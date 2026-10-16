'use strict';
const express=require('express'),crypto=require('crypto'),{DateTime}=require('luxon');
module.exports=function installArchive({app,requireAuth_,getSheets,spreadsheetId,city,baseUrl}){
 const sheet='VD Report Archive',range=s=>"'VD Report Archive'!"+s;
 const headers=['رقم السجل','التاريخ','الوقت','المصدر','البريد الإلكتروني','اسم التقرير','النوع','اسم الملف','حالة الحفظ','الرابط','معرف pCloud','المجلد'];
 const columns=['id','date','time','issuer','email','reportName','format','filename','status','url','fileId','folder'];
 const archiveDeleteEmail='ahmad.zakaria-m@vd-2030.com';
 const canDeleteArchiveRow=req=>String(req.session?.user?.email||'').trim().toLowerCase()===archiveDeleteEmail;
 const cloudHost=String(process.env.PCLOUD_API_HOST||'api.pcloud.com').trim();
 const cloudToken=process.env.PCLOUD_ACCESS_TOKEN||'';
 const cloudUser=String(process.env.PCLOUD_USERNAME||'').trim();
 const cloudPass=String(process.env.PCLOUD_PASSWORD||'');
 const passwordReady=Boolean(cloudUser&&cloudPass);
 const cloudEnabled=(Boolean(cloudToken)||passwordReady)&&['api.pcloud.com','eapi.pcloud.com'].includes(cloudHost);
 let sessionAuth='';
 let loginPromise=null;
 let preferPassword=!cloudToken&&passwordReady;
 const clean=(v,n=180)=>String(v==null?'':v).split('').filter(c=>c.charCodeAt(0)>31).join('').trim().slice(0,n);
 const filename=v=>clean(v).replace(/[\\/:*?"<>|]/g,'_');
 const obj=r=>Object.fromEntries(columns.map((k,i)=>[k,String(r[i]??'')]));
 // Old print-only registrations must not remain indefinitely marked as in progress.
 const visibleArchiveRow=r=>{
   const item=obj(r);
   if(item.status==='تم بدء التصدير'&&!item.fileId&&!item.url){
     const start=DateTime.fromFormat(item.date+' '+item.time,'yyyy-MM-dd HH:mm:ss',{zone:'Asia/Riyadh'});
     if(start.isValid&&DateTime.now().diff(start,'minutes').minutes>5){
       item.status='لم يكتمل حفظ التقرير — أعد التصدير أو ارفع الملف';
     }
   }
   return item;
 };
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
 async function passwordLogin(){
   if(!passwordReady)throw Error('PCLOUD_PASSWORD_NOT_CONFIGURED');
   if(sessionAuth)return sessionAuth;
   if(!loginPromise)loginPromise=(async()=>{
     const body=new URLSearchParams({username:cloudUser,password:cloudPass,getauth:'1',logout:'1',device:'Vision Dimensions Report Archive'});
     const response=await fetch('https://'+cloudHost+'/userinfo',{method:'POST',body,signal:AbortSignal.timeout(20000)});
     const result=await response.json();
     if(!response.ok||result.result!==0||!result.auth)throw Error('PCLOUD_LOGIN_'+(result.result||response.status));
     sessionAuth=String(result.auth);
     return sessionAuth;
   })().finally(()=>{loginPromise=null});
   return loginPromise;
 }
 async function cloud(method,params,form){
   if(!cloudEnabled)throw Error('PCLOUD_NOT_CONFIGURED');
   for(let attempt=0;attempt<2;attempt++){
     const usePassword=preferPassword||!cloudToken;
     const headers={};
     const body=form||new URLSearchParams();
     for(const [k,v] of Object.entries(params||{}))body.set(k,String(v));
     if(usePassword)body.set('auth',await passwordLogin());
     else headers.Authorization='Bearer '+cloudToken;
     const response=await fetch('https://'+cloudHost+'/'+method,{method:'POST',headers,body,signal:AbortSignal.timeout(60000)});
     const result=await response.json();
     if(response.ok&&result.result===0)return result;
     if(passwordReady&&[1000,2000].includes(Number(result.result))&&attempt===0){
       sessionAuth='';
       preferPassword=true;
       continue;
     }
     throw Error('PCLOUD_'+(result.result||response.status));
   }
   throw Error('PCLOUD_AUTH_REJECTED');
 }
 const davHost=cloudHost==='eapi.pcloud.com'?'ewebdav.pcloud.com':'webdav.pcloud.com';
 const davReady=passwordReady&&cloudEnabled;
 const safeDavPath=p=>p.split('/').map((part,i)=>i===0?'':encodeURIComponent(part)).join('/');
 async function dav(method,p,options={}){
   if(!davReady)throw Error('PCLOUD_WEBDAV_NOT_CONFIGURED');
   const address='https://'+davHost+safeDavPath(p);
   const header={Authorization:'Basic '+Buffer.from(cloudUser+':'+cloudPass).toString('base64'),...options.headers};
   let response;
   for(let attempt=0;attempt<3;attempt++){
     try{
       response=await fetch(address,{method,headers:header,body:options.body,redirect:'manual',signal:AbortSignal.timeout(45000)});
       break;
     }catch(e){
       const reason=String(e.cause?.code||e.name||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'_').slice(0,35);
       if(attempt===2)throw Error('WEBDAV_NETWORK_ERROR_'+reason);
       await new Promise(done=>setTimeout(done,900*(attempt+1)));
     }
   }
   for(let redirects=0;redirects<2&&[301,302,307,308].includes(response.status);redirects++){
     const next=new URL(response.headers.get('location')||'',address);
     if(next.protocol!=='https:'||next.hostname!==davHost||next.port||next.username||next.password){
       throw Error('WEBDAV_UNTRUSTED_REDIRECT_'+next.hostname.replace(/[^a-z0-9.-]/gi,'_'));
     }
     const redirectPath=next.pathname;
     try{
       response=await fetch(next.toString(),{method,headers:header,body:options.body,redirect:'manual',signal:AbortSignal.timeout(45000)});
     }catch(e){
       throw Error('WEBDAV_REDIRECT_FETCH_'+String(e.cause?.code||e.name||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'_').slice(0,35));
     }
     if([301,302,307,308].includes(response.status)&&redirects===1){
       throw Error('WEBDAV_REDIRECT_LOOP_'+redirectPath.slice(0,40).replace(/[^A-Za-z0-9/_-]/g,'_'));
     }
   }
   if(options.expected?.includes(response.status))return response;
   if(response.status===401||response.status===403)throw Error('WEBDAV_LOGIN_CONFIRMATION_REQUIRED_'+response.status);
   throw Error('WEBDAV_HTTP_'+response.status);
 }
 async function checkDav(){await dav('PROPFIND','/',{headers:{Depth:'0'},expected:[200,207]});return true}
 async function mkcol(p){await dav('MKCOL',p,{expected:[201,405]})}
 async function uploadDav(buffer,name,id){
   const root='/VisionDimensionsReports';
   const cityPath=root+'/'+(city==='Makkah'?'Makkah':'Jeddah');
   const monthPath=cityPath+'/'+DateTime.now().setZone('Asia/Riyadh').toFormat('yyyy-MM');
   await mkcol(root);await mkcol(cityPath);await mkcol(monthPath);
   const filepath=monthPath+'/'+id.slice(0,8)+'_'+filename(name);
   await dav('PUT',filepath,{body:buffer,headers:{'Content-Type':'application/octet-stream'},expected:[200,201,204]});
   return {fileId:'webdav',folder:filepath};
 }
 async function getDavFile(p){
   if(!p.startsWith('/VisionDimensionsReports/')||p.includes('..')||p.includes('\\'))throw Error('WEBDAV_INVALID_FILEPATH');
   const res=await dav('GET',p,{expected:[200]});
   return Buffer.from(await res.arrayBuffer());
 }
 async function probeDavWritable(){
   await checkDav();
   const id=crypto.randomUUID();
   const sample=Buffer.from('Vision Dimensions WebDAV connectivity '+id,'utf8');
   const target=await uploadDav(sample,'connection-test.txt',id);
   try{
     const actual=await getDavFile(target.folder);
     if(!actual.equals(sample))throw Error('WEBDAV_VERIFY_FAILED');
   }finally{
     await dav('DELETE',target.folder,{expected:[200,204,207]});
   }
   return true;
 }
 async function folder(parent,name){const x=await cloud('createfolderifnotexists',{folderid:parent,name});if(!x.metadata?.folderid)throw Error('PCLOUD_FOLDER_NOT_FOUND');return String(x.metadata.folderid)}
 async function upload(buffer,name,id){
   if(davReady)return uploadDav(buffer,name,id);
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
 app.get('/api/report-archive/pcloud-status',requireAuth_,async(req,res)=>{
   if(!permitted(req))return res.status(403).json({ok:false,error:'ACCESS_DENIED'});
   res.set('Cache-Control','no-store');
   if(!cloudEnabled)return res.json({ok:true,configured:false,connected:false,mode:'not-configured'});
   const mode=davReady?'webdav':(preferPassword?'username-password':'access-token');
   try{
     if(davReady)await probeDavWritable();
     else await cloud('userinfo',{});
     res.json({ok:true,configured:true,connected:true,mode});
   }catch(e){
     res.json({ok:true,configured:true,connected:false,mode,error:String(e.message||'PCLOUD_FAILED').slice(0,80)});
   }
 });
 const probe=setTimeout(()=>{
   if(!cloudEnabled){console.log('Report archive pCloud: not configured');return}
   (davReady?probeDavWritable():cloud('userinfo',{}))
     .then(()=>console.log('Report archive pCloud: connected via '+(davReady?'WebDAV; upload-download verified':(preferPassword?'username-password':'access-token'))))
     .catch(e=>console.warn('Report archive pCloud: connection or file-transfer test unavailable ('+String(e.message||'unknown').slice(0,55)+')'));
 },5000);
 if(typeof probe.unref==='function')probe.unref();
 app.get('/api/report-archive',requireAuth_,async(req,res)=>{
   if(!permitted(req))return res.status(403).json({ok:false,error:'ACCESS_DENIED'});
   try{const {rows}=await load();res.set('Cache-Control','no-store');res.json({ok:true,city,pcloudEnabled:cloudEnabled,canDelete:canDeleteArchiveRow(req),items:rows.slice(-1000).reverse().map(visibleArchiveRow)})}
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
 // Delete a single archive register row. Restricted to the exact authorized account,
 // independently of administrator role or UI visibility. pCloud files are never deleted.
 app.delete('/api/report-archive/:id',requireAuth_,authOrigin,async(req,res)=>{
   if(!canDeleteArchiveRow(req))return res.status(403).json({ok:false,error:'DELETE_ACCESS_DENIED'});
   const id=String(req.params.id||'');
   if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({ok:false,error:'INVALID_ID'});
   try{
     const {sheets,rows}=await load();
     const selected=find(rows,id);
     if(!selected)return res.status(404).json({ok:false,error:'NOT_FOUND'});
     const meta=await sheets.spreadsheets.get({spreadsheetId,fields:'sheets(properties(sheetId,title))'});
     const properties=(meta.data.sheets||[]).map(s=>s.properties).find(p=>p?.title===sheet);
     if(!Number.isInteger(properties?.sheetId))throw Error('ARCHIVE_SHEET_NOT_FOUND');
     const rowIndex=selected.index+1; // values range begins at A2; Sheets indexes are zero-based
     await sheets.spreadsheets.batchUpdate({spreadsheetId,requestBody:{requests:[{
       deleteDimension:{range:{sheetId:properties.sheetId,dimension:'ROWS',startIndex:rowIndex,endIndex:rowIndex+1}}
     }]}});
     res.set('Cache-Control','no-store');
     return res.json({ok:true,id,deletedRecord:selected.item.reportName,cloudFilePreserved:true});
   }catch(error){
     console.error('Archive record delete failed:',error?.message);
     return res.status(500).json({ok:false,error:'ARCHIVE_DELETE_FAILED'});
   }
 });
 app.post('/api/report-archive/:id/failure',requireAuth_,authOrigin,async(req,res)=>{
   try{
     const id=String(req.params.id||'');
     if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({ok:false,error:'INVALID_ID'});
     const messages={
       PCLOUD_NOT_CONFIGURED:'لم يتم حفظ التقرير: إعدادات pCloud غير مكتملة',
       REPORT_NOT_READY:'تعذر تجهيز صفحات التقرير للحفظ',
       PDF_LIBRARY_UNAVAILABLE:'تعذر إنشاء PDF تلقائيًا (مكتبة PDF غير متاحة)',
       PDF_RENDER_FAILED:'تعذر إنشاء ملف PDF تلقائيًا',
       PDF_FILE_TOO_LARGE:'تعذر رفع PDF لأن حجمه يتجاوز الحد المسموح',
       UPLOAD_FAILED:'فشل رفع ملف PDF إلى pCloud'
     };
     const reason=String(req.body?.reason||'');
     if(!Object.hasOwn(messages,reason))return res.status(400).json({ok:false,error:'INVALID_REASON'});
     const {sheets,rows}=await load(),found=find(rows,id);
     if(!found)return res.status(404).json({ok:false,error:'NOT_FOUND'});
     if(found.item.email!==req.session.user?.email)return res.status(403).json({ok:false,error:'NOT_OWNER'});
     if(found.item.fileId)return res.status(409).json({ok:false,error:'ALREADY_ARCHIVED'});
     await sheets.spreadsheets.values.update({spreadsheetId,range:range('I'+(found.index+2)),valueInputOption:'RAW',requestBody:{values:[[messages[reason]]]}});
     res.json({ok:true,id});
   }catch(e){console.error('Archive failure status',e.message);res.status(500).json({ok:false,error:'ARCHIVE_STATUS_FAILED'})}
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
   }catch(e){
     const reason=String(e?.message||'UPLOAD_FAILED');
     console.error('Archive upload',reason);
     const safe=/^(?:WEBDAV_|PCLOUD_|INVALID_PCLOUD_)/.test(reason)?reason.slice(0,90):'UPLOAD_FAILED';
     res.status(502).json({ok:false,error:safe});
   }
 });
 app.get('/api/report-archive/file/:id',requireAuth_,async(req,res)=>{
   try{
     const {rows}=await load(),found=find(rows,String(req.params.id||''));
     if(!found?.item.fileId)return res.status(404).send('No saved report');
     if(!permitted(req)&&found.item.email!==req.session.user?.email)return res.status(403).send('Forbidden');
     if(!cloudEnabled)return res.status(503).send('pCloud not configured');
     if(found.item.fileId==='webdav'){
       const bytes=await getDavFile(found.item.folder);
       const ext=found.item.filename.split('.').pop().toLowerCase();
       const fallback=['pdf','xlsx','pptx','html','csv'].includes(ext)?'Report.'+ext:'Report';
       res.set('Cache-Control','private, no-store');
       res.set('Content-Type','application/octet-stream');
       res.set('Content-Disposition','attachment; filename="'+fallback+'"; filename*=UTF-8\'\''+encodeURIComponent(found.item.filename));
       return res.status(200).send(bytes);
     }
     const result=await cloud('getfilelink',{fileid:found.item.fileId,forcedownload:1});
     const url=new URL('https://'+String(result.hosts?.[0]||'')+String(result.path||''));
     if(!url.hostname.endsWith('.pcloud.com'))throw Error('UNTRUSTED_HOST');
     res.set('Cache-Control','no-store');res.redirect(302,url.toString());
   }catch(e){console.error('Archive download',e.message);res.status(502).send('Archive unavailable')}
 });
};
