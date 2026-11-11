import {del} from '@vercel/blob';
import {NextResponse} from 'next/server';
import {configPath,loadConfig,sameOrigin,sessionId} from '../../../../lib/proplus';
export const runtime='nodejs';
export async function POST(request:Request){
  if(!sameOrigin(request)) return NextResponse.json({error:'Неверный источник запроса.'},{status:403});
  const id=await sessionId();if(!id) return NextResponse.json({error:'Диск не подключён.'},{status:401});
  const state=await loadConfig(id);if(state && (state.value.leaseUntil||0)>Date.now()) return NextResponse.json({error:'Сначала дождитесь завершения обработки.'},{status:409});
  if(state) await del(configPath(id),{ifMatch:state.etag});
  const response=NextResponse.json({ok:true});response.cookies.delete('proplus_session');return response;
}
