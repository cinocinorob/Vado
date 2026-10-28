package app.vado.movimento

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MovimentoModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VadoMovimento")

    Function("status") {
      mapOf(
        "available" to Transitions.available(context),
        "permission" to Transitions.hasPermission(context),
        "enabled" to Prefs.enabled(context),
        "lastEvent" to Prefs.lastEvent(context),
        "lastEventAt" to Prefs.lastEventAt(context).toDouble(),
        "lastNotified" to Prefs.lastNotified(context).toDouble(),
        "history" to Prefs.history(context),
      )
    }

    AsyncFunction("enable") { promise: Promise ->
      val ctx = context.applicationContext
      Transitions.register(ctx, {
        Prefs.setEnabled(ctx, true)
        Prefs.addHistory(ctx, "${System.currentTimeMillis()} registrazione riuscita")
        promise.resolve(true)
      }, { error ->
        Prefs.addHistory(ctx, "${System.currentTimeMillis()} registrazione fallita: ${error.message}")
        promise.reject("ERR_MOVIMENTO", error.message ?: "Registrazione non riuscita", error)
      })
    }

    AsyncFunction("disable") { promise: Promise ->
      val ctx = context.applicationContext
      Prefs.setEnabled(ctx, false)
      Transitions.unregister(ctx) { promise.resolve(true) }
    }

    Function("setTripActive") { active: Boolean ->
      Prefs.setTrip(context.applicationContext, active)
    }
  }
}
