type BarcodeResult = { rawValue: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<BarcodeResult[]> };
type BarcodeDetectorFactory = new (options: { formats: string[] }) => BarcodeDetectorLike;

/** Lightweight QR reader using the native Barcode Detection API when available. */
export class QrScanner {
  private stream?: MediaStream;
  private active = false;
  private session = 0;
  private readonly detector?: BarcodeDetectorLike;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly status: HTMLElement,
    private readonly onCode: (code: string) => void
  ) {
    const factory = (window as Window & { BarcodeDetector?: BarcodeDetectorFactory })
      .BarcodeDetector;
    if (factory) this.detector = new factory({ formats: ['qr_code'] });
  }

  async start() {
    this.stop();
    const session = this.session;
    if (!this.detector) {
      this.status.textContent =
        'Este navegador no permite leer QR con la cámara. Escribe el código de tu factura.';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      if (session !== this.session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = this.stream;
      await this.video.play();
      if (session !== this.session) return;
      this.active = true;
      this.status.textContent = 'Apunta al código QR AODASE PETS de tu factura.';
      this.readFrame();
    } catch {
      if (session !== this.session) return;
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
      this.status.textContent =
        'No se pudo abrir la cámara. Puedes escribir el código de tu factura.';
    }
  }

  stop() {
    this.session++;
    this.active = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.video.srcObject = null;
  }

  private readFrame = async () => {
    if (!this.active || !this.detector) return;
    const session = this.session;
    try {
      const codes = await this.detector.detect(this.video);
      if (!this.active || session !== this.session) return;
      if (codes[0]?.rawValue) {
        this.onCode(codes[0].rawValue);
        this.stop();
        return;
      }
    } catch {
      /* A frame can be unreadable while the camera starts. */
    }
    if (session === this.session && this.active) requestAnimationFrame(this.readFrame);
  };
}
