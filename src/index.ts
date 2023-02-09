#! /usr/bin/env node

import { checkIfPathExists } from "./utils";
import { generateGasBundle } from "./generate-gas-bundle";

function logUsage(): void {
  console.log("usage: bundle-next-to-gas <next-project-path> <output-path>");
}

async function bundleApp() {
  try {
    const [, , ...args] = process.argv;

    const projectPath = args[0];
    const outputPath = args[1];

    const overrideOutput = args.some((p) =>
      p?.toLocaleUpperCase().includes("--FORCE")
    );

    const askedForHelp = args[0]?.toUpperCase() === "HELP";

    if (askedForHelp) {
      logUsage();
      process.exit(0);
    }

    if (!projectPath?.trim() || !outputPath?.trim()) {
      logUsage();
      process.exit(1);
    }

    const projectPathExists = await checkIfPathExists(projectPath);

    if (!projectPathExists) {
      throw new Error(`the project path does not exist: ${projectPath}`);
    }

    const outputPathExists = await checkIfPathExists(outputPath);

    if (outputPathExists && !overrideOutput) {
      throw new Error(
        "error: the output path already exists. Use --force to override it."
      );
    }

    await generateGasBundle(projectPath, outputPath);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

bundleApp();
