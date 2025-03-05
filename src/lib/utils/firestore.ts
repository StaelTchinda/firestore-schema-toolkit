import * as admin from "firebase-admin";
import { getFirestore, Firestore, DocumentData } from "firebase-admin/firestore";
import { getJsonFromFile } from "src/lib/utils/file";

// TODO: Add the necessary attributes and move it to another file.
export interface FirebaseCredentials extends admin.ServiceAccount {
  type: string;
}

export async function getCredentialsFromFile(
  credentialsFilename: string
): Promise<FirebaseCredentials> {
  return getJsonFromFile<FirebaseCredentials>(credentialsFilename);
}

export interface InitFirestoreParams {
  credentials: FirebaseCredentials;
  databaseId?: string;
}

export async function initFirestore({
  credentials,
  databaseId,
}: InitFirestoreParams): Promise<Firestore> {
  if (credentials) {
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
  } else {
    admin.initializeApp();
  }
  if (databaseId) {
    return getFirestore(admin.app(), databaseId);
  } else {
    return admin.firestore();
  }
}

export async function getCollectionDocuments(firestore: FirebaseFirestore.Firestore, collectionName: string): Promise<DocumentData[]> {
  const snapshot = await firestore.collection(collectionName).get();
  const collectionData: DocumentData[] = [];
  snapshot.forEach((doc) => {
    collectionData.push(doc.data());
  });
  return collectionData;
}

export async function saveCollectionDocuments(firestore: FirebaseFirestore.Firestore, collectionName: string, documents: DocumentData[]): Promise<void> {
  const batchSize = 500; // Firestore has a limit of 500 operations per transaction
  const chunks = [];
  
  // Split documents into chunks of 500
  for (let i = 0; i < documents.length; i += batchSize) {
    chunks.push(documents.slice(i, i + batchSize));
  }
  
  // Process each chunk with a transaction
  for (const chunk of chunks) {
    await firestore.runTransaction(async (transaction) => {
      for (const document of chunk) {
        const docRef = firestore.collection(collectionName).doc();
        transaction.set(docRef, document);
      }
    });
  }
}
