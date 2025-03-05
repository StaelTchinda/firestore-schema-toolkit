export interface FirestoreMigrateParams {
  accountCredentialsPath: string;
  scriptPath: string;
  // schemaPath: string;
  inputDatabaseId: string;
  outputDatabaseId: string;
  verbose?: boolean;
}
