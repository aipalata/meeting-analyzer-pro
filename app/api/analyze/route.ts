import { del, get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { processVideo } from '../../../lib/process-video';
import { MAX_BYTES } from '../../../lib/types';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  let path = '';
  try {
    const body: unknown = await request.json();
    path = typeof body === 'object' && body !== null && 'path' in body && typeof body.path === 'string' ? body.path : '';
    if (!/^uploads\/[0-9a-f-]{36}\.(mp4|webm)$/i.test(path)) return NextResponse.json({error:'Неверный файл.'},{status:400});
    const apiKey = request.headers.get('x-openai-key')?.trim() ?? '';
    if (!/^sk-[A-Za-z0-9_-]{10,250}$/.test(apiKey)) return NextResponse.json({error:'Введите корректный API-ключ OpenAI.'},{status:400});
    const blob = await get(path,{access:'private'});
    if (!blob || blob.statusCode !== 200 || !blob.stream) throw new Error('Загруженный файл не найден. Загрузите его ещё раз.');
    if (blob.blob.size > MAX_BYTES) throw new Error('Файл превышает 200 МБ.');
    const data = await new Response(blob.stream).arrayBuffer();
    const file = new File([data],path,{type:blob.blob.contentType});
    if (request.headers.get('accept')?.includes('application/x-ndjson')) {
      const blobPath = path; path = '';
      const encoder = new TextEncoder();
      const stream = new ReadableStream({ async start(controller) {
        const send = (value: object) => controller.enqueue(encoder.encode(JSON.stringify(value) + '\n'));
        try {
          const result = await processVideo(file, apiKey, stage => send({stage}));
          send({result});
        } catch (error) {
          const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
          const message = status === 401 || status === 403 ? 'OpenAI не принял API-ключ.' : status === 429 ? 'OpenAI отклонил запрос: проверьте баланс и лимиты API.' : error instanceof Error && /^(Не удалось|Речь в записи)/.test(error.message) ? error.message : 'Обработка не удалась. Проверьте доступность AI и повторите загрузку.';
          send({error:message});
        } finally { try { await del(blobPath); } catch { console.error('Не удалось удалить временное видео'); } controller.close(); }
      }});
      return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store'}});
    }
    return NextResponse.json(await processVideo(file, apiKey));
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
    if (status === 401 || status === 403) return NextResponse.json({error:'OpenAI не принял API-ключ. Проверьте ключ и доступ к API.'},{status:400});
    if (status === 429) return NextResponse.json({error:'OpenAI отклонил запрос: проверьте баланс и лимиты API.'},{status:429});
    const message = error instanceof Error && /^(AI не настроен|Не удалось|Речь в записи|Загруженный файл|Файл превышает)/.test(error.message) ? error.message : 'Обработка не удалась. Проверьте доступность AI и повторите загрузку.';
    return NextResponse.json({error:message},{status:500});
  } finally { if (path && /^uploads\/[0-9a-f-]{36}\.(mp4|webm)$/i.test(path)) { try { await del(path); } catch { console.error('Не удалось удалить временное видео'); } } }
}
