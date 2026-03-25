package app.lovable.scale

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.io.InputStream
import java.util.UUID

/**
 * AndroidBridge methods for Bluetooth serial scale communication.
 *
 * Add to your WebView setup:
 *   val scaleBridge = BluetoothScaleBridge(webView)
 *   webView.addJavascriptInterface(scaleBridge, "AndroidScaleBridge")
 *
 * Then merge into your existing AndroidBridge JS interface, or call
 * the ScaleBridgeInjector to wire it up.
 */
class BluetoothScaleBridge(private val webView: WebView) {

    private val bluetoothAdapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    private var socket: BluetoothSocket? = null
    private var inputStream: InputStream? = null
    private var readThread: Thread? = null
    private var lastWeight: String = ""
    private val handler = Handler(Looper.getMainLooper())

    // Standard SPP UUID for serial communication
    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    @JavascriptInterface
    fun listPairedDevices(): String {
        val adapter = bluetoothAdapter ?: return "[]"
        val devices = adapter.bondedDevices ?: return "[]"
        val arr = JSONArray()
        for (device in devices) {
            val obj = JSONObject()
            obj.put("name", device.name ?: "Desconhecido")
            obj.put("address", device.address)
            arr.put(obj)
        }
        return arr.toString()
    }

    @JavascriptInterface
    fun connectScale(address: String, baudRate: Int): Boolean {
        // baudRate is informational for BT serial (SPP uses default)
        disconnect()
        val adapter = bluetoothAdapter ?: return false
        val device: BluetoothDevice = try {
            adapter.getRemoteDevice(address)
        } catch (e: Exception) {
            postError("Endereço Bluetooth inválido: $address")
            return false
        }

        // Cancel discovery to speed up connection
        try { adapter.cancelDiscovery() } catch (_: Exception) {}

        return try {
            val s = device.createRfcommSocketToServiceRecord(SPP_UUID)
            s.connect()
            socket = s
            inputStream = s.inputStream
            lastWeight = ""
            startReading()
            postCallback("__scale_connected")
            true
        } catch (e: IOException) {
            // Fallback: reflection method for some devices
            try {
                val m = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                val s = m.invoke(device, 1) as BluetoothSocket
                s.connect()
                socket = s
                inputStream = s.inputStream
                lastWeight = ""
                startReading()
                postCallback("__scale_connected")
                true
            } catch (e2: Exception) {
                postError("Falha ao conectar: ${e2.message}")
                false
            }
        }
    }

    @JavascriptInterface
    fun disconnectScale() {
        disconnect()
        postCallback("__scale_disconnected")
    }

    @JavascriptInterface
    fun isScaleConnected(): Boolean {
        return socket?.isConnected == true
    }

    @JavascriptInterface
    fun readScale(): String {
        // Send ENQ (0x05) to request weight if connected
        try {
            socket?.outputStream?.write(byteArrayOf(0x05))
            socket?.outputStream?.flush()
            // Wait briefly for response
            Thread.sleep(300)
        } catch (_: Exception) {}
        return lastWeight
    }

    private fun startReading() {
        readThread?.interrupt()
        readThread = Thread {
            val buffer = ByteArray(256)
            val sb = StringBuilder()
            while (!Thread.currentThread().isInterrupted) {
                try {
                    val stream = inputStream ?: break
                    val bytesRead = stream.read(buffer)
                    if (bytesRead > 0) {
                        val chunk = String(buffer, 0, bytesRead)
                        sb.append(chunk)

                        // Try to extract weight from buffer
                        val data = sb.toString()
                        val weight = parseWeight(data)
                        if (weight != null) {
                            lastWeight = weight
                            sb.clear()
                            // Notify web
                            handler.post {
                                webView.evaluateJavascript(
                                    "if(window.__scale_weight) window.__scale_weight('$weight');",
                                    null
                                )
                            }
                        }

                        // Prevent buffer overflow
                        if (sb.length > 1024) {
                            sb.delete(0, sb.length - 256)
                        }
                    }
                } catch (e: IOException) {
                    if (!Thread.currentThread().isInterrupted) {
                        handler.post {
                            postCallback("__scale_disconnected")
                        }
                    }
                    break
                }
            }
        }.apply {
            isDaemon = true
            start()
        }
    }

    /**
     * Parse weight from serial data.
     * Supports Toledo Prix 3 protocol (STX...ETX) and plain numeric values.
     */
    private fun parseWeight(data: String): String? {
        // Toledo protocol: STX (0x02) + payload + ETX (0x03)
        val stxIdx = data.indexOf('\u0002')
        val etxIdx = data.indexOf('\u0003', if (stxIdx >= 0) stxIdx else 0)
        if (stxIdx >= 0 && etxIdx > stxIdx) {
            val payload = data.substring(stxIdx + 1, etxIdx).trim()
            val match = Regex("(\\d+\\.?\\d*)").find(payload)
            if (match != null) {
                val value = match.value.toDoubleOrNull() ?: return null
                val kg = if (value > 100) value / 1000.0 else value
                return String.format("%.3f", kg)
            }
        }

        // Plain numeric: look for a line with a number
        val lines = data.split("\n", "\r\n", "\r")
        for (line in lines.reversed()) {
            val trimmed = line.trim()
            if (trimmed.isEmpty()) continue
            val match = Regex("(\\d+[.,]?\\d*)").find(trimmed)
            if (match != null) {
                val value = match.value.replace(',', '.').toDoubleOrNull() ?: continue
                if (value in 0.001..999.0) {
                    return String.format("%.3f", value)
                }
            }
        }
        return null
    }

    private fun disconnect() {
        readThread?.interrupt()
        readThread = null
        try { inputStream?.close() } catch (_: Exception) {}
        try { socket?.close() } catch (_: Exception) {}
        inputStream = null
        socket = null
        lastWeight = ""
    }

    private fun postError(msg: String) {
        handler.post {
            webView.evaluateJavascript(
                "if(window.__scale_error) window.__scale_error('${msg.replace("'", "\\'")}');",
                null
            )
        }
    }

    private fun postCallback(name: String) {
        handler.post {
            webView.evaluateJavascript("if(window.$name) window.$name();", null)
        }
    }
}
