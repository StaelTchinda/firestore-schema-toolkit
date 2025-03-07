import { DocumentData } from "@google-cloud/firestore";
import {
  AttributeChange,
  AttributeChangeTemplate,
  PreviewChange,
  PreviewChangeTemplate,
  PreviewFunction,
} from "src/types/migrate/change";
import { ChangeOperationType } from "src/types/migrate/change-type";

export async function buildDocumentDeletePreview(
  template: PreviewChangeTemplate
): Promise<PreviewFunction> {
  if (template.operation != ChangeOperationType.DELETE.valueOf()) {
    throw new Error("Invalid operation type: " + template.operation);
  }

  return async (firestore) => {
    const collection = firestore.collection(template.collectionPath);
    const docs = await collection.get();

    const _filter = template.filter || (() => true);

    const changes: PreviewChange[] = [];
    for (const doc of docs.docs) {
      if (_filter(doc.data())) {
        changes.push({
          operation: ChangeOperationType.DELETE,
          documentId: doc.id,
          collectionPath: template.collectionPath,
          before: doc.data(),
          after: undefined,
          changes: [],
        });
      }
    }

    return changes;
  };
}

export function getNestedValue<T>(doc: DocumentData, path: string, defaultValue?: T): unknown {
  if (!doc) return defaultValue;
  
  const result = path.split(".").reduce((acc, key) => {
    return acc && typeof acc === 'object' ? acc[key] : undefined;
  }, doc);
  
  return result !== undefined ? result : defaultValue;
}

type AttributePreviewFunction = (doc: DocumentData) => Promise<AttributeChange>;

export async function buildAttributePreview(
  template: AttributeChangeTemplate
): Promise<AttributePreviewFunction> {
  return async (doc: DocumentData) => {
    let oldValue = undefined;
    let newValue = undefined;

    if (template.operation == ChangeOperationType.DELETE || template.operation == ChangeOperationType.UPDATE) {
      oldValue = getNestedValue(doc, template.path);
    }

    if (template.operation == ChangeOperationType.CREATE || template.operation == ChangeOperationType.UPDATE) {
      if (typeof template.newValue === "function") {
        newValue = await template.newValue(doc);
      } else {
        newValue = template.newValue;
      }
    }

    return {
      path: template.path,
      operation: ChangeOperationType.UPDATE,
      oldValue,
      newValue,
    };

  };

}

export async function buildDocumentUpdatePreview(
  template: PreviewChangeTemplate
): Promise<PreviewFunction> {
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

    const changes: PreviewChange[] = [];
    for (const doc of docs.docs) {
      const docData = doc.data();
      if (_filter(docData)) {
        const attributeChanges: AttributeChange[] = await Promise.all(
          (template?.changes ?? []).map(async (change) => {
            const attributeChange = await buildAttributePreview(change);
            return attributeChange(docData);
          })
        );
        // Create a deep clone of the document data to avoid modifying the original
        const afterDocData = JSON.parse(JSON.stringify(docData));
        
        // Apply each attribute change to the cloned data
        applyAttributeChanges(attributeChanges, afterDocData);
        const docChange: PreviewChange = {
          operation: ChangeOperationType.UPDATE,
          documentId: doc.id,
          collectionPath: template.collectionPath,
          before: docData,
          after: afterDocData,
          changes: attributeChanges,
        };
        changes.push(docChange);
      }
    }
    return changes;
  };
}

function applyAttributeChanges(attributeChanges: AttributeChange<unknown>[], afterDocData: DocumentData): void {
  attributeChanges.forEach(change => {
    const path = change.path.split(".");
    const lastKey = path.pop();

    if (!lastKey) return;

    // Navigate to the parent object that contains the property to modify
    const parent = path.reduce((obj, key) => {
      if (!obj[key] || typeof obj[key] !== 'object') {
        obj[key] = {};
      }
      return obj[key];
    }, afterDocData);

    // Apply the change based on operation type
    if (change.operation === ChangeOperationType.DELETE) {
      delete parent[lastKey];
    } else if (change.operation === ChangeOperationType.CREATE ||
      change.operation === ChangeOperationType.UPDATE) {
      parent[lastKey] = change.newValue;
    }
  });
}

export async function buildDocumentCreatePreview(
  template: PreviewChangeTemplate
): Promise<PreviewFunction> {
  if (template.operation != ChangeOperationType.CREATE.valueOf()) {
    throw new Error("Invalid operation type: " + template.operation);
  }
  if (!template.changes) {
    throw new Error("Missing changes for CREATE operation");
  }
  if (!template.changes.every((change) => change.operation === ChangeOperationType.CREATE)) {
    throw new Error("Invalid operation type: " + template.operation);
  }

  return async (firestore) => {
    const collection = firestore.collection(template.collectionPath);
    const docs = await collection.get();

    const _filter = template.filter || (() => true);

    const changes: PreviewChange[] = [];
    for (const doc of docs.docs) {
      const docData = doc.data();
      if (_filter(docData)) {
        const attributeChanges: AttributeChange[] = await Promise.all(
          (template?.changes ?? []).map(async (change) => {
            const attributeChange = await buildAttributePreview(change);
            return attributeChange(docData);
          })
        );
        const docChange: PreviewChange = {
          operation: ChangeOperationType.CREATE,
          documentId: doc.id,
          collectionPath: template.collectionPath,
          before: undefined,
          after: docData,
          changes: attributeChanges,
        };
        changes.push(docChange);
      }
    }
    return changes;
  };
}

export async function buildSinglePreviewFunction(template: PreviewChangeTemplate): Promise<PreviewFunction> {
  switch (template.operation) {
    case ChangeOperationType.CREATE:
      return buildDocumentCreatePreview(template);
    case ChangeOperationType.UPDATE:
      return buildDocumentUpdatePreview(template);
    case ChangeOperationType.DELETE:
      return buildDocumentDeletePreview(template);
    default:
      throw new Error("Invalid operation type: " + template.operation);
  }
}

export async function buildPreviewFunction(templates: PreviewChangeTemplate[]): Promise<PreviewFunction> {
  return async (firestore) => {
    const changes: PreviewChange[] = [];
    for (const template of templates) {
      const previewFunction = await buildSinglePreviewFunction(template);
      const templateChanges = await previewFunction(firestore);
      changes.push(...templateChanges);
    }
    return changes;
  };
}
            
