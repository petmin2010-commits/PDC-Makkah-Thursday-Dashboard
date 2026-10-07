(function(){
'use strict';

const GENERAL=[
 {key:'PROJECT_TITLE',label:'عنوان المشروع',field:'Text Value / Description',type:'text'},
 {key:'DETAILED_WORK_DESCRIPTION',label:'وصف الأعمال التفصيلي',field:'Text Value / Description',type:'textarea',wide:true},
 {key:'CONTRACTOR_REPORT_NAME',label:'اسم المقاول في التقرير',field:'Text Value / Description',type:'text'},
 {key:'ACTUAL_START_DATE',label:'تاريخ البدء الفعلي',field:'Start / Observation Date',type:'date'},
 {key:'EXPECTED_OPERATION_DATE',label:'تاريخ التشغيل المتوقع',field:'End / Expected Date',type:'date'},
 {key:'SEC_FOLLOWUP_ENGINEER',label:'مهندس متابعة شركة الكهرباء',field:'Responsible / Issuing Authority',type:'text'},
 {key:'CONTRACTUAL_DURATION_DAYS',label:'المدة التعاقدية بالأيام',field:'Numeric Value',type:'number'},
 {key:'CONSULTANT_NAME',label:'اسم الاستشاري',field:'Text Value / Description',type:'text'},
 {key:'REPORT_TYPE',label:'نوع التقرير',field:'Text Value / Description',type:'text'},
 {key:'REPORT_NO',label:'رقم التقرير',field:'Text Value / Description',type:'text'},
 {key:'REPORT_DATE',label:'تاريخ التقرير الافتراضي',field:'Start / Observation Date',type:'date'},
 {key:'PREPARED_BY',label:'إعداد التقرير / التوقيع',field:'Responsible / Issuing Authority',type:'text',signature:true}
];
const SECTION_LABELS={
 BOQ_ITEM:'بنود التنفيذ',
 MATERIAL:'المواد',
 PERMIT_DETAIL:'التصاريح',
 PLAN_POINT:'نقاط الخطة والإنجاز',
 MILESTONE:'المعالم الرئيسية',
 ISSUE_RISK:'العوائق والمخاطر',
 PERIOD_SUMMARY:'ملخص الفترة',
 MANAGEMENT_NOTE:'ملاحظات الإدارة'
};
const TAB_DEFS=[
 {id:'general',label:'البيانات الأساسية',icon:'◆',sections:[]},
 {id:'boq',label:'بنود التنفيذ',icon:'▦',sections:['BOQ_ITEM']},
 {id:'materials',label:'المواد',icon:'◫',sections:['MATERIAL']},
 {id:'permits',label:'التصاريح',icon:'▤',sections:['PERMIT_DETAIL']},
 {id:'plan',label:'الخطة والمعالم',icon:'◈',sections:['PLAN_POINT','MILESTONE']},
 {id:'risks',label:'المخاطر',icon:'!',sections:['ISSUE_RISK']},
 {id:'notes',label:'الملخص والملاحظات',icon:'≡',sections:['PERIOD_SUMMARY','MANAGEMENT_NOTE']}
];
const SECTION_FIELDS={
 BOQ_ITEM:[
  ['Field / Item / Permit No.','الكود / رقم البند','text'],['Text Value / Description','وصف البند','text'],
  ['Unit','الوحدة','text'],['Planned / Required Qty','الكمية المخططة','text'],['Executed / Issued Qty','المنفذ','text'],
  ['Period Qty','كمية الفترة','text'],['Weight / Planned Progress %','الوزن %','text'],['Status','الحالة','text']
 ],
 MATERIAL:[
  ['Field / Item / Permit No.','كود المادة','text'],['Text Value / Description','وصف المادة','text'],['Unit','الوحدة','text'],
  ['Planned / Required Qty','المطلوب','text'],['Executed / Issued Qty','المصروف / المتاح','text'],['Status','الحالة','text'],['Notes','ملاحظات','textarea']
 ],
 PERMIT_DETAIL:[
  ['Field / Item / Permit No.','رقم التصريح / المرحلة','text'],['Responsible / Issuing Authority','الجهة المصدرة','text'],
  ['Location / Neighborhood','الموقع / الحي','text'],['Status','الحالة','text'],['Start / Observation Date','تاريخ البداية','date'],
  ['End / Expected Date','تاريخ النهاية','date'],['Planned / Required Qty','الطول / الكمية','text'],['Executed / Issued Qty','المنفذ','text'],['Notes','ملاحظات','textarea']
 ],
 PLAN_POINT:[
  ['Start / Observation Date','التاريخ','date'],['Weight / Planned Progress %','المخطط %','text'],['Numeric Value','الفعلي %','text'],['Notes','ملاحظات','textarea']
 ],
 MILESTONE:[
  ['Field / Item / Permit No.','المعلم / الكود','text'],['Text Value / Description','الوصف','text'],['Start / Observation Date','تاريخ البداية','date'],
  ['End / Expected Date','التاريخ المتوقع','date'],['Responsible / Issuing Authority','المسؤول','text'],['Status','الحالة','text'],['Notes','ملاحظات','textarea']
 ],
 ISSUE_RISK:[
  ['Field / Item / Permit No.','الكود','text'],['Text Value / Description','التحدي / العائق','textarea'],['Category / Impact','التصنيف / الأثر','text'],
  ['Action / Support Required','الإجراء / الدعم المطلوب','textarea'],['Responsible / Issuing Authority','الجهة المسؤولة','text'],
  ['Start / Observation Date','تاريخ الرصد','date'],['Status','الحالة','text'],['Notes','ملاحظات','textarea']
 ],
 PERIOD_SUMMARY:[
  ['Text Value / Description','ملخص الأعمال المنفذة خلال الفترة','textarea'],['Start / Observation Date','من تاريخ','date'],['End / Expected Date','إلى تاريخ','date'],['Notes','ملاحظات','textarea']
 ],
 MANAGEMENT_NOTE:[
  ['Text Value / Description','الملاحظة الإدارية','textarea'],['Action / Support Required','الإجراء / الدعم المطلوب','textarea'],
  ['Responsible / Issuing Authority','المسؤول','text'],['Notes','ملاحظات','textarea']
 ]
};
const ALL_FIELDS=[
 'Section','Sequence','Field / Item / Permit No.','Text Value / Description','Numeric Value','Unit','Planned / Required Qty',
 'Executed / Issued Qty','Period Qty','Weight / Planned Progress %','Status','Start / Observation Date','End / Expected Date',
 'Responsible / Issuing Authority','Location / Neighborhood','Category / Impact','Action / Support Required','URL / Attachment','Notes'
];
const PAGE_SIZE=4;
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v==null?'':v).trim();
let rows=[],details=[],passthrough=[],generalDraft={},currentWo='',busy=false,installed=false,activeTab='general',pageByTab={};

function valueInputDate(v){
 const s=clean(v);let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
 if(m)return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
 m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
 return m?m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0'):'';
}
function woValue(){return clean(document.getElementById('preInput')?.value).replace(/\D/g,'').slice(0,10)}
function rowKey(r){return clean(r?.['Field / Item / Permit No.']).toUpperCase()}
function isKnownGeneral(r){return r?.Section==='PROJECT_EXTRA'&&GENERAL.some(g=>!g.signature&&g.key===rowKey(r))}
function isPrepared(r){return r?.Section==='SIGNATURE'&&rowKey(r)==='PREPARED_BY'}
function generalRow(key){return rows.find(r=>r.Section==='PROJECT_EXTRA'&&rowKey(r)===key)||null}
function preparedRow(){return rows.find(isPrepared)||null}
function tabDef(id=activeTab){return TAB_DEFS.find(t=>t.id===id)||TAB_DEFS[0]}
function tabForSection(section){return TAB_DEFS.find(t=>t.sections.includes(section))?.id||'general'}
function tabEntries(id=activeTab){
 const def=tabDef(id);
 return details.map((r,i)=>({r,i})).filter(x=>def.sections.includes(x.r.Section));
}
function countForTab(t){return t.id==='general'?GENERAL.filter(g=>clean(generalDraft[g.key])).length:tabEntries(t.id).length}

function modalMarkup(){
 return '<div id="preDefaultsModal" class="prd-modal" hidden>'+
  '<div class="prd-dialog" role="dialog" aria-modal="true" aria-labelledby="prdTitle">'+
   '<header class="prd-head"><div><span>PROJECT DEFAULT DATA</span><h3 id="prdTitle">بيانات التقرير الافتراضية</h3><p>تُحفظ في Projects Report Engine Data وتُستدعى تلقائيًا لاحقًا لنفس أمر العمل.</p></div><button id="prdClose" type="button">×</button></header>'+
   '<div class="prd-wo-line"><div><small>أمر العمل</small><b id="prdWo">—</b></div><div id="prdStatus">جاهز</div></div>'+
   '<nav id="prdTabs" class="prd-tabs" aria-label="أقسام البيانات الافتراضية"></nav>'+
   '<div class="prd-scroll"><div id="prdTabContent"></div></div>'+
   '<footer class="prd-foot"><button id="prdDeleteAll" class="prd-danger" type="button">مسح البيانات الافتراضية</button><div><button id="prdCancel" type="button">إلغاء</button><button id="prdSave" class="prd-primary" type="button">حفظ كبيانات افتراضية</button></div></footer>'+
  '</div></div>';
}

function generalValue(g){
 if(Object.prototype.hasOwnProperty.call(generalDraft,g.key))return generalDraft[g.key];
 const r=g.signature?preparedRow():generalRow(g.key);
 return r?clean(r[g.field]):'';
}
function generalField(g){
 const val=generalValue(g),placeholder=currentSuggestion(g.key);
 if(g.type==='textarea')return '<label class="prd-field prd-wide"><span>'+esc(g.label)+'</span><textarea data-general="'+g.key+'" placeholder="'+esc(placeholder)+'">'+esc(val)+'</textarea></label>';
 return '<label class="prd-field'+(g.wide?' prd-wide':'')+'"><span>'+esc(g.label)+'</span><input data-general="'+g.key+'" type="'+g.type+'" value="'+esc(g.type==='date'?valueInputDate(val):val)+'" placeholder="'+esc(placeholder)+'"></label>';
}
function currentSuggestion(key){
 const r=window.__VDProjectsReportEngineReport||null;
 if(!r)return '';
 const map={
  PROJECT_TITLE:r.projectTitle,DETAILED_WORK_DESCRIPTION:r.desc,CONTRACTOR_REPORT_NAME:r.contractor,
  ACTUAL_START_DATE:r.start,EXPECTED_OPERATION_DATE:r.expected,SEC_FOLLOWUP_ENGINEER:r.secFollowup,
  CONTRACTUAL_DURATION_DAYS:r.contractDuration,CONSULTANT_NAME:r.consultant,REPORT_TYPE:r.reportType,
  REPORT_NO:r.reportNo,REPORT_DATE:r.rdate,PREPARED_BY:r.preparedBy
 };
 return clean(map[key]);
}

function recordCard(r,i,displayNo){
 const sec=clean(r.Section)||'BOQ_ITEM',fields=SECTION_FIELDS[sec]||SECTION_FIELDS.BOQ_ITEM;
 const inputs=fields.map(([k,label,type])=>{
  const v=clean(r[k]);
  if(type==='textarea')return '<label class="prd-field prd-wide"><span>'+esc(label)+'</span><textarea data-ridx="'+i+'" data-rfield="'+esc(k)+'">'+esc(v)+'</textarea></label>';
  return '<label class="prd-field"><span>'+esc(label)+'</span><input type="'+type+'" data-ridx="'+i+'" data-rfield="'+esc(k)+'" value="'+esc(type==='date'?valueInputDate(v):v)+'"></label>';
 }).join('');
 return '<article class="prd-record" data-record="'+i+'"><div class="prd-record-head"><div><b>'+esc(SECTION_LABELS[sec]||sec)+'</b><small>سجل '+displayNo+'</small></div><div><select data-section="'+i+'">'+Object.entries(SECTION_LABELS).map(([k,v])=>'<option value="'+k+'"'+(k===sec?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select><button type="button" data-remove="'+i+'">حذف</button></div></div><div class="prd-record-grid">'+inputs+'</div></article>';
}
function addControls(def){
 if(!def.sections.length)return '';
 const opts=def.sections.map(k=>'<option value="'+k+'">'+esc(SECTION_LABELS[k])+'</option>').join('');
 return '<div class="prd-section-actions">'+(def.sections.length>1?'<select id="prdNewSection">'+opts+'</select>':'<input id="prdNewSection" type="hidden" value="'+def.sections[0]+'">')+'<button id="prdAddRow" type="button">+ إضافة سجل</button></div>';
}
function paginationMarkup(total,page){
 if(total<=PAGE_SIZE)return '';
 const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
 return '<div class="prd-pagination"><button type="button" data-page-dir="-1"'+(page<=1?' disabled':'')+'>‹ السابق</button><span>صفحة <b>'+page+'</b> من <b>'+pages+'</b> • '+total+' سجل</span><button type="button" data-page-dir="1"'+(page>=pages?' disabled':'')+'>التالي ›</button></div>';
}
function renderTabs(){
 const nav=document.getElementById('prdTabs');if(!nav)return;
 nav.innerHTML=TAB_DEFS.map(t=>'<button type="button" class="'+(t.id===activeTab?'active':'')+'" data-tab="'+t.id+'"><i>'+t.icon+'</i><span>'+esc(t.label)+'</span><b>'+countForTab(t)+'</b></button>').join('');
}
function renderContent(){
 const box=document.getElementById('prdTabContent');if(!box)return;
 const def=tabDef();
 if(def.id==='general'){
  box.innerHTML='<section class="prd-section prd-section-current"><div class="prd-section-head"><div><b>البيانات الأساسية</b><span>قيم ثابتة وافتراضية خاصة بالتقرير</span></div></div><div id="prdGeneral" class="prd-general-grid">'+GENERAL.map(generalField).join('')+'</div></section>';
  return;
 }
 const entries=tabEntries(),pages=Math.max(1,Math.ceil(entries.length/PAGE_SIZE));
 let page=Math.min(Math.max(1,pageByTab[activeTab]||1),pages);pageByTab[activeTab]=page;
 const start=(page-1)*PAGE_SIZE,view=entries.slice(start,start+PAGE_SIZE);
 const records=view.length?view.map((x,n)=>recordCard(x.r,x.i,start+n+1)).join(''):'<div class="prd-empty">لا توجد سجلات محفوظة في هذا القسم. اضغط «إضافة سجل» للبدء.</div>';
 box.innerHTML='<section class="prd-section prd-section-current"><div class="prd-section-head"><div><b>'+esc(def.label)+'</b><span>'+entries.length+' سجل محفوظ في هذا القسم</span></div>'+addControls(def)+'</div><div id="prdRecords">'+records+'</div>'+paginationMarkup(entries.length,page)+'</section>';
}
function render(){
 document.getElementById('prdWo').textContent=currentWo||'—';
 renderTabs();renderContent();
}
function setStatus(msg,kind=''){const el=document.getElementById('prdStatus');if(el){el.textContent=msg;el.className=kind?'prd-status '+kind:'prd-status'}}
function setBusy(on,msg){busy=on;document.getElementById('prdSave')?.toggleAttribute('disabled',on);document.getElementById('prdDeleteAll')?.toggleAttribute('disabled',on);if(msg)setStatus(msg,on?'working':'')}

function loadGeneralDraft(){
 generalDraft={};
 for(const g of GENERAL){
  const r=g.signature?preparedRow():generalRow(g.key);
  generalDraft[g.key]=r?clean(r[g.field]):'';
 }
}
async function loadDefaults(wo){
 setBusy(true,'جاري تحميل البيانات الافتراضية...');
 try{
  const res=await fetch('/api/projects-report-engine/defaults/'+encodeURIComponent(wo),{cache:'no-store'});
  const j=await res.json().catch(()=>({}));
  if(!res.ok||j.ok===false)throw new Error(j.error||'تعذر تحميل البيانات الافتراضية');
  rows=Array.isArray(j.rows)?j.rows:[];
  details=rows.filter(r=>SECTION_LABELS[r.Section]).map(r=>({...r}));
  passthrough=rows.filter(r=>!SECTION_LABELS[r.Section]&&!isKnownGeneral(r)&&!isPrepared(r)).map(r=>({...r}));
  loadGeneralDraft();pageByTab={};render();setStatus(rows.length?'تم تحميل '+rows.length+' سجل محفوظ':'لا توجد بيانات افتراضية محفوظة بعد','ok');
 }catch(e){rows=[];details=[];passthrough=[];generalDraft={};render();setStatus(e.message||String(e),'error')}
 finally{setBusy(false)}
}
function openModal(){
 const wo=woValue();if(!wo){alert('أدخل رقم أمر العمل أولاً.');document.getElementById('preInput')?.focus();return}
 currentWo=wo;activeTab='general';pageByTab={};const m=document.getElementById('preDefaultsModal');if(!m)return;m.hidden=false;loadDefaults(wo);
}
function closeModal(){const m=document.getElementById('preDefaultsModal');if(m&&!busy)m.hidden=true}

function buildGeneralRows(){
 const out=[];
 for(const g of GENERAL){
  const v=clean(generalDraft[g.key]);if(!v)continue;
  if(g.signature){
   const r={...(preparedRow()||{}),Section:'SIGNATURE','Field / Item / Permit No.':'PREPARED_BY'};
   ['Text Value / Description','Numeric Value','Start / Observation Date','End / Expected Date'].forEach(k=>r[k]='');
   r['Responsible / Issuing Authority']=v;out.push(r);continue;
  }
  const r={...(generalRow(g.key)||{}),Section:'PROJECT_EXTRA','Field / Item / Permit No.':g.key};
  ['Text Value / Description','Numeric Value','Responsible / Issuing Authority','Start / Observation Date','End / Expected Date'].forEach(k=>r[k]='');
  r[g.field]=v;out.push(r);
 }
 return out;
}
function compactDetail(r){
 const out={Section:r.Section};
 for(const k of ALL_FIELDS){
  if(k==='Section')continue;
  const v=r[k];
  if(v!==undefined&&v!==null&&clean(v)!=='')out[k]=v;
 }
 return out;
}
async function save(){
 if(busy)return;
 const payload=[...buildGeneralRows(),...passthrough.map(compactDetail),...details.map(compactDetail).filter(r=>r.Section)];
 setBusy(true,'جاري حفظ البيانات الافتراضية...');
 try{
  const res=await fetch('/api/projects-report-engine/defaults/'+encodeURIComponent(currentWo),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:payload})});
  const j=await res.json().catch(()=>({}));
  if(!res.ok||j.ok===false)throw new Error(j.error||'تعذر حفظ البيانات الافتراضية');
  rows=Array.isArray(j.rows)?j.rows:payload;loadGeneralDraft();setStatus('تم الحفظ بنجاح — ستظهر هذه القيم تلقائيًا لاحقًا','ok');
  setTimeout(()=>{document.getElementById('preSearchBtn')?.click()},150);
 }catch(e){setStatus(e.message||String(e),'error');alert(e.message||String(e))}
 finally{setBusy(false);render()}
}
async function deleteAll(){
 if(busy||!confirm('هل تريد مسح جميع البيانات الافتراضية المحفوظة لأمر العمل '+currentWo+'؟'))return;
 setBusy(true,'جاري مسح البيانات الافتراضية...');
 try{
  const res=await fetch('/api/projects-report-engine/defaults/'+encodeURIComponent(currentWo),{method:'DELETE'});
  const j=await res.json().catch(()=>({}));
  if(!res.ok||j.ok===false)throw new Error(j.error||'تعذر مسح البيانات');
  rows=[];details=[];passthrough=[];generalDraft={};pageByTab={};render();setStatus('تم مسح البيانات الافتراضية','ok');setTimeout(()=>document.getElementById('preSearchBtn')?.click(),150);
 }catch(e){setStatus(e.message||String(e),'error')}
 finally{setBusy(false)}
}
function addRow(){
 const def=tabDef(),sec=document.getElementById('prdNewSection')?.value||def.sections[0]||'BOQ_ITEM';
 details.push({Section:sec,Sequence:details.filter(x=>x.Section===sec).length+1});
 activeTab=tabForSection(sec);
 const total=tabEntries(activeTab).length;pageByTab[activeTab]=Math.max(1,Math.ceil(total/PAGE_SIZE));
 render();
 setTimeout(()=>document.querySelector('#prdRecords .prd-record:last-of-type')?.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
}
function handleInput(e){
 const g=e.target.dataset.general;if(g){generalDraft[g]=e.target.value;return}
 const idx=Number(e.target.dataset.ridx),field=e.target.dataset.rfield;
 if(Number.isInteger(idx)&&details[idx]&&field)details[idx][field]=e.target.value;
}
function handleChange(e){
 const idx=Number(e.target.dataset.section);
 if(Number.isInteger(idx)&&details[idx]){
  const oldTab=activeTab,newSec=e.target.value;
  details[idx]={Section:newSec,Sequence:details[idx].Sequence};
  activeTab=tabForSection(newSec);pageByTab[oldTab]=1;pageByTab[activeTab]=Math.max(1,Math.ceil(tabEntries(activeTab).length/PAGE_SIZE));render();
 }
}
function handleContentClick(e){
 const remove=e.target.closest('[data-remove]');
 if(remove){
  const idx=Number(remove.dataset.remove);if(Number.isInteger(idx)){details.splice(idx,1);render()}return;
 }
 const dir=e.target.closest('[data-page-dir]');
 if(dir){
  const step=Number(dir.dataset.pageDir)||0,total=tabEntries().length,pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  pageByTab[activeTab]=Math.min(pages,Math.max(1,(pageByTab[activeTab]||1)+step));render();return;
 }
 if(e.target.closest('#prdAddRow'))addRow();
}
function switchTab(id){
 if(!TAB_DEFS.some(t=>t.id===id)||id===activeTab)return;
 activeTab=id;render();
}
function install(){
 if(installed)return;
 const page=document.getElementById('projectsReportEnginePage'),search=document.getElementById('preSearchBtn');
 if(!page||!search)return;
 installed=true;
 const btn=document.createElement('button');btn.id='preDefaultsBtn';btn.type='button';btn.className='pre-search-secondary prd-open-btn';btn.textContent='بيانات التقرير الافتراضية';
 search.insertAdjacentElement('afterend',btn);
 page.insertAdjacentHTML('beforeend',modalMarkup());
 btn.onclick=openModal;
 document.getElementById('prdClose').onclick=closeModal;
 document.getElementById('prdCancel').onclick=closeModal;
 document.getElementById('prdSave').onclick=save;
 document.getElementById('prdDeleteAll').onclick=deleteAll;
 document.getElementById('prdTabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)switchTab(b.dataset.tab)});
 document.getElementById('prdTabContent').addEventListener('input',handleInput);
 document.getElementById('prdTabContent').addEventListener('change',handleChange);
 document.getElementById('prdTabContent').addEventListener('click',handleContentClick);
 document.getElementById('preDefaultsModal').addEventListener('click',e=>{if(e.target.id==='preDefaultsModal')closeModal()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
}
const timer=setInterval(()=>{install();if(installed)clearInterval(timer)},300);
setTimeout(()=>clearInterval(timer),15000);
})();