const JOKES_URL = "https://raw.githubusercontent.com/sanchar303/jokes/main/jokes.json";

const NOTES_KEY = "notesText";
const JOKES_CACHE_KEY = "jokesCache";
const JOKES_CACHE_TS_KEY = "jokesCacheTs";
const LAST_TAB_KEY = "lastTab";

const tabs = Array.from(document.querySelectorAll(".tab"));
const views = {
  notes: document.getElementById("view-notes"),
  jokes: document.getElementById("view-jokes")
};

function setTab(name) {
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  Object.entries(views).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
  chrome.storage.local.set({ [LAST_TAB_KEY]: name });
}

tabs.forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));

/* Notes */
const notesBox = document.getElementById("notesBox");

async function loadNotes() {
  const data = await chrome.storage.local.get([NOTES_KEY]);
  notesBox.value = data[NOTES_KEY] || "";
}

let notesTimer = null;
notesBox.addEventListener("input", () => {
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    chrome.storage.local.set({ [NOTES_KEY]: notesBox.value || "" });
  }, 250);
});

document.getElementById("clearNotes").addEventListener("click", async () => {
  notesBox.value = "";
  await chrome.storage.local.set({ [NOTES_KEY]: "" });
});

document.getElementById("copyNotes").addEventListener("click", async () => {
  await navigator.clipboard.writeText(notesBox.value || "");
});

/* Jokes */
const jokeTextEl = document.getElementById("jokeText");
const jokeModeEl = document.getElementById("jokeMode");

async function getCachedJokes() {
  const data = await chrome.storage.local.get([JOKES_CACHE_KEY, JOKES_CACHE_TS_KEY]);
  return {
    jokes: Array.isArray(data[JOKES_CACHE_KEY]) ? data[JOKES_CACHE_KEY] : null,
    ts: data[JOKES_CACHE_TS_KEY] || 0
  };
}

async function setCachedJokes(jokes) {
  await chrome.storage.local.set({
    [JOKES_CACHE_KEY]: jokes,
    [JOKES_CACHE_TS_KEY]: Date.now()
  });
}

async function fetchJokes() {
  const cached = await getCachedJokes();
  const oneDay = 24 * 60 * 60 * 1000;

  if (cached.jokes && Date.now() - cached.ts < oneDay) return cached.jokes;

  const res = await fetch(JOKES_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Fetch failed");
  const jokes = await res.json();
  if (!Array.isArray(jokes)) throw new Error("Invalid jokes JSON");

  await setCachedJokes(jokes);
  return jokes;
}

function formatJoke(j) {
  if (!j) return "";
  if (j.type === "twopart") return `${j.setup}\n\n${j.delivery}`;
  return j.joke || "";
}

function filterByMode(jokes, mode) {
  if (mode === "safe") return jokes.filter((j) => j.safe === true);
  if (mode === "unsafe") return jokes.filter((j) => j.safe === false);
  return jokes; // mixed
}

function pickRandom(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function newJoke() {
  jokeTextEl.textContent = "Loading…";
  try {
    const jokes = await fetchJokes();
    const mode = jokeModeEl.value || "mixed";
    const pool = filterByMode(jokes, mode);

    const chosen = pickRandom(pool);
    if (!chosen) {
      jokeTextEl.textContent = "No jokes found for this mode.";
      return;
    }

    jokeTextEl.textContent = formatJoke(chosen) || "Empty joke.";
  } catch {
    jokeTextEl.textContent = "Could not load jokes (offline?)";
  }
}

document.getElementById("newJoke").addEventListener("click", newJoke);

document.getElementById("copyJoke").addEventListener("click", async () => {
  const text = jokeTextEl.textContent || "";
  if (text && text !== "Loading…") await navigator.clipboard.writeText(text);
});

/* Init */
(async function init() {
  const saved = await chrome.storage.local.get([LAST_TAB_KEY]);
  setTab(saved[LAST_TAB_KEY] || "notes");
  await loadNotes();
})();
