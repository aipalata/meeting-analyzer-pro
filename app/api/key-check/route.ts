import OpenAI from 'openai';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const key = request.headers.get('x-openai-key')?.trim() ?? '';
  if (!/^sk-[A-Za-z0-9_-]{10,250}$/.test(key)) return NextResponse.json({error:'Проверьте формат ключа: он должен начинаться с sk-.'},{status:400});
  try {
    const client = new OpenAI({apiKey:key,timeout:15000,maxRetries:0});
    await client.models.list();
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
    if (status === 401 || status === 403) return NextResponse.json({error:'OpenAI не принял ключ или доступ к проверке ограничен. Проверьте ключ и права проекта.'},{status:400});
    if (status === 429) return NextResponse.json({error:'OpenAI отклонил запрос. Проверьте лимиты и баланс API.'},{status:429});
    return NextResponse.json({error:'Не удалось связаться с OpenAI. Попробуйте ещё раз.'},{status:502});
  }
}
