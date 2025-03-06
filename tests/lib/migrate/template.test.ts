import { Firestore } from "@google-cloud/firestore";
import {
  buildAttributePreview,
  buildDocumentCreatePreview,
  buildDocumentDeletePreview,
  buildDocumentUpdatePreview,
  buildPreviewFunction,
  buildSinglePreviewFunction,
  getNestedValue
} from "src/lib/migrate/template";
import { AttributeChangeTemplate, PreviewChangeTemplate } from "src/types/migrate/change";
import { ChangeOperationType } from "src/types/migrate/change-type";
import { DocumentData } from "firebase-admin/firestore";

// Mock Firestore implementation
const mockCollection = jest.fn();
const mockGet = jest.fn();

// Change mockDocs to a map of collections
const mockCollections: Record<string, DocumentData[]> = {};

const mockFirestore = {
  collection: mockCollection,
} as unknown as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset mock collections
  Object.keys(mockCollections).forEach(key => {
    delete mockCollections[key];
  });
  
  // Setup default mocks
  mockCollection.mockImplementation((collectionPath) => {
    return {
      get: async () => ({
        docs: (mockCollections[collectionPath] || []).map(doc => ({
          id: doc.id,
          data: () => doc.data
        }))
      })
    };
  });
  
  mockGet.mockImplementation(async () => {
    const collectionPath = mockCollection.mock.calls[mockCollection.mock.calls.length - 1][0];
    return {
      docs: (mockCollections[collectionPath] || []).map(doc => ({
        id: doc.id,
        data: () => doc.data
      }))
    };
  });
});

// Helper function to add mock documents to a specific collection
function addMockDocs(collectionPath: string, docs: Array<{ id: string, data: any }>): void {
  if (!mockCollections[collectionPath]) {
    mockCollections[collectionPath] = [];
  }
  
  mockCollections[collectionPath].push(...docs);
}

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

describe('buildAttributePreview', () => {
  it('should build attribute preview for UPDATE operation', async () => {
    const template: AttributeChangeTemplate = {
      path: 'user.name',
      operation: ChangeOperationType.UPDATE,
      newValue: 'Jane'
    };
    
    const doc = { user: { name: 'John', age: 30 } };
    const attributePreviewFn = await buildAttributePreview(template);
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
    const attributePreviewFn = await buildAttributePreview(template);
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
      newValue: { city: 'New York' }
    };
    
    const doc = { user: { name: 'John' } };
    const attributePreviewFn = await buildAttributePreview(template);
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
      newValue: async (doc: {user: {firstName: string, lastName: string}}) => `${doc.user.firstName} ${doc.user.lastName}`
    };
    
    const doc = { user: { firstName: 'John', lastName: 'Doe' } };
    const attributePreviewFn = await buildAttributePreview(template);
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
      newValue: 'New York'
    };
    
    const doc = { user: { name: 'John' } };
    const attributePreviewFn = await buildAttributePreview(template);
    const result = await attributePreviewFn(doc);
    
    expect(result).toEqual({
      path: 'user.address.city',
      operation: ChangeOperationType.UPDATE,
      oldValue: undefined,
      newValue: 'New York'
    });
  });
});

describe('buildDocumentDeletePreview', () => {
  it('should build preview for document deletion', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.DELETE,
      collectionPath: 'users'
    };
    
    addMockDocs('users', [
      { id: 'user1', data: { name: 'John', active: true } },
      { id: 'user2', data: { name: 'Jane', active: false } }
    ]);
    
    const previewFn = await buildDocumentDeletePreview(template);
    const changes = await previewFn(mockFirestore);
    
    expect(changes).toHaveLength(2);
    expect(changes[0]).toEqual({
      operation: ChangeOperationType.DELETE,
      documentId: 'user1',
      collectionPath: 'users',
      before: { name: 'John', active: true },
      after: undefined,
      changes: []
    });
    expect(changes[1]).toEqual({
      operation: ChangeOperationType.DELETE,
      documentId: 'user2',
      collectionPath: 'users',
      before: { name: 'Jane', active: false },
      after: undefined,
      changes: []
    });
    
    expect(mockCollection).toHaveBeenCalledWith('users');
  });

  it('should apply filter when provided', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.DELETE,
      collectionPath: 'users',
      filter: (doc) => doc.active === true
    };
    
    addMockDocs('users', [
      { id: 'user1', data: { name: 'John', active: true } },
      { id: 'user2', data: { name: 'Jane', active: false } }
    ]);
    
    const previewFn = await buildDocumentDeletePreview(template);
    const changes = await previewFn(mockFirestore);
    
    expect(changes).toHaveLength(1);
    expect(changes[0].documentId).toBe('user1');
  });

  it('should throw error for invalid operation type', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.UPDATE,
      collectionPath: 'users'
    };
    
    await expect(buildDocumentDeletePreview(template)).rejects.toThrow('Invalid operation type');
  });

  it('should handle empty collection', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.DELETE,
      collectionPath: 'users'
    };
    
    // No documents added to mockDocs
    
    const previewFn = await buildDocumentDeletePreview(template);
    const changes = await previewFn(mockFirestore);
    
    expect(changes).toHaveLength(0);
  });
});

describe('buildDocumentUpdatePreview', () => {
  it('should build preview for document update', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.UPDATE,
      collectionPath: 'users',
      changes: [
        {
          path: 'name',
          operation: ChangeOperationType.UPDATE,
          newValue: 'Updated Name'
        }
      ]
    };
    
    addMockDocs('users', [
      { id: 'user1', data: { name: 'John', active: true } }
    ]);
    
    const previewFn = await buildDocumentUpdatePreview(template);
    const changes = await previewFn(mockFirestore);
    
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      operation: ChangeOperationType.UPDATE,
      documentId: 'user1',
      collectionPath: 'users',
      before: { name: 'John', active: true },
      after: { name: 'Updated Name', active: true },
      changes: [
        {
          path: 'name',
          operation: ChangeOperationType.UPDATE,
          oldValue: 'John',
          newValue: 'Updated Name'
        }
      ]
    });
  });

  it('should apply filter when provided', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.UPDATE,
      collectionPath: 'users',
      filter: (doc) => doc.active === true,
      changes: [
        {
          path: 'name',
          operation: ChangeOperationType.UPDATE,
          newValue: 'Updated Name'
        }
      ]
    };
    
    addMockDocs('users', [
      { id: 'user1', data: { name: 'John', active: true } },
      { id: 'user2', data: { name: 'Jane', active: false } }
    ]);
    
    const previewFn = await buildDocumentUpdatePreview(template);
    const changes = await previewFn(mockFirestore);
    
    expect(changes).toHaveLength(1);
    expect(changes[0].documentId).toBe('user1');
  });

  it('should throw error for invalid operation type', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.DELETE,
      collectionPath: 'users',
      changes: []
    };
    
    await expect(buildDocumentUpdatePreview(template)).rejects.toThrow('Invalid operation type');
  });

  it('should handle multiple attribute changes', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.UPDATE,
      collectionPath: 'users',
      changes: [
        {
          path: 'name',
          operation: ChangeOperationType.UPDATE,
          newValue: 'Updated Name'
        },
        {
          path: 'active',
          operation: ChangeOperationType.UPDATE,
          newValue: false
        }
      ]
    };
    
    addMockDocs('users', [
      { id: 'user1', data: { name: 'John', active: true } }
    ]);
    
    const previewFn = await buildDocumentUpdatePreview(template);
    const changes = await previewFn(mockFirestore);
    
    expect(changes).toHaveLength(1);
    expect(changes[0].changes).toHaveLength(2);
    expect(changes[0].changes[0].path).toBe('name');
    expect(changes[0].changes[1].path).toBe('active');
  });
});

describe('buildDocumentCreatePreview', () => {
  it('should build preview for document creation', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.CREATE,
      collectionPath: 'users',
      changes: [
        {
          path: 'name',
          operation: ChangeOperationType.CREATE,
          newValue: 'New User'
        },
        {
          path: 'active',
          operation: ChangeOperationType.CREATE,
          newValue: true
        }
      ]
    };
    
    addMockDocs('users', [
      { id: 'user1', data: { } } // Empty document to serve as a template
    ]);
    
    const previewFn = await buildDocumentCreatePreview(template);
    const changes = await previewFn(mockFirestore);
    
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      operation: ChangeOperationType.CREATE,
      documentId: 'user1',
      collectionPath: 'users',
      before: undefined,
      after: { },
      changes: [
        {
          path: 'name',
          operation: ChangeOperationType.UPDATE,
          oldValue: undefined,
          newValue: 'New User'
        },
        {
          path: 'active',
          operation: ChangeOperationType.UPDATE,
          oldValue: undefined,
          newValue: true
        }
      ]
    });
  });

  it('should throw error if any change is not CREATE operation', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.CREATE,
      collectionPath: 'users',
      changes: [
        {
          path: 'name',
          operation: ChangeOperationType.CREATE,
          newValue: 'New User'
        },
        {
          path: 'active',
          operation: ChangeOperationType.UPDATE, // This should be CREATE
          newValue: true
        }
      ]
    };
    
    await expect(buildDocumentCreatePreview(template)).rejects.toThrow('Invalid operation type');
  });

  it('should throw error for invalid operation type', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.UPDATE,
      collectionPath: 'users',
      changes: []
    };
    
    await expect(buildDocumentCreatePreview(template)).rejects.toThrow('Invalid operation type');
  });
});

describe('buildSinglePreviewFunction', () => {
  it('should build correct preview function for CREATE operation', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.CREATE,
      collectionPath: 'users',
      changes: [
        {
          path: 'name',
          operation: ChangeOperationType.CREATE,
          newValue: 'New User'
        }
      ]
    };
    
    addMockDocs('users', [
      { id: 'user1', data: { } } // Empty document to serve as a template
    ]);
    
    const previewFn = await buildSinglePreviewFunction(template);
    const result = await previewFn(mockFirestore);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      operation: ChangeOperationType.CREATE,
      documentId: 'user1',
      collectionPath: 'users',
      before: undefined,
      after: { },
      changes: [
      {
        path: 'name',
        operation: ChangeOperationType.UPDATE,
        oldValue: undefined,
        newValue: 'New User'
      }
      ]
    });
  });

  it('should build correct preview function for UPDATE operation', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.UPDATE,
      collectionPath: 'users',
      changes: [
        {
          path: 'name',
          operation: ChangeOperationType.UPDATE,
          newValue: 'Updated User'
        }
      ]
    };
    
    addMockDocs('users', [
      { id: 'user1', data: { name: 'Old Name', active: true } }
    ]);
    
    const previewFn = await buildSinglePreviewFunction(template);
    const result = await previewFn(mockFirestore);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      operation: ChangeOperationType.UPDATE,
      documentId: 'user1',
      collectionPath: 'users',
      before: { name: 'Old Name', active: true },
      after: { name: 'Updated User', active: true },
      changes: [
      {
        path: 'name',
        operation: ChangeOperationType.UPDATE,
        oldValue: 'Old Name',
        newValue: 'Updated User'
      }
      ]
    });
  });

  it('should build correct preview function for DELETE operation', async () => {
    const template: PreviewChangeTemplate = {
      operation: ChangeOperationType.DELETE,
      collectionPath: 'users'
    };
    
    addMockDocs('users', [
      { id: 'user1', data: { name: 'John', active: true } },
      { id: 'user2', data: { name: 'Jane', active: false } }
    ]);
    
    const previewFn = await buildSinglePreviewFunction(template);
    const result = await previewFn(mockFirestore);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      operation: ChangeOperationType.DELETE,
      documentId: 'user1',
      collectionPath: 'users',
      before: { name: 'John', active: true },
      after: undefined,
      changes: []
    });
    expect(result[1]).toEqual({
      operation: ChangeOperationType.DELETE,
      documentId: 'user2',
      collectionPath: 'users',
      before: { name: 'Jane', active: false },
      after: undefined,
      changes: []
    });
  });

  it('should throw error for invalid operation type', async () => {
    const template: PreviewChangeTemplate = {
      operation: 'INVALID' as any,
      collectionPath: 'users',
      changes: []
    };
    
    await expect(buildSinglePreviewFunction(template)).rejects.toThrow('Invalid operation type');
  });
});

describe('buildPreviewFunction', () => {
  it('should combine results from multiple templates', async () => {
    const templates: PreviewChangeTemplate[] = [
      {
        operation: ChangeOperationType.CREATE,
        collectionPath: 'users',
        changes: [
          {
            path: 'name',
            operation: ChangeOperationType.CREATE,
            newValue: 'New User'
          }
        ]
      },
      {
        operation: ChangeOperationType.UPDATE,
        collectionPath: 'posts',
        changes: [
          {
            path: 'title',
            operation: ChangeOperationType.UPDATE,
            newValue: 'Updated Title'
          }
        ]
      }
    ];
    
    // Add mock documents for both collections
    const mockCollectionData = {
      users: [{ id: 'user1', data: {} }],
      posts: [{ id: 'post1', data: { title: 'Old Title' } }]
    };
    addMockDocs('users', mockCollectionData.users);
    addMockDocs('posts', mockCollectionData.posts);

    const previewFn = await buildPreviewFunction(templates);
    const result = await previewFn(mockFirestore);

    // Verify results contain expected changes from both templates
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(expect.objectContaining({
      operation: ChangeOperationType.CREATE,
      documentId: 'user1',
      collectionPath: 'users',
      changes: expect.arrayContaining([
        expect.objectContaining({
          path: 'name',
          newValue: 'New User'
        })
      ])
    }));
    expect(result).toContainEqual(expect.objectContaining({
      operation: ChangeOperationType.UPDATE,
      documentId: 'post1',
      collectionPath: 'posts',
      changes: expect.arrayContaining([
        expect.objectContaining({
          path: 'title',
          oldValue: 'Old Title',
          newValue: 'Updated Title'
        })
      ])
    }));
  });

  it('should handle empty templates array', async () => {
    const previewFn = await buildPreviewFunction([]);
    const result = await previewFn(mockFirestore);
    
    expect(result).toEqual([]);
  });
});
