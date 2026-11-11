import { describe, it, expect, vi } from 'vitest';
import { diskVersion, listDiskVideos, pendingDiskVideos, downloadDiskVideo, resolveDiskFolder } from '../lib/yandex-disk';
const file={type:'file',name:'meeting.mp4',path:'disk:/Встречи/meeting.mp4',size:100,modified:'2026-11-10T10:00:00Z',sha256:'abc'};
describe('Yandex Disk folder scan',()=>{
  it('requests only the chosen folder and filters unsupported entries',async()=>{
    const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({_embedded:{total:3,items:[file,{...file,name:'notes.txt'}, {...file,type:'dir'}]}})));
    expect(await listDiskVideos('secret','disk:/Встречи',mock)).toEqual([file]);
    const [url,options]=mock.mock.calls[0]; expect(url.hostname).toBe('cloud-api.yandex.net');expect(url.searchParams.get('path')).toBe('disk:/Встречи');expect(options.redirect).toBe('error');
  });
  it('waits for settled files and skips an already processed version',()=>{
    const now=Date.parse('2026-11-10T10:05:00Z'); const changed={...file,sha256:'def'};
    expect(pendingDiskVideos([file,changed],new Set([diskVersion(file)]),now)).toEqual([changed]);
    expect(pendingDiskVideos([file],new Set(),Date.parse(file.modified)+1000)).toEqual([]);
  });
  it('reports access failures without disclosing the token',async()=>{
    await expect(listDiskVideos('secret','disk:/',vi.fn().mockResolvedValue(new Response('',{status:401})))).rejects.toThrow('Нет доступа');
  });
  it('rejects download addresses outside Yandex without making a second request',async()=>{
    const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({href:'https://evil.test/recording'})));
    await expect(downloadDiskVideo('secret',file,mock)).rejects.toThrow('небезопасную ссылку');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('resolves only a public folder owned by the connected account',async()=>{
    const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({items:[{path:'disk:/Видео',public_url:'https://disk.yandex.ru/d/abc'}],total:1})));
    expect(await resolveDiskFolder('token','https://disk.yandex.ru/d/abc?share=1',mock)).toBe('disk:/Видео');
    await expect(resolveDiskFolder('token','https://evil.test/x',mock)).rejects.toThrow();
  });
  it('follows only trusted redirects without forwarding the OAuth token',async()=>{
    const mock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({href:'https://downloader.disk.yandex.ru/file'})))
      .mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'https://storage.yandexcloud.net/recording'}}))
      .mockResolvedValueOnce(new Response(new Uint8Array([0x1a,0x45,0xdf,0xa3])));
    const video=await downloadDiskVideo('private-token',file,mock);
    expect(video.size).toBe(4);expect(mock.mock.calls[2][1].headers).toBeUndefined();
  });
});
