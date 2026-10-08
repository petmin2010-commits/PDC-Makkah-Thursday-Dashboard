(function(){
'use strict';

const UNIT_OPTIONS=['M','M2','EA','KIT','LS','KM','NO'];
const BOQ_STATUS_OPTIONS=['متقدم','وفق المخطط','متأخر','جاري','لم يبدأ','مكتمل'];
const MATERIAL_STATUS_OPTIONS=['لم يتم الصرف','تم الصرف جزئي','تم الصرف بالكامل'];
const PERMIT_STATUS_OPTIONS=['تم الإصدار','قيد التنسيق','قيد التنسيق والاعتماد','مرفوض','منتهي','ملغي','بانتظار السداد','مسودة','انتهت فترة السداد','لا يتطلب','تصريح مدن فقط'];
const RISK_IMPACT_OPTIONS=['عالي','متوسط','منخفض'];
const RISK_STATUS_OPTIONS=['قيد المتابعة','تم الحل','مغلق'];
const REPORT_TYPE_OPTIONS=['يومي','أسبوعي','شهري'];
const WEIGHT_OPTIONS=Array.from({length:100},(_,i)=>(i+1)+'%');

const GENERAL=[
 {key:'REPORT_TYPE',label:'نوع التقرير',field:'Text Value / Description',type:'select',options:REPORT_TYPE_OPTIONS},
 {key:'REPORT_DATE',label:'تاريخ التقرير',field:'Start / Observation Date',type:'date',fixedToday:true},
 {key:'REPORT_NO',label:'رقم التقرير',field:'Text Value / Description',type:'number',auto:true,source:'عدد أيام التقارير منذ بداية العمل باستثناء الجمعة'},
 {key:'PROJECT_TITLE',label:'اسم المشروع',field:'Text Value / Description',type:'text',span:3},
 {key:'WORK_ORDER_LOCATION',label:'الموقع / المنطقة',field:'Location / Neighborhood',type:'text',auto:true,source:'ورقة أوامر العمل — عمود الموقع'},
 {key:'DETAILED_WORK_DESCRIPTION',label:'وصف العمل',field:'Text Value / Description',type:'textarea',wide:true},
 {key:'CONTRACTOR_REPORT_NAME',label:'المقاول',field:'Text Value / Description',type:'text',auto:true,source:'ورقة أوامر العمل — عمود المقاول',span:2},
 {key:'CONSULTANT_NAME',label:'الاستشاري',field:'Text Value / Description',type:'text',fixed:true,value:'شركة أبعاد الرؤية للاستشارات الهندسية'},
 {key:'SEC_FOLLOWUP_ENGINEER',label:'مهندس المتابعة (SEC)',field:'Responsible / Issuing Authority',type:'text'},
 {key:'ACTUAL_START_DATE',label:'تاريخ بدء التنفيذ',field:'Start / Observation Date',type:'date'},
 {key:'EXPECTED_OPERATION_DATE',label:'تاريخ التشغيل المتوقع',field:'End / Expected Date',type:'date'},
 {key:'CONTRACTUAL_DURATION_DAYS',label:'المدة التعاقدية (يوم)',field:'Numeric Value',type:'number',auto:true,source:'ورقة أوامر العمل — عمود المدة uds'},
 {key:'CONTRACT_DURATION_WITH_WEEKENDS',label:'المتبقي على التشغيل (يوم)',field:'Numeric Value',type:'number',auto:true,source:'المدة التعاقدية + أيام الجمعة الواقعة داخلها بداية من تاريخ بدء التنفيذ'},
 {key:'PREPARED_BY',label:'معد التقرير (الاستشاري / مهندس المتابعة)',field:'Responsible / Issuing Authority',type:'staff-select',signature:true},
 {key:'REVIEWED_BY',label:'مراجعة: رئيس القسم',field:'Responsible / Issuing Authority',type:'staff-select',signature:true},
 {key:'APPROVED_BY',label:'اعتماد: مدير الدائرة / الإدارة',field:'Responsible / Issuing Authority',type:'staff-select',signature:true}
];
const INDICATOR_INPUTS=[
 {key:'PLANNED_PROGRESS',label:'نسبة الإنجاز المخططة',field:'Numeric Value',type:'percent'},
 {key:'PERIOD_PROGRESS',label:'إنجاز الفترة',field:'Numeric Value',type:'percent'}
];
const INPUT_DEFS=[...GENERAL,...INDICATOR_INPUTS];

const SECTION_LABELS={
 BOQ_ITEM:'ثانياً: الكميات ونسب التنفيذ',
 MATERIAL:'ثالثاً: المواد (المطلوب / المنصرف / المتبقي)',
 PERMIT_DETAIL:'رابعاً: التصاريح والرخص',
 ISSUE_RISK:'خامساً: أبرز التحديات والعوائق وحالة كل تحدي',
 PERIOD_SUMMARY:'سادساً: ملخص المنفذ خلال الفترة',
 MANAGEMENT_NOTE:'سابعاً: ملاحظات وتنبيهات / الإجراءات المطلوبة والدعم المطلوب من الإدارة',
 PLAN_POINT:'بيانات تاريخية للمنحنى',
 MILESTONE:'بيانات معالم سابقة'
};
const TAB_DEFS=[
 {id:'general',label:'البيانات الأساسية',icon:'◆',sections:[]},
 {id:'indicators',label:'أولاً: مؤشرات أداء المشروع',icon:'◉',sections:[]},
 {id:'boq',label:'ثانياً: الكميات ونسب التنفيذ',icon:'▦',sections:['BOQ_ITEM']},
 {id:'materials',label:'ثالثاً: المواد',icon:'◫',sections:['MATERIAL']},
 {id:'permits',label:'رابعاً: التصاريح والرخص',icon:'▤',sections:['PERMIT_DETAIL']},
 {id:'risks',label:'خامساً: التحديات والعوائق',icon:'!',sections:['ISSUE_RISK']},
 {id:'summary',label:'سادساً: ملخص المنفذ خلال الفترة',icon:'≡',sections:['PERIOD_SUMMARY']},
 {id:'management',label:'سابعاً: الملاحظات والدعم المطلوب',icon:'☷',sections:['MANAGEMENT_NOTE']},
 {id:'charts',label:'ثامناً: الرسوم البيانية',icon:'▥',sections:[]}
];
const SECTION_FIELDS={
 BOQ_ITEM:[
  ['Text Value / Description','البند','text'],['Unit','الوحدة','select',UNIT_OPTIONS],
  ['Planned / Required Qty','الكمية المخططة','text'],['Executed / Issued Qty','إجمالي المنفذ','text'],
  ['Period Qty','المنفذ خلال الفترة','text'],['Weight / Planned Progress %','الوزن %','select',WEIGHT_OPTIONS],['Status','الحالة','select',BOQ_STATUS_OPTIONS]
 ],
 MATERIAL:[
  ['Text Value / Description','المادة','text'],['Unit','الوحدة','select',UNIT_OPTIONS],
  ['Planned / Required Qty','الكمية المطلوبة','text'],['Executed / Issued Qty','المنصرف','text'],
  ['Status','حالة الصرف','select',MATERIAL_STATUS_OPTIONS],['Notes','ملاحظات','textarea']
 ],
 PERMIT_DETAIL:[
  ['Field / Item / Permit No.','رقم التصريح','text'],['Responsible / Issuing Authority','الجهة المصدرة','text'],
  ['Location / Neighborhood','الموقع / الحي','text'],['Status','حالة التصريح','select',PERMIT_STATUS_OPTIONS],
  ['Start / Observation Date','تاريخ البدء','date'],['End / Expected Date','تاريخ الانتهاء','date'],
  ['Planned / Required Qty','الطول (م)','text'],['Executed / Issued Qty','المنجز (م)','text']
 ],
 PLAN_POINT:[
  ['Start / Observation Date','التاريخ','date'],['Weight / Planned Progress %','المخطط %','text'],['Numeric Value','الفعلي %','text'],['Notes','ملاحظات','textarea']
 ],
 MILESTONE:[
  ['Field / Item / Permit No.','المعلم / الكود','text'],['Text Value / Description','الوصف','text'],['Start / Observation Date','تاريخ البداية','date'],
  ['End / Expected Date','التاريخ المتوقع','date'],['Responsible / Issuing Authority','المسؤول','text'],['Status','الحالة','text'],['Notes','ملاحظات','textarea']
 ],
 ISSUE_RISK:[
  ['Text Value / Description','التحدي / العائق','textarea'],['Category / Impact','التصنيف','text'],['Notes','درجة الأثر','select',RISK_IMPACT_OPTIONS],
  ['Action / Support Required','الإجراء المتخذ','textarea'],['Responsible / Issuing Authority','الجهة المسؤولة','text'],
  ['Start / Observation Date','تاريخ الرصد','date'],['Status','الحالة','select',RISK_STATUS_OPTIONS]
 ],
 PERIOD_SUMMARY:[
  ['Text Value / Description','ملخص المنفذ خلال الفترة','textarea']
 ],
 MANAGEMENT_NOTE:[
  ['Text Value / Description','ملاحظات وتنبيهات / الإجراءات المطلوبة والدعم المطلوب من الإدارة','textarea']
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
let rows=[],details=[],passthrough=[],generalDraft={},liveAuto={},staffNames=[],deletedRows=[],currentWo='',busy=false,installed=false,activeTab='general',pageByTab={};

function valueInputDate(v){
 const s=clean(v);let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
 if(m)return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
 m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
 return m?m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0'):'';
}
function dateDisplayDMY(v){
 const iso=valueInputDate(v);if(!iso)return clean(v);
 const p=iso.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:clean(v);
}
function normalizeDateDisplay(v){
 const s=clean(v).replace(/[.\-]/g,'/');
 let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(!m){
  const d=s.replace(/\D/g,'');
  if(d.length===8)m=[d,d.slice(0,2),d.slice(2,4),d.slice(4)];
 }
 if(!m)return s;
 const dd=String(m[1]).padStart(2,'0'),mm=String(m[2]).padStart(2,'0'),yyyy=String(m[3]);
 const dt=new Date(Number(yyyy),Number(mm)-1,Number(dd),12,0,0);
 if(dt.getFullYear()!==Number(yyyy)||dt.getMonth()!==Number(mm)-1||dt.getDate()!==Number(dd))return s;
 return dd+'/'+mm+'/'+yyyy;
}
function ksaTodayIso(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const p={};parts.forEach(x=>{if(x.type!=='literal')p[x.type]=x.value});
 return (p.year||'')+'-'+(p.month||'')+'-'+(p.day||'');
}
function numericDays(v){
 const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
 const n=m?Number(m[0]):NaN;
 return Number.isFinite(n)?Math.floor(n):null;
}
function contractDurationWithWeekends(startValue,durationValue){
 const iso=valueInputDate(startValue),target=numericDays(durationValue);
 if(!iso||target==null||target<=0)return '';
 const d=new Date(iso+'T12:00:00');
 if(Number.isNaN(d.getTime()))return '';
 let fridayDays=0;
 for(let i=0;i<target;i++){
  if(d.getDay()===5)fridayDays++;
  d.setDate(d.getDate()+1);
 }
 return String(target+fridayDays);
}
function calculatedReportNumber(){
 const liveStart=document.querySelector('[data-general="ACTUAL_START_DATE"]')?.value;
 const start=valueInputDate(clean(liveStart)||clean(generalDraft.ACTUAL_START_DATE)||currentSuggestion('ACTUAL_START_DATE'));
 const end=ksaTodayIso();
 if(!start||start>end)return '';
 const d=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00');
 if(!Number.isFinite(d.getTime())||!Number.isFinite(last.getTime()))return '';
 let count=0;
 while(d<=last){if(d.getDay()!==5)count++;d.setDate(d.getDate()+1)}
 return String(count);
}
function calculatedContractDuration(){
 const liveStart=document.querySelector('[data-general="ACTUAL_START_DATE"]')?.value;
 const start=clean(liveStart)||clean(generalDraft.ACTUAL_START_DATE)||currentSuggestion('ACTUAL_START_DATE');
 const duration=clean(liveAuto.CONTRACTUAL_DURATION_DAYS)||currentSuggestion('CONTRACTUAL_DURATION_DAYS');
 return contractDurationWithWeekends(start,duration);
}
function refreshCalculatedGeneral(){
 const update=()=>{const el=document.querySelector('[data-auto-general="CONTRACT_DURATION_WITH_WEEKENDS"]');if(el)el.value=calculatedContractDuration();const pi=document.querySelector('[data-indicator="PLANNED_PROGRESS"]');if(pi)pi.value=percentInputValue(calculatedPlannedProgress());refreshIndicatorOutputs();const no=document.querySelector('[data-auto-general="REPORT_NO"]');if(no)no.value=calculatedReportNumber()};
 update();setTimeout(update,0);
}
function woValue(){return clean(document.getElementById('preInput')?.value).replace(/\D/g,'').slice(0,10)}
function rowKey(r){return clean(r?.['Field / Item / Permit No.']).toUpperCase()}
function isKnownGeneral(r){return r?.Section==='PROJECT_EXTRA'&&INPUT_DEFS.some(g=>!g.signature&&g.key===rowKey(r))}
function isSignature(r){return r?.Section==='SIGNATURE'&&GENERAL.some(g=>g.signature&&g.key===rowKey(r))}
function generalRow(key){return rows.find(r=>r.Section==='PROJECT_EXTRA'&&rowKey(r)===key)||null}
function signatureRow(key){return rows.find(r=>r.Section==='SIGNATURE'&&rowKey(r)===key)||null}
function tabDef(id=activeTab){return TAB_DEFS.find(t=>t.id===id)||TAB_DEFS[0]}
function tabForSection(section){return TAB_DEFS.find(t=>t.sections.includes(section))?.id||'general'}
function tabEntries(id=activeTab){
 const def=tabDef(id);
 return details.map((r,i)=>({r,i})).filter(x=>def.sections.includes(x.r.Section));
}
function countForTab(t){
 if(t.id==='general')return GENERAL.filter(g=>clean(generalValue(g))).length;
 if(t.id==='indicators')return 6;
 if(t.id==='charts')return 2;
 return tabEntries(t.id).length;
}

function modalMarkup(){
 return '<div id="preDefaultsModal" class="prd-modal" hidden>'+
  '<div class="prd-dialog" role="dialog" aria-modal="true" aria-labelledby="prdTitle">'+
   '<header class="prd-head"><div><span>PROJECT DEFAULT DATA</span><h3 id="prdTitle">بيانات التقرير الافتراضية</h3><p>تُحفظ في Projects Report Engine Data وتُستدعى تلقائيًا لاحقًا لنفس أمر العمل.</p></div><button id="prdClose" type="button">×</button></header>'+
   '<div class="prd-wo-line"><div><small>أمر العمل</small><b id="prdWo">—</b></div><div id="prdStatus">جاهز</div></div>'+
   '<div class="prd-body"><nav id="prdTabs" class="prd-tabs" aria-label="أقسام البيانات الافتراضية"></nav>'+
   '<div class="prd-scroll"><div id="prdTabContent"></div></div></div>'+
   '<footer class="prd-foot"><button id="prdDeleteAll" class="prd-danger" type="button">مسح البيانات الافتراضية</button><div><button id="prdCancel" type="button">إلغاء</button><button id="prdSave" class="prd-primary" type="button">حفظ كبيانات افتراضية</button></div></footer>'+
  '</div></div>';
}

function workOrdersValue(data,label){
 const sources=data?.sources||[];
 const src=sources.find(s=>clean(s.sheet).includes('اوامر العمل'));if(!src)return '';
 for(const rec of src.records||[])for(const f of rec.fields||[])if(clean(f.label)===label&&clean(f.value))return clean(f.value);
 return '';
}
function contractorFromWorkOrdersData(data){return workOrdersValue(data,'المقاول')}
function durationFromWorkOrdersData(data){return workOrdersValue(data,'المدة uds')}
function locationFromWorkOrdersData(data){return workOrdersValue(data,'الموقع')}
function generalValue(g){
 if(g.fixedToday)return ksaTodayIso();
 if(g.fixed)return clean(g.value);
 if(g.auto)return clean(liveAuto[g.key]||currentSuggestion(g.key));
 if(Object.prototype.hasOwnProperty.call(generalDraft,g.key))return generalDraft[g.key];
 const r=g.signature?signatureRow(g.key):generalRow(g.key);
 return r?clean(r[g.field]):'';
}
function generalField(g){
 let val=generalValue(g),placeholder=currentSuggestion(g.key);
 if(g.key==='REPORT_NO'){
  const n=parseInt(val||placeholder||'1',10);
  val=Number.isFinite(n)&&n>=1&&n<=100?String(n):'1';
  placeholder=val;
 }
 const baseClass='prd-field'+(g.wide?' prd-wide':'')+(g.span?' prd-span-'+g.span:'');
 const autoClass=baseClass+' prd-field-auto';
 if(g.fixedToday)return '<label class="'+autoClass+'"><span>'+esc(g.label)+'</span><input type="text" data-date-dmy="1" value="'+esc(dateDisplayDMY(val))+'" readonly aria-readonly="true"><small>تاريخ اليوم تلقائيًا — توقيت السعودية • dd/mm/yyyy</small></label>';
 if(g.fixed)return '<label class="'+autoClass+'"><span>'+esc(g.label)+'</span><input type="text" value="'+esc(val)+'" readonly aria-readonly="true"><small>قيمة ثابتة افتراضية</small></label>';
 if(g.auto)return '<label class="'+autoClass+'"><span>'+esc(g.label)+'</span><input data-auto-general="'+esc(g.key)+'" type="text" value="'+esc(val)+'" readonly aria-readonly="true"><small>آلي من '+esc(g.source||'مصدر البيانات')+'</small></label>';
 if(g.type==='staff-select'){
  const selected=clean(val)||clean(placeholder);
  const base=staffNames.slice();
  if(selected&&!base.includes(selected))base.unshift(selected);
  const opts=['',...base].map(x=>'<option value="'+esc(x)+'"'+(x===selected?' selected':'')+'>'+esc(x||'— اختر من الكادر —')+'</option>').join('');
  return '<label class="'+baseClass+'"><span>'+esc(g.label)+'</span><select data-general="'+g.key+'">'+opts+'</select><small class="prd-source-hint">من الموارد البشرية</small></label>';
 }
 if(g.type==='select'){
  const selected=clean(val)||clean(placeholder)||clean(g.options?.[0]);
  const base=(g.options||[]).slice();
  if(selected&&!base.includes(selected))base.unshift(selected);
  const opts=base.map(x=>'<option value="'+esc(x)+'"'+(String(x)===String(selected)?' selected':'')+'>'+esc(x)+'</option>').join('');
  return '<label class="'+baseClass+'"><span>'+esc(g.label)+'</span><select data-general="'+g.key+'">'+opts+'</select></label>';
 }
 if(g.type==='textarea')return '<label class="'+baseClass+'"><span>'+esc(g.label)+'</span><textarea data-general="'+g.key+'" placeholder="'+esc(placeholder)+'">'+esc(val)+'</textarea></label>';
 if(g.type==='date')return '<label class="'+baseClass+'"><span>'+esc(g.label)+'</span><input data-general="'+g.key+'" data-date-dmy="1" type="text" inputmode="numeric" maxlength="10" value="'+esc(dateDisplayDMY(val))+'" placeholder="dd/mm/yyyy"></label>';
 return '<label class="'+baseClass+'"><span>'+esc(g.label)+'</span><input data-general="'+g.key+'" type="'+g.type+'" value="'+esc(val)+'" placeholder="'+esc(placeholder)+'"></label>';
}
function currentSuggestion(key){
 if(key==='REPORT_DATE')return ksaTodayIso();
 if(key==='CONTRACTOR_REPORT_NAME'){
  const fromData=contractorFromWorkOrdersData(window.__VDProjectsReportEngineData);
  if(fromData)return fromData;
 }
 if(key==='WORK_ORDER_LOCATION'){
  const fromData=locationFromWorkOrdersData(window.__VDProjectsReportEngineData);
  if(fromData)return fromData;
 }
 if(key==='CONTRACTUAL_DURATION_DAYS'){
  const fromData=durationFromWorkOrdersData(window.__VDProjectsReportEngineData);
  if(fromData)return fromData;
 }
 if(key==='REPORT_NO')return calculatedReportNumber();
  if(key==='CONTRACT_DURATION_WITH_WEEKENDS')return calculatedContractDuration();
 const r=window.__VDProjectsReportEngineReport||null;
 if(!r)return '';
 const map={
  PROJECT_TITLE:r.projectTitle,DETAILED_WORK_DESCRIPTION:r.desc,CONTRACTOR_REPORT_NAME:r.contractor,
  ACTUAL_START_DATE:r.start,EXPECTED_OPERATION_DATE:r.expected,SEC_FOLLOWUP_ENGINEER:r.secFollowup,
  CONTRACTUAL_DURATION_DAYS:r.contractDuration,CONSULTANT_NAME:r.consultant,REPORT_TYPE:r.reportType,
  REPORT_NO:r.reportNo,REPORT_DATE:r.rdate,PREPARED_BY:r.preparedBy,REVIEWED_BY:r.reviewedBy,APPROVED_BY:r.approvedBy,
  PLANNED_PROGRESS:r.planned,PERIOD_PROGRESS:r.periodProgress
 };
 return clean(map[key]);
}

const TABLE_COLUMNS={
 BOQ_ITEM:[
  ['Text Value / Description','البند','text'],
  ['Unit','الوحدة','select',UNIT_OPTIONS],
  ['Planned / Required Qty','الكمية المخططة','text'],
  ['Executed / Issued Qty','إجمالي المنفذ','text'],
  ['Period Qty','المنفذ خلال الفترة','text'],
  ['@remaining','المتبقي','calc'],
  ['@progress','نسبة الإنجاز','calc'],
  ['Weight / Planned Progress %','الوزن %','select',WEIGHT_OPTIONS],
  ['Status','الحالة','select',BOQ_STATUS_OPTIONS]
 ],
 MATERIAL:[
  ['Text Value / Description','المادة','text'],
  ['Unit','الوحدة','select',UNIT_OPTIONS],
  ['Planned / Required Qty','الكمية المطلوبة','text'],
  ['Executed / Issued Qty','المنصرف','text'],
  ['@remaining','المتبقي','calc'],
  ['@progress','نسبة الصرف','calc'],
  ['Status','حالة الصرف','select',MATERIAL_STATUS_OPTIONS],
  ['Notes','ملاحظات','text']
 ],
 PERMIT_DETAIL:[
  ['Field / Item / Permit No.','رقم التصريح / المرحلة','text'],
  ['Responsible / Issuing Authority','الجهة المصدرة','text'],
  ['Location / Neighborhood','الموقع / الحي','text'],
  ['Status','حالة التصريح','select',SECTION_FIELDS.PERMIT_DETAIL.find(x=>x[0]==='Status')?.[3]||[]],
  ['Start / Observation Date','تاريخ البدء','date'],
  ['End / Expected Date','تاريخ الانتهاء','date'],
  ['Planned / Required Qty','الطول (م)','text'],
  ['Executed / Issued Qty','المنجز (م)','text'],
  ['@progress','نسبة الإنجاز','calc']
 ],
 PLAN_POINT:[
  ['Start / Observation Date','التاريخ','date'],
  ['Weight / Planned Progress %','المخطط %','text'],
  ['Numeric Value','الفعلي %','text'],
  ['Notes','ملاحظات','text']
 ],
 MILESTONE:[
  ['Field / Item / Permit No.','المعلم / الكود','text'],
  ['Text Value / Description','الوصف','text'],
  ['Start / Observation Date','تاريخ البداية','date'],
  ['End / Expected Date','التاريخ المتوقع','date'],
  ['Responsible / Issuing Authority','المسؤول','text'],
  ['Status','الحالة','text'],
  ['Notes','ملاحظات','text']
 ],
 ISSUE_RISK:[
  ['Text Value / Description','التحدي / العائق','text'],
  ['Category / Impact','التصنيف','text'],
  ['Notes','درجة الأثر','select',RISK_IMPACT_OPTIONS],
  ['Action / Support Required','الإجراء المتخذ','text'],
  ['Responsible / Issuing Authority','الجهة المسؤولة','text'],
  ['Start / Observation Date','تاريخ الرصد','date'],
  ['@age','عمر العائق (يوم)','calc'],
  ['Status','الحالة','select',RISK_STATUS_OPTIONS]
 ],
 PERIOD_SUMMARY:[
  ['Text Value / Description','ملخص المنفذ خلال الفترة','textarea']
 ],
 MANAGEMENT_NOTE:[
  ['Text Value / Description','ملاحظات وتنبيهات / الإجراءات المطلوبة والدعم المطلوب من الإدارة','textarea']
 ]
};
function tableNumber(v){const s=String(v??'').replace(/,/g,'').replace('%','').trim();if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null}
function tableCalc(sec,r,key){
 const planned=tableNumber(r['Planned / Required Qty']),done=tableNumber(r['Executed / Issued Qty']);
 if(key==='@remaining')return planned==null?'—':Math.max(0,planned-(done||0)).toLocaleString('en-US',{maximumFractionDigits:2});
 if(key==='@progress')return planned&&done!=null?((done/planned)*100).toFixed(2)+'%':'—';
 if(key==='@age'){
  const status=clean(r.Status);if(status.includes('تم الحل')||status.includes('مغلق'))return 'مغلق';
  const iso=valueInputDate(r['Start / Observation Date']);if(!iso)return '—';
  const a=new Date(iso+'T12:00:00'),b=new Date(ksaTodayIso()+'T12:00:00');
  return Number.isNaN(a.getTime())?'—':Math.max(0,Math.floor((b-a)/86400000))+'';
 }
 return '—';
}
function tableEditor(r,i,col){
 const [key,label,type,options]=col,v=clean(r[key]);
 if(type==='calc')return '<td class="prd-calc" data-calc-ridx="'+i+'" data-calc-key="'+esc(key)+'">'+esc(tableCalc(r.Section,r,key))+'</td>';
 if(type==='select'){
  const base=Array.isArray(options)?options.slice():[];
  if(v&&!base.some(x=>clean(x)===v))base.unshift(v);
  const opts=['',...base].map(x=>'<option value="'+esc(x)+'"'+(clean(x)===v?' selected':'')+'>'+esc(x||'— اختر —')+'</option>').join('');
  return '<td><select aria-label="'+esc(label)+'" data-ridx="'+i+'" data-rfield="'+esc(key)+'">'+opts+'</select></td>';
 }
 if(type==='textarea')return '<td class="prd-cell-wide"><textarea rows="1" aria-label="'+esc(label)+'" data-ridx="'+i+'" data-rfield="'+esc(key)+'">'+esc(v)+'</textarea></td>';
 if(type==='date')return '<td><input aria-label="'+esc(label)+'" type="text" inputmode="numeric" maxlength="10" data-date-dmy="1" data-ridx="'+i+'" data-rfield="'+esc(key)+'" value="'+esc(dateDisplayDMY(v))+'" placeholder="dd/mm/yyyy"></td>';
 return '<td><input aria-label="'+esc(label)+'" type="'+type+'" data-ridx="'+i+'" data-rfield="'+esc(key)+'" value="'+esc(v)+'"></td>';
}
function sectionTable(sec){
 const cols=TABLE_COLUMNS[sec]||[];
 const entries=details.map((r,i)=>({r,i})).filter(x=>x.r.Section===sec);
 const head='<th class="prd-row-no">#</th>'+cols.map(c=>'<th>'+esc(c[1])+'</th>').join('')+'<th class="prd-action-col">إجراء</th>';
 const body=entries.length?entries.map((x,n)=>'<tr data-table-row="'+x.i+'"><td class="prd-row-no">'+(n+1)+'</td>'+cols.map(c=>tableEditor(x.r,x.i,c)).join('')+'<td class="prd-action-col"><button type="button" class="prd-row-delete" data-remove="'+x.i+'">حذف</button></td></tr>').join(''):'<tr><td class="prd-table-empty" colspan="'+(cols.length+2)+'">لا توجد بيانات بعد. اضغط «إضافة صف» للبدء.</td></tr>';
 return '<div class="prd-sheet-block"><div class="prd-sheet-title"><div><b>'+esc(SECTION_LABELS[sec]||sec)+'</b><span>'+entries.length+' صف — إدخال جدولي شبيه بـ Excel</span></div><button type="button" data-add-section="'+esc(sec)+'">+ إضافة صف</button></div><div class="prd-table-wrap"><table class="prd-entry-table"><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div></div>';
}
function refreshCalculatedRow(idx){
 const r=details[idx];if(!r)return;
 document.querySelectorAll('[data-calc-ridx="'+idx+'"]').forEach(el=>{el.textContent=tableCalc(r.Section,r,el.dataset.calcKey)});
}
function ratioValue(v){
 const s=clean(v);if(!s)return null;
 const n=Number(s.replace(/,/g,'').replace('%',''));if(!Number.isFinite(n))return null;
 return s.includes('%')||Math.abs(n)>1?n/100:n;
}
function percentInputValue(v){
 const n=ratioValue(v);if(n==null)return '';
 const x=(n*100).toFixed(2);return x.replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
}
function percentDisplay(v){
 const n=typeof v==='number'?v:ratioValue(v);return n==null?'—':(n*100).toLocaleString('en-US',{maximumFractionDigits:2})+'%';
}
function weightedActualRatio(){
 let weighted=0,totalWeight=0;
 for(const r of details.filter(x=>x.Section==='BOQ_ITEM')){
  const planned=tableNumber(r['Planned / Required Qty']),done=tableNumber(r['Executed / Issued Qty']),weight=ratioValue(r['Weight / Planned Progress %']);
  if(planned&&planned>0&&done!=null&&weight!=null){weighted+=Math.min(Math.max(done/planned,0),1)*weight;totalWeight+=weight}
 }
 if(totalWeight>0)return weighted/totalWeight;
 const live=window.__VDProjectsReportEngineReport?.actual;
 return live==null?null:ratioValue(live);
}
function calculatedPlannedProgress(){
 const start=valueInputDate(clean(document.querySelector('[data-general="ACTUAL_START_DATE"]')?.value)||clean(generalDraft.ACTUAL_START_DATE)||currentSuggestion('ACTUAL_START_DATE'));
 const duration=numericDays(calculatedContractDuration());
 if(!start||!duration||duration<=0)return '';
 const day=new Date(start+'T12:00:00'),now=new Date(ksaTodayIso()+'T12:00:00');
 const elapsed=Math.floor((now-day)/86400000)+1;
 return (Math.min(100,Math.max(0,elapsed*100/duration))).toFixed(2)+'%';
}
function indicatorState(){
 const actual=weightedActualRatio();
 const planned=ratioValue(calculatedPlannedProgress());
 const variance=actual!=null&&planned!=null?actual-planned:null;
 const status=actual==null?'—':actual>=.999?'مكتمل':variance==null?'—':variance>=0?'وفق المخطط':variance>=-.1?'تحت المتابعة':'متأخر';
 const period=ratioValue(generalDraft.PERIOD_PROGRESS||currentSuggestion('PERIOD_PROGRESS'));
 const days=numericDays(calculatedContractDuration());
 const daily=actual!=null&&days?Math.max(0,(1-actual)/Math.max(days,1)):null;
 return {actual,planned,variance,status,period,daily};
}
function indicatorPanel(){
 const s=indicatorState();
 const plannedValue=percentInputValue(calculatedPlannedProgress());
 const periodValue=percentInputValue(generalDraft.PERIOD_PROGRESS||currentSuggestion('PERIOD_PROGRESS'));
 return '<section class="prd-section prd-section-current prd-indicators-section"><div class="prd-section-head"><div><b>أولاً: مؤشرات أداء المشروع</b><span>مطابقة لبنود الورقة الأولى — القيم المحسوبة آلية، والمخطط وإنجاز الفترة قابلان للإدخال</span></div></div>'+
 '<div class="prd-indicator-grid">'+
 '<label class="prd-indicator-card prd-readonly"><span>نسبة الإنجاز الكلية</span><strong data-indicator-output="actual">'+esc(percentDisplay(s.actual))+'</strong><small>محسوبة من الكميات × الأوزان</small></label>'+
 '<label class="prd-indicator-card"><span>نسبة الإنجاز المخططة</span><div class="prd-percent-input"><input data-indicator="PLANNED_PROGRESS" readonly aria-readonly="true" inputmode="decimal" value="'+esc(plannedValue)+'" placeholder="0.00"><b>%</b></div><small>إدخال مطابق للخلية B10</small></label>'+
 '<label class="prd-indicator-card prd-readonly"><span>الانحراف</span><strong data-indicator-output="variance">'+esc(s.variance==null?'—':((s.variance>=0?'+':'')+(s.variance*100).toFixed(2)+'%'))+'</strong><small>الفعلي − المخطط</small></label>'+
 '<label class="prd-indicator-card prd-readonly"><span>حالة المشروع</span><strong data-indicator-output="status">'+esc(s.status)+'</strong><small>مكتمل / وفق المخطط / تحت المتابعة / متأخر</small></label>'+
 '<label class="prd-indicator-card"><span>إنجاز الفترة</span><div class="prd-percent-input"><input data-indicator="PERIOD_PROGRESS" inputmode="decimal" value="'+esc(periodValue)+'" placeholder="0.00"><b>%</b></div><small>إدخال مطابق للخلية F10</small></label>'+
 '<label class="prd-indicator-card prd-readonly"><span>المعدل اليومي المطلوب</span><strong data-indicator-output="daily">'+esc(percentDisplay(s.daily))+'</strong><small>(100% − الإنجاز) ÷ المتبقي على التشغيل</small></label>'+
 '</div></section>';
}
function refreshIndicatorOutputs(){
 const s=indicatorState(),map={actual:percentDisplay(s.actual),variance:s.variance==null?'—':((s.variance>=0?'+':'')+(s.variance*100).toFixed(2)+'%'),status:s.status,daily:percentDisplay(s.daily)};
 Object.entries(map).forEach(([k,v])=>{const el=document.querySelector('[data-indicator-output="'+k+'"]');if(el)el.textContent=v});
}
function chartsPanel(){
 const s=indicatorState(),actual=Math.max(0,Math.min(100,(s.actual||0)*100)),planned=Math.max(0,Math.min(100,(s.planned||0)*100));
 const boq=details.filter(r=>r.Section==='BOQ_ITEM').slice(0,8);
 const rows=boq.length?boq.map(r=>{const p=tableNumber(r['Planned / Required Qty']),d=tableNumber(r['Executed / Issued Qty']);const pc=p&&d!=null?Math.max(0,Math.min(100,(d/p)*100)):0;return '<div class="prd-chart-row"><span>'+esc(r['Text Value / Description']||'بند')+'</span><div><i style="width:'+pc+'%"></i></div><b>'+pc.toFixed(1)+'%</b></div>'}).join(''):'<div class="prd-chart-empty">أضف بنود الكميات أولاً لعرض معاينة الرسم.</div>';
 return '<section class="prd-section prd-section-current prd-charts-section"><div class="prd-section-head"><div><b>ثامناً: الرسوم البيانية</b><span>تُنشأ تلقائيًا من نفس بيانات الورقة الأولى ولا تحتاج إدخالًا مستقلًا</span></div></div>'+
 '<div class="prd-chart-preview"><div class="prd-chart-card"><h4>الإنجاز الفعلي مقابل المخطط</h4><div class="prd-progress-preview"><span>الفعلي <b>'+actual.toFixed(2)+'%</b></span><div><i style="width:'+actual+'%"></i></div><span>المخطط <b>'+planned.toFixed(2)+'%</b></span><div class="planned"><i style="width:'+planned+'%"></i></div></div></div>'+
 '<div class="prd-chart-card"><h4>نسب تنفيذ بنود الكميات</h4>'+rows+'</div></div></section>';
}
function renderTabs(){
 const nav=document.getElementById('prdTabs');if(!nav)return;
 nav.innerHTML=TAB_DEFS.map(t=>'<button type="button" class="'+(t.id===activeTab?'active':'')+'" data-tab="'+t.id+'"><i>'+t.icon+'</i><span>'+esc(t.label)+'</span><b>'+countForTab(t)+'</b></button>').join('');
}
function renderContent(){
 const box=document.getElementById('prdTabContent');if(!box)return;
 const def=tabDef();
 if(def.id==='general'){
  box.innerHTML='<section class="prd-section prd-section-current"><div class="prd-section-head"><div><b>البيانات الأساسية</b><span>مطابقة لترتيب الجزء العلوي من الورقة الأولى</span></div></div><div id="prdGeneral" class="prd-general-grid prd-general-sheet">'+GENERAL.map(generalField).join('')+'</div></section>';
  return;
 }
 if(def.id==='indicators'){box.innerHTML=indicatorPanel();return}
 if(def.id==='charts'){box.innerHTML=chartsPanel();return}
 const total=tabEntries().length;
 box.innerHTML='<section class="prd-section prd-section-current prd-sheet-section"><div class="prd-section-head"><div><b>'+esc(def.label)+'</b><span>'+total+' سجل — أدخل البيانات مباشرة في صفوف وأعمدة مثل ملف Excel</span></div></div>'+def.sections.map(sectionTable).join('')+'</section>';
}
function render(){
 document.getElementById('prdWo').textContent=currentWo||'—';
 renderTabs();renderContent();
}
function setStatus(msg,kind=''){const el=document.getElementById('prdStatus');if(el){el.textContent=msg;el.className=kind?'prd-status '+kind:'prd-status'}}
function setBusy(on,msg){busy=on;document.getElementById('prdSave')?.toggleAttribute('disabled',on);document.getElementById('prdDeleteAll')?.toggleAttribute('disabled',on);if(msg)setStatus(msg,on?'working':'')}

function loadGeneralDraft(){
 generalDraft={};
 for(const g of INPUT_DEFS){
  if(g.auto||g.fixed||g.fixedToday){generalDraft[g.key]='';continue}
  const r=g.signature?signatureRow(g.key):generalRow(g.key);
  let v=r?clean(r[g.field]):'';
  if(g.key==='REPORT_NO'){
   const n=parseInt(v||'1',10);
   v=Number.isFinite(n)&&n>=1&&n<=100?String(n):'1';
  }
  generalDraft[g.key]=v;
 }
}
async function ensureStaffNames(){
 if(staffNames.length)return staffNames;
 try{
  const res=await fetch('/api/hr/staff',{cache:'no-store'});
  const j=await res.json().catch(()=>({}));
  if(res.ok&&j.ok!==false){
   staffNames=[...new Set((j.rows||[]).map(x=>clean(x.name)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  }
 }catch(e){console.warn('HR staff list load failed',e)}
 return staffNames;
}
function applyDetailDefaults(){
 const loc=clean(liveAuto.WORK_ORDER_LOCATION);
 if(!loc)return;
 details.forEach(r=>{if(r.Section==='PERMIT_DETAIL'&&!clean(r['Location / Neighborhood']))r['Location / Neighborhood']=loc});
}
async function ensureLiveAuto(wo){
 liveAuto={};
 const existing=window.__VDProjectsReportEngineData;
 if(existing&&String(existing.workOrder||'')===String(wo)){
  liveAuto.CONTRACTOR_REPORT_NAME=contractorFromWorkOrdersData(existing);
  liveAuto.CONTRACTUAL_DURATION_DAYS=durationFromWorkOrdersData(existing);
  liveAuto.WORK_ORDER_LOCATION=locationFromWorkOrdersData(existing);return;
 }
 try{
  const res=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'getWorkOrder360',args:[wo]})});
  const j=await res.json().catch(()=>({}));
  if(res.ok&&j.ok!==false&&j.result){
   window.__VDProjectsReportEngineData=j.result;
   liveAuto.CONTRACTOR_REPORT_NAME=contractorFromWorkOrdersData(j.result);
   liveAuto.CONTRACTUAL_DURATION_DAYS=durationFromWorkOrdersData(j.result);
   liveAuto.WORK_ORDER_LOCATION=locationFromWorkOrdersData(j.result);
  }
 }catch(e){console.warn('Live contractor lookup failed',e)}
}
async function loadDefaults(wo){
 setBusy(true,'جاري تحميل البيانات الافتراضية...');
 try{
  const res=await fetch('/api/projects-report-engine/defaults/'+encodeURIComponent(wo),{cache:'no-store'});
  const j=await res.json().catch(()=>({}));
  if(!res.ok||j.ok===false)throw new Error(j.error||'تعذر تحميل البيانات الافتراضية');
  rows=Array.isArray(j.rows)?j.rows:[];
  deletedRows=[];
  details=rows.filter(r=>SECTION_LABELS[r.Section]).map(r=>({...r}));
  passthrough=rows.filter(r=>!SECTION_LABELS[r.Section]&&!isKnownGeneral(r)&&!isSignature(r)).map(r=>({...r}));
  await Promise.all([ensureLiveAuto(wo),ensureStaffNames()]);
  applyDetailDefaults();
  loadGeneralDraft();pageByTab={};render();setStatus(rows.length?'تم تحميل '+rows.length+' سجل محفوظ':'لا توجد بيانات افتراضية محفوظة بعد','ok');
 }catch(e){rows=[];details=[];passthrough=[];generalDraft={};deletedRows=[];render();setStatus(e.message||String(e),'error')}
 finally{setBusy(false)}
}
function openModal(){
 const wo=woValue();if(!wo){alert('أدخل رقم أمر العمل أولاً.');document.getElementById('preInput')?.focus();return}
 currentWo=wo;activeTab='general';pageByTab={};const m=document.getElementById('preDefaultsModal');if(!m)return;m.hidden=false;loadDefaults(wo);
}
function closeModal(){const m=document.getElementById('preDefaultsModal');if(m&&!busy)m.hidden=true}

function buildGeneralRows(){
 const out=[];
 generalDraft.PLANNED_PROGRESS=calculatedPlannedProgress();
 for(const g of INPUT_DEFS){
  if(g.auto||g.fixed||g.fixedToday)continue;
  const v=clean(generalDraft[g.key]);if(!v)continue;
  if(g.signature){
   const r={...(signatureRow(g.key)||{}),Section:'SIGNATURE','Field / Item / Permit No.':g.key};
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
 if(Number.isFinite(Number(r?._row)))out._row=Number(r._row);
 for(const k of ALL_FIELDS){
  if(k==='Section')continue;
  const v=r[k];
  if(v!==undefined&&v!==null&&clean(v)!=='')out[k]=v;
 }
 return out;
}
function validateBoqWeights(){
 const boq=details.filter(r=>r.Section==='BOQ_ITEM');
 if(!boq.length)return 'لا يمكن استكمال التقرير دون إدخال بنود وأوزانها بنسبة إجمالية 100%.';
 let total=0;
 for(const row of boq){
  const raw=clean(row['Weight / Planned Progress %']).replace('%','').replace('٪','').trim();
  const weight=Number(raw);
  if(!raw||!Number.isFinite(weight)||weight<0||weight>100)return 'تحذير: يجب اختيار وزن صحيح من 0% إلى 100% لكل بند.';
  total+=weight;
 }
 if(Math.abs(total-100)>0.000001)return 'تحذير: إجمالي أوزان البنود '+total.toFixed(2)+'%، ويجب أن يساوي 100% بالضبط قبل الحفظ أو استكمال التقرير.';
 return '';
}
async function save(){
 if(busy)return;
 const warning=validateBoqWeights();if(warning){setStatus(warning,'error');alert(warning);activeTab='boq';renderTabs();renderContent();return;}
 const payload=[...buildGeneralRows(),...passthrough.map(compactDetail),...details.map(compactDetail).filter(r=>r.Section)];
 setBusy(true,'جاري حفظ البيانات الافتراضية...');
 try{
  const res=await fetch('/api/projects-report-engine/defaults/'+encodeURIComponent(currentWo),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:payload,deletedRows})});
  const j=await res.json().catch(()=>({}));
  if(!res.ok||j.ok===false)throw new Error(j.error||'تعذر حفظ البيانات الافتراضية');
  rows=Array.isArray(j.rows)?j.rows:payload;deletedRows=[];loadGeneralDraft();setStatus('تم الحفظ بنجاح — ستظهر هذه القيم تلقائيًا لاحقًا','ok');
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
  rows=[];details=[];passthrough=[];generalDraft={};deletedRows=[];pageByTab={};render();setStatus('تم مسح البيانات الافتراضية','ok');setTimeout(()=>document.getElementById('preSearchBtn')?.click(),150);
 }catch(e){setStatus(e.message||String(e),'error')}
 finally{setBusy(false)}
}
function addRow(forcedSection=''){
 const def=tabDef(),sec=clean(forcedSection)||def.sections[0]||'BOQ_ITEM';
 const row={Section:sec,Sequence:details.filter(x=>x.Section===sec).length+1};
 if(sec==='PERMIT_DETAIL'&&clean(liveAuto.WORK_ORDER_LOCATION))row['Location / Neighborhood']=clean(liveAuto.WORK_ORDER_LOCATION);
 details.push(row);
 activeTab=tabForSection(sec);
 render();
 setTimeout(()=>{
  const idx=details.length-1,rowEl=document.querySelector('[data-table-row="'+idx+'"]');
  rowEl?.scrollIntoView({behavior:'smooth',block:'center'});
  rowEl?.querySelector('input,select,textarea')?.focus();
 },50);
}
function handleInput(e){
 const indicator=e.target.dataset.indicator;if(indicator){generalDraft[indicator]=e.target.value;refreshIndicatorOutputs();return}
 const g=e.target.dataset.general;if(g){generalDraft[g]=e.target.value;if(g==='ACTUAL_START_DATE')refreshCalculatedGeneral();return}
 const idx=Number(e.target.dataset.ridx),field=e.target.dataset.rfield;
 if(Number.isInteger(idx)&&details[idx]&&field){details[idx][field]=e.target.value;refreshCalculatedRow(idx)}
}
function handleChange(e){
 const indicator=e.target.dataset.indicator;if(indicator){
  const n=ratioValue(e.target.value),value=n==null?'':((n*100).toFixed(2)+'%');
  generalDraft[indicator]=value;e.target.value=percentInputValue(value);refreshIndicatorOutputs();return
 }
 const g=e.target.dataset.general;if(g){
  const value=e.target.dataset.dateDmy==='1'?normalizeDateDisplay(e.target.value):e.target.value;
  if(e.target.dataset.dateDmy==='1')e.target.value=value;
  generalDraft[g]=value;if(g==='ACTUAL_START_DATE')refreshCalculatedGeneral();return
 }
 const ridx=Number(e.target.dataset.ridx),rfield=e.target.dataset.rfield;
 if(Number.isInteger(ridx)&&details[ridx]&&rfield){
  const value=e.target.dataset.dateDmy==='1'?normalizeDateDisplay(e.target.value):e.target.value;
  if(e.target.dataset.dateDmy==='1')e.target.value=value;
  details[ridx][rfield]=value;refreshCalculatedRow(ridx);return
 }
 const idx=Number(e.target.dataset.section);
 if(Number.isInteger(idx)&&details[idx]){
  const oldTab=activeTab,newSec=e.target.value,oldRow=details[idx];
  details[idx]={Section:newSec,Sequence:oldRow.Sequence,_row:oldRow._row};
  activeTab=tabForSection(newSec);pageByTab[oldTab]=1;pageByTab[activeTab]=Math.max(1,Math.ceil(tabEntries(activeTab).length/PAGE_SIZE));render();
 }
}
function handleContentClick(e){
 const remove=e.target.closest('[data-remove]');
 if(remove){
  const idx=Number(remove.dataset.remove);
  if(Number.isInteger(idx)&&details[idx]){
   const rowNo=Number(details[idx]._row);if(Number.isFinite(rowNo))deletedRows.push(rowNo);
   details.splice(idx,1);render();
  }
  return;
 }
 const add=e.target.closest('[data-add-section]');
 if(add){addRow(add.dataset.addSection);return}
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