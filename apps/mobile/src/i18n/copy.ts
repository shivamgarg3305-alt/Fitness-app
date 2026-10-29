/** English copy. Components import this instead of embedding sentences. */
export const copy = {
  disclaimer:
    "This app provides wellness and fitness information and is not a substitute for professional medical advice.",
  guestCloud:
    "Workouts, meals, and settings stay on this device. Google sign-in is required to use the app. Local data already here associates with your account only after you confirm. Restoring a cloud backup onto a new phone is not available in this build.",
  localDataClaim:
    "This device has unbound local data. Associate it with this account only if these records belong to you. Nothing uploads until you confirm.",
  healthWeb:
    "Apple Health and Health Connect are available in the iOS and Android apps. This browser session cannot read them, and nothing is estimated in their place.",
  healthModule:
    "Health data is not linked in this development binary yet. No steps, heart rate, or sleep stages are invented in its place.",
  healthDenied:
    "Health Connect access is incomplete. VitaCore needs every required permission before it can run. Open Health setup or Health Connect settings and allow all VitaCore reads.",
  stagesNeedSource:
    "Sleep stages are shown only when Apple Health or Health Connect provides them. The microphone is not used to guess stages.",
  soundModel:
    "On-device sound classification is designed, and no model is bundled yet. Nothing here is labeled snoring, coughing, or speech.",
  gpsNativeOnly:
    "Route recording, including background location, runs in the iOS and Android app. This browser preview does not start a GPS session and does not invent a route.",
  mapTiles:
    "Routes are saved on this device and always drawn as an outline. A base map appears only in the iOS and Android app when a tile style you have licensed is configured. No public tile server is used as a fallback.",
  coachNeedsAccount:
    "The coach runs on your account so the Gemini key stays on the server and answers use saved data. It will not guess measurements you have not recorded.",
  coachNotConfigured:
    "The coach is not configured yet. Supabase and the Gemini secret live on the server, not in the app.",
  coachNotDeployed:
    "The ai-coach Edge Function is not deployed on this Supabase project yet. Deploy supabase/functions/ai-coach and set GEMINI_API_KEY as a function secret.",
  coachUnavailable:
    "The coach could not answer just now. Nothing was invented on this device.",
  coachPrivacy:
    "Questions are sent to Google Gemini on the free tier. Google may use that content to improve its products. The app does not turn on billing if the free allowance runs out.",
  calorieMinor:
    "The adult calorie equation is not shown under 18. A target is not estimated.",
  alarmLimit:
    "Wake alarms use a local notification. Delivery is not guaranteed if the app was force-quit, battery optimization blocked it, or exact-alarm permission is denied. A smart window only moves the time when a fresh light/awake sample exists — health history is not continuous stage detection.",
  wearableBridge:
    "Direct Fitbit and Garmin connections are not available to a new developer account right now. If those devices already write into Apple Health or Health Connect, that data can be read from there.",
  watchLater:
    "Apple Watch is not a separate app in this build. Watch measurements appear only when Apple Health already has them.",
} as const;
