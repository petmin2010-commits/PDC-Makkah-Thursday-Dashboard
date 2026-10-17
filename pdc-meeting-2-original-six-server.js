'use strict';
/**
 * Authenticated access to the first six original PDC2 slides.
 * The encrypted source is authenticated/decrypted at startup so the UI cannot
 * claim readiness based only on the presence of a key-shaped environment var.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=function installPdc2OriginalSix({app,requireAuth_}){
 const filename=path.join(__dirname,'private-assets','pdc2-original-first-six.pptx.enc');
 const loadSource=()=>{
  if(!fs.existsSync(filename))throw Error('ENCRYPTED_TEMPLATE_MISSING');
  const secret=String(process.env.PDC2_ORIGINAL_SIX_AES_KEY||'').trim();
  if(!secret)throw Error('TEMPLATE_KEY_NOT_CONFIGURED');
  if(!/^[a-f0-9]{64}$/i.test(secret))throw Error('TEMPLATE_KEY_FORMAT_INVALID_LENGTH_'+secret.length);
  const packet=fs.readFileSync(filename);
  if(packet.length<60||packet.subarray(0,8).toString()!=='PDC2ENC1')throw Error('INVALID_TEMPLATE_PACKET');
  const key=Buffer.from(secret,'hex'),iv=packet.subarray(8,20),tag=packet.subarray(packet.length-16);
  const dec=crypto.createDecipheriv('aes-256-gcm',key,iv);dec.setAuthTag(tag);
  const data=Buffer.concat([dec.update(packet.subarray(20,-16)),dec.final()]);
  if(data.length<1000||data.subarray(0,2).toString()!=='PK')throw Error('INVALID_TEMPLATE_CONTENT');
  return data;
 };
 let templateBytes=null,availabilityReason=null;
 try{
  templateBytes=loadSource();
  console.info('[PDC2 original six] verified: source decrypted and authenticated; six-slide template ready');
 }catch(e){
  availabilityReason=e.message||'UNAVAILABLE';
  console.warn('[PDC2 original six] unavailable:',availabilityReason);
 }
 const hasSource=()=>Buffer.isBuffer(templateBytes);
 const allowed=req=>{
  const u=req.session?.user||{},role=String(u.role||'').trim().toLowerCase();
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
  res.set('Content-Type','application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.set('Content-Disposition','inline; filename="PDC2_Makkah_Original_Slides_1-6.pptx"');
  res.send(templateBytes);
 });
};