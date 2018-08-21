#!/usr/bin/env node

const $ = require("./common");

const version = "25.0.0";

async function main() {
  const os = process.env.CI_OS;
  if (!os) {
    throw new Error(`CI_OS must be set`);
  }

  const arch = process.env.CI_ARCH;
  if (!arch) {
    throw new Error(`CI_ARCH must be set`);
  }

  $(await $.sh("rm -rf staging"));
  $(await $.sh("mkdir -p staging"));

  if (os === "windows") {
    await buildWindows();
  } else if (os === "darwin") {
    await buildDarwin();
  } else if (os === "linux") {
    await buildLinux();
    await buildDeb();
  }
}

async function buildWindows() {
  const arch = process.env.CI_ARCH;
  if (arch != "386") {
    throw new Error(`only know how to build windows 386 package, not ${arch}`);
  }

  for (const appname of ["itch", "kitch"]) {
    const url = `https://broth.itch.ovh/${appname}-setup/windows-386/LATEST/unpacked/default`;
    const dir = `broth/install-${appname}/windows-386`;
    $(await $.sh(`mkdir -p ${dir}`));
    $(await $.sh(`curl -f -L ${url} -o ${dir}/${appname}-setup.exe`));
  }

  $.say(`That's all! That was easy :)`);
}

async function buildDarwin() {
  const arch = process.env.CI_ARCH;
  if (arch != "amd64") {
    throw new Error(`only know how to build darwin amd64 package, not ${arch}`);
  }

  const signKey = "Developer ID Application: Amos Wenger (B2N6FSRTPV)";

  for (const appname of ["itch", "kitch"]) {
    const url = `https://broth.itch.ovh/${appname}-setup/darwin-amd64/LATEST/unpacked/default`;
    $(await $.sh(`curl -f -L ${url} -o staging/${appname}-setup`));
    $(await $.sh(`chmod +x staging/${appname}-setup`));

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
    <string>${version}</string>
    <key>CFBundleVersion</key>
    <string>${version}</string>
  </dict>
</plist>`;

    const prefix = `staging/install-${appname}-app`;
    $(await $.sh(`mkdir -p ${prefix}/Contents/MacOS`));
    $(
      await $.sh(
        `cp staging/${appname}-setup ${prefix}/Contents/MacOS/${appname}-setup`
      )
    );
    $(await $.sh(`mkdir -p ${prefix}/Contents/Resources`));
    $(
      await $.sh(
        `cp resources/${appname}.icns ${prefix}/Contents/Resources/${appname}.icns`
      )
    );
    await $.writeFile(`${prefix}/Contents/Info.plist`, infoPlistContents);

    const dist = `broth/install-${appname}/darwin-amd64`;
    $(await $.sh(`mkdir -p ${dist}`));
    const appBundle = `${dist}/Install ${appname}.app`;
    $(await $.sh(`mv ${prefix} "${appBundle}"`));
    $(
      await $.sh(
        `codesign --deep --force --verbose --sign "${signKey}" "${appBundle}"`
      )
    );
    $(await $.sh(`codesign --verify -vvvv "${appBundle}"`));
    $(await $.sh(`spctl -a -vvvv "${appBundle}"`));
  }

  $.say(`That's all! that was easy :)`);
}

async function buildLinux() {
  const arch = process.env.CI_ARCH;

  for (const appname of ["itch", "kitch"]) {
    const outFolder = `../../broth/install-${appname}/linux-portable-${arch}`;

    const url = `https://broth.itch.ovh/${appname}-setup/linux-${arch}/LATEST/unpacked/default`;
    $(await $.sh(`mkdir -p ${outFolder}`));
    $(await $.sh(`curl -f -L ${url} -o ${outFolder}/${appname}-setup`));
    $(await $.sh(`chmod +x ${outFolder}/${appname}-setup`));
  }
}

async function buildDeb() {
  const arch = process.env.CI_ARCH;
  let debArch = arch == "386" ? "i386" : "amd64";

  await $($.sh(`fakeroot -v`));
  await $($.sh(`ar -V`));

  for (const appname of ["itch", "kitch"]) {
    const stage2 = `staging/stage2`;
    await prepareStage2({ arch, appname, stage2 });
    $(await $.sh(`mkdir -p ${stage2}/DEBIAN`));

    $(await $.sh(`mkdir -p ${stage2}/usr/share/doc/${appname}`));
    $(
      await $.sh(
        `cp resources/debian/copyright ${stage2}/usr/share/doc/${appname}`
      )
    );

    $(await $.sh(`mkdir -p ${stage2}/usr/share/lintian/overrides`));
    $(
      await $.sh(
        `cp resources/debian/lintian-overrides ${stage2}/usr/share/lintian/overrides/${appname}`
      )
    );

    const duOutput = await $.getOutput(`du -ck ${stage2}`);
    const duLines = duOutput.trim().split("\n");
    const totalLine = duLines[duLines.length - 1];
    const installedSize = parseInt(/^[0-9]+/.exec(totalLine), 10);

    $.say(`deb installed size: ${(installedSize / 1024).toFixed(2)} MB`);

    const controlContents = `
Package: ${appname}
Version: ${version}
Architecture: ${debArch}
Maintainer: Amos Wenger
Installed-Size: ${Math.ceil(installedSize)}
Depends: libasound2, libatk1.0-0, libc6, libcairo2, libcups2, libdbus-1-3, libexpat1, libfontconfig1, libgcc1, libgconf-2-4, libgdk-pixbuf2.0-0, libglib2.0-0, libgtk-3-0, libnspr4, libnss3, libpango-1.0-0, libpangocairo-1.0-0, libstdc++6, libx11-6, libx11-xcb1, libxcb1, libxcomposite1, libxcursor1, libxdamage1, libxext6, libxfixes3, libxi6, libxrandr2, libxrender1, libxss1, libxtst6, libappindicator1
Section: games
Priority: optional
Homepage: https://itch.io/app
Description: install and play itch.io games easily
  The itch app lets you effortlessly download and run games and software
  from itch.io. All of your downloads are kept in a single place and are
  automatically updated. Access your collections and purchases, or browse
  for new games via the in-app browser. You can even sync any browser based
  games right into the app, letting you play them offline whenever you want.
  Once you're back online you'll be able to grab any updates if necessary.
  Thanks to the itch.io community, itch is available in over 20 languages!
`;
    await $.writeFile(`${stage2}/DEBIAN/control`, controlContents);

    await $.cd(stage2, async () => {
      let sums = "";
      const allFiles = await $.findAllFiles("usr/");
      for (const file of allFiles) {
        sums += `${await $.md5(file)} ${file}\n`;
        const stat = await $.lstat(file);
        const perms = stat.mode & 0o777;
        switch (perms) {
          case 0o775:
            await $.chmod(0o755, file);
            break;
          case 0o664:
            await $.chmod(0o644, file);
            break;
        }
      }
      await $.writeFile(`DEBIAN/md5sums`, sums);

      await $.cd("DEBIAN", async () => {
        $(await $.sh(`fakeroot tar cfz ../control.tar.gz .`));
      });

      $(await $.sh("mkdir data"));
      $(await $.sh("mv usr data/"));
      await $.cd("data", async () => {
        $(await $.sh("fakeroot tar cfJ ../data.tar.xz ."));
      });

      await $.writeFile("debian-binary", "2.0\n");

      const outFolder = `../../broth/install-${appname}/linux-deb-${arch}`;
      $(await $.sh(`mkdir -p ${outFolder}`));
      const deb = `${outFolder}/${appname}_${version}_${debArch}.deb`;
      const debContents = ["debian-binary", "control.tar.gz", "data.tar.xz"];
      $(await $.sh(`ar cq ${deb} ${debContents.join(" ")}`));
    });
  }
}

async function prepareStage2({ arch, appname, stage2 }) {
  $(await $.sh(`rm -rf ${stage2}`));
  $(await $.sh(`mkdir -p ${stage2}`));
  $(await $.sh(`mkdir -p ${stage2}/usr/bin`));
  $(await $.sh(`mkdir -p ${stage2}/usr/share/applications`));

  for (const size of ["16", "32", "48", "64", "128", "256", "512"]) {
    const dir = `${stage2}/usr/share/icons/hicolor/${size}x${size}/apps`;
    $(await $.sh(`mkdir -p ${dir}`));
    $(
      await $.sh(
        `cp resources/images/${appname}-icons/icon${size}.png ${dir}/${appname}.png`
      )
    );
  }

  const launcherContents = `#!/bin/sh
${appname}-setup --prefer-launch -- "$@"
`;
  await $.writeFile(`${stage2}/usr/bin/${appname}`, launcherContents);
  $(await $.sh(`chmod +x ${stage2}/usr/bin/${appname}`));

  const url = `https://broth.itch.ovh/${appname}-setup/linux-${arch}/LATEST/unpacked/default`;
  $(await $.sh(`curl -f -L ${url} -o ${stage2}/usr/bin/${appname}-setup`));
  $(await $.sh(`chmod +x ${stage2}/usr/bin/${appname}-setup`));

  const desktopContents = `[Desktop Entry]
Type=Application
Name=${appname}
TryExec=${appname}
Exec=${appname} %U
Icon=${appname}
Terminal=false
Categories=Game;
MimeType=x-scheme-handler/${appname}io;
X-GNOME-Autostart-enabled=true
Comment=Install and play itch.io games easily`;
  await $.writeFile(
    `${stage2}/usr/share/applications/io.itch.${appname}.desktop`,
    desktopContents
  );
}

main();
