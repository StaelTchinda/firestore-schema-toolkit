import dotenv from "dotenv";
dotenv.config();
import { Command } from "commander";
import fs from "fs";
import JsonSchemaGenrator from "json-schema-generator";
import { parseParams, validateParams } from "src/bin/firestore-schema/export/params";
import { isPathFolder } from "src/lib/utils/file";
import { FirebaseCredentials, getCredentialsFromFile, initFirestore, getCollectionDocuments, getAllCollectionNames } from "src/lib/utils/firestore";

export async function executeAsyncExportCommand(program: Command): Promise<void> {
  const params = parseParams(program);
  validateParams(params);

  const credentials: FirebaseCredentials = await getCredentialsFromFile(
    params.accountCredentialsPath
  );
  params.verbose && console.log("Initializing Firestore client");
  const firestore = await initFirestore({
    credentials,
  });

  // Get collections based on params
  let collectionsToExport = params.collectionNames || [];
  if (params.useAllCollections) {
    params.verbose && console.log("Fetching all collections from database");
    collectionsToExport = await getAllCollectionNames(firestore);
    params.verbose && console.log(`Found ${collectionsToExport.length} collections: ${collectionsToExport.join(', ')}`);
  }

  for (const collectionName of collectionsToExport) {
    params.verbose && console.log(`Importing data for collection: ${collectionName}`);
    const collectionData: unknown[] = await getCollectionDocuments(firestore, collectionName);

    params.verbose && console.log(`Parsing nested document references for collection: ${collectionName}`);
    const parsedCollectionData = parseNestedDocumentReferenceToSimpleObject(collectionData);

    params.verbose && console.log(`Generating schema for collection: ${collectionName}`);
    const collectionSchema = JsonSchemaGenrator(parsedCollectionData);
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