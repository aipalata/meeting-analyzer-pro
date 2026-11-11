import {afterEach, describe, expect, it} from 'vitest';
import {sealPrivateState,openPrivateState} from '../lib/private-state';
describe('encrypted integration settings',()=>{
  afterEach(()=>{delete process.env.PRO_PLUS_ENCRYPTION_KEY;});
  it('encrypts and authenticates saved secrets with fresh nonces',()=>{
    process.env.PRO_PLUS_ENCRYPTION_KEY='ab'.repeat(32);
    const a=sealPrivateState({token:'private-token'});const b=sealPrivateState({token:'private-token'});
    expect(a).not.toContain('private-token');expect(a).not.toBe(b);expect(openPrivateState(a)).toEqual({token:'private-token'});
    const parts=a.split('.');parts[2]=Buffer.alloc(16).toString('base64url');expect(()=>openPrivateState(parts.join('.'))).toThrow();
  });
  it('refuses to save secrets when the encryption key is missing',()=>expect(()=>sealPrivateState({token:'x'})).toThrow());
});
