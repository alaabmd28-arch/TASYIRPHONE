package com.mycompany.tasyirbmd

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.UUID

/** طباعة ESC/POS عبر Bluetooth Classic (SPP). الإيصال يُرسم كصورة في الواجهة (يدعم العربية) ويُرسل raster */
object BtPrinter {
    private val SPP: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    fun hasPerm(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 31 ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun adapter(ctx: Context) =
        (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    @SuppressLint("MissingPermission")
    fun bonded(ctx: Context): JSONArray {
        val a = JSONArray()
        val ad = adapter(ctx) ?: return a
        for (d in ad.bondedDevices ?: emptySet()) {
            a.put(JSONObject().put("name", d.name ?: d.address).put("mac", d.address))
        }
        return a
    }

    /** يعيد null عند النجاح أو رمز الخطأ: nobt/off/nodev/conn/io/img */
    @SuppressLint("MissingPermission")
    fun print(ctx: Context, mac: String, png: ByteArray, widthDots: Int): String? {
        val ad = adapter(ctx) ?: return "nobt"
        if (!ad.isEnabled) return "off"
        val dev = try { ad.getRemoteDevice(mac) } catch (e: Exception) { return "nodev" }
        val bmp = BitmapFactory.decodeByteArray(png, 0, png.size) ?: return "img"
        var sock: BluetoothSocket? = null
        try {
            ad.cancelDiscovery()
            sock = dev.createRfcommSocketToServiceRecord(SPP)
            sock.connect()
            val os = sock.outputStream
            val w = widthDots
            val h = (bmp.height * w.toFloat() / bmp.width).toInt().coerceAtLeast(1)
            val sc = if (bmp.width == w) bmp else Bitmap.createScaledBitmap(bmp, w, h, true)
            val wb = (w + 7) / 8
            val px = IntArray(w * h)
            sc.getPixels(px, 0, w, 0, 0, w, h)
            os.write(byteArrayOf(0x1B, 0x40))
            var y = 0
            while (y < h) {
                val n = minOf(64, h - y)
                val buf = ByteArray(8 + wb * n)
                buf[0] = 0x1D; buf[1] = 0x76; buf[2] = 0x30; buf[3] = 0x00
                buf[4] = (wb % 256).toByte(); buf[5] = (wb / 256).toByte()
                buf[6] = (n % 256).toByte(); buf[7] = (n / 256).toByte()
                for (r in 0 until n) {
                    for (x in 0 until w) {
                        val c = px[(y + r) * w + x]
                        val lum = (((c shr 16) and 255) * 299 + ((c shr 8) and 255) * 587 + (c and 255) * 114) / 1000
                        if ((c ushr 24) > 127 && lum < 140) {
                            val i = 8 + r * wb + x / 8
                            buf[i] = (buf[i].toInt() or (0x80 shr (x % 8))).toByte()
                        }
                    }
                }
                os.write(buf)
                os.flush()
                Thread.sleep(40)
                y += n
            }
            os.write(byteArrayOf(0x1B, 0x64, 0x04))
            os.write(byteArrayOf(0x1D, 0x56, 0x42, 0x00))
            os.flush()
            Thread.sleep(400)
            return null
        } catch (e: IOException) {
            return if (sock?.isConnected == true) "io" else "conn"
        } finally {
            try { sock?.close() } catch (e: Exception) { }
        }
    }
}
