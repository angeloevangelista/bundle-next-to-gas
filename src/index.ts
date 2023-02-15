#! /usr/bin/env node

import { checkIfPathExists } from "./utils";
import { generateGasBundle } from "./generate-gas-bundle";

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

yargs(hideBin(process.argv))
  .command(
    "bundle",
    "Bundle a NextJs project into Google Apps Script Application",
    (builderYargs) => {
      builderYargs
        .option("input", {
          alias: "i",
          description: "NextJs project path",
          string: true,
          demandOption: true,
        })
        .option("output", {
          alias: "o",
          description: "Where the bundled project will be saved",
          string: true,
          demandOption: true,
        })
        .option("name", {
          alias: "n",
          description: "Project name. Example: \"My App\"",
          string: true,
          demandOption: false,
        });

      return builderYargs
    },
    (handlerArgs) => {
      generateGasBundle({
        inputPath: handlerArgs.input as string,
        outputPath: handlerArgs.output as string,
        projectName: handlerArgs.name as string | undefined
      })
    },
  )
  .demandCommand(1)
  .parse();