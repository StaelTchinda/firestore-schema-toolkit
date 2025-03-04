import dotenv from "dotenv";
dotenv.config();
import { Command } from "commander";
import fs from "fs";
import colors from "colors";
import {
  parseParams,
  validateParams,
} from "src/bin/firestore-schema/validate/params";
import { getJsonFromFile, isPathFolder } from "src/lib/utils/file";
import {
  FirebaseCredentials,
  getCredentialsFromFile,
  initFirestore,
  getCollectionDocuments,
} from "src/lib/utils/firestore";
import { Ajv, ErrorObject, Schema } from "ajv";
import { mapItemSchemaToCollectionSchema, mergeValidationErrors } from "src/lib/schema/validate";

export async function executeAsyncValidateCommand(
  program: Command
): Promise<void> {
  const params = parseParams(program);
  validateParams(params);

  const credentials: FirebaseCredentials = await getCredentialsFromFile(
    params.accountCredentialsPath
  );
  params.verbose && console.log("Initializing Firestore client");
  const firestore = await initFirestore({
    credentials,
  });

  const allErrors: Record<string, ErrorObject[]> = {};
  for (const collectionName of params.collectionNames) {
    params.verbose &&
      console.log(`Importing data for collection: ${collectionName}`);
    const collectionData: unknown[] = await getCollectionDocuments(
      firestore,
      collectionName
    );

    params.verbose &&
      console.log(`Fetching schema for collection: ${collectionName}`);
    const schemaPath = isPathFolder(params.schemaPath)
      ? `${params.schemaPath}/${collectionName}.json`
      : params.schemaPath;
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file does not exist: ${schemaPath}`);
    }
    const itemSchema = await getJsonFromFile<Schema>(schemaPath);
    if (!itemSchema) {
      throw new Error(`Failed to read schema file: ${schemaPath}`);
    }
    params.verbose && console.log(`Fetched schema: ${itemSchema}`);
    const collectionSchema = mapItemSchemaToCollectionSchema(itemSchema);

    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(collectionSchema);
    const valid = validate(collectionData);
    if (valid) {
      console.log(colors.bold(colors.green('Validation succeeded')) + ` for collection ${collectionName}.`);
    } else {
      allErrors[collectionName] = validate.errors || [];
      console.error(
        colors.bold(colors.red('Validation failed')) + ` for collection ${collectionName}: found ${validate.errors?.length} errors.`
      );
      const mergedErrors = mergeValidationErrors(validate.errors || []);
      for (const error of mergedErrors) {
        params.verbose && console.error(error);
      }
    }
  }

  if (params.outputPath) {
    params.verbose && console.log(`Writing errors to file: ${params
      .outputPath}`);
    if (isPathFolder(params.outputPath)) {
      for (const collectionName of Object.keys(allErrors)) {
        const errorsOutputPath = isPathFolder(params.outputPath) ? `${params.outputPath}/${collectionName}.json` : params.outputPath;
        const errorsToSave = params.summarize ? mergeValidationErrors(allErrors[collectionName]) : allErrors[collectionName];
        fs.writeFileSync(errorsOutputPath, JSON.stringify(errorsToSave, null, 2));
      }
    } else {
      const errorsToSave = params.summarize ? mergeValidationErrors(Object.values(allErrors).flat()) : Object.values(allErrors).flat();
      fs.writeFileSync(params.outputPath, JSON.stringify(errorsToSave, null, 2));
    }
  }

  params.verbose && console.log("Validation complete");
}
