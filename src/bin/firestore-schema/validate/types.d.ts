export interface FirestoreSchemaValidateParams {
  accountCredentialsPath: string;
  collectionNames?: string[];
  useAllCollections?: boolean;
  outputPath?: string;
  schemaPath: string;
  verbose?: boolean;
  summarize?: boolean;
}
