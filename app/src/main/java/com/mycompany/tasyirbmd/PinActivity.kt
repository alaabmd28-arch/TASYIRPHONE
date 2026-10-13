package com.mycompany.tasyirbmd

import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

/** شاشة إدخال PIN: تُعرض فوق التطبيق ولا يمكن تجاوزها بزر الرجوع */
class PinActivity : AppCompatActivity() {

    private val buf = StringBuilder()
    private lateinit var dots: TextView
    private lateinit var msg: TextView
    private val keys = ArrayList<Button>()
    private val handler = Handler(Looper.getMainLooper())
    private var ticker: Runnable? = null
    private var lang = "ar"

    private fun tr(ar: String, fr: String, en: String) = when (lang) { "fr" -> fr; "en" -> en; else -> ar }
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        isShowing = true
        lang = PinManager.lang(this)
        if (PinManager.secure(this)) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(0xFFFFFFFF.toInt())
            setPadding(dp(24), dp(24), dp(24), dp(24))
        }
        root.addView(TextView(this).apply {
            text = tr("أدخل كلمة السر", "Entrez le code PIN", "Enter your PIN")
            textSize = 22f
            setTextColor(0xFF0F766E.toInt())
            gravity = Gravity.CENTER
        })
        dots = TextView(this).apply {
            textSize = 30f
            gravity = Gravity.CENTER
            setTextColor(0xFF0F172A.toInt())
            minHeight = dp(56)
        }
        root.addView(dots)
        msg = TextView(this).apply {
            textSize = 15f
            gravity = Gravity.CENTER
            setTextColor(0xFFB91C1C.toInt())
            minHeight = dp(28)
        }
        root.addView(msg)

        val labels = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓")
        for (r in 0 until 4) {
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }
            for (c in 0 until 3) {
                val label = labels[r * 3 + c]
                val b = Button(this).apply {
                    text = label
                    textSize = 22f
                    setOnClickListener { onKey(label) }
                }
                keys.add(b)
                row.addView(b, LinearLayout.LayoutParams(dp(84), dp(64)).apply { setMargins(dp(6), dp(6), dp(6), dp(6)) })
            }
            root.addView(row)
        }
        root.addView(Button(this).apply {
            text = tr("نسيت كلمة السر؟", "PIN oublié ?", "Forgot PIN?")
            setOnClickListener { forgot() }
        })
        setContentView(root)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                moveTaskToBack(true)
            }
        })
        refreshLock()
    }

    private fun onKey(k: String) {
        when (k) {
            "⌫" -> if (buf.isNotEmpty()) buf.deleteCharAt(buf.length - 1)
            "✓" -> submit()
            else -> if (buf.length < 6) buf.append(k)
        }
        dots.text = "●".repeat(buf.length)
    }

    private fun submit() {
        if (buf.length < 4) return
        when (PinManager.check(this, buf.toString())) {
            PinManager.OK -> unlock()
            PinManager.WRONG -> {
                window.decorView.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                msg.text = tr("كلمة السر خاطئة", "Code incorrect", "Wrong PIN")
            }
            else -> {
                window.decorView.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                refreshLock()
            }
        }
        buf.setLength(0)
        dots.text = ""
    }

    private fun unlock() {
        PinManager.locked = false
        PinManager.skipNext = true
        finish()
    }

    /** يعطّل لوحة الأرقام أثناء القفل التصاعدي ويعرض العدّاد */
    private fun refreshLock() {
        ticker?.let { handler.removeCallbacks(it) }
        val rem = PinManager.lockRemaining(this)
        if (rem <= 0) {
            keys.forEach { it.isEnabled = true }
            return
        }
        keys.forEach { it.isEnabled = false }
        msg.text = tr("محاولات كثيرة. انتظر ", "Trop d'essais. Attendez ", "Too many attempts. Wait ") + (rem / 1000 + 1) + "s"
        val r = Runnable { refreshLock() }
        ticker = r
        handler.postDelayed(r, 1000)
    }

    private fun forgot() {
        val et = EditText(this).apply {
            hint = "XXXX-XXXX-XXXX"
            setSingleLine()
        }
        AlertDialog.Builder(this)
            .setTitle(tr("مفتاح الاسترجاع", "Clé de récupération", "Recovery key"))
            .setView(et)
            .setPositiveButton(android.R.string.ok) { _, _ ->
                if (PinManager.checkRecovery(this, et.text.toString())) {
                    PinManager.disable(this)
                    Toast.makeText(this, tr("أُلغيت كلمة السر. يمكنك إنشاء واحدة جديدة من الإعدادات.", "PIN supprimé. Créez-en un nouveau dans les réglages.", "PIN removed. Create a new one in Settings."), Toast.LENGTH_LONG).show()
                    unlock()
                } else {
                    msg.text = tr("المفتاح غير صحيح", "Clé incorrecte", "Wrong key")
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    override fun onDestroy() {
        ticker?.let { handler.removeCallbacks(it) }
        isShowing = false
        super.onDestroy()
    }

    companion object {
        @Volatile var isShowing = false
    }
}
