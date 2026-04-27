import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDyKhh3btsszJP3obMpaHYgqHYagH90TvQ",
  authDomain: "noizeee-9dc0a.firebaseapp.com",
  projectId: "noizeee-9dc0a",
  storageBucket: "noizeee-9dc0a.firebasestorage.app",
  messagingSenderId: "938229852306",
  appId: "1:938229852306:web:8ba000ec87fcb804f69e4b",
  measurementId: "G-T98CKNZ6HC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Экспортируем как именованные переменные
export { app, db, auth };