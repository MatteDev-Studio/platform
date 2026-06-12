import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// 1. Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC7Tbqt5FzJK8Z_USkCMWxXiHZp8uRN26A",
  authDomain: "mattedev-account.firebaseapp.com",
  projectId: "mattedev-account",
  storageBucket: "mattedev-account.firebasestorage.app",
  messagingSenderId: "77268069903",
  appId: "1:77268069903:web:040aa6c3981eb3650afd7a"
};

// 2. Inizializzazione
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Carica i dati dell'utente da Firestore
 */
async function loadUserProfile(uid) {
    const pfpImg = document.getElementById('userPfp');
    const usernameSpan = document.getElementById('usernameDisplay'); // Widget alto
    const mainUsernameSpan = document.getElementById('displayUsername'); // Testo grande main

    // Rimosso il 'return' bloccante. Ora il codice controlla gli elementi singolarmente.

    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const rawUsername = userData.username || "Utente";
            
            // Aggiorna il widget in alto se esiste
            if (usernameSpan) usernameSpan.textContent = rawUsername; 
            
            // Aggiorna il testo grande a sinistra se esiste
            if (mainUsernameSpan) mainUsernameSpan.textContent = rawUsername; 
            
            // Aggiorna la pfp se esiste
            if (pfpImg && userData.pfp) {
                pfpImg.src = userData.pfp;
            }
        } else {
            if (usernameSpan) usernameSpan.textContent = "Guest";
            if (mainUsernameSpan) mainUsernameSpan.textContent = "Guest";
        }
    } catch (error) {
        console.error("Errore:", error);
        if (usernameSpan) usernameSpan.textContent = "Offline";
        if (mainUsernameSpan) mainUsernameSpan.textContent = "Offline";
    }
}

/**
 * Ascoltatore stato autenticazione
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Utente loggato: carica profilo usando il suo UID
        loadUserProfile(user.uid);
    } else {
        // Utente non loggato: reindirizza alla login se necessario
        window.location.href = "/pages/login.html";
        console.log("Nessun utente loggato.");
    }
});