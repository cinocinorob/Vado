package app.vado.movimento

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Dopo un riavvio del telefono o un aggiornamento dell'app la registrazione si perde: la si rifà. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (!Prefs.enabled(context)) return
    val pending = goAsync()
    Transitions.register(context.applicationContext, { pending.finish() }, { pending.finish() })
  }
}
