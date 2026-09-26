# PrintDock UI and brand system

PrintDock by Nexkit is the Android-first operator interface for the existing TCP-to-Bluetooth bridge. This increment changes presentation, preference handling and Android branding; it does not certify the print pipeline or make the unauthenticated TCP protocol safe for public networks.

## Product identity

- Display name: **PrintDock**. Developer: **Nexkit**.
- Compatibility identities remain `com.airprint`, React Native component `AirPrint`, and `airprint://printserver/...`. Do not rename these casually: installed data, intents, native modules and integrations rely on them.
- No Apple AirPrint, IPP or Bonjour implementation or affiliation is implied. Store-name/trademark clearance remains an owner responsibility.
- The provided Nexkit logo is copied unchanged. White backing is intentional in dark mode because its lettering is dark.
- Original project-local artwork lives in `src/theme/assets/brand/`; Android copies live in `android/app/src/main/res/drawable-nodpi/`. Source PNGs retain their alpha and aspect ratio.

## Visual contract

| Element        | Contract                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Palette        | Ink `#102E3A`, teal `#087F70`, warm offwhite `#F5F8F7`; semantic dark counterparts rather than inverted text colors                 |
| Typography     | Native system font; 30/38 display, 22/29 title, 17/24 heading, 15/23 body, 12/18 supporting text                                    |
| Spacing        | 4px base rhythm; 20px mobile content inset; centered maximum content width of 600dp                                                 |
| Controls       | At least 48dp touch targets; primary actions at least 54dp; explicit disabled/busy/radio state                                      |
| Icons          | A single 24-unit stroke vocabulary implemented with existing `react-native-svg`; decorative icons excluded from accessibility focus |
| Motion         | Essential content has no animated opacity gate. No decorative perpetual motion; UI remains usable without animations                |
| Status         | Service-snapshot driven, visible text plus non-color-only status; no fake job history or invented metrics                           |
| Primary action | Start/Stop remains in a bottom action area while configuration scrolls; large text can wrap                                         |

Source of truth: `src/design/tokens.ts`, `Icon.tsx`, `components.tsx`, and `Brand.tsx`. Existing theme-provider aliases are retained for compatibility with legacy reusable components, but new surfaces use semantic tokens. Avoid using a color named `white` for both text and surfaces.

## Screen and state architecture

`Startup.tsx` composes presentation; `usePrintController.ts` handles service subscriptions, selected printer, port, discovery, IP refresh, lifecycle guards and confirmed deep links. `printServerService` remains the source of server truth.

- The screen is visible immediately, including while discovery is pending or fails. Permission rejection cannot hide the configuration or Settings.
- First-time Bluetooth discovery follows an explicit action. An already-saved printer selection triggers refresh on startup; scanning does not start the print server.
- Discovery is single-flight, clears stale device results on failure and offers a localized recovery route to Android app settings.
- Bluetooth pairings are managed by Android. PrintDock lists already-paired devices; it does not pretend to pair or discover unpaired hardware.
- Only integer ports 1024–65535 are accepted. A valid port is saved; malformed input is rejected visibly and cannot start the service.
- Configuration is locked during service activity and failed cleanup. A failed service still exposes Stop so cleanup can be retried.
- Exact external links still require valid configuration and explicit confirmation. The app never auto-starts the server after reopening.
- The footer and Settings explain the unauthenticated/plaintext local-network boundary. Do not replace this with an unsupported “secure printing” claim.

## Preferences and languages

Settings uses explicit radio choices, not a blind toggle. Vietnamese, English and French share all translation keys and interpolation placeholders; tests enforce parity. Missing/invalid saved languages fall back to English. Existing saved English/French choices remain valid.

Theme and language changes persist in existing MMKV storage. Theme initialization validates the stored value and does not overwrite a selection from a later mount effect. Tests cover remount and invalid-value recovery. No data migration or clearing is required.

The runtime printer/service may expose technical English diagnostics. Physical-device, notification and full screen-reader localization acceptance remains separate from translation-catalog parity.

## Android launcher and splash

- Adaptive launcher assets use a bounded PrintDock mark on ink; API 33+ has a monochrome printer glyph. Legacy launcher fallback is retained.
- API 31+ uses platform splash attributes; older Android versions use a bounded layer-list fallback. Both use a light background and the Nexkit branding mark.
- `MainActivity` switches to `AppTheme` before React initializes. The splash graphic is no longer the activity's persistent window background.
- No artificial splash delay, new animation dependency, package-ID change or data reset was added.
- Existing unused artwork remains for recoverability and contributes resource warnings; no warning suppression was introduced.
- iOS display name is updated, but iOS icon/splash parity and runtime remain unverified and outside this Android acceptance run.

## Asset provenance

`nexkit-logo.png` is the user-provided `Nexkit Logo.png`, copied without editing. `printdock-mark.png` was generated with the built-in image-generation tool, inspected, and copied into this repository; no API-key workflow or external image service was added to the app. The delivered PNG has transparency, which is preserved; native/UI containers supply the ink backdrop.

Generation prompt:

> Use case: logo-brand. Asset type: production mobile app launcher icon and brand symbol for PrintDock, an Android utility connecting local-network print jobs to Bluetooth thermal printers. Create one original minimal geometric symbol: a small white receipt sheet entering a rounded printer/dock shape, with a restrained mint-teal connection accent. Strong distinctive silhouette, balanced negative space, thick clean geometry readable at 24px. Flat vector-like precision, contemporary industrial/productivity identity, no realism, no gradients, no texture, no shadow. Square canvas, solid uniform deep ink navy #102E3A background extending fully to every edge (not rounded corners). White #FFFFFF and mint-teal #55DBC2 mark occupies the central 60 percent of the square, generous empty margin suitable for Android adaptive icon masking. Exactly one centered icon, no lettering or words at all, no border, no badge, no additional symbols, no Bluetooth trademark, no Apple or AirPrint visual references, no watermark. Output a polished crisp square PNG asset.

## Acceptance scope

Automated checks cover configuration/deep-link guards, loading/error visibility, explicit Settings choices, persistence, translation parity, and selected semantic text pairs at 4.5:1 contrast. These are targeted checks, not a claim of complete WCAG compliance. TalkBack, switch access, RTL, smaller devices and physical-printer flows still require manual acceptance.

See [Genymotion verification](genymotion-testing.md) and the [production gates](production-readiness.md) for actual executed evidence, APK identity and outstanding release work.
