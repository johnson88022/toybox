import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBqxwffituajkSAcOo-fex41iDRmuWz7so",
  authDomain: "auth-9054b.firebaseapp.com",
  projectId: "auth-9054b",
  storageBucket: "auth-9054b.firebasestorage.app",
  messagingSenderId: "524197358100",
  appId: "1:524197358100:web:654d849bc5eaeba6271501",
  measurementId: "G-M4MS5E36D1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Providers
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// Helper to check if config is valid (not placeholder)
const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

export { auth, googleProvider, appleProvider, isFirebaseConfigured, db };