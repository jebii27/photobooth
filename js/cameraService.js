export class CameraService {
  constructor(videoElement, options = {}) {
    this.videoElement = videoElement;
    this.stream = null;
    this.facingMode = options.facingMode ?? "user";
    this.mirrorPreview = options.mirrorPreview ?? true;
    this.mirrorCapture = options.mirrorCapture ?? true;
    this.liveRecorder = null;
    this.liveChunks = [];
    this.liveStopPromise = null;
    this.liveStopResolver = null;
    this.liveMimeType = "";
  }

  resolveLivePhotoMimeType() {
    if (typeof MediaRecorder === "undefined") {
      return "";
    }

    const preferredMimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];

    return preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
  }

  canRecordLivePhoto() {
    return Boolean(this.stream) && typeof MediaRecorder !== "undefined";
  }

  async startLivePhotoRecording() {
    if (!this.canRecordLivePhoto()) {
      return false;
    }

    if (this.liveRecorder && this.liveRecorder.state === "recording") {
      return true;
    }

    if (this.liveRecorder && this.liveRecorder.state !== "inactive") {
      await this.stopLivePhotoRecording();
    }

    this.liveChunks = [];
    const resolvedMimeType = this.resolveLivePhotoMimeType();

    try {
      this.liveRecorder = resolvedMimeType
        ? new MediaRecorder(this.stream, { mimeType: resolvedMimeType })
        : new MediaRecorder(this.stream);
    } catch (error) {
      this.liveRecorder = null;
      this.liveMimeType = "";
      return false;
    }

    this.liveMimeType = this.liveRecorder.mimeType || resolvedMimeType || "video/webm";

    this.liveStopPromise = new Promise((resolve) => {
      this.liveStopResolver = resolve;
    });

    this.liveRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.liveChunks.push(event.data);
      }
    };

    this.liveRecorder.onerror = () => {
      const resolver = this.liveStopResolver;
      this.liveStopResolver = null;
      this.liveChunks = [];
      this.liveRecorder = null;

      if (resolver) {
        resolver(null);
      }
    };

    this.liveRecorder.onstop = () => {
      const resolver = this.liveStopResolver;
      this.liveStopResolver = null;

      const blob = this.liveChunks.length
        ? new Blob(this.liveChunks, { type: this.liveMimeType || "video/webm" })
        : null;

      this.liveChunks = [];
      this.liveRecorder = null;

      if (resolver) {
        resolver(blob);
      }
    };

    this.liveRecorder.start(250);
    return true;
  }

  async stopLivePhotoRecording() {
    if (!this.liveRecorder) {
      return null;
    }

    if (this.liveRecorder.state !== "inactive") {
      this.liveRecorder.stop();
    }

    const pendingStopPromise = this.liveStopPromise;
    this.liveStopPromise = null;

    if (!pendingStopPromise) {
      return null;
    }

    try {
      return await pendingStopPromise;
    } catch (error) {
      return null;
    }
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
    if (this.liveRecorder && this.liveRecorder.state !== "inactive") {
      this.liveRecorder.stop();
    }

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
