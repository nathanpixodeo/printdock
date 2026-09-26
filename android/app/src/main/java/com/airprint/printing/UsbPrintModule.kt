package com.airprint.printing

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/** USB host raw bulk OUT for printer/vendor interfaces. No serial or IPP protocol is inferred. */
class UsbPrintModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private data class Port(val usbInterface: UsbInterface, val out: UsbEndpoint)
    private class PendingConnect(
        val device: UsbDevice,
        val promise: Promise,
        val token: String,
        val generation: Long,
    ) {
        var permissionIntent: PendingIntent? = null
        var timeout: Runnable? = null
        var opening = false
    }
    private class Session(
        val id: Int,
        val device: UsbDevice,
        val port: Port,
        val connection: UsbDeviceConnection,
    )

    private val lock = Any()
    private val usbManager = context.getSystemService(Context.USB_SERVICE) as? UsbManager
    private val connector = Executors.newSingleThreadExecutor()
    private val writer = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var generation = 0L
    private var nextSessionId = 0
    private var pending: PendingConnect? = null
    private var session: Session? = null
    private var queuedWrites = 0
    private var closing = false
    private var disposed = false
    private var detachRegistered = false

    private val detachReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != UsbManager.ACTION_USB_DEVICE_DETACHED) return
            @Suppress("DEPRECATION")
            val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE) ?: return
            val waiting = synchronized(lock) { pending?.takeIf { sameDevice(it.device, device) } }
            if (waiting != null) failPending(waiting, "USB_DISCONNECTED", "USB printer detached during connection.")
            val active = synchronized(lock) { session?.takeIf { sameDevice(it.device, device) } }
            if (active != null) retire(active, notify = true)
        }
    }

    override fun getName() = "PrintDockUsb"

    override fun initialize() {
        super.initialize()
        if (detachRegistered) return
        val filter = IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED)
        if (Build.VERSION.SDK_INT >= 33) {
            reactApplicationContext.registerReceiver(detachReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactApplicationContext.registerReceiver(detachReceiver, filter)
        }
        detachRegistered = true
    }

    @ReactMethod
    fun list(promise: Promise) {
        try {
            val devices = Arguments.createArray()
            manager().deviceList.values.sortedBy { it.deviceName }.forEach { device ->
                if (findPort(device) != null) {
                    devices.pushMap(Arguments.createMap().apply {
                        putString("id", device.deviceName)
                        putString("name", device.productName?.takeIf { it.isNotBlank() } ?: "USB printer")
                        putInt("vendorId", device.vendorId)
                        putInt("productId", device.productId)
                    })
                }
            }
            promise.resolve(devices)
        } catch (error: Exception) {
            promise.reject("USB_LIST_FAILED", "Could not list attached USB printers.", error)
        }
    }

    @ReactMethod
    fun connect(deviceName: String, promise: Promise) {
        try {
            val device = manager().deviceList[deviceName]
                ?: throw IOException("USB printer is not attached.")
            require(findPort(device) != null) { "USB device has no supported bulk OUT interface." }
            val request = synchronized(lock) {
                check(!disposed && !closing && pending == null && session == null) {
                    "Disconnect the previous USB printer before connecting again."
                }
                PendingConnect(device, promise, "$PERMISSION_ACTION_PREFIX${UUID.randomUUID()}", ++generation)
                    .also { pending = it }
            }
            try {
                if (manager().hasPermission(device)) {
                    openAsync(request)
                } else {
                    val flags = PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_CANCEL_CURRENT or
                        (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                    val permissionIntent = PendingIntent.getBroadcast(
                        reactApplicationContext,
                        0,
                        Intent(reactApplicationContext, UsbPermissionReceiver::class.java)
                            .setAction(request.token),
                        flags,
                    )
                    synchronized(lock) {
                        if (pending !== request || disposed) {
                            permissionIntent.cancel()
                            return
                        }
                        request.permissionIntent = permissionIntent
                        permissionRequests[request.token] = this
                        manager().requestPermission(device, permissionIntent)
                        val timeout = Runnable {
                            failPending(request, "USB_PERMISSION_TIMEOUT", "USB permission request timed out.")
                        }
                        request.timeout = timeout
                        mainHandler.postDelayed(timeout, PERMISSION_TIMEOUT_MS)
                    }
                }
            } catch (error: Exception) {
                failPending(request, "USB_CONNECT_FAILED", "Could not request USB access.", error)
            }
        } catch (error: Exception) {
            promise.reject("USB_CONNECT_FAILED", error.message ?: "Could not connect to USB printer.", error)
        }
    }

    private fun onPermissionResult(intent: Intent) {
        val request = synchronized(lock) {
            pending?.takeIf { it.token == intent.action && it.generation == generation }
        } ?: return
        @Suppress("DEPRECATION")
        val returnedDevice = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
        val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
        if (returnedDevice == null || !sameDevice(returnedDevice, request.device) || !granted) {
            failPending(request, "USB_PERMISSION_DENIED", "USB printer permission was denied.")
            return
        }
        try {
            if (!manager().hasPermission(request.device) || !isAttached(request.device)) {
                throw IOException("USB printer permission or attachment was lost.")
            }
            synchronized(lock) {
                if (pending !== request || generation != request.generation) return
                clearPermissionRequest(request) // The UI prompt has completed; opening has no prompt timeout.
            }
            openAsync(request)
        } catch (error: Exception) {
            failPending(request, "USB_CONNECT_FAILED", "USB printer is unavailable after permission.", error)
        }
    }

    private fun openAsync(request: PendingConnect) {
        connector.execute {
            var connection: UsbDeviceConnection? = null
            var claimedPort: Port? = null
            try {
                synchronized(lock) {
                    check(!disposed && pending === request && generation == request.generation) {
                        "Connection cancelled."
                    }
                    request.opening = true
                }
                check(isAttached(request.device) && manager().hasPermission(request.device)) {
                    "USB printer is detached or permission was revoked."
                }
                val port = findPort(request.device)
                    ?: throw IOException("USB printer has no supported bulk OUT interface.")
                val opened = manager().openDevice(request.device)
                    ?: throw IOException("Could not open USB printer.")
                connection = opened
                check(opened.claimInterface(port.usbInterface, true)) {
                    "Could not claim USB printer interface."
                }
                claimedPort = port
                val active: Session
                synchronized(lock) {
                    check(!disposed && pending === request && generation == request.generation && !closing) {
                        "Connection cancelled."
                    }
                    nextSessionId = if (nextSessionId == Int.MAX_VALUE) 1 else nextSessionId + 1
                    active = Session(nextSessionId, request.device, port, opened)
                    session = active
                    pending = null
                    request.opening = false
                    ++generation
                    clearPermissionRequest(request)
                }
                connection = null // The session now owns the connection.
                request.promise.resolve(active.id)
            } catch (error: Exception) {
                connection?.let { closeConnection(it, claimedPort) }
                failPending(request, "USB_CONNECT_FAILED", "Could not connect to USB printer, or connection was cancelled.", error)
            } finally {
                synchronized(lock) {
                    if (request.opening) {
                        request.opening = false
                        closing = false
                    }
                }
            }
        }
    }

    @ReactMethod
    fun write(base64: String, promise: Promise) {
        if (base64.length > MAX_ENCODED_BATCH) {
            promise.reject("USB_WRITE_FAILED", "Printer write batch is too large.")
            return
        }
        val bytes = try {
            Base64.decode(base64, Base64.NO_WRAP).also {
                require(it.isNotEmpty()) { "Printer write batch is empty." }
                require(it.size <= MAX_BATCH_BYTES) { "Printer write batch is too large." }
            }
        } catch (error: IllegalArgumentException) {
            promise.reject("USB_WRITE_FAILED", "Printer write batch is invalid.", error)
            return
        }
        var queueFull = false
        val active = synchronized(lock) {
            val current = session?.takeUnless { disposed }
            if (current != null && queuedWrites >= MAX_QUEUED_WRITES) queueFull = true
            else if (current != null) ++queuedWrites
            current
        }
        if (active == null) {
            promise.reject("USB_NOT_CONNECTED", "USB printer is disconnected.")
            return
        }
        if (queueFull) {
            promise.reject("USB_WRITE_FAILED", "USB printer write queue is full.")
            return
        }
        try {
            writer.execute {
                try {
                    val deadline = SystemClock.elapsedRealtime() + WRITE_DEADLINE_MS
                    var offset = 0
                    while (offset < bytes.size) {
                        synchronized(lock) {
                            check(!disposed && session === active) { "USB printer write cancelled." }
                        }
                        val remaining = deadline - SystemClock.elapsedRealtime()
                        if (remaining <= 0) throw IOException("USB printer write deadline exceeded.")
                        val length = minOf(BULK_CHUNK_BYTES, bytes.size - offset)
                        val written = bulkOut(
                            active, bytes, offset, length,
                            minOf(remaining, BULK_TIMEOUT_MS.toLong()).toInt(),
                        )
                        if (written <= 0 || written > length) throw IOException("USB bulk OUT transfer failed.")
                        offset += written // A short transfer only advances by the bytes actually accepted.
                    }
                    synchronized(lock) {
                        check(!disposed && session === active) { "USB printer disconnected during write." }
                    }
                    promise.resolve(true) // USB accepted the bytes; paper output is not confirmed.
                } catch (error: Exception) {
                    retire(active, notify = true)
                    promise.reject("USB_WRITE_FAILED", "USB write failed; receipt outcome is unknown.", error)
                } finally {
                    synchronized(lock) { --queuedWrites }
                }
            }
        } catch (error: Exception) {
            synchronized(lock) { --queuedWrites }
            promise.reject("USB_WRITE_FAILED", "USB writer is unavailable.", error)
        }
    }

    @ReactMethod
    fun isConnected(promise: Promise) {
        val active = synchronized(lock) { session }
        if (active == null) {
            promise.resolve(false)
            return
        }
        try {
            if (!isAttached(active.device) || !manager().hasPermission(active.device)) {
                retire(active, notify = true)
                promise.resolve(false)
            } else {
                promise.resolve(synchronized(lock) { session === active && !disposed })
            }
        } catch (_: Exception) {
            retire(active, notify = true)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        closeCurrent()
        promise.resolve(true)
    }

    private fun manager(): UsbManager = usbManager ?: throw IOException("USB host is unavailable.")

    private fun sameDevice(first: UsbDevice, second: UsbDevice): Boolean =
        first.deviceName == second.deviceName && first.deviceId == second.deviceId &&
            first.vendorId == second.vendorId && first.productId == second.productId

    private fun isAttached(device: UsbDevice): Boolean =
        manager().deviceList[device.deviceName]?.let { sameDevice(it, device) } == true

    private fun bulkOut(active: Session, bytes: ByteArray, offset: Int, length: Int, timeout: Int): Int =
        if (Build.VERSION.SDK_INT >= 26) {
            active.connection.bulkTransfer(active.port.out, bytes, offset, length, timeout)
        } else {
            // API 23-25 has no offset overload. Copy only this <=4 KiB slice; a short
            // transfer advances the source offset by its actual return value in write().
            val chunk = bytes.copyOfRange(offset, offset + length)
            active.connection.bulkTransfer(active.port.out, chunk, length, timeout)
        }

    private fun findPort(device: UsbDevice): Port? {
        for (index in 0 until device.interfaceCount) {
            val usbInterface = device.getInterface(index)
            if (usbInterface.interfaceClass != UsbConstants.USB_CLASS_PRINTER &&
                usbInterface.interfaceClass != UsbConstants.USB_CLASS_VENDOR_SPEC) continue
            for (endpointIndex in 0 until usbInterface.endpointCount) {
                val endpoint = usbInterface.getEndpoint(endpointIndex)
                if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                    endpoint.direction == UsbConstants.USB_DIR_OUT) return Port(usbInterface, endpoint)
            }
        }
        return null
    }

    private fun clearPermissionRequest(request: PendingConnect) {
        permissionRequests.remove(request.token, this)
        request.timeout?.let { mainHandler.removeCallbacks(it) }
        request.timeout = null
        request.permissionIntent?.cancel()
        request.permissionIntent = null
    }

    private fun failPending(request: PendingConnect, code: String, message: String, error: Exception? = null) {
        val shouldReject = synchronized(lock) {
            if (pending !== request) false
            else {
                pending = null
                if (request.opening) closing = true
                ++generation
                clearPermissionRequest(request)
                true
            }
        }
        if (shouldReject) {
            if (error == null) request.promise.reject(code, message)
            else request.promise.reject(code, message, error)
        }
    }

    private fun retire(active: Session, notify: Boolean) {
        val shouldClose = synchronized(lock) {
            if (session !== active) false
            else {
                session = null
                closing = true
                true
            }
        }
        if (!shouldClose) return
        try {
            closeConnection(active.connection, active.port)
        } finally {
            synchronized(lock) { closing = false }
        }
        if (notify && !synchronized(lock) { disposed }) emitDisconnect(active.id)
    }

    private fun emitDisconnect(sessionId: Int) {
        try {
            if (reactApplicationContext.hasActiveReactInstance()) {
                val event = Arguments.createMap().apply { putInt("sessionId", sessionId) }
                reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("PrintDockUsbDisconnected", event)
            }
        } catch (_: RuntimeException) {
            // React may be torn down between the active check and dispatch.
        }
    }

    private fun closeCurrent() {
        val (waiting, active) = synchronized(lock) {
            val waiting = pending
            if (waiting != null) {
                pending = null
                if (waiting.opening) closing = true
                ++generation
                clearPermissionRequest(waiting)
            }
            val active = session
            if (active != null) {
                session = null
                closing = true
            }
            Pair(waiting, active)
        }
        waiting?.promise?.reject("USB_CONNECT_CANCELLED", "USB connection was cancelled.")
        if (active != null) {
            try {
                closeConnection(active.connection, active.port)
            } finally {
                synchronized(lock) { closing = false }
            }
        }
    }

    private fun closeConnection(connection: UsbDeviceConnection, port: Port?) {
        try {
            if (port != null) connection.releaseInterface(port.usbInterface)
        } catch (_: Exception) {
            // Closing still releases the device, including after physical detach.
        } finally {
            try { connection.close() } catch (_: Exception) { /* Already detached. */ }
        }
    }

    override fun invalidate() {
        synchronized(lock) { disposed = true }
        closeCurrent()
        if (detachRegistered) {
            reactApplicationContext.unregisterReceiver(detachReceiver)
            detachRegistered = false
        }
        connector.shutdown() // Queued tasks still settle their promises after seeing disposed.
        writer.shutdown()
        super.invalidate()
    }

    companion object {
        private const val PERMISSION_ACTION_PREFIX = "com.airprint.printing.USB_PERMISSION."
        private const val PERMISSION_TIMEOUT_MS = 65_000L
        private const val WRITE_DEADLINE_MS = 30_000L
        private const val BULK_TIMEOUT_MS = 2_000
        private const val BULK_CHUNK_BYTES = 4 * 1024
        private const val MAX_BATCH_BYTES = 16 * 1024
        private const val MAX_QUEUED_WRITES = 8
        private const val MAX_ENCODED_BATCH = 4 * ((MAX_BATCH_BYTES + 2) / 3)
        private val permissionRequests = ConcurrentHashMap<String, UsbPrintModule>()

        internal fun deliverPermissionResult(intent: Intent) {
            val token = intent.action ?: return
            if (!token.startsWith(PERMISSION_ACTION_PREFIX)) return
            permissionRequests.remove(token)?.onPermissionResult(intent)
        }
    }
}
