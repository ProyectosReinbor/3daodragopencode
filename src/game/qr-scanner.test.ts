import { afterEach, describe, expect, it, vi } from 'vitest';
import { QrScanner } from './qr-scanner';

afterEach(() => vi.unstubAllGlobals());

describe('QR camera lifecycle', () => {
  it('stops a camera acquired after the user has left the scanner', async () => {
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        detect() {
          return Promise.resolve([]);
        }
      }
    );
    let resolveStream!: (stream: MediaStream) => void;
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: () =>
          new Promise<MediaStream>((resolve) => {
            resolveStream = resolve;
          }),
      },
    });
    const stop = vi.fn();
    const video = document.createElement('video');
    const scanner = new QrScanner(video, document.createElement('p'), vi.fn());
    const opening = scanner.start();
    scanner.stop();
    resolveStream({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await opening;
    expect(stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });

  it('ignores a QR detection that completes after the camera is closed', async () => {
    let resolveDetection!: (codes: { rawValue: string }[]) => void;
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        detect() {
          return new Promise<{ rawValue: string }[]>((resolve) => {
            resolveDetection = resolve;
          });
        }
      }
    );
    const stop = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) },
    });
    const video = document.createElement('video');
    video.play = vi.fn().mockResolvedValue(undefined);
    const callback = vi.fn();
    const scanner = new QrScanner(video, document.createElement('p'), callback);
    await scanner.start();
    scanner.stop();
    resolveDetection([{ rawValue: 'FP-TEST' }]);
    await Promise.resolve();
    expect(callback).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('offers manual entry when native QR detection is unavailable', async () => {
    vi.stubGlobal('BarcodeDetector', undefined);
    const status = document.createElement('p');
    const scanner = new QrScanner(document.createElement('video'), status, vi.fn());
    await scanner.start();
    expect(status.textContent).toContain('Escribe el código');
  });
});
