import { createHash } from 'node:crypto';
import { z } from 'zod';
import { MAX_BYTES } from './types';

const fileSchema = z.object({type:z.string(), name:z.string(), path:z.string(), size:z.number().nonnegative().optional(), modified:z.string(), sha256:z.string().optional(), md5:z.string().optional()});
const pageSchema = z.object({_embedded:z.object({items:z.array(fileSchema), total:z.number().nonnegative()})});
export type DiskFile = z.infer<typeof fileSchema>;
const API = 'https://cloud-api.yandex.net/v1/disk/resources';

/** Enumerates a single folder, not the whole disk. OAuth is only sent to Yandex's fixed API origin. */
export async function listDiskVideos(token:string, folder:string, fetcher:typeof fetch = fetch):Promise<DiskFile[]> {
  if (!token || /[\r\n]/.test(token)) throw new Error('Не указан токен Яндекс Диска.');
  if (!folder.trim() || folder.length > 1024) throw new Error('Укажите путь к папке на Яндекс Диске.');
  const files:DiskFile[]=[]; const limit=100;
  for(let offset=0; offset<10000; offset+=limit){
    const url = new URL(API); url.searchParams.set('path',folder); url.searchParams.set('limit',String(limit)); url.searchParams.set('offset',String(offset));
    const response=await fetcher(url,{headers:{Authorization:`OAuth ${token}`},redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(response.status===401 || response.status===403 ? 'Нет доступа к Яндекс Диску. Проверьте разрешения приложения.' : 'Не удалось прочитать папку на Яндекс Диске.');
    const page=pageSchema.parse(await response.json())._embedded;
    files.push(...page.items.filter(item=>item.type==='file' && /\.(mp4|webm)$/i.test(item.name) && !!item.size && item.size<=MAX_BYTES));
    if(offset+page.items.length>=page.total || !page.items.length) return files;
  }
  throw new Error('В папке слишком много файлов. Выберите папку меньшего размера.');
}

/** A changed version is a distinct job; do not process a file immediately after its last edit. */
export function diskVersion(file:DiskFile):string {
  return createHash('sha256').update(JSON.stringify([file.path,file.sha256 || file.md5 || null,file.size,file.modified])).digest('hex');
}
export function pendingDiskVideos(files:DiskFile[], completed:Set<string>, now=Date.now(), settleMs=120000):DiskFile[] {
  return files.filter(file=>{const modified=Date.parse(file.modified); return Number.isFinite(modified) && now-modified>=settleMs && !completed.has(diskVersion(file));});
}

export async function downloadDiskVideo(token:string,file:DiskFile,fetcher:typeof fetch=fetch):Promise<File>{
  const endpoint=new URL(`${API}/download`); endpoint.searchParams.set('path',file.path);
  let meta:Response;
  try {meta=await fetcher(endpoint,{headers:{Authorization:`OAuth ${token}`},redirect:'error',signal:AbortSignal.timeout(30000)});}
  catch(error){const cause=error instanceof Error && 'cause' in error ? error.cause : null;const code=typeof cause==='object'&&cause!==null&&'code' in cause&&typeof cause.code==='string'&&/^[A-Z0-9_]{1,40}$/.test(cause.code)?cause.code:'unknown';console.error('Ошибка запроса ссылки Яндекс Диска',error instanceof Error?error.name:'unknown',code);throw new Error('Не удалось получить ссылку на видео с Яндекс Диска.');}
  if(!meta.ok) throw new Error('Не удалось получить ссылку на видео с Яндекс Диска.');
  const body=await meta.json();let url:URL;
  try {url=new URL(body.href);} catch {throw new Error('Яндекс Диск вернул неверную ссылку на файл.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)(yandex\.ru|yandex\.net|yandexcloud\.net)$/.test(url.hostname)) throw new Error('Яндекс Диск вернул небезопасную ссылку на файл.');
  let response:Response;
  try {
    for(let redirects=0;;redirects++){
      response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(120000)});
      if(response.status<300||response.status>=400) break;
      const location=response.headers.get('location');
      if(!location || redirects>=3) throw new Error('Не удалось скачать видео с Яндекс Диска.');
      const next=new URL(location,url);
      if(next.protocol!=='https:'||next.username||next.password||next.port||!/(^|\.)(yandex\.ru|yandex\.net|yandexcloud\.net)$/.test(next.hostname)) throw new Error('Яндекс Диск вернул небезопасную ссылку на файл.');
      url=next;
    }
  } catch(error){
    const cause=error instanceof Error && 'cause' in error ? error.cause : null;
    const code=typeof cause==='object'&&cause!==null&&'code' in cause&&typeof cause.code==='string'&&/^[A-Z0-9_]{1,40}$/.test(cause.code)?cause.code:'unknown';
    console.error('Ошибка загрузки Яндекс Диска',error instanceof Error?error.name:'unknown',code);
    if(error instanceof Error && /^(Не удалось|Яндекс)/.test(error.message)) throw error;
    throw new Error('Не удалось скачать видео с Яндекс Диска. Попробуйте ещё раз.');
  }
  if(!response.ok||!response.body) throw new Error('Не удалось скачать видео с Яндекс Диска.');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();throw new Error('Файл превышает 200 МБ.');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=Buffer.concat(chunks);
  const {videoExtension}=await import('./cloud');const ext=videoExtension(bytes);
  if(!ext) throw new Error('Файл не является видео MP4 или WebM.');
  return new File([bytes],file.name,{type:`video/${ext}`});
}

/** Resolve a public link only against folders published by the connected account. */
export async function resolveDiskFolder(token:string, folder:string, fetcher:typeof fetch=fetch):Promise<string>{
  if(!/^https?:\/\//i.test(folder)) return folder;
  let input:URL;
  try { input=new URL(folder); } catch {throw new Error('Неверная ссылка на папку Яндекс Диска.');}
  if(input.protocol!=='https:' || !['disk.yandex.ru','yadi.sk'].includes(input.hostname) || input.username || input.password || input.port) throw new Error('Укажите ссылку на папку Яндекс Диска.');
  const normalize=(text:string)=>{const u=new URL(text);if(!['disk.yandex.ru','yadi.sk'].includes(u.hostname)) return '';return u.pathname.replace(/\/$/,'');};
  for(let offset=0;offset<10000;offset+=100){
    const url=new URL('https://cloud-api.yandex.net/v1/disk/resources/public');url.searchParams.set('type','dir');url.searchParams.set('limit','100');url.searchParams.set('offset',String(offset));
    const response=await fetcher(url,{headers:{Authorization:`OAuth ${token}`},redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error('Не удалось найти опубликованную папку на вашем Диске. Укажите её путь, например disk:/Видеовстречи.');
    const page=z.object({items:z.array(z.object({path:z.string(),public_url:z.string().optional()})),total:z.number().optional()}).parse(await response.json());
    const match=page.items.find(item=>{try{return !!item.public_url && normalize(item.public_url)===normalize(input.toString());}catch{return false;}});
    if(match) return match.path;
    if(page.items.length<100 || (page.total!==undefined && offset+page.items.length>=page.total)) break;
  }
  throw new Error('Не удалось найти опубликованную папку на вашем Диске. Укажите её путь, например disk:/Видеовстречи.');
}
