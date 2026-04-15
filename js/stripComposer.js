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

  context.fillStyle = "rgba(244, 248, 255, 0.95)";
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
  const gradient = context.createLinearGradient(0, 0, preset.width, preset.height);
  gradient.addColorStop(0, "#f8fbff");
  gradient.addColorStop(1, "#edf3fb");
  context.fillStyle = gradient;
  context.fillRect(0, 0, preset.width, preset.height);

  context.strokeStyle = "rgba(117, 150, 185, 0.13)";
  context.lineWidth = 1;

  for (let y = 0; y <= preset.height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(preset.width, y);
    context.stroke();
  }
}

function drawNeonFrame(context, preset) {
  context.save();

  const outerGradient = context.createLinearGradient(0, 0, preset.width, preset.height);
  outerGradient.addColorStop(0, "#18d6bd");
  outerGradient.addColorStop(1, "#4e95ff");

  context.strokeStyle = outerGradient;
  context.lineWidth = 18;
  drawRoundedRect(context, 28, 28, preset.width - 56, preset.height - 56, 26);
  context.stroke();

  preset.slots.forEach((slot) => {
    context.strokeStyle = "rgba(8, 191, 165, 0.74)";
    context.lineWidth = 10;
    drawRoundedRect(
      context,
      slot.x - 8,
      slot.y - 8,
      slot.width + 16,
      slot.height + 16,
      16
    );
    context.stroke();
  });

  context.restore();
}

function drawFilmFrame(context, preset) {
  context.save();

  context.strokeStyle = "rgba(24, 34, 45, 0.92)";
  context.lineWidth = 16;
  drawRoundedRect(context, 24, 24, preset.width - 48, preset.height - 48, 20);
  context.stroke();

  context.fillStyle = "rgba(35, 44, 57, 0.88)";
  const holeWidth = 22;
  const holeHeight = 16;
  const spacing = 36;

  for (let y = 62; y < preset.height - 62; y += spacing) {
    context.fillRect(14, y, holeWidth, holeHeight);
    context.fillRect(preset.width - 36, y, holeWidth, holeHeight);
  }

  preset.slots.forEach((slot) => {
    context.strokeStyle = "rgba(255, 255, 255, 0.94)";
    context.lineWidth = 9;
    drawRoundedRect(
      context,
      slot.x - 6,
      slot.y - 6,
      slot.width + 12,
      slot.height + 12,
      12
    );
    context.stroke();
  });

  context.restore();
}

function drawStudioFrame(context, preset) {
  context.save();

  context.strokeStyle = "rgba(10, 33, 72, 0.7)";
  context.lineWidth = 6;
  drawRoundedRect(context, 40, 40, preset.width - 80, preset.height - 80, 24);
  context.stroke();

  context.strokeStyle = "rgba(74, 123, 189, 0.45)";
  context.lineWidth = 2;
  drawRoundedRect(context, 58, 58, preset.width - 116, preset.height - 116, 20);
  context.stroke();

  const cornerLength = 54;
  const cornerOffset = 56;
  context.strokeStyle = "rgba(57, 124, 210, 0.65)";
  context.lineWidth = 5;

  const corners = [
    [cornerOffset, cornerOffset, 1, 1],
    [preset.width - cornerOffset, cornerOffset, -1, 1],
    [cornerOffset, preset.height - cornerOffset, 1, -1],
    [preset.width - cornerOffset, preset.height - cornerOffset, -1, -1]
  ];

  corners.forEach(([x, y, dx, dy]) => {
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + cornerLength * dx, y);
    context.moveTo(x, y);
    context.lineTo(x, y + cornerLength * dy);
    context.stroke();
  });

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
    context.fillStyle = "rgba(36, 62, 79, 0.92)";
    context.fillText(eventTitle, centerX, titleY);
  }

  if (detailParts.length) {
    const detailSize = Math.round(Math.max(14, Math.min(30, preset.width * 0.012)));
    context.font = `600 ${detailSize}px "Plus Jakarta Sans", "Segoe UI", sans-serif`;
    context.fillStyle = "rgba(56, 88, 109, 0.78)";
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
  });

  drawFrame(context, preset, frame);

  if (sticker && STICKER_ASSETS[sticker]) {
    const stickerImage = await loadImage(STICKER_ASSETS[sticker]);
    drawSticker(context, preset, stickerImage);
  }

  drawBranding(context, preset, branding);

  return outputCanvas;
}
