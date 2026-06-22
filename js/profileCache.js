const PROFILE_CACHE_PREFIX = "mdev-profile:";

function getCacheKey(uid) {
    return `${PROFILE_CACHE_PREFIX}${uid}`;
}

export function getCachedProfile(uid) {
    if (!uid) return null;

    try {
        const raw = localStorage.getItem(getCacheKey(uid));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function cacheProfile(uid, profileData) {
    if (!uid || !profileData) return;

    try {
        const current = getCachedProfile(uid) || {};
        const next = {
            ...current,
            ...profileData,
            cachedAt: Date.now()
        };

        localStorage.setItem(getCacheKey(uid), JSON.stringify(next));
    } catch {
        // Ignora errori di storage locale.
    }
}

export function applyProfilePicture(pfpImage, profileData, username = "Utente") {
    if (!pfpImage) return;

    const pfpUrl = typeof profileData?.pfp === "string" ? profileData.pfp.trim() : "";

    if (!pfpUrl) {
        pfpImage.removeAttribute("src");
        pfpImage.alt = username;
        return;
    }

    pfpImage.onerror = () => {
        pfpImage.removeAttribute("src");
    };

    pfpImage.src = pfpUrl;
    pfpImage.alt = username;
}

export function renderCachedProfile({
    uid,
    profileData,
    usernameDisplay,
    mainUsernameDisplay,
    pfpImage,
    greetingPrefix = "Ciao, ",
    fallbackUsername = "Utente"
}) {
    if (!profileData) return false;

    const username = profileData.username || fallbackUsername;

    if (usernameDisplay) {
        usernameDisplay.textContent = username;
    }

    if (mainUsernameDisplay) {
        mainUsernameDisplay.innerHTML = `${greetingPrefix}<span id="usernameColor">${username}</span>`;
    }

    applyProfilePicture(pfpImage, profileData, username);

    cacheProfile(uid, profileData);
    return true;
}
