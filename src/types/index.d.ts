export interface SchemaAssertOptions {
  projectId?: string;
  keyFilename?: string;
  databaseName?: string;
  collections: string[];
  outputPath: string;
}

export interface SchemaMigrateOptions {
  projectId?: string;
  keyFilename?: string;
  databaseName?: string;
  collections: string[];
  migrationScriptPath: string;
}
