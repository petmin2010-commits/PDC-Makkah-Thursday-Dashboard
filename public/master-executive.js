(function(){
'use strict';
const M={charts:{}};
const t=v=>String(v??'').replace(/\s+/g,' ').trim();
const e=v=>t(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>{const x=parseFloat(t(v).replace(/,/g,''));return Number.isFinite(x)?x:0};
const pct=(a,b)=>b?((a/b)*100).toFixed(1)+'%':'—';
const yes=v=>['نعم','yes','true','1','تم'].includes(t(v).toLowerCase());
const status=z=>{const s=t(z.status);return s.includes('موقوف')||s.includes('محول')?'موقوف/محول':s==='تم التنفيذ'?'تم التنفيذ':'لم يتم التنفيذ'};
function delayBucket(z){
 const s=t(z.delay);
 if(s.includes('تم التنفيذ'))return'تم التنفيذ';
 if(s.includes('موقوف')||s.includes('محول'))return'موقوف/محول';
 if(s.includes('ضمن المدة'))return'ضمن المدة';
 if(s.includes('أوشكت'))return'أوشكت المدة';
 if(s.includes('بسيط'))return'تأخير بسيط';
 if(s.includes('متوسط'))return'تأخير متوسط';
 if(s.includes('شديد')||s.includes('عالي'))return'تأخير شديد';
 return s||'غير محدد';
}
function delayDays(z){const m=t(z.delay).match(/(\d+)\s*يوم/);return m?+m[1]:0}
function group(rows,key,fn=x=>t(x[key])||'غير محدد'){const m={};rows.forEach(x=>{const k=fn(x);m[k]=(m[k]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function uniq(rows,key){return new Set(rows.map(x=>t(x[key])).filter(Boolean)).size}
function sum(rows,key){return rows.reduce((s,x)=>s+n(x[key]),0)}
function destroy(){Object.values(M.charts).forEach(c=>{try{c.destroy()}catch{}});M.charts={}}
function root(){
 let x=document.getElementById('masterExecutiveControl');
 if(x)return x;
 const page=document.getElementById('masterPage'); if(!page)return null;
 x=document.createElement('section');x.id='masterExecutiveControl';x.className='me-root';
 page.insertBefore(x,page.firstChild);
 hideLegacy();
 return x;
}
function hideLegacy(){
 const page=document.getElementById('masterPage');if(!page)return;
 const title=page.querySelector('.section-title');if(title)title.style.display='none';
 const mk=document.getElementById('masterKpis');if(mk)mk.style.display='none';
 const mon=page.querySelector('.monthly-assignment-panel');if(mon)mon.style.display='none';
 const type=page.querySelector('.type-chart-row');if(type)type.style.display='none';
 page.querySelectorAll(':scope > .charts').forEach(x=>x.style.display='none');
 const table=document.getElementById('masterTable');if(table){const p=table.closest('article.panel');if(p)p.style.display='none'}
}
function card(label,value,note='',tone='',page=''){
 return `<article class="me-card ${tone?'me-'+tone:''} ${page?'me-link':''}" ${page?`data-page="${e(page)}"`:''}><span>${e(label)}</span><strong>${typeof value==='number'?value.toLocaleString('ar-SA'):e(value)}</strong><small>${e(note)}</small></article>`;
}
function groupBlock(title,sub,cards,cls=''){return `<section class="me-group ${cls}"><header><div><span>EXECUTIVE KPI</span><h3>${e(title)}</h3></div><small>${e(sub)}</small></header><div>${cards.join('')}</div></section>`}
function chart(id,title,sub,wide=false){return `<article class="panel me-chart ${wide?'me-wide':''}"><div class="panel-title"><span>${e(sub)}</span><h3>${e(title)}</h3></div><div class="me-chart-box"><canvas id="${id}"></canvas></div></article>`}
function draw(id,type,labels,datasets,extra={}){
 const el=document.getElementById(id);if(!el||typeof Chart==='undefined')return;
 M.charts[id]=new Chart(el,{type,data:{labels,datasets},options:Object.assign({responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,font:{family:'Cairo',size:8}}}}},extra)});
}
function stacked(id,rows,key,limit=10){
 const keys=group(rows,key).slice(0,limit).map(x=>x[0]),states=['تم التنفيذ','لم يتم التنفيذ','موقوف/محول'];
 draw(id,'bar',keys,states.map((s,i)=>({label:s,data:keys.map(k=>rows.filter(z=>(t(z[key])||'غير محدد')===k&&status(z)===s).length),backgroundColor:['#16a34a','#f59e0b','#64748b'][i]})),{indexAxis:'y',scales:{x:{stacked:true,beginAtZero:true},y:{stacked:true}}});
}
function criticalScore(z){
 let s=0;const st=status(z),d=delayBucket(z),dd=delayDays(z);
 if(st==='لم يتم التنفيذ')s+=3;if(st==='موقوف/محول')s+=2;
 if(d==='تأخير شديد')s+=5;else if(d==='تأخير متوسط')s+=3;else if(d==='تأخير بسيط')s+=2;else if(d==='أوشكت المدة')s+=1;
 if(dd>=30)s+=2;if(dd>=60)s+=2;
 if((n(z.consultantDays)||0)>=10)s+=2;
 if(st==='تم التنفيذ'&&!yes(z.consultant155))s+=2;
 if(st==='تم التنفيذ'&&!yes(z.contractor155))s+=1;
 if(!t(z.engineer))s+=2;
 return s;
}
function criticalTable(rows){
 const a=rows.map(z=>({z,score:criticalScore(z)})).filter(x=>x.score>=4).sort((a,b)=>b.score-a.score||delayDays(b.z)-delayDays(a.z)).slice(0,25);
 if(!a.length)return'<div class="me-empty">لا توجد أوامر حرجة ضمن الفلاتر الحالية.</div>';
 return `<div class="me-table-wrap"><table><thead><tr><th>الأولوية</th><th>أمر العمل</th><th>القسم</th><th>المقاول</th><th>المسؤول</th><th>الحالة</th><th>التأخير</th><th>المرحلة</th><th>حالة المرحلة</th><th>155 استشاري</th><th>155 مقاول</th><th>التصريح</th></tr></thead><tbody>${a.map(({z,score})=>`<tr><td><b class="me-score">${score}</b></td><td>${e(z.workOrder)}</td><td>${e(z.section)}</td><td>${e(z.contractor)}</td><td>${e(z.engineer)}</td><td>${e(status(z))}</td><td>${e(delayBucket(z))}</td><td>${e(z.stage)}</td><td>${e(z.stageStatus)}</td><td>${e(z.consultant155)}</td><td>${e(z.contractor155)}</td><td>${e(z.permit)}</td></tr>`).join('')}</tbody></table></div>`;
}
function detailTable(rows){
 const a=[...rows].sort((a,b)=>criticalScore(b)-criticalScore(a)).slice(0,180);
 return `<div class="me-table-wrap me-detail"><table><thead><tr><th>#</th><th>أمر العمل</th><th>النوع</th><th>القسم</th><th>الإدارة</th><th>الموقع</th><th>المقاول</th><th>المسؤول</th><th>الحالة</th><th>التأخير</th><th>القيمة</th><th>التصريح</th><th>المرحلة</th><th>حالة المرحلة</th></tr></thead><tbody>${a.map((z,i)=>`<tr><td>${i+1}</td><td>${e(z.workOrder)}</td><td>${e(z.type)}</td><td>${e(z.section)}</td><td>${e(z.region)}</td><td>${e(z.location)}</td><td>${e(z.contractor)}</td><td>${e(z.engineer)}</td><td>${e(status(z))}</td><td>${e(delayBucket(z))}</td><td>${n(z.value).toLocaleString('ar-SA')}</td><td>${e(z.permit)}</td><td>${e(z.stage)}</td><td>${e(z.stageStatus)}</td></tr>`).join('')}</tbody></table></div>`;
}
function render(rows){
 const x=root();if(!x)return;destroy();hideLegacy();
 const total=rows.length,done=rows.filter(z=>status(z)==='تم التنفيذ').length,not=rows.filter(z=>status(z)==='لم يتم التنفيذ').length,stopped=rows.filter(z=>status(z)==='موقوف/محول').length;
 const projects=rows.filter(z=>t(z.section)==='مشاريع').length,connections=rows.filter(z=>t(z.section)==='توصيلات').length,operations=rows.filter(z=>t(z.section).includes('عمليات')).length;
 const delays=['ضمن المدة','أوشكت المدة','تأخير بسيط','تأخير متوسط','تأخير شديد'];
 const dc=Object.fromEntries(delays.map(k=>[k,rows.filter(z=>delayBucket(z)===k).length]));
 const stages=['التصاريح','التنفيذ','مرحلة التشغيل','مرحلة الإغلاق','تحت المعالجة'];
 const stageCount=Object.fromEntries(stages.map(k=>[k,rows.filter(z=>t(z.stage)===k).length]));
 const c155Yes=rows.filter(z=>yes(z.consultant155)).length,k155Yes=rows.filter(z=>yes(z.contractor155)).length;
 const permitIssued=rows.filter(z=>t(z.permit).includes('تم اصدار')).length,permitNo=rows.filter(z=>t(z.permit)==='لا يتطلب').length,permitPending=rows.filter(z=>t(z.permit)&&!t(z.permit).includes('تم اصدار')&&t(z.permit)!=='لا يتطلب').length;
 const contractors=uniq(rows,'contractor'),engineers=uniq(rows,'engineer'),noEngineer=rows.filter(z=>!t(z.engineer)).length;
 const totalValue=sum(rows,'value'),doneValue=sum(rows.filter(z=>status(z)==='تم التنفيذ'),'value'),backlogValue=sum(rows.filter(z=>status(z)!=='تم التنفيذ'),'value');
 const safety=rows.reduce((s,z)=>s+n(z.safetyViolations),0),executionV=rows.reduce((s,z)=>s+n(z.executionViolations),0);
 const critical=rows.filter(z=>criticalScore(z)>=4).length;
 x.innerHTML=`
 <section class="me-hero">
   <div><span>VISION DIMENSIONS • CONTRACT CONTROL ROOM</span><h2>الرئيسية — مركز التحكم التنفيذي لأوامر العمل</h2><p>الرئيسية وأوامر العمل في شاشة واحدة: التنفيذ، التأخير، القيمة، مراحل العمل، 155، التصاريح والمقاولين.</p></div>
   <div class="me-alert"><small>أولوية المتابعة</small><strong>${critical?critical+' أمر يحتاج تدخل':'لا توجد حالات حرجة ضمن الفلاتر الحالية'}</strong><span>كل المؤشرات تتفاعل مع فلاتر الرئيسية</span></div>
 </section>
 <section class="me-groups">
  ${groupBlock('حالة أوامر العمل','المصدر: حالة أمر العمل',[
    card('إجمالي أوامر العمل',total,'','blue'),card('تم التنفيذ',done,pct(done,total),'green'),card('لم يتم التنفيذ',not,pct(not,total),'amber'),card('موقوف / محول',stopped,pct(stopped,total),'slate'),card('نسبة الإنجاز',pct(done,total),'','green')
  ])}
  ${groupBlock('توزيع نطاق العمل','انتقال مباشر إلى التابات التشغيلية',[
    card('المشاريع',projects,pct(projects,total),'blue','projects'),card('التوصيلات',connections,pct(connections,total),'blue','connections'),card('العمليات',operations,pct(operations,total),'purple'),card('المقاولون النشطون',contractors),card('المسؤولون',engineers)
  ])}
  ${groupBlock('التأخير التنفيذي','من إشعارات التأخير بأوامر العمل',[
    card('ضمن المدة',dc['ضمن المدة']||0,'','green'),card('أوشكت المدة',dc['أوشكت المدة']||0,'','amber'),card('تأخير بسيط',dc['تأخير بسيط']||0,'','amber'),card('تأخير متوسط',dc['تأخير متوسط']||0,'','orange'),card('تأخير شديد',dc['تأخير شديد']||0,'','red')
  ])}
  ${groupBlock('مسار التنفيذ','مرحلة التنفيذ الحالية',[
    card('التصاريح',stageCount['التصاريح']||0,'','amber','permits'),card('التنفيذ',stageCount['التنفيذ']||0),card('التشغيل',stageCount['مرحلة التشغيل']||0,'','purple'),card('الإغلاق',stageCount['مرحلة الإغلاق']||0,'','green','closures'),card('تحت المعالجة',stageCount['تحت المعالجة']||0,'','slate')
  ])}
  ${groupBlock('155 والتصاريح','جاهزية الإغلاق والتحكم بالمستندات',[
    card('155 الاستشاري — نعم',c155Yes,pct(c155Yes,total),'green'),card('155 الاستشاري — لا',total-c155Yes,'','amber'),card('155 المقاول — نعم',k155Yes,pct(k155Yes,total),'green'),card('155 المقاول — لا',total-k155Yes,'','amber'),card('تصريح صادر',permitIssued,'','green','permits'),card('لا يتطلب تصريح',permitNo,'','slate','permits'),card('تصاريح تحتاج متابعة',permitPending,'','red','permits')
  ])}
  ${groupBlock('القيمة والمخاطر','القيمة المالية وجودة التنفيذ',[
    card('إجمالي قيمة الأوامر',totalValue.toLocaleString('ar-SA'),'ريال','blue'),card('قيمة المنفذ',doneValue.toLocaleString('ar-SA'),'ريال','green'),card('قيمة المتبقي',backlogValue.toLocaleString('ar-SA'),'ريال','amber'),card('بدون مسؤول',noEngineer,'','red'),card('مخالفات السلامة',safety,'','red','safety'),card('مخالفات التنفيذ',executionV,'','red','violationsCombined')
  ],'me-wide-group')}
 </section>
 <section class="me-charts">
   ${chart('meMonthly','الإسناد الشهري — العدد والقيمة','MONTHLY ASSIGNMENT',true)}
   ${chart('meStatus','حالة التنفيذ','WORK ORDER STATUS')}${chart('meSection','حالة التنفيذ حسب القسم','SECTION × STATUS')}
   ${chart('meStage','مرحلة التنفيذ','EXECUTION STAGE')}${chart('meStageStatus','أعلى حالات المرحلة','PHASE STATUS')}
   ${chart('meDelay','شرائح التأخير','DELAY PROFILE')}${chart('mePermit','حالة التصاريح','PERMITS')}
   ${chart('me155','تقدم 155','CONSULTANT / CONTRACTOR 155')}${chart('meCategory','فئة العمل','WORK CATEGORY')}
   ${chart('meContractor','المقاول — العدد والقيمة','CONTRACTOR PORTFOLIO',true)}
   ${chart('meContractorStatus','حالة التنفيذ حسب المقاول','CONTRACTOR × STATUS',true)}
   ${chart('meEngineer','الحمل التشغيلي على المسؤولين','ENGINEER LOAD',true)}
 </section>
 <section class="me-actions">
   <article class="panel me-table-panel"><div class="panel-title"><span>ACTION PRIORITY</span><h3>أعلى أوامر العمل أولوية للتدخل</h3></div>${criticalTable(rows)}</article>
   <article class="panel me-table-panel"><div class="panel-head"><div class="panel-title"><span>WORK ORDERS</span><h3>أوامر العمل المطابقة للفلاتر</h3></div><b>${total.toLocaleString('ar-SA')}</b></div>${detailTable(rows)}</article>
 </section>`;
 x.querySelectorAll('.me-link').forEach(c=>c.onclick=()=>openPage(c.dataset.page));
 renderCharts(rows);
}
function renderCharts(rows){
 const total=rows.length,done=rows.filter(z=>status(z)==='تم التنفيذ').length,not=rows.filter(z=>status(z)==='لم يتم التنفيذ').length,stopped=rows.filter(z=>status(z)==='موقوف/محول').length;
 draw('meStatus','doughnut',['تم التنفيذ','لم يتم التنفيذ','موقوف/محول'],[{data:[done,not,stopped],backgroundColor:['#16a34a','#f59e0b','#64748b']}]);
 const sections=group(rows,'section').slice(0,8).map(x=>x[0]);draw('meSection','bar',sections,['تم التنفيذ','لم يتم التنفيذ','موقوف/محول'].map((s,i)=>({label:s,data:sections.map(k=>rows.filter(z=>(t(z.section)||'غير محدد')===k&&status(z)===s).length),backgroundColor:['#16a34a','#f59e0b','#64748b'][i]})),{scales:{x:{stacked:true},y:{stacked:true}}});
 const st=group(rows,'stage').slice(0,10);draw('meStage','bar',st.map(x=>x[0]),[{label:'أوامر',data:st.map(x=>x[1]),backgroundColor:'#2563eb'}],{indexAxis:'y'});
 const ss=group(rows,'stageStatus').slice(0,12);draw('meStageStatus','bar',ss.map(x=>x[0]),[{label:'أوامر',data:ss.map(x=>x[1]),backgroundColor:'#7c3aed'}],{indexAxis:'y'});
 const delays=['تم التنفيذ','ضمن المدة','أوشكت المدة','تأخير بسيط','تأخير متوسط','تأخير شديد','موقوف/محول'];draw('meDelay','bar',delays,[{label:'أوامر',data:delays.map(k=>rows.filter(z=>delayBucket(z)===k).length),backgroundColor:['#16a34a','#22c55e','#84cc16','#facc15','#f59e0b','#dc2626','#64748b']}]);
 const pg=group(rows,'permit').slice(0,10);draw('mePermit','doughnut',pg.map(x=>x[0]),[{data:pg.map(x=>x[1])}]);
 draw('me155','bar',['155 الاستشاري','155 المقاول'],[{label:'نعم',data:[rows.filter(z=>yes(z.consultant155)).length,rows.filter(z=>yes(z.contractor155)).length],backgroundColor:'#16a34a'},{label:'لا',data:[rows.filter(z=>!yes(z.consultant155)).length,rows.filter(z=>!yes(z.contractor155)).length],backgroundColor:'#cbd5e1'}],{scales:{x:{stacked:true},y:{stacked:true}}});
 const cg=group(rows,'category').slice(0,10);draw('meCategory','doughnut',cg.map(x=>x[0]),[{data:cg.map(x=>x[1])}]);
 const contractors=group(rows,'contractor').slice(0,12).map(x=>x[0]);draw('meContractor','bar',contractors,[{type:'bar',label:'القيمة',data:contractors.map(k=>sum(rows.filter(z=>t(z.contractor)===k),'value')),backgroundColor:'rgba(37,99,235,.45)',yAxisID:'y'},{type:'line',label:'عدد الأوامر',data:contractors.map(k=>rows.filter(z=>t(z.contractor)===k).length),borderColor:'#f59e0b',backgroundColor:'#f59e0b',tension:.25,yAxisID:'y1'}],{scales:{y:{beginAtZero:true,position:'right'},y1:{beginAtZero:true,position:'left',grid:{drawOnChartArea:false}}}});
 stacked('meContractorStatus',rows,'contractor',12);
 const eng=group(rows,'engineer').slice(0,15);draw('meEngineer','bar',eng.map(x=>x[0]),[{label:'عدد الأوامر',data:eng.map(x=>x[1]),backgroundColor:'#0891b2'}],{indexAxis:'y'});
 const months={};rows.forEach(z=>{let d=null;try{d=typeof parseSheetDate==='function'?parseSheetDate(z.assignedDate):new Date(z.assignedDate)}catch{}if(!d||isNaN(d))return;const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');if(!months[k])months[k]={count:0,value:0};months[k].count++;months[k].value+=n(z.value)});const keys=Object.keys(months).sort();draw('meMonthly','bar',keys,[{type:'bar',label:'قيمة الإسناد',data:keys.map(k=>months[k].value),backgroundColor:'rgba(37,99,235,.4)',yAxisID:'y'},{type:'line',label:'عدد أوامر العمل',data:keys.map(k=>months[k].count),borderColor:'#f59e0b',backgroundColor:'#f59e0b',tension:.25,yAxisID:'y1'},{type:'line',label:'متوسط قيمة الإسناد (ر.س)',data:keys.map(k=>months[k].count?months[k].value/months[k].count:0),borderColor:'#16a34a',backgroundColor:'#16a34a',borderDash:[6,4],pointRadius:4,pointHoverRadius:6,tension:.25,yAxisID:'yAvg'}],{plugins:{legend:{position:'bottom',labels:{usePointStyle:true,font:{family:'Cairo',size:8}}},tooltip:{callbacks:{label:c=>{const v=Number(c.raw||0);return c.dataset.yAxisID==='y1'?c.dataset.label+': '+v.toLocaleString('ar-SA'):c.dataset.label+': '+v.toLocaleString('ar-SA',{maximumFractionDigits:2})+' ر.س'}}}},scales:{y:{beginAtZero:true,position:'right'},y1:{beginAtZero:true,position:'left',grid:{drawOnChartArea:false}},yAvg:{display:false,beginAtZero:false,position:'right',grid:{drawOnChartArea:false}}}});
}
function currentRows(){
 if(typeof S==='undefined')return[];
 const base=Array.isArray(S.masterBaseRows)&&S.masterBaseRows.length?S.masterBaseRows:S.masterRows||[];
 try{return typeof applyChartFilters==='function'?applyChartFilters(base,null,'master'):base}catch{return base}
}
if(typeof openPage==='function'){
 const originalOpen=openPage;
 openPage=function(key){if(key==='workorders'||key==='operations')key='master';return originalOpen(key)};
}
if(typeof applyMasterFilters==='function'){
 const originalApply=applyMasterFilters;
 applyMasterFilters=function(){const out=originalApply.apply(this,arguments);if(typeof S!=='undefined'&&S.current==='master')render(currentRows());return out};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{root();if(typeof S!=='undefined'&&S.current==='master'&&S.masterRows?.length)render(currentRows())});else root();
})();