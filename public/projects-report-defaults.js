(function(){
'use strict';

const UNIT_OPTIONS=['M','EA','KIT','LS','KM','NO'];
const BOQ_STATUS_OPTIONS=['جاري','لم يبدأ'];
const MATERIAL_STATUS_OPTIONS=['لم يتم الصرف','تم الصرف جزئي','تم الصرف بالكامل'];
const REPORT_TYPE_OPTIONS=['يومي','أسبوعي','شهري'];
const WEIGHT_OPTIONS=Array.from({length:100},(_,i)=>(i+1)+'%');

const GENERAL=[
 {key:'PROJECT_TITLE',label:'عنوان المشروع',field:'Text Value / Description',type:'text'},
 {key:'DETAILED_WORK_DESCRIPTION',label:'وصف الأعمال التفصيلي',field:'Text Value / Description',type:'textarea',wide:true},
 {key:'WORK_ORDER_LOCATION',label:'الموقع',field:'Location / Neighborhood',type:'text',auto:true,source:'ورقة أوامر العمل — عمود الموقع'},
 {key:'CONTRACTOR_REPORT_NAME',label:'اسم المقاول في التقرير',field:'Text Value / Description',type:'text',auto:true,source:'ورقة أوامر العمل — عمود المقاول'},
 {key:'ACTUAL_START_DATE',label:'تاريخ البدء الفعلي',field:'Start / Observation Date',type:'date'},
 {key:'EXPECTED_OPERATION_DATE',label:'تاريخ التشغيل المتوقع',field:'End / Expected Date',type:'date'},
 {key:'SEC_FOLLOWUP_ENGINEER',label:'مهندس متابعة شركة الكهرباء',field:'Responsible / Issuing Authority',type:'text'},
 {key:'CONTRACTUAL_DURATION_DAYS',label:'المدة التعاقدية بالأيام',field:'Numeric Value',type:'number',auto:true,source:'ورقة أوامر العمل — عمود المدة uds'},
 {key:'CONTRACT_DURATION_WITH_WEEKENDS',label:'المدة التعاقدية شاملة الجمعة (يوم)',field:'Numeric Value',type:'number',auto:true,source:'حساب آلي من تاريخ البدء الفعلي + أيام الجمعة الواقعة داخل المدة التعاقدية'},
 {key:'CONSULTANT_NAME',label:'اسم الاستشاري',field:'Text Value / Description',type:'text',fixed:true,value:'شركة أبعاد الرؤية للاستشارات الهندسية'},
 {key:'REPORT_TYPE',label:'نوع التقرير',field:'Text Value / Description',type:'select',options:REPORT_TYPE_OPTIONS},
 {key:'REPORT_NO',label:'رقم التقرير',field:'Text Value / Description',type:'select',options:Array.from({length:100},(_,i)=>String(i+1))},
 {key:'REPORT_DATE',label:'تاريخ التقرير',field:'Start / Observation Date',type:'date',fixedToday:true},
 {key:'PREPARED_BY',label:'إعداد التقرير / التوقيع',field:'Responsible / Issuing Authority',type:'staff-select',signature:true}
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
  ['Unit','الوحدة','select',UNIT_OPTIONS],['Planned / Required Qty','الكمية المخططة','text'],['Executed / Issued Qty','المنفذ','text'],
  ['Period Qty','كمية الفترة','text'],['Weight / Planned Progress %','الوزن %','select',WEIGHT_OPTIONS],['Status','الحالة','select',BOQ_STATUS_OPTIONS]
 ],
 MATERIAL:[
  ['Field / Item / Permit No.','كود المادة','text'],['Text Value / Description','وصف المادة','text'],['Unit','الوحدة','select',UNIT_OPTIONS],
  ['Planned / Required Qty','المطلوب','text'],['Executed / Issued Qty','المصروف / المتاح','text'],['Status','الحالة','select',MATERIAL_STATUS_OPTIONS],['Notes','ملاحظات','textarea']
 ],
 PERMIT_DETAIL:[
  ['Field / Item / Permit No.','رقم التصريح / المرحلة','text'],['Responsible / Issuing Authority','الجهة المصدرة','text'],
  ['Location / Neighborhood','الموقع / الحي','text'],['Status','الحالة','select',["لا يتطلب","لم يتم ادخال التصريح","انتهاء التنسيق -رفض","تم اصدار التصريح","ملغي","تم تعديل التصريح","قيد التنسيق والاعتماد","بانتظار السداد","مسودة","انتهت فترة السداد","انتهاء التنسيق - قبول","تصريح مدن فقط"]],['Start / Observation Date','تاريخ البداية','date'],
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
let rows=[],details=[],passthrough=[],generalDraft={},liveAuto={},staffNames=[],deletedRows=[],currentWo='',busy=false,installed=false,activeTab='general',pageByTab={};

function valueInputDate(v){
 const s=clean(v);let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
 if(m)return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
 m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
 return m?m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0'):'';
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
function calculatedContractDuration(){
 const liveStart=document.querySelector('[data-general="ACTUAL_START_DATE"]')?.value;
 const start=clean(liveStart)||clean(generalDraft.ACTUAL_START_DATE)||currentSuggestion('ACTUAL_START_DATE');
 const duration=clean(liveAuto.CONTRACTUAL_DURATION_DAYS)||currentSuggestion('CONTRACTUAL_DURATION_DAYS');
 return contractDurationWithWeekends(start,duration);
}
function refreshCalculatedGeneral(){
 const update=()=>{const el=document.querySelector('[data-auto-general="CONTRACT_DURATION_WITH_WEEKENDS"]');if(el)el.value=calculatedContractDuration()};
 update();setTimeout(update,0);
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
 const r=g.signature?preparedRow():generalRow(g.key);
 return r?clean(r[g.field]):'';
}
function generalField(g){
 let val=generalValue(g),placeholder=currentSuggestion(g.key);
 if(g.key==='REPORT_NO'){
  const n=parseInt(val||placeholder||'1',10);
  val=Number.isFinite(n)&&n>=1&&n<=100?String(n):'1';
  placeholder=val;
 }
 if(g.fixedToday)return '<label class="prd-field prd-field-auto"><span>'+esc(g.label)+'</span><input type="date" value="'+esc(val)+'" readonly aria-readonly="true"><small>تاريخ اليوم تلقائيًا — توقيت السعودية</small></label>';
 if(g.fixed)return '<label class="prd-field prd-field-auto"><span>'+esc(g.label)+'</span><input type="text" value="'+esc(val)+'" readonly aria-readonly="true"><small>قيمة ثابتة افتراضية</small></label>';
 if(g.auto)return '<label class="prd-field prd-field-auto"><span>'+esc(g.label)+'</span><input data-auto-general="'+esc(g.key)+'" type="text" value="'+esc(val)+'" readonly aria-readonly="true"><small>آلي من '+esc(g.source||'مصدر البيانات')+'</small></label>';
 if(g.type==='staff-select'){
  const selected=clean(val)||clean(placeholder);
  const base=staffNames.slice();
  if(selected&&!base.includes(selected))base.unshift(selected);
  const opts=['',...base].map(x=>'<option value="'+esc(x)+'"'+(x===selected?' selected':'')+'>'+esc(x||'— اختر من الكادر —')+'</option>').join('');
  return '<label class="prd-field"><span>'+esc(g.label)+'</span><select data-general="'+g.key+'">'+opts+'</select><small class="prd-source-hint">من الموارد البشرية</small></label>';
 }
 if(g.type==='select'){
  const selected=clean(val)||clean(placeholder)||clean(g.options?.[0]);
  const base=(g.options||[]).slice();
  if(selected&&!base.includes(selected))base.unshift(selected);
  const opts=base.map(x=>'<option value="'+esc(x)+'"'+(String(x)===String(selected)?' selected':'')+'>'+esc(x)+'</option>').join('');
  return '<label class="prd-field"><span>'+esc(g.label)+'</span><select data-general="'+g.key+'">'+opts+'</select></label>';
 }
 if(g.type==='textarea')return '<label class="prd-field prd-wide"><span>'+esc(g.label)+'</span><textarea data-general="'+g.key+'" placeholder="'+esc(placeholder)+'">'+esc(val)+'</textarea></label>';
 return '<label class="prd-field'+(g.wide?' prd-wide':'')+'"><span>'+esc(g.label)+'</span><input data-general="'+g.key+'" type="'+g.type+'" value="'+esc(g.type==='date'?valueInputDate(val):val)+'" placeholder="'+esc(placeholder)+'"></label>';
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
 if(key==='CONTRACT_DURATION_WITH_WEEKENDS')return calculatedContractDuration();
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
  ['Category / Impact','التصنيف / درجة الأثر','text'],
  ['Action / Support Required','الإجراء / الدعم المطلوب','text'],
  ['Responsible / Issuing Authority','الجهة المسؤولة','text'],
  ['Start / Observation Date','تاريخ الرصد','date'],
  ['@age','عمر العائق (يوم)','calc'],
  ['Status','الحالة','text'],
  ['Notes','ملاحظات','text']
 ],
 PERIOD_SUMMARY:[
  ['Text Value / Description','ملخص الأعمال المنفذة خلال الفترة','textarea'],
  ['Start / Observation Date','من تاريخ','date'],
  ['End / Expected Date','إلى تاريخ','date'],
  ['Notes','ملاحظات','text']
 ],
 MANAGEMENT_NOTE:[
  ['Text Value / Description','الملاحظة الإدارية','textarea'],
  ['Action / Support Required','الإجراء / الدعم المطلوب','textarea'],
  ['Responsible / Issuing Authority','المسؤول','text'],
  ['Notes','ملاحظات','text']
 ]
};
function tableNumber(v){const s=String(v??'').replace(/,/g,'').replace('%','').trim();if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null}
function tableCalc(sec,r,key){
 const planned=tableNumber(r['Planned / Required Qty']),done=tableNumber(r['Executed / Issued Qty']);
 if(key==='@remaining')return planned==null?'—':Math.max(0,planned-(done||0)).toLocaleString('en-US',{maximumFractionDigits:2});
 if(key==='@progress')return planned&&done!=null?((done/planned)*100).toFixed(2)+'%':'—';
 if(key==='@age'){
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
 return '<td><input aria-label="'+esc(label)+'" type="'+type+'" data-ridx="'+i+'" data-rfield="'+esc(key)+'" value="'+esc(type==='date'?valueInputDate(v):v)+'"></td>';
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
function renderTabs(){
 const nav=document.getElementById('prdTabs');if(!nav)return;
 nav.innerHTML=TAB_DEFS.map(t=>'<button type="button" class="'+(t.id===activeTab?'active':'')+'" data-tab="'+t.id+'"><i>'+t.icon+'</i><span>'+esc(t.label)+'</span><b>'+countForTab(t)+'</b></button>').join('');
}
function renderContent(){
 const box=document.getElementById('prdTabContent');if(!box)return;
 const def=tabDef();
 if(def.id==='general'){
  box.innerHTML='<section class="prd-section prd-section-current"><div class="prd-section-head"><div><b>البيانات الأساسية</b><span>إدخال منظم في خلايا شبيهة بالجدول</span></div></div><div id="prdGeneral" class="prd-general-grid prd-general-sheet">'+GENERAL.map(generalField).join('')+'</div></section>';
  return;
 }
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
 for(const g of GENERAL){
  if(g.auto||g.fixed||g.fixedToday){generalDraft[g.key]='';continue}
  const r=g.signature?preparedRow():generalRow(g.key);
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
  passthrough=rows.filter(r=>!SECTION_LABELS[r.Section]&&!isKnownGeneral(r)&&!isPrepared(r)).map(r=>({...r}));
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
 for(const g of GENERAL){
  if(g.auto||g.fixed||g.fixedToday)continue;
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
 if(Number.isFinite(Number(r?._row)))out._row=Number(r._row);
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
 const g=e.target.dataset.general;if(g){generalDraft[g]=e.target.value;if(g==='ACTUAL_START_DATE')refreshCalculatedGeneral();return}
 const idx=Number(e.target.dataset.ridx),field=e.target.dataset.rfield;
 if(Number.isInteger(idx)&&details[idx]&&field){details[idx][field]=e.target.value;refreshCalculatedRow(idx)}
}
function handleChange(e){
 const g=e.target.dataset.general;if(g){generalDraft[g]=e.target.value;if(g==='ACTUAL_START_DATE')refreshCalculatedGeneral();return}
 const ridx=Number(e.target.dataset.ridx),rfield=e.target.dataset.rfield;
 if(Number.isInteger(ridx)&&details[ridx]&&rfield){details[ridx][rfield]=e.target.value;refreshCalculatedRow(ridx);return}
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