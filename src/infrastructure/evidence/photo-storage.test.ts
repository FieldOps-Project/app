import { File } from 'expo-file-system';
import { ImageManipulator } from 'expo-image-manipulator';

import { PHOTO_MAX_BYTES } from '@/domain/evidence';
import { deleteFile, storePhoto } from '@/infrastructure/evidence/photo-storage';

/**
 * A minimal in-memory file system: each `File` knows its uri and size, `move`
 * renames it, and `delete` drops it. Enough to check where the photo ends up
 * and that nothing is left behind.
 */
const mockFiles = new Map<string, number>();

jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    create = jest.fn();
  }
  class MockFile {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri) ?? null;
    }
    move(destination: { uri: string }) {
      const size = mockFiles.get(this.uri) ?? 0;
      mockFiles.delete(this.uri);
      mockFiles.set(destination.uri, size);
      this.uri = destination.uri;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { document: { uri: 'file:///documents' } },
  };
});

const mockResize = jest.fn();
let mockRenderedSizes: number[] = [];
let mockRendered = 0;

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: mockResize,
      release: jest.fn(),
      renderAsync: jest.fn(async () => ({
        release: jest.fn(),
        saveAsync: jest.fn(async () => {
          const uri = `file:///cache/manipulated-${mockRendered}.jpg`;
          mockFiles.set(uri, mockRenderedSizes[mockRendered] ?? 1000);
          mockRendered += 1;
          return { uri, width: 0, height: 0 };
        }),
      })),
    })),
  },
}));

const CAMERA_FILE = 'file:///cache/camera/photo.jpg';
const PHOTO = { uri: CAMERA_FILE, width: 4032, height: 3024 };
const TARGET = { inspectionId: 'insp-1', evidenceId: 'ev-1' };

beforeEach(() => {
  jest.clearAllMocks();
  mockFiles.clear();
  mockFiles.set(CAMERA_FILE, 6_000_000);
  mockRenderedSizes = [380_000, 18_000];
  mockRendered = 0;
});

describe('storePhoto', () => {
  it('resizes, compresses and keeps the photo and its thumbnail in the persistent directory', async () => {
    const result = await storePhoto(PHOTO, TARGET);

    expect(result).toEqual({
      ok: true,
      value: {
        photoUri: 'file:///documents/evidences/insp-1/ev-1.jpg',
        thumbnailUri: 'file:///documents/evidences/insp-1/ev-1-thumb.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 380_000,
      },
    });
    expect(mockResize).toHaveBeenNthCalledWith(1, { width: 1600 });
    expect(mockResize).toHaveBeenNthCalledWith(2, { width: 320 });
    expect(ImageManipulator.manipulate).toHaveBeenCalledTimes(2);
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith(CAMERA_FILE);
    expect([...mockFiles.keys()].some((uri) => uri.startsWith('file:///cache/manipulated'))).toBe(
      false
    );
  });

  it('leaves the camera file for another try', async () => {
    await storePhoto(PHOTO, TARGET);

    expect(mockFiles.has(CAMERA_FILE)).toBe(true);
  });

  it('never enlarges a small photo', async () => {
    await storePhoto({ uri: CAMERA_FILE, width: 1024, height: 768 }, TARGET);

    expect(mockResize).toHaveBeenCalledTimes(1);
    expect(mockResize).toHaveBeenCalledWith({ width: 320 });
  });

  it('refuses a file above the limit and removes what it produced', async () => {
    mockRenderedSizes = [PHOTO_MAX_BYTES + 1, 18_000];

    const result = await storePhoto(PHOTO, TARGET);

    expect(result).toEqual({ ok: false, error: { kind: 'rejected', reason: 'TOO_LARGE' } });
    expect([...mockFiles.keys()]).toEqual([CAMERA_FILE]);
  });

  it('reports a storage failure and leaves nothing half written', async () => {
    jest.mocked(ImageManipulator.manipulate).mockImplementationOnce(() => {
      throw new Error('no space');
    });

    const result = await storePhoto(PHOTO, TARGET);

    expect(result).toEqual({ ok: false, error: { kind: 'storage' } });
    expect([...mockFiles.keys()]).toEqual([CAMERA_FILE]);
  });
});

describe('deleteFile', () => {
  it('removes a file and ignores one already gone', () => {
    deleteFile(CAMERA_FILE);
    deleteFile(CAMERA_FILE);
    deleteFile(null);

    expect(new File(CAMERA_FILE).exists).toBe(false);
  });
});
