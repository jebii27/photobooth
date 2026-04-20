import { LAYOUT_PRESETS } from "./config.js";
import { CameraService } from "./cameraService.js";
import { composeStrip } from "./stripComposer.js";
import {
  appState,
  getShotCount,
  resetCaptureSession,
  resetEditorDefaults
} from "./state.js";
import {
  clearGallery,
  getBoothAnalytics,
  getGalleryItems,
  getLeadItems,
  getLeadsCsvContent,
  incrementBoothAnalytics,
  removeGalleryItem,
  saveGalleryItem,
  saveLeadItem
} from "./storage.js";

const fallbackScreenIds = ["landing", "camera", "edit", "download"];

const elements = {
  screens: {
    landing: document.getElementById("landingScreen"),
    camera: document.getElementById("cameraScreen"),
    edit: document.getElementById("editScreen"),
    download: document.getElementById("downloadScreen")
  },
  flowSteps: Array.from(document.querySelectorAll("#flowSteps li")),
  startBoothBtn: document.getElementById("startBoothBtn"),
  continueWithSelectionBtn: document.getElementById("continueWithSelectionBtn"),
  landingLayoutOptions: document.getElementById("landingLayoutOptions"),
  landingSelectionText: document.getElementById("landingSelectionText"),
  sampleCarousel: document.getElementById("sampleCarousel"),
  carouselPrevBtn: document.getElementById("carouselPrevBtn"),
  carouselNextBtn: document.getElementById("carouselNextBtn"),
  carouselDots: document.getElementById("carouselDots"),
  cameraFeed: document.getElementById("cameraFeed"),
  captureBtn: document.getElementById("captureBtn"),
  backToLandingBtn: document.getElementById("backToLandingBtn"),
  countdownOptions: document.getElementById("countdownOptions"),
  layoutOptions: document.getElementById("layoutOptions"),
  cameraFilterPreset: document.getElementById("cameraFilterPreset"),
  cameraFacingMode: document.getElementById("cameraFacingMode"),
  mirrorPreviewToggle: document.getElementById("mirrorPreviewToggle"),
  livePhotoToggle: document.getElementById("livePhotoToggle"),
  livePhotoHint: document.getElementById("livePhotoHint"),
  countdownOverlay: document.getElementById("countdownOverlay"),
  shotStatus: document.getElementById("shotStatus"),
  captureFlash: document.getElementById("captureFlash"),
  modal: document.getElementById("previewModal"),
  modalThumbGrid: document.getElementById("modalThumbGrid"),
  modalPreviewImage: document.getElementById("modalPreviewImage"),
  retakeBtn: document.getElementById("retakeBtn"),
  proceedToEditBtn: document.getElementById("proceedToEditBtn"),
  editPreviewCanvas: document.getElementById("editPreviewCanvas"),
  capturedThumbs: document.getElementById("capturedThumbs"),
  retakeFromEditBtn: document.getElementById("retakeFromEditBtn"),
  toDownloadBtn: document.getElementById("toDownloadBtn"),
  editFilterPreset: document.getElementById("editFilterPreset"),
  grayscaleRange: document.getElementById("grayscaleRange"),
  sepiaRange: document.getElementById("sepiaRange"),
  brightnessRange: document.getElementById("brightnessRange"),
  contrastRange: document.getElementById("contrastRange"),
  editLayoutOptions: document.getElementById("editLayoutOptions"),
  frameOptions: document.getElementById("frameOptions"),
  stickerOptions: document.getElementById("stickerOptions"),
  brandEventTitle: document.getElementById("brandEventTitle"),
  brandTagline: document.getElementById("brandTagline"),
  showDateStamp: document.getElementById("showDateStamp"),
  finalCanvas: document.getElementById("finalCanvas"),
  exportInfo: document.getElementById("exportInfo"),
  shareStripBtn: document.getElementById("shareStripBtn"),
  shareStatus: document.getElementById("shareStatus"),
  livePhotoExportGroup: document.getElementById("livePhotoExportGroup"),
  livePhotoPreview: document.getElementById("livePhotoPreview"),
  downloadLiveBtn: document.getElementById("downloadLiveBtn"),
  livePhotoExportHint: document.getElementById("livePhotoExportHint"),
  leadName: document.getElementById("leadName"),
  leadEmail: document.getElementById("leadEmail"),
  leadPhone: document.getElementById("leadPhone"),
  leadConsent: document.getElementById("leadConsent"),
  saveLeadBtn: document.getElementById("saveLeadBtn"),
  exportLeadsCsvBtn: document.getElementById("exportLeadsCsvBtn"),
  leadStatus: document.getElementById("leadStatus"),
  downloadPngBtn: document.getElementById("downloadPngBtn"),
  downloadJpgBtn: document.getElementById("downloadJpgBtn"),
  printBtn: document.getElementById("printBtn"),
  saveGalleryBtn: document.getElementById("saveGalleryBtn"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  galleryGrid: document.getElementById("galleryGrid"),
  clearGalleryBtn: document.getElementById("clearGalleryBtn"),
  metricSessions: document.getElementById("metricSessions"),
  metricCaptures: document.getElementById("metricCaptures"),
  metricDownloads: document.getElementById("metricDownloads"),
  metricPrints: document.getElementById("metricPrints"),
  metricShares: document.getElementById("metricShares"),
  metricLeads: document.getElementById("metricLeads"),
  thumbTemplate: document.getElementById("thumbItemTemplate")
};

const screenIds = fallbackScreenIds.filter((step) => Boolean(elements.screens[step]));
const hasLandingScreen = Boolean(elements.screens.landing);

const cameraService = new CameraService(elements.cameraFeed, {
  facingMode: appState.camera.facingMode,
  mirrorPreview: appState.camera.mirror,
  mirrorCapture: appState.camera.mirror
});

let isCapturing = false;
let renderTimer = 0;
let renderToken = 0;
let selectedModalPhotoIndex = 0;
const carouselState = {
  index: 0,
  timer: 0
};
const CAROUSEL_INTERVAL_MS = 4300;
const FILTER_PRESETS = {
  none: {
    grayscale: 0,
    sepia: 0,
    brightness: 100,
    contrast: 100
  },
  mono: {
    grayscale: 100,
    sepia: 0,
    brightness: 105,
    contrast: 110
  },
  vintage: {
    grayscale: 18,
    sepia: 34,
    brightness: 108,
    contrast: 94
  },
  bright: {
    grayscale: 0,
    sepia: 0,
    brightness: 120,
    contrast: 112
  },
  dramatic: {
    grayscale: 0,
    sepia: 20,
    brightness: 90,
    contrast: 132
  }
};
let boothAnalytics = getBoothAnalytics();

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function setShotStatus(message, isError = false) {
  if (!elements.shotStatus) {
    return;
  }

  elements.shotStatus.textContent = message;
  elements.shotStatus.style.borderColor = isError
    ? "rgba(255, 92, 117, 0.8)"
    : "rgba(220, 233, 248, 0.28)";
}

function setHintStatus(target, message, isError = false) {
  if (!target) {
    return;
  }

  target.textContent = message;
  target.style.color = isError ? "#b64f5a" : "var(--text-muted)";
}

function isLivePhotoFeatureSupported() {
  return typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices) &&
    typeof navigator.mediaDevices.getUserMedia === "function";
}

function revokeLivePhotoUrl() {
  if (!appState.livePhoto.url) {
    return;
  }

  URL.revokeObjectURL(appState.livePhoto.url);
  appState.livePhoto.url = "";
}

function getLivePhotoFileExtension(mimeType) {
  if (mimeType.includes("mp4")) {
    return "mp4";
  }

  if (mimeType.includes("ogg")) {
    return "ogv";
  }

  return "webm";
}

function renderLivePhotoPreview() {
  if (!elements.livePhotoPreview || !elements.downloadLiveBtn || !elements.livePhotoExportHint) {
    return;
  }

  const hasClip = Boolean(appState.livePhoto.blob) && Boolean(appState.livePhoto.url);

  elements.downloadLiveBtn.disabled = !hasClip;
  elements.livePhotoPreview.classList.toggle("hidden", !hasClip);

  if (hasClip) {
    if (elements.livePhotoPreview.src !== appState.livePhoto.url) {
      elements.livePhotoPreview.src = appState.livePhoto.url;
    }

    setHintStatus(elements.livePhotoExportHint, "Live Photo ready. Download your motion clip.");
    return;
  }

  elements.livePhotoPreview.pause();
  elements.livePhotoPreview.removeAttribute("src");
  elements.livePhotoPreview.load();
  setHintStatus(
    elements.livePhotoExportHint,
    "Capture with Live Photo enabled to preview and download the clip."
  );
}

function setLivePhotoBlob(blob) {
  revokeLivePhotoUrl();

  if (!blob || blob.size <= 0) {
    appState.livePhoto.blob = null;
    appState.livePhoto.mimeType = "";
    renderLivePhotoPreview();
    return;
  }

  appState.livePhoto.blob = blob;
  appState.livePhoto.mimeType = blob.type || "video/webm";
  appState.livePhoto.url = URL.createObjectURL(blob);
  renderLivePhotoPreview();
}

function syncLivePhotoControls() {
  if (!elements.livePhotoToggle || !elements.livePhotoHint) {
    return;
  }

  const isSupported = isLivePhotoFeatureSupported();

  if (!isSupported) {
    appState.livePhoto.enabled = false;
  }

  elements.livePhotoToggle.disabled = !isSupported;
  elements.livePhotoToggle.checked = appState.livePhoto.enabled;

  if (!isSupported) {
    setHintStatus(elements.livePhotoHint, "Live Photo is not supported by this browser.", true);
    return;
  }

  if (appState.livePhoto.enabled) {
    setHintStatus(elements.livePhotoHint, "Live Photo enabled. A clip will be recorded during capture.");
    return;
  }

  setHintStatus(elements.livePhotoHint, "Disabled. Enable to capture a Live Photo clip.");
}

function downloadLivePhotoClip() {
  if (!appState.livePhoto.blob) {
    setHintStatus(elements.livePhotoExportHint, "Capture a session with Live Photo enabled first.", true);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = getLivePhotoFileExtension(appState.livePhoto.mimeType || "video/webm");

  downloadBlob(appState.livePhoto.blob, `lumina-live-photo-${stamp}.${extension}`);
  setHintStatus(elements.livePhotoExportHint, "Live Photo clip downloaded.");
}

function normalizeTextValue(value, maxLength = 64) {
  return String(value || "").trim().slice(0, maxLength);
}

function renderAnalytics(analytics) {
  const metrics = {
    sessions: elements.metricSessions,
    captures: elements.metricCaptures,
    downloads: elements.metricDownloads,
    prints: elements.metricPrints,
    shares: elements.metricShares,
    leads: elements.metricLeads
  };

  Object.entries(metrics).forEach(([metric, target]) => {
    if (!target) {
      return;
    }

    target.textContent = String(analytics[metric] || 0);
  });
}

function refreshAnalyticsDashboard() {
  boothAnalytics = getBoothAnalytics();
  renderAnalytics(boothAnalytics);
}

function bumpAnalytics(metric, amount = 1) {
  boothAnalytics = incrementBoothAnalytics(metric, amount);
  renderAnalytics(boothAnalytics);
}

function buildFilterCss(filters) {
  return [
    `grayscale(${filters.grayscale}%)`,
    `sepia(${filters.sepia}%)`,
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`
  ].join(" ");
}

function setFilterValues(filters) {
  appState.filters.grayscale = filters.grayscale;
  appState.filters.sepia = filters.sepia;
  appState.filters.brightness = filters.brightness;
  appState.filters.contrast = filters.contrast;
}

function syncFilterRangeInputs() {
  elements.grayscaleRange.value = String(appState.filters.grayscale);
  elements.sepiaRange.value = String(appState.filters.sepia);
  elements.brightnessRange.value = String(appState.filters.brightness);
  elements.contrastRange.value = String(appState.filters.contrast);
}

function syncCameraControls() {
  if (elements.cameraFacingMode) {
    elements.cameraFacingMode.value = appState.camera.facingMode;
  }

  if (elements.mirrorPreviewToggle) {
    elements.mirrorPreviewToggle.checked = appState.camera.mirror;
  }
}

function syncBrandingInputs() {
  if (elements.brandEventTitle) {
    elements.brandEventTitle.value = appState.branding.eventTitle;
  }

  if (elements.brandTagline) {
    elements.brandTagline.value = appState.branding.tagline;
  }

  if (elements.showDateStamp) {
    elements.showDateStamp.checked = Boolean(appState.branding.showDate);
  }
}

function getCurrentFilterPresetKey() {
  const current = appState.filters;
  const matchingPreset = Object.entries(FILTER_PRESETS).find(([, preset]) => {
    return preset.grayscale === current.grayscale &&
      preset.sepia === current.sepia &&
      preset.brightness === current.brightness &&
      preset.contrast === current.contrast;
  });

  return matchingPreset ? matchingPreset[0] : "custom";
}

function syncFilterPresetControls() {
  const presetKey = getCurrentFilterPresetKey();

  if (elements.cameraFilterPreset) {
    elements.cameraFilterPreset.value = presetKey;
  }

  if (elements.editFilterPreset) {
    elements.editFilterPreset.value = presetKey;
  }
}

function applyCameraPreviewFilter() {
  if (!elements.cameraFeed) {
    return;
  }

  elements.cameraFeed.style.filter = buildFilterCss(appState.filters);
}

function applyFilterPreset(presetKey) {
  const preset = FILTER_PRESETS[presetKey];
  if (!preset) {
    return;
  }

  setFilterValues(preset);
  syncFilterRangeInputs();
  syncFilterPresetControls();
  applyCameraPreviewFilter();
  refreshCapturedThumbPreviews();
  queueRender();
}

function detectDeviceOrientation() {
  if (window.matchMedia && window.matchMedia("(orientation: portrait)").matches) {
    return "portrait";
  }

  return window.innerHeight >= window.innerWidth ? "portrait" : "landscape";
}

function updateDeviceOrientation() {
  appState.deviceOrientation = detectDeviceOrientation();
  document.body.dataset.deviceOrientation = appState.deviceOrientation;
}

function getCaptureDimensions() {
  const sourceWidth = Number(elements.cameraFeed?.videoWidth || 0);
  const sourceHeight = Number(elements.cameraFeed?.videoHeight || 0);

  if (sourceWidth > 0 && sourceHeight > 0) {
    const longestSide = 1280;

    if (sourceWidth >= sourceHeight) {
      return {
        width: longestSide,
        height: Math.max(1, Math.round((longestSide * sourceHeight) / sourceWidth))
      };
    }

    return {
      width: Math.max(1, Math.round((longestSide * sourceWidth) / sourceHeight)),
      height: longestSide
    };
  }

  if (appState.deviceOrientation === "portrait") {
    return { width: 960, height: 1280 };
  }

  return { width: 1280, height: 960 };
}

function getCarouselSlides() {
  return Array.from(document.querySelectorAll(".sample-slide"));
}

function getCarouselDots() {
  if (!elements.carouselDots) {
    return [];
  }

  return Array.from(elements.carouselDots.querySelectorAll(".carousel-dot"));
}

function setCarouselIndex(index) {
  const slides = getCarouselSlides();
  if (!slides.length) {
    return;
  }

  const bounded = (index + slides.length) % slides.length;
  carouselState.index = bounded;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === bounded);
  });

  getCarouselDots().forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === bounded);
  });
}

function stepCarousel(direction = 1) {
  setCarouselIndex(carouselState.index + direction);
}

function stopCarouselAuto() {
  if (!carouselState.timer) {
    return;
  }

  window.clearInterval(carouselState.timer);
  carouselState.timer = 0;
}

function startCarouselAuto() {
  stopCarouselAuto();

  if (getCarouselSlides().length < 2) {
    return;
  }

  carouselState.timer = window.setInterval(() => {
    stepCarousel(1);
  }, CAROUSEL_INTERVAL_MS);
}

function updateFlow(step) {
  const activeIndex = screenIds.indexOf(step);

  elements.flowSteps.forEach((stepItem) => {
    const itemStep = stepItem.dataset.step;
    const index = screenIds.indexOf(itemStep);
    stepItem.classList.toggle("active", itemStep === step);
    stepItem.classList.toggle("done", index < activeIndex);
  });
}

function setScreen(step) {
  appState.currentStep = step;

  Object.entries(elements.screens).forEach(([key, element]) => {
    if (!element) {
      return;
    }

    element.classList.toggle("active", key === step);
  });

  updateFlow(step);

  if (step === "landing") {
    startCarouselAuto();
  } else {
    stopCarouselAuto();
  }
}

function openModal() {
  syncModalLayoutMode();
  elements.modal.classList.remove("hidden");
  elements.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  elements.modal.classList.add("hidden");
  elements.modal.setAttribute("aria-hidden", "true");
}

function flashCapture() {
  elements.captureFlash.classList.add("active");
  window.setTimeout(() => {
    elements.captureFlash.classList.remove("active");
  }, 140);
}

function getThumbDataUrl(photo, useCurrentFilters = false) {
  if (!useCurrentFilters) {
    return photo.toDataURL("image/jpeg", 0.9);
  }

  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = photo.width;
  previewCanvas.height = photo.height;

  const context = previewCanvas.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = buildFilterCss(appState.filters);
  context.drawImage(photo, 0, 0);
  context.filter = "none";

  return previewCanvas.toDataURL("image/jpeg", 0.9);
}

function updateModalPreviewImage(useCurrentFilters = true) {
  if (!elements.modalPreviewImage) {
    return;
  }

  syncModalLayoutMode();

  const previewWrap = elements.modalPreviewImage.parentElement;

  if (!appState.photos.length) {
    elements.modalPreviewImage.removeAttribute("src");
    elements.modalPreviewImage.alt = "No captured shot available";

    if (previewWrap) {
      previewWrap.classList.remove("is-portrait-shot", "is-landscape-shot");
    }

    return;
  }

  selectedModalPhotoIndex = Math.max(
    0,
    Math.min(selectedModalPhotoIndex, appState.photos.length - 1)
  );

  const selectedPhoto = appState.photos[selectedModalPhotoIndex];
  const isPortraitShot = selectedPhoto.height > selectedPhoto.width;

  if (previewWrap) {
    previewWrap.classList.toggle("is-portrait-shot", isPortraitShot);
    previewWrap.classList.toggle("is-landscape-shot", !isPortraitShot);
  }

  elements.modalPreviewImage.src = getThumbDataUrl(selectedPhoto, useCurrentFilters);
  elements.modalPreviewImage.alt = `Captured shot ${selectedModalPhotoIndex + 1} preview`;

  Array.from(elements.modalThumbGrid.querySelectorAll(".thumb-item")).forEach((node) => {
    node.classList.toggle("active", Number(node.dataset.index) === selectedModalPhotoIndex);
  });
}

function syncModalLayoutMode() {
  if (!elements.modal || !elements.modalPreviewImage) {
    return;
  }

  const modalCard = elements.modal.querySelector(".modal-card");
  const previewWrap = elements.modalPreviewImage.parentElement;

  if (!modalCard || !previewWrap) {
    return;
  }

  const currentLayout = appState.layout;
  const isPortraitLayout = currentLayout !== "strip4Horizontal";

  modalCard.dataset.captureLayout = currentLayout;
  previewWrap.classList.toggle("is-layout-portrait", isPortraitLayout);
  previewWrap.classList.toggle("is-layout-landscape", !isPortraitLayout);
}

function renderPhotoThumbs(target, options = {}) {
  const { useCurrentFilters = false, selectedIndex = -1, onThumbSelect = null } = options;
  target.innerHTML = "";

  appState.photos.forEach((photo, index) => {
    const node = elements.thumbTemplate.content.firstElementChild.cloneNode(true);
    const orientationClass = photo.height > photo.width ? "is-portrait" : "is-landscape";
    node.classList.add(orientationClass);
    node.dataset.index = String(index);
    node.classList.toggle("active", index === selectedIndex);
    const image = node.querySelector("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.draggable = false;
    image.src = getThumbDataUrl(photo, useCurrentFilters);
    image.alt = `Captured shot ${index + 1}`;

    if (typeof onThumbSelect === "function") {
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.setAttribute("aria-label", `Show captured shot ${index + 1}`);
      node.addEventListener("click", () => {
        onThumbSelect(index);
      });
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onThumbSelect(index);
        }
      });
    }

    target.appendChild(node);
  });
}

async function runCountdown(totalShots, shotIndex) {
  elements.countdownOverlay.classList.remove("hidden");

  for (let value = appState.countdownSeconds; value >= 1; value -= 1) {
    elements.countdownOverlay.textContent = String(value);
    setShotStatus(`Shot ${shotIndex}/${totalShots} in ${value}s`);
    await wait(1000);
  }

  elements.countdownOverlay.textContent = "SNAP";
  await wait(260);
  elements.countdownOverlay.classList.add("hidden");
}

async function ensureCamera() {
  try {
    updateDeviceOrientation();
    cameraService.facingMode = appState.camera.facingMode;
    cameraService.setMirror(appState.camera.mirror);
    await cameraService.start();
    syncCameraControls();
    syncLivePhotoControls();
    applyCameraPreviewFilter();
    setShotStatus("Camera ready");
    return true;
  } catch (error) {
    setShotStatus(error.message || "Could not access camera", true);
    return false;
  }
}

async function goToCamera() {
  setScreen("camera");
  closeModal();
  await ensureCamera();
}

function resetEditorUi() {
  syncFilterRangeInputs();
  syncFilterPresetControls();
  syncCameraControls();
  syncBrandingInputs();
  applyCameraPreviewFilter();

  if (elements.editLayoutOptions) {
    Array.from(elements.editLayoutOptions.querySelectorAll(".chip")).forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.layout === appState.layout);
    });
  }

  Array.from(elements.frameOptions.querySelectorAll(".chip")).forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.frame === appState.overlay.frame);
  });

  Array.from(elements.stickerOptions.querySelectorAll(".chip")).forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.sticker === appState.overlay.sticker);
  });
}

function refreshCapturedThumbPreviews() {
  renderPhotoThumbs(elements.capturedThumbs, { useCurrentFilters: true });
  renderPhotoThumbs(elements.modalThumbGrid, {
    useCurrentFilters: true,
    selectedIndex: selectedModalPhotoIndex,
    onThumbSelect: (index) => {
      selectedModalPhotoIndex = index;
      updateModalPreviewImage(true);
    }
  });
  updateModalPreviewImage(true);
}

function applyLayoutSelection(layout, options = {}) {
  const { syncCamera = true, syncLanding = true } = options;

  if (!LAYOUT_PRESETS[layout]) {
    return;
  }

  appState.layout = layout;
  appState.autoSavedCurrentResult = false;

  if (syncCamera && elements.layoutOptions) {
    const radio = elements.layoutOptions.querySelector(`input[name="layout"][value="${layout}"]`);
    if (radio) {
      radio.checked = true;
    }
  }

  if (syncLanding && elements.landingLayoutOptions) {
    Array.from(elements.landingLayoutOptions.querySelectorAll(".package-card")).forEach((card) => {
      card.classList.toggle("active", card.dataset.layout === layout);
    });
  }

  if (elements.landingSelectionText) {
    elements.landingSelectionText.textContent = `Selected: ${LAYOUT_PRESETS[layout].label}`;
  }

  syncPreviewLayoutMode();
  syncModalLayoutMode();

  if (appState.finalCanvas) {
    window.requestAnimationFrame(() => {
      redrawActivePreviewCanvas();
    });
  }
}

function syncPreviewLayoutMode() {
  const preset = LAYOUT_PRESETS[appState.layout] || LAYOUT_PRESETS.strip4;
  const ratio = preset.width / preset.height;
  const isPortraitLayout = ratio < 1;
  const isUltraPortraitLayout = ratio <= 0.55;

  [
    elements.editPreviewCanvas?.parentElement,
    elements.finalCanvas?.parentElement
  ].forEach((container) => {
    if (!container) {
      return;
    }

    container.classList.toggle("is-portrait-layout", isPortraitLayout);
    container.classList.toggle("is-landscape-layout", !isPortraitLayout);
    container.classList.toggle("is-ultra-portrait-layout", isUltraPortraitLayout);
    container.style.setProperty("--layout-ratio", String(ratio));
  });
}

function copyCanvas(source, target) {
  if (!source || !target) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const parentRect = target.parentElement?.getBoundingClientRect();
  const cssWidth = Math.max(
    1,
    Math.floor(targetRect.width || parentRect?.width || target.clientWidth || source.width)
  );
  const cssHeight = Math.max(
    1,
    Math.floor(targetRect.height || parentRect?.height || target.clientHeight || source.height)
  );
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const pixelWidth = Math.round(cssWidth * dpr);
  const pixelHeight = Math.round(cssHeight * dpr);

  if (target.width !== pixelWidth) {
    target.width = pixelWidth;
  }

  if (target.height !== pixelHeight) {
    target.height = pixelHeight;
  }

  const context = target.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, target.width, target.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, target.width, target.height);

  const sourceRatio = source.width / source.height;
  const targetRatio = target.width / target.height;

  let drawWidth = target.width;
  let drawHeight = target.height;
  let drawX = 0;
  let drawY = 0;

  if (sourceRatio > targetRatio) {
    drawHeight = drawWidth / sourceRatio;
    drawY = (target.height - drawHeight) / 2;
  } else {
    drawWidth = drawHeight * sourceRatio;
    drawX = (target.width - drawWidth) / 2;
  }

  context.drawImage(
    source,
    0,
    0,
    source.width,
    source.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
}

function redrawActivePreviewCanvas() {
  if (!appState.finalCanvas) {
    return;
  }

  if (appState.currentStep === "edit") {
    copyCanvas(appState.finalCanvas, elements.editPreviewCanvas);
    return;
  }

  if (appState.currentStep === "download") {
    copyCanvas(appState.finalCanvas, elements.finalCanvas);
  }
}

async function renderComposedStrip() {
  if (!appState.photos.length) {
    return;
  }

  const token = ++renderToken;

  try {
    const composedCanvas = await composeStrip({
      photos: appState.photos,
      layout: appState.layout,
      filters: appState.filters,
      frame: appState.overlay.frame,
      sticker: appState.overlay.sticker,
      branding: appState.branding
    });

    if (token !== renderToken) {
      return;
    }

    appState.finalCanvas = composedCanvas;

    if (appState.currentStep === "edit") {
      copyCanvas(composedCanvas, elements.editPreviewCanvas);
    }

    if (appState.currentStep === "download") {
      copyCanvas(composedCanvas, elements.finalCanvas);
    }

    const preset = LAYOUT_PRESETS[appState.layout] || LAYOUT_PRESETS.strip4;
    elements.exportInfo.textContent = `${preset.label} • ${preset.width}x${preset.height}px`;
  } catch (error) {
    setShotStatus(error.message || "Could not render strip", true);
  }
}

function queueRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    renderComposedStrip();
  }, 80);
}

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function canvasToBlob(canvas, type = "image/png", quality = 0.94) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not generate a share file."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

async function shareCurrentStrip() {
  if (!appState.finalCanvas) {
    setHintStatus(elements.shareStatus, "Create a strip first before sharing.", true);
    return;
  }

  const shareTitle = appState.branding.eventTitle || "Avrielle Photo Booth";
  const shareText = appState.branding.tagline || "Captured with Avrielle Photo Booth";

  try {
    if (navigator.share) {
      const blob = await canvasToBlob(appState.finalCanvas, "image/png", 0.96);
      const fileName = `lumina-strip-${Date.now()}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file]
        });
      } else {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: window.location.href
        });
      }

      bumpAnalytics("shares", 1);
      setHintStatus(elements.shareStatus, "Share complete.");
      return;
    }

    setHintStatus(
      elements.shareStatus,
      "Native share is not available here. Use Download PNG, then share from your gallery.",
      true
    );
  } catch (error) {
    if (error && error.name === "AbortError") {
      setHintStatus(elements.shareStatus, "Share canceled.");
      return;
    }

    setHintStatus(elements.shareStatus, "Could not share strip on this browser.", true);
  }
}

function saveLeadFromForm() {
  const payload = {
    name: normalizeTextValue(elements.leadName.value, 60),
    email: normalizeTextValue(elements.leadEmail.value, 120),
    phone: normalizeTextValue(elements.leadPhone.value, 32),
    consent: Boolean(elements.leadConsent.checked),
    layout: appState.layout
  };

  if (!payload.email && !payload.phone) {
    setHintStatus(elements.leadStatus, "Provide at least an email or phone number.", true);
    return;
  }

  if (!payload.consent) {
    setHintStatus(elements.leadStatus, "Consent is required to store lead details.", true);
    return;
  }

  saveLeadItem(payload);
  bumpAnalytics("leads", 1);
  const leadCount = getLeadItems().length;

  elements.leadName.value = "";
  elements.leadEmail.value = "";
  elements.leadPhone.value = "";
  elements.leadConsent.checked = false;

  setHintStatus(elements.leadStatus, `Lead saved. Total local leads: ${leadCount}.`);
}

function exportLeadsCsv() {
  const leads = getLeadItems();
  if (!leads.length) {
    setHintStatus(elements.leadStatus, "No leads to export yet.", true);
    return;
  }

  const csv = getLeadsCsvContent();
  const csvBlob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadBlob(csvBlob, `lumina-leads-${stamp}.csv`);
  setHintStatus(elements.leadStatus, `Exported ${leads.length} leads to CSV.`);
}

function downloadCurrent(format) {
  if (!appState.finalCanvas) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (format === "png") {
    const dataUrl = appState.finalCanvas.toDataURL("image/png");
    downloadDataUrl(dataUrl, `lumina-strip-${stamp}.png`);
    bumpAnalytics("downloads", 1);
    return;
  }

  const dataUrl = appState.finalCanvas.toDataURL("image/jpeg", 0.94);
  downloadDataUrl(dataUrl, `lumina-strip-${stamp}.jpg`);
  bumpAnalytics("downloads", 1);
}

function printCurrentStrip() {
  if (!appState.finalCanvas) {
    return;
  }

  const dataUrl = appState.finalCanvas.toDataURL("image/png");
  const popup = window.open("", "_blank", "width=980,height=1280");

  if (!popup) {
    alert("Allow popups to print the strip.");
    return;
  }

  popup.document.write(`<!doctype html>
    <html>
      <head>
        <title>Print Photo Strip</title>
        <style>
          html, body { margin: 0; background: #111; }
          body { display: grid; place-items: center; min-height: 100vh; }
          img { max-width: min(96vw, 420px); width: 100%; height: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" alt="Photo strip" />
      </body>
    </html>`);

  popup.document.close();
  popup.focus();
  popup.onload = () => {
    bumpAnalytics("prints", 1);
    popup.print();
  };
}

function autoSaveCurrentResult() {
  if (!appState.finalCanvas || appState.autoSavedCurrentResult) {
    return;
  }

  const previewData = appState.finalCanvas.toDataURL("image/jpeg", 0.88);
  saveGalleryItem(previewData, appState.layout);
  appState.autoSavedCurrentResult = true;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

function renderGallery() {
  const items = getGalleryItems();
  elements.galleryGrid.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No saved strips yet. Export or auto-save a session to build your gallery.";
    elements.galleryGrid.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "gallery-card";

    const image = document.createElement("img");
    image.src = item.dataUrl;
    image.alt = "Saved photo strip";

    const meta = document.createElement("div");
    meta.className = "gallery-meta";

    const label = document.createElement("p");
    label.textContent = `${item.layout} • ${formatDate(item.createdAt)}`;

    const actions = document.createElement("div");
    actions.className = "gallery-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "ghost-btn small";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", () => {
      downloadDataUrl(item.dataUrl, `gallery-strip-${item.id}.jpg`);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ghost-btn small";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      removeGalleryItem(item.id);
      renderGallery();
    });

    actions.append(downloadBtn, deleteBtn);
    meta.append(label, actions);
    card.append(image, meta);
    elements.galleryGrid.appendChild(card);
  });
}

function beginNewSession() {
  bumpAnalytics("sessions", 1);
  revokeLivePhotoUrl();
  resetCaptureSession();
  selectedModalPhotoIndex = 0;
  resetEditorDefaults();
  resetEditorUi();
  syncLivePhotoControls();
  renderLivePhotoPreview();
  closeModal();
  setHintStatus(elements.shareStatus, "Use native sharing on supported devices and browsers.");
  setHintStatus(elements.leadStatus, "Leads and analytics are stored locally on this device.");
  renderPhotoThumbs(elements.capturedThumbs);
  renderPhotoThumbs(elements.modalThumbGrid);
  updateModalPreviewImage(false);
  goToCamera();
}

async function openEditStep() {
  closeModal();
  setScreen("edit");
  cameraService.stop();
  renderPhotoThumbs(elements.capturedThumbs, { useCurrentFilters: true });
  await renderComposedStrip();
}

async function openDownloadStep() {
  setScreen("download");
  cameraService.stop();

  await renderComposedStrip();

  if (appState.finalCanvas) {
    copyCanvas(appState.finalCanvas, elements.finalCanvas);
  }

  renderLivePhotoPreview();

  if (appState.livePhoto.enabled && !appState.livePhoto.blob && elements.livePhotoExportHint) {
    const livePhotoError = cameraService.getLivePhotoLastError();
    setHintStatus(
      elements.livePhotoExportHint,
      livePhotoError || "Live Photo was enabled, but no clip was captured for this session.",
      true
    );
  }

  autoSaveCurrentResult();
  renderGallery();
}

async function runCaptureFlow() {
  if (isCapturing) {
    return;
  }

  if (!cameraService.isReady()) {
    const ok = await ensureCamera();
    if (!ok) {
      return;
    }
  }

  isCapturing = true;
  elements.captureBtn.disabled = true;
  let liveRecordingStarted = false;

  try {
    updateDeviceOrientation();
    revokeLivePhotoUrl();
    resetCaptureSession();
    renderLivePhotoPreview();
    const captureDimensions = getCaptureDimensions();

    const totalShots = getShotCount(appState.layout);

    if (appState.livePhoto.enabled) {
      liveRecordingStarted = await cameraService.startLivePhotoRecording();

      if (liveRecordingStarted) {
        setHintStatus(elements.livePhotoHint, "Live Photo recording in progress...");
      } else {
        const livePhotoError = cameraService.getLivePhotoLastError();
        setHintStatus(
          elements.livePhotoHint,
          livePhotoError || "Could not start Live Photo recording on this browser.",
          true
        );
      }
    }

    for (let index = 1; index <= totalShots; index += 1) {
      await runCountdown(totalShots, index);
      flashCapture();

      const capturedFrame = cameraService.captureFrame(
        captureDimensions.width,
        captureDimensions.height
      );
      appState.photos.push(capturedFrame);

      setShotStatus(`Captured shot ${index}/${totalShots}`);
      await wait(380);
    }

    if (liveRecordingStarted) {
      const livePhotoBlob = await cameraService.stopLivePhotoRecording();
      liveRecordingStarted = false;

      if (livePhotoBlob && livePhotoBlob.size > 0) {
        setLivePhotoBlob(livePhotoBlob);
        setHintStatus(elements.livePhotoHint, "Live Photo captured.");
      } else {
        const livePhotoError = cameraService.getLivePhotoLastError();
        setHintStatus(
          elements.livePhotoHint,
          livePhotoError || "Live Photo could not be generated. Try again.",
          true
        );
      }
    }

    bumpAnalytics("captures", totalShots);

    selectedModalPhotoIndex = 0;
    refreshCapturedThumbPreviews();
    openModal();
    setShotStatus("Capture complete. Review before editing.");
  } catch (error) {
    setShotStatus(error.message || "Failed during capture", true);
  } finally {
    if (liveRecordingStarted) {
      const livePhotoBlob = await cameraService.stopLivePhotoRecording();
      if (!appState.livePhoto.blob && livePhotoBlob && livePhotoBlob.size > 0) {
        setLivePhotoBlob(livePhotoBlob);
      }
    }

    isCapturing = false;
    elements.captureBtn.disabled = false;
    elements.countdownOverlay.classList.add("hidden");
  }
}

function bindFilterControls() {
  if (elements.cameraFilterPreset) {
    elements.cameraFilterPreset.addEventListener("change", (event) => {
      const presetKey = event.target.value;
      applyFilterPreset(presetKey);
    });
  }

  if (elements.editFilterPreset) {
    elements.editFilterPreset.addEventListener("change", (event) => {
      const presetKey = event.target.value;
      applyFilterPreset(presetKey);
    });
  }

  if (elements.editLayoutOptions) {
    elements.editLayoutOptions.addEventListener("click", (event) => {
      const chip = event.target.closest(".chip");
      if (!chip) {
        return;
      }

      const selectedLayout = chip.dataset.layout;
      if (!selectedLayout || !LAYOUT_PRESETS[selectedLayout]) {
        return;
      }

      applyLayoutSelection(selectedLayout);

      Array.from(elements.editLayoutOptions.querySelectorAll(".chip")).forEach((item) => {
        item.classList.toggle("active", item === chip);
      });

      queueRender();
    });
  }

  elements.grayscaleRange.addEventListener("input", (event) => {
    appState.filters.grayscale = Number(event.target.value);
    syncFilterPresetControls();
    applyCameraPreviewFilter();
    refreshCapturedThumbPreviews();
    queueRender();
  });

  elements.sepiaRange.addEventListener("input", (event) => {
    appState.filters.sepia = Number(event.target.value);
    syncFilterPresetControls();
    applyCameraPreviewFilter();
    refreshCapturedThumbPreviews();
    queueRender();
  });

  elements.brightnessRange.addEventListener("input", (event) => {
    appState.filters.brightness = Number(event.target.value);
    syncFilterPresetControls();
    applyCameraPreviewFilter();
    refreshCapturedThumbPreviews();
    queueRender();
  });

  elements.contrastRange.addEventListener("input", (event) => {
    appState.filters.contrast = Number(event.target.value);
    syncFilterPresetControls();
    applyCameraPreviewFilter();
    refreshCapturedThumbPreviews();
    queueRender();
  });

  elements.frameOptions.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) {
      return;
    }

    appState.overlay.frame = chip.dataset.frame;

    Array.from(elements.frameOptions.querySelectorAll(".chip")).forEach((item) => {
      item.classList.toggle("active", item === chip);
    });

    queueRender();
  });

  elements.stickerOptions.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) {
      return;
    }

    appState.overlay.sticker = chip.dataset.sticker;

    Array.from(elements.stickerOptions.querySelectorAll(".chip")).forEach((item) => {
      item.classList.toggle("active", item === chip);
    });

    queueRender();
  });

  if (elements.brandEventTitle) {
    elements.brandEventTitle.addEventListener("input", (event) => {
      appState.branding.eventTitle = normalizeTextValue(event.target.value, 40);
      appState.autoSavedCurrentResult = false;
      queueRender();
    });
  }

  if (elements.brandTagline) {
    elements.brandTagline.addEventListener("input", (event) => {
      appState.branding.tagline = normalizeTextValue(event.target.value, 48);
      appState.autoSavedCurrentResult = false;
      queueRender();
    });
  }

  if (elements.showDateStamp) {
    elements.showDateStamp.addEventListener("change", (event) => {
      appState.branding.showDate = Boolean(event.target.checked);
      appState.autoSavedCurrentResult = false;
      queueRender();
    });
  }
}

function bindCaptureControls() {
  elements.countdownOptions.addEventListener("click", (event) => {
    const button = event.target.closest(".segment");
    if (!button) {
      return;
    }

    appState.countdownSeconds = Number(button.dataset.seconds);

    Array.from(elements.countdownOptions.querySelectorAll(".segment")).forEach((segment) => {
      segment.classList.toggle("active", segment === button);
    });
  });

  elements.layoutOptions.addEventListener("change", (event) => {
    const target = event.target;
    if (target && target.name === "layout") {
      applyLayoutSelection(target.value, { syncCamera: false });
    }
  });

  if (elements.cameraFacingMode) {
    elements.cameraFacingMode.addEventListener("change", async (event) => {
      const selectedMode = event.target.value === "environment" ? "environment" : "user";
      appState.camera.facingMode = selectedMode;
      cameraService.facingMode = selectedMode;

      if (!cameraService.isReady()) {
        return;
      }

      try {
        await cameraService.setFacingMode(selectedMode);
        applyCameraPreviewFilter();
        setShotStatus(selectedMode === "environment" ? "Rear camera active" : "Front camera active");
      } catch (error) {
        appState.camera.facingMode = "user";
        cameraService.facingMode = "user";
        syncCameraControls();
        setShotStatus(error.message || "Could not switch camera", true);
      }
    });
  }

  if (elements.mirrorPreviewToggle) {
    elements.mirrorPreviewToggle.addEventListener("change", (event) => {
      const shouldMirror = Boolean(event.target.checked);
      appState.camera.mirror = shouldMirror;
      cameraService.setMirror(shouldMirror);
      setShotStatus(shouldMirror ? "Mirror mode enabled" : "Mirror mode disabled");
    });
  }

  if (elements.livePhotoToggle) {
    elements.livePhotoToggle.addEventListener("change", (event) => {
      if (!isLivePhotoFeatureSupported()) {
        appState.livePhoto.enabled = false;
        syncLivePhotoControls();
        return;
      }

      appState.livePhoto.enabled = Boolean(event.target.checked);
      syncLivePhotoControls();
    });
  }
}

function bindLandingExperience() {
  if (elements.landingLayoutOptions) {
    elements.landingLayoutOptions.addEventListener("click", (event) => {
      const card = event.target.closest(".package-card");
      if (!card) {
        return;
      }

      applyLayoutSelection(card.dataset.layout);
    });
  }

  if (elements.carouselPrevBtn) {
    elements.carouselPrevBtn.addEventListener("click", () => {
      stepCarousel(-1);
      startCarouselAuto();
    });
  }

  if (elements.carouselNextBtn) {
    elements.carouselNextBtn.addEventListener("click", () => {
      stepCarousel(1);
      startCarouselAuto();
    });
  }

  if (elements.carouselDots) {
    elements.carouselDots.addEventListener("click", (event) => {
      const dot = event.target.closest(".carousel-dot");
      if (!dot) {
        return;
      }

      setCarouselIndex(Number(dot.dataset.index));
      startCarouselAuto();
    });
  }

  if (elements.sampleCarousel) {
    elements.sampleCarousel.addEventListener("mouseenter", () => {
      stopCarouselAuto();
    });

    elements.sampleCarousel.addEventListener("mouseleave", () => {
      if (appState.currentStep === "landing") {
        startCarouselAuto();
      }
    });
  }
}

function bindMainActions() {
  if (elements.startBoothBtn) {
    elements.startBoothBtn.addEventListener("click", () => {
      beginNewSession();
    });
  }

  if (elements.continueWithSelectionBtn) {
    elements.continueWithSelectionBtn.addEventListener("click", () => {
      beginNewSession();
    });
  }

  if (elements.backToLandingBtn) {
    elements.backToLandingBtn.addEventListener("click", () => {
      cameraService.stop();

      if (hasLandingScreen) {
        setScreen("landing");
        setShotStatus("Ready to capture");
        return;
      }

      window.location.href = "index.html";
    });
  }

  elements.captureBtn.addEventListener("click", () => {
    runCaptureFlow();
  });

  elements.retakeBtn.addEventListener("click", () => {
    closeModal();
    revokeLivePhotoUrl();
    resetCaptureSession();
    syncLivePhotoControls();
    renderLivePhotoPreview();
    selectedModalPhotoIndex = 0;
    refreshCapturedThumbPreviews();
    setShotStatus("Retake enabled");
  });

  elements.proceedToEditBtn.addEventListener("click", () => {
    openEditStep();
  });

  elements.retakeFromEditBtn.addEventListener("click", () => {
    beginNewSession();
  });

  elements.toDownloadBtn.addEventListener("click", () => {
    openDownloadStep();
  });

  elements.downloadPngBtn.addEventListener("click", () => {
    downloadCurrent("png");
  });

  elements.downloadJpgBtn.addEventListener("click", () => {
    downloadCurrent("jpg");
  });

  if (elements.downloadLiveBtn) {
    elements.downloadLiveBtn.addEventListener("click", () => {
      downloadLivePhotoClip();
    });
  }

  elements.printBtn.addEventListener("click", () => {
    printCurrentStrip();
  });

  if (elements.shareStripBtn) {
    elements.shareStripBtn.addEventListener("click", () => {
      shareCurrentStrip();
    });
  }

  if (elements.saveLeadBtn) {
    elements.saveLeadBtn.addEventListener("click", () => {
      saveLeadFromForm();
    });
  }

  if (elements.exportLeadsCsvBtn) {
    elements.exportLeadsCsvBtn.addEventListener("click", () => {
      exportLeadsCsv();
    });
  }

  elements.saveGalleryBtn.addEventListener("click", () => {
    if (!appState.finalCanvas) {
      return;
    }

    const previewData = appState.finalCanvas.toDataURL("image/jpeg", 0.9);
    saveGalleryItem(previewData, appState.layout);
    renderGallery();
  });

  elements.newSessionBtn.addEventListener("click", () => {
    beginNewSession();
  });

  elements.clearGalleryBtn.addEventListener("click", () => {
    clearGallery();
    renderGallery();
  });

  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) {
      closeModal();
    }
  });
}

function initialize() {
  let resizeRenderTimer = 0;

  const handleViewportOrientationChange = () => {
    const previous = appState.deviceOrientation;
    updateDeviceOrientation();

    window.clearTimeout(resizeRenderTimer);
    resizeRenderTimer = window.setTimeout(() => {
      redrawActivePreviewCanvas();
    }, 80);

    if (previous !== appState.deviceOrientation) {
      refreshCapturedThumbPreviews();
      queueRender();
    }
  };

  updateDeviceOrientation();
  window.addEventListener("resize", handleViewportOrientationChange, { passive: true });
  window.addEventListener("orientationchange", handleViewportOrientationChange);

  bindLandingExperience();
  bindCaptureControls();
  bindFilterControls();
  bindMainActions();
  if (hasLandingScreen) {
    setCarouselIndex(0);
  }
  applyLayoutSelection(appState.layout);
  resetEditorUi();
  syncLivePhotoControls();
  renderLivePhotoPreview();
  refreshAnalyticsDashboard();
  setHintStatus(elements.shareStatus, "Use native sharing on supported devices and browsers.");
  setHintStatus(elements.leadStatus, "Leads and analytics are stored locally on this device.");
  renderGallery();
  if (hasLandingScreen) {
    setScreen("landing");
  } else if (elements.screens.camera) {
    setScreen("camera");
    ensureCamera();
  } else if (screenIds.length > 0) {
    setScreen(screenIds[0]);
  }
  setShotStatus("Ready to capture");
}

window.addEventListener("beforeunload", () => {
  revokeLivePhotoUrl();
  cameraService.stop();
  stopCarouselAuto();
});

initialize();
