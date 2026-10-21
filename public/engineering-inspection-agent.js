/* Vision Dimensions | Engineering image inspection agent | Makkah/Jeddah */
(()=>{
 'use strict';
 const PAGE='engineeringInspectionPage', NAV='engineeringInspectionNav';
 const $=id=>document.getElementById(id);
 const apiRoot='/api/engineering-inspections';
 const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const state={images:[],analysis:null,records:[],configured:false,busy:false};
 const getVal=id=>($(id)?.value||'').trim();
 async function api(path='',data,method){
   const r=await fetch(apiRoot+path,{credentials:'same-origin',cache:'no-store',method:method||(data?'POST':'GET'),headers:{...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok||!j.ok)throw Error(j.error==='AI_NOT_CONFIGURED'?'التحليل الآلي غير مُفعّل. أضف OPENAI_API_KEY إلى بيئة Render الخاصة بالمشروع.':j.error==='NO_INSPECTION_PERMISSION'?'ليس لديك صلاحية استخدام وكيل الفحص.':j.error||'تعذر اتصال الخادم');
   return j;
 }
 function notice(msg,error=false){const n=$('eiNotice');if(!n)return;n.textContent=msg;n.classList.toggle('error',error);n.hidden=!msg;}
 function wait(value){state.busy=value;['eiAnalyze','eiSave','eiRefresh'].forEach(id=>{if($(id))$(id).disabled=value});$('eiAnalyze').textContent=value?'جارٍ فحص الصور...':'فحص الصور بالوكيل الذكي';}
 function html(){return `<div class="ei-layout">
 <div class="ei-header"><div><small>VISION DIMENSIONS · AI ENGINEERING QUALITY</small><h2>وكيل الفحص الهندسي الذكي للصور</h2><p>تحليل بصري أولي لجودة التنفيذ والسلامة، مرتبط برقم أمر العمل. القرار النهائي لمهندس الجودة.</p></div><span id="eiApiStatus" class="ei-pill">فحص اتصال الوكيل...</span></div>
 <div id="eiNotice" class="ei-notice" hidden></div>
 <div class="ei-stats"><div><small>سجلات الفحص</small><strong id="eiTotal">0</strong></div><div><small>بانتظار مراجعة المهندس</small><strong id="eiPending">0</strong></div><div><small>ملاحظات مرصودة</small><strong id="eiCount">0</strong></div><div><small>معتمدة بعد المراجعة</small><strong id="eiApproved">0</strong></div></div>
 <div class="ei-columns"><section class="ei-panel"><h3>1. بيانات الفحص وصور التنفيذ</h3>
 <div class="ei-fields"><label>رقم أمر العمل <span>*</span><input id="eiWo" placeholder="رقم أمر العمل" maxlength="100" required></label><label>اسم المقاول<input id="eiContractor" placeholder="اسم المقاول" maxlength="180"></label>
 <label>مهندس الموقع<input id="eiEngineer" placeholder="اسم المهندس" maxlength="180"></label><label>نوع الأعمال<select id="eiType"><option value="">اختر...</option><option>الحفر</option><option>الردم</option><option>تمديد الكابلات</option><option>غرف التفتيش</option><option>المحولات</option><option>الخرسانة</option><option>الكابلات والوصلات</option><option>اختبارات الأصول</option><option>أعمال الطوارئ</option><option>أخرى</option></select></label>
 <label class="ei-wide">الموقع / الوصف<input id="eiLocation" maxlength="200" placeholder="موقع المشروع أو وصف الأعمال"></label>
 <label class="ei-wide">المواصفات أو المرجع الفني (اختياري)<textarea id="eiReference" rows="3" maxlength="3500" placeholder="رقم المخطط المعتمد، بند المواصفة، تعليمات الجودة أو معايير الفحص"></textarea></label>
 </div><div class="ei-photo-toolbar"><label>نمط الصور <select id="eiPhotoMode"><option value="site">صور تنفيذ متعددة</option><option value="before-after">قبل المعالجة وبعدها (بنفس الترتيب)</option></select></label></div>
 <label class="ei-upload"><span>📷</span><b>اختر صور التنفيذ أو اسحبها هنا</b><small>من 1 إلى 3 صور JPG/PNG/WebP، تُضغط تلقائيًا قبل الفحص</small><input id="eiUpload" type="file" accept="image/png,image/jpeg,image/webp" multiple></label>
 <div class="ei-photos" id="eiPhotos"></div><p class="ei-hint">تُرسل الصور لخدمة التحليل فقط عند الضغط على الفحص. سجلات الفحص تحفظ النص والبيانات، وليس ملفات الصور الأصلية.</p>
 <button id="eiAnalyze" class="ei-primary" type="button">فحص الصور بالوكيل الذكي</button></section>
 <section class="ei-panel"><h3>2. نتائج الفحص والملاحظات</h3><div id="eiResult" class="ei-placeholder"><span>🔍</span><p>أضف بيانات أمر العمل وصوره، ثم ابدأ الفحص للحصول على ملاحظات مبدئية وإجراءات تصحيحية مقترحة.</p></div>
 <div class="ei-result-actions"><button id="eiSave" type="button" disabled>حفظ الفحص في سجل الجودة</button><button id="eiPrint" type="button" disabled>طباعة / PDF</button></div></section></div>
 <section class="ei-panel ei-history"><div class="ei-history-head"><div><h3>3. سجل فحوصات المشروع</h3><small>يُحفظ في ورقة مستقلة مخفية بـ Google Sheets الخاصة بكل مشروع</small></div><button id="eiRefresh" type="button">↻ تحديث السجل</button></div>
 <div class="ei-history-tools"><input id="eiSearch" placeholder="البحث بأمر العمل أو المقاول أو المهندس" aria-label="بحث سجلات الفحص"><select id="eiStatusFilter"><option value="">كل الحالات</option><option>قيد المراجعة</option><option>معتمدة بعد المراجعة</option><option>تحتاج إعادة فحص</option><option>مغلقة</option></select></div><div id="eiHistory" class="ei-records"></div></section>
 <p class="ei-disclaimer">تحليل الذكاء الاصطناعي استرشادي، ولا يغني عن التحقق الميداني والاختبارات وقياس الأبعاد والرجوع للمخططات والمواصفات المعتمدة. لا تُسجّل نتيجة النموذج كمخالفة نهائية تلقائيًا.</p>
 </div>`}
 function meta(){return{workOrder:getVal('eiWo'),contractor:getVal('eiContractor'),engineer:getVal('eiEngineer'),workType:getVal('eiType'),location:getVal('eiLocation'),referenceNotes:getVal('eiReference'),photoMode:getVal('eiPhotoMode')}}
 function renderImages(){const host=$('eiPhotos');if(!host)return;host.innerHTML=state.images.map((img,i)=>`<div class="ei-photo"><img src="${img.data}" alt="صورة تنفيذ ${i+1}"><div><small>${esc(img.name)}</small><button data-remove-photo="${i}" type="button" aria-label="إزالة الصورة">×</button></div></div>`).join('');}
 async function convert(file){
   if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('صيغة الملف غير مدعومة: '+file.name);
   if(file.size>15*1024*1024)throw Error('الصورة كبيرة جدًا (أقصى حجم 15 ميجابايت).');
   const url=URL.createObjectURL(file);
   try{const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('تعذر قراءة الصورة'));im.src=url});
     let edge=1150,quality=.74,data='';
     for(let i=0;i<7;i++){const factor=Math.min(1,edge/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*factor));canvas.height=Math.max(1,Math.round(img.height*factor));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',quality);if(data.length<235000)break;edge=Math.round(edge*.82);quality=Math.max(.48,quality-.06)}
     if(data.length>=260000)throw Error('تعذر ضغط الصورة بالشكل المطلوب: '+file.name);
     return{name:file.name,data};
   }finally{URL.revokeObjectURL(url)}
 }
 async function onUpload(e){
   const files=[...(e.target.files||[])];
   if(state.images.length+files.length>3){notice('الحد الأقصى 3 صور للفحص الواحد.',true);return;}
   try{for(const file of files)state.images.push(await convert(file));renderImages();notice('تم تجهيز '+state.images.length+' صورة للفحص.');}catch(err){notice(err.message,true)}finally{e.target.value='';}
 }
 function findingHtml(f,i){return `<article class="ei-finding"><div class="ei-finding-head"><b>${i+1}. ${esc(f.title||'ملاحظة محتملة')}</b><div><span class="ei-tag">${esc(f.category||'تنفيذ')}</span><span class="ei-tag">الأهمية: ${esc(f.severity||'غير محددة')}</span><span class="ei-tag">الثقة: ${esc(f.confidence||'غير محددة')}</span></div></div><p><b>الدليل البصري:</b> ${esc(f.evidence)}</p><p><b>الإجراء المقترح:</b> ${esc(f.recommendation)}</p><p><b>يلزم التحقق من:</b> ${esc(f.verification)}</p></article>`}
 function renderAnalysis(){const a=state.analysis;if(!a)return;
   $('eiResult').innerHTML=`<div class="ei-result-intro"><strong>ملخص الفحص</strong><p>${esc(a.summary||'لم يرد ملخص.')}</p></div><div class="ei-finding-list">${a.findings?.length?a.findings.map(findingHtml).join(''):'<p class="ei-no-findings">لم تُرصد ملاحظات واضحة في الصور، وهذا لا يعني اعتماد جودة التنفيذ.</p>'}</div><div class="ei-limit"><b>حدود الفحص البصري:</b> ${esc(a.visibilityLimits||'يلزم الرجوع إلى المواصفات والفحص الميداني.')}</div>`;
   $('eiSave').disabled=false;$('eiPrint').disabled=false;
 }
 async function analyze(){
   if(!getVal('eiWo'))return notice('أدخل رقم أمر العمل أولًا.',true);
   if(!state.images.length)return notice('ارفع صورة واحدة على الأقل.',true);
   wait(true);notice('جارٍ تحليل الصور؛ النتيجة أولية وتحتاج مراجعة مهندس الجودة.');
   try{const result=await api('/analyze',{...meta(),images:state.images.map(x=>x.data)});state.analysis=result.analysis;renderAnalysis();notice('تم فحص الصور. راجع الملاحظات واحفظ السجل إذا لزم.');}
   catch(err){notice(err.message,true)}finally{wait(false)}
 }
 async function save(){if(!state.analysis)return;wait(true);
   try{const result=await api('',{...meta(),analysis:state.analysis,imageCount:state.images.length});notice('تم حفظ الفحص '+result.record.id+' كمسودة قيد المراجعة. الصور الأصلية غير محفوظة في السجل.');await loadRecords();}
   catch(err){notice(err.message,true)}finally{wait(false)}
 }
 function reportMarkup(record){const m=record||{...meta(),...state.analysis,createdAt:new Date().toISOString(),status:'مسودة تحليل أولي'};const a=record?{summary:record.summary,findings:record.findings,visibilityLimits:'يراجع المهندس الصور والمواصفات المعتمدة قبل اعتماد الملاحظات.'}:state.analysis;
   return `<h1>تقرير الفحص الهندسي الذكي للصور</h1><p>أبعاد الرؤية للاستشارات الهندسية · ${esc(document.title)}</p><table><tr><th>رقم أمر العمل</th><td>${esc(m.workOrder)}</td><th>المقاول</th><td>${esc(m.contractor)}</td></tr><tr><th>المهندس</th><td>${esc(m.engineer)}</td><th>نوع العمل</th><td>${esc(m.workType)}</td></tr><tr><th>الموقع</th><td>${esc(m.location)}</td><th>الحالة</th><td>${esc(m.status)}</td></tr></table><h2>ملخص الفحص</h2><p>${esc(a.summary)}</p>${a.findings?.map(findingHtml).join('')||'<p>لا توجد ملاحظات مرصودة.</p>'}<p><b>حدود الفحص:</b> ${esc(a.visibilityLimits||'لا يُعتمد الفحص البصري دون مراجعة هندسية.')}</p><p><b>المرجع المقدم:</b> ${esc(m.referenceNotes)}</p><footer>هذا تقرير آلي أولي؛ يتطلب مراجعة مهندس الجودة واعتماد نتائج التحقق الميداني.</footer>`;
 }
 function printReport(record){if(!record&&!state.analysis)return;const w=window.open('','_blank');if(!w)return notice('يرجى السماح بالنوافذ المنبثقة.',true);const css=`body{font:15px Arial,Tahoma,sans-serif;direction:rtl;padding:28px;color:#15263a}h1{color:#183b63}table{width:100%;border-collapse:collapse}td,th{border:1px solid #cad5e1;padding:10px;text-align:right}.ei-finding{border:1px solid #d5dce5;margin:12px 0;padding:12px;border-radius:9px}.ei-tag{margin:0 6px}footer{border-top:1px solid #aaa;margin-top:25px;padding-top:12px;color:#555}@page{size:A4;margin:15mm}`;
   w.document.open();w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Engineering_Inspection_'+esc(record?.workOrder||getVal('eiWo'))+'</title><style>'+css+'</style></head><body>'+reportMarkup(record)+'</body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),500);
 }
 function renderRecords(){let r=state.records||[];const search=getVal('eiSearch').toLowerCase(),status=getVal('eiStatusFilter');r=r.filter(x=>(!status||x.status===status)&&(!search||[x.workOrder,x.contractor,x.engineer].some(t=>String(t||'').toLowerCase().includes(search))));
   $('eiTotal').textContent=state.records.length;$('eiPending').textContent=state.records.filter(x=>x.status==='قيد المراجعة').length;$('eiApproved').textContent=state.records.filter(x=>x.status==='معتمدة بعد المراجعة').length;$('eiCount').textContent=state.records.reduce((n,x)=>n+(x.findings?.length||0),0);
   $('eiHistory').innerHTML=r.length?r.map(x=>`<article class="ei-record"><div class="ei-record-top"><strong>${esc(x.workOrder)}</strong><span class="ei-tag">${esc(x.status)}</span><small>${esc((x.createdAt||'').slice(0,16).replace('T',' '))}</small></div><div><b>${esc(x.contractor||'مقاول غير محدد')}</b> · ${esc(x.workType||'نوع غير محدد')} · ${x.findings?.length||0} ملاحظات</div><p>${esc(x.summary||'')}</p><div class="ei-record-actions"><button data-print="${esc(x.id)}">طباعة</button><button data-review="${esc(x.id)}" data-status="معتمدة بعد المراجعة">اعتماد بعد التحقق</button><button data-review="${esc(x.id)}" data-status="تحتاج إعادة فحص">إعادة فحص</button><button data-review="${esc(x.id)}" data-status="مغلقة">إغلاق</button></div><small>المراجع: ${esc(x.reviewer||'لم يحدد')} · الصور: ${x.imageCount||0} (غير مؤرشفة في هذا الإصدار)</small></article>`).join(''):'<div class="ei-placeholder">لا توجد سجلات مطابقة.</div>';
 }
 async function loadRecords(){try{const r=await api();state.records=r.records||[];renderRecords();}catch(err){notice('تعذر تحميل السجل: '+err.message,true)}}
 async function review(id,status){if(!confirm('هل تحققت هندسيًا من الملاحظات وتريد تحويل الحالة إلى «'+status+'»؟'))return;
   try{await api('/'+encodeURIComponent(id)+'/review',{status});await loadRecords();notice('تم تحديث حالة المراجعة.');}catch(err){notice(err.message,true)}
 }
 function open(){if(window.vdCanAccessLabel&&!window.vdCanAccessLabel('وكيل الفحص الهندسي الذكي'))return;
   document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(PAGE)?.classList.add('active');document.querySelectorAll('#nav .nav-item').forEach(x=>x.classList.toggle('active',x.id===NAV));const bar=$('filterBar');if(bar)bar.style.display='none';if($('pageTitle'))$('pageTitle').textContent='وكيل الفحص الهندسي الذكي';document.body.classList.add('ei-active');
 }
 function leave(){document.body.classList.remove('ei-active');$(PAGE)?.classList.remove('active');if($('filterBar'))$('filterBar').style.removeProperty('display')}
 function mount(){const nav=$(NAV),main=document.querySelector('main');if(!nav||!main||$(PAGE))return;
   const page=document.createElement('section');page.id=PAGE;page.className='page ei-page';page.innerHTML=html();main.insertBefore(page,main.firstChild);
   nav.onclick=e=>{e.stopImmediatePropagation();open()};
   document.querySelectorAll('#nav .nav-item').forEach(b=>{if(b!==nav)b.addEventListener('click',leave)});
   $('eiUpload').addEventListener('change',onUpload);$('eiPhotos').addEventListener('click',e=>{const b=e.target.closest('[data-remove-photo]');if(!b)return;state.images.splice(Number(b.dataset.removePhoto),1);renderImages()});
   $('eiAnalyze').onclick=analyze;$('eiSave').onclick=save;$('eiPrint').onclick=()=>printReport();$('eiRefresh').onclick=loadRecords;
   $('eiSearch').oninput=renderRecords;$('eiStatusFilter').onchange=renderRecords;
   $('eiHistory').onclick=e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.review||b.dataset.print;const rec=state.records.find(x=>x.id===id);if(!rec)return;if(b.dataset.print)printReport(rec);else review(id,b.dataset.status)};
   api('/status').then(r=>{$('eiApiStatus').textContent=r.configured?'الوكيل متصل · '+r.model:'يتطلب إعداد AI API';$('eiApiStatus').classList.toggle('ei-disabled',!r.configured);state.configured=r.configured;}).catch(()=>{$('eiApiStatus').textContent='تعذر فحص اتصال الوكيل'});
   loadRecords();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
