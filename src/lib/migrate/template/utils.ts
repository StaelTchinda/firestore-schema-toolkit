import { DocumentData } from "@google-cloud/firestore";
import { AttributeChange, AttributeChangeTemplate } from "src/types/migrate/change";
import { ChangeOperationType } from "src/types/migrate/change-type";

export function getNestedValue<T>(doc: DocumentData, path: string, defaultValue?: T): unknown {
  if (!doc) return defaultValue;
  
  const result = path.split(".").reduce((acc, key) => {
    return acc && typeof acc === 'object' ? acc[key] : undefined;
  }, doc);
  
  return result !== undefined ? result : defaultValue;
}

type AttributeChangeBuilder = (doc: DocumentData) => Promise<AttributeChange>;

export async function getAttributeChangeBuilder(
  template: AttributeChangeTemplate
): Promise<AttributeChangeBuilder> {
  return async (doc: DocumentData) => {
    let oldValue = undefined;
    let newValue = undefined;

    if (template.operation == ChangeOperationType.DELETE || template.operation == ChangeOperationType.UPDATE) {
      oldValue = getNestedValue(doc, template.path);
    }

    if (template.operation == ChangeOperationType.CREATE || template.operation == ChangeOperationType.UPDATE) {
      if (typeof template.value === "function") {
        newValue = await template.value(doc);
      } else {
        newValue = template.value;
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

export function applyAttributeChanges(attributeChanges: AttributeChange<unknown>[], afterDocData: DocumentData): void {
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