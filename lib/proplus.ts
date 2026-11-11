import { createHash, randomBytes } from 'node:crypto';
import { get, put, head, BlobServiceRateLimited } from '@vercel/blob';
import { cookies } from 'next/headers';
import { sealPrivateState,openPrivateState } from './private-state';
import type { Notes } from './types';

export type ProResult = {version:string; name:string; createdAt:string; status:'processing'|'done'|'error'; stage?:string; error?:string; notes?:Notes; transcript?:string};
export type ProConfig = {accessToken:string; refreshToken?:string; expiresAt:number; folder?:string; openaiKey?:string; lastChecked?:string; lastError?:string; leaseUntil?:number; results:ProResult[]};
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const randomToken=()=>randomBytes(32).toString('base64url');
export const configPath=(id:string)=>`proplus/${id}.json`;
export async function loadConfig(id:string):Promise<{value:ProConfig;etag:string}|null>{
  if(!/^[a-f0-9]{64}$/.test(id)) return null;
  for(let attempt=0;attempt<3;attempt++){
    const result=await get(configPath(id),{access:'private',useCache:false});
    if(!result || result.statusCode!==200 || !result.stream) return null;
    const text=await new Response(result.stream).text();
    const metadata=await head(configPath(id));
    // The download response can expose a weak ETag (W/...), while conditional
    // writes require the strong ETag returned by Blob's metadata API.
    if(result.blob.etag.replace(/^W\//,'')===metadata.etag){
      return {value:openPrivateState<ProConfig>(text),etag:metadata.etag};
    }
  }
  throw new Error('Данные изменились во время чтения. Повторите попытку.');
}
export async function saveConfig(id:string,value:ProConfig,etag?:string){
  const body=sealPrivateState(value);
  for(let attempt=0; ; attempt++){
    try { await put(configPath(id),body,{access:'private',contentType:'application/octet-stream',addRandomSuffix:false,...(etag?{ifMatch:etag}:{})}); return; }
    catch(error){ if(!(error instanceof BlobServiceRateLimited)||attempt>=5) throw error; await new Promise(resolve=>setTimeout(resolve,1200*(attempt+1))); }
  }
}
export async function sessionId(){
  const token=(await cookies()).get('proplus_session')?.value;
  return token && /^[\w-]{43}$/.test(token) ? tokenHash(token) : null;
}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !!origin && origin===new URL(request.url).origin;}
