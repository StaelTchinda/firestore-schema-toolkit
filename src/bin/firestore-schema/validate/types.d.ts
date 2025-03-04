export interface FirestoreSchemaValidateParams {
  accountCredentialsPath: string;
  collectionNames: string[];
  outputPath?: string;
  schemaPath: string;
  verbose?: boolean;
  summarize?: boolean;
}
