export interface FirestoreMigrateParams {
  accountCredentialsPath: string;
  scriptPath: string;
  // schemaPath: string;
  databaseId: string;
  verbose?: boolean;
  summarize?: boolean;
}
