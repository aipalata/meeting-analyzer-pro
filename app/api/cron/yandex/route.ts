import {list} from '@vercel/blob';
import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {scanAccount} from '../../../../lib/proplus-worker';
export const runtime='nodejs';export const maxDuration=300;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;const actual=request.headers.get('authorization')||'';const expected=`Bearer ${secret}`;
  if(!secret || Buffer.byteLength(actual)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual),Buffer.from(expected))) return NextResponse.json({error:'Нет доступа.'},{status:401});
  const page=await list({prefix:'proplus/',limit:100});
  for(const item of page.blobs){const id=item.pathname.match(/^proplus\/([a-f0-9]{64})\.json$/)?.[1];if(id) await scanAccount(id);}
  return NextResponse.json({ok:true});
}
