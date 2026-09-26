# Background-service compatibility patch

`react-native-background-actions+4.0.1.patch` is an application-specific Android patch, applied by the pinned `patch-package` postinstall hook. Installs fail if the patch cannot be applied. It is required for this SDK-34 baseline, not optional local editing of `node_modules`.

- Use an immutable, package-scoped notification PendingIntent on the app's minimum API 23; remove the unsafe mutable implicit-intent allowance.
- Declare this application's connected-device service type and its permissions in the dependency manifest so standalone dependency lint agrees with the merged app manifest.
- Stop a restarted service safely if Android supplies a null Intent; do not imply automatic print-job recovery.

Version 4.1.0 contains related upstream fixes but also introduces Android API-35 timeout overrides; adopting it belongs with the compile-SDK/native baseline upgrade. Recheck the source/API requirements at that time and remove this patch only after equivalent security/lifecycle behavior passes native checks and hardware tests.

To intentionally refresh the patch after review:

```sh
yarn patch-package react-native-background-actions
yarn install --frozen-lockfile --non-interactive
```

Run JS tests plus Android build/lint after any change. A passing build does not verify notification taps, OS recovery, or physical printing.
