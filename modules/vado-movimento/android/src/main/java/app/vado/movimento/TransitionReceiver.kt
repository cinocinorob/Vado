package app.vado.movimento

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult

/** Riceve da Google Play services "ha iniziato a camminare / pedalare / è su un veicolo". */
class TransitionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!ActivityTransitionResult.hasResult(intent)) return
    val result = ActivityTransitionResult.extractResult(intent) ?: return
    val event = result.transitionEvents.lastOrNull { it.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER } ?: return
    val now = System.currentTimeMillis()
    // Il movimento precedente serve a capire se si è appena scesi da un mezzo.
    val previous = Prefs.lastEvent(context)
    val previousAt = Prefs.lastEventAt(context)
    Prefs.setLastEvent(context, Transitions.name(event.activityType), now)
    val outcome = Nudge.maybeNotify(context, event.activityType, previous, previousAt)
    Prefs.addHistory(context, "$now ${Transitions.name(event.activityType)} $outcome")
  }
}
