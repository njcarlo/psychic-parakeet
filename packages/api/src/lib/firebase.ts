import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App, AppOptions, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { BatchResponse, MulticastMessage } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import { config } from './config.js';

export type PushPayload = Omit<MulticastMessage, 'tokens'>;

export interface FirebaseStorageFile {
  getSignedUrl(options: {
    version: 'v4';
    action: 'write';
    expires: number;
    contentType: string;
  }): Promise<[string]>;
  publicUrl(): string;
}

export interface FirebaseStorageBucket {
  file(path: string): FirebaseStorageFile;
}

export function isFirebaseEnabled(): boolean {
  return Boolean(config.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

export function getFirebaseApp(): App {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  if (!isFirebaseEnabled()) {
    throw new Error('Firebase is not configured');
  }

  const appOptions: AppOptions = {
    credential: config.FIREBASE_SERVICE_ACCOUNT_JSON
      ? cert(JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount)
      : applicationDefault(),
    projectId: config.FIREBASE_PROJECT_ID,
    storageBucket: config.FIREBASE_STORAGE_BUCKET
  };

  return initializeApp(appOptions);
}

export function getStorageBucket(): FirebaseStorageBucket {
  return getStorage(getFirebaseApp()).bucket(config.FIREBASE_STORAGE_BUCKET) as FirebaseStorageBucket;
}

export async function sendPushToTokens(tokens: string[], payload: PushPayload): Promise<BatchResponse | null> {
  if (!isFirebaseEnabled()) return null;

  const uniqueTokens = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];
  if (uniqueTokens.length === 0) return null;

  return getMessaging(getFirebaseApp()).sendEachForMulticast({
    ...payload,
    tokens: uniqueTokens
  });
}
