#!/usr/bin/env node

const $ = require("./common");
const fs = require("fs");

async function main() {
  const pushProject = async (project) => {
    const projectPage = `fasterthanlime/${project}`;
    await $.cd(project, async () => {
      const osarches = fs.readdirSync(".");
      for (const osarch of osarches) {
        const target = `${projectPage}:${osarch}`;
        $.say(`Should push ${process.cwd()} to ${target}`);
      }
    });
  }

  await $.cd("broth", async () => {
    const projects = fs.readdirSync(".");
    for (const project of projects) {
      await pushProject(project);
    }
  });

  $.say(`It's uhh pretty radical.`)
}

main();