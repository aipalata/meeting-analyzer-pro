import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomToken,saveConfig,tokenHash } from '../../../../lib/proplus';
export const runtime='nodejs';
export async function GET(request:Request){
  const url=new URL(request.url);const state=url.searchParams.get('state');const expected=(await cookies()).get('yandex_oauth_state')?.value;
  const origin=process.env.PRO_PLUS_ORIGIN;
  if(!origin || !state || !expected || state!==expected || !url.searchParams.get('code')) return NextResponse.json({error:'Не удалось подтвердить авторизацию Яндекса. Попробуйте подключиться снова.'},{status:400});
  try {
    const params=new URLSearchParams({grant_type:'authorization_code',code:url.searchParams.get('code')!,client_id:process.env.YANDEX_CLIENT_ID!,client_secret:process.env.YANDEX_CLIENT_SECRET!,redirect_uri:`${origin}/api/yandex/callback`});
    const response=await fetch('https://oauth.yandex.ru/token',{method:'POST',body:params,redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error();
    const data=await response.json();if(typeof data.access_token!=='string'||typeof data.expires_in!=='number') throw new Error();
    const token=randomToken();await saveConfig(tokenHash(token),{accessToken:data.access_token,refreshToken:typeof data.refresh_token==='string'?data.refresh_token:undefined,expiresAt:Date.now()+data.expires_in*1000,results:[]});
    const result=NextResponse.redirect(`${origin}/?yandex=connected`);result.cookies.set('proplus_session',token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:365*24*60*60});result.cookies.delete('yandex_oauth_state');return result;
  } catch {return NextResponse.json({error:'Не удалось подключить Яндекс Диск. Попробуйте снова.'},{status:502});}
}
