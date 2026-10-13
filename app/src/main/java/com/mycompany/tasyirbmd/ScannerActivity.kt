package com.mycompany.tasyirbmd

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.ResultPoint
import com.journeyapps.barcodescanner.BarcodeCallback
import com.journeyapps.barcodescanner.BarcodeResult
import com.journeyapps.barcodescanner.CameraPreview
import com.journeyapps.barcodescanner.DecoratedBarcodeView
import com.journeyapps.barcodescanner.DefaultDecoderFactory

class ScannerActivity : AppCompatActivity() {

    private lateinit var barcodeView: DecoratedBarcodeView
    private lateinit var status: TextView
    private var multi = false
    private var last = ""
    private var lastTs = 0L
    private var torchOn = false
    private var closing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // حماية إضافية: لا نفتح الكاميرا بدون إذن
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, R.string.perm_msg, Toast.LENGTH_LONG).show()
            finish()
            return
        }

        setContentView(R.layout.activity_scanner)
        multi = intent.getBooleanExtra(EXTRA_MULTI, false)

        barcodeView = findViewById(R.id.barcode_view)
        status = findViewById(R.id.status)
        status.text = getString(R.string.scan_hint)

        val formats = listOf(
            BarcodeFormat.QR_CODE, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39, BarcodeFormat.ITF
        )
        barcodeView.barcodeView.decoderFactory = DefaultDecoderFactory(formats)
        barcodeView.setStatusText("")

        barcodeView.barcodeView.addStateListener(object : CameraPreview.StateListener {
            override fun previewSized() {}
            override fun previewStarted() {}
            override fun previewStopped() {}
            override fun cameraClosed() {}
            override fun cameraError(error: Exception) {
                runOnUiThread {
                    Toast.makeText(this@ScannerActivity, R.string.camera_error, Toast.LENGTH_LONG).show()
                    finish()
                }
            }
        })

        barcodeView.decodeContinuous(object : BarcodeCallback {
            override fun barcodeResult(result: BarcodeResult) {
                val text = result.text?.trim().orEmpty()
                if (text.isNotEmpty()) onCode(text)
            }

            override fun possibleResultPoints(resultPoints: MutableList<ResultPoint>?) {}
        })

        val done = findViewById<Button>(R.id.btn_done)
        done.setOnClickListener { finish() }

        val torch = findViewById<Button>(R.id.btn_torch)
        if (packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH)) {
            torch.setOnClickListener {
                torchOn = !torchOn
                if (torchOn) barcodeView.setTorchOn() else barcodeView.setTorchOff()
            }
        } else {
            torch.isEnabled = false
        }
    }

    private fun onCode(code: String) {
        if (closing) return
        val now = System.currentTimeMillis()
        if (code == last && now - lastTs < 1800) return
        last = code
        lastTs = now

        beep()
        val main = MainActivity.instance
        if (main == null) {
            finish()
            return
        }
        if (!multi) {
            closing = true
            barcodeView.pause()
        }
        main.dispatchScan(code) { ok, msg ->
            if (multi) {
                status.text = (if (ok) "✅ " else "❌ ") + msg
            } else {
                finish()
            }
        }
    }

    private fun beep() {
        try {
            val tg = ToneGenerator(AudioManager.STREAM_MUSIC, 80)
            tg.startTone(ToneGenerator.TONE_PROP_BEEP, 120)
            window.decorView.postDelayed({ tg.release() }, 400)
        } catch (e: Exception) {
        }
    }

    override fun onResume() {
        super.onResume()
        if (::barcodeView.isInitialized && !closing) barcodeView.resume()
    }

    override fun onPause() {
        super.onPause()
        if (::barcodeView.isInitialized) barcodeView.pause()
    }

    companion object {
        const val EXTRA_MULTI = "multi"
    }
}
