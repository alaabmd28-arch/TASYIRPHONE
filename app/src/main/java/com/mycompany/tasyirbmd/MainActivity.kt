package com.mycompany.tasyirbmd

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.SystemClock
import android.view.ViewGroup
import android.widget.FrameLayout
import android.view.WindowManager
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.util.Log
import android.view.View
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.File

class MainActivity : AppCompatActivity() {

    private var web: WebView? = null
    private var rootFl: FrameLayout? = null
    var floatScanner: FloatScanner? = null
    private var pendingWebPermission: PermissionRequest? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingScanMulti: Boolean? = null
    private var trialToastShown = false
    private var leftAt = 0L
    private var internalLaunch = false

    private val btPermLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            jsCall("window.__btp&&window.__btp(" + granted + ")")
        }

    private fun jsCall(js: String) {
        runOnUiThread { web?.evaluateJavascript(js, null) }
    }

    private val cameraPermLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            onCameraPermissionResult(granted)
        }

    private val fileLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
            val cb = fileCallback
            fileCallback = null
            val uris = try {
                WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data)
            } catch (e: Exception) {
                null
            }
            cb?.onReceiveValue(uris)
        }

    // ------------------------------------------------------------------ lifecycle

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this
        PinManager.locked = PinManager.enabled(this)
        if (PinManager.secure(this)) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        try {
            setupWebView()
        } catch (e: Exception) {
            Log.e(TAG, "WebView init failed", e)
            AlertDialog.Builder(this)
                .setMessage("تعذر تشغيل WebView. حدّث تطبيق Android System WebView من متجر Play ثم أعد المحاولة.")
                .setPositiveButton(R.string.ok) { _, _ -> finish() }
                .setCancelable(false)
                .show()
            return
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleBack()
            }
        })
    }

    override fun onResume() {
        super.onResume()
        web?.onResume()
        enforceLicense()
    }

    /** أولًا الترخيص (إلزامي عند الانتهاء)، ثم كلمة السر PIN */
    private fun enforceLicense() {
        val s = LicenseManager.check(this)
        if (s.state == LicenseManager.State.EXPIRED) {
            web?.visibility = View.INVISIBLE
            if (!LicenseActivity.isShowing) {
                startActivity(
                    Intent(this, LicenseActivity::class.java).putExtra(LicenseActivity.EXTRA_REQUIRED, true)
                )
            }
            return
        }
        if (PinManager.enabled(this)) {
            val skip = internalLaunch || PinManager.skipNext
            if (!skip && leftAt > 0 &&
                SystemClock.elapsedRealtime() - leftAt >= PinManager.timeout(this) * 1000L
            ) {
                PinManager.locked = true
            }
        } else {
            PinManager.locked = false
        }
        internalLaunch = false
        PinManager.skipNext = false
        if (PinManager.locked) {
            web?.visibility = View.INVISIBLE
            if (!PinActivity.isShowing) startActivity(Intent(this, PinActivity::class.java))
            return
        }
        web?.visibility = View.VISIBLE
        if (s.state == LicenseManager.State.TRIAL && !trialToastShown) {
            trialToastShown = true
            toast(getString(R.string.lic_trial_toast, s.daysLeft))
        }
    }

    override fun onStop() {
        leftAt = SystemClock.elapsedRealtime()
        super.onStop()
    }

    override fun onPause() {
        // لا نستدعي web.onPause() حتى لا تتوقف الصفحة أثناء فتح الماسح
        super.onPause()
    }

    override fun onDestroy() {
        floatScanner?.close()
        if (instance === this) instance = null
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        pendingWebPermission?.deny()
        pendingWebPermission = null
        web?.let {
            it.stopLoading()
            it.removeJavascriptInterface("Android")
            it.destroy()
        }
        web = null
        super.onDestroy()
    }

    // ------------------------------------------------------------------ WebView

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val w = WebView(this)
        web = w
        val fl = FrameLayout(this)
        fl.addView(w, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        rootFl = fl
        setContentView(fl)

        with(w.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true          // localStorage (كل بيانات المتجر)
            // الأصول (file:///android_asset) تعمل دائمًا؛ لا حاجة لفتح الملفات أو المحتوى الخارجي للـWebView
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION") allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION") allowUniversalAccessFromFileURLs = false
            mediaPlaybackRequiresUserGesture = false
            // احترام تكبير الخط وإمكانية الوصول في النظام (textZoom يتبع إعداد الجهاز افتراضيًا)
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }
        // لا فحص عن بُعد في نسخة الإصدار
        WebView.setWebContentsDebuggingEnabled((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0)

        w.addJavascriptInterface(Bridge(), "Android")

        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                return if (url.scheme == "file") {
                    false
                } else {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                    } catch (e: ActivityNotFoundException) {
                        toast("لا يوجد تطبيق لفتح هذا الرابط")
                    }
                    true
                }
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // انهيار عملية WebView: نعيد بناء الشاشة بدل إغلاق التطبيق
                Log.e(TAG, "Render process gone, crashed=${detail.didCrash()}")
                runOnUiThread { recreate() }
                return true
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                if (request.isForMainFrame) {
                    view.loadUrl("file:///android_asset/htmlapp/helpers/error.html")
                }
            }
        }

        w.webChromeClient = object : WebChromeClient() {

            // ---- الكاميرا داخل الصفحة (OCR وغيره) ----
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (!request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                        request.deny()
                        return@runOnUiThread
                    }
                    if (hasCameraPermission()) {
                        grantWebCamera(request)
                    } else {
                        pendingWebPermission?.deny()
                        pendingWebPermission = request
                        internalLaunch = true; cameraPermLauncher.launch(Manifest.permission.CAMERA)
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingWebPermission === request) pendingWebPermission = null
            }

            // ---- اختيار الملفات (استيراد Excel / استعادة نسخة / صورة منتج) ----
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    internalLaunch = true
                    fileLauncher.launch(params.createIntent())
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    callback.onReceiveValue(null)
                    toast("تعذر فتح منتقي الملفات")
                    false
                }
            }

            // ---- alert / confirm ----
            override fun onJsAlert(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
                if (isFinishing) {
                    result.cancel()
                    return true
                }
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton(R.string.ok) { _, _ -> result.confirm() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
                if (isFinishing) {
                    result.cancel()
                    return true
                }
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton(R.string.ok) { _, _ -> result.confirm() }
                    .setNegativeButton(R.string.cancel) { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }
        }

        w.loadUrl(START_URL)
    }

    private fun handleBack() {
        if (floatScanner != null) {
            floatScanner?.close()
            return
        }
        val w = web
        if (w == null) {
            finish()
            return
        }
        val js = "(function(){try{" +
            "var s=document.getElementById('sv'),o=document.getElementById('ov');" +
            "if(document.body.classList.contains('dwo')){dwClose();return 1}" +
            "if(s&&s.innerHTML){stopScan();return 1}" +
            "if(o&&o.innerHTML){o.innerHTML='';return 1}" +
            "if(typeof tab!=='undefined'&&(tab!=='dash'||(typeof sub!=='undefined'&&sub))){goBack();return 1}" +
            "}catch(e){}return 0})()"
        w.evaluateJavascript(js) { r ->
            if (r?.trim() != "1") confirmExit()
        }
    }

    private fun confirmExit() {
        AlertDialog.Builder(this)
            .setMessage(R.string.exit_confirm)
            .setPositiveButton(R.string.yes) { _, _ -> finish() }
            .setNegativeButton(R.string.no, null)
            .show()
    }

    // ------------------------------------------------------------------ camera permission

    private fun hasCameraPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun grantWebCamera(request: PermissionRequest) {
        try {
            request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
        } catch (e: Exception) {
            Log.e(TAG, "grant failed", e)
        }
    }

    private fun onCameraPermissionResult(granted: Boolean) {
        val scanMulti = pendingScanMulti
        val req = pendingWebPermission
        pendingScanMulti = null
        pendingWebPermission = null
        if (granted) {
            if (scanMulti != null) launchScanner(scanMulti)
            if (req != null) grantWebCamera(req)
        } else {
            req?.deny()
            if (scanMulti != null || req != null) showPermissionDeniedDialog()
        }
    }

    private fun showPermissionDeniedDialog() {
        if (isFinishing) return
        AlertDialog.Builder(this)
            .setTitle(R.string.perm_title)
            .setMessage(R.string.perm_msg)
            .setPositiveButton(R.string.open_settings) { _, _ -> openAppSettings() }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun openAppSettings() {
        internalLaunch = true
        try {
            startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
            )
        } catch (e: Exception) {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    // ------------------------------------------------------------------ scanner

    private fun startScan(multi: Boolean) {
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
            toast(getString(R.string.no_camera))
            return
        }
        if (hasCameraPermission()) {
            launchScanner(multi)
        } else {
            pendingScanMulti = multi
            internalLaunch = true; cameraPermLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    fun runJs(js: String) {
        jsCall(js)
    }

    /** رمز غير موجود: الصفحة تغلق الماسح وتفتح نموذج منتج جديد بهذا الباركود */
    fun notFound(code: String) {
        jsCall("window.__nf&&window.__nf(" + JSONObject.quote(code) + ")")
    }

    private fun launchScanner(multi: Boolean) {
        val fl = rootFl
        if (fl != null) {
            try {
                floatScanner?.close()
                val fs = FloatScanner(this, fl, multi) { launchLegacyScanner(multi) }
                floatScanner = fs
                fs.start()
                return
            } catch (e: Throwable) {
                Log.e(TAG, "float scanner failed", e)
                floatScanner = null
            }
        }
        launchLegacyScanner(multi)
    }

    private fun launchLegacyScanner(multi: Boolean) {
        try {
            internalLaunch = true
            startActivity(Intent(this, ScannerActivity::class.java).putExtra(ScannerActivity.EXTRA_MULTI, multi))
        } catch (e: Exception) {
            Log.e(TAG, "scanner launch failed", e)
            toast(getString(R.string.camera_error))
        }
    }

    /** يستدعيه ScannerActivity عند قراءة باركود، ويعيد نتيجة الصفحة (نجاح/رسالة) */
    fun dispatchScan(code: String, cb: (Boolean, String) -> Unit) {
        val w = web
        if (w == null) {
            cb(false, "")
            return
        }
        val js = "(function(){try{return window.__ns(" + JSONObject.quote(code) +
            ")}catch(e){return JSON.stringify([0,String(e)])}})()"
        w.evaluateJavascript(js) { raw ->
            var ok = true
            var msg = ""
            try {
                val s = JSONTokener(raw ?: "null").nextValue() as? String
                if (s != null) {
                    val a = JSONArray(s)
                    ok = a.optInt(0, 1) == 1
                    msg = a.optString(1, "")
                }
            } catch (e: Exception) {
                Log.w(TAG, "scan result parse", e)
            }
            cb(ok, msg)
        }
    }

    // ------------------------------------------------------------------ files / print

    private fun toast(msg: String) {
        runOnUiThread { Toast.makeText(this, msg, Toast.LENGTH_LONG).show() }
    }

    private fun saveToDownloads(name: String, mime: String, bytes: ByteArray) {
        val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
        if (Build.VERSION.SDK_INT >= 29) {
            val cv = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, safe)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv)
                ?: throw IllegalStateException("insert failed")
            contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: throw IllegalStateException("stream failed")
            toast(getString(R.string.saved, "Download/$safe"))
        } else {
            // أندرويد 7-9: نحفظ ثم نفتح نافذة المشاركة (حفظ في Drive / واتساب / ملفات...)
            val dir = File(cacheDir, "exports").apply { mkdirs() }
            val f = File(dir, safe)
            f.writeBytes(bytes)
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", f)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            internalLaunch = true
            startActivity(Intent.createChooser(send, safe))
        }
    }

    private fun printPage() {
        val w = web ?: return
        try {
            val pm = getSystemService(PRINT_SERVICE) as PrintManager
            pm.print("Tasyir_bmd", w.createPrintDocumentAdapter("Tasyir_bmd"), PrintAttributes.Builder().build())
        } catch (e: Exception) {
            Log.e(TAG, "print failed", e)
            toast("تعذرت الطباعة")
        }
    }

    // ------------------------------------------------------------------ JS bridge

    inner class Bridge {
        @JavascriptInterface
        fun scanToggle(multi: Boolean) {
            runOnUiThread {
                if (floatScanner != null) floatScanner?.close() else startScan(multi)
            }
        }

        @JavascriptInterface
        fun stopScan() {
            runOnUiThread { floatScanner?.close() }
        }

        @JavascriptInterface
        fun scan(multi: Boolean) {
            runOnUiThread { startScan(multi) }
        }

        @JavascriptInterface
        fun saveFile(name: String, mime: String, base64: String): Boolean {
            return try {
                saveToDownloads(name, mime, Base64.decode(base64, Base64.DEFAULT))
                true
            } catch (e: Exception) {
                Log.e(TAG, "save failed", e)
                toast(getString(R.string.save_failed))
                false
            }
        }

        @JavascriptInterface
        fun print() {
            runOnUiThread { printPage() }
        }

        @JavascriptInterface
        fun licenseInfo(): String {
            val s = LicenseManager.check(this@MainActivity)
            return JSONObject()
                .put("state", s.state.name.lowercase())
                .put("days", if (s.unlimited) 0 else s.daysLeft)
                .put("unlimited", s.unlimited)
                .put("device", LicenseManager.deviceId(this@MainActivity))
                .toString()
        }

        @JavascriptInterface
        fun openLicense() {
            runOnUiThread {
                internalLaunch = true
                startActivity(Intent(this@MainActivity, LicenseActivity::class.java))
            }
        }

        @JavascriptInterface
        fun support(msg: String) {
            runOnUiThread {
                internalLaunch = true
                Support.open(this@MainActivity, msg)
            }
        }

        @JavascriptInterface
        fun setLang(l: String) {
            PinManager.setLang(this@MainActivity, l)
        }

        @JavascriptInterface
        fun pinInfo(): String = JSONObject()
            .put("on", PinManager.enabled(this@MainActivity))
            .put("timeout", PinManager.timeout(this@MainActivity))
            .put("secure", PinManager.secure(this@MainActivity))
            .toString()

        @JavascriptInterface
        fun pinSetup(pin: String): String = PinManager.setup(this@MainActivity, pin)

        @JavascriptInterface
        fun pinVerify(pin: String): Boolean = PinManager.check(this@MainActivity, pin) == PinManager.OK

        @JavascriptInterface
        fun pinDisable(pin: String): Boolean {
            if (PinManager.check(this@MainActivity, pin) != PinManager.OK) return false
            PinManager.disable(this@MainActivity)
            return true
        }

        @JavascriptInterface
        fun pinTimeout(sec: Int) {
            PinManager.setTimeout(this@MainActivity, sec)
        }

        @JavascriptInterface
        fun setSecure(on: Boolean) {
            PinManager.setSecure(this@MainActivity, on)
            runOnUiThread {
                if (on) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }

        @JavascriptInterface
        fun btDevices(): String {
            if (!BtPrinter.hasPerm(this@MainActivity)) {
                runOnUiThread {
                    internalLaunch = true
                    btPermLauncher.launch(Manifest.permission.BLUETOOTH_CONNECT)
                }
                return "{\"err\":\"perm\"}"
            }
            return try {
                JSONObject().put("list", BtPrinter.bonded(this@MainActivity)).toString()
            } catch (e: Exception) {
                "{\"err\":\"nobt\"}"
            }
        }

        @JavascriptInterface
        fun btPrint(mac: String, png64: String, width: Int) {
            if (!BtPrinter.hasPerm(this@MainActivity)) {
                jsCall("window.__btr&&window.__btr('perm')")
                return
            }
            Thread {
                val err = try {
                    BtPrinter.print(this@MainActivity, mac, Base64.decode(png64, Base64.DEFAULT), width)
                } catch (e: Exception) {
                    Log.e(TAG, "bt print", e)
                    "io"
                }
                jsCall("window.__btr&&window.__btr(" + JSONObject.quote(err ?: "") + ")")
            }.start()
        }

        @JavascriptInterface
        fun btSettings() {
            runOnUiThread {
                internalLaunch = true
                try {
                    startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
                } catch (e: Exception) {
                    toast("Bluetooth")
                }
            }
        }

        // ---- مزامنة الحاسوب: طلب HTTP إلى الحاسوب داخل الشبكة المحلية فقط (الصفحة نفسها لا تستطيع ذلك بسبب CSP) ----
        @JavascriptInterface
        fun syncPost(id: Int, url: String, body: String) {
            Thread {
                var status = 0
                var text = ""
                try {
                    val u = java.net.URL(url)
                    if (u.protocol != "http" || u.path != "/sync" || !isLanHost(u.host)) {
                        throw SecurityException("not a LAN sync url")
                    }
                    val c = u.openConnection() as java.net.HttpURLConnection
                    c.requestMethod = "POST"
                    c.connectTimeout = 8000
                    c.readTimeout = 60000
                    c.doOutput = true
                    c.setRequestProperty("Content-Type", "application/json")
                    c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    status = c.responseCode
                    val st = if (status in 200..299) c.inputStream else c.errorStream
                    text = st?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                    c.disconnect()
                } catch (e: Exception) {
                    Log.w(TAG, "sync post failed", e)
                    status = 0
                    text = e.javaClass.simpleName
                }
                jsCall("window.__syncRes&&window.__syncRes(" + id + "," + status + "," + JSONObject.quote(text) + ")")
            }.start()
        }

        /** هل هذا الكود هو كود تفعيل حقيقي سبق تفعيله على هذا الهاتف؟ (شرط الربط) */
        @JavascriptInterface
        fun licenseOwns(code: String): Boolean = LicenseManager.ownsCode(this@MainActivity, code)

        @JavascriptInterface
        fun openSettings() {
            runOnUiThread { openAppSettings() }
        }
    }

    companion object {
        private const val TAG = "TasyirBMD"

        /** عناوين الشبكة المحلية فقط: 10.x و172.16-31.x و192.168.x و169.254.x وlocalhost */
        private fun isLanHost(h: String): Boolean {
            if (h == "localhost") return true
            val m = Regex("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$").matchEntire(h) ?: return false
            val a = m.groupValues[1].toInt()
            val b = m.groupValues[2].toInt()
            if (m.groupValues.drop(1).any { it.toInt() > 255 }) return false
            return a == 10 || a == 127 || (a == 172 && b in 16..31) || (a == 192 && b == 168) || (a == 169 && b == 254)
        }
        // نفس عنوان النسخة القديمة => نفس مساحة localStorage => لا تضيع بيانات المتجر عند التحديث
        private const val START_URL = "file:///android_asset/htmlapp/root/index.html"

        @Volatile
        var instance: MainActivity? = null
    }
}
