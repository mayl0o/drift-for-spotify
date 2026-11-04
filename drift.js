// Drift for Spotify 1.1 (Free) — © bayok. Код відкритий для читання; поширювати змінені копії заборонено — див. LICENSE.
// Pro: https://t.me/Spotify_drift_bot
// NAME: Drift for Spotify
// AUTHOR: bayok
// DESCRIPTION: An endless personal wave that learns from your likes and skips and almost never repeats. Free edition.
// VERSION: 1.1

/* eslint-disable no-console */
(function Volna() {
  "use strict";

  const VERSION = "1.1";
  const TAG = "[Волна]";

  // Особиста збірка Pro: бот підставляє сюди ключ і номер покупця (водяний знак). Порожньо — безкоштовна версія.
  const BUILD = { key: "", buyer: "" };
  // Сервер налаштувань Drift (Supabase Edge Function). Порожньо — працюємо на вбудованих налаштуваннях.
  const CONFIG_URL = "";
  // Збірка: "dev" — усе відкрито (вихідний код), "free" — безкоштовна, "pro" — за ключем підписки. Підставляє tools/build.js.
  const EDITION = "free";
  // Куди вести по Pro (сторінка Boosty). Підставляє tools/build.js.
  const UPGRADE_URL = "https://boosty.to/meenbeens";
  // Пробний Pro на 7 днів — бот видає його за посиланням ?start=trial (один раз на Telegram-акаунт і на встановлення Spotify)
  const TRIAL_URL = "https://t.me/Spotify_drift_bot?start=trial";
  const TRIAL_DAYS = 7;
  // Free дізнається про нову версію з manifest.json на GitHub (Pro — з налаштувань сервера). Підставляє tools/build.js.
  const UPDATE_URL = "https://raw.githubusercontent.com/mayl0o/drift-for-spotify/main/manifest.json";
  const REPO_URL = "https://github.com/mayl0o/drift-for-spotify"; // сторінка Free на GitHub (підставляє tools/build.js)
  const BOT_KEY_URL = "https://t.me/Spotify_drift_bot?start=key";

  // ==================================================================
  // Журнал (видно в «Діагностиці», DevTools не потрібні)
  // ==================================================================
  const journal = [];
  function safeJson(v) { try { return typeof v === "string" ? v : JSON.stringify(v); } catch { return String(v); } }
  function logEvent(msg, data) {
    const line = `${new Date().toLocaleTimeString()}  ${msg}` + (data !== undefined ? `  ${safeJson(data)}` : "");
    journal.push(line);
    if (journal.length > 400) journal.shift();
    console.log(TAG, msg, data ?? "");
  }

  // ==================================================================
  // Чекаємо, поки Spicetify буде готовий
  // ==================================================================
  if (!(window.Spicetify && Spicetify.Platform && Spicetify.Platform.PlayerAPI && Spicetify.Player &&
        Spicetify.Menu && Spicetify.PopupModal && Spicetify.showNotification && Spicetify.LocalStorage &&
        Spicetify.GraphQL && Spicetify.GraphQL.Definitions)) {
    Volna.tries = (Volna.tries || 0) + 1;
    if (Volna.tries > 300) { console.error(TAG, "Spicetify не инициализировался"); return; }
    setTimeout(Volna, 200);
    return;
  }

  // ==================================================================
  // Сховище
  // ==================================================================
  const K = {
    settings: "volna:settings:v3",
    oldSettings: "volna:settings:v2",
    profile: "volna:profile:v6",
    banned: "volna:bannedTracks:v2",
    affinity: "volna:affinity:v2",
    aiList: "volna:aiArtists:v1",
    aiTs: "volna:aiArtistsTs:v1",
    tagPrefix: "volna:tag:v5:",       // компактний формат: [id, назва, "id,id" артистів, ім'я артиста, explicit]
    artistHist: "volna:artistHist:v1", // стара пам'ять артистів по днях — переноситься в artistLast і видаляється
    artistLast: "volna:artistLast:v1", // артист -> [номер останнього прослуховування, скільки разів]
    trackHist: "volna:trackHist:v1",
    playNo: "volna:playNo:v1",       // наскрізний лічильник прослуховувань (для «не повторювати 2000 пісень»)
    artists: "volna:artists:v1",     // кеш артистів (топ-треки, слухачі, схожі)
    lyrics: "volna:lyrics:v1",       // чи є в треку текст
    lastPool: "volna:lastPool:v1",   // кандидати минулого запуску — для миттєвого старту
    remoteCfg: "volna:remoteCfg:v1", // налаштування з сервера (хеші запитів Spotify, розмітка) — останні отримані
    waveLikes: "volna:waveLikes:v1", // лайки, поставлені в хвилі (впливають на хвилю й далі)
    skipHist: "volna:skipHist:v1",   // скіпи артистів за останні дні
    quickSkips: "volna:quickSkips:v1", // треки, скіпнуті в перші 30 с (тиждень не ставимо)
    dislikes: "volna:dislikes:v1",   // дизлайки за артистами: id -> [ts…] (Pro: довга пам'ять)
    dislikeNear: "volna:dislikeNear:v1", // схожі на дизлайкнутих артистів: id -> [вага, ts]
    installId: "volna:installId:v1", // номер встановлення (Pro: на скількох комп'ютерах один ключ)
    stats: "volna:stats:v1",         // результати треків хвилі й підсумки за місяцями («Drift тебе знає», підсумок місяця)
    discovered: "volna:discovered:v1", // артисти, вперше почуті в Drift: id -> ts
    presets: "volna:presets:v1",     // збережені хвилі (Pro)
    proWas: "volna:proWas:v1",       // чи був Pro минулого разу — щоб один раз показати «Pro закінчився»
    trialRemind: "volna:trialRemind:v1", // нагадування «завтра пробний закінчиться» вже було
    recapSeen: "volna:recapSeen:v1", // сповіщення «підсумок місяця готовий» вже було
    recapHide: "volna:recapHide:v1", // плашку підсумку цього місяця закрили хрестиком
    updateSeen: "volna:updateSeen:v1", // про яку нову версію вже сказали
    updateAt: "volna:updateAt:v1",   // коли Free востаннє перевіряв GitHub
  };
  function lsGet(k) { try { return Spicetify.LocalStorage.get(k); } catch { return null; } }
  function lsSet(k, v) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { Spicetify.LocalStorage.set(k, v); return true; }
      catch (e) {
        if (attempt < 2 && /quota/i.test(String(e))) { freeStorage(attempt + 1, k); continue; } // місце скінчилося — чистимо й пробуємо ще раз
        logEvent("Не сохранилось " + k, String(e)); return false;
      }
    }
    return false;
  }
  // Пам'ять Spotify для розширень ~5 МБ на все. Старі версії даних видаляємо, розмітку тримаємо в межах бюджету.
  const TAG_CACHE_BUDGET = 900000;
  function volnaKeys() { try { return Object.keys(localStorage).filter((k) => k.startsWith("volna:")); } catch { return []; } }
  function cleanupStorage() {
    const keep = new Set(Object.values(K));
    let freed = 0;
    for (const k of volnaKeys()) {
      if (keep.has(k) || k.startsWith(K.tagPrefix)) continue;
      try { freed += (localStorage.getItem(k) || "").length; localStorage.removeItem(k); } catch {}
    }
    trimTagCaches(TAG_CACHE_BUDGET);
    if (freed) logEvent("Память: удалены старые данные", { КБ: Math.round(freed / 1024) });
  }
  // розмітка понад бюджет — спершу найстаріша (і не та, що потрібна зараз)
  function trimTagCaches(budget, protect) {
    const rows = volnaKeys().filter((k) => k.startsWith(K.tagPrefix)).map((k) => {
      const v = localStorage.getItem(k) || "";
      const m = /"ts":(\d+)/.exec(v.slice(0, 40));
      return { k, n: v.length, ts: m ? +m[1] : 0 };
    }).sort((a, b) => a.ts - b.ts);
    let total = rows.reduce((x, r) => x + r.n, 0);
    for (const r of rows) {
      if (total <= budget) break;
      if (protect && protect.has(r.k)) continue;
      try { localStorage.removeItem(r.k); total -= r.n; } catch {}
    }
  }
  // Видаляється лише те, що можна завантажити знову. Особисте — профіль, смак, лайки, скіпи, бани,
  // симпатія до артистів, історія треків — не видаляється ніколи.
  // 1-й крок: старі версії + зайва розмітка; 2-й: уся розмітка й кеші (артисти, тексти, пул минулого запуску).
  function freeStorage(level, forKey) {
    try {
      cleanupStorage();
      const active = new Set(activeTags().map((k) => K.tagPrefix + k));
      trimTagCaches(level >= 2 ? 0 : TAG_CACHE_BUDGET / 3, level >= 2 ? null : active);
      if (level >= 2) for (const k of [K.lastPool, K.lyrics, K.artists]) if (k !== forKey) { try { localStorage.removeItem(k); } catch {} }
      logEvent("Память: освобождено место", { шаг: level, для: forKey });
    } catch {}
  }
  function storageUsage() {
    let all = 0, volna = 0;
    try { for (const k of Object.keys(localStorage)) { const n = k.length + (localStorage.getItem(k) || "").length; all += n; if (k.startsWith("volna:")) volna += n; } } catch {}
    return { всегоКБ: Math.round(all / 1024), волнаКБ: Math.round(volna / 1024), лимитКБ: 5120 };
  }
  // Запис на диск пачкою: не на кожен трек, а раз на кілька секунд (і під час закриття Spotify)
  const pendingSaves = new Map(); let saveTimer = 0;
  function saveLater(key, fn) {
    pendingSaves.set(key, fn);
    if (!saveTimer) saveTimer = setTimeout(flushSaves, 5000);
  }
  function flushSaves() {
    saveTimer = 0; // якщо таймер ще попереду — він просто нічого не знайде
    for (const fn of pendingSaves.values()) { try { fn(); } catch {} }
    pendingSaves.clear();
  }

  // ==================================================================
  // Налаштування — як у «Моїй хвилі»: заняття, характер, настрій, мова (+ жанр)
  // ==================================================================
  // Мова інтерфейсу — як у самого Spotify: російська → російською, будь-яка інша → англійською
  const UI_RU = (() => {
    try { return /^ru/i.test((Spicetify.Locale?.getLocale?.()) || navigator.language || ""); } catch { return true; }
  })();
  const L = (ru, en) => (UI_RU ? ru : en);

  const CHARACTERS = [["favorite", L("Любимое", "Favorites")], ["unfamiliar", L("Незнакомое", "Discover")], ["popular", L("Популярное", "Popular")]];
  const MOODS = [["energetic", L("Бодрое", "Energetic")], ["happy", L("Весёлое", "Happy")], ["calm", L("Спокойное", "Calm")], ["sad", L("Грустное", "Sad")]];
  const LANGS = [["ru", L("Русский", "Russian")], ["foreign", L("Иностранный", "Non-Russian")], ["instrumental", L("Без слов", "Instrumental")]];
  const ACTIVITIES = [["wakeup", L("Просыпаюсь", "Waking up")], ["work", L("Работаю", "Working")], ["workout", L("Тренируюсь", "Workout")],
    ["road", L("В дороге", "On the road")], ["sleep", L("Засыпаю", "Falling asleep")]];
  const GENRES = [["rap", L("Рэп", "Rap")], ["phonk", L("Фонк", "Phonk")], ["rock", L("Рок", "Rock")], ["pop", L("Поп", "Pop")],
    ["electronic", L("Электроника", "Electronic")], ["lofi", "Lo-fi"], ["indie", L("Инди", "Indie")], ["metal", L("Метал", "Metal")]];

  const DEFAULTS = {
    character: "",   // '' (звичайна) | favorite | unfamiliar | popular
    mood: "",        // '' | energetic | happy | calm | sad
    language: "",    // '' | ru | foreign | instrumental
    activity: "",    // '' | wakeup | work | workout | road | sleep
    genre: "",       // '' | ключ із GENRES | свій текст
    blockAI: true,
    explicitFilter: false,
    dislikeBanMin: 180,
  };
  function loadSettings() {
    try { const r = lsGet(K.settings); if (r) return { ...DEFAULTS, ...JSON.parse(r) }; } catch {}
    const s = { ...DEFAULTS };
    try { // перенесення зі старої версії
      const o = JSON.parse(lsGet(K.oldSettings) || "null");
      if (o) {
        s.character = { familiar: "favorite", discover: "unfamiliar" }[o.character] || "";
        s.language = { ru: "ru", en: "foreign", nonru: "foreign" }[o.language] || "";
        s.blockAI = o.blockAI !== false;
        s.explicitFilter = !!o.explicitFilter;
      }
    } catch {}
    return s;
  }
  // Pro-налаштування без Pro не діють, але й не стираються: лежать у proStash і повернуться, коли Pro знову відкриється
  const PRO_KEYS = ["mood", "language", "activity", "genre"];
  let proStash = null;
  function saveSettings() { lsSet(K.settings, JSON.stringify(proStash ? { ...settings, ...proStash } : settings)); }
  function gateSettings() {
    if (proActive()) {
      if (proStash) { for (const k of PRO_KEYS) if (!settings[k] && proStash[k]) settings[k] = proStash[k]; proStash = null; sanitizeSettings(); }
      return;
    }
    for (const k of PRO_KEYS) if (settings[k]) { (proStash = proStash || {})[k] = settings[k]; settings[k] = ""; }
  }
  // Несумісні параметри: [що зняти при конфлікті в збережених налаштуваннях, з чим конфліктує]
  const CONFLICTS = [
    [["language", "instrumental"], ["genre", "rap"]],   // репу без слів не буває
    [["language", "instrumental"], ["genre", "pop"]],
    [["mood", "energetic"], ["activity", "sleep"]],     // бадьоре для сну
    [["mood", "calm"], ["activity", "workout"]],        // спокійне для тренування
  ];
  function blockerOf(key, val) {
    for (const [a, b] of CONFLICTS) {
      if (a[0] === key && a[1] === val && settings[b[0]] === b[1]) return b;
      if (b[0] === key && b[1] === val && settings[a[0]] === a[1]) return a;
    }
    return null;
  }
  function sanitizeSettings() {
    for (const [a, b] of CONFLICTS) if (settings[a[0]] === a[1] && settings[b[0]] === b[1]) settings[a[0]] = "";
    // в неросійському інтерфейсі цих варіантів немає — невидимий фільтр не залишаємо
    if (!UI_RU && (settings.language === "ru" || settings.language === "foreign")) settings.language = "";
  }
  let settings = loadSettings();
  sanitizeSettings();

  // Розмітка тегів: кураторські плейлисти Spotify, за якими визначаємо належність треку
  // до жанру / настрою / «без слів» (аналог класифікаторів Яндекса).
  // Розмітки немає у збірках: Free без неї, Pro отримує її із сервера за ключем (tools/build.js вирізає блоки з міткою @markup).
  const TAG_QUERIES = {};
  // Слова для комбінованої розмітки «жанр × настрій»: «sad rap», «грустный рэп», «chill rock»…
  const MOOD_WORDS = {};
  const GENRE_WORDS = {};
  // Як зі слів збираються запити: свій жанр ({g}) і «жанр × настрій» ({m} {g}). Теж приходить із сервера —
  // без ключа шаблонів немає, і жанр із настроєм не дають жодного запиту (раніше жанр збирався прямо в коді).
  const QUERY_TEMPLATES = {};
  const fillTemplates = (list, vars) => (list || []).map((t) => t.replace(/\{(\w)\}/g, (_, k) => vars[k] || ""));
  function tagQueries(key) {
    if (TAG_QUERIES[key]) return TAG_QUERIES[key];
    if (key.startsWith("combo:")) { // combo:<mood|act key>|<genre>
      const [moodKey, genre] = key.slice(6).split("|");
      const g = GENRE_WORDS[genre] || [[genre, "en"], [genre, "ru"]];
      const out = [];
      for (const [m, ml] of MOOD_WORDS[moodKey] || []) for (const [gw, gl] of g) {
        if (ml !== gl) continue;
        out.push(...fillTemplates(ml === "en" ? QUERY_TEMPLATES.comboEn : QUERY_TEMPLATES.comboRu, { m, g: gw }));
      }
      return out;
    }
    if (key.startsWith("genre:")) return fillTemplates(QUERY_TEMPLATES.genre, { g: key.slice(6) });
    return [];
  }
  const isMoodKey = (key) => key.startsWith("mood:") || key.startsWith("act:") || key.startsWith("combo:");
  // Ієрархія умов: мова і жанр — головні (жорсткі); настрій і заняття — нахил поверх жанру.
  // Якщо жанр не вибрано, настрій/заняття стають головною умовою (інакше майже ні на що не впливали б).
  function tagKinds() {
    const hard = [], moodish = [];
    if (settings.genre) hard.push("genre:" + settings.genre);
    if (settings.language === "instrumental") hard.push("lang:instrumental");
    if (settings.mood) moodish.push("mood:" + settings.mood);
    if (settings.activity) moodish.push("act:" + settings.activity);
    // жанр × настрій і «Без слів» × настрій: окрема точна розмітка («грустный рэп», «sad piano»)
    const combo = [];
    if (settings.genre) combo.push(...moodish.map((m) => "combo:" + m + "|" + settings.genre));
    if (settings.language === "instrumental") combo.push(...moodish.map((m) => "combo:" + m + "|instrumental"));
    if (!hard.length) return { hard: moodish, soft: [], combo };
    // без жанру настрій — головна умова (і при «Без слів» теж, інакше Energetic лишається чиловим)
    if (!settings.genre) return { hard: [...hard, ...moodish], soft: [], combo };
    return { hard, soft: moodish, combo };
  }
  function activeTags() { const k = tagKinds(); return [...k.hard, ...k.soft, ...k.combo]; }
  function labelOf(list, v) { const f = list.find((x) => x[0] === v); return f ? f[1] : v; }
  function waveLabel(noSource) {
    const parts = [];
    if (settings.activity) parts.push(labelOf(ACTIVITIES, settings.activity));
    if (settings.character) parts.push(labelOf(CHARACTERS, settings.character));
    if (settings.mood) parts.push(labelOf(MOODS, settings.mood));
    if (settings.language) parts.push(labelOf(LANGS, settings.language));
    if (settings.genre) parts.push(labelOf(GENRES, settings.genre));
    const src = waveSource && !noSource ? L(` по «${waveSource.name || "…"}»`, ` from “${waveSource.name || "…"}”`) : "";
    return "Drift for Spotify" + src + (parts.length ? " · " + parts.join(" · ") : "");
  }
  // Хвиля за плейлистом / артистом: { type, uri, name, tracks, trackSet, artists, related }
  let waveSource = null;

  // ==================================================================
  // Утиліти
  // ==================================================================
  const idOf = (uri) => (uri || "").split(":").pop();
  const isCyrillic = (s) => /[Ѐ-ӿ]/.test(s || "");
  // Мова за артистом: якщо хоч один його трек із кирилицею — артист російськомовний
  // (інакше LIL KRYSTALLL, FACE, OBLADAET тощо з латинськими іменами проходили як «іноземні»).
  const artistLang = new Map(); // artistUri -> { cyr, total }
  function noteArtistLang(t) {
    if (!t || !t.artistUri) return;
    const o = artistLang.get(t.artistUri) || { cyr: 0, total: 0 };
    o.total++;
    if (isCyrillic(t.name) || isCyrillic(t.artistName)) o.cyr++;
    artistLang.set(t.artistUri, o);
  }
  const langChecked = new Set(); // артисти, чиї топ-треки ми перевірили повністю
  function isRuTrack(t) {
    if (isCyrillic(t.name) || isCyrillic(t.artistName)) return true;
    const list = t.artistUris && t.artistUris.length ? t.artistUris : (t.artistUri ? [t.artistUri] : []);
    return list.some((u) => (artistLang.get(u)?.cyr || 0) > 0); // зокрема фіти з російськомовними
  }
  function sampleArr(arr, n) {
    if (!arr || !arr.length || n <= 0) return [];
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  }
  function weightedSample(items, n, weightOf) {
    const pool = items.map((x) => ({ x, w: Math.max(0.05, weightOf(x)) }));
    const out = [];
    while (out.length < n && pool.length) {
      const total = pool.reduce((s, p) => s + p.w, 0);
      let r = Math.random() * total, i = 0;
      for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
      out.push(pool[i].x); pool.splice(i, 1);
    }
    return out;
  }
  function collectUris(obj, type, acc) {
    acc = acc || new Set();
    if (!obj) return acc;
    if (typeof obj === "string") { if (obj.startsWith(`spotify:${type}:`)) acc.add(obj); return acc; }
    if (Array.isArray(obj)) { for (const v of obj) collectUris(v, type, acc); return acc; }
    if (typeof obj === "object") for (const k in obj) collectUris(obj[k], type, acc);
    return acc;
  }

  // ==================================================================
  // GraphQL (операції реєструються ліниво — збираємо визначення самі)
  // ==================================================================
  const DEF_HASHES = {
    queryArtistRelated: "3d031d6cb22a2aa7c8d203d49b49df731f58b1e2799cc38d9876d58771aa66f3",
    internalLinkRecommenderTrack: "c77098ee9d6ee8ad3eb844938722db60570d040b49f41f5ec6e7be9160a7c86b",
    searchTracks: "b02683192a98dde7966b5e6655a79eeb62713eab703eda9902c932818dd52751",
    searchPlaylists: "d520014e748f9ea44f7707d8df1819867ac1205e8b7f3e28f22fe5fc858921b1",
    queryArtistOverview: "9f8134ef565e78621f1e1793555bd6633c5ac144ae0f89604ed3ae3f80b3c8e6",
    userTopContent: "61b7353d3625780022dbc63d459eb64cd609e7e5e2a820f9160d65030efe2e15",
  };
  // ---------------- Налаштування із сервера ----------------
  // «Секрети», які Spotify може зламати оновленням (хеші внутрішніх запитів, пошукові запити розмітки),
  // приходять із сервера раз на добу за ключем Pro. Немає відповіді — працюємо на останніх отриманих, потім на вбудованих.
  const remote = { ok: false, at: 0, reason: "", until: 0, trial: false, triedAt: 0, top: null };
  const ownDefs = new Set(); // описи запитів, які зібрала хвиля (а не сам Spotify)
  function applyRemoteConfig(cfg) {
    if (!cfg || typeof cfg !== "object") return;
    if (cfg.hashes) for (const [k, v] of Object.entries(cfg.hashes)) if (typeof v === "string" && /^[0-9a-f]{64}$/.test(v)) {
      if (DEF_HASHES[k] !== v) { DEF_HASHES[k] = v; if (ownDefs.has(k)) { delete Spicetify.GraphQL.Definitions[k]; ownDefs.delete(k); } } // наше — перезбереться з новим хешем; рідне Spotify не чіпаємо
    }
    if (cfg.tagQueries) for (const [k, v] of Object.entries(cfg.tagQueries)) if (Array.isArray(v) && v.length) TAG_QUERIES[k] = v.map(String);
    if (cfg.latest && typeof cfg.latest.version === "string") noteLatest(cfg.latest.version, cfg.latest.note);
    const pairs = (v) => Array.isArray(v) && v.length && v.every((p) => Array.isArray(p) && p.length === 2);
    for (const [field, target] of [["moodWords", MOOD_WORDS], ["genreWords", GENRE_WORDS]]) {
      if (cfg[field]) for (const [k, v] of Object.entries(cfg[field])) if (pairs(v)) target[k] = v.map(([w, l]) => [String(w), String(l)]);
    }
    if (cfg.queryTemplates && typeof cfg.queryTemplates === "object")
      for (const [k, v] of Object.entries(cfg.queryTemplates)) if (Array.isArray(v) && v.length) QUERY_TEMPLATES[k] = v.map(String);
  }
  // Pro відкритий, поки ключ діє, і ще 3 дні після (продовження на Boosty буває не миттєвим)
  const PRO_GRACE_MS = 3 * 86400000;
  function proActive() {
    if (EDITION === "dev") return true;
    if (EDITION !== "pro" || !CONFIG_URL || !BUILD.key) return false;
    return remote.until > 0 && Date.now() < remote.until + (remote.trial ? 0 : PRO_GRACE_MS); // у пробного запасу немає
  }
  function loadCachedRemote() {
    try {
      const c = JSON.parse(lsGet(K.remoteCfg) || "null");
      if (c && c.cfg) { applyRemoteConfig(c.cfg); remote.at = c.at || 0; remote.ok = true; remote.until = Date.parse(c.until || "") || 0; remote.trial = !!c.trial; remote.top = c.top || null; }
    } catch {}
  }
  // Хеш акаунта Spotify (SHA-256 із сіллю; саме ім'я нікуди не йде) — пробний Pro дається один раз на акаунт
  let acctHash = "";
  async function accountHash() {
    if (acctHash) return acctHash;
    try {
      const u = await Spicetify.Platform.UserAPI.getUser();
      if (!u || !u.username) return "";
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("spotify-drift:" + u.username));
      acctHash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {}
    return acctHash;
  }
  // номер цього встановлення — сервер за ним бачить, на скількох комп'ютерах працює один ключ
  function installId() {
    let id = lsGet(K.installId);
    if (!id) { id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); lsSet(K.installId, id); }
    return id;
  }
  // Pro вимкнувся (скінчився строк / ключ вимкнено) — розмітка із сервера не повинна лишатися на диску:
  // прибираємо її з пам'яті, зі збережених налаштувань сервера і кеші розмітки. Продовження поверне все з першою відповіддю сервера.
  function dropServerMarkup() {
    for (const o of [TAG_QUERIES, MOOD_WORDS, GENRE_WORDS, QUERY_TEMPLATES]) for (const k of Object.keys(o)) delete o[k];
    try {
      const c = JSON.parse(lsGet(K.remoteCfg) || "null");
      if (c && c.cfg && (c.cfg.tagQueries || c.cfg.moodWords || c.cfg.genreWords || c.cfg.queryTemplates)) {
        delete c.cfg.tagQueries; delete c.cfg.moodWords; delete c.cfg.genreWords; delete c.cfg.queryTemplates;
        lsSet(K.remoteCfg, JSON.stringify(c));
      }
    } catch {}
    for (const k of volnaKeys()) if (k.startsWith(K.tagPrefix)) { try { localStorage.removeItem(k); } catch {} }
    try { tagPools.clear(); } catch {}
  }
  // «Pro закінчився» показуємо, лише коли сервер уже відповів: раптом ключ якраз продовжився
  let remoteChecked = false, endModalPending = false;
  async function refreshRemoteConfig(force) {
    try { await refreshRemoteOnce(force); }
    finally {
      remoteChecked = true;
      if (endModalPending) { endModalPending = false; if (!proActive()) showProEndedModal(); }
    }
  }
  async function refreshRemoteOnce(force) {
    if (!CONFIG_URL) return;
    // Pro працює — раз на добу; Pro вимкнений — раз на 15 хв (підписався — Pro увімкнеться сам, без перезапуску)
    if (!force && (proActive() ? Date.now() - remote.at < 20 * 3600000 : Date.now() - remote.triedAt < 15 * 60000)) return;
    remote.triedAt = Date.now();
    try {
      // ключ — у заголовку, а не в адресі (адреси осідають у журналах)
      const res = await fetch(CONFIG_URL + "?v=" + encodeURIComponent(VERSION), {
        method: "GET", headers: { "X-Drift-Key": BUILD.key || "", "X-Drift-Install": installId(), "X-Drift-Acct": await accountHash(), "X-Drift-Stats": statsForBot() },
      });
      const data = await res.json().catch(() => null);
      if (data && data.ok && data.cfg) {
        applyRemoteConfig(data.cfg);
        remote.ok = true; remote.at = Date.now(); remote.reason = "";
        remote.until = Date.parse(data.expiresAt || "") || 0;
        remote.trial = !!data.trial;
        remote.top = data.top && typeof data.top === "object" ? data.top : null; // { "2026-10": 8 } — «топ 8% за відкриттями»
        lsSet(K.remoteCfg, JSON.stringify({ at: remote.at, cfg: data.cfg, until: data.expiresAt || null, trial: remote.trial, top: remote.top }));
        logEvent("Настройки с сервера получены", { до: data.expiresAt || "—" });
      } else {
        remote.reason = (data && data.reason) || "HTTP " + res.status;
        if (data && typeof data.trial === "boolean") remote.trial = data.trial;
        // ключ вимкнено, невідомий або пробний на цьому встановленні вже був — Pro закривається одразу; «минув» — ще 3 дні (підписка)
        if (["revoked", "unknown-key", "trial-used", "trial-device"].includes(remote.reason)) {
          remote.until = 0;
          try { const c = JSON.parse(lsGet(K.remoteCfg) || "null"); if (c) { c.until = null; lsSet(K.remoteCfg, JSON.stringify(c)); } } catch {}
        }
        logEvent("Сервер настроек отказал", remote.reason);
      }
    } catch (e) {
      remote.reason = String(e); logEvent("Сервер настроек недоступен — работаю на сохранённых", String(e));
      if (!remote.ok) setTimeout(() => refreshRemoteConfig(true).catch(() => {}), 5 * 60000); // ще жодного разу не отримували — пробуємо частіше
    }
    onProChanged();
  }
  function getDef(name) {
    const D = Spicetify.GraphQL.Definitions;
    if (D[name]) return D[name];
    const hash = DEF_HASHES[name];
    if (!hash) return null;
    const sample = Object.values(D).find((v) => v && typeof v === "object" && v.constructor && v.constructor !== Object);
    try {
      if (sample) { const def = new sample.constructor(name, "query", hash, null); D[name] = def; ownDefs.add(name); return def; }
    } catch (e) { logEvent("getDef: конструктор не сработал для " + name, String(e)); }
    const flat = { name, operationName: name, operation: "query", sha256Hash: hash, value: null };
    D[name] = flat; ownDefs.add(name);
    return flat;
  }
  // Обмежувач запитів: не більше NET_MAX одночасно (пачки по 30–50 Spotify може різати),
  // термінове (те, що потрібне для найближчого треку) — попереду фонового довантаження.
  const NET_MAX = 8;
  const netQ = [[], []]; // 0 — термінове, 1 — фон
  let netActive = 0;
  function netPrio() { try { return S.starting || S.urgentPick ? 0 : 1; } catch { return 0; } } // старт і підбір наступного треку — наперед
  function net(fn, prio) {
    return new Promise((resolve, reject) => {
      netQ[prio == null ? netPrio() : prio].push({ fn, resolve, reject });
      netPump();
    });
  }
  function netPump() {
    while (netActive < NET_MAX) {
      const job = netQ[0].shift() || netQ[1].shift();
      if (!job) return;
      netActive++;
      Promise.resolve().then(job.fn).then(job.resolve, job.reject)
        .finally(() => { netActive--; netPump(); });
    }
  }
  const gqlStats = {};
  async function gql(name, variables, prio) {
    const def = getDef(name);
    if (!def) throw new Error("нет GraphQL-операции " + name);
    const st = gqlStats[name] || (gqlStats[name] = { ok: 0, err: 0 });
    try {
      const res = await net(() => Spicetify.GraphQL.Request(def, variables), prio);
      if (res && res.errors && res.errors.length) {
        st.err++;
        if (st.err <= 2) logEvent(name + ": ошибки GraphQL", res.errors.slice(0, 2));
      } else st.ok++;
      return res && res.data !== undefined ? res.data : res;
    } catch (e) { st.err++; throw e; }
  }

  // кількість прослуховувань усіх побачених треків — підставляємо трекам із плейлистів (у них її немає)
  const knownPlaycount = new Map();
  function trackFromGql(d) {
    if (!d || (d.__typename && d.__typename !== "Track") || typeof d.uri !== "string" || !d.uri.startsWith("spotify:track:")) return null;
    const a = d.artists?.items?.[0];
    const pc = parseInt(d.playcount || "0", 10) || 0;
    if (pc) knownPlaycount.set(d.uri, pc);
    return {
      uri: d.uri, name: d.name, artistUri: a?.uri, artistName: a?.profile?.name,
      artistUris: (d.artists?.items || []).map((x) => x?.uri).filter(Boolean), // усі артисти, включно з фітами
      explicit: d.contentRating?.label === "EXPLICIT", playcount: parseInt(d.playcount || "0", 10) || 0,
    };
  }

  // ==================================================================
  // Джерела даних (із кешем на сесію)
  // ==================================================================
  // Селектор «схоже на трек»
  const recCache = new Map();
  function recommendByTrack(uri, prio) {
    if (recCache.has(uri)) return recCache.get(uri);
    const p = (async () => {
      try {
        const data = await gql("internalLinkRecommenderTrack", { uri, limit: 20 }, prio);
        return (data?.seoRecommendedTrack?.items || []).map((it) => trackFromGql(it?.data)).filter(Boolean);
      } catch (e) { logEvent("рекомендатель: ошибка", String(e)); return []; }
    })();
    recCache.set(uri, p);
    return p;
  }

  // Схожі артисти
  const relCache = new Map();
  function relatedArtists(artistUri) {
    if (relCache.has(artistUri)) return relCache.get(artistUri);
    const disk = artistDisk[idOf(artistUri)];
    if (disk && disk.r && Date.now() - disk.rt < REL_TTL) {
      const p = Promise.resolve(disk.r.map(AU));
      relCache.set(artistUri, p);
      return p;
    }
    const p = (async () => {
      try {
        const data = await gql("queryArtistRelated", { uri: artistUri });
        const items = data?.artistUnion?.relatedContent?.relatedArtists?.items || [];
        let uris = items.map((a) => a?.uri).filter((u) => typeof u === "string" && u.startsWith("spotify:artist:"));
        if (!uris.length) uris = [...collectUris(data, "artist")];
        uris = uris.filter((u) => u !== artistUri);
        if (uris.length) {
          const d = artistDisk[idOf(artistUri)] || (artistDisk[idOf(artistUri)] = {});
          d.r = uris.map(idOf); d.rt = Date.now();
          saveLater("artists", saveArtistDisk);
        }
        return uris;
      } catch (e) { logEvent("похожие артисты: ошибка", String(e)); return []; }
    })();
    relCache.set(artistUri, p);
    return p;
  }

  // Топ-треки артиста (+ запам'ятовуємо його місячних слухачів — мірило «розкрученості»)
  const artistFame = new Map(); // artistUri -> monthlyListeners
  const ovCache = new Map();

  // Кеш артистів на диску (localStorage Spotify — у користувача, нікуди не надсилається).
  // Лише витяг (~1 КБ на артиста), не більше ARTIST_CACHE_MAX артистів, старе викидається.
  const ARTIST_CACHE_MAX = 700, OV_TTL = 5 * 86400000, REL_TTL = 14 * 86400000;
  // id -> { t, n: ім'я, l: слухачі, tr: [[id, назва, прослуховування, explicit, "id,id" артистів, ім'я 1-го артиста | 0]], r: [id схожих], rt }
  let artistDisk = {};
  const AU = (id) => "spotify:artist:" + id, TU = (id) => "spotify:track:" + id;
  function loadArtistDisk() {
    try { artistDisk = JSON.parse(lsGet(K.artists) || "{}") || {}; } catch { artistDisk = {}; }
    const now = Date.now();
    for (const [id, e] of Object.entries(artistDisk)) {
      if (!e || typeof e !== "object") { delete artistDisk[id]; continue; }
      if (e.t && now - e.t > OV_TTL) { delete e.t; delete e.tr; delete e.l; delete e.n; }
      if (e.rt && now - e.rt > REL_TTL) { delete e.r; delete e.rt; }
      if (!e.t && !e.rt) { delete artistDisk[id]; continue; }
      if (e.t) applyOverview(AU(id), e); // мова, слухачі й прослуховування відомі одразу
    }
  }
  function saveArtistDisk() {
    let rows = Object.entries(artistDisk);
    const fresh = (e) => Math.max(e.t || 0, e.rt || 0);
    if (rows.length > ARTIST_CACHE_MAX) {
      rows = rows.sort((a, b) => fresh(b[1]) - fresh(a[1])).slice(0, ARTIST_CACHE_MAX);
      artistDisk = Object.fromEntries(rows);
    }
    if (!lsSet(K.artists, JSON.stringify(artistDisk))) { // пам'ять Spotify переповнена — лишаємо свіжу половину
      rows = rows.sort((a, b) => fresh(b[1]) - fresh(a[1])).slice(0, rows.length >> 1);
      artistDisk = Object.fromEntries(rows);
      lsSet(K.artists, JSON.stringify(artistDisk));
    }
  }
  // запис кешу -> треки артиста (+ мова, слухачі, прослуховування)
  function applyOverview(artistUri, e) {
    if (e.l) artistFame.set(artistUri, e.l);
    const out = [];
    for (const [id, name, pc, ex, feats, an] of e.tr || []) {
      const uris = feats ? feats.split(",").map(AU) : [artistUri];
      const t = { uri: TU(id), name, artistUri: uris[0], artistName: an || e.n, artistUris: uris,
        explicit: !!ex, playcount: pc || 0, listeners: e.l || 0 };
      if (pc) knownPlaycount.set(t.uri, pc);
      noteArtistLang({ ...t, artistUri, artistName: e.n }); // мову рахуємо за цього артиста
      out.push(t);
    }
    if (isCyrillic(e.n)) noteArtistLang({ uri: "", name: e.n, artistUri, artistName: e.n });
    langChecked.add(artistUri);
    return out;
  }
  function artistOverviewTracks(artistUri) {
    if (ovCache.has(artistUri)) return ovCache.get(artistUri);
    const disk = artistDisk[idOf(artistUri)];
    if (disk && disk.tr && Date.now() - disk.t < OV_TTL) {
      const p = Promise.resolve(applyOverview(artistUri, disk));
      ovCache.set(artistUri, p);
      return p;
    }
    const p = (async () => {
      try {
        const data = await gql("queryArtistOverview", { uri: artistUri, locale: "", includePrerelease: false });
        const au = data?.artistUnion;
        if (!au) return [];
        const aname = au.profile?.name || "";
        const e = { t: Date.now(), n: aname, l: parseInt(au.stats?.monthlyListeners || "0", 10) || 0, tr: [] };
        for (const it of au.discography?.topTracks?.items || []) {
          const t = trackFromGql(it?.track || it?.data);
          if (!t) continue;
          e.tr.push([idOf(t.uri), t.name || "", t.playcount || 0, t.explicit ? 1 : 0,
            (t.artistUris || []).map(idOf).join(","), t.artistName && t.artistName !== aname ? t.artistName : 0]);
        }
        if (!e.tr.length && !e.l) return [];
        const d = artistDisk[idOf(artistUri)] || (artistDisk[idOf(artistUri)] = {});
        Object.assign(d, e);
        saveLater("artists", saveArtistDisk);
        return applyOverview(artistUri, d);
      } catch (e) { logEvent("треки артиста: ошибка", String(e)); return []; }
    })();
    ovCache.set(artistUri, p);
    return p;
  }

  // Твоя історія прослуховувань Spotify (топ за кількістю прослуховувань / останні)
  async function fetchTop(artistRange, artistSort, trackRange, trackSort, limit) {
    const build = (lim) => ({
      includeTopArtists: true,
      topArtistsInput: { offset: 0, limit: lim, sortBy: artistSort, timeRange: artistRange },
      includeTopTracks: true,
      topTracksInput: { offset: 0, limit: lim, sortBy: trackSort, timeRange: trackRange },
    });
    for (const lim of [limit || 50, 20]) {
      try {
        const data = await gql("userTopContent", build(lim));
        const prof = data?.me?.profile;
        if (!prof) continue;
        const artists = (prof.topArtists?.items || []).map((i) => i?.data)
          .filter((a) => a && typeof a.uri === "string").map((a) => ({ uri: a.uri, name: a.profile?.name || "" }));
        const tracks = (prof.topTracks?.items || []).map((i) => trackFromGql(i?.data)).filter(Boolean);
        return { artists, tracks, ok: true };
      } catch (e) { logEvent("история Spotify: ошибка", String(e)); }
    }
    return { artists: [], tracks: [], ok: false };
  }

  // Улюблені треки
  async function fetchLikedTracks() {
    const out = [];
    const lib = Spicetify.Platform.LibraryAPI;
    if (lib && typeof lib.getTracks === "function") {
      try {
        let offset = 0; const limit = 200;
        while (out.length < 2000) {
          const res = await lib.getTracks({ limit, offset, sort: { field: "ADDED_AT", order: "DESC" } });
          const items = (res && (res.items || res.tracks)) || [];
          if (!items.length) break;
          for (const it of items) {
            const uri = it.uri || it.link;
            const a = it.artists && it.artists[0];
            if (uri) out.push({ uri, name: it.name, artistUri: a?.uri, artistName: a?.name,
              artistUris: (it.artists || []).map((x) => x?.uri).filter(Boolean), at: Date.parse(it.addedAt || "") || 0 });
          }
          offset += items.length;
          if (items.length < limit) break;
        }
      } catch (e) { logEvent("Любимые: ошибка LibraryAPI", String(e)); }
    }
    return out;
  }

  // Лайки, поставлені будь-де в Spotify (не лише в хвилі), підтягуються одразу: одна сторінка свіжих
  // лайків під час запуску хвилі й раз на 10 хвилин — не чекаємо перезбирання профілю (раз на 12 годин).
  let likesSyncAt = 0;
  async function syncRecentLikes(force) {
    if (!profile || (!force && Date.now() - likesSyncAt < 10 * 60000)) return;
    likesSyncAt = Date.now();
    try {
      const res = await Spicetify.Platform.LibraryAPI.getTracks({ limit: 50, offset: 0, sort: { field: "ADDED_AT", order: "DESC" } });
      const fresh = [];
      for (const it of ((res && (res.items || res.tracks)) || []).slice(0, 50)) {
        const uri = it.uri || it.link;
        if (!uri || P.likedTracks.has(uri)) continue;
        const a = it.artists && it.artists[0];
        const t = { uri, name: it.name, artistUri: a?.uri, artistName: a?.name, artistUris: (it.artists || []).map((x) => x?.uri).filter(Boolean),
          at: Date.parse(it.addedAt || "") || Date.now() };
        P.likedTracks.add(uri); P.heard.add(uri); P.likeAt.set(uri, t.at);
        if (t.artistUri) P.familiarIds.add(idOf(t.artistUri));
        if (t.artistName) P.familiarNames.add(t.artistName.toLowerCase());
        noteArtistLang(t);
        (isRuTrack(t) ? P.byLang.ru : P.byLang.foreign).unshift(uri);
        fresh.push(t);
      }
      if (!fresh.length) return;
      P.likedItems = [...fresh, ...P.likedItems].slice(0, 2000);
      Object.assign(profile, { likedTracks: [...P.likedTracks], likedItems: P.likedItems, heard: [...P.heard],
        familiarIds: [...P.familiarIds], familiarNames: [...P.familiarNames], byLang: P.byLang });
      saveLater("profile", () => lsSet(K.profile, JSON.stringify(profile)));
      for (const t of fresh.slice(0, 10)) if (t.artistUri) learnTasteFromLike(t.artistUri).catch(() => {});
      logEvent("Новые лайки из библиотеки", fresh.length);
    } catch (e) { logEvent("свежие лайки: ошибка", String(e)); }
  }

  // Чи є в треку текст (= вокал). true — є, false — точно немає (404), null — не вдалося дізнатися.
  // Відповідь майже не змінюється — пам'ятаємо на диску (id -> 1/0), не більше LYRICS_MAX треків.
  const lyricsKnown = new Map();
  const lyricsReq = new Map();
  const LYRICS_MAX = 6000;
  let lyricsDisk = {};
  function loadLyricsDisk() {
    try { lyricsDisk = JSON.parse(lsGet(K.lyrics) || "{}") || {}; } catch { lyricsDisk = {}; }
    for (const [id, v] of Object.entries(lyricsDisk)) lyricsKnown.set(TU(id), !!v);
  }
  function saveLyricsDisk() {
    const keys = Object.keys(lyricsDisk);
    if (keys.length > LYRICS_MAX) for (const k of keys.slice(0, keys.length - LYRICS_MAX)) delete lyricsDisk[k]; // старі — першими
    lsSet(K.lyrics, JSON.stringify(lyricsDisk));
  }
  // Spotify обмежує часті запити до текстів (429) — тоді пауза, що зростає до години
  let lyricsPauseUntil = 0, lyricsPauseMin = 10;
  function checkLyrics(uri, prio) {
    if (lyricsKnown.has(uri)) return Promise.resolve(lyricsKnown.get(uri));
    if (Date.now() < lyricsPauseUntil) return Promise.resolve(null);
    if (lyricsReq.has(uri)) return lyricsReq.get(uri);
    const p = (async () => {
      let v = null;
      try {
        const res = await net(() => Spicetify.CosmosAsync.get(
          `https://spclient.wg.spotify.com/color-lyrics/v2/track/${idOf(uri)}?format=json&vocalRemoval=false&market=from_token`), prio);
        if (res && res.code === 429) {
          lyricsPauseUntil = Date.now() + lyricsPauseMin * 60000;
          logEvent("Тексты: Spotify просит паузу (429)", { минут: lyricsPauseMin });
          lyricsPauseMin = Math.min(60, lyricsPauseMin * 2);
          lyricsReq.delete(uri);
          return null;
        }
        if (res && res.code === 404) v = false;
        const lines = res?.lyrics?.lines;
        if (Array.isArray(lines)) { v = lines.length > 0; lyricsPauseMin = 10; }
      } catch (e) {
        if (/404|not found/i.test(String(e && (e.status || e.message || e)))) v = false;
      }
      if (v !== null) {
        lyricsKnown.set(uri, v);
        lyricsDisk[idOf(uri)] = v ? 1 : 0;
        saveLater("lyrics", saveLyricsDisk);
      }
      return v;
    })();
    lyricsReq.set(uri, p);
    return p;
  }

  // Лайк поточного треку Spotify знає локально (сердечко в плеєрі) — без запиту в мережу.
  // Якщо в цій збірці getHeart не віддає true/false — питаємо бібліотеку, як раніше.
  let heartApi = false;
  function probeHeart() {
    try { const h = Spicetify.Player.getHeart?.(); if (typeof h === "boolean") { heartApi = true; return h; } } catch {}
    return null;
  }
  async function isLiked(uri) {
    try {
      const r = await Spicetify.Platform.LibraryAPI.contains(uri);
      return Array.isArray(r) ? !!r[0] : !!r;
    } catch { return false; }
  }

  // Плейлисти
  async function searchPlaylistUris(q) {
    try {
      const data = await gql("searchPlaylists", {
        searchTerm: q, offset: 0, limit: 10, numberOfTopResults: 5,
        includeAudiobooks: false, includePreReleases: false, includeAlbumPreReleases: false,
        includeAuthors: false, includeEpisodeContentRatingsV2: false,
      });
      let uris = (data?.searchV2?.playlists?.items || []).map((it) => (it?.data || it)?.uri)
        .filter((u) => typeof u === "string" && u.startsWith("spotify:playlist:"));
      if (!uris.length) uris = [...collectUris(data, "playlist")];
      return uris;
    } catch (e) { logEvent("поиск плейлистов: ошибка", String(e)); return []; }
  }
  async function playlistTracks(uri, limit) {
    try {
      const res = await net(() => Spicetify.Platform.PlaylistAPI.getContents(uri, { limit: limit || 100 }));
      return (res?.items || []).filter(Boolean).map((it) => {
        if (typeof it.uri !== "string" || !it.uri.startsWith("spotify:track:")) return null;
        const a = it.artists && it.artists[0];
        return { uri: it.uri, name: it.name, artistUri: a?.uri, artistName: a?.name, explicit: !!(it.isExplicit || it.explicit),
          artistUris: (it.artists || []).map((x) => x?.uri).filter(Boolean) };
      }).filter(Boolean);
    } catch (e) { logEvent("плейлист не загрузился", String(e)); return []; }
  }

  // ==================================================================
  // Розмітка тегів (жанр / настрій / заняття / без слів)
  // ==================================================================
  const tagPools = new Map();
  function makePool(key, tracks, playlists, extra, own) {
    const uris = new Set(), ids = new Set(), names = new Set(), artists = new Map();
    for (const t of tracks) {
      noteArtistLang(t);
      uris.add(t.uri);
      for (const u of artistsOf(t)) { ids.add(idOf(u)); if (!artists.has(u)) artists.set(u, u === t.artistUri ? t.artistName : ""); }
      if (t.artistName) names.add(t.artistName.toLowerCase());
    }
    const coreIds = new Set(ids); // артисти із самих кураторських плейлистів
    // сусіди за графом схожих артистів — «біля жанру» (андеграунд, якого немає в редакторських плейлистах)
    for (const u of extra || []) { ids.add(idOf(u)); if (!artists.has(u)) artists.set(u, ""); }
    // твоя сцена в жанрі (expandTagByTaste): у ядрі, як артисти з кураторських плейлистів
    for (const u of own || []) { ids.add(idOf(u)); coreIds.add(idOf(u)); if (!artists.has(u)) artists.set(u, ""); }
    return { key, tracks, uris, ids, coreIds, names, playlists, extraCount: (extra || []).length, ownCount: (own || []).length,
      artists: [...artists.entries()].map(([uri, name]) => ({ uri, name, core: coreIds.has(idOf(uri)) })) };
  }
  function genreLevel(pool, c) {
    if (pool.uris.has(c.uri)) return 2;
    if (artistsOf(c).some((u) => pool.coreIds && pool.coreIds.has(idOf(u)))) return 1;
    if (c.artistName && pool.names.has(c.artistName.toLowerCase())) return 1;
    if (c.genreChain && c.genreChain.has(pool.key)) return 1;
    return 0; // лише «схожий артист» — не жанр, а біля нього
  }
  function inPool(pool, c) {
    if (pool.uris.has(c.uri)) return true;
    if (artistsOf(c).some((u) => pool.ids.has(idOf(u)))) return true;
    return !!(c.artistName && pool.names.has(c.artistName.toLowerCase()));
  }
  // Розширення розмітки на крок за графом схожих артистів.
  // Жанр — властивість артиста: схожий на репера з розмітки → теж реп. Настрій/заняття — суворіше (≥2 зв'язків).
  // «Без слів» не розширюємо: вокал — властивість треку, а не артиста.
  async function expandTag(key, tracks) {
    // розширюємо лише жанр: настрій і вокал — властивості треку, а не артиста
    if (!key.startsWith("genre:")) return [];
    const freq = new Map();
    for (const t of tracks) if (t.artistUri) freq.set(t.artistUri, (freq.get(t.artistUri) || 0) + 1);
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
    const ru = ranked.filter((u) => (artistLang.get(u)?.cyr || 0) > 0).slice(0, 25);
    const other = ranked.filter((u) => !((artistLang.get(u)?.cyr || 0) > 0)).slice(0, 25);
    const rels = await Promise.all([...ru, ...other].map(relatedArtists));
    const cnt = new Map();
    rels.forEach((list) => list.forEach((u) => cnt.set(u, (cnt.get(u) || 0) + 1)));
    const minHits = key.startsWith("genre:") ? 1 : 2;
    return [...cnt.entries()].filter(([u, n]) => n >= minHits && !freq.has(u)).map(([u]) => u);
  }
  // Жанр очима твого смаку: твої артисти й уся околиця смаку (там і незнайомі — для «Незнайомого»), здебільшого схожі
  // на артистів жанру, — теж цей жанр. Порівнюємо з усім колом жанру (ядро + схожі на нього), а не лише з ядром:
  // андеграунд схожий не на мейнстрим із редакторських плейлистів, а на інший андеграунд того ж жанру.
  async function expandTagByTaste(pool) {
    if (!pool.key.startsWith("genre:")) return [];
    const taste = waveSource ? waveSource.taste : P.taste;
    const near = [...taste.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map(([u]) => u);
    const cand = [...new Set([...topArtistsNow().slice(0, 40).map((a) => a.uri), ...near])].filter((u) => u && !pool.coreIds.has(idOf(u)));
    const own = [];
    await Promise.all(cand.map(async (u) => {
      const rel = await relatedArtists(u);
      // щонайменше 4 артисти з кола жанру (≥40% його схожих) і хоч один — із самого ядра: щоб у «Рок» не затягнуло твій реп
      const hits = rel.filter((r) => pool.ids.has(idOf(r))).length, core = rel.filter((r) => pool.coreIds.has(idOf(r))).length;
      if (hits >= 4 && hits >= rel.length * 0.4 && core >= 1) own.push(u);
    }));
    return own;
  }
  async function loadTagPool(key) {
    if (tagPools.has(key)) return tagPools.get(key);
    try {
      const c = JSON.parse(lsGet(K.tagPrefix + key) || "null");
      if (c && Date.now() - c.ts < 3 * 86400000 && c.tracks && c.tracks.length &&
        (!key.startsWith("genre:") || Array.isArray(c.own))) { // старий кеш жанру без «твоєї сцени» — перезбираємо
        const tracks = c.tracks.map(([id, name, arts, an, ex]) => {
          const uris = arts ? arts.split(",").map(AU) : [];
          return { uri: TU(id), name, artistUri: uris[0], artistName: an, artistUris: uris, explicit: !!ex };
        });
        const pool = makePool(key, tracks, c.playlists, (c.extra || []).map(AU), (c.own || []).map(AU));
        tagPools.set(key, pool);
        return pool;
      }
    } catch {}
    // для настроїв/занять — більше розмітки: потреково вона має покривати багато музики
    const moodish = key.startsWith("mood:") || key.startsWith("act:") || key.startsWith("combo:");
    const perQuery = moodish ? 3 : 2, maxPlaylists = moodish ? 14 : 10, cap = moodish ? 1200 : 800;
    const found = await Promise.all(tagQueries(key).map(searchPlaylistUris));
    const chosen = [];
    for (const list of found) {
      const editorial = list.filter((u) => idOf(u).startsWith("37i9dQZF1")); // кураторські плейлисти Spotify
      for (const u of (editorial.length ? editorial : list).slice(0, perQuery)) if (!chosen.includes(u)) chosen.push(u);
    }
    const lists = await Promise.all(chosen.slice(0, maxPlaylists).map(playlistTracks));
    const seen = new Set(); const tracks = [];
    for (const l of lists) for (const t of l) if (!seen.has(t.uri)) { seen.add(t.uri); tracks.push(t); }
    const compact = tracks.slice(0, cap);
    compact.forEach(noteArtistLang);
    let extraNow = [], ownNow = [];
    const save = () => {
      if (!compact.length) return;
      lsSet(K.tagPrefix + key, JSON.stringify({ ts: Date.now(), playlists: chosen.length, extra: extraNow.map(idOf), own: ownNow.map(idOf),
        tracks: compact.map((t) => [idOf(t.uri), t.name || "", artistsOf(t).map(idOf).join(","), t.artistName || "", t.explicit ? 1 : 0]) }));
      trimTagCaches(TAG_CACHE_BUDGET, new Set([K.tagPrefix + key]));
    };
    save();
    const pool = makePool(key, compact, chosen.length, []);
    tagPools.set(key, pool);
    // фонові доповнення (схожі, твоя сцена) перезбирають розмітку з усім, що вже відомо
    let current = pool;
    const rebuild = () => { if (tagPools.get(key) !== current) return false; current = makePool(key, compact, chosen.length, extraNow, ownNow); tagPools.set(key, current); save(); return true; };
    logEvent("Разметка «" + key + "»", { плейлистов: chosen.length, треков: compact.length, артистов: pool.artists.length });
    // розширення схожими артистами — у фоні (до 50 запитів): хвиля стартує, не чекаючи його
    if (compact.length && key.startsWith("genre:")) expandTag(key, compact).then(async (extra) => {
      if (extra.length) { extraNow = extra; if (rebuild()) logEvent("Разметка «" + key + "» расширена похожими", extra.length); }
      const own = await expandTagByTaste(current);
      if (!own.length) return;
      ownNow = own;
      if (rebuild()) logEvent("Разметка «" + key + "»: твоя сцена в жанре", own.length);
    }).catch(() => {});
    return pool;
  }
  function activePools() { return activeTags().map((k) => tagPools.get(k)).filter((p) => p && p.tracks.length); }
  function hardPools() { return tagKinds().hard.map((k) => tagPools.get(k)).filter((p) => p && p.tracks.length); }
  function softPools() { return tagKinds().soft.map((k) => tagPools.get(k)).filter((p) => p && p.tracks.length); }
  function comboPools() { return tagKinds().combo.map((k) => tagPools.get(k)).filter((p) => p && p.tracks.length); }

  // ---------- Настрій / заняття — властивість ТРЕКУ ----------
  // Рівні: 2 — трек сам із розмітки цього настрою; 1 — схожий на трек звідти (рекомендатор Spotify
  // від перевіреного треку); 0 — ні. Протилежний настрій (бадьоре при «Спокійному» тощо) відсікається.
  const MOOD_OPPOSITES = {
    "mood:calm": ["mood:energetic", "act:workout"], "mood:energetic": ["mood:calm", "act:sleep"],
    "mood:happy": ["mood:sad"], "mood:sad": ["mood:happy"],
    "act:sleep": ["mood:energetic", "act:workout"], "act:workout": ["mood:calm", "act:sleep"],
    "act:work": ["act:workout"], "act:wakeup": ["act:sleep"], "act:road": [],
  };
  function moodKeysSel() {
    const k = [];
    if (settings.mood) k.push("mood:" + settings.mood);
    if (settings.activity) k.push("act:" + settings.activity);
    return k;
  }
  function oppositeKeys() {
    const sel = moodKeysSel(); const out = new Set();
    for (const k of sel) for (const o of MOOD_OPPOSITES[k] || []) if (!sel.includes(o)) out.add(o);
    return [...out];
  }
  const moodIsHard = () => tagKinds().hard.some((k) => k.startsWith("mood:") || k.startsWith("act:"));
  function moodComboExact(uri, k) {
    for (const cp of comboPools()) if (cp.key.startsWith("combo:" + k + "|") && cp.uris.has(uri)) return true;
    return false;
  }
  function moodExact(uri, k) {
    const p = tagPools.get(k);
    return !!(p && p.uris.has(uri)) || moodComboExact(uri, k);
  }
  function moodLevel(c, k) {
    const p = tagPools.get(k);
    if (!p || !p.tracks.length) return 2; // розмітка не завантажилася — не заважаємо
    if (moodExact(c.uri, k)) return 2;
    return c.moodChain && c.moodChain.has(k) ? 1 : 0;
  }
  function moodLevelAll(c) { const ks = moodKeysSel(); return ks.length ? Math.min(...ks.map((k) => moodLevel(c, k))) : 2; }
  function moodArtistAny(c) { return moodKeysSel().some((k) => { const p = tagPools.get(k); return p && inPool(p, c); }); }
  function isOppositeTrack(c) {
    if (moodKeysSel().some((k) => moodExact(c.uri, k))) return false; // трек і в «своєму» настрої — лишаємо
    return oppositeKeys().some((k) => { const p = tagPools.get(k); return p && p.uris.has(c.uri); });
  }
  function oppositeArtistOnly(c) {
    if (moodArtistAny(c)) return false;
    return oppositeKeys().some((k) => { const p = tagPools.get(k); return p && inPool(p, c); });
  }
  // кандидат, схожий на перевірений трек потрібного настрою, отримує «ланцюжок»
  function markMoodChain(c, seedUri) {
    for (const k of moodKeysSel()) if (moodExact(seedUri, k)) (c.moodChain || (c.moodChain = new Set())).add(k);
    // схожий на трек точно з жанру — теж жанр
    for (const p of hardPools()) if (p.key.startsWith("genre:") && p.uris.has(seedUri)) (c.genreChain || (c.genreChain = new Set())).add(p.key);
  }

  // ==================================================================
  // Профіль смаку: лайки + історія прослуховувань Spotify
  // ==================================================================
  let profile = null;
  const P = {
    likedTracks: new Set(), likedItems: [], likeAt: new Map(), familiarIds: new Set(), familiarNames: new Set(), // likeAt: uri -> дата лайка
    heard: new Set(), byLang: { ru: [], foreign: [] }, topArtists: [],
    topTracks: [],        // твої найбільш слухані треки (історія Spotify) — якорі смаку
    taste: new Map(),     // «околиця смаку»: артист -> наскільки він схожий на твоїх улюблених
  };
  function applyProfile(p) {
    profile = p;
    P.likedTracks = new Set(p.likedTracks || []);
    P.likedItems = p.likedItems || [];
    P.likeAt = new Map(P.likedItems.filter((t) => t.at).map((t) => [t.uri, t.at]));
    for (const l of waveLikes) if (l[4] && !P.likeAt.has(TU(l[0]))) P.likeAt.set(TU(l[0]), l[4]);
    P.familiarIds = new Set(p.familiarIds || []);
    P.familiarNames = new Set(p.familiarNames || []);
    P.heard = new Set(p.heard || []);
    P.topArtists = p.topArtists || [];
    P.topTracks = p.topTracks || [];
    P.taste = new Map(p.taste || []);
    for (const [id, aid] of waveLikes) { P.likedTracks.add(TU(id)); P.heard.add(TU(id)); if (aid) P.familiarIds.add(aid); }
    for (const t of P.topTracks) noteArtistLang(t);
    // мова лайків — за артистом, а не лише за літерами в назві
    for (const t of P.likedItems) noteArtistLang(t);
    P.byLang = { ru: [], foreign: [] };
    for (const t of P.likedItems) (isRuTrack(t) ? P.byLang.ru : P.byLang.foreign).push(t.uri);
  }
  // «Знайомий» артист: є в лайках або в історії прослуховувань (аналог «слухав > 5 разів» у Яндекса)
  function isFamiliar(c) {
    if (c.artistUri && P.familiarIds.has(idOf(c.artistUri))) return true;
    return !!(c.artistName && P.familiarNames.has(c.artistName.toLowerCase()));
  }

  let profileBg = null;
  async function buildProfile(force, quiet) {
    // профіль без дат лайків (стара версія) — теж застарілий: перезбереться у фоні
    const fresh = (p) => p && Date.now() - p.builtAt < 12 * 3600000 && !(p.likedItems && p.likedItems.length && !p.likedItems[0].at);
    if (!force) {
      if (!profile) { try { const c = JSON.parse(lsGet(K.profile) || "null"); if (c) applyProfile(c); } catch {} }
      if (fresh(profile)) return profile;
      // застарілий профіль — граємо за ним одразу, а свіжий збираємо у фоні
      if (profile) {
        if (!profileBg) profileBg = buildProfile(true, true).then(() => ensureTaste())
          .catch((e) => logEvent("профиль в фоне: ошибка", String(e))).finally(() => { profileBg = null; });
        return profile;
      }
    }
    const liked = await fetchLikedTracks();
    const tops = await Promise.all([
      fetchTop("LONG_TERM", "PLAY_COUNT", "LONG_TERM", "PLAY_COUNT"),
      fetchTop("MID_TERM", "PLAY_COUNT", "MID_TERM", "PLAY_COUNT"),
      fetchTop("SHORT_TERM", "PLAY_COUNT", "SHORT_TERM", "PLAY_COUNT"),
    ]);

    const names = new Map(); const weight = new Map();
    const familiar = new Set(); const fnames = new Set();
    for (const t of liked) {
      if (t.artistName) fnames.add(t.artistName.toLowerCase());
      if (!t.artistUri) continue;
      familiar.add(idOf(t.artistUri));
      if (t.artistName) names.set(t.artistUri, t.artistName);
      weight.set(t.artistUri, (weight.get(t.artistUri) || 0) + likeWeight(t.at)); // свіжий лайк вагоміший за старий
    }
    // за весь час / пів року / місяць — свіже трохи вагоміше, але помірно: у «місяць» потрапляє й те, що вмикав сам Drift
    const TERM_W = [0.8, 1, 1.2];
    tops.forEach((r, k) => r.artists.forEach((a, i) => {
      familiar.add(idOf(a.uri));
      if (a.name) { fnames.add(a.name.toLowerCase()); names.set(a.uri, a.name); }
      weight.set(a.uri, (weight.get(a.uri) || 0) + Math.max(1, (50 - i) / 8) * TERM_W[k]);
    }));
    const topArtists = [...weight.entries()].sort((x, y) => y[1] - x[1]).slice(0, 80)
      .map(([uri, w]) => ({ uri, name: names.get(uri) || "", weight: w }));
    const heard = new Set(liked.map((t) => t.uri));
    tops.forEach((r) => r.tracks.forEach((t) => heard.add(t.uri)));
    const byLang = { ru: [], foreign: [] };
    for (const t of liked) (isCyrillic(t.name) || isCyrillic(t.artistName) ? byLang.ru : byLang.foreign).push(t.uri);
    // найбільш слухані треки: недавні — першими
    const seenTop = new Set(); const topTracks = [];
    for (const r of [tops[2], tops[1], tops[0]]) for (const t of r.tracks) if (!seenTop.has(t.uri)) { seenTop.add(t.uri); topTracks.push(t); }

    const p = {
      builtAt: Date.now(),
      likedTracks: liked.map((t) => t.uri),
      likedItems: liked.slice(0, 2000),
      familiarIds: [...familiar], familiarNames: [...fnames],
      heard: [...heard], byLang, topArtists, topTracks: topTracks.slice(0, 150),
      taste: profile && Array.isArray(profile.taste) ? profile.taste : [], tasteAt: 0, // старий смак — поки не перераховано
      historyOk: tops.some((r) => r.ok),
    };
    applyProfile(p);
    lsSet(K.profile, JSON.stringify(p));
    for (const a of topArtists) affinity[a.uri] = Math.max(affinity[a.uri] || 0, Math.min(a.weight / 3, 6));
    saveAffinity();
    logEvent("Профиль собран", {
      лайков: liked.length, знакомыхАртистов: familiar.size, услышанныхТреков: heard.size,
      историяSpotify: p.historyOk,
    });
    return profile;
  }
  // Околиця смаку: схожі на твоїх топ-артистів (за прослуховуваннями). Що до більшої кількості
  // улюблених артистів схожий — то ближче до смаку. Будується раз на 12 годин, далі донавчається на лайках у хвилі.
  async function ensureTaste() {
    if (!P.topArtists.length) return;
    // смак свіжіший за профіль і порахований за нинішніми правилами (tasteV 5: 30 улюблених артистів, лайки за датою) — перераховувати нема чого
    if (P.taste.size && profile?.tasteV === 5 && (profile?.tasteAt || 0) >= (profile?.builtAt || 0)) return;
    // 30 найулюбленіших: ширше (50) — і в коло потрапляли артисти, яких нещодавно вмикав сам Drift, хвиля спливала від смаку
    const top = P.topArtists.slice(0, 30);
    const maxW = Math.max(...top.map((a) => a.weight), 1);
    const rels = await Promise.all(top.map((a) => relatedArtists(a.uri)));
    const taste = new Map();
    rels.forEach((list, i) => {
      const w = 0.5 + top[i].weight / maxW; // що улюбленіший артист — то вагоміші його сусіди
      list.forEach((u) => taste.set(u, (taste.get(u) || 0) + w));
    });
    for (const a of top) taste.set(a.uri, (taste.get(a.uri) || 0) + 1);
    // 100 останніх лайків рухають смак: артист лайка і його схожі ближчі, вага — за датою лайка (свіжі сильніші)
    const likes = recentLikes(100).filter((t) => t.artistUri);
    const artW = new Map();
    for (const t of likes) artW.set(t.artistUri, Math.max(artW.get(t.artistUri) || 0, likeWeightOf(t)));
    const likeArts = [...artW.keys()];
    const likeRels = await Promise.all(likeArts.map((u) => relatedArtists(u)));
    likeArts.forEach((u, i) => {
      const w = artW.get(u);
      taste.set(u, (taste.get(u) || 0) + 1.5 * w);
      likeRels[i].forEach((r) => taste.set(r, (taste.get(r) || 0) + 0.7 * w));
    });
    P.taste = taste;
    saveTaste(true);
    logEvent("Окрестность вкуса", { артистов: taste.size });
  }
  function saveTaste(rebuilt) {
    if (!profile) return;
    if (rebuilt) { profile.tasteAt = Date.now(); profile.tasteV = 5; }
    profile.taste = [...P.taste.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2000);
    lsSet(K.profile, JSON.stringify(profile));
  }
  function tasteOf(c) {
    let t = 0;
    const taste = waveSource ? waveSource.taste : P.taste;
    for (const a of artistsOf(c)) t = Math.max(t, taste.get(a) || 0);
    return Math.min(t, 4);
  }
  // Лайк у хвилі розширює смак: цей артист і його схожі стають ближчими
  async function learnTasteFromLike(artistUri) {
    if (!artistUri) return;
    P.taste.set(artistUri, (P.taste.get(artistUri) || 0) + 1.5);
    const rel = await relatedArtists(artistUri);
    rel.forEach((u) => P.taste.set(u, (P.taste.get(u) || 0) + 0.7));
    saveTaste();
  }
  // Твої найбільш слухані треки під вибрану мову (якорі смаку)
  function topTracksForLang() {
    const lang = settings.language, base = waveSource ? waveSource.tracks : P.topTracks;
    const list = base.filter((t) => lang === "ru" ? isRuTrack(t) : lang === "foreign" ? !isRuTrack(t) : true);
    return list.length >= 3 ? list : base;
  }

  function langSeedBase() {
    if (settings.language === "ru" && P.byLang.ru.length) return P.byLang.ru;
    if (settings.language === "foreign" && P.byLang.foreign.length) return P.byLang.foreign;
    return [...P.likedTracks];
  }

  // ==================================================================
  // Постійна пам'ять: симпатія до артистів, бан треків, список ШІ-артистів
  // ==================================================================
  let affinity = {};
  function loadAffinity() { try { affinity = JSON.parse(lsGet(K.affinity) || "{}") || {}; } catch { affinity = {}; } }
  function saveAffinity() { lsSet(K.affinity, JSON.stringify(affinity)); }
  function bumpAffinity(artistUri, d) {
    if (!artistUri) return;
    affinity[artistUri] = Math.max(-12, Math.min(20, (affinity[artistUri] || 0) + d));
  }

  let bannedTracks = new Set();
  function loadBannedTracks() { try { bannedTracks = new Set(JSON.parse(lsGet(K.banned) || "[]")); } catch { bannedTracks = new Set(); } }
  function saveBannedTracks() { lsSet(K.banned, JSON.stringify([...bannedTracks])); }
  // (у бані і id треків, і ключі пісень «k:артист|назва» — щоб та сама пісня в іншій версії теж не повернулася)
  const bannedTrackCount = () => [...bannedTracks].filter((x) => x.startsWith("spotify:")).length;

  // Дизлайк — надовго (Pro): артист значно нижче ~тиждень, плюс довгий хвіст ~2 місяці, його схожі — слабше
  // (дзеркально до лайка, який розширює смак). 2 дизлайки артиста за 30 днів — прихований на 2 тижні. Назавжди — ніколи.
  // Лайк треку цього артиста дизлайки прощає. Записується завжди (і у Free) — на випадок переходу на Pro.
  const DAY_MS = 86400000;
  let dislikes = {}, dislikeNear = {};
  function loadDislikes() {
    try { dislikes = JSON.parse(lsGet(K.dislikes) || "{}") || {}; } catch { dislikes = {}; }
    try { dislikeNear = JSON.parse(lsGet(K.dislikeNear) || "{}") || {}; } catch { dislikeNear = {}; }
    const now = Date.now();
    for (const [id, a] of Object.entries(dislikes)) {
      const keep = Array.isArray(a) ? a.filter((t) => now - t < 180 * DAY_MS).slice(-5) : [];
      if (keep.length) dislikes[id] = keep; else delete dislikes[id];
    }
    for (const [id, v] of Object.entries(dislikeNear)) if (!Array.isArray(v) || v[0] * Math.exp(-(now - v[1]) / (60 * DAY_MS)) < 0.05) delete dislikeNear[id];
  }
  function saveDislikes() { lsSet(K.dislikes, JSON.stringify(dislikes)); lsSet(K.dislikeNear, JSON.stringify(dislikeNear)); }
  function noteDislike(c) {
    if (!c || !c.artistUri) return;
    const id = idOf(c.artistUri), now = Date.now();
    dislikes[id] = [...(dislikes[id] || []), now].slice(-5);
    saveLater("dislikes", saveDislikes);
    relatedArtists(c.artistUri).then((rel) => {
      for (const u of (rel || []).slice(0, 20)) {
        const r = idOf(u); if (r === id) continue;
        const v = dislikeNear[r], w0 = v ? v[0] * Math.exp(-(now - v[1]) / (60 * DAY_MS)) : 0;
        dislikeNear[r] = [Math.min(w0 + 1, 3), now];
      }
      const rows = Object.entries(dislikeNear);
      if (rows.length > 1500) dislikeNear = Object.fromEntries(rows.sort((a, b) => b[1][1] - a[1][1]).slice(0, 1500));
      saveLater("dislikes", saveDislikes);
    }).catch(() => {});
  }
  function forgiveDislikes(artistUri) {
    const id = idOf(artistUri || "");
    if (dislikes[id]) { delete dislikes[id]; saveLater("dislikes", saveDislikes); }
  }
  function dislikePenalty(artistUri) {
    if (!artistUri || !proActive()) return 0;
    const id = idOf(artistUri), now = Date.now();
    let p = 0;
    for (const ts of dislikes[id] || []) { const age = now - ts; p += 2.5 * Math.exp(-age / (7 * DAY_MS)) + 0.8 * Math.exp(-age / (60 * DAY_MS)); }
    const v = dislikeNear[id];
    if (v) p += 0.4 * v[0] * Math.exp(-(now - v[1]) / (60 * DAY_MS));
    return Math.min(p, 6);
  }
  // ---------------- Статистика: «Drift тебе знає» і підсумок місяця (пишеться завжди, і у Free) ----------------
  let stats = { out: [], months: {} }, discovered = {};
  const monthKey = (ts) => { const d = new Date(ts || Date.now()); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  function loadStats() {
    try { const v = JSON.parse(lsGet(K.stats) || "null"); if (v && Array.isArray(v.out) && v.months) stats = v; } catch {}
    try { discovered = JSON.parse(lsGet(K.discovered) || "{}") || {}; } catch { discovered = {}; }
    const keep = Object.keys(stats.months).sort().slice(-13); // рік із невеликим
    stats.months = Object.fromEntries(keep.map((k) => [k, stats.months[k]]));
    const ids = Object.keys(discovered);
    if (ids.length > 4000) discovered = Object.fromEntries(ids.sort((a, b) => discovered[b] - discovered[a]).slice(0, 4000).map((k) => [k, discovered[k]]));
  }
  function saveStats() { lsSet(K.stats, JSON.stringify(stats)); lsSet(K.discovered, JSON.stringify(discovered)); }
  const prevMonthKey = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthKey(d.getTime()); };
  function monthStats(k) {
    const m = stats.months[k] || (stats.months[k] = { plays: 0, good: 0, likes: 0, skips: 0, dislikes: 0, newA: {}, names: {} });
    // для підсумку місяця: час прослуховування, години доби, дні (крива точності), артисти [звучав, дослуханий, лайк], характер хвилі
    if (m.ms == null) Object.assign(m, { ms: 0, hours: Array(24).fill(0), days: {}, arts: {}, chars: {} });
    return m;
  }
  // артист, якого ти раніше не слухав (не з лайків/історії і не звучав у Drift), — нова знахідка цього місяця
  function noteDiscovery(c) {
    if (!c || !c.artistUri) return;
    const id = idOf(c.artistUri);
    if (discovered[id] || P.familiarIds.has(id)) return;
    discovered[id] = Date.now();
    const m = monthStats(monthKey());
    m.newA[id] = m.newA[id] || 0;
    if (c.artistName) m.names[id] = c.artistName;
    saveLater("stats", saveStats);
  }
  const OUT_CODE = { finished: 1, like: 1, partial: 0.5, skip: 0, dislike: 0 };
  function noteStats(c, outcome, listenedMs) {
    const code = OUT_CODE[outcome];
    if (code == null) return;
    stats.out.push([Date.now(), code]);
    if (stats.out.length > 400) stats.out.splice(0, stats.out.length - 400);
    const m = monthStats(monthKey());
    m.plays++; if (code === 1) m.good++;
    if (outcome === "like") m.likes++; else if (outcome === "skip") m.skips++; else if (outcome === "dislike") m.dislikes++;
    const id = c.artistUri && idOf(c.artistUri);
    if (id && id in m.newA) m.newA[id] += outcome === "like" ? 3 : code === 1 ? 1 : 0; // головна знахідка — більше дослуховувань і лайків
    const now = new Date();
    m.ms += Math.max(0, Math.min(listenedMs || 0, 20 * 60000));
    m.hours[now.getHours()]++;
    const day = m.days[now.getDate()] || (m.days[now.getDate()] = [0, 0, 0]);
    day[0]++; if (code === 1) day[1]++; if (outcome === "skip" || outcome === "dislike") day[2]++;
    const ch = settings.character || "-"; m.chars[ch] = (m.chars[ch] || 0) + 1;
    if (id) {
      const ar = m.arts[id] || (m.arts[id] = [0, 0, 0]);
      ar[0]++; if (code === 1) ar[1]++; if (outcome === "like") ar[2]++;
      if (c.artistName && !m.names[id]) m.names[id] = c.artistName;
      const ids = Object.keys(m.arts);
      if (ids.length > 400) for (const x of ids.sort((p, q) => m.arts[p][0] - m.arts[q][0]).slice(0, ids.length - 400)) if (!(x in m.newA)) { delete m.arts[x]; delete m.names[x]; }
    }
    saveLater("stats", saveStats);
  }
  // Точність хвилі: частка дослуханих і лайкнутих серед останніх 50 треків (недослуханий до половини — половина)
  function waveAccuracy() {
    const avg = (a) => a.reduce((x, o) => x + o[1], 0) / a.length * 100;
    const last = stats.out.slice(-50), now = Date.now(), wk = 7 * 86400000;
    const cur = stats.out.filter((o) => now - o[0] < wk), prev = stats.out.filter((o) => now - o[0] >= wk && now - o[0] < 2 * wk);
    return {
      acc: last.length >= 15 ? Math.round(avg(last)) : null, need: Math.max(0, 15 - last.length),
      delta: cur.length >= 10 && prev.length >= 10 ? Math.round(avg(cur) - avg(prev)) : null,
    };
  }
  // Коротке зведення для сервера: бот пише «пробний закінчується» / «Pro закінчився», сервер рахує «топ X% за відкриттями».
  // Лише лічильники, без назв треків і артистів
  // версія Spotify («1.3.6.1921») — автор дізнається від бота, що Spotify оновився, і перевіряє, чи нічого не зламалося
  function spotifyVersion() {
    const v = (Spicetify.Platform && Spicetify.Platform.version) || (/Spotify\/([\d.]+)/.exec(navigator.userAgent) || [])[1] || "";
    return String(v).slice(0, 24);
  }
  function statsForBot() {
    try {
      const { acc, delta } = waveAccuracy(), wk = Date.now() - 7 * 86400000;
      return JSON.stringify({
        a: Object.keys(artistLast).length, d: Object.keys(dislikes).length, l: waveLikes.length,
        acc, dw: delta, nw: Object.values(discovered).filter((t) => t > wk).length, p7: stats.out.filter((o) => o[0] > wk).length,
        mk: monthKey(), mn: Object.keys(stats.months[monthKey()]?.newA || {}).length,
        pk: prevMonthKey(), pn: Object.keys(stats.months[prevMonthKey()]?.newA || {}).length,
        sv: spotifyVersion(), xv: String((Spicetify.Config && Spicetify.Config.version) || "").slice(0, 16),
      });
    } catch { return "{}"; }
  }
  const fmtN = (n) => Number(n || 0).toLocaleString(UI_RU ? "ru-RU" : "en-US");

  // ---------------- Збережені хвилі (Pro) ----------------
  let presets = [];
  const PRESET_KEYS = ["character", "mood", "language", "activity", "genre"];
  function loadPresets() { try { presets = (JSON.parse(lsGet(K.presets) || "[]") || []).filter((x) => x && x.name && x.s); } catch { presets = []; } }
  function savePresets() { lsSet(K.presets, JSON.stringify(presets.slice(0, 6))); }

  function artistDislikedOut(artistUri) {
    if (!artistUri || !proActive()) return false;
    const a = (dislikes[idOf(artistUri)] || []).slice().sort((x, y) => x - y), n = a.length;
    return n >= 2 && a[n - 1] - a[n - 2] <= 30 * DAY_MS && Date.now() - a[n - 1] < 14 * DAY_MS;
  }
  const bannedArtists = new Map(); // artistUri -> до якого часу
  function isArtistBanned(uri) {
    const until = bannedArtists.get(uri);
    if (!until) return false;
    if (Date.now() > until) { bannedArtists.delete(uri); return false; }
    return true;
  }

  const AI_URL = "https://raw.githubusercontent.com/xoundbyte/soul-over-ai/main/dist/artists.json";
  let aiArtists = new Set();
  function loadAICache() { try { aiArtists = new Set(JSON.parse(lsGet(K.aiList) || "[]")); } catch { aiArtists = new Set(); } }
  async function refreshAIList(force) {
    try {
      const ts = parseInt(lsGet(K.aiTs) || "0", 10);
      if (!force && aiArtists.size && Date.now() - ts < 7 * 86400000) return;
      const arr = await (await fetch(AI_URL)).json();
      const ids = [];
      // чужий список — беремо лише те, що схоже на id артиста Spotify
      for (const a of Array.isArray(arr) ? arr : []) if (a && typeof a.spotify === "string" && /^[0-9A-Za-z]{22}$/.test(a.spotify) && !a.removed) ids.push(a.spotify);
      if (!ids.length) throw new Error("пустой или испорченный список");
      aiArtists = new Set(ids);
      lsSet(K.aiList, JSON.stringify(ids));
      lsSet(K.aiTs, String(Date.now()));
      logEvent("Список ИИ-артистов обновлён", aiArtists.size);
    } catch (e) { logEvent("Список ИИ не загрузился", String(e)); }
  }
  const isAIArtist = (uri) => !!uri && aiArtists.has(idOf(uri));

  // Довга пам'ять артистів — у піснях, а не в днях (як у треків): id артиста -> [номер останнього прослуховування, скільки разів].
  // Поки після артиста не прозвучало ARTIST_GAP інших пісень, він не ставиться, якщо є ким замінити; далі — штраф,
  // який сходить за кілька сотень пісень. Діє між запусками й днями (раніше — лише 25 треків у сесії).
  const ARTIST_GAP = 250, ARTIST_MEM = 3000;
  let artistLast = {};
  function loadArtistHist() { // після loadTrackHist: потрібен playNo
    try { artistLast = JSON.parse(lsGet(K.artistLast) || "null"); } catch { artistLast = null; }
    if (!artistLast || typeof artistLast !== "object") { // перенесення зі старої пам'яті по днях (~3 хв на пісню)
      artistLast = {};
      try {
        const old = JSON.parse(lsGet(K.artistHist) || "{}") || {};
        for (const [u, ts] of Object.entries(old)) if (Array.isArray(ts) && ts.length) {
          artistLast[idOf(u)] = [Math.max(0, playNo - Math.round((Date.now() - Math.max(...ts)) / 180000)), ts.length];
        }
        saveArtistHist();
        localStorage.removeItem(K.artistHist);
      } catch {}
    }
    let rows = Object.entries(artistLast).filter(([, v]) => Array.isArray(v) && playNo - v[0] <= ARTIST_MEM);
    if (rows.length > 4000) rows = rows.sort((a, b) => b[1][0] - a[1][0]).slice(0, 4000);
    artistLast = Object.fromEntries(rows);
  }
  function saveArtistHist() { lsSet(K.artistLast, JSON.stringify(artistLast)); }
  function noteArtistPlayed(uri, no, count) {
    if (!uri) return;
    const id = idOf(uri), v = artistLast[id];
    artistLast[id] = [Math.max(no, v ? v[0] : 0), (v ? v[1] : 0) + (count ? 1 : 0)];
  }
  // скільки пісень прозвучало після артиста (Infinity — давно або жодного разу)
  function artistSince(uri) { const v = artistLast[idOf(uri || "")]; return v ? Math.max(0, playNo - v[0]) : Infinity; }
  // артисти плейлиста/артиста, за яким запущено хвилю, — їх ти попросив сам: довга пам'ять їх не притримує
  function isSourceArtist(uri) {
    if (!waveSource) return false;
    if (!waveSource.artistSet) waveSource.artistSet = new Set(waveSource.topArtists.map((a) => a.uri));
    return waveSource.artistSet.has(uri);
  }
  // «Незнайоме»: артист, що вже прозвучав KNOWN_PLAYS+ разів (у хвилі чи повз неї), — уже не незнайомий,
  // інакше хвиля крутить по колу ту саму сцену «нових» артистів
  const KNOWN_PLAYS = 3;
  function knownArtist(uri) { const v = artistLast[idOf(uri || "")]; return !!v && v[1] >= KNOWN_PLAYS && !isSourceArtist(uri); }
  const notForDiscover = (uri) => P.familiarIds.has(idOf(uri)) || knownArtist(uri);

  // Пам'ять про зіграні хвилею ТРЕКИ (між запусками і зміною налаштувань): uri -> [останній ts, скільки разів].
  // Не заборона назавжди: ~12 год трек не беремо, поки є інші; далі штраф згасає за пару днів.
  // Довга пам'ять зіграного: пісня не повторюється, поки після неї не прозвучить repeatGap() інших
  // (рахуємо в треках, а не в годинах). Запис: ключ пісні (або "t:"+id) -> [ts, скільки разів, номер прослуховування].
  // Накопичується з власного запису хвилі + кожні 10 хв з історії Spotify (вона віддає лише останні ~500).
  let trackHist = {};
  let playNo = 0; // наскрізний лічильник прослуховувань
  const TRACK_HIST_MAX = 9000;
  const repeatGap = () => (proActive() ? 2000 : 200); // Free пам'ятає ~200 пісень, Pro — ~2000 (записується все — для переходу на Pro)
  function loadTrackHist() {
    try { trackHist = JSON.parse(lsGet(K.trackHist) || "{}") || {}; } catch { trackHist = {}; }
    playNo = parseFloat(lsGet(K.playNo) || "0") || 0; // дробовий: швидкий скіп — пів пісні
    const cut = Date.now() - 120 * 86400000;
    let rows = Object.entries(trackHist).filter(([, v]) => Array.isArray(v) && v[0] > cut);
    // старий формат (повний uri) — переводимо в короткий "t:"+id
    rows = rows.map(([k, v]) => [k.startsWith("spotify:track:") ? "t:" + idOf(k) : k, v]);
    if (!playNo) playNo = rows.length; // перший запуск із новим форматом
    for (const r of rows) if (r[1][2] == null) r[1][2] = Math.max(0, playNo - Math.round((Date.now() - r[1][0]) / 180000)); // ~3 хв на трек
    if (rows.length > TRACK_HIST_MAX) rows = rows.sort((a, b) => b[1][0] - a[1][0]).slice(0, TRACK_HIST_MAX);
    trackHist = Object.fromEntries(rows);
  }
  function saveTrackHist() { lsSet(K.trackHist, JSON.stringify(trackHist)); lsSet(K.playNo, String(playNo)); }
  // Та сама пісня буває під різними ID: сингл і альбом, «(speed up)», «- Remastered», «[prod. …]».
  // Ключ пісні = артист + назва без хвостів у дужках і після « - ».
  function songKey(c) {
    const name = String(c.name || "").toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, " ").split(" - ")[0]
      .replace(/\b(sped up|speed up|slowed|reverb|remaster(ed)?|radio edit|extended)\b/g, "").replace(/[^a-zа-яё0-9]/gi, "");
    return name && c.artistUri ? "k:" + idOf(c.artistUri) + "|" + name : ""; // без артиста не склеюємо: «Intro» в усіх різні
  }
  // один запис на пісню: ключ пісні (склеює двійників), а без артиста — id треку
  const histKey = (c) => songKey(c) || "t:" + idOf(c.uri);
  function noteTrackPlayed(c, ts, no) {
    const k = histKey(c), h = trackHist[k];
    if (no == null) no = ++playNo;
    trackHist[k] = [ts || Date.now(), (h ? h[1] : 0) + 1, no];
    if (trackHist["t:" + idOf(c.uri)] && k !== "t:" + idOf(c.uri)) delete trackHist["t:" + idOf(c.uri)]; // дубль старого формату
    saveLater("trackHist", saveTrackHist);
  }
  function histOf(c) {
    const a = songKey(c) ? trackHist[songKey(c)] : null, b = trackHist["t:" + idOf(c.uri)];
    if (!a) return b || null;
    if (!b) return a;
    return a[0] >= b[0] ? a : b;
  }
  // скільки пісень прозвучало відтоді (Infinity — жодного разу)
  function playsSince(c) { const h = histOf(c); return h ? playNo - (h[2] ?? playNo) : Infinity; }
  // Лайки, поставлені в хвилі: [id треку, id артиста, назва, ім'я артиста, ts] — нові першими, ≤300.
  let waveLikes = [];
  function loadWaveLikes() { try { waveLikes = JSON.parse(lsGet(K.waveLikes) || "[]") || []; } catch { waveLikes = []; } }
  function rememberLike(c) {
    waveLikes = [[idOf(c.uri), idOf(c.artistUri || ""), c.name || "", c.artistName || "", Date.now()],
      ...waveLikes.filter((l) => l[0] !== idOf(c.uri))].slice(0, 300);
    saveLater("waveLikes", () => lsSet(K.waveLikes, JSON.stringify(waveLikes)));
  }
  // Лайки, зняті потім у Spotify, на хвилю більше не впливають: звіряємо з медіатекою під час запуску
  async function syncWaveLikes() {
    if (!waveLikes.length) return;
    try {
      const flags = await Spicetify.Platform.LibraryAPI.contains(...waveLikes.map((l) => TU(l[0])));
      if (!Array.isArray(flags)) return;
      const keep = waveLikes.filter((_, i) => flags[i]);
      if (keep.length === waveLikes.length) return;
      const gone = waveLikes.filter((_, i) => !flags[i]).map((l) => TU(l[0]));
      waveLikes = keep;
      lsSet(K.waveLikes, JSON.stringify(waveLikes));
      for (const u of gone) P.likedTracks.delete(u);
      if (profile) { profile.tasteAt = 0; } // смак перерахується без знятих лайків
      logEvent("Снятые лайки убраны из волны", gone.length);
    } catch (e) { logEvent("сверка лайков: ошибка", String(e)); }
  }
  // Справжня історія Spotify («Recently played», ~500 треків, включно зі скіпнутими й зіграними повз хвилю) —
  // усе це «вже звучало». Тоді пропуски у власному записі хвилі не важливі.
  let playHistAt = 0;
  async function markRecentlyPlayed(force) {
    if (!force && Date.now() - playHistAt < 10 * 60000) return;
    playHistAt = Date.now();
    try {
      const api = Spicetify.Platform.PlayHistoryAPI;
      let items = [];
      if (api && api.getContents) {
        const r = await api.getContents({ limit: 500, offset: 0 });
        items = (r && (r.items || r.contents)) || [];
      }
      const now = Date.now();
      // нові (хвиля про них не знала): прослухане повз хвилю теж рухає лічильник «скільки пісень минуло»
      const fresh = [];
      items.forEach((x, i) => {
        if (!x || typeof x.uri !== "string" || !x.uri.startsWith("spotify:track:")) return;
        const a = x.artists && x.artists[0];
        const t = { uri: x.uri, name: x.name, artistUri: a?.uri, artistName: a?.name };
        if (!histOf(t) && !fresh.some((f) => histKey(f.t) === histKey(t))) fresh.push({ t, i });
      });
      playNo += fresh.length;
      // час Spotify не віддає — порядок від свіжих до старих: номер прослуховування «i пісень тому»
      fresh.forEach(({ t, i }, rank) => { trackHist[histKey(t)] = [now - i * 3 * 60000, 1, playNo - rank]; });
      // артисти з історії (зокрема фіти): «звучав i пісень тому» — пам'ять артистів знає і те, що грало повз хвилю
      const freshSet = new Set(fresh.map((f) => f.i));
      items.forEach((x, i) => { for (const a of (x && x.artists) || []) if (a && a.uri) noteArtistPlayed(a.uri, playNo - i, freshSet.has(i)); });
      saveLater("artistLast", saveArtistHist);
      const added = fresh.length;
      if (added) { saveLater("trackHist", saveTrackHist); logEvent("Из истории Spotify отмечено прослушанных", added); }
    } catch (e) { logEvent("история Spotify: ошибка", String(e)); }
  }
  // Свіжі лайки — з хвилі й з твоєї бібліотеки (там вони за датою додавання), нові першими
  // Вага лайка за свіжістю: свіжий — 1, за ~4 місяці половина згасальної частини, але не менше 0,15 —
  // старий смак не зникає, а відходить на другий план (тиждень захоплення новим хвилю не перевертає)
  const LIKE_HALF_DAYS = 120, LIKE_FLOOR = 0.15;
  function likeWeight(at) {
    if (!at) return 0.4; // дата невідома — середньо
    const days = Math.max(0, (Date.now() - at) / 86400000);
    return LIKE_FLOOR + (1 - LIKE_FLOOR) * Math.pow(0.5, days / LIKE_HALF_DAYS);
  }
  const likeWeightOf = (t) => likeWeight((t && t.at) || P.likeAt.get(typeof t === "string" ? t : t && t.uri) || 0);
  // випадковий вибір із лайків, свіжі — частіше (ok — спершу ті, що підходять під налаштування)
  function sampleLikesPreferring(list, n, ok) {
    const good = weightedSample(list.filter(ok), n, likeWeightOf);
    if (good.length >= n) return good;
    return good.concat(weightedSample(list.filter((x) => !ok(x)), n - good.length, likeWeightOf));
  }
  function recentLikes(n) {
    const out = [], seen = new Set();
    const push = (t) => { if (t.uri && !seen.has(t.uri)) { seen.add(t.uri); out.push(t); } };
    waveLikes.forEach(([id, aid, name, an, ts]) => push({ uri: TU(id), artistUri: aid ? AU(aid) : undefined, artistName: an, name,
      artistUris: aid ? [AU(aid)] : [], at: ts || 0 }));
    P.likedItems.slice(0, n).forEach(push);
    return out.slice(0, n);
  }

  // Скіпи артистів між запусками: «зараз не те» пам'ятається ~3–4 дні й згасає.
  // Дослухав трек артиста — один скіп прощено, лайкнув — усі.
  let skipHist = {}; // artistId -> [ts, ...]
  const SKIP_TAU_D = 1.3; // через 1 день ≈45% штрафу, через 3 дні ≈10%, через 4 ≈5%
  function loadSkipHist() {
    try { skipHist = JSON.parse(lsGet(K.skipHist) || "{}") || {}; } catch { skipHist = {}; }
    const cut = Date.now() - 5 * 86400000;
    for (const k of Object.keys(skipHist)) {
      const a = (skipHist[k] || []).filter((t) => t > cut).slice(-6);
      if (a.length) skipHist[k] = a; else delete skipHist[k];
    }
  }
  function saveSkipHist() { lsSet(K.skipHist, JSON.stringify(skipHist)); }
  function noteSkip(artistUri) {
    if (!artistUri) return;
    const id = idOf(artistUri);
    (skipHist[id] = skipHist[id] || []).push(Date.now());
    skipHist[id] = skipHist[id].slice(-6);
    saveLater("skipHist", saveSkipHist);
  }
  function forgiveSkips(artistUri, all) {
    const id = idOf(artistUri || ""), a = skipHist[id];
    if (!a || !a.length) return;
    if (all) delete skipHist[id]; else { a.shift(); if (!a.length) delete skipHist[id]; }
    saveLater("skipHist", saveSkipHist);
  }
  // «Навантаження» скіпів артиста (усі запуски, включно з поточним): свіжий скіп = 1, згасає за ~3–4 дні.
  // Пам'ять скіпів між запусками — Pro (Free враховує скіпи лише всередині поточної хвилі). Записуються завжди.
  function skipLoad(artistUri) {
    const a = skipHist[idOf(artistUri || "")];
    if (!a || !proActive()) return 0;
    const now = Date.now();
    let m = 0;
    for (const ts of a) m += Math.exp(-(now - ts) / (SKIP_TAU_D * 86400000));
    return m;
  }
  // 3+ скіпи/дизлайки за 3 дні — артист зникає майже на добу (поки навантаження ≥ 1.5), далі м'який штраф
  function artistSkippedOut(artistUri) {
    const a = skipHist[idOf(artistUri || "")];
    if (!a || a.length < 3 || !proActive()) return false;
    const cut = Date.now() - 3 * 86400000;
    return a.filter((t) => t > cut).length >= 3 && skipLoad(artistUri) >= 1.5;
  }
  // Треки, скіпнуті в перші 30 секунд: id/ключ пісні -> ts, тримаємо 7 днів
  let quickSkips = {};
  function loadQuickSkips() {
    try { quickSkips = JSON.parse(lsGet(K.quickSkips) || "{}") || {}; } catch { quickSkips = {}; }
    const cut = Date.now() - 7 * 86400000;
    for (const k of Object.keys(quickSkips)) if (quickSkips[k] < cut) delete quickSkips[k];
  }
  function noteQuickSkip(c) {
    const now = Date.now();
    quickSkips[idOf(c.uri)] = now;
    const k = songKey(c); if (k) quickSkips[k] = now;
    saveLater("quickSkips", () => lsSet(K.quickSkips, JSON.stringify(quickSkips)));
  }
  function quickSkipped(c) {
    if (!proActive()) return false;
    const cut = Date.now() - 7 * 86400000, k = songKey(c);
    return (quickSkips[idOf(c.uri)] || 0) > cut || (!!k && (quickSkips[k] || 0) > cut);
  }
  const trackAgeH = (c) => { const h = histOf(c); return h ? (Date.now() - h[0]) / 3600000 : Infinity; };
  // штраф за «вже було»: одразу після — сильний, через 2–3 дні майже нуль; те, що часто звучало, — довше
  function replayPenalty(c) {
    const h = histOf(c);
    if (!h) return 0;
    const since = playsSince(c);
    // після repeatGap() пісня може повернутися, але не одразу: штраф сходить ще впродовж півтора таких проміжків
    const gap = repeatGap();
    return (3 + Math.min(h[1] - 1, 4) * 0.5) * Math.exp(-Math.max(0, since - gap) / (gap * 1.5));
  }

  // ==================================================================
  // Сесія хвилі
  // ==================================================================
  const RECENCY = [1, 0.8, 0.65, 0.5, 0.4];
  const graphScore = new Map(); // artistUri -> до скількох недавніх артистів він «схожий»
  const S = {
    active: false, starting: false, restartPending: false,
    ctx: [], head: -1, navBack: false, rebuildUntil: 0,
    history: [], played: new Set(), recentArtists: [], recentSet: new Set(), picksFamiliar: [],
    pool: new Map(), coldSeeds: [],
    skipArtist: new Map(), seedPenalty: new Map(),
    progress: new Map(), duration: new Map(),
    poolBusy: false, poolDirty: false,
    lastOutcome: "", lastRefresh: {}, lastPicks: [],
    artistPlays: new Map(), sessionStart: Date.now(), recentHits: [],
    hearted: new Set(), heartTicks: new Map(), sinceRefresh: 0, playedKeys: new Set(), queued: new Map(), headGen: 0,
    inSpotifyQueue: new Set(), tierUse: {}, feedMode: true, queueMiss: 0, skipNear: new Map(), skipStreak: 0, courseAt: 0, soundAvoid: new Map(),
  };
  function resetSession() {
    S.active = false; S.ctx = []; S.head = -1; S.navBack = false;
    S.artistPlays = new Map(); S.genreFavs = null; S.sessionStart = Date.now(); S.recentHits = []; S.hearted = new Set(); S.heartTicks = new Map(); S.sinceRefresh = 0; S.likeSeed = null; S.playedKeys = new Set(); S.queued = new Map(); S.inSpotifyQueue = new Set(); S.tierUse = {};
    S.history = []; S.played = new Set(); S.recentArtists = []; S.recentSet = new Set(); S.picksFamiliar = [];
    S.pool = new Map(); S.coldSeeds = [];
    S.skipArtist = new Map(); S.seedPenalty = new Map(); S.skipNear = new Map(); S.skipStreak = 0; S.courseAt = 0; S.soundAvoid = new Map(); S.feedMode = true; S.queueMiss = 0;
    S.lastOutcome = ""; S.lastRefresh = {}; S.lastPicks = []; S.relaxNotified = {};
  }

  // Усі артисти треку (з фітами)
  function artistsOf(c) {
    const list = c.artistUris && c.artistUris.length ? c.artistUris : (c.artistUri ? [c.artistUri] : []);
    return list;
  }
  // Запам'ятати артистів треку: артист не має звучати частіше ніж раз на 25 треків
  function noteRecent(uris) {
    if (!uris || !uris.length) return;
    S.recentArtists.push(uris);
    while (S.recentArtists.length > 25) S.recentArtists.shift();
    S.recentSet = new Set(S.recentArtists.flat());
  }
  const isRecentArtist = (c) => artistsOf(c).some((u) => S.recentSet.has(u));
  // «Втома» від артиста: скільки він уже звучав у цій сесії та в попередні дні.
  // Це головний механізм різноманітності: повтори рідкісні, бо нові артисти в пріоритеті, а не через ліміт.
  function fatigue(uri) {
    let f = (S.artistPlays.get(uri) || 0) * 2.5;
    // минулі запуски: що менше пісень минуло після артиста, то сильніше (через ~250 пісень — третина, через 600 — майже нуль);
    // частий гість — довше
    const v = artistLast[idOf(uri)];
    if (v && !S.artistPlays.has(uri) && !isSourceArtist(uri)) {
      const since = Math.max(0, playNo - v[0]);
      f += 1.5 * Math.exp(-since / 250) + 0.25 * Math.min(Math.max(v[1] - 1, 0), 4) * Math.exp(-since / 800);
    }
    return f;
  }

  // Сіди: останні 5 прослуханих (не скіпнутих) треків, лайкнуті — у пріоритеті
  function sessionSeeds() {
    const listened = [];
    for (let i = S.history.length - 1; i >= 0 && listened.length < 5; i--) {
      const h = S.history[i];
      if (S.courseAt && (h.at || 0) < S.courseAt) break; // після зміни курсу старий напрям не тягнемо
      if (h.outcome !== "skip" && h.outcome !== "dislike") listened.push(h);
    }
    listened.sort((x, y) => (y.outcome === "like") - (x.outcome === "like"));
    const seeds = listened.map((h) => h.uri);
    if (S.likeSeed && !seeds.includes(S.likeSeed)) seeds.unshift(S.likeSeed); // лайкнутий зараз — головний орієнтир
    seeds.length = Math.min(seeds.length, 5);
    for (const u of S.coldSeeds) { if (seeds.length >= 5) break; if (!seeds.includes(u)) seeds.push(u); }
    return seeds;
  }

  function addCand(t, source, seed, recency) {
    if (!t || !t.uri) return false;
    noteArtistLang(t);
    if (S.played.has(t.uri)) return false;
    let c = S.pool.get(t.uri);
    const isNew = !c;
    if (!c) { c = { ...t, sources: new Set(), recency: 0, seed: null, addedAt: Date.now() }; S.pool.set(t.uri, c); }
    c.sources.add(source);
    if (recency > c.recency) { c.recency = recency; c.seed = seed; }
    if (seed) markMoodChain(c, seed); // схожий на перевірений трек потрібного настрою
    if (!c.playcount) c.playcount = t.playcount || knownPlaycount.get(t.uri) || 0;
    if (!c.listeners && t.listeners) c.listeners = t.listeners;
    if (!c.artistUri && t.artistUri) { c.artistUri = t.artistUri; c.artistName = t.artistName; }
    if ((!c.artistUris || !c.artistUris.length) && t.artistUris && t.artistUris.length) c.artistUris = t.artistUris;
    return isNew;
  }
  function prunePool() {
    for (const u of [...S.pool.keys()]) if (S.played.has(u)) S.pool.delete(u);
    const seeds = new Set(sessionSeeds());
    for (const c of S.pool.values()) if (c.seed && !seeds.has(c.seed)) c.recency *= 0.6; // ідемо за свіжим прослуховуванням
    // вшир, а не вглиб: не більше 3 кандидатів на артиста (найкращі за зв'язком із поточним прослуховуванням)
    const byArtist = new Map();
    for (const c of S.pool.values()) {
      const a = c.artistUri || c.uri;
      (byArtist.get(a) || byArtist.set(a, []).get(a)).push(c);
    }
    for (const list of byArtist.values()) {
      if (list.length <= 3) continue;
      list.sort((x, y) => (y.recency + y.sources.size * 0.3) - (x.recency + x.sources.size * 0.3));
      for (const c of list.slice(3)) S.pool.delete(c.uri);
    }
    if (S.pool.size > 900) {
      const old = [...S.pool.values()].sort((a, b) => a.addedAt - b.addedAt).slice(0, S.pool.size - 900);
      for (const c of old) S.pool.delete(c.uri);
    }
  }

  // ---------------- Селектори кандидатів ----------------
  // Чи підходить АРТИСТ під налаштування — щоб набирати кандидатів прицільно, а не широко з відсіюванням
  // (інакше під вузькі налаштування проходить 3–4 артисти й хвиля крутить їх по колу).
  function artistIsRu(uri, name) {
    if (isCyrillic(name)) return true;
    const o = uri && artistLang.get(uri);
    return !!(o && o.cyr > 0);
  }
  function artistFitsLangTags(uri, name) {
    if (settings.language === "ru" && !artistIsRu(uri, name)) return false;
    if (settings.language === "foreign" && artistIsRu(uri, name)) return false;
    for (const p of hardPools()) if (!p.ids.has(idOf(uri)) && !(name && p.names.has(name.toLowerCase()))) return false;
    return true;
  }
  function artistPasses(uri, name) {
    if (!uri || isArtistBanned(uri) || (settings.blockAI && isAIArtist(uri))) return false;
    const fam = P.familiarIds.has(idOf(uri)) || (!!name && P.familiarNames.has(name.toLowerCase()));
    if (settings.character === "favorite" && !fam) return false;
    if (settings.character === "unfamiliar" && fam) return false;
    return artistFitsLangTags(uri, name);
  }
  // спершу ті, що підходять під налаштування; якщо їх бракує — добираємо рештою
  function samplePreferring(list, n, ok) {
    const good = sampleArr(list.filter(ok), n);
    if (good.length >= n) return good;
    return good.concat(sampleArr(list.filter((x) => !ok(x)), n - good.length));
  }
  const narrow = () => !!(settings.language || settings.character || activeTags().length);

  function pickFavArtists(n) {
    const base = topArtistsNow().filter((a) => !isArtistBanned(a.uri) && !S.recentSet.has(a.uri));
    const w = (a) => a.weight + Math.max(0, affinity[a.uri] || 0);
    const out = weightedSample(base.filter((a) => artistPasses(a.uri, a.name)), n, w);
    if (out.length < n) out.push(...weightedSample(base.filter((a) => !out.includes(a)), n - out.length, w));
    return out;
  }
  // вшир: схожі від REL_BASE останніх (чи улюблених) артистів, за раз беремо REL_PICK із них
  const REL_BASE = 5, REL_PICK = 10;
  async function relatedSelector(stats) {
    const base = [];
    for (let i = S.history.length - 1; i >= 0 && base.length < REL_BASE; i--) {
      const h = S.history[i];
      if (h.outcome !== "skip" && h.outcome !== "dislike" && h.artistUri && !base.includes(h.artistUri)) base.push(h.artistUri);
    }
    if (base.length < REL_BASE) { // від твоїх найулюбленіших (за прослуховуваннями), а не випадкових
      const tops = topArtistsNow().slice(0, 20).filter((x) => !base.includes(x.uri));
      const ok = tops.filter((x) => artistFitsLangTags(x.uri, x.name));
      for (const a of weightedSample(ok.length >= 2 ? ok : tops, REL_BASE - base.length, (x) => x.weight)) base.push(a.uri);
    }
    const rels = await Promise.all(base.slice(0, REL_BASE).map(relatedArtists));
    const counts = new Map();
    rels.forEach((list) => list.forEach((u) => counts.set(u, (counts.get(u) || 0) + 1)));
    for (const [u, n] of counts) graphScore.set(u, Math.max(graphScore.get(u) || 0, n));
    let pick = [...counts.keys()].filter((u) => !S.recentSet.has(u) && !isArtistBanned(u));
    if (settings.character === "unfamiliar") pick = pick.filter((u) => !notForDiscover(u));
    // ще не почуті артисти — у пріоритеті
    // ще не почуті й не зірки (якщо про артиста вже знаємо, скільки в нього слухачів)
    const fresh = (u) => artistSince(u) >= ARTIST_GAP * 2 && dislikePenalty(u) < 1 && artistPasses(u, "") &&
      (settings.character === "popular" || (artistFame.get(u) || 0) < 3e6);
    // у пріоритеті — ще не почуті Й близькі до твого смаку
    const freshNear = (u) => fresh(u) && (P.taste.get(u) || 0) > 0;
    const chosen = samplePreferring(pick, REL_PICK, (u) => freshNear(u) || (!P.taste.size && fresh(u)));
    // другий крок за графом схожих — лише всередині околиці твого смаку (вшир, але не в чужі сцени)
    if (chosen.length) {
      const hop = await relatedArtists(chosen[(Math.random() * chosen.length) | 0]);
      let hop2 = hop.filter((u) => !counts.has(u) && !S.recentSet.has(u) && !isArtistBanned(u));
      if (settings.character === "unfamiliar") hop2 = hop2.filter((u) => !notForDiscover(u));
      // «Незнайоме» — на крок далі: другий крок і за межами околиці смаку (зв'язок із поточним прослуховуванням — graphScore 1)
      if (settings.character === "unfamiliar" && !activeTags().length && !settings.language) {
        const far = sampleArr(hop2.filter(fresh), 3);
        far.forEach((u) => graphScore.set(u, Math.max(graphScore.get(u) || 0, 1)));
        chosen.push(...far);
      } else {
        if (P.taste.size) hop2 = hop2.filter((u) => (P.taste.get(u) || 0) > 0);
        chosen.push(...sampleArr(hop2.filter(fresh), 3));
      }
    }
    const lists = await Promise.all(chosen.map((u) => artistTracksSample(u, 2)));
    lists.forEach((list) => list.forEach((t) => { if (addCand(t, "rel", null, 0)) stats.rel++; }));
  }
  // ---------------- Жанр від твоїх улюблених ----------------
  // Улюблені артисти, що підходять під мову й хоч трохи стосуються жанру (самі в колі жанру або хтось із їхніх схожих),
  // — затравка. Від них беремо схожих, а від частини схожих — ще схожих. Точність трохи нижча, зате все росте з твого смаку,
  // а не з редакторських плейлистів жанру (там мейнстрим).
  async function genreFavorites(pool) {
    const memo = S.genreFavs || (S.genreFavs = new Map());
    if (memo.has(pool.key)) return memo.get(pool.key);
    const favs = topArtistsNow().slice(0, 30).filter((a) => a.uri && !isArtistBanned(a.uri) &&
      !(settings.language === "ru" && !artistIsRu(a.uri, a.name)) && !(settings.language === "foreign" && artistIsRu(a.uri, a.name)));
    const rels = await Promise.all(favs.map((a) => relatedArtists(a.uri)));
    const out = favs.filter((a, i) => pool.ids.has(idOf(a.uri)) || rels[i].filter((r) => pool.ids.has(idOf(r))).length >= 1);
    memo.set(pool.key, out);
    return out;
  }
  // Дерево від улюблених: улюблений → схожі → схожі на схожих… У жанрі — 2 кроки (тримаємо жанр), у «Незнайомому» — 4
  // (deep: 5): далі від улюблених — більше нових імен, точність трохи нижча, зате розмаїття. Знайомих і тих, хто вже
  // приївся, у «Незнайомому» не беремо на жодному кроці.
  async function tasteWalkSelector(stats, deep) {
    if (waveSource) return;
    const pool = hardPools().find((p) => p.key.startsWith("genre:"));
    const discover = settings.character === "unfamiliar";
    if (!pool && !discover) return;
    const langFit = (a) => !(settings.language === "ru" && !artistIsRu(a.uri, a.name)) && !(settings.language === "foreign" && artistIsRu(a.uri, a.name));
    const favs = pool ? await genreFavorites(pool) : topArtistsNow().slice(0, 30).filter((a) => a.uri && !isArtistBanned(a.uri) && langFit(a));
    if (!favs.length) return;
    const okArtist = (u) => u && !isArtistBanned(u) && !S.recentSet.has(u) && !(settings.blockAI && isAIArtist(u)) &&
      !(settings.language === "foreign" && artistIsRu(u, "")) && !(discover && notForDiscover(u));
    // вузький режим («Незнайоме» + жанр / мова / настрій) — нових мало, тож одразу глибше
    const narrowDiscover = discover && (activeTags().length || settings.language);
    const hops = discover ? (deep || narrowDiscover ? 5 : 4) : 2;
    const seen = new Set(favs.map((a) => a.uri));
    const levels = [];
    // Корені дерева — не лише давні улюблені, а й те, що зайшло в самій хвилі: дослухане й лайкнуте в цій сесії
    // та свіжі лайки з хвилі. Знайшла хвиля нового артиста, який сподобався, — наступні гілки ростуть уже від нього.
    const liked = [];
    for (let i = S.history.length - 1; i >= 0 && liked.length < 3; i--) {
      const h = S.history[i];
      if ((h.outcome === "finished" || h.outcome === "like") && h.artistUri && !liked.includes(h.artistUri) && !isArtistBanned(h.artistUri)) liked.push(h.artistUri);
    }
    for (const l of recentLikes(30)) if (liked.length < 4 && l.artistUri && !liked.includes(l.artistUri) && !isArtistBanned(l.artistUri)) liked.push(l.artistUri);
    const fromWave = sampleArr(liked, 2);
    let front = [...fromWave, ...weightedSample(favs.filter((a) => !fromWave.includes(a.uri)), 4 - fromWave.length, (a) => a.weight || 1).map((a) => a.uri)];
    front.forEach((u) => seen.add(u));
    for (let h = 0; h < hops && front.length; h++) {
      const rels = await Promise.all(front.map(relatedArtists));
      const next = [...new Set(rels.flatMap((rel) => sampleArr(rel.filter((u) => okArtist(u) && !seen.has(u)), h ? 3 : 5)))];
      next.forEach((u) => seen.add(u));
      levels.push(next);
      front = sampleArr(next, 3); // далі йдемо лише від частини — дерево вшир не розростається
    }
    // треки: у «Незнайомому» більше з глибших рівнів (там нові імена), у жанрі — з ближчих (там жанр певніший)
    const arts = [];
    levels.forEach((lv, h) => arts.push(...sampleArr(lv, discover ? 2 + h : (h ? 4 : 8)).map((u) => [u, h])));
    const lists = await Promise.all(arts.slice(0, 12).map(([u]) => artistTracksSample(u, 2)));
    lists.forEach((list, i) => list.forEach((t) => {
      // мова: для «Русский» беремо лише тих, про кого вже знаємо, що вони російськомовні (або дізнаємося з їхніх топ-треків)
      if (settings.language === "ru" && !isRuTrack(t) && !artistIsRu(t.artistUri, t.artistName)) return;
      const isNew = addCand(t, "walk", null, 0.3);
      const c = S.pool.get(t.uri);
      // від твого улюбленого артиста жанру за 1–2 кроки — рахуємо жанром; глибше жанр має довести сам
      if (c && pool && arts[i][1] < 2) (c.genreChain || (c.genreChain = new Set())).add(pool.key);
      if (isNew) stats.walk = (stats.walk || 0) + 1;
    }));
  }
  // ---------------- Радіо Spotify ----------------
  // Spotify сам будує «радіо» від будь-якого артиста чи треку (те, що відкривається через «Перейти до радіо»):
  // ~50 треків під тебе, серед них багато нових імен поруч. Адресу радіо дає внутрішній запит seed_to_playlist.
  // Тримаємо 12 год у пам'яті сесії; не вийшло — просто без радіо.
  const radioCache = new Map();
  function radioTracks(seedUri) {
    const hit = radioCache.get(seedUri);
    if (hit && Date.now() - hit.at < MIX_TTL) return hit.p;
    const p = (async () => {
      try {
        const r = await net(() => Spicetify.CosmosAsync.get(`https://spclient.wg.spotify.com/inspiredby-mix/v2/seed_to_playlist/${seedUri}?response-format=json`), 1);
        const pl = r?.mediaItems?.[0]?.uri;
        return pl && pl.startsWith("spotify:playlist:") ? await playlistTracks(pl, 60) : [];
      } catch (e) { logEvent("радио Spotify: ошибка", String(e)); return []; }
    })();
    radioCache.set(seedUri, { at: Date.now(), p });
    return p;
  }
  // Радіо 2 артистів за раз: у жанрі — улюблених артистів жанру, інакше — улюблених і тих, хто зайшов у самій хвилі.
  async function radioSelector(stats) {
    if (waveSource) return;
    const pool = hardPools().find((p) => p.key.startsWith("genre:"));
    const langFit = (a) => !(settings.language === "ru" && !artistIsRu(a.uri, a.name)) && !(settings.language === "foreign" && artistIsRu(a.uri, a.name));
    const favs = pool ? await genreFavorites(pool) : topArtistsNow().slice(0, 30).filter((a) => a.uri && !isArtistBanned(a.uri) && langFit(a));
    const fromWave = [];
    for (let i = S.history.length - 1; i >= 0 && fromWave.length < 3; i--) {
      const h = S.history[i];
      if ((h.outcome === "finished" || h.outcome === "like") && h.artistUri && !fromWave.includes(h.artistUri) && !isArtistBanned(h.artistUri)) fromWave.push(h.artistUri);
    }
    const seeds = [...sampleArr(fromWave, 1), ...weightedSample(favs, 2, (a) => a.weight || 1).map((a) => a.uri)].slice(0, 2);
    const lists = await Promise.all(seeds.map(radioTracks));
    lists.forEach((list) => sampleArr(list, 12).forEach((t) => {
      const isNew = addCand(t, "radio", null, 0.3);
      const c = S.pool.get(t.uri);
      if (c && pool) (c.genreChain || (c.genreChain = new Set())).add(pool.key); // радіо улюбленого артиста жанру — жанр
      if (isNew) stats.radio = (stats.radio || 0) + 1;
    }));
  }
  // Лайк — радіо саме цієї пісні: хвиля йде в її звучання, а не лише до схожих артистів
  function likeRadio(c) {
    if (!c || !c.uri || waveSource) return;
    radioTracks(c.uri).then((list) => {
      let n = 0;
      sampleArr(list, 15).forEach((t) => { if (t.uri !== c.uri && addCand(t, "likeRadio", c.uri, 0.6)) n++; });
      if (n) { logEvent("Радио лайкнутой песни", { треков: n }); refreshPool(); }
    }).catch(() => {});
  }
  // ---------------- Персональні добірки Spotify ----------------
  // Discover Weekly, Release Radar і Daily Mix Spotify збирає саме під тебе: багато нових артистів, які влучають у смак.
  // Свої знаходимо пошуком за назвою — у персональних особливі адреси (DW/RR — 37i9dQZEVX…, Daily Mix — 37i9dQZF1E…),
  // чужі й редакторські з такою ж назвою відсіюються. Треки тримаємо 12 год; знайомі, повтори й дизлайки відсіє hardFilter.
  const MIX_TTL = 12 * 3600000;
  let mixCache = { at: 0, fresh: [], daily: [] };
  async function loadSpotifyMixes() {
    if (Date.now() - mixCache.at < MIX_TTL) return mixCache;
    mixCache.at = Date.now();
    const own = async (q, prefix, n) => (await searchPlaylistUris(q)).filter((u) => idOf(u).startsWith(prefix)).slice(0, n);
    const [dw, rr, daily] = await Promise.all([own("Discover Weekly", "37i9dQZEVX", 1), own("Release Radar", "37i9dQZEVX", 1), own("Daily Mix", "37i9dQZF1E", 3)]);
    const tracks = async (uris) => (await Promise.all(uris.map((u) => playlistTracks(u, 60)))).flat();
    const [fresh, mixes] = await Promise.all([tracks([...new Set([...dw, ...rr])]), tracks(daily)]);
    mixCache = { at: mixCache.at, fresh, daily: mixes };
    logEvent("Добірки Spotify", { новинки: fresh.length, dailyMix: mixes.length });
    return mixCache;
  }
  // нове (DW + RR) — у всіх режимах, крім «Улюбленого»; Daily Mix (здебільшого знайоме) — у «Улюбленому» і звичайній хвилі
  async function mixSelector(stats) {
    let m;
    try { m = await loadSpotifyMixes(); } catch (e) { logEvent("добірки Spotify: помилка", String(e)); return; }
    // recency 0.3: добірку Spotify уже підібрав під тебе — без штрафу «дрейфу» за межами околиці смаку
    if (settings.character !== "favorite") sampleArr(m.fresh, 15).forEach((t) => { if (addCand(t, "mix", null, 0.3)) stats.mix++; });
    if (!settings.character || settings.character === "favorite") sampleArr(m.daily, 10).forEach((t) => { if (addCand(t, "mix", null, 0.2)) stats.mix++; });
  }
  // 1–2 випадкові треки з топу артиста (а не всі його хіти поспіль)
  function artistTracksSample(uri, n) { return artistOverviewTracks(uri).then((list) => sampleArr(list, n)); }

  // ---------------- Хвиля за плейлистом / артистом ----------------
  // Хвиля за джерелом працює ТАК САМО, як звичайна, — лише замість твого профілю джерело:
  // улюблені артисти → артисти джерела, найбільш слухані треки (якорі) → треки джерела,
  // околиця смаку → схожі на артистів джерела (тим самим способом, що ensureTaste). Лише Pro.
  async function loadSource(type, uri) { return { type, uri, name: "", tracks: [], topArtists: [], taste: new Map() }; }
  const topArtistsNow = () => (waveSource ? waveSource.topArtists : P.topArtists);

  // quick — швидкий набір для старту: лише схоже на сіди, настрій і розмітка (без треків артистів)
  async function refreshPoolOnce(opts) {
    const quick = !!(opts && opts.quick);
    const stats = { sim: 0, anchor: 0, fav: 0, rel: 0, tag: 0, liked: 0, mood: 0, mix: 0 };
    await Promise.all(oppositeKeys().map(loadTagPool)); // розмітка протилежного настрою — для відсікання
    const seeds = sessionSeeds();
    const pools = await Promise.all(activeTags().map(loadTagPool));
    const jobs = [];
    // 1) схоже на останні прослухані — головний селектор, тримає плавні переходи
    seeds.forEach((u, i) => jobs.push(recommendByTrack(u).then((list) =>
      list.forEach((t) => { if (addCand(t, "sim", u, RECENCY[i] || 0.3)) stats.sim++; }))));
    const fits = (t) => hardFilter(t, { cooldown: true });
    // настрій/заняття: схоже на випадкові ПЕРЕВІРЕНІ треки цього настрою (не мегахіти) — постійна підживка
    for (const k of moodKeysSel()) {
      const p = tagPools.get(k);
      if (!p || !p.tracks.length) continue;
      const exact = [...p.tracks, ...comboPools().filter((cp) => cp.key.startsWith("combo:" + k + "|")).flatMap((cp) => cp.tracks)];
      samplePreferring(exact, 3, (t) => fits(t) && (t.playcount || 0) < 3e8).forEach((t) =>
        jobs.push(recommendByTrack(t.uri).then((list) =>
          list.forEach((x) => { if (addCand(x, "mood", t.uri, 0.4)) stats.mood++; }))));
    }
    if (quick) {
      pools.forEach((pool) => samplePreferring(pool.tracks, 40, fits).forEach((t) => { if (addCand(t, "tag", null, 0)) stats.tag++; }));
      if (settings.character === "favorite") sampleLikesPreferring(P.likedItems, 30, fits).forEach((t) => addCand(t, "liked", null, 0));
      await Promise.all(jobs);
      if (settings.language === "instrumental") {
        const toCheck = [...S.pool.values()].filter((c) => !lyricsKnown.has(c.uri) && hardFilter(c, { cooldown: true, lang: true }))
          .sort((a, b) => b.recency - a.recency).slice(0, 5).map((c) => c.uri);
        await Promise.all(toCheck.map((u) => checkLyrics(u)));
      }
      S.lastRefresh = { ...stats, быстрый: true, пул: S.pool.size };
      return;
    }
    // 2) якорі смаку — твої треки, за можливості під мову/жанр
    // якорі — твої НАЙБІЛЬШ СЛУХАНІ треки (історія Spotify), а не випадкові лайки
    // хвиля за джерелом — твої особисті якорі й улюблених артистів не підмішуємо
    const anchorBase = (waveSource || P.topTracks.length) ? topTracksForLang() : (P.likedItems.length ? P.likedItems : langSeedBase().map((uri) => ({ uri })));
    const anchorOk = (t) => !t.artistUri || artistFitsLangTags(t.artistUri, t.artistName);
    samplePreferring(anchorBase, 2, anchorOk).forEach((t) =>
      jobs.push(recommendByTrack(t.uri).then((list) =>
        list.forEach((x) => { if (addCand(x, "anchor", t.uri, 0.25)) stats.anchor++; }))));
    // якір зі свіжих лайків (нові — імовірніше): лайк впливає на хвилю і в наступні дні
    const likes = waveSource ? [] : recentLikes(100);
    const likeOk = likes.filter(anchorOk);
    weightedSample(likeOk.length ? likeOk : likes, 1, likeWeightOf).forEach((t) =>
      jobs.push(recommendByTrack(t.uri).then((list) =>
        list.forEach((x) => { if (addCand(x, "like", t.uri, 0.35)) stats.anchor++; }))));
    // 3) треки улюблених артистів (не в «Незнайомому»), прицільно під налаштування
    if (settings.character !== "unfamiliar") {
      pickFavArtists(narrow() ? 3 : 2).forEach((a) => jobs.push(artistTracksSample(a.uri, 2).then((list) =>
        list.forEach((t) => { if (addCand(t, "fav", null, 0)) stats.fav++; }))));
    }
    // 4) схожі артисти (вшир, два кроки за графом)
    jobs.push(relatedSelector(stats));
    // 4б) жанр від твоїх улюблених: улюблені артисти жанру → схожі → схожі на схожих
    jobs.push(tasteWalkSelector(stats).catch((e) => logEvent("жанр від улюблених: помилка", String(e))));
    // 4в) радіо Spotify від улюблених артистів і тих, хто зайшов у хвилі
    jobs.push(radioSelector(stats).catch((e) => logEvent("радио Spotify: ошибка", String(e))));
    // 7) персональні добірки Spotify (Discover Weekly / Release Radar / Daily Mix) — лише у звичайній хвилі, не за джерелом
    if (!waveSource) jobs.push(mixSelector(stats));
    // 5) розмітка тегів: по одному треку на артиста + треки ще не почутих артистів розмітки.
    // Навіть у жанрі тягнемося до смаку: що ближчий артист до твоїх улюблених, то частіше його трек у вибірці.
    pools.forEach((pool) => {
      const seenArt = new Set();
      // у жанрі з редакторських плейлистів Spotify (там багато поп-репу) — спершу те, що поруч зі смаком
      let fitting = pool.tracks.filter(fits);
      const nearTaste = fitting.filter((t) => tasteOf(t) >= 0.5);
      if (pool.key.startsWith("genre:") && nearTaste.length >= 15) fitting = nearTaste;
      for (const t of weightedSample(fitting.length ? fitting : pool.tracks, 120, (x) => 0.3 + tasteOf(x))) {
        const a = t.artistUri || t.uri;
        if (seenArt.has(a)) continue;
        seenArt.add(a);
        if (addCand(t, "tag", null, 0)) stats.tag++;
        if (seenArt.size >= 15) break;
      }
      const arts = pool.artists.filter((a) => !S.recentSet.has(a.uri) && artistPasses(a.uri, a.name));
      const tasteA = (a) => (waveSource ? waveSource.taste : P.taste).get(a.uri) || 0;
      const freshA = arts.filter((a) => artistSince(a.uri) >= ARTIST_GAP * 2 && (a.core || !pool.key.startsWith("genre:")));
      weightedSample(freshA.length >= 5 ? freshA : arts, 5, (a) => 0.3 + Math.min(tasteA(a), 4)).forEach((a) =>
        jobs.push(artistTracksSample(a.uri, 2).then((list) =>
          list.forEach((t) => { if (addCand(t, "tag", null, 0)) stats.tag++; }))));
      // артисти жанру, що вже поруч із твоїм смаком, — окремо й з невеликою перевагою («твій» реп, а не будь-який)
      if (pool.key.startsWith("genre:") && settings.character !== "unfamiliar") {
        const mine = arts.filter((a) => tasteA(a) > 0).sort((x, y) => tasteA(y) - tasteA(x)).slice(0, 12);
        sampleArr(mine, 5).forEach((a) => jobs.push(artistTracksSample(a.uri, 2).then((list) =>
          list.forEach((t) => { if (addCand(t, "tag", null, 0.2)) stats.tag++; }))));
      }
    });
    // 6) «Улюблене»: самі улюблені треки, що підходять під налаштування
    if (settings.character === "favorite") {
      sampleLikesPreferring(P.likedItems, 30, fits).forEach((t) => { if (addCand(t, "liked", null, 0)) stats.liked++; });
    }
    await Promise.all(jobs);
    // мову вибрано — уточнюємо мову артистів, про яких знаємо мало (за їхніми топ-треками)
    if (settings.language === "ru" || settings.language === "foreign") {
      const unknown = [...new Set([...S.pool.values()]
        .filter((c) => c.artistUri && !isRuTrack(c) && !langChecked.has(c.artistUri))
        .sort((a, b) => (b.recency + b.sources.size * 0.3) - (a.recency + a.sources.size * 0.3))
        .map((c) => c.artistUri))].slice(0, 30);
      await Promise.all(unknown.map((a) => artistOverviewTracks(a))); // перевірка мови за топ-треками
    }
    // «Без слів»: заздалегідь перевіряємо, чи є в кандидатів текст (спершу найімовірніших)
    if (settings.language === "instrumental") {
      const pool = tagPools.get("lang:instrumental");
      const rank = (c) => (pool && pool.uris.has(c.uri) ? 3 : 0) +
        (pool && artistsOf(c).some((u) => pool.ids.has(idOf(u))) ? 1.5 : 0) + c.recency;
      // перевіряємо лише тих, хто проходить усі інші умови, і найкращих із них
      const toCheck = [...S.pool.values()].filter((c) => !lyricsKnown.has(c.uri) && hardFilter(c, { cooldown: true, lang: true }))
        .sort((a, b) => rank(b) - rank(a)).slice(0, quick ? 5 : 12).map((c) => c.uri);
      await Promise.all(toCheck.map((u) => checkLyrics(u)));
    }
    // Популярність треків із плейлистів невідома — підтягуємо топ їхніх артистів (там є прослуховування
    // і місячні слухачі), інакше мегахіти з Happy Hits/Good Vibes проходять без штрафу.
    if (settings.character !== "popular") {
      const unknownPc = [...S.pool.values()].filter((c) => !c.playcount && c.artistUri && !ovCache.has(c.artistUri));
      const arts = [...new Set(unknownPc.sort((a, b) => (b.sources.has("tag") ? 1 : 0) - (a.sources.has("tag") ? 1 : 0))
        .map((c) => c.artistUri))].slice(0, 25);
      await Promise.all(arts.map((a) => artistOverviewTracks(a)));
      for (const c of S.pool.values()) {
        if (!c.playcount) c.playcount = knownPlaycount.get(c.uri) || 0;
        if (!c.listeners && c.artistUri) c.listeners = artistFame.get(c.artistUri) || 0;
      }
    }
    // Голод: під налаштування проходить мало кандидатів — розширюємося ВІД уже відповідних треків
    // (схоже на них і їхні схожі артисти) + більше з розмітки тегу.
    const passing = [...S.pool.values()].filter((c) => hardFilter(c, { cooldown: true }));
    if (passing.length < 12) {
      let added = 0;
      const jobs2 = [];
      sampleArr(passing.map((c) => c.uri), 4).forEach((u) => jobs2.push(recommendByTrack(u).then((list) =>
        list.forEach((t) => { if (addCand(t, "walk", u, 0.5)) added++; }))));
      sampleArr([...new Set(passing.map((c) => c.artistUri).filter(Boolean))], 3).forEach((a) => jobs2.push(
        relatedArtists(a).then((rel) => {
          const ok = rel.filter((r) => settings.character !== "unfamiliar" || !notForDiscover(r));
          return Promise.all(sampleArr(ok, 2).map((u) => artistTracksSample(u, 2)));
        }).then((lists) => lists.flat().forEach((t) => { if (addCand(t, "walk", null, 0.3)) added++; }))));
      activePools().forEach((p) => sampleArr(p.tracks, 150).forEach((t) => { if (addCand(t, "tag", null, 0)) added++; }));
      if (settings.character === "unfamiliar") jobs2.push(tasteWalkSelector(stats, true).catch(() => {})); // «Незнайоме»: ще глибше по дереву
      await Promise.all(jobs2);
      stats.расширение = added;
      logEvent("Мало подходящих (" + passing.length + ") — расширил", added);
    }
    prunePool();
    S.lastRefresh = { ...stats, пул: S.pool.size, сиды: seeds.length };
    logEvent("Кандидаты", S.lastRefresh);
  }
  // Аварійний добір, коли кандидатів бракує: топ-артисти, рекомендації від лайків, уся розмітка
  async function emergencyFill() {
    const jobs = [];
    if (settings.character === "unfamiliar") jobs.push(tasteWalkSelector({}, true).catch(() => {})); // нове — з глибини дерева, а не знайомі
    samplePreferring(topArtistsNow(), 6, (a) => artistPasses(a.uri, a.name)).forEach((a) =>
      jobs.push(artistOverviewTracks(a.uri).then((l) => l.forEach((t) => addCand(t, "fav", null, 0)))));
    sampleArr(P.likedItems, 6).forEach((t) =>
      jobs.push(recommendByTrack(t.uri).then((l) => l.forEach((x) => addCand(x, "anchor", t.uri, 0.2)))));
    activePools().forEach((p) => p.tracks.forEach((t) => addCand(t, "tag", null, 0)));
    sampleArr(P.likedItems, 40).forEach((t) => addCand(t, "liked", null, 0));
    await Promise.all(jobs);
    logEvent("Аварийный добор", { пул: S.pool.size });
  }

  // Пул на диск (~200 найкращих кандидатів) — наступний запуск почне грати одразу, не чекаючи мережі
  function saveLastPool() {
    // спершу ті, хто ще не звучав і пройде фільтри поточного режиму: інакше швидкий старт (особливо в «Незнайомому»)
    // не знаходить жодного кандидата й чекає повного набору
    const usable = (c) => { try { return !S.played.has(c.uri) && hardFilter(c, { cooldown: true, artistGap: true }); } catch { return false; } };
    const all = [...S.pool.values()].sort((a, b) => (b.recency + b.sources.size * 0.3) - (a.recency + a.sources.size * 0.3));
    const items = [...all.filter(usable), ...all.filter((c) => !usable(c))]
      .slice(0, 200).map((c) => [idOf(c.uri), c.name || "", (artistsOf(c)).map(idOf).join(","), c.artistName || "",
        c.explicit ? 1 : 0, c.playcount || 0, c.listeners || 0]);
    lsSet(K.lastPool, JSON.stringify({ t: Date.now(), items }));
  }
  function loadLastPool() {
    try {
      const d = JSON.parse(lsGet(K.lastPool) || "null");
      if (!d || Date.now() - d.t > 2 * 86400000) return [];
      return d.items.map(([id, name, arts, an, ex, pc, li]) => {
        const uris = arts ? arts.split(",").map(AU) : [];
        return { uri: TU(id), name, artistUri: uris[0], artistName: an, artistUris: uris, explicit: !!ex, playcount: pc, listeners: li };
      });
    } catch { return []; }
  }
  async function refreshPool() {
    if (S.poolBusy) { S.poolDirty = true; return; }
    S.poolBusy = true;
    try {
      do { S.poolDirty = false; await refreshPoolOnce(); } while (S.poolDirty);
      saveLater("lastPool", saveLastPool);
    } catch (e) { logEvent("кандидаты: ошибка", String(e && e.stack || e)); }
    finally { S.poolBusy = false; }
  }

  // ---------------- Фільтри ----------------
  function hardFilter(c, relax) {
    if (!c.uri || S.played.has(c.uri)) return false;
    { const k = songKey(c); if (k && (S.playedKeys.has(k) || bannedTracks.has(k))) return false; } // та сама пісня під іншим ID вже звучала / дизлайкнута
    if (bannedTracks.has(c.uri)) return false;
    if (c.artistUri && isArtistBanned(c.artistUri)) return false;
    if (settings.blockAI && isAIArtist(c.artistUri)) return false;
    if (settings.explicitFilter && c.explicit) return false;
    const fam = isFamiliar(c);
    if (settings.character === "favorite") {
      if (!relax.character && !fam && !P.likedTracks.has(c.uri)) return false;
    } else if (!relax.liked && P.likedTracks.has(c.uri)) return false; // лайкнуте не крутимо (крім «Улюбленого»)
    // «Незнайоме»: те, що хвиля тобі вже грала, — теж «почуте», як і артист, що прозвучав уже 3+ рази; знайомих перевіряємо
    // за всіма артистами треку (bbno$ на фіті — теж знайомий). Знайомих не пускаємо й на поступках — замість цього пул
    // розширюється вглиб (tasteWalkSelector); лише останній щабель «тиші не буде» їх допускає.
    if (settings.character === "unfamiliar" && !relax.liked && (fam || P.heard.has(c.uri) || histOf(c) || artistsOf(c).some(notForDiscover))) return false;
    if (!relax.cooldown && isRecentArtist(c)) return false; // артист (включно з фітами) — не частіше ніж раз на 25 треків
    // і між запусками: не раніше ніж через ARTIST_GAP пісень після нього (перша поступка — лише якщо інакше бракує)
    if (!relax.cooldown && !relax.artistGap && artistsOf(c).some((a) => artistSince(a) < ARTIST_GAP && !isSourceArtist(a))) return false;
    if (!relax.character && artistSkippedOut(c.artistUri)) return false; // скіпав/дизлайкав його 3+ рази — поки не ставимо
    if (!relax.replay && artistDislikedOut(c.artistUri)) return false;    // 2 дизлайки за місяць — 2 тижні не ставимо (крім крайнього випадку)
    // звучав у минулих запусках за останні 12 год (в «Улюбленому» — 4 год: там вибір і так вузький) — поки є інші, не беремо
    // повтор: в «Улюбленому» — не раніше ніж за 4 год (там вибір — лише твої лайки), інакше — не раніше ніж через repeatGap() інших пісень
    if (!relax.replay && (settings.character === "favorite" ? trackAgeH(c) < 4 : playsSince(c) < repeatGap())) return false;
    if (!relax.replay && quickSkipped(c)) return false; // скіпнув його одразу за останні 7 днів
    if (!relax.lang) {
      const ru = isRuTrack(c);
      if (settings.language === "ru" && !ru) return false;
      if (settings.language === "foreign") {
        if (ru) return false;
        if (!c.artistUri || !langChecked.has(c.artistUri)) return false; // мову не підтверджено за топ-треками артиста
      }
    }
    // «Без слів» — властивість ТРЕКУ: перевіряємо за розміткою і за наявністю тексту пісні
    // «Без слів» не вимикається на жодному щаблі: на поступці досить «тексту точно немає»
    if (settings.language === "instrumental" && !instrumentalOk(c, !!relax.lang)) return false;
    if (relax.tags !== true) {
      // жанр — жорстко: трек із розмітки, артист із кураторських плейлистів жанру або схожий на трек звідти.
      // Артист, що потрапив «у жанр» лише як схожий, — тільки на поступці.
      const genre = hardPools().filter((p) => p.key.startsWith("genre:"));
      if (genre.length) {
        if (relax.tags === "any") { if (!genre.some((p) => inPool(p, c))) return false; }
        else if (!genre.every((p) => genreLevel(p, c) >= 1)) return false;
      }
      // настрій/заняття без жанру — головна умова, за ТРЕКОМ: сам із розмітки або схожий на трек звідти
      if (moodIsHard()) {
        if (!relax.tags && moodLevelAll(c) < 1) return false;
        if (relax.tags === "any" && moodLevelAll(c) < 1 && !moodArtistAny(c)) return false;
      }
    }
    // протилежний настрій (бадьоре при «Спокійному» тощо) — не беремо
    if (!relax.liked && isOppositeTrack(c)) return false;
    return true;
  }

  // інструментальна розмітка: загальна + «настрій × без слів»
  function instrPools() { return [...tagPools.values()].filter((p) => p.key === "lang:instrumental" || p.key.endsWith("|instrumental")); }
  const inInstrMarkup = (uri) => instrPools().some((p) => p.uris.has(uri));
  function instrumentalOk(c, loose) {
    const known = lyricsKnown.get(c.uri);
    if (known === true) return false;                     // є текст — є вокал
    if (inInstrMarkup(c.uri)) return true;                // трек із кураторської інструментальної розмітки
    if (known !== false) return false;                     // не перевірений — не беремо (навіть на поступках: вокал гірше за все)
    if (loose) return true;                                // поступка: тексту точно немає — досить
    // тексту точно немає + пов'язаний з інструментальною розміткою (артист звідти або схожий на трек звідти)
    return instrPools().some((p) => artistsOf(c).some((u) => p.ids.has(idOf(u))) || (c.seed && p.uris.has(c.seed)));
  }

  // ---------------- Ранжування ----------------
  function popularityScore(c) {
    const pc = c.playcount || 0, li = c.listeners || 0;
    const base = pc > 0 ? pc : (li > 0 ? li * 20 : 0);
    if (base <= 0) return 0.45;
    return Math.max(0, Math.min(1, Math.log10(base) / 7));
  }
  function nicheScore(c) {
    let s = 0;
    const pc = c.playcount || 0;
    // золота середина: не чарти, але й не прохідняк із парою тисяч прослуховувань
    if (pc) {
      if (pc < 15000) s -= 1.5;          // мертвий ноунейм
      else if (pc < 100000) s -= 0.3;    // зовсім маловідоме — частіше прохідняк
      else if (pc < 5e6) s += 0.5;       // середина — найкращі знахідки
      else if (pc < 3e7) s -= 0.2;       // хіти
      else if (pc < 1e8) s -= 0.5;       // великі хіти
      else if (pc < 3e8) s -= 0.6;       // величезні хіти (частку тримає pickNext: ~1 із 6)
      else s -= 0.9;                     // 300 млн+ — не заборонені, але й не кожен трек
      // «Незнайоме» = те, чого ти не чув; пісню на сотні мільйонів ти, найімовірніше, чув
      if (settings.character === "unfamiliar" && pc > 1.5e8) s -= 0.5;
    }
    const li = c.listeners || artistFame.get(c.artistUri) || 0;
    if (pc) { if (li > 1e7) s -= 0.4; } // зірки, яких знають усі
    else if (li > 3e7) s -= 1.0;        // прослуховування треку невідомі, але артист — суперзірка: майже напевно хіт
    else if (li > 1e7) s -= 0.6;
    return s;
  }
  function score(c) {
    let s = c.recency * 2;                                       // ідемо за тим, що слухаєш зараз
    s += Math.max(0, c.sources.size - 1) * 0.6;                  // згода кількох селекторів
    s += Math.max(-6, Math.min(affinity[c.artistUri] || 0, 8)) * 0.2; // вивчена симпатія (легка — щоб не тягнути до тих самих)
    s -= (S.skipArtist.get(c.artistUri) || 0) * 1.5;             // скіп = «зараз не те»
    s -= S.skipNear.get(c.artistUri) || 0;                       // схожий на скіпнутого — той самий напрям
    s -= S.soundAvoid.get(c.uri) || 0;                           // звучить як дизлайкнутий (рекомендації Spotify до нього)
    s -= dislikePenalty(c.artistUri);                            // дизлайкав артиста або схожих (Pro, надовго)
    s -= Math.min(skipLoad(c.artistUri), 4) * 0.8;               // скіпав артиста (за ~3–4 дні; 2 свіжі скіпи ≈ −1.6)
    if (c.seed) s -= (S.seedPenalty.get(c.seed) || 0) * 1.2;     // напрям, від якого скіпали
    // РІЗНОМАНІТНІСТЬ: нові артисти в пріоритеті, ті, що вже звучали, — нижче (з урахуванням минулих днів)
    const arts = artistsOf(c);
    const fat = arts.length ? Math.max(...arts.map(fatigue)) : 0;
    s -= fat * 1.5;
    // давно (або ніколи) не почутий артист — але лише поруч із твоїм смаком, інакше хвилю відносить у випадкове
    if (arts.length && arts.every((a) => artistSince(a) > 400) && (tasteOf(c) > 0 || (graphScore.get(c.artistUri) || 0) > 0)) s += 1.2;
    s -= replayPenalty(c);                                       // уже звучав у минулих запусках (або його двійник)
    // нахил у «знахідки»: мегахіти й зірки вниз, середній/маловідомий рівень угору, мертвий ноунейм вниз.
    // У «Популярному» — навпаки.
    if (settings.character === "popular") s += popularityScore(c) * 2.5; // популярне, але не ціною настрою
    else {
      s += nicheScore(c);
      // хіти 100 млн+ — іноді, але не поспіль: якщо за останні ~5 треків уже був хіт, наступний значно нижче
      if (isMegaHit(c) && hitRecently()) s -= 2.5;
    }
    // СМАК: близькість до твоїх улюблених артистів (околиця смаку + схожі на нещодавно прослуханих)
    const taste = tasteOf(c);
    const near = Math.min(graphScore.get(c.artistUri) || 0, 4);
    const fam = isFamiliar(c);
    if (settings.character === "favorite") s += P.likedTracks.has(c.uri) ? 1.5 : 1;
    else if (settings.character === "unfamiliar") {
      // нове, але поруч із твоїм смаком: не йдемо в чужі сцени
      s += taste * 1.0 + near * 0.3;
      if (!taste && !near && c.recency < 0.3) s -= 1.0;    // ні до смаку, ні до графа від поточного прослуховування — дрейф
    } else s += taste * (settings.character === "popular" ? 0.5 : 0.7) + near * 0.3;
    if (!settings.character) { // звичайна хвиля: баланс знайомого й нового
      const famRecent = S.picksFamiliar.slice(-5).filter(Boolean).length;
      if (fam) s += famRecent >= 2 ? -2 : 0.6;
    }
    const genrePools = hardPools().filter((p) => p.key.startsWith("genre:"));
    for (const p of genrePools) s += [0, 0.4, 0.7][genreLevel(p, c)]; // ближче до жанру — вище
    if (genrePools.length) {
      s += taste * 0.8; // жанр — рамка, а в її межах — ближче до твого смаку
      if (!taste && !near && !c.sources.has("walk")) s -= 1.0; // ні до смаку, ні від твоїх улюблених — мейнстрим жанру
      // лише з редакторських плейлистів і не дуже близьке до смаку — найчастіше мейнстрим жанру: основа — дерево від улюблених
      if (c.sources.size === 1 && c.sources.has("tag") && taste < 1.5) s -= 0.8;
    }
    // Настрій/заняття — за ТРЕКОМ: сам із розмітки — значно вище («грустный рэп» — ще вище),
    // схожий на трек звідти — вище, просто артист звідти — трішки; артист із протилежного — нижче.
    for (const k of moodKeysSel()) {
      const p = tagPools.get(k);
      if (!p || !p.tracks.length) continue;
      const lvl = moodLevel(c, k);
      if (lvl === 2) s += moodComboExact(c.uri, k) ? 4.0 : 3.5;
      else if (lvl === 1) s += 1.8;
      else if (inPool(p, c)) s += 0.3;
    }
    if (oppositeArtistOnly(c)) s -= 1.0;
    s += Math.random() * 1.2;
    return s;
  }
  // Поступки по черзі (добираємо до потрібної кількості треків щабель за щаблем):
  // артист раніше ніж через ARTIST_GAP пісень → повтор артиста раніше ніж через 25 треків → характер → жанр/настрій → той самий артист поруч → і лише наприкінці мова.
  const RELAX_TIERS = [
    {}, { artistGap: true }, { cooldown: true }, { cooldown: true, tags: "any" },
    { cooldown: true, tags: "any", character: true }, { cooldown: true, tags: true, character: true },
    { cooldown: true, tags: true, character: true, adjacent: true },
    { cooldown: true, tags: true, character: true, adjacent: true, replay: true },        // те, що нещодавно звучало, — лише якщо інакше нічого
    { cooldown: true, tags: true, character: true, adjacent: true, replay: true, lang: true },
    { cooldown: true, tags: true, character: true, adjacent: true, replay: true, lang: true, liked: true }, // тиші не буде
  ];
  const RELAX_NOTES = { character: L("характер", "character"), tags: L("жанр/настроение", "genre/mood"), lang: L("язык", "language") };
  // Мегахіт (100 млн+ або зірка без даних про трек) — допустимо, але не частіше ~1 із 6
  function isMegaHit(c) {
    const pc = c.playcount || 0;
    if (pc) return pc > 1e8;
    return (c.listeners || artistFame.get(c.artistUri) || 0) > 3e7;
  }
  const hitRecently = () => S.recentHits.slice(-5).some(Boolean);

  // okFn — додаткова умова (наприклад, «текст уже перевірено»), щоб вибрати без очікування мережі
  function pickNext(k, exclude, avoidArtists, maxTier, okFn) {
    const out = [];
    const deferred = []; // хіти, відкладені заради частки: беремо, лише якщо інакше бракує
    const hitsOff = settings.character !== "popular";
    const taken = new Set(exclude || []);
    const arts = new Set(avoidArtists || []); // не ставити артиста (і фіти) поруч із тим самим
    const lastTier = Math.min(RELAX_TIERS.length - 1, maxTier == null ? 99 : maxTier);
    for (let ti = 0; ti <= lastTier && out.length < k; ti++) {
      const relax = RELAX_TIERS[ti];
      const cands = [...S.pool.values()].filter((c) => !taken.has(c.uri) && hardFilter(c, relax) && (!okFn || okFn(c)));
      if (!cands.length) continue;
      cands.forEach((c) => (c._s = score(c)));
      cands.sort((a, b) => b._s - a._s);
      const before = out.length;
      for (const c of cands) {
        if (out.length >= k) break;
        const as = artistsOf(c);
        if (!relax.adjacent && as.some((u) => arts.has(u))) continue;
        if (hitsOff && isMegaHit(c) && (hitRecently() || out.some(isMegaHit))) { deferred.push(c); continue; }
        as.forEach((u) => arts.add(u));
        taken.add(c.uri);
        out.push(c);
      }
      // не вистачило без хітів на цьому щаблі — краще хіт, ніж послаблювати умови далі
      for (const c of deferred.splice(0)) {
        if (out.length >= k) break;
        if (taken.has(c.uri)) continue;
        taken.add(c.uri); out.push(c);
      }
      if (out.length > before) S.tierUse[ti] = (S.tierUse[ti] || 0) + out.length - before; // для діагностики: з якого щабля беремо
      if (out.length > before && ti > 0) {
        logEvent("Добрал с уступкой", relax);
        S.relaxNotified = S.relaxNotified || {};
        for (const key of ["character", "tags", "lang"]) {
          if (relax[key] === true && !S.relaxNotified[key]) {
            S.relaxNotified[key] = true;
          }
        }
      }
    }
    return out;
  }

  // «Без слів»: фінальна звірка вибраних треків — якщо знайшовся текст, замінюємо
  async function verifyInstrumental(picks, k, exclude, avoid) {
    if (settings.language !== "instrumental") return picks;
    // заміни теж перевіряються; на останньому колі замін уже немає — краще на трек менше, ніж трек із вокалом
    for (let round = 0; picks.length; round++) {
      await Promise.all(picks.map((c) => checkLyrics(c.uri, 0)));
      const good = picks.filter((c) => instrumentalOk(c, true)); // «не знаю» = не можна (крім кураторської розмітки)
      if (good.length === picks.length || round === 3) return good;
      const taken = new Set([...(exclude || []), ...picks.map((c) => c.uri)]);
      picks = good.concat(pickNext(k - good.length, taken, avoid));
    }
    return picks;
  }

  // ---------------- Відтворення ----------------
  // Контекст = [зіграна історія…, поточний, наступні]. «Назад» ходить історією,
  // наступні треки перераховуються після кожної твоєї дії.
  // ВАЖЛИВО: uri контексту — внутрішній, як у самого Spotify для списків рекомендацій.
  // Якщо підставити uri треку, Spotify викидає наш список і вмикає своє радіо від треку.
  const CTX_URI = "spotify:internal:recs:track-ilr";
  // seekMs — продовжити поточний трек із тієї самої секунди (так робить і сам Spotify), без рестарту й перемотування
  // guard — остання перевірка прямо перед надсиланням (поки чистили чергу, могли перемкнути трек)
  async function playCtx(index, seekMs, guard) {
    S.rebuildUntil = Date.now() + 3000;
    await dropOurQueue();
    if (guard && !guard()) { S.rebuildUntil = 0; return; }
    for (const c of S.ctx) S.queued.set(c.uri, c); // усе, що віддали Spotify, — «наше», навіть якщо список уже змінили
    const opts = { skipTo: { index } };
    if (seekMs > 1200) opts.seekTo = Math.floor(seekMs);
    await Spicetify.Platform.PlayerAPI.play(
      { uri: CTX_URI, pages: [{ items: S.ctx.map((c) => ({ uri: c.uri, uid: null, type: "track", provider: null })) }] },
      { featureIdentifier: "volna", referrerIdentifier: "volna" },
      opts
    );
    verifyQueue();
  }
  // Перевірка: наступний трек у Spotify має бути нашим
  function verifyQueue() {
    setTimeout(() => {
      try {
        const next = (Spicetify.Queue && Spicetify.Queue.nextTracks) || [];
        const nextUri = next[0]?.contextTrack?.uri || next[0]?.uri;
        const curUri = Spicetify.Player.data?.item?.uri;
        const at = S.ctx.findIndex((c) => c.uri === curUri);
        if (at === -1) return;
        const expected = S.ctx[at + 1]?.uri;
        if (!expected || !nextUri) return;
        S.queueOk = nextUri === expected;
        if (S.queueOk) { S.queueMiss = 0; return; }
        // режим черги: наступним у Spotify стоїть НАШ трек (поставлений просто перед перемиканням) — просто звіряємо план
        const ours = S.queued.get(nextUri);
        if (S.feedMode && ours && !S.played.has(nextUri)) {
          S.ctx = [...S.ctx.slice(0, S.head + 1), ours, ...S.ctx.slice(S.head + 1).filter((c) => c.uri !== nextUri)];
          S.inSpotifyQueue.add(nextUri);
          S.queueOk = true;
          logEvent("План сверен с очередью Spotify", { следующий: nextUri });
          return;
        }
        logEvent("ВНИМАНИЕ: Spotify играет не наш список", { ждали: expected, уSpotify: nextUri });
        // режим черги двічі розійшовся зі Spotify — до кінця запуску повертаємося до перезбирання списку
        // (та сама розбіжність, помічена двома перевірками одразу, рахується один раз)
        const sig = expected + ">" + nextUri;
        if (sig !== S.lastMissSig) { S.lastMissSig = sig; S.queueMiss = (S.queueMiss || 0) + 1; }
        if (S.feedMode && S.queueMiss >= 2) {
          S.feedMode = false;
          logEvent("Очередь Spotify ведёт себя не так — перехожу на пересборку списка");
          rebuildAhead().catch(() => {});
        }
      } catch {}
    }, 1500);
  }
  async function beginTrack(c) {
    S.played.add(c.uri);
    { const k = songKey(c); if (k) S.playedKeys.add(k); }
    S.pool.delete(c.uri);
    noteRecent(artistsOf(c));
    for (const a of artistsOf(c)) S.artistPlays.set(a, (S.artistPlays.get(a) || 0) + 1);
    S.picksFamiliar.push(isFamiliar(c)); if (S.picksFamiliar.length > 20) S.picksFamiliar.shift();
    noteTrackPlayed(c);
    noteDiscovery(c);
    for (const a of artistsOf(c)) noteArtistPlayed(a, playNo, true);
    saveLater("artistLast", saveArtistHist);
    S.recentHits.push(isMegaHit(c)); if (S.recentHits.length > 20) S.recentHits.shift();
    c.wasLiked = P.likedTracks.has(c.uri) || (!heartApi && await isLiked(c.uri));
  }
  function explainPick(c) {
    return `${c.artistName || "?"} — ${c.name || idOf(c.uri)} [${[...(c.sources || [])].join("+")}] ${c._s != null ? c._s.toFixed(2) : ""}`;
  }

  // Наслідки лайка — один раз на трек (одразу при натисканні або, якщо не встигли помітити, наприкінці треку)
  function applyLike(c) {
    if (c._likeApplied) return;
    c._likeApplied = true;
    const a = c.artistUri;
    bumpAffinity(a, 2); saveAffinity(); P.likedTracks.add(c.uri);
    rememberLike(c); forgiveSkips(a, true); forgiveDislikes(a);
    P.heard.add(c.uri); if (a) P.familiarIds.add(idOf(a));
    learnTasteFromLike(a).catch(() => {}); // лайк розширює смак: цей артист і його схожі ближчі
    likeRadio(c); // і радіо саме цієї пісні — у кандидати
  }
  // Лайк під час треку — хвиля змінюється одразу, як у Яндексі: схоже на лайкнутий — у кандидати,
  // наступні треки перезбираються від нього (поточний продовжує грати з тієї самої секунди).
  // Поточний трек при цьому НЕ чіпаємо (жодних перезапусків): 2 схожі додаємо в чергу Spotify — вони
  // грають одразу після поточного; попередній план хвиля замінить на стику треків.
  // Миттєва реакція на лайк — Pro. У Free лайк враховується на зміні треку (recordOutcome).
  // Блок із міткою @pro у Free-збірці замінюється заглушкою з коментаря @free (tools/build.js).
  async function onLikeNow() {}
  async function queueSimilarNext() { return []; }
  // Наші треки, поставлені в чергу Spotify, прибираємо перед заміною списку — інакше порядок роз'їдеться
  async function dropOurQueue() {
    if (!S.inSpotifyQueue.size) return;
    try { await Spicetify.Platform.PlayerAPI.clearQueue(); } catch (e) { logEvent("очистка очереди: ошибка", String(e)); }
    S.inSpotifyQueue.clear();
  }

  async function recordOutcome(c) {
    c._recorded = true;
    const prog = S.progress.get(c.uri) || 0;
    const dur = S.duration.get(c.uri) || 0;
    const ratio = dur ? prog / dur : 0;
    let outcome;
    if (c._disliked) outcome = "dislike";
    else if (ratio >= 0.8 || (dur && dur - prog < 15000)) outcome = "finished";
    else if (dur ? ratio < 0.5 : prog < 30000) outcome = "skip"; // перемкнув до середини — «не те»
    else outcome = "partial";
    if (outcome !== "dislike" && !c.wasLiked && (heartApi ? S.hearted.has(c.uri) : await isLiked(c.uri))) outcome = "like";
    S.lastOutcome = outcome;
    const a = c.artistUri;
    if (outcome === "finished") { bumpAffinity(a, 0.3); forgiveSkips(a, false); }
    else if (outcome === "partial") bumpAffinity(a, 0.05);
    else if (outcome === "skip") {
      // вага скіпу — за тим, коли перемкнув: до 10 с — «точно не моє», до 30 с — «не те», далі — «не зараз»
      const w = prog < 10000 ? 2.5 : prog < 30000 ? 1.5 : 0.8;
      if (a) S.skipArtist.set(a, (S.skipArtist.get(a) || 0) + w);
      if (c.seed) S.seedPenalty.set(c.seed, (S.seedPenalty.get(c.seed) || 0) + w);
      bumpAffinity(a, -0.1 * w);
      noteSkip(a);
      if (prog < 30000) { // скіпнув одразу — цей трек тиждень не ставимо
        noteQuickSkip(c);
        // і рахуємо його за пів пісні: інакше від частих скіпів «скільки пісень минуло» біжить швидше й артисти повертаються раніше
        playNo = Math.max(0, playNo - 0.5); saveLater("trackHist", saveTrackHist);
      }
      await penalizeDirection(c, w);
    } else if (outcome === "like") applyLike(c);
    else if (outcome === "dislike") {
      bumpAffinity(a, -2); noteSkip(a); noteDislike(c);
      if (a) S.skipArtist.set(a, (S.skipArtist.get(a) || 0) + 2.5);
      await Promise.all([penalizeDirection(c, 2.5), avoidSound(c)]);
    }
    // дослухав/лайкнув — цей артист більше не «поруч зі скіпнутим»
    if (outcome === "finished" || outcome === "like") for (const u of artistsOf(c)) S.skipNear.delete(u);
    // серія скіпів: 2 поспіль (і далі кожні 2) — не подобається весь напрям, змінюємо курс
    S.skipStreak = outcome === "skip" || outcome === "dislike" ? S.skipStreak + 1 : 0;
    if (S.skipStreak >= 2 && S.skipStreak % 2 === 0) changeCourse();
    // «не зараз» поступово забувається
    for (const m of [S.skipArtist, S.seedPenalty, S.skipNear, S.soundAvoid]) {
      for (const [k, v] of [...m]) { const nv = v * 0.85; if (nv < 0.1) m.delete(k); else m.set(k, nv); }
    }
    saveAffinity();
    S.history.push({ uri: c.uri, artistUri: a, artistName: c.artistName, name: c.name, outcome, seed: c.seed,
      sources: [...(c.sources || [])].join("+"), at: Date.now() });
    if (S.history.length > 200) S.history.shift();
    noteStats(c, outcome, dur ? Math.min(prog, dur) : prog);
  }
  // Скіп згортає НАПРЯМ, а не лише артиста: схожі на нього теж тимчасово нижче (слабше, ніж він сам).
  // Артистів плейлиста/артиста, за яким запущено хвилю, не чіпаємо — їх ти вибрав сам.
  // Чекаємо не довше 0,3 с (схожі зазвичай уже в кеші), щоб не затримувати наступні треки; не встигли — штраф наздожене.
  function penalizeDirection(c, w) {
    const arts = artistsOf(c).filter((u) => !isSourceArtist(u));
    if (!arts.length) return Promise.resolve();
    const apply = (rel) => {
      for (const u of (rel || []).slice(0, 20)) {
        if (arts.includes(u) || isSourceArtist(u)) continue;
        S.skipNear.set(u, Math.min((S.skipNear.get(u) || 0) + 0.4 * w, 3));
      }
    };
    const job = relatedArtists(arts[0]).then(apply).catch(() => {});
    return Promise.race([job, new Promise((r) => setTimeout(r, 300))]);
  }
  // Дизлайк відводить і від «того самого звучання»: треки, які Spotify рекомендує до дизлайкнутого, у цьому запуску нижче.
  // Як і зі схожими артистами — чекаємо не довше 0,3 с, інакше штраф наздожене у фоні.
  function avoidSound(c) {
    const job = recommendByTrack(c.uri).then((list) => {
      for (const t of list || []) if (t && t.uri && !isSourceArtist(t.artistUri)) S.soundAvoid.set(t.uri, Math.max(S.soundAvoid.get(t.uri) || 0, 2.5));
    }).catch(() => {});
    return Promise.race([job, new Promise((r) => setTimeout(r, 300))]);
  }
  // Курс змінюється без перезапуску поточного треку: сіди — уже не останні пісні, а перевірене улюблене
  // (як «струснути»), кандидати «по слідах» останніх пісень втрачають перевагу.
  function changeCourse() {
    S.courseAt = Date.now(); // сіди — лише те, що дослухано після зміни курсу
    S.likeSeed = null;
    for (const c of S.pool.values()) c.recency *= 0.3;
    // нові сіди й кандидати від них — у фоні (поточний трек і найближчі не чекають)
    coldStartSeeds(true).then((seeds) => { if (seeds && seeds.length) { S.coldSeeds = seeds; refreshPool(); } }).catch(() => {});
    logEvent("Серия скипов — меняю направление", { подряд: S.skipStreak });
  }

  // Вибрати want треків після head і ahead (із добором, якщо кандидатів мало, і звіркою «Без слів»)
  async function choosePicks(head, ahead, want, exclude) {
    const need = Math.min(2, ahead.length + want); // стільки має бути попереду, щоб не ввімкнувся автоплей Spotify
    const avoid = new Set([head, ...ahead].flatMap(artistsOf));
    let picks = pickNext(want, new Set([...ahead.map((c) => c.uri), ...(exclude || [])]), avoid);
    if (ahead.length + picks.length < need) { // попереду майже порожньо — добираємо
      await refreshPool();
      const taken = new Set([...ahead, ...picks].map((c) => c.uri));
      picks = picks.concat(pickNext(want - picks.length, taken, avoid));
      if (ahead.length + picks.length < need) {
        await emergencyFill();
        picks = picks.concat(pickNext(want - picks.length, new Set([...ahead, ...picks].map((c) => c.uri)), avoid));
      }
    }
    picks = await verifyInstrumental(picks, want, new Set(ahead.map((c) => c.uri)), avoid);
    if (ahead.length + picks.length < need) { // звірка відбракувала майже все — добираємо ще раз
      await refreshPool(); await emergencyFill();
      const taken = new Set([...ahead, ...picks].map((c) => c.uri));
      picks = picks.concat(await verifyInstrumental(pickNext(want - picks.length, taken, avoid), want - picks.length, taken, avoid));
    }
    return picks;
  }

  // Що далі — БЕЗ ПАУЗ: список Spotify після старту не перезапускаємо (play() заново вантажить поточну пісню —
  // звідси мікропауза). Наступний трек підкладаємо в чергу Spotify (addToQueue — як «Додати в чергу»):
  // попереду завжди рівно один наш. Скіп/лайк/дизлайк враховуються у виборі цього наступного треку.
  // Попередній список Spotify (зі старту) — запас на випадок, якщо перемкнув швидше, ніж трек устиг стати в чергу.
  const RESERVE_SIZE = 5; // невеликий — його видно в «Next up» у Spotify
  // У жанровій хвилі старт і запасний список — лише те, що поруч зі смаком або прийшло від твоїх улюблених:
  // запас грає на швидких «далі», і саме там найчастіше вилазив мейнстрим жанру.
  function genreSafe(c) {
    const gp = hardPools().filter((p) => p.key.startsWith("genre:"));
    if (!gp.length) return true;
    return tasteOf(c) >= 0.5 || (graphScore.get(c.artistUri) || 0) > 0 || !!(c.sources && c.sources.has("walk"));
  }
  const both = (f, g) => (f && g ? (c) => f(c) && g(c) : f || g || null);
  // запас — до передостаннього щабля поступок (усе, крім «тиші не буде»): короткий запас у вузькому «Незнайомому»
  // доводилося поповнювати посеред треку, а це мікропауза
  const RESERVE_TIER = () => RELAX_TIERS.length - 2;
  // чи грає Spotify поточний трек хвилі (а не гортаєш історію «назад»)
  const atFrontier = () => !!S.ctx[S.head] && Spicetify.Player.data?.item?.uri === S.ctx[S.head].uri;
  // один підбір за раз; трек змінився посеред підбору — підбираємо знову вже для нового
  let feedBusy = false, feedAgain = false, feedTriedAt = 0;
  async function feedQueue() {
    feedTriedAt = Date.now();
    if (feedBusy) { feedAgain = true; return; }
    feedBusy = true;
    try { do { feedAgain = false; await feedOnce(); } while (feedAgain && S.active && S.feedMode); }
    catch (e) { logEvent("подбор следующего: ошибка", String(e && e.stack || e)); }
    finally { feedBusy = false; }
  }
  // підстраховка під час пісні: якщо наш наступний так і не став у чергу — ставимо
  function feedIfEmpty() {
    if (!S.active || S.starting || !S.feedMode || feedBusy || Date.now() - feedTriedAt < 4000 || !atFrontier()) return;
    if (S.ctx.slice(S.head + 1).some((c) => S.inSpotifyQueue.has(c.uri))) return;
    feedQueue();
  }
  async function feedOnce() {
    const head = S.ctx[S.head];
    if (!head || !atFrontier()) return; // гортаєш історію — нове в чергу не ставимо, інакше «вперед» піде не туди
    const gen = S.headGen;
    const stale = () => gen !== S.headGen || S.ctx[S.head] !== head;
    const { queued: qList, nextUp } = await spotifyQueueState();
    if (stale()) { feedAgain = true; return; }
    // наше, що вже стоїть у черзі Spotify (схоже після лайка або трек, поставлений просто перед перемиканням), —
    // воно й зіграє наступним. Беремо його із самої черги Spotify і в її порядку, а не зі своїх записів — так не розійдемося
    const ahead = qList.filter((u) => u !== head.uri && S.queued.has(u) && !S.played.has(u)).map((u) => S.queued.get(u));
    S.inSpotifyQueue = new Set(ahead.map((c) => c.uri));
    const tail = S.ctx.slice(Math.max(0, S.head - 30), S.head);
    if (ahead.length) { S.ctx = [...tail, head, ...ahead]; S.head = tail.length; return; }
    // запас зі стартового списку Spotify може ще зіграти — його треки в чергу не ставимо (інакше прозвучать двічі)
    const reserve = [...S.queued.keys()].filter((u) => !S.played.has(u));
    let picks = null;
    S.urgentPick = true;
    try {
      const careful = choosePicks(head, [], 1, reserve);
      // «Без слів»: перевірка тексту може затриматися — чекаємо не довше 1,5 с, інакше найкращий із уже перевірених
      // (текст перевірено і його немає), щоб наступний трек точно встиг стати в чергу
      if (settings.language === "instrumental") {
        picks = await Promise.race([careful, new Promise((r) => setTimeout(() => r(null), 1500))]);
        if (!picks) picks = pickNext(1, new Set(reserve), new Set(artistsOf(head)), undefined, (c) => lyricsKnown.get(c.uri) === false && instrumentalOk(c, true));
        if (!picks.length) picks = await careful;
      } else picks = await careful;
    } finally { S.urgentPick = false; }
    if (stale()) { feedAgain = true; return; }
    if (!picks.length) return;
    // запас стартового списку майже скінчився (багато подвійних натискань) — поповнюємо його, але лише на самому початку треку:
    // перезапуск списку тоді зливається зі зміною пісні. Буває рідко.
    if (nextUp >= 0 && nextUp < 2 && (Spicetify.Player.getProgress?.() || 0) < 2500) {
      const ex = new Set([...reserve, ...picks.map((c) => c.uri)]);
      const spare = pickNext(RESERVE_SIZE, ex, new Set([head, ...picks].flatMap(artistsOf)), RESERVE_TIER(),
        both(settings.language === "instrumental" ? (c) => lyricsKnown.get(c.uri) === false && instrumentalOk(c, true) : null, genreSafe));
      const t3 = S.ctx.slice(Math.max(0, S.head - 30), S.head);
      S.ctx = [...t3, head, ...picks, ...spare]; S.head = t3.length;
      S.lastPicks = picks.map(explainPick);
      logEvent("Запас списка пополнен", { треков: spare.length });
      try { await playCtx(S.head, Spicetify.Player.getProgress?.() || 0, () => !stale() && atFrontier()); } catch (e) { logEvent("пополнение запаса не удалось", String(e)); }
      return;
    }
    try {
      // поки вибирали, могли поставити лайк — тоді схоже вже в черзі, зайвого не додаємо
      if (S.ctx.slice(S.head + 1).some((c) => S.inSpotifyQueue.has(c.uri))) return;
      if (picks.some((x) => S.queued.has(x.uri))) { feedAgain = true; return; } // цей трек уже поставив лайк — підберемо інший
      await enqueue(picks);
      // поки ставили, трек змінився: план не переписуємо старим — наступний прохід візьме поставлене з черги Spotify
      if (stale()) { feedAgain = true; return; }
      const t2 = S.ctx.slice(Math.max(0, S.head - 30), S.head);
      S.ctx = [...t2, head, ...picks]; S.head = t2.length;
      S.lastPicks = picks.map(explainPick);
      verifyQueue();
      precheckLyrics();
    } catch (e) { logEvent("очередь Spotify не приняла трек — перехожу на пересборку списка", String(e)); S.feedMode = false; }
  }
  // «Без слів»: поки грає трек, заздалегідь перевіряємо текст у найімовірніших наступних — підбір потім не чекає мережі
  function precheckLyrics() {
    if (settings.language !== "instrumental") return;
    const top = [...S.pool.values()].filter((c) => !lyricsKnown.has(c.uri) && hardFilter(c, { artistGap: true, lang: true }))
      .map((c) => [c, score(c)]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    for (const [c] of top) checkLyrics(c.uri, 1).catch(() => {});
  }
  // Поставити в чергу Spotify. Трек позначаємо «нашим» ДО відповіді Spotify (він відповідає не миттєво): інакше лайк і підбір,
  // що спрацювали в цю частку секунди, виберуть той самий трек — і він стане в чергу двічі.
  async function enqueue(picks) {
    for (const x of picks) { S.queued.set(x.uri, x); S.inSpotifyQueue.add(x.uri); }
    // внутрішня черга Spotify — те саме «Додати в чергу», але без спливашки «Added to queue» на кожен трек хвилі
    // (публічний addToQueue її показує); немає внутрішньої — звичайний спосіб
    const items = picks.map((x) => ({ uri: x.uri, uid: null }));
    const PA = Spicetify.Platform.PlayerAPI, inner = PA && PA._queue;
    try { if (inner && typeof inner.addToQueue === "function") await inner.addToQueue(items); else await PA.addToQueue(items); }
    catch (e) { for (const x of picks) { S.queued.delete(x.uri); S.inSpotifyQueue.delete(x.uri); } throw e; }
  }
  // черга Spotify: queued — «Next in queue» по порядку; nextUp — скільки нашого запасу лишилося в списку («Next up»), −1 — невідомо
  async function spotifyQueueState() {
    try {
      const q = await Spicetify.Platform.PlayerAPI.getQueue();
      const uriOf = (x) => x && (x.uri || x.contextTrack?.uri);
      // у «Next up» рахуємо лише наш запас (туди Spotify може підмішати й свій автоплей)
      const ups = Array.isArray(q && q.nextUp) ? q.nextUp.map(uriOf).filter((u) => u && S.queued.has(u) && !S.played.has(u)).length : -1;
      return { queued: ((q && q.queued) || []).map(uriOf).filter(Boolean), nextUp: ups };
    } catch { return { queued: S.ctx.slice(S.head + 1).filter((c) => S.inSpotifyQueue.has(c.uri)).map((c) => c.uri), nextUp: -1 }; }
  }

  // Запасний спосіб (якщо черга Spotify повелася не так): перезібрати список цілком — із мікропаузою
  async function rebuildAhead() {
    const head = S.ctx[S.head];
    const gen = S.headGen; // якщо за час перезбирання трек змінився — це перезбирання застаріло, нічого не чіпаємо
    const stale = () => gen !== S.headGen || S.ctx[S.head] !== head;
    let ahead = S.ctx.slice(S.head + 1).filter((c) => hardFilter(c, { cooldown: true }));
    const signal = ["skip", "dislike", "like"].includes(S.lastOutcome);
    if (!signal && ahead.length >= 2) return;
    if (signal) ahead = [];
    const picks = await choosePicks(head, ahead, 3 - ahead.length);
    if (stale()) { logEvent("пересборка устарела — пропускаю"); return; }
    const tail = S.ctx.slice(Math.max(0, S.head - 30), S.head);
    S.ctx = [...tail, head, ...ahead, ...picks];
    S.head = tail.length;
    S.lastPicks = picks.map(explainPick);
    const prog = Spicetify.Player.getProgress?.() || 0;
    try {
      await playCtx(S.head, prog + 250); // +час на перезбирання, щоб не повторити шматочок
      // поки надсилали, ти встиг перемкнути — Spotify міг повернутися до минулого треку; ставимо правильний
      if (stale() && S.ctx[S.head] && Spicetify.Player.data?.item?.uri !== S.ctx[S.head].uri) await playCtx(S.head);
    } catch (e) { logEvent("пересборка очереди не удалась", String(e)); }
  }

  async function coldStartSeeds(shake) {
    if (waveSource && waveSource.tracks.length) {
      const langOk = (t) => settings.language === "ru" ? isRuTrack(t) : settings.language === "foreign" ? !isRuTrack(t) : true;
      const base = waveSource.tracks.filter(langOk);
      return sampleArr(base.length >= 3 ? base : waveSource.tracks, 5).map((t) => t.uri);
    }
    const tags = activeTags();
    if (tags.length) {
      await Promise.all(tags.map(loadTagPool));
      const hard = hardPools(), soft = softPools();
      const main = hard[0];
      if (main) {
        // сіди — з жанру; якщо вибрано настрій — самі треки «жанр × настрій» (їхні схожі теж будуть у настрої)
        const hardOk = (t) => hard.every((p) => inPool(p, t));
        const langOk = (t) => settings.language === "ru" ? isRuTrack(t) : settings.language === "foreign" ? !isRuTrack(t) : true;
        let base = main.tracks.filter(hardOk);
        if (!base.length) base = main.tracks;
        const exact = [...comboPools(), ...soft].flatMap((p) => p.tracks).filter(hardOk);
        if (exact.length >= 3) base = exact;
        const inLang = base.filter(langOk);
        if (inLang.length >= 3) base = inLang;
        // спершу — твої найбільш слухані треки від улюблених артистів цього жанру: хвиля росте з твого смаку
        const favIds = new Set((await genreFavorites(main)).map((a) => idOf(a.uri)));
        const own = P.topTracks.filter((t) => t.artistUri && favIds.has(idOf(t.artistUri)) && langOk(t));
        if (own.length >= 3) {
          const pickedOwn = sampleArr(own, 5);
          pickedOwn.forEach((t) => noteRecent(artistsOf(t)));
          return pickedOwn.map((t) => t.uri);
        }
        const mine = base.filter((t) => isFamiliar(t)); // за можливості — з твого «всесвіту»
        const picked = sampleArr(mine.length >= 3 && !shake ? mine : base, 5);
        picked.forEach((t) => noteRecent(artistsOf(t))); // самі сіди не граємо — і їхніх артистів одразу не повторюємо
        return picked.map((t) => t.uri);
      }
    }
    if (shake) return weightedSample(langSeedBase(), 5, likeWeightOf); // свіжі лайки — частіше
    let recent = [];
    try { recent = (await fetchTop("SHORT_TERM", "LAST_PLAYED", "SHORT_TERM", "LAST_PLAYED", 20)).tracks; } catch {}
    recent.forEach(noteArtistLang);
    if (settings.language === "ru") recent = recent.filter(isRuTrack);
    else if (settings.language === "foreign") recent = recent.filter((t) => !isRuTrack(t));
    recent.slice(0, 3).forEach((t) => noteRecent(artistsOf(t))); // ти їх щойно слухав — хвиля стартує з інших
    const seeds = recent.slice(0, 3).map((t) => t.uri);
    // добираємо сіди твоїми найбільш слуханими треками (а якщо історії немає — лайками)
    const filler = P.topTracks.length ? topTracksForLang().slice(0, 30).map((t) => t.uri) : langSeedBase();
    const langOk = (t) => settings.language === "ru" ? isRuTrack(t) : settings.language === "foreign" ? !isRuTrack(t) : true;
    for (const t of weightedSample(recentLikes(40).filter(langOk), 2, likeWeightOf)) { if (seeds.length >= 4) break; if (!seeds.includes(t.uri)) seeds.push(t.uri); }
    for (const u of sampleArr(filler, 6)) { if (seeds.length >= 5) break; if (!seeds.includes(u)) seeds.push(u); }
    return seeds;
  }

  async function startWave(opts) {
    if (S.starting) { S.restartPending = true; return; }
    S.starting = true;
    const t0 = Date.now();
    try {
      // що грало до запуску (або до зміни налаштувань) — його артистів одразу не повторюємо
      const before = (Spicetify.Player.data?.item?.artists || []).map((a) => a?.uri).filter(Boolean);
      const prevPool = [...S.pool.values()];
      const shake = !!(opts && opts.shake);
      resetSession();
      noteRecent(before);
      updateButton();
      await buildProfile(false);
      if (P.taste.size) ensureTaste().catch(() => {}); else await ensureTaste(); // оновлення смаку — у фоні
      [S.coldSeeds] = await Promise.all([coldStartSeeds(shake), syncRecentLikes(true), markRecentlyPlayed(true), syncWaveLikes()]);
      await Promise.all(oppositeKeys().map(loadTagPool));
      // Швидкий старт: кандидати минулого запуску + схоже на сіди (одне коло запитів) — і одразу граємо,
      // без поступок за характером/жанром/мовою. Повний набір кандидатів довантажується у фоні.
      if (!shake) (prevPool.length >= 30 ? prevPool : loadLastPool()).forEach((t) => addCand(t, "carry", null, 0));
      // етапи: швидкий набір → повний → аварійний; на кожному — звірка «Без слів»
      let picks = [], fast = true;
      const ALL = RELAX_TIERS.length - 1;
      // дерево від улюблених (жанр / «Незнайоме») — одразу паралельно: здебільшого воно з кешу артистів і швидке,
      // а без нього швидкий набір у цих режимах часто порожній і старт чекав повного набору
      const warm = tasteWalkSelector({}).catch(() => {});
      const stages = [
        // швидкий набір: можна поступитися лише «характером» (знайомі в «Незнайомому»), жанром/настроєм/мовою — ні
        async () => { await refreshPoolOnce({ quick: true }); return 4; },
        // швидкому набору не вистачило — до 1,5 с чекаємо дерево від улюблених (воно вже рахується), а не повний набір
        async () => { await Promise.race([warm, new Promise((r) => setTimeout(r, 1500))]); return 4; },
        async () => { fast = false; await refreshPool(); return ALL; },
        async () => { await emergencyFill(); return ALL; },
      ];
      for (const stage of stages) {
        const maxTier = await stage();
        const taken = new Set(picks.map((c) => c.uri)), avoid = new Set(picks.flatMap(artistsOf));
        // швидкий набір у жанрі — лише «безпечне» (поруч зі смаком); не вистачило — чекаємо повний набір, а не граємо мейнстрим
        const more = pickNext(3 - picks.length, taken, avoid, maxTier, fast ? genreSafe : null);
        picks = picks.concat(await verifyInstrumental(more, 3 - picks.length, taken, avoid));
        if (picks.length >= (fast ? 2 : 3)) break;
      }
      if (!picks.length) {
        Spicetify.showNotification(L("Drift for Spotify: Spotify не отдаёт треки — проверь интернет (подробности в Диагностике)",
          "Drift for Spotify: Spotify isn't returning tracks — check your connection (see Diagnostics)"), true);
        return;
      }
      // запас: стартовий список Spotify — підстраховка, якщо перемикаєш швидше, ніж наступний трек стає в чергу
      // (на подвійному натисканні «далі»). Список віддається один раз на старті — запас нічого не коштує
      const spare = pickNext(RESERVE_SIZE, new Set(picks.map((c) => c.uri)), new Set(picks.flatMap(artistsOf)), RESERVE_TIER(),
        both(settings.language === "instrumental" ? (c) => lyricsKnown.get(c.uri) === false && instrumentalOk(c, true) : null, genreSafe));
      S.ctx = [...picks, ...spare]; S.head = 0; S.headGen = (S.headGen || 0) + 1;
      S.lastPicks = picks.map(explainPick);
      // чужі треки в черзі Spotify грають раніше за контекст — прибираємо
      try { await Spicetify.Platform.PlayerAPI.clearQueue(); } catch (e) { logEvent("очистка очереди: ошибка", String(e)); }
      await playCtx(0);
      S.active = true;
      await beginTrack(S.ctx[0]);
      updateButton();
      logEvent("Старт", { быстрый: fast, мс: Date.now() - t0 });
      refreshPool();
    } catch (e) {
      logEvent("ОШИБКА старта", String(e && e.stack || e));
      Spicetify.showNotification(L("Drift for Spotify: ошибка (см. Диагностику)", "Drift for Spotify: something went wrong (see Diagnostics)"), true);
    } finally {
      S.starting = false;
      if (S.restartPending) { S.restartPending = false; startWave(); }
    }
  }
  function stopWave() {
    S.active = false; updateButton();
  }
  function toggleWave() { if (S.active) stopWave(); else { waveSource = null; startWave(); } }
  async function startSourceWave(type, uri) {
    if (!proActive()) { showUpsell(type === "artist" ? L("Drift по артисту", "Drift from an artist") : L("Drift по плейлисту", "Drift from a playlist")); return; }
    try {
      const src = await loadSource(type, uri);
      if (!src.tracks.length) { Spicetify.showNotification(L("Drift for Spotify: не получилось прочитать треки", "Drift for Spotify: couldn't read the tracks"), true); return; }
      waveSource = src;
      logEvent("Волна по источнику", { type, name: src.name, треков: src.tracks.length });
      await startWave();
    } catch (e) { logEvent("волна по источнику: ошибка", String(e)); Spicetify.showNotification(L("Drift for Spotify: ошибка (см. Диагностику)", "Drift for Spotify: something went wrong (see Diagnostics)"), true); }
  }
  function clearSource() { waveSource = null; updateButton(); if (S.active) startWave(); }
  function shakeWave() { startWave({ shake: true }); }

  // «Назад» у режимі черги. Зігране йшло через чергу Spotify, а його власне «назад» веде стартовим
  // списком — грала б інша пісня. Spotify перед «назад» надсилає подію action, яку можна скасувати:
  // скасовуємо й вмикаємо справжню попередню пісню; далі «вперед» іде справжньою історією.
  // Після 3 с треку «назад» — як у Spotify: на початок цієї ж пісні.
  function onPlayerAction(e) {
    if (!e || !e.data || e.data.action !== "skipToPrevious") return;
    if (!S.active || S.starting || !S.feedMode) return;
    if ((Spicetify.Player.getProgress?.() || 0) > 3000) return;
    const at = S.ctx.findIndex((c) => c.uri === Spicetify.Player.data?.item?.uri);
    if (at <= 0) return; // раніше за історію хвилі — хай вирішує Spotify
    e.preventDefault();
    // у список — уся історія, план і запас (запас — підстраховка на швидкі «вперед»)
    const extra = [...S.queued.values()].filter((c) => !S.played.has(c.uri) && !S.ctx.includes(c)).slice(0, RESERVE_SIZE);
    S.ctx = [...S.ctx, ...extra];
    playCtx(at - 1).catch((err) => logEvent("назад: не получилось", String(err)));
  }
  async function onSongChange() {
    const cur = Spicetify.Player.data?.item?.uri;
    // хвиля на паузі, а Spotify дограє її список — однаково пам'ятаємо, що трек звучав (інакше він повернеться)
    if (!S.active && cur && S.queued.has(cur) && !S.played.has(cur)) { S.played.add(cur); noteTrackPlayed(S.queued.get(cur)); }
    if (!S.active || S.starting) return;
    if (!cur) return;
    let idx = S.ctx.findIndex((c) => c.uri === cur);
    if (idx === S.head) return;                         // той самий трек (наше перезбирання)
    if (idx === -1) {
      // швидкі натискання: Spotify ще йшов нашим ПОПЕРЕДНІМ списком — це однаково хвиля, вбудовуємо трек
      const ours = S.queued.get(cur);
      if (ours && !S.played.has(cur)) { S.ctx.splice(S.head + 1, 0, ours); idx = S.head + 1; }
      // Spotify дійшов до треку із запасу, який уже звучав (через чергу), — повтор: тихо далі, хвиля не зупиняється
      else if (ours && S.feedMode) { logEvent("повтор из запаса — пропускаю", { трек: cur }); Spicetify.Player.next(); return; }
      else if (Date.now() < S.rebuildUntil) return;
      else {
        S.active = false; updateButton();
        return;
      }
    }
    if (idx < S.head) { S.navBack = true; return; }     // «назад» історією
    S.inSpotifyQueue.delete(cur);
    const prev = S.ctx[S.head], wasBack = S.navBack, head = S.ctx[idx];
    S.navBack = false;
    S.head = idx; S.headGen++;                          // одразу: поточні перезбирання мають зрозуміти, що застаріли
    if (!wasBack && prev && !prev._recorded) await recordOutcome(prev);
    else S.lastOutcome = "";
    if (prev && prev._likeHandled && S.lastOutcome === "like") S.lastOutcome = ""; // уже врахували під час треку
    if (!head) return;
    const isCurrent = () => S.ctx[S.head] === head;
    if (isCurrent() && settings.blockAI && isAIArtist(head.artistUri)) { Spicetify.Player.next(); return; }
    await beginTrack(head);                              // зіграним позначаємо завжди, навіть якщо вже перемкнули далі
    if (!isCurrent()) return;                            // трек уже змінився — перезбере наступний виклик
    if (S.feedMode) await feedQueue(); else await rebuildAhead();
    maybeRefresh();
  }
  // Пул перезбираємо не на кожен трек: після твого сигналу (лайк/скіп/дизлайк), раз на 2 треки
  // або коли відповідних кандидатів лишилося мало.
  function maybeRefresh() {
    S.sinceRefresh++;
    const signal = ["skip", "dislike", "like"].includes(S.lastOutcome);
    syncRecentLikes().catch(() => {});
    markRecentlyPlayed().catch(() => {});
    if (!signal && S.sinceRefresh < 2 && passingCount() >= 25) return;
    S.sinceRefresh = 0;
    refreshPool();
  }
  function passingCount() {
    let n = 0;
    for (const c of S.pool.values()) if (hardFilter(c, { cooldown: true })) n++;
    return n;
  }

  // ---------------- Дії користувача ----------------
  function current() {
    const it = Spicetify.Player?.data?.item;
    if (!it) return null;
    return { uri: it.uri, artistUri: it.artists?.[0]?.uri, artistName: it.artists?.[0]?.name, name: it.metadata?.title || it.name };
  }
  // Дизлайк: цей трек більше ніколи, і хвиля одразу йде від нього
  let lastDislikeAt = 0;
  function dislikeCurrent() {
    const cur = current(); if (!cur) return;
    if (Date.now() - lastDislikeAt < 700) return; // подвійне натискання не повинно забанити й наступний трек
    lastDislikeAt = Date.now();
    bannedTracks.add(cur.uri);
    { const k = songKey(cur); if (k) bannedTracks.add(k); } // і та сама пісня в інших версіях (sped up, remaster, сингл/альбом)
    saveBannedTracks();
    const c = S.ctx[S.head];
    if (S.active && c && c.uri === cur.uri) c._disliked = true;
    else if (cur.artistUri) { bumpAffinity(cur.artistUri, -2); saveAffinity(); noteDislike(cur); }
    // у хвилі — наступний із НАШОГО списку (у Spotify при швидких натисканнях список може бути застарілим)
    // (у режимі черги наступний наш уже стоїть у черзі Spotify — просто «далі», без перезапуску списку)
    if (S.active && !S.feedMode && c && c.uri === cur.uri && S.ctx[S.head + 1]) playCtx(S.head + 1).catch(() => Spicetify.Player.next());
    else Spicetify.Player.next();
  }
  function banArtistCurrent() {
    const cur = current(); if (!cur || !cur.artistUri) return;
    bannedArtists.set(cur.artistUri, Date.now() + settings.dislikeBanMin * 60000);
    bumpAffinity(cur.artistUri, -8); saveAffinity();
    Spicetify.showNotification(L(`🚫 ${cur.artistName || "Артист"} убран из Drift for Spotify на ${Math.round(settings.dislikeBanMin / 60)} ч`,
      `🚫 ${cur.artistName || "Artist"} removed from Drift for Spotify for ${Math.round(settings.dislikeBanMin / 60)} h`));
    Spicetify.Player.next();
  }

  window.Volna = {
    startWave, stopWave, toggleWave, shakeWave, dislikeCurrent, banArtistCurrent,
    rebuildProfile: () => buildProfile(true), getProfile: () => profile, session: S, journal,
    loadTagPool, inPool, blockerOf, getSettings: () => settings, getTaste: () => P.taste,
    clearBannedTracks: () => { bannedTracks.clear(); saveBannedTracks(); },
    startSourceWave, clearSource, getSource: () => waveSource,
    genreLevel, isPro: proActive,
    banTracks: (uris) => { (uris || []).forEach((u) => bannedTracks.add(u)); saveBannedTracks(); return bannedTracks.size; },
    bannedCount: bannedTrackCount,
    flushSaves,
    lyricsOf: (u) => lyricsKnown.get(u),
    openRecap, getStats: () => stats, getPresets: () => presets,
  };

  // ==================================================================
  // UI
  // ==================================================================
  // Логотип Drift for Spotify — «Течія»: яскрава хвиля і її слід з боків
  const WAVE_SVG =
    '<svg height="18" width="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
    '<path d="M3 15c3-5 6-5 9-2s6 3 9-2"/><path d="M3 20c3-5 6-5 9-2s6 3 9-2" stroke-opacity="0.5"/>' +
    '<path d="M3 10c3-5 6-5 9-2s6 3 9-2" stroke-opacity="0.5"/></svg>';
  // для меню Spotify: значок кладеться в рамку 16×16 (так Spicetify вставляє і свої) — інакше обрізається
  const WAVE_ICON_16 = WAVE_SVG.replace('height="18" width="18"', 'height="16" width="16"');
  const DISLIKE_SVG =
    '<svg height="16" width="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>';

  function q(sel) { try { return document.querySelector(sel); } catch { return null; } }
  // onPress — спрацьовує на НАТИСКАННЯ: якщо Spotify перемалює панель між натисканням і відпусканням
  // (так буває в перші секунди треку), звичайний click губиться.
  // Значки кнопок панелі — векторні, кольору тексту (емодзі Spotify малює кольоровими картинками)
  const ICON_PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.2v13.6a1 1 0 0 0 1.5.86l11.2-6.8a1 1 0 0 0 0-1.72L8.5 4.34A1 1 0 0 0 7 5.2z"/></svg>';
  const ICON_STOP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5.5" y="5" width="14" height="14" rx="2.2"/></svg>';
  const ICON_SHAKE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>';
  function setStartLabel(btn) {
    btn.innerHTML = (S.active ? ICON_STOP : ICON_PLAY) + "<span></span>";
    btn.lastChild.textContent = S.active ? L("Остановить Drift for Spotify", "Stop Drift for Spotify") : L("Запустить Drift for Spotify", "Start Drift for Spotify");
  }
  function makeCtrlBtn(id, svg, title, onClick, onPress) {
    const b = document.createElement("button");
    b.id = id; b.className = "volna-ctrl-btn"; b.innerHTML = svg; b.title = title;
    if (onPress) {
      b.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); onPress(e); });
      b.addEventListener("click", (e) => { e.stopPropagation(); if (e.detail === 0) onPress(e); }); // клавіатура (Enter/Space)
    } else b.addEventListener("click", (e) => { e.stopPropagation(); onClick(e); });
    return b;
  }
  function findShuffle() {
    const bar = playBar() || document;
    const back = bar.querySelector('[data-testid="control-button-skip-back"]');
    return bar.querySelector('[data-testid="control-button-shuffle"]') ||
      // підпис залежить від мови Spotify: «Shuffle», «Перемешать», «Включить случайный порядок»…
      [...bar.querySelectorAll("button")].find((b) => /shuffl|перемеш|случайн|випадков|aleator|zufall|zufäll|mélang|melang/i.test(b.getAttribute("aria-label") || "")) ||
      // підписів не впізнали — перемішування стоїть першим у тому ж блоці, що й «Назад»
      (back && back.parentElement && [...back.parentElement.children].find((b) => b.tagName === "BUTTON" && b !== back && !String(b.id).startsWith("volna-"))) || null;
  }
  // Лише нижня панель плеєра: на сторінці (артист, плейлист) і в правій панелі теж є кнопки «Add to…»,
  // раніше дизлайк іноді з'їжджав туди. Назву блоку Spotify змінює (now-playing-widget → -v2) — шукаємо за початком.
  function playBar() { return q('[data-testid="now-playing-bar"]') || q('footer') || q('.Root__now-playing-bar'); }
  function findLike() {
    const bar = playBar();
    if (!bar) return null;
    const widget = bar.querySelector('[data-testid^="now-playing-widget"]') || bar;
    const re = /liked songs|add to|save to|remove from|playlist|медиатек|любим|плейлист|сохран/i;
    return [...widget.querySelectorAll("button")].find((b) => !b.id && b.getAttribute("data-testid") !== "cover-art-button" &&
      (b.getAttribute("data-testid") === "add-button" || re.test(b.getAttribute("aria-label") || ""))) || null;
  }
  function ensureWaveBtn() {
    const cur = document.getElementById("volna-wave-btn"), bar = playBar();
    const shuffle = findShuffle();
    // уже стоїть перед «Перемішати» (або його не знайшли, а запасна кнопка на місці) — нічого не робимо
    if (cur && (!bar || bar.contains(cur)) && (!shuffle || cur.nextElementSibling === shuffle)) return true;
    // запасна кнопка праворуч стала зайвою — місце біля «Перемішати» знайшлося
    if (fallbackBtn) { try { fallbackBtn.deregister(); } catch {} fallbackBtn = null; }
    if (cur && cur.isConnected) cur.remove();
    if (!shuffle || !shuffle.parentNode) return false;
    shuffle.parentNode.insertBefore(makeCtrlBtn("volna-wave-btn", WAVE_SVG, "Drift for Spotify", (e) => togglePanel(e.currentTarget)), shuffle);
    updateButton();
    return true;
  }
  function ensureDislikeBtn() {
    const bar = playBar();
    const existing = [...document.querySelectorAll("#volna-dislike-btn")];
    // зайві або ті, що опинилися не в нижній панелі, — прибираємо
    existing.forEach((b, i) => { if (i > 0 || !bar || !bar.contains(b)) b.remove(); });
    const like = findLike();
    const cur = document.getElementById("volna-dislike-btn");
    if (cur && (!like || cur.previousElementSibling === like)) return true;
    if (cur) cur.remove();
    const btn = makeCtrlBtn("volna-dislike-btn", DISLIKE_SVG, L("Не нравится этот трек", "Don't like this track"), null, () => dislikeCurrent());
    if (like && like.parentNode) { like.parentNode.insertBefore(btn, like.nextSibling); return true; }
    // кнопки лайка в панелі немає (вузьке вікно) — ставимо поруч із кнопкою хвилі
    const wave = document.getElementById("volna-wave-btn");
    if (wave && wave.parentNode) { wave.parentNode.insertBefore(btn, wave); return true; }
    return false;
  }
  // Дизлайк і в правій панелі «Зараз грає» — поруч із її лайком (своя кнопка, нижня лишається)
  function npvPanel() { return q('aside[aria-label*="Now playing view" i]') || q('#Desktop_PanelContainer_Id'); }
  function ensureNpvDislikeBtn() {
    const panel = npvPanel();
    const cur = document.getElementById("volna-dislike-npv");
    if (!panel) { if (cur) cur.remove(); return false; }
    const re = /liked songs|add to|save to|remove from|playlist|медиатек|любим|плейлист|сохран/i;
    // перша така кнопка панелі — біля самого треку (нижче бувають картки черги зі своїми кнопками)
    const like = [...panel.querySelectorAll("button")].find((b) => !b.id && re.test(b.getAttribute("aria-label") || "") &&
      !/copy|share|more|ссылк|ещё|поделит/i.test(b.getAttribute("aria-label") || ""));
    if (cur && like && cur.previousElementSibling === like) return true;
    if (cur) cur.remove();
    if (!like || !like.parentNode) return false;
    like.parentNode.insertBefore(makeCtrlBtn("volna-dislike-npv", DISLIKE_SVG, L("Не нравится этот трек", "Don't like this track"), null, () => dislikeCurrent()), like.nextSibling);
    return true;
  }
  // Spotify перемальовує блок треку при зміні пісні й викидає наші кнопки. Стежимо лише за нижньою
  // і правою панеллю (не за всією сторінкою — то лагало) і повертаємо кнопки в тому ж кадрі.
  const panelObs = new Map(); let injectQueued = false;
  function queueInject() {
    if (injectQueued) return;
    injectQueued = true;
    requestAnimationFrame(() => { injectQueued = false; injectButtons(); });
  }
  function watchPanels() {
    setInterval(() => {
      for (const el of [playBar(), npvPanel()]) {
        if (!el || panelObs.has(el)) continue;
        // панелі змінюються постійно (час треку, рядки тексту) — реагуємо, лише якщо зникла наша кнопка
        const mo = new MutationObserver(() => {
          if (!document.getElementById("volna-dislike-btn") || !document.getElementById("volna-wave-btn") ||
            (npvPanel() && !document.getElementById("volna-dislike-npv"))) queueInject();
        });
        mo.observe(el, { childList: true, subtree: true });
        panelObs.set(el, mo);
      }
      for (const [el, mo] of panelObs) if (!el.isConnected) { mo.disconnect(); panelObs.delete(el); }
    }, 1000);
  }
  function injectButtons() { try { ensureWaveBtn(); ensureDislikeBtn(); ensureNpvDislikeBtn(); } catch (e) { logEvent("кнопки: ошибка", String(e)); } }
  let fallbackTried = false, fallbackBtn = null;
  function addPlaybarFallback() {
    if (fallbackTried) return; fallbackTried = true;
    try {
      if (!document.getElementById("volna-wave-btn") && Spicetify.Playbar && Spicetify.Playbar.Button) {
        const wb = new Spicetify.Playbar.Button("Drift for Spotify", WAVE_SVG, () => togglePanel(wb.element), false, false);
        wb.element.id = "volna-wave-btn"; wb.element.classList.add("volna-ctrl-btn"); fallbackBtn = wb;
        updateButton();
      }
    } catch (e) { logEvent("запасная кнопка: ошибка", String(e)); }
  }
  function updateButton() {
    document.querySelectorAll("#volna-wave-btn").forEach((el) => el.classList.toggle("volna-on", S.active));
    const start = document.getElementById("volna-start");
    if (start) setStartLabel(start);
    const st = document.getElementById("volna-status");
    if (st) st.textContent = (S.active ? L("Играет: ", "Playing: ") : L("Выключен · ", "Off · ")) + waveLabel(true);
  }

  // ---------------- Панель налаштувань ----------------
  let panelEl = null;
  function closePanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; document.removeEventListener("mousedown", onDocDown, true); }
  }
  function onDocDown(e) {
    if (panelEl && !panelEl.contains(e.target) && !e.target.closest?.("#volna-wave-btn")) closePanel();
  }
  function togglePanel(anchor) {
    if (panelEl) { closePanel(); return; }
    panelEl = buildPanel();
    document.body.appendChild(panelEl);
    const r = anchor.getBoundingClientRect();
    const pw = panelEl.offsetWidth, ph = panelEl.offsetHeight;
    const left = Math.max(8, Math.min(Math.round(r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 8));
    panelEl.style.left = left + "px";
    panelEl.style.top = Math.max(8, Math.round(r.top - ph - 10)) + "px";
    setTimeout(() => document.addEventListener("mousedown", onDocDown, true), 0);
  }
  function section(t) { const s = document.createElement("div"); s.className = "volna-sec"; s.textContent = t; return s; }
  function chip(label, active, onClick) {
    const c = document.createElement("button");
    c.className = "volna-chip" + (active ? " on" : "");
    c.textContent = label;
    c.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return c;
  }
  function selectInGroup(groupEl, val) {
    [...groupEl.children].forEach((c) => c.classList.toggle("on", c.dataset.val === String(val)));
  }
  // зміна налаштувань застосовується одразу — хвиля перезапускається з новими умовами
  function applyLive() { saveSettings(); updateButton(); if (S.active) startWave(); }
  // усі кнопки панелі — щоб оновлювати «вибрано» і «не поєднується» без перемальовування
  let chipRegistry = [];
  function labelFor(key, val) {
    const lists = { character: CHARACTERS, mood: MOODS, language: LANGS, activity: ACTIVITIES, genre: GENRES };
    return labelOf(lists[key] || [], val);
  }
  function refreshChipStates() {
    for (const r of chipRegistry) {
      const on = settings[r.key] === r.val;
      const blocker = on ? null : blockerOf(r.key, r.val);
      r.el.classList.toggle("on", on);
      r.el.classList.toggle("blocked", !!blocker);
      r.el.title = blocker ? L(`Не сочетается с «${labelFor(blocker[0], blocker[1])}»`, `Doesn't go with “${labelFor(blocker[0], blocker[1])}”`) : "";
    }
  }
  // ---------------- Free / Pro ----------------
  const isLocked = (key) => PRO_KEYS.includes(key) && !proActive();
  let upsellAt = 0;
  // безкоштовна версія — кличемо спробувати Pro безкоштовно; ключ, що скінчився (пробний чи підписка), — лише підписка
  const canTrial = () => !(EDITION === "pro" && BUILD.key);
  function showUpsell(what) {
    const ended = !canTrial();
    Spicetify.showNotification(ended
      ? (remote.trial
        ? L("Пробный Drift Pro закончился — подписка на Boosty, потом /key боту (переустанавливать не нужно)", "Your Drift Pro trial has ended — subscribe on Boosty to keep Pro")
        : L("Подписка Drift Pro закончилась — продли её на Boosty и напиши боту /key", "Your Drift Pro subscription has ended — renew it on Boosty"))
      : L(`🔒 ${what} — в Drift Pro. Попробуй ${TRIAL_DAYS} дней бесплатно`, `🔒 ${what} is a Drift Pro feature. Try it free for ${TRIAL_DAYS} days`));
    // сторінку відкриваємо не частіше ніж раз на хвилину — щоб випадкові кліки не плодили вкладки
    if (Date.now() - upsellAt > 60000) { upsellAt = Date.now(); setTimeout(() => openLink(ended ? UPGRADE_URL : TRIAL_URL), 900); }
  }
  function openLink(url) { try { window.open(url, "_blank"); } catch {} }
  // «Я підписався — перевірити»: одразу питаємо сервер
  async function checkSubscription() {
    Spicetify.showNotification(L("Проверяю подписку…", "Checking your subscription…"));
    await refreshRemoteConfig(true).catch(() => {});
    Spicetify.showNotification(proActive() ? L("✅ Drift Pro включён", "✅ Drift Pro is on")
      : L("Подписка пока не найдена — если только что оформил, напиши боту /key и проверь ещё раз", "No subscription found yet — message the bot /key and check again"));
  }

  // ---------------- «Pro закінчився»: що перестає працювати — чесно й із цифрами ----------------
  function modalBox() { const box = document.createElement("div"); box.className = "volna-box volna-end"; return box; }
  function modalPara(box, text, bold) {
    const e = document.createElement("p");
    if (bold) { const b = document.createElement("b"); b.textContent = text; e.appendChild(b); } else e.textContent = text;
    box.appendChild(e);
  }
  function modalButtons(box, list) {
    const row = document.createElement("div"); row.className = "volna-end-btns";
    for (const [label, fn, second] of list) {
      const b = document.createElement("button"); b.textContent = label; if (second) b.className = "volna-btn2";
      b.addEventListener("click", fn); row.appendChild(b);
    }
    box.appendChild(row);
  }
  function showProEndedModal() {
    const box = modalBox();
    const nA = Object.keys(artistLast).length, nD = Object.keys(dislikes).length;
    modalPara(box, L(`Drift запомнил ${fmtN(nA)} артистов и 2 000 песен — во Free память сократится до 200, песни начнут повторяться чаще.`,
      `Drift remembered ${fmtN(nA)} artists and 2,000 songs — Free keeps only 200, so songs will repeat more often.`));
    if (nD) modalPara(box, L(`${fmtN(nD)} дизлайкнутых артистов снова могут попадаться.`, `${fmtN(nD)} artists you disliked may come back.`));
    const kept = proStash ? Object.entries(proStash).map(([k, v]) => labelFor(k, v)).filter(Boolean).join(" · ") : "";
    if (kept) modalPara(box, L(`Твои настройки «${kept}» сохранены.`, `Your settings “${kept}” are saved.`));
    if (presets.length) modalPara(box, L(`Сохранённые волны (${presets.length}) ждут тебя.`, `Your ${presets.length} saved waves are waiting.`));
    modalPara(box, L("Всё вернётся сразу после продления.", "Everything comes back as soon as you renew."), true);
    modalButtons(box, [
      [L("Продлить на Boosty", "Renew on Boosty"), () => openLink(UPGRADE_URL)],
      [L("Я подписался — проверить", "I subscribed — check"), () => checkSubscription(), true],
      [L("Остаться на Free", "Stay on Free"), () => Spicetify.PopupModal.hide(), true],
    ]);
    Spicetify.PopupModal.display({ title: remote.trial ? L("Пробный Drift Pro закончился", "Your Drift Pro trial has ended") : L("Drift Pro закончился", "Drift Pro has ended"), content: box });
  }
  // за добу до кінця пробного — один раз нагадати, що накопичено за тиждень
  function trialReminder() {
    if (!remote.trial || !proActive() || remote.until - Date.now() > 86400000) return;
    if (lsGet(K.trialRemind) === String(remote.until)) return;
    lsSet(K.trialRemind, String(remote.until));
    Spicetify.showNotification(L(`Завтра пробный Drift Pro закончится. За это время Drift запомнил ${fmtN(Object.keys(artistLast).length)} артистов — подписка на Boosty сохранит Pro`,
      `Your Drift Pro trial ends tomorrow. Drift has learned ${fmtN(Object.keys(artistLast).length)} artists — subscribe on Boosty to keep Pro`));
  }

  // ---------------- Підсумок місяця: сторіс як Spotify Wrapped (лише Pro; у безкоштовній збірці цього коду немає) ----------------
  function openRecap() {}
  function recapNotice() {}
  function recapAvailable() { return false; }
  function recapBanner() { return null; }
  function syncRecapMenu() {}
  // ---------------- Нова версія ----------------
  // «1.2.3» > «1.2»? — за числами зліва направо
  function newerVersion(a, b) {
    const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
    return false;
  }
  let latestVersion = null;
  // про нову версію кажемо один раз; посилання «Оновити» в панелі лишається, поки не оновишся
  function noteLatest(v, note) {
    if (!/^\d+(\.\d+){0,2}$/.test(String(v)) || !newerVersion(v, VERSION)) return;
    latestVersion = String(v);
    if (lsGet(K.updateSeen) === latestVersion) return;
    lsSet(K.updateSeen, latestVersion);
    const how = EDITION === "free" ? L("скачай её с GitHub", "get it from GitHub") : L("напиши боту /key", "send /key to the bot");
    setTimeout(() => Spicetify.showNotification(L(`🆕 Вышла версия Drift ${latestVersion} — ${how}`, `🆕 Drift ${latestVersion} is out — ${how}`)), 6000);
  }
  // Free: раз на добу дивимося номер версії в manifest.json на GitHub
  async function checkFreeUpdate() {
    if (EDITION !== "free" || !UPDATE_URL) return;
    if (Date.now() - (parseInt(lsGet(K.updateAt) || "0", 10) || 0) < 20 * 3600000) return;
    lsSet(K.updateAt, String(Date.now()));
    try {
      const m = await (await fetch(UPDATE_URL, { cache: "no-store" })).json();
      const v = Array.isArray(m) ? m[0] && m[0].version : m && m.version;
      if (v) noteLatest(v);
    } catch {}
  }
  // Pro відкрився або закрився (відповідь сервера / скінчився строк) — налаштування й панель приводимо у відповідність
  let lastPro = null;
  function onProChanged() {
    const pro = proActive();
    if (pro === lastPro) return;
    const first = lastPro === null;
    lastPro = pro;
    gateSettings();
    if (EDITION === "pro" && !pro) dropServerMarkup();
    if (EDITION === "pro") {
      const was = lsGet(K.proWas);
      lsSet(K.proWas, pro ? "1" : "0");
      if (!pro && was === "1") { if (remoteChecked || !CONFIG_URL) setTimeout(showProEndedModal, 500); else endModalPending = true; }
    }
    if (first) return;
    logEvent(pro ? "Pro включён" : "Pro выключен");
    if (panelEl) { closePanel(); }
    updateButton();
    if (S.active) startWave();
  }
  function proBadge() { const b = document.createElement("span"); b.className = "volna-pro"; b.textContent = "PRO"; return b; }
  function toggleGroup(p, title, options, key, after) {
    const sec = section(title);
    if (isLocked(key)) sec.appendChild(proBadge());
    p.appendChild(sec);
    const g = document.createElement("div"); g.className = "volna-chips";
    // третій елемент — своє налаштування в кнопки (наприклад «Instrumental» у ряду Mood вмикає мову)
    options.forEach(([v, l, ownKey]) => {
      const k = ownKey || key;
      if (isLocked(k)) { // Pro-кнопка без Pro (зараз ряди Pro без Pro не показуються — лишено про запас): видна, але веде на Pro
        const c = chip(l, false, () => showUpsell(title));
        c.classList.add("locked"); c.dataset.val = v; c.title = L("Доступно в Drift Pro", "Available in Drift Pro");
        g.appendChild(c);
        return;
      }
      const c = chip(l, settings[k] === v, () => {
        const blocker = settings[k] === v ? null : blockerOf(k, v);
        if (blocker) {
          Spicetify.showNotification(L(`«${l}» не сочетается с «${labelFor(blocker[0], blocker[1])}» — сначала сними его`,
          `“${l}” doesn't go with “${labelFor(blocker[0], blocker[1])}” — turn that off first`));
          return;
        }
        settings[k] = settings[k] === v ? "" : v; // повторний тап — зняти
        if (after) after();
        refreshChipStates();
        applyLive();
      });
      c.dataset.val = v; g.appendChild(c);
      chipRegistry.push({ key: k, val: v, el: c });
    });
    p.appendChild(g);
    return g;
  }
  // «Мої хвилі»: своє поєднання налаштувань (і плейлист/артист) однією кнопкою — Pro
  function presetName() {
    const parts = PRESET_KEYS.filter((k) => settings[k]).map((k) => labelFor(k, settings[k]));
    if (waveSource && waveSource.name) parts.unshift(waveSource.name);
    return (parts.join(" · ") || L("Моя волна", "My wave")).slice(0, 40);
  }
  function applyPreset(pr) {
    if (!proActive()) { showUpsell(L("Сохранённые волны", "Saved waves")); return; }
    for (const k of PRESET_KEYS) settings[k] = pr.s[k] || "";
    sanitizeSettings(); saveSettings(); closePanel();
    if (pr.src && pr.src.uri) startSourceWave(pr.src.type, pr.src.uri);
    else { waveSource = null; startWave(); }
  }
  function presetsBlock(p) {
    const pro = proActive();
    const sec = section(L("Мои волны", "My waves"));
    if (!pro) sec.appendChild(proBadge());
    p.appendChild(sec);
    const g = document.createElement("div"); g.className = "volna-chips";
    presets.forEach((pr) => {
      const c = chip(pr.name, false, () => applyPreset(pr));
      if (!pro) c.classList.add("locked");
      const x = document.createElement("span"); x.className = "volna-chip-x"; x.textContent = "✕"; x.title = L("Удалить", "Delete");
      x.addEventListener("click", (e) => { e.stopPropagation(); presets = presets.filter((q) => q !== pr); savePresets(); c.remove(); });
      c.appendChild(x); g.appendChild(c);
    });
    if (presets.length < 6) {
      const add = chip("＋ " + L("Сохранить текущую", "Save current"), false, () => {
        if (!proActive()) { showUpsell(L("Сохранённые волны", "Saved waves")); return; }
        if (g.nextSibling && g.nextSibling.classList?.contains("volna-preset-name")) return;
        const inp = document.createElement("input"); inp.className = "volna-input volna-preset-name"; inp.value = presetName(); inp.maxLength = 40;
        inp.placeholder = L("Название (Enter — сохранить)", "Name (Enter to save)");
        inp.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Escape") inp.remove();
          if (e.key !== "Enter" || !inp.value.trim()) return;
          presets.push({ name: inp.value.trim(), s: Object.fromEntries(PRESET_KEYS.map((k) => [k, settings[k] || ""])),
            src: waveSource ? { type: waveSource.type, uri: waveSource.uri, name: waveSource.name } : null });
          savePresets(); closePanel(); openSettings();
          Spicetify.showNotification(L("Волна сохранена", "Wave saved"));
        });
        g.after(inp); inp.focus(); inp.select();
      });
      add.classList.add("volna-chip-add"); if (!pro) add.classList.add("locked");
      g.appendChild(add);
    }
    p.appendChild(g);
  }
  function buildPanel() {
    chipRegistry = [];
    // без Pro панель показує лише те, що працює: Pro-ряди не видно взагалі (жодних замочків) — про Pro один рядок унизу
    const pro = proActive();
    const p = document.createElement("div");
    p.className = "volna-panel";
    p.addEventListener("click", (e) => e.stopPropagation());

    const st = document.createElement("div"); st.id = "volna-status"; st.className = "volna-status";
    st.textContent = (S.active ? L("Играет: ", "Playing: ") : L("Выключен · ", "Off · ")) + waveLabel(true);
    p.appendChild(st);
    if (waveSource) {
      const sr = document.createElement("div"); sr.className = "volna-src";
      const lab = document.createElement("span"); lab.className = "volna-src-name";
      lab.textContent = (waveSource.type === "artist" ? L("Артист: ", "Artist: ") : L("Плейлист: ", "Playlist: ")) + (waveSource.name || "…");
      lab.title = waveSource.name || "";
      const x = document.createElement("button"); x.className = "volna-src-x"; x.textContent = "✕"; x.title = L("Вернуть обычный Drift for Spotify", "Back to regular Drift for Spotify");
      x.addEventListener("click", () => { clearSource(); closePanel(); });
      sr.appendChild(lab); sr.appendChild(x); p.appendChild(sr);
    }

    const banner = recapBanner();
    if (banner) p.appendChild(banner);

    const row = document.createElement("div"); row.className = "volna-row";
    const start = document.createElement("button");
    start.id = "volna-start"; start.className = "volna-start";
    setStartLabel(start);
    start.addEventListener("click", () => toggleWave());
    const shake = document.createElement("button");
    shake.className = "volna-shake"; shake.innerHTML = ICON_SHAKE; shake.title = L("Встряхнуть — новое направление", "Shake up — new direction");
    shake.addEventListener("click", () => shakeWave());
    row.appendChild(start); row.appendChild(shake);
    p.appendChild(row);
    if (pro) presetsBlock(p);

    if (pro) toggleGroup(p, L("По занятию", "Activity"), ACTIVITIES, "activity");
    toggleGroup(p, L("По характеру", "Character"), CHARACTERS, "character");
    if (pro) {
      if (UI_RU) {
        toggleGroup(p, "Под настроение", MOODS, "mood");
        toggleGroup(p, "По языку", LANGS, "language");
      } else {
        // не з СНД: «російська / неросійська» не потрібні — лише «Instrumental», у ряду Mood
        toggleGroup(p, "Mood", [...MOODS, ["instrumental", "Instrumental", "language"]], "mood");
      }

      let gi = null;
      const genreGroup = toggleGroup(p, L("Жанр", "Genre"), GENRES, "genre", () => { if (gi) gi.value = ""; });
      gi = document.createElement("input");
      gi.className = "volna-input"; gi.placeholder = L("Свой жанр… (Enter)", "Custom genre… (Enter)");
      gi.value = settings.genre && !GENRES.some((g) => g[0] === settings.genre) ? settings.genre : "";
      gi.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") { settings.genre = gi.value.trim(); selectInGroup(genreGroup, settings.genre); refreshChipStates(); applyLive(); }
      });
      p.appendChild(gi);
    }
    refreshChipStates();

    const check = (label, key) => {
      const r2 = document.createElement("label"); r2.className = "volna-exrow";
      const box = document.createElement("input"); box.type = "checkbox"; box.checked = !!settings[key];
      box.addEventListener("change", () => { settings[key] = box.checked; applyLive(); });
      r2.appendChild(box); r2.appendChild(document.createTextNode(" " + label));
      p.appendChild(r2);
    };
    check(L("Без ИИ-треков", "No AI tracks"), "blockAI");
    check(L("Пропускать explicit", "Skip explicit"), "explicitFilter");

    const foot = document.createElement("div"); foot.className = "volna-foot";
    if (latestVersion) {
      const upd = document.createElement("button"); upd.className = "volna-link volna-up";
      upd.textContent = L(`🆕 Обновить до ${latestVersion} →`, `🆕 Update to ${latestVersion} →`);
      upd.title = EDITION === "free" ? L("Новая версия — на странице Drift на GitHub", "The new version is on the Drift GitHub page") : L("Бот пришлёт новый файл", "The bot will send you the new file");
      upd.addEventListener("click", () => openLink(EDITION === "free" ? (REPO_URL || "https://spicetify.app") : BOT_KEY_URL));
      foot.appendChild(upd);
    }
    // діагностика — не для панелі: вона в меню профілю Spotify («Drift for Spotify — діагностика»), щоб надіслати звіт
    const rb = document.createElement("button"); rb.className = "volna-link"; rb.textContent = L("Пересобрать вкус", "Rebuild taste");
    rb.addEventListener("click", async () => { try { await buildProfile(true); Spicetify.showNotification(L("Вкус пересобран", "Taste rebuilt")); } catch {} });
    foot.appendChild(rb);
    if (!pro) {
      const up = document.createElement("button"); up.className = "volna-link";
      up.textContent = canTrial() ? L("Drift Pro — настроение, жанры и ещё кое-что →", "Drift Pro — moods, genres and more →") : L("Продлить Drift Pro →", "Renew Drift Pro →");
      up.title = L("Настроение, занятие, язык, жанр, волна по плейлисту и артисту, мгновенный лайк, память на 2000 песен, сохранённые волны, итог месяца. " + TRIAL_DAYS + " дней бесплатно",
        "Mood, activity, genre, Drift from a playlist or artist, instant likes, 2000-song memory, saved waves, monthly recap. Free for " + TRIAL_DAYS + " days");
      up.addEventListener("click", () => openLink(canTrial() ? TRIAL_URL : UPGRADE_URL));
      foot.appendChild(up);
      if (canTrial()) {
        const tip = document.createElement("button"); tip.className = "volna-link"; tip.textContent = L("☕ Поддержать автора", "☕ Support the author");
        tip.addEventListener("click", () => openLink(UPGRADE_URL));
        foot.appendChild(tip);
      } else {
        const ck = document.createElement("button"); ck.className = "volna-link"; ck.textContent = L("Я подписался — проверить", "I subscribed — check");
        ck.addEventListener("click", () => checkSubscription());
        foot.appendChild(ck);
      }
    }
    p.appendChild(foot);
    return p;
  }
  function openSettings() {
    const a = document.getElementById("volna-wave-btn");
    if (a) togglePanel(a); else Spicetify.showNotification(L("Кнопка Drift for Spotify ещё не появилась — перезапусти Spotify", "Drift for Spotify button isn't ready yet — restart Spotify"), true);
  }

  // ---------------- Діагностика ----------------
  function openDiagnostics() {
    const wrap = document.createElement("div"); wrap.className = "volna-box";
    const report = {
      version: VERSION,
      сборка: EDITION + (proActive() ? " · Pro активен" : "") + (remote.until ? " · ключ до " + new Date(remote.until).toLocaleDateString() : "") + (remote.reason ? " · сервер: " + remote.reason : ""),
      настройки: settings,
      волна: S.active ? "играет" : "выключена",
      очередьНаша: S.queueOk === undefined ? "ещё не проверено" : (S.queueOk ? "да" : "НЕТ — Spotify подменяет список"),
      профиль: profile ? {
        собран: new Date(profile.builtAt).toLocaleString(),
        лайков: P.likedTracks.size, знакомыхАртистов: P.familiarIds.size, услышанныхТреков: P.heard.size,
        историяSpotify: !!profile.historyOk,
        самыхСлушаемыхТреков: P.topTracks.length, окрестностьВкуса: P.taste.size,
        топАртисты: P.topArtists.slice(0, 12).map((a) => a.name || idOf(a.uri)),
      } : "ещё не собран",
      разметка: [...tagPools.values()].map((p) => `${p.key}: ${p.tracks.length} треков из ${p.playlists} плейлистов`),
      кандидаты: S.lastRefresh,
      последниеВыборы: S.lastPicks,
      сессия: S.history.slice(-15).map((h) => `${h.outcome} · ${h.artistName || "?"} — ${h.name || ""} [${h.sources}]`),
      graphql: gqlStats,
      забаненоТреков: bannedTrackCount(), дизлайкнутыхАртистов: Object.keys(dislikes).length, ИИартистов: aiArtists.size,
      память: storageUsage(),
      сборка: { pro: !!BUILD.key, покупатель: BUILD.buyer || "—", сервер: CONFIG_URL ? (remote.ok ? "настройки получены " + new Date(remote.at).toLocaleString() : "нет ответа: " + remote.reason) : "не задан" },
      кэш: { артистов: Object.keys(artistDisk).length, текстов: Object.keys(lyricsDisk).length,
        размерКБ: Math.round([K.artists, K.lyrics, K.lastPool, K.trackHist].reduce((n, k) => n + (lsGet(k) || "").length, 0) / 1024) },
      сеть: { одновременно: netActive, вОчереди: netQ[0].length + netQ[1].length },
    };
    const text = "== ОТЧЁТ ==\n" + JSON.stringify(report, null, 2) + "\n\n== ЖУРНАЛ ==\n" + (journal.join("\n") || "(пусто)");
    wrap.innerHTML = '<button id="v-copy">📋 ' + L("Копировать", "Copy") + '</button><button id="v-tags">♻ ' + L("Обновить разметку", "Refresh tags") +
      '</button><button id="v-cache">🧹 ' + L("Очистить кэш", "Clear cache") + '</button><pre id="v-rep"></pre>';
    wrap.querySelector("#v-rep").textContent = text;
    wrap.querySelector("#v-copy").addEventListener("click", async () => {
      try { await Spicetify.Platform.ClipboardAPI.copy(text); Spicetify.showNotification(L("Скопировано", "Copied")); }
      catch { try { await navigator.clipboard.writeText(text); Spicetify.showNotification(L("Скопировано", "Copied")); } catch { Spicetify.showNotification(L("Выдели текст вручную", "Select the text manually"), true); } }
    });
    wrap.querySelector("#v-tags").addEventListener("click", () => {
      for (const k of Object.keys(TAG_QUERIES)) lsSet(K.tagPrefix + k, "");
      tagPools.clear();
      Spicetify.showNotification(L("Разметка сброшена — загрузится при следующем запуске", "Tags reset — they'll reload on next start"));
    });
    // кеш (артисти, тексти, пул минулого запуску) — налаштування, лайки-навчання й історія не чіпаються
    wrap.querySelector("#v-cache").addEventListener("click", () => {
      pendingSaves.delete("artists"); pendingSaves.delete("lyrics"); pendingSaves.delete("lastPool");
      artistDisk = {}; lyricsDisk = {};
      for (const k of [K.artists, K.lyrics, K.lastPool]) lsSet(k, "");
      ovCache.clear(); relCache.clear(); lyricsReq.clear(); lyricsKnown.clear();
      Spicetify.showNotification(L("Кэш очищен — данные подтянутся заново", "Cache cleared — data will reload"));
    });
    Spicetify.PopupModal.display({ title: L("Drift for Spotify — диагностика", "Drift for Spotify — Diagnostics"), content: wrap, isLarge: true });
  }

  // «…» у плейлиста / артиста → «Хвиля за цим плейлистом / артистом»
  function registerSourceMenu() {
    const CM = Spicetify.ContextMenu;
    if (!CM || !CM.Item) { logEvent("контекстное меню недоступно"); return; }
    if (EDITION === "free") return; // хвиля за плейлистом/артистом — Pro: у Free пунктів меню немає зовсім
    const typeOf = (uri) => {
      const U = Spicetify.URI;
      try {
        if (U.isPlaylistV1OrV2 ? U.isPlaylistV1OrV2(uri) : /:playlist:/.test(uri)) return "playlist";
        if (U.isArtist ? U.isArtist(uri) : /:artist:/.test(uri)) return "artist";
      } catch {}
      return /:playlist:/.test(uri) ? "playlist" : /:artist:/.test(uri) ? "artist" : null;
    };
    const one = (uris) => uris && uris.length === 1 ? typeOf(uris[0]) : null;
    new CM.Item(L("Drift по плейлисту", "Start Drift"), (uris) => startSourceWave("playlist", uris[0]), (uris) => one(uris) === "playlist", WAVE_ICON_16).register();
    new CM.Item(L("Drift по артисту", "Start Drift"), (uris) => startSourceWave("artist", uris[0]), (uris) => one(uris) === "artist", WAVE_ICON_16).register();
  }

  let diagMenu = null, diagMenuOn = false;
  function initUI() {
    injectButtons();
    // легка перевірка замість MutationObserver (той лагав увесь клієнт)
    setInterval(injectButtons, 1500); // запасна перевірка
    watchPanels();
    setTimeout(addPlaybarFallback, 4000);
    try {
      // «Налаштування» в меню профілю не потрібні — панель відкривається кнопкою Drift. Підсумок місяця (1–3 число) — вище діагностики.
      syncRecapMenu();
      diagMenu = new Spicetify.Menu.Item(L("Drift for Spotify — диагностика", "Drift for Spotify — Diagnostics"), false, openDiagnostics);
      diagMenu.register(); diagMenuOn = true;
    } catch (e) { logEvent("меню: ошибка", String(e)); }
    try { registerSourceMenu(); } catch (e) { logEvent("контекстное меню: ошибка", String(e)); }
    try {
      Spicetify.Keyboard?.registerShortcut?.({ key: "j", ctrl: true, alt: true }, () => dislikeCurrent());
      Spicetify.Keyboard?.registerShortcut?.({ key: "k", ctrl: true, alt: true }, () => banArtistCurrent());
    } catch {}
    const style = document.createElement("style");
    style.textContent = `
      .volna-ctrl-btn{background:transparent;border:none;color:var(--spice-subtext,#b3b3b3);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border-radius:50%;flex:none;}
      .volna-ctrl-btn:hover{color:var(--spice-text,#fff);}
      .volna-ctrl-btn.volna-on{color:#1ed760;}
      .volna-panel{position:fixed;z-index:9999;width:340px;max-width:92vw;max-height:80vh;overflow-y:auto;background:#181818;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:14px;box-shadow:0 16px 48px rgba(0,0,0,.6);color:#fff;font-size:13px;box-sizing:border-box;}
      .volna-status{font-size:12px;opacity:.7;margin-bottom:10px;line-height:1.4;overflow-wrap:anywhere;}
      .volna-src{display:flex;align-items:center;gap:8px;margin:-4px 0 10px;padding:6px 6px 6px 10px;border-radius:8px;background:rgba(255,255,255,.07);}
      .volna-src-name{flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .volna-src-x{flex:none;width:24px;height:24px;border:none;border-radius:50%;background:transparent;color:#fff;opacity:.7;cursor:pointer;font-size:12px;}
      .volna-src-x:hover{opacity:1;background:rgba(255,255,255,.12);}
      .volna-row{display:flex;gap:8px;}
      .volna-start{flex:1;padding:10px;border:none;border-radius:999px;background:#1ed760;color:#000;font-weight:700;cursor:pointer;font-size:14px;}
      .volna-shake{width:44px;border:1px solid rgba(255,255,255,.25);border-radius:999px;background:transparent;color:#fff;cursor:pointer;font-size:16px;display:inline-flex;align-items:center;justify-content:center;}
      .volna-shake:hover{border-color:#fff;}
      .volna-start{display:inline-flex;align-items:center;justify-content:center;gap:8px;}
      .volna-start svg{display:block;flex:none;}
      .volna-sec{margin:14px 0 6px;font-weight:700;opacity:.7;font-size:11px;text-transform:uppercase;letter-spacing:.05em;}
      .volna-chips{display:flex;flex-wrap:wrap;gap:6px;}
      .volna-chip{padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;cursor:pointer;font-size:12px;}
      .volna-chip:hover{border-color:#fff;}
      .volna-chip.on{background:#1ed760;color:#000;border-color:#1ed760;font-weight:700;}
      .volna-chip.blocked{opacity:.3;cursor:not-allowed;}
      .volna-chip.blocked:hover{border-color:rgba(255,255,255,.18);}
      .volna-chip.locked{opacity:.45;}
      .volna-chip.locked:hover{opacity:.8;border-color:#1ed760;}
      .volna-pro{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;background:#1ed760;color:#000;font-size:9px;letter-spacing:.04em;vertical-align:1px;opacity:1;}
      .volna-up{margin-left:auto;font-weight:700;}
      .volna-input{width:100%;margin-top:8px;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:#121212;color:#fff;box-sizing:border-box;}
      .volna-exrow{display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer;}
      .volna-foot{display:flex;gap:14px;margin-top:14px;border-top:1px solid rgba(255,255,255,.1);padding-top:10px;}
      .volna-link{background:none;border:none;color:#1ed760;cursor:pointer;font-size:12px;padding:0;}
      .volna-box pre{white-space:pre-wrap;word-break:break-word;background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:12px;max-height:48vh;overflow:auto;font-size:11px;line-height:1.5;}
      .volna-box button{padding:7px 16px;border-radius:999px;border:none;background:#1ed760;color:#000;font-weight:700;cursor:pointer;margin-right:8px;}
      .volna-box button.volna-btn2{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.3);}
      .volna-end p{margin:0 0 10px;line-height:1.5;font-size:14px;}
      .volna-end-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}
      .volna-chip-x{margin-left:7px;opacity:.5;font-size:10px;}
      .volna-chip-x:hover{opacity:1;}
      .volna-chip-add{border-style:dashed;}
      .volna-foot{flex-wrap:wrap;row-gap:6px;}
      .drw-ov{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;}
      .drw-frame{position:relative;height:min(88vh,860px);aspect-ratio:9/16;border-radius:18px;overflow:hidden;color:#fff;cursor:pointer;user-select:none;box-shadow:0 30px 80px rgba(0,0,0,.6);transition:background .4s;}
      .drw-bars{position:absolute;top:12px;left:12px;right:12px;display:flex;gap:4px;z-index:2;}
      .drw-bar{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.35);overflow:hidden;}
      .drw-bar i{display:block;height:100%;width:0;background:#fff;}
      @keyframes drw-fill{from{width:0}to{width:100%}}
      .drw-x{position:absolute;top:24px;right:14px;z-index:3;width:32px;height:32px;border:none;border-radius:50%;background:rgba(0,0,0,.25);color:#fff;font-size:14px;cursor:pointer;}
      .drw-demo{position:absolute;top:30px;left:16px;z-index:3;font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(0,0,0,.35);}
      .drw-stage{position:absolute;inset:0;}
      .drw-slide{position:absolute;inset:0;padding:70px 28px 36px;display:flex;flex-direction:column;justify-content:center;gap:6px;animation:drw-in .5s ease-out;}
      .drw-center{align-items:center;text-align:center;}
      @keyframes drw-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
      .drw-kicker{font-size:15px;font-weight:700;letter-spacing:.02em;opacity:.9;}
      .drw-big{font-size:96px;font-weight:900;line-height:1;letter-spacing:-.03em;}
      .drw-h1{font-size:40px;font-weight:900;line-height:1.05;letter-spacing:-.02em;}
      .drw-h2{font-size:26px;font-weight:800;}
      .drw-sub{font-size:15px;font-weight:600;opacity:.9;margin-top:8px;line-height:1.4;}
      .drw-logo svg{color:#fff;margin-bottom:10px;}
      .drw-emoji{font-size:84px;line-height:1.1;margin:6px 0;}
      .drw-list{margin-top:18px;display:flex;flex-direction:column;gap:10px;}
      .drw-row{display:flex;align-items:center;gap:12px;font-weight:700;font-size:17px;}
      .drw-num{width:18px;opacity:.8;}
      .drw-ava{width:46px;height:46px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,.2);}
      .drw-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .drw-hero{width:62%;aspect-ratio:1;border-radius:50%;object-fit:cover;margin:14px 0;box-shadow:0 18px 50px rgba(0,0,0,.35);}
      .drw-curve{width:100%;height:auto;margin:22px 0 6px;overflow:visible;}
      .drw-split{margin:26px 0 10px;}
      .drw-banner{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;margin:0 0 10px;padding:10px 14px;border:none;border-radius:12px;cursor:pointer;color:#fff;text-align:left;
        background:linear-gradient(110deg,#1a0b4d,#4100f5 45%,#0d72ea 80%,#4100f5);background-size:200% 100%;animation:drw-shine 6s ease-in-out infinite;box-shadow:0 6px 22px rgba(65,0,245,.4);}
      .drw-banner:hover{filter:brightness(1.08);}
      .drw-banner-t{font-size:15px;font-weight:800;}
      .drw-banner-s{font-size:12px;font-weight:600;opacity:.9;}
      .drw-banner{position:relative;}
      .drw-banner-x{position:absolute;top:6px;right:6px;width:22px;height:22px;border:none;border-radius:50%;background:rgba(0,0,0,.25);color:#fff;font-size:11px;line-height:22px;padding:0;cursor:pointer;opacity:.75;}
      .drw-banner-x:hover{opacity:1;background:rgba(0,0,0,.45);}
      @keyframes drw-shine{0%,100%{background-position:0 0}50%{background-position:100% 0}}
      .drw-split-bar{display:flex;height:22px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.12);}
      .drw-split-bar i{display:block;height:100%;transform-origin:left;transform:scaleX(0);animation:drw-grow .7s ease-out forwards;}
      @keyframes drw-grow{to{transform:scaleX(1)}}
      .drw-split-legend{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;font-size:14px;font-weight:700;}
      .drw-split-row{display:flex;align-items:center;gap:8px;}
      .drw-split-row b{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,.35);}
      .drw-line{stroke-dasharray:1000;stroke-dashoffset:1000;animation:drw-draw 1.6s ease-out .15s forwards;}
      .drw-area{opacity:0;animation:drw-fade .8s ease-out 1.1s forwards;}
      .drw-dot,.drw-lbl{opacity:0;animation:drw-fade .4s ease-out forwards;}
      .drw-lbl{fill:#fff;font-size:17px;font-weight:800;}
      @keyframes drw-draw{to{stroke-dashoffset:0}}
      @keyframes drw-fade{to{opacity:1}}
      .drw-card{height:62%;border-radius:12px;margin:12px 0;box-shadow:0 12px 40px rgba(0,0,0,.5);}
      .drw-actions{display:flex;gap:10px;}
      .drw-btn{padding:10px 18px;border-radius:999px;border:none;background:#1ed760;color:#000;font-weight:800;cursor:pointer;font-size:14px;}
      .drw-btn2{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);}`;
    document.head.appendChild(style);
  }

  // ==================================================================
  // Старт
  // ==================================================================
  cleanupStorage();
  loadCachedRemote(); // до всіх запитів: свіжі хеші й строк Pro
  onProChanged();     // Free / Pro: Pro-налаштування без Pro відкладаються
  loadWaveLikes();
  loadQuickSkips();
  loadBannedTracks(); loadDislikes(); loadStats(); loadPresets();
  loadAffinity();
  loadTrackHist(); loadArtistHist();
  loadArtistDisk(); loadLyricsDisk(); loadSkipHist();
  try { window.addEventListener("beforeunload", flushSaves); } catch {}
  loadAICache();
  refreshAIList(false);
  try { const c = JSON.parse(lsGet(K.profile) || "null"); if (c) applyProfile(c); } catch {}
  initUI();
  try { Spicetify.Platform.PlayerAPI.getEvents().addListener("action", onPlayerAction); } catch (e) { logEvent("«назад»: событие недоступно", String(e)); }
  Spicetify.Player.addEventListener("songchange", () => {
    onSongChange().catch((e) => logEvent("смена трека: ошибка", String(e && e.stack || e)));
  });
  Spicetify.Player.addEventListener("onprogress", (e) => {
    const u = Spicetify.Player.data?.item?.uri;
    if (!u) return;
    S.progress.set(u, typeof e?.data === "number" ? e.data : (Spicetify.Player.getProgress?.() || 0));
    const d = Spicetify.Player.getDuration?.();
    if (d) S.duration.set(u, d);
    feedIfEmpty();
    // лайк зараховуємо, якщо сердечко горить кілька відліків поспіль (на зміні треку воно може блимнути від минулого)
    if (S.active && probeHeart()) {
      const n = (S.heartTicks.get(u) || 0) + 1; S.heartTicks.set(u, n);
      // на зміні треку сердечко може блимнути від минулої пісні — рахуємо лише після 2 с треку
      if (n >= 3 && (S.progress.get(u) || 0) >= 2000 && !S.hearted.has(u)) {
        S.hearted.add(u);
        const c = S.ctx[S.head];
        if (c && c.uri === u) isLiked(u).then((ok) => { // підтверджуємо за медіатекою
          if (ok) onLikeNow(c).catch((e) => logEvent("лайк: ошибка", String(e)));
          else S.hearted.delete(u);
        });
      }
    }
  });
  setTimeout(() => { markRecentlyPlayed(true); syncWaveLikes(); }, 3000); // історія Spotify і зняті лайки — одразу під час завантаження
  refreshRemoteConfig().catch(() => {});
  // перевірка раз на 10 хв; запит до сервера — раз на добу, а поки Pro вимкнений — раз на 15 хв
  setInterval(() => { refreshRemoteConfig().catch(() => {}); onProChanged(); trialReminder(); recapNotice(); }, 10 * 60000);
  setTimeout(() => { trialReminder(); recapNotice(); checkFreeUpdate(); }, 8000);
  logEvent("Загружено v" + VERSION);
  Spicetify.showNotification(L("Drift for Spotify загружен", "Drift for Spotify loaded") + " (v" + VERSION + ")");
})();
