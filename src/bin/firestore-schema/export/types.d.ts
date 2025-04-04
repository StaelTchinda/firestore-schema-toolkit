export interface FirestoreSchemaExportParams {
  accountCredentialsPath: string;
  collectionNames?: string[];
  useAllCollections?: boolean;
  outputPath: string;
  verbose?: boolean;
}
