#!/usr/bin/env node

const $ = require("./common");
const fs = require("fs");
const {join} = require("path");

async function main() {
  const toolsDir = join(process.cwd(), "tools")
  $(await $.sh(`mkdir -p "${toolsDir}"`));
  await $.cd(toolsDir, async () => {
    $(await $.sh(`curl -sLo butler.zip "https://broth.itch.ovh/butler/linux-amd64-head/LATEST/.zip"`));
    $(await $.sh(`unzip butler.zip`));
  });
  $(await $.sh(`${toolsDir}/butler -V`));

  const pushProject = async (project) => {
    const projectPage = `fasterthanlime/${project}`;
    await $.cd(project, async () => {
      const osarches = fs.readdirSync(".");
      for (const osarch of osarches) {
        const target = `${projectPage}:${osarch}`;
        $(await $.sh(`${toolsDir}/butler push "./${osarch}" "${target}"`));
      }
    });
  }

  await $.cd("broth", async () => {
    const projects = fs.readdirSync(".");
    for (const project of projects) {
      await pushProject(project);
    }
  });
}

main();