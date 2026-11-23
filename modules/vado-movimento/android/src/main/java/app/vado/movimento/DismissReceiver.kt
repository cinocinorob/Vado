package app.vado.movimento

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

/** Il pulsante "Ignora" della notifica: la chiude e lo annota nella cronologia. */
class DismissReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    NotificationManagerCompat.from(context).cancel(Nudge.ID)
    Prefs.addHistory(context, "${System.currentTimeMillis()} avviso ignorato")
  }
}
