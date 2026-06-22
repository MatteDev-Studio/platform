import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getCachedProfile, renderCachedProfile } from '../profileCache.js';

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
    const usernameDisplay = document.getElementById('usernameDisplay');
    const mainUsernameSpan = document.getElementById('displayUsername');
    const userPfp = document.getElementById('userPfp');

    if (!navigator.onLine) {
        const cachedProfile = getCachedProfile(uid);
        if (renderCachedProfile({
            uid,
            profileData: cachedProfile,
            usernameDisplay,
            mainUsernameDisplay: mainUsernameSpan,
            pfpImage: userPfp,
            greetingPrefix: `${ottieniSalutoCasuale()}`,
            fallbackUsername: "Offline"
        })) {
            console.warn("Browser offline, uso i dati in cache.");
            return;
        }

        if (usernameDisplay) usernameDisplay.textContent = "Offline";
        if (mainUsernameSpan) mainUsernameSpan.textContent = "Ciao, Offline";
        return;
    }

    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();

            renderCachedProfile({
                uid,
                profileData: data,
                usernameDisplay,
                mainUsernameDisplay: mainUsernameSpan,
                pfpImage: userPfp,
                greetingPrefix: `${ottieniSalutoCasuale()}`,
                fallbackUsername: "Utente"
            });

            console.log("Dati caricati con successo sulla Dashboard!");
        } else {
            const cachedProfile = getCachedProfile(uid);

            if (renderCachedProfile({
                uid,
                profileData: cachedProfile,
                usernameDisplay,
                mainUsernameDisplay: mainUsernameSpan,
                pfpImage: userPfp,
                greetingPrefix: `${ottieniSalutoCasuale()}`,
                fallbackUsername: "Ospite"
            })) {
                return;
            }

            console.error("Documento utente non trovato in Firestore per l'UID:", uid);
            if (mainUsernameSpan) mainUsernameSpan.textContent = "Ciao, Ospite";
        }
    } catch (error) {
        const cachedProfile = getCachedProfile(uid);

        if (renderCachedProfile({
            uid,
            profileData: cachedProfile,
            usernameDisplay,
            mainUsernameDisplay: mainUsernameSpan,
            pfpImage: userPfp,
            greetingPrefix: `${ottieniSalutoCasuale()}`,
            fallbackUsername: "Offline"
        })) {
            console.warn("Firestore non raggiungibile, uso i dati in cache.");
            return;
        }

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
