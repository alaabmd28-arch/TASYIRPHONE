import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ---------------------------------------------------------------------------
// بيانات التوقيع لا تُكتب في الشيفرة. تُقرأ من:
//   1) ملف keystore.properties في جذر المشروع (غير مُتتبَّع في git)، أو
//   2) متغيرات البيئة TASYIR_STORE_PASSWORD / TASYIR_KEY_PASSWORD (مثل أسرار GitHub)
// نفس ملف المفتاح tasyirbmd.jks ونفس الـalias => التحديث يُثبَّت فوق النسخة الحالية.
// ---------------------------------------------------------------------------
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun signingValue(prop: String, env: String): String? =
    (keystoreProps.getProperty(prop) ?: System.getenv(env))?.takeIf { it.isNotBlank() }
val releaseStorePassword = signingValue("storePassword", "TASYIR_STORE_PASSWORD")
val releaseKeyPassword = signingValue("keyPassword", "TASYIR_KEY_PASSWORD") ?: releaseStorePassword
val releaseSigningReady = releaseStorePassword != null

android {
    namespace = "com.mycompany.tasyirbmd"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mycompany.tasyirbmd"   // نفس الحزمة القديمة => التحديث يحافظ على البيانات
        minSdk = 24
        targetSdk = 34
        versionCode = 105
        versionName = "2.2"
    }

    signingConfigs {
        create("release") {
            storeFile = file(keystoreProps.getProperty("storeFile") ?: "tasyirbmd.jks") // app/tasyirbmd.jks
            keyAlias = keystoreProps.getProperty("keyAlias") ?: "tasyirbmd"
            storePassword = releaseStorePassword
            keyPassword = releaseKeyPassword
        }
    }

    buildTypes {
        release {
            // R8: تصغير وتعتيم الشيفرة الأصلية (قواعد الجسر في proguard-rules.pro)
            isMinifyEnabled = true
            isShrinkResources = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            // التصحيح يستعمل مفتاح التصحيح الافتراضي — لا يُوقَّع أبدًا بمفتاح الإصدار
            isDebuggable = true
        }
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

// يفشل البناء بوضوح إذا طُلب Release بدون أسرار التوقيع (بدل إنتاج APK غير موقّع)
gradle.taskGraph.whenReady {
    val wantsRelease = allTasks.any { it.project == project && it.name.contains("Release", ignoreCase = true) }
    if (wantsRelease && !releaseSigningReady) {
        throw GradleException(
            "Release signing missing: create keystore.properties (see keystore.properties.example) " +
            "or set TASYIR_STORE_PASSWORD / TASYIR_KEY_PASSWORD."
        )
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.1")
    // ماسح الباركود يعمل بدون إنترنت
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    // الكاميرا العائمة: CameraX + ML Kit (النسخة المضمّنة تعمل بلا إنترنت)
    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
}
