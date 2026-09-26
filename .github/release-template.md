# AirPrint <version> — <platform / channel>

<!-- Template only. Copy to docs/releases/<tag>.md for an actual release, replace every placeholder, and remove instructional comments before publishing. A static-review-only snapshot must explicitly say that builds/device tests were not run. -->

Status: <internal alpha / beta / release candidate / stable>

## Release identity

| Field | Value |
| --- | --- |
| Tag | <annotated vMAJOR.MINOR.PATCH[-channel.N]> |
| Source commit | <full immutable SHA of the built source> |
| Source branch | <reviewed branch> |
| Build date | <UTC timestamp> |
| Release owner | <responsible maintainer> |
| CI/evidence | <links to checks and retained build/test reports> |
| Package version | <package.json version> |
| Android | <application ID, versionName, versionCode> |
| iOS | <bundle ID, marketing version, build number, or not released> |

## Changes

- <Concrete user-visible change and practical effect.>
- <Protocol/configuration/migration change, or explicitly none.>

## Supported deployment

- OS/device models: <exact tested versions, patch levels, manufacturers/models>.
- Printers: <model, firmware, transport, command set, encoding, paper width>.
- Network trust mode: <managed raw TCP with deployment requirements / authenticated protocol>.
- Limits: <job bytes, concurrent clients, queue jobs/bytes, timeouts>.
- Delivery semantics: <what success confirms and how uncertain jobs are handled>.
- Permissions/background behavior: <requirements, tested recovery, known OS restrictions>.

## Artifacts and provenance

| Artifact | Size | SHA-256 | Signing identity / verification |
| --- | --- | --- | --- |
| <AAB/APK/IPA filename> | <bytes> | <64-character hash> | <certificate fingerprint and verification evidence; no secrets> |

Toolchain: <Node, package manager, RN, native toolchain and SDK versions>. Source tree: <clean and exact commit verified>. Include architecture/ABI information and distinguish upload signing from distribution signing where applicable.

## Validation

Record **pass / fail / not run / not applicable**, with evidence; unchecked boxes are not successful checks.

| Check | Result | Evidence / reason |
| --- | --- | --- |
| Frozen clean dependency install | <status> | <CI URL/log> |
| Lint, formatting, TypeScript | <status> | <report> |
| Unit/service tests and coverage | <status> | <report and critical scenarios> |
| Signed native build; launch without Metro | <status> | <artifact/device evidence> |
| Binary fidelity, framing, queue/concurrency | <status> | <hardware/fixture report> |
| Permission, lifecycle, network and printer faults | <status> | <matrix report> |
| Background/memory soak | <status> | <duration, device, memory and failure counts> |
| Pilot | <status> | <dates, sites, jobs, write-success denominator, rejected/failed/unknown counts> |
| Security, dependencies, signing and privacy | <status> | <redacted results and credential disposition> |
| English/French and accessibility | <status> | <task results> |
| Upgrade and recovery rehearsal | <status> | <supported path and outcome> |

Production-plan gate reached: <G0–G4 and linked sign-off>. List any remaining blockers explicitly; alpha snapshots cannot be described as production-ready.

## Known limitations and operator actions

- <Known issue, impact, affected devices, workaround, tracking link.>
- <Any unsupported platform or printer family; distinguish untested from unsupported.>
- <How to reconcile an unknown print outcome without duplicating a receipt.>

## Install or upgrade

<Approved distribution track/link, prerequisites, settings/schema migrations, and actions required before/after upgrade. Never include tokens, keys, or receipt/customer data.>

## Rollout and recovery

<Pilot/cohort schedule, monitoring owner, exact stop thresholds, escalation/support contact, artifact retention, and recovery procedure.>

Previous validated version: <tag and artifact hash>. Forward-fix plan: <new higher build number, source/migration strategy, and verification>. Do not promise a data-preserving downgrade unless tested and supported by the distribution mechanism.

## Privacy and licensing

<Privacy-policy/support links, data/diagnostic behavior changes, permissions rationale, license and third-party notice status.>
