const GALLERY_KEY = "lumina-photo-booth-gallery";
const MAX_GALLERY_ITEMS = 12;

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function readCollection() {
  const source = localStorage.getItem(GALLERY_KEY);
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

function writeCollection(items) {
  localStorage.setItem(GALLERY_KEY, JSON.stringify(items));
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
