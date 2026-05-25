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
    console.log('--- Inspecting Users ---');
    const userSnap = await getDocs(query(collection(db, 'users'), limit(2)));
    userSnap.forEach(d => {
      console.log('User ID:', d.id);
      console.log('User Data:', JSON.stringify(d.data(), null, 2));
    });

    console.log('\n--- Inspecting Businesses ---');
    const busSnap = await getDocs(query(collection(db, 'businesses'), limit(1)));
    busSnap.forEach(d => {
      console.log('Business ID:', d.id);
      console.log('Business Data:', JSON.stringify(d.data(), null, 2));
    });

    console.log('\n--- Inspecting Folders ---');
    const folderSnap = await getDocs(query(collection(db, 'folders'), limit(1)));
    folderSnap.forEach(d => {
      console.log('Folder ID:', d.id);
      console.log('Folder Data:', JSON.stringify(d.data(), null, 2));
    });
  } catch (err) {
    console.error('Inspection failed:', err);
  }
}

inspect();
