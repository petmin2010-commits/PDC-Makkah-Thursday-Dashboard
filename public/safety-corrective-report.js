(()=>{'use strict';
const PAGE='safetyCorrectivePage',NAV='safetyCorrectiveNav',API='/api/safety-corrective';
const state={report:null,findings:[],reports:[],current:null,photos:[],pending:{},photoDraft:{},loading:false,dirty:false};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').trim();
const photoRef=(r,f)=>r+'--'+f;
const city=/(جدة|Jeddah)/i.test(document.title)?'جدة':'مكة المكرمة';
const currentName=()=>state.report?.weekLabel||'تقرير السلامة';
const fmt=n=>Number(n||0).toLocaleString('en-US');
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s);
const today=()=>{const p={};new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(x=>{if(x.type!=='literal')p[x.type]=x.value});return p.year+'-'+p.month+'-'+p.day;};
async function request(url,method='GET',body){
 const res=await fetch(API+url,{method,headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body)});
 const j=await res.json().catch(()=>({}));
 if(!res.ok||!j.ok)throw new Error(j.error||'تعذر الاتصال بالخادم');
 return j;
}
function notice(message,error=false){const el=$('scrNotice');if(!el)return;el.textContent=message;el.className='scr-notice'+(error?' error':'');}
function buttonBusy(id,busy,text){const b=$(id);if(!b)return;if(!b.dataset.normalText)b.dataset.normalText=b.textContent;b.disabled=busy;b.textContent=busy?(text||'جارٍ الحفظ...'):b.dataset.normalText;}
function mount(){
 const nav=$(NAV),main=document.querySelector('main');if(!nav||!main||$(PAGE))return;
 const el=document.createElement('section');el.id=PAGE;el.className='page scr-page';el.innerHTML=markup();main.insertBefore(el,main.firstChild);
 nav.onclick=e=>{e.stopImmediatePropagation();open();};
 document.querySelectorAll('#nav .nav-item').forEach(b=>{if(b!==nav)b.addEventListener('click',leave)});
 $('scrCreate').addEventListener('click',create);
 $('scrSelect').addEventListener('change',e=>load(e.target.value));
 $('scrMetaSave').addEventListener('click',saveMeta);
 $('scrAddFinding').addEventListener('click',()=>selectFinding(null));
 $('scrSaveFinding').addEventListener('click',saveFinding);
 $('scrRemoveFinding').addEventListener('click',removeFinding);
 $('scrExport').addEventListener('click',printReport);
 $('scrFindingList').addEventListener('click',e=>{const b=e.target.closest('[data-finding]');if(b)selectFinding(b.dataset.finding)});
 $('scrPhotoGrid').addEventListener('change',photoChange);
 $('scrPhotoGrid').addEventListener('click',photoClick);
 $('scrPhotoGrid').addEventListener('input',e=>{if(e.target.matches('[data-caption]')){state.photoDraft[e.target.dataset.caption]=e.target.value;state.dirty=true}});
 $('scrMetaFields').addEventListener('input',()=>{$('scrMetaSave').classList.add('scr-unsaved')});
 refresh();
}
function markup(){return `
<div class="scr-hero"><div><small>SAFETY • CORRECTIVE ACTIONS</small><h2>تقرير السلامة والإجراءات التصحيحية</h2><p>تقرير أسبوعي موحد مع صور قبل المعالجة وبعد المعالجة، وتوثيق كل ملاحظة بصور قبل وبعد المعالجة، ووصف الحالة والإجراء التصحيحي.</p></div><div class="scr-toolbar"><button id="scrExport" type="button" disabled>تصدير PDF</button></div></div>
<div class="scr-line"><label>التقارير المحفوظة <select id="scrSelect"><option value="">اختر التقرير...</option></select></label><button id="scrCreate" type="button">+ إنشاء تقرير أسبوعي</button><span id="scrNotice" class="scr-notice">جاري تحميل التقارير...</span></div>
<div id="scrWorkspace" hidden>
<section class="scr-panel"><div class="scr-section-head"><h3>بيانات التقرير الأسبوعي</h3><button id="scrMetaSave" type="button">حفظ بيانات التقرير</button></div>
<div id="scrMetaFields" class="scr-grid">
<label>عنوان الأسبوع<input id="scrWeekLabel" maxlength="120" placeholder="الأسبوع الثاني - أكتوبر 2026"></label>
<label>من تاريخ<input id="scrStart" type="date"></label><label>إلى تاريخ<input id="scrEnd" type="date"></label>
<label>عدد المواقع الكلي<input id="scrSites" type="number" min="0"></label>
<label>عدد المواقع التي تمت زيارتها<input id="scrVisited" type="number" min="0"></label>
<label>عدد الزيارات الميدانية<input id="scrVisits" type="number" min="0"></label>
<label>معد التقرير<input id="scrPrepared" placeholder="الاسم أو المسمى الوظيفي" maxlength="180"></label>
<label class="scr-wide">ملاحظات التقرير العامة<textarea id="scrNotes" rows="2" maxlength="2000"></textarea></label>
</div></section>
<div id="scrKpis" class="scr-kpis"></div>
<section class="scr-panel"><div class="scr-section-head"><h3>الملاحظات والإجراءات التصحيحية</h3><button id="scrAddFinding" type="button">+ إضافة ملاحظة</button></div>
<div class="scr-master-detail"><div id="scrFindingList" class="scr-findings-list"></div>
<div class="scr-editor" id="scrEditor" hidden>
<div class="scr-reference-heading"><div><h4 id="scrEditorTitle">بيانات المعالجة والتوثيق</h4><p>نموذج إدخال مطابق لترتيب صفحة الملاحظة في التقرير: بيانات أمر العمل ← قبل المعالجة ← بعد المعالجة.</p></div><span class="scr-reference-pill">ملاحظة مستقلة لكل حالة</span></div>
<div id="scrPhotoGrid" class="scr-reference-layout">
<section class="scr-ref-card scr-ref-order" aria-label="بيانات أمر العمل">
<h5>بيانات أمر العمل</h5>
<div class="scr-ref-fields">
<label>رقم أمر العمل<input id="scrWO" inputmode="numeric" maxlength="40" placeholder="رقم أمر العمل"></label>
<label>المقاول<input id="scrContractor" maxlength="180" placeholder="اسم المقاول"></label>
<label>الاستشاري<input id="scrConsultant" maxlength="180" value="أبعاد الرؤية"></label>
<label>نوع أمر العمل<select id="scrType"><option value="">اختر نوع أمر العمل</option><option value="350">350</option><option value="360">360</option><option value="402">402</option><option value="801">801</option><option value="802">802</option><option value="طارئ">طارئ</option></select></label>
<label class="scr-ref-observation">الملاحظات المرصودة<textarea id="scrObservation" rows="5" maxlength="1700" placeholder="اكتب الملاحظة كما ستظهر في التقرير"></textarea></label>
<label>حالة الملاحظة<select id="scrStatus"><option>مفتوحة</option><option>جاري التصحيح</option><option>مغلقة</option></select></label>
</div></section>
<section class="scr-ref-card scr-ref-before" aria-label="قبل المعالجة">
<h5>قبل المعالجة</h5>
<div id="scrPhotoBefore" class="scr-phase-photos"></div>
<label class="scr-ref-description scr-description-reference">وصف الحالة<textarea id="scrBeforeDesc" rows="3" maxlength="1000" placeholder="وصف الحالة قبل المعالجة"></textarea></label>
</section>
<section class="scr-ref-card scr-ref-after" aria-label="بعد المعالجة">
<h5>بعد المعالجة</h5>
<div id="scrPhotoAfter" class="scr-phase-photos"></div>
<label class="scr-ref-description scr-description-reference">وصف الإجراء التصحيحي<textarea id="scrAction" rows="3" maxlength="1700" placeholder="الإجراء التصحيحي أو في انتظار التصحيح"></textarea></label>
<input id="scrAfterDesc" type="hidden" value="">
</section>
</div>
<div id="scrPhotoSection" hidden><p>تظهر معاينة الصور فور اختيارها، حتى قبل حفظ الملاحظة. اكتب وصف الحالة تحت صورة «قبل المعالجة»، ووصف الإجراء التصحيحي تحت صورة «بعد المعالجة»، ثم احفظ بيانات الملاحظة وصورها معًا.</p></div>
<div class="scr-editor-actions"><button id="scrSaveFinding" type="button">حفظ بيانات الملاحظة</button><button id="scrRemoveFinding" class="scr-danger" type="button" hidden>حذف الملاحظة</button></div>
</div></div></section></div>`}
function open(){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(PAGE).classList.add('active');document.querySelectorAll('#nav .nav-item').forEach(x=>x.classList.toggle('active',x.id===NAV));const bar=$('filterBar');if(bar)bar.style.display='none';const title=$('pageTitle');if(title)title.textContent='تقرير السلامة والإجراءات التصحيحية';document.body.classList.add('scr-open');}
function leave(){document.body.classList.remove('scr-open');$(PAGE)?.classList.remove('active');const bar=$('filterBar');if(bar)bar.style.display='';}
function getMeta(){return {weekLabel:clean($('scrWeekLabel').value),startDate:$('scrStart').value,endDate:$('scrEnd').value,totalSites:Number($('scrSites').value||0),visitedSites:Number($('scrVisited').value||0),totalVisits:Number($('scrVisits').value||0),preparedBy:clean($('scrPrepared').value),notes:clean($('scrNotes').value)}}
function fillMeta(r){$('scrWeekLabel').value=r.weekLabel||'';$('scrStart').value=r.startDate||'';$('scrEnd').value=r.endDate||'';$('scrSites').value=r.totalSites||0;$('scrVisited').value=r.visitedSites||0;$('scrVisits').value=r.totalVisits||0;$('scrPrepared').value=r.preparedBy||'';$('scrNotes').value=r.notes||'';$('scrWorkspace').hidden=false;$('scrExport').disabled=false;$('scrMetaSave').classList.remove('scr-unsaved');}
function validateMeta(x){if(!validDate(x.startDate)||!validDate(x.endDate)||x.startDate>x.endDate)throw Error('حدد فترة زمنية صحيحة.');if(x.visitedSites>x.totalSites)throw Error('المواقع التي تمت زيارتها لا يمكن أن تتجاوز إجمالي المواقع.')}
async function refresh(){try{const j=await request('/reports');state.reports=j.reports||[];$('scrSelect').innerHTML='<option value="">اختر تقريرًا محفوظًا...</option>'+state.reports.map(r=>'<option value="'+esc(r.id)+'">'+esc((r.weekLabel||'تقرير')+' • '+r.startDate+' / '+r.endDate)+'</option>').join('');if(state.report)$('scrSelect').value=state.report.id;notice('اختر تقريرًا أو أنشئ تقريرًا جديدًا.')}catch(e){notice(e.message,true)}}
async function create(){
 if(!confirm('إنشاء تقرير أسبوعي جديد؟'))return;
 const d=today(),start=new Date(d+'T12:00:00');start.setDate(start.getDate()-6);
 const from=start.getFullYear()+'-'+String(start.getMonth()+1).padStart(2,'0')+'-'+String(start.getDate()).padStart(2,'0');
 buttonBusy('scrCreate',true);
 try{const j=await request('/reports','POST',{startDate:from,endDate:d,weekLabel:'تقرير أسبوعي – '+d,totalSites:0,visitedSites:0,totalVisits:0});await refresh();await load(j.report.id);notice('تم إنشاء التقرير، ويمكنك الآن إضافة الملاحظات والصور.')}catch(e){notice(e.message,true)}finally{buttonBusy('scrCreate',false)}
}
async function load(id){
 if(!id){state.report=null;state.findings=[];state.current=null;$('scrWorkspace').hidden=true;$('scrExport').disabled=true;return}
 notice('جارٍ تحميل التقرير...');
 try{const j=await request('/reports/'+encodeURIComponent(id));state.report=j.report;$('scrSelect').value=j.report.id;state.findings=j.findings||[];state.current=null;state.photos=[];state.pending={};state.photoDraft={};state.dirty=false;fillMeta(j.report);renderKpis();renderFindings();$('scrEditor').hidden=true;notice('تم تحميل التقرير • '+state.findings.length+' ملاحظة.')}catch(e){notice(e.message,true)}
}
async function saveMeta(){const data=getMeta();try{validateMeta(data);buttonBusy('scrMetaSave',true);const j=await request('/reports/'+state.report.id,'PUT',data);state.report=j.report;fillMeta(state.report);await refresh();renderKpis();notice('تم حفظ بيانات التقرير.')}catch(e){notice(e.message,true)}finally{buttonBusy('scrMetaSave',false)}}
function renderKpis(){
 const r=state.report||{},total=state.findings.length,closed=state.findings.filter(f=>f.status==='مغلقة').length,open=state.findings.filter(f=>f.status!=='مغلقة').length;
 const coverage=r.totalSites?Math.round(r.visitedSites/r.totalSites*1000)/10:0;
 const items=[['المواقع المستهدفة',fmt(r.totalSites)],['المواقع التي تمت زيارتها',fmt(r.visitedSites)],['عدد الزيارات',fmt(r.totalVisits)],['تغطية المواقع',coverage.toLocaleString('en-US')+'%'],['ملاحظات السلامة',fmt(total)],['مفتوحة / جاري التصحيح',fmt(open)],['مغلقة',fmt(closed)]];
 $('scrKpis').innerHTML=items.map(a=>'<div class="scr-kpi"><small>'+a[0]+'</small><strong>'+a[1]+'</strong></div>').join('');
}
function renderFindings(){
 const list=$('scrFindingList'),has=state.findings.length>0;
 list.innerHTML=has?state.findings.map((f,i)=>'<button type="button" class="scr-finding'+(state.current===f.id?' active':'')+'" data-finding="'+esc(f.id)+'"><b>ملاحظة '+(i+1)+' • '+esc(f.workOrder||'بدون رقم')+'</b><span>'+esc(f.observation||'لا يوجد وصف بعد')+'</span><small>'+esc(f.contractor||'المقاول غير محدد')+' · '+esc(f.status)+'</small></button>').join(''):'';
 list.hidden=!has;
 list.parentElement.classList.toggle('scr-has-list',has);
}
function selectFinding(id){
 const f=state.findings.find(x=>x.id===id)||{id:'',workOrder:'',contractor:'',consultant:'أبعاد الرؤية',workType:'',observation:'',correctiveAction:'',status:'مفتوحة',beforeDescription:'',afterDescription:''};
 if(state.dirty&&!confirm('توجد صور أو تعليقات لم تحفظ. هل تريد الانتقال دون حفظها؟'))return;state.current=f.id||null;state.photos=[];state.pending={};state.photoDraft={};state.dirty=false;
 for(const [field,key] of [['scrWO','workOrder'],['scrType','workType'],['scrContractor','contractor'],['scrConsultant','consultant'],['scrStatus','status'],['scrObservation','observation'],['scrAction','correctiveAction'],['scrBeforeDesc','beforeDescription'],['scrAfterDesc','afterDescription']])$(field).value=f[key]||'';
 const priorType=clean(f.workType);const typeSelect=$('scrType');typeSelect.querySelectorAll('option[data-legacy]').forEach(o=>o.remove());
 if(priorType&&!Array.from(typeSelect.options).some(o=>o.value===priorType)){const opt=new Option(priorType,priorType);opt.dataset.legacy='true';typeSelect.add(opt)}
 typeSelect.value=priorType;
 $('scrEditor').hidden=false;$('scrEditorTitle').textContent=f.id?'تعديل ملاحظة السلامة':'إضافة ملاحظة جديدة';
 $('scrRemoveFinding').hidden=!f.id;$('scrPhotoSection').hidden=!f.id;renderFindings();renderPhotos();
 if(f.id)loadPhotos();
}
function findingForm(){return {id:state.current||'',workOrder:clean($('scrWO').value),workType:clean($('scrType').value),contractor:clean($('scrContractor').value),consultant:clean($('scrConsultant').value),status:$('scrStatus').value,observation:clean($('scrObservation').value),correctiveAction:clean($('scrAction').value),beforeDescription:clean($('scrBeforeDesc').value),afterDescription:clean($('scrAfterDesc').value)}}
async function saveFinding(){
 await Promise.all(Object.values(state.processing||{}).map(p=>p.catch(()=>null)));
 const b=findingForm();
 if(!b.observation){notice('اكتب الملاحظة المرصودة أولاً لحفظ الملاحظة والصور.',true);return}
 if(!state.report){notice('اختر التقرير الأسبوعي أولاً.',true);return}
 const wasNew=!state.current;
 try{
  buttonBusy('scrSaveFinding',true,'جارٍ حفظ البيانات والصور...');
  const j=await request('/reports/'+encodeURIComponent(state.report.id)+'/findings','POST',b);
  const index=state.findings.findIndex(x=>x.id===j.finding.id);
  if(index>=0)state.findings[index]=j.finding;else state.findings.push(j.finding);
  state.current=j.finding.id;
  if(wasNew)state.photos=[];
  $('scrRemoveFinding').hidden=false;$('scrPhotoSection').hidden=false;
  renderKpis();renderFindings();
  const slots=Object.keys(state.pending).map(Number).sort((a,b)=>a-b);
  let failures=0;
  for(const slot of slots){
   try{
    const caption=(slot<=4?b.beforeDescription:b.correctiveAction).slice(0,800);
    const response=await request('/photos/'+photoRef(state.report.id,state.current)+'/'+slot,'POST',{dataUrl:state.pending[slot],caption});
    state.photos=state.photos.filter(x=>Number(x.slot)!==slot);
    state.photos.push(response.image);
    delete state.pending[slot];
   }catch(error){failures++;notice('تعذر حفظ الصورة '+slot+': '+error.message,true)}
  }
  state.dirty=Object.keys(state.pending).length>0;
  renderPhotos();
  if(!failures)notice('تم حفظ بيانات الملاحظة وصورها بنجاح.');
  else notice('حُفظت الملاحظة، وتعذر حفظ '+failures+' صورة؛ ما زالت معاينة الصور غير المحفوظة ظاهرة لإعادة المحاولة.',true);
 }catch(e){notice('تعذر حفظ الملاحظة: '+e.message,true)}
 finally{buttonBusy('scrSaveFinding',false)}
}
async function removeFinding(){
 if(!state.current||!confirm('هل تريد حذف الملاحظة؟ يُنصح بحذف صورها أولاً؛ قد تبقى ملفاتها المؤرشفة في ورقة الصور.'))return;
 try{await request('/reports/'+state.report.id+'/findings/'+state.current,'DELETE');state.findings=state.findings.filter(f=>f.id!==state.current);state.current=null;state.photos=[];$('scrEditor').hidden=true;renderKpis();renderFindings();notice('تم حذف سجل الملاحظة.')}catch(e){notice(e.message,true)}
}
async function loadPhotos(){
 if(!state.report||!state.current)return;
 const id=state.current,ref=photoRef(state.report.id,id);
 try{
  const j=await request('/photos/'+ref);
  if(id!==state.current)return;
  state.photos=j.images||[];
  // Keep previews selected while existing images were loading.
  state.dirty=Object.keys(state.pending).length>0;
  renderPhotos();
 }catch(e){notice('تعذر تحميل الصور: '+e.message,true)}
}
const stored=slot=>state.photos.find(p=>Number(p.slot)===slot);
function renderPhotos(){
 const card=slot=>{
  const photo=stored(slot),pending=state.pending[slot],src=pending||photo?.dataUrl||'',before=slot<=4,label=before?'قبل المعالجة':'بعد المعالجة',primary=(slot===1||slot===5);
  return '<article class="scr-photo'+(primary?' scr-photo-primary':'')+'" data-slot="'+slot+'"><header><b>'+(primary?'الصورة الأساسية':'صورة إضافية '+(before?slot:slot-4))+'</b><small>'+(pending?'جاهزة للحفظ':photo?.dataUrl?'محفوظة':'غير مرفقة')+'</small></header>'+
  '<div class="scr-photo-preview">'+(src?'<img src="'+esc(src)+'" alt="'+label+'">':'<span>أضف صورة '+label+'</span>')+'</div>'+
  '<label class="scr-upload">رفع صورة '+label+'<input type="file" accept="image/*" data-photo-file="'+slot+'" aria-label="رفع صورة '+label+'"></label>'+
  '<div class="scr-photo-buttons"><button type="button" data-photo-save="'+slot+'" '+(src?'':'disabled')+'>حفظ الصورة</button><button class="scr-danger" type="button" data-photo-delete="'+slot+'" '+(src?'':'disabled')+'>حذف</button></div></article>';
 };
 const stage=start=>card(start)+'<details class="scr-extra-photos"><summary>+ صور إضافية لهذه المرحلة (حتى 3)</summary><div class="scr-extra-photo-grid">'+[start+1,start+2,start+3].map(card).join('')+'</div></details>';
 $('scrPhotoBefore').innerHTML=stage(1);
 $('scrPhotoAfter').innerHTML=stage(5);
}
async function compress(file){
 if(!file.type.startsWith('image/'))throw Error('اختر ملف صورة.');
 if(file.size>20*1024*1024)throw Error('الصورة أكبر من 20 ميجابايت.');
 const source=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('فشل قراءة الصورة'));r.readAsDataURL(file)});
 const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('تعذر فتح الصورة'));im.src=source});
 let ratio=Math.min(1,1400/Math.max(image.width,image.height)),quality=.8,result='';
 for(let attempt=0;attempt<9;attempt++){
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
 canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);result=canvas.toDataURL('image/jpeg',quality);
 if(result.length<780000)return result;
 if(quality>.48)quality-=.1;else ratio*=.78;
 }
 throw Error('حجم الصورة كبير جدًا بعد الضغط.');
}
async function photoChange(e){
 const slot=Number(e.target.dataset.photoFile);
 if(!slot||!e.target.files?.length)return;
 const file=e.target.files[0],card=e.target.closest('.scr-photo');
 if(!file.type.startsWith('image/')||file.size>20*1024*1024){notice('اختر صورة صالحة بحجم لا يزيد عن 20 ميجابايت.',true);return}
 const previewUrl=URL.createObjectURL(file);
 const preview=card?.querySelector('.scr-photo-preview');
 if(preview){preview.replaceChildren();const img=document.createElement('img');img.src=previewUrl;img.alt='معاينة فورية للصورة';preview.append(img)}
 const marker=card?.querySelector('header small');if(marker)marker.textContent='تجهيز الصورة...';
 state.dirty=true;
 notice('تظهر الصورة الآن في المعاينة. يجري تجهيزها للحفظ...');
 const work=compress(file);
 state.processing??={};state.processing[slot]=work;
 try{
  const result=await work;
  if(state.processing[slot]!==work)return;
  state.pending[slot]=result;
  const current=$('scrPhotoGrid')?.querySelector('[data-slot="'+slot+'"]');
  if(current){
   const target=current.querySelector('.scr-photo-preview');
   target.replaceChildren();
   const img=document.createElement('img');img.src=result;img.alt='معاينة الصورة';target.append(img);
   current.querySelector('header small').textContent='جاهزة للحفظ';
   const save=current.querySelector('[data-photo-save]'),del=current.querySelector('[data-photo-delete]');
   if(save)save.disabled=false;if(del)del.disabled=false;
  }
  notice('ظهرت الصورة بالمعاينة. اضغط حفظ بيانات الملاحظة لحفظها مع الصور.');
 }catch(err){notice('تعذر معاينة الصورة: '+err.message,true)}
 finally{URL.revokeObjectURL(previewUrl);if(state.processing[slot]===work)delete state.processing[slot]}
}
async function photoClick(e){
 const save=e.target.closest('[data-photo-save]'),del=e.target.closest('[data-photo-delete]');
 if(!save&&!del)return;
 const slot=Number((save||del).dataset.photoSave||(save||del).dataset.photoDelete);
 if(!state.current){
  if(del){
   delete state.pending[slot];
   state.dirty=Object.keys(state.pending).length>0;
   renderPhotos();notice('تم حذف معاينة الصورة قبل الحفظ.');
  }else await saveFinding();
  return;
 }
 const ref=photoRef(state.report.id,state.current),prior=stored(slot);
 if(del&&!state.pending[slot]&&!confirm('حذف هذه الصورة المحفوظة؟'))return;
 const btn=save||del;btn.disabled=true;
 try{
  let saved;
  if(del){
   if(prior?.dataUrl)await request('/photos/'+ref+'/'+slot,'DELETE');
  }else{
   await Promise.all(Object.values(state.processing||{}).map(p=>p.catch(()=>null)));
   const dataUrl=state.pending[slot]||prior?.dataUrl||'';
   if(!dataUrl)throw Error('اختر صورة أولاً.');
   const caption=clean(slot<=4?$('scrBeforeDesc').value:$('scrAction').value).slice(0,800);
   saved=await request('/photos/'+ref+'/'+slot,'POST',{dataUrl,caption});
  }
  state.photos=state.photos.filter(p=>Number(p.slot)!==slot);
  if(saved?.image)state.photos.push(saved.image);
  delete state.pending[slot];
  state.dirty=Object.keys(state.pending).length>0;
  renderPhotos();
  notice(del?'تم حذف الصورة.':'تم حفظ الصورة بنجاح.');
 }catch(err){notice(err.message,true);btn.disabled=false}
}
function printCss(){return `@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{direction:rtl;font-family:Tahoma,Arial,sans-serif;color:#16395c;margin:0}h1,h2,h3,p{margin-top:0}.print-actions{padding:12px;background:#dae8f7;text-align:center;position:sticky;top:0;z-index:10}.print-actions button{padding:10px 24px;background:#183f67;color:white;border:0;border-radius:8px;font-weight:bold;cursor:pointer}.sheet{min-height:180mm;page-break-after:always;position:relative;padding:15mm;border-top:8px solid #f18c2d;overflow:hidden}.sheet:before{content:'VISION DIMENSIONS';position:absolute;opacity:.035;left:25%;top:42%;font-size:50pt;transform:rotate(-15deg);pointer-events:none}.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #dbe8f1;padding-bottom:8mm;margin-bottom:10mm}.brand img{height:22mm;max-width:35mm;object-fit:contain}.brand h2{font-size:16pt;margin:0}.cover{background:linear-gradient(120deg,#143b62 35%,#1c5885 80%);color:#fff;text-align:center;padding:25mm}.cover .brand{border-color:#ffffff48}.cover .brand h2{color:#fff}.cover h1{font-size:32pt;margin-top:24mm}.cover p{font-size:17pt;color:#f9c490}.cover span{font-size:13pt}.end{background:#173e66;color:white;text-align:center}.end h1{font-size:31pt;margin-top:42mm}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7mm;margin-bottom:12mm}.metric{padding:8mm;border:1px solid #bcd1e5;border-radius:8px;background:#eef5fb}.metric b{display:block;font-size:23pt;margin-top:4mm}.summary-table{width:100%;border-collapse:collapse;font-size:11pt}.summary-table th,.summary-table td{padding:4mm;border:1px solid #d1dfec;text-align:right}.summary-table th{background:#17446e;color:#fff}.summary-table tr:nth-child(even){background:#f0f5fb}.finding-title{background:#17446e;color:#fff;padding:3mm 6mm;border-radius:5px;font-size:14pt}.finding-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;font-size:10pt}.finding-meta span{padding:3mm;border:1px solid #d7e3ee;border-radius:5px}.finding-text{padding:3mm 6mm;background:#f2f7fb;border-inline-start:4px solid #f18c2d;margin:3mm 0;white-space:pre-wrap;font-size:11pt}.photos{display:grid;grid-template-columns:1fr 1fr;gap:8mm}.photos-col h3{text-align:center;background:#f18c2d;color:white;border-radius:5px;padding:2mm}.photos-col.after h3{background:#17446e}.photo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm}.photo-list figure{margin:0;border:1px solid #d9e4ef;padding:2mm;break-inside:avoid;border-radius:6px}.photo-list img{display:block;width:100%;height:40mm;object-fit:contain;background:#f7f9fb}.photo-list figcaption{text-align:center;font-size:9pt;color:#173d64;min-height:12mm;overflow-wrap:anywhere;padding-top:2mm}.empty{padding:20mm 2mm;text-align:center;color:#6b8197;border:1px dashed #b3c3d4;border-radius:5px}.foot{position:absolute;bottom:6mm;right:16mm;left:16mm;text-align:center;border-top:1px solid #c9dbe8;padding-top:2mm;font-size:9pt;color:#688096}@media print{.print-actions{display:none}.sheet{border-top-width:6px}body{background:white}}`}
const summaryCounts=()=>{const f=state.findings,r=state.report,closed=f.filter(x=>x.status==='مغلقة').length;const grouped={};f.forEach(x=>{const name=x.contractor||'غير محدد';grouped[name]=(grouped[name]||0)+1});return {closed,open:f.length-closed,coverage:r.totalSites?100*r.visitedSites/r.totalSites:0,grouped}};
const brand=title=>'<header class="brand"><img src="/company-logo.png" alt="أبعاد الرؤية"><h2>'+esc(title)+'</h2><img src="/pdc-logo.jpg" alt="PDC"></header>';
async function printReport(){
 if(!state.report)return;const r=state.report;
 if($('scrMetaSave').classList.contains('scr-unsaved')){notice('احفظ تعديلات بيانات التقرير قبل التصدير.',true);return}
 if(state.dirty){notice('احفظ الصور والتعليقات غير المحفوظة قبل التصدير.',true);return}
 const win=window.open('','_blank','width=1440,height=920');if(!win){notice('يرجى السماح بالنوافذ المنبثقة.',true);return}win.document.write('<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><body style="font-family:Tahoma;text-align:center;padding:90px">جاري تجهيز تقرير السلامة والصور...</body></html>');
 const rows=[];buttonBusy('scrExport',true,'جاري تجهيز الصور...');
 try{
 for(const f of state.findings){const j=await request('/photos/'+photoRef(r.id,f.id));rows.push({f,photos:j.images||[]})}
 const s=summaryCounts(),entries=Object.entries(s.grouped).sort((a,b)=>b[1]-a[1]);
 const title='تقرير الإجراءات التصحيحية الأسبوعي',subtitle=esc(r.weekLabel||'تقرير السلامة')+' • '+esc(r.startDate)+' إلى '+esc(r.endDate);
 let pages='<section class="sheet cover">'+brand('دائرة مشاريع التوزيع – '+city)+'<h1>'+title+'</h1><p>'+subtitle+'</p><span>نموذج موحد للمتابعة والتوثيق<br>أبعاد الرؤية للاستشارات الهندسية | PDC</span></section>';
 pages+='<section class="sheet">'+brand('تقرير زيارات السلامة الميدانية')+'<h2>الملخص التنفيذي</h2><div class="metrics">'+[
 ['عدد المواقع للأسبوع',fmt(r.totalSites)],['عدد المواقع المزارة',fmt(r.visitedSites)],['عدد الزيارات',fmt(r.totalVisits)],['نسبة تغطية المواقع',s.coverage.toFixed(1)+'%'],
 ['الملاحظات المرصودة',fmt(rows.length)],['الملاحظات المفتوحة',fmt(s.open)],['الملاحظات المغلقة',fmt(s.closed)]].map(x=>'<div class="metric"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div><h3>توزيع الملاحظات حسب المقاول</h3><table class="summary-table"><thead><tr><th>المقاول</th><th>عدد الملاحظات</th></tr></thead><tbody>'+entries.map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+fmt(x[1])+'</td></tr>').join('')+'</tbody></table><p>'+esc(r.notes||'')+'</p><div class="foot">تقرير السلامة | '+esc(city)+'</div></section>';
 for(let i=0;i<rows.length;i++){
 const {f,photos}=rows[i],phase=(before)=>{const list=photos.filter(p=>p.dataUrl&&(before?Number(p.slot)<=4:Number(p.slot)>4)),label=before?'وصف الحالة':'وصف الإجراء التصحيحي',description=before?(f.beforeDescription||f.observation):(f.correctiveAction||'في انتظار التصحيح');return '<section class="photos-col '+(before?'before':'after')+'"><h3>'+(before?'قبل المعالجة':'بعد المعالجة')+'</h3><div class="photo-list">'+(list.length?list.map(p=>'<figure><img src="'+esc(p.dataUrl)+'"></figure>').join(''):'<div class="empty">لم تُرفق صور لهذه المرحلة</div>')+'</div><div style="white-space:pre-wrap;text-align:center;border:1px solid #c6d4df;border-radius:10px;background:#f6f9fb;padding:12px 8px;margin-top:10px;color:'+(before?'#e67916':'#17446e')+';font-weight:bold"><b>'+label+': </b>'+esc(description)+'</div></section>'};
 pages+='<section class="sheet">'+brand('بيانات المعالجة والتوثيق')+'<div class="finding-title">الملاحظة '+(i+1)+' من '+rows.length+'</div><div class="finding-meta">'+[['أمر العمل',f.workOrder],['نوع أمر العمل',f.workType],['المقاول',f.contractor],['الاستشاري',f.consultant],['الحالة',f.status]].map(x=>'<span><b>'+x[0]+': </b>'+esc(x[1]||'—')+'</span>').join('')+'</div><div class="finding-text"><b>الملاحظات المرصودة:</b> '+esc(f.observation)+'</div><div class="photos">'+phase(true)+phase(false)+'</div><div class="foot">تقرير الإجراءات التصحيحية لكل أسبوع | '+esc(city)+'</div></section>';
 }
 pages+='<section class="sheet end">'+brand('أبعاد الرؤية للاستشارات الهندسية')+'<h1>شكرًا لتعاونكم</h1><h2>معًا لرفع جودة التنفيذ والسلامة</h2><p>دائرة مشاريع التوزيع – '+esc(city)+'</p></section>';
 if(win.closed)throw Error('أُغلقت نافذة التقرير أثناء التجهيز.');
 win.document.open();win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc('VD-Safety-'+city+'-'+r.startDate)+'</title><style>'+printCss()+'</style></head><body><div class="print-actions"><button onclick="window.print()">طباعة أو حفظ التقرير PDF</button> – تأكد من تحميل الصور قبل الطباعة</div>'+pages+'</body></html>');win.document.close();window.VDReportArchive?.record({reportName:'تقرير السلامة والإجراءات التصحيحية',format:'PDF',filename:'VD_Safety_Corrective.pdf'});notice('تقرير PDF جاهز في نافذة جديدة. استخدم زر الطباعة للحفظ.');
 }catch(e){if(!win.closed)win.close();notice('تعذر تجهيز التقرير: '+e.message,true)}finally{buttonBusy('scrExport',false)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
