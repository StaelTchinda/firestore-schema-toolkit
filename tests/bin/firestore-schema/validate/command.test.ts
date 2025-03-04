import { Command } from 'commander';
import fs from 'fs';
import * as firestoreUtils from 'src/lib/utils/firestore';
import * as fileUtils from 'src/lib/utils/file';
import { executeAsyncValidateCommand } from 'src/bin/firestore-schema/validate/command';
import { parseParams, validateParams } from 'src/bin/firestore-schema/validate/params';
import { Ajv, ErrorObject, ValidateFunction } from 'ajv';
import { mergeValidationErrors, mapItemSchemaToCollectionSchema } from 'src/lib/schema/validate';

// Mock dependencies
jest.mock('fs');
jest.mock('src/lib/utils/firestore');
jest.mock('src/lib/utils/file');
jest.mock('ajv');
jest.mock('src/bin/firestore-schema/validate/params', () => {
  const originalModule = jest.requireActual('src/bin/firestore-schema/validate/params');
  return {
    ...originalModule,
    validateParams: jest.fn(),
    parseParams: jest.fn(),
  };
});

describe('Validate Command', () => {
  let mockProgram: Command;
  const mockCredentials = { projectId: 'test-project' };
  const mockFirestore = { collection: jest.fn() };
  const mockCollectionData = [{ id: '1', name: 'test' }];
  const mockSchema = { type: 'object', properties: { name: { type: 'string' } } };
  const mockCompile = jest.fn();
  const mockAjvInstance = { compile: mockCompile };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProgram = new Command();
    
    // Mock parameter parsing
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      collectionNames: ['users'],
      schemaPath: '/schema/path',
      outputPath: '/output/path',
      verbose: true,
      summarize: false
    });

    // Mock firestore utilities
    (firestoreUtils.getCredentialsFromFile as jest.Mock).mockResolvedValue(mockCredentials);
    (firestoreUtils.initFirestore as jest.Mock).mockResolvedValue(mockFirestore);
    (firestoreUtils.getCollectionDocuments as jest.Mock).mockResolvedValue(mockCollectionData);

    // Mock file operations
    (fileUtils.isPathFolder as jest.Mock).mockImplementation((path) => {
      if (path === '/schema/path' || path === '/output/path') return true;
      return false;
    });
    (fileUtils.getJsonFromFile as jest.Mock).mockResolvedValue(mockSchema);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.writeFileSync as jest.Mock).mockImplementation(jest.fn());

    // Mock Ajv
    (Ajv as unknown as jest.Mock).mockReturnValue(mockAjvInstance);
    mockCompile.mockReturnValue(() => true);
  });

  test('validates parameters', async () => {
    await executeAsyncValidateCommand(mockProgram);
    expect(validateParams).toHaveBeenCalled();
  });

  test('fetches credentials from specified path', async () => {
    await executeAsyncValidateCommand(mockProgram);
    expect(firestoreUtils.getCredentialsFromFile).toHaveBeenCalledWith('/path/to/credentials.json');
  });

  test('initializes Firestore with correct credentials', async () => {
    await executeAsyncValidateCommand(mockProgram);
    expect(firestoreUtils.initFirestore).toHaveBeenCalledWith({
      credentials: mockCredentials,
    });
  });

  test('retrieves collection data for each collection', async () => {
    const params = {
      accountCredentialsPath: '/path/to/credentials.json',
      collectionNames: ['users', 'posts'],
      schemaPath: '/schema/path',
      outputPath: '/output/path',
      verbose: true,
      summarize: false
    };
    (parseParams as jest.Mock).mockReturnValue(params);

    await executeAsyncValidateCommand(mockProgram);
    
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenNthCalledWith(1, mockFirestore, 'users');
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenNthCalledWith(2, mockFirestore, 'posts');
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenCalledTimes(2);
  });

  test('loads schema file with correct path when schemaPath is a folder', async () => {
    (fileUtils.isPathFolder as jest.Mock).mockImplementation((path) => {
      if (path === '/schema/path') return true;
      return false;
    });

    await executeAsyncValidateCommand(mockProgram);
    expect(fileUtils.getJsonFromFile).toHaveBeenCalledWith('/schema/path/users.json');
  });

  test('loads schema file with correct path when schemaPath is a file', async () => {
    (fileUtils.isPathFolder as jest.Mock).mockImplementation((path) => {
      if (path === '/schema/path') return false;
      return false;
    });

    await executeAsyncValidateCommand(mockProgram);
    expect(fileUtils.getJsonFromFile).toHaveBeenCalledWith('/schema/path');
  });

  test('validates collection data against schema', async () => {
    mockCompile.mockReturnValue(() => true);
    const validateFn = jest.fn().mockReturnValue(true);
    mockCompile.mockReturnValue(validateFn);

    await executeAsyncValidateCommand(mockProgram);

    expect(mockCompile).toHaveBeenCalled();
    expect(validateFn).toHaveBeenCalledWith(mockCollectionData);
  });

  
  test('writes validation errors to file when validation fails', async () => {
    const mockErrors: ErrorObject[] = [{ instancePath: '/0/name', keyword: 'type', message: 'must be string', schemaPath: '#/properties/name/type', params: { type: 'string' } }];
    const validateFn = jest.fn().mockReturnValue(false) as jest.Mock<ValidateFunction> & ValidateFunction;
    validateFn.errors = mockErrors;
    mockCompile.mockReturnValue(validateFn);
    
    await executeAsyncValidateCommand(mockProgram);
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/output/path/users.json',
      JSON.stringify(mockErrors, null, 2)
    );
  });
  

  
  test('writes summarized validation errors when summarize flag is true', async () => {
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      collectionNames: ['users'],
      schemaPath: '/schema/path',
      outputPath: '/output/path',
      verbose: true,
      summarize: true
    });

    const mockErrors: ErrorObject[] = [
      { instancePath: '/0/name', keyword: 'type', message: 'must be string', schemaPath: '#/properties/name/type', params: { type: 'string' } },
      { instancePath: '/1/name', keyword: 'type', message: 'must be string', schemaPath: '#/properties/name/type', params: { type: 'string' } }
    ];
    const validateFn = jest.fn().mockReturnValue(false) as jest.Mock<ValidateFunction> & ValidateFunction;
    validateFn.errors = mockErrors;
    mockCompile.mockReturnValue(validateFn);
    
    await executeAsyncValidateCommand(mockProgram);
    
    // Expect merged errors in output
    const expectedMergedErrors = [{
      instancePath: '/0/name,/1/name',
      keyword: 'type',
      message: 'must be string',
      schemaPath: '#/properties/name/type',
      params: { type: 'string' },
      instancePaths: ['/0/name', '/1/name']
    }];
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/output/path/users.json',
      JSON.stringify(expectedMergedErrors, null, 2)
    );
  });
  

  test('throws error when schema file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    await expect(executeAsyncValidateCommand(mockProgram)).rejects.toThrow(
      'Schema file does not exist: /schema/path/users.json'
    );
  });

  test('throws error when schema cannot be read', async () => {
    (fileUtils.getJsonFromFile as jest.Mock).mockResolvedValue(null);
    
    await expect(executeAsyncValidateCommand(mockProgram)).rejects.toThrow(
      'Failed to read schema file: /schema/path/users.json'
    );
  });

  describe('mergeValidationErrors', () => {
    test('merges errors with same message, params, keyword and schemaPath', () => {
      const errors = [
        { instancePath: '/0/name', keyword: 'type', message: 'must be string', schemaPath: '#/props', params: { type: 'string' } },
        { instancePath: '/1/name', keyword: 'type', message: 'must be string', schemaPath: '#/props', params: { type: 'string' } },
        { instancePath: '/0/age', keyword: 'minimum', message: 'must be >= 18', schemaPath: '#/props', params: { min: 18 } }
      ];
      
      const result = mergeValidationErrors(errors);
      
      expect(result).toEqual([
        { 
          instancePath: '/0/name,/1/name', 
          instancePaths: ['/0/name', '/1/name'],
          keyword: 'type', 
          message: 'must be string', 
          schemaPath: '#/props', 
          params: { type: 'string' } 
        },
        { 
          instancePath: '/0/age', 
          instancePaths: ['/0/age'],
          keyword: 'minimum', 
          message: 'must be >= 18', 
          schemaPath: '#/props', 
          params: { min: 18 } 
        }
      ]);
    });
  });

  describe('mapItemSchemaToCollectionSchema', () => {
    test('wraps item schema in array schema', () => {
      const itemSchema = { type: 'object', properties: { name: { type: 'string' } } };
      const result = mapItemSchemaToCollectionSchema(itemSchema);
      
      expect(result).toEqual({
        type: 'array',
        items: itemSchema
      });
    });
  });
});
