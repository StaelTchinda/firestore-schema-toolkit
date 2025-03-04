import { Command } from "commander";
import colors from "colors";
import fs from "fs";
import { OptionParams } from "src/lib/utils/bin/option";
import { 
  accountCredentialsEnvironmentKey, 
  defaultAccountCredentialsPath 
} from "src/lib/utils/bin/common";
import { isPathFile, isPathFolder } from "src/lib/utils/file";
import { FirestoreSchemaValidateParams } from "./types";

export const validateCommandOptions: { [key: string]: OptionParams } = {
  accountCredentialsPath: {
    shortKey: "a",
    key: "accountCredentials",
    args: "<path>",
    description: `path to Google Cloud account credentials JSON file. If missing, will look at the ${accountCredentialsEnvironmentKey} environment variable for the path. Defaults to '${defaultAccountCredentialsPath}' if missing.`,
    defaultValue: defaultAccountCredentialsPath,
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
    description: "output path to save all errors found [optional]",
  },
  schemaPath: {
    shortKey: "s",
    key: "schema",
    args: "<path>",
    description: "path to the JSON schema file to validate the data against",
  },
  verbose: {
    shortKey: "v",
    key: "verbose",
    args: "",
    description: "verbose output",
  },
  summarize: {
    shortKey: "z",
    key: "summarized",
    args: "",
    description: "summarize the validation results",
  },
};

export function parseParams(program: Command): FirestoreSchemaValidateParams {
  const options = program.opts();

  const accountCredentialsPath =
    options[validateCommandOptions.accountCredentialsPath.key] ||
    process.env[accountCredentialsEnvironmentKey] ||
    validateCommandOptions.accountCredentialsPath.defaultValue;

  const collectionNames =
    options[validateCommandOptions.collectionNames.key]
      ?.split(",")
      .map((collectionName: string) => collectionName.trim()) || [];

  const outputPath = options[validateCommandOptions.outputPath.key];

  const schemaPath = options[validateCommandOptions.schemaPath.key];

  const verbose = Boolean(options[validateCommandOptions.verbose.key]);

  const summarize = Boolean(options[validateCommandOptions.summarize.key]);

  return {
    accountCredentialsPath,
    collectionNames,
    outputPath,
    schemaPath,
    verbose,
    summarize,
  };
}

export function validateParams(
  commandParams: FirestoreSchemaValidateParams
): void {
  if (!commandParams.accountCredentialsPath) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(validateCommandOptions.accountCredentialsPath.key) +
        " - " +
        validateCommandOptions.accountCredentialsPath.description
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
        colors.bold(validateCommandOptions.collectionNames.key) +
        " - " +
        validateCommandOptions.collectionNames.description
    );
  }

  if (commandParams.outputPath) {
    if (commandParams.collectionNames && commandParams.collectionNames.length > 1 && !isPathFolder(commandParams.outputPath)) {
      throw new Error(
        colors.bold(colors.red("Invalid: ")) +
          colors.bold(validateCommandOptions.outputPath.key) +
          " - " +
          "Output path must be a folder when validating multiple collections"
      );
    }
  }

  if (!commandParams.schemaPath) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(validateCommandOptions.outputPath.key) +
        " - " +
        validateCommandOptions.outputPath.description
    );
  } else if (
    commandParams.collectionNames.length > 1 &&
    !isPathFolder(commandParams.schemaPath)
  ) {
    throw new Error(
      colors.bold(colors.red("Invalid: ")) +
        colors.bold(validateCommandOptions.outputPath.key) +
        " - " +
        "Schema path must be a folder when validating multiple collections"
    );
  }
}
