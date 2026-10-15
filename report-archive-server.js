'use strict';
const express=require('express'),crypto=require('crypto'),{DateTime}=require('luxon');
module.exports=function installArchive({app,requireAuth_,getSheets,spreadsheetId,city,baseUrl}){
 const sheet='VD Report Archive',range=s=>"'VD Report Archive'!"+s;
 const headers=['رقم السجل','التاريخ','الوقت','المصدر','البريد الإلكتروني','اسم التقرير','النوع','اسم الملف','حالة الحفظ','الرابط','معرف pCloud','المجلد'];
 const columns=['id','date','time','issuer','email','reportName','format','filename','status','url','fileId','folder'];
 const cloudHost=String(process.env.PCLOUD_API_HOST||'api.pcloud.com').trim();
 const cloudToken=process.env.PCLOUD_ACCESS_TOKEN||'';
 const cloudEnabled=!!cloudToken&&['api.pcloud.com','eapi.pcloud.com'].includes(cloudHost);
 const clean=(v,n=180)=>String(v==null?'':v).split('').filter(c=>c.charCodeAt(0)>31).join('').trim().slice(0,n);
 const filename=v=>clean(v).replace(/[\\/:*?"<>|]/g,'_');
 const obj=r=>Object.fromEntries(columns.map((k,i)=>[k,String(r[i]??'')]));
 let initialized=null;
 async function ensure(sheets){
   if(!initialized)initialized=(async()=>{
     const meta=await sheets.spreadsheets.get({spreadsheetId,fields:'sheets.properties(title)'});
     if(!(meta.data.sheets||[]).some(s=>s.properties?.title===sheet)){
       try{await sheets.spreadsheets.batchUpdate({spreadsheetId,requestBody:{requests:[{addSheet:{properties:{title:sheet,gridProperties:{rowCount:10000,columnCount:12,frozenRowCount:1},rightToLeft:true}}}]}})}
       catch(error){const again=await sheets.spreadsheets.get({spreadsheetId,fields:'sheets.properties(title)'});if(!(again.data.sheets||[]).some(s=>s.properties?.title===sheet))throw error}
     }
     const first=await sheets.spreadsheets.values.get({spreadsheetId,range:range('A1:L1')});
     if(!first.data.values?.[0]?.length)await sheets.spreadsheets.values.update({spreadsheetId,range:range('A1:L1'),valueInputOption:'RAW',requestBody:{values:[headers]}});
   })().catch(e=>{initialized=null;throw e});
   await initialized;
 }
 async function load(){const sheets=await getSheets();await ensure(sheets);const r=await sheets.spreadsheets.values.get({spreadsheetId,range:range('A2:L'),valueRenderOption:'FORMATTED_VALUE'});return {sheets,rows:r.data.values||[]}}
 const find=(rows,id)=>{const i=rows.findIndex(r=>String(r[0])===id);return i<0?null:{index:i,item:obj(rows[i])}};
 const authOrigin=(req,res,next)=>{const origin=req.get('origin');if(origin){try{if(new URL(origin).host!==req.get('host'))return res.status(403).json({ok:false,error:'INVALID_ORIGIN'})}catch{return res.status(403).json({ok:false,error:'INVALID_ORIGIN'})}}next()};
 const permitted=req=>{const user=req.session?.user||{};const perms=Array.isArray(user.permissions)?user.permissions:[];const norm=x=>String(x||'').normalize('NFKC').replace(/[ً-ْٰ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').trim().toLowerCase();return ['admin','administrator','مدير النظام'].includes(norm(user.role))||perms.some(p=>['*','all','الكل','جميع الصفحات','كامل الصلاحيات','مركز التقارير','سجل التقارير الصادرة'].includes(norm(p)))};
 const archiveUrl=(req,id)=>(process.env.REPORT_ARCHIVE_BASE_URL||baseUrl||req.protocol+'://'+req.get('host')).replace(/[/]+$/,'')+'/api/report-archive/file/'+id;
 async function cloud(method,params,form){
   if(!cloudEnabled)throw Error('PCLOUD_NOT_CONFIGURED');
   const body=form||new URLSearchParams();
   for(const [k,v] of Object.entries(params||{}))body.set(k,String(v));
   const response=await fetch('https://'+cloudHost+'/'+method,{method:'POST',headers:{Authorization:'Bearer '+cloudToken},body,signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok||result.result!==0)throw Error('PCLOUD_'+(result.result||response.status));
   return result;
 }
 async function folder(parent,name){const x=await cloud('createfolderifnotexists',{folderid:parent,name});if(!x.metadata?.folderid)throw Error('PCLOUD_FOLDER_NOT_FOUND');return String(x.metadata.folderid)}
 async function upload(buffer,name,id){
   let parent=String(process.env.PCLOUD_REPORTS_FOLDER_ID||'0');if(!/^[0-9]+$/.test(parent))throw Error('INVALID_PCLOUD_FOLDER');
   parent=await folder(parent,'VisionDimensionsReports');
   parent=await folder(parent,city==='Makkah'?'Makkah':'Jeddah');
   parent=await folder(parent,DateTime.now().setZone('Asia/Riyadh').toFormat('yyyy-MM'));
   const form=new FormData();form.set('folderid',parent);form.set('renameifexists','1');
   form.append('file',new Blob([buffer]),id.slice(0,8)+'_'+filename(name));
   const result=await cloud('uploadfile',{},form);
   const fileId=result.fileids?.[0]||result.metadata?.[0]?.fileid;
   if(!fileId)throw Error('PCLOUD_FILE_NOT_SAVED');
   return {fileId:String(fileId),folder:parent};
 }
 app.get('/api/report-archive',requireAuth_,async(req,res)=>{
   if(!permitted(req))return res.status(403).json({ok:false,error:'ACCESS_DENIED'});
   try{const {rows}=await load();res.set('Cache-Control','no-store');res.json({ok:true,city,pcloudEnabled:cloudEnabled,items:rows.slice(-1000).reverse().map(obj)})}
   catch(e){console.error('Archive list',e.message);res.status(500).json({ok:false,error:'ARCHIVE_READ_FAILED'})}
 });
 app.post('/api/report-archive',requireAuth_,authOrigin,async(req,res)=>{
   try{
     const name=clean(req.body?.reportName),format=clean(req.body?.format,8).toUpperCase();
     if(!name||!['PDF','XLSX','PPTX','CSV','HTML'].includes(format))return res.status(400).json({ok:false,error:'INVALID_REPORT'});
     const user=req.session.user||{},now=DateTime.now().setZone('Asia/Riyadh'),id=crypto.randomUUID();
     const row=[id,now.toFormat('yyyy-MM-dd'),now.toFormat('HH:mm:ss'),clean(user.name),clean(user.email),name,format,filename(req.body?.filename||name+'.'+format.toLowerCase()),'تم بدء التصدير','','',''];
     const sheets=await getSheets();await ensure(sheets);
     await sheets.spreadsheets.values.append({spreadsheetId,range:range('A:L'),valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[row]}});
     res.status(201).json({ok:true,id,pcloudEnabled:cloudEnabled});
   }catch(e){console.error('Archive register',e.message);res.status(500).json({ok:false,error:'ARCHIVE_WRITE_FAILED'})}
 });
 app.post('/api/report-archive/:id/link',requireAuth_,authOrigin,async(req,res)=>{
  try{
    const id=String(req.params.id||''),link=String(req.body?.url||'').trim();
    if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({ok:false,error:'INVALID_ID'});
    try{const target=new URL(link);if(target.protocol!=='https:')throw Error('Invalid')}catch{return res.status(400).json({ok:false,error:'INVALID_LINK'})}
    const {sheets,rows}=await load(),found=find(rows,id);
    if(!found)return res.status(404).json({ok:false,error:'NOT_FOUND'});
    if(found.item.email!==req.session.user?.email)return res.status(403).json({ok:false,error:'NOT_OWNER'});
    await sheets.spreadsheets.values.update({spreadsheetId,range:range('I'+(found.index+2)+':J'+(found.index+2)),valueInputOption:'RAW',requestBody:{values:[['تم حفظ الرابط',link.slice(0,1000)]]}});
    res.json({ok:true,url:link});
  }catch(e){console.error('Archive link',e.message);res.status(500).json({ok:false,error:'LINK_SAVE_FAILED'})}
 });
 app.post('/api/report-archive/:id/upload',requireAuth_,authOrigin,express.raw({type:'application/octet-stream',limit:'25mb'}),async(req,res)=>{
   try{
     if(!cloudEnabled)return res.status(409).json({ok:false,error:'PCLOUD_NOT_CONFIGURED'});
     const id=String(req.params.id||'');
     if(!/^[0-9a-f-]{36}$/i.test(id)||!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({ok:false,error:'INVALID_FILE'});
     const {sheets,rows}=await load(),found=find(rows,id);
     if(!found)return res.status(404).json({ok:false,error:'NOT_FOUND'});
     if(found.item.email!==req.session.user?.email)return res.status(403).json({ok:false,error:'NOT_OWNER'});
     const file=filename(decodeURIComponent(req.get('x-report-filename')||found.item.filename));
     const ext=file.split('.').pop().toUpperCase();
     if(ext!==found.item.format)return res.status(400).json({ok:false,error:'FORMAT_MISMATCH'});
     if(ext==='PDF'&&req.body.subarray(0,5).toString()!=='%PDF-')return res.status(400).json({ok:false,error:'NOT_PDF'});
     if(['XLSX','PPTX'].includes(ext)&&req.body.subarray(0,2).toString()!=='PK')return res.status(400).json({ok:false,error:'NOT_OFFICE'});
     const saved=await upload(req.body,file,id),url=archiveUrl(req,id);
     await sheets.spreadsheets.values.update({spreadsheetId,range:range('H'+(found.index+2)+':L'+(found.index+2)),valueInputOption:'RAW',requestBody:{values:[[file,'محفوظ في pCloud',url,saved.fileId,saved.folder]]}});
     res.json({ok:true,url});
   }catch(e){console.error('Archive upload',e.message);res.status(502).json({ok:false,error:'UPLOAD_FAILED'})}
 });
 app.get('/api/report-archive/file/:id',requireAuth_,async(req,res)=>{
   try{
     const {rows}=await load(),found=find(rows,String(req.params.id||''));
     if(!found?.item.fileId)return res.status(404).send('No saved report');
     if(!permitted(req)&&found.item.email!==req.session.user?.email)return res.status(403).send('Forbidden');
     if(!cloudEnabled)return res.status(503).send('pCloud not configured');
     const result=await cloud('getfilelink',{fileid:found.item.fileId,forcedownload:1});
     const url=new URL('https://'+String(result.hosts?.[0]||'')+String(result.path||''));
     if(!url.hostname.endsWith('.pcloud.com'))throw Error('UNTRUSTED_HOST');
     res.set('Cache-Control','no-store');res.redirect(302,url.toString());
   }catch(e){console.error('Archive download',e.message);res.status(502).send('Archive unavailable')}
 });
};
