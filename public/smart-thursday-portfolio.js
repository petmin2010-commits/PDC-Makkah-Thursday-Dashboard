(function(){
'use strict';
const P={loaded:false,loading:false,loadedAt:0,pages:{},portfolio:null,history:null,charts:{}};
const KEYS=['workorders','projects','connections','permits','operations','assets','emergency'];
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
 const g=k=>(P.pages[k]?.rows||[]),wo=g('workorders'),projects=g('projects'),connections=g('connections'),permits=g('permits'),operations=g('operations'),assets=g('assets'),emergency=g('emergency');
 const woMetric=window.VDKpiLogic?.metric?.('workorders',wo);
 const done=woMetric?woMetric.completed:wo.filter(x=>isDone(x.status)).length;
 const stopped=wo.filter(x=>{const s=norm(x.status);return s.includes('موقوف')||s.includes('محول')}).length;
 const pending=Math.max(0,wo.length-done-stopped),executionRate=woMetric?woMetric.rate:pct(done,wo.length);
 const permitDone=permits.filter(x=>{const s=norm(x.permitStatus);return s.includes('لا يتطلب')||s.includes('تم اصدار')||s.includes('تم الاصدار')||s.includes('صدر')||s.includes('معتمد')}).length;
 const assetDone=assets.filter(x=>isDone(x.orderFollowStatus)).length;
 const emDone=emergency.filter(x=>isDone(x.status)).length;
 const sections=[
  projectMetric('projects',projects),
  projectMetric('connections',connections),
  metric('permits',permits,pct(permitDone,permits.length),permitDone,'تصريح مكتمل',pct(permitDone,permits.length),'صادر / معتمد / لا يتطلب'),
  projectMetric('operations',operations),
  metric('assets',assets,pct(assetDone,assets.length),assetDone,'تم التنفيذ',pct(assetDone,assets.length),'حسب حالة الأمر وفق متابعة المهندس'),
  metric('emergency',emergency,pct(emDone,emergency.length),emDone,'إشعار منجز',pct(emDone,emergency.length),'الإنجاز الفني للإشعارات')
 ];
 sections.forEach(s=>{if(!['projects','connections','operations'].includes(s.key))return;const m=window.VDKpiLogic?.metric?.(s.key,g(s.key));if(!m)return;s.rate=m.rate;s.completed=m.completed;if(m.secondaryLabel)s.secondaryLabel=m.secondaryLabel;if(m.secondaryRate!=null)s.secondaryRate=m.secondaryRate;});
 const core=sections.filter(x=>x.total);
 const portfolioRate=core.length?r1(core.reduce((s,x)=>s+x.rate,0)/core.length):0;
 const pEx=avgPct(projects,'excavationProgress'),pExt=avgPct(projects,'extensionProgress');
 const cEx=avgPct(connections,'excavationProgress'),cExt=avgPct(connections,'extensionProgress');
 return {
  sections,
  summary:{totalOrders:wo.length,completed:done,pending,stopped,executionRate,portfolioRate,
   projectsRate:sections.find(x=>x.key==='projects')?.rate||0,
   connectionsRate:sections.find(x=>x.key==='connections')?.rate||0,
   permitsRate:sections.find(x=>x.key==='permits')?.rate||0,
   operationsRate:sections.find(x=>x.key==='operations')?.rate||0,
   assetsRate:sections.find(x=>x.key==='assets')?.rate||0,
   emergencyRate:sections.find(x=>x.key==='emergency')?.rate||0,
   projectExcavation:pEx??0,projectExtension:pExt??0,connectionExcavation:cEx??0,connectionExtension:cExt??0},
  workorders:wo
 };
}
function dateVal(v){const s=t(v);if(!s)return null;let d;if(/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(s)){const a=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);d=new Date(+a[3],+a[2]-1,+a[1])}else d=new Date(s);return isNaN(d)?null:d}
function activity(period,previous){
 const from=new Date(period.from),to=new Date(period.to+'T23:59:59'),pf=new Date(previous.from),pt=new Date(previous.to+'T23:59:59');
 const defs=[['أوامر العمل المسندة','workorders','assignedDate'],['المشاريع المسندة','projects','assignedDate'],['التوصيلات المسندة','connections','assignedDate'],['طلبات التصاريح','permits','assignedDate'],['عمليات الإنشاءات','operations','assignedDate'],['إشعارات الطوارئ','emergency','assignedDate']];
 return defs.map(([label,key,field])=>{const rows=P.pages[key]?.rows||[],c=rows.filter(x=>{const d=dateVal(x[field]);return d&&d>=from&&d<=to}).length,p=rows.filter(x=>{const d=dateVal(x[field]);return d&&d>=pf&&d<=pt}).length;return {label,key,current:c,previous:p,delta:c-p}});
}
function group(rows,key,limit=10){const m=new Map();rows.forEach(x=>{const v=t(x[key])||'غير محدد';m.set(v,(m.get(v)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(x=>({name:x[0],count:x[1]}))}
function delayProfile(rows){const b={'ضمن المدة':0,'أوشكت المدة':0,'تأخير بسيط':0,'تأخير متوسط':0,'تأخير شديد':0,'موقوف/محول':0,'غير محدد':0};rows.forEach(x=>{const s=norm(x.delay);let k='غير محدد';if(s.includes('موقوف')||s.includes('محول'))k='موقوف/محول';else if(s.includes('ضمن المده'))k='ضمن المدة';else if(s.includes('اوشك'))k='أوشكت المدة';else if(s.includes('شديد')||s.includes('عالي'))k='تأخير شديد';else if(s.includes('متوسط'))k='تأخير متوسط';else if(s.includes('بسيط'))k='تأخير بسيط';b[k]++});return Object.entries(b).map(x=>({name:x[0],count:x[1]})).filter(x=>x.count)}
function deltaBadge(v){if(v==null)return '<span class="stp-delta neutral">بدون خط أساس</span>';const cls=v>0?'up':v<0?'down':'neutral',a=v>0?'↑':v<0?'↓':'→';return '<span class="stp-delta '+cls+'">'+a+' '+(v>0?'+':'')+r1(v)+' نقطة</span>'}
function card(x,change){return '<article class="stp-section-card" data-stp-page="'+e(x.page)+'"><div class="stp-card-head"><span>'+e(x.label)+'</span>'+deltaBadge(change?.delta)+'</div><strong>'+r1(x.rate)+'%</strong><div class="stp-progress"><i style="width:'+Math.max(0,Math.min(100,x.rate))+'%"></i></div><small>'+x.completed.toLocaleString('ar-SA')+' / '+x.total.toLocaleString('ar-SA')+' • '+e(x.secondaryLabel)+(x.secondaryRate==null?'':': '+r1(x.secondaryRate)+'%')+'</small><em>'+e(x.note||'')+'</em></article>'}
function destroyCharts(){Object.values(P.charts).forEach(c=>{try{c.destroy()}catch{}});P.charts={}}
function chart(id,type,labels,datasets,options={}){
 const el=document.getElementById(id);if(!el||typeof Chart==='undefined')return;
 const base={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#b9c9dc',usePointStyle:true,font:{family:'Cairo',size:9}}},tooltip:{rtl:true}}};
 P.charts[id]=new Chart(el,{type,data:{labels,datasets},options:Object.assign(base,options)});
}
function trendSeries(key,label){const h=P.history?.trend||[];return {label,data:h.map(x=>{if(key==='overall')return Number(x.overallRate||0);const m=(x.sections||[]).find(s=>s.key===key);return m?Number(m.rate||0):null}),borderWidth:2,tension:.3,spanGaps:true}}
function drawCharts(activityRows){
 destroyCharts();const x=P.portfolio;
 const yPct={min:0,max:100,ticks:{color:'#91a7bf',callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.05)'}};
 const yCount={beginAtZero:true,ticks:{color:'#91a7bf',precision:0},grid:{color:'rgba(255,255,255,.05)'}};
 const active=x.sections.filter(s=>s.total);
 chart('stpSections','bar',active.map(s=>s.label),[{label:'نسبة التقدم',data:active.map(s=>s.rate),backgroundColor:'rgba(71,145,255,.72)'}],{indexAxis:'y',scales:{x:yPct,y:{ticks:{color:'#c5d4e6'},grid:{display:false}}}});
 const h=P.history?.trend||[];
 chart('stpTrend','line',h.map(z=>z.label),[trendSeries('overall','إنجاز أوامر العمل'),trendSeries('projects','المشاريع'),trendSeries('connections','التوصيلات'),trendSeries('permits','التصاريح'),trendSeries('operations','العمليات'),trendSeries('emergency','الطوارئ')],{scales:{y:yPct,x:{ticks:{color:'#91a7bf'},grid:{display:false}}}});
 chart('stpActivity','bar',activityRows.map(a=>a.label),[{label:'هذا الأسبوع',data:activityRows.map(a=>a.current),backgroundColor:'rgba(71,145,255,.78)'},{label:'الأسبوع السابق',data:activityRows.map(a=>a.previous),backgroundColor:'rgba(139,157,181,.45)'}],{indexAxis:'y',scales:{x:yCount,y:{ticks:{color:'#c5d4e6'},grid:{display:false}}}});
 chart('stpWoStatus','doughnut',['تم التنفيذ','لم يتم التنفيذ','موقوف / محول'],[{data:[x.summary.completed,x.summary.pending,x.summary.stopped],backgroundColor:['#2fc88f','#f1b44c','#7e8da3']}],{cutout:'66%'});
 const support=[['حفر المشاريع',x.summary.projectExcavation],['تمديد المشاريع',x.summary.projectExtension],['حفر التوصيلات',x.summary.connectionExcavation],['تمديد التوصيلات',x.summary.connectionExtension]];
 chart('stpSupport','bar',support.map(v=>v[0]),[{label:'نسبة الإنجاز الفني',data:support.map(v=>v[1]),backgroundColor:'rgba(87,212,175,.68)'}],{scales:{y:yPct,x:{ticks:{color:'#c5d4e6'},grid:{display:false}}}});
 const d=delayProfile([...(P.pages.projects?.rows||[]),...(P.pages.connections?.rows||[])]);chart('stpDelay','doughnut',d.map(v=>v.name),[{data:d.map(v=>v.count)}],{cutout:'58%'});
 const stage=group([...(P.pages.projects?.rows||[]),...(P.pages.connections?.rows||[]),...(P.pages.operations?.rows||[])],'stage',9);
 chart('stpStages','bar',stage.map(v=>v.name),[{label:'عدد السجلات',data:stage.map(v=>v.count),backgroundColor:'rgba(137,102,255,.68)'}],{indexAxis:'y',scales:{x:yCount,y:{ticks:{color:'#c5d4e6'},grid:{display:false}}}});
}
function render(root,legacy){
 if(!root)return;
 let host=document.getElementById('stPortfolio');
 if(!host){host=document.createElement('section');host.id='stPortfolio';host.className='stp-root';const hero=root.querySelector('.st-hero');hero?hero.insertAdjacentElement('afterend',host):root.prepend(host)}
 if(P.loaded&&!P.loading&&Date.now()-P.loadedAt>180000){load(root,legacy,true);return}
 if(P.loading&&!P.loaded){host.innerHTML='<div class="stp-loading"><span></span><b>جاري تجميع مؤشرات الإنجاز الفني...</b><small>أوامر العمل، المشاريع، التوصيلات، التصاريح، العمليات، الأصول والطوارئ</small></div>';return}
 if(P.error&&!P.loaded){host.innerHTML='<div class="stp-error">تعذر بناء الملخص التنفيذي: '+e(P.error)+'</div><button class="stp-retry" id="stpRetry">إعادة المحاولة</button>';document.getElementById('stpRetry').onclick=()=>{P.error='';load(root,legacy,true)};return}
 if(!P.loaded){host.innerHTML='<div class="stp-loading"><b>تهيئة الملخص التنفيذي...</b></div>';load(root,legacy);return}
 const x=P.portfolio,h=P.history||{},activityRows=activity(legacy.period,legacy.previousPeriod),changes=new Map((h.sectionChanges||[]).map(v=>[v.key,v])),od=h.overallDelta;
 host.innerHTML='<div class="stp-title"><div><span>TECHNICAL WEEKLY PULSE</span><h2>الملخص التنفيذي للإنجاز الفني</h2><p>يركز هذا الجزء على التنفيذ الفعلي ونسب الإنجاز الفني فقط، دون الأرشفة أو جودة البيانات أو المؤشرات المالية.</p></div><button id="stpRefresh">↻ تحديث شامل</button></div>'+
 '<div class="stp-top-kpis">'+[
 ['إنجاز أوامر العمل',x.summary.executionRate+'%',deltaBadge(od),'تم التنفيذ من إجمالي أوامر العمل'],
 ['متوسط الإنجاز الفني',x.summary.portfolioRate+'%','<span class="stp-tag">6 مسارات فنية</span>','متوسط المشاريع والتوصيلات والتصاريح والعمليات والأصول والطوارئ'],
 ['إنجاز المشاريع',x.summary.projectsRate+'%','<span class="stp-tag">نسبة الإنجاز الكلية</span>','متوسط التقدم الفني بأوامر المشاريع'],
 ['إنجاز التوصيلات',x.summary.connectionsRate+'%','<span class="stp-tag">نسبة الإنجاز الكلية</span>','متوسط التقدم الفني بأوامر التوصيلات'],
 ['التصاريح المكتملة',x.summary.permitsRate+'%','<span class="stp-tag">صادر / معتمد / لا يتطلب</span>','نسبة الطلبات المستوفية فنيًا'],
 ['إنجاز العمليات',x.summary.operationsRate+'%','<span class="stp-tag">نسبة الإنجاز الكلية</span>','متوسط أعمال العمليات بالإنشاءات'],
 ['إنجاز الأصول',x.summary.assetsRate+'%','<span class="stp-tag">حالة التنفيذ</span>','حسب متابعة المهندس المسؤول'],
 ['إنجاز الطوارئ',x.summary.emergencyRate+'%','<span class="stp-tag">إشعارات منجزة</span>','المنجز من إجمالي إشعارات الطوارئ']
 ].map(v=>'<article><span>'+v[0]+'</span><strong>'+v[1]+'</strong>'+v[2]+'<small>'+v[3]+'</small></article>').join('')+'</div>'+
 '<div class="stp-section-head"><div><span>TECHNICAL PROGRESS</span><h3>تقدم المسارات الفنية</h3></div><small>اضغط على أي كارت للانتقال إلى التاب الأصلي</small></div>'+
 '<div class="stp-section-grid">'+x.sections.filter(s=>s.total).map(s=>card(s,changes.get(s.key))).join('')+'</div>'+
 '<div class="stp-chart-grid">'+
 '<article class="stp-panel stp-wide"><div><span>WEEKLY TREND</span><h3>التغير الأسبوعي لنسب الإنجاز</h3></div><canvas id="stpTrend"></canvas></article>'+
 '<article class="stp-panel stp-wide"><div><span>CURRENT PROGRESS</span><h3>نسبة التقدم الحالية حسب القسم</h3></div><canvas id="stpSections"></canvas></article>'+
 '<article class="stp-panel stp-wide"><div><span>WEEKLY ACTIVITY</span><h3>نشاط هذا الأسبوع مقابل الأسبوع السابق</h3></div><canvas id="stpActivity"></canvas></article>'+
 '<article class="stp-panel"><div><span>MASTER STATUS</span><h3>حالة أوامر العمل</h3></div><canvas id="stpWoStatus"></canvas></article>'+
 '<article class="stp-panel"><div><span>EXCAVATION & EXTENSION</span><h3>الحفر والتمديد الفني</h3></div><canvas id="stpSupport"></canvas></article>'+
 '<article class="stp-panel"><div><span>DELAY PROFILE</span><h3>شرائح التأخير</h3></div><canvas id="stpDelay"></canvas></article>'+
 '<article class="stp-panel"><div><span>EXECUTION STAGES</span><h3>توزيع مراحل التنفيذ</h3></div><canvas id="stpStages"></canvas></article>'+
 '</div>'+
 '<div class="stp-foot"><b>الذاكرة الأسبوعية:</b> '+((h.trend||[]).length?((h.trend||[]).length+' لقطة أسبوعية محفوظة'):'تم إنشاء خط الأساس الحالي')+' • المصدر التاريخي: '+e(h.sheet||'VD Thursday Progress')+'</div>';
 document.getElementById('stpRefresh').onclick=()=>load(root,legacy,true);
 host.querySelectorAll('[data-stp-page]').forEach(c=>c.onclick=()=>{try{if(typeof openPage==='function')openPage(c.dataset.stpPage)}catch{}});
 setTimeout(()=>drawCharts(activityRows),20);
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
   overallRate:P.portfolio.summary.executionRate,totalOrders:P.portfolio.summary.totalOrders,completed:P.portfolio.summary.completed,
   sections:P.portfolio.sections.map(s=>({key:s.key,label:s.label,rate:s.rate,total:s.total,completed:s.completed})),
   summary:{portfolioRate:P.portfolio.summary.portfolioRate,projectsRate:P.portfolio.summary.projectsRate,connectionsRate:P.portfolio.summary.connectionsRate,permitsRate:P.portfolio.summary.permitsRate,operationsRate:P.portfolio.summary.operationsRate,assetsRate:P.portfolio.summary.assetsRate,emergencyRate:P.portfolio.summary.emergencyRate}
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
