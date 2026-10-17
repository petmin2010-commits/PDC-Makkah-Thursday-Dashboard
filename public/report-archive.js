(()=>{'use strict';
 const PAGE='reportArchivePage',byId=id=>document.getElementById(id);
 const state={items:[],pending:false,term:'',cloud:false,canDelete:false};
 const activeName=()=>document.querySelector('#nav .nav-item.active span')?.textContent?.trim()||'تقرير الداشبورد';
 const STORE='reports',DATABASE='vd-report-pcloud-pending-v1',inflight=new Set();
 let databasePromise=null,flushing=null;
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function openDatabase(){
  if(databasePromise)return databasePromise;
  databasePromise=new Promise(resolve=>{
   if(!('indexedDB' in window))return resolve(null);
   let req;
   try{req=indexedDB.open(DATABASE,1)}catch(error){console.warn('Archive IndexedDB unavailable',error);return resolve(null)}
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'clientKey'})};
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>{console.warn('Archive IndexedDB opening failed',req.error);resolve(null)};
   req.onblocked=()=>resolve(null);
  });
  return databasePromise;
 }
 async function pendingOperation(mode,job){
  const db=await openDatabase();if(!db)return mode==='get'?[]:false;
  return new Promise(resolve=>{
   try{
    const tx=db.transaction(STORE,mode==='get'?'readonly':'readwrite'),store=tx.objectStore(STORE);
    const request=mode==='get'?store.getAll():mode==='remove'?store.delete(job.clientKey):store.put(job);
    request.onsuccess=()=>resolve(mode==='get'?request.result||[]:true);
    request.onerror=()=>{console.warn('Archive queue failed',request.error);resolve(mode==='get'?[]:false)};
   }catch(e){console.warn('Archive queue transaction error',e);resolve(mode==='get'?[]:false)}
  });
 }
 const localAll=()=>pendingOperation('get');
 const localSave=job=>pendingOperation('put',job);
 const localDelete=job=>pendingOperation('remove',job);
 async function call(path,data){
  const r=await fetch(path,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(65000)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok)throw Error(j.error||'تعذر اتصال أرشفة التقارير');
  return j;
 }
 async function sendFile(id,blob,name){
  if(!(blob instanceof Blob)||blob.size<1)throw Error('REPORT_FILE_MISSING');
  let error;
  for(let i=0;i<3;i++){
   try{
    const r=await fetch('/api/report-archive/'+encodeURIComponent(id)+'/upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-Report-Filename':encodeURIComponent(name)},body:blob,signal:AbortSignal.timeout(180000)});
    const x=await r.json().catch(()=>({}));if(!r.ok||!x.ok)throw Error(x.error||'UPLOAD_FAILED');
    if(!x.url||x.verified!==true||!/^https:\/\//i.test(x.url))throw Error('PCLOUD_LINK_NOT_VERIFIED');
    return x;
   }catch(e){error=e;if(i<2)await wait(900*(i+1))}
  }
  throw error||Error('UPLOAD_FAILED');
 }
 function queueEvent(status,detail={}){try{window.dispatchEvent(new CustomEvent('vd:report-archive-status',{detail:{status,...detail}}))}catch(_){}}
 async function runJob(job,onRegistered){
  if(inflight.has(job.clientKey))return {ok:false,error:'UPLOAD_IN_PROGRESS',id:job.archiveId};
  inflight.add(job.clientKey);
  let created=null;
  try{
   created=await call('/api/report-archive',{reportName:job.reportName,format:job.format,filename:job.filename,clientKey:job.clientKey});
   job.archiveId=created.id;await localSave(job);
   if(typeof onRegistered==='function')onRegistered(created.id);
   if(!created.pcloudEnabled)throw Error('PCLOUD_NOT_CONFIGURED');
   const saved=created.alreadySaved&&created.url?{url:created.url,verified:true}:await sendFile(created.id,job.blob,job.filename);
   if(!saved?.verified||!saved.url)throw Error('PCLOUD_LINK_NOT_VERIFIED');
   await localDelete(job);
   queueEvent('archived',{id:created.id,url:saved.url});
   if(document.querySelector('.nav-item.active')?.dataset.page==='reportArchive')refresh();
   return {ok:true,id:created.id,url:saved.url,pcloudEnabled:true,verified:true};
  }catch(e){
   job.attempts=(job.attempts||0)+1;job.lastError=String(e.message||e);
   await localSave(job);
   if(job.archiveId)await call('/api/report-archive/'+encodeURIComponent(job.archiveId)+'/failure',{reason:job.lastError==='PCLOUD_NOT_CONFIGURED'?'PCLOUD_NOT_CONFIGURED':'UPLOAD_FAILED'}).catch(()=>{});
   queueEvent('pending',{id:job.archiveId,error:job.lastError});
   console.warn('Archive queued for retry',job.archiveId,job.lastError);
   return {ok:false,id:job.archiveId,archiveError:job.lastError,pending:true};
  }finally{inflight.delete(job.clientKey)}
 }
 async function record(input={}){
  const reportName=String(input.reportName||activeName()).trim(),format=String(input.format||'PDF').toUpperCase();
  const filename=String(input.filename||('VD_'+reportName+'.'+format.toLowerCase())).trim();
  // A browser print dialog does not yield an actual PDF Blob; never record an invented upload.
  if(!(input.blob instanceof Blob)||input.blob.size===0){
   console.warn('No electronic report file supplied; archive not registered:',reportName);
   queueEvent('file-missing',{error:'REPORT_FILE_MISSING',reportName});
   return {ok:false,archiveError:'REPORT_FILE_MISSING'};
  }
  const job={clientKey:crypto.randomUUID(),archiveId:null,reportName,format,filename,blob:input.blob,attempts:0,createdAt:Date.now()};
  const durable=await localSave(job);
  if(!durable)console.warn('Persistent archive queue unavailable: retry only while current tab remains open');
  return runJob(job,input.onRegistered);
 }
 async function archiveGeneratedPdf({report,win,selector,reportName,filename,onPdfReady,onProgress,onRegistered,wide=false}={}){
  let blob;
  try{
   const capture=window.VDReportPdfCapture;
   if(!capture)throw Error('PDF_LIBRARY_UNAVAILABLE');
   blob=win?(wide?await capture.createWindowPdfWide(win,selector,onProgress):await capture.createWindowPdf(win,selector,onProgress)):await capture.createPdf(report);
   if(!(blob instanceof Blob)||blob.size<800)throw Error('PDF_LIBRARY_UNAVAILABLE');
   if(typeof onPdfReady==='function')try{onPdfReady(blob)}catch(e){console.warn('Report viewer callback error',e)}
   const result=await record({reportName:reportName||activeName(),format:'PDF',filename:filename||'VD_Report.pdf',blob,onRegistered});
   return {...result,error:result.archiveError,blob};
  }catch(e){
   queueEvent('capture-failed',{error:String(e.message||e)});
   console.error('PDF generation failed; no archive row was registered:',e);
   return {ok:false,error:String(e.message||e),blob};
  }
 }
 async function flushPending(){
  if(flushing)return flushing;
  flushing=(async()=>{
   const jobs=await localAll();
   for(const job of jobs){
    if(inflight.has(job.clientKey))continue;
    if(!job.blob||!job.filename){await localDelete(job);continue}
    await runJob(job);
   }
  })().finally(()=>{flushing=null});
  return flushing;
 }
 window.VDReportArchive={record,sendFile,archiveGeneratedPdf,refresh:()=>refresh(),retryPending:flushPending,queueList:localAll};
 const onlineRetry=()=>{if(document.visibilityState!=='hidden'&&navigator.onLine!==false)flushPending().catch(console.warn)};
 window.addEventListener('online',onlineRetry);
 window.addEventListener('focus',onlineRetry);
 document.addEventListener('visibilitychange',onlineRetry);
 setInterval(onlineRetry,120000);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(onlineRetry,1200),{once:true});
 else setTimeout(onlineRetry,1200);
const el=(tag,txt)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=txt;return x};
 function render(){
  const page=byId(PAGE);if(!page)return;page.replaceChildren();
  const head=el('div');head.className='ra-head';const name=el('div');name.append(el('small','REPORT ARCHIVE'),el('h2','سجل التقارير الصادرة'),el('p','التاريخ والوقت بتوقيت السعودية | المُصدِر | اسم التقرير | رابط التقرير'));head.append(name);
  const refreshButton=el('button','تحديث ↻');refreshButton.addEventListener('click',refresh);head.append(refreshButton);
  const testButton=el('button','اختبار اتصال pCloud');
  testButton.addEventListener('click',async()=>{
    testButton.disabled=true;testButton.textContent='جاري اختبار الاتصال...';
    try{
      const status=await call('/api/report-archive/pcloud-status');
      if(status.connected)alert('تم الاتصال بـ pCloud بنجاح ('+(status.mode==='webdav'?'WebDAV ببريد الحساب وكلمة المرور':status.mode==='username-password'?'حساب وكلمة مرور':'رمز اتصال')+').');
      else if(!status.configured)alert('إعدادات pCloud غير مكتملة في Render. أضف PCLOUD_USERNAME و PCLOUD_PASSWORD أو PCLOUD_ACCESS_TOKEN.');
      else if(String(status.error||'').includes('WEBDAV_LOGIN_CONFIRMATION_REQUIRED'))alert('يطلب pCloud تأكيد تسجيل دخول WebDAV من البريد الإلكتروني. افتح رسالة New login attempt واضغط Yes, it’s me ثم جرّب مرة أخرى.');
      else if(String(status.error||'').includes('1022'))alert('pCloud يطلب رمز تحقق إضافيًا (1022)، وربما تكون المصادقة الثنائية مفعّلة. لا تضع رمز التحقق أو كلمة المرور في المحادثة؛ أكمل التفويض من حساب pCloud.');
      else alert('تعذر اتصال pCloud: '+(status.error||'تحقق من البريد وكلمة المرور وموقع الخادم.'));
    }catch(error){alert('فشل اختبار الاتصال: '+error.message)}
    finally{testButton.disabled=false;testButton.textContent='اختبار اتصال pCloud'}
  });
  head.append(testButton);page.append(head);
  const items=window.VDReportArchiveFilters?.mount(page,state.items,render)
    ||state.items.filter(i=>[i.date,i.time,i.issuer,i.reportName,i.format,i.filename].join(' ').toLowerCase().includes(state.term.toLowerCase()));
  const wrap=el('div');wrap.className='ra-grid';const table=el('table');wrap.append(table);page.append(wrap);
  const thead=el('thead');table.append(thead);const titles=el('tr');
  ['التاريخ','الوقت','المُصدِر','اسم التقرير','الصيغة','حالة الحفظ','رابط التقرير','pCloud'].forEach(x=>titles.append(el('th',x)));thead.append(titles);
  const tbody=el('tbody');table.append(tbody);
  for(const item of items){
    const row=el('tr');tbody.append(row);
    ['date','time','issuer','reportName','format','status'].forEach(k=>row.append(el('td',item[k]||'—')));
    const td=el('td');row.append(td);
    if(item.url){const a=el('a','فتح التقرير ↗');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';td.append(a)}else td.append(el('span','لم تُحفظ نسخة'));
    const actions=el('td');row.append(actions);
    const link=el('button','إضافة رابط');link.addEventListener('click',()=>linkRecord(item));actions.append(link);
    if(state.cloud&&!item.fileId){const upload=el('button',/فشل|تعذر|لم يكتمل/i.test(item.status||'')?'إعادة رفع':'رفع ملف');upload.addEventListener('click',()=>pickFile(item));actions.append(upload)}
    if(state.canDelete&&item.id){const remove=el('button','حذف السجل');remove.className='ra-delete-record';remove.title='حذف هذا السجل فقط دون حذف ملف pCloud';remove.addEventListener('click',()=>deleteArchiveRow(item,remove));actions.append(remove)}
  }
  if(!items.length){const row=el('tr'),cell=el('td','لا توجد تقارير مطابقة');cell.colSpan=8;row.append(cell);tbody.append(row)}
  const note=el('p',state.cloud?'إعدادات pCloud موجودة. اضغط «اختبار اتصال pCloud» للتحقق من إمكانية رفع وتنزيل الملفات. لا يُعتبر أي تقرير محفوظًا حتى تتغير حالة السجل إلى «محفوظ في pCloud».':'pCloud غير مهيأ حاليًا؛ يمكنك إضافة رابط تقرير محفوظ يدويًا.');note.className='ra-note';page.append(note);
 }
 async function refresh(){
  if(state.pending)return;state.pending=true;
  try{const data=await call('/api/report-archive');state.items=data.items||[];state.cloud=!!data.pcloudEnabled;state.canDelete=data.canDelete===true;render()}
  catch(e){const page=byId(PAGE);page.replaceChildren(el('h3','تعذر فتح السجل'),el('p',e.message));const b=el('button','إعادة المحاولة');b.addEventListener('click',refresh);page.append(b)}
  finally{state.pending=false}
 }
 async function linkRecord(item){const url=prompt('ألصق رابط مشاركة التقرير من pCloud (https://):',item.url||'');if(!url)return;try{await call('/api/report-archive/'+encodeURIComponent(item.id)+'/link',{url});await refresh()}catch(e){alert('لم يُحفظ الرابط: '+e.message)}}
 async function deleteArchiveRow(item,button){
   if(!state.canDelete||!item?.id)return;
   const details=[item.reportName||'تقرير',item.date||'',item.time||''].filter(Boolean).join(' — ');
   if(!confirm('هل تريد حذف سجل التقرير التالي نهائيًا؟\n'+details+'\n\nسيتم حذف السجل المحدد فقط. لن يتم حذف الملف المخزن على pCloud، لكن رابط السجل لن يعمل بعد حذفه.'))return;
   button.disabled=true;
   button.textContent='جار الحذف...';
   try{
     const response=await fetch('/api/report-archive/'+encodeURIComponent(item.id),{method:'DELETE',credentials:'same-origin'});
     const data=await response.json().catch(()=>({}));
     if(!response.ok||!data.ok)throw Error(data.error||'تعذر حذف السجل');
     state.items=state.items.filter(entry=>entry.id!==item.id);
     render();
     await refresh();
   }catch(error){
     button.disabled=false;
     button.textContent='حذف السجل';
     alert('تعذر حذف السجل: '+error.message);
   }
 }
 function pickFile(item){
  const input=el('input');input.type='file';input.accept='.'+item.format.toLowerCase();
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    if(file.name.split('.').pop().toUpperCase()!==item.format){alert('صيغة الملف غير مطابقة');return}
    try{await sendFile(item.id,file,file.name);await refresh()}catch(e){alert('لم يُرفع الملف: '+e.message)}
  });input.click();
 }
 function show(){
  document.body.classList.add('vd-report-archive-active');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  byId(PAGE)?.classList.add('active');
  document.querySelectorAll('#nav .nav-item').forEach(p=>p.classList.toggle('active',p.dataset.page==='reportArchive'));
  if(byId('filterBar'))byId('filterBar').style.display='none';
  if(byId('pageTitle'))byId('pageTitle').textContent='سجل التقارير الصادرة';
  refresh();
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('#nav .nav-item');if(!b)return;
  if(b.dataset.page==='reportArchive'){e.preventDefault();e.stopImmediatePropagation();show()}
  else {document.body.classList.remove('vd-report-archive-active');byId(PAGE)?.classList.remove('active');}
 },true);
})();
