'use strict';
/**
 * Private first-six slides from the originally approved PDC2 PowerPoint.
 * Ciphertext is stored separately from the secret; full original PPTX and
 * historical observation images are never published or served.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=function installPdc2OriginalSix({app,requireAuth_}){
 const filename=path.join(__dirname,'private-assets','pdc2-original-first-six.pptx.enc');
 const hasSource=()=>fs.existsSync(filename)&&/^[a-f0-9]{64}$/i.test(String(process.env.PDC2_ORIGINAL_SIX_AES_KEY||''));
 const allowed=req=>{
  const u=req.session?.user||{},role=String(u.role||'').toLowerCase();
  if(['admin','administrator','مدير النظام'].includes(role))return true;
  const p=Array.isArray(u.permissions)?u.permissions:[];
  return p.some(v=>/^(?:\*|all|جميع الصلاحيات|اجتماع\s*(?:الـ\s*)?PDC\s*2)$/i.test(String(v||'').trim()));
 };
 app.get('/api/pdc-meeting-2/template-six/status',requireAuth_,(req,res)=>{
  res.set('Cache-Control','private, no-store');
  if(!allowed(req))return res.status(403).json({ok:false,error:'PDC2_PERMISSION_REQUIRED'});
  res.json({ok:true,available:hasSource(),source:'original-pptx-six',verifiedSlides:6,
   description:'Original first six native PPTX slides; no rebuilt HTML slide may substitute them.'});
 });
 app.get('/api/pdc-meeting-2/template-six',requireAuth_,(req,res)=>{
  res.set('Cache-Control','private, no-store');
  res.set('X-Content-Type-Options','nosniff');
  if(!allowed(req))return res.status(403).json({ok:false,error:'PDC2_PERMISSION_REQUIRED'});
  if(!hasSource())return res.status(503).json({ok:false,error:'ORIGINAL_SIX_TEMPLATE_NOT_CONFIGURED'});
  try{
   const packet=fs.readFileSync(filename);
   if(packet.length<60||packet.subarray(0,8).toString()!=='PDC2ENC1')throw Error('INVALID_TEMPLATE_PACKET');
   const key=Buffer.from(process.env.PDC2_ORIGINAL_SIX_AES_KEY,'hex'),
     iv=packet.subarray(8,20),tag=packet.subarray(packet.length-16);
   const dec=crypto.createDecipheriv('aes-256-gcm',key,iv);dec.setAuthTag(tag);
   const data=Buffer.concat([dec.update(packet.subarray(20,-16)),dec.final()]);
   if(data.subarray(0,2).toString()!=='PK')throw Error('INVALID_TEMPLATE_CONTENT');
   res.set('Content-Type','application/vnd.openxmlformats-officedocument.presentationml.presentation');
   res.set('Content-Disposition','inline; filename="PDC2_Makkah_Original_Slides_1-6.pptx"');
   res.send(data);
  }catch(error){
   console.error('[PDC2 original six] unavailable:',error.message);
   res.status(503).json({ok:false,error:'ORIGINAL_SIX_TEMPLATE_UNAVAILABLE'});
  }
 });
};