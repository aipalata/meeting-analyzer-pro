import { NextResponse } from 'next/server';
import {randomToken} from '../../../../lib/proplus';
export const runtime='nodejs';
export async function GET(request:Request){
  const id=process.env.YANDEX_CLIENT_ID; const appUrl=process.env.PRO_PLUS_ORIGIN;
  if(!id || !appUrl || !process.env.YANDEX_CLIENT_SECRET || !process.env.PRO_PLUS_ENCRYPTION_KEY) return NextResponse.json({error:'Подключение Яндекс Диска ещё не настроено.'},{status:503});
  const state=randomToken(); const url=new URL('https://oauth.yandex.ru/authorize');
  url.searchParams.set('response_type','code');url.searchParams.set('client_id',id);url.searchParams.set('redirect_uri',`${appUrl}/api/yandex/callback`);url.searchParams.set('state',state);
  const response=NextResponse.redirect(url);response.cookies.set('yandex_oauth_state',state,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});return response;
}
