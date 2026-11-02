// Personal study calendar (_pages/study.html). Each day holds the minutes studied
// and an optional color. Entries are kept in this browser's localStorage, so the
// page works offline, and synced with the server in _study-server/ once connected.
// Devices merge per day: the newest edit wins, and deleted days are sent as empty.
(function () {
  const root = document.getElementById("study");
  if (!root) return;

  const STORAGE_KEY = "study-log-v1";
  const PENDING_KEY = "study-log-pending-v1";
  const SERVER_KEY = "study-log-server";
  const SYNC_DELAY_MS = 600;
  const SYNC_INTERVAL_MS = 60 * 1000;
  const SYNC_TIMEOUT_MS = 8000;
  const MAX_MINUTES = 24 * 60;
  const STEP_MINUTES = 30;
  const DEFAULT_HINT = "Try 2.5, 2:30, 2h 30m or 90m";
  // Written out in full so PurgeCSS keeps the matching rules in _study.scss
  const COLOR_CLASSES = { green: "is-green", yellow: "is-yellow", red: "is-red" };

  const byId = (id) => document.getElementById(id);
  const grid = byId("studyGrid");
  const timeInput = byId("studyTime");
  const hint = byId("studyTimeHint");
  const status = byId("studyStatus");
  const clearButton = byId("studyClear");
  const importFile = byId("studyImportFile");
  const swatches = Array.from(root.querySelectorAll(".study-swatch"));
  const syncLine = byId("studySync");
  const serverForm = byId("studyServerForm");
  const serverInput = byId("studyServer");
  const serverToggle = byId("studyServerToggle");

  let entries = load();
  let pending = loadPending(); // days changed here that the server has not accepted yet
  let serverUrl = loadServer();
  let syncState = "idle";
  let lastSynced = null;
  let syncing = false;
  let syncAgain = false;
  let syncTimer = null;
  let today = dateKey(new Date());
  let selected = today;
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();
  let cells = new Map();
  let weeks = [];
  let persistenceRequested = false;

  /* Dates: always local time, stored as YYYY-MM-DD */

  function dateKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function parseKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function shiftKey(key, days) {
    const date = parseKey(key);
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }

  function inView(key) {
    const date = parseKey(key);
    return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
  }

  /* Time: stored as whole minutes */

  function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours && rest) return hours + "h " + rest + "m";
    return rest ? rest + "m" : hours + "h";
  }

  // Returns minutes, or null if the text is not a duration of 24 hours or less
  function parseTime(text) {
    const value = text.trim().toLowerCase().replace(",", ".");
    if (!value) return 0;

    let minutes = null;
    const clock = value.match(/^(\d+):([0-5]\d)$/);
    const units = value.match(/^(?:(\d*\.?\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:ins?|inutes?)?)?$/);
    if (clock) {
      minutes = Number(clock[1]) * 60 + Number(clock[2]);
    } else if (/^\d*\.?\d+$/.test(value)) {
      minutes = Math.round(Number(value) * 60);
    } else if (units) {
      minutes = Math.round(Number(units[1] || 0) * 60) + Number(units[2] || 0);
    }
    return minutes !== null && minutes <= MAX_MINUTES ? minutes : null;
  }

  /* Storage */

  // Keeps the valid days from untrusted data (localStorage, a file or the server).
  // Empty days only mean something in sync data, where they mark a deletion.
  function cleanEntries(raw, keepEmpty) {
    const clean = {};
    Object.entries(raw && typeof raw === "object" ? raw : {}).forEach(([key, entry]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || dateKey(parseKey(key)) !== key || !entry) return;
      const minutes = Number.isInteger(entry.minutes) && entry.minutes > 0 && entry.minutes <= MAX_MINUTES ? entry.minutes : 0;
      const color = Object.hasOwn(COLOR_CLASSES, entry.color) ? entry.color : null;
      const updated = Number.isInteger(entry.updated) && entry.updated > 0 ? entry.updated : 0;
      if (minutes || color || keepEmpty) clean[key] = { minutes, color, updated };
    });
    return clean;
  }

  function loadPending() {
    try {
      return cleanEntries(JSON.parse(localStorage.getItem(PENDING_KEY)), true);
    } catch (error) {
      return {};
    }
  }

  function loadServer() {
    try {
      return localStorage.getItem(SERVER_KEY);
    } catch (error) {
      return null;
    }
  }

  function load() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      warn("This browser is blocking storage, so nothing here will be saved.");
      return {};
    }
    if (!raw) return {};
    try {
      return cleanEntries(JSON.parse(raw).entries);
    } catch (error) {
      // Set the unreadable data aside so the next save does not destroy it
      localStorage.setItem(STORAGE_KEY + "-unreadable", raw);
      warn("Your saved data could not be read. A copy was kept under " + STORAGE_KEY + "-unreadable.");
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      if (serverUrl) localStorage.setItem(SERVER_KEY, serverUrl);
      else localStorage.removeItem(SERVER_KEY);
    } catch (error) {
      warn("Could not save. Export a backup before leaving this page.");
      return;
    }
    if (!persistenceRequested && navigator.storage && navigator.storage.persist) {
      persistenceRequested = true;
      navigator.storage.persist();
    }
  }

  function warn(message) {
    status.textContent = message;
    status.classList.add("is-warning");
  }

  function say(message) {
    status.textContent = message;
    status.classList.remove("is-warning");
  }

  function entryFor(key) {
    return entries[key] || { minutes: 0, color: null };
  }

  // Records an edit made on this device, stamped so other devices can order it
  function writeDay(key, day) {
    const next = Object.assign({}, day, { updated: Date.now() });
    if (next.minutes || next.color) entries[key] = next;
    else delete entries[key];
    if (serverUrl) pending[key] = next;
  }

  function setEntry(key, change) {
    writeDay(key, Object.assign({}, entryFor(key), change));
    save();
    paintDay(key);
    scheduleSync();
  }

  /* Sync */

  async function postSync(url, changes) {
    const response = await fetch(url + "/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("Server replied " + response.status);
    return cleanEntries((await response.json()).entries, true);
  }

  function applyRemote(remote) {
    const merged = {};
    Object.entries(remote).forEach(([key, day]) => {
      if (!pending[key] && (day.minutes || day.color)) merged[key] = day;
    });
    Object.entries(entries).forEach(([key, day]) => {
      if (pending[key]) {
        merged[key] = day;
      } else if (!remote[key]) {
        // The server has never seen this day (say its file was restored): send it back
        merged[key] = day;
        pending[key] = day;
      }
    });
    entries = merged;
  }

  async function sync() {
    if (!serverUrl) return;
    if (syncing) {
      syncAgain = true;
      return;
    }
    syncing = true;
    const url = serverUrl;
    const sent = Object.assign({}, pending);

    try {
      const remote = await postSync(url, sent);
      if (url === serverUrl) {
        // Keep anything edited while this request was on its way
        Object.keys(sent).forEach((key) => {
          if (pending[key] && pending[key].updated === sent[key].updated) delete pending[key];
        });
        applyRemote(remote);
        save();
        syncState = "synced";
        lastSynced = new Date();
        paintAll();
      }
    } catch (error) {
      syncState = "offline";
    }

    syncing = false;
    paintSync();
    if (syncAgain || (syncState === "synced" && Object.keys(pending).length)) {
      syncAgain = false;
      scheduleSync();
    }
  }

  function scheduleSync() {
    if (!serverUrl) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, SYNC_DELAY_MS);
  }

  function paintSync() {
    const waiting = Object.keys(pending).length;
    const days = waiting + (waiting === 1 ? " day" : " days");
    const host = serverUrl ? new URL(serverUrl).hostname.split(".")[0] : "";

    syncLine.classList.toggle("is-synced", Boolean(serverUrl) && syncState === "synced");
    syncLine.classList.toggle("is-offline", Boolean(serverUrl) && syncState === "offline");
    serverToggle.textContent = serverUrl ? "Disconnect" : "Connect server";

    if (!serverUrl) {
      syncLine.textContent = "Saved only in this browser. Connect your server to keep it on all your devices.";
    } else if (syncState === "offline") {
      syncLine.textContent = "Can't reach " + host + ". Saved here" + (waiting ? ", " + days + " will sync" : " and will sync") + " when it's back.";
    } else if (syncState === "synced") {
      const time = lastSynced.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      syncLine.textContent = "Synced with " + host + " at " + time + (waiting ? ", " + days + " waiting" : "") + ".";
    } else {
      syncLine.textContent = "Connecting to " + host + "...";
    }
  }

  // Accepts a bare hostname; returns null for anything that is not HTTPS
  function parseServer(text) {
    const value = text.trim();
    try {
      const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : "https://" + value);
      return url.protocol === "https:" ? url.origin : null;
    } catch (error) {
      return null;
    }
  }

  async function connect(url) {
    say("Connecting...");
    try {
      await postSync(url, {});
    } catch (error) {
      warn("Could not reach that address. Check it, and that Tailscale is on for this device.");
      return;
    }
    serverUrl = url;
    pending = Object.assign({}, entries); // this device's days may be new to the server
    syncState = "idle";
    save();
    serverForm.hidden = true;
    say("");
    paintSync();
    sync();
  }

  function disconnect() {
    clearTimeout(syncTimer);
    serverUrl = null;
    pending = {};
    syncState = "idle";
    save();
    paintSync();
    say("Disconnected. This browser keeps its copy; the server keeps its data.");
  }

  /* Rendering */

  function buildGrid() {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7; // weeks start on Monday
    const length = new Date(viewYear, viewMonth + 1, 0).getDate();
    const rows = Math.ceil((offset + length) / 7);

    grid.textContent = "";
    cells = new Map();
    weeks = [];

    for (let row = 0; row < rows; row++) {
      const week = { keys: [], total: document.createElement("div") };
      for (let column = 0; column < 7; column++) {
        const date = new Date(viewYear, viewMonth, 1 - offset + row * 7 + column);
        const key = dateKey(date);
        const cell = document.createElement("button");
        const number = document.createElement("span");
        const time = document.createElement("span");

        cell.type = "button";
        cell.className = "study-day";
        cell.dataset.date = key;
        cell.tabIndex = -1;
        number.className = "study-day-number";
        number.textContent = date.getDate();
        time.className = "study-day-time";
        cell.append(number, time);
        grid.append(cell);

        cells.set(key, cell);
        week.keys.push(key);
      }
      week.total.className = "study-week-total";
      grid.append(week.total);
      weeks.push(week);
    }

    const monthName = first.toLocaleDateString("en-US", { month: "long" });
    byId("studyMonthName").textContent = monthName;
    byId("studyYear").textContent = viewYear;
    paintAll();
  }

  function paintCell(key) {
    const cell = cells.get(key);
    if (!cell) return;

    const entry = entryFor(key);
    const date = parseKey(key);
    const isToday = key === today;
    const isSelected = key === selected;

    Object.entries(COLOR_CLASSES).forEach(([color, className]) => cell.classList.toggle(className, entry.color === color));
    cell.classList.toggle("is-outside", !inView(key));
    cell.classList.toggle("is-future", key > today);
    cell.classList.toggle("is-today", isToday);
    cell.classList.toggle("is-selected", isSelected);
    cell.tabIndex = isSelected ? 0 : -1;
    cell.setAttribute("aria-pressed", String(isSelected));
    cell.querySelector(".study-day-time").textContent = entry.minutes ? formatMinutes(entry.minutes) : "";

    const label = [date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })];
    if (isToday) label.push("today");
    label.push(entry.minutes ? formatMinutes(entry.minutes) : "no time logged");
    if (entry.color) label.push(entry.color);
    cell.setAttribute("aria-label", label.join(", "));
  }

  function paintWeeks() {
    weeks.forEach((week) => {
      const total = week.keys.reduce((sum, key) => sum + entryFor(key).minutes, 0);
      week.total.textContent = total ? formatMinutes(total) : "";
    });
  }

  function paintStats() {
    const counts = { green: 0, yellow: 0, red: 0 };
    let total = 0;
    let days = 0;

    Object.entries(entries).forEach(([key, entry]) => {
      if (!inView(key)) return;
      total += entry.minutes;
      if (entry.minutes) days++;
      if (entry.color) counts[entry.color]++;
    });

    // A streak survives until the end of today, so an unlogged today does not break it
    let cursor = entryFor(today).minutes ? today : shiftKey(today, -1);
    let streak = 0;
    while (entryFor(cursor).minutes) {
      streak++;
      cursor = shiftKey(cursor, -1);
    }

    byId("statTotal").textContent = formatMinutes(total);
    byId("statDays").textContent = days;
    byId("statAverage").textContent = days ? formatMinutes(Math.round(total / days)) : "–";
    byId("statStreak").textContent = streak + (streak === 1 ? " day" : " days");
    byId("countGreen").textContent = counts.green;
    byId("countYellow").textContent = counts.yellow;
    byId("countRed").textContent = counts.red;
  }

  function paintEditor() {
    const date = parseKey(selected);
    const entry = entryFor(selected);

    byId("editorWeekday").textContent = selected === today ? "Today" : date.toLocaleDateString("en-US", { weekday: "long" });
    byId("editorDate").textContent = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    swatches.forEach((swatch) => swatch.setAttribute("aria-pressed", String(swatch.dataset.color === entry.color)));
    clearButton.disabled = !entries[selected];
  }

  function paintDay(key) {
    paintCell(key);
    paintWeeks();
    paintStats();
    paintEditor();
  }

  function paintAll() {
    cells.forEach((cell, key) => paintCell(key));
    paintWeeks();
    paintStats();
    paintEditor();
    // A sync can land mid-keystroke: never rewrite what is being typed
    if (document.activeElement !== timeInput) syncTimeInput();
  }

  function syncTimeInput() {
    const minutes = entryFor(selected).minutes;
    timeInput.value = minutes ? formatMinutes(minutes) : "";
    timeInput.removeAttribute("aria-invalid");
    hint.textContent = DEFAULT_HINT;
    hint.classList.remove("is-warning");
  }

  /* Actions */

  function select(key, focusCell) {
    const previous = selected;
    const date = parseKey(key);
    selected = key;

    if (date.getFullYear() !== viewYear || date.getMonth() !== viewMonth) {
      viewYear = date.getFullYear();
      viewMonth = date.getMonth();
      buildGrid();
    } else {
      paintCell(previous);
      paintCell(key);
      paintEditor();
      syncTimeInput();
    }
    if (focusCell) cells.get(key).focus();
  }

  function changeMonth(delta) {
    const date = new Date(viewYear, viewMonth + delta, 1);
    const sameMonthAsToday = dateKey(date).slice(0, 7) === today.slice(0, 7);
    select(sameMonthAsToday ? today : dateKey(date));
  }

  function setColor(color) {
    setEntry(selected, { color: entryFor(selected).color === color ? null : color });
  }

  function step(delta) {
    const minutes = Math.max(0, Math.min(MAX_MINUTES, entryFor(selected).minutes + delta));
    setEntry(selected, { minutes });
    syncTimeInput();
  }

  function exportBackup() {
    const data = JSON.stringify({ version: 1, entries }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "study-log-" + today + ".json";
    link.click();
    URL.revokeObjectURL(url);
    const count = Object.keys(entries).length;
    say("Exported " + count + (count === 1 ? " day." : " days."));
  }

  async function importBackup(file) {
    let imported;
    try {
      imported = cleanEntries(JSON.parse(await file.text()).entries);
    } catch (error) {
      imported = {};
    }

    const keys = Object.keys(imported);
    if (!keys.length) {
      warn("That file has no study log entries, so nothing changed.");
      return;
    }

    const differs = (key) => entries[key] && (entries[key].minutes !== imported[key].minutes || entries[key].color !== imported[key].color);
    const conflicts = keys.filter(differs).length;
    if (conflicts && !window.confirm("Replace " + conflicts + " existing " + (conflicts === 1 ? "day" : "days") + " with the backup's values?")) {
      say("Import cancelled.");
      return;
    }

    keys.forEach((key) => writeDay(key, imported[key]));
    save();
    paintAll();
    scheduleSync();
    say("Imported " + keys.length + (keys.length === 1 ? " day." : " days."));
  }

  /* Events */

  byId("studyPrev").addEventListener("click", () => changeMonth(-1));
  byId("studyNext").addEventListener("click", () => changeMonth(1));
  byId("studyToday").addEventListener("click", () => select(today));
  byId("studyMinus").addEventListener("click", () => step(-STEP_MINUTES));
  byId("studyPlus").addEventListener("click", () => step(STEP_MINUTES));
  byId("studyExport").addEventListener("click", exportBackup);
  byId("studyImport").addEventListener("click", () => importFile.click());
  swatches.forEach((swatch) => swatch.addEventListener("click", () => setColor(swatch.dataset.color)));

  clearButton.addEventListener("click", () => {
    setEntry(selected, { minutes: 0, color: null });
    syncTimeInput();
  });

  serverToggle.addEventListener("click", () => {
    if (serverUrl) {
      disconnect();
    } else {
      serverForm.hidden = !serverForm.hidden;
      if (!serverForm.hidden) serverInput.focus();
    }
  });

  byId("studyServerCancel").addEventListener("click", () => {
    serverForm.hidden = true;
  });

  serverForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = parseServer(serverInput.value);
    if (url) connect(url);
    else warn("Enter an https:// address, like the one the install script printed.");
  });

  grid.addEventListener("click", (event) => {
    const cell = event.target.closest(".study-day");
    if (cell) select(cell.dataset.date, true);
  });

  importFile.addEventListener("change", () => {
    if (importFile.files[0]) importBackup(importFile.files[0]);
    importFile.value = "";
  });

  // Saves as you type, so closing the tab never loses a valid value
  timeInput.addEventListener("input", () => {
    const minutes = parseTime(timeInput.value);
    const invalid = minutes === null;
    timeInput.toggleAttribute("aria-invalid", invalid);
    hint.textContent = invalid ? "Enter up to 24h, like 2.5, 2:30 or 90m" : DEFAULT_HINT;
    hint.classList.toggle("is-warning", invalid);
    if (!invalid) setEntry(selected, { minutes });
  });

  timeInput.addEventListener("focus", () => timeInput.select());

  timeInput.addEventListener("blur", () => {
    if (!timeInput.hasAttribute("aria-invalid")) syncTimeInput();
  });

  timeInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    if (event.key === "Escape") syncTimeInput();
    cells.get(selected).focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("input, textarea, select, ninja-keys")) return;

    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const colors = { g: "green", y: "yellow", r: "red" };
    const key = event.key.toLowerCase();

    if (moves[event.key]) {
      event.preventDefault();
      select(shiftKey(selected, moves[event.key]), true);
    } else if (colors[key]) {
      setColor(colors[key]);
    } else if (key === "t") {
      select(today, true);
    } else if (/^[0-9]$/.test(event.key) && event.target.closest(".study-day")) {
      timeInput.focus(); // the digit lands in the input and replaces the selection
    }
  });

  // Another tab changed the data: pick it up rather than overwrite it later
  window.addEventListener("storage", (event) => {
    if (![STORAGE_KEY, PENDING_KEY, SERVER_KEY].includes(event.key)) return;
    entries = load();
    pending = loadPending();
    serverUrl = loadServer();
    paintAll();
    paintSync();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    // The page was left open past midnight
    if (dateKey(new Date()) !== today) {
      today = dateKey(new Date());
      paintAll();
    }
    sync();
  });

  window.addEventListener("online", sync);
  setInterval(() => {
    if (!document.hidden) sync();
  }, SYNC_INTERVAL_MS);

  buildGrid();
  paintSync();
  sync();
})();
