import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Encrypts private integration settings before writing them to persistent storage. */
function keyFromEnvironment():Buffer {
  const raw=process.env.PRO_PLUS_ENCRYPTION_KEY;
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) throw new Error('PRO+ не настроен: отсутствует ключ шифрования.');
  return Buffer.from(raw,'hex');
}
export function sealPrivateState(value:unknown):string {
  const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',keyFromEnvironment(),iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function openPrivateState<T>(value:string):T {
  const [version,iv,tag,data,...extra]=value.split('.');
  if(version!=='v1'||!iv||!tag||!data||extra.length) throw new Error('Неверный формат защищённых данных.');
  const decipher=createDecipheriv('aes-256-gcm',keyFromEnvironment(),Buffer.from(iv,'base64url'));
  decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8')) as T;
}
