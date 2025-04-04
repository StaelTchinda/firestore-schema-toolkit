import * as admin from "firebase-admin";
import { getFirestore, Firestore, DocumentData, DocumentReference } from "firebase-admin/firestore";
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

export async function getCollectionDocuments(firestore: Firestore, collectionName: string): Promise<DocumentData[]> {
  const snapshot = await firestore.collection(collectionName).get();
  const collectionData: DocumentData[] = [];
  snapshot.forEach((doc) => {
    collectionData.push(doc.data());
  });
  return collectionData;
}


export function parseNestedDocumentReferenceToSimpleObject(documentData: DocumentData): DocumentData {
  const parsedData = { ...documentData };
  for (const key in parsedData) {
    if (isDocumentReference(parsedData[key])) {
      parsedData[key] = parseDocumentReferenceToSimpleObject(parsedData[key]);
    } 
    // Check if the value is an array
    else if (Array.isArray(parsedData[key])) {
      parsedData[key] = parsedData[key].map((item: unknown) => {
        if (isDocumentReference(item)) {
          return parseDocumentReferenceToSimpleObject(item as DocumentReference);
        }
        return parseNestedDocumentReferenceToSimpleObject(item as DocumentData);
      });
    }
    // Check if the value is an object
    else if (typeof parsedData[key] === 'object' && parsedData[key] !== null) {
      parsedData[key] = parseNestedDocumentReferenceToSimpleObject(parsedData[key]);
    }
  }
  return parsedData;
}

export function parseDocumentReferenceToSimpleObject(documentReference: DocumentReference): {id: string, path: string} {
  return {
    id: documentReference.id,
    path: documentReference.path,
  };
}

export function isDocumentReference(variable: unknown): boolean {
  return variable instanceof DocumentReference;
}

export async function getAllCollectionNames(firestore: Firestore): Promise<string[]> {
  const collections = await firestore.listCollections();
  return collections.map(collection => collection.id);
}
