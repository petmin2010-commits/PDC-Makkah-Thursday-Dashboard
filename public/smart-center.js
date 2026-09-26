(function(){
'use strict';
const SC={loaded:false,loading:false,pages:{},issues:[],quality:[],summary:null,charts:{},projectKey:'',lastUpdated:'',previous:null,centralHistory:null};
const PAGE_KEYS=['workorders','projects','connections','permits','assets','closures','emergency','attachments','tasks'];
const PAGE_TITLES={workorders:'أوامر العمل',projects:'المشاريع',connections:'التوصيلات',permits:'التصاريح',assets:'الأصول',closures:'الإغلاقات',emergency:'الطوارئ',attachments:'المرفقات',tasks:'متابعة المواقع'};
const SEV_LABELS={critical:'حرجة',high:'مرتفعة',medium:'متوسطة'};
function el(id){return document.getElementById(id)}
function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function norm(v){return clean(v).replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase()}
function num(v){const m=clean(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):0}
function pct(a,b){return b?Math.round(a/b*1000)/10:0}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function isDone(v){return norm(v)==='تم التنفيذ'||norm(v)==='منجز'}
function isDelayed(v){const s=norm(v);return !!s&&!s.includes('ضمن المده')&&!s.includes('اوشك')&&(s.includes('تاخير')||s.includes('متاخر'))}
function containsAny(v,arr){const s=norm(v);return arr.some(x=>s.includes(norm(x)))}
function rpc(method,args=[]){return fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})}).then(async r=>{const x=await r.json().catch(()=>({}));if(!r.ok||x.ok===false)throw new Error(x.error||('HTTP '+r.status));return x.result})}
function projectIdentity(){
 const brand=clean(document.querySelector('.brand-copy strong')?.textContent)||clean(document.title);
 return {name:brand||'المشروع',key:(location.host+'|'+brand).replace(/\s+/g,'_')};
}
function installUi(){
 if(el('smartCenterPage'))return;
 const nav=el('nav');if(!nav)return;
 const reports=[...nav.children].find(x=>x.classList?.contains('nav-section-label'));
 const label=document.createElement('div');label.className='nav-section-label smart-center-label';label.textContent='التحليل الذكي';
 const btn=document.createElement('button');btn.type='button';btn.id='smartCenterNav';btn.className='nav-item';btn.innerHTML='🧠 <span>مركز التحليل الذكي</span>';
 nav.insertBefore(label,reports||null);nav.insertBefore(btn,reports||null);
 const page=document.createElement('section');page.id='smartCenterPage';page.className='page smart-center-page';page.innerHTML=smartCenterMarkup();
 const main=document.querySelector('main');const firstPage=el('masterPage');main.insertBefore(page,firstPage||null);
 btn.addEventListener('click',openSmartCenter);
 nav.addEventListener('click',e=>{const item=e.target.closest('.nav-item');if(item&&item.id!=='smartCenterNav')leaveSmartCenter()});
 bindSmartCenter();
}
function smartCenterMarkup(){return `
<div class="sc-hero"><div class="sc-hero-main"><div><span class="sc-eyebrow">SMART PROJECT INTELLIGENCE • FREE ENGINE</span><h2>🧠 مركز التحليل الذكي</h2><p>تحليل مباشر لقواعد المشروع، جودة البيانات، التأخيرات والاستثناءات بدون أي API مدفوع.</p></div><div class="sc-hero-actions"><span class="sc-live"><i></i><span id="scUpdated">جاري التحليل...</span></span><button id="scRefresh" class="sc-refresh">↻ إعادة التحليل</button></div></div></div>
<div id="scLoading" class="sc-loading"><i></i><span>جاري قراءة بيانات المشروع وبناء التحليل الذكي...</span></div>
<div id="scContent" style="display:none"></div>`}
function openSmartCenter(){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 el('smartCenterPage')?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id==='smartCenterNav'));
 if(el('filterBar'))el('filterBar').style.display='none';
 if(el('pageTitle'))el('pageTitle').textContent='مركز التحليل الذكي';
 if(!SC.loaded)loadSmartCenter();else renderAll();
}
function leaveSmartCenter(){
 el('smartCenterPage')?.classList.remove('active');
 if(el('filterBar'))el('filterBar').style.display='';
}
function bindSmartCenter(){
 el('scRefresh').onclick=()=>loadSmartCenter(true);
}
async function loadSmartCenter(force=false){
 if(SC.loading)return;SC.loading=true;
 el('scLoading').style.display='flex';el('scContent').style.display='none';
 try{
  if(force){SC.pages={};SC.issues=[];SC.quality=[];SC.summary=null}
  const identity=projectIdentity();SC.projectKey=identity.key;SC.previous=previousSnapshot();
  const results=await Promise.all(PAGE_KEYS.map(async key=>{try{return [key,await rpc('getPageData',[key])]}catch(e){return [key,{key,title:PAGE_TITLES[key],rows:[],error:e.message}]}}));
  SC.pages=Object.fromEntries(results);analyzeProject();await syncCentralHistory();SC.loaded=true;SC.lastUpdated=new Date().toLocaleString('ar-SA');
  renderAll();saveSnapshot();
 }catch(e){
  el('scContent').innerHTML='<div class="sc-panel"><div class="sc-empty">تعذر بناء التحليل: '+esc(e.message||e)+'</div></div>';el('scContent').style.display='block';
 }finally{SC.loading=false;el('scLoading').style.display='none'}
}
function rows(key){return Array.isArray(SC.pages[key]?.rows)?SC.pages[key].rows:[]}
function addIssue(severity,category,pageKey,title,detail,row){
 const id=clean(row?.workOrder||row?.noticeNo||row?.station||row?._row||'');
 SC.issues.push({severity,category,pageKey,title,detail,id,contractor:clean(row?.contractor),engineer:clean(row?.engineer),section:clean(row?.section),row:row?._row||''});
}
function completeness(pageKey,keys){
 const rs=rows(pageKey);if(!rs.length)return {pageKey,title:PAGE_TITLES[pageKey],score:100,missing:0,cells:0,rows:0};
 let cells=0,missing=0;rs.forEach(r=>keys.forEach(k=>{cells++;if(!clean(r?.[k]))missing++}));
 return {pageKey,title:PAGE_TITLES[pageKey],score:Math.round((1-missing/Math.max(1,cells))*1000)/10,missing,cells,rows:rs.length};
}
function analyzeProject(){
 SC.issues=[];
 const wo=rows('workorders');
 wo.forEach(r=>{
  if(!isDone(r.status)&&isDelayed(r.delay))addIssue('high','التأخير','workorders','أمر عمل متأخر وغير منفذ','الحالة الحالية ليست تم التنفيذ مع وجود مؤشر تأخير.',r);
  if(!clean(r.engineer))addIssue('medium','جودة البيانات','workorders','مسؤول المتابعة غير مسجل','حقل المهندس المسؤول فارغ في أمر العمل.',r);
  if(num(r.consultantDays)>=15)addIssue('critical','المتابعة','workorders','انقطاع متابعة استشارية طويل','مر '+num(r.consultantDays)+' يومًا منذ آخر إجراء استشاري.',r);
  else if(num(r.consultantDays)>=10)addIssue('high','المتابعة','workorders','متابعة استشارية متأخرة','مر '+num(r.consultantDays)+' يومًا منذ آخر إجراء استشاري.',r);
 });
 ['projects','connections'].forEach(key=>rows(key).forEach(r=>{
  if(isDelayed(r.executionStatus)||isDelayed(r.delay))addIssue('high','التأخير',key,'حالة تنفيذ متأخرة','سجل التنفيذ يحمل حالة تأخير ويحتاج متابعة.',r);
  const age=norm(r.adviceAge);
  if(age.includes('اهمال شديد'))addIssue('critical','الإفادات',key,'إهمال شديد في المتابعة','حالة الإفادة مصنفة إهمال شديد بالمتابعة.',r);
  else if(age.includes('اهمال'))addIssue('high','الإفادات',key,'إهمال في المتابعة','حالة الإفادة مصنفة إهمال بالمتابعة.',r);
  else if(age.includes('قديمه جدا'))addIssue('high','الإفادات',key,'إفادة قديمة جدًا','الإفادة تحتاج تحديثًا عاجلًا.',r);
  if(!clean(r.engineer))addIssue('medium','جودة البيانات',key,'المهندس المسؤول غير مسجل','سجل نشط بدون اسم مهندس مسؤول.',r);
 }));
 rows('permits').forEach(r=>{
  if(!clean(r.permitStatus))addIssue('medium','التصاريح','permits','حالة التصريح غير مكتملة','حالة التصريح فارغة وتحتاج استكمال.',r);
  if(clean(r.permitNotes)&&!clean(r.actionTaken))addIssue('high','التصاريح','permits','ملاحظة تصريح بدون إجراء مسجل','يوجد نص ملاحظة على التصريح بدون تسجيل الإجراء المتخذ.',r);
  if(containsAny(r.evaluation,['رفض','مرفوض']))addIssue('high','التصاريح','permits','طلب تصريح مرفوض','تقييم الطلب يشير إلى رفض ويحتاج متابعة.',r);
 });
 rows('assets').forEach(r=>{
  if(norm(r.plantingReview)==='تمت المراجعه'){
   if(!clean(r.installDate))addIssue('high','الأصول','assets','تاريخ التركيب مفقود بعد المراجعة','حالة المراجعة تمت المراجعة بينما تاريخ التركيب فارغ.',r);
   if(!clean(r.engineer))addIssue('high','الأصول','assets','مهندس التركيب مفقود بعد المراجعة','حالة المراجعة تمت المراجعة بينما اسم مهندس التركيب فارغ.',r);
  }
 });
 rows('emergency').forEach(r=>{
  const done=isDone(r.status),archive=norm(r.archive);
  if(done&&(!archive||archive.includes('لم يستلم من المقاول')))addIssue('high','المستندات','emergency','إشعار منجز ومستنداته غير مستلمة','التنفيذ منجز لكن دورة المستندات لم تبدأ أو لم تستلم من المقاول.',r);
  if(!clean(r.status))addIssue('medium','جودة البيانات','emergency','حالة تنفيذ الطوارئ فارغة','الإشعار لا يحتوي حالة تنفيذ.',r);
  if(done&&(!clean(r.startDate)||!clean(r.endDate)))addIssue('medium','جودة البيانات','emergency','تواريخ تنفيذ ناقصة لإشعار منجز','الإشعار منجز مع نقص في تاريخ المباشرة أو الانتهاء.',r);
 });
 rows('attachments').forEach(r=>{
  if(clean(r.status)&&!containsAny(r.status,['تم رفع','مكتمل']))addIssue('medium','المرفقات','attachments','مرفقات غير مكتملة','حالة رفع المرفقات لا تشير إلى اكتمال الرفع.',r);
 });
 rows('closures').forEach(r=>{
  if(clean(r.docsReceived)&&!clean(r.docsReview))addIssue('medium','الإغلاقات','closures','مستندات مستلمة بدون مراجعة مسجلة','تم تسجيل استلام المستندات بينما حقل المراجعة فارغ.',r);
 });
 rows('tasks').forEach(r=>{
  if(containsAny(r.attachments,['مشكلة','عدم','ناقص'])&&!containsAny(r.resolved,['تم','معالج']))addIssue('high','متابعة المواقع','tasks','مشكلة مرفقات غير معالجة','السجل يشير إلى مشكلة بالمرفقات دون إثبات معالجة.',r);
 });
 SC.quality=[
  completeness('projects',['workOrder','contractor','engineer','stage','stageStatus','advice']),
  completeness('connections',['workOrder','contractor','engineer','stage','stageStatus','advice']),
  completeness('permits',['workOrder','contractor','permitStatus','evaluation']),
  completeness('assets',['workOrder','contractor','location','plantingReview']),
  completeness('emergency',['noticeNo','contractor','status','archive']),
  completeness('attachments',['workOrder','contractor','status']),
  completeness('closures',['workOrder','contractor','docsReceived','docsReview'])
 ];
 const completed=wo.filter(r=>isDone(r.status)).length,executionRate=pct(completed,wo.length);
 const qualityAvg=SC.quality.length?Math.round(SC.quality.reduce((s,x)=>s+x.score,0)/SC.quality.length*10)/10:100;
 const er=rows('emergency'),doneE=er.filter(r=>isDone(r.status)),docsOk=doneE.filter(r=>{const a=norm(r.archive);return a&& !a.includes('لم يستلم من المقاول')}).length;
 const ar=rows('attachments'),uploaded=ar.filter(r=>containsAny(r.status,['تم رفع','مكتمل'])).length;
 const docParts=[];if(doneE.length)docParts.push(pct(docsOk,doneE.length));if(ar.length)docParts.push(pct(uploaded,ar.length));
 const docScore=docParts.length?Math.round(docParts.reduce((a,b)=>a+b,0)/docParts.length*10)/10:100;
 const health=Math.max(0,Math.min(100,Math.round((executionRate*.45+qualityAvg*.30+docScore*.25)*10)/10));
 const critical=SC.issues.filter(x=>x.severity==='critical').length,high=SC.issues.filter(x=>x.severity==='high').length;
 SC.summary={health,executionRate,qualityAvg,docScore,critical,high,totalIssues:SC.issues.length,totalOrders:wo.length,completed};
 SC.issues.sort((a,b)=>({critical:0,high:1,medium:2}[a.severity]-({critical:0,high:1,medium:2}[b.severity])));
}
function renderAll(){
 if(!SC.summary)return;
 el('scUpdated').textContent='آخر تحليل: '+SC.lastUpdated;
 const root=el('scContent');root.innerHTML=contentMarkup();root.style.display='block';
 renderKpis();renderChanges();renderPriorities();bindAnalyst();bindExceptionTools();renderExceptions();renderCharts();
}
function contentMarkup(){return `
<div class="sc-kpis" id="scKpis"></div>
<div class="sc-grid"><article class="sc-panel"><div class="sc-panel-head"><div><span>WHAT CHANGED</span><h3>ماذا تغير منذ آخر يوم مسجل؟</h3></div><b class="sc-badge" id="scPreviousTime">—</b></div><div id="scChanges" class="sc-changes"></div><div class="sc-method">المقارنة مركزية ومشتركة بين جميع المستخدمين، ويتم حفظ Snapshot يومي داخل ورقة Dashboard History في Google Sheet.</div></article><article class="sc-panel"><div class="sc-panel-head"><div><span>PRIORITY RADAR</span><h3>أعلى نقاط التدخل الآن</h3></div><b class="sc-badge">حسب عدد الاستثناءات</b></div><div id="scPriorities" class="sc-priority-list"></div></article></div>
<div class="sc-grid"><article class="sc-panel"><div class="sc-panel-head"><div><span>SMART ANALYST</span><h3>اسأل المحلل المجاني</h3></div><b class="sc-badge">Rule Engine</b></div><div class="sc-analyst"><div class="sc-question-row"><button class="sc-chip" data-q="ما الحالات الحرجة؟">الحالات الحرجة</button><button class="sc-chip" data-q="من أكثر المقاولين لديهم مشاكل؟">المقاولون</button><button class="sc-chip" data-q="أين مشاكل جودة البيانات؟">جودة البيانات</button><button class="sc-chip" data-q="ما مشاكل المستندات؟">المستندات</button><button class="sc-chip" data-q="ما مشاكل التصاريح؟">التصاريح</button></div><div class="sc-ask-box"><input id="scQuestion" placeholder="اكتب: أكثر المقاولين تأخيرًا، مشاكل الأصول، الحالات الحرجة..."><button id="scAsk">تحليل</button></div><div id="scAnswer" class="sc-answer">اختر سؤالًا جاهزًا أو اكتب سؤالك. الإجابات ناتجة من قواعد وأرقام الداشبورد مباشرة.</div></div></article><article class="sc-panel"><div class="sc-panel-head"><div><span>DATA COMPLETENESS</span><h3>نسبة اكتمال البيانات حسب التاب</h3></div><b class="sc-badge">حقول أساسية</b></div><div class="sc-chart compact"><canvas id="scQualityChart"></canvas></div></article></div>
<div class="sc-grid"><article class="sc-panel"><div class="sc-panel-head"><div><span>ISSUE PROFILE</span><h3>توزيع الاستثناءات حسب النوع</h3></div></div><div class="sc-chart"><canvas id="scIssueChart"></canvas></div></article><article class="sc-panel"><div class="sc-panel-head"><div><span>CONTRACTOR EXPOSURE</span><h3>أعلى المقاولين في عدد الاستثناءات</h3></div></div><div class="sc-chart"><canvas id="scContractorChart"></canvas></div></article></div>
<article class="sc-panel sc-exception-wrap"><div class="sc-panel-head"><div><span>EXCEPTION CENTER</span><h3>مركز الاستثناءات — الحالات التي تحتاج مراجعة</h3></div><b class="sc-badge" id="scIssueCount">0</b></div><div class="sc-toolbar"><select id="scSeverity"><option value="">كل درجات الأهمية</option><option value="critical">حرجة</option><option value="high">مرتفعة</option><option value="medium">متوسطة</option></select><select id="scCategory"><option value="">كل الأنواع</option></select><input id="scIssueSearch" placeholder="بحث بأمر العمل، الإشعار، المقاول، المهندس أو الوصف..."></div><div id="scExceptionTable" class="sc-table-wrap"></div></article>`}
function renderKpis(){
 const s=SC.summary;const cards=[
  ['صحة المشروع',s.health.toFixed(1)+'%','تنفيذ 45% + جودة 30% + مستندات 25%',s.health>=80?'success':s.health>=65?'warning':'danger'],
  ['استثناءات حرجة',s.critical,'تحتاج مراجعة أولوية','danger'],
  ['استثناءات مرتفعة',s.high,'تحتاج متابعة قريبة','warning'],
  ['اكتمال البيانات',s.qualityAvg.toFixed(1)+'%','متوسط الحقول الأساسية','success'],
  ['اكتمال دورة المستندات',s.docScore.toFixed(1)+'%','الطوارئ + المرفقات','purple']
 ];
 el('scKpis').innerHTML=cards.map(c=>`<article class="sc-kpi" data-tone="${c[3]}"><span>${esc(c[0])}</span><strong>${esc(c[1])}</strong><small>${esc(c[2])}</small></article>`).join('');
}
function snapshotData(){
 const byCategory=groupIssues('category',20),byContractor=groupIssues('contractor',20);
 return {time:new Date().toISOString(),summary:SC.summary,categories:Object.fromEntries(byCategory.map(x=>[x.name,x.count])),contractors:Object.fromEntries(byContractor.map(x=>[x.name,x.count]))};
}
function snapshotKey(){return 'smart-center-snapshot-v1|'+SC.projectKey}
function previousSnapshot(){try{return JSON.parse(localStorage.getItem(snapshotKey())||'null')}catch(e){return null}}
function saveSnapshot(){try{localStorage.setItem(snapshotKey(),JSON.stringify(snapshotData()))}catch(e){}}
function issueKey(x){return [x.severity,x.category,x.pageKey,x.title,x.id,x.row].map(clean).join('|')}
async function syncCentralHistory(){
 const categories=Object.fromEntries(groupIssues('category',40).map(x=>[x.name,x.count]));
 const contractors=Object.fromEntries(groupIssues('contractor',80).map(x=>[x.name,x.count]));
 const payload={
  summary:SC.summary,
  issueKeys:SC.issues.slice(0,1800).map(issueKey),
  categories,
  contractors
 };
 try{SC.centralHistory=await rpc('saveSmartHistory',[payload])}
 catch(e){SC.centralHistory={ok:false,error:e.message||String(e)}}
}
function deltaText(now,old){const d=Math.round((Number(now||0)-Number(old||0))*10)/10;return {d,text:(d>0?'+':'')+d,cls:d>0?'up':d<0?'down':'same'}}
function renderChanges(){
 const root=el('scChanges'),central=SC.centralHistory;
 if(central?.ok&&central.source==='google-sheet'){
  if(!central.previous){
   el('scPreviousTime').textContent='Google Sheet • خط أساس';
   root.innerHTML='<div class="sc-change same"><b>تم حفظ أول Snapshot مركزي</b><span>من الغد ستظهر مقارنة فعلية مع آخر يوم مسجل لجميع المستخدمين.</span></div>';
   return;
  }
  el('scPreviousTime').textContent='مقارنة مع '+central.previous.date;
  const c=central.changes||{};
  const items=[
   ['أوامر تم تنفيذها',c.completed,'good',''],
   ['مشاكل جديدة',c.newIssues,'bad',''],
   ['مشاكل تم حلها',c.resolvedIssues,'good',''],
   ['إجمالي الاستثناءات',c.totalIssues,'bad',''],
   ['اكتمال البيانات',c.qualityAvg,'good','%'],
   ['صحة المشروع',c.health,'good','%']
  ];
  root.innerHTML=items.map(([label,value,direction,suffix])=>{
   const d=Number(value||0),good=d===0?null:(direction==='good'?d>0:d<0);
   const cls=d===0?'same':good?'down':'up';
   return `<div class="sc-change ${cls}"><b>${d>0?'+':''}${d}${suffix}</b><span>${esc(label)}</span></div>`;
  }).join('');
  return;
 }
 const prev=SC.previous;
 if(!prev?.summary){
  el('scPreviousTime').textContent='محلي • خط أساس';
  root.innerHTML='<div class="sc-change same"><b>تعذر السجل المركزي</b><span>تم استخدام Snapshot محلي مؤقتًا حتى تتاح الكتابة على Google Sheet.</span></div>';
  return;
 }
 el('scPreviousTime').textContent='محلي • '+new Date(prev.time).toLocaleString('ar-SA');
 const items=[
  ['إجمالي الاستثناءات',SC.summary.totalIssues,prev.summary.totalIssues,false,''],
  ['الحالات الحرجة',SC.summary.critical,prev.summary.critical,false,''],
  ['اكتمال البيانات',SC.summary.qualityAvg,prev.summary.qualityAvg,true,'%'],
  ['صحة المشروع',SC.summary.health,prev.summary.health,true,'%']
 ];
 root.innerHTML=items.map(([label,now,old,goodUp,suffix])=>{const d=Math.round((Number(now)-Number(old))*10)/10;const good=d===0?null:(d>0)===goodUp;const cls=d===0?'same':good?'down':'up';return `<div class="sc-change ${cls}"><b>${d>0?'+':''}${d}${suffix}</b><span>${esc(label)} • الحالي ${Number(now).toFixed(suffix?1:0)}${suffix}</span></div>`}).join('');
}
function groupIssues(key,limit=10,source=SC.issues){
 const m=new Map();source.forEach(x=>{const name=clean(x[key]);if(name)m.set(name,(m.get(name)||0)+1)});
 return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([name,count])=>({name,count}));
}
function renderPriorities(){
 const data=groupIssues('category',5);const root=el('scPriorities');
 root.innerHTML=data.length?data.map((x,i)=>`<div class="sc-priority"><span class="sc-priority-rank">${i+1}</span><div><b>${esc(x.name)}</b><small>عدد الحالات المكتشفة بهذه الفئة</small></div><strong>${x.count}</strong></div>`).join(''):'<div class="sc-empty">لا توجد استثناءات مكتشفة بالقواعد الحالية.</div>';
}
function bindAnalyst(){
 document.querySelectorAll('#smartCenterPage .sc-chip').forEach(b=>b.onclick=()=>{el('scQuestion').value=b.dataset.q||'';answerQuestion()});
 el('scAsk').onclick=answerQuestion;el('scQuestion').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();answerQuestion()}});
}
function listText(items,label='حالة'){return items.length?items.map((x,i)=>`${i+1}) ${x.name}: ${x.count} ${label}`).join('\n'):'لا توجد حالات ضمن هذا التصنيف.'}
function answerQuestion(){
 const q=norm(el('scQuestion').value),out=el('scAnswer');if(!q){out.textContent='اكتب سؤالك أولًا.';return}
 let text='';
 if(q.includes('مقاول')){
  let src=SC.issues;if(q.includes('تاخير')||q.includes('متاخر'))src=src.filter(x=>x.category==='التأخير');
  const top=groupIssues('contractor',7,src);text='أعلى المقاولين حسب الحالات المطابقة:\n'+listText(top,'حالة')+'\n\nالاحتساب من الاستثناءات المكتشفة بالقواعد الحالية.';
 }else if(q.includes('جوده')||q.includes('بيانات')||q.includes('فارغ')||q.includes('نقص')){
  const data=[...SC.quality].sort((a,b)=>a.score-b.score).slice(0,7);text='أقل التابات في اكتمال الحقول الأساسية:\n'+data.map((x,i)=>`${i+1}) ${x.title}: ${x.score.toFixed(1)}% — ${x.missing} خلية ناقصة`).join('\n');
 }else if(q.includes('حرج')||q.includes('تدخل')||q.includes('اولويه')){
  const data=SC.issues.filter(x=>x.severity==='critical').slice(0,8);text=data.length?'الحالات الحرجة الحالية:\n'+data.map((x,i)=>`${i+1}) ${x.title}${x.id?' — '+x.id:''}${x.contractor?' — '+x.contractor:''}`).join('\n'):'لا توجد حالات حرجة وفق القواعد الحالية.';
 }else if(q.includes('مستند')||q.includes('مرفق')||q.includes('اغلاق')){
  const data=SC.issues.filter(x=>['المستندات','المرفقات','الإغلاقات'].includes(x.category));text=`إجمالي مشاكل دورة المستندات المكتشفة: ${data.length}\n`+listText(groupIssues('category',6,data),'حالة');
 }else if(q.includes('تصريح')){
  const data=SC.issues.filter(x=>x.category==='التصاريح');text=`إجمالي استثناءات التصاريح: ${data.length}\n`+listText(groupIssues('title',6,data),'حالة');
 }else if(q.includes('اصل')||q.includes('اصول')||q.includes('تركيب')){
  const data=SC.issues.filter(x=>x.category==='الأصول');text=`إجمالي استثناءات الأصول: ${data.length}\n`+listText(groupIssues('title',6,data),'حالة');
 }else if(q.includes('تاخير')||q.includes('متاخر')){
  const data=SC.issues.filter(x=>x.category==='التأخير');text=`إجمالي حالات التأخير المكتشفة: ${data.length}\nأعلى المقاولين:\n`+listText(groupIssues('contractor',6,data),'حالة');
 }else{text=`ملخص المشروع الحالي:\n• صحة المشروع: ${SC.summary.health.toFixed(1)}%\n• اكتمال البيانات: ${SC.summary.qualityAvg.toFixed(1)}%\n• الحالات الحرجة: ${SC.summary.critical}\n• الحالات مرتفعة الأهمية: ${SC.summary.high}\n• إجمالي الاستثناءات: ${SC.summary.totalIssues}\n\nيمكنك السؤال عن المقاولين، التأخير، الجودة، المستندات، التصاريح أو الأصول.`}
 out.textContent=text;
}
function bindExceptionTools(){
 const cats=[...new Set(SC.issues.map(x=>x.category).filter(Boolean))].sort();
 el('scCategory').innerHTML='<option value="">كل الأنواع</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 el('scSeverity').onchange=renderExceptions;el('scCategory').onchange=renderExceptions;
 let t;el('scIssueSearch').oninput=()=>{clearTimeout(t);t=setTimeout(renderExceptions,130)};
}
function filteredIssues(){
 const sev=el('scSeverity')?.value||'',cat=el('scCategory')?.value||'',q=norm(el('scIssueSearch')?.value||'');
 return SC.issues.filter(x=>{
  if(sev&&x.severity!==sev)return false;if(cat&&x.category!==cat)return false;
  if(!q)return true;return norm([x.title,x.detail,x.id,x.contractor,x.engineer,x.section,PAGE_TITLES[x.pageKey]].join(' ')).includes(q);
 });
}
function renderExceptions(){
 const data=filteredIssues(),root=el('scExceptionTable');el('scIssueCount').textContent=data.length.toLocaleString('ar-SA');
 if(!data.length){root.innerHTML='<div class="sc-empty">لا توجد حالات مطابقة للفلاتر الحالية.</div>';return}
 root.innerHTML=`<table class="sc-table"><thead><tr><th>الأهمية</th><th>النوع</th><th>الملاحظة</th><th>السجل</th><th>المقاول</th><th>المهندس</th><th>المصدر</th><th></th></tr></thead><tbody>${data.slice(0,500).map((x,i)=>`<tr><td><span class="sc-severity ${x.severity}">${SEV_LABELS[x.severity]||x.severity}</span></td><td>${esc(x.category)}</td><td><b>${esc(x.title)}</b><br><small>${esc(x.detail)}</small></td><td>${esc(x.id||'—')}</td><td>${esc(x.contractor||'—')}</td><td>${esc(x.engineer||'—')}</td><td>${esc(PAGE_TITLES[x.pageKey]||x.pageKey)}</td><td><button class="sc-source-btn" data-source-index="${SC.issues.indexOf(x)}">فتح المصدر</button></td></tr>`).join('')}</tbody></table>`;
 root.querySelectorAll('.sc-source-btn').forEach(b=>b.onclick=()=>openIssueSource(SC.issues[Number(b.dataset.sourceIndex)]));
}
function openIssueSource(issue){
 if(!issue)return;leaveSmartCenter();
 const search=el('globalSearch');if(search)search.value=issue.id||issue.contractor||'';
 if(typeof openPage==='function')openPage(issue.pageKey);
 setTimeout(()=>{try{if(typeof applyFilters==='function')applyFilters()}catch(e){}},700);
}
function destroyChart(id){try{SC.charts[id]?.destroy()}catch(e){}delete SC.charts[id]}
function barChart(id,labels,data,horizontal=false,max=100){
 destroyChart(id);const canvas=el(id);if(!canvas||typeof Chart==='undefined')return;
 SC.charts[id]=new Chart(canvas,{type:'bar',data:{labels,datasets:[{data,backgroundColor:'rgba(40,120,232,.72)',hoverBackgroundColor:'rgba(40,120,232,.9)',borderWidth:0,borderRadius:7,maxBarThickness:34}]},options:{indexAxis:horizontal?'y':'x',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{rtl:true,titleFont:{family:'Cairo'},bodyFont:{family:'Cairo'}}},scales:{x:{beginAtZero:true,max:horizontal&&max===100?100:undefined,grid:{display:false},ticks:{font:{family:'Cairo',size:8}}},y:{beginAtZero:true,max:!horizontal&&max===100?100:undefined,grid:{color:'rgba(120,140,165,.12)'},ticks:{font:{family:'Cairo',size:8}}}}}});
}
function renderCharts(){
 const quality=[...SC.quality].sort((a,b)=>a.score-b.score);barChart('scQualityChart',quality.map(x=>x.title),quality.map(x=>x.score),true,100);
 const categories=groupIssues('category',9);barChart('scIssueChart',categories.map(x=>x.name),categories.map(x=>x.count),true,0);
 const contractors=groupIssues('contractor',10);barChart('scContractorChart',contractors.map(x=>x.name),contractors.map(x=>x.count),true,0);
}
function bootSmartCenter(){
 const identity=projectIdentity();SC.projectKey=identity.key;installUi();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bootSmartCenter,120));else setTimeout(bootSmartCenter,120);
})();
