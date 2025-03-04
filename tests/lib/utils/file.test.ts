import fs, { PathOrFileDescriptor } from "fs";
import { getJsonFromFile, isPathFolder, isPathFile } from "../../../src/lib/utils/file";
import { Abortable } from "events";

// Mock fs module
jest.mock("fs");
const mockedFs = fs as jest.Mocked<typeof fs>;

type FsReadFileSpy = (
  path: PathOrFileDescriptor,
  options:
    | ({
        encoding: BufferEncoding;
        flag?: string | undefined;
      } & Abortable)
    | BufferEncoding,
  callback: (err: NodeJS.ErrnoException | null, data: string) => void
) => void;

function mockFsReadFile(data: string, error: NodeJS.ErrnoException | null = null): void {
  (jest.spyOn(fs, "readFile") as unknown as jest.MockedFunction<FsReadFileSpy>).mockImplementationOnce((_path, _options, callback) => {
    callback(error, data);
  });
}

describe("File Utils", () => {
  describe("getJsonFromFile", () => {
    it("should return parsed JSON when file exists", async () => {
      // Mock data
      const mockData = JSON.stringify({ test: "data" });

      // Setup the mock
      mockFsReadFile(mockData);

      // Execute and assert
      const result = await getJsonFromFile<{ test: string }>("test.json");
      expect(result).toEqual({ test: "data" });
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        "test.json",
        "utf8",
        expect.any(Function)
      );
    });

    it("should reject with error when file read fails", async () => {
      // Setup the mock
      const mockError = new Error("File not found");
      mockFsReadFile("", mockError);

      // Execute and assert
      await expect(getJsonFromFile("nonexistent.json")).rejects.toEqual(
        mockError
      );
    });
  });

  describe("isPathFolder", () => {
    it("should return true when path is a directory", () => {
      // Setup mock
      mockedFs.lstatSync.mockReturnValueOnce({
        isDirectory: () => true,
        isFile: () => false,
      } as unknown as fs.Stats);

      // Execute and assert
      expect(isPathFolder("/path/to/dir")).toBe(true);
      expect(mockedFs.lstatSync).toHaveBeenCalledWith("/path/to/dir");
    });

    it("should return false when path is not a directory", () => {
      // Setup mock
      mockedFs.lstatSync.mockReturnValueOnce({
        isDirectory: () => false,
        isFile: () => true,
      } as unknown as fs.Stats);

      // Execute and assert
      expect(isPathFolder("/path/to/file.txt")).toBe(false);
    });
  });

  describe("isPathFile", () => {
    it("should return true when path is a file", () => {
      // Setup mock
      mockedFs.lstatSync.mockReturnValueOnce({
        isDirectory: () => false,
        isFile: () => true,
      } as unknown as fs.Stats);

      // Execute and assert
      expect(isPathFile("/path/to/file.txt")).toBe(true);
      expect(mockedFs.lstatSync).toHaveBeenCalledWith("/path/to/file.txt");
    });

    it("should return false when path is not a file", () => {
      // Setup mock
      mockedFs.lstatSync.mockReturnValueOnce({
        isDirectory: () => true,
        isFile: () => false,
      } as unknown as fs.Stats);

      // Execute and assert
      expect(isPathFile("/path/to/dir")).toBe(false);
    });
  });
});
