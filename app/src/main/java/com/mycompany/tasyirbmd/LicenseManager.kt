package com.mycompany.tasyirbmd

import android.content.Context
import android.provider.Settings
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * نظام التفعيل (يعمل بدون إنترنت):
 * - تجربة مجانية TRIAL_DAYS أيام من أول تشغيل.
 * - كود التفعيل 24 خانة يحمل: المدة + رقم تسلسلي + (اختياريًا) معرّف جهاز + توقيع HMAC.
 * - الأكواد تُنتَج من ملف code-generator.html الذي بحوزتك فقط.
 */
object LicenseManager {

    const val TRIAL_DAYS = 7
    private const val PREFS = "lic"
    private const val DAY_MS = 86_400_000L
    private const val UNLIMITED = 0xFFFF
    private const val MAX_FAILS = 5
    private const val LOCK_MS = 5 * 60_000L
    private const val ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

    private const val OBF = "276397380f29d00492c1fd11a2fc152fd9f3f2c64c4e9d22066e069812c4a3ff"
    private const val MASK = "42d5ded0550ee63c7b0c268c395aa5a98b2a4841418366ae9f3171eb54dbfeff"

    enum class State { TRIAL, ACTIVE, EXPIRED }

    class Status(val state: State, val daysLeft: Int, val unlimited: Boolean)

    sealed class Result {
        class Ok(val status: Status, val days: Int) : Result()
        object Bad : Result()
        object WrongDevice : Result()
        object Used : Result()
        class Locked(val seconds: Int) : Result()
    }

    private fun hex(s: String): ByteArray =
        ByteArray(s.length / 2) { i -> s.substring(i * 2, i * 2 + 2).toInt(16).toByte() }

    private fun secret(): ByteArray {
        val a = hex(OBF)
        val b = hex(MASK)
        return ByteArray(a.size) { i -> (a[i].toInt() xor b[i].toInt()).toByte() }
    }

    // ------------------------------------------------------------ الحالة

    /** الوقت الفعّال: لا يرجع للخلف أبدًا (حماية من تغيير ساعة الهاتف) */
    private fun effectiveNow(ctx: Context): Long {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val real = System.currentTimeMillis()
        val last = p.getLong("last", 0L)
        if (real > last) {
            p.edit().putLong("last", real).apply()
            return real
        }
        return last
    }

    private fun trialStart(ctx: Context, now: Long): Long {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val saved = p.getLong("t0", 0L)
        if (saved > 0L) return saved
        var t0 = now
        try {
            val pi = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
            // تثبيت جديد لم يُحدَّث: نستعمل وقت التثبيت الحقيقي (فلا تعيد "مسح البيانات" التجربة)
            if (pi.firstInstallTime == pi.lastUpdateTime && pi.firstInstallTime in 1..now) {
                t0 = pi.firstInstallTime
            }
        } catch (e: Exception) {
            t0 = now
        }
        p.edit().putLong("t0", t0).apply()
        return t0
    }

    fun check(ctx: Context): Status {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = effectiveNow(ctx)
        val exp = p.getLong("exp", 0L)
        if (exp == -1L) return Status(State.ACTIVE, Int.MAX_VALUE, true)
        if (exp > 0L) {
            return if (exp > now) {
                Status(State.ACTIVE, (((exp - now) + DAY_MS - 1) / DAY_MS).toInt(), false)
            } else {
                Status(State.EXPIRED, 0, false)
            }
        }
        val trialEnd = trialStart(ctx, now) + TRIAL_DAYS * DAY_MS
        return if (now < trialEnd) {
            Status(State.TRIAL, (((trialEnd - now) + DAY_MS - 1) / DAY_MS).toInt(), false)
        } else {
            Status(State.EXPIRED, 0, false)
        }
    }

    /** معرّف الجهاز (6 خانات) لإصدار كود مربوط بجهاز واحد */
    fun deviceId(ctx: Context): String {
        val id = try {
            Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID) ?: "0"
        } catch (e: Exception) {
            "0"
        }
        val d = MessageDigest.getInstance("SHA-256").digest((id + "|" + ctx.packageName).toByteArray())
        return String.format("%02X%02X%02X", d[0], d[1], d[2])
    }

    // ------------------------------------------------------------ التفعيل

    private fun decode(raw: String): ByteArray? {
        val s = raw.uppercase()
            .replace('O', '0').replace('I', '1').replace('L', '1')
            .filter { it in '0'..'9' || it in 'A'..'Z' }
        if (s.length != 24) return null
        val out = ByteArray(15)
        var acc = 0L
        var bits = 0
        var idx = 0
        for (ch in s) {
            val v = ALPHABET.indexOf(ch)
            if (v < 0) return null
            acc = (acc shl 5) or v.toLong()
            bits += 5
            while (bits >= 8) {
                bits -= 8
                out[idx++] = ((acc shr bits) and 0xFF).toByte()
            }
            acc = acc and ((1L shl bits) - 1)
        }
        return if (idx == 15) out else null
    }

    /** كود صحيح التوقيع وسبق تفعيله على هذا الجهاز (لا يغيّر أي حالة) */
    fun ownsCode(ctx: Context, raw: String): Boolean {
        val bytes = decode(raw) ?: return false
        val m = Mac.getInstance("HmacSHA256")
        m.init(SecretKeySpec(secret(), "HmacSHA256"))
        val calc = m.doFinal(bytes.copyOfRange(0, 8)).copyOf(7)
        if (!MessageDigest.isEqual(calc, bytes.copyOfRange(8, 15))) return false
        val id = bytes.copyOfRange(0, 8).joinToString("") { String.format("%02X", it) }
        val used = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet("used", emptySet()) ?: emptySet()
        return used.contains(id)
    }

    fun activate(ctx: Context, raw: String): Result {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val nowReal = System.currentTimeMillis()

        val lockUntil = p.getLong("lockUntil", 0L)
        if (lockUntil > nowReal) return Result.Locked(((lockUntil - nowReal) / 1000).toInt() + 1)

        val bytes = decode(raw)
        var ok = false
        if (bytes != null) {
            val payload = bytes.copyOfRange(0, 8)
            val mac = bytes.copyOfRange(8, 15)
            val m = Mac.getInstance("HmacSHA256")
            m.init(SecretKeySpec(secret(), "HmacSHA256"))
            val calc = m.doFinal(payload).copyOf(7)
            ok = MessageDigest.isEqual(calc, mac)
        }
        if (!ok || bytes == null) {
            val fails = p.getInt("fails", 0) + 1
            val e = p.edit()
            if (fails >= MAX_FAILS) {
                e.putInt("fails", 0).putLong("lockUntil", nowReal + LOCK_MS)
            } else {
                e.putInt("fails", fails)
            }
            e.apply()
            return Result.Bad
        }

        val days = ((bytes[0].toInt() and 0xFF) shl 8) or (bytes[1].toInt() and 0xFF)
        if (days == 0) return Result.Bad

        val devBytes = bytes.copyOfRange(5, 8)
        val bound = devBytes.any { it.toInt() != 0 }
        if (bound) {
            val mine = String.format("%02X%02X%02X", devBytes[0], devBytes[1], devBytes[2])
            if (mine != deviceId(ctx)) return Result.WrongDevice
        }

        val id = bytes.copyOfRange(0, 8).joinToString("") { String.format("%02X", it) }
        val used = HashSet(p.getStringSet("used", emptySet()) ?: emptySet())
        if (used.contains(id)) return Result.Used

        val now = effectiveNow(ctx)
        val oldExp = p.getLong("exp", 0L)
        val newExp = when {
            days == UNLIMITED -> -1L
            oldExp == -1L -> -1L
            else -> maxOf(now, oldExp) + days.toLong() * DAY_MS
        }
        used.add(id)
        p.edit().putLong("exp", newExp).putStringSet("used", used).putInt("fails", 0).apply()
        return Result.Ok(check(ctx), days)
    }
}
