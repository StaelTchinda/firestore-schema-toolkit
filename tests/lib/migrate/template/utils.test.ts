import { DocumentData } from "firebase-admin/firestore";
import { getAttributeChangeBuilder, getNestedValue } from "src/lib/migrate/template/utils";
import { AttributeChangeTemplate } from "src/types/migrate/change";
import { ChangeOperationType } from "src/types/migrate/change-type";



describe('getNestedValue', () => {
  // This is accessing a function that's not exported in the original code
  // Let's assume it's exported for testing purposes
  
  it('should return the value at the specified path', () => {
    const doc = { user: { name: 'John', address: { city: 'New York' } } };
    expect(getNestedValue(doc, 'user.name')).toBe('John');
    expect(getNestedValue(doc, 'user.address.city')).toBe('New York');
  });

  it('should return undefined for non-existent paths', () => {
    const doc = { user: { name: 'John' } };
    expect(getNestedValue(doc, 'user.age')).toBeUndefined();
    expect(getNestedValue(doc, 'user.address.city')).toBeUndefined();
  });

  it('should return the default value for non-existent paths if provided', () => {
    const doc = { user: { name: 'John' } };
    expect(getNestedValue(doc, 'user.age', 30)).toBe(30);
  });

  it('should handle null or undefined documents', () => {
    expect(getNestedValue(null as unknown as DocumentData, 'user.name')).toBeUndefined();
    expect(getNestedValue(undefined as unknown as DocumentData, 'user.name')).toBeUndefined();
    expect(getNestedValue(null as unknown as DocumentData, 'user.name', 'Default')).toBe('Default');
  });
});


describe('getAttributeChangeBuilder', () => {
  it('should build attribute preview for UPDATE operation', async () => {
    const template: AttributeChangeTemplate = {
      path: 'user.name',
      operation: ChangeOperationType.UPDATE,
      value: 'Jane'
    };
    
    const doc = { user: { name: 'John', age: 30 } };
    const attributePreviewFn = await getAttributeChangeBuilder(template);
    const result = await attributePreviewFn(doc);
    
    expect(result).toEqual({
      path: 'user.name',
      operation: ChangeOperationType.UPDATE,
      oldValue: 'John',
      newValue: 'Jane'
    });
  });

  it('should build attribute preview for DELETE operation', async () => {
    const template: AttributeChangeTemplate = {
      path: 'user.age',
      operation: ChangeOperationType.DELETE
    };
    
    const doc = { user: { name: 'John', age: 30 } };
    const attributePreviewFn = await getAttributeChangeBuilder(template);
    const result = await attributePreviewFn(doc);
    
    expect(result).toEqual({
      path: 'user.age',
      operation: ChangeOperationType.UPDATE,
      oldValue: 30,
      newValue: undefined
    });
  });

  it('should build attribute preview for CREATE operation', async () => {
    const template: AttributeChangeTemplate = {
      path: 'user.address',
      operation: ChangeOperationType.CREATE,
      value: { city: 'New York' }
    };
    
    const doc = { user: { name: 'John' } };
    const attributePreviewFn = await getAttributeChangeBuilder(template);
    const result = await attributePreviewFn(doc);
    
    expect(result).toEqual({
      path: 'user.address',
      operation: ChangeOperationType.UPDATE,
      oldValue: undefined,
      newValue: { city: 'New York' }
    });
  });

  it('should handle function-based new values', async () => {
    const template: AttributeChangeTemplate = {
      path: 'user.fullName',
      operation: ChangeOperationType.CREATE,
      value: async (doc: {user: {firstName: string, lastName: string}}) => `${doc.user.firstName} ${doc.user.lastName}`
    };
    
    const doc = { user: { firstName: 'John', lastName: 'Doe' } };
    const attributePreviewFn = await getAttributeChangeBuilder(template);
    const result = await attributePreviewFn(doc);
    
    expect(result).toEqual({
      path: 'user.fullName',
      operation: ChangeOperationType.UPDATE,
      oldValue: undefined,
      newValue: 'John Doe'
    });
  });

  it('should handle missing attributes', async () => {
    const template: AttributeChangeTemplate = {
      path: 'user.address.city',
      operation: ChangeOperationType.UPDATE,
      value: 'New York'
    };
    
    const doc = { user: { name: 'John' } };
    const attributePreviewFn = await getAttributeChangeBuilder(template);
    const result = await attributePreviewFn(doc);
    
    expect(result).toEqual({
      path: 'user.address.city',
      operation: ChangeOperationType.UPDATE,
      oldValue: undefined,
      newValue: 'New York'
    });
  });
});

