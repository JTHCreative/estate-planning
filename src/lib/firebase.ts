import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCQAw4KlG3RX5lcslIh6Ev1Z3r7jcpD1lk",
  authDomain: "estate-planning-4cceb.firebaseapp.com",
  projectId: "estate-planning-4cceb",
  storageBucket: "estate-planning-4cceb.firebasestorage.app",
  messagingSenderId: "696534041164",
  appId: "1:696534041164:web:2b61e18c4f81c0fce12ae9",
  measurementId: "G-WH87BT0E75",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
