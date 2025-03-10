import { Command } from 'commander';
import * as path from 'path';
import * as firestoreUtils from 'src/lib/utils/firestore';
import * as compileUtils from 'src/lib/utils/compile';
import { executeAsyncMigrateCommand } from 'src/bin/firestore-migrate/command';
import { parseParams, validateParams } from 'src/bin/firestore-migrate/params';
import { ChangeOperationType } from 'src/types/migrate/change-type';
import { PreviewChange } from 'src/types/migrate/change';

// Mock Enquirer for user prompts
jest.mock('enquirer', () => {
  return {
    prompt: jest.fn()
  };
});

// Mock dependencies
jest.mock('path');
jest.mock('src/lib/utils/firestore');
jest.mock('src/lib/utils/file');
jest.mock('src/lib/utils/compile');
jest.mock('src/bin/firestore-migrate/params', () => {
  const originalModule = jest.requireActual('src/bin/firestore-migrate/params');
  return {
    ...originalModule,
    validateParams: jest.fn(),
    parseParams: jest.fn(),
  };
});

// Import Enquirer after mocking
import * as Enquirer from 'enquirer';

// Create mock migration modules
const mockMigration1Path = '/path/to/migration.ts';
// const mockMigration2Path = '/path/to/migration1.ts';
// const mockMigration3Path = '/path/to/migration2.ts';

const mockMigrationFunction = jest.fn().mockResolvedValue({});
const mockMigrationPreviewFunction = jest.fn();
const mockMigrationFile = {
  description: 'Test migration',
  migrate: mockMigrationFunction,
  preview: mockMigrationPreviewFunction
};

// const mockMigrationFunction2 = jest.fn().mockResolvedValue({});
// const mockMigrationFile2 = {
//   description: 'Second migration',
//   up: mockMigrationFunction2,
//   preview: jest.fn()
// };

// Mock specific migration file paths
jest.mock('/path/to/migration.ts', () => mockMigrationFile, { virtual: true });
// jest.mock('/path/to/migration1.ts', () => mockMigrationFile, { virtual: true });
// jest.mock('/path/to/migration2.ts', () => mockMigrationFile2, { virtual: true });

describe('Migrate Command', () => {
  let mockProgram: Command;
  const mockCredentials = { projectId: 'test-project' };
  const mockFirestore = { 
    collection: jest.fn(),
    batch: jest.fn(),
  };

  // Mock preview changes
  const mockPreviewChanges: PreviewChange[] = [
    {
      operation: ChangeOperationType.UPDATE,
      documentId: 'doc1',
      collectionPath: 'users',
      before: { name: 'John', age: 25 },
      after: { name: 'John', age: 26 },
      changes: [
        {
          path: 'age',
          operation: ChangeOperationType.UPDATE,
          oldValue: 25,
          newValue: 26
        }
      ]
    }
  ];

  // Mock batch operations
  const mockBatch = {
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue([])
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProgram = new Command();
    
    // Mock parameter parsing with scriptPath and single databaseId
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      scriptPath: mockMigration1Path,
      databaseId: 'test-database',
      applyChanges: false,
      verbose: true,
      summarize: false
    });

    // Mock firestore utilities
    (firestoreUtils.getCredentialsFromFile as jest.Mock).mockResolvedValue(mockCredentials);
    (firestoreUtils.initFirestore as jest.Mock).mockResolvedValue(mockFirestore);
    (mockFirestore.batch as jest.Mock).mockReturnValue(mockBatch);
    
    // Mock migration preview function to return changes
    mockMigrationPreviewFunction.mockResolvedValue(mockPreviewChanges);

    // Mock path utilities
    (path.resolve as jest.Mock).mockImplementation((_cwd, p) => p);
    
    // Mock compile utils
    (compileUtils.registerTsCompiler as jest.Mock).mockResolvedValue(undefined);

    // Default mock for user prompt - declining to apply changes
    (Enquirer.prompt as jest.Mock).mockResolvedValue({ confirm: false });
  });

  test('validates parameters', async () => {
    await executeAsyncMigrateCommand(mockProgram);
    expect(validateParams).toHaveBeenCalled();
  });

  test('fetches credentials from specified path', async () => {
    await executeAsyncMigrateCommand(mockProgram);
    expect(firestoreUtils.getCredentialsFromFile).toHaveBeenCalledWith('/path/to/credentials.json');
  });

  test('initializes Firestore with correct credentials', async () => {
    await executeAsyncMigrateCommand(mockProgram);
    expect(firestoreUtils.initFirestore).toHaveBeenCalledWith({
      credentials: mockCredentials,
      databaseId: 'test-database',
    });
  });

  test('registers TS compiler', async () => {
    await executeAsyncMigrateCommand(mockProgram);
    expect(compileUtils.registerTsCompiler).toHaveBeenCalled();
  });

  test('always runs preview function regardless of applyChanges parameter', async () => {
    await executeAsyncMigrateCommand(mockProgram);
    expect(mockMigrationPreviewFunction).toHaveBeenCalledWith(mockFirestore);
  });

  test('does not apply migration when applyChanges is false', async () => {
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      scriptPath: mockMigration1Path,
      databaseId: 'test-database',
      applyChanges: false,
      verbose: true,
      summarize: false
    });

    await executeAsyncMigrateCommand(mockProgram);
    
    expect(mockMigrationPreviewFunction).toHaveBeenCalledWith(mockFirestore);
    expect(mockMigrationFunction).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  test('applies migration when user confirms', async () => {
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      scriptPath: mockMigration1Path,
      databaseId: 'test-database',
      verbose: true,
      summarize: false
    });
    
    // Mock user confirming the migration
    (Enquirer.prompt as jest.Mock).mockResolvedValue({ confirm: true });

    await executeAsyncMigrateCommand(mockProgram);
    
    expect(mockMigrationPreviewFunction).toHaveBeenCalledWith(mockFirestore);
    expect(mockMigrationFunction).toHaveBeenCalledWith(mockFirestore);
  });

  test('applies batch operations when applyChanges is true and user confirms', async () => {
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      scriptPath: mockMigration1Path,
      databaseId: 'test-database',
      applyChanges: true,
      verbose: true,
      summarize: false
    });

    // Mock user confirming the migration
    (Enquirer.prompt as jest.Mock).mockResolvedValue({ confirm: true });

    const mockCollection = {
      doc: jest.fn().mockReturnValue({ id: 'doc1' })
    };

    (mockFirestore.collection as jest.Mock).mockReturnValue(mockCollection);

    await executeAsyncMigrateCommand(mockProgram);
    
    expect(mockMigrationPreviewFunction).toHaveBeenCalledWith(mockFirestore);
    expect(mockFirestore.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.doc).toHaveBeenCalledWith('doc1');
    expect(mockBatch.update).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  test('only previews changes without applying when applyChanges is false', async () => {
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      scriptPath: mockMigration1Path,
      databaseId: 'test-database',
      applyChanges: false,
      verbose: true,
      summarize: false
    });

    const mockCollection = {
      doc: jest.fn().mockReturnValue({ id: 'doc1' })
    };

    (mockFirestore.collection as jest.Mock).mockReturnValue(mockCollection);

    await executeAsyncMigrateCommand(mockProgram);
    
    expect(mockMigrationPreviewFunction).toHaveBeenCalledWith(mockFirestore);
    expect(mockMigrationFunction).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  test('does not apply migration when user declines confirmation', async () => {
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      scriptPath: mockMigration1Path,
      databaseId: 'test-database',
      applyChanges: true,
      verbose: true,
      summarize: false
    });

    // Mock user declining the confirmation
    (Enquirer.prompt as jest.Mock).mockResolvedValue({ confirm: false });

    await executeAsyncMigrateCommand(mockProgram);
    
    expect(mockMigrationPreviewFunction).toHaveBeenCalledWith(mockFirestore);
    expect(mockMigrationFunction).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  test('asks for user confirmation before applying changes', async () => {
    (parseParams as jest.Mock).mockReturnValue({
      accountCredentialsPath: '/path/to/credentials.json',
      scriptPath: mockMigration1Path,
      databaseId: 'test-database',
      applyChanges: true,
      verbose: true,
      summarize: false
    });

    await executeAsyncMigrateCommand(mockProgram);
    
    // Verify that the prompt was called with the right parameters
    expect(Enquirer.prompt).toHaveBeenCalledWith({
      type: 'confirm',
      name: 'confirm',
      message: expect.stringContaining('Do you want to proceed with the migration?')
    });
  });
});
