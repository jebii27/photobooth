import { LAYOUT_PRESETS, STICKER_ASSETS } from "./config.js";

const imageCache = new Map();

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawContainImage(context, image, slot) {
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const sourceRatio = sourceWidth / sourceHeight;
  const slotRatio = slot.width / slot.height;

  let drawWidth = slot.width;
  let drawHeight = slot.height;
  let drawX = slot.x;
  let drawY = slot.y;

  if (sourceRatio > slotRatio) {
    drawHeight = slot.width / sourceRatio;
    drawY = slot.y + (slot.height - drawHeight) / 2;
  } else {
    drawWidth = slot.height * sourceRatio;
    drawX = slot.x + (slot.width - drawWidth) / 2;
  }

  context.fillStyle = "#f8fafc";
  context.fillRect(slot.x, slot.y, slot.width, slot.height);

  context.drawImage(
    image,
    0,
    0,
    sourceWidth,
    sourceHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
}

function buildFilterString(filters) {
  return [
    `grayscale(${filters.grayscale}%)`,
    `sepia(${filters.sepia}%)`,
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`
  ].join(" ");
}

function drawBackdrop(context, preset) {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, preset.width, preset.height);
}

function drawNeonFrame(context, preset) {
  context.save();
  context.strokeStyle = "rgba(15, 23, 42, 0.9)";
  context.lineWidth = 4;
  drawRoundedRect(context, 20, 20, preset.width - 40, preset.height - 40, 20);
  context.stroke();
  context.restore();
}

function drawFilmFrame(context, preset) {
  context.save();
  context.strokeStyle = "rgba(17, 24, 39, 0.92)";
  context.lineWidth = 8;
  drawRoundedRect(context, 18, 18, preset.width - 36, preset.height - 36, 16);
  context.stroke();
  context.restore();
}

function drawStudioFrame(context, preset) {
  context.save();
  context.strokeStyle = "rgba(30, 41, 59, 0.5)";
  context.lineWidth = 4;
  drawRoundedRect(context, 26, 26, preset.width - 52, preset.height - 52, 20);
  context.stroke();

  context.strokeStyle = "rgba(30, 41, 59, 0.24)";
  context.lineWidth = 2;
  drawRoundedRect(context, 44, 44, preset.width - 88, preset.height - 88, 16);
  context.stroke();

  context.restore();
}

function drawFrame(context, preset, frame) {
  if (frame === "none") {
    return;
  }

  if (frame === "film") {
    drawFilmFrame(context, preset);
    return;
  }

  if (frame === "studio") {
    drawStudioFrame(context, preset);
    return;
  }

  drawNeonFrame(context, preset);
}

function drawBranding(context, preset, branding = {}) {
  const eventTitle = String(branding.eventTitle || "").trim().slice(0, 48);
  const tagline = String(branding.tagline || "").trim().slice(0, 64);
  const showDate = branding.showDate !== false;

  const detailParts = [];
  if (tagline) {
    detailParts.push(tagline);
  }
  if (showDate) {
    detailParts.push(new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }));
  }

  if (!eventTitle && !detailParts.length) {
    return;
  }

  const centerX = preset.width / 2;
  const bottomPadding = Math.round(Math.max(26, preset.height * 0.022));
  const detailY = preset.height - bottomPadding;
  const titleY = detailParts.length ? detailY - Math.round(Math.max(26, preset.height * 0.02)) : detailY;

  context.save();
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  if (eventTitle) {
    const titleSize = Math.round(Math.max(18, Math.min(44, preset.width * 0.022)));
    context.font = `700 ${titleSize}px "Plus Jakarta Sans", "Segoe UI", sans-serif`;
    context.fillStyle = "rgba(15, 23, 42, 0.95)";
    context.fillText(eventTitle, centerX, titleY);
  }

  if (detailParts.length) {
    const detailSize = Math.round(Math.max(14, Math.min(30, preset.width * 0.012)));
    context.font = `600 ${detailSize}px "Plus Jakarta Sans", "Segoe UI", sans-serif`;
    context.fillStyle = "rgba(71, 85, 105, 0.86)";
    context.fillText(detailParts.join(" | "), centerX, detailY);
  }

  context.restore();
}

function loadImage(source) {
  if (imageCache.has(source)) {
    return imageCache.get(source);
  }

  const pendingImage = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${source}`));
    image.src = source;
  });

  imageCache.set(source, pendingImage);
  return pendingImage;
}

function drawSticker(context, preset, stickerImage) {
  const size = Math.round(Math.min(preset.width, preset.height) * 0.13);
  const placements = [
    { x: preset.width - size - 52, y: 56 },
    { x: 52, y: preset.height - size - 62 }
  ];

  context.save();
  context.globalAlpha = 0.92;

  placements.forEach((placement, index) => {
    context.save();
    context.translate(placement.x + size / 2, placement.y + size / 2);
    context.rotate(index === 0 ? 0.16 : -0.2);
    context.drawImage(stickerImage, -size / 2, -size / 2, size, size);
    context.restore();
  });

  context.restore();
}

export async function composeStrip({
  photos,
  layout,
  filters,
  frame,
  sticker,
  branding
}) {
  if (!photos || photos.length === 0) {
    throw new Error("No photos were provided for strip rendering.");
  }

  const preset = LAYOUT_PRESETS[layout] || LAYOUT_PRESETS.strip4;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = preset.width;
  outputCanvas.height = preset.height;

  const context = outputCanvas.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  drawBackdrop(context, preset);

  const filterString = buildFilterString(filters);

  preset.slots.forEach((slot, index) => {
    const source = photos[index % photos.length];

    context.save();
    context.filter = filterString;
    drawRoundedRect(context, slot.x, slot.y, slot.width, slot.height, 14);
    context.clip();
    drawContainImage(context, source, slot);
    context.restore();

    context.save();
    context.strokeStyle = "rgba(15, 23, 42, 0.16)";
    context.lineWidth = 3;
    drawRoundedRect(context, slot.x + 1.5, slot.y + 1.5, slot.width - 3, slot.height - 3, 14);
    context.stroke();
    context.restore();
  });

  drawFrame(context, preset, frame);

  if (sticker && STICKER_ASSETS[sticker]) {
    const stickerImage = await loadImage(STICKER_ASSETS[sticker]);
    drawSticker(context, preset, stickerImage);
  }

  drawBranding(context, preset, branding);

  return outputCanvas;
}
