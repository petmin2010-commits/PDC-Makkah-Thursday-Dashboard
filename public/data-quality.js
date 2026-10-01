(function(){
'use strict';
const DQ={sections:[],selected:null};
const t=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const esc=v=>t(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(Number(v||0));
const fmtAdviceDate=v=>{
 const s=t(v);if(!s)return '—';
 const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(iso)return iso[3]+'/'+iso[2]+'/'+iso[1];
 const dmy=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
 if(dmy)return String(dmy[1]).padStart(2,'0')+'/'+String(dmy[2]).padStart(2,'0')+'/'+dmy[3];
 const d=new Date(s);
 return isNaN(d)?s:d.toLocaleDateString('ar-EG',{day:'2-digit',month:'2-digit',year:'numeric'});
};
const norm=v=>t(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
const blank=(r,k)=>!t(r&&r[k]);
const checked=v=>v===true||/^(true|نعم|تم|yes|1)$/i.test(t(v));
const exact=(v,x)=>norm(v)===norm(x);
const rowId=(r,section)=>t(r.workOrder||r.noticeNo)||(section==='emergency'?'إشعار':'سجل')+' — صف '+(r._row||'—');
const ctx=(r)=>t(r.contractor||r.engineer||r.location)||'—';

function missing(label,col,field,header,note,applicable){
 return {label,col,field,header,note:note||('العمود '+col+' — بيانات ناقصة'),issue:r=>blank(r,field),value:()=> 'فارغ',applicable:applicable||(()=>true)};
}
function custom(label,col,header,note,predicate,value,applicable){
 return {label,col,header,note,issue:predicate,value:value||(()=> '—'),applicable:applicable||(()=>true)};
}
const assetExecuted=r=>exact(r&&r.orderFollowStatus,'تم التنفيذ');
const assetHasNote=r=>!!t(r&&r.notes)&&!/لا\s*(يوجد|توجد).*ملاحظ/i.test(t(r&&r.notes));

function definitions(q){
 return [
  {key:'projects',title:'المشاريع',subtitle:'⚡ المشاريع العام',rows:q.projects||[],cards:[
   missing('بدون مهندس مسئول','U','engineer','المهندس المسئول'),
   missing('بدون مرحلة تنفيذ','V','stage','مرحلة التنفيذ'),
   missing('بدون حالة مرحلة','W','stageStatus','حالة المرحلة'),
   missing('بدون الحفر المستهدف','X','excavationTarget','الحفر المستهدف'),
   missing('بدون التمديد المستهدف','Z','extensionTarget','التمديد المستهدف'),
   missing('بدون إفادة استشاري','AC','advice','إفادة الاستشاري'),
   custom('إفادات قديمة','AE','حالة الإفادة','العمود AE — يحسب كل إدخال غير «جديدة»',r=>!!t(r.adviceAge)&&!exact(r.adviceAge,'جديدة'),r=>t(r.adviceAge))
  ]},
  {key:'connections',title:'التوصيلات',subtitle:'🔌 التوصيلات العام',rows:q.connections||[],cards:[
   missing('بدون مهندس مسئول','V','engineer','المهندس المسئول'),
   missing('بدون مرحلة تنفيذ','W','stage','مرحلة التنفيذ'),
   missing('بدون حالة مرحلة','X','stageStatus','حالة المرحلة'),
   missing('بدون إفادة استشاري','AC','advice','إفادة الاستشاري'),
   custom('إفادات قديمة','AE','حالة الإفادة','العمود AE — يحسب كل إدخال غير «جديدة»',r=>!!t(r.adviceAge)&&!exact(r.adviceAge,'جديدة'),r=>t(r.adviceAge))
  ]},
  {key:'permits',title:'التصاريح',subtitle:'🧾 التصاريح العام',rows:q.permits||[],cards:[
   missing('بدون حالة تصريح','N','permitStatus','حالة التصريح'),
   custom('متأخر ولم يتم اتخاذ اللازم','R + T','اتخاذ اللازم للحالات المتأخرة','R يجب أن يكون ✓ عندما تكون T غير «غير متأخر»',
    r=>!!t(r.evaluation)&&!exact(r.evaluation,'غير متأخر')&&!checked(r.actionTaken),
    r=>'T: '+(t(r.evaluation)||'فارغ')+' | R: '+(checked(r.actionTaken)?'✓':'غير محدد / غير مفعّل'))
  ]},
  {key:'assets',title:'الأصول',subtitle:'🏭 الأصول',rows:q.assets||[],cards:[
   missing('بدون تاريخ تركيب المعدة','J','installDate','تاريخ تركيب المعدة','العمود J — مطلوب عندما تكون حالة الأمر «تم التنفيذ»',assetExecuted),
   missing('بدون رقم المعدة','K','equipmentNo','رقم المعدة','العمود K — مطلوب لكل أمر حالته «تم التنفيذ»',assetExecuted),
   missing('بدون نوع الاختبار','L','testType','نوع الاختبار','العمود L — مطلوب لكل أمر حالته «تم التنفيذ»',assetExecuted),
   missing('بدون الجهة المنفذة','M','executingEntity','الجهة المنفذة','العمود M — مطلوب عندما تكون حالة الأمر «تم التنفيذ»',assetExecuted),
   missing('بدون اسم مهندس التركيب','N','engineer','اسم المهندس المسئول عن التركيب','العمود N — مطلوب عندما تكون حالة الأمر «تم التنفيذ»',assetExecuted),
   missing('بدون مراجعة بيانات الزراعة','O','plantingReview','مراجعة بيانات الزراعه','العمود O — «لا يتطلب» قيمة صحيحة ومكتملة'),
   missing('بدون حالة الزراعة','P','plantingStatus','حالة الزاعة','العمود P — «لا يتطلب» قيمة صحيحة ومكتملة'),
   missing('بدون نموذج الأصول','Q','assetForm','نموذج الأصول','العمود Q — «لا يتطلب» قيمة صحيحة ومكتملة'),
   missing('بدون الاستلام الميداني','R','fieldReceipt','الإستلام الميداني'),
   missing('بدون إجراء 207','S','procedure207','إجراء 207'),
   custom('بدون بيان هل تم تلافيها','U','هل تم تلافيها','العمود U — مطلوب فقط عند وجود ملاحظة فعلية في العمود T',r=>blank(r,'resolved'),()=> 'فارغ',assetHasNote),
   missing('بدون استلام الأصول على النظام 211','V','systemReceipt','استلام الأصول على النظام اجراء 211')
  ]},
  {key:'emergency',title:'الطوارئ',subtitle:'⚠ إشعارات الطوارئ',rows:q.emergency||[],cards:[
   missing('بدون رقم إشعار','B','noticeNo','رقم الإشعار'),
   missing('بدون تاريخ إسناد','D','assignedDate','تاريخ الإسناد'),
   custom('بدون تاريخ مباشرة العمل','E','تاريخ مباشرة العمل','العمود E — مطلوب للحالة «منجز» فقط',r=>exact(r.status,'منجز')&&blank(r,'startDate'),()=> 'فارغ'),
   custom('بدون تاريخ انتهاء العمل','F','تاريخ انتهاء العمل','العمود F — مطلوب للحالة «منجز» فقط',r=>exact(r.status,'منجز')&&blank(r,'endDate'),()=> 'فارغ'),
   missing('بدون وصف عمل','G','description','وصف العمل'),
   missing('بدون تصنيف عمل','H','classification','تصنيف العمل'),
   missing('بدون نوع','I','type','النوع'),
   missing('بدون إدارة','J','administration','الإدارة'),
   missing('بدون دائرة','K','circuit','الدائرة'),
   missing('بدون قسم','L','section','القسم'),
   missing('بدون مجدول / طارئ','M','emergencyType','مجدول / طارئ'),
   missing('بدون موقع','N','location','الموقع'),
   missing('بدون استشاري','O','consultant','الاستشاري'),
   missing('بدون اسم استشاري','P','engineer','اسم الاستشاري'),
   missing('بدون مقاول','Q','contractor','المقاول'),
   missing('بدون حالة تنفيذ','U','status','حالة التنفيذ','العمود U — منجز / غير منجز'),
   missing('بدون أرشفة مستندات','V','archive','أرشفة المستندات','العمود V — أرشفة المستندات')
  ]}
 ];
}

function dqDate(v){
 const raw=t(v);if(!raw)return null;
 const s=raw.replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/[۰-۹]/g,d=>'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);
 const make=(y,m,d)=>{const x=new Date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null};
 let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s.*)?$/);
 if(m)return make(Number(m[1]),Number(m[2]),Number(m[3]));
 m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
 if(m)return make(Number(m[3]),Number(m[2]),Number(m[1]));
 m=s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s.*)?$/);
 if(m){
  // Google Sheets API returns the project permit dates as MM-DD-YYYY
  // (e.g. 07-03-2026 = 3 July 2026). Fall back to DD-MM-YYYY
  // only when the US interpretation is impossible.
  const y=Number(m[3]),a=Number(m[1]),b=Number(m[2]);
  return make(y,a,b)||make(y,b,a);
 }
 m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s.*)?$/);
 if(m)return make(Number(m[3]),Number(m[2]),Number(m[1]));
 const d=new Date(s);return isNaN(d)?null:d;
}
function dqDateLabel(v){
 const d=dqDate(v);if(!d)return t(v);
 const p=n=>String(n).padStart(2,'0');
 return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();
}
function dqAdvancedRow(source,r,issue,value){
 return {source,_row:r._row||'—',workOrder:t(r.workOrder||r.noticeNo),contractor:t(r.contractor),issue,value:t(value)||'—'};
}
function advancedChecks(q){
 const projects=q.projects||[],connections=q.connections||[],permits=q.permits||[],assets=q.assets||[],emergency=q.emergency||[];
 const safety=q.safety||[],execution=q.executionViolations||[],minutes=q.minutes||[];
 const checks=[];

 const missingWo=[];
 [['المشاريع',projects],['التوصيلات',connections],['التصاريح',permits],['الأصول',assets],['مخالفات السلامة',safety],['مخالفات التنفيذ',execution],['محاضر إثبات الحالة',minutes]].forEach(([source,rows])=>{
  rows.forEach(r=>{if(blank(r,'workOrder'))missingWo.push(dqAdvancedRow(source,r,'رقم أمر العمل فارغ','فارغ'))});
 });
 checks.push({key:'missingWorkOrder',label:'رقم أمر ناقص',note:'سجل موجود بدون رقم أمر عمل، ما يمنع الربط الصحيح بين البيانات.',rows:missingWo});

 const badDates=[],today=new Date();today.setHours(0,0,0,0);const futureLimit=new Date(today);futureLimit.setDate(futureLimit.getDate()+1);
 const inspectDates=(source,rows,fields,pairs=[],futureKeys=[])=>{
  rows.forEach(r=>{
   fields.forEach(([key,label])=>{
    const raw=t(r[key]);if(!raw)return;const d=dqDate(raw);
    if(!d)badDates.push(dqAdvancedRow(source,r,'تنسيق '+label+' غير صالح',raw));
    else if(futureKeys.includes(key)&&d>futureLimit)badDates.push(dqAdvancedRow(source,r,label+' في المستقبل',raw));
   });
   pairs.forEach(([a,b,label])=>{const da=dqDate(r[a]),db=dqDate(r[b]);if(da&&db&&da>db)badDates.push(dqAdvancedRow(source,r,label,dqDateLabel(r[a])+' ← '+dqDateLabel(r[b])))});
  });
 };
 inspectDates('المشاريع',projects,[['assignedDate','تاريخ الإسناد'],['permitStart','بداية التصريح'],['permitEnd','نهاية التصريح']],[['permitStart','permitEnd','نهاية التصريح أسبق من البداية']],['assignedDate']);
 inspectDates('التوصيلات',connections,[['assignedDate','تاريخ الإسناد'],['permitStart','بداية التصريح'],['permitEnd','نهاية التصريح']],[['permitStart','permitEnd','نهاية التصريح أسبق من البداية']],['assignedDate']);
 inspectDates('التصاريح',permits,[['assignedDate','تاريخ الإسناد'],['permitStart','بداية التصريح'],['permitEnd','نهاية التصريح']],[['permitStart','permitEnd','نهاية التصريح أسبق من البداية']],['assignedDate']);
 inspectDates('الأصول',assets,[['installDate','تاريخ تركيب المعدة']],[],['installDate']);
 inspectDates('الطوارئ',emergency,[['assignedDate','تاريخ الإسناد'],['startDate','تاريخ مباشرة العمل'],['endDate','تاريخ انتهاء العمل']],[['startDate','endDate','تاريخ انتهاء العمل أسبق من المباشرة']]);
 inspectDates('مخالفات السلامة',safety,[['date','تاريخ المخالفة']],[],['date']);
 inspectDates('مخالفات التنفيذ',execution,[['date','تاريخ المخالفة']],[],['date']);
 inspectDates('محاضر إثبات الحالة',minutes,[['date','تاريخ المحضر']],[],['date']);
 checks.push({key:'badDate',label:'تاريخ غير منطقي',note:'تنسيق تاريخ غير صالح، تاريخ مستقبلي، أو نهاية أسبق من البداية.',rows:badDates});

 const assetSequence=[];
 assets.forEach(r=>{
  if(exact(r.procedure207,'تم')&&!exact(r.fieldReceipt,'تم')){
   assetSequence.push(dqAdvancedRow('الأصول',r,'إجراء 207 تم قبل الاستلام الميداني','R: '+(t(r.fieldReceipt)||'فارغ')+' | S: '+(t(r.procedure207)||'فارغ')));
  }
 });
 checks.push({key:'assetSequence',label:'تسلسل أصول غير منطقي',note:'إجراء 207 لا يُعتبر صحيحًا إلا بعد أن يكون الاستلام الميداني = «تم».',rows:assetSequence});

 const missingLinks=[];
 safety.forEach(r=>{if((t(r.violation1)||t(r.violation2))&&blank(r,'link'))missingLinks.push(dqAdvancedRow('مخالفات السلامة',r,'مخالفة مسجلة بدون رابط','الرابط فارغ'))});
 execution.forEach(r=>{if(t(r.violation)&&blank(r,'link'))missingLinks.push(dqAdvancedRow('مخالفات التنفيذ',r,'مخالفة مسجلة بدون رابط','الرابط فارغ'))});
 checks.push({key:'missingLink',label:'رابط مفقود',note:'مخالفة مسجلة ولكن رابط المستند/المخالفة غير موجود.',rows:missingLinks});

 const duplicateRows=[],seen=new Map();
 const fullRowSignature=(source,r)=>{
  // Prefer the server-side signature of the COMPLETE physical sheet row.
  // It contains unmapped columns too (such as email send timestamp), while ignoring only the sheet row number.
  if(r&&r._fullRowSignature)return JSON.stringify([t(source),String(r._fullRowSignature)]);
  // Backward-compatible fallback for older payloads.
  const keys=Object.keys(r).filter(k=>!k.startsWith('_')).sort();
  const values=keys.map(k=>t(r[k]));
  if(!values.some(Boolean))return '';
  return JSON.stringify([t(source),...keys.map((k,i)=>[k,values[i]])]);
 };
 const addDup=(source,rows)=>{
  rows.forEach(r=>{
   const sig=fullRowSignature(source,r);
   if(!sig)return;
   if(!seen.has(sig))seen.set(sig,[]);
   seen.get(sig).push({source,r});
  });
 };
 addDup('مخالفات السلامة',safety);
 addDup('مخالفات التنفيذ',execution);
 addDup('محاضر إثبات الحالة',minutes);
 seen.forEach(group=>{if(group.length>1)group.forEach(x=>duplicateRows.push(dqAdvancedRow(x.source,x.r,'صف كامل مطابق ومكرر',group.length+' صفوف متطابقة بالكامل')))});
 checks.push({key:'duplicate',label:'تكرار سجل',note:'لا تُرصد الملاحظة إلا إذا تطابقت جميع خلايا الصف بالكامل داخل نفس المصدر؛ يُستثنى فقط رقم صف الشيت.',rows:duplicateRows});

 const contractorNoSupervisor=[];
 safety.forEach(r=>{if(t(r.contractor)&&blank(r,'supervisor'))contractorNoSupervisor.push(dqAdvancedRow('مخالفات السلامة',r,'مقاول مسجل بدون مشرف موقع','المشرف فارغ'))});
 execution.forEach(r=>{if(t(r.contractor)&&blank(r,'supervisor'))contractorNoSupervisor.push(dqAdvancedRow('مخالفات التنفيذ',r,'مقاول مسجل بدون مشرف موقع','المشرف فارغ'))});
 checks.push({key:'contractorNoSupervisor',label:'مقاول بدون مشرف',note:'يوجد مقاول في سجل مخالفة ولا يوجد مشرف موقع مرتبط بالسجل.',rows:contractorNoSupervisor});

 const violationNoStatement=[];
 safety.forEach(r=>{if((t(r.violation1)||t(r.violation2))&&blank(r,'reason'))violationNoStatement.push(dqAdvancedRow('مخالفات السلامة',r,'مخالفة بدون إفادة / سبب','سبب المخالفة فارغ'))});
 execution.forEach(r=>{if(t(r.violation)&&blank(r,'reason'))violationNoStatement.push(dqAdvancedRow('مخالفات التنفيذ',r,'مخالفة بدون إفادة / سبب','سبب المخالفة فارغ'))});
 minutes.forEach(r=>{if(t(r.minuteType)&&blank(r,'statement'))violationNoStatement.push(dqAdvancedRow('محاضر إثبات الحالة',r,'محضر بدون إفادة موقع','إفادة الموقع فارغة'))});
 checks.push({key:'violationNoStatement',label:'مخالفة بدون إفادة',note:'في المخالفات: سبب/إفادة المخالفة فارغ؛ وفي المحاضر: إفادة الموقع فارغة.',rows:violationNoStatement});

 return checks;
}
function renderAdvancedDetails(check){
 const root=document.getElementById('dqIssueDetails');if(!root)return;
 const rows=check.rows||[];
 root.innerHTML=`
  <div class="dq-detail-head">
   <div><span>SMART DATA AUDIT</span><h3>التدقيق الذكي — ${esc(check.label)}</h3><small>${esc(check.note)}</small></div>
   <div class="dq-detail-count">${fmt(rows.length)} حالة</div>
  </div>
  ${rows.length?`<div class="dq-table-wrap"><table><thead><tr><th>#</th><th>المصدر</th><th>صف الشيت</th><th>المعرف</th><th>المقاول</th><th>المشكلة</th><th>القيمة الحالية</th></tr></thead><tbody>
   ${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.source)}</td><td>${esc(r._row)}</td><td><b>${esc(r.workOrder||'—')}</b></td><td>${esc(r.contractor||'—')}</td><td>${esc(r.issue)}</td><td>${esc(r.value)}</td></tr>`).join('')}
  </tbody></table></div>`:'<div class="dq-empty">لا توجد حالات مخالفة لهذا الفحص حاليًا.</div>'}`;
 root.scrollIntoView({behavior:'smooth',block:'start'});
}

function ensure(){
 const dataPage=document.getElementById('dataPage');if(!dataPage)return null;
 let root=document.getElementById('dataQualityDashboard');
 if(!root){
  root=document.createElement('section');
  root.id='dataQualityDashboard';
  root.className='dq-dashboard';
  root.style.display='none';
  const k=document.getElementById('pageKpis');
  dataPage.insertBefore(root,k||dataPage.firstChild);
  const detail=document.getElementById('dataTable')?.closest('.panel');
  if(detail)detail.classList.add('dq-generic-detail');
 }
 return root;
}

function issueRows(section,card){
 const applicable=card.applicable||(()=>true);
 return section.rows.filter(r=>applicable(r)&&card.issue(r));
}
function sectionStats(section){
 const affected=new Set(),counts=[];let totalCells=0;
 section.cards.forEach(card=>{
  const applicable=card.applicable||(()=>true);
  totalCells+=section.rows.filter(applicable).length;
  const rows=issueRows(section,card);counts.push(rows.length);
  rows.forEach(r=>affected.add(r._row));
 });
 const issues=counts.reduce((a,b)=>a+b,0);
 const completionRate=totalCells?((totalCells-issues)/totalCells)*100:100;
 return {issues,affected:affected.size,counts,totalCells,completionRate};
}

function renderDetails(section,card){
 const root=document.getElementById('dqIssueDetails');if(!root)return;
 const rows=issueRows(section,card);
 root.innerHTML=`
  <div class="dq-detail-head">
   <div><span>ISSUE DRILLDOWN</span><h3>${esc(section.title)} — ${esc(card.label)}</h3><small>${esc(card.note)}</small></div>
   <div class="dq-detail-count">${fmt(rows.length)} حالة</div>
  </div>
  ${rows.length? `<div class="dq-table-wrap"><table><thead><tr><th>#</th><th>صف الشيت</th><th>المعرف</th><th>المقاول / المسؤول</th><th>القيمة الحالية</th><th>قاعدة الجودة</th></tr></thead><tbody>
   ${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r._row||'—')}</td><td><b>${esc(rowId(r,section.key))}</b></td><td>${esc(ctx(r))}</td><td>${esc(card.value(r))}</td><td>${esc(card.note)}</td></tr>`).join('')}
  </tbody></table></div>` : '<div class="dq-empty">لا توجد حالات مخالفة لهذه القاعدة حاليًا.</div>'}`;
 root.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderAdviceAiDetails(ai,type){
 const root=document.getElementById('dqIssueDetails');if(!root)return;
 const recent=Array.isArray(ai?.recent)?ai.recent:[];
 const current=Array.isArray(ai?.currentOrders)?ai.currentOrders:[];
 let rows=[],title='الحالة الحالية للإفادات',note='الكروت تعرض الحالة الحالية فقط؛ السجل التاريخي يحتفظ بكل التغييرات السابقة للمراجعة.';
 if(type==='substantive'){rows=current.filter(x=>x.classification==='جوهري');title='تحديثات جوهرية حالية'}
 else if(type==='weak'){rows=current.filter(x=>x.classification==='ضعيف');title='إفادات ضعيفة حاليًا'}
 else if(type==='suspicious'){rows=current.filter(x=>x.classification==='شكلي'||t(x.classification).includes('مشتبه'));title='تحديثات شكلية / مشتبهة حاليًا';note='تختفي الحالة من هذا الكارت فور إدخال إفادة جوهرية لاحقة، مع بقاء الحدث القديم محفوظًا في السجل التاريخي.'}
 else if(type==='pending'){rows=current.filter(x=>t(x.classification).includes('بانتظار'));title='بانتظار تحليل الوكيل'}
 else if(type==='stale'){rows=current.filter(x=>Number(x.daysSinceSubstantive)>=3);title='لم تُحدّث جوهريًا منذ 3 أيام فأكثر';note='العمر محسوب من آخر متابعة اعتبرها الوكيل جوهرية، وليس من آخر تعديل شكلي.'}
 else if(type==='severe'){rows=current.filter(x=>Number(x.daysSinceSubstantive)>=15);title='إهمال شديد — 15 يومًا فأكثر';note='لم يرصد النظام متابعة جوهرية منذ 15 يومًا فأكثر.'}
 else rows=current;
 const staleMode=type==='stale'||type==='severe';
 root.innerHTML=`
  <div class="dq-detail-head"><div><span>AI ADVICE AGENT</span><h3>${esc(title)}</h3><small>${esc(note)}</small></div><div class="dq-detail-count">${fmt(rows.length)} حالة</div></div>
  ${rows.length?`<div class="dq-table-wrap"><table><thead><tr><th>#</th><th>المصدر</th><th>أمر العمل</th><th>المهندس</th><th>المرحلة</th><th>${staleMode?'آخر متابعة جوهرية':'التصنيف'}</th><th>${staleMode?'العمر':'الدرجة'}</th><th>الإفادة السابقة</th><th>الإفادة الحالية</th><th>تاريخ الإفادة الجديدة</th><th>تحليل الوكيل</th></tr></thead><tbody>
   ${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.source)}</td><td><b>${esc(r.workOrder)}</b></td><td>${esc(r.engineer||'—')}</td><td>${esc(r.stage||'—')}</td><td>${esc(staleMode?(r.lastSubstantiveAt||'—'):(r.classification||'—'))}</td><td>${staleMode?(Number(r.daysSinceSubstantive||0).toFixed(1)+' يوم'):(r.score==null?'—':esc(r.score)+'/100')}</td><td class="dq-advice-text">${esc(r.previousAdvice||'—')}</td><td class="dq-advice-text">${esc(r.currentAdvice||'—')}</td><td class="dq-advice-date">${esc(fmtAdviceDate(r.currentTimestamp))}</td><td class="dq-advice-text">${esc(r.reason||'—')}</td></tr>`).join('')}
  </tbody></table></div>`:'<div class="dq-empty">لا توجد حالات ضمن هذا التصنيف حاليًا.</div>'}`;
 root.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderAdviceAi(ai){
 ai=ai||{};const c=ai.counts||{},a=ai.age||{};
 const stale=Number(a.old||0)+Number(a.veryOld||0)+Number(a.neglect||0)+Number(a.severe||0);
 const status=ai.agentEnabled?'الوكيل مفعل':'الوكيل غير مفعل';
 const statusText=ai.agentEnabled?'يحلل التغييرات الدلالية في الإفادات ويحدد هل المتابعة جوهرية أم شكلية.':'تم تجهيز النظام والتخزين التاريخي، ويلزم تفعيل OPENAI_API_KEY على السيرفر لبدء التحليل الدلالي.';
 return `<section class="dq-ai-advice">
  <div class="dq-ai-head"><div><span>AI ADVICE QUALITY AGENT</span><h3>وكيل الذكاء الاصطناعي لتحليل جودة الإفادات</h3><p>يفصل بين آخر تعديل وآخر متابعة حقيقية، ويقارن الإفادة السابقة بالجديدة. أوامر العمل في «مرحلة الإغلاق» مستبعدة من التحليل ومؤشرات جودة الإفادات.</p></div><div class="dq-ai-status ${ai.agentEnabled?'on':'off'}"><b>${esc(status)}</b><small>${esc(statusText)}</small></div></div>
  <div class="dq-ai-cards">
   <button data-advice-ai="all"><span>أوامر تحت الرقابة</span><strong>${fmt(ai.trackedOrders||0)}</strong><small>المشاريع + التوصيلات</small></button>
   <button data-advice-ai="substantive"><span>تحديثات جوهرية حالية</span><strong>${fmt(c.substantive||0)}</strong><small>آخر إفادة أضافت معلومة أو إجراءً فعليًا</small></button>
   <button data-advice-ai="weak"><span>إفادات ضعيفة حاليًا</span><strong>${fmt(c.weak||0)}</strong><small>آخر إفادة قيمتها التشغيلية محدودة</small></button>
   <button data-advice-ai="suspicious"><span>تحديثات شكلية / مشتبهة حاليًا</span><strong>${fmt(c.suspicious||0)}</strong><small>تختفي فور وصول إفادة جوهرية لاحقة</small></button>
   <button data-advice-ai="pending"><span>بانتظار تحليل الوكيل</span><strong>${fmt(c.pending||0)}</strong><small>تُحلل تلقائيًا بعد تفعيل الوكيل</small></button>
   <button data-advice-ai="stale"><span>دون متابعة جوهرية 3+ أيام</span><strong>${fmt(stale)}</strong><small>لا يعتمد على آخر تعديل شكلي</small></button>
   <button data-advice-ai="severe"><span>دون متابعة جوهرية 15+ يوم</span><strong>${fmt(a.severe||0)}</strong><small>إهمال شديد بالمتابعة الحقيقية</small></button>
   <button type="button" disabled><span>مستبعد — مرحلة الإغلاق</span><strong>${fmt(ai.excludedClosed||0)}</strong><small>لا يُرسل للوكيل ولا يدخل في مؤشرات الجودة</small></button>
   <button type="button" disabled><span>سجل تاريخي محفوظ</span><strong>${fmt(ai.totalEvents||0)}</strong><small>${esc(ai.sheet||'🔒 سجل الإفادات التاريخي')}</small></button>
  </div>
 </section>`;
}

function render(){
 const root=ensure();if(!root)return;
 const q=S.page&&S.page.quality?S.page.quality:{};
 const adviceAi=S.page&&S.page.adviceIntelligence?S.page.adviceIntelligence:{};
 const sections=definitions(q);DQ.sections=sections;
 const advanced=advancedChecks(q);DQ.advanced=advanced;
 const stats=sections.map(sectionStats);
 const totalIssues=stats.reduce((s,x)=>s+x.issues,0);
 const totalAffected=stats.reduce((s,x)=>s+x.affected,0);
 const totalCells=stats.reduce((s,x)=>s+x.totalCells,0);
 const overallCompletionRate=totalCells?((totalCells-totalIssues)/totalCells)*100:100;

 root.innerHTML=`
 <section class="dq-hero">
  <div><span>DATA QUALITY CONTROL</span><h2>مركز مراقبة جودة البيانات</h2><p>مراقبة مباشرة لنواقص الإدخال وقواعد الجودة في المشاريع والتوصيلات والتصاريح والأصول والطوارئ. اضغط على أي كارت لعرض السجلات التي تحتاج معالجة.</p></div>
  <div class="dq-hero-score"><div class="dq-hero-score-main"><strong>${fmt(totalIssues)}</strong><b>${totalIssues===0?"100.00":overallCompletionRate.toFixed(2)}%</b></div><span>ملاحظات جودة <em>• نسبة الجودة</em></span><small>${fmt(totalAffected)} حالات متأثرة عبر الأقسام</small></div>
 </section>
 <section class="dq-overview">
  ${sections.map((s,i)=>`<button class="dq-overview-card" type="button" data-go="${esc(s.key)}"><span>${esc(s.title)}</span><strong>${fmt(stats[i].issues)}</strong><small>${fmt(stats[i].affected)} سجل متأثر</small></button>`).join('')}
 </section>
 ${sections.map((section,si)=>`
 <section class="dq-section" id="dq-${esc(section.key)}">
  <div class="dq-section-head"><div><span>${esc(section.subtitle)}</span><h3>${esc(section.title)}</h3></div><div class="dq-section-metrics"><div><b>${fmt(stats[si].issues)}</b><small>ملاحظات جودة</small></div><div class="dq-quality-rate"><b>${stats[si].issues===0?"100.00":stats[si].completionRate.toFixed(2)}%</b><small>نسبة جودة البيانات</small><em>${fmt(stats[si].totalCells-stats[si].issues)} / ${fmt(stats[si].totalCells)} خلية مكتملة</em></div></div></div>
  <div class="dq-cards">
   ${section.cards.map((card,ci)=>{const count=stats[si].counts[ci];return `
    <button type="button" class="dq-card ${count?'has-issue':'is-ok'}" data-si="${si}" data-ci="${ci}" title="${esc(card.note)}">
     <i>i</i><span>${esc(card.label)}</span><strong>${fmt(count)}</strong><small>العمود ${esc(card.col)} — ${esc(card.header)}</small>
    </button>`}).join('')}
  </div>
 </section>`).join('')}
 ${renderAdviceAi(adviceAi)}
 <section class="dq-smart-audit">
  <div class="dq-smart-head"><div><span>SMART DATA AUDIT</span><h3>التدقيق الذكي المتقدم</h3><p>فحوصات إضافية لا تغيّر الكروت الحالية: تكشف أخطاء الربط والمنطق والتكرار ونواقص سجلات المخالفات.</p></div><div class="dq-smart-total"><b>${fmt(advanced.reduce((s,x)=>s+x.rows.length,0))}</b><small>ملاحظة ذكية</small></div></div>
  <div class="dq-smart-cards">
   ${advanced.map((check,ai)=>`<button type="button" class="dq-smart-card ${check.rows.length?'has-issue':'is-ok'}" data-ai="${ai}" title="${esc(check.note)}"><i>✦</i><span>${esc(check.label)}</span><strong>${fmt(check.rows.length)}</strong><small>${esc(check.note)}</small></button>`).join('')}
  </div>
 </section>
 <section id="dqIssueDetails" class="dq-details">
  <div class="dq-detail-placeholder"><b>تفاصيل الحالات</b><span>اضغط على أي كارت أعلاه لعرض الصفوف التي تحتاج مراجعة.</span></div>
 </section>`;

 root.querySelectorAll('.dq-card').forEach(btn=>btn.addEventListener('click',()=>{
  const s=sections[Number(btn.dataset.si)],c=s.cards[Number(btn.dataset.ci)];
  renderDetails(s,c);
 }));
 root.querySelectorAll('.dq-overview-card').forEach(btn=>btn.addEventListener('click',()=>{
  document.getElementById('dq-'+btn.dataset.go)?.scrollIntoView({behavior:'smooth',block:'start'});
 }));
 root.querySelectorAll('[data-advice-ai]').forEach(btn=>btn.addEventListener('click',()=>renderAdviceAiDetails(adviceAi,btn.dataset.adviceAi)));
 root.querySelectorAll('.dq-smart-card').forEach(btn=>btn.addEventListener('click',()=>{
  renderAdvancedDetails(advanced[Number(btn.dataset.ai)]);
 }));
}

function sync(){
 const dataPage=document.getElementById('dataPage'),root=ensure();if(!dataPage||!root)return;
 const on=typeof S!=='undefined'&&S.current==='dataQuality';
 dataPage.classList.toggle('data-quality-mode',on);
 root.style.display=on?'block':'none';
 document.getElementById('filterBar')?.classList.toggle('dq-filter-hidden',on);
 if(on)render();
}

ensure();
if(typeof renderDataPage==='function'){
 const base=renderDataPage;
 renderDataPage=function(){base.apply(this,arguments);sync()};
}
if(typeof openPage==='function'){
 const baseOpenPage=openPage;
 window.openPage=function(key){
  if(key!=='dataQuality'){
   document.getElementById('dataPage')?.classList.remove('data-quality-mode');
   document.getElementById('dataQualityDashboard')?.style.setProperty('display','none');
   document.getElementById('filterBar')?.classList.remove('dq-filter-hidden');
  }
  return baseOpenPage.apply(this,arguments);
 };
}
window.renderDataQualityDashboard=sync;
})();