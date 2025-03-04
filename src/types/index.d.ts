import { Firestore } from '@google-cloud/firestore';

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

export interface MigrationScript {
  preview: (firestore: Firestore, collections: string[]) => Promise<string>;
  do: (firestore: Firestore, collections: string[]) => Promise<string>;
  undo: (firestore: Firestore, collections: string[]) => Promise<string>;
}