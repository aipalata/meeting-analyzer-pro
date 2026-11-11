import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ get:vi.fn(), del:vi.fn(), processVideo:vi.fn() }));
vi.mock('@vercel/blob', () => ({get:mocked.get,del:mocked.del}));
vi.mock('../lib/process-video', () => ({processVideo:mocked.processVideo}));
import { POST } from '../app/api/analyze/route';
const path = 'uploads/12345678-1234-1234-1234-123456789abc.mp4';
function request(key?:string){return new Request('http://localhost/api/analyze',{method:'POST',headers:{'content-type':'application/json',...(key?{'x-openai-key':key}:{})},body:JSON.stringify({path})})}
describe('visitor API key',()=>{
 beforeEach(()=>{vi.resetAllMocks(); mocked.del.mockResolvedValue(undefined); mocked.get.mockResolvedValue({statusCode:200,blob:{size:3,contentType:'video/mp4'},stream:new Blob(['vid']).stream()});mocked.processVideo.mockResolvedValue({transcript:'test',notes:{summary:'test',decisions:[],tasks:[],questions:[]}})});
 it('rejects requests without a visitor key before accessing AI',async()=>{ const result=await POST(request());expect(result.status).toBe(400);expect(mocked.get).not.toHaveBeenCalled();expect(mocked.processVideo).not.toHaveBeenCalled(); });
 it('passes the visitor key only to the processor',async()=>{const key='sk-example-test-value';const result=await POST(request(key));expect(result.status).toBe(200);expect(mocked.processVideo).toHaveBeenCalledWith(expect.any(File),key);expect(JSON.stringify(await result.json())).not.toContain(key);});
});
