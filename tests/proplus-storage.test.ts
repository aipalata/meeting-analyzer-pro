import {afterEach,describe,expect,it,vi} from 'vitest';
import {BlobServiceRateLimited,BlobPreconditionFailedError} from '@vercel/blob';
const mocks=vi.hoisted(()=>({put:vi.fn(),get:vi.fn(),head:vi.fn()}));
vi.mock('@vercel/blob',async importOriginal=>({...await importOriginal<typeof import('@vercel/blob')>(),put:mocks.put,get:mocks.get,head:mocks.head}));
import {saveConfig,loadConfig} from '../lib/proplus';
import {sealPrivateState} from '../lib/private-state';
const config={accessToken:'token',expiresAt:123,results:[]};
describe('encrypted state writes',()=>{
  afterEach(()=>{vi.useRealTimers();vi.resetAllMocks();delete process.env.PRO_PLUS_ENCRYPTION_KEY;});
  it('retries a transient rate limit without changing the conditional version',async()=>{
    process.env.PRO_PLUS_ENCRYPTION_KEY='ab'.repeat(32);vi.useFakeTimers();mocks.put.mockRejectedValueOnce(new BlobServiceRateLimited()).mockResolvedValueOnce({});
    const pending=saveConfig('a'.repeat(64),config,'etag');await vi.runAllTimersAsync();await pending;
    expect(mocks.put).toHaveBeenCalledTimes(2);expect(mocks.put.mock.calls[1][2].ifMatch).toBe('etag');
  });
  it('does not retry a conflicting write',async()=>{process.env.PRO_PLUS_ENCRYPTION_KEY='ab'.repeat(32);mocks.put.mockRejectedValue(new BlobPreconditionFailedError());await expect(saveConfig('a'.repeat(64),config,'etag')).rejects.toBeInstanceOf(BlobPreconditionFailedError);expect(mocks.put).toHaveBeenCalledTimes(1);});
  it('uses the strong storage ETag when the download returns a weak one',async()=>{
    process.env.PRO_PLUS_ENCRYPTION_KEY='ab'.repeat(32);
    const content=sealPrivateState(config);
    mocks.get.mockResolvedValue({statusCode:200,stream:new Response(content).body,blob:{etag:'W/"version"'}});
    mocks.head.mockResolvedValue({etag:'"version"'});
    expect(await loadConfig('a'.repeat(64))).toEqual({value:config,etag:'"version"'});
  });
});
