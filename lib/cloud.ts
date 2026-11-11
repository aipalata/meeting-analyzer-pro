export function googleDriveId(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Укажите корректную ссылку Google Drive.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password || url.port) throw new Error('Поддерживаются только ссылки на файлы Google Drive.');
  const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1] ?? (url.pathname === '/open' || url.pathname === '/uc' ? url.searchParams.get('id') : null);
  if (!id || !/^[\w-]{10,200}$/.test(id)) throw new Error('Не удалось определить файл. Скопируйте ссылку на файл Google Drive.');
  return id;
}
export function videoExtension(bytes: Uint8Array): 'mp4' | 'webm' | null {
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') return 'mp4';
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
  return null;
}
