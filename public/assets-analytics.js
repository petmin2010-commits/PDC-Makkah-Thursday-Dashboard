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
const stageDefs=[
 {label:'مراجعة الزراعة',field:'plantingReview',done:'تمت المراجعة',pending:'لم تتم المراجعة'},
 {label:'الزراعة',field:'plantingStatus',done:'تمت الزراعة',pending:'لم يتم الزراعة'},
 {label:'نموذج الأصول',field:'assetForm',done:'تم الارفاق',pending:'لم يتم الارفاق'},
 {label:'إجراء 207',field:'procedure207',done:'تم',pending:'لم يتم'},
 {label:'الاستلام الميداني',field:'fieldReceipt',done:'تم',pending:'لم يتم'},
 {label:'استلام النظام',field:'systemReceipt',done:'تم',pending:'لم يتم'}
];
function processActive(rows){return rows.some(r=>stageDefs.some(s=>filled(r[s.field])))}
function currentStage(r,active){
 if(!active)return'بيانات دورة الأصول غير مدخلة';
 if(yes(r.systemReceipt))return'مستلم على النظام';
 if(yes(r.fieldReceipt))return'بانتظار استلام النظام';
 if(yes(r.procedure207))return'بانتظار الاستلام الميداني';
 if(yes(r.assetForm))return'بانتظار إجراء 207';
 if(yes(r.plantingStatus))return'بانتظار نموذج الأصول';
 if(yes(r.plantingReview))return'بانتظار الزراعة';
 if(filled(r.installDate))return'بانتظار مراجعة الزراعة';
 return'بانتظار تركيب المعدة';
}
function priorityScore(r,active){
 let s=0;const age=n(r.ageDays)||0;
 if(age>120)s+=6;else if(age>90)s+=5;else if(age>60)s+=4;else if(age>30)s+=2;
 if(active){
  if(yes(r.fieldReceipt)&&!yes(r.systemReceipt))s+=5;
  else if(yes(r.procedure207)&&!yes(r.fieldReceipt))s+=4;
  else if(yes(r.assetForm)&&!yes(r.procedure207))s+=3;
  else if(yes(r.plantingStatus)&&!yes(r.assetForm))s+=2;
  else if(yes(r.plantingReview)&&!yes(r.plantingStatus))s+=2;
  else if(filled(r.installDate)&&!yes(r.plantingReview))s+=2;
  if(!yes(r.systemReceipt))s+=2;
 }
 if(filled(r.notes)&&!yes(r.resolved))s+=3;
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
function card(label,value,sub='',tone=''){
 return `<article class="aa-card ${tone?'aa-'+tone:''}"><span>${e(label)}</span><strong>${typeof value==='number'?fmt(value):e(value)}</strong><small>${e(sub)}</small></article>`;
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
 if(!active)return'<div class="aa-data-warning"><b>بيانات دورة الأصول غير مدخلة بعد</b><span>توجد بيانات أوامر العمل والمقاولين والمواقع والأعمار، بينما حقول التركيب والزراعة و207 والاستلام لا تحتوي بيانات تشغيلية حالياً.</span></div>';
 const total=rows.length;
 return `<div class="aa-funnel">${stageDefs.map((s,i)=>{const d=rows.filter(r=>yes(r[s.field])).length;return `<div class="aa-funnel-step"><span>${e(s.label)}</span><strong>${fmt(d)}</strong><small>${pct(d,total)}</small></div>${i<stageDefs.length-1?'<i>←</i>':''}`}).join('')}</div>`;
}
function contractorTable(rows,active){
 const m=new Map();
 rows.forEach(r=>{const k=t(r.contractor)||'غير محدد';if(!m.has(k))m.set(k,[]);m.get(k).push(r)});
 const a=[...m].map(([k,rs])=>({k,rs,avg:avg(rs,'ageDays')||0,old:rs.filter(r=>(n(r.ageDays)||0)>60).length,inst:rs.filter(r=>filled(r.installDate)).length,field:rs.filter(r=>yes(r.fieldReceipt)).length,system:rs.filter(r=>yes(r.systemReceipt)).length})).sort((x,y)=>y.rs.length-x.rs.length);
 return `<div class="aa-table-wrap"><table><thead><tr><th>#</th><th>المقاول</th><th>الأوامر</th><th>متوسط العمر</th><th>أكثر من 60 يوم</th><th>تركيب مسجل</th>${active?'<th>استلام ميداني</th><th>استلام النظام</th><th>الرصيد غير المستلم</th>':''}</tr></thead><tbody>${a.map((x,i)=>`<tr><td>${i+1}</td><td><b>${e(x.k)}</b></td><td>${fmt(x.rs.length)}</td><td>${x.avg.toFixed(1)} يوم</td><td>${fmt(x.old)}</td><td>${fmt(x.inst)}</td>${active?`<td>${fmt(x.field)}</td><td>${fmt(x.system)}</td><td><b>${fmt(x.rs.length-x.system)}</b></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function priorityTable(rows,active){
 const a=rows.map(r=>({r,s:priorityScore(r,active)})).sort((x,y)=>y.s-x.s||((n(y.r.ageDays)||0)-(n(x.r.ageDays)||0))).slice(0,30);
 if(!a.length)return'<div class="aa-empty">لا توجد بيانات للمتابعة ضمن الفلاتر الحالية.</div>';
 return `<div class="aa-table-wrap"><table><thead><tr><th>الأولوية</th><th>أمر العمل</th><th>المقاول</th><th>الموقع</th><th>العمر</th><th>المرحلة الحالية</th><th>تاريخ التركيب</th><th>المهندس</th><th>الملاحظات</th></tr></thead><tbody>${a.map(x=>`<tr><td><span class="aa-score ${x.s>=9?'hot':x.s>=6?'warn':''}">${x.s}</span></td><td><b>${e(x.r.workOrder)}</b></td><td>${e(x.r.contractor)}</td><td>${e(x.r.location)}</td><td>${e(x.r.ageDays||'—')}</td><td>${e(currentStage(x.r,active))}</td><td>${e(x.r.installDate||'—')}</td><td>${e(x.r.engineer||'—')}</td><td class="aa-note">${e(x.r.notes||'—')}</td></tr>`).join('')}</tbody></table></div>`;
}
function render(rows){
 const x=root();if(!x)return;destroy();
 const total=rows.length,active=processActive(rows),installed=rows.filter(r=>filled(r.installDate)).length,engineers=rows.filter(r=>filled(r.engineer)).length;
 rows.forEach(r=>{r._assetStage=currentStage(r,active)});
 const ages=rows.map(r=>n(r.ageDays)).filter(v=>v!=null),avgAge=ages.length?ages.reduce((a,b)=>a+b,0)/ages.length:0,maxAge=ages.length?Math.max(...ages):0;
 const ageBands=[['0–30 يوم',0,30],['31–60 يوم',31,60],['61–90 يوم',61,90],['91–120 يوم',91,120],['أكثر من 120 يوم',121,99999]];
 const notes=rows.filter(r=>filled(r.notes)).length,unresolved=rows.filter(r=>filled(r.notes)&&!yes(r.resolved)).length,resolved=rows.filter(r=>yes(r.resolved)).length;
 const sys=rows.filter(r=>yes(r.systemReceipt)).length,field=rows.filter(r=>yes(r.fieldReceipt)).length,readySystem=rows.filter(r=>yes(r.fieldReceipt)&&!yes(r.systemReceipt)).length;
 const processFilled=stageDefs.reduce((sum,s)=>sum+rows.filter(r=>filled(r[s.field])).length,0),processPossible=total*stageDefs.length;
 const coverage=processPossible?processFilled/processPossible:0;
 const worstOld=rows.filter(r=>(n(r.ageDays)||0)>60&&!yes(r.systemReceipt)).length;
 x.innerHTML=`<section class="aa-hero"><div><span>ASSET CONTROL ROOM</span><h2>التحليل التنفيذي للأصول</h2><p>قراءة مباشرة لمسار الأصل من أمر العمل والعمر منذ الإسناد وحتى الاستلام الميداني واستلام الأصول على النظام.</p></div><b>${active?(readySystem?fmt(readySystem)+' جاهز/قريب من استلام النظام':fmt(sys)+' مستلم على النظام'):'اكتمال بيانات دورة الأصول: '+(coverage*100).toFixed(0)+'%'}</b></section>
 ${stageSummary(rows,active)}
 <section class="aa-groups">
  <div class="aa-group"><h3>حجم محفظة الأصول</h3><div>${card('إجمالي أوامر الأصول',total)}${card('المقاولون',unique(rows,'contractor'))}${card('المواقع',unique(rows,'location'))}${card('أنواع أوامر العمل',unique(rows,'type'))}${card('رموز أوامر العمل',unique(rows,'workOrderCode'))}</div></div>
  <div class="aa-group"><h3>العمر منذ الإسناد</h3><div>${card('متوسط العمر',avgAge.toFixed(1)+' يوم')}${card('أعلى عمر',maxAge+' يوم','أقدم سجل','red')}${card('أكثر من 60 يوم',rows.filter(r=>(n(r.ageDays)||0)>60).length,pct(rows.filter(r=>(n(r.ageDays)||0)>60).length,total),'amber')}${card('أكثر من 90 يوم',rows.filter(r=>(n(r.ageDays)||0)>90).length,pct(rows.filter(r=>(n(r.ageDays)||0)>90).length,total),'red')}${card('قديم وغير مستلم نظامياً',active?worstOld:'—',active?'العمر >60 ولم يستلم على النظام':'بانتظار إدخال دورة الأصول',active?'red':'slate')}</div></div>
  <div class="aa-group"><h3>التركيب والتغطية</h3><div>${card('تاريخ تركيب مسجل',installed,pct(installed,total),installed?'green':'amber')}${card('مهندس تركيب مسجل',engineers,pct(engineers,total),engineers?'green':'amber')}${card('بيانات دورة الأصول',active?(coverage*100).toFixed(1)+'%':'0.0%','اكتمال حقول المراحل',active?'green':'red')}${card('سجلات بها ملاحظات',notes,pct(notes,total),notes?'amber':'')}${card('ملاحظات غير معلّم تلافيها',unresolved,notes?pct(unresolved,notes):'—',unresolved?'red':'green')}</div></div>
  <div class="aa-group"><h3>مراحل دورة الأصول</h3><div>${stageDefs.map(s=>card(s.label,active?rows.filter(r=>yes(r[s.field])).length:'—',active?pct(rows.filter(r=>yes(r[s.field])).length,total):'لا توجد بيانات',active&&rows.filter(r=>yes(r[s.field])).length?'green':'slate')).join('')}</div></div>
  <div class="aa-group"><h3>الاستلام والمتابعة</h3><div>${card('الاستلام الميداني',active?field:'—',active?pct(field,total):'لا توجد بيانات',field?'green':'slate')}${card('استلام الأصول على النظام',active?sys:'—',active?pct(sys,total):'لا توجد بيانات',sys?'green':'slate')}${card('مستلم ميدانياً ولم يستلم بالنظام',active?readySystem:'—',active?'فرصة إغلاق مباشرة':'لا توجد بيانات',readySystem?'amber':'slate')}${card('تم تلافي الملاحظات',resolved,notes?pct(resolved,notes):'—',resolved?'green':'slate')}${card('بيانات موقع ناقصة',rows.filter(r=>!filled(r.location)).length,'الموقع فارغ',rows.some(r=>!filled(r.location))?'red':'green')}</div></div>
 </section>
 <section class="aa-charts">
  ${chartBox('aaStages','مصفوفة مراحل دورة الأصول','تم / لم يتم / غير مدخل',true)}
  ${chartBox('aaAge','توزيع العمر منذ الإسناد','عدد الأيام',false)}
  ${chartBox('aaContractor','الأصول حسب المقاول','أعلى المقاولين',false)}
  ${chartBox('aaLocation','الأصول حسب الموقع','أعلى المواقع',false)}
  ${chartBox('aaType','أنواع أوامر العمل','نوع أمر العمل',false)}
  ${chartBox('aaCode','رموز أوامر العمل','رمز أمر العمل',false)}
  ${chartBox('aaEngineer','التوزيع حسب مهندس التركيب','مهندس التركيب',false)}
  ${chartBox('aaInstallTrend','اتجاه تسجيل التركيب شهرياً','تاريخ تركيب المعدة',false)}
  ${chartBox('aaSystem','حالة الاستلام على النظام','استلام الأصول على النظام',false)}
  ${chartBox('aaCurrentStage','المرحلة الحالية المقدرة','تسلسل دورة الأصول',true)}
  ${chartBox('aaCompleteness','اكتمال البيانات التشغيلية','جودة بيانات الأصول',true)}
 </section>
 <section class="aa-tables"><article class="panel"><div class="panel-title"><span>CONTRACTOR PERFORMANCE</span><h3>أداء المقاولين في محفظة الأصول</h3></div>${contractorTable(rows,active)}</article><article class="panel"><div class="panel-title"><span>FOLLOW-UP PRIORITY</span><h3>أعلى الحالات أولوية للمتابعة</h3></div>${priorityTable(rows,active)}</article></section>`;
 const doneVals=stageDefs.map(s=>rows.filter(r=>yes(r[s.field])).length),pendingVals=stageDefs.map(s=>rows.filter(r=>no(r[s.field])).length),blankVals=stageDefs.map(s=>rows.filter(r=>!filled(r[s.field])).length);
 draw('aaStages','bar',stageDefs.map(s=>s.label),[{label:'تم',data:doneVals,backgroundColor:'#16a34a'},{label:'لم يتم',data:pendingVals,backgroundColor:'#f59e0b'},{label:'غير مدخل',data:blankVals,backgroundColor:'#94a3b8'}],{stacked:true,onClick:(hit)=>{const s=stageDefs[hit.index];if(!s)return;const ds=hit.datasetIndex;if(ds===2)toggleChartFilter('aaStages',s.field,'',s.label,'blank','غير مدخل');else toggleChartFilter('aaStages',s.field,ds===0?s.done:s.pending,s.label,'exact',ds===0?'تم':'لم يتم')}});
 draw('aaAge','bar',ageBands.map(x=>x[0]),[{label:'الأوامر',data:ageBands.map(x=>rows.filter(r=>{const v=n(r.ageDays);return v!=null&&v>=x[1]&&v<=x[2]}).length),backgroundColor:['#22c55e','#84cc16','#f59e0b','#f97316','#dc2626']}],{field:'ageDays',filterLabel:'العمر منذ الإسناد',range:ageBands.map(x=>({min:x[1],max:x[2]}))});
 const cs=group(rows,'contractor').slice(0,12);draw('aaContractor','bar',cs.map(x=>x[0]),[{label:'الأوامر',data:cs.map(x=>x[1]),backgroundColor:'#2563eb'}],{horizontal:true,field:'contractor',filterLabel:'المقاول'});
 const ls=group(rows,'location').slice(0,12);draw('aaLocation','bar',ls.map(x=>x[0]),[{label:'الأوامر',data:ls.map(x=>x[1]),backgroundColor:'#0891b2'}],{horizontal:true,field:'location',filterLabel:'الموقع'});
 const ts=group(rows,'type');draw('aaType','doughnut',ts.map(x=>x[0]),[{data:ts.map(x=>x[1]),backgroundColor:['#2563eb','#7c3aed','#0ea5e9','#14b8a6','#f59e0b','#f97316','#64748b']}],{field:'type',filterLabel:'نوع أمر العمل'});
 const codes=group(rows,'workOrderCode');draw('aaCode','doughnut',codes.map(x=>x[0]),[{data:codes.map(x=>x[1]),backgroundColor:['#16a34a','#2563eb','#f59e0b','#8b5cf6']}],{field:'workOrderCode',filterLabel:'رمز أمر العمل'});
 const es=group(rows,'engineer').filter(x=>x[0]!=='غير محدد').slice(0,12);draw('aaEngineer','bar',es.length?es.map(x=>x[0]):['لا توجد بيانات'],[{label:'الأوامر',data:es.length?es.map(x=>x[1]):[0],backgroundColor:'#7c3aed'}],es.length?{horizontal:true,field:'engineer',filterLabel:'مهندس التركيب'}:{horizontal:true});
 const months={};rows.forEach(r=>{const d=date(r.installDate);if(!d)return;const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');months[k]=(months[k]||0)+1});const ma=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0]));
 draw('aaInstallTrend','line',ma.length?ma.map(x=>x[0]):['لا توجد تواريخ تركيب'],[{label:'تركيبات مسجلة',data:ma.length?ma.map(x=>x[1]):[0],borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,.15)',fill:true,tension:.3}],ma.length?{legend:false,field:'installDate',filterLabel:'شهر التركيب',mode:'month',values:ma.map(x=>x[0])}:{legend:false});
 const ss=active?group(rows,'systemReceipt'):[['غير مدخل',total]];draw('aaSystem','doughnut',ss.map(x=>x[0]),[{data:ss.map(x=>x[1]),backgroundColor:['#16a34a','#f59e0b','#94a3b8','#dc2626']}],active?{field:'systemReceipt',filterLabel:'استلام الأصول على النظام'}:{});
 const stages=group(rows,'_assetStage');draw('aaCurrentStage','bar',stages.map(x=>x[0]),[{label:'الأوامر',data:stages.map(x=>x[1]),backgroundColor:'#0f766e'}],{horizontal:true,field:'_assetStage',filterLabel:'المرحلة الحالية'});
 const compFields=[['أمر العمل','workOrder'],['المقاول','contractor'],['الموقع','location'],['العمر','ageDays'],['تاريخ التركيب','installDate'],['مهندس التركيب','engineer'],...stageDefs.map(s=>[s.label,s.field])];
 draw('aaCompleteness','bar',compFields.map(x=>x[0]),[{label:'مكتمل',data:compFields.map(x=>rows.filter(r=>filled(r[x[1]])).length),backgroundColor:'#16a34a'},{label:'ناقص',data:compFields.map(x=>total-rows.filter(r=>filled(r[x[1]])).length),backgroundColor:'#cbd5e1'}],{stacked:true,horizontal:true,onClick:(hit)=>{const f=compFields[hit.index];if(!f)return;toggleChartFilter('aaCompleteness',f[1],'',f[0],hit.datasetIndex===0?'notblank':'blank',hit.datasetIndex===0?'مكتمل':'ناقص')}});
}
function sync(){
 const x=root();if(!x)return;const on=typeof S!=='undefined'&&S.current==='assets';x.style.display=on?'block':'none';
 const g=document.getElementById('genericPageCharts'),p=document.getElementById('executionPhaseAnalytics');
 if(on){if(g)g.style.display='none';if(p)p.style.display='none';render(Array.isArray(S.filtered)?S.filtered:[])}else destroy();
}
if(typeof renderDataPage==='function'){const base=renderDataPage;renderDataPage=function(){base.apply(this,arguments);sync()}}
})();