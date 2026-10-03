(()=>{
'use strict';
const root=()=>document.getElementById('employeeEvaluationRoot');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim(), norm=v=>clean(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
const pct=(a,b)=>b?Math.round(a/b*1000)/10:0, avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length*10)/10:0;
const unique=a=>[...new Set(a.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
const mfMatch=(v,s)=>window.VDMultiFilter?VDMultiFilter.match(v,s):(!s||s==='الكل'||v===s);
const mfActive=s=>Array.isArray(s)?s.length>0:!!s&&s!=='الكل';
const mfLabel=s=>Array.isArray(s)?(s.length===1?s[0]:s.length+' مهندسين'):s;
const num=v=>{const s=clean(v).replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/[۰-۹]/g,d=>'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]).replace(/,/g,'');const n=Number(s.replace(/[^\d.-]/g,''));return Number.isFinite(n)?Math.max(0,n):0};
const safetySummary=rows=>{const total=rows.reduce((s,r)=>s+num(r.safetyViolations),0),tasks=rows.length,withViolations=rows.filter(r=>num(r.safetyViolations)>0).length;return {total:Math.round(total*10)/10,tasks,withViolations,per100:tasks?Math.round(total/tasks*1000)/10:0,interventionPct:tasks?Math.round(withViolations/tasks*1000)/10:0}};
const state={rows:[],available:{},updatedAt:'',sheet:'',loaded:false,charts:{},cross:{band:'',metric:'',safety:''},filters:{engineer:'الكل',contractor:'الكل',workType:'الكل',owner:'الكل',from:'',to:'',search:''}};
const metricDefs=[
 {key:'advice',label:'اكتمال الإفادات',source:'T',avail:a=>a.advice,score:r=>{const s=norm(r.advice);return s&&!/لا ?يوجد.*افاد|لا ?توجد.*افاد/.test(s)?100:0}},
 {key:'attachments',label:'اكتمال المرفقات',source:'V/W',avail:a=>a.attachments,score:r=>docScore(r.attachments,r.attachmentsFix)},
 {key:'safetyElectronic',label:'السلامة الإلكتروني',source:'X/Z',avail:a=>a.safetyElectronic||a.safetyElectronicRate,score:r=>electronicScore(r)},
 {key:'safetyPaper',label:'السلامة الورقي',source:'AC/AD',avail:a=>a.safetyPaper,score:r=>docScore(r.safetyPaper,r.safetyPaperFix)},
 {key:'photos',label:'رفع الصور',source:'AE/AF',avail:a=>a.photos,score:r=>docScore(r.photos,r.photosFix)},
 {key:'supervision',label:'نماذج الإشراف',source:'AG/AH',avail:a=>a.supervision,score:r=>docScore(r.supervision,r.supervisionFix)},
 {key:'asBuilt',label:'As-Built',source:'AI/AJ',avail:a=>a.asBuilt,score:r=>docScore(r.asBuilt,r.asBuiltFix)},
 {key:'assets',label:'نماذج الأصول',source:'AK/AL',avail:a=>a.assets,score:r=>docScore(r.assets,r.assetsFix)}
];
function isDone(v){const s=norm(v);return !!s&&!s.includes('لم يتم')&&!s.includes('غير جاهز')&&!s.includes('غير مكتمل')}
function docScore(v,fix){if(isDone(v))return 100;const f=norm(fix);return f&&f.includes('تم')&&!f.includes('لم يتم')?100:0}
function electronicScore(r){const s=clean(r.safetyElectronicRate),n=Number(s.replace(',','.'));if(s&&Number.isFinite(n))return Math.max(0,Math.min(100,n));const z=norm(s);if(z.includes('تم المعالجه'))return 100;if(z.includes('لم يتم'))return 0;return docScore(r.safetyElectronic,r.safetyElectronicFix)}
function metrics(){return metricDefs.filter(m=>m.avail(state.available||{}))}
function parseTaskDate(v){const s=clean(v);if(!s)return null;let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);if(!m)return null;const a=+m[1],b=+m[2],y=+m[3];return a>12?new Date(y,b-1,a):b>12?new Date(y,a-1,b):new Date(y,a-1,b)}
function filtered(skipEngineer=false){const f=state.filters,q=norm(f.search),from=f.from?new Date(f.from+'T00:00:00'):null,to=f.to?new Date(f.to+'T23:59:59'):null;let out=state.rows.filter(r=>{if(!skipEngineer&&!mfMatch(r.engineer,f.engineer))return false;if(!mfMatch(r.contractor,f.contractor))return false;if(!mfMatch(r.workType,f.workType))return false;if(!mfMatch(r.owner,f.owner))return false;const d=parseTaskDate(r.taskDate);if(from&&(!d||d<from))return false;if(to&&(!d||d>to))return false;if(q&&!norm([r.engineer,r.workOrder,r.contractor,r.description,r.location,r.advice].join(' ')).includes(q))return false;return true});if(state.cross.metric){const m=metrics().find(x=>x.label===state.cross.metric);if(m)out=out.filter(r=>m.score(r)<100)}if(state.cross.safety==='with')out=out.filter(r=>num(r.safetyViolations)>0);if(state.cross.band){const allowed=new Set(engineerStats(out).filter(x=>band(x.overall)===state.cross.band).map(x=>x.name));out=out.filter(r=>allowed.has(clean(r.engineer)))}return out}
function metricAvg(rows,m){return rows.length?avg(rows.map(m.score)):0}
function rowScore(r){const ms=metrics();return ms.length?avg(ms.map(m=>m.score(r))):0}
function engineerStats(rows){const map=new Map();rows.forEach(r=>{const k=clean(r.engineer)||'غير محدد';if(!map.has(k))map.set(k,[]);map.get(k).push(r)});return [...map].map(([name,rs])=>{const values={};metrics().forEach(m=>values[m.key]=metricAvg(rs,m));const safety=safetySummary(rs);return {name,tasks:rs.length,overall:metrics().length?avg(metrics().map(m=>values[m.key])):0,values,safety,rows:rs}}).sort((a,b)=>b.overall-a.overall||b.tasks-a.tasks)}
function optionList(values,current){return ['الكل',...unique(values)].map(v=>'<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(v)+'</option>').join('')}
function band(v){return v>=90?'ممتاز':v>=80?'جيد جدًا':v>=70?'جيد':'يحتاج تحسين'}
function tone(v){return v>=90?'ok':v>=80?'good':v>=70?'warn':'bad'}
function card(label,value,sub,cls=''){return '<article class="ee-kpi '+cls+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub||'')+'</small></article>'}
function renderShell(rows,stats,benchmarkRows){
 const f=state.filters,ms=metrics(),overall=ms.length?avg(ms.map(m=>metricAvg(rows,m))):0;
 const safety=safetySummary(rows),benchmark=safetySummary(benchmarkRows||rows);
 const relative=benchmark.per100>0?Math.round((safety.per100-benchmark.per100)/benchmark.per100*1000)/10:null;
 const comparison=(mfActive(state.filters.engineer)&&relative!==null?' • '+(relative>=0?'أعلى':'أقل')+' من المتوسط بـ '+Math.abs(relative)+'%':'');
 const safetySub=safety.per100+' مخالفة لكل 100 مهمة • مهام بها مخالفة '+safety.interventionPct+'% • متوسط النطاق '+benchmark.per100+comparison;
 const cards=[card('مهندسو المواقع',stats.length,'ضمن الفلاتر الحالية','primary'),card('إجمالي المهام',rows.length,'صف من شيت المهام والإفادات','primary'),card('متوسط التقييم',overall+'%',band(overall),tone(overall)),...(state.available.safetyViolations?[card('الرقابة وفرض متطلبات السلامة',safety.total+' مخالفة',safetySub,'safety-audit')]:[]),...ms.map(m=>card(m.label,metricAvg(rows,m)+'%','المصدر '+m.source,tone(metricAvg(rows,m))))];
 const note=(ms.length===8?'التقييم الآلي = متوسط متساوي الوزن لثمانية مؤشرات مستخرجة من الشيت، ولا يشمل تقييم مدير المشروع الفني.':'التقييم يعتمد فقط على المؤشرات المتاحة فعليًا في ورقة المشروع الحالية ('+ms.length+' مؤشرات)، ولا يشمل تقييم مدير المشروع الفني.')+(state.available.safetyViolations?' مؤشر الرقابة على السلامة من العمود AB مستقل ولا يدخل في المتوسط العام.':'');
 return '<div class="ee-wrap"><section class="ee-hero"><div><span>EMPLOYEE PERFORMANCE • SITE ENGINEERS</span><h2>تقييم مهندسي المواقع</h2><p>تقييم آلي لمهندسي المواقع من ورقة «'+esc(state.sheet||'المهام والإفادات')+'» مع تحليل الإفادات ومتطلبات التوثيق.</p></div><div class="ee-meta"><small>آخر قراءة</small><b>'+esc(state.updatedAt||'—')+'</b></div></section>'+
 '<section class="ee-note"><b>منهجية الاحتساب</b><span>'+esc(note)+'</span></section>'+
 '<section class="ee-filter-panel"><div class="ee-filter-grid">'+
 '<label><span>المهندس</span><select id="eeEngineer">'+optionList(state.rows.map(r=>r.engineer),f.engineer)+'</select></label>'+
 '<label><span>المقاول</span><select id="eeContractor">'+optionList(state.rows.map(r=>r.contractor),f.contractor)+'</select></label>'+
 '<label><span>نوع أمر العمل</span><select id="eeWorkType">'+optionList(state.rows.map(r=>r.workType),f.workType)+'</select></label>'+
 '<label><span>الجهة</span><select id="eeOwner">'+optionList(state.rows.map(r=>r.owner),f.owner)+'</select></label>'+
 '<label><span>من تاريخ</span><input id="eeFrom" type="date" value="'+esc(f.from)+'"></label><label><span>إلى تاريخ</span><input id="eeTo" type="date" value="'+esc(f.to)+'"></label>'+
 '<label class="ee-search"><span>بحث شامل</span><input id="eeSearch" value="'+esc(f.search)+'" placeholder="مهندس، أمر عمل، مقاول، إفادة..."></label></div>'+
 '<div class="ee-actions"><button id="eeReset" class="ghost-btn">مسح الفلاتر</button><button id="eeRefresh" class="primary-btn">↻ تحديث البيانات</button><strong>'+rows.length+' مهمة مطابقة</strong>'+((state.cross.band||state.cross.metric||state.cross.safety)?'<span>تفاعلي: '+esc([state.cross.band,state.cross.metric,state.cross.safety==='with'?'بها مخالفات سلامة':''].filter(Boolean).join(' • '))+'</span>':'')+'</div></section>'+
 '<section class="ee-section-head"><div><span>PERFORMANCE KPIs</span><h3>مؤشرات تقييم مهندسي المواقع</h3></div></section><div class="ee-kpis">'+cards.join('')+'</div>'+
 '<div class="ee-charts"><article class="panel ee-chart wide"><div class="panel-title"><span>ENGINEER RANKING</span><h3>التقييم الإجمالي حسب المهندس</h3></div><div class="ee-canvas"><canvas id="eeRankingChart"></canvas></div></article>'+
 '<article class="panel ee-chart"><div class="panel-title"><span>METRICS</span><h3>متوسط المؤشرات</h3></div><div class="ee-canvas"><canvas id="eeMetricChart"></canvas></div></article>'+
 '<article class="panel ee-chart"><div class="panel-title"><span>PERFORMANCE BANDS</span><h3>توزيع مستويات التقييم</h3></div><div class="ee-canvas"><canvas id="eeBandChart"></canvas></div></article>'+
 (state.available.safetyViolations?'<article class="panel ee-chart"><div class="panel-title"><span>SAFETY ENFORCEMENT</span><h3>مخالفات السلامة لكل 100 مهمة</h3></div><div class="ee-canvas"><canvas id="eeSafetyChart"></canvas></div></article>':'')+'</div>'+
 renderEngineerTable(stats)+renderTaskDrilldown(rows)+'</div>';
}
function renderEngineerTable(stats){const ms=metrics(),hasSafety=!!state.available.safetyViolations;const safetyHead=hasSafety?'<th>مخالفات السلامة</th><th>لكل 100 مهمة</th><th>مهام بها مخالفة</th>':'';return '<section class="ee-section-head"><div><span>EMPLOYEE MATRIX</span><h3>مصفوفة تقييم الموظفين</h3></div><p>اضغط اسم المهندس لعرض مهامه فقط.</p></section><article class="panel"><div class="ee-table-wrap"><table class="ee-table"><thead><tr><th>#</th><th>المهندس</th><th>المهام</th>'+safetyHead+'<th>التقييم</th>'+ms.map(m=>'<th>'+esc(m.label)+'</th>').join('')+'</tr></thead><tbody>'+stats.map((x,i)=>{const safetyCells=hasSafety?'<td><b>'+x.safety.total+'</b></td><td><span class="ee-mini-score safety">'+x.safety.per100+'</span></td><td>'+x.safety.interventionPct+'%</td>':'';return '<tr><td>'+(i+1)+'</td><td><button class="ee-engineer-link" data-ee-engineer="'+esc(x.name)+'">'+esc(x.name)+'</button></td><td>'+x.tasks+'</td>'+safetyCells+'<td><b class="ee-score '+tone(x.overall)+'">'+x.overall+'%</b><small>'+band(x.overall)+'</small></td>'+ms.map(m=>'<td><span class="ee-mini-score '+tone(x.values[m.key])+'">'+x.values[m.key]+'%</span></td>').join('')+'</tr>'}).join('')+'</tbody></table></div></article>'}
function renderTaskDrilldown(rows){if(!mfActive(state.filters.engineer))return '';const recent=[...rows].sort((a,b)=>(parseTaskDate(b.taskDate)||0)-(parseTaskDate(a.taskDate)||0)).slice(0,100);return '<section class="ee-section-head"><div><span>TASK DRILLDOWN</span><h3>تفاصيل مهام '+esc(mfLabel(state.filters.engineer))+'</h3></div><p>آخر '+recent.length+' مهمة مطابقة للفلاتر.</p></section><article class="panel"><div class="ee-table-wrap"><table class="ee-table compact"><thead><tr><th>التاريخ</th><th>أمر العمل</th><th>المقاول</th><th>وصف المهمة</th><th>الإفادة</th><th>تقييم المهمة</th></tr></thead><tbody>'+recent.map(r=>'<tr><td>'+esc(r.taskDate||'—')+'</td><td><b>'+esc(r.workOrder||'—')+'</b></td><td>'+esc(r.contractor||'—')+'</td><td>'+esc(r.description||'—')+'</td><td class="ee-advice">'+esc(r.advice||'—')+'</td><td><b class="ee-score '+tone(rowScore(r))+'">'+rowScore(r)+'%</b></td></tr>').join('')+'</tbody></table></div></article>'}
function destroyCharts(){Object.values(state.charts).forEach(c=>{try{c.destroy()}catch{}});state.charts={}}
function draw(id,type,labels,data,opts={}){const el=document.getElementById(id);if(!el||typeof Chart==='undefined')return;const bg=type==='doughnut'?['#2878e8','#13a36d','#e6a500','#dc3d4b','#7a5af8','#00a6a6']: '#2878e8';const scales=type==='doughnut'?{}:(opts.horizontal?{x:{beginAtZero:true,max:opts.percent?100:undefined},y:{}}:{x:{},y:{beginAtZero:true,max:opts.percent?100:undefined}});state.charts[id]=new Chart(el,{type,data:{labels,datasets:[{label:opts.label||'%',data,borderWidth:1,backgroundColor:bg}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:opts.horizontal?'y':'x',plugins:{legend:{display:type==='doughnut'},tooltip:{callbacks:{label:c=>(c.dataset.label?c.dataset.label+': ':'')+c.raw+(opts.percent?'%':'')}}},scales}})}
function renderCharts(rows,stats){destroyCharts();const top=stats.slice(0,15);draw('eeRankingChart','bar',top.map(x=>x.name),top.map(x=>x.overall),{label:'التقييم',horizontal:true,percent:true});draw('eeMetricChart','bar',metrics().map(m=>m.label),metrics().map(m=>metricAvg(rows,m)),{label:'النسبة',percent:true});const bands={'ممتاز':0,'جيد جدًا':0,'جيد':0,'يحتاج تحسين':0};stats.forEach(x=>bands[band(x.overall)]++);draw('eeBandChart','doughnut',Object.keys(bands),Object.values(bands),{label:'مهندسون'});if(state.available.safetyViolations){const safetyTop=[...stats].sort((a,b)=>b.safety.per100-a.safety.per100).slice(0,15);draw('eeSafetyChart','bar',safetyTop.map(x=>x.name),safetyTop.map(x=>x.safety.per100),{label:'مخالفة لكل 100 مهمة',horizontal:true})}}
window.EmployeeEvaluationDashboard={
 filterFromChart(id,label){
  if(id==='eeRankingChart'||id==='eeSafetyChart'){const cur=Array.isArray(state.filters.engineer)?state.filters.engineer:[state.filters.engineer];state.filters.engineer=(cur.length===1&&cur[0]===label)?'الكل':[label];render();return true}
  if(id==='eeBandChart'){state.cross.band=state.cross.band===label?'':label;render();return true}
  if(id==='eeMetricChart'){state.cross.metric=state.cross.metric===label?'':label;render();return true}
  return false;
 },
 filterFromCard(label){
  const t=clean(label);if(!t)return false;
  if(t==='مهندسو المواقع'||t==='إجمالي المهام'){state.cross={band:'',metric:'',safety:''};render();return true}
  if(t==='متوسط التقييم'){const rs=filtered(),ms=metrics(),overall=ms.length?avg(ms.map(m=>metricAvg(rs,m))):0,b=band(overall);state.cross.band=state.cross.band===b?'':b;render();return true}
  if(t.includes('الرقابة وفرض متطلبات السلامة')){state.cross.safety=state.cross.safety==='with'?'':'with';render();return true}
  const m=metrics().find(x=>x.label===t);if(m){state.cross.metric=state.cross.metric===t?'':t;render();return true}
  return false;
 },
 clearInteractive(){state.cross={band:'',metric:'',safety:''};render()}
};
function bind(){
 const bindSel=(id,key)=>{const el=document.getElementById(id);if(el){if(el.tagName==='SELECT'&&window.VDMultiFilter)VDMultiFilter.enhance(el,{selected:state.filters[key],allText:'الكل'});el.onchange=()=>{state.filters[key]=(el.tagName==='SELECT'&&window.VDMultiFilter)?VDMultiFilter.values(el):el.value;render()}}};
 bindSel('eeEngineer','engineer');bindSel('eeContractor','contractor');bindSel('eeWorkType','workType');bindSel('eeOwner','owner');bindSel('eeFrom','from');bindSel('eeTo','to');
 const q=document.getElementById('eeSearch');if(q){let timer;q.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{state.filters.search=q.value;render()},180)}}
 document.getElementById('eeReset')?.addEventListener('click',()=>{state.filters={engineer:'الكل',contractor:'الكل',workType:'الكل',owner:'الكل',from:'',to:'',search:''};state.cross={band:'',metric:'',safety:''};render()});
 document.getElementById('eeRefresh')?.addEventListener('click',()=>load(true));
 document.querySelectorAll('[data-ee-engineer]').forEach(b=>b.onclick=()=>{state.filters.engineer=[b.dataset.eeEngineer];render();document.getElementById('employeeEvaluationRoot')?.scrollIntoView({behavior:'smooth',block:'start'})});
}
function render(){
 const host=root();if(!host)return;
 const rows=filtered(),benchmarkRows=filtered(true),stats=engineerStats(rows);
 host.innerHTML=renderShell(rows,stats,benchmarkRows);bind();requestAnimationFrame(()=>renderCharts(rows,stats));
}
async function load(force=false){
 const host=root();if(host&&!state.loaded)host.innerHTML='<div class="ee-loading"><div class="spinner"></div><b>جاري تحميل وتحليل بيانات المهام والإفادات...</b></div>';
 try{
  const r=await fetch('/api/hr/employee-evaluation'+(force?'?t='+Date.now():''));
  const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'تعذر تحميل بيانات تقييم الموظفين');
  state.rows=j.rows||[];state.available=j.available||{};state.updatedAt=j.updatedAt||'';state.sheet=j.sheet||'';state.loaded=true;render();
 }catch(e){if(host)host.innerHTML='<div class="ee-error">'+esc(e.message||e)+'</div>'}
}
function activate(){
 if(typeof S!=='undefined')S.current='employeeEvaluation';
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page==='employeeEvaluation'));
 ['masterPage','meetingPage','dataPage','importantLinksPage','hrStaffPage'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
 document.getElementById('employeeEvaluationPage')?.classList.add('active');
 const fb=document.getElementById('filterBar');if(fb)fb.style.display='none';
 const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='none';
 const title=document.getElementById('pageTitle');if(title)title.textContent='تقييم مهندسي المواقع';
 load(false);
}
if(typeof openPage==='function'){
 const previous=openPage;
 openPage=function(key){
  if(key==='employeeEvaluation'){activate();return}
  document.getElementById('employeeEvaluationPage')?.classList.remove('active');
  const fb=document.getElementById('filterBar');if(fb)fb.style.display='';
  const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='';
  return previous(key);
 };
}
})();