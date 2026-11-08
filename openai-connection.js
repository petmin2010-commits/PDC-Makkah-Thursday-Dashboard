'use strict';
const crypto=require('crypto');

// Keys stay on the server. Do not expose credentials to the dashboard.
const rejectedFingerprints=new Set();
const warnedFingerprints=new Set();
function normalizeKey(value){
 let key=String(value||'').trim();
 if((key.startsWith('"')&&key.endsWith('"'))||(key.startsWith("'")&&key.endsWith("'")))key=key.slice(1,-1).trim();
 return key.replace(/^Bearer\s+/i,'').trim();
}
function fingerprint(key){
 return crypto.createHash('sha256').update(key).digest('hex');
}
function configuredKeys(){
 return [...new Set([normalizeKey(process.env.OPENAI_API_KEY),normalizeKey(process.env.OPENAI_API_KEY_BACKUP)])].filter(Boolean);
}
function getApiKey(){
 return configuredKeys().find(key=>!rejectedFingerprints.has(fingerprint(key)))||'';
}
function status(){
 const configured=configuredKeys().length>0;
 const active=Boolean(getApiKey());
 return {configured,active,code:!configured?'not_configured':!active?'invalid_key':'ready'};
}
function recordHttpError(code,usedKey){
 if(Number(code)!==401)return;
 const key=normalizeKey(usedKey);
 if(!key)return;
 const id=fingerprint(key);
 rejectedFingerprints.add(id);
 if(!warnedFingerprints.has(id)){
  warnedFingerprints.add(id);
  console.warn('[OpenAI] Authentication rejected (401). Credential disabled until rotated; check OPENAI_API_KEY in Render. No secret was logged.');
 }
}
function reason(){
 const s=status();
 if(s.code==='invalid_key')return 'مفتاح OpenAI مرفوض (401). حدّث OPENAI_API_KEY في Render أو أضف OPENAI_API_KEY_BACKUP صالحًا لاستئناف التحليل.';
 if(s.code==='not_configured')return 'مفتاح OpenAI غير مُعدّ في Render.';
 return '';
}
module.exports={status,recordHttpError,reason,getApiKey};
