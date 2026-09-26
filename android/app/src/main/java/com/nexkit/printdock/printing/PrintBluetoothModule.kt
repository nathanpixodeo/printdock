package com.nexkit.printdock.printing

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException
import java.util.UUID
import java.util.concurrent.Executors

/** Paired Bluetooth Classic SPP only. No discovery, payload logging, or automatic retry. */
@SuppressLint("MissingPermission") // JS requests runtime permissions; native calls still reject SecurityException.
class PrintBluetoothModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val lock = Any()
    private val connector = Executors.newSingleThreadExecutor()
    private val writer = Executors.newSingleThreadExecutor()
    private val reader = Executors.newSingleThreadExecutor()
    private var epoch = 0L
    private var pending: BluetoothSocket? = null
    private var connected: BluetoothSocket? = null
    private val closing = mutableSetOf<BluetoothSocket>()
    private var disposed = false

    override fun getName() = "PrintDockBluetooth"

    private fun adapter(): BluetoothAdapter =
        (reactApplicationContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)
            ?.adapter ?: throw IOException("This device has no Bluetooth adapter.")

    @ReactMethod
    fun isEnabled(promise: Promise) {
        try {
            promise.resolve(adapter().isEnabled)
        } catch (error: Exception) {
            promise.reject("BLUETOOTH_UNAVAILABLE", "Bluetooth is unavailable or permission was revoked.", error)
        }
    }

    @ReactMethod
    fun list(promise: Promise) {
        try {
            val bluetooth = adapter()
            if (!bluetooth.isEnabled) throw IOException("Turn on Bluetooth in Android Settings.")
            val devices = Arguments.createArray()
            bluetooth.bondedDevices.sortedBy { it.address }.forEach { device ->
                devices.pushMap(Arguments.createMap().apply {
                    putString("id", device.address)
                    putString("address", device.address)
                    putString("name", device.name ?: "Bluetooth printer")
                })
            }
            promise.resolve(devices)
        } catch (error: Exception) {
            promise.reject("BLUETOOTH_LIST_FAILED", "Cannot list paired printers. Check Bluetooth and nearby-device permissions.", error)
        }
    }

    @ReactMethod
    fun isConnected(promise: Promise) {
        promise.resolve(synchronized(lock) { connected?.isConnected == true })
    }

    @ReactMethod
    fun connect(address: String, promise: Promise) {
        try {
            require(BluetoothAdapter.checkBluetoothAddress(address)) { "Invalid printer address." }
            val bluetooth = adapter()
            check(bluetooth.isEnabled) { "Turn on Bluetooth in Android Settings." }
            val socket: BluetoothSocket
            val generation: Long
            synchronized(lock) {
                check(!disposed && pending == null && connected == null && closing.isEmpty()) {
                    "Disconnect the previous printer before connecting again."
                }
                socket = bluetooth.getRemoteDevice(address).createRfcommSocketToServiceRecord(SPP_UUID)
                generation = ++epoch
                pending = socket
            }
            connector.execute {
                try {
                    // cancelDiscovery requires BLUETOOTH_SCAN on API 31+, also requested by the service.
                    bluetooth.cancelDiscovery()
                    socket.connect()
                    synchronized(lock) {
                        check(!disposed && epoch == generation && pending === socket) { "Connection cancelled." }
                        pending = null
                        connected = socket
                    }
                    reader.execute { observeDisconnect(socket, generation) }
                    promise.resolve(generation.toDouble())
                } catch (error: Exception) {
                    retire(socket, generation, notify = false)
                    promise.reject("BLUETOOTH_CONNECT_FAILED", "Could not connect to the paired printer, or connection was cancelled.", error)
                }
            }
        } catch (error: Exception) {
            promise.reject("BLUETOOTH_CONNECT_FAILED", error.message ?: "Could not connect to the printer.", error)
        }
    }

    @ReactMethod
    fun write(base64: String, promise: Promise) {
        // Bound the bridge payload; the decoded batch is still written in 4 KiB SPP chunks.
        if (base64.length > MAX_ENCODED_BATCH) {
            promise.reject("BLUETOOTH_WRITE_FAILED", "Printer write batch is too large.")
            return
        }
        val bytes = try {
            Base64.decode(base64, Base64.NO_WRAP).also {
                require(it.isNotEmpty()) { "Printer write batch is empty." }
                require(it.size <= MAX_BATCH_BYTES) { "Printer write batch is too large." }
            }
        } catch (error: IllegalArgumentException) {
            promise.reject("BLUETOOTH_WRITE_FAILED", "Printer write batch is invalid.", error)
            return
        }
        val socket: BluetoothSocket
        val generation: Long
        synchronized(lock) {
            val current = connected
            if (disposed || current == null) {
                promise.reject("BLUETOOTH_NOT_CONNECTED", "Printer is disconnected.")
                return
            }
            socket = current
            generation = epoch
        }
        try {
            writer.execute {
                try {
                    val output = socket.outputStream
                    for (offset in bytes.indices step SPP_CHUNK_BYTES) {
                        synchronized(lock) {
                            check(epoch == generation && connected === socket && socket.isConnected) { "Printer write cancelled." }
                        }
                        output.write(bytes, offset, minOf(SPP_CHUNK_BYTES, bytes.size - offset))
                        synchronized(lock) {
                            check(epoch == generation && connected === socket && socket.isConnected) { "Printer disconnected during write." }
                        }
                    }
                    promise.resolve(true) // Transport write only; physical paper output is not confirmed.
                } catch (error: Exception) {
                    retire(socket, generation, notify = true)
                    promise.reject("BLUETOOTH_WRITE_FAILED", "Printer write failed; receipt outcome is unknown.", error)
                }
            }
        } catch (error: Exception) {
            promise.reject("BLUETOOTH_WRITE_FAILED", "Bluetooth writer is unavailable.", error)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        // This runs independently of the blocking writer/connector, so closing the socket cancels I/O.
        val failures = closeSession()
        if (failures == null) promise.resolve(true)
        else promise.reject("BLUETOOTH_DISCONNECT_FAILED", "Printer cleanup failed. Retry stopping the server.", failures)
    }

    private fun observeDisconnect(socket: BluetoothSocket, generation: Long) {
        try {
            val bytes = ByteArray(1024)
            while (socket.inputStream.read(bytes) != -1) {
                // Drain optional printer status without retaining or logging receipt data.
            }
        } catch (_: Exception) {
            // A closed socket, range loss, or a powered-off printer all terminate this session.
        } finally {
            retire(socket, generation, notify = true)
        }
    }

    private fun retire(socket: BluetoothSocket, generation: Long, notify: Boolean) {
        val notifyCurrent = synchronized(lock) {
            val current = epoch == generation && (pending === socket || connected === socket)
            if (current) {
                ++epoch
                pending = null
                connected = null
            }
            closing.add(socket)
            current && notify && !disposed
        }
        closeSocket(socket)
        if (notifyCurrent) {
            try {
                if (reactApplicationContext.hasActiveReactInstance()) {
                    val event = Arguments.createMap().apply { putDouble("sessionId", generation.toDouble()) }
                    reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("PrintDockBluetoothDisconnected", event)
                }
            } catch (_: RuntimeException) {
                // The React instance may be torn down between the active check and event dispatch.
            }
        }
    }

    private fun closeSocket(socket: BluetoothSocket): Exception? = try {
        socket.close()
        synchronized(lock) { closing.remove(socket) }
        null
    } catch (error: Exception) {
        error // Retain in closing: a new connection cannot overtake incomplete cleanup.
    }

    private fun closeSession(): Exception? {
        val sockets = synchronized(lock) {
            ++epoch
            pending?.let { closing.add(it) }
            connected?.let { closing.add(it) }
            pending = null
            connected = null
            closing.toList()
        }
        var failure: Exception? = null
        sockets.forEach { socket -> closeSocket(socket)?.let { failure = it } }
        return failure
    }

    override fun invalidate() {
        synchronized(lock) { disposed = true }
        closeSession()
        connector.shutdownNow()
        writer.shutdownNow()
        reader.shutdownNow()
        super.invalidate()
    }

    private companion object {
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        const val SPP_CHUNK_BYTES = 4096
        const val MAX_BATCH_BYTES = 16 * 1024
        const val MAX_ENCODED_BATCH = 4 * ((MAX_BATCH_BYTES + 2) / 3)
    }
}
