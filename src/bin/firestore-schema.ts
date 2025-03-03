#!/usr/bin/env node
import { Command } from "commander";
import colors from "colors";
import process from "process";
import fs from "fs";
import { buildOption, OptionParams } from "../utils/bin/option";
import {
  accountCredentialsEnvironmentKey,
  defaultaccountCredentialsPath,
  packageInfo,
} from "../utils/bin/common";
import {
  FirebaseCredentials,
  getCredentialsFromFile,
  initFirestore,
} from "src/utils/firestore";

interface FirestoreSchemaExportParams {
  accountCredentialsPath: string;
  collectionNames: string[];
  outputPath: string;
}

const params: { [key: string]: OptionParams } = {
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
};

function setupProgram(): Command {
  const program = new Command();
  program
    .name(packageInfo.name)
    .description(packageInfo.description)
    .version(packageInfo.version);

  program
    .option(...buildOption(params.accountCredentialsPath))
    .option(...buildOption(params.collectionNames))
    .option(...buildOption(params.outputPath))
    .parse(process.argv);

  return program;
}

function parseParams(program: Command): FirestoreSchemaExportParams {
  const options = program.opts();

  const accountCredentialsPath =
    options[params.accountCredentialsPath.key] ||
    process.env[accountCredentialsEnvironmentKey] ||
    params.accountCredentialsPath.defaultValue;

  const collectionNames = options[params.collectionNames.key]
    .split(",")
    .map((collectionName: string) => collectionName.trim());

  const outputPath = options[params.outputPath.key];

  return {
    accountCredentialsPath,
    collectionNames,
    outputPath,
  };
}

function validateParams(commandParams: FirestoreSchemaExportParams): void {
  if (!commandParams.accountCredentialsPath) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(params.accountCredentialsPath.key) +
        " - " +
        params.accountCredentialsPath.description
    );
  }
  if (!fs.existsSync(commandParams.accountCredentialsPath)) {
    throw new Error(
      colors.bold(colors.red("Account credentials file does not exist: ")) +
        colors.bold(commandParams.accountCredentialsPath)
    );
  }

  if (!commandParams.collectionNames) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(params.collectionNames.key) +
        " - " +
        params.collectionNames.description
    );
  }

  if (!commandParams.outputPath) {
    throw new Error(
      colors.bold(colors.red("Missing: ")) +
        colors.bold(params.outputPath.key) +
        " - " +
        params.outputPath.description
    );
  }
}

async function exportFirestoreSchema(params: FirestoreSchemaExportParams): Promise<void> {
  const credentials: FirebaseCredentials = await getCredentialsFromFile(
    params.accountCredentialsPath
  );
  console.log("Getting Firestore DB Reference");
  const firestore = await initFirestore({
    credentials,
  });

  const data: Record<string, any> = {};
  for (const collectionName of params.collectionNames) {
    console.log(`Exporting collection: ${collectionName}`);
    const snapshot = await firestore.collection(collectionName).get();
    const collectionData: any[] = [];
    snapshot.forEach((doc) => {
      collectionData.push(doc.data());
    });
    data[collectionName] = collectionData;
  }
}

(async (): Promise<void> => {
  const program = setupProgram();
  const commandParams = parseParams(program);
  validateParams(commandParams);
  await exportFirestoreSchema(commandParams);
})().catch((error) => {
  if (error instanceof Error) {
    console.error(colors.red(`${error.name}: ${error.message}`));
    console.error(colors.red(error.stack as string));
    process.exit(1);
  } else {
    console.error(colors.red(error));
  }
});
