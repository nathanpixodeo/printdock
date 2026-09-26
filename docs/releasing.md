# Repository metadata and release guide

This guide defines the release process for AirPrint. A debug/JS CI workflow is now checked in, but hosted execution, signing, store distribution, branch protection, and release gates are not certified. At assessment baseline `ebb5947`, no local tags were present; no version tag has been created by this work. The app is pre-production and the [production-readiness gates](production-readiness.md) must precede a release claim.

## Repository description and topic tags

[`.github/repository-metadata.json`](../.github/repository-metadata.json) is the reviewed source for the GitHub description and topics. GitHub does not automatically apply this custom JSON file. `package.json` mirrors the description and keywords and includes repository, homepage, and issue links; `private: true` continues to prevent accidental npm publication.

Description:

> React Native Android app that bridges raw TCP print jobs over LAN to paired Bluetooth thermal printers, with foreground-service controls and a TypeScript UI. Pre-production; iOS experimental.

Topics:

`react-native`, `typescript`, `android`, `bluetooth`, `thermal-printer`, `escpos`, `tcp-server`, `print-server`, `point-of-sale`, `receipt-printer`, `foreground-service`, `lan-printing`, `mobile-app`.

`escpos` describes a relevant printer command stream that clients may supply; the app is not an ESC/POS document renderer. Do not add Apple AirPrint, certified-printer, or iOS-production claims without implementing and validating them.

To inspect hosted metadata with the GitHub CLI:

```sh
gh repo view nathanpixodeo/air-print-app --json nameWithOwner,description,repositoryTopics,visibility
```

To apply the checked-in description and add its topics from PowerShell, after reviewing the JSON:

```powershell
$repoMetadata = Get-Content -Raw .github/repository-metadata.json | ConvertFrom-Json
gh repo edit $repoMetadata.repository --description $repoMetadata.description --add-topic ($repoMetadata.topics -join ',')
```

Adding topics preserves any existing topics. Review obsolete topics before removing them. Repository visibility, access, and branch settings are separate from description/topics; this metadata procedure does not change them. Local `.git/description` is not GitHub's About description and is not a versioned project deliverable.

## Version and tag policy

Use semantic versions and annotated Git tags. Keep prerelease maturity explicit; a tag is a pointer to source, not evidence of production fitness.

| Release type            | Example tag      | Requirements                                                                                       |
| ----------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| Internal alpha snapshot | `v0.1.0-alpha.1` | Identified commit and build/validation status; limitations clearly documented; no production claim |
| External beta           | `v1.0.0-beta.1`  | All P0 work closed; signed artifact and controlled testing scope                                   |
| Release candidate       | `v1.0.0-rc.1`    | G3 complete; exact artifact enters pilot; no known P0/P1 defects in claimed scope                  |
| Stable                  | `v1.0.0`         | G4 complete, pilot evidence and release-owner sign-off                                             |
| Compatible correction   | `v1.0.1`         | Regression evidence and fresh higher native build number                                           |

These names are examples, not existing/planned release announcements. Confirm prior published build numbers in the distribution console before choosing numbers. An alpha can document an incomplete baseline; do not label it beta/RC merely to make the repository look complete.

Before tagging, synchronize:

- `package.json` version and any release manifest (Yarn Classic's lockfile does not contain a root application version).
- Android `versionName` and monotonically increasing `versionCode`.
- iOS `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`, if shipping iOS.
- The Settings version display, generated/read from the selected version source instead of hard-coded text.
- Changelog heading, release manifest, tag annotation, and release title.

Package, Android `versionName`, and the package-backed Settings display now agree at `0.0.1`; Android code remains `1`. Experimental iOS retains marketing `1.0`/build `1` and is excluded from the proposed Android release. Verify distribution history before assigning codes. Native/store marketing versions may need numeric `MAJOR.MINOR.PATCH` while Git/package use `-rc.N`; record the mapping and advance native build numbers on every distributed rebuild.

Increment major version for a breaking print protocol/configuration contract, minor for compatible features, and patch for compatible fixes. Before 1.0, explicitly document compatibility expectations. Never reuse, move, or force-push a published version tag. A failed candidate receives a new version/prerelease identifier and build number.

## Release metadata contract

Use [`.github/release-template.md`](../.github/release-template.md) to create a filled note at `docs/releases/<tag>.md` after building an actual candidate. That directory is intentionally absent until a release is prepared. Include the completed note in the annotated tag and hosted release, and archive it in a documentation commit. The archive commit can follow the built source commit: the tag must identify the source that produced the artifact, not the later note archive. This avoids requiring a source commit to contain its own hash or future artifact checksum.

Every release needs:

| Field         | Required contents                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Identity      | Tag, release title, channel, UTC build date, release owner                                                 |
| Source        | Full commit SHA, branch, clean-worktree confirmation, CI run URL                                           |
| Application   | Package version, Android application ID/name/code, optional iOS bundle ID/marketing/build                  |
| Toolchain     | Node/package-manager/RN versions, JDK/Gradle/SDK/NDK or Xcode/CocoaPods versions                           |
| Artifacts     | Platform filename, byte size, SHA-256, architecture set, signing certificate fingerprint where applicable  |
| Compatibility | Device/OS/printer/firmware/transport matrix, payload/queue limits, network trust mode                      |
| Validation    | Lint/types/tests, native build, binary/concurrency/fault tests, soak and pilot results with evidence links |
| Changes       | User-visible changes, migrations, protocol/configuration changes, known issues                             |
| Operations    | Rollout stages, stop criteria, privacy/diagnostic policy, support owner, forward-fix procedure             |

Git supplies annotation author/date and object identity; include semantic release information in the annotation as well. Sign tags with `git tag -s` where the maintainer has an established signing identity; otherwise use `git tag -a` and document provenance through the protected CI release job. Tag signing and mobile application signing are distinct.

## Signing and build preparation

Complete SEC-01 before distribution. Tracked signing values have been removed, but historical exposure remains unresolved. Do not copy historical passwords into a secret store and assume exposure is resolved. Determine whether they protect a real key and whether password replacement, upload-key reset, or a store signing-key process is required. Preserve the ability to update installed apps.

The Android build references these Gradle properties:

- `MYAPP_RELEASE_STORE_FILE`
- `MYAPP_RELEASE_STORE_PASSWORD`
- `MYAPP_RELEASE_KEY_ALIAS`
- `MYAPP_RELEASE_KEY_PASSWORD`

Provide these through CI's masked secret facility or the developer's untracked user Gradle properties. Gradle environment variables can use `ORG_GRADLE_PROJECT_` followed by the property name. Keep the keystore outside the repository; use a verified absolute path. Do not put secrets in command-line arguments or release notes/logs. An arbitrary `android/gradle.properties.local` file is ignored by Git but is not automatically loaded by Gradle.

The `validateReleaseSigning` task is wired into release builds and checks for missing configuration; debug builds do not require release credentials. Verify signer, package ID, versions, SDKs, ABIs, and native-library compatibility in the actual artifact. Retain certificate fingerprints/recovery custody in the appropriate private record; never attach private keys to a release.

After the build baseline and checks are repaired, the existing Android project can be built with the wrapper:

```powershell
# From the repository root on Windows; secret properties are already provisioned.
cd android
.\gradlew.bat bundleRelease
cd ..
```

On macOS/Linux, use `./gradlew bundleRelease` from `android/`. Expected AAB path: `android/app/build/outputs/bundle/release/app-release.aab`. For managed sideload testing, `assembleRelease` produces an APK under `android/app/build/outputs/apk/release/`; verify the actual filename instead of assuming it. An AAB is installed through a distribution track or a bundletool-generated APK set, not directly as an APK.

Record checksums, for example:

```powershell
Get-FileHash -Algorithm SHA256 android/app/build/outputs/bundle/release/app-release.aab
```

These commands are a future release procedure, not evidence of a successful build in this documentation change. iOS archive/export instructions should be finalized only after IOS-01 establishes a real supported target and signing identity.

## Candidate workflow

1. Close the appropriate production-plan gates and identify the exact supported scope. Recheck current store SDK, background-service, privacy, and native-library requirements.
2. Reconcile versions and native build numbers, update the changelog, and commit the candidate source through the normal review process. Record its full SHA.
3. From a clean checkout of that immutable commit, run the pinned install, lint/types/tests, signed build, artifact verification, and physical-printer tests. Then fill the release-note template with the built source SHA, CI URLs, and artifact hashes. Archive the notes in a separate documentation commit if needed; retain the original built source SHA as the tag target. A changed code/dependency/native candidate requires a new build and affected validation.
4. Confirm the build checkout was clean, the candidate commit is reachable from the intended reviewed branch, and the desired tag is unused locally and remotely. Reconcile any local changes before tagging; verify an archived notes file refers to the candidate rather than assuming the current `HEAD` was built.
5. Create an annotated tag on the explicit commit. Read back its commit and annotation before publishing. Push that one tag only after the release owner approves the candidate evidence.
6. Create a draft GitHub prerelease with the same tag, notes, and artifact. Verify uploaded checksums, fill all evidence, then publish only to the approved pilot audience/channel.
7. Run the pilot. Stable promotion must identify exactly which artifact was tested. Rebuilding, even for a version change, requires a fresh artifact hash, appropriate checks, and increased build number when distributed.

Example commands **after** a real candidate has passed its gate; replace `FULL_VALIDATED_COMMIT_SHA` and use an existing, fully completed notes file:

```sh
git status --short
git ls-remote --tags origin
git tag --list
git tag -a v1.0.0-rc.1 FULL_VALIDATED_COMMIT_SHA -F docs/releases/v1.0.0-rc.1.md
git show --no-patch v1.0.0-rc.1
git rev-list -n 1 v1.0.0-rc.1
git push origin refs/tags/v1.0.0-rc.1
gh release create v1.0.0-rc.1 --repo nathanpixodeo/air-print-app --verify-tag --prerelease --draft --title "AirPrint 1.0.0-rc.1 - Android release candidate" --notes-file docs/releases/v1.0.0-rc.1.md
```

Use `--verify-tag` to prevent GitHub CLI from silently creating a missing tag. Upload only validated artifacts and their checksum manifest; keep receipt fixtures containing personal data, credentials, debug logs, private signing files, and internal secrets out of release assets. No tag/push/release-creation command is executed merely by adding these instructions.

The checked-in CI workflow runs JS and unsigned-by-release-key debug checks with pinned actions and retained reports. A future release workflow must protect signing environments, verify source-to-tag correspondence, and restrict credentials. Untrusted pull requests must not receive signing keys. No hosted branch protection or release environment is configured by this work.

## Rollout, stop conditions, and recovery

Start with internal testers, then a named small pilot, then progressively expand the approved distribution cohort after reviewing evidence. A possible rollout is 5%, 25%, 100%, with at least 24 hours of healthy observation between production increases after the pilot; managed deployments can use equivalent device/site cohorts. Record actual percentages, dates, owners, and thresholds in each release.

Halt expansion for receipt corruption/interleaving, unexplained duplicate output, credential exposure, repeatable background failure, or a breached pilot success threshold. Investigate printer/network incidents separately from app regressions but record both.

Mobile rollback is usually a forward fix: stop the rollout and ship reviewed known-good behavior in a new build with a higher native build number. App stores and Android generally do not offer a universal data-preserving downgrade. Keep the previous source, migration strategy, signing access, and tested recovery procedure; do not promise that users can install a lower version over the current one.

If a receipt's outcome is unknown, ask the operator to reconcile it before reprinting. Stop the server where appropriate and retain only redacted diagnostics. Do not turn a fleet recovery step into automatic receipt replay.
