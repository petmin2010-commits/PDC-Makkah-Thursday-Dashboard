'use strict';
let rejected=false;
let warned=false;
function status(){
 const configured=Boolean(String(process.env.OPENAI_API_KEY||'').trim());
 const code=!configured?'not_configured':rejected?'invalid_key':'ready';
 return {configured,active:configured&&!rejected,code};
}
function recordHttpError(code){
 if(Number(code)===401){
  rejected=true;
  if(!warned){
   warned=true;
   console.warn('[OpenAI] Authentication rejected (401). Automatic AI retries paused. Replace OPENAI_API_KEY in Render and redeploy.');
  }
 }
}
function reason(){
 const s=status();
 if(s.code==='invalid_key')return 'مفتاح OpenAI الحالي مرفوض (401). حدّث OPENAI_API_KEY في Render لاستعادة التحليل الذكي.';
 if(s.code==='not_configured')return 'مفتاح OpenAI غير مُعدّ في Render.';
 return '';
}
module.exports={status,recordHttpError,reason};
