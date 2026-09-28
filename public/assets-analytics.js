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
const monitoredFields=[
 {label:'تاريخ تركيب المعدة',field:'installDate',col:'I'},{label:'رقم المعدة',field:'equipmentNo',col:'J'},
 {label:'نوع الاختبار',field:'testType',col:'K'},{label:'الجهة المنفذة',field:'executingEntity',col:'L'},
 {label:'مهندس التركيب',field:'engineer',col:'M'},{label:'مراجعة بيانات الزراعة',field:'plantingReview',col:'N'},
 {label:'حالة الزراعة',field:'plantingStatus',col:'O'},{label:'نموذج الأصول',field:'assetForm',col:'P'},
 {label:'الاستلام الميداني',field:'fieldReceipt',col:'Q'},{label:'إجراء 207',field:'procedure207',col:'R'},
 {label:'هل تم تلافيها',field:'resolved',col:'T'},{label:'استلام النظام 211',field:'systemReceipt',col:'U'}
];
const workflowDefs=[
 {label:'تركيب المعدة',field:'installDate',mode:'filled'},
 {label:'رقم المعدة',field:'equipmentNo',mode:'filled'},
 {label:'نوع الاختبار',field:'testType',mode:'filled'},
 {label:'الجهة المنفذة',field:'executingEntity',mode:'filled'},
 {label:'مهندس التركيب',field:'engineer',mode:'filled'},
 {label:'مراجعة الزراعة',field:'plantingReview',done:'تمت المراجعة',pending:'لم تتم المراجعة'},
 {label:'الزراعة',field:'plantingStatus',done:'تمت الزراعة',pending:'لم يتم الزراعة'},
 {label:'نموذج الأصول',field:'assetForm',done:'تم الارفاق',pending:'لم يتم الارفاق'},
 {label:'الاستلام الميداني',field:'fieldReceipt',done:'تم',pending:'لم يتم'},
 {label:'إجراء 207',field:'procedure207',done:'تم',pending:'لم يتم'},
 {label:'إجراء 211',field:'systemReceipt',done:'تم',pending:'لم يتم'}
];
const actionableNote=r=>filled(r.notes)&&!/لا\s*(يوجد|توجد).*ملاحظ/i.test(t(r.notes));
const resolvedOk=v=>{const s=t(v);return filled(s)&&(!/^لم\s/.test(s))&&(s.includes('تم')||/لا\s*(يوجد|توجد).*ملاحظ/i.test(s))};
const missingCount=r=>monitoredFields.filter(f=>!filled(r[f.field])).length;
const workflowDone=(r,s)=>s.mode==='filled'?filled(r[s.field]):yes(r[s.field]);
function processActive(rows){return rows.some(r=>workflowDefs.some(s=>filled(r[s.field])))}
function currentStage(r,active){
 if(!active)return'بيانات دورة الأصول غير مدخلة';
 if(yes(r.systemReceipt))return'مكتمل — إجراء 211';
 if(yes(r.procedure207))return'بانتظار إجراء 211';
 if(yes(r.fieldReceipt))return'بانتظار إجراء 207';
 if(yes(r.assetForm))return'بانتظار الاستلام الميداني';
 if(yes(r.plantingStatus))return'بانتظار نموذج الأصول';
 if(yes(r.plantingReview))return'بانتظار الزراعة';
 if(filled(r.engineer))return'بانتظار مراجعة الزراعة';
 if(filled(r.executingEntity))return'بانتظار مهندس التركيب';
 if(filled(r.testType))return'بانتظار الجهة المنفذة';
 if(filled(r.equipmentNo))return'بانتظار نوع الاختبار';
 if(filled(r.installDate))return'بانتظار رقم المعدة';
 return'بانتظار تركيب المعدة';
}
function priorityScore(r,active){
 let s=0;const age=n(r.ageDays)||0;
 if(age>120)s+=6;else if(age>90)s+=5;else if(age>60)s+=4;else if(age>30)s+=2;
 if(active){
  if(yes(r.procedure207)&&!yes(r.systemReceipt))s+=6;
  else if(yes(r.fieldReceipt)&&!yes(r.procedure207))s+=5;
  else if(yes(r.assetForm)&&!yes(r.fieldReceipt))s+=4;
  else if(yes(r.plantingStatus)&&!yes(r.assetForm))s+=3;
  else if(yes(r.plantingReview)&&!yes(r.plantingStatus))s+=3;
  else if(filled(r.engineer)&&!yes(r.plantingReview))s+=3;
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
 if(!active)return'<div class="aa-data-warning"><b>بيانات دورة الأصول غير مدخلة بعد</b><span>لم تُرصد بيانات تشغيلية في حقول دورة الأصل الجديدة حتى الآن.</span></div>';
 const total=rows.length;
 return `<div class="aa-funnel">${workflowDefs.map((s,i)=>{const d=rows.filter(r=>workflowDone(r,s)).length;return `<div class="aa-funnel-step"><span>${e(s.label)}</span><strong>${fmt(d)}</strong><small>${pct(d,total)}</small></div>${i<workflowDefs.length-1?'<i>←</i>':''}`}).join('')}</div>`;
}
function contractorTable(rows,active){
 const m=new Map();
 rows.forEach(r=>{const k=t(r.contractor)||'غير محدد';if(!m.has(k))m.set(k,[]);m.get(k).push(r)});
 const a=[...m].map(([k,rs])=>{
  const possible=rs.length*monitoredFields.length,filledCells=monitoredFields.reduce((s,f)=>s+rs.filter(r=>filled(r[f.field])).length,0);
  return {k,rs,avg:avg(rs,'ageDays')||0,equip:rs.filter(r=>filled(r.equipmentNo)).length,test:rs.filter(r=>filled(r.testType)).length,field:rs.filter(r=>yes(r.fieldReceipt)).length,p207:rs.filter(r=>yes(r.procedure207)).length,system:rs.filter(r=>yes(r.systemReceipt)).length,quality:possible?filledCells/possible*100:100};
 }).sort((x,y)=>y.rs.length-x.rs.length);
 return `<div class="aa-table-wrap"><table><thead><tr><th>#</th><th>المقاول</th><th>الأوامر</th><th>متوسط العمر</th><th>رقم معدة</th><th>نوع اختبار</th><th>استلام ميداني</th><th>إجراء 207</th><th>إجراء 211</th><th>اكتمال البيانات</th></tr></thead><tbody>${a.map((x,i)=>`<tr><td>${i+1}</td><td><b>${e(x.k)}</b></td><td>${fmt(x.rs.length)}</td><td>${x.avg.toFixed(1)} يوم</td><td>${fmt(x.equip)}</td><td>${fmt(x.test)}</td><td>${fmt(x.field)}</td><td>${fmt(x.p207)}</td><td>${fmt(x.system)}</td><td><b>${x.quality.toFixed(1)}%</b></td></tr>`).join('')}</tbody></table></div>`;
}
function priorityTable(rows,active){
 const a=rows.map(r=>({r,s:priorityScore(r,active),missing:missingCount(r)})).sort((x,y)=>y.s-x.s||y.missing-x.missing||((n(y.r.ageDays)||0)-(n(x.r.ageDays)||0))).slice(0,30);
 if(!a.length)return'<div class="aa-empty">لا توجد بيانات للمتابعة ضمن الفلاتر الحالية.</div>';
 return `<div class="aa-table-wrap"><table><thead><tr><th>الأولوية</th><th>أمر العمل</th><th>المقاول</th><th>رقم المعدة</th><th>نوع الاختبار</th><th>الجهة المنفذة</th><th>المهندس</th><th>المرحلة الحالية</th><th>نواقص الـ12 عمود</th><th>العمر</th><th>الملاحظات</th></tr></thead><tbody>${a.map(x=>`<tr><td><span class="aa-score ${x.s>=12?'hot':x.s>=7?'warn':''}">${x.s}</span></td><td><b>${e(x.r.workOrder)}</b></td><td>${e(x.r.contractor)}</td><td>${e(x.r.equipmentNo||'—')}</td><td>${e(x.r.testType||'—')}</td><td>${e(x.r.executingEntity||'—')}</td><td>${e(x.r.engineer||'—')}</td><td>${e(currentStage(x.r,active))}</td><td><b>${fmt(x.missing)}</b></td><td>${e(x.r.ageDays||'—')}</td><td class="aa-note">${e(x.r.notes||'—')}</td></tr>`).join('')}</tbody></table></div>`;
}
function render(rows){
 const x=root();if(!x)return;destroy();
 const total=rows.length,active=processActive(rows);
 rows.forEach(r=>{r._assetStage=currentStage(r,active)});
 const installed=rows.filter(r=>filled(r.installDate)).length,equipment=rows.filter(r=>filled(r.equipmentNo)).length,tests=rows.filter(r=>filled(r.testType)).length;
 const executors=rows.filter(r=>filled(r.executingEntity)).length,engineers=rows.filter(r=>filled(r.engineer)).length;
 const reviewed=rows.filter(r=>yes(r.plantingReview)).length,planted=rows.filter(r=>yes(r.plantingStatus)).length,forms=rows.filter(r=>yes(r.assetForm)).length;
 const field=rows.filter(r=>yes(r.fieldReceipt)).length,p207=rows.filter(r=>yes(r.procedure207)).length,sys=rows.filter(r=>yes(r.systemReceipt)).length;
 const ready211=rows.filter(r=>yes(r.procedure207)&&!yes(r.systemReceipt)).length;
 const ages=rows.map(r=>n(r.ageDays)).filter(v=>v!=null),avgAge=ages.length?ages.reduce((a,b)=>a+b,0)/ages.length:0,maxAge=ages.length?Math.max(...ages):0;
 const ageBands=[['0–30 يوم',0,30],['31–60 يوم',31,60],['61–90 يوم',61,90],['91–120 يوم',91,120],['أكثر من 120 يوم',121,99999]];
 const actionable=rows.filter(actionableNote),openNotes=actionable.filter(r=>!resolvedOk(r.resolved)).length,resolvedField=rows.filter(r=>filled(r.resolved)).length;
 const totalCells=total*monitoredFields.length,filledCells=monitoredFields.reduce((s,f)=>s+rows.filter(r=>filled(r[f.field])).length,0),missingCells=Math.max(0,totalCells-filledCells);
 const quality=totalCells?filledCells/totalCells*100:100,completeRows=rows.filter(r=>missingCount(r)===0).length,incompleteRows=total-completeRows;
 const worstOld=rows.filter(r=>(n(r.ageDays)||0)>60&&!yes(r.systemReceipt)).length;
 const equipmentMap=new Map();rows.forEach(r=>{const k=t(r.equipmentNo);if(k)equipmentMap.set(k,(equipmentMap.get(k)||0)+1)});const duplicateEquipmentIds=[...equipmentMap.values()].filter(v=>v>1).length;
 x.innerHTML=`<section class="aa-hero"><div><span>ASSET CONTROL ROOM • NEW DATA MODEL</span><h2>مركز متابعة الأصول والمعدات</h2><p>تحليل مباشر للبيانات الجديدة: التركيب، رقم المعدة، نوع الاختبار، الجهة المنفذة، مهندس التركيب، دورة الزراعة، الاستلام الميداني، إجراء 207، وتوثيق الاستلام على النظام بإجراء 211.</p></div><b>جودة الـ12 عمود: ${quality.toFixed(1)}% • جاهز لـ211: ${fmt(ready211)}</b></section>
 ${stageSummary(rows,active)}
 <section class="aa-groups">
  <div class="aa-group"><h3>محفظة الأصول والمعدات</h3><div>${card('إجمالي أوامر الأصول',total,'السجلات الحالية')}${card('المقاولون',unique(rows,'contractor'))}${card('المواقع',unique(rows,'location'))}${card('أرقام معدات فريدة',equipmentMap.size,pct(equipment,total),equipment?'green':'amber')}${card('أرقام معدات مكررة',duplicateEquipmentIds,'عدد أرقام المعدات التي ظهرت بأكثر من سجل',duplicateEquipmentIds?'amber':'green')}</div></div>
  <div class="aa-group"><h3>التركيب والاختبارات</h3><div>${card('تاريخ تركيب مسجل',installed,pct(installed,total),installed?'green':'amber','العمود I')}${card('رقم معدة مسجل',equipment,pct(equipment,total),equipment?'green':'amber','العمود J')}${card('نوع اختبار مسجل',tests,pct(tests,total),tests?'green':'amber','العمود K')}${card('جهة منفذة مسجلة',executors,pct(executors,total),executors?'green':'amber','العمود L')}${card('مهندس تركيب مسجل',engineers,pct(engineers,total),engineers?'green':'amber','العمود M')}</div></div>
  <div class="aa-group"><h3>المراجعة والتنفيذ</h3><div>${card('تمت مراجعة بيانات الزراعة',reviewed,pct(reviewed,total),reviewed?'green':'slate','العمود N')}${card('تمت الزراعة',planted,pct(planted,total),planted?'green':'slate','العمود O')}${card('نموذج الأصول مرفق',forms,pct(forms,total),forms?'green':'slate','العمود P')}${card('تم الاستلام الميداني',field,pct(field,total),field?'green':'slate','العمود Q')}${card('تم إجراء 207',p207,pct(p207,total),p207?'green':'slate','العمود R')}</div></div>
  <div class="aa-group"><h3>الإغلاق والمتابعة</h3><div>${card('تم إجراء 211 / الاستلام بالنظام',sys,pct(sys,total),sys?'green':'slate','العمود U')}${card('207 تم و211 لم يتم',ready211,'حالات جاهزة للإغلاق النظامي',ready211?'amber':'green')}${card('حقل هل تم تلافيها مسجل',resolvedField,pct(resolvedField,total),resolvedField?'green':'amber','العمود T')}${card('ملاحظات فعلية غير متلافاة',openNotes,actionable.length?pct(openNotes,actionable.length):'لا توجد ملاحظات',openNotes?'red':'green')}${card('أقدم من 60 يوم وغير مستلم نظامياً',worstOld,'بحسب عدد الأيام منذ الإسناد',worstOld?'red':'green')}</div></div>
  <div class="aa-group"><h3>جودة البيانات — الأعمدة الـ12</h3><div>${card('نسبة الاكتمال',quality.toFixed(1)+'%',fmt(filledCells)+' / '+fmt(totalCells)+' خلية',quality>=95?'green':quality>=80?'amber':'red')}${card('صفوف مكتملة بالكامل',completeRows,pct(completeRows,total),completeRows?'green':'slate')}${card('صفوف بها نواقص',incompleteRows,pct(incompleteRows,total),incompleteRows?'amber':'green')}${card('إجمالي الخلايا الناقصة',missingCells,'ضمن الأعمدة المطلوبة فقط',missingCells?'red':'green')}${card('متوسط النواقص لكل صف',total?(missingCells/total).toFixed(1):'0.0','من أصل 12 عمود')}</div></div>
  <div class="aa-group"><h3>العمر منذ الإسناد</h3><div>${card('متوسط العمر',avgAge.toFixed(1)+' يوم')}${card('أعلى عمر',maxAge+' يوم','أقدم سجل','red')}${card('أكثر من 60 يوم',rows.filter(r=>(n(r.ageDays)||0)>60).length,pct(rows.filter(r=>(n(r.ageDays)||0)>60).length,total),'amber')}${card('أكثر من 90 يوم',rows.filter(r=>(n(r.ageDays)||0)>90).length,pct(rows.filter(r=>(n(r.ageDays)||0)>90).length,total),'red')}${card('مواقع ناقصة',rows.filter(r=>!filled(r.location)).length,'الموقع فارغ',rows.some(r=>!filled(r.location))?'red':'green')}</div></div>
 </section>
 <section class="aa-charts">
  ${chartBox('aaCompleteness','اكتمال الأعمدة الـ12 الجديدة','مكتمل / ناقص — اضغط للتصفية',true)}
  ${chartBox('aaWorkflow','مسار دورة الأصل','مكتمل / لم يتم / غير مدخل',true)}
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
 const compFields=monitoredFields.map(f=>[f.label,f.field]);
 draw('aaCompleteness','bar',compFields.map(x=>x[0]),[{label:'مكتمل',data:compFields.map(x=>rows.filter(r=>filled(r[x[1]])).length),backgroundColor:'#16a34a'},{label:'ناقص',data:compFields.map(x=>total-rows.filter(r=>filled(r[x[1]])).length),backgroundColor:'#cbd5e1'}],{stacked:true,horizontal:true,onClick:(hit)=>{const f=compFields[hit.index];if(!f)return;toggleChartFilter('aaCompleteness',f[1],'',f[0],hit.datasetIndex===0?'notblank':'blank',hit.datasetIndex===0?'مكتمل':'ناقص')}});
 const doneVals=workflowDefs.map(s=>rows.filter(r=>workflowDone(r,s)).length),pendingVals=workflowDefs.map(s=>s.mode==='filled'?0:rows.filter(r=>no(r[s.field])).length),blankVals=workflowDefs.map(s=>rows.filter(r=>!filled(r[s.field])).length);
 draw('aaWorkflow','bar',workflowDefs.map(s=>s.label),[{label:'مكتمل / تم',data:doneVals,backgroundColor:'#16a34a'},{label:'لم يتم',data:pendingVals,backgroundColor:'#f59e0b'},{label:'غير مدخل',data:blankVals,backgroundColor:'#94a3b8'}],{stacked:true,onClick:(hit)=>{const s=workflowDefs[hit.index];if(!s)return;const ds=hit.datasetIndex;if(ds===2)return toggleChartFilter('aaWorkflow',s.field,'',s.label,'blank','غير مدخل');if(s.mode==='filled'){if(ds===0)return toggleChartFilter('aaWorkflow',s.field,'',s.label,'notblank','مكتمل');return}toggleChartFilter('aaWorkflow',s.field,ds===0?s.done:s.pending,s.label,'exact',ds===0?'تم':'لم يتم')}});
 const tt=group(rows,'testType').filter(x=>x[0]!=='غير محدد').slice(0,12);draw('aaTestType','doughnut',tt.length?tt.map(x=>x[0]):['لا توجد بيانات'],[{data:tt.length?tt.map(x=>x[1]):[0],backgroundColor:['#2563eb','#7c3aed','#0ea5e9','#14b8a6','#f59e0b','#f97316','#64748b']}],tt.length?{field:'testType',filterLabel:'نوع الاختبار'}:{});
 const ex=group(rows,'executingEntity').filter(x=>x[0]!=='غير محدد').slice(0,12);draw('aaExecutingEntity','bar',ex.length?ex.map(x=>x[0]):['لا توجد بيانات'],[{label:'الأوامر',data:ex.length?ex.map(x=>x[1]):[0],backgroundColor:'#0f766e'}],ex.length?{horizontal:true,field:'executingEntity',filterLabel:'الجهة المنفذة'}:{horizontal:true});
 draw('aaEquipment','doughnut',['رقم معدة مسجل','رقم معدة ناقص'],[{data:[equipment,total-equipment],backgroundColor:['#16a34a','#cbd5e1']}],{onClick:(hit)=>toggleChartFilter('aaEquipment','equipmentNo','','رقم المعدة',hit.index===0?'notblank':'blank',hit.index===0?'مسجل':'ناقص')});
 const cs=group(rows,'contractor').slice(0,12);draw('aaContractor','bar',cs.map(x=>x[0]),[{label:'الأوامر',data:cs.map(x=>x[1]),backgroundColor:'#2563eb'}],{horizontal:true,field:'contractor',filterLabel:'المقاول'});
 const ls=group(rows,'location').slice(0,12);draw('aaLocation','bar',ls.map(x=>x[0]),[{label:'الأوامر',data:ls.map(x=>x[1]),backgroundColor:'#0891b2'}],{horizontal:true,field:'location',filterLabel:'الموقع'});
 const es=group(rows,'engineer').filter(x=>x[0]!=='غير محدد').slice(0,12);draw('aaEngineer','bar',es.length?es.map(x=>x[0]):['لا توجد بيانات'],[{label:'الأوامر',data:es.length?es.map(x=>x[1]):[0],backgroundColor:'#7c3aed'}],es.length?{horizontal:true,field:'engineer',filterLabel:'مهندس التركيب'}:{horizontal:true});
 const months={};rows.forEach(r=>{const d=date(r.installDate);if(!d)return;const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');months[k]=(months[k]||0)+1});const ma=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0]));
 draw('aaInstallTrend','line',ma.length?ma.map(x=>x[0]):['لا توجد تواريخ تركيب'],[{label:'تركيبات مسجلة',data:ma.length?ma.map(x=>x[1]):[0],borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,.15)',fill:true,tension:.3}],ma.length?{legend:false,field:'installDate',filterLabel:'شهر التركيب',mode:'month',values:ma.map(x=>x[0])}:{legend:false});
 const ss=group(rows,'systemReceipt');draw('aaSystem','doughnut',ss.map(x=>x[0]),[{data:ss.map(x=>x[1]),backgroundColor:['#16a34a','#f59e0b','#94a3b8','#dc2626']}],{onClick:(hit,labels)=>{const label=labels[hit.index];toggleChartFilter('aaSystem','systemReceipt',label==='غير محدد'?'':label,'إجراء 211',label==='غير محدد'?'blank':'exact',label)}});
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