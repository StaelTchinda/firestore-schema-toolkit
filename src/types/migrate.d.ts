import { Firestore, DocumentData } from "@google-cloud/firestore";

export enum ChangeOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export interface AttributeChange<T = unknown> {
  path: string; // Path to the attribute (e.g., "user.address.city")
  operation: ChangeOperationType;
  oldValue?: T; // For UPDATE and DELETE
  newValue?: T; // For CREATE and UPDATE
}

export interface PreviewChange<T extends DocumentData = DocumentData> {
  operation: ChangeOperationType;
  documentId: string;
  collectionPath: string;
  before?: T; // Optional because it might not exist for CREATE
  after?: T;  // Optional because it might not exist for DELETE
  changes: AttributeChange[]; // Detailed attribute changes
}


export interface MigrationScript {
  preview: (firestore: Firestore) => Promise<PreviewChange[]>;
  migrate: (firestore: Firestore) => Promise<DocumentData[]>;
}
