// Personal study calendar (_pages/study.html). Each day holds the minutes studied
// and an optional color. Entries live in this browser's localStorage, with JSON
// export and import as the backup.
(function () {
  const root = document.getElementById("study");
  if (!root) return;

  const STORAGE_KEY = "study-log-v1";
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

  let entries = load();
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

  // Keeps the valid days from untrusted data (localStorage or an imported file)
  function cleanEntries(raw) {
    const clean = {};
    Object.entries(raw && typeof raw === "object" ? raw : {}).forEach(([key, entry]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || dateKey(parseKey(key)) !== key || !entry) return;
      const minutes = Number.isInteger(entry.minutes) && entry.minutes > 0 && entry.minutes <= MAX_MINUTES ? entry.minutes : 0;
      const color = Object.hasOwn(COLOR_CLASSES, entry.color) ? entry.color : null;
      if (minutes || color) clean[key] = { minutes, color };
    });
    return clean;
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

  function setEntry(key, change) {
    const next = Object.assign({}, entryFor(key), change);
    if (next.minutes || next.color) entries[key] = next;
    else delete entries[key];
    save();
    paintDay(key);
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
    syncTimeInput();
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

    const differs = (key) => entries[key] && JSON.stringify(entries[key]) !== JSON.stringify(imported[key]);
    const conflicts = keys.filter(differs).length;
    if (conflicts && !window.confirm("Replace " + conflicts + " existing " + (conflicts === 1 ? "day" : "days") + " with the backup's values?")) {
      say("Import cancelled.");
      return;
    }

    entries = Object.assign(entries, imported);
    save();
    paintAll();
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
    delete entries[selected];
    save();
    paintDay(selected);
    syncTimeInput();
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
    if (event.key !== STORAGE_KEY) return;
    entries = load();
    paintAll();
  });

  // The page was left open past midnight
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || dateKey(new Date()) === today) return;
    today = dateKey(new Date());
    paintAll();
  });

  buildGrid();
})();
