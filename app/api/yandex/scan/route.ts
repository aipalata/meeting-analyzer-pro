import {NextResponse} from 'next/server';
import {sessionId,sameOrigin} from '../../../../lib/proplus';
import {scanAccount} from '../../../../lib/proplus-worker';
export const runtime='nodejs';export const maxDuration=300;
export async function POST(request:Request){
  if(!sameOrigin(request)) return NextResponse.json({error:'Неверный источник запроса.'},{status:403});
  const id=await sessionId();if(!id) return NextResponse.json({error:'Сначала подключите Яндекс Диск.'},{status:401});
  try {await scanAccount(id);return NextResponse.json({ok:true});} catch {return NextResponse.json({error:'Не удалось запустить проверку. Попробуйте ещё раз.'},{status:503});}
}
