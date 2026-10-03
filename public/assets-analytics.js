(function(){
'use strict';
const A={charts:{}};
const t=v=>String(v??'').replace(/\s+/g,' ').trim();
const e=v=>t(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>{const m=t(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
const fmt=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(Number(v||0));
const pct=(a,b)=>b?((a/b)*100).toFixed(1)+'%':'0.0%';
const yes=v=>{const s=t(v);return !!s&&!/^لم\s/.test(s)&&(/^تم/.test(s)||s.includes('تمت'))};
const no=v=>/^لم\s/.test(t(v));
const filled=v=>!!t(v);
const date=v=>{if(typeof parseDashboardDate==='function'){const d=parseDashboardDate(v);if(d&&!isNaN(d))return d}const s=t(v);if(!s)return null;const d=new Date(s);return isNaN(d)?null:d};
const avg=(rows,k)=>{const a=rows.map(r=>n(r[k])).filter(x=>x!=null&&Number.isFinite(x));return a.length?a.reduce((s,x)=>s+x,0)/a.length:null};
const unique=(rows,k)=>new Set(rows.map(r=>t(r[k])).filter(Boolean)).size;
const group=(rows,k,fn)=>{const m=new Map();rows.forEach(r=>{const x=fn?fn(r):(t(r[k])||'غير محدد');m.set(x,(m.get(x)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1])};
const executionDone=r=>t(r&&r.orderFollowStatus)==='تم التنفيذ';
const executionStopped=r=>t(r&&r.orderFollowStatus)==='موقوف/محول';
const executionPending=r=>t(r&&r.orderFollowStatus)==='لم يتم التنفيذ';
const notApplicable=v=>t(v)==='لا يتطلب';
const actionableNote=r=>filled(r.notes)&&!/لا\s*(يوجد|توجد).*ملاحظ/i.test(t(r.notes));
const resolvedOk=v=>{const s=t(v);return filled(s)&&(!/^لم\s/.test(s))&&(s.includes('تم')||/لا\s*(يوجد|توجد).*ملاحظ/i.test(s))};
const monitoredFields=[
 {label:'تاريخ تركيب المعدة',field:'installDate',col:'J',applicable:executionDone},
 {label:'رقم المعدة',field:'equipmentNo',col:'K',applicable:executionDone},
 {label:'نوع الاختبار',field:'testType',col:'L',applicable:executionDone},
 {label:'الجهة المنفذة',field:'executingEntity',col:'M',applicable:executionDone},
 {label:'مهندس التركيب',field:'engineer',col:'N',applicable:executionDone},
 {label:'مراجعة بيانات الزراعة',field:'plantingReview',col:'O',applicable:()=>true},
 {label:'حالة الزراعة',field:'plantingStatus',col:'P',applicable:()=>true},
 {label:'نموذج الأصول',field:'assetForm',col:'Q',applicable:()=>true},
 {label:'الاستلام الميداني',field:'fieldReceipt',col:'R',applicable:()=>true},
 {label:'إجراء 207',field:'procedure207',col:'S',applicable:()=>true},
 {label:'هل تم تلافيها',field:'resolved',col:'U',applicable:actionableNote},
 {label:'استلام النظام 211',field:'systemReceipt',col:'V',applicable:()=>true}
];
const workflowDefs=[
 {label:'تركيب المعدة',field:'installDate',mode:'filled'},
 {label:'رقم المعدة',field:'equipmentNo',mode:'filled'},
 {label:'نوع الاختبار',field:'testType',mode:'filled'},
 {label:'الجهة المنفذة',field:'executingEntity',mode:'filled'},
 {label:'مهندس التركيب',field:'engineer',mode:'filled'},
 {label:'مراجعة الزراعة',field:'plantingReview',done:'تمت المراجعة',pending:'لم تتم المراجعة',allowNA:true},
 {label:'الزراعة',field:'plantingStatus',done:'تمت الزراعة',pending:'لم يتم الزراعة',allowNA:true},
 {label:'نموذج الأصول',field:'assetForm',done:'تم الارفاق',pending:'لم يتم الارفاق',allowNA:true},
 {label:'الاستلام الميداني',field:'fieldReceipt',done:'تم',pending:'لم يتم'},
 {label:'إجراء 207',field:'procedure207',done:'تم',pending:'لم يتم'},
 {label:'إجراء 211',field:'systemReceipt',done:'تم',pending:'لم يتم'}
];
const fieldApplicable=(r,f)=>!f.applicable||f.applicable(r);
const fieldComplete=(r,f)=>!fieldApplicable(r,f)||filled(r[f.field]);
const missingCount=r=>monitoredFields.filter(f=>fieldApplicable(r,f)&&!filled(r[f.field])).length;
const qualityStats=rows=>{
 let applicableCells=0,completeCells=0,completeRows=0;
 rows.forEach(r=>{
  const applicable=monitoredFields.filter(f=>fieldApplicable(r,f));
  applicableCells+=applicable.length;
  const done=applicable.filter(f=>filled(r[f.field])).length;
  completeCells+=done;
  if(done===applicable.length)completeRows++;
 });
 return {applicableCells,completeCells,missingCells:applicableCells-completeCells,completeRows,incompleteRows:rows.length-completeRows,pct:applicableCells?completeCells*100/applicableCells:100};
};
const workflowDone=(r,s)=>s.mode==='filled'?filled(r[s.field]):(yes(r[s.field])||(s.allowNA&&notApplicable(r[s.field])));
function processActive(rows){return rows.some(r=>workflowDefs.some(s=>filled(r[s.field])))}
function currentStage(r,active){
 if(executionStopped(r))return'موقوف/محول — خارج متطلبات التركيب';
 if(executionPending(r))return'لم يتم التنفيذ — قبل دورة الأصل';
 if(!active)return'بيانات دورة الأصول غير مدخلة';
 if(yes(r.systemReceipt))return'مكتمل — إجراء 211';
 if(yes(r.procedure207))return'بانتظار إجراء 211';
 if(yes(r.fieldReceipt))return'بانتظار إجراء 207';
 if(workflowDone(r,{field:'assetForm',allowNA:true}))return'بانتظار الاستلام الميداني';
 if(workflowDone(r,{field:'plantingStatus',allowNA:true}))return'بانتظار نموذج الأصول';
 if(workflowDone(r,{field:'plantingReview',allowNA:true}))return'بانتظار الزراعة';
 if(filled(r.engineer))return'بانتظار مراجعة الزراعة';
 if(filled(r.executingEntity))return'بانتظار مهندس التركيب';
 if(filled(r.testType))return'بانتظار الجهة المنفذة';
 if(filled(r.equipmentNo))return'بانتظار نوع الاختبار';
 if(filled(r.installDate))return'بانتظار رقم المعدة';
 return executionDone(r)?'تم التنفيذ — بيانات الأصل غير مكتملة':'بانتظار تركيب المعدة';
}
function priorityScore(r,active){
 if(executionStopped(r))return 0;
 let s=0;const age=n(r.ageDays)||0;
 if(age>120)s+=6;else if(age>90)s+=5;else if(age>60)s+=4;else if(age>30)s+=2;
 if(executionDone(r)&&active){
  if(yes(r.procedure207)&&!yes(r.systemReceipt))s+=6;
  else if(yes(r.fieldReceipt)&&!yes(r.procedure207))s+=5;
  else if(workflowDone(r,{field:'assetForm',allowNA:true})&&!yes(r.fieldReceipt))s+=4;
  else if(workflowDone(r,{field:'plantingStatus',allowNA:true})&&!workflowDone(r,{field:'assetForm',allowNA:true}))s+=3;
  else if(workflowDone(r,{field:'plantingReview',allowNA:true})&&!workflowDone(r,{field:'plantingStatus',allowNA:true}))s+=3;
  else if(filled(r.engineer)&&!workflowDone(r,{field:'plantingReview',allowNA:true}))s+=3;
  else if(filled(r.executingEntity)&&!filled(r.engineer))s+=3;
  else if(filled(r.testType)&&!filled(r.executingEntity))s+=3;
  else if(filled(r.equipmentNo)&&!filled(r.testType))s+=4;
  else if(filled(r.installDate)&&!filled(r.equipmentNo))s+=4;
 }
 if(actionableNote(r)&&!resolvedOk(r.resolved))s+=4;
 s+=Math.min(4,missingCount(r));
 if(!filled(r.location))s+=1;if(!filled(r.contractor))s+=2;
 return s;
}
function root(){
 let x=document.getElementById('assetsAdvancedAnalytics');if(x)return x;
 const g=document.getElementById('genericPageCharts');if(!g)return null;
 x=document.createElement('section');x.id='assetsAdvancedAnalytics';x.className='assets-analytics';
 g.parentNode.insertBefore(x,g);return x;
}
function destroy(){Object.values(A.charts).forEach(x=>{try{x.destroy()}catch{}});A.charts={}}
function chartBox(id,title,sub,wide=false){
 return `<article class="panel aa-chart ${wide?'aa-wide':''}"><div class="panel-title"><span>${e(sub)}</span><h3>${e(title)}</h3></div><div class="aa-chart-box"><canvas id="${id}"></canvas></div></article>`;
}
function card(label,value,sub='',tone='',help=''){
 return `<article class="aa-card ${tone?'aa-'+tone:''}" title="${e(help||sub||label)}"><i class="aa-info">i</i><span>${e(label)}</span><strong>${typeof value==='number'?fmt(value):e(value)}</strong><small>${e(sub)}</small></article>`;
}
function chartFilter(id,opt,index,label){
 if(!opt)return;
 if(opt.range){
  const scope=S.current||'assets',store=chartFilterStore(scope),r=opt.range[index]||{},cur=store[id];
  const same=cur&&cur.mode==='number-range'&&cur.displayValue===label;
  if(same)delete store[id];else store[id]={field:opt.field,value:'',label:opt.filterLabel||'الفترة',mode:'number-range',displayValue:label,...r};
  renderChartFilterSummary();applyFilters();return;
 }
 if(opt.field&&typeof toggleChartFilter==='function'){
  const value=(opt.values&&opt.values[index]!=null)?opt.values[index]:label;
  toggleChartFilter(id,opt.field,value,opt.filterLabel||opt.field,opt.mode||'exact',label);
 }
}
function applyQualityFilter(f,state){
 if(typeof chartFilterStore!=='function')return;
 const scope=S.current||'assets',store=chartFilterStore(scope);
 const firstFive=['installDate','equipmentNo','testType','executingEntity','engineer'].includes(f.field);
 const noteOnly=f.field==='resolved';
 const mode=state==='complete'?'notblank':'blank';
 const same=store.aaQualityField&&store.aaQualityField.field===f.field&&store.aaQualityField.mode===mode&&state!=='na';
 delete store.aaQualityField;delete store.aaQualityScope;
 if(same){renderChartFilterSummary();applyFilters();return}
 if(state==='na'){
  if(firstFive)store.aaQualityScope={field:'orderFollowStatus',value:'',label:'حالة الأمر',mode:'not-completed',displayValue:'غير منفذ / غير مطلوب'};
  else if(noteOnly)store.aaQualityScope={field:'notes',value:'',label:'ملاحظات الموقع',mode:'blank',displayValue:'لا توجد ملاحظة'};
 }else{
  store.aaQualityField={field:f.field,value:'',label:f.label,mode,displayValue:state==='complete'?'مكتمل':'ناقص'};
  if(firstFive)store.aaQualityScope={field:'orderFollowStatus',value:'تم التنفيذ',label:'حالة الأمر',mode:'exact',displayValue:'تم التنفيذ'};
  else if(noteOnly)store.aaQualityScope={field:'notes',value:'',label:'ملاحظات الموقع',mode:'notblank',displayValue:'توجد ملاحظة'};
 }
 renderChartFilterSummary();applyFilters();
}
function applyExecutedFilter(id,field,value,label,mode='exact',displayValue){
 if(typeof chartFilterStore!=='function')return;
 const scope=S.current||'assets',store=chartFilterStore(scope);
 const valueKey=id+'Value',scopeKey=id+'Scope',normalized=String(value??'').trim();
 const current=store[valueKey];
 const same=current&&current.field===field&&String(current.value??'').trim()===normalized&&(current.mode||'exact')===mode;
 delete store[valueKey];delete store[scopeKey];
 if(!same){
  store[valueKey]={field,value:normalized,label:label||field,mode,displayValue:displayValue||normalized};
  store[scopeKey]={field:'orderFollowStatus',value:'تم التنفيذ',label:'حالة الأمر',mode:'exact',displayValue:'تم التنفيذ'};
 }
 renderChartFilterSummary();applyFilters();
}
function draw(id,type,labels,datasets,opt={}){
 const el=document.getElementById(id);if(!el)return;
 const dark=document.body.classList.contains('vd-report-dark'),ink=dark?'#dbe8f8':'#44546a',grid=dark?'rgba(255,255,255,.08)':'#edf1f6';
 A.charts[id]=new Chart(el,{type,data:{labels,datasets},options:{
  responsive:true,maintainAspectRatio:false,indexAxis:opt.horizontal?'y':'x',cutout:type==='doughnut'?'62%':undefined,
  onClick:(ev,els)=>{if(!els.length)return;if(typeof opt.onClick==='function'){opt.onClick(els[0],labels);return}chartFilter(id,opt,els[0].index,labels[els[0].index])},
  plugins:{legend:{display:opt.legend!==false&&(type==='doughnut'||datasets.length>1),position:'bottom',rtl:true,labels:{color:ink,font:{family:'Cairo',size:9},boxWidth:10,usePointStyle:true}},tooltip:{rtl:true}},
  scales:type==='doughnut'?{}:{x:{stacked:!!opt.stacked,beginAtZero:true,grid:{color:grid,display:!opt.horizontal},ticks:{color:ink,font:{family:'Cairo',size:9}}},y:{stacked:!!opt.stacked,beginAtZero:true,grid:{color:grid,display:false},ticks:{color:ink,font:{family:'Cairo',size:9},autoSkip:false}}}
 }});
}
function stageSummary(rows,active){
 const scope=rows.filter(executionDone);
 if(!scope.length)return'<div class="aa-data-warning"><b>لا توجد أوامر منفذة ضمن الفلتر الحالي</b><span>مسار دورة الأصل يُقاس على الأوامر التي حالتها «تم التنفيذ» فقط، بينما «لا يتطلب» في O/P/Q يُحسب مكتملًا.</span></div>';
 const total=scope.length;
 return `<div class="aa-funnel">${workflowDefs.map((s,i)=>{const d=scope.filter(r=>workflowDone(r,s)).length;return `<div class="aa-funnel-step"><span>${e(s.label)}</span><strong>${fmt(d)}</strong><small>${pct(d,total)}</small></div>${i<workflowDefs.length-1?'<i>←</i>':''}`}).join('')}</div>`;
}
function contractorTable(rows,active){
 const m=new Map();
 rows.forEach(r=>{const k=t(r.contractor)||'غير محدد';if(!m.has(k))m.set(k,[]);m.get(k).push(r)});
 const a=[...m].map(([k,rs])=>{
  const q=qualityStats(rs);
  return {k,rs,avg:avg(rs,'ageDays')||0,executed:rs.filter(executionDone).length,equip:rs.filter(r=>filled(r.equipmentNo)).length,test:rs.filter(r=>filled(r.testType)).length,field:rs.filter(r=>yes(r.fieldReceipt)).length,p207:rs.filter(r=>yes(r.procedure207)).length,system:rs.filter(r=>yes(r.systemReceipt)).length,quality:q.pct};
 }).sort((x,y)=>y.rs.length-x.rs.length);
 return `<div class="aa-table-wrap"><table><thead><tr><th>#</th><th>المقاول</th><th>الأوامر</th><th>تم التنفيذ</th><th>متوسط العمر</th><th>رقم معدة</th><th>نوع اختبار</th><th>استلام ميداني</th><th>إجراء 207</th><th>إجراء 211</th><th>الجودة الشرطية</th></tr></thead><tbody>${a.map((x,i)=>`<tr><td>${i+1}</td><td><b>${e(x.k)}</b></td><td>${fmt(x.rs.length)}</td><td>${fmt(x.executed)}</td><td>${x.avg.toFixed(1)} يوم</td><td>${fmt(x.equip)}</td><td>${fmt(x.test)}</td><td>${fmt(x.field)}</td><td>${fmt(x.p207)}</td><td>${fmt(x.system)}</td><td><b>${x.quality.toFixed(1)}%</b></td></tr>`).join('')}</tbody></table></div>`;
}
function priorityTable(rows,active){
 const a=rows.map(r=>({r,s:priorityScore(r,active),missing:missingCount(r)})).sort((x,y)=>y.s-x.s||y.missing-x.missing||((n(y.r.ageDays)||0)-(n(x.r.ageDays)||0))).slice(0,30);
 if(!a.length)return'<div class="aa-empty">لا توجد بيانات للمتابعة ضمن الفلاتر الحالية.</div>';
 return `<div class="aa-table-wrap"><table><thead><tr><th>الأولوية</th><th>أمر العمل</th><th>حالة الأمر</th><th>المقاول</th><th>رقم المعدة</th><th>نوع الاختبار</th><th>الجهة المنفذة</th><th>المهندس</th><th>المرحلة الحالية</th><th>النواقص المطلوبة</th><th>العمر</th><th>الملاحظات</th></tr></thead><tbody>${a.map(x=>`<tr><td><span class="aa-score ${x.s>=12?'hot':x.s>=7?'warn':''}">${x.s}</span></td><td><b>${e(x.r.workOrder)}</b></td><td>${e(x.r.orderFollowStatus||'—')}</td><td>${e(x.r.contractor)}</td><td>${e(x.r.equipmentNo||'—')}</td><td>${e(x.r.testType||'—')}</td><td>${e(x.r.executingEntity||'—')}</td><td>${e(x.r.engineer||'—')}</td><td>${e(currentStage(x.r,active))}</td><td><b>${fmt(x.missing)}</b></td><td>${e(x.r.ageDays||'—')}</td><td class="aa-note">${e(x.r.notes||'—')}</td></tr>`).join('')}</tbody></table></div>`;
}
function render(rows){
 const x=root();if(!x)return;destroy();
 const total=rows.length,active=processActive(rows);
 const assetMetric=window.VDKpiLogic?.metric?.('assets',rows);
 const executed=rows.filter(executionDone).length,pending=rows.filter(executionPending).length,stopped=rows.filter(executionStopped).length;
 rows.forEach(r=>{r._assetStage=currentStage(r,active)});
 const executedRows=rows.filter(executionDone);
 const installed=executedRows.filter(r=>filled(r.installDate)).length,equipment=executedRows.filter(r=>filled(r.equipmentNo)).length,tests=executedRows.filter(r=>filled(r.testType)).length;
 const executors=executedRows.filter(r=>filled(r.executingEntity)).length,engineers=executedRows.filter(r=>filled(r.engineer)).length;
 const reviewed=executedRows.filter(r=>workflowDone(r,{field:'plantingReview',allowNA:true})).length,reviewNA=executedRows.filter(r=>notApplicable(r.plantingReview)).length;
 const planted=executedRows.filter(r=>workflowDone(r,{field:'plantingStatus',allowNA:true})).length,plantNA=executedRows.filter(r=>notApplicable(r.plantingStatus)).length;
 const forms=executedRows.filter(r=>workflowDone(r,{field:'assetForm',allowNA:true})).length,formNA=executedRows.filter(r=>notApplicable(r.assetForm)).length;
 const field=executedRows.filter(r=>yes(r.fieldReceipt)).length,p207=executedRows.filter(r=>yes(r.procedure207)).length,sys=executedRows.filter(r=>yes(r.systemReceipt)).length;
 const ready211=executedRows.filter(r=>yes(r.procedure207)&&!yes(r.systemReceipt)).length;
 const sequenceErrors=rows.filter(r=>yes(r.procedure207)&&!yes(r.fieldReceipt)).length;
 const ages=rows.map(r=>n(r.ageDays)).filter(v=>v!=null),avgAge=ages.length?ages.reduce((a,b)=>a+b,0)/ages.length:0,maxAge=ages.length?Math.max(...ages):0;
 const ageBands=[['0–30 يوم',0,30],['31–60 يوم',31,60],['61–90 يوم',61,90],['91–120 يوم',91,120],['أكثر من 120 يوم',121,99999]];
 const actionable=rows.filter(actionableNote),openNotes=actionable.filter(r=>!resolvedOk(r.resolved)).length,resolvedField=actionable.filter(r=>filled(r.resolved)).length;
 const q=qualityStats(rows),totalCells=q.applicableCells,filledCells=q.completeCells,missingCells=q.missingCells,quality=q.pct,completeRows=q.completeRows,incompleteRows=q.incompleteRows;
 const worstOld=executedRows.filter(r=>(n(r.ageDays)||0)>60&&!yes(r.systemReceipt)).length;
 const equipmentMap=new Map();rows.forEach(r=>{const k=t(r.equipmentNo);if(k)equipmentMap.set(k,(equipmentMap.get(k)||0)+1)});const duplicateEquipmentIds=[...equipmentMap.values()].filter(v=>v>1).length;
 x.innerHTML=`<section class="aa-hero"><div><span>ASSET CONTROL ROOM • SMART CONDITIONAL QUALITY</span><h2>مركز متابعة الأصول والمعدات</h2><p>المتابعة مرتبطة بحالة الأمر: بيانات التركيب J:N إلزامية عند «تم التنفيذ»، و«لا يتطلب» في O:P:Q حالة مكتملة، وU مطلوب فقط عند وجود ملاحظة في T.</p></div><b>الجودة الشرطية: ${quality.toFixed(1)}% • جاهز لـ211: ${fmt(ready211)}</b></section>
 ${stageSummary(rows,active)}
 <section class="aa-groups">
  <div class="aa-group"><h3>محفظة الأصول والمعدات</h3><div>${card('إجمالي السجلات',total,'السجلات الحالية')}${card('اكتمال مسار الأصول',assetMetric?assetMetric.rate.toFixed(1)+'%':'0.0%','متوسط اكتمال مراحل الأصول من إجمالي السجلات',assetMetric&&assetMetric.rate>=80?'green':assetMetric&&assetMetric.rate>=50?'amber':'red')}${card('الاستلام على النظام',assetMetric&&assetMetric.secondaryRate!=null?assetMetric.secondaryRate.toFixed(1)+'%':'0.0%','إجراء 211 من إجمالي السجلات',assetMetric&&assetMetric.secondaryRate>=80?'green':assetMetric&&assetMetric.secondaryRate>=50?'amber':'red')}${card('المقاولون',unique(rows,'contractor'))}${card('المواقع',unique(rows,'location'))}${card('أرقام معدات فريدة',equipmentMap.size,'كل أرقام المعدات المسجلة')}${card('أرقام معدات مكررة',duplicateEquipmentIds,'عدد أرقام المعدات التي ظهرت بأكثر من سجل',duplicateEquipmentIds?'amber':'green')}</div></div>
  <div class="aa-group"><h3>حالة أمر العمل — العمود I</h3><div>${card('تم التنفيذ',executed,pct(executed,total),executed?'green':'slate','المتطلبات J:N تصبح إلزامية لهذه الفئة')}${card('لم يتم التنفيذ',pending,pct(pending,total),pending?'amber':'slate','لا تُحسب J:N كنواقص قبل التنفيذ')}${card('موقوف / محول',stopped,pct(stopped,total),stopped?'slate':'green','خارج متطلبات التركيب')}${card('أوامر منفذة ناقصة بيانات أصل',executedRows.filter(r=>missingCount(r)>0).length,'بحسب المتطلبات المنطبقة فقط',executedRows.some(r=>missingCount(r)>0)?'red':'green')}${card('أخطاء تسلسل 207',sequenceErrors,'S = تم بينما R ≠ تم',sequenceErrors?'red':'green')}</div></div>
  <div class="aa-group"><h3>التركيب والاختبارات — للأوامر المنفذة</h3><div>${card('تاريخ تركيب مسجل',installed,pct(installed,executed),installed===executed&&executed?'green':'amber','العمود J — مطلوب عند تم التنفيذ')}${card('رقم معدة مسجل',equipment,pct(equipment,executed),equipment===executed&&executed?'green':'amber','العمود K — مطلوب عند تم التنفيذ')}${card('نوع اختبار مسجل',tests,pct(tests,executed),tests===executed&&executed?'green':'amber','العمود L — مطلوب عند تم التنفيذ')}${card('جهة منفذة مسجلة',executors,pct(executors,executed),executors===executed&&executed?'green':'amber','العمود M — مطلوب عند تم التنفيذ')}${card('مهندس تركيب مسجل',engineers,pct(engineers,executed),engineers===executed&&executed?'green':'amber','العمود N — مطلوب عند تم التنفيذ')}</div></div>
  <div class="aa-group"><h3>المراجعة والتنفيذ — للأوامر المنفذة</h3><div>${card('مراجعة الزراعة مكتملة',reviewed,pct(reviewed,executed),reviewed===executed&&executed?'green':'amber','العمود O — يشمل «تمت المراجعة» و«لا يتطلب»؛ لا يتطلب: '+fmt(reviewNA))}${card('حالة الزراعة مكتملة',planted,pct(planted,executed),planted===executed&&executed?'green':'amber','العمود P — يشمل «تمت الزراعة» و«لا يتطلب»؛ لا يتطلب: '+fmt(plantNA))}${card('نموذج الأصول مكتمل',forms,pct(forms,executed),forms===executed&&executed?'green':'amber','العمود Q — يشمل «تم الارفاق» و«لا يتطلب»؛ لا يتطلب: '+fmt(formNA))}${card('تم الاستلام الميداني',field,pct(field,executed),field===executed&&executed?'green':'amber','العمود R')}${card('تم إجراء 207',p207,pct(p207,executed),p207===executed&&executed?'green':'amber','العمود S — لا يجوز أن يسبق الاستلام الميداني')}</div></div>
  <div class="aa-group"><h3>الإغلاق والمتابعة</h3><div>${card('تم إجراء 211 / الاستلام بالنظام',sys,pct(sys,executed),sys?'green':'slate','العمود V')}${card('207 تم و211 لم يتم',ready211,'حالات جاهزة للإغلاق النظامي',ready211?'amber':'green')}${card('بيان تلافي الملاحظة مسجل',resolvedField,actionable.length?pct(resolvedField,actionable.length):'لا توجد ملاحظات',resolvedField===actionable.length?'green':'amber','العمود U — مطلوب فقط عند وجود ملاحظة في T')}${card('ملاحظات فعلية غير متلافاة',openNotes,actionable.length?pct(openNotes,actionable.length):'لا توجد ملاحظات',openNotes?'red':'green')}${card('أقدم من 60 يوم وغير مستلم نظامياً',worstOld,'أوامر منفذة فقط',worstOld?'red':'green')}</div></div>
  <div class="aa-group"><h3>جودة البيانات الشرطية</h3><div>${card('نسبة الجودة الشرطية',quality.toFixed(1)+'%',fmt(filledCells)+' / '+fmt(totalCells)+' متطلب منطبق',quality>=95?'green':quality>=80?'amber':'red','لا تدخل الخانات غير المطلوبة في المقام')}${card('صفوف مكتملة حسب حالتها',completeRows,pct(completeRows,total),completeRows?'green':'slate')}${card('صفوف بها نواقص مطلوبة',incompleteRows,pct(incompleteRows,total),incompleteRows?'amber':'green')}${card('إجمالي النواقص الفعلية',missingCells,'بعد استبعاد الخانات غير المطلوبة',missingCells?'red':'green')}${card('متوسط النواقص لكل سجل',total?(missingCells/total).toFixed(1):'0.0','بحسب المتطلبات المنطبقة')}</div></div>
  <div class="aa-group"><h3>العمر منذ الإسناد</h3><div>${card('متوسط العمر',avgAge.toFixed(1)+' يوم')}${card('أعلى عمر',maxAge+' يوم','أقدم سجل','red')}${card('أكثر من 60 يوم',rows.filter(r=>(n(r.ageDays)||0)>60).length,pct(rows.filter(r=>(n(r.ageDays)||0)>60).length,total),'amber')}${card('أكثر من 90 يوم',rows.filter(r=>(n(r.ageDays)||0)>90).length,pct(rows.filter(r=>(n(r.ageDays)||0)>90).length,total),'red')}${card('مواقع ناقصة',rows.filter(r=>!filled(r.location)).length,'الموقع فارغ',rows.some(r=>!filled(r.location))?'red':'green')}</div></div>
 </section>
 <section class="aa-charts">
  ${chartBox('aaExecutionStatus','حالة أمر العمل','تم التنفيذ / لم يتم التنفيذ / موقوف-محول',true)}
  ${chartBox('aaCompleteness','اكتمال المتطلبات الشرطية','مكتمل / ناقص / غير مطلوب',true)}
  ${chartBox('aaWorkflow','مسار دورة الأصل للأوامر المنفذة','تم / لا يتطلب / لم يتم / غير مدخل',true)}
  ${chartBox('aaTestType','توزيع أنواع الاختبارات','نوع الاختبار',false)}
  ${chartBox('aaExecutingEntity','التوزيع حسب الجهة المنفذة','الجهة المنفذة',false)}
  ${chartBox('aaEquipment','تغطية أرقام المعدات','رقم المعدة',false)}
  ${chartBox('aaContractor','الأصول حسب المقاول','أعلى المقاولين',false)}
  ${chartBox('aaLocation','الأصول حسب الموقع','أعلى المواقع',false)}
  ${chartBox('aaEngineer','التوزيع حسب مهندس التركيب','مهندس التركيب',false)}
  ${chartBox('aaInstallTrend','اتجاه تسجيل التركيب شهرياً','تاريخ تركيب المعدة',false)}
  ${chartBox('aaSystem','حالة الاستلام على النظام','إجراء 211',false)}
  ${chartBox('aaAge','توزيع العمر منذ الإسناد','عدد الأيام',false)}
  ${chartBox('aaCurrentStage','المرحلة الحالية المقدرة','تسلسل دورة الأصل الجديدة',true)}
 </section>
 <section class="aa-tables"><article class="panel"><div class="panel-title"><span>CONTRACTOR ASSET PERFORMANCE</span><h3>أداء المقاولين واكتمال بيانات الأصول</h3></div>${contractorTable(rows,active)}</article><article class="panel"><div class="panel-title"><span>FOLLOW-UP PRIORITY</span><h3>أعلى الحالات أولوية للمتابعة</h3></div>${priorityTable(rows,active)}</article></section>`;
 const executionLabels=['تم التنفيذ','لم يتم التنفيذ','موقوف/محول'];
 draw('aaExecutionStatus','doughnut',executionLabels,[{data:[executed,pending,stopped],backgroundColor:['#16a34a','#f59e0b','#64748b']}],{field:'orderFollowStatus',filterLabel:'حالة الأمر',values:executionLabels});
 const compFields=monitoredFields;
 const compDone=compFields.map(f=>rows.filter(r=>fieldApplicable(r,f)&&filled(r[f.field])).length);
 const compMissing=compFields.map(f=>rows.filter(r=>fieldApplicable(r,f)&&!filled(r[f.field])).length);
 const compNA=compFields.map(f=>rows.filter(r=>!fieldApplicable(r,f)).length);
 draw('aaCompleteness','bar',compFields.map(f=>f.label),[{label:'مكتمل',data:compDone,backgroundColor:'#16a34a'},{label:'ناقص',data:compMissing,backgroundColor:'#dc2626'},{label:'غير مطلوب',data:compNA,backgroundColor:'#cbd5e1'}],{stacked:true,horizontal:true,onClick:(hit)=>{const f=compFields[hit.index];if(!f)return;applyQualityFilter(f,hit.datasetIndex===0?'complete':hit.datasetIndex===1?'missing':'na')}});
 const workflowRows=executedRows;
 const doneVals=workflowDefs.map(s=>workflowRows.filter(r=>s.mode==='filled'?filled(r[s.field]):yes(r[s.field])).length);
 const naVals=workflowDefs.map(s=>s.allowNA?workflowRows.filter(r=>notApplicable(r[s.field])).length:0);
 const pendingVals=workflowDefs.map(s=>s.mode==='filled'?0:workflowRows.filter(r=>no(r[s.field])).length);
 const blankVals=workflowDefs.map(s=>workflowRows.filter(r=>!filled(r[s.field])).length);
 draw('aaWorkflow','bar',workflowDefs.map(s=>s.label),[{label:'تم / مكتمل',data:doneVals,backgroundColor:'#16a34a'},{label:'لا يتطلب',data:naVals,backgroundColor:'#0ea5e9'},{label:'لم يتم',data:pendingVals,backgroundColor:'#f59e0b'},{label:'غير مدخل',data:blankVals,backgroundColor:'#94a3b8'}],{stacked:true,onClick:(hit)=>{const s=workflowDefs[hit.index];if(!s)return;const ds=hit.datasetIndex;if(ds===3)return applyExecutedFilter('aaWorkflow',s.field,'',s.label,'blank','غير مدخل');if(ds===1&&s.allowNA)return applyExecutedFilter('aaWorkflow',s.field,'لا يتطلب',s.label,'exact','لا يتطلب');if(ds===2&&s.mode!=='filled')return applyExecutedFilter('aaWorkflow',s.field,s.pending,s.label,'exact','لم يتم');if(ds===0){if(s.mode==='filled')return applyExecutedFilter('aaWorkflow',s.field,'',s.label,'notblank','مكتمل');return applyExecutedFilter('aaWorkflow',s.field,s.done,s.label,'exact','تم')}}});
 const tt=group(executedRows,'testType').filter(x=>x[0]!=='غير محدد').slice(0,12);draw('aaTestType','doughnut',tt.length?tt.map(x=>x[0]):['لا توجد بيانات'],[{data:tt.length?tt.map(x=>x[1]):[0],backgroundColor:['#2563eb','#7c3aed','#0ea5e9','#14b8a6','#f59e0b','#f97316','#64748b']}],tt.length?{onClick:(hit,labels)=>applyExecutedFilter('aaTestType','testType',labels[hit.index],'نوع الاختبار','exact',labels[hit.index])}:{});
 const ex=group(executedRows,'executingEntity').filter(x=>x[0]!=='غير محدد').slice(0,12);draw('aaExecutingEntity','bar',ex.length?ex.map(x=>x[0]):['لا توجد بيانات'],[{label:'الأوامر',data:ex.length?ex.map(x=>x[1]):[0],backgroundColor:'#0f766e'}],ex.length?{horizontal:true,onClick:(hit,labels)=>applyExecutedFilter('aaExecutingEntity','executingEntity',labels[hit.index],'الجهة المنفذة','exact',labels[hit.index])}:{horizontal:true});
 const equipmentField=monitoredFields.find(f=>f.field==='equipmentNo');draw('aaEquipment','doughnut',['رقم معدة مسجل','رقم معدة ناقص'],[{data:[equipment,Math.max(0,executed-equipment)],backgroundColor:['#16a34a','#cbd5e1']}],{onClick:(hit)=>applyQualityFilter(equipmentField,hit.index===0?'complete':'missing')});
 const cs=group(rows,'contractor').slice(0,12);draw('aaContractor','bar',cs.map(x=>x[0]),[{label:'الأوامر',data:cs.map(x=>x[1]),backgroundColor:'#2563eb'}],{horizontal:true,field:'contractor',filterLabel:'المقاول'});
 const ls=group(rows,'location').slice(0,12);draw('aaLocation','bar',ls.map(x=>x[0]),[{label:'الأوامر',data:ls.map(x=>x[1]),backgroundColor:'#0891b2'}],{horizontal:true,field:'location',filterLabel:'الموقع'});
 const es=group(executedRows,'engineer').filter(x=>x[0]!=='غير محدد').slice(0,12);draw('aaEngineer','bar',es.length?es.map(x=>x[0]):['لا توجد بيانات'],[{label:'الأوامر',data:es.length?es.map(x=>x[1]):[0],backgroundColor:'#7c3aed'}],es.length?{horizontal:true,onClick:(hit,labels)=>applyExecutedFilter('aaEngineer','engineer',labels[hit.index],'مهندس التركيب','exact',labels[hit.index])}:{horizontal:true});
 const months={};executedRows.forEach(r=>{const d=date(r.installDate);if(!d)return;const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');months[k]=(months[k]||0)+1});const ma=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0]));
 draw('aaInstallTrend','line',ma.length?ma.map(x=>x[0]):['لا توجد تواريخ تركيب'],[{label:'تركيبات مسجلة',data:ma.length?ma.map(x=>x[1]):[0],borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,.15)',fill:true,tension:.3}],ma.length?{legend:false,onClick:(hit)=>applyExecutedFilter('aaInstallTrend','installDate',ma[hit.index][0],'شهر التركيب','month',ma[hit.index][0])}:{legend:false});
 const ss=group(executedRows,'systemReceipt');draw('aaSystem','doughnut',ss.map(x=>x[0]),[{data:ss.map(x=>x[1]),backgroundColor:['#16a34a','#f59e0b','#94a3b8','#dc2626']}],{onClick:(hit,labels)=>{const label=labels[hit.index];applyExecutedFilter('aaSystem','systemReceipt',label==='غير محدد'?'':label,'إجراء 211',label==='غير محدد'?'blank':'exact',label)}});
 draw('aaAge','bar',ageBands.map(x=>x[0]),[{label:'الأوامر',data:ageBands.map(x=>rows.filter(r=>{const v=n(r.ageDays);return v!=null&&v>=x[1]&&v<=x[2]}).length),backgroundColor:['#22c55e','#84cc16','#f59e0b','#f97316','#dc2626']}],{field:'ageDays',filterLabel:'العمر منذ الإسناد',range:ageBands.map(x=>({min:x[1],max:x[2]}))});
 const stages=group(rows,'_assetStage');draw('aaCurrentStage','bar',stages.map(x=>x[0]),[{label:'الأوامر',data:stages.map(x=>x[1]),backgroundColor:'#0f766e'}],{horizontal:true,field:'_assetStage',filterLabel:'المرحلة الحالية'});
}
function sync(){
 const x=root();if(!x)return;const on=typeof S!=='undefined'&&S.current==='assets';x.style.display=on?'block':'none';
 const g=document.getElementById('genericPageCharts'),p=document.getElementById('executionPhaseAnalytics');
 if(on){if(g)g.style.display='none';if(p)p.style.display='none';render(Array.isArray(S.filtered)?S.filtered:[])}else destroy();
}
if(typeof renderDataPage==='function'){const base=renderDataPage;renderDataPage=function(){base.apply(this,arguments);sync()}}
})();