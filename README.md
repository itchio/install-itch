# install-itch

Generates installers for itch and kitch (beta) on Windows, macOS and Linux. Both are built from the same `itch-setup` binary downloaded from broth.itch.zone - the kitch variant is simply renamed.

Deploys to:

  * https://itchio.itch.io/install-itch (stable)
  * https://itchio.itch.io/install-kitch (beta)

## Build Process

Builds are run via GitHub Actions (`.github/workflows/build.yml`). Deployment is triggered manually via workflow dispatch.

### Windows

Downloads `itch-setup.exe` from broth.itch.zone.

Output: `artifacts/install-{app}/windows-amd64/{app}-setup.exe`

### macOS

Creates a universal (Intel + ARM64) macOS app bundle:

1. Downloads `itch-setup` for both `darwin-amd64` and `darwin-arm64` from broth.itch.zone
2. Combines them into a universal binary using `lipo`
3. Packages as an app bundle:
   ```
   Install itch.app/
     Contents/
       Info.plist
       MacOS/
         itch-setup
       Resources/
         itch.icns
   ```
4. Code signs the app with Developer ID certificate
5. Creates a DMG disk image
6. Notarizes the DMG with Apple

Output: `artifacts/install-{app}/darwin-universal/Install {app}.dmg`

### Linux

Downloads `itch-setup` from broth.itch.zone.

Output: `artifacts/install-{app}/linux-portable-amd64/{app}-setup`
