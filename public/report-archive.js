(()=>{'use strict';
 const PAGE='reportArchivePage',byId=id=>document.getElementById(id);
 const state={items:[],pending:false,term:'',cloud:false,canDelete:false};
 const activeName=()=>document.querySelector('#nav .nav-item.active span')?.textContent?.trim()||'تقرير الداشبورد';
 let recent=null;
 async function call(path,data){
   const r=await fetch(path,{method:data?'POST':'GET',credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
   const j=await r.json().catch(()=>({}));
   if(!r.ok||!j.ok)throw Error(j.error||'فشل الاتصال بسجل التقارير');
   return j;
 }
 async function sendFile(id,blob,name){
   const r=await fetch('/api/report-archive/'+encodeURIComponent(id)+'/upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-Report-Filename':encodeURIComponent(name)},body:blob});
   const x=await r.json().catch(()=>({}));if(!r.ok||!x.ok)throw Error(x.error||'فشل حفظ الملف على pCloud');return x;
 }
 async function record(input={}){
   const reportName=String(input.reportName||activeName()).trim(),format=String(input.format||'PDF').toUpperCase();
   const filename=String(input.filename||('VD_'+reportName+'.'+format.toLowerCase())).trim();
   const key=reportName+'|'+format+'|'+filename;
   if(recent&&recent.key===key&&Date.now()-recent.at<4000)return recent.job;
   const job=(async()=>{
     try{
       const result=await call('/api/report-archive',{reportName,format,filename});
       if(input.blob){
         if(!result.pcloudEnabled){
           result.archiveError='PCLOUD_NOT_CONFIGURED';
           await call('/api/report-archive/'+encodeURIComponent(result.id)+'/failure',{reason:'PCLOUD_NOT_CONFIGURED'}).catch(e=>console.warn('Archive status update failed',e.message));
         }else{
           try{
             const saved=await sendFile(result.id,input.blob,filename);
             result.url=saved.url;
           }catch(e){
             result.archiveError=e.message;
             console.warn('Archive upload',e.message);
             await call('/api/report-archive/'+encodeURIComponent(result.id)+'/failure',{reason:'UPLOAD_FAILED'}).catch(err=>console.warn('Archive status update failed',err.message));
           }
         }
       }
       if(document.querySelector('.nav-item.active')?.dataset?.page==='reportArchive')refresh();
       return result;
     }catch(e){console.error('Report archive:',e.message);return null}
   })();
   recent={key,at:Date.now(),job};return job;
 }
 async function archiveGeneratedPdf({report,win,selector,reportName,filename,onPdfReady,onProgress,onRegistered}={}){
   const name=String(filename||('VD_'+(reportName||activeName())+'.pdf'));
   // Register before any heavy PDF rendering. Avoid blocking rendering on Sheets.
   const registration=record({reportName:reportName||activeName(),format:'PDF',filename:name})
     .then(created=>{
       if(created?.id&&typeof onRegistered==='function'){
         try{onRegistered(created.id)}catch(e){console.warn('Archive progress callback failed',e)}
       }
       return created;
     });
   let created=null,blob;
   try{
     // Generate a usable PDF even if the archive service is unavailable.
     blob=win?await window.VDReportPdfCapture?.createWindowPdf(win,selector,onProgress):await window.VDReportPdfCapture?.createPdf(report);
     if(!(blob instanceof Blob))throw Error('PDF_LIBRARY_UNAVAILABLE');
     // Reveal the preopened PDF tab as soon as rendering finishes, without awaiting upload.
     if(typeof onPdfReady==='function'){
       try{onPdfReady(blob)}catch(viewError){console.error('PDF viewer failed',viewError)}
     }
     // Complete the already-started registration and update its pCloud link.
     created=await registration;
     if(!created)return {ok:false,error:'REGISTRATION_FAILED',blob};
     if(!created.pcloudEnabled){
       await call('/api/report-archive/'+encodeURIComponent(created.id)+'/failure',{reason:'PCLOUD_NOT_CONFIGURED'}).catch(e=>console.warn('Archive status update failed',e.message));
       if(document.querySelector('.nav-item.active')?.dataset?.page==='reportArchive')refresh();
       return {ok:false,id:created.id,error:'PCLOUD_NOT_CONFIGURED',blob};
     }
     const saved=await sendFile(created.id,blob,name);
     if(document.querySelector('.nav-item.active')?.dataset?.page==='reportArchive')refresh();
     console.info('PDF archived to pCloud',created.id);
     return {ok:true,id:created.id,url:saved.url,blob};
   }catch(error){
     // Even failed PDF rendering must leave a traceable archive record.
     if(!created)created=await registration;
     const code=String(error?.message||'PDF_RENDER_FAILED');
     const reason=code.startsWith('PDF_FILE_SIZE')?'PDF_FILE_TOO_LARGE':code==='REPORT_NOT_READY'?'REPORT_NOT_READY':code==='PDF_LIBRARY_UNAVAILABLE'?'PDF_LIBRARY_UNAVAILABLE':/^(UPLOAD_|WEBDAV_|PCLOUD_)/.test(code)?'UPLOAD_FAILED':'PDF_RENDER_FAILED';
     if(created){
       try{await call('/api/report-archive/'+encodeURIComponent(created.id)+'/failure',{reason})}catch(e){console.warn('Report archive status update failed',e.message)}
     }
     console.error('Automatic PDF archive failed',reason,code);
     return {ok:false,id:created?.id,error:reason,blob};
   }
 }
 window.VDReportArchive={record,sendFile,archiveGeneratedPdf,refresh:()=>refresh()};
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
