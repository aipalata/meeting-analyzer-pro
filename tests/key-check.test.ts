import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(()=>({list:vi.fn()}));
vi.mock('openai',()=>({default:class {models={list:state.list}}}));
import {POST} from '../app/api/key-check/route';
const request=(key:string)=>new Request('http://localhost/api/key-check',{method:'POST',headers:{'x-openai-key':key}});
describe('key check',()=>{
 beforeEach(()=>vi.resetAllMocks());
 it('rejects invalid formats without calling OpenAI',async()=>{const r=await POST(request('wrong')); expect(r.status).toBe(400);expect(state.list).not.toHaveBeenCalled();});
 it('reports success without returning the key',async()=>{state.list.mockResolvedValue({data:[]}); const key='sk-example-test-key';const r=await POST(request(key));expect(r.status).toBe(200);expect(JSON.stringify(await r.json())).not.toContain(key);});
 it('explains rejected keys without exposing service errors',async()=>{state.list.mockRejectedValue({status:401});const r=await POST(request('sk-example-test-key'));expect(r.status).toBe(400);expect((await r.json()).error).toContain('не принял');});
});
