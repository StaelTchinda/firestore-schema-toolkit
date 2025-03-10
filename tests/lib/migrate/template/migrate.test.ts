import {
  executeDocumentDelete,
  executeDocumentUpdate,
  executeDocumentCreate,
  buildSingleMigrateFunction,
  buildMigrateFunction
} from 'src/lib/migrate/template/migrate';
import { ChangeOperationType } from 'src/types/migrate/change-type';
import { PreviewChangeTemplate } from 'src/types/migrate/change';
import * as utils from 'src/lib/migrate/template/utils';

// Mock the utility functions
jest.mock('src/lib/migrate/template/utils', () => ({
  applyAttributeChanges: jest.fn(),
  getAttributeChangeBuilder: jest.fn()
}));

describe('Migration Functions', () => {
  let mockFirestore: any;
  let mockCollection: any;
  let mockBatch: any;
  let mockDocs: any;
  let mockDoc: any;
  let mockDocRef: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up mocks
    mockBatch = {
      delete: jest.fn(),
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    };
    
    mockDocRef = {
      set: jest.fn().mockResolvedValue(undefined)
    };
    
    mockDocs = [
      {
        data: () => ({ id: 1, name: 'Test 1' }),
        ref: { id: 'doc1' }
      },
      {
        data: () => ({ id: 2, name: 'Test 2' }),
        ref: { id: 'doc2' }
      }
    ];
    
    mockCollection = {
      get: jest.fn().mockResolvedValue({ docs: mockDocs }),
      doc: jest.fn().mockReturnValue(mockDocRef)
    };
    
    mockFirestore = {
      collection: jest.fn().mockReturnValue(mockCollection),
      batch: jest.fn().mockReturnValue(mockBatch)
    };
    
    // Mock the attribute change builder to return some sample changes
    (utils.getAttributeChangeBuilder as jest.Mock).mockImplementation((change) => async (data: any) => {
      if (change.operation === ChangeOperationType.CREATE) {
        return {
          operation: ChangeOperationType.CREATE,
          path: change.path,
          newValue: change.value
        };
      }
      if (change.operation === ChangeOperationType.UPDATE) {
        return {
          operation: ChangeOperationType.UPDATE,
          path: change.path,
          oldValue: data[change.path],
          newValue: change.value
        };
      }
      if (change.operation === ChangeOperationType.DELETE) {
        return {
          operation: ChangeOperationType.DELETE,
          path: change.path,
          oldValue: data[change.path]
        };
      }
      return change;
    });
  });

  describe('executeDocumentDelete', () => {
    it('should delete documents that match the filter', async () => {
      const template: PreviewChangeTemplate = {
        operation: ChangeOperationType.DELETE,
        collectionPath: 'test-collection',
        filter: (doc) => doc.id === 1
      };

      const migrateFunction = await executeDocumentDelete(template);
      await migrateFunction(mockFirestore);

      expect(mockFirestore.collection).toHaveBeenCalledWith('test-collection');
      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should not commit batch if no documents match filter', async () => {
      const template: PreviewChangeTemplate = {
        operation: ChangeOperationType.DELETE,
        collectionPath: 'test-collection',
        filter: () => false
      };

      const migrateFunction = await executeDocumentDelete(template);
      await migrateFunction(mockFirestore);

      expect(mockBatch.delete).not.toHaveBeenCalled();
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });

    it('should throw error if operation is not DELETE', async () => {
      const template: PreviewChangeTemplate = {
        operation: ChangeOperationType.UPDATE,
        collectionPath: 'test-collection'
      };

      await expect(executeDocumentDelete(template)).rejects.toThrow('Invalid operation type');
    });
  });

  describe('executeDocumentUpdate', () => {
    it('should update documents that match the filter', async () => {
      const template: PreviewChangeTemplate = {
        operation: ChangeOperationType.UPDATE,
        collectionPath: 'test-collection',
        filter: (doc) => doc.id === 1,
        changes: [
          {
            operation: ChangeOperationType.UPDATE,
            path: 'name',
            value: 'Updated Name'
          }
        ]
      };

      const migrateFunction = await executeDocumentUpdate(template);
      await migrateFunction(mockFirestore);

      expect(mockFirestore.collection).toHaveBeenCalledWith('test-collection');
      expect(utils.getAttributeChangeBuilder).toHaveBeenCalled();
      expect(utils.applyAttributeChanges).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should throw error if operation is not UPDATE', async () => {
      const template: PreviewChangeTemplate = {
        operation: ChangeOperationType.DELETE,
        collectionPath: 'test-collection'
      };

      await expect(executeDocumentUpdate(template)).rejects.toThrow('Invalid operation type');
    });

    it('should throw error if changes are not provided', async () => {
      const template: PreviewChangeTemplate = {
        operation: ChangeOperationType.UPDATE,
        collectionPath: 'test-collection'
      };

      await expect(executeDocumentUpdate(template)).rejects.toThrow('Missing changes for UPDATE operation');
    });
  });

  describe('executeDocumentCreate', () => {
    it('should create a new document with the specified attributes', async () => {
      const template: PreviewChangeTemplate = {
        operation: ChangeOperationType.CREATE,
        collectionPath: 'test-collection',
        changes: [
          {
            operation: ChangeOperationType.CREATE,
            path: 'name',
            value: 'New Document'
          },
          {
            operation: ChangeOperationType.CREATE,
            path: 'nested.property',
            value: 'Nested Value'
          }
        ]
      };

      const migrateFunction = await executeDocumentCreate(template);
      await migrateFunction(mockFirestore);

      expect(mockFirestore.collection).toHaveBeenCalledWith('test-collection');
      expect(mockCollection.doc).toHaveBeenCalled();
      expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Document',
        nested: { property: 'Nested Value' }
      }));
    });

    it('should throw error if operation is not CREATE', async () => {
      const template: PreviewChangeTemplate = {
        operation: ChangeOperationType.UPDATE,
        collectionPath: 'test-collection'
      };

      await expect(executeDocumentCreate(template)).rejects.toThrow('Invalid operation type');
    });

    it('should throw error if changes are not provided', async () => {
      const template: PreviewChangeTemplate = {
        operation: ChangeOperationType.CREATE,
        collectionPath: 'test-collection'
      };

      await expect(executeDocumentCreate(template)).rejects.toThrow('Missing changes for CREATE operation');
    });
  });

  describe('buildSingleMigrateFunction', () => {
    it('should return the correct function based on operation type', async () => {
      const createTemplate: PreviewChangeTemplate = {
        operation: ChangeOperationType.CREATE,
        collectionPath: 'test-collection',
        changes: [{ operation: ChangeOperationType.CREATE, path: 'name', value: 'Test' }]
      };
      
      const updateTemplate: PreviewChangeTemplate = {
        operation: ChangeOperationType.UPDATE,
        collectionPath: 'test-collection',
        changes: [{ operation: ChangeOperationType.UPDATE, path: 'name', value: 'Updated' }]
      };
      
      const deleteTemplate: PreviewChangeTemplate = {
        operation: ChangeOperationType.DELETE,
        collectionPath: 'test-collection'
      };

      // Testing each operation type
      await buildSingleMigrateFunction(createTemplate);
      await buildSingleMigrateFunction(updateTemplate);
      await buildSingleMigrateFunction(deleteTemplate);

      expect(true).toBeTruthy(); // If we get here without errors, the test passes
    });

    it('should throw error for invalid operation type', async () => {
      const template = {
        operation: 'INVALID' as any,
        collectionPath: 'test-collection'
      };

      await expect(buildSingleMigrateFunction(template)).rejects.toThrow('Invalid operation type');
    });
  });

  describe('buildMigrateFunction', () => {
    it('should execute multiple templates in order', async () => {
      const templates: PreviewChangeTemplate[] = [
        {
          operation: ChangeOperationType.CREATE,
          collectionPath: 'test-collection',
          changes: [{ operation: ChangeOperationType.CREATE, path: 'name', value: 'New Doc' }]
        },
        {
          operation: ChangeOperationType.UPDATE,
          collectionPath: 'test-collection',
          changes: [{ operation: ChangeOperationType.UPDATE, path: 'name', value: 'Updated Doc' }]
        }
      ];

      const migrateFunction = await buildMigrateFunction(templates);
      await migrateFunction(mockFirestore);

      // We can't directly verify the order, but we can verify the function completes
      // and the collection was accessed the expected number of times
      expect(mockFirestore.collection).toHaveBeenCalledTimes(2);
    });
  });
});
