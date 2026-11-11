import {NextResponse} from 'next/server';
import {loadConfig,saveConfig,sessionId,sameOrigin} from '../../../../lib/proplus';
export const runtime='nodejs';
export async function POST(request:Request){
  if(!sameOrigin(request)) return NextResponse.json({error:'Неверный источник запроса.'},{status:403});
  const id=await sessionId(); if(!id) return NextResponse.json({error:'Сначала подключите Яндекс Диск.'},{status:401});
  try {const {folder,apiKey}=await request.json();
    if(typeof folder!=='string'||!folder.trim()||folder.length>1024||typeof apiKey!=='string'||!/^sk-[A-Za-z0-9_-]{10,250}$/.test(apiKey.trim())) return NextResponse.json({error:'Укажите путь к папке и корректный ключ OpenAI.'},{status:400});
    const saved=await loadConfig(id);if(!saved) return NextResponse.json({error:'Подключите Диск повторно.'},{status:401});
    if((saved.value.leaseUntil||0)>Date.now()) return NextResponse.json({error:'Идёт проверка. Попробуйте через несколько минут.'},{status:409});
    saved.value.folder=folder.trim();saved.value.openaiKey=apiKey.trim();await saveConfig(id,saved.value,saved.etag);return NextResponse.json({ok:true});
  } catch{return NextResponse.json({error:'Не удалось сохранить настройки. Попробуйте снова.'},{status:500});}
}
