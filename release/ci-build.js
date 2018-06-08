#!/usr/bin/env node

const $ = require("./common");

async function main() {
  const os = process.env.CI_OS;
  if (!os) {
    throw new Error(`CI_OS must be set`)
  }

  const arch = process.env.CI_ARCH;
  if (!arch) {
    throw new Error(`CI_ARCH must be set`)
  }

  $(await $.sh("rm -rf staging"))
  $(await $.sh("mkdir -p staging"))

  if (os === "windows") {
    await buildWindows();
  }

  if (os === "darwin") {
    await buildDarwin();
  }
}

async function buildWindows() {
  const arch = process.env.CI_ARCH;
  if (arch != "386") {
    throw new Error(`only know how to build windows 386 package, not ${arch}`);
  }

  const url = `https://broth.itch.ovh/itch-setup/windows-386/LATEST/unpacked/default`
  $(await $.sh(`curl -L ${url} -o staging/itch-setup.exe`))

  $(await $.sh(`mkdir -p broth/install-itch/windows-386`))
  $(await $.sh(`cp staging/itch-setup.exe broth/install-itch/windows-386/itch-setup.exe`))
  $(await $.sh(`mkdir -p broth/install-kitch/windows-386`))
  $(await $.sh(`cp staging/itch-setup.exe broth/install-kitch/windows-386/kitch-setup.exe`))

  $.say(`That's all! That was easy :)`)
}

async function buildDarwin() {
  const arch = process.env.CI_ARCH;
  if (arch != "amd64") {
    throw new Error(`only know how to build darwin amd64 package, not ${arch}`);
  }

  const url = `https://broth.itch.ovh/itch-setup/darwin-amd64/LATEST/unpacked/default`
  $(await $.sh(`curl -L ${url} -o staging/itch-setup`))
  $(await $.sh(`chmod +x staging/itch-setup`));

  const signKey = "Developer ID Application: Amos Wenger (B2N6FSRTPV)";

  for (const appname of ["itch", "kitch"]) {
  const infoPlistContents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDisplayName</key>
    <string>Install ${appname}</string>
    <key>CFBundleExecutable</key>
    <string>${appname}-setup</string>
    <key>CFBundleIconFile</key>
    <string>${appname}.icns</string>
    <key>CFBundleIdentifier</key>
    <string>io.${appname}-setup.mac</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>${appname}-setup</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
  </dict>
</plist>`;

    const prefix = `staging/install-${appname}-app`;
    $(await $.sh(`mkdir -p ${prefix}/Contents/MacOS`));
    $(await $.sh(`cp staging/itch-setup ${prefix}/Contents/MacOS/${appname}-setup`));
    $(await $.sh(`mkdir -p ${prefix}/Contents/Resources`));
    $(await $.sh(`cp resources/${appname}.icns ${prefix}/Contents/Resources/${appname}-setup`));
    await $.writeFile(`${prefix}/Contents/Info.plist`, infoPlistContents);

    const dist = `broth/install-${appname}/darwin-amd64`;
    $(await $.sh(`mkdir -p ${dist}`))
    const appBundle = `${dist}/Install ${appname}.app`;
    $(await $.sh(`mv ${prefix} "${appBundle}"`));
    $(await $.sh(`codesign --deep --force --verbose --sign "${signKey}" "${appBundle}"`));
    $(await $.sh(`codesign --verify -vvvv "${appBundle}"`));
    $(await $.sh(`spctl -a -vvvv "${appBundle}"`));
  }

  $.say(`That's all! that was easy :)`)
}

main();