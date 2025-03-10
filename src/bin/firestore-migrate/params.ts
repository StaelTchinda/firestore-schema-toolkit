import { Command } from "commander";
import colors from "colors";
import fs from "fs";
import path from "path";
import { OptionParams } from "src/lib/utils/bin/option";
import {
  accountCredentialsEnvironmentKey,
  defaultAccountCredentialsPath,
  defaultDatabaseId,
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
  databaseId: {
    shortKey: "d",
    key: "database",
    args: "<databaseId>",
    description: `ID of the database to migrate data from and to. Defaults to '${defaultDatabaseId}' if missing.`,
    defaultValue: defaultDatabaseId,
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
  summarize: {
    shortKey: "z",
    key: "summarize",
    args: "",
    description: "summarize output",
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

  const databaseId =
    options[migrateCommandOptions.databaseId.key] ||
    migrateCommandOptions.databaseId.defaultValue;

  const verbose = Boolean(options[migrateCommandOptions.verbose.key]);

  const summarize = Boolean(options[migrateCommandOptions.summarize.key]);

  return {
    accountCredentialsPath,
    scriptPath,
    // schemaPath,
    databaseId,
    verbose,
    summarize,
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
  } else if (!fs.existsSync(commandParams.scriptPath)) {
    throw new Error(
      colors.bold(colors.red("Script file does not exist: ")) +
        colors.bold(commandParams.scriptPath)
    );
  } else if (!isPathFile(commandParams.scriptPath)) {
    throw new Error(
      colors.bold(colors.red("Invalid: ")) +
        colors.bold(migrateCommandOptions.scriptPath.key) +
        " - " +
        "Script path must be a file"
    );
  } else {
    let scriptModule;
    try {
      const scriptResolvedPath = path.resolve(
        process.cwd(),
        commandParams.scriptPath
      );
      scriptModule = await import(scriptResolvedPath);
    } catch (error) {
      // console.error("Failed to load script", error);
      throw new Error(
        colors.bold(colors.red("Failed to load script: ")) +
          colors.bold(commandParams.scriptPath) +
          " - " +
          error
      );
    }

    if (
      typeof scriptModule.changes !== "object" &&
      (typeof scriptModule.preview !== "function" ||
        typeof scriptModule.migrate !== "function")
    ) {
      throw new Error(
        colors.bold(colors.red("Invalid: ")) +
          colors.bold(commandParams.scriptPath) +
          " - " +
          "Migration script must export either changes or both 'preview' and 'migrate' functions"
      );
    }
  }

  if (!commandParams.databaseId) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(migrateCommandOptions.databaseId.key) +
        " - " +
        migrateCommandOptions.databaseId.description
    );
  }
}
