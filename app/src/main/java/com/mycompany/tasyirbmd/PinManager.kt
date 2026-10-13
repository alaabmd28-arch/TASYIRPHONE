package com.mycompany.tasyirbmd

import android.content.Context
import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/** كلمة سر التطبيق: لا يُخزَّن الرقم أبدًا، فقط PBKDF2 + salt */
object PinManager {
    private const val PREFS = "tasyir_pin"
    private const val ITER = 20000      // القيمة القديمة (للـPIN المخزَّن سابقًا)
    private const val ITER_NEW = 100000  // القيمة الجديدة؛ يُرقَّى الـPIN تلقائيًا بعد أول إدخال صحيح
    private const val ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

    @Volatile var locked = false
    @Volatile var skipNext = false

    const val OK = 0
    const val WRONG = 1
    const val LOCKED = 2

    private fun sp(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun enabled(c: Context) = sp(c).getString("h", null) != null
    fun timeout(c: Context) = sp(c).getInt("to", 60)
    fun setTimeout(c: Context, s: Int) { sp(c).edit().putInt("to", s).apply() }
    fun secure(c: Context) = sp(c).getBoolean("sec", false)
    fun setSecure(c: Context, on: Boolean) { sp(c).edit().putBoolean("sec", on).apply() }
    fun lang(c: Context): String = sp(c).getString("lang", "ar") ?: "ar"
    fun setLang(c: Context, l: String) { sp(c).edit().putString("lang", l).apply() }

    private fun hash(v: String, salt: ByteArray, iter: Int = ITER): ByteArray {
        val spec = PBEKeySpec(v.toCharArray(), salt, iter, 256)
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1").generateSecret(spec).encoded
    }

    private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
    private fun unb64(s: String) = Base64.decode(s, Base64.NO_WRAP)
    private fun newSalt() = ByteArray(16).also { SecureRandom().nextBytes(it) }
    private fun norm(k: String) = k.uppercase().filter { it.isLetterOrDigit() }

    /** ينشئ PIN ويعيد مفتاح الاسترجاع (12 خانة)، أو "" عند فشل التحقق من الصيغة */
    fun setup(c: Context, pin: String): String {
        if (!Regex("\\d{4,6}").matches(pin)) return ""
        val rnd = SecureRandom()
        val rk = (1..12).map { ALPHA[rnd.nextInt(ALPHA.length)] }.joinToString("")
        val s1 = newSalt()
        val s2 = newSalt()
        sp(c).edit()
            .putString("h", b64(hash(pin, s1, ITER_NEW))).putString("s", b64(s1)).putInt("it", ITER_NEW)
            .putString("rh", b64(hash(rk, s2, ITER_NEW))).putString("rs", b64(s2)).putInt("rit", ITER_NEW)
            .putInt("fails", 0).putLong("until", 0L)
            .apply()
        return rk
    }

    fun lockRemaining(c: Context): Long =
        (sp(c).getLong("until", 0L) - System.currentTimeMillis()).coerceAtLeast(0L)

    fun check(c: Context, pin: String): Int {
        if (lockRemaining(c) > 0) return LOCKED
        val h = sp(c).getString("h", null) ?: return OK
        val s = sp(c).getString("s", null) ?: return WRONG
        val good = try {
            MessageDigest.isEqual(unb64(h), hash(pin, unb64(s), sp(c).getInt("it", ITER)))
        } catch (e: Exception) {
            false
        }
        if (good) {
            val ed0 = sp(c).edit().putInt("fails", 0).putLong("until", 0L)
            if (sp(c).getInt("it", ITER) < ITER_NEW) {
                // ترقية صامتة: إعادة التجزئة بملح جديد وعدد تكرارات أعلى (بعد التحقق من صحة الـPIN فقط)
                try {
                    val ns = newSalt()
                    ed0.putString("h", b64(hash(pin, ns, ITER_NEW))).putString("s", b64(ns)).putInt("it", ITER_NEW)
                } catch (e: Exception) { /* يبقى القديم صالحًا */ }
            }
            ed0.apply()
            return OK
        }
        val f = sp(c).getInt("fails", 0) + 1
        val ed = sp(c).edit().putInt("fails", f)
        if (f % 5 == 0) {
            val level = (f / 5 - 1).coerceAtMost(10)
            ed.putLong("until", System.currentTimeMillis() + 30000L * (1L shl level))
        }
        ed.apply()
        return if (f % 5 == 0) LOCKED else WRONG
    }

    fun checkRecovery(c: Context, key: String): Boolean {
        val h = sp(c).getString("rh", null) ?: return false
        val s = sp(c).getString("rs", null) ?: return false
        return try {
            MessageDigest.isEqual(unb64(h), hash(norm(key), unb64(s), sp(c).getInt("rit", ITER)))
        } catch (e: Exception) {
            false
        }
    }

    fun disable(c: Context) {
        sp(c).edit().remove("h").remove("s").remove("rh").remove("rs").remove("it").remove("rit")
            .putInt("fails", 0).putLong("until", 0L).apply()
        locked = false
    }
}
