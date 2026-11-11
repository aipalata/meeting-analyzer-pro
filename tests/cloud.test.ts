import { describe, expect, it } from 'vitest';
import { googleDriveId, videoExtension } from '../lib/cloud';
describe('Google Drive import', () => {
  it('normalizes supported share URLs to one file id', () => {
    expect(googleDriveId('https://drive.google.com/file/d/abcDEF_123456/view?usp=sharing')).toBe('abcDEF_123456');
    expect(googleDriveId('https://drive.google.com/open?id=abcDEF_123456')).toBe('abcDEF_123456');
  });
  it('rejects arbitrary hosts and folder links', () => {
    for (const value of ['http://drive.google.com/open?id=abcDEF_123456', 'https://drive.google.com.evil.test/open?id=abcDEF_123456', 'https://drive.google.com/drive/folders/abcDEF_123456', 'http://127.0.0.1/']) expect(() => googleDriveId(value)).toThrow();
  });
  it('checks actual video signatures instead of filenames', () => {
    expect(videoExtension(new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109]))).toBe('mp4');
    expect(videoExtension(new Uint8Array([0x1a,0x45,0xdf,0xa3]))).toBe('webm');
    expect(videoExtension(new TextEncoder().encode('<html>login</html>'))).toBeNull();
  });
});
