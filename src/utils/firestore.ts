import * as admin from "firebase-admin";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getJsonFromFile } from "./file";

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
