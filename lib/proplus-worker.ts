import {BlobPreconditionFailedError,BlobServiceRateLimited} from '@vercel/blob';
import {listDiskVideos,pendingDiskVideos,diskVersion,downloadDiskVideo,resolveDiskFolder} from './yandex-disk';
import {loadConfig,saveConfig,type ProConfig} from './proplus';
import {processVideo} from './process-video';

/** Uses Blob ETags as a lease to prevent overlapping scheduled runs for one account. */
export async function scanAccount(id:string){
  let stored=await loadConfig(id);if(!stored || !stored.value.folder || !stored.value.openaiKey || (stored.value.leaseUntil||0)>Date.now()) return;
  let state:ProConfig={...stored.value,leaseUntil:Date.now()+9*60*1000};
  const lease=state.leaseUntil;
  try {await saveConfig(id,state,stored.etag);} catch (error) {console.error('Не удалось получить блокировку',error instanceof BlobPreconditionFailedError?'etag_mismatch':error instanceof BlobServiceRateLimited?'rate_limited':error instanceof Error?error.name:'unknown');throw new Error('Не удалось запустить проверку. Попробуйте ещё раз.');}
  async function update(){const latest=await loadConfig(id);if(!latest || latest.value.leaseUntil!==state.leaseUntil) throw new Error('Проверка уже выполняется.');await saveConfig(id,state,latest.etag);}
  try {
    if(state.expiresAt < Date.now()+300000){
      if(!state.refreshToken) throw new Error('Срок доступа к Яндекс Диску истёк. Подключите его снова.');
      const params=new URLSearchParams({grant_type:'refresh_token',refresh_token:state.refreshToken,client_id:process.env.YANDEX_CLIENT_ID!,client_secret:process.env.YANDEX_CLIENT_SECRET!});
      const response=await fetch('https://oauth.yandex.ru/token',{method:'POST',body:params,redirect:'error',signal:AbortSignal.timeout(30000)});
      if(!response.ok) throw new Error('Не удалось обновить доступ к Яндекс Диску. Подключите его снова.');
      const data=await response.json();if(typeof data.access_token!=='string'||typeof data.expires_in!=='number') throw new Error('Не удалось обновить доступ к Яндекс Диску.');
      state.accessToken=data.access_token;state.refreshToken=typeof data.refresh_token==='string'?data.refresh_token:state.refreshToken;state.expiresAt=Date.now()+data.expires_in*1000;await update();
    }
    delete state.lastError;
    state.folder=await resolveDiskFolder(state.accessToken,state.folder!);
    const files=await listDiskVideos(state.accessToken,state.folder!);state.lastChecked=new Date().toISOString();
    const completed=new Set(state.results.filter(r=>r.status==='done').map(r=>r.version));
    const file=pendingDiskVideos(files,completed)[0];
    if(!file){await update();return;}
    const version=diskVersion(file);
    state.results=[{version,name:file.name,createdAt:new Date().toISOString(),status:'processing',stage:'Получение файла'},...state.results.filter(r=>r.version!==version)];await update();
    let workStage='download';
    try {
      const video=await downloadDiskVideo(state.accessToken,file);
      workStage='verify';
      const current=(await listDiskVideos(state.accessToken,state.folder!)).find(f=>f.path===file.path);
      if(!current||diskVersion(current)!==version) throw new Error('Файл изменился во время загрузки; повторим проверку позже.');
      workStage='ai';
      const result=await processVideo(video,state.openaiKey!,async stage=>{state.results[0].stage=stage==='transcribing'?'Распознавание речи':'AI-анализ';await update();});
      state.results[0]={...state.results[0],status:'done',stage:undefined,...result};
    } catch(error){console.error('Ошибка обработки файла',workStage,error instanceof Error?error.name:'unknown');const status=typeof error==='object'&&error!==null&&'status' in error?error.status:null;const message=status===401||status===403?'OpenAI не принял API-ключ.':status===429?'OpenAI отклонил запрос: проверьте баланс и лимиты.':error instanceof Error&&/^(Не удалось|Файл|Речь|Яндекс)/.test(error.message)?error.message:'Не удалось обработать запись.';state.results[0]={...state.results[0],status:'error',stage:undefined,error:message};}
    await update();
  } catch(error){state.lastChecked=new Date().toISOString();state.lastError=error instanceof Error && /^(Нет доступа|Не удалось|Срок доступа|В папке)/.test(error.message)?error.message:'Не удалось проверить папку на Яндекс Диске.';console.error('Проверка Яндекс Диска не выполнена', error instanceof BlobPreconditionFailedError ? 'etag_mismatch' : error instanceof BlobServiceRateLimited ? 'rate_limited' : error instanceof Error ? error.name : 'unknown');}
  finally {try {delete state.leaseUntil;const latest=await loadConfig(id);if(latest && latest.value.leaseUntil===lease) await saveConfig(id,state,latest.etag);} catch (error) {console.error('Не удалось сохранить состояние проверки', error instanceof BlobPreconditionFailedError ? 'etag_mismatch' : error instanceof BlobServiceRateLimited ? 'rate_limited' : error instanceof Error ? error.name : 'unknown');}}
}
