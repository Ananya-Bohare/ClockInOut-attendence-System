// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
//import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBe-Hka9CfBZHxDcqsqSi1FejlNBStgP70",
  authDomain: "clockinoutsystem-daa15.firebaseapp.com",
  projectId: "clockinoutsystem-daa15",
  storageBucket: "clockinoutsystem-daa15.firebasestorage.app",
  messagingSenderId: "435549119980",
  appId: "1:435549119980:web:684a51ace10a372df44cc9",
  measurementId: "G-C930DHX8K9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

