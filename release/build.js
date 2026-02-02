//@ts-check
"use strict";

const { $, setVerbose, chalk, info } = require("@itchio/bob");
const { writeFileSync } = require("fs");

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
 *  arch?: Arch,
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
  // arch is required for windows and linux, but not for darwin (which builds universal)
  if (os !== "darwin" && !arch) {
    throw new Error(`${chalk.yellow("--arch")} must be specified for ${os}`);
  }

  /** @type {Opts} */
  let opts = { os, arch };

  $(`rm -rf staging`);
  $(`mkdir -p staging`);

  switch (opts.os) {
    case "windows":
      return await buildWindows(opts);
    case "darwin":
      return await buildDarwin();
    case "linux":
      return await buildLinux(opts);
  }
}

/**
 * @param {Opts} opts
 */
async function buildWindows(opts) {
  for (const appName of appNames) {
    const url = `https://broth.itch.zone/${appName}-setup/windows-${opts.arch}/LATEST/unpacked/default`;
    const dir = `artifacts/install-${appName}/windows-${opts.arch}`;
    $(`mkdir -p ${dir}`);
    $(`curl -f -L ${url} -o ${dir}/${appName}-setup.exe`);
  }

  info(`That's all! That was easy :)`);
}

/**
 * Builds universal macOS binary (Intel + ARM64) and creates unsigned .app bundle.
 * Code signing, DMG creation, and notarization are handled by GitHub Actions.
 */
async function buildDarwin() {
  for (const appName of appNames) {
    // Download both architectures from broth
    const amd64Url = `https://broth.itch.zone/${appName}-setup/darwin-amd64/LATEST/unpacked/default`;
    const arm64Url = `https://broth.itch.zone/${appName}-setup/darwin-arm64/LATEST/unpacked/default`;

    info(`Downloading ${appName}-setup for darwin-amd64...`);
    $(`curl -f -L "${amd64Url}" -o staging/${appName}-setup-amd64`);

    info(`Downloading ${appName}-setup for darwin-arm64...`);
    $(`curl -f -L "${arm64Url}" -o staging/${appName}-setup-arm64`);

    // Create universal binary with lipo
    info(`Creating universal binary for ${appName}-setup...`);
    $(`lipo -create staging/${appName}-setup-amd64 staging/${appName}-setup-arm64 -output staging/${appName}-setup`);
    $(`chmod +x staging/${appName}-setup`);

    // Verify the universal binary
    $(`lipo -info staging/${appName}-setup`);

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

    // Create .app bundle structure
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

    // Output unsigned .app bundle to darwin-universal directory
    const dist = `artifacts/install-${appName}/darwin-universal`;
    $(`mkdir -p ${dist}`);
    const appBundleName = `Install ${appName}.app`;
    const appBundle = `${dist}/${appBundleName}`;
    $(`mv ${prefix} "${appBundle}"`);

    info(`Created unsigned app bundle: ${appBundle}`);
  }

  info(`That's all! Unsigned .app bundles created for signing by GitHub Actions.`);
}

/**
 * @param {Opts} opts
 */
async function buildLinux(opts) {
  const arch = opts.arch;

  for (const appName of appNames) {
    const dist = `artifacts/install-${appName}/linux-portable-${arch}`;

    const url = `https://broth.itch.zone/${appName}-setup/linux-${arch}/LATEST/unpacked/default`;
    $(`mkdir -p ${dist}`);
    $(`curl -f -L ${url} -o ${dist}/${appName}-setup`);
    $(`chmod +x ${dist}/${appName}-setup`);
  }

  info(`That's all! that was easy :)`);
}

main(process.argv.slice(2));
