//@ts-check
"use strict";

const { $, setVerbose, chalk, info, cd } = require("@itchio/bob");
const { writeFileSync } = require("fs");
const { resolve } = require("path");

const version = "25.0.0";
const appNames = ["itch", "kitch"];

/**
 * @typedef OS
 * @type {"linux" | "windows" | "darwin"}
 */

/**
 * @typedef Arch
 * @type {"386" | "amd64"}
 */

/**
 * @typedef Opts
 * @type {{
 *  os: OS,
 *  arch: Arch,
 * }}
 */

/**
 * @param {string[]} args
 */
async function main(args) {
  /** @type {OS | undefined} */
  let os;
  /** @type {Arch | undefined} */
  let arch;

  for (let i = 0; i < args.length; i++) {
    let arg = args[i];

    let matches = /^--(.*)$/.exec(arg);
    if (matches) {
      let k = matches[1];
      if (k == "verbose") {
        setVerbose(true);
        continue;
      }

      if (k === "os" || k === "arch") {
        i++;
        let v = args[i];

        if (k === "os") {
          if (v === "linux" || v === "windows" || v === "darwin") {
            os = v;
          } else {
            throw new Error(`Unsupported OS ${chalk.yellow(v)}`);
          }
        } else if (k === "arch") {
          if (v === "386" || v === "amd64") {
            arch = v;
          } else {
            throw new Error(`Unsupported arch ${chalk.yellow(v)}`);
          }
        }
      }
    }
  }

  if (!os) {
    throw new Error(`${chalk.yellow("--os")} must be specified`);
  }
  if (!arch) {
    throw new Error(`${chalk.yellow("--arch")} must be specified`);
  }

  /** @type {Opts} */
  let opts = { os, arch };

  $(`rm -rf staging`);
  $(`mkdir -p staging`);

  switch (opts.os) {
    case "windows":
      return await buildWindows(opts);
    case "darwin":
      return await buildDarwin(opts);
    case "linux":
      return await buildLinux(opts);
  }
}

/**
 * @param {Opts} opts
 */
async function buildWindows(opts) {
  for (const appName of appNames) {
    const url = `https://broth.itch.ovh/${appName}-setup/windows-${opts.arch}/LATEST/unpacked/default`;
    const dir = `artifacts/install-${appName}/windows-${opts.arch}`;
    $(`mkdir -p ${dir}`);
    $(`curl -f -L ${url} -o ${dir}/${appName}-setup.exe`);
  }

  info(`That's all! That was easy :)`);
}

/**
 * @param {Opts} opts
 */
async function buildDarwin(opts) {
  if (opts.arch != "amd64") {
    throw new Error(
      `Only know how to build for darwin amd64 arch, not ${chalk.yellow(
        opts.arch
      )}`
    );
  }

  const signKey = "Developer ID Application: Amos Wenger (B2N6FSRTPV)";

  for (const appName of appNames) {
    const url = `https://broth.itch.ovh/${appName}-setup/darwin-amd64/LATEST/unpacked/default`;
    $(`curl -f -L ${url} -o staging/${appName}-setup`);
    $(`chmod +x staging/${appName}-setup`);

    const bundleId = `io.${appName}-setup.mac`;
    const infoPlistContents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDisplayName</key>
    <string>Install ${appName}</string>
    <key>CFBundleExecutable</key>
    <string>${appName}-setup</string>
    <key>CFBundleIconFile</key>
    <string>${appName}.icns</string>
    <key>CFBundleIdentifier</key>
    <string>${bundleId}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>${appName}-setup</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${version}</string>
    <key>CFBundleVersion</key>
    <string>${version}</string>
    <key>NSHighResolutionCapable</key>
    <true/>
  </dict>
</plist>`;

    const prefix = `staging/install-${appName}-app`;
    $(`mkdir -p ${prefix}/Contents/MacOS`);
    $(`cp staging/${appName}-setup ${prefix}/Contents/MacOS/${appName}-setup`);
    $(`mkdir -p ${prefix}/Contents/Resources`);
    $(
      `cp resources/${appName}.icns ${prefix}/Contents/Resources/${appName}.icns`
    );
    writeFileSync(`${prefix}/Contents/Info.plist`, infoPlistContents, {
      encoding: "utf-8",
    });

    const dist = `artifacts/install-${appName}/darwin-amd64`;
    $(`mkdir -p ${dist}`);
    const appBundleName = `Install ${appName}.app`;
    const appBundle = `${dist}/${appBundleName}`;
    const dmgName = `Install ${appName}.dmg`;
    $(`mv ${prefix} "${appBundle}"`);
    const entitlementsPath = resolve(`./entitlements.plist`);

    await cd(dist, async () => {
      $(
        `codesign --options runtime --timestamp --entitlements "${entitlementsPath}" --deep --force --verbose --sign "${signKey}" "${appBundleName}"`
      );
      $(`codesign --verify -vvvv "${appBundleName}"`);
      $(`spctl -a -vvvv "${appBundleName}"`);

      const volname = `Install ${appName}`;
      $(
        `hdiutil create -volname "${volname}" -srcfolder "${appBundleName}" -ov -format UDZO "${dmgName}"`
      );
      $(`rm -rf "${appBundleName}"`);
      $(`codesign --deep --force --verbose --sign "${signKey}" "${dmgName}"`);
      $(`codesign --verify -vvvv "${dmgName}"`);

      if (process.env.SKIP_NOTARIZE) {
        console.log(`$SKIP_NOTARIZE is set, skipping notarization...`); 
      } else {
        console.log(`Notarizing...`);
        require("debug").enable("electron-notarize"); // sic.
        const { notarize } = require("electron-notarize-dmg");
        await notarize({
          appBundleId: bundleId,
          dmgPath: dmgName,
          appleId: "amoswenger@gmail.com",
          appleIdPassword: process.env.APPLE_ID_PASSWORD || "",
          staple: true,
        });
      }
    });
  }

  info(`That's all! that was easy :)`);
}

/**
 * @param {Opts} opts
 */
async function buildLinux(opts) {
  const arch = opts.arch;

  for (const appName of appNames) {
    const dist = `artifacts/install-${appName}/linux-portable-${arch}`;

    const url = `https://broth.itch.ovh/${appName}-setup/linux-${arch}/LATEST/unpacked/default`;
    $(`mkdir -p ${dist}`);
    $(`curl -f -L ${url} -o ${dist}/${appName}-setup`);
    $(`chmod +x ${dist}/${appName}-setup`);
  }

  info(`That's all! that was easy :)`);
}

main(process.argv.slice(2));
