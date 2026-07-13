import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken as getMessagingToken,
  isSupported,
  onMessage,
  type MessagePayload
} from 'firebase/messaging';

let app: FirebaseApp | null | undefined;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (app !== undefined) return app;

  app = initializeApp(firebaseConfig);
  return app;
}

async function getMessagingRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const activeRegistration = registrations.find((registration) => registration.active);
  if (activeRegistration) return activeRegistration;

  return navigator.serviceWorker.register('/firebase-messaging-sw.js');
}

async function getSupportedMessaging() {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!(await isSupported())) return null;
  return getMessaging(firebaseApp);
}

export async function registerPushToken(apiRegister: (token: string) => Promise<void>): Promise<string | null> {
  const messaging = await getSupportedMessaging();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

  if (!messaging || !vapidKey || !('Notification' in window)) return null;

  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const token = await getMessagingToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: await getMessagingRegistration()
  });

  if (!token) return null;
  await apiRegister(token);
  return token;
}

export async function onForegroundPushMessage(
  handler: (payload: MessagePayload) => void
): Promise<(() => void) | null> {
  const messaging = await getSupportedMessaging();
  if (!messaging) return null;
  return onMessage(messaging, handler);
}
