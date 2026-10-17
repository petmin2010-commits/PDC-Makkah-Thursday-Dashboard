(()=>{'use strict';
const PAGE='safetyCorrectivePage',NAV='safetyCorrectiveNav',API='/api/safety-corrective';
const state={report:null,findings:[],reports:[],contractors:[],workTypes:[],current:null,photos:[],pending:{},photoDraft:{},loading:false,dirty:false};
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
 $('scrPhotoGrid').addEventListener('input',e=>{if(e.target.matches('textarea,input:not([type=file]),select'))state.dirty=true;});
 $('scrMetaFields').addEventListener('input',()=>{$('scrMetaSave').classList.add('scr-unsaved');renderKpis()});
 $('scrAddContractor').addEventListener('click',()=>{const t=$('scrContractorRows');t.insertAdjacentHTML('beforeend','<tr><td><input data-contractor-name maxlength="120" aria-label="اسم المقاول" placeholder="اسم المقاول"></td><td><input data-contractor-count type="number" min="0" aria-label="عدد ملاحظات السلامة"></td><td><button type="button" class="scr-remove-contractor" aria-label="حذف المقاول" title="حذف الصف">×</button></td></tr>');$('scrMetaSave').classList.add('scr-unsaved');renderKpis()});
 $('scrContractorRows').addEventListener('click',e=>{if(!e.target.matches('.scr-remove-contractor'))return;e.target.closest('tr')?.remove();if(!$('scrContractorRows').children.length)renderContractorRows([]);$('scrMetaSave').classList.add('scr-unsaved');renderKpis()});
 refresh();
 refreshContractors();
 refreshWorkTypes();
}
function markup(){return `
<div class="scr-hero"><div><small>SAFETY • CORRECTIVE ACTIONS</small><h2>تقرير السلامة والإجراءات التصحيحية</h2><p>تقرير أسبوعي موحد مع صور قبل المعالجة وبعد المعالجة، وتوثيق كل ملاحظة بصور قبل وبعد المعالجة، ووصف الحالة والإجراء التصحيحي.</p></div><div class="scr-toolbar"><button id="scrExport" type="button" disabled>تصدير PDF</button></div></div>
<div class="scr-line"><label>التقارير المحفوظة <select id="scrSelect"><option value="">اختر التقرير...</option></select></label><button id="scrCreate" type="button">+ إنشاء تقرير أسبوعي</button><span id="scrNotice" class="scr-notice">جاري تحميل التقارير...</span></div>
<div id="scrWorkspace" hidden>
<section class="scr-panel scr-weekly-template">
<div class="scr-original-heading"><h3>تقرير زيارات السلامة الميدانية</h3><div class="scr-original-brand"><img src="/assets/pdc-logo.png" alt="PDC"><img src="/assets/saudi-electricity-logo.png" alt="الشركة السعودية للكهرباء"></div></div>
<div class="scr-original-toolbar"><span>إدخال ملخص الأسبوع وفق ترتيب صفحة التقرير الأصلي.</span><button id="scrMetaSave" type="button">حفظ بيانات التقرير</button></div>
<div id="scrMetaFields">
<div class="scr-original-metrics">
<label class="scr-original-metric"><span>عدد المواقع للأسبوع</span><input id="scrSites" type="number" min="0"></label>
<label class="scr-original-metric"><span>عدد الزيارات</span><input id="scrVisits" type="number" min="0"></label>
<div class="scr-original-metric scr-original-counter"><span>عدد الملاحظات</span><strong id="scrAutoFindings" role="status" aria-live="polite">0</strong></div>
<div class="scr-original-metric scr-original-coverage"><span>نسبة تغطية الزيارات</span><strong id="scrCoverage" aria-live="polite">0%</strong><label>المواقع التي تمت زيارتها<input id="scrVisited" type="number" min="0"></label></div>
</div>
<div class="scr-original-lower">
<section class="scr-original-highlights"><h4>أبرز ملاحظات جودة التنفيذ المرصودة في الموقع</h4><label for="scrHighlights">اكتب كل ملاحظة في سطر مستقل؛ ستظهر بنقطة في التقرير.</label><textarea id="scrHighlights" rows="10" maxlength="3000" placeholder="اكتب الملاحظات الفعلية المرصودة خلال الأسبوع هنا"></textarea></section>
<section class="scr-original-status">
<div class="scr-original-metric scr-original-counter"><span>عدد الملاحظات المفتوحة</span><strong id="scrAutoOpen" role="status" aria-live="polite">0</strong></div>
<div class="scr-original-metric scr-original-counter"><span>عدد الملاحظات المغلقة</span><strong id="scrAutoClosed" role="status" aria-live="polite">0</strong></div>
<small id="scrCountsHint">تُحسب الأعداد تلقائيًا من الملاحظات المحفوظة أدناه.</small>
</section>
<section class="scr-original-contractors">
<table aria-label="ملاحظات السلامة حسب المقاول"><thead><tr><th>المقاول</th><th>عدد ملاحظات السلامة</th><th class="scr-row-actions">حذف</th></tr></thead><tbody id="scrContractorRows"></tbody></table>
<button id="scrAddContractor" class="scr-add-contractor" type="button">+ إضافة مقاول</button><small id="scrContractorHint">يمكن تعديل أسماء المقاولين وأعداد الملاحظات.</small>
</section>
</div>
<details class="scr-original-extras"><summary>بيانات الفترة والاعتماد وملاحظات التقرير العامة</summary><div class="scr-grid">
<label>عنوان الأسبوع<input id="scrWeekLabel" maxlength="120" placeholder="الأسبوع الثاني - أكتوبر 2026"></label>
<label>من تاريخ<input id="scrStart" type="date"></label><label>إلى تاريخ<input id="scrEnd" type="date"></label>
<label>معد التقرير<input id="scrPrepared" placeholder="الاسم أو المسمى الوظيفي" maxlength="180"></label>
<label class="scr-wide">ملاحظات التقرير العامة<textarea id="scrNotes" rows="2" maxlength="2000"></textarea></label>
</div></details>
</div></section>
<section class="scr-panel"><div class="scr-section-head"><h3>الملاحظات والإجراءات التصحيحية</h3><button id="scrAddFinding" type="button">+ إضافة ملاحظة</button></div>
<div class="scr-master-detail"><div id="scrFindingList" class="scr-findings-list"></div>
<div class="scr-editor" id="scrEditor" hidden>
<div class="scr-reference-heading"><div><h4 id="scrEditorTitle">بيانات المعالجة والتوثيق</h4><p>نموذج إدخال مطابق لترتيب صفحة الملاحظة في التقرير: بيانات أمر العمل ← قبل المعالجة ← بعد المعالجة.</p></div><span class="scr-reference-pill">ملاحظة مستقلة لكل حالة</span></div>
<div id="scrPhotoGrid" class="scr-reference-layout">
<section class="scr-ref-card scr-ref-order" aria-label="بيانات أمر العمل">
<h5>بيانات أمر العمل</h5>
<div class="scr-ref-fields">
<label>رقم أمر العمل<input id="scrWO" inputmode="numeric" maxlength="40" placeholder="رقم أمر العمل"></label>
<label>المقاول<select id="scrContractor" aria-label="المقاول"><option value="">جاري تحميل المقاولين...</option></select></label>
<label>الاستشاري<input id="scrConsultant" maxlength="180" value="أبعاد الرؤية"></label>
<label>نوع أمر العمل<select id="scrType"><option value="">جاري تحميل أنواع أوامر العمل من info...</option></select></label>
<label class="scr-ref-observation">الملاحظات المرصودة<textarea id="scrObservation" rows="5" maxlength="1700" placeholder="اكتب الملاحظة كما ستظهر في التقرير"></textarea></label>
<label>حالة الملاحظة<select id="scrStatus"><option>مفتوحة</option><option>جاري التصحيح</option><option>مغلقة</option></select></label>
</div></section>
<section class="scr-ref-card scr-ref-before" aria-label="قبل المعالجة">
<h5>قبل المعالجة</h5>
<div id="scrPhotoBefore" class="scr-phase-photos"></div>
<label class="scr-ref-description scr-description-reference">وصف الحالة<textarea id="scrBeforeDesc" rows="3" maxlength="1000" placeholder="وصف الحالة قبل المعالجة"></textarea></label>
<div class="scr-phase-actions"><button type="button" data-phase-save="1">حفظ الصورة والتعليق</button><button type="button" class="scr-danger" data-photo-delete="1" disabled>حذف الصورة</button></div>
</section>
<section class="scr-ref-card scr-ref-after" aria-label="بعد المعالجة">
<h5>بعد المعالجة</h5>
<div id="scrPhotoAfter" class="scr-phase-photos"></div>
<label class="scr-ref-description scr-description-reference">وصف الإجراء التصحيحي<textarea id="scrAction" rows="3" maxlength="1700" placeholder="الإجراء التصحيحي أو في انتظار التصحيح"></textarea></label>
<div class="scr-phase-actions"><button type="button" data-phase-save="5">حفظ الصورة والتعليق</button><button type="button" class="scr-danger" data-photo-delete="5" disabled>حذف الصورة</button></div>
<input id="scrAfterDesc" type="hidden" value="">
</section>
</div>
<div id="scrPhotoSection" hidden><p>تظهر معاينة الصور فور اختيارها، حتى قبل حفظ الملاحظة. اكتب وصف الحالة تحت صورة «قبل المعالجة»، ووصف الإجراء التصحيحي تحت صورة «بعد المعالجة»، ثم احفظ بيانات الملاحظة وصورها معًا.</p></div>
<div class="scr-editor-actions"><button id="scrSaveFinding" type="button">حفظ بيانات الملاحظة</button><button id="scrRemoveFinding" class="scr-danger" type="button" hidden>حذف الملاحظة</button></div>
</div></div></section></div>`}
function open(){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(PAGE).classList.add('active');document.querySelectorAll('#nav .nav-item').forEach(x=>x.classList.toggle('active',x.id===NAV));const bar=$('filterBar');if(bar)bar.style.display='none';const title=$('pageTitle');if(title)title.textContent='تقرير السلامة والإجراءات التصحيحية';document.body.classList.add('scr-open');}
function leave(){document.body.classList.remove('scr-open');$(PAGE)?.classList.remove('active');const bar=$('filterBar');if(bar)bar.style.display='';}
function summaryContractors(){
 return [...$('scrContractorRows').querySelectorAll('tr')].map(tr=>({
  name:clean(tr.querySelector('[data-contractor-name]')?.value),
  count:Number(tr.querySelector('[data-contractor-count]')?.value||0)
 })).filter(x=>x.name).slice(0,60)
}
function renderContractorRows(values){
 const list=Array.isArray(values)&&values.length?values:[{name:'',count:''}];
 $('scrContractorRows').innerHTML=list.map(x=>'<tr><td><input data-contractor-name maxlength="120" aria-label="اسم المقاول" placeholder="اسم المقاول" value="'+esc(x.name||'')+'"></td>'+
 '<td><input data-contractor-count type="number" min="0" aria-label="عدد ملاحظات السلامة" value="'+esc(x.count??'')+'"></td>'+
 '<td><button type="button" class="scr-remove-contractor" aria-label="حذف المقاول" title="حذف الصف">×</button></td></tr>').join('');
}
const detailCount=()=>({total:state.findings.length,open:state.findings.filter(f=>f.status!=='مغلقة').length,closed:state.findings.filter(f=>f.status==='مغلقة').length});
function derivedContractors(){
 const groups=new Map();state.findings.forEach(f=>{const name=clean(f.contractor)||'غير محدد';groups.set(name,(groups.get(name)||0)+1)});
 return [...groups].map(([name,count])=>({name,count}));
}
function getMeta(){
 return {weekLabel:clean($('scrWeekLabel').value),startDate:$('scrStart').value,endDate:$('scrEnd').value,
 totalSites:Number($('scrSites').value||0),visitedSites:Number($('scrVisited').value||0),totalVisits:Number($('scrVisits').value||0),
 preparedBy:clean($('scrPrepared').value),notes:clean($('scrNotes').value),highlights:$('scrHighlights').value.trim(),
 manualFindings:null,manualOpen:null,manualClosed:null,
 contractorBreakdown:summaryContractors()};
}
function fillMeta(r){
 $('scrWeekLabel').value=r.weekLabel||'';$('scrStart').value=r.startDate||'';$('scrEnd').value=r.endDate||'';
 $('scrSites').value=r.totalSites??0;$('scrVisited').value=r.visitedSites??0;$('scrVisits').value=r.totalVisits??0;
 $('scrPrepared').value=r.preparedBy||'';$('scrNotes').value=r.notes||'';$('scrHighlights').value=r.highlights||'';
 renderContractorRows(r.contractorBreakdown?.length?r.contractorBreakdown:derivedContractors());
 $('scrWorkspace').hidden=false;$('scrExport').disabled=false;$('scrMetaSave').classList.remove('scr-unsaved');
}
function validateMeta(x){if(!validDate(x.startDate)||!validDate(x.endDate)||x.startDate>x.endDate)throw Error('حدد فترة زمنية صحيحة.');if(x.visitedSites>x.totalSites)throw Error('المواقع التي تمت زيارتها لا يمكن أن تتجاوز إجمالي المواقع.')}
function renderContractorOptions(selected){
 const el=$('scrContractor');if(!el)return;
 const value=clean(selected===undefined?el.value:selected);
 const options=[...new Set([...state.contractors,...state.findings.map(f=>f.contractor),value].map(clean).filter(Boolean))]
   .sort((a,b)=>a.localeCompare(b,'ar'));
 el.innerHTML='<option value="">'+(options.length?'اختر المقاول':'لا توجد أسماء مقاولين متاحة بعد')+'</option>'+
   options.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('');
 el.value=value;
}
function renderWorkTypeOptions(selected){
 const el=$('scrType');if(!el)return;
 const value=clean(selected===undefined?el.value:selected);
 const types=new Map();
 for(const entry of state.workTypes){const code=clean(entry?.code);if(code&&!types.has(code))types.set(code,clean(entry.description));}
 for(const code of [...state.findings.map(f=>f.workType),'طارئ',value].map(clean).filter(Boolean))if(!types.has(code))types.set(code,'');
 el.innerHTML='<option value="">'+(state.workTypes.length?'اختر نوع أمر العمل':'اختر نوع أمر العمل (بانتظار info)')+'</option>'+
  [...types].map(([code,description])=>'<option value="'+esc(code)+'">'+esc(code+(description?' — '+description:''))+'</option>').join('');
 el.value=value;
}
async function refreshWorkTypes(){
 try{
  const data=await request('/work-types');
  if(!Array.isArray(data.workTypes))throw Error('استجابة غير صحيحة من المصدر info');
  state.workTypes=data.workTypes;
  renderWorkTypeOptions();
 }catch(e){renderWorkTypeOptions();notice('تعذر تحميل أنواع أمر العمل من ورقة info: '+e.message,true);}
}
async function refreshContractors(){
 try{
  const data=await request('/contractors');
  state.contractors=Array.isArray(data.contractors)?data.contractors.filter(v=>typeof v==='string'):[];
  renderContractorOptions();
 }catch(e){
  renderContractorOptions();
  notice('تعذر تحميل قائمة المقاولين من أوامر العمل: '+e.message,true);
 }
}
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
 try{const j=await request('/reports/'+encodeURIComponent(id));state.report=j.report;$('scrSelect').value=j.report.id;state.findings=j.findings||[];state.current=null;state.photos=[];state.pending={};state.photoDraft={};state.dirty=false;fillMeta(j.report);renderContractorOptions();renderWorkTypeOptions();renderKpis();renderFindings();$('scrEditor').hidden=true;notice('تم تحميل التقرير • '+state.findings.length+' ملاحظة.')}catch(e){notice(e.message,true)}
}
async function saveMeta(){const data=getMeta();try{validateMeta(data);buttonBusy('scrMetaSave',true);const j=await request('/reports/'+state.report.id,'PUT',data);state.report=j.report;fillMeta(state.report);await refresh();renderKpis();notice('تم حفظ بيانات التقرير.')}catch(e){notice(e.message,true)}finally{buttonBusy('scrMetaSave',false)}}
function renderKpis(){
 const r=state.report||{},detail=detailCount(),sites=Number($('scrSites')?.value??r.totalSites??0),visited=Number($('scrVisited')?.value??r.visitedSites??0);
 const coverage=sites>0?Math.round(visited/sites*100):0;
 $('scrCoverage').textContent=coverage.toLocaleString('en-US')+'%';
 for(const [id,value] of [['scrAutoFindings',detail.total],['scrAutoOpen',detail.open],['scrAutoClosed',detail.closed]])$(id).textContent=fmt(value);
 $('scrCountsHint').textContent='إجمالي '+detail.total+' ملاحظة محفوظة: '+detail.open+' مفتوحة (تشمل جاري التصحيح) + '+detail.closed+' مغلقة. يُحدث العداد تلقائيًا بعد الحفظ أو الحذف.';
 const listed=summaryContractors(),sum=listed.reduce((n,x)=>n+x.count,0);
 $('scrContractorHint').textContent=listed.length?'مجموع ملاحظات المقاولين: '+sum+' من أصل '+detail.total+(sum===detail.total?' (متطابق).':' (راجع المقاولين غير المدرجين).'):'أضف أسماء المقاولين وأعداد الملاحظات.';
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
 renderWorkTypeOptions(f.workType);
 renderContractorOptions(f.contractor);
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
  const slots=[1,5].filter(slot=>state.pending[slot]);
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
  const photo=stored(slot),pending=state.pending[slot],src=pending||photo?.dataUrl||'',label=slot===1?'قبل المعالجة':'بعد المعالجة';
  return '<article class="scr-photo scr-photo-primary" data-slot="'+slot+'"><header><b>الصورة الأساسية</b><small>'+(pending?'جاهزة للحفظ':photo?.dataUrl?'محفوظة':'غير مرفقة')+'</small></header>'+
   '<div class="scr-photo-preview">'+(src?'<img src="'+esc(src)+'" alt="'+label+'">':'<span>أضف صورة '+label+'</span>')+'</div>'+
   '<label class="scr-upload">رفع صورة '+label+'<input type="file" accept="image/*" data-photo-file="'+slot+'" aria-label="رفع صورة '+label+'"></label></article>';
 };
 $('scrPhotoBefore').innerHTML=card(1);
 $('scrPhotoAfter').innerHTML=card(5);
 for(const slot of [1,5]){const del=$('scrPhotoGrid').querySelector('[data-photo-delete="'+slot+'"]');if(del)del.disabled=!(state.pending[slot]||stored(slot)?.dataUrl);}
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
   const del=$('scrPhotoGrid')?.querySelector('[data-photo-delete="'+slot+'"]');
   if(del)del.disabled=false;
  }
  notice('ظهرت الصورة بالمعاينة. اضغط حفظ بيانات الملاحظة لحفظها مع الصور.');
 }catch(err){notice('تعذر معاينة الصورة: '+err.message,true)}
 finally{URL.revokeObjectURL(previewUrl);if(state.processing[slot]===work)delete state.processing[slot]}
}
async function photoClick(e){
 const phase=e.target.closest('[data-phase-save]');
 if(phase){await saveFinding();return;}
 const del=e.target.closest('[data-photo-delete]');
 if(!del)return;
 const slot=Number(del.dataset.photoDelete);
 if(![1,5].includes(slot))return;
 if(!state.current){
  delete state.pending[slot];state.dirty=Object.keys(state.pending).length>0;
  renderPhotos();notice('تم حذف معاينة الصورة قبل الحفظ.');return;
 }
 const ref=photoRef(state.report.id,state.current),prior=stored(slot);
 if(!state.pending[slot]&&!prior?.dataUrl)return;
 if(prior?.dataUrl&&!confirm('حذف هذه الصورة المحفوظة؟'))return;
 del.disabled=true;
 try{
  if(prior?.dataUrl)await request('/photos/'+ref+'/'+slot,'DELETE');
  state.photos=state.photos.filter(p=>Number(p.slot)!==slot);
  delete state.pending[slot];state.dirty=Object.keys(state.pending).length>0;
  renderPhotos();notice('تم حذف الصورة.');
 }catch(err){notice(err.message,true);del.disabled=false}
}
function printCss(){return `@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{direction:rtl;font-family:Tahoma,Arial,sans-serif;color:#16395c;margin:0}h1,h2,h3,p{margin-top:0}.print-actions{padding:12px;background:#dae8f7;text-align:center;position:sticky;top:0;z-index:10}.print-actions button{padding:10px 24px;background:#183f67;color:white;border:0;border-radius:8px;font-weight:bold;cursor:pointer}.sheet{min-height:180mm;page-break-after:always;position:relative;padding:15mm;border-top:8px solid #f18c2d;overflow:hidden}.sheet:before{content:'VISION DIMENSIONS';position:absolute;opacity:.035;left:25%;top:42%;font-size:50pt;transform:rotate(-15deg);pointer-events:none}.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #dbe8f1;padding-bottom:8mm;margin-bottom:10mm}.brand img{height:22mm;max-width:35mm;object-fit:contain}.brand h2{font-size:16pt;margin:0}.cover{background:linear-gradient(120deg,#143b62 35%,#1c5885 80%);color:#fff;text-align:center;padding:25mm}.cover .brand{border-color:#ffffff48}.cover .brand h2{color:#fff}.cover h1{font-size:32pt;margin-top:24mm}.cover p{font-size:17pt;color:#f9c490}.cover span{font-size:13pt}.end{background:#173e66;color:white;text-align:center}.end h1{font-size:31pt;margin-top:42mm}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7mm;margin-bottom:12mm}.metric{padding:8mm;border:1px solid #bcd1e5;border-radius:8px;background:#eef5fb}.metric b{display:block;font-size:23pt;margin-top:4mm}.summary-table{width:100%;border-collapse:collapse;font-size:11pt}.summary-table th,.summary-table td{padding:4mm;border:1px solid #d1dfec;text-align:right}.summary-table th{background:#17446e;color:#fff}.summary-table tr:nth-child(even){background:#f0f5fb}.finding-title{background:#17446e;color:#fff;padding:3mm 6mm;border-radius:5px;font-size:14pt}.finding-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;font-size:10pt}.finding-meta span{padding:3mm;border:1px solid #d7e3ee;border-radius:5px}.finding-text{padding:3mm 6mm;background:#f2f7fb;border-inline-start:4px solid #f18c2d;margin:3mm 0;white-space:pre-wrap;font-size:11pt}.photos{display:grid;grid-template-columns:1fr 1fr;gap:8mm}.photos-col h3{text-align:center;background:#f18c2d;color:white;border-radius:5px;padding:2mm}.photos-col.after h3{background:#17446e}.photo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm}.photo-list figure{margin:0;border:1px solid #d9e4ef;padding:2mm;break-inside:avoid;border-radius:6px}.photo-list img{display:block;width:100%;height:40mm;object-fit:contain;background:#f7f9fb}.photo-list figcaption{text-align:center;font-size:9pt;color:#173d64;min-height:12mm;overflow-wrap:anywhere;padding-top:2mm}.empty{padding:20mm 2mm;text-align:center;color:#6b8197;border:1px dashed #b3c3d4;border-radius:5px}.foot{position:absolute;bottom:6mm;right:16mm;left:16mm;text-align:center;border-top:1px solid #c9dbe8;padding-top:2mm;font-size:9pt;color:#688096}@media print{.print-actions{display:none}.sheet{border-top-width:6px}body{background:white}}`}

function originalSummaryCss(){return '@media print{.scr-p-summary{page-break-inside:avoid}}'+
'.scr-p-summary{font-family:Tahoma,Arial,sans-serif;padding:10mm 9mm;min-height:180mm;border-top:0;direction:rtl}'+
'.scr-p-head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #f18c2d;padding-bottom:4mm;margin-bottom:5mm}'+
'.scr-p-head h2{font-size:18pt;margin:0;color:#123a66}.scr-p-logos{direction:ltr;display:flex;gap:5mm}'+
'.scr-p-logos img{height:15mm;max-width:32mm;object-fit:contain}'+
'.scr-p-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm;margin-bottom:5mm}'+
'.scr-p-metric{background:linear-gradient(#fff,#edf1f5,#fff);border:1px solid #b6c2d2;text-align:center;min-height:27mm;box-shadow:1px 2px 2px #a0a7b0}'+
'.scr-p-metric>span{display:block;background:linear-gradient(#35689a,#0d2e51);color:#fff;padding:2mm 1mm;font-size:13pt;font-weight:bold;min-height:11mm}'+
'.scr-p-metric>b{display:block;font-size:22pt;color:#174572;padding:4mm 0 1mm}'+
'.scr-p-lower{display:grid;grid-template-columns:1.5fr .83fr .9fr;gap:8mm;direction:rtl;align-items:start}'+
'.scr-p-highlights{background:#cfdef2;color:#0e396b;border-radius:14mm;padding:5mm 7mm;min-height:91mm;box-shadow:1px 2px 3px #aaa}'+
'.scr-p-highlights h3{font-size:13pt;text-align:center;line-height:1.5}'+
'.scr-p-highlights li{font-size:11pt;font-weight:bold;line-height:1.6;margin:1mm 0}'+
'.scr-p-status{display:grid;gap:7mm;padding-top:3mm}'+
'.scr-p-contractors table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9pt}'+
'.scr-p-contractors th{background:#4c82bd;color:#fff;font-size:9pt;padding:2mm;text-align:center}'+
'.scr-p-contractors td{background:#d0d9e8;text-align:center;padding:1.5mm;border:1px solid #fff}'+
'.scr-p-contractors tr:nth-child(even) td{background:#e8edf4}'+
'.scr-p-extra-notes{font-size:9pt;padding-top:4mm;color:#456786}';
}

const summaryCounts=()=>{
 const f=state.findings,r=state.report||{},detail=detailCount(),grouped={};
 f.forEach(x=>{const name=x.contractor||'غير محدد';grouped[name]=(grouped[name]||0)+1});
 if(Array.isArray(r.contractorBreakdown)&&r.contractorBreakdown.length){
  Object.keys(grouped).forEach(k=>delete grouped[k]);
  for(const x of r.contractorBreakdown)grouped[x.name]=(grouped[x.name]||0)+Number(x.count||0);
 }
 return {total:detail.total,closed:detail.closed,open:detail.open,coverage:r.totalSites?100*r.visitedSites/r.totalSites:0,grouped};
};
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

 pages+='<section class="sheet scr-p-summary"><header class="scr-p-head"><h2>تقرير زيارات السلامة الميدانية</h2><div class="scr-p-logos"><img src="/assets/pdc-logo.png" alt="PDC"><img src="/assets/saudi-electricity-logo.png" alt="الشركة السعودية للكهرباء"></div></header>'+
 '<div class="scr-p-metrics">'+[
 ['عدد المواقع للأسبوع',fmt(r.totalSites)],['عدد الزيارات',fmt(r.totalVisits)],
 ['عدد الملاحظات',fmt(s.total)],['نسبة تغطية الزيارات',s.coverage.toFixed(1)+'%']
 ].map(x=>'<div class="scr-p-metric"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div>'+
 '<div class="scr-p-lower"><div class="scr-p-highlights"><h3>أبرز ملاحظات جودة التنفيذ المرصودة في الموقع</h3>'+
 '<ul>'+String(r.highlights||'').split(/\r?\n/).map(x=>clean(x)).filter(Boolean).map(x=>'<li>'+esc(x.replace(/^[•\-]\s*/,''))+'</li>').join('')+'</ul></div>'+
 '<div class="scr-p-status"><div class="scr-p-metric"><span>عدد الملاحظات المفتوحة</span><b>'+fmt(s.open)+'</b></div><div class="scr-p-metric"><span>عدد الملاحظات المغلقة</span><b>'+fmt(s.closed)+'</b></div></div>'+
 '<div class="scr-p-contractors"><table><thead><tr><th>المقاول</th><th>عدد ملاحظات السلامة</th></tr></thead><tbody>'+
 entries.map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+fmt(x[1])+'</td></tr>').join('')+'</tbody></table></div></div>'+
 (r.notes?'<p class="scr-p-extra-notes">'+esc(r.notes)+'</p>':'')+
 '<div class="foot">تقرير السلامة | '+esc(city)+'</div></section>';

 for(let i=0;i<rows.length;i++){
 const {f,photos}=rows[i],phase=(before)=>{const available=photos.filter(p=>p.dataUrl&&(before?Number(p.slot)<=4:Number(p.slot)>4)),primary=available.find(p=>Number(p.slot)===(before?1:5)),list=primary?[primary]:available.slice(0,1),label=before?'وصف الحالة':'وصف الإجراء التصحيحي',description=before?(f.beforeDescription||f.observation):(f.correctiveAction||'في انتظار التصحيح');return '<section class="photos-col '+(before?'before':'after')+'"><h3>'+(before?'قبل المعالجة':'بعد المعالجة')+'</h3><div class="photo-list">'+(list.length?list.map(p=>'<figure><img src="'+esc(p.dataUrl)+'"></figure>').join(''):'<div class="empty">لم تُرفق صور لهذه المرحلة</div>')+'</div><div style="white-space:pre-wrap;text-align:center;border:1px solid #c6d4df;border-radius:10px;background:#f6f9fb;padding:12px 8px;margin-top:10px;color:'+(before?'#e67916':'#17446e')+';font-weight:bold"><b>'+label+': </b>'+esc(description)+'</div></section>'};
 pages+='<section class="sheet">'+brand('بيانات المعالجة والتوثيق')+'<div class="finding-title">الملاحظة '+(i+1)+' من '+rows.length+'</div><div class="finding-meta">'+[['أمر العمل',f.workOrder],['نوع أمر العمل',f.workType],['المقاول',f.contractor],['الاستشاري',f.consultant],['الحالة',f.status]].map(x=>'<span><b>'+x[0]+': </b>'+esc(x[1]||'—')+'</span>').join('')+'</div><div class="finding-text"><b>الملاحظات المرصودة:</b> '+esc(f.observation)+'</div><div class="photos">'+phase(true)+phase(false)+'</div><div class="foot">تقرير الإجراءات التصحيحية لكل أسبوع | '+esc(city)+'</div></section>';
 }
 pages+='<section class="sheet end">'+brand('أبعاد الرؤية للاستشارات الهندسية')+'<h1>شكرًا لتعاونكم</h1><h2>معًا لرفع جودة التنفيذ والسلامة</h2><p>دائرة مشاريع التوزيع – '+esc(city)+'</p></section>';
 if(win.closed)throw Error('أُغلقت نافذة التقرير أثناء التجهيز.');
 win.document.open();win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc('VD-Safety-'+city+'-'+r.startDate)+'</title><style>'+printCss()+originalSummaryCss()+'</style></head><body><div class="print-actions"><button onclick="window.print()">طباعة أو حفظ التقرير PDF</button> – تأكد من تحميل الصور قبل الطباعة</div>'+pages+'</body></html>');win.document.close();window.VDReportArchive?.record({reportName:'تقرير السلامة والإجراءات التصحيحية',format:'PDF',filename:'VD_Safety_Corrective.pdf'});notice('تقرير PDF جاهز في نافذة جديدة. استخدم زر الطباعة للحفظ.');
 }catch(e){if(!win.closed)win.close();notice('تعذر تجهيز التقرير: '+e.message,true)}finally{buttonBusy('scrExport',false)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
