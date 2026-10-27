package app.vado.movimento

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity

/** Registrazione presso Google Play services dei cambi di attività che interessano. */
internal object Transitions {
  const val ACTION = "app.vado.movimento.TRANSIZIONE"

  private val WATCHED = listOf(DetectedActivity.WALKING, DetectedActivity.ON_BICYCLE, DetectedActivity.IN_VEHICLE)

  fun available(context: Context): Boolean =
    GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

  fun hasPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

  private fun pendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, TransitionReceiver::class.java).setAction(ACTION)
    // Mutabile: è Google Play services a riempirlo con il risultato.
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
    return PendingIntent.getBroadcast(context, 7301, intent, flags)
  }

  @Suppress("MissingPermission")
  fun register(context: Context, onDone: () -> Unit, onError: (Exception) -> Unit) {
    if (!available(context)) return onError(IllegalStateException("Google Play services non disponibili"))
    if (!hasPermission(context)) return onError(SecurityException("Permesso attività fisica non concesso"))
    val transitions = WATCHED.map {
      ActivityTransition.Builder().setActivityType(it).setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER).build()
    }
    try {
      ActivityRecognition.getClient(context)
        .requestActivityTransitionUpdates(ActivityTransitionRequest(transitions), pendingIntent(context))
        .addOnSuccessListener { onDone() }
        .addOnFailureListener { onError(it) }
    } catch (e: Exception) {
      onError(e)
    }
  }

  @Suppress("MissingPermission")
  fun unregister(context: Context, onDone: () -> Unit) {
    try {
      ActivityRecognition.getClient(context)
        .removeActivityTransitionUpdates(pendingIntent(context))
        .addOnCompleteListener { onDone() }
    } catch (e: Exception) {
      onDone()
    }
  }

  fun name(type: Int): String = when (type) {
    DetectedActivity.WALKING -> "piedi"
    DetectedActivity.ON_BICYCLE -> "bici"
    DetectedActivity.IN_VEHICLE -> "veicolo"
    else -> "altro"
  }
}
