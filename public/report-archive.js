(()=>{'use strict';
 const PAGE='reportArchivePage',byId=id=>document.getElementById(id);
 const state={items:[],pending:false,term:'',cloud:false};
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
       if(input.blob&&result.pcloudEnabled){try{const saved=await sendFile(result.id,input.blob,filename);result.url=saved.url}catch(e){result.archiveError=e.message;console.warn('Archive upload',e.message)}}
       if(document.querySelector('.nav-item.active')?.dataset?.page==='reportArchive')refresh();
       return result;
     }catch(e){console.error('Report archive:',e.message);return null}
   })();
   recent={key,at:Date.now(),job};return job;
 }
 window.VDReportArchive={record,sendFile,refresh:()=>refresh()};
 window.addEventListener('beforeprint',()=>record({reportName:activeName(),format:'PDF',filename:(/^VD[_-]/i.test(document.title)?document.title:'VD_'+activeName())+'.pdf'}));
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
  const tools=el('div');tools.className='ra-controls';const search=el('input');search.type='search';search.placeholder='ابحث عن تقرير أو مُصدِر أو تاريخ';search.value=state.term;
  search.addEventListener('input',e=>{const start=e.target.selectionStart;state.term=e.target.value;render();const next=page.querySelector('input[type=search]');next.focus();next.setSelectionRange(start,start)});tools.append(search);
  const items=state.items.filter(i=>[i.date,i.time,i.issuer,i.reportName,i.format,i.filename].join(' ').toLowerCase().includes(state.term.toLowerCase()));
  tools.append(el('span',items.length+' تقرير'));page.append(tools);
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
    if(state.cloud){const upload=el('button','رفع ملف');upload.addEventListener('click',()=>pickFile(item));actions.append(upload)}
  }
  if(!items.length){const row=el('tr'),cell=el('td','لا توجد تقارير مطابقة');cell.colSpan=8;row.append(cell);tbody.append(row)}
  const note=el('p',state.cloud?'الحفظ التلقائي يعمل على ملفات Excel/PowerPoint/HTML. ملف PDF الصادر من نافذة الطباعة يحتاج إلى رفع نسخته بعد حفظها.':'pCloud غير متصل بعد؛ يمكنك إضافة رابط مشاركة تقرير محفوظ يدويًا.');note.className='ra-note';page.append(note);
 }
 async function refresh(){
  if(state.pending)return;state.pending=true;
  try{const data=await call('/api/report-archive');state.items=data.items||[];state.cloud=!!data.pcloudEnabled;render()}
  catch(e){const page=byId(PAGE);page.replaceChildren(el('h3','تعذر فتح السجل'),el('p',e.message));const b=el('button','إعادة المحاولة');b.addEventListener('click',refresh);page.append(b)}
  finally{state.pending=false}
 }
 async function linkRecord(item){const url=prompt('ألصق رابط مشاركة التقرير من pCloud (https://):',item.url||'');if(!url)return;try{await call('/api/report-archive/'+encodeURIComponent(item.id)+'/link',{url});await refresh()}catch(e){alert('لم يُحفظ الرابط: '+e.message)}}
 function pickFile(item){
  const input=el('input');input.type='file';input.accept='.'+item.format.toLowerCase();
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    if(file.name.split('.').pop().toUpperCase()!==item.format){alert('صيغة الملف غير مطابقة');return}
    try{await sendFile(item.id,file,file.name);await refresh()}catch(e){alert('لم يُرفع الملف: '+e.message)}
  });input.click();
 }
 function show(){
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
  else byId(PAGE)?.classList.remove('active');
 },true);
})();
