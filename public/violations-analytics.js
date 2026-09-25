'use strict';
(()=>{
const VX={charts:{}};
const t=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const e=v=>t(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>{const x=Number(String(v||'').replace(/,/g,'').replace(/[^\d.-]/g,''));return Number.isFinite(x)?x:0};
const fm=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(Number(v||0));
const money=v=>fm(v)+' ر.س';
const count=(rows,key)=>{const m=new Map();rows.forEach(r=>{const x=t(r[key])||'غير محدد';m.set(x,(m.get(x)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1])};
const sumBy=(rows,key,valueKey)=>{const m=new Map();rows.forEach(r=>{const x=t(r[key])||'غير محدد';m.set(x,(m.get(x)||0)+n(r[valueKey]))});return [...m].sort((a,b)=>b[1]-a[1])};
const monthKey=v=>{const d=typeof parseDashboardDate==='function'?parseDashboardDate(v):null;return d&&!isNaN(d)?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'):''};
const monthLabel=k=>{const [y,m]=k.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('ar-SA',{month:'short',year:'numeric'})};
const REPORT_KEYS=new Set(['safety','executionViolations','minutes']);
VX.periods=VX.periods||{};
const periodState=key=>VX.periods[key]||(VX.periods[key]={from:'',to:'',preset:'all'});
const isoDate=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const inputDate=v=>{if(!v)return null;const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));return isNaN(d)?null:d};
const rowDate=r=>{if(typeof parseDashboardDate==='function'){const d=parseDashboardDate(r?.date);if(d&&!isNaN(d))return d}const d=new Date(r?.date||'');return isNaN(d)?null:d};
const reportBasis=key=>key==='minutes'?'الأساس: تاريخ المحضر':key==='safety'||key==='executionViolations'?'الأساس: تاريخ المخالفة':'الأساس: تاريخ السجل';
function filterPeriodRows(rows,key){
 if(!REPORT_KEYS.has(key))return rows;
 const st=periodState(key),from=inputDate(st.from),to=inputDate(st.to);
 if(!from&&!to)return rows;
 const start=from?new Date(from.getFullYear(),from.getMonth(),from.getDate(),0,0,0,0):null;
 const end=to?new Date(to.getFullYear(),to.getMonth(),to.getDate(),23,59,59,999):null;
 return rows.filter(r=>{const d=rowDate(r);if(!d)return false;if(start&&d<start)return false;if(end&&d>end)return false;return true});
}
function fmtPeriodDate(v){
 const d=inputDate(v);return d?d.toLocaleDateString('ar-SA',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
}
function updatePeriodSlicer(){
 const key=typeof S!=='undefined'?S.current:'',box=document.getElementById('violationPeriodSlicer');
 if(!box)return;
 const on=REPORT_KEYS.has(key);box.style.display=on?'block':'none';if(!on)return;
 const st=periodState(key),from=document.getElementById('vpsFrom'),to=document.getElementById('vpsTo'),basis=document.getElementById('vpsBasis'),summary=document.getElementById('vpsSummary');
 if(from&&from.value!==st.from)from.value=st.from;
 if(to&&to.value!==st.to)to.value=st.to;
 if(basis)basis.textContent=reportBasis(key);
 box.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period===st.preset));
 const label=!st.from&&!st.to?'كامل المدة':(st.from&&st.to?fmtPeriodDate(st.from)+' — '+fmtPeriodDate(st.to):st.from?'من '+fmtPeriodDate(st.from):'حتى '+fmtPeriodDate(st.to));
 const count=Array.isArray(S?.filtered)?S.filtered.length:0,total=Array.isArray(S?.raw)?S.raw.length:0;
 if(summary)summary.innerHTML='<b>'+e(label)+'</b><small>'+fm(count)+' من '+fm(total)+' سجل</small>';
}
function setPreset(preset){
 const key=typeof S!=='undefined'?S.current:'';if(!REPORT_KEYS.has(key))return;
 const st=periodState(key),today=new Date();today.setHours(0,0,0,0);
 if(preset==='all'){st.from='';st.to='';}
 else if(preset==='month'){st.from=isoDate(new Date(today.getFullYear(),today.getMonth(),1));st.to=isoDate(today);}
 else if(preset==='30'){const d=new Date(today);d.setDate(d.getDate()-29);st.from=isoDate(d);st.to=isoDate(today);}
 else if(preset==='90'){const d=new Date(today);d.setDate(d.getDate()-89);st.from=isoDate(d);st.to=isoDate(today);}
 else if(preset==='year'){st.from=isoDate(new Date(today.getFullYear(),0,1));st.to=isoDate(today);}
 st.preset=preset;
 if(typeof applyFilters==='function')applyFilters();
}
function bindPeriodSlicer(){
 const from=document.getElementById('vpsFrom'),to=document.getElementById('vpsTo'),clear=document.getElementById('vpsClear'),box=document.getElementById('violationPeriodSlicer');
 if(!box||box.dataset.bound==='1')return;box.dataset.bound='1';
 const manual=()=>{
  const key=typeof S!=='undefined'?S.current:'';if(!REPORT_KEYS.has(key))return;
  const st=periodState(key);st.from=from?.value||'';st.to=to?.value||'';
  if(st.from&&st.to&&st.from>st.to){const a=st.from;st.from=st.to;st.to=a;}
  st.preset='custom';if(typeof applyFilters==='function')applyFilters();
 };
 if(from)from.onchange=manual;if(to)to.onchange=manual;
 box.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>setPreset(b.dataset.period));
 if(clear)clear.onclick=()=>setPreset('all');
}
function applyPeriodToState(){
 const key=typeof S!=='undefined'?S.current:'';if(!REPORT_KEYS.has(key))return;
 if(Array.isArray(S.pageBaseRows))S.pageBaseRows=filterPeriodRows(S.pageBaseRows,key);
 if(Array.isArray(S.filtered))S.filtered=filterPeriodRows(S.filtered,key);
}
function destroy(id){if(VX.charts[id]){try{VX.charts[id].destroy()}catch{}delete VX.charts[id]}}
function draw(id,type,labels,data,opt={}){
 const el=document.getElementById(id);if(!el)return;destroy(id);
 const palette=['#2878e8','#18a875','#f0a126','#7757d7','#e4505b','#22a8c5','#667ca8','#b26abc','#63b35e','#d68942'];
 const dark=document.body.classList.contains('vd-report-dark'),ink=dark?'#eaf2ff':'#40506a',grid=dark?'rgba(255,255,255,.08)':'#edf1f6';
 VX.charts[id]=new Chart(el,{type,data:{labels,datasets:[{label:opt.label||'العدد',data,backgroundColor:type==='line'?'rgba(40,120,232,.14)':labels.map((_,i)=>palette[i%palette.length]),borderColor:type==='line'?'#2878e8':labels.map((_,i)=>palette[i%palette.length]),borderWidth:type==='line'?3:1,fill:type==='line',tension:.34,borderRadius:type==='bar'?8:0,maxBarThickness:24}]},
 options:{responsive:true,maintainAspectRatio:false,indexAxis:opt.horizontal?'y':'x',cutout:type==='doughnut'?'64%':undefined,
 onClick:(evt,els)=>{if(!els.length||!opt.field||typeof toggleChartFilter!=='function')return;const v=labels[els[0].index];toggleChartFilter(id,opt.field,v,(typeof LABELS!=='undefined'&&LABELS[opt.field])||opt.field,'exact',v)},
 plugins:{legend:{display:type==='doughnut',position:'bottom',rtl:true,labels:{color:ink,font:{family:'Cairo',size:9},boxWidth:10,usePointStyle:true}},tooltip:{rtl:true,callbacks:{label:c=>' '+fm(c.raw)+(opt.money?' ر.س':'')}}},
 scales:type==='doughnut'?{}:{x:{beginAtZero:true,grid:{display:!opt.horizontal,color:grid},ticks:{color:ink,font:{family:'Cairo',size:9}}},y:{beginAtZero:true,grid:{display:false},ticks:{color:ink,font:{family:'Cairo',size:9},autoSkip:false}}}}});
}
function ensure(){
 const generic=document.getElementById('genericPageCharts');if(!generic)return;
 const pageKpis=document.getElementById('pageKpis');
 if(pageKpis&&!document.getElementById('violationPeriodSlicer')){
  const slicer=document.createElement('section');
  slicer.id='violationPeriodSlicer';
  slicer.className='violation-period-slicer';
  slicer.style.display='none';
  slicer.innerHTML=`
    <div class="vps-head">
      <div>
        <span>REPORT PERIOD</span>
        <h3>الفترة الزمنية للتقرير</h3>
        <small id="vpsBasis">يعتمد على تاريخ السجل</small>
      </div>
      <div id="vpsSummary" class="vps-summary">كامل المدة</div>
    </div>
    <div class="vps-controls">
      <label><span>من تاريخ</span><input id="vpsFrom" type="date"></label>
      <label><span>إلى تاريخ</span><input id="vpsTo" type="date"></label>
      <div class="vps-presets" aria-label="اختيارات سريعة للفترة">
        <button type="button" data-period="all" class="active">كامل المدة</button>
        <button type="button" data-period="month">هذا الشهر</button>
        <button type="button" data-period="30">آخر 30 يوم</button>
        <button type="button" data-period="90">آخر 90 يوم</button>
        <button type="button" data-period="year">هذا العام</button>
      </div>
      <button type="button" id="vpsClear" class="vps-clear">إعادة ضبط</button>
    </div>`;
  pageKpis.parentNode.insertBefore(slicer,pageKpis);
  bindPeriodSlicer();
 }
 const ex=document.getElementById('executionMasterAnalytics');
 if(ex&&!document.getElementById('vxExecutionExtra')){
  ex.insertAdjacentHTML('beforeend',`<section id="vxExecutionExtra"><div id="vxExecutionInsights" class="vx-insights"></div><div class="vx-grid"><article class="panel"><div class="panel-title"><span>VIOLATION EDITORS</span><h3>المخالفات حسب محرر المخالفة</h3></div><div class="vx-chart"><canvas id="vxExecutionEditor"></canvas></div></article><article class="panel"><div class="panel-title"><span>EMAIL STATUS</span><h3>حالة إرسال إشعارات المخالفات</h3></div><div class="vx-chart"><canvas id="vxExecutionEmail"></canvas></div></article></div></section>`);
 }
 if(!document.getElementById('minutesMasterAnalytics')){
  const s=document.createElement('section');s.id='minutesMasterAnalytics';s.className='vx-root';s.style.display='none';
  s.innerHTML=`<div class="vx-hero"><div><span>VISION DIMENSIONS • CASE VIOLATION MINUTES</span><h3>محاضر مخالفة اثبات الحالة — تحليل شامل</h3><p>قراءة تنفيذية للغرامات، المقاولين، بنود المخالفات، حالة الرفع ومصادر أوامر العمل.</p></div></div>
  <div id="vxMinutesInsights" class="vx-insights"></div>
  <div class="vx-grid">
  <article class="panel vx-wide"><div class="panel-title"><span>TREND</span><h3>اتجاه عدد المحاضر شهريًا</h3></div><div class="vx-chart"><canvas id="vxMinutesTrend"></canvas></div></article>
  <article class="panel vx-wide"><div class="panel-title"><span>PENALTY TREND</span><h3>قيمة الغرامات شهريًا</h3></div><div class="vx-chart"><canvas id="vxMinutesPenaltyTrend"></canvas></div></article>
  <article class="panel"><div class="panel-title"><span>CONTRACTORS</span><h3>المحاضر حسب المقاول</h3></div><div class="vx-chart"><canvas id="vxMinutesContractor"></canvas></div></article>
  <article class="panel"><div class="panel-title"><span>PENALTIES BY CONTRACTOR</span><h3>الغرامات حسب المقاول</h3></div><div class="vx-chart"><canvas id="vxMinutesContractorPenalty"></canvas></div></article>
  <article class="panel"><div class="panel-title"><span>PENALTY ITEMS</span><h3>أكثر بنود الغرامات تكرارًا</h3></div><div class="vx-chart"><canvas id="vxMinutesItems"></canvas></div></article>
  <article class="panel"><div class="panel-title"><span>REGIONS</span><h3>المحاضر حسب الإدارة</h3></div><div class="vx-chart"><canvas id="vxMinutesRegion"></canvas></div></article>
  <article class="panel"><div class="panel-title"><span>SOURCE</span><h3>مصدر أمر العمل</h3></div><div class="vx-chart"><canvas id="vxMinutesSource"></canvas></div></article>
  <article class="panel"><div class="panel-title"><span>UPLOAD STATUS</span><h3>حالة رفع المحاضر</h3></div><div class="vx-chart"><canvas id="vxMinutesUpload"></canvas></div></article>
  </div><div class="vx-ranks"><article class="panel"><div class="panel-title"><span>CONTRACTOR RANKING</span><h3>ترتيب المقاولين — العدد والغرامات</h3></div><div id="vxMinutesContractorRank" class="vx-table"></div></article><article class="panel"><div class="panel-title"><span>WORK ORDER RANKING</span><h3>أعلى أوامر العمل بالغرامات</h3></div><div id="vxMinutesWorkOrderRank" class="vx-table"></div></article></div>`;
  generic.parentNode.insertBefore(s,generic);
 }
}
const insight=(label,value,sub)=>`<article class="vx-insight"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(sub)}</small></article>`;
function renderExecution(rows){
 const c=count(rows,'contractor'),v=count(rows,'violation'),ed=count(rows,'editor').slice(0,10),em=count(rows,'emailStatus');
 const sent=rows.filter(r=>t(r.emailStatus).includes('تم الإرسال')).length;
 const reps=Object.values(rows.reduce((o,r)=>{const k=t(r.workOrder);if(k)o[k]=(o[k]||0)+1;return o},{})).filter(x=>x>1).length;
 const root=document.getElementById('vxExecutionInsights');if(root)root.innerHTML=[insight('أعلى مقاول بالمخالفات',c[0]?.[0]||'—',(c[0]?.[1]||0)+' مخالفة'),insight('أكثر مخالفة تكرارًا',v[0]?.[0]||'—',(v[0]?.[1]||0)+' سجل'),insight('نسبة نجاح إرسال الإيميل',rows.length?((sent/rows.length)*100).toFixed(1)+'%':'0.0%',sent+' من '+rows.length),insight('أوامر متكررة المخالفات',String(reps),'أكثر من مخالفة لنفس أمر العمل')].join('');
 draw('vxExecutionEditor','bar',ed.map(x=>x[0]),ed.map(x=>x[1]),{horizontal:true,field:'editor'});
 draw('vxExecutionEmail','doughnut',em.map(x=>x[0]),em.map(x=>x[1]),{field:'emailStatus'});
}
function tableRank(items,headers,format){
 if(!items.length)return '<div class="empty">لا توجد بيانات</div>';
 return `<table><thead><tr><th>#</th>${headers.map(h=>'<th>'+e(h)+'</th>').join('')}</tr></thead><tbody>${items.map((x,i)=>'<tr><td>'+(i+1)+'</td>'+format(x).map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')}</tbody></table>`;
}
function renderMinutes(rows){
 const monthly={};rows.forEach(r=>{const k=monthKey(r.date);if(!k)return;if(!monthly[k])monthly[k]={count:0,penalty:0};monthly[k].count++;monthly[k].penalty+=n(r.penalty)});const mk=Object.keys(monthly).sort();
 const contractors=count(rows,'contractor').slice(0,10),cp=sumBy(rows,'contractor','penalty').slice(0,10),regions=count(rows,'region').slice(0,10),sources=count(rows,'source').slice(0,10),uploads=count(rows,'uploadStatus').slice(0,10);
 const im=new Map();rows.forEach(r=>['penaltyItem1','penaltyItem2','penaltyItem3','penaltyItem4','penaltyItem5'].forEach(k=>{const x=t(r[k]);if(x)im.set(x,(im.get(x)||0)+1)}));const items=[...im].sort((a,b)=>b[1]-a[1]).slice(0,10);
 const total=rows.reduce((s,r)=>s+n(r.penalty),0),pdf=rows.filter(r=>t(r.pdfLink)||t(r.uploadStatus).includes('PDF')).length,max=Math.max(0,...rows.map(r=>n(r.penalty)));
 const ins=document.getElementById('vxMinutesInsights');if(ins)ins.innerHTML=[insight('إجمالي الغرامات',money(total),'حسب إجمالي الغرامات AF'),insight('أعلى مقاول بالغرامات',cp[0]?.[0]||'—',money(cp[0]?.[1]||0)),insight('أكثر بند غرامة',items[0]?.[0]||'—',(items[0]?.[1]||0)+' مرة'),insight('اكتمال PDF',rows.length?((pdf/rows.length)*100).toFixed(1)+'%':'0.0%',pdf+' من '+rows.length),insight('أعلى غرامة لمحضر',money(max),'أعلى قيمة مفردة')].join('');
 draw('vxMinutesTrend','line',mk.map(monthLabel),mk.map(k=>monthly[k].count),{label:'عدد المحاضر'});
 draw('vxMinutesPenaltyTrend','bar',mk.map(monthLabel),mk.map(k=>monthly[k].penalty),{label:'الغرامات',money:true});
 draw('vxMinutesContractor','bar',contractors.map(x=>x[0]),contractors.map(x=>x[1]),{horizontal:true,field:'contractor'});
 draw('vxMinutesContractorPenalty','bar',cp.map(x=>x[0]),cp.map(x=>x[1]),{horizontal:true,field:'contractor',money:true});
 draw('vxMinutesItems','bar',items.map(x=>x[0]),items.map(x=>x[1]),{horizontal:true});
 draw('vxMinutesRegion','doughnut',regions.map(x=>x[0]),regions.map(x=>x[1]),{field:'region'});
 draw('vxMinutesSource','bar',sources.map(x=>x[0]),sources.map(x=>x[1]),{horizontal:true,field:'source'});
 draw('vxMinutesUpload','doughnut',uploads.map(x=>x[0]),uploads.map(x=>x[1]),{field:'uploadStatus'});
 const cm=new Map();rows.forEach(r=>{const k=t(r.contractor)||'غير محدد',x=cm.get(k)||{count:0,penalty:0};x.count++;x.penalty+=n(r.penalty);cm.set(k,x)});const cr=[...cm].sort((a,b)=>b[1].penalty-a[1].penalty).slice(0,12);
 const wm=new Map();rows.forEach(r=>{const k=t(r.workOrder);if(!k)return;const x=wm.get(k)||{count:0,penalty:0,contractor:t(r.contractor)};x.count++;x.penalty+=n(r.penalty);wm.set(k,x)});const wr=[...wm].sort((a,b)=>b[1].penalty-a[1].penalty).slice(0,12);
 document.getElementById('vxMinutesContractorRank').innerHTML=tableRank(cr,['المقاول','المحاضر','الغرامات'],x=>[e(x[0]),fm(x[1].count),money(x[1].penalty)]);
 document.getElementById('vxMinutesWorkOrderRank').innerHTML=tableRank(wr,['أمر العمل','المقاول','المحاضر','الغرامات'],x=>[e(x[0]),e(x[1].contractor),fm(x[1].count),money(x[1].penalty)]);
}
function sync(){
 ensure();const key=typeof S!=='undefined'?S.current:'',minutes=document.getElementById('minutesMasterAnalytics'),generic=document.getElementById('genericPageCharts');
 updatePeriodSlicer();
 if(minutes)minutes.style.display=key==='minutes'?'block':'none';
 if(key==='minutes'){if(generic)generic.style.display='none';renderMinutes(Array.isArray(S.filtered)?S.filtered:[])}
 if(key==='executionViolations')renderExecution(Array.isArray(S.filtered)?S.filtered:[]);
 if(key!=='executionViolations'){destroy('vxExecutionEditor');destroy('vxExecutionEmail')}
 if(key!=='minutes'){['vxMinutesTrend','vxMinutesPenaltyTrend','vxMinutesContractor','vxMinutesContractorPenalty','vxMinutesItems','vxMinutesRegion','vxMinutesSource','vxMinutesUpload'].forEach(destroy)}
}
ensure();
if(typeof renderDataPage==='function'){
 const base=renderDataPage;
 renderDataPage=function(){
  ensure();
  applyPeriodToState();
  base.apply(this,arguments);
  sync();
 };
}
window.renderViolationAnalytics=sync;
})();