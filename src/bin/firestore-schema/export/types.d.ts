export interface FirestoreSchemaExportParams {
  accountCredentialsPath: string;
  collectionNames: string[];
  outputPath: string;
  verbose?: boolean;
}
