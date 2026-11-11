import {NextResponse} from 'next/server';
import {loadConfig,sessionId} from '../../../../lib/proplus';
export const runtime='nodejs';
export async function GET(){
  try {const id=await sessionId();if(!id) return NextResponse.json({connected:false});const saved=await loadConfig(id);if(!saved) return NextResponse.json({connected:false});
    const c=saved.value;return NextResponse.json({connected:true,configured:!!(c.folder&&c.openaiKey),folder:c.folder||'',lastChecked:c.lastChecked||null,lastError:c.lastError||null,scanning:(c.leaseUntil||0)>Date.now(),results:c.results},{headers:{'Cache-Control':'no-store'}});
  } catch{return NextResponse.json({error:'Не удалось получить состояние подключения.'},{status:503});}
}
