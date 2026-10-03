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
const mfMatch=(v,s)=>window.VDMultiFilter?VDMultiFilter.match(v,s):(!s||s==='الكل'||v===s);
const mfActive=s=>Array.isArray(s)?s.length>0:!!s&&s!=='الكل';
const mfLabel=(s,n='قيم')=>Array.isArray(s)?(s.length===1?s[0]:s.length+' '+n):s;
const num=v=>{const n=Number(clean(v).replace('%','').replace(',','.').replace(/[^\d.-]/g,''));return Number.isFinite(n)?n:null};
const state={data:null,loaded:false,charts:{},cross:{component:'',issue:'',stale:''},filters:{engineer:'الكل',section:'الكل',contractor:'الكل',from:'',to:'',search:''}};
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
function smartAudit(section,r){
 const issues=[],today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);let applicable=1;
 if(blank(r.workOrder))issues.push('رقم أمر العمل فارغ');
 const check=(key,label,future=false)=>{const raw=clean(r[key]);if(!raw)return;applicable++;const d=parseDate(raw);if(!d)issues.push('تنسيق '+label+' غير صالح');else if(future&&d>tomorrow)issues.push(label+' في المستقبل')};
 if(section==='projects'||section==='connections'){
  check('assignedDate','تاريخ الإسناد',true);check('permitStart','بداية التصريح');check('permitEnd','نهاية التصريح');
  const a=parseDate(r.permitStart),b=parseDate(r.permitEnd);if(a&&b){applicable++;if(a>b)issues.push('نهاية التصريح أسبق من البداية')}
 }
 if(section==='assets'&&exact(r.fieldReceipt,'تم'))check('installDate','تاريخ تركيب المعدة',true);
 return {applicable,issues,score:applicable?pct(applicable-issues.length,applicable):null};
}
function smartIssues(section,r){return smartAudit(section,r).issues}
function allRows(){
 const d=state.data||{};return ['projects','connections','assets'].flatMap(section=>(d[section]||[]).map(r=>({...r,_section:section})));
}
function rowDate(r){return r._section==='assets'?parseDate(r.installDate):parseDate(r.assignedDate)}
function agentProblem(r){
 if(r._section==='assets')return false;
 const current=Array.isArray(state.data?.adviceIntelligence?.currentOrders)?state.data.adviceIntelligence.currentOrders:[];
 const x=current.find(z=>clean(z.workOrder)===clean(r.workOrder)&&(!clean(z.engineer)||clean(z.engineer)===clean(r.engineer)));
 if(!x)return false;
 const c=norm(x.classification),days=Number(x.daysSinceSubstantive);
 return c==='ضعيف'||c==='شكلي'||c.includes('مشتبه')||(Number.isFinite(days)&&days>=3);
}
function agentStale(r){
 if(r._section==='assets')return false;
 const current=Array.isArray(state.data?.adviceIntelligence?.currentOrders)?state.data.adviceIntelligence.currentOrders:[];
 const x=current.find(z=>clean(z.workOrder)===clean(r.workOrder)&&(!clean(z.engineer)||clean(z.engineer)===clean(r.engineer)));
 return !!x&&Number(x.daysSinceSubstantive)>=3;
}
function filteredRows(skipEngineer=false){
 const f=state.filters,q=norm(f.search),from=f.from?new Date(f.from+'T00:00:00'):null,to=f.to?new Date(f.to+'T23:59:59'):null;
 return allRows().filter(r=>{
  if(!clean(r.engineer))return false;
  if(!skipEngineer&&!mfMatch(r.engineer,f.engineer))return false;
  if(!mfMatch(r._section,f.section))return false;
  if(!mfMatch(r.contractor,f.contractor))return false;
  const d=rowDate(r);if(from&&(!d||d<from))return false;if(to&&(!d||d>to))return false;
  if(q&&!norm([r.engineer,r.workOrder,r.contractor,r.location,r.stage,r.executionStatus,r.advice,r.notes].join(' ')).includes(q))return false;
  if(state.cross.issue){
    const want=state.cross.issue;
    if(want==='__ANY__'){if(!evaluateRow(r._section,r).issues.length&&!smartAudit(r._section,r).issues.length)return false}
    else if(want.startsWith('ذكي: ')){if(!smartAudit(r._section,r).issues.includes(want.slice(5)))return false}
    else if(!evaluateRow(r._section,r).issues.includes(want))return false;
  }
  if(state.cross.stale==='3+'&&!agentStale(r))return false;
  if(state.cross.component==='جودة البيانات'&&evaluateRow(r._section,r).score>=100)return false;
  if(state.cross.component==='التدقيق الذكي'&&(smartAudit(r._section,r).score??100)>=100)return false;
  if(state.cross.component==='تقييم الوكيل'&&!agentProblem(r))return false;
  if(state.cross.component==='متوسط الإنجاز'&&(r._section==='assets'||progress(r.progress)==null||progress(r.progress)>=100))return false;
  return true;
 });
}
function aiStats(engineer,scopeRows){
 const current=Array.isArray(state.data?.adviceIntelligence?.currentOrders)?state.data.adviceIntelligence.currentOrders:[];
 const eng=Array.isArray(engineer)?engineer.filter(Boolean):(!engineer||engineer==='الكل'?[]:[engineer]);
 const adviceScope=scopeRows?scopeRows.filter(r=>r._section==='projects'||r._section==='connections'):null;
 const orderSet=adviceScope?new Set(adviceScope.map(r=>clean(r.workOrder)).filter(Boolean)):null;
 const rows=scopeRows&&adviceScope&&!adviceScope.length?[]:current.filter(x=>(!eng.length||eng.includes(clean(x.engineer)))&&(!orderSet||orderSet.has(clean(x.workOrder))));
 const classValues=rows.map(x=>{const c=clean(x.classification);if(c==='جوهري')return 100;if(c==='ضعيف')return 50;if(c==='شكلي'||c.includes('مشتبه'))return 20;return null}).filter(v=>v!=null);
 const ageValues=rows.map(x=>{const d=Number(x.daysSinceSubstantive);if(!Number.isFinite(d))return 0;if(d<3)return 100;if(d<6)return 80;if(d<10)return 60;if(d<15)return 30;return 0});
 const classificationScore=classValues.length?avg(classValues):null,freshnessScore=ageValues.length?avg(ageValues):null;
 const components=[classificationScore,freshnessScore].filter(v=>v!=null);
 return {
  rows:rows.length,weak:rows.filter(x=>clean(x.classification)==='ضعيف').length,
  suspicious:rows.filter(x=>{const c=clean(x.classification);return c==='شكلي'||c.includes('مشتبه')}).length,
  substantive:rows.filter(x=>clean(x.classification)==='جوهري').length,
  stale:rows.filter(x=>Number(x.daysSinceSubstantive)>=3).length,
  severe:rows.filter(x=>Number(x.daysSinceSubstantive)>=15).length,
  classificationScore,freshnessScore,score:components.length?avg(components):null
 };
}
function summarize(rows){
 let applicable=0,issues=0,smartIssuesCount=0,smartApplicable=0,affected=new Set(),delayed=0;const issueCounts={},sections={projects:[],connections:[],assets:[]};
 for(const r of rows){
  sections[r._section].push(r);const e=evaluateRow(r._section,r);applicable+=e.applicable;issues+=e.issues.length;
  if(e.issues.length)affected.add(r._section+'|'+(r.workOrder||r._row));
  e.issues.forEach(x=>issueCounts[x]=(issueCounts[x]||0)+1);
  const sa=smartAudit(r._section,r);smartApplicable+=sa.applicable;smartIssuesCount+=sa.issues.length;sa.issues.forEach(x=>issueCounts['ذكي: '+x]=(issueCounts['ذكي: '+x]||0)+1);
  if((r._section==='projects'||r._section==='connections')&&isDelayed(r.delay))delayed++;
 }
 const sectionStats={};
 for(const s of Object.keys(sections)){
  let a=0,i=0,sa=0,si=0;
  sections[s].forEach(r=>{const e=evaluateRow(s,r);a+=e.applicable;i+=e.issues.length;const sm=smartAudit(s,r);sa+=sm.applicable;si+=sm.issues.length});
  sectionStats[s]={rows:sections[s].length,issues:i,applicable:a,quality:a?pct(a-i,a):null,smartApplicable:sa,smartIssues:si,smartScore:sa?pct(sa-si,sa):null};
 }
 const uniqueOrders=new Set(rows.map(r=>clean(r.workOrder)).filter(Boolean)).size;
 return {rows:rows.length,uniqueOrders,applicable,issues,smart:smartIssuesCount,smartApplicable,affected:affected.size,delayed,quality:applicable?pct(applicable-issues,applicable):null,smartScore:smartApplicable?pct(smartApplicable-smartIssuesCount,smartApplicable):null,issueCounts,sectionStats};
}
function sectionProgress(rows,section){
 if(section==='assets')return null;const vals=rows.filter(r=>r._section===section).map(r=>progress(r.progress)).filter(v=>v!=null);return vals.length?avg(vals):null;
}
function completionScore(rows){
 const vals=['projects','connections'].map(s=>sectionProgress(rows,s)).filter(v=>v!=null);return vals.length?avg(vals):null;
}
function finalScore(summary,ai,completion){
 const vals=[summary.quality,summary.smartScore,ai?.score,completion].filter(v=>v!=null&&Number.isFinite(v));return vals.length?avg(vals):null;
}
function sectionEvaluation(rows,summary,engineer,section){
 const sr=rows.filter(r=>r._section===section),base=summary.sectionStats[section],p=sectionProgress(rows,section),ai=section==='assets'?{score:null}:aiStats(engineer,sr);
 const score=finalScore({quality:base.quality,smartScore:base.smartScore},ai,p);
 return {...base,progress:p,aiScore:ai.score,score};
}
function engineerStats(rows){
 const map=new Map();for(const r of rows){const k=clean(r.engineer);if(!k)continue;if(!map.has(k))map.set(k,[]);map.get(k).push(r)}
 return [...map].map(([name,rs])=>{const summary=summarize(rs),ai=aiStats(name,rs),completion=completionScore(rs),score=finalScore(summary,ai,completion);return {name,...summary,ai,completion,score,sectionEvaluation:{projects:sectionEvaluation(rs,summary,name,'projects'),connections:sectionEvaluation(rs,summary,name,'connections'),assets:sectionEvaluation(rs,summary,name,'assets')}}}).sort((a,b)=>(b.score??-1)-(a.score??-1)||b.uniqueOrders-a.uniqueOrders);
}
function optionList(values,current,withAll=true){const arr=withAll?['الكل',...unique(values)]:unique(values);return arr.map(v=>'<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(v)+'</option>').join('')}
function qTone(v){return v>=95?'ok':v>=90?'good':v>=80?'warn':'bad'}
function card(label,value,sub,cls=''){return '<article class="eee-kpi '+cls+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub||'')+'</small></article>'}
function sectionCards(summary,rows,engineer){
 return ['projects','connections','assets'].map(s=>{const ev=sectionEvaluation(rows,summary,engineer,s),sr=rows.filter(r=>r._section===s);let extra='';
  if(s==='assets'){const field=sr.filter(r=>exact(r.fieldReceipt,'تم')).length,sys=sr.filter(r=>!blank(r.systemReceipt)).length;extra='<div><dt>استلام ميداني تم</dt><dd>'+field+'</dd></div><div><dt>إجراء 211 مسجل</dt><dd>'+sys+'</dd></div>'}
  else{const delayed=sr.filter(r=>isDelayed(r.delay)).length,old=sr.filter(r=>clean(r.adviceAge)&&!exact(r.adviceAge,'جديدة')).length;extra='<div><dt>متأخر</dt><dd>'+delayed+'</dd></div><div><dt>إفادة قديمة</dt><dd>'+old+'</dd></div>'}
  return '<article class="eee-section-card '+(ev.score==null?'':qTone(ev.score))+'"><div><span>'+esc(SECTION_LABELS[s])+'</span><strong>'+(ev.rows&&ev.score!=null?ev.score.toFixed(2)+'%':'—')+'</strong></div><small class="eee-section-sub">التقييم المركب للسكشن</small><dl><div><dt>جودة البيانات</dt><dd>'+(ev.quality==null?'—':ev.quality.toFixed(1)+'%')+'</dd></div><div><dt>التدقيق الذكي</dt><dd>'+(ev.smartScore==null?'—':ev.smartScore.toFixed(1)+'%')+'</dd></div><div><dt>تقييم الوكيل</dt><dd>'+(ev.aiScore==null?'—':ev.aiScore.toFixed(1)+'%')+'</dd></div><div><dt>متوسط الإنجاز</dt><dd>'+(ev.progress==null?'—':ev.progress+'%')+'</dd></div><div><dt>السجلات</dt><dd>'+ev.rows+'</dd></div><div><dt>ملاحظات الجودة</dt><dd>'+ev.issues+'</dd></div>'+extra+'</dl></article>'}).join('');
}
function issueTable(summary){
 const arr=Object.entries(summary.issueCounts).sort((a,b)=>b[1]-a[1]).slice(0,18);
 return arr.length?'<div class="eee-issue-list">'+arr.map(([k,v])=>'<div><span>'+esc(k)+'</span><b>'+v+'</b></div>').join('')+'</div>':'<div class="eee-empty">لا توجد ملاحظات جودة ضمن الفلاتر الحالية.</div>';
}
function renderEngineerMatrix(stats){
 const fmt=v=>v==null?'—':v.toFixed(1)+'%';
 return '<section class="eee-head"><div><span>ENGINEER EVALUATION MATRIX</span><h3>مصفوفة التقييم النهائي لمهندسي شركة الكهرباء</h3></div><p>التقييم النهائي = متوسط جودة البيانات + التدقيق الذكي + تقييم الوكيل + متوسط الإنجاز، مع إعادة توزيع الوزن تلقائيًا إذا تعذر أحد المكونات.</p></section><article class="panel"><div class="eee-table-wrap"><table class="eee-table"><thead><tr><th>#</th><th>المهندس</th><th>أوامر العمل</th><th>التقييم النهائي</th><th>جودة البيانات</th><th>التدقيق الذكي</th><th>الوكيل</th><th>متوسط الإنجاز</th><th>المشاريع</th><th>التوصيلات</th><th>الأصول</th></tr></thead><tbody>'+
 stats.map((x,i)=>'<tr><td>'+(i+1)+'</td><td><button data-eee-engineer="'+esc(x.name)+'">'+esc(x.name)+'</button></td><td>'+x.uniqueOrders+'</td><td><b class="eee-score '+qTone(x.score??0)+'">'+fmt(x.score)+'</b></td><td>'+fmt(x.quality)+'</td><td>'+fmt(x.smartScore)+'</td><td>'+fmt(x.ai.score)+'</td><td>'+fmt(x.completion)+'</td><td>'+fmt(x.sectionEvaluation.projects.score)+'</td><td>'+fmt(x.sectionEvaluation.connections.score)+'</td><td>'+fmt(x.sectionEvaluation.assets.score)+'</td></tr>').join('')+
 '</tbody></table></div></article>';
}
function aiOrderRecord(r){
 if(r._section==='assets')return null;const current=Array.isArray(state.data?.adviceIntelligence?.currentOrders)?state.data.adviceIntelligence.currentOrders:[];
 return current.find(x=>clean(x.workOrder)===clean(r.workOrder)&&(!clean(x.engineer)||clean(x.engineer)===clean(r.engineer)))||null;
}
function renderDrilldown(rows){
 if(!mfActive(state.filters.engineer))return '';
 const list=rows.map(r=>{const e=evaluateRow(r._section,r),sa=smartAudit(r._section,r),ai=aiOrderRecord(r);return {...r,_quality:e.score,_smart:sa.score,_agent:ai,_issues:[...e.issues,...sa.issues.map(x=>'ذكي: '+x)]}}).sort((a,b)=>b._issues.length-a._issues.length||clean(a.workOrder).localeCompare(clean(b.workOrder),'ar'));
 return '<section class="eee-head"><div><span>WORK ORDER 360°</span><h3>كل التحليلات المرتبطة بأوامر '+esc(mfLabel(state.filters.engineer,'مهندسين'))+'</h3></div><p>'+list.length+' سجل عبر المشاريع والتوصيلات والأصول.</p></section><article class="panel"><div class="eee-table-wrap"><table class="eee-table detail"><thead><tr><th>السكشن</th><th>أمر العمل</th><th>المقاول</th><th>الحالة / المرحلة</th><th>التأخير</th><th>الإنجاز</th><th>جودة البيانات</th><th>التدقيق الذكي</th><th>تصنيف الوكيل</th><th>عمر المتابعة الجوهرية</th><th>الملاحظات</th></tr></thead><tbody>'+
 list.map(r=>'<tr><td>'+esc(SECTION_LABELS[r._section])+'</td><td><b>'+esc(r.workOrder||'—')+'</b></td><td>'+esc(r.contractor||'—')+'</td><td>'+esc(r.stage||r.orderFollowStatus||r.executionStatus||'—')+'</td><td>'+esc(r.delay||'—')+'</td><td>'+esc(r._section==='assets'?'—':((progress(r.progress)??'—')+(progress(r.progress)!=null?'%':'')))+'</td><td><b class="eee-score '+qTone(r._quality)+'">'+r._quality.toFixed(1)+'%</b></td><td>'+(r._smart==null?'—':'<b class="eee-score '+qTone(r._smart)+'">'+r._smart.toFixed(1)+'%</b>')+'</td><td>'+esc(r._agent?.classification||'—')+'</td><td>'+esc(r._agent&&Number.isFinite(Number(r._agent.daysSinceSubstantive))?Number(r._agent.daysSinceSubstantive).toFixed(1)+' يوم':'—')+'</td><td class="eee-issues">'+esc(r._issues.length?r._issues.join(' • '):'لا توجد')+'</td></tr>').join('')+
 '</tbody></table></div></article>';
}
function destroyCharts(){Object.values(state.charts).forEach(c=>{try{c.destroy()}catch{}});state.charts={}}
function draw(id,type,labels,data,opts={}){const el=document.getElementById(id);if(!el||typeof Chart==='undefined')return;state.charts[id]=new Chart(el,{type,data:{labels,datasets:[{label:opts.label||'',data,borderWidth:1,backgroundColor:type==='doughnut'?['#2878e8','#13a36d','#e6a500','#dc3d4b','#7a5af8','#00a6a6']:'#2878e8'}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:opts.horizontal?'y':'x',plugins:{legend:{display:type==='doughnut'}},scales:type==='doughnut'?{}:(opts.horizontal?{x:{beginAtZero:true,max:opts.max||undefined},y:{}}:{x:{},y:{beginAtZero:true,max:opts.max||undefined}})}})}
function renderCharts(summary,stats,rows,ai,completion,engineer){
 destroyCharts();
 const components=[['جودة البيانات',summary.quality],['التدقيق الذكي',summary.smartScore],['تقييم الوكيل',ai.score],['متوسط الإنجاز',completion]].filter(x=>x[1]!=null);
 draw('eeeComponentChart','bar',components.map(x=>x[0]),components.map(x=>x[1]),{label:'نسبة المكون',max:100});
 const sec=['projects','connections','assets'],sectionScores=sec.map(s=>sectionEvaluation(rows,summary,engineer,s).score);
 draw('eeeSectionQuality','bar',sec.map(s=>SECTION_LABELS[s]),sectionScores.map(v=>v??0),{label:'التقييم المركب للسكشن',max:100});
 const issues=Object.entries(summary.issueCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);draw('eeeIssuesChart','bar',issues.map(x=>x[0]),issues.map(x=>x[1]),{label:'عدد الملاحظات المؤثرة',horizontal:true});
}
function render(){
 const host=root();if(!host||!state.data)return;
 const rows=filteredRows(),benchmarkRows=filteredRows(true),summary=summarize(rows),stats=engineerStats(benchmarkRows),ai=aiStats(state.filters.engineer,rows),completion=completionScore(rows),overall=finalScore(summary,ai,completion);
 const projectProgress=sectionProgress(rows,'projects'),connectionProgress=sectionProgress(rows,'connections');
 const f=state.filters,engineers=unique(allRows().map(r=>r.engineer)),contractors=unique(allRows().map(r=>r.contractor));
 const fmt=v=>v==null?'—':v.toFixed(1)+'%';
 const cards=[
  card('التقييم النهائي',fmt(overall),'متوسط متساوي للعوامل المتاحة',qTone(overall??0)),
  card('جودة البيانات',fmt(summary.quality),summary.applicable+' خلية قابلة للفحص',qTone(summary.quality??0)),
  card('التدقيق الذكي',fmt(summary.smartScore),summary.smart+' ملاحظة منطق/تاريخ',qTone(summary.smartScore??0)),
  card('تقييم وكيل الإفادات',fmt(ai.score),'جودة التصنيف '+fmt(ai.classificationScore)+' • حداثة المتابعة '+fmt(ai.freshnessScore),qTone(ai.score??0)),
  card('متوسط الإنجاز',fmt(completion),'المشاريع '+fmt(projectProgress)+' • التوصيلات '+fmt(connectionProgress),qTone(completion??0)),
  card('أوامر العمل',summary.uniqueOrders,'أوامر فريدة ضمن الفلاتر','primary'),
  card('ملاحظات الجودة',summary.issues,summary.affected+' أمر / سجل متأثر',summary.issues?'bad':'ok'),
  card('دون متابعة جوهرية 3+ أيام',ai.stale,'مؤشر متابعة من وكيل الإفادات',ai.stale?'warn':'ok')
 ];
 host.innerHTML='<div class="eee-wrap"><section class="eee-hero"><div><span>SEC ENGINEER • COMPOSITE PERFORMANCE EVALUATION</span><h2>تقييم مهندسي شركة الكهرباء</h2><p>تقييم مركب يدمج جودة البيانات، التدقيق الذكي، تحليل وكيل الإفادات، ومتوسط نسبة الإنجاز لأوامر العمل التابعة للمهندس في المشاريع والتوصيلات والأصول.</p></div></section>'+
 '<section class="eee-note"><b>منهجية التقييم النهائي</b><span>يتم احتساب متوسط متساوي للعوامل المتاحة: جودة البيانات + التدقيق الذكي + تقييم وكيل الإفادات + متوسط الإنجاز. عند توفر العوامل الأربعة يكون وزن كل عامل 25%، وإذا تعذر عامل في نطاق معين يعاد توزيع الوزن تلقائيًا على العوامل المتاحة.</span></section>'+
 '<section class="eee-filter">'+
 '<div class="eee-filter-title"><div><span>ENGINEER FIRST</span><h3>اختيار مهندس شركة الكهرباء هو محور التقييم</h3><p>اختر مهندسًا واحدًا أولًا، ثم استخدم باقي الفلاتر لتحليل أوامر العمل والإفادات وجودة البيانات الخاصة به.</p></div><b>'+rows.length+' سجل مطابق</b></div>'+
 '<div class="eee-filter-grid">'+
 '<label class="eee-engineer-focus"><span>المهندس المراد تقييمه</span><select id="eeeEngineer">'+optionList(engineers,f.engineer)+'</select></label>'+
 '<label><span>السكشن</span><select id="eeeSection"><option value="الكل">الكل</option><option value="projects"'+(f.section==='projects'?' selected':'')+'>المشاريع</option><option value="connections"'+(f.section==='connections'?' selected':'')+'>التوصيلات</option><option value="assets"'+(f.section==='assets'?' selected':'')+'>الأصول</option></select></label>'+
 '<label><span>المقاول</span><select id="eeeContractor">'+optionList(contractors,f.contractor)+'</select></label>'+
 '<label><span>من تاريخ</span><input id="eeeFrom" type="date" value="'+esc(f.from)+'"></label><label><span>إلى تاريخ</span><input id="eeeTo" type="date" value="'+esc(f.to)+'"></label></div>'+
 '<div class="eee-actions"><button id="eeeReset" class="ghost-btn">مسح الفلاتر</button><button id="eeeRefresh" class="primary-btn">↻ تحديث البيانات</button><button id="eeeExportReport" class="vd-tab-report-btn" type="button">↓ تصدير التقرير PDF</button>'+((state.cross.component||state.cross.issue||state.cross.stale)?'<span>تفاعلي: '+esc([state.cross.component,state.cross.issue==='__ANY__'?'ملاحظات الجودة':state.cross.issue,state.cross.stale==='3+'?'دون متابعة جوهرية 3+ أيام':''].filter(Boolean).join(' • '))+'</span>':'')+'</div></section>'+
 '<div class="eee-kpis">'+cards.join('')+'</div><section class="eee-section-grid">'+sectionCards(summary,rows,state.filters.engineer)+'</section>'+
 '<section class="eee-analysis-grid"><article class="panel"><div class="panel-title"><span>SCORE COMPONENTS</span><h3>مكونات التقييم</h3></div><div class="eee-canvas"><canvas id="eeeComponentChart"></canvas></div></article>'+
 '<article class="panel"><div class="panel-title"><span>SECTION SCORE</span><h3>التقييم المركب حسب السكشن</h3></div><div class="eee-canvas"><canvas id="eeeSectionQuality"></canvas></div></article>'+
 '<article class="panel"><div class="panel-title"><span>EVALUATION ISSUES</span><h3>أكثر الملاحظات المؤثرة على التقييم</h3></div><div class="eee-canvas tall"><canvas id="eeeIssuesChart"></canvas></div></article></section>'+
 '<section class="eee-head"><div><span>EVALUATION DIAGNOSTICS</span><h3>تفصيل ملاحظات الجودة والتدقيق الذكي</h3></div><p>هذه التفاصيل تفسر أسباب انخفاض النسب ولا تضيف خصمًا مستقلًا فوق مكونات التقييم.</p></section><article class="panel eee-issues-panel">'+issueTable(summary)+'</article>'+
 renderEngineerMatrix(stats)+renderDrilldown(rows)+'</div>';
 bind();requestAnimationFrame(()=>renderCharts(summary,stats,rows,ai,completion,state.filters.engineer));
}
window.ElectricityEngineerEvaluationDashboard={
 filterFromChart(id,label){
  if(id==='eeeSectionQuality'){
   const key=Object.keys(SECTION_LABELS).find(k=>SECTION_LABELS[k]===label);
   if(key){const cur=Array.isArray(state.filters.section)?state.filters.section:[state.filters.section];state.filters.section=(cur.length===1&&cur[0]===key)?'الكل':[key];render();return true}
  }
  if(id==='eeeComponentChart'){state.cross.component=state.cross.component===label?'':label;render();return true}
  if(id==='eeeIssuesChart'){state.cross.issue=state.cross.issue===label?'':label;render();return true}
  return false;
 },
 filterFromCard(label){
  const t=clean(label);if(!t)return false;
  if(t==='التقييم النهائي'||t==='أوامر العمل'){state.cross={component:'',issue:'',stale:''};render();return true}
  const sectionKey=Object.keys(SECTION_LABELS).find(k=>SECTION_LABELS[k]===t);if(sectionKey){const cur=Array.isArray(state.filters.section)?state.filters.section:[state.filters.section];state.filters.section=(cur.length===1&&cur[0]===sectionKey)?'الكل':[sectionKey];render();return true}
  if(t==='جودة البيانات'||t==='التدقيق الذكي'||t==='متوسط الإنجاز'){state.cross.component=state.cross.component===t?'':t;render();return true}
  if(t==='تقييم وكيل الإفادات'){const v='تقييم الوكيل';state.cross.component=state.cross.component===v?'':v;render();return true}
  if(t==='ملاحظات الجودة'){state.cross.issue=state.cross.issue==='__ANY__'?'':'__ANY__';render();return true}
  if(t.includes('دون متابعة جوهرية')){state.cross.stale=state.cross.stale==='3+'?'':'3+';render();return true}
  return false;
 },
 clearInteractive(){state.cross={component:'',issue:'',stale:''};render()}
};
function bind(){
 const bindSel=(id,key,multi=true)=>{const el=document.getElementById(id);if(el){if(el.tagName==='SELECT'&&multi&&window.VDMultiFilter)VDMultiFilter.enhance(el,{selected:state.filters[key],allText:'الكل'});el.onchange=()=>{state.filters[key]=(el.tagName==='SELECT'&&multi&&window.VDMultiFilter)?VDMultiFilter.values(el):el.value;render()}}};
 bindSel('eeeEngineer','engineer',false);bindSel('eeeSection','section');bindSel('eeeContractor','contractor');bindSel('eeeFrom','from',false);bindSel('eeeTo','to',false);
 const q=document.getElementById('eeeSearch');if(q){let timer;q.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{state.filters.search=q.value;render()},180)}}
 document.getElementById('eeeReset')?.addEventListener('click',()=>{state.filters={engineer:'الكل',section:'الكل',contractor:'الكل',from:'',to:'',search:''};state.cross={component:'',issue:'',stale:''};render()});
 document.getElementById('eeeRefresh')?.addEventListener('click',()=>load(true));
 document.getElementById('eeeExportReport')?.addEventListener('click',()=>{if(window.VDReportExport?.exportCurrent)window.VDReportExport.exportCurrent();else document.querySelector('#vdUnifiedReportAction .vd-tab-report-btn')?.click()});
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
 document.body.classList.add('electricity-engineer-evaluation-active');
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
 document.body.classList.remove('electricity-engineer-evaluation-active');
 document.getElementById('electricityEngineerEvaluationPage')?.classList.remove('active');
 return previous(key);
};}
})();