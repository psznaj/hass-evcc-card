export async function loadTranslations(card) {
  const base = new URL("locales/", import.meta.url).href;

  let langs = [];
  try {
    const idxResp = await fetch(`${base}index.json`);
    if (idxResp.ok) langs = await idxResp.json();
    else {
      langs = ["en"];
      console.warn("[evcc-card] locales/index.json not found, using fallback:", langs);
    }
  } catch (e) {
    langs = ["en"];
    console.warn("[evcc-card] Could not load locales/index.json, using fallback:", langs);
  }

  const requestedLang = getLang(card);
  if (requestedLang && !langs.includes(requestedLang)) {
    langs.push(requestedLang);
  }

  const results = await Promise.allSettled(
    langs.map(lang =>
      fetch(`${base}${lang}.json`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => ({ lang, data }))
    )
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      card._translations[result.value.lang] = result.value.data;
    } else {
      console.warn("[evcc-card] Failed to load translation:", result.reason);
    }
  }

  card._translationsReady = true;
}

export function getLocale(card) {
  const configured = card._config.language || card._hass?.language || "en";
  return String(configured).replace("_", "-");
}

export function getLang(card) {
  return getLocale(card).split("-")[0].toLowerCase();
}

export function formatDateTime(card, value) {
  if (!value || value === "unknown" || value === "unavailable") return null;
  try {
    return new Date(value).toLocaleString(getLocale(card), {
      weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  } catch (e) {
    return null;
  }
}

export function translate(card, key, replacements = {}) {
  const lang = getLang(card);
  const strings = card._translations[lang]
    || card._translations["en"]
    || {};

  let val = strings[key] ?? key;
  for (const [k, v] of Object.entries(replacements)) {
    val = val.replace(`{${k}}`, v);
  }
  return val;
}
