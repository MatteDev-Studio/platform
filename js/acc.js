import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getCachedProfile, renderCachedProfile, cacheProfile } from './profileCache.js';

// 1. Configurazione Iniziale
const firebaseConfig = {
  apiKey: "AIzaSyC7Tbqt5FzJK8Z_USkCMWxXiHZp8uRN26A",
  authDomain: "mattedev-account.firebaseapp.com",
  projectId: "mattedev-account",
  storageBucket: "mattedev-account.firebasestorage.app",
  messagingSenderId: "77268069903",
  appId: "1:77268069903:web:040aa6c3981eb3650afd7a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Elementi DOM
const editUsername = document.getElementById('editUsername');
const editBio = document.getElementById('editBio');
const saveBtn = document.getElementById('saveBtn');
const sessionLogoutBtn = document.getElementById('sessionLogoutBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const accountNavLinks = Array.from(document.querySelectorAll(".account-nav-link"));
const viewAccount = document.getElementById("account");
const viewSessione = document.getElementById("sessione");

const usernameDisplay = document.getElementById('usernameDisplay'); 
const displayUsername = document.getElementById('displayUsername'); 
const userPfp = document.getElementById('currentPfp');

const listaBenvenuti = [
    "Benvenuto, ",
    "Ciao, ",
    "Bentornato, ",
    "La tua dashboard, ",
    "Pronto all'azione, ",
    "Felice di rivederti, "
];

const ottieniSalutoCasuale = () => {
    const randomIndex = Math.floor(Math.random() * listaBenvenuti.length);
    return listaBenvenuti[randomIndex];
};

const setActiveNav = (hash) => {
    accountNavLinks.forEach((link) => {
        const target = link.getAttribute("href") || "";
        link.classList.toggle("is-active", target === `#${hash}`);
    });
};

const setActiveView = (hash) => {
    const view = hash === "sessione" ? "sessione" : "account";
    if (viewAccount) viewAccount.classList.toggle("is-active", view === "account");
    if (viewSessione) viewSessione.classList.toggle("is-active", view === "sessione");
    setActiveNav(view);
};

if (accountNavLinks.length) {
    accountNavLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            const href = link.getAttribute("href") || "";
            if (!href.startsWith("#")) return;
            e.preventDefault();
            const hash = href.slice(1) || "account";
            window.location.hash = `#${hash}`;
            setActiveView(hash);
        });
    });

    const initialHash = (window.location.hash || "#account").slice(1);
    setActiveView(initialHash);

    window.addEventListener("hashchange", () => {
        const nextHash = (window.location.hash || "#account").slice(1);
        setActiveView(nextHash);
    });
}

// 2. Gestione Autenticazione
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Utente autenticato:", user.uid);
        await loadUserData(user.uid);
    } else {
        console.warn("Nessun utente loggato. Reindirizzamento...");
    }
});

// 3. Funzione per caricare i dati da Firestore
async function loadUserData(uid) {
    if (!navigator.onLine) {
        const cachedProfile = getCachedProfile(uid);
        const mainUsernameSpan = document.getElementById('displayUsername');

        if (renderCachedProfile({
            uid,
            profileData: cachedProfile,
            usernameDisplay,
            mainUsernameDisplay: mainUsernameSpan,
            pfpImage: userPfp,
            greetingPrefix: `${ottieniSalutoCasuale()}`,
            fallbackUsername: "Offline"
        })) {
            if (editUsername) editUsername.value = cachedProfile.username || "";
            if (editBio) editBio.value = cachedProfile.bio || "";
            console.warn("Browser offline, uso i dati in cache.");
            return;
        }

        if (usernameDisplay) usernameDisplay.textContent = "Offline";
        if (mainUsernameSpan) mainUsernameSpan.textContent = "Ciao, Offline";
        if (editUsername) editUsername.value = "";
        if (editBio) editBio.value = "";
        return;
    }

    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            const username = data.username || "Utente";
            const mainUsernameSpan = document.getElementById('displayUsername');
            renderCachedProfile({
                uid,
                profileData: data,
                usernameDisplay,
                mainUsernameDisplay: mainUsernameSpan,
                pfpImage: userPfp,
                greetingPrefix: `${ottieniSalutoCasuale()}`,
                fallbackUsername: "Utente"
            });

            if (editUsername) editUsername.value = username;
            if (editBio) editBio.value = data.bio || "";

            console.log("Dati caricati con successo!");
        } else {
            const mainUsernameSpan = document.getElementById('displayUsername');
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
                if (editUsername) editUsername.value = cachedProfile.username || "";
                if (editBio) editBio.value = cachedProfile.bio || "";
                return;
            }

            console.error("Documento utente non trovato in Firestore per l'UID:", uid);
            if (mainUsernameSpan) mainUsernameSpan.textContent = "Ciao, Ospite";
        }
    } catch (error) {
        const mainUsernameSpan = document.getElementById('displayUsername');
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
            if (editUsername) editUsername.value = cachedProfile.username || "";
            if (editBio) editBio.value = cachedProfile.bio || "";
            console.warn("Firestore non raggiungibile, uso i dati in cache.");
            return;
        }

        console.error("Errore durante il recupero dei dati:", error);
    }
}

// 4. Salvataggio dei dati modificati
if (saveBtn) saveBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("Devi essere loggato per salvare!");

    saveBtn.disabled = true;
    saveBtn.textContent = "Salvataggio in corso...";

    try {
        const userRef = doc(db, "users", user.uid);
        const updatedData = {
            username: editUsername.value,
            bio: editBio.value
        };

        await updateDoc(userRef, updatedData);
        cacheProfile(user.uid, updatedData);

        if (displayUsername) {
            displayUsername.innerHTML = `Profilo aggiornato, <span id="usernameColor">${editUsername.value}</span>`;
        }
        
        alert("Profilo aggiornato con successo!");
    } catch (error) {
        console.error("Errore nel salvataggio:", error);
        alert("Errore nel salvataggio dei dati.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Salva impostazioni account";
    }
});

// 5. Sessione: logout + eliminazione account
if (sessionLogoutBtn) {
    sessionLogoutBtn.addEventListener("click", async () => {
        if (!confirm("Vuoi uscire?")) return;
        try {
            await signOut(auth);
            window.location.href = "/pages/login.html";
        } catch (error) {
            console.error("Errore logout:", error);
            alert("Errore durante il logout.");
        }
    });
}

if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return alert("Devi essere loggato.");

        const first = confirm("Vuoi eliminare definitivamente l'account?");
        if (!first) return;

        const second = confirm("Questa azione è IRREVERSIBILE. Confermi?");
        if (!second) return;

        deleteAccountBtn.disabled = true;
        const previousText = deleteAccountBtn.textContent;
        deleteAccountBtn.textContent = "Eliminazione in corso...";

        try {
            const userRef = doc(db, "users", user.uid);
            await deleteDoc(userRef);

            await deleteUser(user);
            alert("Account eliminato.");
            window.location.href = "/pages/login.html";
        } catch (error) {
            console.error("Errore eliminazione account:", error);
            if (String(error?.code || "").includes("requires-recent-login")) {
                alert("Per eliminare l'account devi rieffettuare l'accesso (sicurezza).");
            } else {
                alert("Errore durante l'eliminazione dell'account.");
            }
        } finally {
            deleteAccountBtn.disabled = false;
            deleteAccountBtn.textContent = previousText;
        }
    });
}

window.updateFirestorePfp = async (newUrl) => {
    const user = auth.currentUser;
    if (user) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { pfp: newUrl });
        cacheProfile(user.uid, { pfp: newUrl });
        console.log("Firestore aggiornato con il nuovo URL della foto!");
    }
};
