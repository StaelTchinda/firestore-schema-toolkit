import { Command } from 'commander';
import fs from 'fs';
import colors from 'colors';
import { parseParams, validateParams, exportCommandOptions } from 'src/bin/firestore-schema/export/params';
import { FirestoreSchemaExportParams } from 'src/bin/firestore-schema/export/types';
import { setupProgram } from 'src/lib/utils/bin/program';

describe('Export Command Parameters', () => {
  let program: Command;

  beforeEach(() => {
    program = setupProgram({ options: exportCommandOptions, parse: false });
  });

  describe('parseParams', () => {
    test('parses account credentials path', () => {
      program.parse(['node', 'script.js', '--accountCredentials', '/path/to/credentials.json']);
      const params = parseParams(program);
      expect(params.accountCredentialsPath).toBe('/path/to/credentials.json');
    });

    test('parses account credentials path from environment variable', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';
      program.parse(['node', 'script.js']);
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

    test('parses verbose flag', () => {
      program.parse(['node', 'script.js', '--verbose']);
      const params = parseParams(program);
      expect(params.verbose).toBe(true);
    });

    test('returns empty for options not specified without default values', () => {
      program.parse(['node', 'script.js']);
      const params = parseParams(program);
      expect(params.collectionNames).toEqual([]);
      expect(params.outputPath).toBeUndefined();
    });

    test('returns default values for options with default values', () => {
      program.parse(['node', 'script.js']);
      const params = parseParams(program);
      expect(params.accountCredentialsPath).toBe('firebase-export.json');
      expect(params.verbose).toBe(false); // Default value
    });
  });

  describe('validateParams', () => {

    jest.spyOn(fs, 'existsSync').mockImplementation((path: unknown) => {
      return path === '/path/to/credentials.json';
    });
    test('accepts valid parameters', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: ['users'],
        outputPath: '/output/path',
        verbose: true
      };
      expect(() => validateParams(params)).not.toThrow();
    });

    test('throws error when accountCredentialsPath is missing', () => {
      const params = {
        collectionNames: ['users'],
        outputPath: '/output/path'
      };
      expect(() => validateParams(params as FirestoreSchemaExportParams)).toThrow(colors.bold(colors.red('Missing: ')) + colors.bold('accountCredentials'));
    });

    test('throws error when collectionNames is missing', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        outputPath: '/output/path'
      };
      expect(() => validateParams(params as FirestoreSchemaExportParams)).toThrow(colors.bold(colors.red('Missing: ')) + colors.bold('collections'));
    });

    test('throws error when outputPath is missing', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: ['users']
      };
      expect(() => validateParams(params as FirestoreSchemaExportParams)).toThrow(colors.bold(colors.red('Missing: ')) + colors.bold('output'));
    });

    test('throws error when collectionNames is empty', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: [],
        outputPath: '/output/path'
      };
      expect(() => validateParams(params as FirestoreSchemaExportParams)).toThrow('collections must have at least one element');
    });

    test('does not throw when verbose is missing', () => {
      const params = {
        accountCredentialsPath: '/path/to/credentials.json',
        collectionNames: ['users'],
        outputPath: '/output/path'
      };
      expect(() => validateParams(params)).not.toThrow();
    });
  });

  describe('exportCommandOptions', () => {
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

    test('help output includes verbose option', () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain('-v --verbose');
      expect(helpOutput).toContain('enable verbose');
    });
  });
});
