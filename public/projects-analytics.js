(function(){
'use strict';
const P={charts:{}};
const t=v=>String(v??'').replace(/\s+/g,' ').trim();
const n=v=>{const m=t(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
const r=v=>{const x=n(v);return x==null?null:(t(v).includes('%')?x/100:x)};
const eq=(a,b)=>t(a)===b, has=(a,b)=>t(a).includes(b);
const pct=x=>x==null?'—':`${(x*100).toFixed(x>=1?0:1)}%`;
const uniq=(rows,k)=>new Set(rows.map(x=>t(x[k])).filter(Boolean)).size;
const count=(rows,k,v)=>rows.filter(x=>eq(x[k],v)).length;
const avg=(rows,k)=>{const a=rows.map(x=>r(x[k])).filter(x=>x!=null);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null};
function status(x){const s=t(x.executionStatus);return s==='تم التنفيذ'?'تم التنفيذ':(s.includes('موقوف')||s.includes('محول'))?'موقوف/محول':'لم يتم التنفيذ'}
function advice(x){const s=t(x.adviceAge);if(s.includes('اهمال شديد'))return'إهمال شديد';if(s.includes('اهمال'))return'إهمال';if(s.includes('قديمة جدا'))return'قديمة جدًا';if(s.includes('قديمة'))return'قديمة';if(s.includes('جديدة'))return'جديدة';return'غير محدد'}
function group(rows,k,fn=x=>t(x[k])||'غير محدد'){const m={};rows.forEach(x=>{const a=fn(x);m[a]=(m[a]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function root(){let x=document.getElementById('projectsAdvancedAnalytics');if(x)return x;const a=document.getElementById('genericPageCharts');if(!a)return null;x=document.createElement('section');x.id='projectsAdvancedAnalytics';a.parentNode.insertBefore(x,a);return x}
function destroy(){Object.values(P.charts).forEach(x=>{try{x.destroy()}catch{}});P.charts={}}
function draw(id,type,labels,data,extra={}){const el=document.getElementById(id);if(!el)return;P.charts[id]=new Chart(el,{type,data:{labels,datasets:data},options:Object.assign({responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,font:{family:'Cairo',size:8}}}}},extra)})}
function card(a,b,c=''){return `<article class="pa-card"><span>${a}</span><strong>${b}</strong><small>${c}</small></article>`}
function chart(id,title,sub){return `<article class="panel pa-chart"><div class="panel-title"><span>${sub}</span><h3>${title}</h3></div><div class="pa-chart-box"><canvas id="${id}"></canvas></div></article>`}
function render(rows){
 const x=root();if(!x)return;destroy();
 const total=rows.length,done=rows.filter(z=>status(z)==='تم التنفيذ').length,not=rows.filter(z=>status(z)==='لم يتم التنفيذ').length,stop=rows.filter(z=>status(z)==='موقوف/محول').length;
 const within=rows.filter(z=>{const q=r(z.timeRatio);return q!=null&&q>=1}).length,late=rows.filter(z=>{const q=r(z.timeRatio);return q!=null&&q>0&&q<1}).length;
 const stages=['التصاريح','التنفيذ','مرحلة التشغيل','مرحلة الإغلاق','تحت المعالجة'];
 const adv=['جديدة','قديمة','قديمة جدًا','إهمال','إهمال شديد'];
 const issued=rows.filter(z=>has(z.permit,'تم اصدار')).length,noPermit=rows.filter(z=>has(z.permit,'لا يتطلب')).length;
 const missingPermit=rows.filter(z=>!t(z.permit)||has(z.permit,'لم يتم')).length;
 x.innerHTML=`<section class="pa-hero"><div><span>PROJECTS CONTROL ROOM</span><h2>التحليل التنفيذي المتقدم للمشاريع</h2><p>قراءة مباشرة من «⚡المشاريع العام» حتى AO وتتحرك مع فلاتر التاب.</p></div><b>${late?late+' أمر متجاوز المدة':'لا توجد حالات زمنية حرجة'}</b></section>
 <section class="pa-groups">
  <div class="pa-group"><h3>حالة التنفيذ — AO</h3><div>${card('إجمالي المشاريع',total)}${card('تم التنفيذ',done,total?pct(done/total):'—')}${card('لم يتم التنفيذ',not,total?pct(not/total):'—')}${card('موقوف/محول',stop,total?pct(stop/total):'—')}${card('نسبة التنفيذ',total?pct(done/total):'—')}</div></div>
  <div class="pa-group"><h3>مسار التنفيذ — V</h3><div>${stages.map(s=>card(s,count(rows,'stage',s))).join('')}</div></div>
  <div class="pa-group"><h3>جودة المتابعة — AE</h3><div>${adv.map(s=>card(s,rows.filter(z=>advice(z)===s).length)).join('')}${card('بدون إفادة/تاريخ',rows.filter(z=>!t(z.advice)||!t(z.adviceDate)).length)}</div></div>
  <div class="pa-group"><h3>الزمن والأداء — AJ/AM/AN</h3><div>${card('ضمن المدة',within)}${card('متجاوز المدة',late)}${card('متوسط الإنجاز',pct(avg(rows,'progress')))}${card('متوسط النسبة الزمنية',pct(avg(rows,'timeRatio')))}${card('متوسط SPI',avg(rows,'spi')==null?'—':avg(rows,'spi').toFixed(2))}</div></div>
  <div class="pa-group"><h3>التصاريح — P</h3><div>${card('تم إصدار التصريح',issued)}${card('لم يدخل/غير محدد',missingPermit)}${card('لا يتطلب تصريح',noPermit)}${card('حالات التصاريح',uniq(rows,'permit'))}</div></div>
  <div class="pa-group"><h3>التغطية التشغيلية</h3><div>${card('المقاولون',uniq(rows,'contractor'))}${card('المسؤولون',uniq(rows,'engineer'))}${card('المواقع',uniq(rows,'location'))}${card('أنواع الأعمال',uniq(rows,'description'))}</div></div>
 </section>
 <section class="pa-charts">${chart('paExec','حالة التنفيذ النهائية','AO')}${chart('paStage','مرحلة التنفيذ','V')}${chart('paStatus','أعلى حالات المرحلة','W')}${chart('paPermit','حالة التصاريح','P')}${chart('paAdvice','حداثة الإفادات','AE')}${chart('paContractor','حالة التنفيذ حسب المقاول','G × AO')}</section>
 <article class="panel pa-table"><div class="panel-title"><span>ACTION LIST</span><h3>أعلى أوامر المشاريع أولوية للمتابعة</h3></div>${priority(rows)}</article>`;
 draw('paExec','doughnut',['تم التنفيذ','لم يتم التنفيذ','موقوف/محول'],[{data:[done,not,stop],backgroundColor:['#16a34a','#f59e0b','#64748b']}]);
 const sg=group(rows,'stage').slice(0,8);draw('paStage','bar',sg.map(z=>z[0]),[{label:'عدد الأوامر',data:sg.map(z=>z[1]),backgroundColor:'#2563eb'}],{indexAxis:'y'});
 const wg=group(rows,'stageStatus').slice(0,10);draw('paStatus','bar',wg.map(z=>z[0]),[{label:'عدد الأوامر',data:wg.map(z=>z[1]),backgroundColor:'#7c3aed'}],{indexAxis:'y'});
 const pg=group(rows,'permit').slice(0,8);draw('paPermit','doughnut',pg.map(z=>z[0]),[{data:pg.map(z=>z[1])}]);
 draw('paAdvice','bar',adv,[{label:'عدد الأوامر',data:adv.map(s=>rows.filter(z=>advice(z)===s).length),backgroundColor:['#16a34a','#84cc16','#f59e0b','#f97316','#dc2626']}]);
 const cg=group(rows,'contractor').slice(0,10),states=['تم التنفيذ','لم يتم التنفيذ','موقوف/محول'];draw('paContractor','bar',cg.map(z=>z[0]),states.map((s,i)=>({label:s,data:cg.map(([k])=>rows.filter(z=>(t(z.contractor)||'غير محدد')===k&&status(z)===s).length),backgroundColor:['#16a34a','#f59e0b','#64748b'][i]})),{indexAxis:'y',scales:{x:{stacked:true},y:{stacked:true}}});
}
function score(z){let s=0;if(status(z)==='لم يتم التنفيذ')s+=3;if(status(z)==='موقوف/محول')s+=2;const q=r(z.timeRatio);if(q!=null&&q<1)s+=3;const a=advice(z);if(a==='إهمال شديد')s+=4;else if(a==='إهمال')s+=3;else if(a==='قديمة جدًا')s+=2;const p=r(z.progress);if(p!=null&&p<.5)s+=2;return s}
function priority(rows){const a=rows.map(z=>[z,score(z)]).filter(z=>z[1]>=4).sort((a,b)=>b[1]-a[1]).slice(0,20);if(!a.length)return'<div class="pa-empty">لا توجد أوامر حرجة ضمن الفلاتر الحالية.</div>';return `<div class="pa-wrap"><table><thead><tr><th>الأولوية</th><th>أمر العمل</th><th>المقاول</th><th>المسؤول</th><th>المرحلة</th><th>حالة المرحلة</th><th>الإنجاز</th><th>النسبة الزمنية</th><th>آخر إفادة</th></tr></thead><tbody>${a.map(([z,s])=>`<tr><td><b>${s}</b></td><td>${t(z.workOrder)}</td><td>${t(z.contractor)}</td><td>${t(z.engineer)}</td><td>${t(z.stage)}</td><td>${t(z.stageStatus)}</td><td>${pct(r(z.progress))}</td><td>${pct(r(z.timeRatio))}</td><td>${t(z.advice)}</td></tr>`).join('')}</tbody></table></div>`}
function sync(){const x=root();if(!x)return;const on=typeof S!=='undefined'&&S.current==='projects';x.style.display=on?'block':'none';const g=document.getElementById('genericPageCharts'),p=document.getElementById('executionPhaseAnalytics'),k=document.getElementById('pageKpis');if(on){if(g)g.style.display='none';if(p)p.style.display='none';if(k)k.style.display='none';render(Array.isArray(S.filtered)?S.filtered:[])}else{if(k)k.style.display='';destroy()}}
if(typeof renderDataPage==='function'){const base=renderDataPage;renderDataPage=function(){base.apply(this,arguments);sync()}}
})();