import { DocumentData, Firestore } from "@google-cloud/firestore";
import {
  MigrateFunction,
  PreviewChangeTemplate
} from "src/types/migrate/change";
import { ChangeOperationType } from "src/types/migrate/change-type";
import { applyAttributeChanges, getAttributeChangeBuilder } from "src/lib/migrate/template/utils";

export async function executeDocumentDelete(
  template: PreviewChangeTemplate
): Promise<MigrateFunction> {
  if (template.operation != ChangeOperationType.DELETE.valueOf()) {
    throw new Error("Invalid operation type: " + template.operation);
  }

  return async (firestore) => {
    const collection = firestore.collection(template.collectionPath);
    const docs = await collection.get();
    const _filter = template.filter || (() => true);
    const batch = firestore.batch();
    let deletedCount = 0;

    for (const doc of docs.docs) {
      if (_filter(doc.data())) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await batch.commit();
    }
  };
}

export async function executeDocumentUpdate(
  template: PreviewChangeTemplate
): Promise<MigrateFunction> {
  if (template.operation != ChangeOperationType.UPDATE.valueOf()) {
    throw new Error("Invalid operation type: " + template.operation);
  }
  if (!template.changes) {
    throw new Error("Missing changes for UPDATE operation");
  }

  return async (firestore) => {
    const collection = firestore.collection(template.collectionPath);
    const docs = await collection.get();
    const _filter = template.filter || (() => true);
    const batch = firestore.batch();
    let updatedCount = 0;

    for (const doc of docs.docs) {
      const docData = doc.data();
      if (_filter(docData)) {
        const attributeChanges = await Promise.all(
          (template?.changes ?? []).map(async (change) => {
            const attributeMigration = await getAttributeChangeBuilder(change);
            return attributeMigration(docData);
          })
        );
        // Create a deep clone of the document data to avoid modifying the original
        const updatedDocData = JSON.parse(JSON.stringify(docData));
        applyAttributeChanges(attributeChanges, updatedDocData);
        
        if (Object.keys(updatedDocData).length > 0) {
          batch.update(doc.ref, updatedDocData);
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
    }
  };
}

export async function executeDocumentCreate(
  template: PreviewChangeTemplate
): Promise<MigrateFunction> {
  if (template.operation != ChangeOperationType.CREATE.valueOf()) {
    throw new Error("Invalid operation type: " + template.operation);
  }
  if (!template.changes) {
    throw new Error("Missing changes for CREATE operation");
  }

  return async (firestore) => {
    const collection = firestore.collection(template.collectionPath);
    
    const docRef = collection.doc();
    const newDocData: DocumentData = {};
    
    // Apply all attribute changes to build the new document
    const attributeChanges = await Promise.all(
      (template?.changes ?? []).map(async (change) => {
        const attributeMigration = await getAttributeChangeBuilder(change);
        // We pass an empty object since we're creating a new document
        return attributeMigration({});
      })
    );
    
    // Apply all attribute changes to the new document
    attributeChanges.forEach(change => {
      if (change.operation === ChangeOperationType.CREATE) {
        const path = change.path.split(".");
        let current = newDocData;
        
        // Navigate to the right nested object
        for (let i = 0; i < path.length - 1; i++) {
          if (!current[path[i]]) {
            current[path[i]] = {};
          }
          current = current[path[i]];
        }
        
        // Set the value
        current[path[path.length - 1]] = change.newValue;
      }
    });
    
    await docRef.set(newDocData);
  };
}

export async function buildSingleMigrateFunction(template: PreviewChangeTemplate): Promise<MigrateFunction> {
  switch (template.operation) {
    case ChangeOperationType.CREATE:
      return executeDocumentCreate(template);
    case ChangeOperationType.UPDATE:
      return executeDocumentUpdate(template);
    case ChangeOperationType.DELETE:
      return executeDocumentDelete(template);
    default:
      throw new Error("Invalid operation type: " + template.operation);
  }
}

export async function buildMigrateFunction(templates: PreviewChangeTemplate[]): Promise<MigrateFunction> {
  return async (firestore: Firestore) => {
    const results = [];
    
    // Execute each migration template
    for (const template of templates) {
      const migrateFunction = await buildSingleMigrateFunction(template);
      const result = await migrateFunction(firestore);
      results.push(result);
    }
  };
}
