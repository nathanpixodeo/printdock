package com.nexkit.printdock.printing

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Explicit, non-exported target for UsbManager's permission PendingIntent. */
class UsbPermissionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        UsbPrintModule.deliverPermissionResult(intent)
    }
}
