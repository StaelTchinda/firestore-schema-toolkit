import dotenv from "dotenv";
dotenv.config();
import { Command } from "commander";
import fs from "fs";
import JsonSchemaGenrator from "json-schema-generator";
import { parseParams, validateParams } from "src/bin/firestore-schema/export/params";
import { isPathFolder } from "src/lib/utils/file";
import { FirebaseCredentials, getCredentialsFromFile, initFirestore, getCollectionDocuments, getAllCollectionNames, parseNestedDocumentReferenceToSimpleObject } from "src/lib/utils/firestore";
import { DocumentData } from "firebase-admin/firestore";

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
    const collectionData: DocumentData[] = await getCollectionDocuments(firestore, collectionName);
    params.verbose && console.log(`Fetched ${collectionData.length} documents from collection: ${collectionName} with keys: ${new Set(collectionData.map((doc) => Object.keys(doc || {})).flatMap((keys) => keys))}`);

    params.verbose && console.log(`Parsing nested document references for collection: ${collectionName}`);
    const parsedCollectionData = collectionData.map(parseNestedDocumentReferenceToSimpleObject);
    if (!parsedCollectionData || parsedCollectionData.length === 0) {
      console.warn(
        `No documents found in collection: ${collectionName}. Skipping schema generation.`
      );
      continue;
    }
    
    params.verbose && console.log(`Generating schema for collection: ${collectionName}`);
    let collectionSchema;
    try {
      collectionSchema = JsonSchemaGenrator(parsedCollectionData);
    } catch (error) {
      console.error(`Error generating schema for collection: ${collectionName} using data`, error);
      continue;
    }
    if (!collectionSchema) {
      console.warn(
        `Failed to generate schema for collection: ${collectionName}. Collection is empty or has no schema.`
      );
      continue;
    } else {
      params.verbose && console.log(`Schema generated for collection: ${collectionName}`);
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