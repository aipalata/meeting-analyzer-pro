import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { googleDriveId, videoExtension } from '../../../lib/cloud';
import { MAX_BYTES } from '../../../lib/types';
export const runtime = 'nodejs';
export const maxDuration = 300;
const fallback = 'Проверьте, что доступ по ссылке открыт для всех и файл можно скачать. Если скачать не удаётся, загрузите видео с компьютера.';
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = googleDriveId(typeof body.url === 'string' ? body.url : '');
    if (typeof body.meetingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.meetingId)) return NextResponse.json({error:'Неверный идентификатор записи.'},{status:400});
    // Only the fixed Google download origin is contacted. Arbitrary URLs and redirects are never followed.
    const response = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`, {redirect:'error', signal:AbortSignal.timeout(120000)});
    if (!response.ok || !response.body) throw new Error(fallback);
    const length = Number(response.headers.get('content-length'));
    if (length > MAX_BYTES) throw new Error('Файл превышает 200 МБ.');
    const reader = response.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
    try { while (true) { const {done,value} = await reader.read(); if(done) break; size += value.length; if(size > MAX_BYTES) { await reader.cancel(); throw new Error('Файл превышает 200 МБ.'); } parts.push(value); } } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(parts); const ext = videoExtension(bytes);
    if (!ext) throw new Error('По ссылке не найдено видео MP4 или WebM. ' + fallback);
    const disposition = response.headers.get('content-disposition') || '';
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    let name = disposition.match(/filename="([^"\r\n]+)"/i)?.[1] || `Запись Google Drive.${ext}`;
    if (encoded) { try { name = decodeURIComponent(encoded); } catch { /* use fallback */ } }
    name = name.replace(/[\\/\x00-\x1f]/g, '_').slice(0,200);
    const path = `uploads/${body.meetingId}.${ext}`;
    await put(path, bytes, {access:'private', contentType:`video/${ext}`, addRandomSuffix:false, ttlDays:1});
    return NextResponse.json({path,name});
  } catch (error) {
    const message = error instanceof Error && /^(Укажите|Поддерживаются|Не удалось определить|Файл превышает|По ссылке|Проверьте)/.test(error.message) ? error.message : `Не удалось получить файл. ${fallback}`;
    return NextResponse.json({error:message},{status:400});
  }
}
