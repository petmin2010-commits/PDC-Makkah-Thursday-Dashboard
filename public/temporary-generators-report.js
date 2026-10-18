(()=>{'use strict';
const PAGE='temporaryGeneratorsPage',NAV='temporaryGeneratorsNav',API='/api/temporary-generators';
const state={report:null,findings:[],reports:[],contractors:[],workTypes:[],current:null,photos:[],pending:{},photoDraft:{},loading:false,dirty:false};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').trim();
const photoRef=(r,f)=>r+'--'+f;
const city=/(جدة|Jeddah)/i.test(document.title)?'جدة':'مكة المكرمة';
const currentName=()=>state.report?.weekLabel||'تقرير الجودة';
const fmt=n=>Number(n||0).toLocaleString('en-US');
// Visits may exceed sites where multiple visits are made to the same location.
const visitCoverage=(visits,sites)=>{const v=Number(visits),s=Number(sites);return Number.isFinite(v)&&Number.isFinite(s)&&s>0?Math.max(0,v)/s*100:0};
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s);
const today=()=>{const p={};new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(x=>{if(x.type!=='literal')p[x.type]=x.value});return p.year+'-'+p.month+'-'+p.day;};
async function request(url,method='GET',body){
 const res=await fetch(API+url,{method,headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body)});
 const j=await res.json().catch(()=>({}));
 if(!res.ok||!j.ok)throw new Error(j.error||'تعذر الاتصال بالخادم');
 return j;
}
function notice(message,error=false){const el=$('tgrNotice');if(!el)return;el.textContent=message;el.className='tgr-notice'+(error?' error':'');}
function buttonBusy(id,busy,text){const b=$(id);if(!b)return;if(!b.dataset.normalText)b.dataset.normalText=b.textContent;b.disabled=busy;b.textContent=busy?(text||'جارٍ الحفظ...'):b.dataset.normalText;}
function mount(){
 const nav=$(NAV),main=document.querySelector('main');if(!nav||!main||$(PAGE))return;
 const el=document.createElement('section');el.id=PAGE;el.className='page tgr-page';el.innerHTML=markup();main.insertBefore(el,main.firstChild);
 nav.onclick=e=>{e.stopImmediatePropagation();open();};
 document.querySelectorAll('#nav .nav-item').forEach(b=>{if(b!==nav)b.addEventListener('click',leave)});
 $('tgrCreate').addEventListener('click',create);
 $('tgrSelect').addEventListener('change',e=>load(e.target.value));
 $('tgrMetaSave').addEventListener('click',saveMeta);
 $('tgrAddFinding').addEventListener('click',()=>selectFinding(null));
 $('tgrSaveFinding').addEventListener('click',saveFinding);
 $('tgrRemoveFinding').addEventListener('click',removeFinding);
 $('tgrExport').addEventListener('click',()=>printReport());
 $('tgrExportPptx').addEventListener('click',exportPptx);
 $('tgrFindingList').addEventListener('click',e=>{const b=e.target.closest('[data-finding]');if(b)selectFinding(b.dataset.finding)});
 $('tgrPhotoGrid').addEventListener('change',photoChange);
 $('tgrPhotoGrid').addEventListener('click',photoClick);
 $('tgrPhotoGrid').addEventListener('input',e=>{if(e.target.matches('textarea,input:not([type=file]),select'))state.dirty=true;});
 $('tgrMetaFields').addEventListener('input',()=>{$('tgrMetaSave').classList.add('tgr-unsaved');renderKpis()});
 refresh();
 refreshContractors();
 refreshWorkTypes();
}
function markup(){return `
<div class="tgr-hero"><div><small>TEMPORARY GENERATORS | WEEKLY REPORT</small><h2>تقرير المؤقتات والمولدات</h2><p>تقرير أسبوعي موحد مع صور قبل المعالجة وبعد المعالجة، وتوثيق كل ملاحظة بصور قبل وبعد المعالجة، ووصف الحالة والإجراء التصحيحي.</p></div><div class="tgr-toolbar"><button id="tgrExport" type="button" disabled>تصدير PDF</button><button id="tgrExportPptx" type="button" disabled>تصدير PowerPoint</button></div></div>
<div class="tgr-line"><label>التقارير المحفوظة <select id="tgrSelect"><option value="">اختر التقرير...</option></select></label><button id="tgrCreate" type="button">+ إنشاء تقرير أسبوعي</button><span id="tgrNotice" class="tgr-notice">جاري تحميل التقارير...</span></div>
<div id="tgrWorkspace" hidden>
<section class="tgr-panel tgr-weekly-template">
<div class="tgr-original-heading"><h3>تقرير أعمال المؤقتات والمولدات</h3><div class="tgr-original-brand"><img src="/assets/pdc-logo.png" alt="PDC"><img src="/assets/saudi-electricity-logo.png" alt="الشركة السعودية للكهرباء"></div></div>
<div class="tgr-original-toolbar"><span>إدخال ملخص الأسبوع وفق ترتيب صفحة التقرير الأصلي.</span><button id="tgrMetaSave" type="button">حفظ بيانات التقرير</button></div>
<div id="tgrMetaFields">
<div class="tgr-original-metrics tgr-temporary-metrics">
<label class="tgr-original-metric"><span>عدد المواقع الحالية</span><input id="tgrCurrentSites" type="number" min="0" step="1"></label>
<label class="tgr-original-metric"><span>عدد المواقع المغلقة</span><input id="tgrClosedSites" type="number" min="0" step="1"></label>
<label class="tgr-original-metric"><span>الكابلات المؤقتة</span><input id="tgrTemporaryCables" type="number" min="0" step="1"></label>
<label class="tgr-original-metric"><span>المولدات الإجمالي</span><input id="tgrGeneratorsTotal" type="number" min="0" step="1"></label>
</div>
<div class="tgr-original-lower">
<section class="tgr-original-highlights"><h4>أبرز ملاحظات المؤقتات والمولدات المرصودة في الموقع</h4><label for="tgrHighlights">ملخص تلقائي من حقل «الملاحظات المرصودة» داخل كل ملاحظة محفوظة أدناه؛ لا يحتاج إلى إدخال يدوي.</label><textarea id="tgrHighlights" rows="10" readonly aria-readonly="true" placeholder="ستظهر هنا الملاحظات المسجلة بعد حفظها."></textarea></section>
<section class="tgr-original-status"><div class="tgr-original-metric tgr-original-counter"><span>إجمالي الملاحظات</span><strong id="tgrAutoFindings" role="status">0</strong></div>
<div class="tgr-original-metric tgr-original-counter"><span>عدد الملاحظات المفتوحة</span><strong id="tgrAutoOpen" role="status" aria-live="polite">0</strong></div>
<div class="tgr-original-metric tgr-original-counter"><span>عدد الملاحظات المغلقة</span><strong id="tgrAutoClosed" role="status" aria-live="polite">0</strong></div>
<small id="tgrCountsHint">تُحسب الأعداد تلقائيًا من الملاحظات المحفوظة أدناه.</small>
</section>
<section class="tgr-original-contractors">
<table aria-label="ملاحظات المؤقتات والمولدات حسب المقاول"><thead><tr><th>المقاول</th><th>عدد ملاحظات المؤقتات والمولدات</th></tr></thead><tbody id="tgrContractorRows"></tbody><tfoot><tr><th scope="row">الإجمالي</th><td id="tgrContractorTotal">0</td></tr></tfoot></table>
<small id="tgrContractorHint">جدول تلقائي من المقاول المختار في الملاحظات المحفوظة لهذا التقرير؛ لا يحتاج لإضافة أسماء أو تعديل أعداد.</small>
</section>
</div>
<details class="tgr-original-extras"><summary>بيانات الفترة والاعتماد وملاحظات التقرير العامة</summary><div class="tgr-grid">
<label>عنوان الأسبوع<input id="tgrWeekLabel" maxlength="120" placeholder="الأسبوع الثاني - أكتوبر 2026"></label>
<label>من تاريخ<input id="tgrStart" type="date"></label><label>إلى تاريخ<input id="tgrEnd" type="date"></label>
<label>معد التقرير<input id="tgrPrepared" placeholder="الاسم أو المسمى الوظيفي" maxlength="180"></label>
<label class="tgr-wide">ملاحظات التقرير العامة<textarea id="tgrNotes" rows="2" maxlength="2000"></textarea></label>
</div></details>
</div></section>
<section class="tgr-panel tgr-checklist"><h3>مراعاة ملاحظات السلامة والجودة لأعمال المؤقتات</h3><ol><li>تأمين نقاط التوصيل بشكل آمن وصحيح</li><li>مطبات الحماية سليمة وكافية</li><li>وجود أقفال السلامة</li><li>وجود أقماع حماية</li><li>وجود أشرطة تحذيرية</li><li>التأكد من تثبيت البراغي للمعدة بشكل صحيح</li><li>إغلاق منطقة العمل إذا تطلب الأمر</li><li>وضع الحواجز بالشكل المناسب</li><li>إغلاق أبواب المحطات والكبائن</li><li>يمنع استخدام مصدر تغذية آخر في حالة عدم وجود مولد</li></ol></section>
<section class="tgr-panel"><div class="tgr-section-head"><h3>الملاحظات والإجراءات التصحيحية</h3><button id="tgrAddFinding" type="button">+ إضافة ملاحظة</button></div>
<div class="tgr-master-detail"><div id="tgrFindingList" class="tgr-findings-list"></div>
<div class="tgr-editor" id="tgrEditor" hidden>
<div class="tgr-reference-heading"><div><h4 id="tgrEditorTitle">بيانات المعالجة والتوثيق</h4><p>نموذج إدخال مطابق لترتيب صفحة الملاحظة في التقرير: بيانات أمر العمل ← قبل المعالجة ← بعد المعالجة.</p></div><span class="tgr-reference-pill">ملاحظة مستقلة لكل حالة</span></div>
<div id="tgrPhotoGrid" class="tgr-reference-layout">
<section class="tgr-ref-card tgr-ref-order" aria-label="بيانات أمر العمل">
<h5>بيانات أمر العمل</h5>
<div class="tgr-ref-fields">
<label>رقم أمر العمل<input id="tgrWO" inputmode="numeric" maxlength="40" placeholder="رقم أمر العمل"></label>
<label>المقاول<select id="tgrContractor" aria-label="المقاول"><option value="">جاري تحميل المقاولين...</option></select></label>
<label>الاستشاري<input id="tgrConsultant" maxlength="180" value="أبعاد الرؤية"></label>
<label>نوع أمر العمل<select id="tgrType"><option value="">جاري تحميل أنواع أوامر العمل من info...</option></select></label>
<label>موقع العمل<input id="tgrLocation" maxlength="180" placeholder="مثال: العزيزية"></label>
<label>وصف العمل<input id="tgrWorkDescription" maxlength="500" placeholder="مثال: استبدال محطة بكدج"></label>
<label class="tgr-ref-observation">الملاحظات المرصودة<textarea id="tgrObservation" rows="5" maxlength="1700" placeholder="اكتب الملاحظة كما ستظهر في التقرير"></textarea></label>
<label>حالة الملاحظة<select id="tgrStatus"><option>مفتوحة</option><option>جاري التصحيح</option><option>مغلقة</option></select></label>
</div></section>
<section class="tgr-ref-card tgr-ref-before" aria-label="قبل المعالجة">
<h5>قبل المعالجة</h5>
<div id="tgrPhotoBefore" class="tgr-phase-photos"></div>
<label class="tgr-ref-description tgr-description-reference">وصف الحالة<textarea id="tgrBeforeDesc" rows="3" maxlength="1000" placeholder="وصف الحالة قبل المعالجة"></textarea></label>
<div class="tgr-phase-actions"><button type="button" data-phase-save="1">حفظ الصورة والتعليق</button><button type="button" class="tgr-danger" data-photo-delete="1" disabled>حذف الصورة</button></div>
</section>
<section class="tgr-ref-card tgr-ref-after" aria-label="بعد المعالجة">
<h5>بعد المعالجة</h5>
<div id="tgrPhotoAfter" class="tgr-phase-photos"></div>
<label class="tgr-ref-description tgr-description-reference">وصف الإجراء التصحيحي<textarea id="tgrAction" rows="3" maxlength="1700" placeholder="الإجراء التصحيحي أو في انتظار التصحيح"></textarea></label>
<div class="tgr-phase-actions"><button type="button" data-phase-save="5">حفظ الصورة والتعليق</button><button type="button" class="tgr-danger" data-photo-delete="5" disabled>حذف الصورة</button></div>
<input id="tgrAfterDesc" type="hidden" value="">
</section>
</div>
<div id="tgrPhotoSection" hidden><p>تظهر معاينة الصور فور اختيارها، حتى قبل حفظ الملاحظة. اكتب وصف الحالة تحت صورة «قبل المعالجة»، ووصف الإجراء التصحيحي تحت صورة «بعد المعالجة»، ثم احفظ بيانات الملاحظة وصورها معًا.</p></div>
<div class="tgr-editor-actions"><button id="tgrSaveFinding" type="button">حفظ بيانات الملاحظة</button><button id="tgrRemoveFinding" class="tgr-danger" type="button" hidden>حذف الملاحظة</button></div>
</div></div></section></div>`}
function open(){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(PAGE).classList.add('active');document.querySelectorAll('#nav .nav-item').forEach(x=>x.classList.toggle('active',x.id===NAV));const bar=$('filterBar');if(bar)bar.style.display='none';const title=$('pageTitle');if(title)title.textContent='تقرير المؤقتات والمولدات';document.body.classList.add('tgr-open');}
function leave(){document.body.classList.remove('tgr-open');$(PAGE)?.classList.remove('active');const bar=$('filterBar');if(bar)bar.style.display='';}
const contractorKey=value=>clean(value).normalize('NFKC').replace(/\s+/g,' ').replace(/[\u0640\u064B-\u065F]/g,'').toLocaleLowerCase('ar');
function contractorCountMap(){
 const totals=new Map();
 for(const finding of state.findings){
  const name=clean(finding.contractor)||'غير محدد',key=contractorKey(name);
  if(!totals.has(key))totals.set(key,{name,count:0});
  totals.get(key).count++;
 }
 return totals;
}
function summaryContractors(){return derivedContractors();}
function renderContractorRows(){
 const values=summaryContractors(),target=$('tgrContractorRows');
 if(!target)return;
 target.innerHTML=values.length?values.map(x=>
  '<tr><td>'+esc(x.name)+'</td><td><output class="tgr-contractor-count">'+fmt(x.count)+'</output></td></tr>'
 ).join(''):'<tr class="tgr-contractors-empty"><td colspan="2">لا توجد ملاحظات محفوظة بعد.</td></tr>';
 const total=$('tgrContractorTotal');if(total)total.textContent=fmt(values.reduce((n,x)=>n+x.count,0));
}
const observationNotes=()=>state.findings.map(f=>clean(f.observation)).filter(Boolean);
const highlightsText=()=>observationNotes().map((note,i)=>(i+1)+'- '+note).join('\n\n');
function renderHighlights(){const area=$('tgrHighlights');if(area)area.value=highlightsText();}
const detailCount=()=>({total:state.findings.length,open:state.findings.filter(f=>f.status!=='مغلقة').length,closed:state.findings.filter(f=>f.status==='مغلقة').length});
function derivedContractors(){
 return [...contractorCountMap().values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ar'));
}
function getMeta(){
 return {weekLabel:clean($('tgrWeekLabel').value),startDate:$('tgrStart').value,endDate:$('tgrEnd').value,
 totalSites:0,visitedSites:0,totalVisits:0,
 currentSites:Number($('tgrCurrentSites').value||0),closedSites:Number($('tgrClosedSites').value||0),temporaryCables:Number($('tgrTemporaryCables').value||0),generatorsTotal:Number($('tgrGeneratorsTotal').value||0),
 preparedBy:clean($('tgrPrepared').value),notes:clean($('tgrNotes').value),highlights:highlightsText(),
 manualFindings:null,manualOpen:null,manualClosed:null,
 contractorBreakdown:summaryContractors()};
}
function fillMeta(r){
 $('tgrWeekLabel').value=r.weekLabel||'';$('tgrStart').value=r.startDate||'';$('tgrEnd').value=r.endDate||'';
 for(const [id,key] of [['tgrCurrentSites','currentSites'],['tgrClosedSites','closedSites'],['tgrTemporaryCables','temporaryCables'],['tgrGeneratorsTotal','generatorsTotal']])$(id).value=r[key]??0;
 $('tgrPrepared').value=r.preparedBy||'';$('tgrNotes').value=r.notes||'';renderHighlights();
 renderContractorRows();
 $('tgrWorkspace').hidden=false;$('tgrExport').disabled=false;$('tgrExportPptx').disabled=false;$('tgrMetaSave').classList.remove('tgr-unsaved');
}
function validateMeta(x){if(!validDate(x.startDate)||!validDate(x.endDate)||x.startDate>x.endDate)throw Error('حدد فترة زمنية صحيحة.');}
function renderContractorOptions(selected){
 const el=$('tgrContractor');if(!el)return;
 const value=clean(selected===undefined?el.value:selected);
 const options=[...new Set([...state.contractors,...state.findings.map(f=>f.contractor),value].map(clean).filter(Boolean))]
   .sort((a,b)=>a.localeCompare(b,'ar'));
 el.innerHTML='<option value="">'+(options.length?'اختر المقاول':'لا توجد أسماء مقاولين متاحة بعد')+'</option>'+
   options.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('');
 el.value=value;
}
function renderWorkTypeOptions(selected){
 const el=$('tgrType');if(!el)return;
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
async function refresh(){try{const j=await request('/reports');state.reports=j.reports||[];$('tgrSelect').innerHTML='<option value="">اختر تقريرًا محفوظًا...</option>'+state.reports.map(r=>'<option value="'+esc(r.id)+'">'+esc((r.weekLabel||'تقرير')+' • '+r.startDate+' / '+r.endDate)+'</option>').join('');if(state.report)$('tgrSelect').value=state.report.id;notice('اختر تقريرًا أو أنشئ تقريرًا جديدًا.')}catch(e){notice(e.message,true)}}
async function create(){
 if(!confirm('إنشاء تقرير أسبوعي جديد؟'))return;
 const d=today(),start=new Date(d+'T12:00:00');start.setDate(start.getDate()-6);
 const from=start.getFullYear()+'-'+String(start.getMonth()+1).padStart(2,'0')+'-'+String(start.getDate()).padStart(2,'0');
 buttonBusy('tgrCreate',true);
 try{const j=await request('/reports','POST',{startDate:from,endDate:d,weekLabel:'تقرير أسبوعي – '+d,totalSites:0,visitedSites:0,totalVisits:0});await refresh();await load(j.report.id);notice('تم إنشاء التقرير، ويمكنك الآن إضافة الملاحظات والصور.')}catch(e){notice(e.message,true)}finally{buttonBusy('tgrCreate',false)}
}
async function load(id){
 if(!id){state.report=null;state.findings=[];state.current=null;$('tgrWorkspace').hidden=true;$('tgrExport').disabled=true;$('tgrExportPptx').disabled=true;return}
 notice('جارٍ تحميل التقرير...');
 try{const j=await request('/reports/'+encodeURIComponent(id));state.report=j.report;$('tgrSelect').value=j.report.id;state.findings=j.findings||[];state.current=null;state.photos=[];state.pending={};state.photoDraft={};state.dirty=false;fillMeta(j.report);renderContractorOptions();renderWorkTypeOptions();renderKpis();renderFindings();$('tgrEditor').hidden=true;notice('تم تحميل التقرير • '+state.findings.length+' ملاحظة.')}catch(e){notice(e.message,true)}
}
async function saveMeta(){const data=getMeta();try{validateMeta(data);buttonBusy('tgrMetaSave',true);const j=await request('/reports/'+state.report.id,'PUT',data);state.report=j.report;fillMeta(state.report);await refresh();renderKpis();notice('تم حفظ بيانات التقرير.')}catch(e){notice(e.message,true)}finally{buttonBusy('tgrMetaSave',false)}}
function renderKpis(){
 renderHighlights();
 const detail=detailCount();
 for(const [id,value] of [['tgrAutoFindings',detail.total],['tgrAutoOpen',detail.open],['tgrAutoClosed',detail.closed]])$(id).textContent=fmt(value);
 $('tgrCountsHint').textContent='إجمالي '+detail.total+' ملاحظة محفوظة: '+detail.open+' مفتوحة (تشمل جاري التصحيح) + '+detail.closed+' مغلقة. يُحدث العداد تلقائيًا بعد الحفظ أو الحذف.';
 renderContractorRows();
 const counted=summaryContractors().reduce((sum,item)=>sum+item.count,0);
 $('tgrContractorHint').textContent='العدد محسوب تلقائيًا من '+detail.total+' ملاحظة محفوظة في هذا الأسبوع. مجموع جدول المقاولين: '+counted+'.';
}
function renderFindings(){
 const list=$('tgrFindingList'),has=state.findings.length>0;
 list.innerHTML=has?state.findings.map((f,i)=>'<button type="button" class="tgr-finding'+(state.current===f.id?' active':'')+'" data-finding="'+esc(f.id)+'"><b>ملاحظة '+(i+1)+' • '+esc(f.workOrder||'بدون رقم')+'</b><span>'+esc(f.observation||'لا يوجد وصف بعد')+'</span><small>'+esc(f.contractor||'المقاول غير محدد')+' · '+esc(f.status)+'</small></button>').join(''):'';
 list.hidden=!has;
 list.parentElement.classList.toggle('tgr-has-list',has);
}
function selectFinding(id){
 const f=state.findings.find(x=>x.id===id)||{id:'',workOrder:'',contractor:'',consultant:'أبعاد الرؤية',workType:'',location:'',workDescription:'',observation:'',correctiveAction:'',status:'مفتوحة',beforeDescription:'',afterDescription:''};
 if(state.dirty&&!confirm('توجد صور أو تعليقات لم تحفظ. هل تريد الانتقال دون حفظها؟'))return;state.current=f.id||null;state.photos=[];state.pending={};state.photoDraft={};state.dirty=false;
 for(const [field,key] of [['tgrWO','workOrder'],['tgrLocation','location'],['tgrWorkDescription','workDescription'],['tgrType','workType'],['tgrContractor','contractor'],['tgrConsultant','consultant'],['tgrStatus','status'],['tgrObservation','observation'],['tgrAction','correctiveAction'],['tgrBeforeDesc','beforeDescription'],['tgrAfterDesc','afterDescription']])$(field).value=f[key]||'';
 renderWorkTypeOptions(f.workType);
 renderContractorOptions(f.contractor);
 $('tgrEditor').hidden=false;$('tgrEditorTitle').textContent=f.id?'تعديل ملاحظة المؤقتات والمولدات':'إضافة ملاحظة جديدة';
 $('tgrRemoveFinding').hidden=!f.id;$('tgrPhotoSection').hidden=!f.id;renderFindings();renderPhotos();
 if(f.id)loadPhotos();
}
function findingForm(){return {id:state.current||'',workOrder:clean($('tgrWO').value),workType:clean($('tgrType').value),location:clean($('tgrLocation').value),workDescription:clean($('tgrWorkDescription').value),contractor:clean($('tgrContractor').value),consultant:clean($('tgrConsultant').value),status:$('tgrStatus').value,observation:clean($('tgrObservation').value),correctiveAction:clean($('tgrAction').value),beforeDescription:clean($('tgrBeforeDesc').value),afterDescription:clean($('tgrAfterDesc').value)}}
async function saveFinding(){
 await Promise.all(Object.values(state.processing||{}).map(p=>p.catch(()=>null)));
 const b=findingForm();
 if(!b.observation){notice('اكتب الملاحظة المرصودة أولاً لحفظ الملاحظة والصور.',true);return}
 if(!state.report){notice('اختر التقرير الأسبوعي أولاً.',true);return}
 const wasNew=!state.current;
 try{
  buttonBusy('tgrSaveFinding',true,'جارٍ حفظ البيانات والصور...');
  const j=await request('/reports/'+encodeURIComponent(state.report.id)+'/findings','POST',b);
  const index=state.findings.findIndex(x=>x.id===j.finding.id);
  if(index>=0)state.findings[index]=j.finding;else state.findings.push(j.finding);
  state.current=j.finding.id;
  if(wasNew)state.photos=[];
  $('tgrRemoveFinding').hidden=false;$('tgrPhotoSection').hidden=false;
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
 finally{buttonBusy('tgrSaveFinding',false)}
}
async function removeFinding(){
 if(!state.current||!confirm('هل تريد حذف الملاحظة؟ يُنصح بحذف صورها أولاً؛ قد تبقى ملفاتها المؤرشفة في ورقة الصور.'))return;
 try{await request('/reports/'+state.report.id+'/findings/'+state.current,'DELETE');state.findings=state.findings.filter(f=>f.id!==state.current);state.current=null;state.photos=[];$('tgrEditor').hidden=true;renderKpis();renderFindings();notice('تم حذف سجل الملاحظة.')}catch(e){notice(e.message,true)}
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
  return '<article class="tgr-photo tgr-photo-primary" data-slot="'+slot+'"><header><b>الصورة الأساسية</b><small>'+(pending?'جاهزة للحفظ':photo?.dataUrl?'محفوظة':'غير مرفقة')+'</small></header>'+
   '<div class="tgr-photo-preview">'+(src?'<img src="'+esc(src)+'" alt="'+label+'">':'<span>أضف صورة '+label+'</span>')+'</div>'+
   '<label class="tgr-upload">رفع صورة '+label+'<input type="file" accept="image/*" data-photo-file="'+slot+'" aria-label="رفع صورة '+label+'"></label></article>';
 };
 $('tgrPhotoBefore').innerHTML=card(1);
 $('tgrPhotoAfter').innerHTML=card(5);
 for(const slot of [1,5]){const del=$('tgrPhotoGrid').querySelector('[data-photo-delete="'+slot+'"]');if(del)del.disabled=!(state.pending[slot]||stored(slot)?.dataUrl);}
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
 const file=e.target.files[0],card=e.target.closest('.tgr-photo');
 if(!file.type.startsWith('image/')||file.size>20*1024*1024){notice('اختر صورة صالحة بحجم لا يزيد عن 20 ميجابايت.',true);return}
 const previewUrl=URL.createObjectURL(file);
 const preview=card?.querySelector('.tgr-photo-preview');
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
  const current=$('tgrPhotoGrid')?.querySelector('[data-slot="'+slot+'"]');
  if(current){
   const target=current.querySelector('.tgr-photo-preview');
   target.replaceChildren();
   const img=document.createElement('img');img.src=result;img.alt='معاينة الصورة';target.append(img);
   current.querySelector('header small').textContent='جاهزة للحفظ';
   const del=$('tgrPhotoGrid')?.querySelector('[data-photo-delete="'+slot+'"]');
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

function approvedEndcapsCss(){return `@page{size:13.333333in 7.5in;margin:0}
@media print{html,body{margin:0!important;padding:0!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.print-actions{display:none!important}.sheet{width:13.333333in!important;min-height:7.5in!important;box-sizing:border-box!important;margin:0!important;page-break-after:always;break-after:page}.sheet.approved-page{height:7.5in!important;min-height:7.5in!important}.sheet:last-of-type{page-break-after:auto;break-after:auto}}
.sheet.approved-page{position:relative;box-sizing:border-box;display:block;overflow:hidden;padding:0!important;margin:0!important;border:0!important;background:#fff;aspect-ratio:16/9}
.sheet.approved-page:before{content:none!important;display:none!important}
.approved-page .approved-bg{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:fill;display:block}
.approved-page .approved-mask{position:absolute;background:#123e6c!important;direction:rtl;text-align:right;display:flex;align-items:center;justify-content:flex-start;white-space:nowrap;overflow:hidden;font-family:Arial,Tahoma,sans-serif;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.approved-page .approved-cover-city{left:17.3%;top:44.1%;width:27.8%;height:6.8%;color:#f58220;font-size:28px;font-weight:bold}
.approved-page .approved-cover-week{left:27.2%;top:70.5%;width:18%;height:5.8%;color:white;font-size:17.5px;font-weight:normal}
.approved-page .approved-end-city{left:57.2%;top:67.7%;width:20.1%;height:5.8%;color:white;font-size:20.5px;font-weight:normal}
`;}
function approvedCityLabel(){return 'دائرة مشاريع التوزيع - '+(/جدة|Jeddah/i.test(city)?'جدة':'مكة المكرمة');}
function approvedCoverHtml(r){const label=esc(approvedCityLabel()),week=esc(r.weekLabel||'الأسبوع الحالي');return '<section class="sheet approved-page approved-cover">'+
'<img class="approved-bg" src="/assets/safety-approved-cover.jpg" alt="غلاف التقرير المعتمد">'+
'<span class="approved-mask approved-cover-city">'+label+'</span>'+
'<span class="approved-mask approved-cover-week">'+week+'</span></section>';}
function approvedEndingHtml(){return '<section class="sheet approved-page approved-ending">'+
'<img class="approved-bg" src="/assets/safety-approved-ending.jpg" alt="صفحة الختام المعتمدة">'+
'<span class="approved-mask approved-end-city">'+esc(approvedCityLabel())+'</span></section>';}

function printCss(){return `@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{direction:rtl;font-family:Tahoma,Arial,sans-serif;color:#16395c;margin:0}h1,h2,h3,p{margin-top:0}.print-actions{padding:12px;background:#dae8f7;text-align:center;position:sticky;top:0;z-index:10}.print-actions button{padding:10px 24px;background:#183f67;color:white;border:0;border-radius:8px;font-weight:bold;cursor:pointer}.sheet{min-height:180mm;page-break-after:always;position:relative;padding:15mm;border-top:8px solid #f18c2d;overflow:hidden}.sheet:before{content:'VISION DIMENSIONS';position:absolute;opacity:.035;left:25%;top:42%;font-size:50pt;transform:rotate(-15deg);pointer-events:none}.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #dbe8f1;padding-bottom:8mm;margin-bottom:10mm}.brand img{height:22mm;max-width:35mm;object-fit:contain}.brand h2{font-size:16pt;margin:0}.cover{background:linear-gradient(120deg,#143b62 35%,#1c5885 80%);color:#fff;text-align:center;padding:25mm}.cover .brand{border-color:#ffffff48}.cover .brand h2{color:#fff}.cover h1{font-size:32pt;margin-top:24mm}.cover p{font-size:17pt;color:#f9c490}.cover span{font-size:13pt}.end{background:#173e66;color:white;text-align:center}.end h1{font-size:31pt;margin-top:42mm}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7mm;margin-bottom:12mm}.metric{padding:8mm;border:1px solid #bcd1e5;border-radius:8px;background:#eef5fb}.metric b{display:block;font-size:23pt;margin-top:4mm}.summary-table{width:100%;border-collapse:collapse;font-size:11pt}.summary-table th,.summary-table td{padding:4mm;border:1px solid #d1dfec;text-align:right}.summary-table th{background:#17446e;color:#fff}.summary-table tr:nth-child(even){background:#f0f5fb}.finding-title{background:#17446e;color:#fff;padding:3mm 6mm;border-radius:5px;font-size:14pt}.finding-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;font-size:10pt}.finding-meta span{padding:3mm;border:1px solid #d7e3ee;border-radius:5px}.finding-text{padding:3mm 6mm;background:#f2f7fb;border-inline-start:4px solid #f18c2d;margin:3mm 0;white-space:pre-wrap;font-size:11pt}.photos{display:grid;grid-template-columns:1fr 1fr;gap:8mm}.photos-col h3{text-align:center;background:#f18c2d;color:white;border-radius:5px;padding:2mm}.photos-col.after h3{background:#17446e}.photo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm}.photo-list figure{margin:0;border:1px solid #d9e4ef;padding:2mm;break-inside:avoid;border-radius:6px}.photo-list img{display:block;width:100%;height:40mm;object-fit:contain;background:#f7f9fb}.photo-list figcaption{text-align:center;font-size:9pt;color:#173d64;min-height:12mm;overflow-wrap:anywhere;padding-top:2mm}.empty{padding:20mm 2mm;text-align:center;color:#6b8197;border:1px dashed #b3c3d4;border-radius:5px}.foot{position:absolute;bottom:6mm;right:16mm;left:16mm;text-align:center;border-top:1px solid #c9dbe8;padding-top:2mm;font-size:9pt;color:#688096}@media print{.print-actions{display:none}.sheet{border-top-width:6px}body{background:white}}`}

function originalSummaryCss(){return '@media print{.tgr-p-summary{page-break-inside:avoid}}'+
'.tgr-p-summary{font-family:Tahoma,Arial,sans-serif;padding:10mm 9mm;min-height:180mm;border-top:0;direction:rtl}'+
'.tgr-p-head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #f18c2d;padding-bottom:4mm;margin-bottom:5mm}'+
'.tgr-p-head h2{font-size:18pt;margin:0;color:#123a66}.tgr-p-logos{direction:ltr;display:flex;gap:5mm}'+
'.tgr-p-logos img{height:15mm;max-width:32mm;object-fit:contain}'+
'.tgr-p-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm;margin-bottom:5mm}'+
'.tgr-p-metric{background:linear-gradient(#fff,#edf1f5,#fff);border:1px solid #b6c2d2;text-align:center;min-height:27mm;box-shadow:1px 2px 2px #a0a7b0}'+
'.tgr-p-metric>span{display:block;background:linear-gradient(#35689a,#0d2e51);color:#fff;padding:2mm 1mm;font-size:13pt;font-weight:bold;min-height:11mm}'+
'.tgr-p-metric>b{display:block;font-size:22pt;color:#174572;padding:4mm 0 1mm}'+
'.tgr-p-lower{display:grid;grid-template-columns:1.5fr .83fr .9fr;gap:8mm;direction:rtl;align-items:start}'+
'.tgr-p-highlights{background:#cfdef2;color:#0e396b;border-radius:14mm;padding:5mm 7mm;min-height:91mm;box-shadow:1px 2px 3px #aaa}'+
'.tgr-p-highlights h3{font-size:13pt;text-align:center;line-height:1.5}'+
'.tgr-p-highlights li{font-size:11pt;font-weight:bold;line-height:1.6;margin:1mm 0;white-space:pre-wrap;overflow-wrap:anywhere}'+
'.tgr-p-status{display:grid;gap:7mm;padding-top:3mm}'+
'.tgr-p-contractors table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9pt}'+
'.tgr-p-contractors th{background:#4c82bd;color:#fff;font-size:9pt;padding:2mm;text-align:center}'+
'.tgr-p-contractors td{background:#d0d9e8;text-align:center;padding:1.5mm;border:1px solid #fff}'+
'.tgr-p-contractors tr:nth-child(even) td{background:#e8edf4}'+
'.tgr-p-extra-notes{font-size:9pt;padding-top:4mm;color:#456786}';
}


function originalFindingCss(){return `
@page{size:13.333in 7.5in;margin:0}
html,body{margin:0!important;padding:0!important;background:#fff!important}
.sheet{width:13.333in;height:7.5in;min-height:7.5in;max-height:7.5in;break-after:page;page-break-after:always;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet:last-child{break-after:auto;page-break-after:auto}
.tgr-f-slide{direction:rtl;color:#0c3763;background:#fff;border:0!important;padding:0!important;position:relative;font-family:Tahoma,Arial,sans-serif;box-shadow:none}
.tgr-f-slide::before{content:none!important}
.tgr-f-header{height:22mm;display:flex;align-items:center;justify-content:space-between;padding:0 10mm;border-bottom:1.25mm solid #ff8423;position:relative}
.tgr-f-header h2{font-size:17pt;font-weight:900;margin:0;color:#0d3866}
.tgr-f-logos{display:flex;direction:ltr;align-items:center;gap:10mm;height:100%}
.tgr-f-logos img{max-width:34mm;max-height:14mm;width:auto;height:auto;object-fit:contain}
.tgr-f-frame{position:absolute;top:26mm;right:6mm;left:6mm;bottom:10mm;border:0.55mm solid #d2d9df;border-radius:18mm;box-shadow:0 0.5mm 0.65mm #0002;display:grid;grid-template-columns:.82fr 1fr 1fr;gap:7mm;padding:6mm;direction:rtl}
.tgr-f-order{background:#113f6b;border-radius:13mm;box-shadow:0 0.65mm 0.9mm #0003;padding:6mm 5mm 4mm;display:flex;flex-direction:column;min-width:0;min-height:0;color:#123d67}
.tgr-f-order h3{color:#fff;font-size:17pt;font-weight:900;text-align:center;margin:0 0 4mm;padding-bottom:3mm;border-bottom:.75mm solid #f78a24}
.tgr-f-detail{border-radius:3.5mm;background:#fff;text-align:right;min-height:15mm;margin-bottom:3mm;box-shadow:0 .5mm .65mm #0002;padding:3mm 3.5mm;display:flex;justify-content:flex-start;align-items:center;gap:1.8mm;flex-wrap:wrap;min-width:0;font-size:10.5pt;font-weight:700;line-height:1.3}
.tgr-f-detail b{color:#123d67;flex:none}
.tgr-f-detail span{color:#174573;font-weight:900;overflow-wrap:anywhere;min-width:0}
.tgr-f-observed{flex:1;display:block;border-radius:7mm;margin-bottom:0;padding:4mm 4mm;min-height:32mm;overflow:hidden}
.tgr-f-observed b{display:block;margin-bottom:2mm}
.tgr-f-observed span{display:block;white-space:pre-wrap;font-size:11pt;line-height:1.4}
.tgr-f-card{border:.55mm solid #d4dbe0;border-radius:17mm;box-shadow:0 .6mm .8mm #0003;background:#fff;min-width:0;min-height:0;padding:3.3mm 5mm 7mm;display:flex;flex-direction:column;position:relative;align-items:stretch}
.tgr-f-card h3{border-radius:3.5mm;padding:2.7mm 1mm;margin:0 0 4mm;background:#ff831c;color:#fff;font-size:16pt;min-height:14mm;text-align:center;font-weight:900;box-shadow:0 .7mm 1mm #0003}
.tgr-f-after h3{background:#123e69}
.tgr-f-photo-border{margin:0 1mm;border:0.55mm dashed #f88722;border-radius:15mm;padding:3.1mm;height:85mm;min-height:85mm;display:flex;align-items:center;justify-content:center;overflow:hidden}
.tgr-f-after .tgr-f-photo-border{border-color:#124370}
.tgr-f-photo-border img{display:block;max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;border-radius:11mm;background:#f7f9fb}
.tgr-f-photo-empty{color:#7086a0;font-weight:700;font-size:12pt;text-align:center}
.tgr-f-caption{margin-top:4mm;min-height:23mm;max-height:35mm;background:#f6f9fc;border:.4mm solid #c9d3da;border-radius:4mm;box-shadow:0 .65mm .85mm #0002;padding:3mm 3.3mm;text-align:center;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;align-content:center;gap:1mm;overflow:hidden;font-size:11pt;font-weight:900;line-height:1.3;overflow-wrap:anywhere}
.tgr-f-caption span{white-space:pre-wrap}
.tgr-f-before .tgr-f-caption{color:#f17c11}
.tgr-f-after .tgr-f-caption{color:#113f6b}
.tgr-f-arrow{position:absolute;left:33.2%;top:51%;transform:translate(-50%,-50%);z-index:2;width:10mm;height:12mm;background:#fa8520;clip-path:polygon(0 50%,44% 0,44% 28%,100% 28%,100% 72%,44% 72%,44% 100%);filter:drop-shadow(0 .4mm .4mm #b95e17)}
.tgr-f-footer{position:absolute;bottom:2.4mm;right:12mm;left:12mm;text-align:center;font-size:7.5pt;color:#16416b;white-space:nowrap}
@media print{.print-actions{display:none!important}.tgr-f-slide{break-inside:avoid;page-break-inside:avoid}}
`;}


function originalFindingFitScript(){return '<script>window.fitTemporaryGeneratorsSlides=function(){document.querySelectorAll(".tgr-f-slide [data-fittext]").forEach(function(el){var inner=el.querySelector("span");if(!inner)return;var font=parseFloat(getComputedStyle(inner).fontSize);while(el.scrollHeight>el.clientHeight+2&&font>9){font-=.5;inner.style.fontSize=font+"px";}})};window.addEventListener("load",window.fitTemporaryGeneratorsSlides);<\\/script>'.replace('\\/script','/script');}

function renderFindingSlide(f,photos,index,total){
 const imageFor=before=>{
  const picked=photos.filter(p=>p&&p.dataUrl&&(before?Number(p.slot)<=4:Number(p.slot)>4));
  return picked.find(p=>Number(p.slot)===(before?1:5))||picked[0]||null;
 };
 const card=(before)=>{
  const photo=imageFor(before);
  const description=before?(f.beforeDescription||f.observation||'—'):(f.correctiveAction||'في انتظار التصحيح');
  const caption=before?'وصف الحالة':'وصف الإجراء التصحيحي';
  const heading=before?'قبل المعالجة':'بعد المعالجة';
  const phaseClass=before?'tgr-f-before':'tgr-f-after';
  const image=photo?'<img src="'+esc(photo.dataUrl)+'" alt="'+heading+'">':'<span class="tgr-f-photo-empty">لم تُرفق صورة '+heading+'</span>';
  return '<section class="tgr-f-card '+phaseClass+'"><h3>'+heading+'</h3>'+
    '<div class="tgr-f-photo-border">'+image+'</div>'+
    '<div class="tgr-f-caption" data-fittext="1"><b>'+caption+' :</b><span>'+esc(description)+'</span></div></section>';
 };
 const info=(label,value)=>'<div class="tgr-f-detail"><b>'+label+' :</b><span>'+esc(value||'—')+'</span></div>';
 return '<section class="sheet tgr-f-slide" data-finding-slide="'+(index+1)+'">'+
  '<header class="tgr-f-header"><h2>بيانات المعالجة والتوثيق</h2><div class="tgr-f-logos">'+
  '<img src="/assets/pdc-logo.png" alt="PDC"><img src="/assets/saudi-electricity-logo.png" alt="الشركة السعودية للكهرباء"></div></header>'+
  '<div class="tgr-f-frame">'+
   '<aside class="tgr-f-order"><h3>بيانات أمر العمل</h3>'+
    info('رقم أمر العمل',f.workOrder)+info('المقاول',f.contractor)+
    info('الاستشاري',f.consultant||'أبعاد الرؤية')+
    info('نوع أمر العمل',f.workType)+
    '<div class="tgr-f-detail tgr-f-observed" data-fittext="1"><b>الملاحظات المرصودة :</b><span>'+esc(f.observation||'—')+'</span></div>'+
   '</aside>'+
   card(true)+card(false)+
   '<span class="tgr-f-arrow" aria-hidden="true"></span>'+
  '</div>'+
  '<footer class="tgr-f-footer">تقرير المؤقتات والمولدات لكل أسبوع | '+esc(city)+' | الملاحظة '+(index+1)+' من '+total+'</footer>'+
  '</section>';
}

const summaryCounts=()=>{
 const r=state.report||{},detail=detailCount(),grouped={};
 for(const item of summaryContractors())grouped[item.name]=item.count;
 return {total:detail.total,closed:detail.closed,open:detail.open,coverage:visitCoverage(r.totalVisits,r.totalSites),grouped};
};
const brand=title=>'<header class="brand"><img src="/company-logo.png" alt="أبعاد الرؤية"><h2>'+esc(title)+'</h2><img src="/pdc-logo.jpg" alt="PDC"></header>';

const tempGuidance=[
'تأمين نقاط التوصيل بشكل آمن وصحيح','مطبات الحماية سليمة وكافية','وجود أقفال السلامة','وجود أقماع حماية','وجود أشرطة تحذيرية',
'التأكد من تثبيت البراغي للمعدة بشكل صحيح','إغلاق منطقة العمل إذا تطلب الأمر','وضع الحواجز بالشكل المناسب',
'إغلاق أبواب المحطات والكبائن','يمنع استخدام مصدر تغذية آخر في حالة عدم وجود مولد'
];
function tempPage(inside,cls=''){return '<section class="tg-slide '+cls+'">'+inside+'<footer>Public Internal - عام (داخلي)</footer></section>';}
function tempFrame(title,inside){return tempPage('<header class="tg-title">'+esc(title)+'</header>'+inside);}
function tempPrintStyle(){return `
@page{size:13.333in 7.5in;margin:0}*{box-sizing:border-box}body{margin:0;background:#ddd;font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#192d49}
.tg-slide{width:13.333in;height:7.5in;position:relative;background:white;overflow:hidden;padding:.65in .85in;page-break-after:always;break-after:page}
.tg-slide footer{position:absolute;bottom:.18in;right:.5in;font-size:12px;color:#6b7280}
.tg-title{font-size:30px;font-weight:800;color:#123663;border-bottom:6px solid #0c467a;padding-bottom:.24in;margin-bottom:.3in}
.tg-slide.cover{background:linear-gradient(116deg,#091a37 0%,#123969 55%,#245b85 100%);color:white}
.tg-slide.cover h1{font-size:51px;line-height:1.5;margin:2in .6in .3in 0}.tg-slide.cover h2{font-size:28px;margin:0 .6in}
.tg-slide.cover footer{color:#fff}
.tg-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:.18in;margin:.35in 0 .55in}.tg-metric{background:#edf4fa;border:2px solid #dce7f0;text-align:center;border-radius:15px;padding:.25in .08in}
.tg-metric b{display:block;font-size:40px;color:#103966}.tg-metric span{font-size:17px;font-weight:bold}
.tg-note{font-size:24px;border-right:7px solid #438abc;padding:16px 25px;margin:14px 0;line-height:1.6}
.tg-table{width:100%;border-collapse:collapse;font-size:22px;line-height:1.25}
.tg-table td,.tg-table th{border:2px solid #aac1d2;padding:10px 19px}.tg-table th{background:#1a4f7f;color:white}
.tg-detail-head{display:flex;gap:25px;justify-content:space-between;font-size:19px;background:#eef4f8;padding:20px 25px;border-radius:10px;line-height:1.8}
.tg-images{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:.22in}
.tg-figure{border:2px solid #b7cbdc;border-radius:12px;overflow:hidden;min-height:3.6in}
.tg-figure header{background:#123f70;color:white;font-size:21px;padding:10px 18px;font-weight:700}
.tg-figure img{display:block;width:100%;height:2.5in;object-fit:contain;background:#f7f9fc}
.tg-figure .missing{height:2.5in;display:grid;place-items:center;background:#f7f9fc;color:#667085}
.tg-figure p{font-size:17px;margin:10px 17px;line-height:1.4}
.tg-end{display:grid;place-items:center;text-align:center}
.tg-end h1{font-size:82px;color:#173960}
.print-actions{position:fixed;z-index:999;top:8px;left:8px;background:#fff;padding:9px;border-radius:8px}
@media print{body{background:white}.print-actions{display:none}.tg-slide{margin:0}}
`;}
async function printReport(externalWindow=null){
 if(!state.report)return;
 if($('tgrMetaSave').classList.contains('tgr-unsaved')||state.dirty){notice('احفظ التغييرات والملاحظات قبل التصدير.',true);return}
 const win=externalWindow||window.open('','_blank','width=1440,height=920');
 if(!win){notice('اسمح بالنوافذ المنبثقة لتصدير PDF.',true);return}
 buttonBusy('tgrExport',true,'جارٍ إعداد الشرائح الأصلية...');
 try{
  if(!window.VDGeneratorOriginalDeck)throw Error('القالب الأصلي لم يحمل؛ حدّث الصفحة.');
  const check=await fetch('/generator-template/shared_5.webp',{cache:'no-store'});
  if(!check.ok||!String(check.headers.get('content-type')||'').includes('image'))throw Error('صور القالب الأصلي ليست متاحة بعد؛ لا يمكن إصدار تقرير غير مطابق.');
  const r=state.report,rows=[];
  for(const f of state.findings){const reply=await request('/photos/'+photoRef(r.id,f.id));rows.push({f,photos:reply.images||[]})}
  const deck=window.VDGeneratorOriginalDeck.build(r,rows,city);
  win.document.open();
  win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير أعمال المؤقتات والمولدات</title><style>'+deck.css+'</style></head><body>'+deck.html+'</body></html>');
  win.document.close();
  await Promise.all([...win.document.images].map(i=>i.decode?.().catch(()=>{})||Promise.resolve()));
  const result=await window.VDReportArchive.archiveGeneratedPdf({win,selector:'.tg-slide',wide:true,reportName:'تقرير أعمال المؤقتات والمولدات',filename:'VD_Temporary_Generators_'+String(r.startDate||'Week')+'_'+city+'.pdf'});
  notice(result?.ok?'تم إصدار PDF من قالب التقرير الأصلي وتسجيل الأرشفة.':'التقرير مطابق في الشكل، لكن الأرشفة لم تؤكد: '+String(result?.error||'يرجى مراجعة سجل التقارير'),!result?.ok);
  return result;
 }catch(e){notice('تعذر إصدار PDF المطابق: '+e.message,true);try{win.close()}catch(_){};throw e}
 finally{buttonBusy('tgrExport',false)}
}

async function exportPptx(){
 if(!state.report)return;
 if($('tgrMetaSave').classList.contains('tgr-unsaved')||state.dirty){notice('احفظ التغييرات قبل إصدار PowerPoint.',true);return}
 buttonBusy('tgrExportPptx',true,'جارٍ تجهيز PowerPoint...');
 try{
  const response=await fetch(API+'/reports/'+encodeURIComponent(state.report.id)+'/pptx',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'تعذر توليد ملف PowerPoint')}
  const blob=await response.blob(),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='VD_Temporary_Generators_'+String(state.report.startDate||'Weekly')+'.pptx';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);
  notice('تم تصدير ملف PowerPoint من الشرائح الأصلية.');
 }catch(e){notice('خطأ تصدير PowerPoint: '+e.message,true)}finally{buttonBusy('tgrExportPptx',false)}
}
async function assembleLatestGenerator(){
 if(!window.VDGeneratorOriginalDeck)throw Error('القالب الأصلي للمؤقتات غير محمل.');
 const api=async(url)=>{const res=await fetch(API+url,{credentials:'same-origin',cache:'no-store'});const j=await res.json().catch(()=>({}));if(!res.ok||!j.ok)throw Error(j.error||'تعذر قراءة تقرير المؤقتات');return j};
 const all=(await api('/reports')).reports||[];
 const ordered=[...all].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
 let r=null,findings=[];
 for(const x of ordered){
  const d=await api('/reports/'+encodeURIComponent(x.id));
  if((d.findings||[]).length){r=d.report;findings=d.findings;break}
 }
 if(!r)return null;
 const check=await fetch('/generator-template/shared_5.webp',{cache:'no-store'});
 if(!check.ok||!String(check.headers.get('content-type')||'').includes('image'))throw Error('قالب المؤقتات الأصلي غير متاح؛ لا نُدخل تقريرًا بتصميم بديل في PDC.');
 const rows=[];
 for(const f of findings){const d=await api('/photos/'+photoRef(r.id,f.id));rows.push({f,photos:d.images||[]})}
 return {...window.VDGeneratorOriginalDeck.build(r,rows,city),fitScript:''};
}
window.VDGeneratorReportCenter={assembleLatest:assembleLatestGenerator};
window.VDTemporaryGeneratorsCenter={
 prepare:async id=>{if(!document.getElementById(PAGE))mount();await load(id);if(!state.report||String(state.report.id)!==String(id))throw Error("تعذر تحميل التقرير المطلوب");},
 exportPDF:win=>printReport(win),
 exportPPTX:()=>exportPptx(),
 currentReport:()=>state.report?.id||""
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
