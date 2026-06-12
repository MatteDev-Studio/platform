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

// ==========================================
// CONFIGURAZIONE SALUTI CASUALI PER DASHBOARD
// ==========================================
const listaBenvenuti = [
    "Benvenuto, ",
    "Ciao, ",
    "Bentornato, ",
    "La tua dashboard, ",
    "Pronto all'azione, ",
    "Felice di rivederti, ",
    "Area personale di: "
];

const ottieniSalutoCasuale = () => {
    const indice = Math.floor(Math.random() * listaBenvenuti.length);
    return listaBenvenuti[indice];
};

/**
 * Carica i dati dell'utente da Firestore (Versione specifica per Dashboard)
 */
async function loadUserData(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            const username = data.username || "Utente";

            const salutoScelto = ottieniSalutoCasuale();

            const usernameDisplay = document.getElementById('usernameDisplay');
            if (usernameDisplay) usernameDisplay.textContent = username;
            
            const mainUsernameSpan = document.getElementById('displayUsername');
            if (mainUsernameSpan) {
                mainUsernameSpan.innerHTML = `${salutoScelto}<span id="usernameColor">${username}</span>`;
            }

            const userPfp = document.getElementById('userPfp');
            if (userPfp && data.pfp) {
                userPfp.src = data.pfp;
                userPfp.alt = username;
            }

            console.log("Dati caricati con successo sulla Dashboard!");
        } else {
            console.error("Documento utente non trovato in Firestore per l'UID:", uid);
            const mainUsernameSpan = document.getElementById('displayUsername');
            if (mainUsernameSpan) mainUsernameSpan.textContent = "Ciao, Ospite";
        }
    } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
    }
}

/**
 * Ascoltatore stato autenticazione
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadUserData(user.uid);
    } else {
        window.location.href = "/pages/login.html";
        console.log("Nessun utente loggato.");
    }
});