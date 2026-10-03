(function(){
'use strict';
const SC={loaded:false,loading:false,pages:{},issues:[],quality:[],summary:null,charts:{},projectKey:'',lastUpdated:'',previous:null,centralHistory:null,cross:{contractor:'',pageKey:''},temporalCross:{snapshot:'',chartId:'',series:''}};
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
function smartSectionKey(){
 const active=document.querySelector('#nav .nav-item.active');
 if(!active)return '';
 if(active.id==='smartCenterNav')return 'smartCenterNav';
 if(active.id==='temporalMemoryNav')return 'temporalMemoryNav';
 if(active.id==='investigationRoomNav')return 'investigationRoomNav';
 if(active.id==='explainableDecisionNav')return 'explainableDecisionNav';
 if(active.id==='workOrder360Nav')return 'workOrder360Nav';
 if(active.dataset?.page==='smartThursday')return 'smartThursday';
 return '';
}
function restoreSmartSpecialHeroes(){
 const defs=[
  ['.tm-hero','temporalMemoryPage'],
  ['.ir-hero','investigationRoomPage'],
  ['.xd-hero','explainableDecisionPage'],
  ['.st-hero','smartThursdayReport']
 ];
 defs.forEach(([sel,parentId])=>{
  const hero=document.querySelector(sel),parent=el(parentId);
  if(hero&&parent&&hero.parentElement!==parent)parent.insertBefore(hero,parent.firstChild);
 });
}
function syncSmartSectionTabs(){
 const bar=el('smartSectionTopTabs'),heading=el('globalPageHeading'),host=el('smartPageHeroHost'),dock=el('vdUnifiedControls'),key=smartSectionKey();
 restoreSmartSpecialHeroes();
 if(dock){if(key)dock.style.setProperty('display','none','important');else dock.style.removeProperty('display')}
 const showShared=key==='smartCenterNav';
 if(bar)bar.style.display=showShared?'block':'none';
 if(heading){if(key)heading.style.setProperty('display','none','important');else heading.style.removeProperty('display')}
 if(bar)bar.querySelectorAll('[data-smart-target]').forEach(b=>b.classList.toggle('active',b.dataset.smartTarget===key));
 if(host){
  host.style.display='none';
  host.innerHTML='';
  const target={
   temporalMemoryNav:'.tm-hero',
   investigationRoomNav:'.ir-hero',
   explainableDecisionNav:'.xd-hero',
   smartThursday:'#smartThursdayReport .st-hero'
  }[key];
  if(target){
   const hero=document.querySelector(target);
   if(hero){host.appendChild(hero);host.style.display='block'}
  }
 }
}
function installSmartSectionTabs(){
 if(el('smartSectionTopTabs')){syncSmartSectionTabs();return}
 const heading=el('globalPageHeading'),filter=el('filterBar');
 if(!heading||!filter)return;
 const bar=document.createElement('section');
 bar.id='smartSectionTopTabs';
 bar.className='smart-section-top-tabs';
 bar.style.display='none';
 bar.innerHTML=`
  <div class="sst-top">
   <div class="sst-head"><span>SMART PROJECT INTELLIGENCE • FREE ENGINE</span><strong>مركز التحليل الذكي</strong><small>تحليل مباشر لقواعد المشروع، جودة البيانات، التأخيرات والاستثناءات.</small></div>
   <div class="sst-actions"><span class="sc-live"><i></i><span id="scUpdated">جاري التحليل...</span></span><button id="scRefresh" class="sc-refresh" type="button">↻ إعادة التحليل</button></div>
  </div>
  <div class="sst-tabs" role="tablist" aria-label="تبويبات التحليل الذكي">
   <button type="button" data-smart-target="smartCenterNav">🧠 <span>مركز التحليل الذكي</span></button>
   <button type="button" data-smart-target="temporalMemoryNav">◷ <span>ذاكرة المشروع الزمنية</span></button>
   <button type="button" data-smart-target="investigationRoomNav">⌕ <span>غرفة التحقيق الذكية</span></button>
   <button type="button" data-smart-target="explainableDecisionNav">⚖ <span>محرك القرار المفسر</span></button>
   <button type="button" data-smart-target="workOrder360Nav">🔎 <span>Work Order 360°</span></button>
   <button type="button" data-smart-target="smartThursday">▣ <span>تقرير الخميس الذكي</span></button>
  </div>`;
 const host=document.createElement('div');host.id='smartPageHeroHost';host.className='smart-page-hero-host';host.style.display='none';
 heading.parentNode.insertBefore(host,heading);
 heading.parentNode.insertBefore(bar,heading);
 bar.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-smart-target]');if(!b)return;
  const k=b.dataset.smartTarget;
  const target=k==='smartThursday'?document.querySelector('#nav .nav-item[data-page="smartThursday"]'):el(k);
  target?.click();
  setTimeout(syncSmartSectionTabs,0);
 });
 const nav=el('nav');
 nav?.addEventListener('click',()=>setTimeout(syncSmartSectionTabs,0),true);
 if(nav){
  new MutationObserver(syncSmartSectionTabs).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 }
 syncSmartSectionTabs();
}
function installUi(){
 if(el('smartCenterPage'))return;
 const nav=el('nav');if(!nav)return;
 const adminLabel=[...nav.children].find(x=>x.classList?.contains('nav-section-label')&&clean(x.textContent)==='اداريات');
 const reportsLabel=[...nav.children].find(x=>x.classList?.contains('nav-section-label')&&clean(x.textContent)==='التقارير');
 const label=document.createElement('div');label.className='nav-section-label smart-center-label';label.textContent='التحليل الذكي';
 const btn=document.createElement('button');btn.type='button';btn.id='smartCenterNav';btn.className='nav-item';btn.innerHTML='🧠 <span>مركز التحليل الذكي</span>';
 const memoryBtn=document.createElement('button');memoryBtn.type='button';memoryBtn.id='temporalMemoryNav';memoryBtn.className='nav-item';memoryBtn.innerHTML='◷ <span>ذاكرة المشروع الزمنية</span>';
 const investigationBtn=document.createElement('button');investigationBtn.type='button';investigationBtn.id='investigationRoomNav';investigationBtn.className='nav-item';investigationBtn.innerHTML='⌕ <span>غرفة التحقيق الذكية</span>';
 const decisionBtn=document.createElement('button');decisionBtn.type='button';decisionBtn.id='explainableDecisionNav';decisionBtn.className='nav-item';decisionBtn.innerHTML='⚖ <span>محرك القرار المفسر</span>';
 const thursdayBtn=nav.querySelector('[data-page="smartThursday"]');
 const reportsCenterBtn=nav.querySelector('[data-page="reportsCenter"]');
 const anchor=adminLabel||reportsLabel||null;
 nav.insertBefore(label,anchor);nav.insertBefore(btn,anchor);nav.insertBefore(memoryBtn,anchor);nav.insertBefore(investigationBtn,anchor);nav.insertBefore(decisionBtn,anchor);
 if(thursdayBtn)nav.insertBefore(thursdayBtn,anchor);
 if(reportsCenterBtn)nav.insertBefore(reportsCenterBtn,anchor);
 if(reportsLabel)reportsLabel.remove();
 const page=document.createElement('section');page.id='smartCenterPage';page.className='page smart-center-page';page.innerHTML=smartCenterMarkup();
 const memoryPage=document.createElement('section');memoryPage.id='temporalMemoryPage';memoryPage.className='page smart-center-page temporal-memory-page';memoryPage.innerHTML=temporalMemoryMarkup();
 const investigationPage=document.createElement('section');investigationPage.id='investigationRoomPage';investigationPage.className='page smart-center-page investigation-room-page';investigationPage.innerHTML=investigationRoomMarkup();
 const decisionPage=document.createElement('section');decisionPage.id='explainableDecisionPage';decisionPage.className='page smart-center-page explainable-decision-page';decisionPage.innerHTML=explainableDecisionMarkup();
 const main=document.querySelector('main');const firstPage=el('masterPage');main.insertBefore(page,firstPage||null);main.insertBefore(memoryPage,firstPage||null);main.insertBefore(investigationPage,firstPage||null);main.insertBefore(decisionPage,firstPage||null);
 btn.addEventListener('click',openSmartCenter);memoryBtn.addEventListener('click',openTemporalMemory);investigationBtn.addEventListener('click',openInvestigationRoom);decisionBtn.addEventListener('click',openExplainableDecision);
 nav.addEventListener('click',e=>{const item=e.target.closest('.nav-item');if(item&&!['smartCenterNav','temporalMemoryNav','investigationRoomNav','explainableDecisionNav'].includes(item.id))leaveSmartCenter()});
 installSmartSectionTabs();
 bindSmartCenter();bindTemporalMemory();bindInvestigationRoom();bindExplainableDecision();
}
function smartCenterMarkup(){return `
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
function investigationRoomMarkup(){return `
<div class="ir-hero"><div><span>AUTOMATED INVESTIGATION ROOM</span><h2>⌕ غرفة التحقيق الذكية</h2><p>اختر الظاهرة مرة واحدة، والنظام يقسمها تلقائيًا حسب المقاول، النوع، المشرف، أمر العمل، الزمن والمنطقة، ثم يبحث عن أكثر تركيب يفسر الزيادة حسابيًا.</p></div><button id="irRefresh" type="button">↻ تحديث التحليل</button></div>
<div id="irLoading" class="sc-loading"><i></i><span>جاري تجهيز غرفة التحقيق...</span></div>
<div id="irContent" style="display:none">
 <article class="ir-control">
  <div class="ir-control-main"><label>الظاهرة</label><select id="irPhenomenon"><option value="safety">ارتفاع مخالفات السلامة</option><option value="execution">ارتفاع مخالفات التنفيذ</option><option value="minutes">ارتفاع محاضر إثبات الحالة</option><option value="all">ارتفاع إجمالي المخالفات والمحاضر</option></select></div>
  <div class="ir-control-main"><label>المقارنة</label><select id="irPeriod"><option value="week">هذا الأسبوع مقابل السابق — الجمعة إلى الخميس</option><option value="14">آخر 14 يومًا مقابل الـ14 يومًا السابقة</option><option value="30">آخر 30 يومًا مقابل الـ30 يومًا السابقة</option></select></div>
  <button id="irRun" type="button">ابدأ التحقيق</button>
 </article>
 <div id="irSummary" class="ir-summary"></div>
 <article class="ir-best"><div class="ir-best-head"><span>STRONGEST EXPLANATORY COMBINATION</span><h3>التركيب الأكثر تفسيرًا للظاهرة</h3><p>تركيز إحصائي للزيادة، وليس حكمًا سببيًا.</p></div><div id="irBestCombo"></div></article>
 <div id="irDimensions" class="ir-dimensions"></div>
 <article class="sc-panel ir-combos-panel"><div class="sc-panel-head"><div><span>COMBINATION SEARCH</span><h3>أقوى التركيبات المفسرة للزيادة</h3></div><b class="sc-badge" id="irComboCount">0</b></div><div id="irComboTable"></div></article>
</div>`}
function explainableDecisionMarkup(){return `
<div class="xd-hero"><div><span>EXPLAINABLE DECISION ENGINE • ACTIONABLE PRIORITIES</span><h2>⚖ محرك القرار القابل للتفسير</h2><p>يرتب حالات المتابعة من جميع مصادر المشروع، ويفصل بين الإشارة المباشرة والعامل السياقي، ثم يوضح الدليل وثقة التغطية وخطة الإجراء التالية.</p></div><button id="xdRefresh" type="button">↻ إعادة الحساب</button></div>
<div id="xdLoading" class="sc-loading"><i></i><span>جاري بناء أولويات المتابعة وربط الأدلة بين مصادر المشروع...</span></div>
<div id="xdContent" style="display:none">
 <div id="xdKpis" class="xd-kpis"></div>
 <article class="xd-guide">
  <div><b>قرار أقوى = أكثر من إشارة مباشرة مستقلة</b><span>التأخير، المستندات، التصاريح، المخالفات، الأصول، الإغلاقات، المواقع والطوارئ.</span></div>
  <div><b>العوامل السياقية لا تكفي وحدها</b><span>تكرار مخالفات المقاول يعزز حالة موجودة، ولا ينشئ أولوية بمفرده.</span></div>
  <div><b>جودة البيانات منفصلة عن نقاط الأولوية</b><span>نقص المهندس أو المقاول يخفض ثقة التغطية بدل رفع درجة المخاطر.</span></div>
 </article>
 <article class="xd-tools" aria-label="بحث وتصفية حالات القرار">
  <div class="xd-search-field">
   <div class="xd-search-body">
    <label for="xdSearch">بحث سريع في حالات المتابعة</label>
    <input id="xdSearch" type="search" autocomplete="off" placeholder="أمر العمل، المقاول، المهندس، السبب أو الإجراء...">
   </div>
   <button id="xdSearchBtn" class="xd-search-btn" type="button"><span aria-hidden="true">⌕</span> بحث</button>
  </div>
  <label class="xd-filter-field"><span>مستوى الأولوية</span><select id="xdPriority"><option value="">كل مستويات الأولوية</option><option value="high">مرتفعة</option><option value="medium">متوسطة</option><option value="watch">مراقبة</option></select></label>
  <label class="xd-filter-field"><span>ثقة التغطية</span><select id="xdConfidence"><option value="">كل مستويات ثقة التغطية</option><option value="high">ثقة عالية ≥ 75%</option><option value="medium">ثقة متوسطة 50–74%</option><option value="low">ثقة محدودة &lt; 50%</option></select></label>
  <label class="xd-filter-field"><span>مصدر القرار</span><select id="xdSource"><option value="">كل مصادر القرار</option></select></label>
  <button id="xdClear" class="xd-clear-btn" type="button"><span aria-hidden="true">↺</span> مسح الفلاتر</button>
  <div class="xd-filter-summary" aria-live="polite"><strong id="xdFilterCount">0 حالة</strong><span id="xdFilterHint">كل الحالات</span></div>
 </article>
 <div id="xdCases" class="xd-cases"></div>
 <article id="xdEvidencePanel" class="xd-evidence-panel"><div class="xd-empty-evidence">اضغط على أي سبب داخل حالة متابعة لعرض الدليل، المصدر، الإجراء المقترح وفتح السجل الأصلي.</div></article>
 <div class="xd-method"><b>منهج الاحتساب:</b> «نقاط الأولوية» أداة ترتيب تشغيلية وليست احتمالًا أو حكمًا نهائيًا. ثقة التغطية تقيس تنوع الأدلة واكتمال البيانات المتاحة. العوامل السياقية تُستخدم فقط لتعزيز حالة لها دليل مباشر.</div>
</div>`}
function openSmartCenter(){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 el('smartCenterPage')?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id==='smartCenterNav'));
 syncSmartSectionTabs();
 if(el('filterBar'))el('filterBar').style.display='none';
 if(el('pageTitle'))el('pageTitle').textContent='مركز التحليل الذكي';
 if(!SC.loaded)loadSmartCenter();else renderAll();
}
async function openTemporalMemory(){
 if(SC.loading){setTimeout(openTemporalMemory,250);return}
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 el('temporalMemoryPage')?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id==='temporalMemoryNav'));
 syncSmartSectionTabs();
 if(el('filterBar'))el('filterBar').style.display='none';
 if(el('pageTitle'))el('pageTitle').textContent='ذاكرة المشروع الزمنية';
 if(!SC.loaded){el('tmLoading').style.display='flex';el('tmContent').style.display='none';await loadSmartCenter()}
 renderTemporalMemory();
}
async function openInvestigationRoom(){
 if(SC.loading){setTimeout(openInvestigationRoom,250);return}
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 el('investigationRoomPage')?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id==='investigationRoomNav'));
 syncSmartSectionTabs();
 if(el('filterBar'))el('filterBar').style.display='none';
 if(el('pageTitle'))el('pageTitle').textContent='غرفة التحقيق الذكية';
 if(!SC.loaded){el('irLoading').style.display='flex';el('irContent').style.display='none';await loadSmartCenter()}
 renderInvestigationRoom();
}
async function openExplainableDecision(){
 if(SC.loading){setTimeout(openExplainableDecision,250);return}
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 el('explainableDecisionPage')?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id==='explainableDecisionNav'));
 syncSmartSectionTabs();
 if(el('filterBar'))el('filterBar').style.display='none';
 if(el('pageTitle'))el('pageTitle').textContent='محرك القرار القابل للتفسير';
 if(!SC.loaded){el('xdLoading').style.display='flex';el('xdContent').style.display='none';await loadSmartCenter()}
 renderExplainableDecision();
}
function leaveSmartCenter(){
 el('smartCenterPage')?.classList.remove('active');
 el('temporalMemoryPage')?.classList.remove('active');
 el('investigationRoomPage')?.classList.remove('active');
 el('explainableDecisionPage')?.classList.remove('active');
 if(el('filterBar'))el('filterBar').style.display='';
 setTimeout(syncSmartSectionTabs,0);
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
function bindInvestigationRoom(){
 el('irRun').onclick=renderInvestigationRoom;
 el('irRefresh').onclick=async()=>{el('irLoading').style.display='flex';el('irContent').style.display='none';await loadSmartCenter(true);renderInvestigationRoom()};
 el('irPhenomenon').onchange=renderInvestigationRoom;el('irPeriod').onchange=renderInvestigationRoom;
}
function bindExplainableDecision(){
 el('xdRefresh').onclick=async()=>{el('xdLoading').style.display='flex';el('xdContent').style.display='none';await loadSmartCenter(true);renderExplainableDecision()};
 const runSearch=()=>renderDecisionCases();
 el('xdSearchBtn').onclick=runSearch;
 el('xdSearch').oninput=renderDecisionCases;
 el('xdSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runSearch()}});
 el('xdPriority').onchange=renderDecisionCases;
 el('xdConfidence').onchange=renderDecisionCases;
 el('xdSource').onchange=renderDecisionCases;
 el('xdClear').onclick=()=>{
  el('xdSearch').value='';
  el('xdPriority').value='';
  el('xdConfidence').value='';
  el('xdSource').value='';
  renderDecisionCases();
 };
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
<article class="sc-panel sc-exception-wrap"><div class="sc-panel-head"><div><span>EXCEPTION CENTER</span><h3>مركز الاستثناءات — الحالات التي تحتاج مراجعة</h3></div><b class="sc-badge" id="scIssueCount">0</b></div><div class="sc-toolbar"><span id="scChartFilterBadge" class="sc-badge" style="display:none"></span><button id="scChartFilterClear" type="button" style="display:none">× مسح فلتر الشارت</button><select id="scSeverity"><option value="">كل درجات الأهمية</option><option value="critical">حرجة</option><option value="high">مرتفعة</option><option value="medium">متوسطة</option></select><select id="scCategory"><option value="">كل الأنواع</option></select><input id="scIssueSearch" placeholder="بحث بأمر العمل، الإشعار، المقاول، المهندس أو الوصف..."></div><div id="scExceptionTable" class="sc-table-wrap"></div></article>`}
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
function temporalChartClick(id,label,series){
 const same=SC.temporalCross.chartId===id&&SC.temporalCross.snapshot===label&&SC.temporalCross.series===series;
 SC.temporalCross=same?{snapshot:'',chartId:'',series:''}:{snapshot:label,chartId:id,series:series||''};
 renderTemporalMemory();
}
function renderTemporalCharts(history,weeks){
 if(typeof Chart==='undefined')return;
 ['tmHistoryChart','tmViolationChart'].forEach(id=>{try{if(SC.charts[id])SC.charts[id].destroy()}catch(e){}delete SC.charts[id]});
 const h=SC.temporalCross.chartId==='tmHistoryChart'&&SC.temporalCross.snapshot?history.filter(x=>tmFmtDate(x.date)===SC.temporalCross.snapshot):history;
 const w=SC.temporalCross.chartId==='tmViolationChart'&&SC.temporalCross.snapshot?weeks.filter(x=>tmFmtDate(x.start)===SC.temporalCross.snapshot):weeks;
 const hCanvas=el('tmHistoryChart');
 if(hCanvas&&h.length){
  let hds=[
   {label:'صحة المشروع %',data:h.map(x=>Number(x.health||0)),borderWidth:2,tension:.25,pointRadius:2},
   {label:'اكتمال البيانات %',data:h.map(x=>Number(x.qualityAvg||0)),borderWidth:2,tension:.25,pointRadius:2},
   {label:'نسبة التنفيذ %',data:h.map(x=>Number(x.executionRate||0)),borderWidth:2,tension:.25,pointRadius:2}
  ];
  if(SC.temporalCross.chartId==='tmHistoryChart'&&SC.temporalCross.series)hds=hds.filter(x=>x.label===SC.temporalCross.series);
  SC.charts.tmHistoryChart=new Chart(hCanvas,{type:'line',data:{labels:h.map(x=>tmFmtDate(x.date)),datasets:hds},options:{responsive:true,maintainAspectRatio:false,onHover:(e,els)=>{hCanvas.style.cursor=els.length?'pointer':'default'},onClick:(e,els,ch)=>{if(els.length){const x=els[0];temporalChartClick('tmHistoryChart',clean(ch.data.labels[x.index]),clean(ch.data.datasets[x.datasetIndex].label))}},plugins:{legend:{labels:{font:{family:'Cairo',size:9}}},tooltip:{rtl:true}},scales:{y:{beginAtZero:true,max:100},x:{ticks:{font:{family:'Cairo',size:8},maxRotation:0,autoSkip:true}}}}});
 }
 const vCanvas=el('tmViolationChart');
 if(vCanvas&&w.length){
  let vds=[
   {label:'السلامة',data:w.map(z=>z.sources.get('مخالفات السلامة')||0),borderWidth:0},
   {label:'التنفيذ',data:w.map(z=>z.sources.get('مخالفات التنفيذ')||0),borderWidth:0},
   {label:'محاضر إثبات الحالة',data:w.map(z=>z.sources.get('محاضر إثبات الحالة')||0),borderWidth:0}
  ];
  if(SC.temporalCross.chartId==='tmViolationChart'&&SC.temporalCross.series)vds=vds.filter(x=>x.label===SC.temporalCross.series);
  SC.charts.tmViolationChart=new Chart(vCanvas,{type:'bar',data:{labels:w.map(z=>tmFmtDate(z.start)),datasets:vds},options:{responsive:true,maintainAspectRatio:false,onHover:(e,els)=>{vCanvas.style.cursor=els.length?'pointer':'default'},onClick:(e,els,ch)=>{if(els.length){const x=els[0];temporalChartClick('tmViolationChart',clean(ch.data.labels[x.index]),clean(ch.data.datasets[x.datasetIndex].label))}},plugins:{legend:{labels:{font:{family:'Cairo',size:9}}},tooltip:{rtl:true}},scales:{x:{stacked:true,ticks:{font:{family:'Cairo',size:8},maxRotation:0,autoSkip:true}},y:{stacked:true,beginAtZero:true}}}});
 }
}

function irWorkOrderLookup(){
 const map=new Map();
 const touch=(r)=>{const wo=clean(r&&r.workOrder);if(!wo)return;const k=norm(wo),x=map.get(k)||{workOrder:wo,contractor:'',engineer:'',region:'',location:'',section:'',type:''};
  if(!x.contractor&&clean(r.contractor))x.contractor=clean(r.contractor);if(!x.engineer&&clean(r.engineer))x.engineer=clean(r.engineer);if(!x.region&&clean(r.region))x.region=clean(r.region);if(!x.location&&clean(r.location))x.location=clean(r.location);if(!x.section&&clean(r.section))x.section=clean(r.section);if(!x.type&&clean(r.type))x.type=clean(r.type);map.set(k,x)};
 ['workorders','projects','connections','permits'].forEach(key=>rows(key).forEach(touch));return map;
}
function irRecords(mode){
 const lookup=irWorkOrderLookup(),out=[];
 const add=(source,r,type,supervisor)=>{const d=tmDate(r.date);if(!d)return;const wo=clean(r.workOrder),m=lookup.get(norm(wo))||{};out.push({source,date:d,workOrder:wo||'غير محدد',contractor:clean(r.contractor)||m.contractor||'غير محدد',type:clean(type)||m.type||'غير محدد',supervisor:clean(supervisor)||m.engineer||'غير محدد',region:m.region||m.location||m.section||'غير محدد'})};
 if(mode==='safety'||mode==='all')rows('safety').forEach(r=>add('مخالفات السلامة',r,[r.violation1,r.violation2].filter(Boolean).join(' / '),r.supervisor));
 if(mode==='execution'||mode==='all')rows('executionViolations').forEach(r=>add('مخالفات التنفيذ',r,r.violation,r.supervisor));
 if(mode==='minutes'||mode==='all')rows('minutes').forEach(r=>add('محاضر إثبات الحالة',r,r.minuteType||r.penaltyItem1,r.editor));
 return out;
}
function irPeriodRange(kind){
 const today=new Date();today.setHours(0,0,0,0);let cs,ce,ps,pe,label='';
 if(kind==='week'){cs=tmWeekStart(today);ce=today;ps=tmAddDays(cs,-7);pe=tmAddDays(ce,-7);label='نفس أيام أسبوع الجمعة–الخميس'}
 else{const n=kind==='30'?30:14;ce=today;cs=tmAddDays(today,-(n-1));pe=tmAddDays(cs,-1);ps=tmAddDays(pe,-(n-1));label='آخر '+n+' يومًا'}
 return {cs,ce,ps,pe,label,currentLabel:tmFmtDate(cs)+' — '+tmFmtDate(ce),previousLabel:tmFmtDate(ps)+' — '+tmFmtDate(pe)};
}
function irDayName(d){return ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][d.getDay()]}
function irDimensionRows(current,previous,key){
 const get=r=>key==='day'?irDayName(r.date):clean(r[key])||'غير محدد',a=new Map(),b=new Map();current.forEach(r=>tmMapInc(a,get(r)));previous.forEach(r=>tmMapInc(b,get(r)));
 const keys=new Set([...a.keys(),...b.keys()]),pos=[...keys].reduce((s,k)=>s+Math.max(0,(a.get(k)||0)-(b.get(k)||0)),0);
 return [...keys].map(name=>{const c=a.get(name)||0,p=b.get(name)||0,d=c-p;return {name,current:c,previous:p,delta:d,contribution:pos&&d>0?Math.round(d/pos*1000)/10:0}}).sort((x,y)=>y.delta-x.delta||y.current-x.current).slice(0,8);
}
function irCombinationRows(current,previous){
 const defs=[['contractor','type'],['contractor','region'],['contractor','supervisor'],['type','supervisor'],['type','region'],['supervisor','region'],['contractor','type','region'],['contractor','type','supervisor']];
 const all=[];defs.forEach(dims=>{const a=new Map(),b=new Map(),label=dims.join('|'),key=r=>dims.map(k=>clean(r[k])||'غير محدد').join(' × ');current.forEach(r=>tmMapInc(a,key(r)));previous.forEach(r=>tmMapInc(b,key(r)));
  const candidates=[...new Set([...a.keys(),...b.keys()])].map(name=>{const c=a.get(name)||0,p=b.get(name)||0;return {name,current:c,previous:p,delta:c-p}}).filter(x=>x.current>=2&&x.delta>0),pos=Math.max(1,candidates.reduce((s,x)=>s+x.delta,0));
  candidates.forEach(x=>all.push({dims,label,name:x.name,current:x.current,previous:x.previous,delta:x.delta,share:Math.round(x.delta/pos*1000)/10,score:x.delta*100+x.current}))
 });
 return all.sort((x,y)=>y.score-x.score||y.share-x.share).slice(0,15);
}
function renderInvestigationRoom(){
 if(!SC.loaded)return;const loading=el('irLoading'),root=el('irContent');if(loading)loading.style.display='none';if(root)root.style.display='block';
 const mode=el('irPhenomenon').value||'safety',period=irPeriodRange(el('irPeriod').value||'week'),all=irRecords(mode);
 const current=all.filter(r=>r.date>=period.cs&&r.date<=period.ce),previous=all.filter(r=>r.date>=period.ps&&r.date<=period.pe),delta=current.length-previous.length;
 const combos=irCombinationRows(current,previous),best=combos[0],phenomenon={safety:'مخالفات السلامة',execution:'مخالفات التنفيذ',minutes:'محاضر إثبات الحالة',all:'إجمالي المخالفات والمحاضر'}[mode];
 const uniq=(arr,key)=>new Set(arr.map(x=>x[key]).filter(Boolean)).size;
 el('irSummary').innerHTML=[['الظاهرة',phenomenon,period.label],['الفترة الحالية',current.length,period.currentLabel],['الفترة السابقة',previous.length,period.previousLabel],['التغير',((delta>0?'+':'')+delta),delta>0?'ارتفاع يحتاج تفسيرًا':delta<0?'انخفاض عن الفترة السابقة':'لا تغير'],['أوامر العمل',uniq(current,'workOrder'),'في الفترة الحالية'],['المقاولون',uniq(current,'contractor'),'في الفترة الحالية']].map(x=>'<article><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></article>').join('');
 el('irBestCombo').innerHTML=best?'<div class="ir-best-value"><b>'+esc(best.name)+'</b><span>'+best.current+' حاليًا مقابل '+best.previous+' سابقًا • زيادة +'+best.delta+'</span><small>الأبعاد: '+esc(best.dims.map(d=>({contractor:'المقاول',type:'النوع',supervisor:'المشرف',region:'المنطقة'}[d]||d)).join(' + '))+(delta>0?' • يمثل '+best.share+'% من الزيادة الموجبة داخل هذا التقسيم':'')+'</small></div>':'<div class="ir-empty">لا يوجد تركيب مرتفع بما يكفي لتفسير زيادة؛ قد تكون الظاهرة مستقرة أو منخفضة في الفترة المختارة.</div>';
 const dims=[['contractor','المقاول'],['type','النوع'],['supervisor','المشرف'],['workOrder','أمر العمل'],['day','الزمن / يوم الأسبوع'],['region','المنطقة']];
 el('irDimensions').innerHTML=dims.map(([key,label])=>{const data=irDimensionRows(current,previous,key);return '<article class="ir-dim"><div class="ir-dim-head"><span>'+esc(label)+'</span><b>'+data.length+'</b></div>'+(data.length?data.map(x=>'<div class="ir-row"><div><strong>'+esc(x.name)+'</strong><small>الحالي '+x.current+' • السابق '+x.previous+'</small></div><em class="'+(x.delta>0?'up':x.delta<0?'down':'flat')+'">'+(x.delta>0?'+':'')+x.delta+'</em></div>').join(''):'<div class="ir-empty">لا توجد بيانات</div>')+'</article>'}).join('');
 el('irComboCount').textContent=combos.length+' تركيب';
 el('irComboTable').innerHTML=combos.length?'<div class="ir-table-wrap"><table><thead><tr><th>التركيب</th><th>الحالي</th><th>السابق</th><th>الزيادة</th><th>مساهمة تقديرية</th></tr></thead><tbody>'+combos.slice(0,12).map(x=>'<tr><td><b>'+esc(x.name)+'</b><small>'+esc(x.dims.join(' + '))+'</small></td><td>'+x.current+'</td><td>'+x.previous+'</td><td class="ir-up">+'+x.delta+'</td><td>'+Math.min(999,x.share)+'%</td></tr>').join('')+'</tbody></table></div>':'<div class="ir-empty">لا توجد زيادة مركزة في تركيبات متعددة الأبعاد.</div>';
}
function xdDaysSince(v){const d=tmDate(v);if(!d)return null;const t=new Date();t.setHours(0,0,0,0);return Math.max(0,Math.floor((t-d)/86400000))}
function xdDocFinal(v){const s=norm(v);return s.includes('تم الاعتماد')||s.includes('تم الرفع')||s.includes('مكتمل')||s.includes('تمت الارشفة')}
function xdClosingState(r){const s=norm([r&&r.stage,r&&r.stageStatus,r&&r.status,r&&r.executionStatus].filter(Boolean).join(' '));return s.includes('مرحله الاغلاق')||s.includes('تحت المعالجه')}
function xdCaseRef(r){return clean(r&&r.workOrder)||clean(r&&r.noticeNo)||clean(r&&r.taskNo)||clean(r&&r.id)||''}
function xdAddQualityFlag(c,label,detail){if(!c||!label)return;if(!c.qualityFlags.some(x=>x.label===label))c.qualityFlags.push({label,detail})}
function xdPushReason(c,id,label,points,pageKey,source,detail,action,row,kind='direct'){
 if(!c||!id||!points)return;
 const old=c.reasons.find(x=>x.id===id);
 const payload={label,points,pageKey,source,detail,action,row:row&&row._row?row._row:'—',kind};
 if(old){if(points<=old.points)return;c.score+=points-old.points;Object.assign(old,payload);return}
 c.score+=points;c.reasons.push({id,...payload});
}
function xdBuildCases(){
 const lookup=irWorkOrderLookup(),map=new Map();
 const ensure=(ref,row)=>{ref=clean(ref);if(!ref)return null;const k=norm(ref),m=lookup.get(k)||{},hasWo=!!clean(row&&row.workOrder);
  const c=map.get(k)||{workOrder:ref,hasWorkOrder:hasWo,contractor:m.contractor||clean(row&&row.contractor),engineer:m.engineer||clean(row&&row.engineer),region:m.region||m.location||m.section||clean(row&&row.region)||clean(row&&row.location)||clean(row&&row.section)||'',score:0,reasons:[],qualityFlags:[]};
  if(hasWo)c.hasWorkOrder=true;if(!c.contractor&&row)c.contractor=clean(row.contractor);if(!c.engineer&&row)c.engineer=clean(row.engineer);if(!c.region&&row)c.region=clean(row.region)||clean(row.location)||clean(row.section);map.set(k,c);return c};
 ['workorders','projects','connections','permits','attachments','assets','closures','tasks','emergency','safety','executionViolations','minutes'].forEach(key=>rows(key).forEach(r=>ensure(xdCaseRef(r),r)));
 const today=new Date();today.setHours(0,0,0,0),recentStart=tmAddDays(today,-6);
 const seen=new Set(),recentBySource={safety:new Map(),executionViolations:new Map(),minutes:new Map()},contractorRecent=new Map();
 [['safety','مخالفات السلامة'],['executionViolations','مخالفات التنفيذ'],['minutes','محاضر إثبات الحالة']].forEach(([key,label])=>rows(key).forEach(r=>{
  const d=tmDate(r.date),ref=xdCaseRef(r);if(!d||!ref||d<recentStart||d>today)return;
  const detail=clean(r.violation)||clean(r.violation1)||clean(r.minuteType)||clean(r.penaltyItem1)||clean(r.type)||label;
  const dedupe=[key,norm(ref),d.toISOString().slice(0,10),norm(detail),norm(r.contractor)].join('|');if(seen.has(dedupe))return;seen.add(dedupe);
  const bucket=recentBySource[key],rk=norm(ref),a=bucket.get(rk)||{count:0,row:r};a.count++;a.row=r;bucket.set(rk,a);if(clean(r.contractor))tmMapInc(contractorRecent,clean(r.contractor));
 }));
 const recentRules=[
  ['safety','مخالفات سلامة حديثة',4,12,'مخالفات السلامة'],
  ['executionViolations','مخالفات تنفيذ حديثة',5,15,'مخالفات التنفيذ'],
  ['minutes','محاضر إثبات حالة حديثة',5,15,'محاضر إثبات الحالة']
 ];
 recentRules.forEach(([key,label,unit,cap,source])=>recentBySource[key].forEach((x,k)=>{const c=map.get(k);if(c)xdPushReason(c,'recent-'+key,label,Math.min(cap,x.count*unit),key,source,x.count+' سجل حديث خلال آخر 7 أيام.','مراجعة السجلات الحديثة وربطها بسبب التكرار والإجراء التصحيحي.',x.row)}));
 rows('workorders').forEach(r=>{const c=ensure(xdCaseRef(r),r);if(!c)return;const days=num(r.consultantDays);
  if(days>=15)xdPushReason(c,'consultantDays-workorders','انقطاع متابعة استشارية',20,'workorders','أوامر العمل','مر '+days+' يومًا منذ آخر إجراء استشاري.','تحديث الإفادة والإجراء الاستشاري وتوثيق آخر متابعة.',r);
  else if(days>=10)xdPushReason(c,'consultantDays-workorders','متابعة استشارية متأخرة',15,'workorders','أوامر العمل','مر '+days+' يومًا منذ آخر إجراء استشاري.','تحديث الإفادة أو الإجراء الاستشاري.',r);
  else if(days>=6)xdPushReason(c,'consultantDays-workorders','متابعة تحتاج تنشيط',8,'workorders','أوامر العمل','مر '+days+' أيام منذ آخر إجراء استشاري.','مراجعة الحاجة إلى إفادة أحدث.',r);
  if(!isDone(r.status)&&isDelayed(r.delay))xdPushReason(c,'delay-workorders','تأخير تنفيذ ظاهر',18,'workorders','أوامر العمل','الحالة غير منفذة مع وجود مؤشر تأخير.','مراجعة سبب التأخير وخطة المعالجة.',r);
 });
 ['projects','connections'].forEach(key=>rows(key).forEach(r=>{const c=ensure(xdCaseRef(r),r);if(!c)return;const age=norm(r.adviceAge),closing=xdClosingState(r);
  if(!closing&&age.includes('اهمال شديد'))xdPushReason(c,'advice-'+key,'إفادة مهملة بشدة',20,key,PAGE_TITLES[key],'حالة الإفادة مصنفة إهمال شديد بالمتابعة.','تحديث الإفادة فورًا وتوثيق الموقف الحالي.',r);
  else if(!closing&&age.includes('اهمال'))xdPushReason(c,'advice-'+key,'إفادة مهملة',15,key,PAGE_TITLES[key],'حالة الإفادة مصنفة إهمال بالمتابعة.','تحديث الإفادة وتحديد آخر إجراء.',r);
  else if(!closing&&age.includes('قديمه جدا'))xdPushReason(c,'advice-'+key,'إفادة قديمة جدًا',10,key,PAGE_TITLES[key],'الإفادة مصنفة قديمة جدًا.','تحديث الإفادة بالموقف الحالي.',r);
  if(isDelayed(r.executionStatus)||isDelayed(r.delay))xdPushReason(c,'delay-'+key,'تأخير في التنفيذ',18,key,PAGE_TITLES[key],'سجل التنفيذ يحمل مؤشر تأخير.','مراجعة سبب التأخير والإجراء التصحيحي.',r);
 }));
 rows('attachments').forEach(r=>{const c=ensure(xdCaseRef(r),r);if(!c)return;const status=clean(r.status),age=xdDaysSince(r.uploadDate);
  if(!xdDocFinal(status)){if(age!==null&&age>=14)xdPushReason(c,'documents-attachments','دورة مستندات راكدة',18,'attachments','المرفقات','حالة المرفقات «'+(status||'غير محددة')+'» وآخر تحديث منذ '+age+' يومًا.','متابعة المستندات وتحديد سبب توقف الدورة.',r);
   else if(age!==null&&age>=7)xdPushReason(c,'documents-attachments','مستندات لم تتحرك',12,'attachments','المرفقات','حالة المرفقات «'+(status||'غير محددة')+'» وآخر تحديث منذ '+age+' أيام.','متابعة انتقال المستندات للمرحلة التالية.',r);
   else if(status&&(norm(status).includes('لم')||norm(status).includes('قيد')))xdPushReason(c,'documents-attachments','دورة مستندات غير مكتملة',7,'attachments','المرفقات','الحالة الحالية: '+status+'.','التحقق من الإجراء التالي في دورة المستندات.',r)}
 });
 rows('permits').forEach(r=>{const c=ensure(xdCaseRef(r),r);if(!c)return;
  if(containsAny(r.evaluation,['رفض','مرفوض']))xdPushReason(c,'permit-rejected','تصريح مرفوض',10,'permits','التصاريح','تقييم طلب التصريح يشير إلى الرفض.','مراجعة سبب الرفض وخطوة إعادة التقديم.',r);
  else if(clean(r.permitNotes)&&!clean(r.actionTaken))xdPushReason(c,'permit-no-action','ملاحظة تصريح بلا إجراء',8,'permits','التصاريح','توجد ملاحظة على التصريح بدون إجراء مسجل.','تسجيل الإجراء المتخذ ومتابعة التصريح.',r)
 });
 rows('assets').forEach(r=>{const c=ensure(xdCaseRef(r),r);if(!c)return;
  if(norm(r.plantingReview)==='تمت المراجعه'){
   if(!clean(r.installDate))xdAddQualityFlag(c,'تاريخ تركيب مفقود','الأصل تمت مراجعته لكن تاريخ التركيب غير مسجل.');
   if(!clean(r.engineer))xdAddQualityFlag(c,'مهندس تركيب مفقود','الأصل تمت مراجعته لكن مهندس التركيب غير مسجل.');
  }
  if(clean(r.notes)&&!containsAny(r.resolved,['تم','نعم','معالج']))xdPushReason(c,'asset-unresolved','ملاحظة أصل غير مغلقة',10,'assets','الأصول','توجد ملاحظة على الأصل دون إثبات تلافيها.','مراجعة الملاحظة وتوثيق الإغلاق أو الإجراء التصحيحي.',r);
 });
 rows('closures').forEach(r=>{const c=ensure(xdCaseRef(r),r);if(!c)return;
  if(clean(r.docsReceived)&&!clean(r.docsReview))xdPushReason(c,'closure-review','مستندات إغلاق بلا مراجعة',10,'closures','الإغلاقات','تم استلام مستندات الإغلاق دون تسجيل نتيجة المراجعة.','استكمال مراجعة مستندات الإغلاق وتوثيق النتيجة.',r);
 });
 rows('tasks').forEach(r=>{const c=ensure(xdCaseRef(r),r);if(!c)return;
  if(containsAny(r.attachments,['مشكلة','عدم','ناقص'])&&!containsAny(r.resolved,['تم','معالج']))xdPushReason(c,'site-unresolved','مشكلة ميدانية غير معالجة',12,'tasks','متابعة المواقع','السجل يشير إلى مشكلة بالمرفقات أو الإثباتات دون معالجة مثبتة.','معالجة المشكلة الميدانية وتحديث الإثبات والإفادة.',r);
 });
 rows('emergency').forEach(r=>{const c=ensure(xdCaseRef(r),r);if(!c)return;const done=isDone(r.status),archive=norm(r.archive);
  if(done&&(!archive||archive.includes('لم يستلم من المقاول')))xdPushReason(c,'emergency-docs','إشعار منجز ودورة المستندات لم تبدأ',14,'emergency','الطوارئ','التنفيذ منجز لكن المستندات غير مستلمة من المقاول أو الحالة غير مكتملة.','استلام مستندات الإشعار وبدء دورة المراجعة.',r);
  if(!clean(r.status))xdAddQualityFlag(c,'حالة الطوارئ غير مسجلة','السجل لا يحتوي على حالة تنفيذ.');
  if(done&&(!clean(r.startDate)||!clean(r.endDate)))xdAddQualityFlag(c,'تواريخ تنفيذ ناقصة','الإشعار منجز مع نقص في تاريخ المباشرة أو الانتهاء.');
 });
 map.forEach(c=>{
  if(!c.engineer)xdAddQualityFlag(c,'مسؤول المتابعة غير واضح','لم يتم العثور على مهندس أو مسؤول متابعة مرتبط بالسجل.');
  if(!c.contractor)xdAddQualityFlag(c,'المقاول غير واضح','لم يتم العثور على مقاول مرتبط بالسجل.');
  const direct=c.reasons.filter(r=>r.kind!=='context');
  const repeat=contractorRecent.get(c.contractor)||0;
  if(direct.length&&c.contractor&&repeat>=7)xdPushReason(c,'contractor-context','سياق تكرار مرتفع لدى المقاول',8,'','سياق المقاول','المقاول لديه '+repeat+' سجل مخالفة/محضر فريد خلال آخر 7 أيام.','مراجعة النمط المتكرر لدى المقاول بالتوازي مع السبب المباشر للحالة.',null,'context');
  else if(direct.length&&c.contractor&&repeat>=4)xdPushReason(c,'contractor-context','سياق تكرار ملحوظ لدى المقاول',5,'','سياق المقاول','المقاول لديه '+repeat+' سجلات مخالفة/محاضر فريدة خلال آخر 7 أيام.','فحص نمط التكرار لدى المقاول قبل اتساعه.',null,'context');
  c.score=Math.min(100,c.score);
  c.directReasons=c.reasons.filter(r=>r.kind!=='context');
  c.contextReasons=c.reasons.filter(r=>r.kind==='context');
  c.sourceKeys=[...new Set(c.directReasons.map(r=>r.pageKey).filter(Boolean))];
  c.sourceNames=c.sourceKeys.map(k=>PAGE_TITLES[k]||k);
  c.actionPlan=[...new Set(c.directReasons.slice().sort((a,b)=>b.points-a.points).map(r=>r.action).filter(Boolean))].slice(0,3);
  const coverage=30+Math.min(30,c.sourceKeys.length*10)+Math.min(30,c.directReasons.length*7)+(c.hasWorkOrder?5:0)-Math.min(24,c.qualityFlags.length*8);
  c.confidence=Math.max(25,Math.min(95,coverage));c.confidenceLevel=c.confidence>=75?'high':c.confidence>=50?'medium':'low';
  c.priority=c.score>=50?'high':c.score>=25?'medium':'watch';c.nextAction=c.actionPlan[0]||'مراجعة الحالة';
 });
 return [...map.values()].filter(c=>c.directReasons&&c.directReasons.length&&c.score>0).sort((a,b)=>b.score-a.score||b.confidence-a.confidence||b.directReasons.length-a.directReasons.length);
}
function renderExplainableDecision(){
 if(!SC.loaded)return;const loading=el('xdLoading'),root=el('xdContent');if(loading)loading.style.display='none';if(root)root.style.display='block';SC.decisionCases=xdBuildCases();
 const all=SC.decisionCases,high=all.filter(x=>x.priority==='high').length,multi=all.filter(x=>x.sourceKeys.length>=2).length,highConfidence=all.filter(x=>x.confidence>=75).length,top=all[0];
 el('xdKpis').innerHTML=[['حالات تحتاج متابعة',all.length,'بها دليل مباشر واحد على الأقل'],['أولوية مرتفعة',high,'نقاط أولوية ≥ 50'],['متعددة المصادر',multi,'مرتبطة بمصدرين أو أكثر'],['ثقة تغطية عالية',highConfidence,'تغطية ≥ 75%'],['أعلى حالة',top?top.workOrder:'—',top?('نقاط '+top.score+' • ثقة '+top.confidence+'%'):'لا توجد حالات']].map(x=>'<article><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></article>').join('');
 const source=el('xdSource');if(source){const current=source.value;const keys=[...new Set(all.flatMap(c=>c.sourceKeys))].sort((a,b)=>(PAGE_TITLES[a]||a).localeCompare(PAGE_TITLES[b]||b,'ar'));source.innerHTML='<option value="">كل مصادر القرار</option>'+keys.map(k=>'<option value="'+esc(k)+'">'+esc(PAGE_TITLES[k]||k)+'</option>').join('');if(keys.includes(current))source.value=current}
 renderDecisionCases();
}
function xdConfidenceMatch(c,f){if(!f)return true;if(f==='high')return c.confidence>=75;if(f==='medium')return c.confidence>=50&&c.confidence<75;if(f==='low')return c.confidence<50;return true}
function renderDecisionCases(){
 if(!Array.isArray(SC.decisionCases))SC.decisionCases=xdBuildCases();
 const searchRaw=clean(el('xdSearch')&&el('xdSearch').value),q=norm(searchRaw),p=el('xdPriority')&&el('xdPriority').value,cf=el('xdConfidence')&&el('xdConfidence').value,src=el('xdSource')&&el('xdSource').value;
 const cases=SC.decisionCases.filter(c=>{if(p&&c.priority!==p)return false;if(!xdConfidenceMatch(c,cf))return false;if(src&&!c.sourceKeys.includes(src))return false;
  if(!q)return true;const hay=[c.workOrder,c.contractor,c.engineer,c.region,...c.reasons.flatMap(r=>[r.label,r.detail,r.action,r.source]),...c.qualityFlags.flatMap(x=>[x.label,x.detail])].join(' ');return norm(hay).includes(q)}).slice(0,80);
 const count=el('xdFilterCount'),hint=el('xdFilterHint'),clearBtn=el('xdClear'),active=[];
 if(searchRaw)active.push('بحث: '+searchRaw);
 if(p)active.push('الأولوية: '+({high:'مرتفعة',medium:'متوسطة',watch:'مراقبة'}[p]||p));
 if(cf)active.push('الثقة: '+({high:'عالية',medium:'متوسطة',low:'محدودة'}[cf]||cf));
 if(src){const opt=el('xdSource')?.selectedOptions?.[0];active.push('المصدر: '+(opt?.textContent||src))}
 if(count)count.textContent=cases.length.toLocaleString('ar-SA')+' حالة';
 if(hint)hint.textContent=active.length?active.join(' • '):'كل الحالات بدون فلترة';
 if(clearBtn){clearBtn.disabled=!active.length;clearBtn.classList.toggle('is-active',!!active.length)}
 const label={high:'مرتفعة',medium:'متوسطة',watch:'مراقبة'},root=el('xdCases');if(!cases.length){root.innerHTML='<div class="xd-empty">لا توجد حالات مطابقة للفلاتر الحالية.</div>';return}
 root.innerHTML=cases.map(c=>{const idx=SC.decisionCases.indexOf(c),sorted=c.reasons.slice().sort((a,b)=>b.points-a.points),kindLabel=c.hasWorkOrder?'أمر العمل':'السجل';
  return '<article class="xd-case '+c.priority+'"><div class="xd-case-head"><div><span>'+kindLabel+'</span><h3>'+esc(c.workOrder)+'</h3><small>'+esc(c.contractor||'مقاول غير محدد')+(c.engineer?' • '+esc(c.engineer):'')+(c.region?' • '+esc(c.region):'')+'</small></div><div class="xd-score"><b>'+c.score+'</b><span>نقاط أولوية</span><em>'+label[c.priority]+'</em></div></div>'+
  '<div class="xd-meta-row"><span class="xd-confidence '+c.confidenceLevel+'">ثقة التغطية '+c.confidence+'%</span><span>'+c.directReasons.length+' إشارة مباشرة</span><span>'+c.sourceKeys.length+' مصدر</span></div>'+
  '<div class="xd-source-row">'+c.sourceNames.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>'+
  '<div class="xd-why"><b>لماذا هذه الأولوية؟</b><div>'+sorted.map(r=>'<button type="button" class="xd-reason '+(r.kind==='context'?'context':'')+'" data-ci="'+idx+'" data-ri="'+c.reasons.indexOf(r)+'"><span>'+esc(r.label)+'</span><strong>+'+r.points+'</strong><small>'+esc(r.detail)+'</small><em>'+(r.kind==='context'?'عامل سياقي':'دليل مباشر')+'</em></button>').join('')+'</div></div>'+
  '<div class="xd-plan"><span>خطة الإجراء المقترحة</span><ol>'+c.actionPlan.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ol></div>'+
  (c.qualityFlags.length?'<div class="xd-quality-flags"><b>تنبيهات جودة البيانات</b>'+c.qualityFlags.map(x=>'<span title="'+esc(x.detail)+'">'+esc(x.label)+'</span>').join('')+'</div>':'')+
  '</article>'}).join('');
 root.querySelectorAll('.xd-reason').forEach(b=>b.onclick=()=>renderDecisionEvidence(Number(b.dataset.ci),Number(b.dataset.ri)));
}
function renderDecisionEvidence(ci,ri){
 const c=SC.decisionCases&&SC.decisionCases[ci],r=c&&c.reasons[ri],root=el('xdEvidencePanel');if(!c||!r||!root)return;
 root.innerHTML='<div class="xd-evidence-head"><div><span>EVIDENCE TRACE</span><h3>'+esc(r.label)+'</h3><p>'+esc(c.hasWorkOrder?'أمر العمل ':'السجل ')+esc(c.workOrder)+' • مساهمة +'+r.points+' نقطة • '+(r.kind==='context'?'عامل سياقي':'دليل مباشر')+'.</p></div><b>'+esc(r.source)+'</b></div>'+
 '<div class="xd-evidence-grid"><article><span>الدليل</span><strong>'+esc(r.detail)+'</strong></article><article><span>المصدر</span><strong>'+esc(r.source)+'</strong><small>صف المصدر: '+esc(r.row||'—')+'</small></article><article><span>الإجراء التالي المقترح</span><strong>'+esc(r.action)+'</strong></article><article><span>السياق</span><strong>'+esc(c.contractor||'مقاول غير محدد')+'</strong><small>'+esc(c.engineer||'مسؤول متابعة غير محدد')+(c.region?' • '+esc(c.region):'')+'</small></article></div>'+
 '<div class="xd-evidence-actions">'+(xdCanOpenSource(r.pageKey)?'<button type="button" id="xdOpenSource">فتح المصدر الأصلي ↗</button>':'')+(c.hasWorkOrder?'<button type="button" id="xdOpen360">فتح Work Order 360° 🔎</button>':'')+'</div>'+
 '<div class="xd-evidence-note">هذه أولوية تشغيلية قابلة للتفسير مبنية على البيانات المتاحة. ثقة التغطية الحالية '+c.confidence+'%، ويمكن مراجعة بقية الأسباب للحصول على الصورة الكاملة.</div>';
 if(xdCanOpenSource(r.pageKey)&&el('xdOpenSource'))el('xdOpenSource').onclick=()=>openDecisionSource(ci,ri);
 if(c.hasWorkOrder&&el('xdOpen360'))el('xdOpen360').onclick=()=>openDecision360(ci);
 root.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function xdCanOpenSource(pageKey){return pageKey==='workorders'||!!document.querySelector('#nav .nav-item[data-page="'+pageKey+'"]')}
function openDecisionSource(ci,ri){
 const c=SC.decisionCases&&SC.decisionCases[ci],r=c&&c.reasons[ri];if(!c||!r||!xdCanOpenSource(r.pageKey))return;
 const target=r.pageKey==='workorders'?'master':r.pageKey;
 leaveSmartCenter();const search=el('globalSearch');if(search)search.value=c.workOrder;
 if(typeof openPage==='function')openPage(target);else document.querySelector('#nav .nav-item[data-page="'+target+'"]')?.click();
 setTimeout(()=>{try{if(typeof applyFilters==='function')applyFilters()}catch(e){}},650);
}
function openDecision360(ci){
 const c=SC.decisionCases&&SC.decisionCases[ci];if(!c||!c.hasWorkOrder)return;
 const nav=el('workOrder360Nav');if(!nav)return;nav.click();
 setTimeout(()=>{const input=el('wo360Input');if(input)input.value=c.workOrder;el('wo360Search')?.click()},180);
}

function bindExceptionTools(){
 const cats=[...new Set(SC.issues.map(x=>x.category).filter(Boolean))].sort();
 el('scCategory').innerHTML='<option value="">كل الأنواع</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 el('scSeverity').onchange=renderExceptions;el('scCategory').onchange=renderExceptions;
 let t;el('scIssueSearch').oninput=()=>{clearTimeout(t);t=setTimeout(renderExceptions,130)};
 const clear=el('scChartFilterClear');if(clear)clear.onclick=()=>{SC.cross={contractor:'',pageKey:''};if(el('scCategory'))el('scCategory').value='';renderExceptions()};
}
function filteredIssues(){
 const sev=el('scSeverity')?.value||'',cat=el('scCategory')?.value||'',q=norm(el('scIssueSearch')?.value||'');
 return SC.issues.filter(x=>{
  if(sev&&x.severity!==sev)return false;if(cat&&x.category!==cat)return false;
  if(SC.cross.contractor&&clean(x.contractor)!==clean(SC.cross.contractor))return false;
  if(SC.cross.pageKey&&x.pageKey!==SC.cross.pageKey)return false;
  if(!q)return true;return norm([x.title,x.detail,x.id,x.contractor,x.engineer,x.section,PAGE_TITLES[x.pageKey]].join(' ')).includes(q);
 });
}
function syncSmartChartFilterBadge(){
 const badge=el('scChartFilterBadge'),clear=el('scChartFilterClear'),cat=el('scCategory')?.value||'';
 const parts=[];if(SC.cross.pageKey)parts.push(PAGE_TITLES[SC.cross.pageKey]||SC.cross.pageKey);if(SC.cross.contractor)parts.push(SC.cross.contractor);if(cat)parts.push(cat);
 if(badge){badge.style.display=parts.length?'inline-flex':'none';badge.textContent=parts.length?'فلتر الشارت: '+parts.join(' • '):''}
 if(clear)clear.style.display=parts.length?'inline-flex':'none';
}
function renderExceptions(){
 const data=filteredIssues(),root=el('scExceptionTable');el('scIssueCount').textContent=data.length.toLocaleString('ar-SA');syncSmartChartFilterBadge();
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
function smartChartClick(id,label){
 if(id==='scQualityChart'){const q=SC.quality.find(x=>clean(x.title)===clean(label));if(q){SC.cross.pageKey=SC.cross.pageKey===q.pageKey?'':q.pageKey;renderExceptions()}return}
 if(id==='scIssueChart'){const c=el('scCategory');if(c){c.value=c.value===label?'':label;renderExceptions()}return}
 if(id==='scContractorChart'){SC.cross.contractor=SC.cross.contractor===label?'':label;renderExceptions()}
}
function barChart(id,labels,data,horizontal=false,max=100){
 destroyChart(id);const canvas=el(id);if(!canvas||typeof Chart==='undefined')return;
 SC.charts[id]=new Chart(canvas,{type:'bar',data:{labels,datasets:[{data,backgroundColor:'rgba(40,120,232,.72)',hoverBackgroundColor:'rgba(40,120,232,.9)',borderWidth:0,borderRadius:7,maxBarThickness:34}]},options:{indexAxis:horizontal?'y':'x',responsive:true,maintainAspectRatio:false,onHover:(e,els)=>{canvas.style.cursor=els.length?'pointer':'default'},onClick:(e,els,ch)=>{if(els.length)smartChartClick(id,clean(ch.data.labels[els[0].index]))},plugins:{legend:{display:false},tooltip:{rtl:true,titleFont:{family:'Cairo'},bodyFont:{family:'Cairo'}}},scales:{x:{beginAtZero:true,max:horizontal&&max===100?100:undefined,grid:{display:false},ticks:{font:{family:'Cairo',size:8}}},y:{beginAtZero:true,max:!horizontal&&max===100?100:undefined,grid:{color:'rgba(120,140,165,.12)'},ticks:{font:{family:'Cairo',size:8}}}}}});
}
function renderCharts(){
 const quality=[...SC.quality].sort((a,b)=>a.score-b.score);barChart('scQualityChart',quality.map(x=>x.title),quality.map(x=>x.score),true,100);
 const categories=groupIssues('category',9);barChart('scIssueChart',categories.map(x=>x.name),categories.map(x=>x.count),true,0);
 const contractors=groupIssues('contractor',10);barChart('scContractorChart',contractors.map(x=>x.name),contractors.map(x=>x.count),true,0);
}
window.VDSyncSmartSectionTabs=syncSmartSectionTabs;
function bootSmartCenter(){
 const identity=projectIdentity();SC.projectKey=identity.key;installUi();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bootSmartCenter,120));else setTimeout(bootSmartCenter,120);
})();
