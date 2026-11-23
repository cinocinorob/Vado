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
  /** Di norma al massimo un avviso ogni 45 minuti. */
  private const val EVERY_MS = 45 * 60 * 1000L
  /**
   * Scendendo da un mezzo si ricomincia a camminare dopo pochi minuti
   * (metro, poi a piedi fino all'ufficio): in quel caso basta un quarto d'ora.
   */
  private const val AFTER_VEHICLE_MS = 15 * 60 * 1000L
  /** Per quanto tempo un "su un veicolo" conta come appena sceso. */
  private const val VEHICLE_RECENT_MS = 60 * 60 * 1000L
  const val ID = 7302
  /** Un tragitto aperto da più di 4 ore è quasi certamente uno dimenticato con l'app chiusa. */
  private const val TRIP_STALE_MS = 4 * 60 * 60 * 1000L

  @Suppress("MissingPermission")
  /** Manda l'avviso se è il momento. Restituisce l'esito, per la diagnostica. */
  fun maybeNotify(context: Context, type: Int, previous: String, previousAt: Long): String {
    val now = System.currentTimeMillis()
    if (!Prefs.enabled(context)) return "spento"
    val trip = Prefs.tripSince(context)
    if (trip > 0 && now - trip < TRIP_STALE_MS) return "tragitto già in corso"
    val fromVehicle = type != DetectedActivity.IN_VEHICLE && previous == "veicolo" && now - previousAt < VEHICLE_RECENT_MS
    val gap = if (fromVehicle) AFTER_VEHICLE_MS else EVERY_MS
    if (now - Prefs.lastNotified(context) < gap) return "avviso recente"
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    if (hour < 6 || hour >= 23) return "di notte"
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return "notifiche disattivate"

    val (title, body, mode) = when (type) {
      DetectedActivity.ON_BICYCLE -> Triple("Stai pedalando?", "Tocca per avviare il tragitto in bici: Vado misura e ti dà i punti.", "bici")
      DetectedActivity.IN_VEHICLE -> Triple("Sei su un mezzo?", "Se è bus, tram o metro, tocca per avviare il tragitto. In auto non serve.", "tpl")
      else -> Triple("Stai camminando?", "Tocca per avviare il tragitto a piedi: Vado misura e ti dà i punti.", "piedi")
    }
    ensureChannel(context)
    val tap = start(context, mode, 7303)
    // Pulsanti: il mezzo riconosciuto, l'alternativa più probabile e "Ignora".
    // Ognuno avvia subito il tragitto con quel mezzo, senza passare dalla scelta.
    val actions = when (type) {
      DetectedActivity.ON_BICYCLE -> listOf("In bici" to "bici", "Bici elettrica" to "ebike")
      DetectedActivity.IN_VEHICLE -> listOf("Bus, tram, metro" to "tpl", "Treno" to "treno")
      else -> listOf("A piedi" to "piedi", "Bus, tram, metro" to "tpl")
    }
    val notification = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(tap)
      .addAction(0, actions[0].first, start(context, actions[0].second, 7304))
      .addAction(0, actions[1].first, start(context, actions[1].second, 7305))
      .addAction(0, "Ignora", dismiss(context))
      .setAutoCancel(true)
      .setTimeoutAfter(20 * 60 * 1000L)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()
    return try {
      NotificationManagerCompat.from(context).notify(ID, notification)
      Prefs.setLastNotified(context, now)
      "avviso mandato"
    } catch (e: SecurityException) {
      "notifiche non permesse"
    }
  }

  /** Apre l'app e avvia subito il tragitto con il mezzo indicato. */
  private fun start(context: Context, mode: String, code: Int): PendingIntent {
    val link = Intent(Intent.ACTION_VIEW, Uri.parse("vado://nuovo?modo=$mode&avvia=1"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, code, link, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun dismiss(context: Context): PendingIntent {
    val intent = Intent(context, DismissReceiver::class.java)
    return PendingIntent.getBroadcast(context, 7306, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL) != null) return
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "Avvio dei tragitti", NotificationManager.IMPORTANCE_DEFAULT))
  }
}
