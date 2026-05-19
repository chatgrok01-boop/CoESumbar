/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0160864040",
  appId: "1:917017389194:web:fb1568b390ddd8b94fe573",
  apiKey: "AIzaSyAWi4U6OIWKUAcvFyMoZz92dLMvDm7q6HM",
  authDomain: "gen-lang-client-0160864040.firebaseapp.com",
  storageBucket: "gen-lang-client-0160864040.firebasestorage.app",
  messagingSenderId: "917017389194"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
