# install-itch

Generates installers from itch-setup for Windows, macOS and Linux.

Deploys to:

  * https://fasterthanlime.itch.io/install-itch (stable)
  * https://fasterthanlime.itch.io/install-kitch (beta)

### Windows

Pretty much directly itch-setup's binary,
except renamed to `kitch-setup.exe` for kitch.

### macOS

Generates a macOS app bundle around `itch-setup`, with
the following structure:

```
Install itch.app/
  Contents/
    Info.plist
    MacOS/
      install-itch
    Resources
      itch.icns
```

### Linux

Generates a 32-bit and 64-bit .deb package, which installs:


```
# The actual itch-setup binary
/usr/bin/itch-setup

# A launcher script
/usr/bin/itch

# An application .desktop file
/usr/share/applications/io.itch.itch.desktop

# Some icons
/usr/share/icons/hicolor/${size}x${size}/apps/itch.png

# etc.
```
