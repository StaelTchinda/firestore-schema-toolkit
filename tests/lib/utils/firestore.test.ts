import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as fileUtils from 'src/lib/utils/file';
import {
  FirebaseCredentials,
  getCredentialsFromFile,
  initFirestore,
  getCollectionDocuments,
} from 'src/lib/utils/firestore';

// Mocks
jest.mock('firebase-admin', () => {
  return {
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn().mockReturnValue('mocked-credential'),
    },
    firestore: jest.fn().mockReturnValue('mocked-firestore'),
    app: jest.fn().mockReturnValue('mocked-app'),
  };
});

jest.mock('firebase-admin/firestore', () => {
  return {
    getFirestore: jest.fn().mockReturnValue('mocked-firestore-with-id'),
  };
});

jest.mock('src/lib/utils/file', () => {
  return {
    getJsonFromFile: jest.fn(),
  };
});

describe('Firestore Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCredentialsFromFile', () => {
    it('should call getJsonFromFile with the provided filename', async () => {
      const mockCredentials: FirebaseCredentials = {
        projectId: 'test-project',
        clientEmail: 'test@example.com',
        privateKey: 'test-key',
        type: 'service_account',
      };

      (fileUtils.getJsonFromFile as jest.Mock).mockResolvedValue(mockCredentials);

      const result = await getCredentialsFromFile('credentials.json');
      
      expect(fileUtils.getJsonFromFile).toHaveBeenCalledWith('credentials.json');
      expect(result).toEqual(mockCredentials);
    });
  });

  describe('initFirestore', () => {
    const mockCredentials: FirebaseCredentials = {
      projectId: 'test-project',
      clientEmail: 'test@example.com',
      privateKey: 'test-key',
      type: 'service_account',
    };

    it('should initialize Firebase with provided credentials', async () => {
      await initFirestore({ credentials: mockCredentials });
      
      expect(admin.credential.cert).toHaveBeenCalledWith(mockCredentials);
      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: 'mocked-credential',
      });
      expect(admin.firestore).toHaveBeenCalled();
    });

    it('should initialize Firebase without credentials if not provided', async () => {
      await initFirestore({ credentials: undefined as unknown as FirebaseCredentials });
      
      expect(admin.credential.cert).not.toHaveBeenCalled();
      expect(admin.initializeApp).toHaveBeenCalledWith();
      expect(admin.firestore).toHaveBeenCalled();
    });

    it('should use databaseId if provided', async () => {      
      const result = await initFirestore({ 
        credentials: mockCredentials, 
        databaseId: 'test-db' 
      });
      
      expect(admin.app).toHaveBeenCalled();
      expect(getFirestore).toHaveBeenCalledWith('mocked-app', 'test-db');
      expect(result).toBe('mocked-firestore-with-id');
    });
  });

  describe('getCollectionDocuments', () => {
    it('should retrieve documents from a collection', async () => {
      const mockData = [{ id: '1', name: 'Doc 1' }, { id: '2', name: 'Doc 2' }];
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          mockData.forEach(item => {
            callback({
              data: () => item
            });
          });
        })
      };
      
      const mockCollection = {
        get: jest.fn().mockResolvedValue(mockSnapshot)
      };
      
      const mockFirestore = {
        collection: jest.fn().mockReturnValue(mockCollection)
      } as unknown as FirebaseFirestore.Firestore;

      const result = await getCollectionDocuments(mockFirestore, 'test-collection');
      
      expect(mockFirestore.collection).toHaveBeenCalledWith('test-collection');
      expect(mockCollection.get).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should return empty array when collection is empty', async () => {
      const mockSnapshot = {
        forEach: jest.fn()
      };
      
      const mockCollection = {
        get: jest.fn().mockResolvedValue(mockSnapshot)
      };
      
      const mockFirestore = {
        collection: jest.fn().mockReturnValue(mockCollection)
      } as unknown as FirebaseFirestore.Firestore;

      const result = await getCollectionDocuments(mockFirestore, 'empty-collection');
      
      expect(mockFirestore.collection).toHaveBeenCalledWith('empty-collection');
      expect(mockCollection.get).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
