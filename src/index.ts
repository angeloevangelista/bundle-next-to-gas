import path from "path";
import jsdom from "jsdom";
import { NextConfig } from "next";

import {
  readFile,
  writeFile,
  createFolder,
  checkIfPathExists,
  deleteFolder,
  executeCommand,
  copyFolder,
  copyFile,
  renameFile,
  deleteFile,
} from "./utils";

async function generateGasBundle() {
  const tempFolderPath = path.resolve(__dirname, "..", "temp");

  const tempFolderExists = await checkIfPathExists(tempFolderPath);

  if (tempFolderExists) await deleteFolder(tempFolderPath);

  await createFolder(tempFolderPath);

  const originalNextProjectPath = path.resolve(
    __dirname,
    "..",
    "..",
    "next-base-app"
  );

  const nextProjectCopyPath = path.resolve(tempFolderPath, "next-project");

  await copyFolder(originalNextProjectPath, nextProjectCopyPath, {
    dereference: true,
    recursive: true,
  });

  const nextConfigPath = path.resolve(nextProjectCopyPath, "next.config.js");

  const nextConfigBuffer = await readFile(nextConfigPath);

  let nextConfigContent = nextConfigBuffer.toString();

  const configLogCommand = "console.log(JSON.stringify(nextConfig));";

  const nextConfigHasLogOfItsValue =
    nextConfigContent.includes(configLogCommand);

  if (!nextConfigHasLogOfItsValue) {
    nextConfigContent += `\n${configLogCommand}`;
  }

  await writeFile(nextConfigPath, nextConfigContent);

  const nextConfigLogOutput = await executeCommand(
    "node next.config.js",
    nextProjectCopyPath
  );

  let tempNextConfigObject = JSON.parse(nextConfigLogOutput) as NextConfig;

  if (!tempNextConfigObject.images?.unoptimized) {
    tempNextConfigObject = {
      ...tempNextConfigObject,
      images: {
        ...tempNextConfigObject.images,
        unoptimized: true,
      },
    };
  }

  const newNextConfigContent = [
    `/** @type {import('next').NextConfig} */`,
    `const nextConfig = `,
    JSON.stringify(tempNextConfigObject, null, 2),
    `module.exports = nextConfig`,
  ].join("\n");

  await writeFile(nextConfigPath, newNextConfigContent);

  await Promise.all(
    ["out", ".next", "node_modules"].map((folder) =>
      deleteFolder(path.resolve(nextProjectCopyPath, folder))
    )
  );

  await executeCommand(
    ["yarn", "yarn next build", "yarn next export"].join("&&"),
    nextProjectCopyPath
  );

  const staticBundlePath = path.resolve(nextProjectCopyPath, "out");

  await copyFile(
    path.resolve(__dirname, "..", "appsscript.json"),
    path.resolve(staticBundlePath, "appsscript.json")
  );

  await copyFile(
    path.resolve(__dirname, "gas-scripts", "fileServer.ts"),
    path.resolve(staticBundlePath, "fileServer.ts")
  );

  const bundleEntryPath = path.resolve(staticBundlePath, "index.html");

  const bundleEntryBuffer = await readFile(bundleEntryPath);

  let bundleEntryContent = bundleEntryBuffer.toString();

  var bundleEntryDOM = new jsdom.JSDOM(bundleEntryContent);

  const scriptElements = Array.from(
    bundleEntryDOM.window.document.querySelectorAll("script")
  ).filter((scriptElement) => scriptElement.src);

  const staticFilesPrefix = "<?= ScriptApp.getService().getUrl()?>/static";

  const updateProjectScriptsPromises = scriptElements.map(
    async (scriptElement) => {
      const physicalScriptFilePath = path.join(
        staticBundlePath,
        scriptElement.src
      );

      await renameFile(
        physicalScriptFilePath,
        path.join(staticBundlePath, scriptElement.src.replace(".js", ".html"))
      );

      scriptElement.src = `${staticFilesPrefix}?filePath=${scriptElement.src
        .replace(".js", "")
        .substring(1)}`;
    }
  );

  await Promise.all(updateProjectScriptsPromises);

  const stylesheetLinkElements = Array.from(
    bundleEntryDOM.window.document.querySelectorAll("link")
  )
    .filter(
      (stylesheetLinkElement) => stylesheetLinkElement.rel === "stylesheet"
    )
    .reduce<HTMLLinkElement[]>(
      (acc, stylesheetLinkElement) =>
        acc.some((p) => p.href === stylesheetLinkElement.href)
          ? acc
          : [...acc, stylesheetLinkElement],
      []
    );

  const updateProjectStylesheetsPromises = stylesheetLinkElements.map<
    Promise<string>
  >(async (stylesheetLinkElement) => {
    const physicalStylesFilePath = path.join(
      staticBundlePath,
      stylesheetLinkElement.href
    );

    const styleElementBuffer = await readFile(physicalStylesFilePath);

    stylesheetLinkElement.remove();

    await writeFile(
      physicalStylesFilePath,
      `<style>${styleElementBuffer.toString()}</style>`
    );

    await renameFile(
      physicalStylesFilePath,
      path.join(
        staticBundlePath,
        stylesheetLinkElement.href.replace(".css", ".html")
      )
    );

    return `<?!= include('${stylesheetLinkElement.href
      .replace(".css", "")
      .substring(1)}'); ?>`;
  });

  const stylesheetIncludes = await Promise.all(
    updateProjectStylesheetsPromises
  );

  bundleEntryContent =
    bundleEntryDOM.window.document.body.parentElement!.outerHTML;

  const startOfEndOfBodyIndex = bundleEntryContent
    .toUpperCase()
    .indexOf("</BODY>");

  bundleEntryContent = [
    bundleEntryContent.substring(0, startOfEndOfBodyIndex),
    stylesheetIncludes.join(""),
    bundleEntryContent.substring(startOfEndOfBodyIndex),
  ].join("");

  await writeFile(bundleEntryPath, bundleEntryContent);
}

generateGasBundle();
