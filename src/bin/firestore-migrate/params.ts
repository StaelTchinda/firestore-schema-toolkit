import { Command } from "commander";
import colors from "colors";
import fs from "fs";
import path from "path";
import { OptionParams } from "src/lib/utils/bin/option";
import {
  accountCredentialsEnvironmentKey,
  defaultAccountCredentialsPath,
} from "src/lib/utils/bin/common";
import { isPathFile } from "src/lib/utils/file";
import { FirestoreMigrateParams } from "./types";

export const migrateCommandOptions: { [key: string]: OptionParams } = {
  accountCredentialsPath: {
    shortKey: "a",
    key: "accountCredentials",
    args: "<path>",
    description: `path to Google Cloud account credentials JSON file. If missing, will look at the ${accountCredentialsEnvironmentKey} environment variable for the path. Defaults to '${defaultAccountCredentialsPath}' if missing.`,
    defaultValue: defaultAccountCredentialsPath,
  },
  scriptPath: {
    shortKey: "x",
    key: "script",
    args: "<path>",
    description:
      "path to the migration script file. The script should be a module that exports the function 'preview', and 'migrate'",
  },
  /*
  schemaPath: {
    shortKey: "s",
    key: "schema",
    args: "<path>",
    description: "path to the JSON schema file to migrate the data against",
  },
  */
  verbose: {
    shortKey: "v",
    key: "verbose",
    args: "",
    description: "verbose output",
  },
};

export function parseParams(program: Command): FirestoreMigrateParams {
  const options = program.opts();

  const accountCredentialsPath =
    options[migrateCommandOptions.accountCredentialsPath.key] ||
    process.env[accountCredentialsEnvironmentKey] ||
    migrateCommandOptions.accountCredentialsPath.defaultValue;

  const scriptPath = options[migrateCommandOptions.scriptPath.key];

  // const schemaPath = options[migrateCommandOptions.schemaPath.key];

  const verbose = Boolean(options[migrateCommandOptions.verbose.key]);

  return {
    accountCredentialsPath,
    scriptPath,
    // schemaPath,
    verbose,
  };
}

export async function validateParams(
  commandParams: FirestoreMigrateParams
): Promise<void> {
  if (!commandParams.accountCredentialsPath) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(migrateCommandOptions.accountCredentialsPath.key) +
        " - " +
        migrateCommandOptions.accountCredentialsPath.description
    );
  }
  if (!fs.existsSync(commandParams.accountCredentialsPath)) {
    throw new Error(
      colors.bold(colors.red("Account credentials file does not exist: ")) +
        colors.bold(commandParams.accountCredentialsPath)
    );
  }

  if (!commandParams.scriptPath) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(migrateCommandOptions.scriptPath.key) +
        " - " +
        migrateCommandOptions.scriptPath.description
    );
  } else if (!isPathFile(commandParams.scriptPath)) {
    throw new Error(
      colors.bold(colors.red("Invalid: ")) +
        colors.bold(migrateCommandOptions.scriptPath.key) +
        " - " +
        "Script path must be a file"
    );
  } else if (!fs.existsSync(commandParams.scriptPath)) {
    throw new Error(
      colors.bold(colors.red("Script file does not exist: ")) +
        colors.bold(commandParams.scriptPath)
    );
  } else {
    let scriptModule;
    try {
      scriptModule = await import(
        path.resolve(process.cwd(), commandParams.scriptPath)
      );
    } catch (error) {
      throw new Error(
        colors.bold(colors.red("Failed to load script: ")) +
          colors.bold(commandParams.scriptPath) +
          " - " +
          error
      );
    }
    console.log("scriptModule", scriptModule);
    if (
      typeof scriptModule.preview !== "function" ||
      typeof scriptModule.migrate !== "function"
    ) {
      throw new Error(
        colors.bold(colors.red("Invalid: ")) +
          colors.bold(commandParams.scriptPath) +
          " - " +
          "Migration script must export both 'preview' and 'migrate' functions"
      );
    }
  }
}
