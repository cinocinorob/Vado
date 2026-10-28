package app.vado.movimento

import android.content.Context

/** Stato salvato sul telefono: acceso o spento, tragitto in corso, ultimo avviso. */
internal object Prefs {
  private const val NAME = "vado_movimento"

  private fun prefs(context: Context) = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun enabled(context: Context) = prefs(context).getBoolean("enabled", false)
  fun setEnabled(context: Context, value: Boolean) = prefs(context).edit().putBoolean("enabled", value).apply()

  /** Istante in cui l'app ha detto che un tragitto è in corso; 0 se nessuno. */
  fun tripSince(context: Context) = prefs(context).getLong("tripSince", 0L)
  fun setTrip(context: Context, active: Boolean) =
    prefs(context).edit().putLong("tripSince", if (active) System.currentTimeMillis() else 0L).apply()

  fun lastNotified(context: Context) = prefs(context).getLong("lastNotified", 0L)
  fun setLastNotified(context: Context, at: Long) = prefs(context).edit().putLong("lastNotified", at).apply()

  /** Ultimi eventi, uno per riga: "istante tipo esito". Per la pagina Diagnostica. */
  fun history(context: Context) = prefs(context).getString("history", "") ?: ""
  fun addHistory(context: Context, line: String) {
    val lines = (history(context).lines().filter { it.isNotBlank() } + line).takeLast(20)
    prefs(context).edit().putString("history", lines.joinToString("\n")).apply()
  }

  fun lastEvent(context: Context) = prefs(context).getString("lastEvent", "") ?: ""
  fun lastEventAt(context: Context) = prefs(context).getLong("lastEventAt", 0L)
  fun setLastEvent(context: Context, name: String, at: Long) =
    prefs(context).edit().putString("lastEvent", name).putLong("lastEventAt", at).apply()
}
