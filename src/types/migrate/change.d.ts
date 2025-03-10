import { Firestore, DocumentData } from "@google-cloud/firestore";



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


export interface PreviewChangeSummaryGroup {
  collectionPath: string;
  documentIds: string[];
  change: Omit<PreviewChange, "documentId">;
}


export interface AttributeChangeTemplate<DocumentType extends DocumentData = DocumentData, AttributeType = any> {
  path: string; // Path to the attribute (e.g., "user.address.city")
  operation: ChangeOperationType;
  value?: AttributeType | ((doc: DocumentType) => Promise<AttributeType>); // For CREATE and UPDATE
}

export interface PreviewChangeTemplate<DocumentType extends DocumentData = DocumentData> {
  operation: ChangeOperationType;
  collectionPath: string;
  filter?: (doc: DocumentType) => boolean;
  changes?: AttributeChangeTemplate<DocumentType>[];
}

export type PreviewFunction = (firestore: Firestore) => Promise<PreviewChange[]>;

export type MigrateFunction = (firestore: Firestore) => Promise<DocumentData[]>;


export interface MigrationScript {
  changes?: PreviewChangeTemplate[];
  preview?: PreviewFunction;
  migrate?: MigrateFunction;

  // Either Changes or (Preview and Migrate) must be defined
}
