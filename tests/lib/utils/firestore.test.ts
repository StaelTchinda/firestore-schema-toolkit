// Import mock class before any imports to avoid hoisting issues
import { MockDocumentReference } from "tests/utils/mocks";
import * as admin from "firebase-admin";
import { DocumentReference, getFirestore } from "firebase-admin/firestore";
import * as fileUtils from "src/lib/utils/file";
import {
  FirebaseCredentials,
  getCredentialsFromFile,
  initFirestore,
  getCollectionDocuments,
  parseDocumentReferenceToSimpleObject,
  parseNestedDocumentReferenceToSimpleObject,
} from "src/lib/utils/firestore";

// Mocks
jest.mock("firebase-admin", () => {
  return {
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn().mockReturnValue("mocked-credential"),
    },
    firestore: jest.fn().mockReturnValue("mocked-firestore"),
    app: jest.fn().mockReturnValue("mocked-app"),
  };
});

jest.mock("firebase-admin/firestore", () => {
  return {
    getFirestore: jest.fn().mockReturnValue("mocked-firestore-with-id"),
    DocumentReference: MockDocumentReference, // Add MockDocumentReference as DocumentReference
  };
});

jest.mock("src/lib/utils/file", () => {
  return {
    getJsonFromFile: jest.fn(),
  };
});

describe("Firestore Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCredentialsFromFile", () => {
    it("should call getJsonFromFile with the provided filename", async () => {
      const mockCredentials: FirebaseCredentials = {
        projectId: "test-project",
        clientEmail: "test@example.com",
        privateKey: "test-key",
        type: "service_account",
      };

      (fileUtils.getJsonFromFile as jest.Mock).mockResolvedValue(
        mockCredentials
      );

      const result = await getCredentialsFromFile("credentials.json");

      expect(fileUtils.getJsonFromFile).toHaveBeenCalledWith(
        "credentials.json"
      );
      expect(result).toEqual(mockCredentials);
    });
  });

  describe("initFirestore", () => {
    const mockCredentials: FirebaseCredentials = {
      projectId: "test-project",
      clientEmail: "test@example.com",
      privateKey: "test-key",
      type: "service_account",
    };

    it("should initialize Firebase with provided credentials", async () => {
      await initFirestore({ credentials: mockCredentials });

      expect(admin.credential.cert).toHaveBeenCalledWith(mockCredentials);
      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: "mocked-credential",
      });
      expect(admin.firestore).toHaveBeenCalled();
    });

    it("should initialize Firebase without credentials if not provided", async () => {
      await initFirestore({
        credentials: undefined as unknown as FirebaseCredentials,
      });

      expect(admin.credential.cert).not.toHaveBeenCalled();
      expect(admin.initializeApp).toHaveBeenCalledWith();
      expect(admin.firestore).toHaveBeenCalled();
    });

    it("should use databaseId if provided", async () => {
      const result = await initFirestore({
        credentials: mockCredentials,
        databaseId: "test-db",
      });

      expect(admin.app).toHaveBeenCalled();
      expect(getFirestore).toHaveBeenCalledWith("mocked-app", "test-db");
      expect(result).toBe("mocked-firestore-with-id");
    });
  });

  describe("getCollectionDocuments", () => {
    it("should retrieve documents from a collection", async () => {
      const mockData = [
        { id: "1", name: "Doc 1" },
        { id: "2", name: "Doc 2" },
      ];
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockData.forEach((item) => {
            callback({
              data: () => item,
            });
          });
        }),
      };

      const mockCollection = {
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };

      const mockFirestore = {
        collection: jest.fn().mockReturnValue(mockCollection),
      } as unknown as FirebaseFirestore.Firestore;

      const result = await getCollectionDocuments(
        mockFirestore,
        "test-collection"
      );

      expect(mockFirestore.collection).toHaveBeenCalledWith("test-collection");
      expect(mockCollection.get).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it("should return empty array when collection is empty", async () => {
      const mockSnapshot = {
        forEach: jest.fn(),
      };

      const mockCollection = {
        get: jest.fn().mockResolvedValue(mockSnapshot),
      };

      const mockFirestore = {
        collection: jest.fn().mockReturnValue(mockCollection),
      } as unknown as FirebaseFirestore.Firestore;

      const result = await getCollectionDocuments(
        mockFirestore,
        "empty-collection"
      );

      expect(mockFirestore.collection).toHaveBeenCalledWith("empty-collection");
      expect(mockCollection.get).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("parseDocumentReferenceToSimpleObject", () => {
    it("should convert a document reference to a simple object", () => {
      const mockDocRef = {
        id: "123",
        path: "collection/123",
        get: jest.fn().mockResolvedValue({
          data: () => ({ name: "Test Document" }),
        }),
      } as unknown as DocumentReference;

      const result = parseDocumentReferenceToSimpleObject(mockDocRef);

      expect(result).toEqual({
        id: "123",
        path: "collection/123",
      });
    });
  });

  describe("parseNestedDocumentReferenceToSimpleObject", () => {
    it("should convert nested document references to a simple object", async () => {
      const mockNestedDocData = {
        id: "456",
        postTitle: "Post Title",
        postContent: "Post Content",
        postAuthor: new MockDocumentReference("123", "users/123"),
      };

      const result = await parseNestedDocumentReferenceToSimpleObject(
        mockNestedDocData
      );

      expect(result).toEqual({
        id: "456",
        postTitle: "Post Title",
        postContent: "Post Content",
        postAuthor: {
          id: "123",
          path: "users/123",
        },
      });
    });

    it("should convert array of document references to simple objects", async () => {
      const mockDocRefsArray = {
        id: "789",
        title: "Array Test",
        authors: [
          new MockDocumentReference("123", "users/123"),
          new MockDocumentReference("456", "users/456"),
        ],
      };

      const result = await parseNestedDocumentReferenceToSimpleObject(
        mockDocRefsArray
      );

      expect(result).toEqual({
        id: "789",
        title: "Array Test",
        authors: [
          { id: "123", path: "users/123" },
          { id: "456", path: "users/456" },
        ],
      });
    });

    it("should convert deeply nested document references to simple objects", async () => {
      const mockDeepNestedData = {
        id: "101",
        title: "Deep Nested Test",
        mainCategory: {
          id: "201",
          name: "Category",
          owner: new MockDocumentReference("301", "users/301"),
          subcategories: [
            {
              id: "401",
              name: "Subcategory 1",
              moderator: new MockDocumentReference("501", "users/501"),
            },
            {
              id: "402",
              name: "Subcategory 2",
              moderator: new MockDocumentReference("502", "users/502"),
            },
          ],
        },
      };

      const result = await parseNestedDocumentReferenceToSimpleObject(
        mockDeepNestedData
      );

      expect(result).toEqual({
        id: "101",
        title: "Deep Nested Test",
        mainCategory: {
          id: "201",
          name: "Category",
          owner: { id: "301", path: "users/301" },
          subcategories: [
            {
              id: "401",
              name: "Subcategory 1",
              moderator: { id: "501", path: "users/501" },
            },
            {
              id: "402",
              name: "Subcategory 2",
              moderator: { id: "502", path: "users/502" },
            },
          ],
        },
      });
    });

    it("should handle mixed nested objects and arrays with document references", async () => {
      const mockMixedData = {
        id: "600",
        title: "Mixed Data",
        author: new MockDocumentReference("601", "users/601"),
        comments: [
          {
            id: "701",
            text: "Great post!",
            user: new MockDocumentReference("702", "users/702"),
            replies: [
              {
                id: "801",
                text: "Thanks!",
                user: new MockDocumentReference("802", "users/802"),
              },
            ],
          },
        ],
        tags: [
          new MockDocumentReference("901", "tags/901"),
          new MockDocumentReference("902", "tags/902"),
        ],
      };

      const result = await parseNestedDocumentReferenceToSimpleObject(
        mockMixedData
      );

      expect(result).toEqual({
        id: "600",
        title: "Mixed Data",
        author: { id: "601", path: "users/601" },
        comments: [
          {
            id: "701",
            text: "Great post!",
            user: { id: "702", path: "users/702" },
            replies: [
              {
                id: "801",
                text: "Thanks!",
                user: { id: "802", path: "users/802" },
              },
            ],
          },
        ],
        tags: [
          { id: "901", path: "tags/901" },
          { id: "902", path: "tags/902" },
        ],
      });
    });
  });
});
