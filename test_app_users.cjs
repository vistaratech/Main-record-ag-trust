const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBLYtTJtHGfIaIkdi5Qw41wm6sD-tEpGZQ",
  authDomain: "sjvps-5a7f0.firebaseapp.com",
  projectId: "sjvps-5a7f0",
  storageBucket: "sjvps-5a7f0.firebasestorage.app",
  messagingSenderId: "195226208341",
  appId: "1:195226208341:web:d8c0e179e136b4369e2cdc",
  measurementId: "G-6NQGNFC8PQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  try {
    console.log('--- Inspecting app_users ---');
    const userSnap = await getDocs(query(collection(db, 'app_users'), limit(2)));
    console.log('Found documents count:', userSnap.size);
    userSnap.forEach(d => {
      console.log('User ID:', d.id);
      console.log('User Data:', JSON.stringify(d.data(), null, 2));
    });
  } catch (err) {
    console.error('Inspection failed:', err);
  }
}

inspect();
