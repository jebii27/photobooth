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
  getGalleryItems,
  removeGalleryItem,
  saveGalleryItem
} from "./storage.js";

const screenIds = ["landing", "camera", "edit", "download"];

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
  countdownOverlay: document.getElementById("countdownOverlay"),
  shotStatus: document.getElementById("shotStatus"),
  captureFlash: document.getElementById("captureFlash"),
  modal: document.getElementById("previewModal"),
  modalThumbGrid: document.getElementById("modalThumbGrid"),
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
  finalCanvas: document.getElementById("finalCanvas"),
  exportInfo: document.getElementById("exportInfo"),
  downloadPngBtn: document.getElementById("downloadPngBtn"),
  downloadJpgBtn: document.getElementById("downloadJpgBtn"),
  printBtn: document.getElementById("printBtn"),
  saveGalleryBtn: document.getElementById("saveGalleryBtn"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  galleryGrid: document.getElementById("galleryGrid"),
  clearGalleryBtn: document.getElementById("clearGalleryBtn"),
  thumbTemplate: document.getElementById("thumbItemTemplate")
};

const cameraService = new CameraService(elements.cameraFeed, {
  mirrorPreview: true,
  mirrorCapture: true
});

let isCapturing = false;
let renderTimer = 0;
let renderToken = 0;
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

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function setShotStatus(message, isError = false) {
  elements.shotStatus.textContent = message;
  elements.shotStatus.style.borderColor = isError
    ? "rgba(255, 92, 117, 0.8)"
    : "rgba(220, 233, 248, 0.28)";
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
  queueRender();
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

function renderPhotoThumbs(target) {
  target.innerHTML = "";

  appState.photos.forEach((photo, index) => {
    const node = elements.thumbTemplate.content.firstElementChild.cloneNode(true);
    const image = node.querySelector("img");
    image.src = photo.toDataURL("image/jpeg", 0.9);
    image.alt = `Captured shot ${index + 1}`;
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
    await cameraService.start();
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
}

function copyCanvas(source, target) {
  target.width = source.width;
  target.height = source.height;

  const context = target.getContext("2d", { alpha: false });
  context.clearRect(0, 0, target.width, target.height);
  context.drawImage(source, 0, 0);
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
      sticker: appState.overlay.sticker
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

function downloadCurrent(format) {
  if (!appState.finalCanvas) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (format === "png") {
    const dataUrl = appState.finalCanvas.toDataURL("image/png");
    downloadDataUrl(dataUrl, `lumina-strip-${stamp}.png`);
    return;
  }

  const dataUrl = appState.finalCanvas.toDataURL("image/jpeg", 0.94);
  downloadDataUrl(dataUrl, `lumina-strip-${stamp}.jpg`);
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
  resetCaptureSession();
  resetEditorDefaults();
  resetEditorUi();
  closeModal();
  renderPhotoThumbs(elements.capturedThumbs);
  renderPhotoThumbs(elements.modalThumbGrid);
  goToCamera();
}

async function openEditStep() {
  closeModal();
  setScreen("edit");
  cameraService.stop();
  renderPhotoThumbs(elements.capturedThumbs);
  await renderComposedStrip();
}

async function openDownloadStep() {
  setScreen("download");
  cameraService.stop();

  await renderComposedStrip();

  if (appState.finalCanvas) {
    copyCanvas(appState.finalCanvas, elements.finalCanvas);
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

  try {
    resetCaptureSession();

    const totalShots = getShotCount(appState.layout);

    for (let index = 1; index <= totalShots; index += 1) {
      await runCountdown(totalShots, index);
      flashCapture();

      const capturedFrame = cameraService.captureFrame(1280, 960);
      appState.photos.push(capturedFrame);

      setShotStatus(`Captured shot ${index}/${totalShots}`);
      await wait(380);
    }

    renderPhotoThumbs(elements.modalThumbGrid);
    openModal();
    setShotStatus("Capture complete. Review before editing.");
  } catch (error) {
    setShotStatus(error.message || "Failed during capture", true);
  } finally {
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
    queueRender();
  });

  elements.sepiaRange.addEventListener("input", (event) => {
    appState.filters.sepia = Number(event.target.value);
    syncFilterPresetControls();
    applyCameraPreviewFilter();
    queueRender();
  });

  elements.brightnessRange.addEventListener("input", (event) => {
    appState.filters.brightness = Number(event.target.value);
    syncFilterPresetControls();
    applyCameraPreviewFilter();
    queueRender();
  });

  elements.contrastRange.addEventListener("input", (event) => {
    appState.filters.contrast = Number(event.target.value);
    syncFilterPresetControls();
    applyCameraPreviewFilter();
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
  elements.startBoothBtn.addEventListener("click", () => {
    beginNewSession();
  });

  if (elements.continueWithSelectionBtn) {
    elements.continueWithSelectionBtn.addEventListener("click", () => {
      beginNewSession();
    });
  }

  elements.backToLandingBtn.addEventListener("click", () => {
    cameraService.stop();
    setScreen("landing");
    setShotStatus("Ready to capture");
  });

  elements.captureBtn.addEventListener("click", () => {
    runCaptureFlow();
  });

  elements.retakeBtn.addEventListener("click", () => {
    closeModal();
    resetCaptureSession();
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

  elements.printBtn.addEventListener("click", () => {
    printCurrentStrip();
  });

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
  bindLandingExperience();
  bindCaptureControls();
  bindFilterControls();
  bindMainActions();
  setCarouselIndex(0);
  applyLayoutSelection(appState.layout);
  resetEditorUi();
  renderGallery();
  setScreen("landing");
  setShotStatus("Ready to capture");
}

window.addEventListener("beforeunload", () => {
  cameraService.stop();
  stopCarouselAuto();
});

initialize();
