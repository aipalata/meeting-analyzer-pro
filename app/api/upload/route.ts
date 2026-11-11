import { issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { MAX_BYTES } from '../../../lib/types';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadPresignedBody;
    const result = await handleUploadPresigned({body,request,getSignedToken: async (pathname) => {
      if (!/^uploads\/[0-9a-f-]{36}\.(mp4|webm)$/i.test(pathname)) throw new Error('Неверное имя файла.');
      const token = await issueSignedToken({pathname,operations:['put'],allowedContentTypes:['video/mp4','video/webm','application/octet-stream'],maximumSizeInBytes:MAX_BYTES,validUntil:Date.now()+15*60*1000});
      return {token,urlOptions:{ttlDays:1,addRandomSuffix:false}};
    }});
    return NextResponse.json(result);
  } catch { return NextResponse.json({error:'Не удалось подготовить загрузку. Проверьте настройки хранилища.'},{status:400}); }
}
