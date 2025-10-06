// Firebase config and initialization (compat)
// This file assumes you loaded:
//   - https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js
//   - https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js

const firebaseConfig = {
  apiKey: "AIzaSyDqULwMCZyzaYM3EN59WiOo_qLluaQAhDM",
  authDomain: "omob-ddd69.firebaseapp.com",
  projectId: "omob-ddd69",
  storageBucket: "omob-ddd69.firebasestorage.app",
  messagingSenderId: "710103890319",
  appId: "1:710103890319:web:afa9f64b39f39b138f73fa"
};

// Initialize Firebase (compat)
firebase.initializeApp(firebaseConfig);

// después de firebase.initializeApp(firebaseConfig);
window.fbAuth = firebase.auth();
window.db = firebase.firestore();   