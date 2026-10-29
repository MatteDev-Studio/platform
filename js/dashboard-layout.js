import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyC7Tbqt5FzJK8Z_USkCMWxXiHZp8uRN26A',
    authDomain: 'mattedev-account.firebaseapp.com',
    projectId: 'mattedev-account',
    storageBucket: 'mattedev-account.firebasestorage.app',
    messagingSenderId: '77268069903',
    appId: '1:77268069903:web:040aa6c3981eb3650afd7a'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const canvas = document.getElementById('dashboardCanvas');
const editToggle = document.getElementById('dashboardEditToggle');
const widgetPanel = document.getElementById('widgetPanel');
const openWidgetPanel = document.getElementById('openWidgetPanel');
const statusMessage = document.getElementById('layoutSaveStatus');
const weatherCityInput = document.getElementById('weatherCityInput');
const weatherCityResults = document.getElementById('weatherCityResults');
const appList = document.getElementById('dashboardAppList');
const columnSpacingInput = document.getElementById('dashboardColumnSpacing');
const columnSpacingValue = document.getElementById('dashboardColumnSpacingValue');
const rowSpacingInput = document.getElementById('dashboardRowSpacing');
const rowSpacingValue = document.getElementById('dashboardRowSpacingValue');
const sizes = ['small', 'medium', 'large'];
const defaultCity = { name: 'Roma', country: 'Italia', latitude: 41.9028, longitude: 12.4964 };
const appElements = new Map(Array.from(canvas.querySelectorAll(':scope > .app-item[data-layout-id]'))
    .map((element) => [element.dataset.layoutId, element]));
const widgetDefinitions = {
    clock: { title: 'Orologio', size: 'small' },
    weather: { title: 'Meteo', size: 'medium' },
    date: { title: 'Data', size: 'small' }
};

let layout = [];
let currentUserId = null;
let isEditing = false;
let isLoaded = false;
let saveQueue = Promise.resolve();
let statusTimeout;
let weatherCity = defaultCity;
let removedAppIds = new Set();
let dashboardColumnSpacing = 8;
let dashboardRowSpacing = 8;
const weatherRequestIds = new WeakMap();

const getAppItems = () => Array.from(appElements.values());

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle('is-error', isError);
    statusMessage.classList.add('is-visible');
    window.clearTimeout(statusTimeout);
    statusTimeout = window.setTimeout(() => {
        statusMessage.classList.remove('is-visible');
    }, isError ? 6000 : 2200);
}

function makeDefaultLayout() {
    const appItems = getAppItems().filter((element) => !removedAppIds.has(element.dataset.layoutId)).map((element, index) => ({
        id: element.dataset.layoutId,
        type: 'app',
        x: index % 6,
        y: 2 + Math.floor(index / 6),
        size: 'small'
    }));

    return [
        { id: 'widget-clock', type: 'widget', widgetType: 'clock', x: 0, y: 0, size: 'small' },
        { id: 'widget-weather', type: 'widget', widgetType: 'weather', x: 2, y: 0, size: 'medium' },
        ...appItems
    ];
}

function getWidgetSize(item) {
    const dimensions = {
        small: { columns: 2, rows: 2 },
        medium: { columns: 3, rows: 2 },
        large: { columns: 4, rows: 3 }
    };
    return dimensions[item.size] || dimensions.small;
}

function setWidgetText(element, selector, text) {
    const target = element.querySelector(selector);
    if (target) target.textContent = text;
}

function createWidget(item) {
    const definition = widgetDefinitions[item.widgetType];
    if (!definition) return null;

    const widget = document.createElement('article');
    widget.className = 'dashboard-widget';
    widget.dataset.layoutId = item.id;
    widget.dataset.widgetType = item.widgetType;
    widget.innerHTML = `
        <div class="widget-header">
            <span class="widget-title"></span>
            <div class="widget-controls">
                <button type="button" class="widget-resize" aria-label="Cambia dimensione widget" title="Cambia dimensione">↗</button>
                <button type="button" class="widget-remove" aria-label="Rimuovi widget" title="Rimuovi">×</button>
            </div>
        </div>
        <div class="widget-body"></div>
    `;
    setWidgetText(widget, '.widget-title', definition.title);

    const body = widget.querySelector('.widget-body');
    if (item.widgetType === 'clock') {
        body.innerHTML = '<time class="widget-clock-time"></time><span class="widget-clock-date"></span>';
    } else if (item.widgetType === 'date') {
        body.innerHTML = '<span class="widget-clock-time widget-date-day"></span><span class="widget-clock-date widget-date-full"></span>';
    } else if (item.widgetType === 'weather') {
        body.innerHTML = `
            <span class="widget-weather-temperature">--°</span>
            <span class="widget-weather-condition">Meteo non ancora caricato</span>
            <span class="widget-weather-location"></span>
            <button type="button" class="widget-action weather-refresh-btn">Aggiorna</button>
        `;
    }

    return widget;
}

function updateSpacingControl() {
    document.documentElement.style.setProperty('--dashboard-column-gap', `${dashboardColumnSpacing}px`);
    document.documentElement.style.setProperty('--dashboard-row-gap', `${dashboardRowSpacing}px`);
    columnSpacingInput.value = String(dashboardColumnSpacing);
    columnSpacingValue.textContent = `${dashboardColumnSpacing} px`;
    rowSpacingInput.value = String(dashboardRowSpacing);
    rowSpacingValue.textContent = `${dashboardRowSpacing} px`;
}

function renderAppPicker() {
    appList.replaceChildren();
    const removedApps = getAppItems().filter((element) => removedAppIds.has(element.dataset.layoutId));

    if (!removedApps.length) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'app-picker-empty';
        emptyMessage.textContent = 'Tutte le app sono nella dashboard.';
        appList.append(emptyMessage);
        return;
    }

    removedApps.forEach((element) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dashboard-app-restore';
        button.dataset.restoreApp = element.dataset.layoutId;

        const name = document.createElement('span');
        name.textContent = element.querySelector('.app-name')?.textContent.trim() || 'App';
        const restoreLabel = document.createElement('span');
        restoreLabel.textContent = '+';
        restoreLabel.setAttribute('aria-hidden', 'true');
        button.append(name, restoreLabel);
        appList.append(button);
    });
}

function setupAppRemoveControls() {
    for (const [id, element] of appElements) {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'app-remove-button';
        removeButton.dataset.removeApp = id;
        removeButton.setAttribute('aria-label', `Rimuovi ${element.querySelector('.app-name')?.textContent.trim() || 'app'} dalla dashboard`);
        removeButton.textContent = '×';
        element.append(removeButton);
    }
}

function getColumnCount() {
    if (window.matchMedia('(max-width: 420px)').matches) return 3;
    if (window.matchMedia('(max-width: 700px)').matches) return 4;
    return 6;
}

function findAvailablePosition(occupied, startX, startY, columnSpan, rowSpan, columns) {
    for (let y = Math.max(0, startY); y < startY + 100; y += 1) {
        for (let x = Math.max(0, Math.min(startX, columns - columnSpan)); x <= columns - columnSpan; x += 1) {
            let isAvailable = true;
            for (let row = y; row < y + rowSpan; row += 1) {
                for (let column = x; column < x + columnSpan; column += 1) {
                    if (occupied.has(`${column}:${row}`)) isAvailable = false;
                }
            }
            if (isAvailable) return { x, y };
        }
    }
    return { x: 0, y: startY + 100 };
}

function arrangeLayout(priorityId = null) {
    const columns = getColumnCount();
    const occupied = new Set();
    const ordered = layout
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            if (a.item.id === priorityId) return -1;
            if (b.item.id === priorityId) return 1;
            return a.item.y - b.item.y || a.item.x - b.item.x || a.index - b.index;
        });

    for (const { item } of ordered) {
        const element = canvas.querySelector(`:scope > [data-layout-id="${CSS.escape(item.id)}"]`);
        if (!element) continue;

        const isWidget = item.type === 'widget';
        const baseWidth = isWidget ? getWidgetSize(item).columns : 1;
        const rowSpan = isWidget ? getWidgetSize(item).rows : 1;
        const columnSpan = Math.min(columns, Math.max(1, Math.ceil(baseWidth * columns / 6)));
        const preferredX = Math.floor(item.x * columns / 6);
        const { x, y } = findAvailablePosition(occupied, preferredX, item.y, columnSpan, rowSpan, columns);

        for (let row = y; row < y + rowSpan; row += 1) {
            for (let column = x; column < x + columnSpan; column += 1) {
                occupied.add(`${column}:${row}`);
            }
        }

        element.style.gridColumn = `${x + 1} / span ${columnSpan}`;
        element.style.gridRow = `${y + 1} / span ${rowSpan}`;
        element.dataset.currentX = String(x);
        element.dataset.currentY = String(y);
        element.dataset.currentColumnSpan = String(columnSpan);
    }
}

function serializeLayout() {
    return layout.map(({ id, type, widgetType, x, y, size }) => ({
        id,
        type,
        ...(widgetType ? { widgetType } : {}),
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
        size: sizes.includes(size) ? size : 'small'
    }));
}

function syncLayoutFromVisual() {
    const columns = getColumnCount();
    for (const item of layout) {
        const element = canvas.querySelector(`:scope > [data-layout-id="${CSS.escape(item.id)}"]`);
        if (!element) continue;
        item.x = Math.round(Number(element.dataset.currentX) * 6 / columns);
        item.y = Number(element.dataset.currentY);
    }
}

function saveLayout() {
    if (!currentUserId || !isLoaded) return;

    const userRef = doc(db, 'users', currentUserId);
    const dashboardLayout = serializeLayout();
    showStatus('Salvataggio dashboard…');
    saveQueue = saveQueue.then(async () => {
        try {
            await setDoc(userRef, {
                dashboardLayout,
                hiddenDashboardApps: Array.from(removedAppIds),
                dashboardColumnSpacing,
                dashboardRowSpacing
            }, { merge: true });
            showStatus('Dashboard salvata');
        } catch (error) {
            console.error('Errore durante il salvataggio della dashboard:', error);
            showStatus('Impossibile salvare la dashboard. Riprova.', true);
        }
    });
}

function updateClockWidgets() {
    const now = new Date();
    const time = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(now);
    const fullDate = new Intl.DateTimeFormat('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }).format(now);

    canvas.querySelectorAll('[data-widget-type="clock"]').forEach((widget) => {
        const timeElement = widget.querySelector('.widget-clock-time');
        if (timeElement) {
            timeElement.textContent = time;
            timeElement.dateTime = now.toISOString();
        }
        setWidgetText(widget, '.widget-clock-date', fullDate);
    });

    canvas.querySelectorAll('[data-widget-type="date"]').forEach((widget) => {
        setWidgetText(widget, '.widget-date-day', new Intl.DateTimeFormat('it-IT', { day: '2-digit' }).format(now));
        setWidgetText(widget, '.widget-date-full', fullDate);
    });
}

const weatherDescriptions = {
    0: 'Sereno',
    1: 'Prevalentemente sereno',
    2: 'Parzialmente nuvoloso',
    3: 'Nuvoloso',
    45: 'Nebbia',
    48: 'Nebbia con brina',
    51: 'Pioviggine leggera',
    53: 'Pioviggine moderata',
    55: 'Pioviggine intensa',
    61: 'Pioggia leggera',
    63: 'Pioggia moderata',
    65: 'Pioggia intensa',
    71: 'Neve leggera',
    73: 'Neve moderata',
    75: 'Neve intensa',
    80: 'Rovesci leggeri',
    81: 'Rovesci moderati',
    82: 'Rovesci intensi',
    95: 'Temporale'
};

async function loadWeather(widget) {
    const requestId = (weatherRequestIds.get(widget) || 0) + 1;
    const requestedCity = weatherCity;
    weatherRequestIds.set(widget, requestId);
    const button = widget.querySelector('.weather-refresh-btn');
    const condition = widget.querySelector('.widget-weather-condition');
    const temperature = widget.querySelector('.widget-weather-temperature');
    const location = widget.querySelector('.widget-weather-location');

    button.disabled = true;
    button.textContent = 'Caricamento…';
    condition.textContent = 'Ricerca del meteo…';

    try {
        const parameters = new URLSearchParams({
            latitude: String(requestedCity.latitude),
            longitude: String(requestedCity.longitude),
            current: 'temperature_2m,weather_code',
            timezone: 'auto'
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`);
        if (!response.ok) throw new Error(`Open-Meteo ha risposto con HTTP ${response.status}`);

        const data = await response.json();
        if (typeof data.current?.temperature_2m !== 'number') {
            throw new Error('La risposta del servizio meteo non contiene una temperatura valida.');
        }

        if (weatherRequestIds.get(widget) !== requestId || !widget.isConnected) return;
        temperature.textContent = `${Math.round(data.current.temperature_2m)}°`;
        condition.textContent = weatherDescriptions[data.current.weather_code] || 'Condizioni aggiornate';
        location.textContent = `${requestedCity.name}${requestedCity.country ? `, ${requestedCity.country}` : ''}`;
        button.textContent = 'Aggiorna';
    } catch (error) {
        if (weatherRequestIds.get(widget) !== requestId || !widget.isConnected) return;
        console.error('Impossibile caricare il meteo:', error);
        condition.textContent = 'Meteo non disponibile. Riprova.';
        button.textContent = 'Riprova';
    } finally {
        if (weatherRequestIds.get(widget) === requestId && widget.isConnected) {
            button.disabled = false;
        }
    }
}

function getStoredCity(prefCity) {
    if (prefCity && typeof prefCity === 'object') {
        const latitude = Number(prefCity.latitude ?? prefCity.lat);
        const longitude = Number(prefCity.longitude ?? prefCity.lon ?? prefCity.lng);
        const name = prefCity.name || prefCity.city || prefCity.label;
        if (typeof name === 'string' && Number.isFinite(latitude) && Number.isFinite(longitude)) {
            return {
                name,
                country: typeof prefCity.country === 'string' ? prefCity.country : '',
                latitude,
                longitude
            };
        }
    }

    if (typeof prefCity === 'string' && prefCity.trim()) {
        return defaultCity;
    }

    return defaultCity;
}

async function resolveStoredCity(prefCity) {
    const storedCity = getStoredCity(prefCity);
    if (prefCity && typeof prefCity === 'object'
        && Number.isFinite(Number(prefCity.latitude ?? prefCity.lat))
        && Number.isFinite(Number(prefCity.longitude ?? prefCity.lon ?? prefCity.lng))) {
        return storedCity;
    }

    const query = typeof prefCity === 'string'
        ? prefCity.trim()
        : (prefCity?.name || prefCity?.city || prefCity?.label || '');
    if (!query) return storedCity;

    const parameters = new URLSearchParams({ name: query, count: '1', language: 'it', format: 'json' });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`);
    if (!response.ok) throw new Error(`Open-Meteo ha risposto con HTTP ${response.status}`);
    const data = await response.json();
    const result = Array.isArray(data.results) ? data.results[0] : null;
    if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
        throw new Error(`Open-Meteo non ha trovato le coordinate della città "${query}".`);
    }

    return {
        name: result.name,
        country: typeof result.country === 'string' ? result.country : '',
        latitude: result.latitude,
        longitude: result.longitude
    };
}

async function searchWeatherCities() {
    const query = weatherCityInput.value.trim();
    weatherCityResults.replaceChildren();
    if (query.length < 2) {
        showStatus('Inserisci almeno due caratteri per cercare una città.', true);
        return;
    }

    const button = document.getElementById('weatherCitySearch');
    button.disabled = true;
    button.textContent = 'Ricerca…';

    try {
        const parameters = new URLSearchParams({ name: query, count: '6', language: 'it', format: 'json' });
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`);
        if (!response.ok) throw new Error(`Open-Meteo ha risposto con HTTP ${response.status}`);
        const data = await response.json();
        const results = Array.isArray(data.results) ? data.results : [];

        if (!results.length) {
            showStatus('Nessuna città trovata. Prova con un altro nome.', true);
            return;
        }

        results.forEach((result) => {
            if (typeof result.name !== 'string' || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) return;
            const city = {
                name: result.name,
                country: typeof result.country === 'string' ? result.country : '',
                region: typeof result.admin1 === 'string' ? result.admin1 : '',
                latitude: result.latitude,
                longitude: result.longitude
            };
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'weather-city-option';
            option.setAttribute('role', 'option');
            option.textContent = `${city.name}${city.region ? `, ${city.region}` : ''}${city.country ? ` · ${city.country}` : ''}`;
            option.addEventListener('click', () => selectWeatherCity(city));
            weatherCityResults.append(option);
        });

        if (!weatherCityResults.childElementCount) showStatus('Nessuna città valida trovata.', true);
    } catch (error) {
        console.error('Impossibile cercare la città:', error);
        showStatus('Ricerca città non disponibile. Riprova.', true);
    } finally {
        button.disabled = false;
        button.textContent = 'Cerca';
    }
}

async function selectWeatherCity(city) {
    const previousCity = weatherCity;
    weatherCity = city;
    weatherCityResults.replaceChildren();
    weatherCityInput.value = `${city.name}${city.country ? `, ${city.country}` : ''}`;

    try {
        await setDoc(doc(db, 'users', currentUserId), { prefCity: city }, { merge: true });
        showStatus(`Città meteo salvata: ${city.name}`);
        refreshWeatherWidgets();
    } catch (error) {
        weatherCity = previousCity;
        weatherCityInput.value = `${previousCity.name}${previousCity.country ? `, ${previousCity.country}` : ''}`;
        console.error('Impossibile salvare la città meteo:', error);
        showStatus('Città non salvata. Riprova.', true);
    }
    collapseWidgetPanel();
}

function refreshWeatherWidgets() {
    canvas.querySelectorAll('[data-widget-type="weather"]').forEach((widget) => loadWeather(widget));
}

function addWidgetsToCanvas(items) {
    items.filter((item) => item.type === 'widget').forEach((item) => {
        if (canvas.querySelector(`:scope > [data-layout-id="${CSS.escape(item.id)}"]`)) return;
        const element = createWidget(item);
        if (element) canvas.append(element);
    });
}

function removeApp(appId) {
    const element = appElements.get(appId);
    if (!element || removedAppIds.has(appId)) return;

    removedAppIds.add(appId);
    element.classList.add('app-removed');
    layout = layout.filter((item) => item.id !== appId);
    renderAppPicker();
    arrangeLayout();
    syncLayoutFromVisual();
    saveLayout();
}

function restoreApp(appId) {
    const element = appElements.get(appId);
    if (!element || !removedAppIds.has(appId)) return;

    removedAppIds.delete(appId);
    element.classList.remove('app-removed');
    const nextRow = layout.reduce((bottom, item) => {
        const rowSpan = item.type === 'widget' ? getWidgetSize(item).rows : 1;
        return Math.max(bottom, item.y + rowSpan);
    }, 0);
    layout.push({ id: appId, type: 'app', x: 0, y: nextRow, size: 'small' });
    arrangeLayout(appId);
    syncLayoutFromVisual();
    renderAppPicker();
    saveLayout();
}

function addWidget(widgetType) {
    const definition = widgetDefinitions[widgetType];
    if (!definition) return;

    const widget = {
        id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'widget',
        widgetType,
        x: 0,
        y: 0,
        size: definition.size
    };
    const element = createWidget(widget);
    if (!element) return;

    layout.push(widget);
    canvas.append(element);
    arrangeLayout(widget.id);
    syncLayoutFromVisual();
    updateClockWidgets();
    if (widgetType === 'weather') refreshWeatherWidgets();
    saveLayout();
    collapseWidgetPanel();
}

function loadStoredLayout(savedLayout) {
    const knownApps = new Map(getAppItems().map((element) => [element.dataset.layoutId, element]));
    const knownIds = new Set();
    const restored = [];

    for (const savedItem of savedLayout) {
        if (!savedItem || typeof savedItem.id !== 'string' || knownIds.has(savedItem.id)) continue;
        if (!Number.isFinite(savedItem.x) || !Number.isFinite(savedItem.y)) continue;

        if (savedItem.type === 'app' && knownApps.has(savedItem.id)) {
            restored.push({
                id: savedItem.id,
                type: 'app',
                x: Math.max(0, Math.min(5, Math.round(savedItem.x))),
                y: Math.max(0, Math.round(savedItem.y)),
                size: 'small'
            });
        } else if (savedItem.type === 'widget' && widgetDefinitions[savedItem.widgetType]) {
            const item = {
                id: savedItem.id,
                type: 'widget',
                widgetType: savedItem.widgetType,
                x: Math.max(0, Math.min(5, Math.round(savedItem.x))),
                y: Math.max(0, Math.round(savedItem.y)),
                size: sizes.includes(savedItem.size) ? savedItem.size : widgetDefinitions[savedItem.widgetType].size
            };
            const widgetElement = createWidget(item);
            if (!widgetElement) continue;
            canvas.append(widgetElement);
            restored.push(item);
        } else {
            continue;
        }

        knownIds.add(savedItem.id);
    }

    const missingApps = Array.from(knownApps.keys())
        .filter((id) => !knownIds.has(id) && !removedAppIds.has(id));
    const nextRow = restored.reduce((bottom, item) => {
        return Math.max(bottom, item.y + (item.type === 'widget' ? getWidgetSize(item).rows : 1));
    }, 2);

    missingApps.forEach((id, index) => {
        restored.push({
            id,
            type: 'app',
            x: index % 6,
            y: nextRow + Math.floor(index / 6),
            size: 'small'
        });
    });

    return restored;
}

function setEditMode(enabled) {
    isEditing = enabled;
    document.body.classList.toggle('dashboard-editing', enabled);
    editToggle.setAttribute('aria-pressed', String(enabled));
    editToggle.setAttribute('aria-label', enabled ? 'Blocca dashboard' : 'Modifica dashboard');
    editToggle.title = enabled ? 'Blocca dashboard' : 'Modifica dashboard';
    widgetPanel.hidden = !enabled;
    openWidgetPanel.hidden = !enabled;
}

function collapseWidgetPanel() {
    widgetPanel.hidden = true;
    openWidgetPanel.hidden = !isEditing;
}

let dragState = null;

function handlePointerMove(event) {
    if (!dragState) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(deltaX, deltaY) < 6) return;

    dragState.moved = true;
    dragState.element.classList.add('is-being-dragged');
    dragState.element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.03)`;
}

function handlePointerUp(event) {
    if (!dragState) return;

    const { element, moved } = dragState;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);

    if (moved) {
        const columns = getColumnCount();
        const styles = getComputedStyle(canvas);
        const columnGap = parseFloat(styles.columnGap) || 0;
        const rowGap = parseFloat(styles.rowGap) || 0;
        const columnWidth = (canvas.clientWidth - columnGap * (columns - 1)) / columns;
        const rowHeight = parseFloat(styles.gridAutoRows) || 100;
        const rect = canvas.getBoundingClientRect();
        const startX = Math.max(0, Math.min(columns - 1,
            Math.floor((event.clientX - rect.left) / (columnWidth + columnGap))));
        const startY = Math.max(0, Math.floor(
            (event.clientY - rect.top - (parseFloat(styles.paddingTop) || 0)) / (rowHeight + rowGap)
        ));
        const item = layout.find((entry) => entry.id === element.dataset.layoutId);

        if (item) {
            item.x = Math.round(startX * 6 / columns);
            item.y = startY;
            layout = [item, ...layout.filter((entry) => entry.id !== item.id)];
            element.style.transform = '';
            element.classList.remove('is-being-dragged');
            arrangeLayout(item.id);
            syncLayoutFromVisual();
            saveLayout();
        }
    }

    element.style.transform = '';
    element.classList.remove('is-being-dragged');
    dragState = null;
}

editToggle.addEventListener('click', () => setEditMode(!isEditing));
document.getElementById('closeWidgetPanel').addEventListener('click', () => {
    collapseWidgetPanel();
});
openWidgetPanel.addEventListener('click', () => {
    widgetPanel.hidden = false;
    openWidgetPanel.hidden = true;
});
document.getElementById('weatherCitySearch').addEventListener('click', searchWeatherCities);
weatherCityInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchWeatherCities();
});
columnSpacingInput.addEventListener('input', () => {
    dashboardColumnSpacing = Number(columnSpacingInput.value);
    updateSpacingControl();
});
columnSpacingInput.addEventListener('change', saveLayout);
rowSpacingInput.addEventListener('input', () => {
    dashboardRowSpacing = Number(rowSpacingInput.value);
    updateSpacingControl();
});
rowSpacingInput.addEventListener('change', saveLayout);

widgetPanel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-widget]');
    if (button) addWidget(button.dataset.addWidget);

    const restoreButton = event.target.closest('[data-restore-app]');
    if (restoreButton) restoreApp(restoreButton.dataset.restoreApp);
});

canvas.addEventListener('pointerdown', (event) => {
    if (!isEditing || event.button !== 0 || event.target.closest('button')) return;
    const element = event.target.closest('.app-item[data-layout-id], .dashboard-widget[data-layout-id]');
    if (!element || element.parentElement !== canvas) return;

    event.preventDefault();
    dragState = {
        element,
        startX: event.clientX,
        startY: event.clientY,
        moved: false
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
});

canvas.addEventListener('click', (event) => {
    const removeAppButton = event.target.closest('[data-remove-app]');
    if (removeAppButton) {
        event.preventDefault();
        event.stopPropagation();
        removeApp(removeAppButton.dataset.removeApp);
        return;
    }

    if (isEditing) {
        if (event.target.closest('.app-item')) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
    }

    const button = event.target.closest('.widget-resize, .widget-remove, .weather-refresh-btn');
    if (!button) return;

    const widgetElement = button.closest('.dashboard-widget');
    const item = layout.find((entry) => entry.id === widgetElement?.dataset.layoutId);
    if (!item) return;

    if (button.classList.contains('weather-refresh-btn')) {
        loadWeather(widgetElement);
    } else if (button.classList.contains('widget-remove')) {
        layout = layout.filter((entry) => entry.id !== item.id);
        widgetElement.remove();
        arrangeLayout();
        saveLayout();
    } else if (button.classList.contains('widget-resize')) {
        const nextSize = (sizes.indexOf(item.size) + 1) % sizes.length;
        item.size = sizes[nextSize];
        arrangeLayout(item.id);
        syncLayoutFromVisual();
        saveLayout();
    }
}, true);

window.addEventListener('resize', () => arrangeLayout());
window.addEventListener('online', () => {
    refreshWeatherWidgets();
});
window.setInterval(updateClockWidgets, 1000);

onAuthStateChanged(auth, async (user) => {
    if (!user || isLoaded) return;
    currentUserId = user.uid;

    try {
        const snapshot = await getDoc(doc(db, 'users', user.uid));
        const data = snapshot.exists() ? snapshot.data() : {};
        const hasSavedLayout = Array.isArray(data.dashboardLayout);
        const validAppIds = new Set(appElements.keys());
        removedAppIds = new Set(Array.isArray(data.hiddenDashboardApps)
            ? data.hiddenDashboardApps.filter((id) => validAppIds.has(id))
            : []);
        dashboardColumnSpacing = Number.isFinite(data.dashboardColumnSpacing)
            ? Math.max(0, Math.min(24, Math.round(data.dashboardColumnSpacing)))
            : Number.isFinite(data.dashboardSpacing)
                ? Math.max(0, Math.min(24, Math.round(data.dashboardSpacing)))
                : 8;
        dashboardRowSpacing = Number.isFinite(data.dashboardRowSpacing)
            ? Math.max(0, Math.min(32, Math.round(data.dashboardRowSpacing)))
            : Number.isFinite(data.dashboardSpacing)
                ? Math.max(0, Math.min(32, Math.round(data.dashboardSpacing)))
            : 8;
        updateSpacingControl();
        setupAppRemoveControls();
        for (const appId of removedAppIds) appElements.get(appId)?.classList.add('app-removed');
        renderAppPicker();
        try {
            weatherCity = await resolveStoredCity(data.prefCity);
        } catch (error) {
            weatherCity = defaultCity;
            console.error('Impossibile risolvere la città meteo salvata:', error);
            showStatus('Città preferita non disponibile: uso Roma come città predefinita.', true);
        }
        weatherCityInput.value = `${weatherCity.name}${weatherCity.country ? `, ${weatherCity.country}` : ''}`;

        if (hasSavedLayout) {
            layout = loadStoredLayout(data.dashboardLayout);
        } else {
            layout = makeDefaultLayout();
            addWidgetsToCanvas(layout);
        }
        const hasRemovedWidgets = hasSavedLayout && data.dashboardLayout.some((item) => {
            return item?.type === 'widget' && !widgetDefinitions[item.widgetType];
        });

        isLoaded = true;
        arrangeLayout();
        if (!hasSavedLayout) syncLayoutFromVisual();
        updateClockWidgets();
        refreshWeatherWidgets();

        if (!hasSavedLayout || hasRemovedWidgets) saveLayout();
    } catch (error) {
        console.error('Impossibile caricare la disposizione della dashboard:', error);
        layout = makeDefaultLayout();
        addWidgetsToCanvas(layout);
        isLoaded = true;
        arrangeLayout();
        updateClockWidgets();
        refreshWeatherWidgets();
        showStatus('Layout non caricato da Firebase. Le modifiche non saranno salvate.', true);
    }
});
