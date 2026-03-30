import { afterEach } from 'vitest';

const asFileReaderEvent = (type: string): ProgressEvent<FileReader> =>
  new ProgressEvent(type) as ProgressEvent<FileReader>;

class MockFileReader implements FileReader {
  static readonly EMPTY = 0;
  static readonly LOADING = 1;
  static readonly DONE = 2;

  readonly EMPTY = 0;
  readonly LOADING = 1;
  readonly DONE = 2;

  error: DOMException | null = null;
  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  onloadstart: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  ontimeout: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  readyState: 0 | 1 | 2 = this.EMPTY;
  result: string | ArrayBuffer | null = null;

  abort(): void {
    this.readyState = this.DONE;
    this.onabort?.call(this, asFileReaderEvent('abort'));
    this.onloadend?.call(this, asFileReaderEvent('loadend'));
  }

  addEventListener(): void {}

  dispatchEvent(): boolean {
    return true;
  }

  readAsArrayBuffer(_blob: Blob): void {
    this.result = new ArrayBuffer(0);
    this.readyState = this.DONE;
    this.onload?.call(this, asFileReaderEvent('load'));
    this.onloadend?.call(this, asFileReaderEvent('loadend'));
  }

  readAsBinaryString(_blob: Blob): void {
    this.result = '';
    this.readyState = this.DONE;
    this.onload?.call(this, asFileReaderEvent('load'));
    this.onloadend?.call(this, asFileReaderEvent('loadend'));
  }

  readAsDataURL(blob: Blob): void {
    this.readyState = this.LOADING;
    this.onloadstart?.call(this, asFileReaderEvent('loadstart'));

    const mime = blob.type || 'application/octet-stream';
    this.result = `data:${mime};base64,MOCK_DATA_URI`;

    this.readyState = this.DONE;
    this.onload?.call(this, asFileReaderEvent('load'));
    this.onloadend?.call(this, asFileReaderEvent('loadend'));
  }

  readAsText(_blob: Blob): void {
    this.result = '';
    this.readyState = this.DONE;
    this.onload?.call(this, asFileReaderEvent('load'));
    this.onloadend?.call(this, asFileReaderEvent('loadend'));
  }

  removeEventListener(): void {}
}

Object.defineProperty(globalThis, 'FileReader', {
  configurable: true,
  writable: true,
  value: MockFileReader
});

const storageData = new Map<string, string>();

const memoryLocalStorage: Storage = {
  get length() {
    return storageData.size;
  },
  clear() {
    storageData.clear();
  },
  getItem(key: string) {
    return storageData.get(key) ?? null;
  },
  key(index: number) {
    const keys = Array.from(storageData.keys());
    return keys[index] ?? null;
  },
  removeItem(key: string) {
    storageData.delete(key);
  },
  setItem(key: string, value: string) {
    storageData.set(String(key), String(value));
  }
};

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: memoryLocalStorage
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: memoryLocalStorage
  });
}

afterEach(() => {
  const storage = typeof window !== 'undefined' ? window.localStorage : null;
  if (storage && typeof storage.clear === 'function') {
    storage.clear();
  }
});
