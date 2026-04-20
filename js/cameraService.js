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
    this.liveCaptureCanvas = null;
    this.liveCaptureContext = null;
    this.liveCaptureRafId = 0;
    this.liveCanvasStream = null;
    this.liveVideoElementStream = null;
    this.liveLastErrorMessage = "";
  }

  resolveLivePhotoMimeType() {
    if (typeof MediaRecorder === "undefined") {
      return "";
    }

    const preferredMimeTypes = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1",
      "video/mp4",
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

  getLivePhotoLastError() {
    return this.liveLastErrorMessage;
  }

  createLiveRecorder(sourceStream, mimeType) {
    if (!sourceStream || typeof MediaRecorder === "undefined") {
      return null;
    }

    if (mimeType) {
      try {
        return new MediaRecorder(sourceStream, { mimeType });
      } catch (error) {
        // Fall through and retry without explicit mimeType.
      }
    }

    try {
      return new MediaRecorder(sourceStream);
    } catch (error) {
      return null;
    }
  }

  releaseLiveCanvasResources() {
    if (this.liveCaptureRafId) {
      cancelAnimationFrame(this.liveCaptureRafId);
      this.liveCaptureRafId = 0;
    }

    if (this.liveCanvasStream) {
      this.liveCanvasStream.getTracks().forEach((track) => track.stop());
      this.liveCanvasStream = null;
    }

    if (this.liveVideoElementStream) {
      this.liveVideoElementStream.getTracks().forEach((track) => track.stop());
      this.liveVideoElementStream = null;
    }

    this.liveCaptureContext = null;
    this.liveCaptureCanvas = null;
  }

  createVideoElementStream() {
    if (!this.videoElement) {
      return null;
    }

    const captureFromVideo = this.videoElement.captureStream || this.videoElement.mozCaptureStream;
    if (typeof captureFromVideo !== "function") {
      return null;
    }

    try {
      this.liveVideoElementStream = captureFromVideo.call(this.videoElement);
      return this.liveVideoElementStream;
    } catch (error) {
      this.liveVideoElementStream = null;
      return null;
    }
  }

  createLiveCanvasStream() {
    const sourceWidth = this.videoElement?.videoWidth || 1280;
    const sourceHeight = this.videoElement?.videoHeight || 720;
    const width = Math.max(1, Number(sourceWidth) || 1280);
    const height = Math.max(1, Number(sourceHeight) || 720);

    this.liveCaptureCanvas = document.createElement("canvas");
    this.liveCaptureCanvas.width = width;
    this.liveCaptureCanvas.height = height;
    this.liveCaptureContext = this.liveCaptureCanvas.getContext("2d", { alpha: false });

    if (!this.liveCaptureContext) {
      this.releaseLiveCanvasResources();
      return null;
    }

    const drawFrame = () => {
      if (!this.liveCaptureContext || !this.videoElement) {
        return;
      }

      this.liveCaptureContext.fillStyle = "#0f172a";
      this.liveCaptureContext.fillRect(0, 0, width, height);

      if (this.mirrorCapture) {
        this.liveCaptureContext.save();
        this.liveCaptureContext.translate(width, 0);
        this.liveCaptureContext.scale(-1, 1);
        this.liveCaptureContext.drawImage(this.videoElement, 0, 0, width, height);
        this.liveCaptureContext.restore();
      } else {
        this.liveCaptureContext.drawImage(this.videoElement, 0, 0, width, height);
      }

      this.liveCaptureRafId = requestAnimationFrame(drawFrame);
    };

    if (typeof this.liveCaptureCanvas.captureStream !== "function") {
      this.releaseLiveCanvasResources();
      return null;
    }

    drawFrame();

    try {
      this.liveCanvasStream = this.liveCaptureCanvas.captureStream(24);
    } catch (error) {
      this.releaseLiveCanvasResources();
      return null;
    }

    return this.liveCanvasStream;
  }

  async startLivePhotoRecording() {
    this.liveLastErrorMessage = "";

    if (!this.canRecordLivePhoto()) {
      this.liveLastErrorMessage = "Live Photo recording is not supported on this browser.";
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

    this.liveRecorder = this.createLiveRecorder(this.stream, resolvedMimeType);

    if (!this.liveRecorder) {
      const videoElementStream = this.createVideoElementStream();
      this.liveRecorder = this.createLiveRecorder(videoElementStream, resolvedMimeType);
    }

    if (!this.liveRecorder) {
      const fallbackCanvasStream = this.createLiveCanvasStream();
      this.liveRecorder = this.createLiveRecorder(fallbackCanvasStream, resolvedMimeType);
    }

    if (!this.liveRecorder) {
      this.liveMimeType = "";
      this.liveLastErrorMessage = "This browser could not initialize Live Photo recording.";
      this.releaseLiveCanvasResources();
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
      this.liveMimeType = "";
      this.liveLastErrorMessage = "Live Photo recording failed during capture.";
      this.releaseLiveCanvasResources();

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

      if (blob && blob.size > 0) {
        this.liveLastErrorMessage = "";
      } else {
        this.liveLastErrorMessage = "Live Photo recording finished without clip data.";
      }

      this.liveChunks = [];
      this.liveRecorder = null;
      this.liveMimeType = "";
      this.releaseLiveCanvasResources();

      if (resolver) {
        resolver(blob);
      }
    };

    try {
      this.liveRecorder.start(250);
    } catch (error) {
      this.liveLastErrorMessage = "Live Photo recorder could not start.";
      this.liveRecorder = null;
      this.liveMimeType = "";
      this.releaseLiveCanvasResources();

      if (this.liveStopResolver) {
        const resolver = this.liveStopResolver;
        this.liveStopResolver = null;
        resolver(null);
      }

      this.liveStopPromise = null;
      return false;
    }

    return true;
  }

  async stopLivePhotoRecording() {
    if (!this.liveRecorder) {
      this.releaseLiveCanvasResources();
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
      this.liveLastErrorMessage = "Live Photo recording stopped unexpectedly.";
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

    this.releaseLiveCanvasResources();

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
