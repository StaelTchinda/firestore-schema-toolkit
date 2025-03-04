import { Command } from 'commander';
import fs from 'fs';
import colors from 'colors';
import { parseParams, validateParams, validateCommandOptions } from 'src/bin/firestore-schema/validate/params';
import { FirestoreSchemaValidateParams } from 'src/bin/firestore-schema/validate/types';
import { setupProgram } from 'src/lib/utils/bin/program';
import * as fileUtils from 'src/lib/utils/file';

describe('Validate Command Parameters', () => {
  let program: Command;

  beforeEach(() => {
    program = setupProgram({ options: validateCommandOptions, parse: false });
    jest.restoreAllMocks();
  });

  describe('parseParams', () => {
    test('parses account credentials path', () => {
      program.parse(['node', 'script.js', '--accountCredentials', '/path/to/credentials.json']);
      const params = parseParams(program);
      expect(params.accountCredentialsPath).toBe('/path/to/credentials.json');
    });

    test('parses collection names as an array', () => {
      program.parse(['node', 'script.js', '--collections', 'users,posts,comments']);
      const params = parseParams(program);
      expect(params.collectionNames).toEqual(['users', 'posts', 'comments']);
    });

    test('parses output path', () => {
      program.parse(['node', 'script.js', '--output', '/output/folder']);
      const params = parseParams(program);
      expect(params.outputPath).toBe('/output/folder');
    });

    test('parses schema path', () => {
      program.parse(['node', 'script.js', '--schema', '/schema/path']);
      const params = parseParams(program);
      expect(params.schemaPath).toBe('/schema/path');
    });

    test('parses verbose flag', () => {
      program.parse(['node', 'script.js', '--verbose']);
      const params = parseParams(program);
      expect(params.verbose).toBe(true);
    });

    test('parses summarize flag', () => {
      program.parse(['node', 'script.js', '--summarized']);
      const params = parseParams(program);
      expect(params.summarize).toBe(true);
    });

    test('returns empty for options not specified without default values', () => {
      program.parse(['node', 'script.js']);
      const params = parseParams(program);
      expect(params.collectionNames).toEqual([]);
      expect(params.outputPath).toBeUndefined();
      expect(params.schemaPath).toBeUndefined();
    });

    test('returns default values for options with default values', () => {
      program.parse(['node', 'script.js']);
      const params = parseParams(program);
      expect(params.accountCredentialsPath).toBe('firebase-export.json');
      expect(params.verbose).toBe(false);
      expect(params.summarize).toBe(false);
    });
  });

  describe('validateParams', () => {
    beforeEach(() => {
      jest.spyOn(fs, 'existsSync').mockImplementation((path: unknown) => {
        return path === '/path/to/credentials.json';
      });
      jest.spyOn(fileUtils, 'isPathFolder').mockImplementation((path: string) => {
        return path === '/output/folder' || path === '/schema/folder';
      });
    });

    test('accepts valid parameters', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: ['users'],
        schemaPath: '/schema/path',
        outputPath: '/output/path',
        verbose: true,
        summarize: false
      };
      expect(() => validateParams(params)).not.toThrow();
    });

    test('throws error when accountCredentialsPath is missing', () => {
      const params = {
        collectionNames: ['users'],
        schemaPath: '/schema/path',
        outputPath: '/output/path'
      };
      expect(() => validateParams(params as FirestoreSchemaValidateParams)).toThrow(colors.bold(colors.red('Missing: ')) + colors.bold('accountCredentials'));
    });

    test('throws error when collectionNames is missing', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        schemaPath: '/schema/path',
        outputPath: '/output/path'
      };
      expect(() => validateParams(params as FirestoreSchemaValidateParams)).toThrow(colors.bold(colors.red('Missing: ')) + colors.bold('collections'));
    });

    test('throws error when collectionNames is empty', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: [],
        schemaPath: '/schema/path',
        outputPath: '/output/path'
      };
      expect(() => validateParams(params as FirestoreSchemaValidateParams)).toThrow(colors.bold(colors.red('Missing: ')) + colors.bold('collections'));
    });

    test('throws error when schemaPath is missing', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: ['users'],
        outputPath: '/output/path'
      };
      expect(() => validateParams(params as FirestoreSchemaValidateParams)).toThrow(colors.bold(colors.red('Missing: ')) + colors.bold('output'));
    });

    test('throws error when schema path is not a folder with multiple collections', () => {
      jest.spyOn(fileUtils, 'isPathFolder').mockImplementation((path: string) => {
        return path === '/output/folder';
      });
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: ['users', 'posts'],
        schemaPath: '/schema/path',
        outputPath: '/output/folder'
      };
      expect(() => validateParams(params)).toThrow('Schema path must be a folder when validating multiple collections');
    });

    test('throws error when output path is not a folder with multiple collections', () => {
      jest.spyOn(fileUtils, 'isPathFolder').mockImplementation((path: string) => {
        return path === '/schema/folder';
      });
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: ['users', 'posts'],
        schemaPath: '/schema/folder',
        outputPath: '/output/path'
      };
      expect(() => validateParams(params)).toThrow('Output path must be a folder when validating multiple collections');
    });

    test('does not throw when output path is not provided', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: ['users'],
        schemaPath: '/schema/path',
      };
      expect(() => validateParams(params as FirestoreSchemaValidateParams)).not.toThrow();
    });
    
    test('does not throw when verbose and summarize are missing', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: ['users'],
        schemaPath: '/schema/path',
        outputPath: '/output/path'
      };
      expect(() => validateParams(params as FirestoreSchemaValidateParams)).not.toThrow();
    });
  });

  describe('validateCommandOptions', () => {
    test('help output includes account credentials option', () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain('-a --accountCredentials <path>');
      expect(helpOutput).toContain('path to Google Cloud account credentials');
    });

    test('help output includes collections option', () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain('-c --collections <collection1,collection2,...>');
      expect(helpOutput).toContain('comma separated list of collection names');
    });

    test('help output includes output option', () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain('-o --output <path>');
      expect(helpOutput).toContain('output path');
    });

    test('help output includes schema option', () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain('-s --schema <path>');
      expect(helpOutput).toContain('path to the JSON schema file');
    });

    test('help output includes verbose option', () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain('-v --verbose');
      expect(helpOutput).toContain('verbose output');
    });

    test('help output includes summarize option', () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain('-z --summarized');
      expect(helpOutput).toContain('summarize the validation results');
    });
  });
});
