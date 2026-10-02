import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    sendEmailVerification 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// 1. Configurazione
const firebaseConfig = {
  apiKey: "AIzaSyC7Tbqt5FzJK8Z_USkCMWxXiHZp8uRN26A",
  authDomain: "mattedev-account.firebaseapp.com",
  projectId: "mattedev-account",
  storageBucket: "mattedev-account.firebasestorage.app",
  messagingSenderId: "77268069903",
  appId: "1:77268069903:web:040aa6c3981eb3650afd7a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * LOGICA DI AUTENTICAZIONE
 */
window.handleAuth = async () => {
    const emailField = document.getElementById('email');
    const passField = document.getElementById('password');
    const userField = document.getElementById('username');
    const authBtn = document.getElementById('authBtn');
    const authMsg = document.getElementById('authMsg');

    if (!emailField || !passField || !authBtn || authBtn.disabled) return;

    const email = emailField.value.trim();
    const pass = passField.value;
    const isLogin = authBtn.textContent.trim() === "Accedi";
    const username = userField?.value.trim() || email.split('@')[0];

    if (!email || !pass || (!isLogin && !userField?.value.trim())) {
        if (authMsg) {
            authMsg.textContent = "Compila tutti i campi obbligatori.";
            authMsg.className = "msg error";
        } else {
            alert("Compila tutti i campi obbligatori.");
        }
        return;
    }

    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
        if (authMsg) {
            authMsg.textContent = "Inserisci un indirizzo email valido.";
            authMsg.className = "msg error";
        } else {
            alert("Inserisci un indirizzo email valido.");
        }
        return;
    }

    if (pass.length < 6) {
        if (authMsg) {
            authMsg.textContent = "La password deve essere di almeno 6 caratteri.";
            authMsg.className = "msg error";
        } else {
            alert("La password deve essere di almeno 6 caratteri.");
        }
        return;
    }

    const initialButtonText = isLogin ? "Accedi" : "Registrati";
    authBtn.disabled = true;
    authBtn.textContent = isLogin ? "Accesso in corso..." : "Registrazione in corso...";
    if (authMsg) authMsg.className = "msg";

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, pass);
            // Il redirect automatico è gestito da onAuthStateChanged
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // Salva dati profilo
            await setDoc(doc(db, "users", user.uid), {
                username: username,
                email: email,
                pfp: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username),
                bio: '',
                isPrivate: false,
                uid: user.uid,
                createdAt: serverTimestamp()
            });

            await sendEmailVerification(user);
            window.location.href = "/pages/emailverify.html";
        }
    } catch (err) {
        if (authMsg) {
            authMsg.textContent = "Errore: " + err.message;
            authMsg.className = "msg error";
        } else {
            alert("Errore: " + err.message);
        }
    } finally {
        authBtn.disabled = false;
        authBtn.textContent = initialButtonText;
    }
};

/**
 * STATO UTENTE E REDIRECTS
 */
onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;
    const isAuthPage = path.includes('/pages/login.html');
    const isVerifyPage = path.includes('/pages/emailverify.html');

    if (user) {
        if (isAuthPage && user.emailVerified) {
            window.location.href = 'dashboard.html';
        }
    } else {
        if (!isAuthPage && !isVerifyPage && path !== '/' && !path.includes('index.html')) {
            window.location.href = '/pages/login.html';
        }
    }
});

/**
 * RESEND EMAIL
 */
window.resendVerification = async () => {
    if (auth.currentUser) {
        try {
            await sendEmailVerification(auth.currentUser);
            alert("Email inviata!");
        } catch (err) {
            alert("Attendi prima di richiedere un nuovo invio.");
        }
    }
};

/**
 * LISTENERS
 */
document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('authBtn');
    if (authBtn) authBtn.addEventListener('click', window.handleAuth);

    const resendBtn = document.getElementById('resendEmail');
    if (resendBtn) resendBtn.addEventListener('click', window.resendVerification);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (confirm("Vuoi uscire?")) {
                await signOut(auth);
                window.location.href = '/pages/login.html';
            }
        };
    }
});