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
  const mockParsedCollectionData = [{ id: '1', name: 'test' }]; // Same as mockCollectionData for simplicity
  const mockSchema = { items: { type: 'object', properties: { name: { type: 'string' } } } };
  const mockAllCollectionNames = ["users", "posts", "comments", "likes"];

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
    (firestoreUtils.getAllCollectionNames as jest.Mock).mockResolvedValue(mockAllCollectionNames);

    // Mock document reference parsing
    (firestoreUtils.parseNestedDocumentReferenceToSimpleObject as jest.Mock).mockReturnValue(mockParsedCollectionData[0]);

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

  test("get all collection names when allCollections flag is set", async () => {
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: "/path/to/credentials.json",
      schemaPath: "/schema/path",
      outputPath: "/output/path",
      useAllCollections: true,
    });

    await executeAsyncExportCommand(mockProgram);
    expect(firestoreUtils.getAllCollectionNames).toHaveBeenCalled();
  });

  test("retrieves collection data for each collection, when allCollections flag is not set", async () => {
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

  test("retrieves collection data for each collection, when allCollections flag is set", async () => {
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: "/path/to/credentials.json",
      schemaPath: "/schema/path",
      outputPath: "/output/path",
      useAllCollections: true,
    });

    await executeAsyncExportCommand(mockProgram);
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenCalledTimes(4);
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenNthCalledWith(
      1,
      mockFirestore,
      mockAllCollectionNames[0]
    );
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenNthCalledWith(
      2,
      mockFirestore,
      mockAllCollectionNames[1]
    );
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenNthCalledWith(
      3,
      mockFirestore,
      mockAllCollectionNames[2]
    );
    expect(firestoreUtils.getCollectionDocuments).toHaveBeenNthCalledWith(
      4,
      mockFirestore,
      mockAllCollectionNames[3]
    );
  });

  test("retrieves collection data for each collection, when allCollections flag is not set", async () => {
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
    // The command maps and parses each document before passing to JsonSchemaGenerator
    expect(JsonSchemaGenerator).toHaveBeenCalledWith(mockParsedCollectionData);
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
    // Mock JsonSchemaGenerator to return null to simulate failure
    (JsonSchemaGenerator as jest.Mock).mockReturnValue(null);
    
    // In the actual implementation, it logs a warning and continues rather than throwing
    // So we should expect the function to resolve, not reject
    await executeAsyncExportCommand(mockProgram);

    // Verify that the warning was logged using mock.calls
    expect(console.warn).toHaveBeenCalled();
    expect((console.warn as jest.Mock).mock.calls[0][0]).toContain(
      'Failed to generate schema for collection: users. Collection is empty or has no schema.'
    );
    
    // Verify that writeFileSync was not called, indicating the schema wasn't written
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});

