import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {ProConfig} from '../lib/proplus';
const mocks=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),list:vi.fn(),download:vi.fn(),process:vi.fn()}));
vi.mock('../lib/proplus',()=>({loadConfig:mocks.load,saveConfig:mocks.save}));
vi.mock('../lib/yandex-disk',()=>({listDiskVideos:mocks.list,resolveDiskFolder:async (_token:string,folder:string)=>folder,diskVersion:()=> 'version-1',pendingDiskVideos:(files:unknown[],done:Set<string>)=>done.has('version-1')?[]:files,downloadDiskVideo:mocks.download}));
vi.mock('../lib/process-video',()=>({processVideo:mocks.process}));
import {scanAccount} from '../lib/proplus-worker';
let value:ProConfig;let etag=0;
describe('background scan',()=>{
  beforeEach(()=>{vi.clearAllMocks();etag=0;value={accessToken:'disk-secret',expiresAt:Date.now()+3600000,folder:'disk:/Встречи',openaiKey:'sk-secret',results:[]};
    mocks.load.mockImplementation(async()=>({value:structuredClone(value),etag:String(etag)}));
    mocks.save.mockImplementation(async(_id:string,next:ProConfig,expected:string)=>{if(expected!==String(etag))throw new Error('etag');value=structuredClone(next);etag++;});
    mocks.list.mockResolvedValue([{type:'file',name:'meeting.mp4',path:'disk:/Встречи/meeting.mp4',modified:'2026-11-10T10:00:00Z',size:20}]);mocks.download.mockResolvedValue(new File(['video'],'meeting.mp4'));
    mocks.process.mockImplementation(async(_file:unknown,_key:unknown,onStage:(s:string)=>Promise<void>)=>{await onStage('transcribing');await onStage('analyzing');return {transcript:'Встреча',notes:{summary:'Итоги',decisions:[],tasks:[],questions:[]}};});
  });
  it('saves real pipeline output and skips the same version later',async()=>{await scanAccount('id');expect(value.results[0].status).toBe('done');expect(value.results[0].transcript).toBe('Встреча');expect(value.leaseUntil).toBeUndefined();await scanAccount('id');expect(mocks.process).toHaveBeenCalledTimes(1);});
  it('does not start while another run holds the lease',async()=>{value.leaseUntil=Date.now()+60000;await scanAccount('id');expect(mocks.list).not.toHaveBeenCalled();});
  it('reports a failed scan without persisting credentials in the error',async()=>{mocks.list.mockRejectedValue(new Error('secret should not appear'));await scanAccount('id');expect(value.lastError).toBe('Не удалось проверить папку на Яндекс Диске.');expect(value.leaseUntil).toBeUndefined();});
});
