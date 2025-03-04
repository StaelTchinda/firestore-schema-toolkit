#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import { Command } from "commander";
import colors from "colors";
import process from "process";
import fs from "fs";
import JsonSchemaGenrator from "json-schema-generator";
import { setupProgram } from "src/lib/utils/bin/program";
import { exportCommandOptions, parseParams, validateParams } from "src/bin/firestore-schema/export/params";
import { isPathFolder } from "src/lib/utils/file";
import { FirebaseCredentials, getCredentialsFromFile, initFirestore, getCollectionDocuments } from "src/lib/utils/firestore";

export async function executeExportCommand(program: Command): Promise<void> {
  const params = parseParams(program);
  validateParams(params);

  const credentials: FirebaseCredentials = await getCredentialsFromFile(
    params.accountCredentialsPath
  );
  params.verbose && console.log("Getting Firestore DB Reference");
  const firestore = await initFirestore({
    credentials,
  });

  for (const collectionName of params.collectionNames) {
    params.verbose && console.log(`Exporting collection: ${collectionName}`);
    const collectionData: unknown[] = await getCollectionDocuments(firestore, collectionName);

    const collectionSchema = JsonSchemaGenrator(collectionData);

    if (!collectionSchema || !collectionSchema["items"]) {
      throw new Error(
        `Failed to generate schema for collection: ${collectionName}. Collection is empty or has no schema.`
      );
    }
    const dataSchema = collectionSchema["items"];

    const schemaOutputPath = isPathFolder(params.outputPath)
      ? `${params.outputPath}/${collectionName}.json`
      : params.outputPath;
    params.verbose && console.log(`Writing to file: ${schemaOutputPath}`);
    fs.writeFileSync(schemaOutputPath, JSON.stringify(dataSchema, null, 2));
  }

  params.verbose && console.log("Export complete");
}

(async (): Promise<void> => {
  try {
    const program = setupProgram({options: exportCommandOptions});
    await executeExportCommand(program);
  } catch (error) {
    if (error instanceof Error) {
      console.error(colors.red(`${error.name}: ${error.message}`));
      console.error(colors.red(error.stack as string));
      process.exit(1);
    } else {
      console.error(colors.red(String(error)));
    }
  }
})();

