package com.mycompany.tasyirbmd

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class LicenseActivity : AppCompatActivity() {

    private lateinit var tvStatus: TextView
    private lateinit var tvMsg: TextView
    private lateinit var etCode: EditText
    private lateinit var btnBack: Button
    private var required = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_license)
        isShowing = true
        required = intent.getBooleanExtra(EXTRA_REQUIRED, false)

        tvStatus = findViewById(R.id.tv_status)
        tvMsg = findViewById(R.id.tv_msg)
        etCode = findViewById(R.id.et_code)
        btnBack = findViewById(R.id.btn_back)

        val device = LicenseManager.deviceId(this)
        findViewById<TextView>(R.id.tv_device).text = device
        findViewById<Button>(R.id.btn_copy).setOnClickListener {
            try {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("device", device))
                Toast.makeText(this, R.string.lic_copied, Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                // تجاهل: النسخ اختياري
            }
        }
        findViewById<Button>(R.id.btn_wa).setOnClickListener {
            Support.open(this, "Tasyir bmd — طلب كود تفعيل / Demande de code\nID: $device")
        }
        findViewById<Button>(R.id.btn_paste).setOnClickListener {
            try {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val t = cm.primaryClip?.getItemAt(0)?.text?.toString() ?: ""
                etCode.setText(t.trim().uppercase())
            } catch (e: Exception) {
                // تجاهل
            }
        }
        findViewById<Button>(R.id.btn_activate).setOnClickListener { doActivate() }
        etCode.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                doActivate()
                true
            } else {
                false
            }
        }
        btnBack.setOnClickListener { leave() }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                leave()
            }
        })
        refresh()
    }

    override fun onDestroy() {
        isShowing = false
        super.onDestroy()
    }

    private fun leave() {
        if (LicenseManager.check(this).state == LicenseManager.State.EXPIRED) {
            finishAffinity()   // انتهت التجربة: الخروج من التطبيق
        } else {
            finish()
        }
    }

    private fun refresh() {
        val s = LicenseManager.check(this)
        tvStatus.text = when (s.state) {
            LicenseManager.State.TRIAL -> getString(R.string.lic_st_trial, s.daysLeft)
            LicenseManager.State.ACTIVE ->
                if (s.unlimited) getString(R.string.lic_st_unlimited)
                else getString(R.string.lic_st_active, s.daysLeft)
            LicenseManager.State.EXPIRED -> getString(R.string.lic_st_expired)
        }
        btnBack.setText(if (s.state == LicenseManager.State.EXPIRED) R.string.lic_exit else R.string.lic_back)
    }

    private fun doActivate() {
        val code = etCode.text.toString().trim()
        if (code.isEmpty()) {
            tvMsg.setText(R.string.lic_empty)
            return
        }
        when (val r = LicenseManager.activate(this, code)) {
            is LicenseManager.Result.Ok -> {
                val msg = if (r.days == 0xFFFF) getString(R.string.lic_ok_unlimited)
                else getString(R.string.lic_ok_days, r.days)
                Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
                finish()
            }
            LicenseManager.Result.Bad -> tvMsg.setText(R.string.lic_bad)
            LicenseManager.Result.WrongDevice -> tvMsg.setText(R.string.lic_wrong_device)
            LicenseManager.Result.Used -> tvMsg.setText(R.string.lic_used)
            is LicenseManager.Result.Locked -> tvMsg.text = getString(R.string.lic_locked, r.seconds)
        }
        refresh()
    }

    companion object {
        const val EXTRA_REQUIRED = "required"

        @Volatile
        var isShowing = false
    }
}
