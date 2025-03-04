import { Command } from 'commander';
import fs from 'fs';
import * as firestoreUtils from 'src/lib/utils/firestore';
import * as fileUtils from 'src/lib/utils/file';
import { executeAsyncExportCommand } from 'src/bin/firestore-schema/export/command';
import { parseParams, validateParams } from 'src/bin/firestore-schema/export/params';
import JsonSchemaGenerator from 'json-schema-generator';

// Mock dependencies
jest.mock('fs');
jest.mock('src/lib/utils/firestore');
jest.mock('src/lib/utils/file');
jest.mock('json-schema-generator');
jest.mock('src/bin/firestore-schema/export/params', () => {
  const originalModule = jest.requireActual('src/bin/firestore-schema/export/params');
  return {
    ...originalModule,
    validateParams: jest.fn(),
    parseParams: jest.fn(),
  };
});

describe('Export Command', () => {
  let mockProgram: Command;
  const mockCredentials = { projectId: 'test-project' };
  const mockFirestore = { collection: jest.fn() };
  const mockCollectionData = [{ id: '1', name: 'test' }];
  const mockSchema = { items: { type: 'object', properties: { name: { type: 'string' } } } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProgram = new Command();
    
    // Mock parameter parsing
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      collectionNames: ['users'],
      outputPath: '/output/path',
      verbose: true
    });

    // Mock firestore utilities
    (firestoreUtils.getCredentialsFromFile as jest.Mock).mockResolvedValue(mockCredentials);
    (firestoreUtils.initFirestore as jest.Mock).mockResolvedValue(mockFirestore);
    (firestoreUtils.getCollectionDocuments as jest.Mock).mockResolvedValue(mockCollectionData);

    // Mock schema generation
    (JsonSchemaGenerator as jest.Mock).mockReturnValue(mockSchema);
    
    // Mock file operations
    (fileUtils.isPathFolder as jest.Mock).mockReturnValue(true);
    (fs.writeFileSync as jest.Mock).mockImplementation(jest.fn());
  });

  test('validates parameters', async () => {
    await executeAsyncExportCommand(mockProgram);
    expect(validateParams).toHaveBeenCalled();
  });

  test('fetches credentials from specified path', async () => {
    await executeAsyncExportCommand(mockProgram);
    expect(firestoreUtils.getCredentialsFromFile).toHaveBeenCalledWith('/path/to/credentials.json');
  });

  test('initializes Firestore with correct credentials', async () => {
    await executeAsyncExportCommand(mockProgram);
    expect(firestoreUtils.initFirestore).toHaveBeenCalledWith({
      credentials: mockCredentials,
    });
  });

  test('retrieves collection data for each collection', async () => {
    const params = {
      accountCredentialsPath: '/path/to/credentials.json',
      collectionNames: ['users', 'posts'],
      outputPath: '/output/path',
      verbose: true
    };
    (parseParams as jest.Mock).mockReturnValue(params);

    await executeAsyncExportCommand(mockProgram);
    
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenNthCalledWith(1, mockFirestore, 'users');
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenNthCalledWith(2, mockFirestore, 'posts');
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenCalledTimes(2);
  });

  test('generates schema for collection data', async () => {
    await executeAsyncExportCommand(mockProgram);
    expect(JsonSchemaGenerator).toHaveBeenCalledWith(mockCollectionData);
  });

  test('writes schema to file with collection name when output path is a folder', async () => {
    (fileUtils.isPathFolder as jest.Mock).mockReturnValue(true);
    await executeAsyncExportCommand(mockProgram);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/output/path/users.json',
      JSON.stringify(mockSchema.items, null, 2)
    );
  });

  test('writes schema to specified file when output path is not a folder', async () => {
    (fileUtils.isPathFolder as jest.Mock).mockReturnValue(false);
    await executeAsyncExportCommand(mockProgram);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/output/path',
      JSON.stringify(mockSchema.items, null, 2)
    );
  });

  test('throws error when schema generation fails', async () => {
    (JsonSchemaGenerator as jest.Mock).mockReturnValue({});
    
    await expect(executeAsyncExportCommand(mockProgram)).rejects.toThrow(
      'Failed to generate schema for collection: users. Collection is empty or has no schema.'
    );
  });
});

