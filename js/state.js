export const appState = {
  currentStep: "landing",
  countdownSeconds: 3,
  layout: "strip4",
  photos: [],
  filters: {
    grayscale: 0,
    sepia: 0,
    brightness: 100,
    contrast: 100
  },
  overlay: {
    frame: "none",
    sticker: "none"
  },
  finalCanvas: null,
  autoSavedCurrentResult: false
};

export function getShotCount(layout) {
  return layout === "single" ? 1 : 4;
}

export function resetCaptureSession() {
  appState.photos = [];
  appState.finalCanvas = null;
  appState.autoSavedCurrentResult = false;
}

export function resetEditorDefaults() {
  appState.filters.grayscale = 0;
  appState.filters.sepia = 0;
  appState.filters.brightness = 100;
  appState.filters.contrast = 100;
  appState.overlay.frame = "none";
  appState.overlay.sticker = "none";
}
