(()=>{
'use strict';
const root=()=>document.getElementById('electricityEngineerEvaluationRoot');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
const exact=(a,b)=>norm(a)===norm(b), blank=v=>!clean(v);
const pct=(a,b)=>b?Math.round(a/b*10000)/100:100;
const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length*10)/10:0;
const unique=a=>[...new Set(a.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
const num=v=>{const n=Number(clean(v).replace('%','').replace(',','.').replace(/[^\d.-]/g,''));return Number.isFinite(n)?n:null};
const state={data:null,loaded:false,charts:{},filters:{engineer:'الكل',section:'الكل',contractor:'الكل',from:'',to:'',search:''}};
const SECTION_LABELS={projects:'المشاريع',connections:'التوصيلات',assets:'الأصول'};
const isDelayed=v=>{const s=norm(v);return !!s&&!s.includes('ضمن المده')&&!s.includes('اوشك')&&(s.includes('تاخير')||s.includes('متاخر'))};
function progress(v){let n=num(v);if(n==null)return null;if(n<=1)n*=100;return Math.max(0,Math.min(100,n))}
function parseDate(v){const s=clean(v).replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'');if(!s)return null;let m=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);if(m)return validDate(+m[1],+m[2],+m[3]);m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);if(!m)return null;const a=+m[1],b=+m[2],y=+m[3];return validDate(y,b,a)||validDate(y,a,b)}
function validDate(y,m,d){const x=new Date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null}
function rules(section){
 if(section==='projects')return [
  ['stage','مرحلة التنفيذ'],['stageStatus','حالة المرحلة'],['excavationTarget','الحفر المستهدف'],['extensionTarget','التمديد المستهدف'],['advice','إفادة الاستشاري'],
  ['adviceAge','إفادة قديمة',r=>!!clean(r.adviceAge)&&!exact(r.adviceAge,'جديدة'),()=>true]
 ];
 if(section==='connections')return [
  ['stage','مرحلة التنفيذ'],['stageStatus','حالة المرحلة'],['advice','إفادة الاستشاري'],
  ['adviceAge','إفادة قديمة',r=>!!clean(r.adviceAge)&&!exact(r.adviceAge,'جديدة'),()=>true]
 ];
 return [
  ['installDate','تاريخ تركيب المعدة',r=>blank(r.installDate),r=>exact(r.fieldReceipt,'تم')],
  ['equipmentNo','رقم المعدة',r=>blank(r.equipmentNo),r=>exact(r.fieldReceipt,'تم')],
  ['testType','نوع الاختبار',r=>blank(r.testType),r=>exact(r.fieldReceipt,'تم')],
  ['executingEntity','الجهة المنفذة',r=>blank(r.executingEntity),r=>exact(r.fieldReceipt,'تم')],
  ['plantingReview','مراجعة بيانات الزراعة',r=>blank(r.plantingReview),r=>exact(r.fieldReceipt,'تم')],
  ['plantingStatus','حالة الزراعة',r=>blank(r.plantingStatus),r=>exact(r.fieldReceipt,'تم')],
  ['assetForm','نموذج الأصول',r=>blank(r.assetForm),r=>exact(r.fieldReceipt,'تم')],
  ['procedure207','إجراء 207'],['resolved','هل تم تلافيها',r=>blank(r.resolved),r=>{const s=norm(r.notes);return !!s&&!s.includes('لا يوجد ملاحظات حتي الان')}],
  ['systemReceipt','استلام الأصول على النظام 211']
 ];
}
function evaluateRow(section,r){
 let applicable=0,issues=[];for(const [key,label,predicate,applies] of rules(section)){if(applies&&!applies(r))continue;applicable++;const bad=predicate?predicate(r):blank(r[key]);if(bad)issues.push(label)}
 return {applicable,issues,score:pct(applicable-issues.length,applicable)};
}
function smartIssues(section,r){
 const out=[],today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
 const check=(key,label,future=false)=>{const raw=clean(r[key]);if(!raw)return;const d=parseDate(raw);if(!d)out.push('تنسيق '+label+' غير صالح');else if(future&&d>tomorrow)out.push(label+' في المستقبل')};
 if(section==='projects'||section==='connections'){
  check('assignedDate','تاريخ الإسناد',true);check('permitStart','بداية التصريح');check('permitEnd','نهاية التصريح');
  const a=parseDate(r.permitStart),b=parseDate(r.permitEnd);if(a&&b&&a>b)out.push('نهاية التصريح أسبق من البداية');
 }
 if(section==='assets'&&exact(r.fieldReceipt,'تم'))check('installDate','تاريخ تركيب المعدة',true);
 return out;
}
function allRows(){
 const d=state.data||{};return ['projects','connections','assets'].flatMap(section=>(d[section]||[]).map(r=>({...r,_section:section})));
}
function rowDate(r){return r._section==='assets'?parseDate(r.installDate):parseDate(r.assignedDate)}
function filteredRows(skipEngineer=false){
 const f=state.filters,q=norm(f.search),from=f.from?new Date(f.from+'T00:00:00'):null,to=f.to?new Date(f.to+'T23:59:59'):null;
 return allRows().filter(r=>{
  if(!clean(r.engineer))return false;
  if(!skipEngineer&&f.engineer!=='الكل'&&r.engineer!==f.engineer)return false;
  if(f.section!=='الكل'&&r._section!==f.section)return false;
  if(f.contractor!=='الكل'&&r.contractor!==f.contractor)return false;
  const d=rowDate(r);if(from&&(!d||d<from))return false;if(to&&(!d||d>to))return false;
  if(q&&!norm([r.engineer,r.workOrder,r.contractor,r.location,r.stage,r.executionStatus,r.advice,r.notes].join(' ')).includes(q))return false;
  return true;
 });
}
function aiStats(engineer,scopeRows){
 const current=Array.isArray(state.data?.adviceIntelligence?.currentOrders)?state.data.adviceIntelligence.currentOrders:[];
 const orderSet=scopeRows?new Set(scopeRows.map(r=>clean(r.workOrder)).filter(Boolean)):null;
 const rows=current.filter(x=>(!engineer||engineer==='الكل'||clean(x.engineer)===engineer)&&(!orderSet||orderSet.has(clean(x.workOrder))));
 return {
  weak:rows.filter(x=>clean(x.classification)==='ضعيف').length,
  suspicious:rows.filter(x=>{const c=clean(x.classification);return c==='شكلي'||c.includes('مشتبه')}).length,
  substantive:rows.filter(x=>clean(x.classification)==='جوهري').length,
  stale:rows.filter(x=>Number(x.daysSinceSubstantive)>=3).length,
  severe:rows.filter(x=>Number(x.daysSinceSubstantive)>=15).length
 };
}
function summarize(rows){
 let applicable=0,issues=0,smart=0,affected=new Set(),delayed=0;const issueCounts={},sections={projects:[],connections:[],assets:[]};
 for(const r of rows){
  sections[r._section].push(r);const e=evaluateRow(r._section,r);applicable+=e.applicable;issues+=e.issues.length;
  if(e.issues.length)affected.add(r._section+'|'+(r.workOrder||r._row));
  e.issues.forEach(x=>issueCounts[x]=(issueCounts[x]||0)+1);
  const si=smartIssues(r._section,r);smart+=si.length;si.forEach(x=>issueCounts['ذكي: '+x]=(issueCounts['ذكي: '+x]||0)+1);
  if((r._section==='projects'||r._section==='connections')&&isDelayed(r.delay))delayed++;
 }
 const sectionStats={};for(const s of Object.keys(sections)){let a=0,i=0;sections[s].forEach(r=>{const e=evaluateRow(s,r);a+=e.applicable;i+=e.issues.length});sectionStats[s]={rows:sections[s].length,issues:i,applicable:a,quality:pct(a-i,a)}}
 const uniqueOrders=new Set(rows.map(r=>clean(r.workOrder)).filter(Boolean)).size;
 return {rows:rows.length,uniqueOrders,applicable,issues,smart,affected:affected.size,delayed,quality:pct(applicable-issues,applicable),issueCounts,sectionStats};
}
function engineerStats(rows){
 const map=new Map();for(const r of rows){const k=clean(r.engineer);if(!k)continue;if(!map.has(k))map.set(k,[]);map.get(k).push(r)}
 return [...map].map(([name,rs])=>({name,...summarize(rs),ai:aiStats(name,rs)})).sort((a,b)=>b.quality-a.quality||b.uniqueOrders-a.uniqueOrders);
}
function sectionProgress(rows,section){
 if(section==='assets')return null;const vals=rows.filter(r=>r._section===section).map(r=>progress(r.progress)).filter(v=>v!=null);return vals.length?avg(vals):null;
}
function optionList(values,current,withAll=true){const arr=withAll?['الكل',...unique(values)]:unique(values);return arr.map(v=>'<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(v)+'</option>').join('')}
function qTone(v){return v>=95?'ok':v>=90?'good':v>=80?'warn':'bad'}
function card(label,value,sub,cls=''){return '<article class="eee-kpi '+cls+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub||'')+'</small></article>'}
function sectionCards(summary,rows){
 return ['projects','connections','assets'].map(s=>{const x=summary.sectionStats[s],sr=rows.filter(r=>r._section===s),p=sectionProgress(rows,s);let extra='';
  if(s==='assets'){const field=sr.filter(r=>exact(r.fieldReceipt,'تم')).length,sys=sr.filter(r=>!blank(r.systemReceipt)).length;extra='<div><dt>استلام ميداني تم</dt><dd>'+field+'</dd></div><div><dt>إجراء 211 مسجل</dt><dd>'+sys+'</dd></div>'}
  else{const delayed=sr.filter(r=>isDelayed(r.delay)).length,old=sr.filter(r=>clean(r.adviceAge)&&!exact(r.adviceAge,'جديدة')).length;extra='<div><dt>متأخر</dt><dd>'+delayed+'</dd></div><div><dt>إفادة قديمة</dt><dd>'+old+'</dd></div>'}
  return '<article class="eee-section-card '+qTone(x.quality)+'"><div><span>'+esc(SECTION_LABELS[s])+'</span><strong>'+(x.rows?x.quality.toFixed(2)+'%':'—')+'</strong></div><dl><div><dt>السجلات</dt><dd>'+x.rows+'</dd></div><div><dt>ملاحظات الجودة</dt><dd>'+x.issues+'</dd></div>'+(p==null?'':'<div><dt>متوسط الإنجاز</dt><dd>'+p+'%</dd></div>')+extra+'</dl></article>'}).join('');
}
function issueTable(summary){
 const arr=Object.entries(summary.issueCounts).sort((a,b)=>b[1]-a[1]).slice(0,18);
 return arr.length?'<div class="eee-issue-list">'+arr.map(([k,v])=>'<div><span>'+esc(k)+'</span><b>'+v+'</b></div>').join('')+'</div>':'<div class="eee-empty">لا توجد ملاحظات جودة ضمن الفلاتر الحالية.</div>';
}
function renderEngineerMatrix(stats){
 return '<section class="eee-head"><div><span>ENGINEER QUALITY MATRIX</span><h3>مصفوفة تقييم مهندسي شركة الكهرباء</h3></div><p>التقييم موزون بعدد خلايا الجودة القابلة للفحص في أوامر المهندس.</p></section><article class="panel"><div class="eee-table-wrap"><table class="eee-table"><thead><tr><th>#</th><th>المهندس</th><th>أوامر العمل</th><th>الجودة العامة</th><th>المشاريع</th><th>التوصيلات</th><th>الأصول</th><th>الملاحظات</th><th>أوامر متأثرة</th><th>متأخر</th><th>إفادات 3+ أيام</th></tr></thead><tbody>'+
 stats.map((x,i)=>'<tr><td>'+(i+1)+'</td><td><button data-eee-engineer="'+esc(x.name)+'">'+esc(x.name)+'</button></td><td>'+x.uniqueOrders+'</td><td><b class="eee-score '+qTone(x.quality)+'">'+x.quality.toFixed(2)+'%</b></td><td>'+x.sectionStats.projects.quality.toFixed(1)+'%</td><td>'+x.sectionStats.connections.quality.toFixed(1)+'%</td><td>'+x.sectionStats.assets.quality.toFixed(1)+'%</td><td>'+x.issues+'</td><td>'+x.affected+'</td><td>'+x.delayed+'</td><td>'+x.ai.stale+'</td></tr>').join('')+
 '</tbody></table></div></article>';
}
function renderDrilldown(rows){
 if(state.filters.engineer==='الكل')return '';
 const list=rows.map(r=>{const e=evaluateRow(r._section,r),si=smartIssues(r._section,r);return {...r,_quality:e.score,_issues:[...e.issues,...si.map(x=>'ذكي: '+x)]}}).sort((a,b)=>b._issues.length-a._issues.length||clean(a.workOrder).localeCompare(clean(b.workOrder),'ar'));
 return '<section class="eee-head"><div><span>WORK ORDER 360°</span><h3>كل التحليلات المرتبطة بأوامر '+esc(state.filters.engineer)+'</h3></div><p>'+list.length+' سجل عبر المشاريع والتوصيلات والأصول.</p></section><article class="panel"><div class="eee-table-wrap"><table class="eee-table detail"><thead><tr><th>السكشن</th><th>أمر العمل</th><th>المقاول</th><th>الحالة / المرحلة</th><th>التأخير</th><th>الإنجاز</th><th>حالة الإفادة</th><th>جودة الصف</th><th>الملاحظات</th></tr></thead><tbody>'+
 list.map(r=>'<tr><td>'+esc(SECTION_LABELS[r._section])+'</td><td><b>'+esc(r.workOrder||'—')+'</b></td><td>'+esc(r.contractor||'—')+'</td><td>'+esc(r.stage||r.orderFollowStatus||r.executionStatus||'—')+'</td><td>'+esc(r.delay||'—')+'</td><td>'+esc(r._section==='assets'?'—':((progress(r.progress)??'—')+(progress(r.progress)!=null?'%':'')))+'</td><td>'+esc(r.adviceAge||'—')+'</td><td><b class="eee-score '+qTone(r._quality)+'">'+r._quality.toFixed(1)+'%</b></td><td class="eee-issues">'+esc(r._issues.length?r._issues.join(' • '):'لا توجد')+'</td></tr>').join('')+
 '</tbody></table></div></article>';
}
function destroyCharts(){Object.values(state.charts).forEach(c=>{try{c.destroy()}catch{}});state.charts={}}
function draw(id,type,labels,data,opts={}){const el=document.getElementById(id);if(!el||typeof Chart==='undefined')return;state.charts[id]=new Chart(el,{type,data:{labels,datasets:[{label:opts.label||'',data,borderWidth:1,backgroundColor:type==='doughnut'?['#2878e8','#13a36d','#e6a500','#dc3d4b','#7a5af8','#00a6a6']:'#2878e8'}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:opts.horizontal?'y':'x',plugins:{legend:{display:type==='doughnut'}},scales:type==='doughnut'?{}:(opts.horizontal?{x:{beginAtZero:true,max:opts.max||undefined},y:{}}:{x:{},y:{beginAtZero:true,max:opts.max||undefined}})}})}
function renderCharts(summary,stats,rows){
 destroyCharts();const top=[...stats].sort((a,b)=>b.quality-a.quality).slice(0,15);
 draw('eeeEngineerQuality','bar',top.map(x=>x.name),top.map(x=>x.quality),{label:'نسبة جودة البيانات',horizontal:true,max:100});
 draw('eeeSectionQuality','bar',['المشاريع','التوصيلات','الأصول'],['projects','connections','assets'].map(s=>summary.sectionStats[s].quality),{label:'نسبة الجودة',max:100});
 const issues=Object.entries(summary.issueCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);draw('eeeIssuesChart','bar',issues.map(x=>x[0]),issues.map(x=>x[1]),{label:'عدد الملاحظات',horizontal:true});
 const sec=['projects','connections','assets'];draw('eeeAffectedChart','doughnut',sec.map(s=>SECTION_LABELS[s]),sec.map(s=>summary.sectionStats[s].issues),{label:'ملاحظات الجودة'});
 const status={};rows.forEach(r=>{const k=clean(r.executionStatus||r.stageStatus||r.orderFollowStatus)||'غير محدد';status[k]=(status[k]||0)+1});const st=Object.entries(status).sort((a,b)=>b[1]-a[1]).slice(0,10);draw('eeeStatusChart','bar',st.map(x=>x[0]),st.map(x=>x[1]),{label:'عدد السجلات',horizontal:true});
 const contractors={};rows.forEach(r=>{const k=clean(r.contractor)||'غير محدد';contractors[k]=(contractors[k]||0)+1});const co=Object.entries(contractors).sort((a,b)=>b[1]-a[1]).slice(0,10);draw('eeeContractorChart','bar',co.map(x=>x[0]),co.map(x=>x[1]),{label:'عدد السجلات',horizontal:true});
}
function render(){
 const host=root();if(!host||!state.data)return;
 const rows=filteredRows(),benchmarkRows=filteredRows(true),summary=summarize(rows),stats=engineerStats(benchmarkRows),ai=aiStats(state.filters.engineer,rows);
 const f=state.filters,engineers=unique(allRows().map(r=>r.engineer)),contractors=unique(allRows().map(r=>r.contractor));
 const cards=[
  card('مهندسو شركة الكهرباء',state.filters.engineer==='الكل'?stats.length:1,'ضمن الفلاتر الحالية','primary'),
  card('أوامر العمل',summary.uniqueOrders,'أوامر فريدة عبر السكاشن','primary'),
  card('جودة البيانات',summary.quality.toFixed(2)+'%',summary.applicable+' خلية قابلة للفحص',qTone(summary.quality)),
  card('ملاحظات الجودة',summary.issues,summary.affected+' أمر / سجل متأثر',summary.issues?'bad':'ok'),
  card('ملاحظات التدقيق الذكي',summary.smart,'تواريخ ومنطق بيانات','warn'),
  card('أوامر متأخرة',summary.delayed,'المشاريع + التوصيلات','warn'),
  card('إفادات ضعيفة / مشتبهة',ai.weak+ai.suspicious,'وفق وكيل تحليل الإفادات','warn'),
  card('دون متابعة جوهرية 3+ أيام',ai.stale,'من أوامر المهندس تحت الرقابة','bad')
 ];
 host.innerHTML='<div class="eee-wrap"><section class="eee-hero"><div><span>SEC ENGINEER • DATA QUALITY & WORK ORDERS</span><h2>تقييم مهندسي شركة الكهرباء</h2><p>تقييم جودة بيانات أوامر العمل المسندة لكل مهندس مسؤول في المشاريع والتوصيلات والأصول، مع تجميع الملاحظات والتحليلات التشغيلية والتدقيق الذكي في صفحة واحدة.</p></div><div class="eee-meta"><small>آخر قراءة</small><b>'+esc(state.data.updatedAt||'—')+'</b></div></section>'+
 '<section class="eee-note"><b>منهجية التقييم</b><span>نسبة الجودة = الخلايا المكتملة ÷ الخلايا القابلة للفحص وفق نفس قواعد تاب جودة البيانات. فحوصات التدقيق الذكي وتحليل الإفادات تظهر كمؤشرات مستقلة ولا تخصم مرة أخرى من نسبة الجودة.</span></section>'+
 '<section class="eee-filter"><div class="eee-filter-grid">'+
 '<label><span>المهندس المسؤول</span><select id="eeeEngineer">'+optionList(engineers,f.engineer)+'</select></label>'+
 '<label><span>السكشن</span><select id="eeeSection"><option value="الكل">الكل</option><option value="projects"'+(f.section==='projects'?' selected':'')+'>المشاريع</option><option value="connections"'+(f.section==='connections'?' selected':'')+'>التوصيلات</option><option value="assets"'+(f.section==='assets'?' selected':'')+'>الأصول</option></select></label>'+
 '<label><span>المقاول</span><select id="eeeContractor">'+optionList(contractors,f.contractor)+'</select></label>'+
 '<label><span>من تاريخ</span><input id="eeeFrom" type="date" value="'+esc(f.from)+'"></label><label><span>إلى تاريخ</span><input id="eeeTo" type="date" value="'+esc(f.to)+'"></label>'+
 '<label class="wide"><span>بحث</span><input id="eeeSearch" value="'+esc(f.search)+'" placeholder="أمر عمل، مقاول، موقع، حالة، إفادة..."></label></div><div class="eee-actions"><button id="eeeReset" class="ghost-btn">مسح الفلاتر</button><button id="eeeRefresh" class="primary-btn">↻ تحديث البيانات</button><strong>'+rows.length+' سجل مطابق</strong></div></section>'+
 '<div class="eee-kpis">'+cards.join('')+'</div><section class="eee-section-grid">'+sectionCards(summary,rows)+'</section>'+
 '<section class="eee-analysis-grid"><article class="panel"><div class="panel-title"><span>QUALITY RANKING</span><h3>جودة البيانات حسب المهندس</h3></div><div class="eee-canvas tall"><canvas id="eeeEngineerQuality"></canvas></div></article><article class="panel"><div class="panel-title"><span>SECTION QUALITY</span><h3>الجودة حسب السكشن</h3></div><div class="eee-canvas"><canvas id="eeeSectionQuality"></canvas></div></article><article class="panel"><div class="panel-title"><span>ISSUES</span><h3>أكثر ملاحظات الجودة</h3></div><div class="eee-canvas tall"><canvas id="eeeIssuesChart"></canvas></div></article><article class="panel"><div class="panel-title"><span>ISSUE MIX</span><h3>توزيع الملاحظات حسب السكشن</h3></div><div class="eee-canvas"><canvas id="eeeAffectedChart"></canvas></div></article><article class="panel"><div class="panel-title"><span>OPERATION STATUS</span><h3>الحالات التشغيلية لأوامر المهندس</h3></div><div class="eee-canvas tall"><canvas id="eeeStatusChart"></canvas></div></article><article class="panel"><div class="panel-title"><span>CONTRACTORS</span><h3>توزيع أوامر المهندس حسب المقاول</h3></div><div class="eee-canvas tall"><canvas id="eeeContractorChart"></canvas></div></article></section>'+
 '<section class="eee-head"><div><span>QUALITY ISSUE BREAKDOWN</span><h3>تفصيل ملاحظات الجودة والتدقيق</h3></div></section><article class="panel eee-issues-panel">'+issueTable(summary)+'</article>'+
 renderEngineerMatrix(stats)+renderDrilldown(rows)+'</div>';
 bind();requestAnimationFrame(()=>renderCharts(summary,stats,rows));
}
function bind(){
 const bindSel=(id,key)=>{const el=document.getElementById(id);if(el)el.onchange=()=>{state.filters[key]=el.value;render()}};
 bindSel('eeeEngineer','engineer');bindSel('eeeSection','section');bindSel('eeeContractor','contractor');bindSel('eeeFrom','from');bindSel('eeeTo','to');
 const q=document.getElementById('eeeSearch');if(q){let timer;q.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{state.filters.search=q.value;render()},180)}}
 document.getElementById('eeeReset')?.addEventListener('click',()=>{state.filters={engineer:'الكل',section:'الكل',contractor:'الكل',from:'',to:'',search:''};render()});
 document.getElementById('eeeRefresh')?.addEventListener('click',()=>load(true));
 document.querySelectorAll('[data-eee-engineer]').forEach(b=>b.onclick=()=>{state.filters.engineer=b.dataset.eeeEngineer;render();root()?.scrollIntoView({behavior:'smooth',block:'start'})});
}
async function load(force=false){
 const host=root();if(host&&!state.loaded)host.innerHTML='<div class="eee-loading"><div class="spinner"></div><b>جاري تجميع أوامر العمل وتحليل جودة البيانات حسب المهندس...</b></div>';
 try{
  const r=await fetch('/api/hr/electricity-engineer-evaluation'+(force?'?t='+Date.now():''));
  const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'تعذر تحميل تقييم مهندسي شركة الكهرباء');
  state.data=j;state.loaded=true;render();
 }catch(e){if(host)host.innerHTML='<div class="eee-error">'+esc(e.message||e)+'</div>'}
}
function activate(){
 if(typeof S!=='undefined')S.current='electricityEngineerEvaluation';
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page==='electricityEngineerEvaluation'));
 ['masterPage','meetingPage','dataPage','importantLinksPage','hrStaffPage','employeeEvaluationPage'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
 document.getElementById('electricityEngineerEvaluationPage')?.classList.add('active');
 const fb=document.getElementById('filterBar');if(fb)fb.style.display='none';
 const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='none';
 const title=document.getElementById('pageTitle');if(title)title.textContent='تقييم مهندسي شركة الكهرباء';
 load(false);
}
if(typeof openPage==='function'){const previous=openPage;openPage=function(key){
 if(key==='electricityEngineerEvaluation'){activate();return}
 document.getElementById('electricityEngineerEvaluationPage')?.classList.remove('active');
 return previous(key);
};}
})();