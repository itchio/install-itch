//@ts-check
"use strict";

const { $, $$, cd } = require("@itchio/bob");
const { readdirSync, readFileSync, existsSync } = require("fs");
const { join } = require("path");

/**
 * Get the short commit hash of the current repository
 * @returns {string}
 */
function getCommitHash() {
  return $$(`git rev-parse --short HEAD`, { silent: true }).trim();
}

async function main() {
  const toolsDir = join(process.cwd(), "tools");
  $(`mkdir -p "${toolsDir}"`);
  await cd(toolsDir, async () => {
    $(
      `curl -sLo butler.zip "https://broth.itch.zone/butler/linux-amd64-head/LATEST/.zip"`
    );
    $(`unzip butler.zip`);
  });
  $(`${toolsDir}/butler -V`);

  const commitHash = getCommitHash();

  /**
   * @param {string} project
   */
  const pushProject = async (project) => {
    const projectPage = `itchio/${project}`;
    await cd(project, async () => {
      const entries = readdirSync(".");
      // Filter to only directories (exclude .version.json files)
      const osarches = entries.filter(entry => !entry.endsWith(".version.json"));
      for (const osarch of osarches) {
        const target = `${projectPage}:${osarch}`;

        // Read version metadata from sibling file
        const versionFile = `${osarch}.version.json`;
        let userversionArg = "";
        if (existsSync(versionFile)) {
          const versionData = JSON.parse(readFileSync(versionFile, { encoding: "utf-8" }));
          const userversion = `${versionData.itchSetupVersion}+${commitHash}`;
          userversionArg = ` --userversion "${userversion}"`;
        }

        $(`${toolsDir}/butler push "./${osarch}" "${target}"${userversionArg}`);
      }
    });
  };

  await cd("artifacts", async () => {
    const projects = readdirSync(".");
    for (const project of projects) {
      await pushProject(project);
    }
  });
}

main();
