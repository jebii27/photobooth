const GALLERY_KEY = "lumina-photo-booth-gallery";
const ANALYTICS_KEY = "lumina-photo-booth-analytics";
const LEADS_KEY = "lumina-photo-booth-leads";
const MAX_GALLERY_ITEMS = 12;
const MAX_LEAD_ITEMS = 500;

const DEFAULT_ANALYTICS = Object.freeze({
  sessions: 0,
  captures: 0,
  downloads: 0,
  prints: 0,
  shares: 0,
  leads: 0
});

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function readJsonCollection(key) {
  const source = localStorage.getItem(key);
  if (!source) {
    return [];
  }

  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeJsonCollection(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function readCollection() {
  return readJsonCollection(GALLERY_KEY);
}

function writeCollection(items) {
  writeJsonCollection(GALLERY_KEY, items);
}

export function getGalleryItems() {
  return readCollection();
}

export function saveGalleryItem(dataUrl, layout) {
  const items = readCollection();
  const item = {
    id: createId(),
    dataUrl,
    layout,
    createdAt: new Date().toISOString()
  };

  items.unshift(item);

  if (items.length > MAX_GALLERY_ITEMS) {
    items.length = MAX_GALLERY_ITEMS;
  }

  writeCollection(items);

  return item;
}

export function removeGalleryItem(itemId) {
  const items = readCollection().filter((item) => item.id !== itemId);
  writeCollection(items);
}

export function clearGallery() {
  localStorage.removeItem(GALLERY_KEY);
}

function readAnalytics() {
  const source = localStorage.getItem(ANALYTICS_KEY);
  if (!source) {
    return { ...DEFAULT_ANALYTICS };
  }

  try {
    const parsed = JSON.parse(source);
    return {
      sessions: Number(parsed.sessions) || 0,
      captures: Number(parsed.captures) || 0,
      downloads: Number(parsed.downloads) || 0,
      prints: Number(parsed.prints) || 0,
      shares: Number(parsed.shares) || 0,
      leads: Number(parsed.leads) || 0
    };
  } catch (error) {
    return { ...DEFAULT_ANALYTICS };
  }
}

function writeAnalytics(analytics) {
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
}

export function getBoothAnalytics() {
  return readAnalytics();
}

export function incrementBoothAnalytics(metric, amount = 1) {
  if (!(metric in DEFAULT_ANALYTICS)) {
    return readAnalytics();
  }

  const safeAmount = Number.isFinite(amount) ? amount : 1;
  const analytics = readAnalytics();
  analytics[metric] = Math.max(0, analytics[metric] + safeAmount);
  writeAnalytics(analytics);

  return analytics;
}

function readLeadCollection() {
  return readJsonCollection(LEADS_KEY);
}

function writeLeadCollection(items) {
  writeJsonCollection(LEADS_KEY, items);
}

export function getLeadItems() {
  return readLeadCollection();
}

export function saveLeadItem(payload = {}) {
  const item = {
    id: createId(),
    name: String(payload.name || "").trim(),
    email: String(payload.email || "").trim(),
    phone: String(payload.phone || "").trim(),
    consent: Boolean(payload.consent),
    layout: String(payload.layout || "unknown"),
    createdAt: new Date().toISOString()
  };

  const items = readLeadCollection();
  items.unshift(item);

  if (items.length > MAX_LEAD_ITEMS) {
    items.length = MAX_LEAD_ITEMS;
  }

  writeLeadCollection(items);
  return item;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function getLeadsCsvContent() {
  const items = getLeadItems();
  const header = ["name", "email", "phone", "consent", "layout", "createdAt"];
  const lines = items.map((item) => {
    return [
      escapeCsvValue(item.name),
      escapeCsvValue(item.email),
      escapeCsvValue(item.phone),
      escapeCsvValue(item.consent ? "yes" : "no"),
      escapeCsvValue(item.layout),
      escapeCsvValue(item.createdAt)
    ].join(",");
  });

  return [header.join(","), ...lines].join("\n");
}

export function clearLeadItems() {
  localStorage.removeItem(LEADS_KEY);
}
