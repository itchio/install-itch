//@ts-check
"use strict";

const { $, setVerbose, chalk, info } = require("@itchio/bob");
const { writeFileSync } = require("fs");

const version = "25.0.0";
const allAppNames = ["itch", "kitch"];

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
 *  itchSetupVersion: string,
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
  /** @type {string | undefined} */
  let appFilter;
  /** @type {string} */
  let itchSetupVersion = "LATEST";

  for (let i = 0; i < args.length; i++) {
    let arg = args[i];

    let matches = /^--(.*)$/.exec(arg);
    if (matches) {
      let k = matches[1];
      if (k == "verbose") {
        setVerbose(true);
        continue;
      }

      if (k === "os" || k === "arch" || k === "app" || k === "version") {
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
        } else if (k === "app") {
          if (v === "itch" || v === "kitch") {
            appFilter = v;
          } else {
            throw new Error(`Unsupported app ${chalk.yellow(v)}, must be "itch" or "kitch"`);
          }
        } else if (k === "version") {
          itchSetupVersion = v;
        }
      }
    }
  }

  // Filter app names if --app is specified
  const appNames = appFilter ? [appFilter] : allAppNames;

  if (!os) {
    throw new Error(`${chalk.yellow("--os")} must be specified`);
  }
  // arch is required for windows and linux, but not for darwin (which builds universal)
  if (os !== "darwin" && !arch) {
    throw new Error(`${chalk.yellow("--arch")} must be specified for ${os}`);
  }

  /** @type {Opts} */
  let opts = { os, arch, itchSetupVersion };

  info(`Using itch-setup version: ${itchSetupVersion}`);

  $(`rm -rf staging`);
  $(`mkdir -p staging`);

  switch (opts.os) {
    case "windows":
      return await buildWindows(opts, appNames);
    case "darwin":
      return await buildDarwin(opts, appNames);
    case "linux":
      return await buildLinux(opts, appNames);
  }
}

/**
 * @param {Opts} opts
 * @param {string[]} appNames
 */
async function buildWindows(opts, appNames) {
  // Download itch-setup once (kitch-setup is retired, same executable)
  const url = `https://broth.itch.zone/itch-setup/windows-${opts.arch}/${opts.itchSetupVersion}/unpacked/default`;
  $(`curl -f -L ${url} -o staging/itch-setup.exe`);

  for (const appName of appNames) {
    const dir = `artifacts/install-${appName}/windows-${opts.arch}`;
    $(`mkdir -p ${dir}`);
    $(`cp staging/itch-setup.exe ${dir}/${appName}-setup.exe`);
  }

  info(`That's all! That was easy :)`);
}

/**
 * Builds universal macOS binary (Intel + ARM64) and creates unsigned .app bundle.
 * Code signing, DMG creation, and notarization are handled by GitHub Actions.
 * @param {Opts} opts
 * @param {string[]} appNames
 */
async function buildDarwin(opts, appNames) {
  // Download itch-setup binaries once (kitch-setup is retired, same executable)
  const amd64Url = `https://broth.itch.zone/itch-setup/darwin-amd64/${opts.itchSetupVersion}/unpacked/default`;
  const arm64Url = `https://broth.itch.zone/itch-setup/darwin-arm64/${opts.itchSetupVersion}/unpacked/default`;

  info(`Downloading itch-setup for darwin-amd64...`);
  $(`curl -f -L "${amd64Url}" -o staging/itch-setup-amd64`);

  info(`Downloading itch-setup for darwin-arm64...`);
  $(`curl -f -L "${arm64Url}" -o staging/itch-setup-arm64`);

  // Create universal binary once
  info(`Creating universal binary for itch-setup...`);
  $(`lipo -create staging/itch-setup-amd64 staging/itch-setup-arm64 -output staging/itch-setup`);
  $(`chmod +x staging/itch-setup`);
  $(`lipo -info staging/itch-setup`);

  for (const appName of appNames) {
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

    // Create .app bundle structure (copy universal binary, renamed for this app)
    const prefix = `staging/install-${appName}-app`;
    $(`mkdir -p ${prefix}/Contents/MacOS`);
    $(`cp staging/itch-setup ${prefix}/Contents/MacOS/${appName}-setup`);
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
 * @param {string[]} appNames
 */
async function buildLinux(opts, appNames) {
  const arch = opts.arch;

  // Download itch-setup once (kitch-setup is retired, same executable)
  const url = `https://broth.itch.zone/itch-setup/linux-${arch}/${opts.itchSetupVersion}/unpacked/default`;
  $(`curl -f -L ${url} -o staging/itch-setup`);
  $(`chmod +x staging/itch-setup`);

  for (const appName of appNames) {
    const dist = `artifacts/install-${appName}/linux-portable-${arch}`;
    $(`mkdir -p ${dist}`);
    $(`cp staging/itch-setup ${dist}/${appName}-setup`);
  }

  info(`That's all! that was easy :)`);
}

main(process.argv.slice(2));
