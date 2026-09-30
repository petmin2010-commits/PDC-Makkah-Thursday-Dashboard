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
function deltaBadge(v){if(v==null)return '<span class="stp-delta neutral">بدون خط أساس</span>';const cls=v>0?'up':v<0?'down':'neutral',a=v>0?'↑':v<0?'↓':'→';return '<span class="stp-delta '+cls+'">'+a+' '+(v>0?'+':'')+r1(v)+' نقطة</span>'}
function card(x,change){const pending=Math.max(0,x.total-x.completed);return '<article class="stp-section-card" data-stp-page="'+e(x.page)+'"><div class="stp-card-head"><span>'+e(x.label)+'</span>'+deltaBadge(change?.delta)+'</div><strong>'+r1(x.rate)+'%</strong><div class="stp-progress"><i style="width:'+Math.max(0,Math.min(100,x.rate))+'%"></i></div><div class="stp-mini"><span><b>'+x.total.toLocaleString('ar-SA')+'</b>إجمالي</span><span><b>'+x.completed.toLocaleString('ar-SA')+'</b>مكتمل</span><span><b>'+pending.toLocaleString('ar-SA')+'</b>متبقي</span></div><small>'+e(x.secondaryLabel)+(x.secondaryRate==null?'':': '+r1(x.secondaryRate)+'%')+'</small><em>'+e(x.note||'')+'</em></article>'}
function destroyCharts(){Object.values(P.charts).forEach(c=>{try{c.destroy()}catch{}});P.charts={}}
function chart(id,type,labels,datasets,options={}){
 const el=document.getElementById(id);if(!el||typeof Chart==='undefined')return;
 const base={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#b9c9dc',usePointStyle:true,font:{family:'Cairo',size:9}}},tooltip:{rtl:true}}};
 P.charts[id]=new Chart(el,{type,data:{labels,datasets},options:Object.assign(base,options)});
}
function trendSeries(key,label){const h=P.history?.trend||[];return {label,data:h.map(x=>{if(key==='overall')return Number(x.overallRate||0);const m=(x.sections||[]).find(s=>s.key===key);return m?Number(m.rate||0):null}),borderWidth:2,tension:.3,spanGaps:true}}
function drawCharts(activityRows){
 destroyCharts();const x=P.portfolio,s=x.summary;
 const yPct={min:0,max:100,ticks:{color:'#91a7bf',callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.05)'}};
 const yCount={beginAtZero:true,ticks:{color:'#91a7bf',precision:0},grid:{color:'rgba(255,255,255,.05)'}};
 chart('stpSections','bar',x.sections.map(v=>v.label),[{label:'نسبة الإنجاز',data:x.sections.map(v=>v.rate),backgroundColor:'rgba(71,145,255,.72)'}],{indexAxis:'y',scales:{x:yPct,y:{ticks:{color:'#c5d4e6'},grid:{display:false}}}});
 const h=P.history?.trend||[];
 chart('stpTrend','line',h.map(z=>z.label),[trendSeries('projects','المشاريع'),trendSeries('connections','التوصيلات'),trendSeries('permits','التصاريح'),trendSeries('emergency','الطوارئ')],{scales:{y:yPct,x:{ticks:{color:'#91a7bf'},grid:{display:false}}}});
 chart('stpActivity','bar',activityRows.map(a=>a.label),[{label:'هذا الأسبوع',data:activityRows.map(a=>a.current),backgroundColor:'rgba(71,145,255,.78)'},{label:'الأسبوع السابق',data:activityRows.map(a=>a.previous),backgroundColor:'rgba(139,157,181,.45)'}],{indexAxis:'y',scales:{x:yCount,y:{ticks:{color:'#c5d4e6'},grid:{display:false}}}});
 chart('stpWoStatus','doughnut',['مكتمل','متبقي'],[{data:[s.construction.completed,s.construction.pending],backgroundColor:['#2fc88f','#f1b44c']}],{cutout:'66%'});
 const support=[['حفر المشاريع',s.projects.excavation],['تمديد المشاريع',s.projects.extension],['حفر التوصيلات',s.connections.excavation],['تمديد التوصيلات',s.connections.extension]];
 chart('stpSupport','bar',support.map(v=>v[0]),[{label:'نسبة الإنجاز الفني',data:support.map(v=>v[1]),backgroundColor:'rgba(87,212,175,.68)'}],{scales:{y:yPct,x:{ticks:{color:'#c5d4e6'},grid:{display:false}}}});
 const d=delayProfile([...(P.pages.projects?.rows||[]),...(P.pages.connections?.rows||[])]);chart('stpDelay','doughnut',d.map(v=>v.name),[{data:d.map(v=>v.count)}],{cutout:'58%'});
 const stage=group([...(P.pages.projects?.rows||[]),...(P.pages.connections?.rows||[])],'stage',9);
 chart('stpStages','bar',stage.map(v=>v.name),[{label:'عدد أوامر الإنشاءات',data:stage.map(v=>v.count),backgroundColor:'rgba(137,102,255,.68)'}],{indexAxis:'y',scales:{x:yCount,y:{ticks:{color:'#c5d4e6'},grid:{display:false}}}});
}
function render(root,legacy){
 if(!root)return;
 let host=document.getElementById('stPortfolio');
 if(!host){host=document.createElement('section');host.id='stPortfolio';host.className='stp-root';const hero=root.querySelector('.st-hero');hero?hero.insertAdjacentElement('afterend',host):root.prepend(host)}
 if(P.loaded&&!P.loading&&Date.now()-P.loadedAt>180000){load(root,legacy,true);return}
 if(P.loading&&!P.loaded){host.innerHTML='<div class="stp-loading"><span></span><b>جاري تجميع مؤشرات الإنجاز الفني...</b><small>المشاريع، التوصيلات، التصاريح والطوارئ — كل مسار بصورة مستقلة</small></div>';return}
 if(P.error&&!P.loaded){host.innerHTML='<div class="stp-error">تعذر بناء الملخص التنفيذي: '+e(P.error)+'</div><button class="stp-retry" id="stpRetry">إعادة المحاولة</button>';document.getElementById('stpRetry').onclick=()=>{P.error='';load(root,legacy,true)};return}
 if(!P.loaded){host.innerHTML='<div class="stp-loading"><b>تهيئة الملخص التنفيذي...</b></div>';load(root,legacy);return}
 const x=P.portfolio,h=P.history||{},s=x.summary,activityRows=activity(legacy.period,legacy.previousPeriod),changes=new Map((h.sectionChanges||[]).map(v=>[v.key,v]));
 host.innerHTML='<div class="stp-title"><div><span>TECHNICAL WEEKLY PULSE</span><h2>الملخص التنفيذي للإنجاز الفني</h2><p>المشاريع والتوصيلات والتصاريح والطوارئ تُعرض كلٌ على حدة. لا يوجد متوسط يجمع المسارات المختلفة.</p></div><button id="stpRefresh">↻ تحديث شامل</button></div>'+
 '<div class="stp-top-kpis">'+[
 ['متابعة المشاريع',s.projects.rate+'%','<span class="stp-tag">إجمالي '+s.projects.total.toLocaleString('ar-SA')+'</span>','مكتمل '+s.projects.completed.toLocaleString('ar-SA')+' • متبقي '+s.projects.pending.toLocaleString('ar-SA')],
 ['متابعة التوصيلات',s.connections.rate+'%','<span class="stp-tag">إجمالي '+s.connections.total.toLocaleString('ar-SA')+'</span>','مكتمل '+s.connections.completed.toLocaleString('ar-SA')+' • متبقي '+s.connections.pending.toLocaleString('ar-SA')],
 ['متابعة التصاريح',s.permits.rate+'%','<span class="stp-tag">إجمالي '+s.permits.total.toLocaleString('ar-SA')+'</span>','مكتمل '+s.permits.completed.toLocaleString('ar-SA')+' • متبقي '+s.permits.pending.toLocaleString('ar-SA')],
 ['متابعة الطوارئ',s.emergency.rate+'%','<span class="stp-tag">إجمالي '+s.emergency.total.toLocaleString('ar-SA')+'</span>','منجز '+s.emergency.completed.toLocaleString('ar-SA')+' • متبقي '+s.emergency.pending.toLocaleString('ar-SA')]
 ].map(v=>'<article><span>'+v[0]+'</span><strong>'+v[1]+'</strong>'+v[2]+'<small>'+v[3]+'</small></article>').join('')+'</div>'+
 '<div class="stp-section-head"><div><span>SEPARATE FOLLOW-UP</span><h3>المتابعات الفنية المستقلة</h3></div><small>لا يتم خلط نسب المشاريع والتوصيلات والتصاريح والطوارئ</small></div>'+
 '<div class="stp-section-grid">'+x.sections.filter(v=>v.total).map(v=>card(v,changes.get(v.key))).join('')+'</div>'+
 '<div class="stp-chart-grid">'+
 '<article class="stp-panel stp-wide"><div><span>WEEKLY TREND</span><h3>التغير الأسبوعي لكل متابعة بصورة مستقلة</h3></div><canvas id="stpTrend"></canvas></article>'+
 '<article class="stp-panel stp-wide"><div><span>CURRENT PROGRESS</span><h3>نسب الإنجاز الحالية — بدون تجميع</h3></div><canvas id="stpSections"></canvas></article>'+
 '<article class="stp-panel stp-wide"><div><span>WEEKLY ACTIVITY</span><h3>حجم المتابعة هذا الأسبوع مقابل الأسبوع السابق</h3></div><canvas id="stpActivity"></canvas></article>'+
 '<article class="stp-panel"><div><span>CONSTRUCTION STATUS</span><h3>حالة الإنشاءات (مشاريع & توصيلات)</h3></div><canvas id="stpWoStatus"></canvas></article>'+
 '<article class="stp-panel"><div><span>EXCAVATION & EXTENSION</span><h3>الحفر والتمديد — مشاريع مقابل توصيلات</h3></div><canvas id="stpSupport"></canvas></article>'+
 '<article class="stp-panel"><div><span>CONSTRUCTION DELAY</span><h3>شرائح التأخير — الإنشاءات فقط</h3></div><canvas id="stpDelay"></canvas></article>'+
 '<article class="stp-panel"><div><span>CONSTRUCTION STAGES</span><h3>مراحل التنفيذ — الإنشاءات فقط</h3></div><canvas id="stpStages"></canvas></article>'+
 '</div>'+
 '<section class="stp-construction-final"><div class="stp-section-head"><div><span>FINAL CONSTRUCTION SUMMARY</span><h3>الإنشاءات (مشاريع & توصيلات)</h3></div><small>هذا هو التجميع الوحيد في التقرير</small></div>'+
 '<div class="stp-construction-grid">'+
 '<article><span>إجمالي الإنشاءات</span><strong>'+s.construction.total.toLocaleString('ar-SA')+'</strong><small>مشاريع '+s.projects.total.toLocaleString('ar-SA')+' + توصيلات '+s.connections.total.toLocaleString('ar-SA')+'</small></article>'+
 '<article><span>المكتمل</span><strong>'+s.construction.completed.toLocaleString('ar-SA')+'</strong><small>إجمالي المكتمل بالمشاريع والتوصيلات</small></article>'+
 '<article><span>المتبقي</span><strong>'+s.construction.pending.toLocaleString('ar-SA')+'</strong><small>إجمالي غير المكتمل</small></article>'+
 '<article><span>نسبة التنفيذ المكتمل</span><strong>'+s.construction.executionRate+'%</strong><small>المكتمل ÷ إجمالي الإنشاءات</small></article>'+
 '<article><span>نسبة التقدم الفني المجمعة</span><strong>'+s.construction.progressRate+'%</strong><small>متوسط موزون حسب عدد أوامر المشاريع والتوصيلات</small></article>'+
 '</div></section>'+
 '<div class="stp-foot"><b>الذاكرة الأسبوعية:</b> كل متابعة تحفظ نسبتها منفصلة، بينما الإنشاءات تجمع المشاريع والتوصيلات فقط.</div>';
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
   overallRate:P.portfolio.summary.construction.progressRate,totalOrders:P.portfolio.summary.construction.total,completed:P.portfolio.summary.construction.completed,
   sections:P.portfolio.sections.map(s=>({key:s.key,label:s.label,rate:s.rate,total:s.total,completed:s.completed})),
   summary:{constructionProgressRate:P.portfolio.summary.construction.progressRate,constructionExecutionRate:P.portfolio.summary.construction.executionRate,projects:P.portfolio.summary.projects,connections:P.portfolio.summary.connections,permits:P.portfolio.summary.permits,emergency:P.portfolio.summary.emergency}
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
