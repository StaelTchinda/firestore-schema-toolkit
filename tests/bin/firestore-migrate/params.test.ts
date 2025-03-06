import { Command } from "commander";
import fs from "fs";
import path from "path";
import colors from "colors";
import {
  parseParams,
  validateParams,
  migrateCommandOptions,
} from "src/bin/firestore-migrate/params";
import { FirestoreMigrateParams } from "src/bin/firestore-migrate/types";
import { setupProgram } from "src/lib/utils/bin/program";

describe("Migrate Command Parameters", () => {
  let program: Command;

  beforeEach(() => {
    program = setupProgram({ options: migrateCommandOptions, parse: false });
  });

  describe("parseParams", () => {
    test("parses account credentials path", () => {
      program.parse([
        "node",
        "script.js",
        "--accountCredentials",
        "/path/to/credentials.json",
      ]);
      const params = parseParams(program);
      expect(params.accountCredentialsPath).toBe("/path/to/credentials.json");
    });

    test("parses account credentials path from environment variable", () => {
      const originalEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      try {
        process.env.GOOGLE_APPLICATION_CREDENTIALS =
          "/path/to/credentials.json";
        program.parse(["node", "script.js"]);
        const params = parseParams(program);
        expect(params.accountCredentialsPath).toBe("/path/to/credentials.json");
      } finally {
        // Clean up environment variable
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (originalEnv !== undefined) {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = originalEnv;
        }
      }
    });

    test("parses script path", () => {
      program.parse(["node", "script.js", "--script", "/path/to/migration.js"]);
      const params = parseParams(program);
      expect(params.scriptPath).toBe("/path/to/migration.js");
    });

    test("parses input database ID", () => {
      program.parse(["node", "script.js", "--input", "input-database"]);
      const params = parseParams(program);
      expect(params.inputDatabaseId).toBe("input-database");
    });

    test("parses output database ID", () => {
      program.parse(["node", "script.js", "--output", "output-database"]);
      const params = parseParams(program);
      expect(params.outputDatabaseId).toBe("output-database");
    });

    test("parses verbose flag", () => {
      program.parse(["node", "script.js", "--verbose"]);
      const params = parseParams(program);
      expect(params.verbose).toBe(true);
    });

    test("returns default values for options with default values", () => {
      program.parse(["node", "script.js"]);
      const params = parseParams(program);
      expect(params.accountCredentialsPath).toBe("firebase-export.json");
      expect(params.inputDatabaseId).toBe("(default)");
      expect(params.outputDatabaseId).toBe("(default)");
      expect(params.verbose).toBe(false);
    });

    test("returns undefined for options not specified without default values", () => {
      program.parse(["node", "script.js"]);
      const params = parseParams(program);
      expect(params.scriptPath).toBeUndefined();
    });
  });

  describe("validateParams", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();

      jest.spyOn(fs, "existsSync").mockImplementation((filePath: unknown) => {
        return (
          filePath === "/path/to/credentials.json" ||
          filePath === "/path/to/valid-script.js" ||
          filePath === "/path/to/valid-changes-script.js" ||
          filePath === "/path/to/invalid-script.js"
        );
      });


      jest.spyOn(fs, "lstatSync").mockImplementation((filePath: fs.PathLike) => {
        if (
          filePath === "/path/to/credentials.json" ||
          filePath === "/path/to/valid-script.js" ||
          filePath === "/path/to/valid-changes-script.js" ||
          filePath === "/path/to/invalid-script.js"
        ) {
          return {
            isFile: () => true,
            isFolder: () => false,
          } as unknown as fs.Stats;
        } else {
          throw new Error(`ENOENT: no such file or directory, lstat '${filePath}'`);
        }
      });
      

      // Mock the import of script module
      jest.mock(
        "/path/to/valid-script.js",
        () => ({
          preview: jest.fn(),
          migrate: jest.fn(),
        }),
        { virtual: true }
      );

      jest.mock(
        "/path/to/valid-changes-script.js",
        () => ({
          changes: { collection: {} },
        }),
        { virtual: true }
      );

      jest.mock(
        "/path/to/invalid-script.js",
        () => ({
          someOtherFunction: jest.fn(),
        }),
        { virtual: true }
      );

      // Mock path.resolve to return the input path
      jest.spyOn(path, "resolve").mockImplementation((_cwd, p) => p);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.resetModules();
    });

    test("accepts valid parameters with preview/migrate functions", async () => {
      const params = {
        accountCredentialsPath: "/path/to/credentials.json",
        scriptPath: "/path/to/valid-script.js",
        inputDatabaseId: "input-db",
        outputDatabaseId: "output-db",
        verbose: true,
      };
      await expect(validateParams(params)).resolves.not.toThrow();
    });

    test("accepts valid parameters with changes object", async () => {
      const params = {
        accountCredentialsPath: "/path/to/credentials.json",
        scriptPath: "/path/to/valid-changes-script.js",
        inputDatabaseId: "input-db",
        outputDatabaseId: "output-db",
        verbose: true,
      };
      await expect(validateParams(params)).resolves.not.toThrow();
    });

    test("throws error when accountCredentialsPath is missing", async () => {
      const params = {
        scriptPath: "/path/to/valid-script.js",
        inputDatabaseId: "input-db",
        outputDatabaseId: "output-db",
      };
      await expect(
        validateParams(params as FirestoreMigrateParams)
      ).rejects.toThrow(
        colors.bold(colors.red("Missing: ")) + colors.bold("accountCredentials")
      );
    });

    test("throws error when accountCredentialsPath file does not exist", async () => {
      const params = {
        accountCredentialsPath: "/path/to/nonexistent.json",
        scriptPath: "/path/to/valid-script.js",
        inputDatabaseId: "input-db",
        outputDatabaseId: "output-db",
      };
      await expect(
        validateParams(params as FirestoreMigrateParams)
      ).rejects.toThrow(
        colors.bold(colors.red("Account credentials file does not exist: "))
      );
    });

    test("throws error when scriptPath is missing", async () => {
      const params = {
        accountCredentialsPath: "/path/to/credentials.json",
        inputDatabaseId: "input-db",
        outputDatabaseId: "output-db",
      };
      await expect(
        validateParams(params as FirestoreMigrateParams)
      ).rejects.toThrow(
        colors.bold(colors.red("Missing: ")) + colors.bold("script")
      );
    });

    test("throws error when script file does not exist", async () => {
      const params = {
        accountCredentialsPath: "/path/to/credentials.json",
        scriptPath: "/path/to/nonexistent.js",
        inputDatabaseId: "input-db",
        outputDatabaseId: "output-db",
      };
      await expect(
        validateParams(params as FirestoreMigrateParams)
      ).rejects.toThrow(
        colors.bold(colors.red("Script file does not exist: "))
      );
    });

    test("throws error when script does not export required functions/objects", async () => {
      const params = {
        accountCredentialsPath: "/path/to/credentials.json",
        scriptPath: "/path/to/invalid-script.js",
        inputDatabaseId: "input-db",
        outputDatabaseId: "output-db",
      };
      await expect(
        validateParams(params as FirestoreMigrateParams)
      ).rejects.toThrow(
        colors.bold(colors.red("Invalid: ")) +
          colors.bold("/path/to/invalid-script.js") +
          " - " +
          "Migration script must export either changes or both 'preview' and 'migrate' functions"
      );
    });

    test("throws error when inputDatabaseId is missing", async () => {
      const params = {
        accountCredentialsPath: "/path/to/credentials.json",
        scriptPath: "/path/to/valid-script.js",
        outputDatabaseId: "output-db",
      } as FirestoreMigrateParams;
      params.inputDatabaseId = undefined as unknown as string;
      await expect(validateParams(params)).rejects.toThrow(
        colors.bold(colors.red("Missing: ")) + colors.bold("input")
      );
    });

    test("throws error when outputDatabaseId is missing", async () => {
      const params = {
        accountCredentialsPath: "/path/to/credentials.json",
        scriptPath: "/path/to/valid-script.js",
        inputDatabaseId: "input-db",
      } as FirestoreMigrateParams;
      params.outputDatabaseId = undefined as unknown as string;
      await expect(validateParams(params)).rejects.toThrow(
        colors.bold(colors.red("Missing: ")) + colors.bold("output")
      );
    });

    test("does not throw when verbose is missing", async () => {
      const params = {
        accountCredentialsPath: "/path/to/credentials.json",
        scriptPath: "/path/to/valid-script.js",
        inputDatabaseId: "input-db",
        outputDatabaseId: "output-db",
      };
      await expect(validateParams(params)).resolves.not.toThrow();
    });
  });

  describe("migrateCommandOptions", () => {
    test("help output includes account credentials option", () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain("-a --accountCredentials <path>");
      expect(helpOutput).toContain("path to Google Cloud account credentials");
    });

    test("help output includes script option", () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain("-x --script <path>");
      expect(helpOutput).toContain("path to the migration script file");
    });

    test("help output includes input database option", () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain("-i --input <id>");
      expect(helpOutput).toContain("ID of the database to migrate data from");
    });

    test("help output includes output database option", () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain("-o --output <id>");
      expect(helpOutput).toContain("ID of the database to migrate data to");
    });

    test("help output includes verbose option", () => {
      const helpOutput = program.helpInformation();
      expect(helpOutput).toContain("-v --verbose");
      expect(helpOutput).toContain("verbose output");
    });
  });
});
