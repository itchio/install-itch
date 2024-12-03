//@ts-check
"use strict";

const { $, cd } = require("@itchio/bob");
const { readdirSync } = require("fs");
const { join } = require("path");

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

  /**
   * @param {string} project
   */
  const pushProject = async (project) => {
    const projectPage = `itchio/${project}`;
    await cd(project, async () => {
      const osarches = readdirSync(".");
      for (const osarch of osarches) {
        const target = `${projectPage}:${osarch}`;
        $(`${toolsDir}/butler push "./${osarch}" "${target}"`);
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
