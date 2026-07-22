type BarcodeResult = { rawValue: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<BarcodeResult[]> };
type BarcodeDetectorFactory = new (options: { formats: string[] }) => BarcodeDetectorLike;

/** Lightweight QR reader using the native Barcode Detection API when available. */
export class QrScanner {
  private stream?: MediaStream;
  private active = false;
  private readonly detector?: BarcodeDetectorLike;

  constructor(private readonly video: HTMLVideoElement, private readonly status: HTMLElement, private readonly onCode: (code: string) => void) {
    const factory = (window as Window & { BarcodeDetector?: BarcodeDetectorFactory }).BarcodeDetector;
    if (factory) this.detector = new factory({ formats: ['qr_code'] });
  }

  async start() {
    if (!this.detector) { this.status.textContent = 'QR camera scan is not supported on this browser. Use the code field.'; return; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.active = true;
      this.status.textContent = 'Point the camera at the invoice QR code.';
      this.readFrame();
    } catch { this.status.textContent = 'Camera permission was not granted. Use the code field.'; }
  }

  stop() {
    this.active = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.video.srcObject = null;
  }

  private readFrame = async () => {
    if (!this.active || !this.detector) return;
    try {
      const codes = await this.detector.detect(this.video);
      if (codes[0]?.rawValue) { this.onCode(codes[0].rawValue); this.stop(); return; }
    } catch { /* A frame can be unreadable while the camera starts. */ }
    requestAnimationFrame(this.readFrame);
  };
}
