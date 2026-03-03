// ─────────────────────────────────────────────────────────────
// 🔥 FIREBASE CONFIG — Paste YOUR Firebase credentials here
// Follow the setup guide in README.md to get these values
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyB8FPui1wV_kE7nv8HYYMHIQz7xK3y5C9s",
  authDomain:        "financexvs.firebaseapp.com",
  projectId:         "financexvs",
  storageBucket:     "financexvs.firebasestorage.app",
  messagingSenderId: "525853616868",
  appId:             "1:525853616868:web:f5b91291cc234055e45af1",
};

const app      = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db       = getFirestore(app);
