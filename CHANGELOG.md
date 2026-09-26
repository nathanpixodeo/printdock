# Changelog

Record user-facing changes and release evidence here. Version headings must correspond to actual released tags; planned milestones belong in the production plan.

## Unreleased

### USB OTG transport (experimental)

- Add a separate Android USB host path for attached printer-class or vendor-specific interfaces exposing bulk OUT. Request Android's per-device USB permission on connect, preserve binary write order and partial-transfer accounting, and surface detach/write failure as an unknown receipt outcome.
- Add separate USB discovery and selection in Home without requesting Bluetooth permission. USB device paths are ephemeral and are not persisted; Bluetooth selection behavior remains unchanged.
- Reuse the existing bounded raw-TCP receiver and FIFO for either selected transport. No USB serial, generic driver/spooler, IPP, or printer-language conversion is included; a physical model/firmware test is required before claiming compatibility.
- Add a test-only simulated USB sink for binary/FIFO/failure/detach cases and USB bridge adapter tests. The simulator is not part of the app's UI or a claim of physical-printer compatibility.

### PrintDock frontend

- Rename the app experience to PrintDock and credit Nexkit; add Vietnamese while retaining English and French.
- Align the Android package, experimental iOS project/bundle ID, React Native component, deep links, and repository name with PrintDock. The new Android ID installs as a separate app; old app data and links are not migrated.
- Introduce a shared accessible design system for typography, controls, icons, status, and branded presentation.
- Rework Home as a print-server controller with explicit paired-printer discovery and persistent configuration/actions while discovery is pending or fails.
- Expand Settings with saved theme and language preferences, immediate language selection, and app information.
- Refresh the Android launcher icon and splash screen for PrintDock and Nexkit.

### Documentation and metadata

- Replace the introductory README with an implementation-based guide covering the print contract, platform limits, development setup, configuration, security, checks, and troubleshooting.
- Add a production-readiness backlog with evidence, accountable roles, acceptance criteria, release gates, and a physical-device validation matrix.
- Add repository description/topic metadata, package discovery metadata, and a release procedure/template for versioning, signing, artifacts, rollout, and rollback.
- Correct unsupported claims about iOS readiness, active API configuration, obsolete source paths, and license verification.

### Release status

- Pre-production: no signed candidate, hardware certification, store release, or version tag is created by these changes.
- Android/UI version now follows package `0.0.1`; Android build code remains `1`. iOS is experimental; its project identity changes are not evidence of an iOS release.

### Android hardening

- Add bounded binary TCP receive, clean-EOF admission, FIFO printer writes, deadlines, client/queue limits, lifecycle snapshots, startup cancellation, and cleanup/restart protection.
- Reduce app-side print-bridge overhead with bounded 16 KiB JS-to-native batches and two connection-status calls per job, while retaining ordered 4 KiB Bluetooth writes and session checks; physical speed improvement remains unmeasured.
- Replace obsolete Bluetooth serial and unused printer dependencies with an app-owned Android Classic SPP bridge; preserve binary bytes, reject write failures, scope disconnects by native session, and never automatically replay uncertain jobs.
- Bind only the validated local IPv4; enforce integer ports and exact confirmed deep links.
- Persist printer/port/language, preserve service state across theme/navigation changes, expose failures, and add root error handling/accessibility labels.
- Remove tracked signing values, require external release signing, cap legacy permissions, and handle notification permission. Untrack `.env` without deleting the local copy; historical credential remediation remains open.
- Pin and patch the background-service dependency for immutable package-scoped notification intents, connected-device metadata, and null-intent recovery. Remove unused location permission; guard cancelled late HeadlessJS task startup before permitting restart.

### Engineering

- Pin Node 22.23.3 and Yarn 1.22.22; consolidate lockfiles, remove undeclared install hooks, repair lint/types and test reporting.
- Normalize text line endings through Git attributes so Windows checkouts and Linux CI agree with formatting checks; keep batch scripts CRLF.
- Add service/pipeline/adapter/UI regression tests and coverage, production bundle checking, and Android debug/lint CI definitions.
- Do not interpret passing mocked tests as native transport or physical printing certification; remaining gates and dated evidence are in the production plan.
