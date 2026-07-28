import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const cfg={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID};
export const firebaseReady=Object.values(cfg).every(Boolean);
const app=firebaseReady?initializeApp(cfg):null;
export const db=app?getFirestore(app):null;
export const auth=app?getAuth(app):null;
export async function ensureAnonymousUser(){if(!auth)return null;if(auth.currentUser)return auth.currentUser;return (await signInAnonymously(auth)).user;}
