(function(){
'use strict';
const P={loaded:false,loading:false,loadedAt:0,pages:{},portfolio:null,history:null,charts:{}};
const KEYS=['projects','connections','permits','emergency'];
const LABELS={projects:'المشاريع',connections:'التوصيلات',permits:'التصاريح',operations:'العمليات بالإنشاءات',closures:'الإغلاقات',assets:'الأصول',emergency:'الطوارئ',attachments:'المرفقات',tasks:'متابعة المواقع',finance:'الماليات'};
const e=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const n=v=>{const m=t(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):0};
const r1=v=>Math.round(Number(v||0)*10)/10;
const pct=(a,b)=>b?r1((Number(a||0)/Number(b))*100):0;
function norm(v){return t(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toLowerCase()}
function rpc(method,args=[]){return fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})}).then(async x=>{const j=await x.json().catch(()=>({}));if(!x.ok||j.ok===false)throw new Error(j.error||('HTTP '+x.status));return j.result})}
function isDone(v){const s=norm(v);return s==='تم التنفيذ'||s==='منجز'||s==='مكتمل'||s.includes('تم التنفيذ')||s.includes('تم الانجاز')}
function negative(v){const s=norm(v);return !s?false:['لم يتم','غير مكتمل','غير منجز','لا يوجد','لم يستلم','لم يرفع','قيد','معاد','ناقص','موقوف','محول','تحت المراجعه'].some(x=>s.includes(x))}
function positive(v){const s=norm(v);return !!s&&!negative(v)&&['تم','نعم','مكتمل','منجز','معتمد','صدر','مرفوع','جاهز','استلم','انته'].some(x=>s.includes(x))}
function pnum(v){const s=t(v);if(!s)return null;let x=n(s);if(!Number.isFinite(x))return null;if(!s.includes('%')&&x>0&&x<=1)x*=100;return Math.max(0,Math.min(100,r1(x)))}
function avgPct(rows,key){const a=rows.map(x=>pnum(x?.[key])).filter(x=>x!==null);return a.length?r1(a.reduce((s,x)=>s+x,0)/a.length):null}
function fieldRate(rows,key){return rows.length?pct(rows.filter(x=>positive(x?.[key])).length,rows.length):0}
function composite(rows,keys){if(!rows.length)return 0;let d=0,z=0;rows.forEach(x=>keys.forEach(k=>{z++;if(positive(x?.[k]))d++}));return pct(d,z)}
function filled(rows,keys){if(!rows.length)return null;let d=0,z=0;rows.forEach(x=>keys.forEach(k=>{z++;if(t(x?.[k]))d++}));return pct(d,z)}
function projectMetric(key,rows){const progress=avgPct(rows,'progress'),done=rows.filter(x=>isDone(x.executionStatus)).length,exec=pct(done,rows.length);const ex=avgPct(rows,'excavationProgress'),ext=avgPct(rows,'extensionProgress');return {key,label:LABELS[key],page:key,total:rows.length,completed:done,rate:progress===null?exec:progress,secondaryLabel:'تنفيذ مكتمل',secondaryRate:exec,note:[ex!==null?'الحفر '+ex+'%':'',ext!==null?'التمديد '+ext+'%':''].filter(Boolean).join(' • ')}}
function metric(key,rows,rate,done,secondaryLabel,secondaryRate,note){return {key,label:LABELS[key],page:key,total:rows.length,completed:done||0,rate:r1(rate||0),secondaryLabel:secondaryLabel||'',secondaryRate:secondaryRate==null?null:r1(secondaryRate),note:note||''}}
function buildPortfolio(){
 const g=k=>(P.pages[k]?.rows||[]),projects=g('projects'),connections=g('connections'),permits=g('permits'),emergency=g('emergency');
 const project=projectMetric('projects',projects),connection=projectMetric('connections',connections);
 const pm=window.VDKpiLogic?.metric?.('projects',projects),cm=window.VDKpiLogic?.metric?.('connections',connections);
 if(pm){project.rate=pm.rate;project.completed=pm.completed;project.secondaryLabel=pm.secondaryLabel||project.secondaryLabel;project.secondaryRate=pm.secondaryRate??project.secondaryRate}
 if(cm){connection.rate=cm.rate;connection.completed=cm.completed;connection.secondaryLabel=cm.secondaryLabel||connection.secondaryLabel;connection.secondaryRate=cm.secondaryRate??connection.secondaryRate}
 const permitDone=permits.filter(x=>{const s=norm(x.permitStatus);return s.includes('لا يتطلب')||s.includes('تم اصدار')||s.includes('تم الاصدار')||s.includes('صدر')||s.includes('معتمد')}).length;
 const permit=metric('permits',permits,pct(permitDone,permits.length),permitDone,'تصريح مكتمل',pct(permitDone,permits.length),'صادر / معتمد / لا يتطلب');
 const emDone=emergency.filter(x=>isDone(x.status)).length;
 const emergencyMetric=metric('emergency',emergency,pct(emDone,emergency.length),emDone,'إشعار منجز',pct(emDone,emergency.length),'الإنجاز الفني للإشعارات');
 const sections=[project,connection,permit,emergencyMetric];
 const pEx=avgPct(projects,'excavationProgress'),pExt=avgPct(projects,'extensionProgress');
 const cEx=avgPct(connections,'excavationProgress'),cExt=avgPct(connections,'extensionProgress');
 const constructionTotal=project.total+connection.total;
 const constructionCompleted=project.completed+connection.completed;
 const constructionPending=Math.max(0,constructionTotal-constructionCompleted);
 const constructionExecution=pct(constructionCompleted,constructionTotal);
 const constructionProgress=constructionTotal?r1(((project.rate*project.total)+(connection.rate*connection.total))/constructionTotal):0;
 return {
  sections,
  summary:{
   projects:{total:project.total,completed:project.completed,pending:Math.max(0,project.total-project.completed),rate:project.rate,executionRate:project.secondaryRate??pct(project.completed,project.total),excavation:pEx??0,extension:pExt??0},
   connections:{total:connection.total,completed:connection.completed,pending:Math.max(0,connection.total-connection.completed),rate:connection.rate,executionRate:connection.secondaryRate??pct(connection.completed,connection.total),excavation:cEx??0,extension:cExt??0},
   permits:{total:permit.total,completed:permit.completed,pending:Math.max(0,permit.total-permit.completed),rate:permit.rate},
   emergency:{total:emergencyMetric.total,completed:emergencyMetric.completed,pending:Math.max(0,emergencyMetric.total-emergencyMetric.completed),rate:emergencyMetric.rate},
   construction:{total:constructionTotal,completed:constructionCompleted,pending:constructionPending,executionRate:constructionExecution,progressRate:constructionProgress}
  }
 };
}
function dateVal(v){const s=t(v);if(!s)return null;let d;if(/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(s)){const a=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);d=new Date(+a[3],+a[2]-1,+a[1])}else d=new Date(s);return isNaN(d)?null:d}
function activity(period,previous){
 const from=new Date(period.from),to=new Date(period.to+'T23:59:59'),pf=new Date(previous.from),pt=new Date(previous.to+'T23:59:59');
 const defs=[['المشاريع','projects','assignedDate'],['التوصيلات','connections','assignedDate'],['التصاريح','permits','assignedDate'],['الطوارئ','emergency','assignedDate']];
 return defs.map(([label,key,field])=>{const rows=P.pages[key]?.rows||[],c=rows.filter(x=>{const d=dateVal(x[field]);return d&&d>=from&&d<=to}).length,p=rows.filter(x=>{const d=dateVal(x[field]);return d&&d>=pf&&d<=pt}).length;return {label,key,current:c,previous:p,delta:c-p}});
}
function group(rows,key,limit=10){const m=new Map();rows.forEach(x=>{const v=t(x[key])||'غير محدد';m.set(v,(m.get(v)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(x=>({name:x[0],count:x[1]}))}
function delayProfile(rows){const b={'ضمن المدة':0,'أوشكت المدة':0,'تأخير بسيط':0,'تأخير متوسط':0,'تأخير شديد':0,'موقوف/محول':0,'غير محدد':0};rows.forEach(x=>{const s=norm(x.delay);let k='غير محدد';if(s.includes('موقوف')||s.includes('محول'))k='موقوف/محول';else if(s.includes('ضمن المده'))k='ضمن المدة';else if(s.includes('اوشك'))k='أوشكت المدة';else if(s.includes('شديد')||s.includes('عالي'))k='تأخير شديد';else if(s.includes('متوسط'))k='تأخير متوسط';else if(s.includes('بسيط'))k='تأخير بسيط';b[k]++});return Object.entries(b).map(x=>({name:x[0],count:x[1]})).filter(x=>x.count)}
function baselineSection(snap,key){return (snap?.sections||[]).find(s=>s.key===key)||null}
function signed(v,dec=0){const x=Number(v||0),z=dec?r1(x):Math.round(x);return (z>0?'+':'')+z.toLocaleString('ar-SA')}
function liveCard(x){
 const pending=Math.max(0,Number(x.total||0)-Number(x.completed||0));
 return '<article class="stp-section-card stp-live-card" data-stp-page="'+e(x.page)+'"><div class="stp-card-head"><span>'+e(x.label)+'</span><span class="stp-delta live">مباشر</span></div><strong>'+r1(x.rate)+'%</strong><div class="stp-baseline-values stp-live-source"><span>قراءة حية من الشيتات</span></div><div class="stp-mini"><span><b>'+Number(x.total||0).toLocaleString('ar-SA')+'</b>إجمالي</span><span><b>'+Number(x.completed||0).toLocaleString('ar-SA')+'</b>مكتمل</span><span><b>'+pending.toLocaleString('ar-SA')+'</b>متبقي</span></div><small>الوضع الحالي أياً كان اليوم</small></article>'
}
function baselineCard(x,latest,previous){
 const a=baselineSection(previous,x.key),b=baselineSection(latest,x.key),has=!!(a&&b);
 const pair=has?(previous.label+' → '+latest.label):(latest?(latest.label+' • بانتظار خميس سابق'):'بانتظار أول لقطة خميس');
 if(!has)return '<article class="stp-section-card stp-baseline-card" data-stp-page="'+e(x.page)+'"><div class="stp-card-head"><span>'+e(x.label)+'</span><span class="stp-delta neutral">'+e(pair)+'</span></div><strong class="stp-delta-main neutral">—</strong><div class="stp-baseline-values"><span>لا يوجد خط أساس للمقارنة بعد</span></div><div class="stp-mini"><span><b>—</b>فرق الإجمالي</span><span><b>—</b>فرق المكتمل</span><span><b>—</b>فرق المتبقي</span></div><small>يظهر الفرق بعد توفر لقطة خميس سابقة</small></article>';
 const dr=r1(Number(b.rate||0)-Number(a.rate||0));
 const dt=Number(b.total||0)-Number(a.total||0),dc=Number(b.completed||0)-Number(a.completed||0);
 const ap=Math.max(0,Number(a.total||0)-Number(a.completed||0)),bp=Math.max(0,Number(b.total||0)-Number(b.completed||0)),dp=bp-ap;
 const cls=dr>0?'up':dr<0?'down':'neutral',arrow=dr>0?'↑':dr<0?'↓':'→';
 return '<article class="stp-section-card stp-baseline-card" data-stp-page="'+e(x.page)+'"><div class="stp-card-head"><span>'+e(x.label)+'</span><span class="stp-delta '+cls+'">'+e(pair)+'</span></div><strong class="stp-delta-main '+cls+'">'+arrow+' '+signed(dr,1)+' نقطة</strong><div class="stp-baseline-values"><span><small>'+e(previous.label)+'</small><b>'+r1(a.rate)+'%</b></span><i>←</i><span><small>'+e(latest.label)+'</small><b>'+r1(b.rate)+'%</b></span></div><div class="stp-mini"><span><b>'+signed(dt)+'</b>فرق الإجمالي</span><span><b>'+signed(dc)+'</b>فرق المكتمل</span><span><b>'+signed(dp)+'</b>فرق المتبقي</span></div><small>فرق الإغلاق الرسمي بين خطي الأساس</small></article>'
}
function breakdown(rows,key){const out={};(rows||[]).forEach(x=>{const v=t(x?.[key])||'غير محدد';out[v]=(out[v]||0)+1});return out}
const STP_TREND_COLORS=['#43a5ff','#ff5f7d','#f6a33b','#f4ca4d','#55d6a9','#9b7cff','#5ed1e8','#ff8f5c','#95a7bd','#c56cff','#7ddc6f','#e9a3ff'];
const STP_VALUE_LABELS={
 id:'stpValueLabels',
 afterDatasetsDraw(chart,args,opts){
  if(!opts||opts.enabled!==true)return;
  const ctx=chart.ctx,area=chart.chartArea,occupied=[];
  ctx.save();
  ctx.font='700 11px Cairo, Arial, sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.lineJoin='round';

  function rect(text,x,y){
   const w=ctx.measureText(text).width+5,h=15;
   return {left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2,x,y};
  }
  function hit(a,b){
   return !(a.right+3<=b.left||a.left-3>=b.right||a.bottom+3<=b.top||a.top-3>=b.bottom);
  }
  function place(label,x,y,color){
   const offsets=[[0,0],[0,-15],[0,15],[18,-10],[-18,-10],[18,10],[-18,10],[0,-30],[0,30]];
   for(const [dx,dy] of offsets){
    const px=x+dx,py=y+dy,r=rect(label,px,py);
    if(r.left<area.left+2||r.right>area.right-2||r.top<area.top+2||r.bottom>area.bottom-2)continue;
    if(occupied.some(o=>hit(r,o)))continue;
    occupied.push(r);
    ctx.lineWidth=3;
    ctx.strokeStyle='rgba(5,24,43,.78)';
    ctx.strokeText(label,px,py);
    ctx.fillStyle=color||'#ffffff';
    ctx.fillText(label,px,py);
    return true;
   }
   return false;
  }

  chart.data.datasets.forEach((ds,di)=>{
   const meta=chart.getDatasetMeta(di);
   if(meta.hidden)return;
   meta.data.forEach((pt,pi)=>{
    const showAll=(chart.data.labels?.length||0)<=Number(opts.maxAllPoints||5);
    if(!showAll&&pi!==meta.data.length-1)return;
    const raw=ds.data?.[pi];
    if(raw===null||raw===undefined||raw==='')return;
    const value=Number(raw);
    if(!Number.isFinite(value))return;
    const label=String(Math.round(value));
    const color=ds.borderColor||ds.backgroundColor||'#ffffff';
    place(label,pt.x+8,pt.y-10,color);
   });
  });
  ctx.restore();
 }
};
function drawBreakdownTrend(id,sectionKey,fieldKey){
 const h=P.history?.trend||[],maps=h.map(z=>z.summary?.stageBreakdowns?.[sectionKey]?.[fieldKey]||{});
 const cats=[...new Set(maps.flatMap(o=>Object.keys(o)))].sort((a,b)=>maps.reduce((n,o)=>n+Number(o[b]||0),0)-maps.reduce((n,o)=>n+Number(o[a]||0),0));
 const ds=cats.map((c,i)=>({label:c,data:maps.map(o=>Number(o[c]||0)),borderColor:STP_TREND_COLORS[i%STP_TREND_COLORS.length],backgroundColor:STP_TREND_COLORS[i%STP_TREND_COLORS.length],borderWidth:2,tension:.25,pointRadius:4,pointHoverRadius:6,fill:false}));
 chart(id,'line',h.map(z=>z.label),ds,{layout:{padding:{top:18,right:34,left:8,bottom:4}},plugins:{stpValueLabels:{enabled:true,maxAllPoints:5}},scales:{y:{beginAtZero:true,ticks:{color:'#91a7bf',precision:0},grid:{color:'rgba(255,255,255,.05)'}},x:{ticks:{color:'#91a7bf'},grid:{display:false}}}})
}
function destroyCharts(){Object.values(P.charts).forEach(c=>{try{c.destroy()}catch{}});P.charts={}}
function chart(id,type,labels,datasets,options={}){
 const el=document.getElementById(id);if(!el||typeof Chart==='undefined')return;
 const base={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#b9c9dc',usePointStyle:true,font:{family:'Cairo',size:9}}},tooltip:{rtl:true}}};
 const merged=Object.assign({},base,options);
 merged.plugins=Object.assign({},base.plugins,options.plugins||{});
 P.charts[id]=new Chart(el,{type,data:{labels,datasets},options:merged,plugins:[STP_VALUE_LABELS]});
}
function trendSeries(key,label){const h=P.history?.trend||[];return {label,data:h.map(x=>{if(key==='overall')return Number(x.overallRate||0);const m=(x.sections||[]).find(s=>s.key===key);return m?Number(m.rate||0):null}),borderWidth:2,tension:.3,spanGaps:true}}
function drawCharts(){
 destroyCharts();
 const yPct={min:0,max:100,ticks:{color:'#91a7bf',callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.05)'}};
 const h=P.history?.trend||[];
 chart('stpTrend','line',h.map(z=>z.label),[trendSeries('projects','المشاريع'),trendSeries('connections','التوصيلات'),trendSeries('permits','التصاريح'),trendSeries('emergency','الطوارئ')],{scales:{y:yPct,x:{ticks:{color:'#91a7bf'},grid:{display:false}}}});
 drawBreakdownTrend('stpProjectsStageTrend','projects','stage');
 drawBreakdownTrend('stpConnectionsStageTrend','connections','stage');
 drawBreakdownTrend('stpProjectsStageStatusTrend','projects','stageStatus');
 drawBreakdownTrend('stpConnectionsStageStatusTrend','connections','stageStatus');
}

function exportDateLabel(){
 try{return new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date())}catch{return new Date().toLocaleString('ar-SA')}
}
function exportRowsTable(){
 const rows=P.portfolio?.sections||[];
 const body=rows.map(x=>'<tr><td>'+e(x.label)+'</td><td>'+r1(x.rate)+'%</td><td>'+Number(x.total||0).toLocaleString('ar-SA')+'</td><td>'+Number(x.completed||0).toLocaleString('ar-SA')+'</td><td>'+Math.max(0,Number(x.total||0)-Number(x.completed||0)).toLocaleString('ar-SA')+'</td></tr>').join('');
 return '<section class="x-section"><h2>ملخص المؤشرات الحالية</h2><table><thead><tr><th>المتابعة</th><th>النسبة الحالية</th><th>الإجمالي</th><th>المكتمل</th><th>المتبقي</th></tr></thead><tbody>'+body+'</tbody></table></section>';
}
function exportHistoryTable(){
 const h=P.history?.trend||[];
 const cols=['projects','connections','permits','emergency'];
 const labels={projects:'المشاريع',connections:'التوصيلات',permits:'التصاريح',emergency:'الطوارئ'};
 const head='<th>الخميس</th>'+cols.map(k=>'<th>'+labels[k]+' %</th>').join('');
 const body=h.map(x=>'<tr><td>'+e(x.label||x.date||'')+'</td>'+cols.map(k=>{const m=(x.sections||[]).find(z=>z.key===k);return '<td>'+(m?r1(m.rate)+'%':'—')+'</td>'}).join('')+'</tr>').join('');
 return '<section class="x-section"><h2>اللقطات الأسبوعية</h2><table><thead><tr>'+head+'</tr></thead><tbody>'+(body||'<tr><td colspan="5">لا توجد لقطات خميس محفوظة بعد.</td></tr>')+'</tbody></table></section>';
}
function exportBreakdownTable(title,data){
 const entries=Object.entries(data||{}).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0));
 return '<section class="x-section"><h2>'+e(title)+'</h2><table><thead><tr><th>الحالة</th><th>العدد</th></tr></thead><tbody>'+(entries.length?entries.map(([k,v])=>'<tr><td>'+e(k)+'</td><td>'+Number(v||0).toLocaleString('ar-SA')+'</td></tr>').join(''):'<tr><td colspan="2">لا توجد بيانات.</td></tr>')+'</tbody></table></section>';
}
async function exportThursdayHtml(){
 const host=document.getElementById('stPortfolio'); if(!host||!P.loaded)return;
 const clone=host.cloneNode(true);
 clone.querySelectorAll('button').forEach(x=>x.remove());
 host.querySelectorAll('canvas').forEach(c=>{
  const cc=clone.querySelector('#'+c.id); if(!cc)return;
  try{const im=document.createElement('img');im.src=c.toDataURL('image/png',1);im.alt=c.id;im.className='x-chart-img';cc.replaceWith(im)}catch{}
 });
 let css='';
 try{css+=(await fetch('/smart-thursday-portfolio.css').then(r=>r.text()))+'\n'}catch{}
 try{css+=(await fetch('/smart-thursday.css').then(r=>r.text()))+'\n'}catch{}
 const pRows=P.pages.projects?.rows||[],cRows=P.pages.connections?.rows||[];
 const appendix=exportRowsTable()+exportHistoryTable()+
  exportBreakdownTable('مرحلة الإنجاز — المشاريع',breakdown(pRows,'stage'))+
  exportBreakdownTable('حالة المرحلة — المشاريع',breakdown(pRows,'stageStatus'))+
  exportBreakdownTable('مرحلة الإنجاز — التوصيلات',breakdown(cRows,'stage'))+
  exportBreakdownTable('حالة المرحلة — التوصيلات',breakdown(cRows,'stageStatus'));
 const title='تقرير الخميس الفني — '+(document.title||'PDC');
 const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(title)+'</title><style>'+
 'html,body{margin:0;background:#071d34;color:#e8f1fb;font-family:Cairo,Tahoma,Arial,sans-serif}body{padding:28px}.x-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:22px;padding:18px 20px;border:1px solid rgba(84,162,255,.25);border-radius:18px;background:#0a2a49}.x-head h1{margin:0 0 7px;font-size:26px}.x-head p{margin:0;color:#8ea4bd}.x-stamp{color:#72b0ff;font-weight:700;white-space:nowrap}.x-chart-img{width:100%;height:auto;display:block}.x-section{margin-top:22px;padding:16px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:#09213b}.x-section h2{font-size:17px;margin:0 0 12px}.x-section table{width:100%;border-collapse:collapse;font-size:12px}.x-section th,.x-section td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.08);text-align:right}.x-section th{color:#8fb4db;background:#0d2d4d}.x-note{margin-top:18px;color:#8097b1;font-size:11px}.stp-section-card{cursor:default!important}.stp-section-card:hover{transform:none!important}.stp-title button{display:none!important}@media print{body{padding:10px}.x-section,.stp-panel,.stp-section-card{break-inside:avoid}}'+css+'</style></head><body>'+
 '<header class="x-head"><div><h1>'+e(title)+'</h1><p>نسخة HTML ثابتة من بيانات الداشبورد وقت التصدير.</p></div><div class="x-stamp">تاريخ التصدير: '+e(exportDateLabel())+'</div></header>'+
 clone.outerHTML+appendix+'<div class="x-note">هذا التقرير لا يتصل بالشيت بعد التصدير؛ الأرقام والشارتات تمثل لحظة إنشاء الملف.</div></body></html>';
 const blob=new Blob(['\ufeff'+html],{type:'text/html;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 const date=new Date().toISOString().slice(0,10);
 a.href=url;a.download='Thursday-Technical-Report-'+date+'.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function reportChartSrc(id){
 const c=document.getElementById(id); if(!c)return '';
 try{return c.toDataURL('image/png',1)}catch{return ''}
}
function reportLightChartSrc(id,percentAxis=false){
 const source=P.charts?.[id];
 const original=document.getElementById(id);
 if(!source||typeof Chart==='undefined'){
  try{return original?.toDataURL('image/png',1)||''}catch{return ''}
 }
 const canvas=document.createElement('canvas');
 canvas.width=1500;canvas.height=560;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
 const labels=[...(source.data?.labels||[])];
 const datasets=(source.data?.datasets||[]).map((ds,i)=>{
  let style={};
  try{style=source.getDatasetMeta(i)?.controller?.getStyle?.(0,false)||{}}catch{}
  const color=ds.borderColor||style.borderColor||STP_TREND_COLORS[i%STP_TREND_COLORS.length];
  return {
   label:ds.label,
   data:[...(ds.data||[])],
   borderColor:color,
   backgroundColor:color,
   borderWidth:3,
   tension:.28,
   pointRadius:6,
   pointHoverRadius:6,
   pointBackgroundColor:color,
   pointBorderColor:'#ffffff',
   pointBorderWidth:2,
   spanGaps:true,
   fill:false
  };
 });
 const labelPlugin={
  id:'reportPointLabels',
  afterDatasetsDraw(chart){
   const c=chart.ctx,area=chart.chartArea,occupied=[];
   c.save();
   c.font='700 16px Tahoma, Arial, sans-serif';
   c.textAlign='center';
   c.textBaseline='middle';
   c.lineJoin='round';

   function rect(txt,x,y){
    const w=c.measureText(txt).width+7,h=21;
    return {left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2,x,y};
   }
   function hit(a,b){
    return !(a.right+5<=b.left||a.left-5>=b.right||a.bottom+5<=b.top||a.top-5>=b.bottom);
   }
   function drawLabel(txt,x,y,color){
    const offsets=[[0,0],[0,-24],[0,24],[34,-16],[-34,-16],[34,16],[-34,16],[0,-48],[0,48]];
    for(const [dx,dy] of offsets){
     const px=x+dx,py=y+dy,r=rect(txt,px,py);
     if(r.left<area.left+3||r.right>area.right-3||r.top<area.top+3||r.bottom>area.bottom-3)continue;
     if(occupied.some(o=>hit(r,o)))continue;
     occupied.push(r);
     c.lineWidth=4;
     c.strokeStyle='rgba(255,255,255,.88)';
     c.strokeText(txt,px,py);
     c.fillStyle=color||'#172b5f';
     c.fillText(txt,px,py);
     return true;
    }
    return false;
   }

   chart.data.datasets.forEach((ds,di)=>{
    const meta=chart.getDatasetMeta(di);if(meta.hidden)return;
    meta.data.forEach((pt,pi)=>{
     const showAll=(chart.data.labels?.length||0)<=5;
     if(!showAll&&pi!==meta.data.length-1)return;
     const raw=Number(ds.data?.[pi]);if(!Number.isFinite(raw))return;
     const txt=percentAxis?(raw.toFixed(1)+'%'):String(Math.round(raw));
     drawLabel(txt,pt.x+12,pt.y-15,ds.borderColor||'#172b5f');
    });
   });
   c.restore();
  }
 };
 const opts={
  responsive:false,
  animation:false,
  maintainAspectRatio:false,
  layout:{padding:{top:28,right:48,left:18,bottom:8}},
  plugins:{
   legend:{position:'bottom',labels:{color:'#324a67',usePointStyle:true,boxWidth:10,padding:14,font:{family:'Tahoma',size:13}}},
   tooltip:{enabled:false}
  },
  scales:{
   x:{ticks:{color:'#5e6d7f',font:{size:13}},grid:{display:false},border:{color:'#b9c4cf'}},
   y:{beginAtZero:true,max:percentAxis?100:undefined,ticks:{color:'#5e6d7f',font:{size:13},callback:percentAxis?(v=>v+'%'):undefined},grid:{color:'#e8edf2'},border:{color:'#b9c4cf'}}
  }
 };
 let tmp;
 try{
  tmp=new Chart(ctx,{type:'line',data:{labels,datasets},options:opts,plugins:[labelPlugin]});
  tmp.update('none');
  const out=canvas.toDataURL('image/png',1);
  tmp.destroy();return out;
 }catch(err){
  try{tmp?.destroy()}catch{}
  try{return original?.toDataURL('image/png',1)||''}catch{return ''}
 }
}
function reportBreakdown(title,data){
 const entries=Object.entries(data||{}).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0));
 const total=entries.reduce((sum,[,v])=>sum+Number(v||0),0);
 const rows=entries.length?entries.map(([k,v])=>'<tr><td>'+e(k)+'</td><td>'+Number(v||0).toLocaleString('ar-SA')+'</td><td>'+(total?pct(v,total):0)+'%</td></tr>').join(''):'<tr><td colspan="3">لا توجد بيانات</td></tr>';
 return '<section class="r-table-card"><h3>'+e(title)+'</h3><table><thead><tr><th>التصنيف</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
}
function reportBaselineCard(x,latest,previous){
 const a=baselineSection(previous,x.key),b=baselineSection(latest,x.key),has=!!(a&&b);
 const pendingA=a?Math.max(0,Number(a.total||0)-Number(a.completed||0)):0;
 const pendingB=b?Math.max(0,Number(b.total||0)-Number(b.completed||0)):0;
 if(!has)return '<article class="r-delta-card"><div class="r-delta-title">'+e(x.label)+'</div><div class="r-wait">بانتظار توفر لقطتي خميس رسميتين</div><div class="r-delta-mini"><span>فرق الإجمالي<b>—</b></span><span>فرق المكتمل<b>—</b></span><span>فرق المتبقي<b>—</b></span></div></article>';
 const dr=r1(Number(b.rate||0)-Number(a.rate||0)),dt=Number(b.total||0)-Number(a.total||0),dc=Number(b.completed||0)-Number(a.completed||0),dp=pendingB-pendingA;
 const cls=dr>0?'pos':dr<0?'neg':'flat',arrow=dr>0?'▲':dr<0?'▼':'●';
 return '<article class="r-delta-card"><div class="r-delta-title">'+e(x.label)+'</div><div class="r-delta-main '+cls+'">'+arrow+' '+signed(dr,1)+' نقطة</div><div class="r-pair"><span><small>'+e(previous.label)+'</small><b>'+r1(a.rate)+'%</b></span><i>←</i><span><small>'+e(latest.label)+'</small><b>'+r1(b.rate)+'%</b></span></div><div class="r-delta-mini"><span>فرق الإجمالي<b>'+signed(dt)+'</b></span><span>فرق المكتمل<b>'+signed(dc)+'</b></span><span>فرق المتبقي<b>'+signed(dp)+'</b></span></div></article>';
}
function exportThursdayReport(){
 if(!P.loaded||!P.portfolio)return;
 const win=window.open('','_blank');
 if(!win){alert('اسمح بالنوافذ المنبثقة لتصدير التقرير');return}

 const x=P.portfolio,h=P.history||{},trend=h.trend||[];
 const latest=trend.length?trend[trend.length-1]:null;
 const previous=trend.length>1?trend[trend.length-2]:null;
 const stamp=exportDateLabel();
 const city=document.querySelector('.brand-copy strong')?.textContent?.trim()||document.title||'PDC';
 const contract=document.querySelector('.brand-copy em')?.textContent?.trim()||'';
 const contractNo=contract.replace('رقم العقد:','').trim();
 const logo=location.origin+'/company-logo.png';
 const pRows=P.pages.projects?.rows||[];
 const cRows=P.pages.connections?.rows||[];
 const pageTitle='التقرير الأسبوعي لمتابعة الأداء الفني';
 const baselineText=previous&&latest?('مقارنة '+previous.label+' مع '+latest.label):'بانتظار اكتمال خط الأساس الأسبوعي';

 const chartSources={
  weekly:reportLightChartSrc('stpTrend',true),
  pStage:reportLightChartSrc('stpProjectsStageTrend',false),
  cStage:reportLightChartSrc('stpConnectionsStageTrend',false),
  pStatus:reportLightChartSrc('stpProjectsStageStatusTrend',false),
  cStatus:reportLightChartSrc('stpConnectionsStageStatusTrend',false)
 };

 function entries(rows,key){
  return Object.entries(breakdown(rows,key)||{})
   .map(function(v){return [v[0],Number(v[1]||0)]})
   .sort(function(a,b){return b[1]-a[1]});
 }
 function section(title,en){
  return '<div class="section-title"><h2>'+e(title)+'</h2><span>'+e(en)+'</span></div>';
 }
 function footer(pageNo,total){
  return '<footer class="footer"><span>شركة أبعاد الرؤية للاستشارات الهندسية</span><span>صفحة '+pageNo+' من '+total+'</span></footer>';
 }
 function header(pageNo,total,sub){
  return '<header class="header">'+
   '<img class="logo" src="'+logo+'">'+
   '<div class="title"><h1>'+e(pageTitle)+'</h1><p>Weekly Technical Performance Report</p><p>'+e(sub||city)+'</p></div>'+
   '<div class="meta"><b>'+e(contract)+'</b><span>'+e(stamp)+'</span></div>'+
   '</header>'+
   '<section class="report-info">'+
    '<span><b>المشروع:</b><em>'+e(city)+'</em></span>'+
    '<span><b>العقد:</b><em>'+e(contractNo)+'</em></span>'+
    '<span><b>تاريخ التقرير:</b><em>'+e(stamp)+'</em></span>'+
    '<span><b>الصفحة:</b><em>'+pageNo+' / '+total+'</em></span>'+
   '</section>';
 }
 function page(body,pageNo,total,sub){
  return '<main class="page">'+header(pageNo,total,sub)+body+footer(pageNo,total)+'</main>';
 }
 function chartCard(title,src,emptyText){
  return '<section class="chart-card"><h3>'+e(title)+'</h3>'+
   (src?'<div class="chart-image"><img src="'+src+'" alt="'+e(title)+'"></div>':'<div class="chart-empty">'+e(emptyText||'لا توجد بيانات كافية للرسم بعد')+'</div>')+
   '</section>';
 }
 function miniBars(title,data,limit=6){
  const list=(Array.isArray(data)?data:[]).slice(0,limit);
  const max=Math.max(1,...list.map(function(v){return Number(v[1]||0)}));
  const total=list.reduce(function(s,v){return s+Number(v[1]||0)},0);
  const rows=list.length?list.map(function(v){
   const value=Number(v[1]||0),width=Math.max(2,Math.min(100,value/max*100));
   return '<div class="mini-row"><span>'+e(v[0])+'</span><div class="mini-track"><i style="width:'+width.toFixed(1)+'%"></i></div><b>'+value.toLocaleString('ar-SA')+'</b></div>';
  }).join(''):'<div class="empty">لا توجد بيانات</div>';
  return '<section class="mini-card"><h3>'+e(title)+'</h3><div class="mini-list">'+rows+'</div></section>';
 }
 function tablePanel(title,data,compact=false){
  const list=Array.isArray(data)?data:[];
  const total=list.reduce(function(s,v){return s+Number(v[1]||0)},0);
  const rows=list.length?list.map(function(v){
   const value=Number(v[1]||0),share=total?(value/total*100):0;
   return '<tr><td>'+e(v[0])+'</td><td>'+value.toLocaleString('ar-SA')+'</td><td>'+share.toFixed(1)+'%</td></tr>';
  }).join(''):'<tr><td colspan="3">لا توجد بيانات</td></tr>';
  return '<section class="table-card '+(compact?'compact':'')+'"><h3>'+e(title)+'</h3><table><thead><tr><th>التصنيف</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
 }

 const kpis=(x.sections||[]).map(function(v){
  const pending=Math.max(0,Number(v.total||0)-Number(v.completed||0));
  return '<article class="kpi">'+
   '<div class="kpi-head"><span>'+e(v.label)+'</span><b>'+r1(v.rate)+'%</b></div>'+
   '<div class="kpi-mini">'+
    '<span><b>'+Number(v.total||0).toLocaleString('ar-SA')+'</b>إجمالي</span>'+
    '<span><b>'+Number(v.completed||0).toLocaleString('ar-SA')+'</b>مكتمل</span>'+
    '<span><b>'+pending.toLocaleString('ar-SA')+'</b>متبقي</span>'+
   '</div>'+
  '</article>';
 }).join('');

 const deltas=(x.sections||[]).map(function(v){return reportBaselineCard(v,latest,previous)}).join('');
 const pStage=entries(pRows,'stage');
 const cStage=entries(cRows,'stage');
 const pStatus=entries(pRows,'stageStatus');
 const cStatus=entries(cRows,'stageStatus');

 const hist=trend.slice(-8);
 const histRows=hist.length?hist.map(function(z){
  return '<tr><td>'+e(z.label||z.date||'')+'</td>'+
   ['projects','connections','permits','emergency'].map(function(k){
    const m=(z.sections||[]).find(function(a){return a.key===k});
    return '<td>'+(m?r1(m.rate)+'%':'—')+'</td>';
   }).join('')+
   '</tr>';
 }).join(''):'<tr><td colspan="5">لا توجد لقطات خميس محفوظة بعد.</td></tr>';

 const totalPages=4;

 const page1=
  section('1. الوضع الحالي','LIVE STATUS')+
  '<div class="kpi-grid">'+kpis+'</div>'+
  section('2. التغير الأسبوعي مقارنة بخط الأساس','THURSDAY BASELINE DELTA')+
  '<div class="delta-grid">'+deltas+'</div>'+
  section('3. الاتجاه الأسبوعي لنسبة الإنجاز','WEEKLY TREND')+
  chartCard('التغير الأسبوعي لنسب الإنجاز — المشاريع والتوصيلات والتصاريح والطوارئ',chartSources.weekly,'سيظهر الاتجاه الأسبوعي بعد توفر أول لقطة خميس رسمية');

 const page2=
  section('4. تريند مرحلة الإنجاز','STAGE TREND')+
  '<div class="charts-row">'+
   chartCard('تريند أعداد مرحلة الإنجاز — المشاريع',chartSources.pStage)+
   chartCard('تريند أعداد مرحلة الإنجاز — التوصيلات',chartSources.cStage)+
  '</div>'+
  '<div class="summary-row">'+
   miniBars('الوضع الحالي — مرحلة الإنجاز بالمشاريع',pStage,5)+
   miniBars('الوضع الحالي — مرحلة الإنجاز بالتوصيلات',cStage,5)+
  '</div>';

 const page3=
  section('5. تريند حالة المرحلة','STAGE STATUS TREND')+
  '<div class="charts-row">'+
   chartCard('تريند أعداد حالة المرحلة — المشاريع',chartSources.pStatus)+
   chartCard('تريند أعداد حالة المرحلة — التوصيلات',chartSources.cStatus)+
  '</div>'+
  '<div class="summary-row">'+
   miniBars('أعلى حالات المرحلة — المشاريع',pStatus,7)+
   miniBars('أعلى حالات المرحلة — التوصيلات',cStatus,7)+
  '</div>';

 const page4=
  section('6. الجداول التفصيلية','DETAIL TABLES')+
  '<div class="detail-stage-row">'+
   tablePanel('مرحلة الإنجاز — المشاريع',pStage,true)+
   tablePanel('مرحلة الإنجاز — التوصيلات',cStage,true)+
  '</div>'+
  '<div class="detail-status-row">'+
   tablePanel('حالة المرحلة — المشاريع',pStatus,true)+
   tablePanel('حالة المرحلة — التوصيلات',cStatus,true)+
  '</div>'+
  section('7. ملخص آخر اللقطات الأسبوعية','THURSDAY SNAPSHOTS')+
  '<section class="snapshot-card"><table><thead><tr><th>الخميس</th><th>المشاريع</th><th>التوصيلات</th><th>التصاريح</th><th>الطوارئ</th></tr></thead><tbody>'+histRows+'</tbody></table></section>';

 const css=
 '@page{size:A4 landscape;margin:0}'+
 '*{box-sizing:border-box}'+
 'html,body{margin:0;padding:0;background:#fff;color:#172b5f;font-family:Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
 'body{font-size:9px}'+
 '.page{width:297mm;height:210mm;position:relative;padding:6mm 9mm 14mm;overflow:hidden;background:#fff;break-after:page;page-break-after:always}'+
 '.page:last-child{break-after:auto;page-break-after:auto}'+
 '.page>*{position:relative;z-index:2}'+
 '.page:before{content:"";position:absolute;z-index:0;left:-20mm;bottom:-28mm;width:345mm;height:54mm;border-top:8mm solid #232d70;border-radius:50% 50% 0 0/100% 100% 0 0;transform:rotate(-1deg)}'+
 '.page:after{content:"";position:absolute;z-index:0;left:-18mm;bottom:-20mm;width:340mm;height:43mm;border-top:4.5mm solid #d9dde3;border-radius:50% 50% 0 0/100% 100% 0 0;transform:rotate(-1deg)}'+
 '.header{position:relative;min-height:22mm;text-align:center;padding-top:.5mm;margin-bottom:.5mm}'+
 '.logo{position:absolute;left:0;top:0;width:27mm;height:17mm;object-fit:contain;object-position:left top}'+
 '.title{padding:0 40mm}.title h1{position:relative;margin:0;color:#172b5f;font-size:18px;font-weight:900}'+
 '.title h1:after{content:"";display:block;width:72mm;height:1px;background:#f2a31b;margin:2.5mm auto 0}'+
 '.title h1:before{content:"";position:absolute;left:50%;top:9.6mm;width:3.6mm;height:3.6mm;background:#f2a31b;transform:translateX(-50%) rotate(45deg)}'+
 '.title p{margin:.8mm 0 0;color:#6e737b;font-size:8px;font-weight:700}'+
 '.meta{position:absolute;right:0;top:0;text-align:right;color:#172b5f;font-size:6.8px;min-width:48mm}.meta b{display:block;font-size:7.8px;margin-bottom:.6mm}'+
 '.report-info{position:relative;margin:0 0 2.5mm;border:1px solid #26396f;border-radius:2px;display:grid;grid-template-columns:repeat(4,1fr)}'+
 '.report-info:before{content:"بيانات التقرير";position:absolute;right:-1px;top:-5.7mm;background:#172b5f;color:#fff;padding:1.4mm 3.8mm;border-radius:2px 2px 0 0;font-weight:900;font-size:7.5px}'+
 '.report-info span{display:flex;align-items:center;justify-content:center;gap:1.3mm;min-height:7.5mm;border-left:1px solid #c8ced9;background:#f7f8fa}.report-info span:nth-child(even){background:#eef0f4}.report-info span:last-child{border-left:0}.report-info b{font-size:6.6px}.report-info em{font-style:normal;color:#273f6d;font-size:7px}'+
 '.section-title{display:flex;width:max-content;max-width:96%;align-items:center;gap:2.5mm;margin:2.2mm 0 0 auto;padding:1.35mm 3.2mm;border-radius:3px 3px 0 0;background:#172b5f;color:#fff}.section-title h2{margin:0;font-size:9px}.section-title span{font-size:5.7px;color:#dce5f1}.section-title+*{border-top:1px solid #26396f;padding-top:1.3mm}'+
 '.kpi-grid,.delta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2.3mm}.kpi,.r-delta-card{border:1px solid #26396f;border-radius:3px;padding:1.8mm;background:#fff;min-height:23mm}'+
 '.kpi-head{display:flex;flex-direction:column-reverse;align-items:center;gap:.6mm;font-weight:800}.kpi-head span{font-size:7.5px}.kpi-head b{font-size:16px;color:#f19500}'+
 '.kpi-mini,.r-delta-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:.8mm;margin-top:1.1mm}.kpi-mini span,.r-delta-mini span{background:#f4f5f7;border:1px solid #d9dde3;border-radius:2px;padding:.8mm;text-align:center;color:#667184;font-size:5.7px}.kpi-mini b,.r-delta-mini b{display:block;color:#172b5f;font-size:8px;margin-bottom:.2mm}'+
 '.r-delta-title{text-align:center;font-weight:900;font-size:7.5px}.r-delta-main{text-align:center;font-size:12px;font-weight:900;margin:1mm 0}.r-delta-main.pos{color:#148a5b}.r-delta-main.neg{color:#c64f58}.r-delta-main.flat{color:#f19500}.r-pair{display:grid;grid-template-columns:1fr auto 1fr;gap:.8mm;align-items:center;background:#f4f5f7;border:1px solid #d9dde3;border-radius:2px;padding:.7mm;margin-bottom:.8mm}.r-pair span{text-align:center}.r-pair small{display:block;color:#7a808a;font-size:5.4px}.r-pair b{display:block;font-size:7.6px}.r-pair i{font-style:normal;color:#f19500}.r-wait{height:8mm;display:flex;align-items:center;justify-content:center;color:#7a808a;background:#f4f5f7;border:1px solid #d9dde3;border-radius:2px;margin:1.1mm 0;font-size:5.7px}'+
 '.chart-card{border:1px solid #26396f;border-radius:3px;background:#fff;overflow:hidden;min-width:0}.chart-card h3{margin:0;padding:1.6mm 2.3mm;background:#172b5f;color:#fff;font-size:8.2px}.chart-image{height:58mm;padding:1.5mm;background:#fff}.chart-image img{width:100%;height:100%;object-fit:contain;display:block}.chart-empty{height:58mm;display:flex;align-items:center;justify-content:center;background:#f7f8fa;color:#7a808a;font-size:7px}'+
 '.page:first-of-type .chart-image,.page:first-of-type .chart-empty{height:43mm}'+
 '.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.summary-row{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:3mm}'+
 '.mini-card,.table-card,.snapshot-card{border:1px solid #26396f;border-radius:3px;background:#fff;overflow:hidden;min-width:0}.mini-card h3,.table-card h3{margin:0;padding:1.5mm 2.2mm;background:#172b5f;color:#fff;font-size:7.8px}.mini-list{padding:1.7mm 2.2mm}.mini-row{display:grid;grid-template-columns:32% 1fr auto;gap:1.5mm;align-items:center;margin-bottom:1mm;font-size:6.4px}.mini-row:last-child{margin-bottom:0}.mini-row>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mini-track{height:2.4mm;background:#eceff3;border-radius:10px;overflow:hidden}.mini-track i{display:block;height:100%;background:linear-gradient(90deg,#172b5f,#2f66a5,#f2a31b);border-radius:10px}.mini-row b{min-width:10mm;text-align:left;color:#172b5f;font-size:6.8px}'+
 '.detail-stage-row,.detail-status-row{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.detail-status-row{margin-top:2.5mm}'+
 'table{width:100%;border-collapse:collapse;table-layout:auto;font-size:6.3px}th{background:#eef0f4;color:#172b5f;padding:1mm;text-align:right;border:1px solid #c8ced9;font-weight:900}td{padding:.82mm 1mm;border:1px solid #d5d9e0;color:#263b64;line-height:1.15}tbody tr:nth-child(even){background:#fbfbfc}'+
 '.table-card.compact h3{padding:1.2mm 2mm;font-size:7.2px}.table-card.compact table{font-size:5.8px}.table-card.compact th,.table-card.compact td{padding:.62mm .8mm}.detail-stage-row .table-card{max-height:33mm}.detail-stage-row .table-card tbody tr:nth-child(n+7){display:none}.detail-status-row .table-card{height:82mm;overflow:hidden}'+
 '.snapshot-card{margin-top:0}.snapshot-card table{font-size:5.8px}.snapshot-card th,.snapshot-card td{padding:.65mm .8mm}'+
 '.empty{padding:5mm;text-align:center;color:#7a808a}'+
 '.footer{position:absolute;z-index:3;bottom:2.4mm;right:9mm;left:9mm;display:flex;justify-content:space-between;color:#777f8a;font-size:5.8px}'+
 '@media print{html,body{width:297mm}body{margin:0}.page{break-inside:avoid}}';

 const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+e(pageTitle)+'</title><style>'+css+'</style></head><body>'+
  page(page1,1,totalPages,city)+
  page(page2,2,totalPages,city+' — مرحلة الإنجاز')+
  page(page3,3,totalPages,city+' — حالة المرحلة')+
  page(page4,4,totalPages,city+' — التفاصيل واللقطات')+
  '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},950)});<\/script>'+
  '</body></html>';

 win.document.open();
 win.document.write(html);
 win.document.close();
}
function render(root,legacy){
 if(!root)return;
 let host=document.getElementById('stPortfolio');
 if(!host){host=document.createElement('section');host.id='stPortfolio';host.className='stp-root';const hero=root.querySelector('.st-hero');hero?hero.insertAdjacentElement('afterend',host):root.prepend(host)}
 if(P.loaded&&!P.loading&&Date.now()-P.loadedAt>180000){load(root,legacy,true);return}
 if(P.loading&&!P.loaded){host.innerHTML='<div class="stp-loading"><span></span><b>جاري تجميع مؤشرات الإنجاز الفني...</b><small>المشاريع، التوصيلات، التصاريح والطوارئ — كل مسار بصورة مستقلة</small></div>';return}
 if(P.error&&!P.loaded){host.innerHTML='<div class="stp-error">تعذر بناء الملخص التنفيذي: '+e(P.error)+'</div><button class="stp-retry" id="stpRetry">إعادة المحاولة</button>';document.getElementById('stpRetry').onclick=()=>{P.error='';load(root,legacy,true)};return}
 if(!P.loaded){host.innerHTML='<div class="stp-loading"><b>تهيئة الملخص التنفيذي...</b></div>';load(root,legacy);return}
 const x=P.portfolio,h=P.history||{},s=x.summary,trend=h.trend||[],latest=trend.length?trend[trend.length-1]:null,previous=trend.length>1?trend[trend.length-2]:null;
 host.innerHTML='<div class="stp-title"><div><span>TECHNICAL WEEKLY PULSE</span><h2>الملخص التنفيذي للإنجاز الفني</h2><p>المشاريع والتوصيلات والتصاريح والطوارئ تُعرض كلٌ على حدة. لا يوجد متوسط يجمع المسارات المختلفة.</p></div><div class="stp-actions"><button id="stpExportReport" class="stp-export-btn">⇩ تصدير تقرير</button><button id="stpRefresh">↻ تحديث شامل</button></div></div>'+
 '<div class="stp-section-head"><div><span>LIVE STATUS</span><h3>الوضع الحالي</h3></div><small>قراءة حية من الشيتات أياً كان اليوم — لا تعتمد على لقطة الخميس</small></div>'+
 '<div class="stp-section-grid stp-live-grid">'+x.sections.filter(v=>v.total).map(liveCard).join('')+'</div>'+
 '<div class="stp-section-head"><div><span>THURSDAY BASELINE DELTA</span><h3>الفرق بين خطي الأساس الأسبوعيين</h3></div><small>'+(previous&&latest?('مقارنة إغلاق '+previous.label+' مع '+latest.label):'تظهر الفروق بعد توفر لقطتي خميس رسميتين')+'</small></div>'+
 '<div class="stp-section-grid">'+x.sections.filter(v=>v.total||baselineSection(latest,v.key)||baselineSection(previous,v.key)).map(v=>baselineCard(v,latest,previous)).join('')+'</div>'+
 '<div class="stp-chart-grid">'+
 '<article class="stp-panel stp-wide"><div><span>WEEKLY TREND</span><h3>التغير الأسبوعي لكل متابعة بصورة مستقلة</h3></div><canvas id="stpTrend"></canvas></article>'+
 '<article class="stp-panel"><div><span>PROJECTS • STAGE</span><h3>تريند أعداد مرحلة الإنجاز — المشاريع</h3></div><canvas id="stpProjectsStageTrend"></canvas></article>'+
 '<article class="stp-panel"><div><span>CONNECTIONS • STAGE</span><h3>تريند أعداد مرحلة الإنجاز — التوصيلات</h3></div><canvas id="stpConnectionsStageTrend"></canvas></article>'+
 '<article class="stp-panel"><div><span>PROJECTS • STAGE STATUS</span><h3>تريند أعداد حالة المرحلة — المشاريع</h3></div><canvas id="stpProjectsStageStatusTrend"></canvas></article>'+
 '<article class="stp-panel"><div><span>CONNECTIONS • STAGE STATUS</span><h3>تريند أعداد حالة المرحلة — التوصيلات</h3></div><canvas id="stpConnectionsStageStatusTrend"></canvas></article>'+
 '</div>';
 document.getElementById('stpRefresh').onclick=()=>load(root,legacy,true);
 document.getElementById('stpExportReport').onclick=()=>exportThursdayReport();
 host.querySelectorAll('[data-stp-page]').forEach(c=>c.onclick=()=>{try{if(typeof openPage==='function')openPage(c.dataset.stpPage)}catch{}});
 setTimeout(()=>drawCharts(),20);
}
async function load(root,legacy,force=false){
 if(P.loading)return;
 P.loading=true;P.error='';
 if(force){P.loaded=false;P.pages={};P.portfolio=null;P.history=null}
 render(root,legacy);
 try{
  const result=await Promise.all(KEYS.map(async k=>{try{return [k,await rpc('getPageData',[k])]}catch{return [k,{rows:[]}]}}));
  P.pages=Object.fromEntries(result);P.portfolio=buildPortfolio();
  const payload={
   overallRate:P.portfolio.summary.construction.progressRate,totalOrders:P.portfolio.summary.construction.total,completed:P.portfolio.summary.construction.completed,
   sections:P.portfolio.sections.map(s=>({key:s.key,label:s.label,rate:s.rate,total:s.total,completed:s.completed})),
   summary:{constructionProgressRate:P.portfolio.summary.construction.progressRate,constructionExecutionRate:P.portfolio.summary.construction.executionRate,projects:P.portfolio.summary.projects,connections:P.portfolio.summary.connections,permits:P.portfolio.summary.permits,emergency:P.portfolio.summary.emergency,stageBreakdowns:{projects:{stage:breakdown(P.pages.projects?.rows||[],'stage'),stageStatus:breakdown(P.pages.projects?.rows||[],'stageStatus')},connections:{stage:breakdown(P.pages.connections?.rows||[],'stage'),stageStatus:breakdown(P.pages.connections?.rows||[],'stageStatus')}}}
  };
  try{P.history=await rpc('syncThursdayProgressHistory',[payload])}catch(err){P.history={ok:false,error:err.message,trend:[],sectionChanges:[],overallDelta:null}}
  P.loaded=true;P.loadedAt=Date.now();
 }catch(err){
  P.loaded=false;P.error=err?.message||String(err);
 }finally{
  P.loading=false;render(root,legacy);
 }
}
window.renderSmartThursdayPortfolio=(root,legacy)=>render(root,legacy);
document.addEventListener('click',ev=>{
 const b=ev.target.closest?.('.nav-item[data-page="smartThursday"]');
 if(!b)return;
 setTimeout(()=>{const root=document.getElementById('smartThursdayReport');const p=(typeof S!=='undefined'&&S.page?.report)?S.page.report:null;if(root&&p)render(root,p)},500);
});
setTimeout(()=>{const root=document.getElementById('smartThursdayReport');const p=(typeof S!=='undefined'&&S.current==='smartThursday'&&S.page?.report)?S.page.report:null;if(root&&p)render(root,p)},0);
})();
