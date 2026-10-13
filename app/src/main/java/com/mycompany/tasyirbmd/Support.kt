package com.mycompany.tasyirbmd

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/** دعم واتساب: +213791071026 */
object Support {
    const val PHONE = "213791071026"

    fun open(ctx: Context, msg: String) {
        val uri = Uri.parse("https://wa.me/$PHONE?text=" + Uri.encode(msg))
        try {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, uri).setPackage("com.whatsapp"))
            return
        } catch (e: Exception) {
            // واتساب العادي غير مثبّت
        }
        try {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: Exception) {
            Toast.makeText(ctx, "WhatsApp: +$PHONE", Toast.LENGTH_LONG).show()
        }
    }
}
