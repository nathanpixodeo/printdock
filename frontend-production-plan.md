# Frontend production refactor

Status: implementation approved on 2026-09-25. Display brand is PrintDock by Nexkit; Vietnamese is implemented alongside English/French. Existing TCP/Bluetooth service hardening and uncommitted user changes are preserved. Native build, 73 tests, TypeScript, ESLint, formatting, production-mode bundle, and earlier branded-APK emulator flows passed. After a user factory reset, the branded APK reinstalled and fresh-install Home/Settings, all three languages, both themes, and the Nearby devices denial/settings path rendered. A guest `system` ANR and a PrintDock focus ANR interrupted further tests; the VM then stalled on a lower-memory restart and is currently powered off. Fresh-install persistence/recovery, stable emulator operation and physical-printer acceptance remain open. See `docs/genymotion-testing.md` for executed evidence and the retained bugreport.

## Scope and direction

- Android-first React Native 0.75 UI; no framework migration or new web animation dependencies. iOS remains unqualified until built and tested on macOS.
- Rename the display brand to PrintDock, retaining package/component/deep-link identities. The new mark must not imply Apple AirPrint protocol compatibility; the user-supplied Nexkit developer logo is preserved.
- Calm ink-blue, teal and warm-neutral visual language, semantic light/dark tokens, system typography, consistent vector interface icons, and generous touch targets.
- Home: clear connection/readiness status, actionable printer/permission/network states, explicit port validation, discoverable start/stop action, and no fabricated activity metrics.
- Settings: explicit accessible theme/language choices, app information, and persistent preferences.
- Native Android adaptive launcher icon and bounded, correctly scaled splash artwork. Essential UI must never depend on animation completion.
- Vietnamese joins English/French with explicit Settings choices and tested translation parity.

## Work sequence and ownership

1. Capture current UI/runtime findings and preserve regression coverage.
2. Main agent owns the visual contract, shared UI components, Home refactor, controller behavior, integration, and emulator verification.
3. A bounded worker owns only Android branding resources and splash integration after the brand asset contract is fixed.
4. A bounded worker owns only preference persistence/language schema and associated tests after language choice is fixed.
5. Integrate Settings and translations against the shared UI contract; run format, lint, strict types and unit tests.
6. Build an x86_64 debug APK, install without clearing app data, and verify real screens, validation, navigation, preference persistence, permission recovery and safe external-link behavior on Genymotion.
7. Record artifacts, observed failures and untested production gates. No commit, push, release or version tag is implied.

## Baseline findings

- Existing debug APK installs and opens on Genymotion Samsung Galaxy S24, Android 14/API 34, x86_64, 1080x2340.
- Initial Home, navigation, theme/language switching, and invalid ports 80/65536 were exercised successfully.
- Settings back-arrow has insufficient dark-theme contrast.
- After force-stop/relaunch, Home body was observed missing while the header remained; later navigating to Settings still worked. Theme restoration was not verified; possible concurrent interaction was queried. Preserve evidence in artifacts/genymotion before claiming a root cause.
- Nearby-device permission was ultimately granted; the attempted denial flow is inconclusive and must not be reported as passed.
- Genymotion does not qualify Bluetooth SPP printing, physical receipt quality, OEM background restrictions, signed-release behavior or store readiness.

## Acceptance gates

- No service lifecycle/security regression; failed state still exposes cleanup/retry, external links still require exact parsing and confirmation, UI status comes from the service snapshot.
- Content remains usable during slow/failed printer discovery and with animation disabled.
- Descriptive accessibility labels/states, at least 48dp controls, non-color-only status, readable contrast, scrolling and font scaling. Full TalkBack/device certification remains explicit if not executed.
- Vietnamese/English/French translation parity; no untranslated ordinary interface copy.
- Persist valid port/theme/language through process restart; reject invalid input without silently starting a server.
- Android 12+ splash and legacy fallback use the same brand identity without a stretched full-screen launcher image.
- Passing relevant tests, types, lint, formatting, debug build and documented emulator evidence; no unsupported claim that the entire app is production-certified.
