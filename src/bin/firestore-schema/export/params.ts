import { Command } from "commander";
import colors from "colors";
import fs from "fs";
import { OptionParams } from "src/lib/utils/bin/option";
import { 
  accountCredentialsEnvironmentKey, 
  defaultaccountCredentialsPath 
} from "src/lib/utils/bin/common";
import { isPathFolder } from "src/lib/utils/file";
import { FirestoreSchemaExportParams } from "src/bin/firestore-schema/export/types";

export const exportCommandOptions: { [key: string]: OptionParams } = {
  accountCredentialsPath: {
    shortKey: "a",
    key: "accountCredentials",
    args: "<path>",
    description: `path to Google Cloud account credentials JSON file. If missing, will look at the ${accountCredentialsEnvironmentKey} environment variable for the path. Defaults to '${defaultaccountCredentialsPath}' if missing.`,
    defaultValue: defaultaccountCredentialsPath,
  },
  collectionNames: {
    shortKey: "c",
    key: "collections",
    args: "<collection1,collection2,...>",
    description: "comma separated list of collection names to export",
  },
  outputPath: {
    shortKey: "o",
    key: "output",
    args: "<path>",
    description: "path to save the exported data",
  },
  verbose: {
    shortKey: "v",
    key: "verbose",
    args: "",
    description: "verbose output",
  },
};

export function parseParams(program: Command): FirestoreSchemaExportParams {
  const options = program.opts();

  const accountCredentialsPath =
    options[exportCommandOptions.accountCredentialsPath.key] ||
    process.env[process.env.FIREBASE_ACCOUNT_CREDENTIALS as string] ||
    exportCommandOptions.accountCredentialsPath.defaultValue;

  const collectionNames =
    options[exportCommandOptions.collectionNames.key]
      ?.split(",")
      .map((collectionName: string) => collectionName.trim()) || [];

  const outputPath = options[exportCommandOptions.outputPath.key];

  const verbose = Boolean(options[exportCommandOptions.verbose.key]);

  return {
    accountCredentialsPath,
    collectionNames,
    outputPath,
    verbose,
  };
}

export function validateParams(
  commandParams: FirestoreSchemaExportParams
): void {
  if (!commandParams.accountCredentialsPath) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(exportCommandOptions.accountCredentialsPath.key) +
        " - " +
        exportCommandOptions.accountCredentialsPath.description
    );
  }
  if (!fs.existsSync(commandParams.accountCredentialsPath)) {
    throw new Error(
      colors.bold(colors.red("Account credentials file does not exist: ")) +
        colors.bold(commandParams.accountCredentialsPath)
    );
  }

  if (
    !commandParams.collectionNames ||
    commandParams.collectionNames.length === 0
  ) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(exportCommandOptions.collectionNames.key) +
        " - " +
        exportCommandOptions.collectionNames.description
    );
  }

  if (!commandParams.outputPath) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(exportCommandOptions.outputPath.key) +
        " - " +
        exportCommandOptions.outputPath.description
    );
  } else if (
    commandParams.collectionNames.length > 1 &&
    !isPathFolder(commandParams.outputPath)
  ) {
    throw new Error(
      colors.bold(colors.red("Invalid: ")) +
        colors.bold(exportCommandOptions.outputPath.key) +
        " - " +
        "Output path must be a folder when exporting multiple collections"
    );
  }
}
