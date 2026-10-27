package app.vado.movimento

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.android.gms.location.DetectedActivity
import java.util.Calendar

/** L'avviso "Stai camminando? Avvia il tragitto". */
internal object Nudge {
  private const val CHANNEL = "avvio"
  private const val ID = 7302
  /** Al massimo un avviso ogni 45 minuti. */
  private const val EVERY_MS = 45 * 60 * 1000L
  /** Un tragitto aperto da più di 4 ore è quasi certamente uno dimenticato con l'app chiusa. */
  private const val TRIP_STALE_MS = 4 * 60 * 60 * 1000L

  @Suppress("MissingPermission")
  fun maybeNotify(context: Context, type: Int) {
    val now = System.currentTimeMillis()
    if (!Prefs.enabled(context)) return
    val trip = Prefs.tripSince(context)
    if (trip > 0 && now - trip < TRIP_STALE_MS) return
    if (now - Prefs.lastNotified(context) < EVERY_MS) return
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    if (hour < 6 || hour >= 23) return
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

    val (title, body, mode) = when (type) {
      DetectedActivity.ON_BICYCLE -> Triple("Stai pedalando?", "Tocca per avviare il tragitto in bici: Vado misura e ti dà i punti.", "bici")
      DetectedActivity.IN_VEHICLE -> Triple("Sei su un mezzo?", "Se è bus, tram o metro, tocca per avviare il tragitto. In auto non serve.", "tpl")
      else -> Triple("Stai camminando?", "Tocca per avviare il tragitto a piedi: Vado misura e ti dà i punti.", "piedi")
    }
    ensureChannel(context)
    val link = Intent(Intent.ACTION_VIEW, Uri.parse("vado://nuovo?modo=$mode&avvia=1"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val tap = PendingIntent.getActivity(context, 7303, link, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(tap)
      .setAutoCancel(true)
      .setTimeoutAfter(20 * 60 * 1000L)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()
    try {
      NotificationManagerCompat.from(context).notify(ID, notification)
      Prefs.setLastNotified(context, now)
    } catch (e: SecurityException) {
      // Permesso delle notifiche revocato: niente avviso.
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL) != null) return
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "Avvio dei tragitti", NotificationManager.IMPORTANCE_DEFAULT))
  }
}
