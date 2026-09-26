# Genymotion smoke testing

Use Genymotion for Android installation, startup, navigation, settings, validation, and crash checks. It does not certify Bluetooth Classic SPP printing, physical receipts, OEM background behavior, or printer fault recovery.

All `artifacts/` paths below describe ignored files retained on the test workstation. They are evidence identifiers, not downloadable files in a fresh clone or published release assets. Rebuild from the recorded source commit when a local artifact is unavailable; a new build has a different identity and must be rehashed and retested.

The historical runs in the longer record below used the former `com.airprint` application ID. After the full PrintDock rename, the new `com.nexkit.printdock` APK installs as a separate app; those old screenshots and hashes do not validate its installation, data migration, or runtime. The procedural commands later in this guide target the new ID.

## Full-identity PrintDock smoke test (2026-09-26)

- A local x86_64 `:app:assembleDebug :app:lintDebug` completed after the Android package/RN component/deep-link rename. The generated `android/app/build/outputs/apk/debug/app-debug.apk` has SHA-256 `29e4e1a169a45e847f4b209eba608731ed8d8ce0af7ab7ed0213fc1ddb94aadd`. `aapt` reports package `com.nexkit.printdock`, version `0.0.1`/code `1`, launchable activity `com.nexkit.printdock.MainActivity`, label PrintDock, and `printdock://printserver` intent-filter entries. This is a debug APK requiring Metro, not a release artifact.
- The APK installed with `adb install -r` on the running Genymotion Android 14 Galaxy S24 without uninstalling the former app. `adb reverse tcp:8081 tcp:8081` connected it to the existing Metro server; a cold `am start -W -n com.nexkit.printdock/.MainActivity` returned `Status: ok` and a running process. Home rendered with PrintDock branding, a stopped server, default port 9100, Bluetooth/USB choices, and no selected printer. UI evidence is in local ignored `artifacts/genymotion/printdock-rename-*` files.
- The new `printdock://printserver/start` intent resolved to the running app. With no printer selected it displayed the expected invalid-configuration alert rather than starting a listener. A `printdock://printserver/stop` intent also resolved but did nothing because the server was already stopped. No physical printer, USB permission/bulk transfer, Bluetooth print, sustained background operation, or iOS build was tested. The app was not checked for migration from the former package; none is implemented.

## Local verification record (2026-09-25–26)

- Build: **passed**, `:app:assembleDebug` with `reactNativeArchitectures=x86_64`.
- Retained APK: `artifacts/genymotion/airprint-0.0.1-debug-x86_64.apk` (debug-signed, requires Metro).
- SHA-256: `4a42431be034d179c5380c692ad710e03bb609c01d796e8d7bf527626024cdc0`.
- Package inspection: x86_64 Hermes, React Native, MMKV, Reanimated, and Screens libraries are present; APK signature verification succeeds.
- Device: Genymotion Samsung Galaxy S24, Android 14 / API 34, `x86_64,x86`, physical resolution 1080 × 2340.
- Installation: **passed**, `adb install -r` returned `Success` for the retained APK on `192.168.56.101:5555`.
- Original APK runtime: launched successfully. Home, Settings, language/theme switching, invalid ports 80/65536, and the no-printer error were exercised. A later reopen showed the Home body missing while its header remained; this prompted the frontend refactor.
- PrintDock native APK: `artifacts/genymotion/printdock-0.0.1-debug-x86_64.apk`, SHA-256 `d9386ee0c8af752abe095715dede4acd4ecfc6f3a9a988ec4fe26b78a396674b`. `adb install -r --no-streaming` returned `Success` over the old package without clearing its data. Android package remains `com.airprint`.
- PrintDock runtime with Metro: the installed APK launched. Home and Settings rendered in dark/light mode; Vietnamese, English and French changed immediately. Home showed saved port 9200 after process force-stop/relaunch, and the body remained visible. Invalid port 80 displayed a validation error; returning to 9200 cleared it. Start without a printer showed a localized error. The first explicit paired-printer scan showed Android's Nearby devices prompt; denial showed a localized recovery action that opened the correct app settings page. Re-enabling Nearby devices restored both Bluetooth permissions and scanning. Screenshots and UI XML are retained as `artifacts/genymotion/23-printdock-loaded.*` through `48-discovery-recovered.*` (selected steps).
- Native `:app:assembleDebug :app:lintDebug` passed for x86_64; app lint reported 0 errors and 35 warnings. Final TypeScript, full ESLint, Prettier, `git diff --check`, and Jest verification passed on 2026-09-26 (73 tests, 13 suites).
- Final production-mode Metro bundle (separate from the debug APK): `artifacts/genymotion/printdock-bundle-final/index.android.bundle`, 2,468,813 bytes, SHA-256 `c5b1750e139f9ad0455c4f3ae4506287b00bb0db67b51eaf0e8ac3e646cd75e8`; eight assets copied. It validates bundling but is not an offline signed release APK.
- Stability issue: the VM initially used 8192 MB/8 CPUs on a 16 GB host and became unresponsive. At 4096 MB/4 CPUs, one cold boot reached `sys.boot_completed=1`, but `adb reboot` stuck before ADB returned. At 3072 MB/2 CPUs, one cold boot reached Android and PrintDock with saved data intact; a later soft reboot and repeated cold boots stalled at Genymotion's second-stage startup. Genymotion `--coldboot` and direct VirtualBox startup did not fix the repetition. A separate clone from the factory snapshot also failed to reach ADB; it was removed after the test, leaving the original VM and its data intact. VirtualBox reports Hyper-V backed NEM “Snail execution mode,” but its causal role is not proven. The original VM is currently powered off, with 3072 MB/2 CPUs and its original `legacy` paravirtualization setting restored. No VM disk or app data was deleted.
- Final retry after closing Genymotion Desktop: started the original VM at approximately 03:03 local time on 2026-09-26. More than three minutes later, `192.168.56.101:5555` still refused ADB and the display remained at second-stage startup (`artifacts/genymotion/66-final-failed-boot.png`). The stuck VM was powered off; the installed PrintDock APK and preferences remain on its disk. Do not mistake Genymotion's `On` state for a completed Android boot.
- Morning retry at 09:10 local time with Genymotion Desktop open: `gmtool admin start --coldboot` changed the VM to `On`, but ADB still refused connections and the guest console showed repeated system failures (`artifacts/genymotion/67-morning-boot.png`). Enabling HPET only for this VM did not advance startup or restore ADB; HPET was returned to `off`. The original VM is again powered off, while the Genymotion Desktop window remains open.
- Factory-reset retry on 2026-09-26: the user reset the original Galaxy S24 and Android 14 reached `sys.boot_completed=1`; ADB reported `192.168.56.101:5555` and 1080 × 2340. The reset removed `com.airprint`. Reinstalling the retained PrintDock x86_64 debug APK with `adb install -r --no-streaming`, forwarding Metro port 8081, and launching `.MainActivity` succeeded. Fresh-install Home rendered with the default English/light theme and stopped server (`artifacts/genymotion/70-after-wait.png`). Settings navigation, Vietnamese/English/French and light/dark changes rendered (`71-` through `76-` evidence). The explicit paired-printer action requested Android Nearby devices permission; denial produced an actionable in-app message and **Open app settings** led to the correct Android permission page. Granting Nearby devices there set both `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` to allowed (`77-` through `82-` evidence). No printer was paired.
- This retry did **not** pass stability: Android's `system` process showed an ANR at 02:30 UTC before the app UI appeared (`69-system-anr.png`), and returning from Android permission settings produced a `com.airprint` input-focus ANR at 02:38 UTC (`83-return-from-settings.png`, `83-return-from-settings.xml`). The captured ANR stack has the app main thread waiting in Android HWUI `RenderProxy::setStopped` while RenderThread is in HWUI frame-commit/JNI code. This does not establish an app-code root cause; the earlier system ANR and severe guest/host memory pressure are confounders. The ADB connection then went offline, so fresh-install port validation, preference persistence, permission-recovery rescan, and crash-free completion remain unverified. A local Android bugreport with ANR traces is retained at `artifacts/genymotion/printdock-anr-bugreport.zip` (review for sensitive data before sharing).
- Factory reset also restored this VM's allocation to **8192 MB / 8 CPUs**; Windows had only about 0.8 GB physical RAM free while it was running. The previously approved reduction to **4096 MB / 4 CPUs** was applied after a normal Genymotion stop. A subsequent start remained at Genymotion `second_stage`, with no ADB device after several minutes (`87-boot-4096mb.png`, `88-boot-4096mb-late.png`). The stalled session was stopped through Genymotion. **Current state: original VM powered off, 4096 MB / 4 CPUs; its factory-reset app install and settings remain on disk.** The reset itself removed prior preferences, so earlier saved-port evidence does not carry across the reset.
- A later bridge-overhead optimization produced `artifacts/genymotion/printdock-0.0.1-debug-x86_64-batched.apk` (SHA-256 `c019b34a25b94fedf6ccf00a106b376a659e63598a66d6348483e05ee1f665d8`). It built successfully but **has not been installed on the stopped VM**. Screenshots and permission flows above belong to the earlier, unbatched PrintDock APK; they do not validate this newer binary or physical print speed.
- The subsequent USB OTG integration produced `artifacts/genymotion/printdock-0.0.1-debug-x86_64-usb-otg.apk` (SHA-256 `3896d90c8be6c2d417c96bd018a37223166955da87599928402fb804de640355`). Kotlin debug assembly and Android app lint passed (0 errors / 35 warnings). Its later Genymotion installation is recorded below. A VM cannot certify Android USB host/OTG transport or paper output; qualification requires a physical phone and the identified printer.
- A separate arm64-oriented debug build for physical-phone investigation is `artifacts/genymotion/printdock-0.0.1-debug-arm64-usb-otg.apk` (SHA-256 `62852acbdc6a2ed0a9378c64d9b218a8244fb7d29ca7858ec7c6442b4ae78b94`). It has not been installed or run. Both named APKs remain local development artifacts, not signed/offline release candidates.
- The original Android 14 Genymotion VM was later available via ADB (`192.168.56.101:5555`, 1080×2340). The x86_64 post-USB APK installed over `com.airprint` without clearing data and launched with Metro. USB scan with no printer attached stayed empty; Start without selecting a printer displayed “Please select an available printer first.” After reloading the current JS bundle, the UI dump and screenshot `artifacts/genymotion/printdock-no-simulator*` confirm there is no virtual-printer control. The printer simulator is a Jest-only fake, not an emulator USB device. No USB printing or receipt output was tested.
- Physical Bluetooth receipt printing, OEM background behavior, signed release/offline startup, TalkBack, and large-font acceptance remain untested. Debug builds require Metro while running.

The normal `android/app/build/outputs/apk/debug/app-debug.apk` is replaced by each build; use the retained copy/hash above to identify this test artifact.

For a controlled retry of this exact deployed VM, check its UUID and state first. If it is stuck, power off only that VM and start it through Genymotion. This procedure worked once; subsequent attempts failed, so it is **not a verified fix**:

```powershell
& 'C:\Program Files\Oracle\VirtualBox\VBoxManage.exe' showvminfo '94ac468c-2889-4613-8a81-68da07bbb653' --machinereadable
& 'C:\Program Files\Oracle\VirtualBox\VBoxManage.exe' controlvm '94ac468c-2889-4613-8a81-68da07bbb653' poweroff
& 'C:\Program Files\Genymobile\Genymotion\gmtool.exe' admin start '94ac468c-2889-4613-8a81-68da07bbb653' --timeout 120
adb -s 192.168.56.101:5555 shell getprop sys.boot_completed
```

Use the power-off command only if this VM is actually stuck; it ends its current session abruptly. The first `gmtool admin start` immediately after power-off once returned “stopped unexpectedly”; repeating it after the player settled started the same VM without modifying its disk. If ADB changes address, use the serial reported by `gmtool admin list` or `adb devices -l`. The next independent path is a fresh Android image using Genymotion's QEMU engine (if available to this installation), or a planned host virtualization review. The installed CLI requires a license for listing/creating OS images and hardware profiles; this run did not bypass it. Disabling Hyper-V/VBS or rebooting the Windows host would affect WSL/security and was not performed.

## Prerequisites

- Create and start an Android 13 or 14 **x86_64** virtual device in the Genymotion desktop application. Complete any required account/license setup locally. Availability of command-line device management depends on the installed edition.
- Use the project's pinned Node/Yarn, JDK 17, and Android SDK from the [README](../README.md).
- Configure Genymotion to use the same Android SDK/ADB as your terminal if the device is missing from `adb devices -l`.
- Do not uninstall an existing app or clear its data merely to work around an installation error. A signing mismatch needs an explicit decision because uninstalling deletes preferences.

Identify the actual device before installing:

```powershell
adb devices -l
$deviceSerial = 'REPLACE_WITH_ADB_SERIAL'
adb -s $deviceSerial shell getprop ro.product.cpu.abilist
adb -s $deviceSerial shell getprop ro.build.version.release
adb -s $deviceSerial shell wm size
```

If the ABI is not `x86_64`, build for the reported ABI instead. An APK listing multiple ABIs does not prove every dependency was compiled for every ABI; inspect the packaged native libraries and test the actual target.

## Build and install

From the repository root, with `JAVA_HOME`, SDK, and the pinned Node on `PATH`:

```powershell
yarn install --frozen-lockfile --non-interactive
Push-Location android
.\gradlew.bat --no-daemon --max-workers=2 -PreactNativeArchitectures=x86_64 :app:assembleDebug
Pop-Location
adb -s $deviceSerial install -r android/app/build/outputs/apk/debug/app-debug.apk
```

This is a **debug-signed development APK**, not a store/release artifact. It needs Metro. In a separate terminal at the repository root:

```powershell
yarn start --host 127.0.0.1 --port 8081
```

Forward the emulator's port to the local development server and launch:

```powershell
adb -s $deviceSerial reverse tcp:8081 tcp:8081
adb -s $deviceSerial shell am start -W -n com.nexkit.printdock/.MainActivity
```

If a red error screen says the development server is unavailable, confirm Metro is running and inspect `adb -s $deviceSerial reverse --list`. Do not disable a firewall globally or expose Metro publicly as a workaround.

## Smoke-test checklist

| Case                         | Expected result                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Fresh launch                 | Home renders without native/JS crash or missing-library error                                    |
| No Bluetooth adapter/printer | Actionable unavailable/permission message; no false listening state                              |
| Port input                   | Valid integer ports accepted; malformed/out-of-range input visibly rejected                      |
| Settings                     | Navigation works; theme and Vietnamese/English/French selection update correctly                 |
| Restart app                  | Saved valid port, language, and theme restored; server does not auto-start                       |
| External link                | Only exact supported links accepted; start requires valid printer/configuration and confirmation |
| Layout                       | Controls remain usable with keyboard, safe areas, scrolling, and larger text                     |
| Logs                         | No fatal exception, uncaught JS error, or ANR during tested flows                                |

Use UI hierarchy bounds before automated taps, then capture the resulting screen. Keep evidence under ignored `artifacts/`:

```powershell
New-Item -ItemType Directory -Force artifacts/genymotion | Out-Null
adb -s $deviceSerial shell uiautomator dump /sdcard/printdock-smoke-ui.xml
adb -s $deviceSerial pull /sdcard/printdock-smoke-ui.xml artifacts/genymotion/ui.xml
adb -s $deviceSerial shell screencap -p /sdcard/printdock-smoke-screen.png
adb -s $deviceSerial pull /sdcard/printdock-smoke-screen.png artifacts/genymotion/screen.png
$appProcessId = (adb -s $deviceSerial shell pidof -s com.nexkit.printdock).Trim()
if ($appProcessId) {
    adb -s $deviceSerial logcat -d --pid=$appProcessId
}
```

Review logs before sharing. Record device image/Android version/ABI, APK SHA-256, test steps, results, screenshots, and failures. A checklist is not evidence that its cases passed. Real Android/printer tests and the [production gates](production-readiness.md) remain required.
