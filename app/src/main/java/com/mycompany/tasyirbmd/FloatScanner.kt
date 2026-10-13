package com.mycompany.tasyirbmd

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Size
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors
import kotlin.math.abs

/**
 * ماسح عائم أصلي فوق الـ WebView: قابل للسحب والتكبير/التصغير، زوم 1x/2x/3x،
 * مصباح، تبديل الكاميرا، مسح متواصل، عدة رموز في الإطار، ووضع "بحث".
 */
class FloatScanner(
    private val act: MainActivity,
    private val root: FrameLayout,
    private var continuous: Boolean,
    private val onFail: () -> Unit
) {
    private val dm = act.resources.displayMetrics
    private fun dp(v: Int) = (v * dm.density).toInt()

    private val card = LinearLayout(act)
    private val previewBox = FrameLayout(act)
    private val preview = PreviewView(act)
    private val flashView = View(act)
    private val msg = TextView(act)
    private val zoomChip = TextView(act)
    private val torchBtn = ImageButton(act)
    private val expandBtn = ImageButton(act)

    private var provider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var front = false
    private var torchOn = false
    private var zoomIdx = 0
    private val zooms = floatArrayOf(1f, 2f, 3f)
    private var expanded = false
    private var multiFrame = false
    private var lookup = false
    private var closed = false
    private val recent = HashMap<String, Long>()
    private val exec = Executors.newSingleThreadExecutor()
    private var tone: ToneGenerator? = null
    private var normW = 0
    private var normX = 0f
    private var normY = 0f
    private val prefs = act.getSharedPreferences("tasyir_scan", Context.MODE_PRIVATE)

    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A,
                Barcode.FORMAT_UPC_E, Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39,
                Barcode.FORMAT_ITF, Barcode.FORMAT_QR_CODE
            )
            .build()
    )

    private fun round(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius).toFloat()
    }

    private fun circle(color: Int) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
    }

    private fun tb(res: Int, bg: Int, fg: Int, onClick: (TextView) -> Unit): TextView {
        val t = TextView(act)
        val ico = ContextCompat.getDrawable(act, res)!!.mutate()
        ico.setTint(fg)
        ico.setBounds(0, 0, dp(18), dp(18))
        t.setCompoundDrawablesRelative(ico, null, null, null)
        t.setPaddingRelative(dp(10), 0, 0, 0)
        t.gravity = Gravity.CENTER
        t.textSize = 16f
        t.setTextColor(fg)
        t.background = circle(bg)
        val lp = LinearLayout.LayoutParams(dp(38), dp(38))
        lp.setMargins(dp(3), 0, dp(3), 0)
        t.layoutParams = lp
        t.setOnClickListener { onClick(t) }
        return t
    }

    private fun icon(btn: ImageButton, res: Int, gravity: Int, onClick: () -> Unit) {
        btn.setImageResource(res)
        btn.background = circle(0x99000000.toInt())
        btn.setPadding(dp(6), dp(6), dp(6), dp(6))
        btn.scaleType = android.widget.ImageView.ScaleType.FIT_CENTER
        val lp = FrameLayout.LayoutParams(dp(34), dp(34), gravity)
        lp.setMargins(dp(8), dp(8), dp(8), dp(8))
        btn.layoutParams = lp
        btn.setOnClickListener { onClick() }
        previewBox.addView(btn)
    }

    @SuppressLint("ClickableViewAccessibility")
    fun start() {
        val w = (dm.widthPixels * 0.62f).toInt()
        normW = w
        card.orientation = LinearLayout.VERTICAL
        card.background = round(0xFF3E4145.toInt(), 24)
        card.clipToOutline = true
        card.outlineProvider = ViewOutlineProvider.BACKGROUND
        card.elevation = dp(14).toFloat()
        card.layoutParams = FrameLayout.LayoutParams(w, ViewGroup.LayoutParams.WRAP_CONTENT)

        previewBox.setBackgroundColor(Color.BLACK)
        previewBox.layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (w * 0.8f).toInt())
        preview.scaleType = PreviewView.ScaleType.FILL_CENTER
        previewBox.addView(preview, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        flashView.setBackgroundColor(0x5500E676)
        flashView.visibility = View.GONE
        previewBox.addView(flashView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        icon(ImageButton(act), R.drawable.ic_sc_close, Gravity.TOP or Gravity.END) { close() }
        icon(torchBtn, R.drawable.ic_sc_flash, Gravity.TOP or Gravity.START) { toggleTorch() }
        icon(expandBtn, R.drawable.ic_sc_full, Gravity.BOTTOM or Gravity.START) { toggleExpand() }

        zoomChip.text = "1x"
        zoomChip.setTextColor(Color.WHITE)
        zoomChip.textSize = 13f
        zoomChip.gravity = Gravity.CENTER
        zoomChip.background = round(0x99000000.toInt(), 17)
        val zl = FrameLayout.LayoutParams(dp(44), dp(34), Gravity.BOTTOM or Gravity.END)
        zl.setMargins(dp(8), dp(8), dp(8), dp(8))
        previewBox.addView(zoomChip, zl)
        zoomChip.setOnClickListener { cycleZoom() }
        card.addView(previewBox)

        msg.setTextColor(Color.WHITE)
        msg.textSize = 13f
        msg.gravity = Gravity.CENTER
        msg.setPadding(dp(8), dp(6), dp(8), dp(2))
        msg.maxLines = 2
        msg.visibility = View.GONE
        card.addView(msg)

        val bar = LinearLayout(act)
        bar.orientation = LinearLayout.HORIZONTAL
        bar.gravity = Gravity.CENTER
        bar.setPadding(dp(6), dp(8), dp(6), dp(10))
        bar.addView(tb(R.drawable.ic_sc_grid, Color.WHITE, Color.BLACK) { v ->
            multiFrame = !multiFrame
            v.background = circle(if (multiFrame) 0xFF00E676.toInt() else Color.WHITE)
        })
        bar.addView(tb(R.drawable.ic_sc_search, Color.WHITE, Color.BLACK) { v ->
            lookup = !lookup
            v.background = circle(if (lookup) 0xFF00E676.toInt() else Color.WHITE)
            act.runJs("window._lk=" + lookup)
        })
        val sep = View(act)
        sep.setBackgroundColor(0x66FFFFFF)
        bar.addView(sep, LinearLayout.LayoutParams(dp(1), dp(30)).apply { setMargins(dp(4), 0, dp(4), 0) })
        bar.addView(tb(R.drawable.ic_sc_infinity, if (continuous) 0xFF00E676.toInt() else 0x33FFFFFF, Color.WHITE) { v ->
            continuous = !continuous
            v.background = circle(if (continuous) 0xFF00E676.toInt() else 0x33FFFFFF)
        })
        bar.addView(tb(R.drawable.ic_sc_flip, 0x33FFFFFF, Color.WHITE) {
            front = !front
            bind()
        })
        card.addView(bar)

        preview.setOnTouchListener(dragTouch())
        root.addView(card)

        val sx = prefs.getFloat("x", -1f)
        val sy = prefs.getFloat("y", -1f)
        card.post {
            normX = if (sx >= 0f) sx else ((root.width - card.width) / 2f)
            normY = if (sy >= 0f) sy else dp(120).toFloat()
            card.x = normX.coerceIn(0f, (root.width - card.width).toFloat().coerceAtLeast(0f))
            card.y = normY.coerceIn(0f, (root.height - card.height).toFloat().coerceAtLeast(0f))
        }
        act.runJs("window._lk=false")

        val f = ProcessCameraProvider.getInstance(act)
        f.addListener({
            try {
                provider = f.get()
                bind()
            } catch (e: Exception) {
                fail()
            }
        }, ContextCompat.getMainExecutor(act))
    }

    private var dx = 0f
    private var dy = 0f
    private var sx0 = 0f
    private var sy0 = 0f
    private var moved = false

    @SuppressLint("ClickableViewAccessibility")
    private fun dragTouch() = View.OnTouchListener { _, e ->
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                dx = card.x - e.rawX
                dy = card.y - e.rawY
                sx0 = e.rawX
                sy0 = e.rawY
                moved = false
            }
            MotionEvent.ACTION_MOVE -> {
                if (!expanded && (abs(e.rawX - sx0) > dp(8) || abs(e.rawY - sy0) > dp(8))) moved = true
                if (moved) {
                    card.x = (e.rawX + dx).coerceIn(0f, (root.width - card.width).toFloat().coerceAtLeast(0f))
                    card.y = (e.rawY + dy).coerceIn(0f, (root.height - card.height).toFloat().coerceAtLeast(0f))
                }
            }
            MotionEvent.ACTION_UP -> {
                if (moved) {
                    normX = card.x
                    normY = card.y
                    prefs.edit().putFloat("x", normX).putFloat("y", normY).apply()
                } else {
                    focusAt(e.x, e.y)
                }
            }
        }
        true
    }

    private fun focusAt(x: Float, y: Float) {
        try {
            val pt = preview.meteringPointFactory.createPoint(x, y)
            camera?.cameraControl?.startFocusAndMetering(FocusMeteringAction.Builder(pt).build())
        } catch (e: Exception) {
        }
    }

    private fun bind() {
        val p = provider ?: return
        if (closed) return
        try {
            p.unbindAll()
            val sel = if (front) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
            if (!p.hasCamera(sel)) {
                front = !front
                return
            }
            val prev = Preview.Builder().build()
            prev.setSurfaceProvider(preview.surfaceProvider)
            @Suppress("DEPRECATION")
            val ana = ImageAnalysis.Builder()
                .setTargetResolution(Size(1280, 720))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            ana.setAnalyzer(exec) { proxy -> analyze(proxy) }
            camera = p.bindToLifecycle(act, sel, prev, ana)
            zoomIdx = 0
            zoomChip.text = "1x"
            torchOn = false
            torchBtn.alpha = 1f
        } catch (e: Exception) {
            fail()
        }
    }

    @Suppress("UnsafeOptInUsageError")
    private fun analyze(proxy: ImageProxy) {
        val img = proxy.image
        if (img == null || closed) {
            proxy.close()
            return
        }
        val input = InputImage.fromMediaImage(img, proxy.imageInfo.rotationDegrees)
        scanner.process(input)
            .addOnSuccessListener { list ->
                val codes = list.mapNotNull { it.rawValue?.trim() }.filter { it.isNotEmpty() }
                if (codes.isNotEmpty() && !closed) onCodes(if (multiFrame) codes else listOf(codes[0]))
            }
            .addOnCompleteListener { proxy.close() }
    }

    private fun onCodes(codes: List<String>) {
        val now = System.currentTimeMillis()
        for (c in codes) {
            val t = recent[c]
            if (t != null && now - t < 1500) continue
            recent[c] = now
            act.dispatchScan(c) { ok, m -> feedback(ok, m, c) }
        }
    }

    private fun feedback(ok: Boolean, m: String, code: String) {
        if (closed) return
        if (ok) {
            beep()
            buzz()
            flashView.visibility = View.VISIBLE
            flashView.postDelayed({ flashView.visibility = View.GONE }, 140)
            msg.text = "✓ $m"
            msg.setTextColor(0xFF69F0AE.toInt())
            msg.setOnClickListener(null)
        } else {
            msg.text = "✕ $m  ＋"
            msg.setTextColor(0xFFFFAB91.toInt())
            msg.setOnClickListener { act.notFound(code) }
        }
        msg.visibility = View.VISIBLE
        if (ok && !continuous) close()
    }

    private fun beep() {
        try {
            if (tone == null) tone = ToneGenerator(AudioManager.STREAM_MUSIC, 80)
            tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 110)
        } catch (e: Exception) {
        }
    }

    @Suppress("DEPRECATION")
    private fun buzz() {
        try {
            val v = act.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE))
            else v.vibrate(40)
        } catch (e: Exception) {
        }
    }

    private fun toggleTorch() {
        val cam = camera ?: return
        if (!cam.cameraInfo.hasFlashUnit()) return
        torchOn = !torchOn
        cam.cameraControl.enableTorch(torchOn)
        torchBtn.alpha = if (torchOn) 0.6f else 1f
        torchBtn.background = circle(if (torchOn) 0xFFFFC107.toInt() else 0x99000000.toInt())
    }

    private fun cycleZoom() {
        val cam = camera ?: return
        zoomIdx = (zoomIdx + 1) % zooms.size
        val max = cam.cameraInfo.zoomState.value?.maxZoomRatio ?: 1f
        val r = zooms[zoomIdx].coerceAtMost(max)
        cam.cameraControl.setZoomRatio(r)
        zoomChip.text = "${zooms[zoomIdx].toInt()}x"
    }

    private fun toggleExpand() {
        expanded = !expanded
        val lp = card.layoutParams
        val pl = previewBox.layoutParams
        if (expanded) {
            lp.width = root.width - dp(24)
            pl.height = (root.height * 0.55f).toInt()
            card.layoutParams = lp
            previewBox.layoutParams = pl
            card.x = dp(12).toFloat()
            card.y = dp(56).toFloat()
            expandBtn.setImageResource(R.drawable.ic_sc_shrink)
        } else {
            lp.width = normW
            pl.height = (normW * 0.8f).toInt()
            card.layoutParams = lp
            previewBox.layoutParams = pl
            card.x = normX.coerceIn(0f, (root.width - normW).toFloat().coerceAtLeast(0f))
            card.y = normY
            expandBtn.setImageResource(R.drawable.ic_sc_full)
        }
    }

    private fun fail() {
        close()
        onFail()
    }

    fun close() {
        if (closed) return
        closed = true
        try { provider?.unbindAll() } catch (e: Exception) { }
        try { scanner.close() } catch (e: Exception) { }
        try { root.removeView(card) } catch (e: Exception) { }
        try { exec.shutdown() } catch (e: Exception) { }
        try { tone?.release() } catch (e: Exception) { }
        act.runJs("window._lk=false")
        act.floatScanner = null
    }
}
