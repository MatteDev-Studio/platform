import { auth } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cacheProfile } from "./profileCache.js";

const db = getFirestore(auth.app);

// Riferimenti DOM
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const warningModal = document.getElementById('warningModal');
const confirmUpload = document.getElementById('confirmUpload');
const closeModalBtn = document.getElementById('closeModal');
const currentPfp = document.getElementById('currentPfp');

if (!dropZone || !fileInput || !warningModal || !confirmUpload || !closeModalBtn || !currentPfp) {
    console.warn("Pfp.js: elementi DOM mancanti, script non inizializzato.");
} else {
    const mainText = dropZone.querySelector('.main-text');

    const openModal = () => {
        warningModal.style.display = "flex";
        warningModal.setAttribute("aria-hidden", "false");
    };

    const closeModal = () => {
        warningModal.style.display = "none";
        warningModal.setAttribute("aria-hidden", "true");
        pendingFile = null;
    };

let pendingFile = null;
let currentUserUID = null;

// Recupera l'utente corrente
onAuthStateChanged(auth, (user) => {
    currentUserUID = user?.uid ?? null;
});

// Gestione selezione file
function prepareUpload(file) {
    if (file && file.type.startsWith('image/')) {
        pendingFile = file;
        openModal();
    } else {
        alert("Per favore seleziona un'immagine valida.");
    }
}

dropZone.onclick = () => fileInput.click();
fileInput.onchange = (e) => prepareUpload(e.target.files[0]);

dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
    }
});

dropZone.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files?.[0];
    if (file) prepareUpload(file);
});

// Logica Upload
confirmUpload.onclick = async () => {
    warningModal.style.display = "none";
    warningModal.setAttribute("aria-hidden", "true");
    if (!pendingFile) return;

    const user = auth.currentUser;
    if (!user) {
        const message = "Utente non autenticato. Effettua nuovamente il login.";
        if (mainText) mainText.innerText = message;
        alert(message);
        return;
    }

    if (!navigator.onLine) {
        if (mainText) mainText.innerText = "Sei offline, impossibile caricare l'immagine.";
        alert("Sei offline: il caricamento della foto non puo essere completato.");
        return;
    }

    if (mainText) mainText.innerText = "Elaborazione immagine...";

    try {
        const token = await user.getIdToken(true);
        currentUserUID = user.uid;
        console.log("Firebase user:", user.uid);

        const formData = new FormData();
        formData.append('image', pendingFile);
        formData.append('uid', currentUserUID);

        console.log("PFP upload avviato");
        // 1. Upload sul tuo server Ubuntu
        const response = await fetch('https://pfp-api.mattedev.com/upload-pfp', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Upload PFP fallito (${response.status})`);
        }

        console.log("PFP upload completato");
        if (data.url) {
            // 2. Aggiorna Firestore con l'URL corretto (quello col trattino -)
            const userRef = doc(db, "users", currentUserUID);
            await updateDoc(userRef, {
                pfp: data.url // Salva il link nel campo 'pfp' del documento UID
            });
            cacheProfile(currentUserUID, { pfp: data.url });

            // 3. Aggiorna UI
            currentPfp.src = data.url;
            if (mainText) mainText.innerText = "Profilo aggiornato con successo!";
            
            setTimeout(() => { 
                if (mainText) mainText.innerText = "Trascina qui la tua immagine";
            }, 3000);
        }

    } catch (err) {
        console.error("Errore:", err);
        const message = err instanceof Error ? err.message : "Errore nell'aggiornamento del profilo.";
        if (mainText) mainText.innerText = message;
        alert(message);
    }
};

closeModalBtn.onclick = closeModal;

warningModal.addEventListener("click", (e) => {
    if (e.target === warningModal) {
        closeModal();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && warningModal.style.display === "flex") {
        closeModal();
    }
});
}
