# Sleep system

Status labels used below:

- **IMPLEMENTED — NOT VERIFIED** — code exists; not proven on a physical device.
- **VERIFIED IN AUTOMATED TESTS** — domain/unit tests cover the behavior.
- **VERIFIED ON PHYSICAL DEVICE** — only after real hardware QA.
- **BLOCKED** — needs external credentials, hardware, or approval.

## Manual sleep lifecycle

| Capability | Status |
| --- | --- |
| Start Sleep, persist timestamp, show elapsed | IMPLEMENTED — NOT VERIFIED |
| Duplicate active-session prevention | VERIFIED IN AUTOMATED TESTS |
| Swipe to wake + button alternative | IMPLEMENTED — NOT VERIFIED |
| Cancel without inventing asleep duration | VERIFIED IN AUTOMATED TESTS |
| Recover unfinished session after restart | VERIFIED IN AUTOMATED TESTS (domain + prefs) |
| Edit / delete manual entries | IMPLEMENTED — NOT VERIFIED |
| Distinguish elapsed / in-bed / asleep | VERIFIED IN AUTOMATED TESTS |

Active sessions are stored in the local `preferences` key `active_manual_sleep`. Completed nights go to `sleep_sessions` with optional `in_bed_*`, `session_*`, and `asleep_confirmed` columns (local migration via `ensureColumn` only).

## Health-platform stages

| Capability | Status |
| --- | --- |
| Health Connect / HealthKit readers | IMPLEMENTED — NOT VERIFIED |
| Overlap dedupe + source priority helpers | VERIFIED IN AUTOMATED TESTS |
| Invalid / future / >24h rejection | VERIFIED IN AUTOMATED TESTS |
| Missing stages → no invented REM/deep/light | VERIFIED IN AUTOMATED TESTS |
| Wearable data only via connected platform | Documented; no direct Fitbit/Garmin/etc. APIs |

## Score, reports, activity load

| Capability | Status |
| --- | --- |
| `scoreSleep` with incomplete inputs | VERIFIED IN AUTOMATED TESTS |
| Bedtime consistency MAD | VERIFIED IN AUTOMATED TESTS |
| VitaCore activity load (0–21 heuristic) | VERIFIED IN AUTOMATED TESTS |
| Recovery requires ≥2 real inputs | VERIFIED IN AUTOMATED TESTS |

## Smart alarm & sleep notifications

| Capability | Status |
| --- | --- |
| Alarm settings UI + persistence | IMPLEMENTED — NOT VERIFIED |
| Window selection + fallback | VERIFIED IN AUTOMATED TESTS |
| Sleep reminder categories + quiet hours | VERIFIED IN AUTOMATED TESTS |
| Duplicate prevention / reschedule | VERIFIED IN AUTOMATED TESTS |
| OS delivery when backgrounded / Doze | BLOCKED (device QA) |
| Exact alarm permission on Android 12+ | BLOCKED (device QA) |

## Privacy

Microphone is not activated for sleep. Sleep sounds remain playback-only. No fabricated snoring or stages.

## Device checklist (still required)

1. Start Sleep → force-quit → reopen → session recovers.
2. Wake via swipe and via button; history shows unconfirmed vs confirmed asleep.
3. Health Connect / HealthKit permission grant, deny, revoke.
4. Enable alarm; verify next wake label; test alarm; background delivery.
5. Toggle sleep reminder categories; confirm quiet hours skip non-alarm reminders.
6. Confirm no microphone prompt appears from Sleep screens.
