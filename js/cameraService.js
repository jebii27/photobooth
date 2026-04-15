export class CameraService {
  constructor(videoElement, options = {}) {
    this.videoElement = videoElement;
    this.stream = null;
    this.facingMode = options.facingMode ?? "user";
    this.mirrorPreview = options.mirrorPreview ?? true;
    this.mirrorCapture = options.mirrorCapture ?? true;
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("This browser does not support webcam access.");
    }

    if (this.stream) {
      return;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    this.videoElement.srcObject = this.stream;
    await this.videoElement.play();

    this.videoElement.classList.toggle("mirrored-video", this.mirrorPreview);
  }

  async restart() {
    this.stop();
    await this.start();
  }

  async setFacingMode(mode) {
    const normalized = mode === "environment" ? "environment" : "user";
    if (normalized === this.facingMode) {
      return;
    }

    this.facingMode = normalized;
    await this.restart();
  }

  setMirror(enabled) {
    const value = Boolean(enabled);
    this.mirrorPreview = value;
    this.mirrorCapture = value;
    this.videoElement.classList.toggle("mirrored-video", this.mirrorPreview);
  }

  stop() {
    if (!this.stream) {
      return;
    }

    this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.videoElement.srcObject = null;
  }

  isReady() {
    return Boolean(this.stream) && this.videoElement.readyState >= 2;
  }

  captureFrame(targetWidth = 1280, targetHeight = 960) {
    if (!this.isReady()) {
      throw new Error("Camera is not ready yet.");
    }

    const sourceWidth = this.videoElement.videoWidth;
    const sourceHeight = this.videoElement.videoHeight;
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = targetWidth / targetHeight;

    let drawWidth = targetWidth;
    let drawHeight = targetHeight;
    let drawX = 0;
    let drawY = 0;

    if (sourceRatio > targetRatio) {
      drawHeight = targetWidth / sourceRatio;
      drawY = (targetHeight - drawHeight) / 2;
    } else {
      drawWidth = targetHeight * sourceRatio;
      drawX = (targetWidth - drawWidth) / 2;
    }

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = targetWidth;
    frameCanvas.height = targetHeight;

    const context = frameCanvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#f6f7f9";
    context.fillRect(0, 0, targetWidth, targetHeight);

    if (this.mirrorCapture) {
      context.save();
      context.translate(targetWidth, 0);
      context.scale(-1, 1);
      context.drawImage(
        this.videoElement,
        0,
        0,
        sourceWidth,
        sourceHeight,
        targetWidth - drawX - drawWidth,
        drawY,
        drawWidth,
        drawHeight
      );
      context.restore();
    } else {
      context.drawImage(
        this.videoElement,
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

    return frameCanvas;
  }
}
