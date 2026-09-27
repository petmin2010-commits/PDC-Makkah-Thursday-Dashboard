(function(){
'use strict';
const SC={loaded:false,loading:false,pages:{},issues:[],quality:[],summary:null,charts:{},projectKey:'',lastUpdated:'',previous:null,centralHistory:null};
const PAGE_KEYS=['workorders','projects','connections','permits','assets','closures','emergency','attachments','tasks','safety','executionViolations','minutes'];
const PAGE_TITLES={workorders:'أوامر العمل',projects:'المشاريع',connections:'التوصيلات',permits:'التصاريح',assets:'الأصول',closures:'الإغلاقات',emergency:'الطوارئ',attachments:'المرفقات',tasks:'متابعة المواقع',safety:'مخالفات السلامة',executionViolations:'مخالفات التنفيذ',minutes:'محاضر إثبات الحالة'};
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
 const memoryBtn=document.createElement('button');memoryBtn.type='button';memoryBtn.id='temporalMemoryNav';memoryBtn.className='nav-item';memoryBtn.innerHTML='◷ <span>ذاكرة المشروع الزمنية</span>';
 nav.insertBefore(label,reports||null);nav.insertBefore(btn,reports||null);nav.insertBefore(memoryBtn,reports||null);
 const page=document.createElement('section');page.id='smartCenterPage';page.className='page smart-center-page';page.innerHTML=smartCenterMarkup();
 const memoryPage=document.createElement('section');memoryPage.id='temporalMemoryPage';memoryPage.className='page smart-center-page temporal-memory-page';memoryPage.innerHTML=temporalMemoryMarkup();
 const main=document.querySelector('main');const firstPage=el('masterPage');main.insertBefore(page,firstPage||null);main.insertBefore(memoryPage,firstPage||null);
 btn.addEventListener('click',openSmartCenter);memoryBtn.addEventListener('click',openTemporalMemory);
 nav.addEventListener('click',e=>{const item=e.target.closest('.nav-item');if(item&&!['smartCenterNav','temporalMemoryNav'].includes(item.id))leaveSmartCenter()});
 bindSmartCenter();bindTemporalMemory();
}
function smartCenterMarkup(){return `
<div class="sc-hero"><div class="sc-hero-main"><div><span class="sc-eyebrow">SMART PROJECT INTELLIGENCE • FREE ENGINE</span><h2>🧠 مركز التحليل الذكي</h2><p>تحليل مباشر لقواعد المشروع، جودة البيانات، التأخيرات والاستثناءات بدون أي API مدفوع.</p></div><div class="sc-hero-actions"><span class="sc-live"><i></i><span id="scUpdated">جاري التحليل...</span></span><button id="scRefresh" class="sc-refresh">↻ إعادة التحليل</button></div></div></div>
<div id="scLoading" class="sc-loading"><i></i><span>جاري قراءة بيانات المشروع وبناء التحليل الذكي...</span></div>
<div id="scContent" style="display:none"></div>`}
function temporalMemoryMarkup(){return `
<div class="tm-hero"><div><span>PROJECT TEMPORAL MEMORY • EVIDENCE ENGINE</span><h2>◷ ذاكرة المشروع الزمنية</h2><p>تقرأ اللقطات التاريخية المركزية وسجلات المخالفات المؤرخة للإجابة عن: متى بدأ التدهور؟ ما أول مؤشر؟ وماذا سبق التغير؟</p></div><div class="tm-actions"><span id="tmCoverageBadge">جاري بناء الذاكرة...</span><button id="tmRefresh" type="button">↻ تحديث الذاكرة</button></div></div>
<div id="tmLoading" class="sc-loading"><i></i><span>جاري بناء الذاكرة الزمنية وتحليل التسلسل...</span></div>
<div id="tmContent" class="tm-content" style="display:none">
 <div id="tmKpis" class="tm-kpis"></div>
 <article class="tm-question-panel">
  <div class="tm-panel-head"><div><span>ASK THE PAST</span><h3>اسأل ذاكرة المشروع</h3><p>الإجابة تذكر الفترة والدليل وحدود التغطية بدل التخمين.</p></div><b>زمن + دليل</b></div>
  <div class="tm-chips">
   <button type="button" data-tmq="متى بدأ التدهور؟">متى بدأ التدهور؟</button>
   <button type="button" data-tmq="ما أول مؤشر ظهر؟">ما أول مؤشر ظهر؟</button>
   <button type="button" data-tmq="منذ متى أصبح أعلى مقاول من المتوسط؟">متى تجاوز المقاول المتوسط؟</button>
   <button type="button" data-tmq="ما الذي تغير قبل ارتفاع المخالفات بأسبوعين؟">ما قبل ارتفاع المخالفات بأسبوعين؟</button>
  </div>
  <div class="tm-ask"><input id="tmQuestion" placeholder="مثال: منذ متى أصبح المقاول شركة ... أعلى من المتوسط؟"><button id="tmAsk" type="button">تحليل زمني</button></div>
  <div id="tmAnswer" class="tm-answer">اختر سؤالًا جاهزًا أو اكتب سؤالًا زمنيًا.</div>
 </article>
 <div class="tm-grid">
  <article class="sc-panel"><div class="sc-panel-head"><div><span>PROJECT MEMORY</span><h3>تطور صحة المشروع والمؤشرات</h3></div><b class="sc-badge" id="tmHistoryCount">0 لقطة</b></div><div class="tm-chart"><canvas id="tmHistoryChart"></canvas></div></article>
  <article class="sc-panel"><div class="sc-panel-head"><div><span>VIOLATION MEMORY</span><h3>المخالفات حسب أسبوع الجمعة–الخميس</h3></div><b class="sc-badge" id="tmViolationCount">0 سجل</b></div><div class="tm-chart"><canvas id="tmViolationChart"></canvas></div></article>
 </div>
 <article class="sc-panel tm-evidence-panel"><div class="sc-panel-head"><div><span>TEMPORAL EVIDENCE</span><h3>أهم الاستنتاجات الزمنية الحالية</h3></div><b class="sc-badge">قابلة للتفسير</b></div><div id="tmEvidence" class="tm-evidence"></div></article>
</div>`}
function openSmartCenter(){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 el('smartCenterPage')?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id==='smartCenterNav'));
 if(el('filterBar'))el('filterBar').style.display='none';
 if(el('pageTitle'))el('pageTitle').textContent='مركز التحليل الذكي';
 if(!SC.loaded)loadSmartCenter();else renderAll();
}
async function openTemporalMemory(){
 if(SC.loading){setTimeout(openTemporalMemory,250);return}
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 el('temporalMemoryPage')?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id==='temporalMemoryNav'));
 if(el('filterBar'))el('filterBar').style.display='none';
 if(el('pageTitle'))el('pageTitle').textContent='ذاكرة المشروع الزمنية';
 if(!SC.loaded){el('tmLoading').style.display='flex';el('tmContent').style.display='none';await loadSmartCenter()}
 renderTemporalMemory();
}
function leaveSmartCenter(){
 el('smartCenterPage')?.classList.remove('active');
 el('temporalMemoryPage')?.classList.remove('active');
 if(el('filterBar'))el('filterBar').style.display='';
}
function bindSmartCenter(){
 el('scRefresh').onclick=()=>loadSmartCenter(true);
}
function bindTemporalMemory(){
 el('tmRefresh').onclick=async()=>{el('tmLoading').style.display='flex';el('tmContent').style.display='none';await loadSmartCenter(true);renderTemporalMemory()};
 el('tmAsk').onclick=answerTemporalQuestion;
 el('tmQuestion').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();answerTemporalQuestion()}});
 document.querySelectorAll('#temporalMemoryPage [data-tmq]').forEach(b=>b.onclick=()=>{el('tmQuestion').value=b.dataset.tmq||'';answerTemporalQuestion()});
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
<article class="sc-what-banner">
 <div class="sc-what-head"><div><span>WHAT CHANGED</span><h3>ماذا تغير منذ أمس؟</h3><p>ملخص تنفيذي تلقائي لأهم التغيّرات منذ آخر يوم مسجل.</p></div><b class="sc-what-date" id="scPreviousTime">—</b></div>
 <div id="scChangeSummary" class="sc-what-summary">جاري بناء المقارنة...</div>
 <div id="scChanges" class="sc-change-strip"></div>
 <div class="sc-method">المقارنة مركزية ومشتركة بين جميع المستخدمين، ويتم حفظ Snapshot يومي داخل ورقة Dashboard History في Google Sheet.</div>
</article>
<article class="sc-panel sc-priority-wide"><div class="sc-panel-head"><div><span>PRIORITY RADAR</span><h3>أعلى نقاط التدخل الآن</h3></div><b class="sc-badge">حسب عدد الاستثناءات</b></div><div id="scPriorities" class="sc-priority-list"></div></article>
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
function changeCard(label,value,direction,suffix=''){
 const d=Math.round(Number(value||0)*10)/10;
 const positive=d===0?null:(direction==='good'?d>0:d<0);
 const cls=d===0?'neutral':positive?'positive':'negative';
 const arrow=d===0?'→':d>0?'↑':'↓';
 return `<div class="sc-change-card ${cls}"><span class="sc-change-arrow">${arrow}</span><div><strong>${d>0?'+':''}${d}${suffix}</strong><small>${esc(label)}</small></div></div>`;
}
function renderChanges(){
 const root=el('scChanges'),summary=el('scChangeSummary'),central=SC.centralHistory;
 if(central?.ok&&central.source==='google-sheet'){
  if(!central.previous){
   el('scPreviousTime').textContent='تم تسجيل اليوم';
   summary.innerHTML='<span class="sc-summary-icon neutral">●</span><div><b>تم إنشاء خط الأساس المركزي لليوم.</b><small>من أول يوم لاحق سيظهر هنا ملخص فعلي لما تحسن وما يحتاج انتباه.</small></div>';
   root.innerHTML=changeCard('Snapshot مركزي','0','good','');
   return;
  }
  el('scPreviousTime').textContent='مقارنة مع '+central.previous.date;
  const c=central.changes||{};
  const completed=Number(c.completed||0),newIssues=Number(c.newIssues||0),resolved=Number(c.resolvedIssues||0),quality=Math.round(Number(c.qualityAvg||0)*10)/10;
  const overall=(resolved+Math.max(0,completed))-(newIssues+Math.max(0,-completed));
  const summaryTone=overall>0?'positive':overall<0?'negative':'neutral';
  const summaryIcon=summaryTone==='positive'?'↑':summaryTone==='negative'?'↓':'→';
  const parts=[];
  if(completed)parts.push(`${completed>0?'تم تنفيذ':'انخفض عدد المنفذ بمقدار'} ${Math.abs(completed)} ${completed>0?'أمر عمل':''}`.trim());
  if(newIssues)parts.push(`ظهرت ${newIssues} مشكلة جديدة`);
  if(resolved)parts.push(`تم حل ${resolved} مشكلة`);
  if(quality)parts.push(`${quality>0?'تحسن':'تراجع'} اكتمال البيانات ${Math.abs(quality)}%`);
  const sentence=parts.length?parts.join('، ')+' .':'لا توجد تغيرات جوهرية مسجلة مقارنة بآخر يوم محفوظ.';
  summary.innerHTML=`<span class="sc-summary-icon ${summaryTone}">${summaryIcon}</span><div><b>${esc(sentence)}</b><small>ملخص تلقائي مبني على Snapshot المركزي — وليس تقديرًا يدويًا.</small></div>`;
  root.innerHTML=[
   changeCard('أوامر تم تنفيذها',completed,'good'),
   changeCard('مشاكل جديدة',newIssues,'bad'),
   changeCard('مشاكل تم حلها',resolved,'good'),
   changeCard('اكتمال البيانات',quality,'good','%')
  ].join('');
  return;
 }
 const prev=SC.previous;
 if(!prev?.summary){
  el('scPreviousTime').textContent='خط أساس محلي';
  summary.innerHTML='<span class="sc-summary-icon neutral">!</span><div><b>السجل المركزي غير متاح حاليًا.</b><small>سيتم استخدام Snapshot محلي مؤقت حتى تعود المزامنة المركزية.</small></div>';
  root.innerHTML=changeCard('حالة المقارنة',0,'good');
  return;
 }
 el('scPreviousTime').textContent='محلي • '+new Date(prev.time).toLocaleString('ar-SA');
 const totalDelta=Math.round((SC.summary.totalIssues-prev.summary.totalIssues)*10)/10;
 const criticalDelta=Math.round((SC.summary.critical-prev.summary.critical)*10)/10;
 const qualityDelta=Math.round((SC.summary.qualityAvg-prev.summary.qualityAvg)*10)/10;
 const healthDelta=Math.round((SC.summary.health-prev.summary.health)*10)/10;
 summary.innerHTML='<span class="sc-summary-icon neutral">→</span><div><b>مقارنة محلية مؤقتة.</b><small>النتائج أدناه من آخر Snapshot محفوظ على هذا الجهاز.</small></div>';
 root.innerHTML=[
  changeCard('إجمالي الاستثناءات',totalDelta,'bad'),
  changeCard('الحالات الحرجة',criticalDelta,'bad'),
  changeCard('اكتمال البيانات',qualityDelta,'good','%'),
  changeCard('صحة المشروع',healthDelta,'good','%')
 ].join('');
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

function tmDigits(v){return clean(v).replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/[۰-۹]/g,d=>'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])}
function tmDate(v){
 const s=tmDigits(v);if(!s)return null;
 const make=(y,m,d)=>{const x=new Date(y,m-1,d);x.setHours(0,0,0,0);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null};
 let m=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);if(m)return make(+m[1],+m[2],+m[3]);
 m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);if(m)return make(+m[3],+m[2],+m[1]);
 const d=new Date(s);if(isNaN(d))return null;d.setHours(0,0,0,0);return d;
}
function tmDateKey(d){if(!(d instanceof Date)||isNaN(d))return'';return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function tmFmtDate(v){const d=v instanceof Date?v:tmDate(v);return d?String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear():'—'}
function tmAddDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);x.setHours(0,0,0,0);return x}
function tmHistory(){return Array.isArray(SC.centralHistory&&SC.centralHistory.memoryHistory)?[...SC.centralHistory.memoryHistory].filter(x=>x&&x.date).sort((a,b)=>String(a.date).localeCompare(String(b.date))):[]}
function tmViolationRecords(){
 const defs=[
  ['مخالفات السلامة',rows('safety'),r=>r.date,r=>[r.violation1,r.violation2].filter(Boolean).join(' / ')],
  ['مخالفات التنفيذ',rows('executionViolations'),r=>r.date,r=>r.violation],
  ['محاضر إثبات الحالة',rows('minutes'),r=>r.date,r=>r.minuteType||r.penaltyItem1]
 ];
 const out=[],tomorrow=tmAddDays(new Date(),1);
 defs.forEach(([source,list,dateFn,typeFn])=>list.forEach(r=>{
  const date=tmDate(dateFn(r));if(!date||date>tomorrow)return;
  out.push({date,dateKey:tmDateKey(date),source,contractor:clean(r.contractor),workOrder:clean(r.workOrder),type:clean(typeFn(r)),row:r._row||''});
 }));
 return out.sort((a,b)=>a.date-b.date);
}
function tmWeekStart(d){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()-5+7)%7));return x}
function tmMapInc(m,k,n=1){if(!k)return;m.set(k,(m.get(k)||0)+n)}
function tmWeeklyViolations(){
 const map=new Map();
 tmViolationRecords().forEach(r=>{
  const start=tmWeekStart(r.date),key=tmDateKey(start);
  if(!map.has(key))map.set(key,{key,start,end:tmAddDays(start,6),count:0,sources:new Map(),contractors:new Map(),types:new Map()});
  const w=map.get(key);w.count++;tmMapInc(w.sources,r.source);tmMapInc(w.contractors,r.contractor);tmMapInc(w.types,r.type);
 });
 return [...map.values()].sort((a,b)=>a.start-b.start);
}
function tmGroup(records,field){
 const m=new Map();records.forEach(r=>tmMapInc(m,clean(r[field])));
 return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}));
}
function tmPositiveChange(now,before){
 const a=new Map(now.map(x=>[x.name,x.count])),b=new Map(before.map(x=>[x.name,x.count])),out=[];
 new Set([...a.keys(),...b.keys()]).forEach(name=>{if(!name)return;const delta=(a.get(name)||0)-(b.get(name)||0);if(delta>0)out.push({name,delta,current:a.get(name)||0,previous:b.get(name)||0})});
 return out.sort((x,y)=>y.delta-x.delta);
}
function tmDeterioration(){
 const h=tmHistory();if(h.length<2)return {ok:false,reason:'تحتاج الذاكرة إلى لقطتين مركزيتين على الأقل لتحديد بداية التدهور.'};
 const events=[];
 for(let i=1;i<h.length;i++){
  const p=h[i-1],c=h[i];
  const parts=[
   {label:'صحة المشروع',delta:Number(p.health||0)-Number(c.health||0),unit:'%',w:1.2},
   {label:'اكتمال البيانات',delta:Number(p.qualityAvg||0)-Number(c.qualityAvg||0),unit:'%',w:.8},
   {label:'نسبة التنفيذ',delta:Number(p.executionRate||0)-Number(c.executionRate||0),unit:'%',w:1},
   {label:'دورة المستندات',delta:Number(p.docScore||0)-Number(c.docScore||0),unit:'%',w:.5},
   {label:'إجمالي الاستثناءات',delta:Number(c.totalIssues||0)-Number(p.totalIssues||0),unit:'',w:.8},
   {label:'الحالات الحرجة',delta:Number(c.critical||0)-Number(p.critical||0),unit:'',w:2}
  ].filter(x=>x.delta>0);
  const score=parts.reduce((s,x)=>s+x.delta*x.w,0);
  events.push({index:i,date:c.date,prevDate:p.date,score,parts});
 }
 const bad=events.filter(x=>x.score>=1);
 if(!bad.length)return {ok:true,stable:true,date:h[h.length-1].date,reason:'لم يظهر تدهور واضح في اللقطات المركزية المحفوظة حتى الآن.',events};
 let bestRun=[],run=[];
 events.forEach(ev=>{if(ev.score>=1){run.push(ev)}else{if(run.length>bestRun.length||(run.length===bestRun.length&&run.length&&run[run.length-1].date>(bestRun[bestRun.length-1]||{}).date))bestRun=[...run];run=[]}});
 if(run.length>bestRun.length||(run.length===bestRun.length&&run.length&&run[run.length-1].date>(bestRun[bestRun.length-1]||{}).date))bestRun=[...run];
 if(!bestRun.length)bestRun=[bad.sort((a,b)=>b.score-a.score)[0]];
 const first=bestRun[0],last=bestRun[bestRun.length-1];
 return {ok:true,stable:false,date:first.date,prevDate:first.prevDate,score:first.score,parts:first.parts,run:bestRun,lastDate:last.date,events};
}
function tmFirstIndicator(){
 const d=tmDeterioration();if(!d.ok)return d;if(d.stable)return {ok:true,stable:true,date:d.date,label:'لا يوجد مؤشر تدهور واضح',detail:d.reason};
 const ev=(d.run&&d.run[0])||d;const ranked=[...(ev.parts||[])].sort((a,b)=>(b.delta*b.w)-(a.delta*a.w));const first=ranked[0];
 return first?{ok:true,stable:false,date:ev.date,label:first.label,delta:first.delta,unit:first.unit,detail:'كان أول/أقوى مؤشر سلبي في بداية موجة التدهور المسجلة.'}:{ok:false,reason:'لا يوجد تغير كافٍ لتحديد أول مؤشر.'};
}


function tmFindContractor(q){
 const candidates=new Set();
 tmViolationRecords().forEach(r=>{if(r.contractor)candidates.add(r.contractor)});
 tmHistory().forEach(h=>Object.keys(h.contractors||{}).forEach(x=>{if(clean(x))candidates.add(x)}));
 const nq=norm(q);const matches=[...candidates].filter(x=>nq.includes(norm(x))).sort((a,b)=>b.length-a.length);
 if(matches.length)return matches[0];
 if(nq.includes('مخالف')){const recent=tmViolationRecords().filter(r=>r.contractor),top=tmGroup(recent,'contractor')[0];return top?top.name:''}
 const h=tmHistory(),latest=h.length?h[h.length-1]:null,top=latest?Object.entries(latest.contractors||{}).sort((a,b)=>Number(b[1])-Number(a[1]))[0]:null;return top?top[0]:'';
}
function tmAboveAverageRun(points){
 const above=points.filter(p=>p.count>p.avg);if(!above.length)return null;
 let latestRun=[],current=[];
 points.forEach(p=>{if(p.count>p.avg)current.push(p);else{if(current.length)latestRun=current;current=[]}});
 if(current.length)latestRun=current;
 if(!latestRun.length)latestRun=[above[above.length-1]];
 return {since:latestRun[0],latest:latestRun[latestRun.length-1],length:latestRun.length};
}
function tmContractorMemory(q){
 const contractor=tmFindContractor(q);if(!contractor)return {ok:false,reason:'اكتب اسم المقاول داخل السؤال حتى أستطيع تتبع تاريخه.'};
 const useViolations=norm(q).includes('مخالف');
 if(useViolations){
  const weeks=tmWeeklyViolations(),pts=weeks.map(w=>{const vals=[...w.contractors.values()].filter(v=>v>0);return {date:w.key,label:tmFmtDate(w.start)+' — '+tmFmtDate(w.end),count:w.contractors.get(contractor)||0,avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}}).filter(x=>x.count||x.avg);
  const run=tmAboveAverageRun(pts);if(!run)return {ok:true,contractor,above:false,scope:'المخالفات',reason:'لم يظهر المقاول أعلى من متوسط المقاولين في أسابيع المخالفات المتاحة.'};
  return {ok:true,contractor,above:true,scope:'المخالفات',since:run.since.date,label:run.since.label,count:run.latest.count,avg:run.latest.avg,points:pts};
 }
 const h=tmHistory(),pts=h.map(x=>{const obj=x.contractors||{},vals=Object.values(obj).map(Number).filter(v=>v>0);return {date:x.date,count:Number(obj[contractor]||0),avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}}).filter(x=>x.count||x.avg);
 const run=tmAboveAverageRun(pts);if(!run)return {ok:true,contractor,above:false,scope:'الاستثناءات',reason:'لم يظهر المقاول أعلى من متوسط المقاولين في اللقطات المركزية المتاحة.'};
 return {ok:true,contractor,above:true,scope:'الاستثناءات',since:run.since.date,count:run.latest.count,avg:run.latest.avg,points:pts};
}
function tmViolationSpike(){
 const weeks=tmWeeklyViolations();if(weeks.length<2)return {ok:false,reason:'لا توجد أسابيع مخالفة كافية للمقارنة.'};
 const diffs=[];for(let i=1;i<weeks.length;i++){const prev=weeks[i-1],cur=weeks[i],delta=cur.count-prev.count,pctRise=prev.count?delta/prev.count*100:(delta>0?100:0);diffs.push({i,prev,cur,delta,pctRise})}
 const positive=diffs.filter(x=>x.delta>0);if(!positive.length)return {ok:true,stable:true,reason:'لم يظهر ارتفاع أسبوعي في المخالفات ضمن البيانات المؤرخة المتاحة.',weeks};
 const significant=positive.filter(x=>x.delta>=3||x.pctRise>=25),spike=(significant.length?significant:positive)[(significant.length?significant:positive).length-1];
 const start=spike.cur.start,beforeEnd=tmAddDays(start,-1),beforeStart=tmAddDays(start,-14),baseEnd=tmAddDays(start,-15),baseStart=tmAddDays(start,-28);
 const rec=tmViolationRecords(),range=(a,b)=>rec.filter(r=>r.date>=a&&r.date<=b),pre=range(beforeStart,beforeEnd),base=range(baseStart,baseEnd);
 const sourceChanges=tmPositiveChange(tmGroup(pre,'source'),tmGroup(base,'source'));
 const contractorChanges=tmPositiveChange(tmGroup(pre,'contractor'),tmGroup(base,'contractor'));
 const typeChanges=tmPositiveChange(tmGroup(pre,'type'),tmGroup(base,'type'));
 const h=tmHistory(),nearest=d=>[...h].filter(x=>tmDate(x.date)&&tmDate(x.date)<=d).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]||null;
 const h0=nearest(beforeStart),h1=nearest(beforeEnd),projectChanges=[];
 if(h0&&h1&&h0.date!==h1.date){
  const defs=[['إجمالي الاستثناءات','totalIssues','up'],['الحالات الحرجة','critical','up'],['صحة المشروع','health','down'],['اكتمال البيانات','qualityAvg','down'],['نسبة التنفيذ','executionRate','down'],['دورة المستندات','docScore','down']];
  defs.forEach(([label,key,bad])=>{const a=Number(h0[key]||0),b=Number(h1[key]||0),delta=Math.round((b-a)*10)/10;if((bad==='up'&&delta>0)||(bad==='down'&&delta<0))projectChanges.push({label,delta,from:a,to:b})});
 }
 return {ok:true,stable:false,spike,pre,base,sourceChanges,contractorChanges,typeChanges,projectChanges,beforeStart,beforeEnd,baseStart,baseEnd,weeks};
}
function tmMetricText(p){return (p.parts||[]).slice(0,3).map(x=>x.label+' '+(x.delta>0?'+':'')+Math.round(x.delta*10)/10+x.unit).join('، ')}
function tmAnswerBlock(title,lead,bullets,note){
 bullets=bullets||[];note=note||'';
 return '<div class="tm-answer-title"><span>نتيجة التحليل الزمني</span><h4>'+esc(title)+'</h4></div><p class="tm-answer-lead">'+esc(lead)+'</p>'+(bullets.length?'<ul>'+bullets.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+(note?'<div class="tm-answer-note">'+esc(note)+'</div>':'');
}


function answerTemporalQuestion(){
 const input=el('tmQuestion'),out=el('tmAnswer'),raw=clean(input&&input.value),q=norm(raw);if(!out)return;if(!q){out.textContent='اكتب سؤالك الزمني أولًا.';return}
 const h=tmHistory(),coverage=h.length?('تغطية اللقطات المركزية: '+tmFmtDate(h[0].date)+' إلى '+tmFmtDate(h[h.length-1].date)+' ('+h.length+' لقطة).'):'لا توجد لقطات مركزية تاريخية بعد.';
 if(q.includes('تدهور')){
  const d=tmDeterioration();if(!d.ok){out.innerHTML=tmAnswerBlock('بداية التدهور','لا يمكن تحديدها بثقة بعد.',[],d.reason+' '+coverage);return}
  if(d.stable){out.innerHTML=tmAnswerBlock('بداية التدهور','لم يظهر تدهور واضح في الذاكرة المحفوظة.',[],coverage);return}
  out.innerHTML=tmAnswerBlock('بدأ التدهور المسجل في '+tmFmtDate(d.date),'هذه أول نقطة في موجة التدهور الأقوى داخل اللقطات المتاحة.',[tmMetricText(d),'استمرت موجة التدهور حتى '+tmFmtDate(d.lastDate)],coverage+' هذا وصف زمني للأدلة وليس إثباتًا للسببية.');return;
 }
 if((q.includes('اول')&&q.includes('مؤشر'))||q.includes('مؤشر ظهر')){
  const f=tmFirstIndicator();if(!f.ok){out.innerHTML=tmAnswerBlock('أول مؤشر','لا يمكن تحديده بعد.',[],f.reason+' '+coverage);return}
  if(f.stable){out.innerHTML=tmAnswerBlock('أول مؤشر','لا يوجد مؤشر تدهور واضح حتى الآن.',[],coverage);return}
  out.innerHTML=tmAnswerBlock('أول مؤشر سلبي: '+f.label,'ظهر في '+tmFmtDate(f.date)+'.',['التغير المسجل: '+(Math.round(f.delta*10)/10)+f.unit,'تم اختياره من أول نقطة في موجة التدهور المسجلة.'],coverage);return;
 }
 if(q.includes('مقاول')&&(q.includes('متوسط')||q.includes('منذ')||q.includes('اعلى'))){
  const c=tmContractorMemory(raw);if(!c.ok){out.innerHTML=tmAnswerBlock('تاريخ المقاول','أحتاج اسم المقاول.',[],c.reason);return}
  if(!c.above){out.innerHTML=tmAnswerBlock('المقاول '+c.contractor,'لم يظهر أعلى من المتوسط في '+c.scope+' ضمن التغطية الحالية.',[],c.reason+' '+coverage);return}
  out.innerHTML=tmAnswerBlock('المقاول '+c.contractor,'أصبح أعلى من متوسط المقاولين في '+c.scope+' منذ '+tmFmtDate(c.since)+'.',['أحدث قراءة: '+c.count+' مقابل متوسط '+c.avg.toFixed(1)],coverage);return;
 }
 if(q.includes('مخالف')&&(q.includes('اسبوعين')||q.includes('قبل')||q.includes('ارتفاع'))){
  const v=tmViolationSpike();if(!v.ok){out.innerHTML=tmAnswerBlock('ما قبل ارتفاع المخالفات','لا يمكن بناء المقارنة بعد.',[],v.reason);return}
  if(v.stable){out.innerHTML=tmAnswerBlock('ما قبل ارتفاع المخالفات','لم يظهر ارتفاع أسبوعي واضح ضمن السجلات المؤرخة.',[],v.reason);return}
  const bullets=['أسبوع الارتفاع: '+tmFmtDate(v.spike.cur.start)+' — '+tmFmtDate(v.spike.cur.end)+'؛ ارتفع العدد من '+v.spike.prev.count+' إلى '+v.spike.cur.count+' ('+(v.spike.delta>0?'+':'')+v.spike.delta+').'];
  if(v.sourceChanges[0])bullets.push('أكبر زيادة في المصدر خلال الأسبوعين السابقين: '+v.sourceChanges[0].name+' +'+v.sourceChanges[0].delta+'.');
  if(v.contractorChanges[0])bullets.push('أبرز مقاول ارتفعت سجلاته قبل القفزة: '+v.contractorChanges[0].name+' +'+v.contractorChanges[0].delta+'.');
  if(v.typeChanges[0])bullets.push('أبرز نوع/نمط ارتفع: '+v.typeChanges[0].name+' +'+v.typeChanges[0].delta+'.');
  v.projectChanges.slice(0,2).forEach(x=>bullets.push(x.label+' تغير من '+x.from+' إلى '+x.to+' قبل الارتفاع.'));
  out.innerHTML=tmAnswerBlock('ما الذي تغير قبل ارتفاع المخالفات بأسبوعين؟','تمت مقارنة '+tmFmtDate(v.beforeStart)+'–'+tmFmtDate(v.beforeEnd)+' بالفترة السابقة لها مباشرة.',bullets,'العلاقات المعروضة تسبق الارتفاع زمنيًا ولا تعني وحدها أنها سببت الارتفاع.');return;
 }
 const d=tmDeterioration(),f=tmFirstIndicator(),v=tmViolationSpike();
 const bullets=[
  h.length?'الذاكرة المركزية تحتوي '+h.length+' لقطة من '+tmFmtDate(h[0].date)+'.':'الذاكرة المركزية بدأت الآن وستصبح أدق مع تراكم اللقطات اليومية.',
  d.ok&&!d.stable?'بداية التدهور المسجل: '+tmFmtDate(d.date)+'.':'لا توجد موجة تدهور واضحة حاليًا.',
  f.ok&&!f.stable?'أول مؤشر سلبي: '+f.label+'.':'لا يوجد مؤشر سلبي أول قابل للتحديد.',
  v.ok&&!v.stable?'آخر ارتفاع أسبوعي واضح للمخالفات: +'+v.spike.delta+'.':'لا توجد قفزة مخالفات واضحة ضمن التغطية.'
 ];
 out.innerHTML=tmAnswerBlock('ملخص ذاكرة المشروع','هذه هي أهم الإشارات الزمنية المتاحة حاليًا.',bullets,'يمكنك السؤال: متى بدأ التدهور؟ ما أول مؤشر ظهر؟ اسم مقاول + أعلى من المتوسط؟ أو ما قبل ارتفاع المخالفات بأسبوعين؟');
}
function renderTemporalMemory(){
 const root=el('tmContent'),loading=el('tmLoading');if(loading)loading.style.display='none';if(!root)return;
 if(!SC.loaded||!SC.summary){root.style.display='block';root.innerHTML='<div class="sc-panel"><div class="sc-empty">تعذر بناء ذاكرة المشروع حتى يكتمل تحميل التحليل.</div></div>';return}
 root.style.display='block';
 const h=tmHistory(),vr=tmViolationRecords(),weeks=tmWeeklyViolations(),d=tmDeterioration(),f=tmFirstIndicator(),v=tmViolationSpike();
 const cov=SC.centralHistory&&SC.centralHistory.memoryCoverage;
 el('tmCoverageBadge').textContent=h.length?('ذاكرة مركزية: '+tmFmtDate((cov&&cov.from)||h[0].date)+' ← '+tmFmtDate((cov&&cov.to)||h[h.length-1].date)):'تم إنشاء خط الأساس اليوم';
 el('tmHistoryCount').textContent=h.length.toLocaleString('ar-SA')+' لقطة';
 el('tmViolationCount').textContent=vr.length.toLocaleString('ar-SA')+' سجل';
 const topContractor=tmGroup(vr.filter(r=>r.contractor),'contractor')[0];
 el('tmKpis').innerHTML=[
  ['اللقطات المركزية',h.length,'Snapshot يومي مشترك'],
  ['بداية الذاكرة',h.length?tmFmtDate(h[0].date):'اليوم','Dashboard History'],
  ['سجلات المخالفات المؤرخة',vr.length,'سلامة + تنفيذ + محاضر'],
  ['أعلى مقاول بالمخالفات',topContractor?topContractor.name:'—',topContractor?topContractor.count+' سجل':'لا توجد بيانات']
 ].map(x=>'<article><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></article>').join('');
 const evidence=[];
 evidence.push({title:'بداية التدهور',value:d.ok&&!d.stable?tmFmtDate(d.date):'غير ظاهر',detail:d.ok&&!d.stable?tmMetricText(d):(d.reason||'لا توجد موجة واضحة')});
 evidence.push({title:'أول مؤشر',value:f.ok&&!f.stable?f.label:'غير محدد',detail:f.ok&&!f.stable?('ظهر '+tmFmtDate(f.date)+' • '+Math.round(f.delta*10)/10+f.unit):(f.detail||f.reason||'—')});
 evidence.push({title:'آخر قفزة مخالفات',value:v.ok&&!v.stable?('+'+v.spike.delta):'لا توجد',detail:v.ok&&!v.stable?(tmFmtDate(v.spike.cur.start)+' — '+tmFmtDate(v.spike.cur.end)):(v.reason||'—')});
 evidence.push({title:'مدى ذاكرة المخالفات',value:weeks.length+' أسبوع',detail:weeks.length?(tmFmtDate(weeks[0].start)+' — '+tmFmtDate(weeks[weeks.length-1].end)):'لا توجد تواريخ صالحة'});
 el('tmEvidence').innerHTML=evidence.map(x=>'<article><span>'+esc(x.title)+'</span><strong>'+esc(x.value)+'</strong><small>'+esc(x.detail)+'</small></article>').join('');
 renderTemporalCharts(h,weeks);
 const ans=el('tmAnswer');if(ans&&!ans.dataset.initialized){ans.dataset.initialized='1';ans.innerHTML=tmAnswerBlock('الذاكرة جاهزة',h.length>1?'يمكنك الآن سؤال النظام عن بداية التدهور وتسلسل المؤشرات.':'تم تسجيل خط الأساس المركزي؛ الأسئلة التي تعتمد على المقارنة ستتحسن مع اللقطات القادمة.',[],h.length?('التغطية الحالية من '+tmFmtDate(h[0].date)+' إلى '+tmFmtDate(h[h.length-1].date)+'.'):'')}
}
function renderTemporalCharts(history,weeks){
 if(typeof Chart==='undefined')return;
 ['tmHistoryChart','tmViolationChart'].forEach(id=>{try{if(SC.charts[id])SC.charts[id].destroy()}catch(e){}delete SC.charts[id]});
 const hCanvas=el('tmHistoryChart');
 if(hCanvas&&history.length){
  SC.charts.tmHistoryChart=new Chart(hCanvas,{type:'line',data:{labels:history.map(x=>tmFmtDate(x.date)),datasets:[
   {label:'صحة المشروع %',data:history.map(x=>Number(x.health||0)),borderWidth:2,tension:.25,pointRadius:2},
   {label:'اكتمال البيانات %',data:history.map(x=>Number(x.qualityAvg||0)),borderWidth:2,tension:.25,pointRadius:2},
   {label:'نسبة التنفيذ %',data:history.map(x=>Number(x.executionRate||0)),borderWidth:2,tension:.25,pointRadius:2}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{family:'Cairo',size:9}}},tooltip:{rtl:true}},scales:{y:{beginAtZero:true,max:100},x:{ticks:{font:{family:'Cairo',size:8},maxRotation:0,autoSkip:true}}}}});
 }
 const vCanvas=el('tmViolationChart');
 if(vCanvas&&weeks.length){
  SC.charts.tmViolationChart=new Chart(vCanvas,{type:'bar',data:{labels:weeks.map(w=>tmFmtDate(w.start)),datasets:[
   {label:'السلامة',data:weeks.map(w=>w.sources.get('مخالفات السلامة')||0),borderWidth:0},
   {label:'التنفيذ',data:weeks.map(w=>w.sources.get('مخالفات التنفيذ')||0),borderWidth:0},
   {label:'محاضر إثبات الحالة',data:weeks.map(w=>w.sources.get('محاضر إثبات الحالة')||0),borderWidth:0}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{family:'Cairo',size:9}}},tooltip:{rtl:true}},scales:{x:{stacked:true,ticks:{font:{family:'Cairo',size:8},maxRotation:0,autoSkip:true}},y:{stacked:true,beginAtZero:true}}}});
 }
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
