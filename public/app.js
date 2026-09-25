
const S={booted:false,boot:null,masterRows:[],masterKpis:[],page:null,raw:[],filtered:[],columns:[],filterKeys:[],charts:{},current:'master',pageCache:{},chartFilters:{},pageBaseRows:[],masterBaseRows:[],meeting:null,meetingRows:[]};
const LABELS={
 region:'الإدارة / المنطقة',section:'القسم',contractor:'المقاول',engineer:'المهندس',status:'الحالة',
 delay:'التأخير',executionStatus:'حالة التنفيذ',permit:'التصريح',permitStatus:'حالة التصريح',
 category:'النوع الفرعي',stage:'مرحلة التنفيذ',stageStatus:'حالة المرحلة',approval:'الاعتماد',
 resolved:'المعالجة',faultType:'نوع العطل',source:'المصدر',attachments:'المرفقات',
 employee:'الموظف',sourceType:'النوع',supervisor:'المشرف',editor:'المحرر',violation:'المخالفة',
 emailStatus:'حالة الإيميل',violationSection:'قسم المخالفة',minuteType:'نوع المحضر',
 uploadStatus:'حالة الرفع',payment:'حالة السداد',consultant155:'155 الاستشاري',contractor155:'155 المقاول',value:'القيمة المالية',paymentStatus:'حالة الدفع',statementNo:'المستخلص',
 sapStatus:'حالة SAP',group:'المجموعة',executionEntity:'جهة التنفيذ',evaluation:'التقييم',date:'التاريخ'
};

document.addEventListener('DOMContentLoaded',()=>{
 // إخفاء شاشة التحميل بشكل مستقل عن أي زر أو دالة أخرى.
 setTimeout(()=>{
   S.booted=true;
   showBoot(false);
   document.body.classList.add('dashboard-ready');
 },120);

 try{
   bind();
 }catch(e){
   console.error('Bind error:',e);
 }

 const title=document.getElementById('pageTitle');
 if(title) title.textContent='لوحة المتابعة الرئيسية — جاري تحديث البيانات...';

 google.script.run
   .withSuccessHandler(init)
   .withFailureHandler(fail)
   .getBootData();
});

function bind(){
 document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>openPage(b.dataset.page));
 const financeBtn=document.getElementById('financeBtn');
 if(financeBtn) financeBtn.onclick=()=>openPage('finance');

 const printBtn=document.getElementById('printBtn');
 if(printBtn) printBtn.onclick=()=>window.print();
 const exportSafetyPdfBtn=document.getElementById('exportSafetyPdfBtn');
 if(exportSafetyPdfBtn) exportSafetyPdfBtn.onclick=exportSafetyReportPdf;
 const exportExecutionPdfBtn=document.getElementById('exportExecutionPdfBtn');
 if(exportExecutionPdfBtn) exportExecutionPdfBtn.onclick=exportExecutionReportPdf;

 bindWednesdayInfoPopups();
 bindMeetingCalculationHelp();

 const themeSelect=document.getElementById('themeSelect');
 if(themeSelect) themeSelect.onchange=()=>setDashboardTheme(themeSelect.value,true);
 applySavedTheme();

 const refreshBtn=document.getElementById('refreshBtn');
 if(refreshBtn) refreshBtn.onclick=()=>{
   showBoot(true); google.script.run.withSuccessHandler(()=>location.reload()).withFailureHandler(fail).clearDashboardCache();
 };
 const clearFilters=document.getElementById('clearFilters');
 if(clearFilters) clearFilters.onclick=()=>{
   ['f1','f2','f3','f4','f5'].forEach(id=>document.getElementById(id).value='');
   document.getElementById('globalSearch').value='';
   clearChartFilters(S.current);
   if(S.current==='master')applyMasterFilters();else applyFilters();
 };
 ['f1','f2','f3','f4','f5'].forEach(id=>{
   const el=document.getElementById(id);
   if(el) el.onchange=applyFilters;
 });
 let t;
 const globalSearch=document.getElementById('globalSearch');
 if(globalSearch) globalSearch.oninput=()=>{clearTimeout(t);t=setTimeout(applyFilters,180)};
}

function init(x){
 S.boot=x; S.masterRows=x.master.rows||[]; S.masterKpis=x.master.kpis||[];
 document.getElementById('lastUpdate').textContent=x.updatedAt;
 document.getElementById('pageTitle').textContent='لوحة المتابعة الرئيسية';
 renderMasterKpis(S.masterKpis);
 configureMasterFilters();
 applyMasterFilters();
 showBoot(false);

 // بعد ظهور الصفحة: حمّل أعمدة التأخير فقط في الخلفية.
 setTimeout(loadMasterEnrichment, 50);

 // ثم بقية المؤشرات من الأوراق الأخرى بدون تعطيل المستخدم.
 setTimeout(loadSecondaryMasterKpis, 250);
}

function loadMasterEnrichment(){
 google.script.run
   .withSuccessHandler(extra=>{
     if(!Array.isArray(extra)||!extra.length)return;

     const byRow=new Map(extra.map(x=>[Number(x._row),x]));
     S.masterRows.forEach(r=>{
       const e=byRow.get(Number(r._row));
       if(e){
         ['category','executionEntity','office','duration','delay','consultantAction','consultantDays','consultant155','consultant155Date','contractorAction','contractorDays','contractor155','contractor155Date','contractorPosition','permit','payment','advice','stage','stageStatus'].forEach(k=>{r[k]=e[k]||''});
         r._search=(r._search+' '+[
           r.category,r.executionEntity,r.office,r.duration,r.delay,r.consultantAction,r.consultantDays,
           r.consultant155,r.contractorAction,r.contractor155,r.contractorPosition,r.permit,r.payment,
           r.advice,r.stage,r.stageStatus
         ].join(' ')).toLowerCase();
       }
     });

     if(S.current==='master') applyMasterFilters();
   })
   .withFailureHandler(()=>{})
   .getWorkOrderMasterEnrichment();
}

function loadSecondaryMasterKpis(){
 google.script.run
   .withSuccessHandler(arr=>{
     if(!Array.isArray(arr)||!arr.length)return;
     S.masterKpis=S.masterKpis.concat(arr);
     renderMasterKpis(S.masterKpis);
   })
   .withFailureHandler(()=>{})
   .getSecondaryMasterKpis();
}

function bindWednesdayInfoPopups(){
 const modal=document.getElementById('meetingInfoModal');
 const text=document.getElementById('meetingInfoText');
 const close=document.getElementById('meetingInfoClose');

 document.querySelectorAll('.meeting-info-btn').forEach(btn=>{
   if(btn.dataset.bound)return;
   btn.addEventListener('click',()=>{
     if(text)text.textContent=btn.dataset.note||'';
     if(modal){
       modal.classList.add('show');
       modal.setAttribute('aria-hidden','false');
     }
   });
   btn.dataset.bound='1';
 });

 const detailsBtn=document.getElementById('meetingMethodologyBtn');
 if(detailsBtn&&!detailsBtn.dataset.bound){
   detailsBtn.addEventListener('click',()=>{
     if(text)text.innerHTML=`
       <div class="meeting-method-list">
         <p><b>التنفيذ:</b> العمود R. يُعتبر الأمر منفذًا فقط إذا كانت القيمة «تم التنفيذ».</p>
         <p><b>شجرة لم يتم التنفيذ:</b> تُقسم تلقائيًا حسب الحالات الفعلية الموجودة في العمود BC.</p>
         <p><b>متأخر إغلاق:</b> الأمر منفذ + مرحلة التنفيذ تحتوي «الإغلاق» + حالة المرحلة ليست «تم الانتهاء».</p>
         <p><b>المقاول:</b> العمود G.</p>
         <p><b>نوع العمل:</b> العمود P.</p>
         <p><b>فئة العمل:</b> العمود T.</p>
         <p><b>جهة التنفيذ / المكتب:</b> العمود U.</p>
         <p><b>حالة التصاريح:</b> تعتمد كليًا على العمود AO (حالة التصريح من بلدي). جميع القيم المختلفة في AO تظهر تلقائيًا في الجدول والرسم، بما فيها «انتهاء التنسيق - رفض»، وأي حالة جديدة مستقبلًا تظهر تلقائيًا.</p>
         <p><b>شريحة أيام التأخير:</b> العمود BE مباشرة.</p>
         <p><b>شجرة تم التنفيذ:</b> تبدأ من العمود AK إلى «مستلم 155 للمقاول» و«غير مستلم 155 للمقاول». فرع «غير مستلم 155 للمقاول» ينقسم حسب BF إلى «تم الاستلام من المقاول» و«لم يتم الاستلام من المقاول»، ثم «تم الاستلام من المقاول» ينقسم تلقائيًا حسب الحالات الموجودة في BG.</p>
       </div>`;
     if(modal){
       modal.classList.add('show');
       modal.setAttribute('aria-hidden','false');
     }
   });
   detailsBtn.dataset.bound='1';
 }

 const hide=()=>{
   if(modal){
     modal.classList.remove('show');
     modal.setAttribute('aria-hidden','true');
   }
 };

 if(close&&!close.dataset.bound){
   close.addEventListener('click',hide);
   close.dataset.bound='1';
 }

 if(modal&&!modal.dataset.bound){
   modal.addEventListener('click',e=>{if(e.target===modal)hide()});
   modal.dataset.bound='1';
 }
}

function openPage(key){
 S.current=key;
 const isMeeting=key==='wednesdayMeeting';
 renderChartFilterSummary();
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===key));
 document.getElementById('masterPage').classList.toggle('active',key==='master');
 document.getElementById('meetingPage').classList.toggle('active',isMeeting);
 document.getElementById('dataPage').classList.toggle('active',key!=='master'&&!isMeeting);
 const filterBar=document.getElementById('filterBar');
 if(filterBar)filterBar.classList.toggle('meeting-filter-hidden',isMeeting);

 if(key==='master'){
   document.getElementById('pageTitle').textContent='لوحة المتابعة الرئيسية';
   configureMasterFilters();applyMasterFilters();return;
 }
 if(isMeeting){
   document.getElementById('pageTitle').textContent='اجتماع الـ PDC';
   openWednesdayMeeting();
   return;
 }
 document.getElementById('pageTitle').textContent=(S.boot.pageMeta[key]?.title||key);
 if(S.pageCache[key]){loadPagePayload(S.pageCache[key]);return}
 showBoot(true);
 google.script.run.withSuccessHandler(p=>{S.pageCache[key]=p;loadPagePayload(p);showBoot(false)}).withFailureHandler(fail).getPageData(key);
}


function openWednesdayMeeting(){
 if(S.meeting){
   configureWednesdayMeetingFilters();
   renderWednesdayMeeting();
   return;
 }
 showBoot(true);
 google.script.run
   .withSuccessHandler(p=>{
     S.meeting=p||{rows:[]};
     S.meetingRows=Array.isArray(S.meeting.rows)?S.meeting.rows:[];
     configureWednesdayMeetingFilters();
     renderWednesdayMeeting();
     showBoot(false);
   })
   .withFailureHandler(fail)
   .getWednesdayMeetingData();
}

function configureWednesdayMeetingFilters(){
 const defs=[
   ['wmOffice','office'],
   ['wmContractor','contractor'],
   ['wmCategory','category'],
   ['wmExecution','executionStatus']
 ];
 defs.forEach(([id,key])=>{
   const el=document.getElementById(id);
   if(!el)return;
   const current=el.value||'';
   const vals=unique(S.meetingRows.map(r=>r[key])).sort((a,b)=>String(a).localeCompare(String(b),'ar'));
   el.innerHTML='<option value="">الكل</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
   if(vals.includes(current))el.value=current;
   el.onchange=renderWednesdayMeeting;
 });
 const search=document.getElementById('wmSearch');
 if(search&&!search.dataset.bound){
   let timer;
   search.oninput=()=>{clearTimeout(timer);timer=setTimeout(renderWednesdayMeeting,160)};
   search.dataset.bound='1';
 }
 const reset=document.getElementById('wmReset');
 if(reset&&!reset.dataset.bound){
   reset.onclick=()=>{
     defs.forEach(([id])=>{const e=document.getElementById(id);if(e)e.value=''});
     if(search)search.value='';
     renderWednesdayMeeting();
   };
   reset.dataset.bound='1';
 }
}

function filteredWednesdayRows(){
 const filters={
   office:document.getElementById('wmOffice')?.value||'',
   contractor:document.getElementById('wmContractor')?.value||'',
   category:document.getElementById('wmCategory')?.value||'',
   executionStatus:document.getElementById('wmExecution')?.value||''
 };
 const q=String(document.getElementById('wmSearch')?.value||'').trim().toLowerCase();
 return S.meetingRows.filter(r=>{
   if(filters.office&&String(r.office||'')!==filters.office)return false;
   if(filters.contractor&&String(r.contractor||'')!==filters.contractor)return false;
   if(filters.category&&String(r.category||'')!==filters.category)return false;
   if(filters.executionStatus&&String(r.executionStatus||'')!==filters.executionStatus)return false;
   if(q&&!String(r._search||'').includes(q))return false;
   return true;
 });
}

function meetingPct(a,b){return b?Math.round(a/b*1000)/10:0}

function meetingGroupSummary(rows,key,limit){
 const m=new Map();
 rows.forEach(r=>{
   const name=String(r[key]||'غير محدد').trim()||'غير محدد';
   let x=m.get(name);
   if(!x){x={name,total:0,completed:0,delayed:0,within:0,closure:0};m.set(name,x)}
   x.total++;
   if(r.completed)x.completed++;
   if(r.delayedExecution)x.delayed++;
   if(r.withinDuration)x.within++;
   if(r.delayedClosure)x.closure++;
 });
 let arr=[...m.values()].map(x=>({...x,rate:meetingPct(x.completed,x.total)}))
   .sort((a,b)=>b.total-a.total||b.completed-a.completed);
 if(limit)arr=arr.slice(0,limit);
 return arr;
}

function meetingCountBy(rows,key,predicate){
 const m={};
 rows.forEach(r=>{
   if(predicate&&!predicate(r))return;
   const name=String(r[key]||'غير محدد').trim()||'غير محدد';
   m[name]=(m[name]||0)+1;
 });
 return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}

function renderWednesdayMeeting(){
 const rows=filteredWednesdayRows();
 const total=rows.length;
 const completed=rows.filter(r=>r.completed).length;
 const delayed=rows.filter(r=>r.delayedExecution).length;
 const within=rows.filter(r=>r.withinDuration).length;
 const closure=rows.filter(r=>r.delayedClosure).length;
 const avgDelay=total?rows.reduce((s,r)=>s+Number(r.delayDays||0),0)/total:0;
 // حالة المستندات تخص أوامر العمل المنفذة فقط لأن المقاول يقدم المستندات بعد التنفيذ.
 const executedRows=rows.filter(r=>r.completed);
 const docsIncomplete=executedRows.filter(r=>{
   const d=String(r.docsStatus||'').trim();
   if(!d||d==='غير محدد')return true;
   return !(d.includes('مكتمل')||d.includes('مستوف')||d.includes('تم التسليم')||d.includes('تم الاستلام')||d.includes('مستلمة'));
 }).length;

 const updated=document.getElementById('meetingUpdatedAt');
 if(updated)updated.textContent=S.meeting?.updatedAt||'—';

 const statusNorm=v=>String(v||'').trim().replace(/\s*\/\s*/g,'/');
 // المستوى الأول يعتمد فقط على حالة التنفيذ الأصلية من العمود R.
 const completedRows=rows.filter(r=>statusNorm(r.executionRaw)==='تم التنفيذ');
 const incompleteRows=rows.filter(r=>statusNorm(r.executionRaw)==='لم يتم التنفيذ');
 const stoppedRows=rows.filter(r=>{
   const x=statusNorm(r.executionRaw);
   return x==='موقوف/محول'||x==='متوقف/محول'||x==='موقوف'||x==='محول'||x==='متوقف';
 });
 const pct=n=>meetingPct(n,total)+'% من الإجمالي';

 // AK: نعم = مستلم 155، لا = غير مستلم 155.
 const akNorm=v=>statusNorm(v).replace(/[أإآ]/g,'ا');
 const received155Rows=completedRows.filter(r=>akNorm(r.contractor155Status)==='نعم');
 const notReceived155Rows=completedRows.filter(r=>akNorm(r.contractor155Status)==='لا');

 // BF يطبق على فرع "غير مستلم 155 المقاول" فقط كما في شجرة الاجتماع المعتمدة.
 const bfReceivedRows=notReceived155Rows.filter(r=>statusNorm(r.docsStatus)==='تم الاستلام من المقاول');
 const bfNotReceivedRows=notReceived155Rows.filter(r=>statusNorm(r.docsStatus)==='لم يتم الاستلام من المقاول');

 // BG تفصيل حالة المستندات تحت BF = تم الاستلام من المقاول.
 const bgEntries=meetingCountBy(bfReceivedRows,'docsSubStatus');
 const bgHtml=bgEntries.length
   ? bgEntries.map(([label,count])=>`<article class="kpi-story-card kpi-story-greatgrandchild"><span>${esc(label)}</span><strong>${fmt(count)}</strong><small>${pct(count)}</small></article>`).join('')
   : '<article class="kpi-story-card kpi-story-greatgrandchild"><span>غير محدد</span><strong>0</strong><small>0.0%</small></article>';

 // BC: حالات أوامر العمل غير المنفذة.
 const bcEntries=meetingCountBy(incompleteRows,'nonExecutionStatus');
 const bcHtml=bcEntries.length
   ? bcEntries.map(([label,count])=>`<article class="kpi-story-card kpi-story-child"><span>${esc(label)}</span><strong>${fmt(count)}</strong><small>${pct(count)}</small></article>`).join('')
   : '<article class="kpi-story-card kpi-story-child"><span>غير محدد</span><strong>0</strong><small>0.0%</small></article>';

 const kroot=document.getElementById('meetingKpis');
 if(kroot)kroot.innerHTML=`
  <div class="kpi-story target-tree">
   <article class="kpi-story-card kpi-story-root"><span>إجمالي أوامر العمل</span><strong>${fmt(total)}</strong><small>100% من إجمالي الأوامر</small></article>
   <div class="kpi-story-level1">
    <section class="kpi-story-node completed">
     <article class="kpi-story-card"><span>تم التنفيذ</span><strong>${fmt(completedRows.length)}</strong><small>${pct(completedRows.length)}</small></article>
     <div class="kpi-story-children ak-level">
      <article class="kpi-story-card kpi-story-child"><span>مستلم 155 المقاول</span><strong>${fmt(received155Rows.length)}</strong><small>${pct(received155Rows.length)}</small></article>
      <div class="kpi-story-child-node ak-not-received">
       <article class="kpi-story-card kpi-story-child"><span>غير مستلم 155 المقاول</span><strong>${fmt(notReceived155Rows.length)}</strong><small>${pct(notReceived155Rows.length)}</small></article>
       <div class="kpi-story-grandchildren bf-level">
        <div class="kpi-story-grandchild-node bf-received">
         <article class="kpi-story-card kpi-story-grandchild"><span>تم الاستلام من المقاول</span><strong>${fmt(bfReceivedRows.length)}</strong><small>${pct(bfReceivedRows.length)}</small></article>
         <div class="kpi-story-greatgrandchildren bg-level">${bgHtml}</div>
        </div>
        <article class="kpi-story-card kpi-story-grandchild"><span>لم يتم الاستلام من المقاول</span><strong>${fmt(bfNotReceivedRows.length)}</strong><small>${pct(bfNotReceivedRows.length)}</small></article>
       </div>
      </div>
     </div>
    </section>
    <section class="kpi-story-node incomplete">
     <article class="kpi-story-card"><span>لم يتم التنفيذ</span><strong>${fmt(incompleteRows.length)}</strong><small>${pct(incompleteRows.length)}</small></article>
     <div class="kpi-story-children bc-level">${bcHtml}</div>
    </section>
    <section class="kpi-story-node stopped">
     <article class="kpi-story-card"><span>موقوف / محول</span><strong>${fmt(stoppedRows.length)}</strong><small>${pct(stoppedRows.length)}</small></article>
    </section>
   </div>
  </div>`;

 // مؤشرات اجتماع الـ PDC المختصرة — بنفس كروت جدة.
 const allMeetingRows=Array.isArray(S.meetingRows)?S.meetingRows:[];
 const delayedExecutionByAB=allMeetingRows.filter(r=>String(r.delayStatus||'').includes('تأخير')).length;
 const withinByAB=allMeetingRows.filter(r=>{const s=String(r.delayStatus||'').trim();return s==='ضمن المدة'||s==='أوشكت المدة على الانتهاء';}).length;
 const docsNotReceivedByBG=allMeetingRows.filter(r=>statusNorm(r.executionRaw)==='تم التنفيذ'&&statusNorm(r.docsSubStatus)==='لم تُسلّم من المقاول').length;
 const executedByR=rows.filter(r=>statusNorm(r.executionRaw)==='تم التنفيذ').length;
 const completionPct=total?(executedByR/total*100):0;
 const avgDelayZA=total?(rows.reduce((sum,r)=>sum+Number(r.delayDays||0),0)/total):0;
 const summaryRoot=document.getElementById('meetingSummaryKpis');
 if(summaryRoot)summaryRoot.innerHTML=`
   <article class="meeting-summary-card tone-blue"><strong>${fmt(total)}</strong><span>إجمالي أوامر العمل</span></article>
   <article class="meeting-summary-card tone-purple"><strong>${fmt(executedByR)}</strong><span>متأخر إغلاق</span></article>
   <article class="meeting-summary-card tone-orange"><strong>${fmt(withinByAB)}</strong><span>قيد التنفيذ ضمن المدة</span></article>
   <article class="meeting-summary-card tone-red"><strong>${fmt(delayedExecutionByAB)}</strong><span>متأخر تنفيذ</span></article>
   <article class="meeting-summary-card tone-docs"><strong>${fmt(docsNotReceivedByBG)}</strong><span>مستندات لم تُسلّم من المقاول</span></article>
   <article class="meeting-summary-card tone-green"><strong>${completionPct.toFixed(1)}%</strong><span>نسبة إنجاز التنفيذ</span></article>
   <article class="meeting-summary-card tone-yellow"><strong>${avgDelayZA.toFixed(1)}</strong><span>متوسط أيام التأخير</span></article>
   <article class="meeting-summary-card tone-green"><strong>${fmt(executedByR)}</strong><span>أُنجز التنفيذ</span></article>`;

 const execLabels=['أُنجز التنفيذ','متأخر تنفيذ','قيد التنفيذ ضمن المدة','أخرى'];
 const execValues=[
   completed,delayed,within,
   Math.max(0,total-completed-delayed-within)
 ];
 meetingDrawChart('wmExecutionChart','doughnut',execLabels,[{
   data:execValues,
   backgroundColor:['#18aa7d','#e4505b','#f0a126','#667ca8'],
   borderWidth:2,borderColor:'#fff'
 }],{legend:true});

 // شارتات الملخص على اليسار تعرض نفس أعمدة حالة التنفيذ في الجدول المقابل،
 // مع لون ثابت لكل مؤشر في جميع أقسام ورقة الاجتماع.
 // شارتات الملخص تُعرض كشريط واحد متراص لكل صف، مقسم حسب حالات التنفيذ.
 // إجمالي الأوامر لا يُرسم كجزء مستقل لأنه يمثل أصل الشريط وليس حالة تنفيذ.
 const meetingSummaryDatasets=(items,{showClosure=true}={})=>{
   const common={
     stack:'meetingStatus',
     borderWidth:0,
     borderSkipped:false,
     maxBarThickness:24,
     categoryPercentage:.72,
     barPercentage:1
   };
   const sets=[
     {label:'أُنجز التنفيذ',data:items.map(x=>x.completed),backgroundColor:'#18aa7d',...common},
     {label:'متأخر تنفيذ',data:items.map(x=>x.delayed),backgroundColor:'#e4505b',...common},
     {label:'قيد التنفيذ ضمن المدة',data:items.map(x=>x.within),backgroundColor:'#f0a126',...common}
   ];
   if(showClosure)sets.push({label:'متأخر إغلاق',data:items.map(x=>x.closure),backgroundColor:'#7657d7',...common});
   return sets;
 };

 const offices=meetingGroupSummary(rows,'office',20);
 meetingDrawChart('wmOfficeChart','bar',offices.map(x=>x.name),
   meetingSummaryDatasets(offices),{horizontal:true,legend:true,stacked:true,totals:offices.map(x=>x.total)});

 const categories=meetingGroupSummary(rows,'category',20);
 meetingDrawChart('wmCategoryChart','bar',categories.map(x=>x.name),
   meetingSummaryDatasets(categories,{showClosure:false}),{horizontal:true,legend:true,stacked:true,totals:categories.map(x=>x.total)});

 const contractors=meetingGroupSummary(rows,'contractor',25);
 meetingDrawChart('wmContractorChart','bar',contractors.map(x=>x.name),
   meetingSummaryDatasets(contractors),{horizontal:true,legend:true,stacked:true,totals:contractors.map(x=>x.total)});

 const workTypes=meetingGroupSummary(rows,'workType',30);
 const workTypeSummary=meetingGroupSummary(rows,'workType',30);
 meetingDrawChart('wmWorkTypeChart','bar',workTypes.map(x=>x.name),
   meetingSummaryDatasets(workTypeSummary,{showClosure:false}),{horizontal:true,legend:true,stacked:true,totals:workTypeSummary.map(x=>x.total)});

 const delayOrder=['من 1 إلى 10 أيام','من 11 إلى 20 يوم','من 21 إلى 30 يوم','من 31 إلى 45 يوم','أكثر من 45 يوم','بدون تأخير (صفر أو أقل)'];
 const delayMap=Object.fromEntries(meetingCountBy(rows,'delayBucket'));
 meetingDrawChart('wmDelayChart','bar',delayOrder,[{
   label:'عدد الأوامر',data:delayOrder.map(x=>delayMap[x]||0),
   backgroundColor:'#f0a126',borderRadius:6,maxBarThickness:42
 }],{});

 // جميع حالات التصاريح تُقرأ ديناميكيًا من القيم الفعلية المختلفة في AO.
 const permitEntries=meetingCountBy(rows,'permitStatus');
 meetingDrawChart('wmPermitChart','doughnut',permitEntries.map(x=>x[0]),[{
   data:permitEntries.map(x=>x[1]),
   backgroundColor:['#18aa7d','#2878e8','#f0a126','#e4505b','#7657d7','#667ca8'],
   borderWidth:2,borderColor:'#fff'
 }],{legend:true});

 const docsEntries=meetingCountBy(executedRows,'docsSubStatus');
 meetingDrawChart('wmDocsChart','doughnut',docsEntries.map(x=>x[0]),[{
   data:docsEntries.map(x=>x[1]),
   backgroundColor:['#2878e8','#e4505b','#18aa7d','#f0a126','#7657d7','#667ca8'],
   borderWidth:2,borderColor:'#fff'
 }],{legend:true});

 renderMeetingSummaryTable('wmOfficeTable',meetingGroupSummary(rows,'office'));
 renderMeetingSummaryTable('wmCategoryTable',meetingGroupSummary(rows,'category'),{showClosure:false});
 renderMeetingSummaryTable('wmContractorTable',meetingGroupSummary(rows,'contractor',30));
 renderMeetingWorkTypeTable('wmWorkTypeTable',rows);
 renderMeetingCountTable('wmPermitTable',permitEntries,total,'حالة التصاريح');
 renderMeetingCountTable('wmDocsTable',docsEntries,executedRows.length,'حالة المستندات');
 renderMeetingDelayTable('wmDelayTable',delayOrder,delayMap,total);
 const stopped=rows.filter(r=>r.executionStatus==='موقوف / محول').length;
 const execEntries=[
   ['أُنجز التنفيذ',completed],
   ['متأخر تنفيذ',delayed],
   ['قيد التنفيذ ضمن المدة',within],
   ['موقوف / محول',stopped],
   ['غير محدد',Math.max(0,total-completed-delayed-within-stopped)]
 ];
 renderMeetingCountTable('wmExecutionTable',execEntries,total,'حالة التنفيذ');

 const delayedRows=rows
   .filter(r=>Number(r.delayDays||0)>0)
   .sort((a,b)=>Number(b.delayDays||0)-Number(a.delayDays||0))
   .slice(0,25);
 renderMeetingDelayedTable(delayedRows);
}

function meetingDrawChart(id,type,labels,datasets,opt={}){
 if(S.charts[id])S.charts[id].destroy();
 const ctx=document.getElementById(id);
 if(!ctx)return;
 S.charts[id]=new Chart(ctx,{
   type,
   data:{labels,datasets},
   options:{
     indexAxis:opt.horizontal?'y':'x',
     responsive:true,
     maintainAspectRatio:false,
     interaction:{mode:'nearest',intersect:true},
     plugins:{
       legend:{
         display:!!opt.legend,
         position:'bottom',
         labels:{font:{family:'Cairo',size:8},boxWidth:9,usePointStyle:true}
       },
       tooltip:{rtl:true,titleFont:{family:'Cairo'},bodyFont:{family:'Cairo'}}
     },
     scales:type==='doughnut'?{}:{
       x:{
         stacked:!!opt.stacked,
         grid:{display:false},
         ticks:{font:{family:'Cairo',size:8},precision:0}
       },
       y:{
         stacked:!!opt.stacked,
         beginAtZero:true,
         grid:{color:'#edf1f6'},
         ticks:{font:{family:'Cairo',size:8},precision:0}
       }
     }
   }
 });
}

function renderMeetingSummaryTable(id,rows,opt={}){
 const root=document.getElementById(id);
 if(!root)return;
 const showClosure=opt.showClosure!==false;
 const closureHead=showClosure?'<th>متأخر إغلاق</th>':'';
 const total=rows.reduce((s,x)=>s+x.total,0);
 const completed=rows.reduce((s,x)=>s+x.completed,0);
 const delayed=rows.reduce((s,x)=>s+x.delayed,0);
 const within=rows.reduce((s,x)=>s+x.within,0);
 const closure=rows.reduce((s,x)=>s+x.closure,0);
 const rate=meetingPct(completed,total);
 root.innerHTML=`<table class="meeting-summary-grid">
   <thead><tr>
     <th>البيان</th><th>إجمالي الأوامر</th><th>أُنجز التنفيذ</th><th>متأخر تنفيذ</th><th>قيد التنفيذ ضمن المدة</th>${closureHead}<th>نسبة الإنجاز</th>
   </tr></thead>
   <tbody>${rows.map(x=>`<tr>
     <td>${esc(x.name)}</td><td>${fmt(x.total)}</td><td>${fmt(x.completed)}</td>
     <td>${fmt(x.delayed)}</td><td>${fmt(x.within)}</td>${showClosure?`<td>${fmt(x.closure)}</td>`:''}
     <td><b class="meeting-rate ${x.rate>=70?'good':x.rate>=50?'mid':'low'}">${x.rate.toFixed(1)}%</b></td>
   </tr>`).join('')}
   <tr class="meeting-total-row"><td>الإجمالي</td><td>${fmt(total)}</td><td>${fmt(completed)}</td><td>${fmt(delayed)}</td><td>${fmt(within)}</td>${showClosure?`<td>${fmt(closure)}</td>`:''}<td><b>${rate.toFixed(1)}%</b></td></tr>
   </tbody>
 </table>`;
}

function renderMeetingCountTable(id,entries,total,label){
 const root=document.getElementById(id);
 if(!root)return;
 root.innerHTML=`<table class="meeting-summary-grid">
   <thead><tr><th>${esc(label)}</th><th>العدد</th><th>النسبة</th></tr></thead>
   <tbody>
   ${entries.map(([name,count])=>`<tr><td>${esc(name)}</td><td>${fmt(count)}</td><td>${meetingPct(count,total).toFixed(1)}%</td></tr>`).join('')}
   <tr class="meeting-total-row"><td>الإجمالي</td><td>${fmt(total)}</td><td>100.0%</td></tr>
   </tbody>
 </table>`;
}

function renderMeetingDelayTable(id,order,map,total){
 const root=document.getElementById(id);
 if(!root)return;
 root.innerHTML=`<table class="meeting-summary-grid">
   <thead><tr><th>الشريحة</th><th>العدد</th><th>النسبة</th></tr></thead>
   <tbody>
   ${order.map(name=>{const count=Number(map[name]||0);return `<tr><td>${esc(name)}</td><td>${fmt(count)}</td><td>${meetingPct(count,total).toFixed(1)}%</td></tr>`}).join('')}
   <tr class="meeting-total-row"><td>الإجمالي</td><td>${fmt(total)}</td><td>100.0%</td></tr>
   </tbody>
 </table>`;
}

function renderMeetingWorkTypeTable(id,rows){
 const root=document.getElementById(id);
 if(!root)return;
 const groups=new Map();
 rows.forEach(r=>{
   const name=String(r.workType||'غير محدد').trim()||'غير محدد';
   let x=groups.get(name);
   if(!x){x={name,total:0,completed:0,delayed:0,within:0,categories:new Map()};groups.set(name,x)}
   x.total++;
   if(r.completed)x.completed++;
   if(r.delayedExecution)x.delayed++;
   if(r.withinDuration)x.within++;
   const cat=String(r.category||'غير محدد').trim()||'غير محدد';
   x.categories.set(cat,(x.categories.get(cat)||0)+1);
 });
 const data=[...groups.values()].map(x=>{
   const category=[...x.categories.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'غير محدد';
   return {...x,category,rate:meetingPct(x.completed,x.total)};
 }).sort((a,b)=>b.total-a.total);

 const total=data.reduce((s,x)=>s+x.total,0);
 const completed=data.reduce((s,x)=>s+x.completed,0);
 const delayed=data.reduce((s,x)=>s+x.delayed,0);
 const within=data.reduce((s,x)=>s+x.within,0);

 root.innerHTML=`<table class="meeting-summary-grid">
   <thead><tr><th>نوع العمل</th><th>فئة العمل</th><th>إجمالي الأوامر</th><th>أُنجز التنفيذ</th><th>متأخر تنفيذ</th><th>قيد التنفيذ ضمن المدة</th><th>نسبة الإنجاز</th></tr></thead>
   <tbody>
   ${data.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.category)}</td><td>${fmt(x.total)}</td><td>${fmt(x.completed)}</td><td>${fmt(x.delayed)}</td><td>${fmt(x.within)}</td><td><b class="meeting-rate ${x.rate>=70?'good':x.rate>=50?'mid':'low'}">${x.rate.toFixed(1)}%</b></td></tr>`).join('')}
   <tr class="meeting-total-row"><td>الإجمالي</td><td>—</td><td>${fmt(total)}</td><td>${fmt(completed)}</td><td>${fmt(delayed)}</td><td>${fmt(within)}</td><td><b>${meetingPct(completed,total).toFixed(1)}%</b></td></tr>
   </tbody>
 </table>`;
}

function renderMeetingDelayedTable(rows){
 const root=document.getElementById('wmDelayedTable');
 if(!root)return;
 root.innerHTML=`<table class="meeting-summary-grid">
   <thead><tr><th>أمر العمل</th><th>جهة التنفيذ</th><th>المقاول</th><th>نوع العمل</th><th>أيام التأخير</th><th>الحالة</th></tr></thead>
   <tbody>${rows.map(r=>`<tr>
     <td>${esc(r.workOrder)}</td><td>${esc(r.office)}</td><td>${esc(r.contractor)}</td>
     <td>${esc(r.workType)}</td><td><b class="meeting-delay-days">${fmt(r.delayDays)}</b></td>
     <td>${esc(r.executionStatus)}</td>
   </tr>`).join('')}</tbody>
 </table>`;
}

function loadPagePayload(p){
 S.page=p;S.raw=p.rows||[];S.columns=p.columns||[];S.filterKeys=p.filterKeys||[];
 configurePageFilters();applyFilters();
}

function renderMasterKpis(arr){
 const root=document.getElementById('masterKpis');

 const order=[
   'grp-work',
   'grp-type',
   'grp-delay',
   'grp-violations',
   'grp-attachments',
   'grp-resources',
   'grp-emergency',
   'grp-tasks',
   'grp-finance',
   'grp-other'
 ];

 const titles={
   'grp-work':'أوامر العمل والتنفيذ',
   'grp-type':'أنواع الأعمال',
   'grp-delay':'التأخيرات والمتابعة',
   'grp-violations':'المخالفات والغرامات',
   'grp-attachments':'المرفقات',
   'grp-resources':'الموارد',
   'grp-emergency':'الطوارئ',
   'grp-tasks':'المهام والإفادات',
   'grp-finance':'المؤشرات المالية',
   'grp-other':'مؤشرات أخرى'
 };

 const groups={};
 const hiddenMasterLabels=new Set([
   'المهام والإفادات',
   'مهام معالجة',
   'مهندسون مسؤولون',
   'مرفقات مرفوعة',
   'مرفقات غير مكتملة'
 ]);

 arr
   .filter(k=>!hiddenMasterLabels.has(String(k.label||'').trim()))
   .forEach(k=>{
     let g=kpiGroupClass(k);

     // المقاولون النشطون يظهر مع أول مجموعة في الرئيسية.
     if(String(k.label||'').trim()==='مقاولون نشطون') g='grp-work';

     (groups[g]||(groups[g]=[])).push(k);
   });

 root.innerHTML=order
   .filter(g=>groups[g]&&groups[g].length)
   .map(g=>`
     <section class="kpi-group-row ${g}">
       <div class="kpi-group-label">${esc(titles[g]||'')}</div>
       <div class="kpi-group-cards">
         ${groups[g].map(k=>`
           <article class="master-card ${g}" data-page="${esc(k.page)}">
             <span>${esc(k.label)}</span>
             <strong>${formatKpi(k)}</strong>
             <small>${k.sub?esc(String(k.sub)):'&nbsp;'}</small>
           </article>`).join('')}
       </div>
     </section>`).join('');

 root.querySelectorAll('.master-card').forEach(c=>c.onclick=()=>openPage(c.dataset.page));
}
function configureMasterFilters(){
 const defs=[['region','الإدارة'],['section','القسم'],['contractor','المقاول'],['engineer','المهندس'],['status','الحالة']];
 setupInteractiveFilters(defs,S.masterRows,true,false);
}

function configurePageFilters(){
 // جميع الفلاتر المعرفة لكل تاب تعمل كتفاعلية مترابطة.
 const defs=(S.filterKeys||[]).slice(0,5).map(k=>[k,LABELS[k]||k]);
 setupInteractiveFilters(defs,S.raw,false,true);
}

function setupInteractiveFilters(defs,rows,isMaster,resetValues){
 for(let i=0;i<5;i++){
   const box=document.getElementById('f'+(i+1)), lab=document.getElementById('fl'+(i+1));
   if(!box||!lab)continue;
   const d=defs[i];

   if(resetValues) box.value='';

   if(!d){
     box.parentElement.style.display='none';
     box.dataset.key='';
     box.innerHTML='<option value="">الكل</option>';
     continue;
   }

   box.parentElement.style.display='block';
   box.dataset.key=d[0];
   box.dataset.master=isMaster?'1':'0';
   lab.textContent=d[1];
 }
 rebuildFilterOptions(rows,isMaster);
}

function currentSelections(){
 const out={};
 for(let i=1;i<=5;i++){
   const s=document.getElementById('f'+i);
   if(s.parentElement.style.display==='none'||!s.dataset.key)continue;
   out[s.dataset.key]=s.value||'';
 }
 return out;
}

function rowMatchesSelections(row,selections,skipKey){
 for(const [k,v] of Object.entries(selections)){
   if(k===skipKey||!v)continue;
   if(String(row[k]||'')!==v)return false;
 }
 return true;
}

function rebuildFilterOptions(rows,isMaster){
 const selections=currentSelections();

 for(let i=1;i<=5;i++){
   const s=document.getElementById('f'+i);
   if(s.parentElement.style.display==='none'||!s.dataset.key)continue;

   const key=s.dataset.key;
   const current=selections[key]||'';

   // كل فلتر يعرض فقط القيم الممكنة وفق اختيارات الفلاتر الأخرى
   const compatible=rows.filter(r=>rowMatchesSelections(r,selections,key));
   const options=unique(compatible.map(r=>r[key]));

   s.innerHTML='<option value="">الكل</option>';
   options.forEach(v=>{
     const o=document.createElement('option');
     o.value=v;o.textContent=v;s.appendChild(o);
   });

   // الحفاظ على الاختيار إذا ما زال صالحًا
   if(current && options.includes(current)) s.value=current;
   else if(current) s.value='';
 }
 updateFilterVisualState();
}

function updateFilterVisualState(){
 let active=0;
 for(let i=1;i<=5;i++){
   const s=document.getElementById('f'+i);
   const wrap=s.parentElement;
   const on=!!s.value;
   wrap.classList.toggle('active-filter',on);
   if(on)active++;
 }
 const clear=document.getElementById('clearFilters');
 clear.textContent=active?`مسح الفلاتر (${active})`:'مسح الفلاتر';
 clear.classList.toggle('has-active',active>0);
}


/* =========================================================
   V2.2.32 — POWER BI STYLE CHART CROSS-FILTERS
   كل تاب يحتفظ بفلاتر الشارت الخاصة به بشكل مستقل.
   ========================================================= */

function chartFilterStore(scope){
  scope=scope||S.current||'master';
  if(!S.chartFilters[scope]) S.chartFilters[scope]={};
  return S.chartFilters[scope];
}

function chartFilterLabel(filter){
  if(!filter)return '';
  return `${filter.label||filter.field}: ${filter.displayValue||filter.value}`;
}

function monthKeyFromValue(v){
  const d=parseDashboardDate(v);
  if(!d)return '';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}

function rowMatchesChartFilter(row,filter){
  if(!filter)return true;

  if(filter.mode==='month'){
    return monthKeyFromValue(row[filter.field])===filter.value;
  }

  if(filter.mode==='not-completed'){
    return !exactStatus(row[filter.field],'تم التنفيذ');
  }

  if(filter.mode==='blank'){
    return !String(row[filter.field]??'').trim();
  }

  if(filter.mode==='emergency-archive-stage'){
    if(!emergencyIsDone(row))return false;
    const archive=normalizeEmergencyStage(row.archive);
    const notReceived=normalizeEmergencyStage('لم يستلم من المقاول');
    if(filter.value==='__received__')return archive!==notReceived;
    if(filter.value==='__blank__')return !archive;
    return archive===normalizeEmergencyStage(filter.value);
  }

  if(filter.mode==='emergency-type-description'){
    try{
      const [type,description]=JSON.parse(filter.value);
      return exactStatus(row.emergencyType,type) &&
        cleanEmergencyTreeValue(row.description)===cleanEmergencyTreeValue(description);
    }catch(e){
      return false;
    }
  }

  return String(row[filter.field]??'').trim()===String(filter.value??'').trim();
}

function applyChartFilters(rows,excludeId,scope){
  const store=chartFilterStore(scope);
  const filters=Object.entries(store)
    .filter(([id,f])=>id!==excludeId && f);

  if(!filters.length)return rows.slice();

  return rows.filter(row=>{
    for(const [,f] of filters){
      if(!rowMatchesChartFilter(row,f))return false;
    }
    return true;
  });
}

function toggleChartFilter(filterId,field,value,label,mode,displayValue){
  const scope=S.current||'master';
  const store=chartFilterStore(scope);
  const current=store[filterId];

  const normalized=String(value??'').trim();
  const same=current &&
    current.field===field &&
    String(current.value??'').trim()===normalized &&
    (current.mode||'exact')===(mode||'exact');

  if(same){
    delete store[filterId];
  }else{
    store[filterId]={
      field,
      value:normalized,
      label:label||LABELS[field]||field,
      mode:mode||'exact',
      displayValue:displayValue||normalized
    };
  }

  renderChartFilterSummary();

  if(scope==='master')applyMasterFilters();
  else applyFilters();
}

function clearChartFilters(scope){
  scope=scope||S.current||'master';
  S.chartFilters[scope]={};
  renderChartFilterSummary();
}

function renderChartFilterSummary(){
  const bar=document.getElementById('filterBar');
  if(!bar)return;

  let wrap=document.getElementById('chartFilterSummary');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='chartFilterSummary';
    wrap.className='chart-filter-summary';
    bar.appendChild(wrap);
  }

  const store=chartFilterStore(S.current);
  const entries=Object.entries(store).filter(([,f])=>f);

  if(!entries.length){
    wrap.innerHTML='';
    wrap.classList.remove('show');
    return;
  }

  wrap.classList.add('show');
  wrap.innerHTML=`
    <div class="chart-filter-summary-title">تصفية من الشارتات</div>
    <div class="chart-filter-chips">
      ${entries.map(([id,f])=>`
        <button class="chart-filter-chip" data-chart-filter="${esc(id)}" title="اضغط لإلغاء هذا الفلتر">
          <span>${esc(chartFilterLabel(f))}</span><b>×</b>
        </button>`).join('')}
      <button class="chart-filter-clear" type="button">مسح فلاتر الشارت</button>
    </div>`;

  wrap.querySelectorAll('.chart-filter-chip').forEach(btn=>{
    btn.onclick=()=>{
      delete chartFilterStore(S.current)[btn.dataset.chartFilter];
      renderChartFilterSummary();
      if(S.current==='master')applyMasterFilters();else applyFilters();
    };
  });

  const clear=wrap.querySelector('.chart-filter-clear');
  if(clear)clear.onclick=()=>{
    clearChartFilters(S.current);
    if(S.current==='master')applyMasterFilters();else applyFilters();
  };
}

function activeChartFilter(filterId,scope){
  return chartFilterStore(scope||S.current)[filterId]||null;
}

function selectedChartColors(filterId,labels,baseColors,scope){
  const active=activeChartFilter(filterId,scope);
  if(!active)return labels.map((_,i)=>baseColors[i%baseColors.length]);

  return labels.map((label,i)=>{
    const selected=String(label)===String(active.displayValue||active.value);
    if(selected)return baseColors[i%baseColors.length];
    return 'rgba(190,198,210,.32)';
  });
}

function applyFilters(){
 if(S.current==='master') return applyMasterFilters();

 const q=document.getElementById('globalSearch').value.trim().toLowerCase();
 const selections=currentSelections();

 const base=S.raw.filter(r=>{
   if(!rowMatchesSelections(r,selections,''))return false;
   return !q||(r._search||'').includes(q);
 });

 S.pageBaseRows=base;
 S.filtered=applyChartFilters(base,null,S.current);

 // السلايسرز تتفاعل أيضًا مع اختيارات الشارتات.
 const chartFilteredRaw=applyChartFilters(S.raw,null,S.current);
 rebuildFilterOptions(chartFilteredRaw,false);

 renderChartFilterSummary();
 renderDataPage();
}

function applyMasterFilters(){
 const q=document.getElementById('globalSearch').value.trim().toLowerCase();
 const selections=currentSelections();

 const base=S.masterRows.filter(r=>{
   if(!rowMatchesSelections(r,selections,''))return false;
   return !q||(r._search||'').includes(q);
 });

 S.masterBaseRows=base;
 const rows=applyChartFilters(base,null,'master');

 const chartFilteredRaw=applyChartFilters(S.masterRows,null,'master');
 rebuildFilterOptions(chartFilteredRaw,true);

 renderChartFilterSummary();
 renderInteractiveMasterKpis(rows);

 // كل شارت يستثني فلتره الذاتي حتى تبقى باقي النقاط مرئية مثل Power BI.
 renderMonthlyAssignmentChart(applyChartFilters(base,'monthlyAssignmentChart','master'));
 renderWorkOrderTypeChart(applyChartFilters(base,'workOrderTypeChart','master'));
 renderMasterCharts(base);
 renderMasterTable(rows);
}

function renderInteractiveMasterKpis(rows){
 // المؤشرات المرتبطة مباشرة بورقة أوامر العمل تتغير فورًا مع الفلاتر.
 const total=rows.length;
 const completed=rows.filter(r=>exactStatus(r.status,'تم التنفيذ')).length;
 const projects=rows.filter(r=>String(r.section||'').trim()==='مشاريع').length;
 const connections=rows.filter(r=>String(r.section||'').trim()==='توصيلات').length;
 const operations=rows.filter(r=>has(r.section,'عمليات')).length;
 const contractors=unique(rows.map(r=>r.contractor)).length;
 const engineers=unique(rows.map(r=>r.engineer)).length;
 const hasDelayData=rows.some(r=>Object.prototype.hasOwnProperty.call(r,'delay'));
 const simple=hasDelayData?rows.filter(r=>has(r.delay,'تأخير بسيط')).length:0;
 const medium=hasDelayData?rows.filter(r=>has(r.delay,'تأخير متوسط')).length:0;
 const high=hasDelayData?rows.filter(r=>has(r.delay,'تأخير شديد')).length:0;
 const near=hasDelayData?rows.filter(r=>has(r.delay,'أوشكت')).length:0;

 const live=[
   {label:'إجمالي أوامر العمل',value:total,page:'workorders',tone:'primary'},
   {label:'تم التنفيذ',value:completed,page:'workorders',tone:'success',sub:total?((completed/total)*100).toFixed(1)+'%':''},
   {label:'غير مكتمل',value:Math.max(0,total-completed),page:'workorders',tone:'warning'},
   {label:'نسبة الإنجاز',value:total?completed/total*100:0,page:'workorders',tone:'success',sub:'من النتائج المفلترة',isPercent:true},
   {label:'المشاريع',value:projects,page:'projects',tone:'primary'},
   {label:'التوصيلات',value:connections,page:'connections',tone:'primary'},
   {label:'العمليات',value:operations,page:'operations',tone:'purple'},
   {label:'مقاولون نشطون',value:contractors,page:'workorders',tone:'primary'},
   {label:'مهندسون مسؤولون',value:engineers,page:'workorders',tone:'primary'}
 ];

 if(hasDelayData){
   live.splice(7,0,
     {label:'تأخير بسيط',value:simple,page:'workorders',tone:'warning'},
     {label:'تأخير متوسط',value:medium,page:'workorders',tone:'orange'},
     {label:'تأخير شديد',value:high,page:'workorders',tone:'danger'},
     {label:'أوشكت المدة',value:near,page:'workorders',tone:'warning'}
   );
 }

 // الاحتفاظ بالمؤشرات الثانوية التي تأتي من أوراق أخرى بدون تغيير.
 const dynamicLabels=new Set(live.map(x=>x.label));
 const secondary=(S.masterKpis||[]).filter(k=>!dynamicLabels.has(k.label));
 renderMasterKpis(live.concat(secondary));
}

function renderMonthlyAssignmentChart(rows){
 const bucket={};

 rows.forEach(r=>{
   const d=parseSheetDate(r.assignedDate);
   if(!d)return;

   const y=d.getFullYear();
   const m=d.getMonth();
   const key=`${y}-${String(m+1).padStart(2,'0')}`;

   if(!bucket[key]){
     bucket[key]={year:y,month:m,count:0,value:0};
   }
   bucket[key].count++;
   bucket[key].value+=num(r.value);
 });

 // الأحدث أولًا مثل الداشبورد المرجعي.
 const data=Object.entries(bucket)
   .sort((a,b)=>b[0].localeCompare(a[0]))
   .slice(0,36)
   .map(([,v])=>v);

 const monthNames=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
 const labels=data.map(x=>monthNames[x.month]+' '+x.year);
 const values=data.map(x=>x.value);
 const counts=data.map(x=>x.count);

 if(S.charts.monthlyAssignmentChart)S.charts.monthlyAssignmentChart.destroy();

 const ctx=document.getElementById('monthlyAssignmentChart');
 if(!ctx)return;

 S.charts.monthlyAssignmentChart=new Chart(ctx,{
   data:{
     labels,
     datasets:[
       {
         type:'bar',
         label:'قيمة الإسناد',
         data:values,
         yAxisID:'yValue',
         backgroundColor:'rgba(36,119,232,.82)',
         borderRadius:6,
         order:2
       },
       {
         type:'line',
         label:'عدد أوامر العمل',
         data:counts,
         yAxisID:'yCount',
         borderColor:'#f0a126',
         backgroundColor:'#f0a126',
         pointBackgroundColor:'#f0a126',
         pointRadius:3,
         pointHoverRadius:5,
         borderWidth:2,
         tension:.25,
         order:1
       }
     ]
   },
   options:{
     responsive:true,
     maintainAspectRatio:false,
     interaction:{mode:'index',intersect:false},
     onHover:(event,elements)=>{
       const canvas=event.native?.target||ctx;
       canvas.style.cursor=elements.length?'pointer':'default';
     },

     onClick:(event,elements)=>{
       if(!elements.length)return;
       const i=elements[0].index;
       const key=keys[i];
       const display=labels[i];
       toggleChartFilter('monthlyAssignmentChart','assignedDate',key,'شهر الإسناد','month',display);
     },

     plugins:{
       legend:{display:false},
       tooltip:{
         titleFont:{family:'Cairo'},
         bodyFont:{family:'Cairo'},
         callbacks:{
           label:(c)=>{
             if(c.dataset.yAxisID==='yValue') return ' قيمة الإسناد: '+moneyFull(c.raw);
             return ' عدد أوامر العمل: '+fmt(c.raw);
           }
         }
       }
     },
     scales:{
       x:{
         grid:{display:false},
         ticks:{font:{family:'Cairo',size:9},maxRotation:55,minRotation:55}
       },
       yValue:{
         position:'right',
         beginAtZero:true,
         grid:{color:'#edf1f6'},
         ticks:{
           font:{family:'Cairo',size:8},
           callback:v=>compactMoney(v)
         },
         title:{display:true,text:'قيمة أوامر العمل',font:{family:'Cairo',size:9}}
       },
       yCount:{
         position:'left',
         beginAtZero:true,
         grid:{drawOnChartArea:false},
         ticks:{precision:0,font:{family:'Cairo',size:8}},
         title:{display:true,text:'عدد أوامر العمل',font:{family:'Cairo',size:9}}
       }
     }
   }
 });
}

function parseSheetDate(v){
 const s=String(v||'').trim();
 if(!s)return null;

 // yyyy-mm-dd / yyyy/mm/dd
 let m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
 if(m)return validDate(+m[1],+m[2]-1,+m[3]);

 // dd/mm/yyyy أو dd-mm-yyyy
 m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
 if(m)return validDate(+m[3],+m[2]-1,+m[1]);

 // محاولة أخيرة عبر Date
 const d=new Date(s);
 return isNaN(d.getTime())?null:d;
}

function validDate(y,m,d){
 const x=new Date(y,m,d);
 return isNaN(x.getTime())?null:x;
}

function compactMoney(v){
 const n=Number(v||0);
 if(Math.abs(n)>=1000000)return (n/1000000).toFixed(n>=10000000?0:1)+'M';
 if(Math.abs(n)>=1000)return (n/1000).toFixed(n>=100000?0:1)+'K';
 return String(Math.round(n));
}

function moneyFull(v){
 return new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(Number(v||0))+' ر.س';
}


function renderWorkOrderTypeChart(rows){
 const grouped={};

 rows.forEach(r=>{
   const type=String(r.type||'غير محدد').trim()||'غير محدد';

   if(!grouped[type]){
     grouped[type]={count:0,value:0};
   }

   grouped[type].count++;
   grouped[type].value+=num(r.value);
 });

 const data=Object.entries(grouped)
   .map(([type,x])=>({
     type:type,
     count:x.count,
     value:x.value
   }))
   .sort((a,b)=>b.value-a.value || b.count-a.count)
   .slice(0,8);

 const labels=data.map(x=>x.type);
 const values=data.map(x=>x.value);
 const counts=data.map(x=>x.count);

 if(S.charts.workOrderTypeChart){
   S.charts.workOrderTypeChart.destroy();
 }

 const ctx=document.getElementById('workOrderTypeChart');
 if(!ctx)return;

 const wrap=ctx.parentElement;
 if(wrap){
   wrap.style.height=Math.max(300,data.length*52+55)+'px';
 }

 const valueLabelPlugin={
   id:'workOrderTypeLabels',

   afterDatasetsDraw(chart){
     const {ctx,chartArea}=chart;
     const meta=chart.getDatasetMeta(0);

     ctx.save();
     ctx.textBaseline='middle';
     ctx.textAlign='left';

     meta.data.forEach((bar,i)=>{
       const y=bar.y;
       const labelX=Math.min(bar.x+12,chartArea.right+8);

       // القيمة والعدد في نفس السطر أمام نهاية العمود
       ctx.font='700 11px Cairo';
       ctx.fillStyle='#14213d';
       const valueText=compactMoney(values[i]);
       ctx.fillText(valueText,labelX,y);

       const valueWidth=ctx.measureText(valueText).width;

       ctx.fillStyle='#b8c2d0';
       ctx.font='600 10px Cairo';
       ctx.fillText('|',labelX+valueWidth+8,y);

       const sepWidth=ctx.measureText('|').width;

       ctx.fillStyle='#f0a126';
       ctx.font='700 11px Cairo';
       ctx.fillText(
         fmt(counts[i]),
         labelX+valueWidth+sepWidth+16,
         y
       );
     });

     ctx.restore();
   }
 };

 const barColors=[
   '#171c86',
   '#222996',
   '#3038a6',
   '#4149b4',
   '#555dc1',
   '#686fca',
   '#7a80d2',
   '#8b91d9'
 ];

 S.charts.workOrderTypeChart=new Chart(ctx,{
   type:'bar',

   data:{
     labels:labels,

     datasets:[{
       label:'قيمة أوامر العمل',
       data:values,
       backgroundColor:barColors.slice(0,data.length),
       borderWidth:0,
       borderRadius:4,
       borderSkipped:false,
       barPercentage:.72,
       categoryPercentage:.82
     }]
   },

   plugins:[
     valueLabelPlugin
   ],

   options:{
     indexAxis:'y',
     responsive:true,
     maintainAspectRatio:false,

     animation:{
       duration:450
     },

     interaction:{
       mode:'nearest',
       intersect:false
     },

     onHover:(event,elements)=>{
       const canvas=event.native?.target||ctx;
       canvas.style.cursor=elements.length?'pointer':'default';
     },

     onClick:(event,elements)=>{
       if(!elements.length)return;
       const i=elements[0].index;
       toggleChartFilter('workOrderTypeChart','type',labels[i],'نوع أمر العمل','exact',labels[i]);
     },

     layout:{
       padding:{
         top:8,
         right:135,
         bottom:4,
         left:0
       }
     },

     plugins:{
       legend:{
         display:false
       },

       tooltip:{
         rtl:true,
         titleFont:{
           family:'Cairo',
           size:11
         },
         bodyFont:{
           family:'Cairo',
           size:10
         },
         callbacks:{
           title:(items)=>{
             return 'نوع أمر العمل: '+items[0].label;
           },
           label:(c)=>{
             return 'القيمة: '+moneyFull(c.raw);
           },
           afterLabel:(c)=>{
             return 'عدد أوامر العمل: '+fmt(counts[c.dataIndex]);
           }
         }
       }
     },

     scales:{
       x:{
         beginAtZero:true,
         grace:'15%',

         grid:{
           color:'#edf1f6',
           drawBorder:false
         },

         border:{
           display:false
         },

         ticks:{
           font:{
             family:'Cairo',
             size:8
           },
           color:'#7d899d',
           maxTicksLimit:7,
           callback:v=>compactMoney(v)
         }
       },

       y:{
         grid:{
           display:false
         },

         border:{
           display:false
         },

         ticks:{
           autoSkip:false,
           padding:8,
           font:{
             family:'Cairo',
             size:11,
             weight:'600'
           },
           color:'#44546c'
         }
       }
     }
   }
 });
}

function renderMasterCharts(baseRows){
 const statusRows=applyChartFilters(baseRows,'statusChart','master');
 const completed=statusRows.filter(r=>exactStatus(r.status,'تم التنفيذ')).length;
 draw(
   'statusChart','doughnut',
   ['تم التنفيذ','غير مكتمل'],
   [completed,Math.max(0,statusRows.length-completed)],
   'status',
   ['تم التنفيذ','__NOT_COMPLETED__'],
   ['تم التنفيذ','غير مكتمل']
 );

 groupChart('sectionChart','bar',applyChartFilters(baseRows,'sectionChart','master'),'section',8,'section');
 groupChart('regionChart','polarArea',applyChartFilters(baseRows,'regionChart','master'),'region',6,'region');
}
function renderMasterTable(rows){
 document.getElementById('masterCount').textContent=fmt(rows.length)+' نتيجة';
 const cols=[['workOrder','أمر العمل'],['section','القسم'],['region','الإدارة'],['contractor','المقاول'],['engineer','المهندس'],['status','الحالة'],['value','القيمة المالية'],['consultant155','155 الاستشاري'],['contractor155','155 المقاول'],['permitStatus','حالة تصريح بلدي'],['payment','حالة السداد'],['delay','التأخير']];
 document.getElementById('masterTable').innerHTML=tableHtml(rows.slice(0,180),cols);
}


function renderContractorWorkOrdersChart(rows){
 const grouped={};

 rows.forEach(r=>{
   const contractor=String(r.contractor||'غير محدد').trim()||'غير محدد';

   if(!grouped[contractor]){
     grouped[contractor]={count:0,value:0};
   }

   grouped[contractor].count++;
   grouped[contractor].value+=num(r.value);
 });

 // عرض جميع المقاولين المتاحين بدون Top N.
 const data=Object.entries(grouped)
   .map(([contractor,x])=>({
     contractor,
     count:x.count,
     value:x.value
   }))
   .sort((a,b)=>b.value-a.value || b.count-a.count);

 const labels=data.map(x=>x.contractor);
 const values=data.map(x=>x.value);
 const counts=data.map(x=>x.count);

 if(S.charts.contractorWorkOrdersChart){
   S.charts.contractorWorkOrdersChart.destroy();
 }

 const ctx=document.getElementById('contractorWorkOrdersChart');
 if(!ctx)return;

 // ارتفاع ديناميكي حتى تظهر جميع أسماء المقاولين بدون تزاحم.
 const wrap=document.getElementById('contractorWorkOrdersChartWrap');
 if(wrap){
   wrap.style.height=Math.max(320,data.length*52+60)+'px';
 }

 const labelPlugin={
   id:'contractorValueCountLabels',

   afterDatasetsDraw(chart){
     const {ctx,chartArea}=chart;
     const meta=chart.getDatasetMeta(0);

     ctx.save();
     ctx.textBaseline='middle';
     ctx.textAlign='left';

     meta.data.forEach((bar,i)=>{
       const y=bar.y;
       const x=Math.min(bar.x+12,chartArea.right+8);

       ctx.font='700 10px Cairo';
       ctx.fillStyle='#14213d';

       const valueText=compactMoney(values[i]);
       ctx.fillText(valueText,x,y);

       const valueWidth=ctx.measureText(valueText).width;

       ctx.font='600 9px Cairo';
       ctx.fillStyle='#b7c0ce';
       ctx.fillText('|',x+valueWidth+8,y);

       const separatorWidth=ctx.measureText('|').width;

       ctx.font='700 10px Cairo';
       ctx.fillStyle='#f0a126';
       ctx.fillText(
         fmt(counts[i]),
         x+valueWidth+separatorWidth+16,
         y
       );
     });

     ctx.restore();
   }
 };

 const colors=data.map((_,i)=>{
   const palette=[
     '#171c86','#222996','#3038a6','#4149b4',
     '#555dc1','#686fca','#7a80d2','#8b91d9',
     '#969bdc','#a5a9e2','#b4b8e8','#c0c4ed'
   ];
   return palette[Math.min(i,palette.length-1)];
 });

 S.charts.contractorWorkOrdersChart=new Chart(ctx,{
   type:'bar',

   data:{
     labels,
     datasets:[{
       label:'قيمة أوامر العمل',
       data:values,
       backgroundColor:colors,
       borderWidth:0,
       borderRadius:4,
       borderSkipped:false,
       barPercentage:.72,
       categoryPercentage:.82
     }]
   },

   plugins:[labelPlugin],

   options:{
     indexAxis:'y',
     responsive:true,
     maintainAspectRatio:false,

     interaction:{
       mode:'nearest',
       intersect:false
     },

     onHover:(event,elements)=>{
       const canvas=event.native?.target||ctx;
       canvas.style.cursor=elements.length?'pointer':'default';
     },

     onClick:(event,elements)=>{
       if(!elements.length)return;
       const i=elements[0].index;
       toggleChartFilter('contractorWorkOrdersChart','contractor',labels[i],'المقاول','exact',labels[i]);
     },

     animation:{
       duration:400
     },

     layout:{
       padding:{
         top:8,
         right:145,
         bottom:4,
         left:0
       }
     },

     plugins:{
       legend:{display:false},

       tooltip:{
         rtl:true,
         titleFont:{family:'Cairo',size:11},
         bodyFont:{family:'Cairo',size:10},
         callbacks:{
           title:(items)=>items[0].label,
           label:(c)=>'القيمة: '+moneyFull(c.raw),
           afterLabel:(c)=>'عدد أوامر العمل: '+fmt(counts[c.dataIndex])
         }
       }
     },

     scales:{
       x:{
         beginAtZero:true,
         grace:'16%',

         grid:{
           color:'#edf1f6',
           drawBorder:false
         },

         border:{display:false},

         ticks:{
           font:{family:'Cairo',size:8},
           color:'#7d899d',
           maxTicksLimit:7,
           callback:v=>compactMoney(v)
         }
       },

       y:{
         grid:{display:false},
         border:{display:false},

         ticks:{
           autoSkip:false,
           padding:8,
           font:{
             family:'Cairo',
             size:9,
             weight:'600'
           },
           color:'#44546c',
           callback:function(value){
             const label=this.getLabelForValue(value);
             return label.length>42 ? label.slice(0,42)+'…' : label;
           }
         }
       }
     }
   }
 });
}



function emergencyIsDone(row){
  return exactStatus(row.status,'منجز');
}

function emergencyStatusValue(row){
  const s=String(row.status||'').replace(/\s+/g,' ').trim();
  return s || 'غير محدد';
}

function normalizeEmergencyStage(value){
  return String(value||'')
    .replace(/[\u064B-\u065F\u0670]/g,'')
    .replace(/ـ/g,'')
    .replace(/ال\s*PDC/gi,'PDC')
    .replace(/^معاد[هة]?(?=\s*ل)/,'معاد')
    .replace(/\s+/g,'')
    .toLocaleLowerCase('ar');
}

function cleanEmergencyTreeValue(value){
  return String(value||'').replace(/\s+/g,' ').trim();
}

function renderEmergencyDashboard(baseRows){
  renderEmergencyStatusTree(
    applyChartFilters(baseRows,'emergencyStatusTree','emergency')
  );

  renderEmergencyTypeTree(
    applyChartFilters(baseRows,'emergencyTypeTree','emergency')
  );

  renderEmergencyMonthlyChart(
    applyChartFilters(baseRows,'emergencyMonthlyChart','emergency')
  );

  renderEmergencyCategoricalChart(
    'emergencyStatusChart','doughnut',
    applyChartFilters(baseRows,'emergencyStatusChart','emergency'),
    'status',10,'حالة التنفيذ',false
  );

  renderEmergencyCategoricalChart(
    'emergencyCircuitChart','doughnut',
    applyChartFilters(baseRows,'emergencyCircuitChart','emergency'),
    'circuit',10,'الدائرة',false
  );

    renderEmergencyCategoricalChart('emergencyClassificationChart','doughnut',applyChartFilters(baseRows,'emergencyClassificationChart','emergency'),'classification',15,'تصنيف العمل',false);
  renderEmergencyCategoricalChart('emergencyWorkTypeChart','bar',applyChartFilters(baseRows,'emergencyWorkTypeChart','emergency'),'type',20,'النوع',true);
  renderEmergencyCategoricalChart('emergencyAdministrationChart','doughnut',applyChartFilters(baseRows,'emergencyAdministrationChart','emergency'),'administration',15,'الإدارة',false);
  renderEmergencyCategoricalChart('emergencySectionChart','bar',applyChartFilters(baseRows,'emergencySectionChart','emergency'),'section',20,'القسم',true);
  renderEmergencyCategoricalChart('emergencyScheduleTypeChart','doughnut',applyChartFilters(baseRows,'emergencyScheduleTypeChart','emergency'),'emergencyType',10,'مجدول / طارئ',false);
  renderEmergencyCategoricalChart('emergencyConsultantChart','bar',applyChartFilters(baseRows,'emergencyConsultantChart','emergency'),'consultant',20,'الاستشاري',true);
  renderEmergencyCategoricalChart('emergencyEngineerChart','bar',applyChartFilters(baseRows,'emergencyEngineerChart','emergency'),'engineer',30,'اسم الاستشاري',true);
  renderEmergencyCategoricalChart('emergencyArchiveChart','bar',applyChartFilters(baseRows,'emergencyArchiveChart','emergency'),'archive',20,'حالة المستندات',true);

renderEmergencyCategoricalChart(
    'emergencyFaultChart','bar',
    applyChartFilters(baseRows,'emergencyFaultChart','emergency'),
    'description',20,'وصف العمل',true
  );

  renderEmergencyCategoricalChart(
    'emergencyContractorChart','bar',
    applyChartFilters(baseRows,'emergencyContractorChart','emergency'),
    'contractor',30,'المقاول',true
  );

  renderEmergencySummaryTable(
    'emergencyLocationTable',
    applyChartFilters(baseRows,'emergencyLocationTable','emergency'),
    'location',
    'الحي / الموقع'
  );

  renderEmergencySummaryTable(
    'emergencyContractorTable',
    applyChartFilters(baseRows,'emergencyContractorTable','emergency'),
    'contractor',
    'المقاول'
  );
  installEmergencyHelpV2();
}



/* =========================================================
   EMERGENCY HELP V2
   Calculation/source explanations for emergency dashboard
   ========================================================= */

function installEmergencyHelpV2(){

  if(S.current !== 'emergency') return;

  const page = document.getElementById('dataPage');
  if(!page) return;

  /* ---------- CSS ---------- */

  if(!document.getElementById('emergencyHelpV2Style')){

    const style = document.createElement('style');

    style.id = 'emergencyHelpV2Style';

    style.textContent = [
      '.em-help-host{position:relative!important}',

      '.em-help-btn{',
        'position:absolute;',
        'top:8px;',
        'left:8px;',
        'z-index:50;',
        'width:22px;',
        'height:22px;',
        'border-radius:50%;',
        'border:1px solid #e9a126;',
        'background:#fff;',
        'color:#c77b00;',
        'font:700 12px Arial,sans-serif;',
        'display:flex;',
        'align-items:center;',
        'justify-content:center;',
        'cursor:pointer;',
        'box-shadow:0 2px 7px rgba(30,50,80,.13);',
        'padding:0;',
      '}',

      '.em-help-btn:hover{',
        'background:#fff6e6;',
        'transform:scale(1.08);',
      '}',

      '.em-help-overlay{',
        'position:fixed;',
        'inset:0;',
        'z-index:99998;',
        'background:rgba(15,30,55,.28);',
        'display:flex;',
        'align-items:center;',
        'justify-content:center;',
        'padding:20px;',
      '}',

      '.em-help-box{',
        'width:min(560px,94vw);',
        'background:#fff;',
        'border-radius:18px;',
        'padding:24px;',
        'box-shadow:0 18px 60px rgba(20,40,70,.25);',
        'direction:rtl;',
        'text-align:right;',
        'font-family:Cairo,Arial,sans-serif;',
        'position:relative;',
      '}',

      '.em-help-box h3{',
        'margin:0 0 14px;',
        'padding-left:32px;',
        'font-size:18px;',
        'color:#172542;',
      '}',

      '.em-help-box p{',
        'margin:0;',
        'white-space:pre-line;',
        'line-height:1.9;',
        'font-size:13px;',
        'color:#52627d;',
      '}',

      '.em-help-close{',
        'position:absolute;',
        'top:13px;',
        'left:13px;',
        'width:30px;',
        'height:30px;',
        'border:0;',
        'border-radius:50%;',
        'background:#f2f5f9;',
        'cursor:pointer;',
        'font-size:18px;',
        'color:#52627d;',
      '}',

      '@media print{.em-help-btn{display:none!important}}'

    ].join('');

    document.head.appendChild(style);
  }


  /* ---------- Popup ---------- */

  function showHelp(title,text){

    document.querySelector('.em-help-overlay')?.remove();

    const overlay = document.createElement('div');

    overlay.className = 'em-help-overlay';

    const box = document.createElement('div');

    box.className = 'em-help-box';

    const close = document.createElement('button');

    close.type = 'button';
    close.className = 'em-help-close';
    close.textContent = '×';

    const h = document.createElement('h3');
    h.textContent = title;

    const p = document.createElement('p');
    p.textContent = text;

    close.onclick = () => overlay.remove();

    overlay.onclick = e => {
      if(e.target === overlay) overlay.remove();
    };

    box.append(close,h,p);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }


  /* ---------- Generic button ---------- */

  function addButton(host,title,text){

    if(!host) return;

    if(host.querySelector(':scope > .em-help-btn')) return;

    host.classList.add('em-help-host');

    const b = document.createElement('button');

    b.type = 'button';
    b.className = 'em-help-btn';
    b.textContent = 'i';

    b.title = 'شرح طريقة الاحتساب';

    b.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      showHelp(title,text);
    };

    host.appendChild(b);
  }


  /* =====================================================
     KPI CARDS
     ===================================================== */

  const kpiRules = [

    [
      'مسند اليوم',
      'المصدر: العمود D — تاريخ الإسناد.\nالحساب: عدد السجلات التي يطابق تاريخ إسنادها تاريخ اليوم.'
    ],

    [
      'مسند هذا الشهر',
      'المصدر: العمود D — تاريخ الإسناد.\nالحساب: عدد السجلات التي يقع تاريخ إسنادها في الشهر والسنة الحاليين.'
    ],

    [
      'تمت مباشرة العمل',
      'المصدر: العمود E — تاريخ مباشرة العمل.\nالحساب: عدد السجلات التي تحتوي على تاريخ مباشرة عمل.\nالنسبة: العدد ÷ إجمالي الإشعارات × 100.'
    ],

    [
      'لم تبدأ بعد',
      'المصدر: العمود E — تاريخ مباشرة العمل.\nالحساب: عدد السجلات التي لا تحتوي على تاريخ مباشرة عمل.'
    ],

    [
      'لها تاريخ انتهاء',
      'المصدر: العمود F — تاريخ انتهاء العمل.\nالحساب: عدد السجلات التي تحتوي على تاريخ انتهاء.\nالنسبة: العدد ÷ إجمالي الإشعارات × 100.'
    ],

    [
      'إنجاز في نفس يوم الإسناد',
      'المصدر: D تاريخ الإسناد + F تاريخ انتهاء العمل.\nالحساب: عدد السجلات التي يكون فيها التاريخان في نفس اليوم.\nالنسبة: العدد ÷ إجمالي الإشعارات × 100.'
    ],

    [
      'متوسط زمن المباشرة',
      'المصدر: D تاريخ الإسناد → E تاريخ مباشرة العمل.\nالحساب: متوسط الفرق بين التاريخين.\nيتم احتساب السجلات ذات التاريخين الصالحين فقط، مع استبعاد الفرق السالب.\n«سجل صالح» = عدد السجلات الداخلة فعليًا في المتوسط.'
    ],

    [
      'متوسط مدة التنفيذ',
      'المصدر: E تاريخ مباشرة العمل → F تاريخ انتهاء العمل.\nالحساب: متوسط الفرق بين التاريخين.\nيتم احتساب السجلات ذات التاريخين الصالحين فقط، مع استبعاد الفرق السالب.\n«سجل صالح» = عدد السجلات الداخلة فعليًا في المتوسط.'
    ],

    [
      'متوسط الإسناد حتى الانتهاء',
      'المصدر: D تاريخ الإسناد → F تاريخ انتهاء العمل.\nالحساب: متوسط المدة الكلية من الإسناد حتى الانتهاء.\nيتم احتساب السجلات ذات التاريخين الصالحين فقط، مع استبعاد الفرق السالب.'
    ],

    [
      'إجمالي الإشعارات',
      'الحساب: إجمالي سجلات إشعارات الطوارئ بعد تطبيق الفلاتر الحالية.'
    ],

    [
      'منجز',
      'المصدر: العمود U — حالة التنفيذ.\nالحساب: عدد السجلات التي حالتها «منجز».'
    ],

    [
      'جاري التنفيذ',
      'المصدر: العمود U — حالة التنفيذ.\nالحساب: عدد السجلات التي حالتها «جاري التنفيذ».'
    ],

    [
      'لم يتم البدء',
      'المصدر: العمود U — حالة التنفيذ.\nالحساب: عدد السجلات التي حالتها «لم يتم البدء».'
    ],

    [
      'نسبة الإنجاز',
      'المصدر: العمود U — حالة التنفيذ.\nالحساب: عدد السجلات المنجزة ÷ إجمالي الإشعارات × 100.'
    ],

    [
      'طارئ',
      'المصدر: العمود M — مجدول / طارئ.\nالحساب: عدد السجلات المصنفة «طارئ».'
    ],

    [
      'مجدول',
      'المصدر: العمود M — مجدول / طارئ.\nالحساب: عدد السجلات المصنفة «مجدول».'
    ],

    [
      'نسبة الأرشفة',
      'المصدر: العمود V — حالة المستندات.\nالحساب: عدد السجلات المصنفة كمؤرشفة ÷ إجمالي الإشعارات × 100.'
    ]

  ];


  page.querySelectorAll('#pageKpis article').forEach(card => {

    const text = String(card.innerText || '')
      .replace(/\s+/g,' ')
      .trim();

    const rule = kpiRules.find(([name]) => text.includes(name));

    if(rule){
      addButton(card,rule[0],rule[1]);
    }else{
      addButton(
        card,
        'شرح المؤشر',
        'يتم احتساب هذا المؤشر من بيانات إشعارات الطوارئ بعد تطبيق الفلاتر الحالية.'
      );
    }

  });


  /* =====================================================
     TREE
     ===================================================== */

  addButton(
    document.getElementById('emergencyStatusTree')?.closest('.panel'),
    'مسار إشعارات الطوارئ ودورة المستندات',
    'حالة التنفيذ الرئيسية مصدرها العمود U.\nيتم قراءة جميع الحالات غير الفارغة الموجودة في U تلقائيًا.\n\nفرع «منجز» ينتقل إلى دورة المستندات، ومصدر حالات المستندات هو العمود V.\n\nالنسب داخل حالات التنفيذ محسوبة من إجمالي الإشعارات، بينما نسب دورة المستندات محسوبة من إجمالي السجلات المنجزة.'
  );


  addButton(
    document.getElementById('emergencyTypeTree')?.closest('.panel'),
    'تصنيف الطوارئ ووصف العمل',
    'المستوى الأول مصدره العمود M — مجدول / طارئ.\nالمستوى التالي مصدره العمود G — وصف العمل.\n\nالنسبة في كل فرع من أوصاف العمل محسوبة من إجمالي سجلات النوع نفسه.'
  );


  /* =====================================================
     CHARTS
     ===================================================== */

  const chartRules = {

    emergencyMonthlyChart:
      ['الإشعارات شهريًا',
       'المصدر: العمود D — تاريخ الإسناد.\nيتم تجميع الإشعارات حسب الشهر والسنة من تاريخ الإسناد.'],

    emergencyStatusChart:
      ['حالة التنفيذ',
       'المصدر: العمود U — حالة التنفيذ.\nيعرض عدد السجلات لكل حالة موجودة في العمود.'],

    emergencyCircuitChart:
      ['الدائرة',
       'المصدر: العمود K — الدائرة.\nيتم تجميع وعدّ الإشعارات حسب الدائرة.'],

    emergencyClassificationChart:
      ['تصنيف العمل',
       'المصدر: العمود H — تصنيف العمل.\nيتم تجميع وعدّ الإشعارات حسب تصنيف العمل.'],

    emergencyWorkTypeChart:
      ['النوع',
       'المصدر: العمود I — النوع.\nيتم تجميع وعدّ الإشعارات حسب النوع.'],

    emergencyAdministrationChart:
      ['الإدارة',
       'المصدر: العمود J — الإدارة.\nيتم تجميع وعدّ الإشعارات حسب الإدارة.'],

    emergencySectionChart:
      ['القسم',
       'المصدر: العمود L — القسم.\nيتم تجميع وعدّ الإشعارات حسب القسم.'],

    emergencyScheduleTypeChart:
      ['مجدول / طارئ',
       'المصدر: العمود M.\nيتم تجميع وعدّ الإشعارات حسب قيمة مجدول / طارئ.'],

    emergencyConsultantChart:
      ['الاستشاري',
       'المصدر: العمود O — الاستشاري.\nيتم تجميع وعدّ الإشعارات حسب الجهة الاستشارية.'],

    emergencyEngineerChart:
      ['اسم الاستشاري',
       'المصدر: العمود P — اسم الاستشاري.\nيتم تجميع وعدّ الإشعارات حسب اسم الاستشاري.'],

    emergencyArchiveChart:
      ['حالة المستندات',
       'المصدر: العمود V — حالة المستندات.\nيتم تجميع وعدّ السجلات حسب الحالة الموجودة في V.'],

    emergencyFaultChart:
      ['وصف العمل / الأعطال',
       'المصدر: العمود G — وصف العمل.\nيتم تجميع الأوصاف وترتيبها تنازليًا حسب عدد الإشعارات.'],

    emergencyContractorChart:
      ['المقاول',
       'المصدر: العمود Q — المقاول.\nيتم تجميع وعدّ الإشعارات حسب المقاول.']

  };


  Object.entries(chartRules).forEach(([id,rule]) => {

    const canvas = document.getElementById(id);

    if(!canvas) return;

    const panel = canvas.closest('.panel');

    addButton(panel,rule[0],rule[1]);

  });


  /* =====================================================
     TABLES
     ===================================================== */

  const locationTable = document.getElementById('emergencyLocationTable');

  addButton(
    locationTable?.closest('.panel'),
    'جدول الأعطال حسب الحي / الموقع',
    'المصدر الأساسي: العمود N — الموقع / الحي.\nيتم تجميع جميع السجلات حسب الموقع.\n\nحالات التنفيذ مصدرها العمود U.\nنسبة الإنجاز لكل موقع = عدد حالة «منجز» ÷ إجمالي إشعارات الموقع × 100.'
  );


  const contractorTable = document.getElementById('emergencyContractorTable');

  addButton(
    contractorTable?.closest('.panel'),
    'جدول الأعطال حسب المقاول',
    'المصدر الأساسي: العمود Q — المقاول.\nيتم تجميع جميع السجلات حسب المقاول.\n\nحالات التنفيذ مصدرها العمود U.\nنسبة الإنجاز لكل مقاول = عدد حالة «منجز» ÷ إجمالي إشعارات المقاول × 100.'
  );



}

function renderEmergencyStatusTree(rows,rootTarget='emergencyStatusTree',interactive=true){
  const root=typeof rootTarget==='string'?document.getElementById(rootTarget):rootTarget;
  if(!root)return;
  const uid=interactive?'emergency':'closuresEmergency';

  const total=rows.length;

  // المستوى الرئيسي يقرأ تلقائياً كل القيم غير الفارغة في حقل status.
  const statusCounts=new Map();
  rows.forEach(r=>{
    const label=String(r.status||'').replace(/\s+/g,' ').trim();
    if(label)statusCounts.set(label,(statusCounts.get(label)||0)+1);
  });

  // نحافظ على ترتيب الحالات الأساسية أولاً، ثم أي حالات إضافية تظهر تلقائياً.
  const preferredStatusOrder=['لم يتم البدء','جاري التنفيذ','منجز'];
  const statusEntries=[...statusCounts.entries()].sort((a,b)=>{
    const ai=preferredStatusOrder.indexOf(a[0]);
    const bi=preferredStatusOrder.indexOf(b[0]);
    if(ai!==-1 || bi!==-1) return (ai===-1?999:ai)-(bi===-1?999:bi);
    return String(a[0]).localeCompare(String(b[0]),'ar');
  });

  const completedRows=rows.filter(r=>exactStatus(r.status,'منجز'));
  const completed=completedRows.length;
  const blankStatus=rows.filter(r=>!String(r.status||'').trim()).length;
  const rate=(count,base)=>base?(count/base*100):0;
  const statusActive=interactive?activeChartFilter('emergencyStatusTree','emergency'):null;

  // حقل archive يقرأ تلقائياً من رأس العمود «ارشفة المستندات».
  const archiveCount=label=>{
    const target=normalizeEmergencyStage(label);
    return completedRows.filter(r=>normalizeEmergencyStage(r.archive)===target).length;
  };
  const notReceived=archiveCount('لم يستلم من المقاول');
  const received=Math.max(0,completed-notReceived);
  const consultantReview=archiveCount('قيد مراجعة الاستشاري');
  const returnedContractor=archiveCount('معاده للمقاول بملاحظات');
  const pdcReview=archiveCount('قيد مراجعة ال PDC');
  const approvedPdc=archiveCount('تم الاعتماد من PDC');
  const returnedConsultant=archiveCount('معاده للاستشاري بملاحظات');
  const blankArchive=completedRows.filter(r=>!normalizeEmergencyStage(r.archive)).length;

  const statusCard=(label,value,tone)=>{
    const selected=statusActive&&statusActive.field==='status'&&String(statusActive.value)===label;
    return `<button type="button" class="emergency-tree-card emergency-tree-${tone} ${selected?'selected':''}" data-tree-field="status" data-tree-value="${esc(label)}" data-tree-mode="exact" data-tree-label="حالة إشعار الطوارئ">
      <span>${esc(label)}</span>
      <strong>${fmt(value)}</strong>
      <small>${rate(value,total).toFixed(1)}% من إجمالي الإشعارات</small>
    </button>`;
  };

  const archiveCard=(label,value,position,filterValue=label)=>{
    const selected=statusActive&&statusActive.mode==='emergency-archive-stage'&&String(statusActive.value)===String(filterValue);
    return `<button type="button" class="emergency-tree-card emergency-tree-doc-card ${position} ${selected?'selected':''}" data-tree-field="archive" data-tree-value="${esc(filterValue)}" data-tree-mode="emergency-archive-stage" data-tree-label="حالة المستندات">
      <span>${esc(label)}</span>
      <strong>${fmt(value)}</strong>
      <small>${rate(value,completed).toFixed(1)}% من المنجز</small>
    </button>`;
  };

  const statusTone=label=>{
    if(exactStatus(label,'منجز'))return 'success';
    if(exactStatus(label,'جاري التنفيذ'))return 'running';
    if(exactStatus(label,'لم يتم البدء'))return 'pending';
    return 'running';
  };

  const statusWidth=220;
  const statusCenters=statusEntries.map((_,i)=>{
    if(statusEntries.length<=1)return 580;
    return 140+(880*i/(statusEntries.length-1));
  });
  const statusBranches=statusCenters.map(x=>`M${x} 82 V110`).join(' ');
  const completedIndex=statusEntries.findIndex(([label])=>exactStatus(label,'منجز'));
  const completedX=completedIndex>=0?statusCenters[completedIndex]:1020;
  const statusHtml=statusEntries.map(([label,count],i)=>{
    const left=Math.max(0,Math.min(940,statusCenters[i]-statusWidth/2));
    return `<div class="tree-status" style="left:${left.toFixed(1)}px">${statusCard(label,count,statusTone(label))}</div>`;
  }).join('');

  root.innerHTML=`
    <div class="emergency-tree-canvas">
      <svg class="emergency-tree-lines" viewBox="0 0 1160 710" aria-hidden="true" focusable="false">
        <defs>
          <marker id="${uid}GreenArrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" class="tree-arrow-green"/></marker>
          <marker id="${uid}OrangeArrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" class="tree-arrow-orange"/></marker>
        </defs>

        <path id="${uid}StatusLine" class="tree-status-line" d="M580 58 V82 M140 82 H1020 ${statusBranches}"/>
        <path id="${uid}DocLine" class="tree-doc-line" d="M${completedX} 168 V190 H580 V205 M580 235 V250 M250 250 H910 M250 250 V270 M910 250 V270"/>

        <rect id="${uid}ContractorLoop" class="tree-loop-box" x="60" y="252" width="1020" height="233" rx="22"/>
        <rect id="${uid}ConsultantLoop" class="tree-loop-box" x="60" y="337" width="1020" height="273" rx="22"/>

        <path id="${uid}FlowReceived" class="tree-flow-green" marker-end="url(#${uid}GreenArrow)" d="M370 299 H790"/>
        <path id="${uid}FlowConsultant" class="tree-flow-green" marker-end="url(#${uid}GreenArrow)" d="M910 328 V355"/>
        <path id="${uid}FlowReturnContractor" class="tree-flow-orange" marker-end="url(#${uid}OrangeArrow)" d="M790 384 H370"/>
        <path id="${uid}FlowBackContractor" class="tree-flow-orange" marker-end="url(#${uid}OrangeArrow)" d="M250 355 V328"/>
        <path id="${uid}FlowReturnConsultant" class="tree-flow-orange tree-return-flow" marker-end="url(#${uid}OrangeArrow)" d="M790 554 C650 554 560 500 370 469"/>
        <path id="${uid}FlowPdcReview" class="tree-flow-green" marker-end="url(#${uid}GreenArrow)" d="M910 498 V525"/>
        <path id="${uid}FlowApproved" class="tree-flow-green" marker-end="url(#${uid}GreenArrow)" d="M910 583 V610"/>

        <path class="tree-quality-line" d="M210 639 C435 639 570 299 790 299"/>
        <text id="${uid}ContractorLoopLabel" class="tree-loop-label" x="78" y="275">دورة ملاحظات المقاول</text>
        <text id="${uid}ConsultantLoopLabel" class="tree-loop-label" x="78" y="360">دورة ملاحظات الاستشاري</text>
        <text class="tree-arrow-label" x="580" y="291">عند الاستلام</text>
        <text class="tree-arrow-label tree-arrow-label-orange" x="590" y="492">إعادة للمراجعة</text>
      </svg>

      <article class="emergency-tree-card emergency-tree-root">
        <span>إجمالي إشعارات الطوارئ</span>
        <strong>${fmt(total)}</strong>
        <small>100% من إجمالي الإشعارات</small>
      </article>

      <button type="button" class="emergency-tree-warning ${statusActive&&statusActive.mode==='blank'?'selected':''}" data-tree-field="status" data-tree-value="" data-tree-mode="blank" data-tree-label="حالة التنفيذ"><b>!</b><span>حالة التنفيذ فارغة</span><strong>${fmt(blankStatus)}</strong></button>

      ${statusHtml}

      <div class="emergency-tree-docs-title">دورة المستندات — ارشفة المستندات</div>
      ${archiveCard('لم يستلم من المقاول',notReceived,'tree-doc-not-received')}
      ${archiveCard('مستلم من المقاول',received,'tree-doc-received','__received__')}
      ${archiveCard('معاده للمقاول بملاحظات',returnedContractor,'tree-doc-returned-contractor')}
      ${archiveCard('قيد مراجعة الاستشاري',consultantReview,'tree-doc-consultant-review')}
      ${archiveCard('معاده للاستشاري بملاحظات',returnedConsultant,'tree-doc-returned-consultant')}
      ${archiveCard('قيد مراجعة ال PDC',pdcReview,'tree-doc-pdc-review')}
      ${archiveCard('تم الاعتماد من PDC',approvedPdc,'tree-doc-pdc-approved')}
      <button type="button" class="emergency-tree-card emergency-tree-archive-warning ${statusActive&&statusActive.value==='__blank__'?'selected':''}" data-tree-field="archive" data-tree-value="__blank__" data-tree-mode="emergency-archive-stage" data-tree-label="حالة المستندات">
        <span>الفراغات</span><strong>${fmt(blankArchive)}</strong><small>تنبيه جودة بيانات</small>
      </button>
    </div>`;


  // Dynamic SVG connectors: follow the real edges of flexible-width cards.
  const updateEmergencyTreeConnectors=()=>{
    const canvas=root.querySelector('.emergency-tree-canvas');
    if(!canvas)return;

    const canvasRect=canvas.getBoundingClientRect();
    if(!canvasRect.width||!canvasRect.height)return;

    const sx=1160/canvasRect.width;
    const sy=710/canvasRect.height;

    const box=selector=>{
      const el=root.querySelector(selector);
      if(!el)return null;
      const r=el.getBoundingClientRect();
      const left=(r.left-canvasRect.left)*sx;
      const right=(r.right-canvasRect.left)*sx;
      const top=(r.top-canvasRect.top)*sy;
      const bottom=(r.bottom-canvasRect.top)*sy;
      return {
        left,right,top,bottom,
        cx:(left+right)/2,
        cy:(top+bottom)/2
      };
    };

    const setPath=(id,d)=>{
      const el=root.querySelector('#'+id);
      if(el&&d)el.setAttribute('d',d);
    };

    const rootCard=box('.emergency-tree-root');
    const statuses=[...root.querySelectorAll('.tree-status > .emergency-tree-card')].map(el=>{
      const r=el.getBoundingClientRect();
      const left=(r.left-canvasRect.left)*sx;
      const right=(r.right-canvasRect.left)*sx;
      const top=(r.top-canvasRect.top)*sy;
      const bottom=(r.bottom-canvasRect.top)*sy;
      return {left,right,top,bottom,cx:(left+right)/2,cy:(top+bottom)/2};
    });

    if(rootCard&&statuses.length){
      const branchY=Math.max(rootCard.bottom+15,Math.min(...statuses.map(x=>x.top))-15);
      const minX=Math.min(...statuses.map(x=>x.cx));
      const maxX=Math.max(...statuses.map(x=>x.cx));

      let d='M'+rootCard.cx+' '+rootCard.bottom+' V'+branchY+
            ' M'+minX+' '+branchY+' H'+maxX;

      statuses.forEach(x=>{
        d+=' M'+x.cx+' '+branchY+' V'+x.top;
      });

      setPath(uid+'StatusLine',d);
    }

    const completedCard=[...root.querySelectorAll('.tree-status > .emergency-tree-card')]
      .find(el=>el.dataset.treeValue==='منجز');

    const completed=completedCard ? (()=>{
      const r=completedCard.getBoundingClientRect();
      const left=(r.left-canvasRect.left)*sx;
      const right=(r.right-canvasRect.left)*sx;
      const top=(r.top-canvasRect.top)*sy;
      const bottom=(r.bottom-canvasRect.top)*sy;
      return {left,right,top,bottom,cx:(left+right)/2,cy:(top+bottom)/2};
    })() : null;

    const title=box('.emergency-tree-docs-title');
    const notReceived=box('.tree-doc-not-received');
    const received=box('.tree-doc-received');
    const returnedContractor=box('.tree-doc-returned-contractor');
    const consultant=box('.tree-doc-consultant-review');
    const returnedConsultant=box('.tree-doc-returned-consultant');
    const pdcReview=box('.tree-doc-pdc-review');
    const approved=box('.tree-doc-pdc-approved');

    if(completed&&title&&notReceived&&received){
      const y1=(completed.bottom+title.top)/2;
      const y2=(title.bottom+Math.min(notReceived.top,received.top))/2;

      setPath(
        uid+'DocLine',
        'M'+completed.cx+' '+completed.bottom+
        ' V'+y1+
        ' H'+title.cx+
        ' V'+title.top+
        ' M'+title.cx+' '+title.bottom+
        ' V'+y2+
        ' M'+notReceived.cx+' '+y2+
        ' H'+received.cx+
        ' M'+notReceived.cx+' '+y2+
        ' V'+notReceived.top+
        ' M'+received.cx+' '+y2+
        ' V'+received.top
      );
    }

    if(notReceived&&received){
      setPath(
        uid+'FlowReceived',
        'M'+notReceived.right+' '+notReceived.cy+
        ' H'+received.left
      );
    }

    if(received&&consultant){
      setPath(
        uid+'FlowConsultant',
        'M'+received.cx+' '+received.bottom+
        ' V'+(consultant.top-Math.max(24,(consultant.top-received.bottom)*0.45))
      );
    }

    if(consultant&&returnedContractor){
      setPath(
        uid+'FlowReturnContractor',
        'M'+consultant.left+' '+consultant.cy+
        ' H'+returnedContractor.right
      );
    }

    if(returnedContractor&&notReceived){
      setPath(
        uid+'FlowBackContractor',
        'M'+returnedContractor.cx+' '+returnedContractor.top+
        ' V'+notReceived.bottom
      );
    }
    if(consultant&&pdcReview){
      setPath(
        uid+'FlowPdcReview',
        'M'+consultant.cx+' '+consultant.bottom+
        ' V'+(pdcReview.top-Math.max(24,(pdcReview.top-consultant.bottom)*0.45))
      );
    }

    if(pdcReview&&approved){
      setPath(
        uid+'FlowApproved',
        'M'+pdcReview.cx+' '+pdcReview.bottom+
        ' V'+(approved.top-Math.max(24,(approved.top-pdcReview.bottom)*0.45))
      );
    }


    // Flexible orange loop boxes and their titles.
    const contractorLoop=root.querySelector('#'+uid+'ContractorLoop');
    const consultantLoop=root.querySelector('#'+uid+'ConsultantLoop');
    const contractorLabel=root.querySelector('#'+uid+'ContractorLoopLabel');
    const consultantLabel=root.querySelector('#'+uid+'ConsultantLoopLabel');

    if(notReceived&&received&&returnedContractor&&consultant){
      const padX=38;
      const padTop=18;
      const padBottom=18;

      const left=Math.min(
        notReceived.left,
        received.left,
        returnedContractor.left,
        consultant.left
      )-padX;

      const right=Math.max(
        notReceived.right,
        received.right,
        returnedContractor.right,
        consultant.right
      )+padX;

      const top=Math.min(notReceived.top,received.top)-padTop;
      const bottom=Math.max(returnedContractor.bottom,consultant.bottom)+padBottom;

      if(contractorLoop){
        contractorLoop.setAttribute('x',left);
        contractorLoop.setAttribute('y',top);
        contractorLoop.setAttribute('width',right-left);
        contractorLoop.setAttribute('height',bottom-top);
      }

      if(contractorLabel){
        contractorLabel.setAttribute('x',left+16);
        contractorLabel.setAttribute('y',top+22);
      }
    }

    if(returnedContractor&&consultant&&returnedConsultant&&pdcReview&&approved){
      const padX=38;
      const padTop=18;
      const padBottom=18;

      const left=Math.min(
        returnedContractor.left,
        consultant.left,
        returnedConsultant.left,
        pdcReview.left,
        approved.left
      )-padX;

      const right=Math.max(
        returnedContractor.right,
        consultant.right,
        returnedConsultant.right,
        pdcReview.right,
        approved.right
      )+padX;

      const top=Math.min(returnedContractor.top,consultant.top)-padTop;
      const bottom=Math.max(
        returnedConsultant.bottom,
        pdcReview.bottom,
        approved.bottom
      )+padBottom;

      if(consultantLoop){
        consultantLoop.setAttribute('x',left);
        consultantLoop.setAttribute('y',top);
        consultantLoop.setAttribute('width',right-left);
        consultantLoop.setAttribute('height',bottom-top);
      }

      if(consultantLabel){
        consultantLabel.setAttribute('x',left+16);
        consultantLabel.setAttribute('y',top+22);
      }
    }

    if(returnedConsultant){
      const pdcCardEl=root.querySelector('.tree-doc-pdc-review');

      if(pdcCardEl){
        const pdcRect=pdcCardEl.getBoundingClientRect();

        const startX=
          (pdcRect.left-canvasRect.left)*sx;

        const startY=
          ((pdcRect.top-canvasRect.top) +
          (pdcRect.height/2))*sy;

        const endX=returnedConsultant.right;
        const endY=returnedConsultant.cy;

        setPath(
          uid+'FlowReturnConsultant',
          'M'+startX+' '+startY+
          ' L'+endX+' '+endY
        );
      }
    }
  };

  requestAnimationFrame(updateEmergencyTreeConnectors);

  if(interactive)root.querySelectorAll('[data-tree-field]').forEach(card=>{
    card.onclick=()=>toggleChartFilter(
      'emergencyStatusTree',card.dataset.treeField,card.dataset.treeValue,
      card.dataset.treeLabel,card.dataset.treeMode,
      card.querySelector('span')?.textContent||card.dataset.treeValue
    );
  });
}
function renderEmergencyTypeTree(rows){
  const root=document.getElementById('emergencyTypeTree');
  if(!root)return;

  const total=rows.length;
  const rate=(count,base)=>base?(count/base*100):0;
  const active=activeChartFilter('emergencyTypeTree','emergency');
  const types=[
    {label:'طارئ',tone:'urgent'},
    {label:'مجدول',tone:'scheduled'}
  ];
  const knownTypes=new Set(types.map(x=>x.label));
  const unclassified=rows.filter(r=>!knownTypes.has(cleanEmergencyTreeValue(r.emergencyType))).length;

  const descriptionEntries=type=>{
    const typeRows=rows.filter(r=>exactStatus(r.emergencyType,type));
    const counts=new Map();
    typeRows.forEach(r=>{
      const value=cleanEmergencyTreeValue(r.description);
      counts.set(value,(counts.get(value)||0)+1);
    });
    return {
      rows:typeRows,
      entries:[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ar'))
    };
  };

  const typeBranch=({label,tone})=>{
    const data=descriptionEntries(label);
    const typeSelected=active&&active.field==='emergencyType'&&active.mode==='exact'&&String(active.value)===label;
    return `<section class="emergency-type-branch emergency-type-${tone}">
      <button type="button" class="emergency-tree-card emergency-type-card ${typeSelected?'selected':''}" data-type-field="emergencyType" data-type-value="${esc(label)}" data-type-mode="exact" data-type-display="${esc(label)}">
        <span>${esc(label)}</span>
        <strong>${fmt(data.rows.length)}</strong>
        <small>${rate(data.rows.length,total).toFixed(1)}% من إجمالي الإشعارات</small>
      </button>
      <div class="emergency-description-tree">
        <div class="emergency-description-title">وصف العمل — العمود G</div>
        <div class="emergency-description-list">
          ${data.entries.length?data.entries.map(([description,count])=>{
            const filterValue=JSON.stringify([label,description]);
            const selected=active&&active.mode==='emergency-type-description'&&String(active.value)===filterValue;
            const shown=description||'الفراغات في وصف العمل';
            return `<button type="button" class="emergency-tree-card emergency-description-card ${!description?'description-blank':''} ${selected?'selected':''}" data-type-field="description" data-type-value="${esc(filterValue)}" data-type-mode="emergency-type-description" data-type-display="${esc(label+' — '+shown)}">
              <span>${esc(shown)}</span><strong>${fmt(count)}</strong><small>${rate(count,data.rows.length).toFixed(1)}% من ${esc(label)}</small>
            </button>`;
          }).join(''):'<article class="emergency-tree-card emergency-description-card is-empty"><span>لا توجد إشعارات</span><strong>٠</strong><small>0.0%</small></article>'}
        </div>
      </div>
    </section>`;
  };

  root.innerHTML=`
    <div class="emergency-type-tree-canvas">
      <article class="emergency-tree-card emergency-type-root">
        <span>إجمالي إشعارات الطوارئ</span>
        <strong>${fmt(total)}</strong>
        <small>100% من إجمالي الإشعارات</small>
      </article>
      ${unclassified?`<div class="emergency-type-quality-warning"><b>!</b> غير مصنف في العمود M: <strong>${fmt(unclassified)}</strong></div>`:''}
      <div class="emergency-type-branches">
        ${types.map(typeBranch).join('')}
      </div>
    </div>`;

  root.querySelectorAll('[data-type-field]').forEach(card=>{
    card.onclick=()=>toggleChartFilter(
      'emergencyTypeTree',card.dataset.typeField,card.dataset.typeValue,
      card.dataset.typeMode==='emergency-type-description'?'النوع ووصف العمل':'نوع الإشعار',
      card.dataset.typeMode,card.dataset.typeDisplay
    );
  });
}

function emergencyMonthLabel(key){
  const [y,m]=String(key).split('-');
  const names=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${names[Number(m)-1]||m} ${y}`;
}

function renderEmergencyMonthlyChart(rows){
  const monthly={};

  rows.forEach(r=>{
    // المصدر الرسمي: العمود D = تاريخ الاسناد
    const d=parseDashboardDate(r.assignedDate);
    if(!d)return;

    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    monthly[key]=(monthly[key]||0)+1;
  });

  const keys=Object.keys(monthly).sort();
  const labels=keys.map(emergencyMonthLabel);
  const values=keys.map(k=>monthly[k]);

  if(S.charts.emergencyMonthlyChart)S.charts.emergencyMonthlyChart.destroy();

  const ctx=document.getElementById('emergencyMonthlyChart');
  if(!ctx)return;

  const active=activeChartFilter('emergencyMonthlyChart','emergency');
  const colors=keys.map(k=>!active||k===active.value?'#178446':'rgba(188,198,214,.35)');

  S.charts.emergencyMonthlyChart=new Chart(ctx,{
    type:'bar',
    data:{
      labels,
      datasets:[{
        label:'عدد الإشعارات',
        data:values,
        backgroundColor:colors,
        borderRadius:6,
        borderWidth:0,
        maxBarThickness:36
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:'nearest',intersect:false},
      onHover:(e,els)=>{
        (e.native?.target||ctx).style.cursor=els.length?'pointer':'default';
      },
      onClick:(e,els)=>{
        if(!els.length)return;
        const i=els[0].index;
        toggleChartFilter(
          'emergencyMonthlyChart',
          'assignedDate',
          keys[i],
          'شهر الإسناد',
          'month',
          labels[i]
        );
      },
      plugins:{
        legend:{display:false},
        tooltip:{
          rtl:true,
          titleFont:{family:'Cairo'},
          bodyFont:{family:'Cairo'},
          callbacks:{label:c=>'عدد الإشعارات: '+fmt(c.raw)}
        }
      },
      scales:{
        x:{
          grid:{display:false},
          ticks:{font:{family:'Cairo',size:8},maxRotation:35,minRotation:0}
        },
        y:{
          beginAtZero:true,
          grid:{color:'#edf1f6'},
          ticks:{precision:0,font:{family:'Cairo',size:8}}
        }
      }
    }
  });
}

function renderEmergencyCategoricalChart(id,type,rows,field,limit,label,horizontal){
  const grouped={};

  rows.forEach(r=>{
    const v=String(r[field]||'غير محدد').replace(/\s+/g,' ').trim()||'غير محدد';
    grouped[v]=(grouped[v]||0)+1;
  });

  const entries=Object.entries(grouped)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,limit||12);

  const labels=entries.map(x=>x[0]);
  const values=entries.map(x=>x[1]);

  const palette=[
    '#178446','#2f79cf','#f1ae19','#d94242','#7657ce',
    '#1b9ca6','#6077a8','#b363a4','#5fa858','#d58c3d',
    '#488ec4','#9472c9','#cf6680','#46998e','#8692a4'
  ];

  const active=activeChartFilter(id,'emergency');

  const colors=labels.map((x,i)=>{
    if(!active)return palette[i%palette.length];
    return String(x)===String(active.value)
      ? palette[i%palette.length]
      : 'rgba(188,198,214,.35)';
  });

  if(S.charts[id])S.charts[id].destroy();

  const ctx=document.getElementById(id);
  if(!ctx)return;

  S.charts[id]=new Chart(ctx,{
    type,
    data:{
      labels,
      datasets:[{
        data:values,
        backgroundColor:colors,
        borderWidth:type==='bar'?0:2,
        borderColor:type==='bar'?'transparent':'#fff',
        borderRadius:type==='bar'?6:0,
        maxBarThickness:horizontal?25:42
      }]
    },
    options:{
      indexAxis:horizontal?'y':'x',
      responsive:true,
      maintainAspectRatio:false,
      onHover:(e,els)=>{
        (e.native?.target||ctx).style.cursor=els.length?'pointer':'default';
      },
      onClick:(e,els)=>{
        if(!els.length)return;
        const i=els[0].index;
        toggleChartFilter(id,field,labels[i],label,'exact',labels[i]);
      },
      plugins:{
        legend:{
          display:type!=='bar',
          position:'bottom',
          labels:{
            boxWidth:8,
            usePointStyle:true,
            font:{family:'Cairo',size:8}
          }
        },
        tooltip:{
          rtl:true,
          titleFont:{family:'Cairo'},
          bodyFont:{family:'Cairo'},
          callbacks:{
            label:c=>`${label}: ${c.label} — ${fmt(c.raw)}`
          }
        }
      },
      scales:type==='bar'
        ? (horizontal
          ? {
              x:{
                beginAtZero:true,
                grid:{color:'#edf1f6'},
                ticks:{precision:0,font:{family:'Cairo',size:8}}
              },
              y:{
                grid:{display:false},
                ticks:{
                  autoSkip:false,
                  font:{family:'Cairo',size:8},
                  callback:function(value){
                    const txt=this.getLabelForValue(value);
                    return txt.length>46?txt.slice(0,46)+'…':txt;
                  }
                }
              }
            }
          : {
              x:{grid:{display:false},ticks:{font:{family:'Cairo',size:8},maxRotation:30}},
              y:{beginAtZero:true,grid:{color:'#edf1f6'},ticks:{precision:0,font:{family:'Cairo',size:8}}}
            })
        : undefined
    }
  });
}

function emergencyTableStatuses(rows){
  const preferred=['منجز','جاري التنفيذ','لم يتم البدء'];
  const found=unique(rows.map(r=>emergencyStatusValue(r)));

  const ordered=preferred.filter(s=>found.includes(s));
  found.forEach(s=>{
    if(!ordered.includes(s))ordered.push(s);
  });

  return ordered;
}

function emergencyProgressClass(pctValue){
  if(pctValue>=90)return 'emergency-pct-good';
  if(pctValue>=70)return 'emergency-pct-mid';
  if(pctValue>=50)return 'emergency-pct-warn';
  return 'emergency-pct-bad';
}

function renderEmergencySummaryTable(id,rows,groupField,groupLabel){
  const root=document.getElementById(id);
  if(!root)return;

  if(!Array.isArray(rows)){
    root.innerHTML='<div class="empty">تعذر قراءة بيانات الجدول</div>';
    return;
  }

  const statuses=emergencyTableStatuses(rows);
  const groups={};

  rows.forEach(r=>{
    const key=String(r[groupField]||'غير محدد').replace(/\s+/g,' ').trim()||'غير محدد';

    if(!groups[key]){
      groups[key]={total:0,status:{}};
    }

    groups[key].total++;

    const status=emergencyStatusValue(r);
    groups[key].status[status]=(groups[key].status[status]||0)+1;
  });

  const entries=Object.entries(groups)
    .map(([name,x])=>{
      const done=x.status['منجز']||0;
      return {
        name,
        total:x.total,
        done,
        pct:x.total?(done/x.total*100):0,
        status:x.status
      };
    })
    .sort((a,b)=>b.total-a.total || b.done-a.done);

  if(!entries.length){
    root.innerHTML='<div class="empty">لا توجد بيانات مطابقة للفلاتر الحالية</div>';
    return;
  }

  const active=activeChartFilter(id,'emergency');

  root.innerHTML=`
    <div class="emergency-table-scroll">
      <table class="emergency-performance-table">
        <thead>
          <tr>
            <th>${esc(groupLabel)}</th>
            <th>إجمالي الأعطال</th>
            ${statuses.map(s=>`<th>${esc(s)}</th>`).join('')}
            <th>نسبة الإنجاز</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(x=>{
            const selected=active && String(active.value)===String(x.name);
            return `
              <tr class="${selected?'selected-row':''}" data-filter-value="${esc(x.name)}">
                <td class="emergency-group-name">${esc(x.name)}</td>
                <td>
                  <div class="emergency-total-bar" style="--bar:${Math.max(8,(x.total/entries[0].total)*100).toFixed(1)}%">
                    <b>${fmt(x.total)}</b>
                  </div>
                </td>
                ${statuses.map(s=>`<td>${fmt(x.status[s]||0)}</td>`).join('')}
                <td class="${emergencyProgressClass(x.pct)}">
                  <b>${x.pct.toFixed(1)}%</b>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <th>الإجمالي</th>
            <th>${fmt(entries.reduce((s,x)=>s+x.total,0))}</th>
            ${statuses.map(st=>`<th>${fmt(entries.reduce((s,x)=>s+(x.status[st]||0),0))}</th>`).join('')}
            <th>${pct(entries.reduce((s,x)=>s+x.done,0),entries.reduce((s,x)=>s+x.total,0))}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  root.querySelectorAll('tbody tr').forEach(tr=>{
    tr.onclick=()=>{
      toggleChartFilter(
        id,
        groupField,
        tr.dataset.filterValue,
        groupLabel,
        'exact',
        tr.dataset.filterValue
      );
    };
  });
}


/* =========================================================
   V2.2.36 — EXECUTION PHASE ANALYTICS
   Work Orders / Projects / Connections / Operations
   ========================================================= */

function renderExecutionPhaseCharts(baseRows,key){
  renderPhaseChart(
    'executionStageChart',
    'bar',
    applyChartFilters(baseRows,'executionStageChart',key),
    'stage',
    'مرحلة التنفيذ',
    true
  );

  renderPhaseChart(
    'executionStageStatusChart',
    'doughnut',
    applyChartFilters(baseRows,'executionStageStatusChart',key),
    'stageStatus',
    'حالة المرحلة',
    false
  );
}

function renderPhaseChart(id,type,rows,field,label,horizontal){
  const grouped={};

  rows.forEach(r=>{
    const value=String(r[field]||'غير محدد').replace(/\s+/g,' ').trim()||'غير محدد';
    grouped[value]=(grouped[value]||0)+1;
  });

  const entries=Object.entries(grouped)
    .sort((a,b)=>b[1]-a[1]);

  const labels=entries.map(x=>x[0]);
  const values=entries.map(x=>x[1]);

  const palette=[
    '#2878e8','#18aa7d','#f0a126','#7757d7',
    '#e4505b','#22a8c5','#667ca8','#b26abc',
    '#63b35e','#d68942','#4f9ed8','#9a72ce'
  ];

  const active=activeChartFilter(id,S.current);

  const colors=labels.map((value,i)=>{
    if(!active)return palette[i%palette.length];
    return String(value)===String(active.value)
      ? palette[i%palette.length]
      : 'rgba(188,198,214,.30)';
  });

  if(S.charts[id])S.charts[id].destroy();

  const ctx=document.getElementById(id);
  if(!ctx)return;

  S.charts[id]=new Chart(ctx,{
    type,
    data:{
      labels,
      datasets:[{
        data:values,
        backgroundColor:colors,
        borderWidth:type==='bar'?0:2,
        borderColor:type==='bar'?'transparent':'#fff',
        borderRadius:type==='bar'?7:0,
        maxBarThickness:30
      }]
    },
    options:{
      indexAxis:type==='bar'&&horizontal?'y':'x',
      responsive:true,
      maintainAspectRatio:false,

      onHover:(event,elements)=>{
        const canvas=event.native?.target||ctx;
        canvas.style.cursor=elements.length?'pointer':'default';
      },

      onClick:(event,elements)=>{
        if(!elements.length)return;
        const i=elements[0].index;

        toggleChartFilter(
          id,
          field,
          labels[i],
          label,
          'exact',
          labels[i]
        );
      },

      plugins:{
        legend:{
          display:type!=='bar',
          position:'bottom',
          labels:{
            boxWidth:8,
            usePointStyle:true,
            font:{family:'Cairo',size:8}
          }
        },
        tooltip:{
          rtl:true,
          titleFont:{family:'Cairo',size:10},
          bodyFont:{family:'Cairo',size:9},
          callbacks:{
            label:c=>`${c.label}: ${fmt(c.raw)}`
          }
        }
      },

      scales:type==='bar'
        ? {
            x:{
              beginAtZero:true,
              grid:{color:'#edf1f6'},
              ticks:{
                precision:0,
                font:{family:'Cairo',size:8}
              }
            },
            y:{
              grid:{display:false},
              ticks:{
                autoSkip:false,
                font:{family:'Cairo',size:9},
                callback:function(value){
                  const txt=this.getLabelForValue(value);
                  return txt.length>42?txt.slice(0,42)+'…':txt;
                }
              }
            }
          }
        : undefined
    }
  });
}

function renderDataPage(){
 const rows=S.filtered, key=S.current;
 document.getElementById('dataTitle').textContent=S.page.title;
 document.getElementById('dataCount').textContent=fmt(rows.length)+' نتيجة';
 renderPageKpis(key,rows);

 const permitDelaySection=document.getElementById('permitDelaySection');
 if(key==='permits'){
   permitDelaySection.style.display='block';
   renderPermitDelayKpis(rows);
 }else{
   permitDelaySection.style.display='none';
 }

 const contractorPanel=document.getElementById('contractorWorkOrdersPanel');
 if(key==='workorders'){
   contractorPanel.style.display='block';
   renderContractorWorkOrdersChart(applyChartFilters(S.pageBaseRows,'contractorWorkOrdersChart',key));
 }else{
   contractorPanel.style.display='none';
   if(S.charts.contractorWorkOrdersChart){
     S.charts.contractorWorkOrdersChart.destroy();
     delete S.charts.contractorWorkOrdersChart;
   }
 }

 const phaseAnalytics=document.getElementById('executionPhaseAnalytics');
 const phasePages=new Set(['workorders','projects','connections','operations']);

 if(phaseAnalytics){
   phaseAnalytics.style.display=phasePages.has(key)?'block':'none';
 }

 if(phasePages.has(key)){
   renderExecutionPhaseCharts(S.pageBaseRows,key);
 }else{
   ['executionStageChart','executionStageStatusChart'].forEach(id=>{
     if(S.charts[id]){
       S.charts[id].destroy();
       delete S.charts[id];
     }
   });
 }

 const emergencyTreeSection=document.getElementById('emergencyTreeSection');
 const emergencyAnalytics=document.getElementById('emergencyAnalytics');
 const genericPageCharts=document.getElementById('genericPageCharts');
 const safetyAnalytics=document.getElementById('safetyMasterAnalytics');
 const executionAnalytics=document.getElementById('executionMasterAnalytics');
 const isCorporateViolationReport=key==='safety'||key==='violationsCombined';
 document.body.classList.toggle('vd-report-dark',isCorporateViolationReport);

 if(emergencyTreeSection) emergencyTreeSection.style.display=key==='emergency'?'block':'none';

 if(safetyAnalytics) safetyAnalytics.style.display=key==='safety'?'block':'none';
 if(executionAnalytics) executionAnalytics.style.display=key==='violationsCombined'?'block':'none';

 if(key==='safety'){
   if(emergencyAnalytics) emergencyAnalytics.style.display='none';
   if(genericPageCharts) genericPageCharts.style.display='none';
   renderSafetyMasterAnalytics(rows);
 }else if(key==='violationsCombined'){
   if(emergencyAnalytics) emergencyAnalytics.style.display='none';
   if(genericPageCharts) genericPageCharts.style.display='none';
   renderExecutionMasterAnalytics(rows);
 }else if(key==='emergency'){
   if(emergencyAnalytics) emergencyAnalytics.style.display='block';
   if(genericPageCharts) genericPageCharts.style.display='none';
   renderEmergencyDashboard(S.pageBaseRows);
 }else{
   if(emergencyAnalytics) emergencyAnalytics.style.display='none';
   if(genericPageCharts) genericPageCharts.style.display='grid';

   const dims=pickDimensions(key);
   const chart1Rows=applyChartFilters(S.pageBaseRows,'pageChart1',key);
   groupChart('pageChart1','bar',chart1Rows,dims[0],8,dims[0]);
   document.getElementById('chart1Title').textContent=LABELS[dims[0]]||dims[0];

   if(key==='violationsCombined'){
     document.getElementById('chart2Title').textContent='عدد مخالفات التنفيذ الشهرية';
     const chart2Rows=applyChartFilters(S.pageBaseRows,'pageChart2',key);
     renderMonthlyExecutionViolationsChart(chart2Rows);
   }else{
     const chart2Rows=applyChartFilters(S.pageBaseRows,'pageChart2',key);
     groupChart('pageChart2','doughnut',chart2Rows,dims[1],8,dims[1]);
     document.getElementById('chart2Title').textContent=LABELS[dims[1]]||dims[1];
   }
 }

 document.getElementById('dataTable').innerHTML=tableHtml(rows.slice(0,350),S.columns);
}


function safetyCounts(rows,key){
 const m=new Map();
 rows.forEach(r=>{
   const v=String(r[key]||'').trim()||'غير محدد';
   m.set(v,(m.get(v)||0)+1);
 });
 return [...m.entries()].sort((a,b)=>b[1]-a[1]);
}

function renderSafetyMasterAnalytics(rows){
 const topContractors=safetyCounts(rows,'contractor').slice(0,10);
 const topViolations=safetyCounts(rows,'violation1').slice(0,10);
 const topSupervisors=safetyCounts(rows,'supervisor').slice(0,10);
 const topTypes=safetyCounts(rows,'type').slice(0,8);
 const topEditors=safetyCounts(rows,'editor').slice(0,10);

 const monthly={};
 rows.forEach(r=>{
   const d=parseDashboardDate(r.date);
   if(!d)return;
   const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
   monthly[k]=(monthly[k]||0)+1;
 });
 const mkeys=Object.keys(monthly).sort();
 const mlabels=mkeys.map(monthLabelAr);
 const mvalues=mkeys.map(k=>monthly[k]);

 const VD={navy:'#1c2868',blue:'#19b8e6',cyan:'#00a0c6',orange:'#f6a21a',ink:'#f5f9ff',muted:'#b8c9df'};
 const palette=[VD.navy,VD.blue,VD.orange,VD.cyan,'#2f57a6','#ee8b19','#4e79a7','#59a14f','#af7aa1','#9c755f'];
 const makeChart=(id,type,labels,data,opts={})=>{
   if(S.charts[id])S.charts[id].destroy();
   const el=document.getElementById(id); if(!el)return;
   const isBar=type==='bar', isLine=type==='line', isDoughnut=type==='doughnut';
   const bg=isLine?'rgba(0,127,186,.12)':labels.map((_,i)=>palette[i%palette.length]);
   const border=isLine?VD.blue:labels.map((_,i)=>palette[i%palette.length]);
   S.charts[id]=new Chart(el,{
     type,
     data:{labels,datasets:[{
       label:'عدد المخالفات',data,
       backgroundColor:bg,borderColor:border,
       borderWidth:isLine?3:(isDoughnut?2:0),
       borderRadius:isBar?9:0,borderSkipped:false,
       pointRadius:isLine?4:0,pointHoverRadius:isLine?7:0,
       pointBackgroundColor:isLine?'#fff':undefined,pointBorderColor:isLine?VD.blue:undefined,pointBorderWidth:isLine?2:0,
       fill:isLine,tension:.34,barThickness:isBar?18:undefined,maxBarThickness:isBar?22:undefined,
       hoverOffset:isDoughnut?8:undefined
     }]},
     options:{
       responsive:true,maintainAspectRatio:false,indexAxis:opts.horizontal?'y':'x',cutout:isDoughnut?'66%':undefined,
       interaction:{mode:isDoughnut?'nearest':'index',intersect:false},
       layout:{padding:{top:10,right:12,bottom:5,left:10}},
       plugins:{
         legend:{display:isDoughnut,position:'bottom',rtl:true,labels:{font:{family:'Cairo',size:9},boxWidth:10,boxHeight:10,usePointStyle:true,padding:12,color:VD.ink}},
         tooltip:{rtl:true,backgroundColor:VD.ink,titleFont:{family:'Cairo',size:11,weight:'700'},bodyFont:{family:'Cairo',size:10},padding:11,cornerRadius:10,displayColors:true,callbacks:{label:c=>' '+fmt(c.raw)+' مخالفة'}},
         title:{display:false}
       },
       scales:isDoughnut?{}:{
         x:{beginAtZero:true,grid:{display:!opts.horizontal,color:'rgba(255,255,255,.08)'},border:{display:false},ticks:{font:{family:'Cairo',size:9},color:VD.muted,maxRotation:isLine?0:30,minRotation:0}},
         y:{beginAtZero:true,grid:{display:false},border:{display:false},ticks:{font:{family:'Cairo',size:9,weight:opts.horizontal?'600':'400'},color:VD.ink,autoSkip:false,callback:function(v){const t=this.getLabelForValue(v);return String(t).length>36?String(t).slice(0,36)+'…':t;}}}
       }
     }
   });
 };
 makeChart('safetyTrendChart','line',mlabels,mvalues);
 makeChart('safetyContractorChart','bar',topContractors.map(x=>x[0]),topContractors.map(x=>x[1]),{horizontal:true});
 makeChart('safetyViolationChart','bar',topViolations.map(x=>x[0]),topViolations.map(x=>x[1]),{horizontal:true});
 makeChart('safetySupervisorChart','bar',topSupervisors.map(x=>x[0]),topSupervisors.map(x=>x[1]),{horizontal:true});
 makeChart('safetyTypeChart','doughnut',topTypes.map(x=>x[0]),topTypes.map(x=>x[1]));
 makeChart('safetyEditorChart','bar',topEditors.map(x=>x[0]),topEditors.map(x=>x[1]),{horizontal:true});

 const wo=safetyCounts(rows,'workOrder').filter(x=>x[1]>1).slice(0,12);
 const rankHtml=(items,label)=>items.length?`<table><thead><tr><th>#</th><th>${label}</th><th>عدد المخالفات</th><th>النسبة</th></tr></thead><tbody>${items.map((x,i)=>`<tr><td><span class="safety-rank-no">${i+1}</span></td><td>${esc(x[0])}</td><td><b>${fmt(x[1])}</b></td><td>${rows.length?((x[1]/rows.length)*100).toFixed(1):'0.0'}%</td></tr>`).join('')}</tbody></table>`:'<div class="empty">لا توجد بيانات</div>';
 const woRoot=document.getElementById('safetyRepeatedWorkOrders'); if(woRoot)woRoot.innerHTML=rankHtml(wo,'أمر العمل');
 const cRoot=document.getElementById('safetyContractorRanking'); if(cRoot)cRoot.innerHTML=rankHtml(topContractors,'المقاول');
}


function renderExecutionMasterAnalytics(rows){
 const topContractors=safetyCounts(rows,'contractor').slice(0,10);
 const topViolations=safetyCounts(rows,'violation').slice(0,10);
 const topSupervisors=safetyCounts(rows,'supervisor').filter(x=>x[0]!=='غير محدد').slice(0,10);
 const topTypes=safetyCounts(rows,'type').slice(0,8);
 const topSections=safetyCounts(rows,'violationSection').filter(x=>x[0]!=='غير محدد').slice(0,10);
 const monthly={};
 rows.forEach(r=>{const d=parseDashboardDate(r.date);if(!d)return;const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');monthly[k]=(monthly[k]||0)+1});
 const mkeys=Object.keys(monthly).sort(),mlabels=mkeys.map(monthLabelAr),mvalues=mkeys.map(k=>monthly[k]);
 const VD={navy:'#1c2868',blue:'#19b8e6',cyan:'#00a0c6',orange:'#f6a21a',ink:'#f5f9ff',muted:'#b8c9df'};
 const palette=[VD.blue,VD.orange,VD.cyan,'#4d7cff','#8f6cff','#40c98a','#f05a5a','#7ac7ff','#ffd166','#7e8aa6'];
 const makeChart=(id,type,labels,data,opts={})=>{
   if(S.charts[id])S.charts[id].destroy(); const el=document.getElementById(id);if(!el)return;
   const isBar=type==='bar',isLine=type==='line',isDoughnut=type==='doughnut';
   S.charts[id]=new Chart(el,{type,data:{labels,datasets:[{label:'عدد المخالفات',data,backgroundColor:isLine?'rgba(25,184,230,.18)':labels.map((_,i)=>palette[i%palette.length]),borderColor:isLine?VD.blue:labels.map((_,i)=>palette[i%palette.length]),borderWidth:isLine?3:(isDoughnut?2:0),borderRadius:isBar?9:0,borderSkipped:false,pointRadius:isLine?4:0,pointHoverRadius:isLine?7:0,pointBackgroundColor:isLine?'#fff':undefined,pointBorderColor:isLine?VD.blue:undefined,pointBorderWidth:isLine?2:0,fill:isLine,tension:.34,barThickness:isBar?18:undefined,maxBarThickness:isBar?22:undefined,hoverOffset:isDoughnut?8:undefined}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:opts.horizontal?'y':'x',cutout:isDoughnut?'66%':undefined,interaction:{mode:isDoughnut?'nearest':'index',intersect:false},layout:{padding:{top:10,right:12,bottom:5,left:10}},plugins:{legend:{display:isDoughnut,position:'bottom',rtl:true,labels:{font:{family:'Cairo',size:9},boxWidth:10,boxHeight:10,usePointStyle:true,padding:12,color:VD.ink}},tooltip:{rtl:true,backgroundColor:'#071e38',titleFont:{family:'Cairo',size:11,weight:'700'},bodyFont:{family:'Cairo',size:10},padding:11,cornerRadius:10,callbacks:{label:c=>' '+fmt(c.raw)+' مخالفة'}}},scales:isDoughnut?{}:{x:{beginAtZero:true,grid:{display:!opts.horizontal,color:'rgba(255,255,255,.08)'},border:{display:false},ticks:{font:{family:'Cairo',size:9},color:VD.muted,maxRotation:isLine?0:30,minRotation:0}},y:{beginAtZero:true,grid:{display:false},border:{display:false},ticks:{font:{family:'Cairo',size:9,weight:opts.horizontal?'600':'400'},color:VD.ink,autoSkip:false,callback:function(v){const t=this.getLabelForValue(v);return String(t).length>36?String(t).slice(0,36)+'…':t;}}}}}});
 };
 makeChart('executionTrendChart','line',mlabels,mvalues);
 makeChart('executionContractorChart','bar',topContractors.map(x=>x[0]),topContractors.map(x=>x[1]),{horizontal:true});
 makeChart('executionViolationChart','bar',topViolations.map(x=>x[0]),topViolations.map(x=>x[1]),{horizontal:true});
 makeChart('executionSupervisorChart','bar',topSupervisors.map(x=>x[0]),topSupervisors.map(x=>x[1]),{horizontal:true});
 makeChart('executionTypeChart','doughnut',topTypes.map(x=>x[0]),topTypes.map(x=>x[1]));
 makeChart('executionSectionChart','bar',topSections.map(x=>x[0]),topSections.map(x=>x[1]),{horizontal:true});
 const wo=safetyCounts(rows,'workOrder').filter(x=>x[0]!=='غير محدد'&&x[1]>1).slice(0,12);
 const rankHtml=(items,label)=>items.length?`<table><thead><tr><th>#</th><th>${label}</th><th>عدد المخالفات</th><th>النسبة</th></tr></thead><tbody>${items.map((x,i)=>`<tr><td><span class="safety-rank-no">${i+1}</span></td><td>${esc(x[0])}</td><td><b>${fmt(x[1])}</b></td><td>${rows.length?((x[1]/rows.length)*100).toFixed(1):'0.0'}%</td></tr>`).join('')}</tbody></table>`:'<div class="empty">لا توجد بيانات</div>';
 const w=document.getElementById('executionRepeatedWorkOrders');if(w)w.innerHTML=rankHtml(wo,'أمر العمل');
 const c=document.getElementById('executionContractorRanking');if(c)c.innerHTML=rankHtml(topContractors,'المقاول');
}

function exportExecutionReportPdf(){
 if(S.current!=='violationsCombined')return;
 const rows=S.filtered||[];if(!rows.length){toast('لا توجد بيانات مطابقة للفلاتر لتصديرها');return;}
 const win=window.open('','_blank');if(!win){toast('اسمح بالنوافذ المنبثقة لتصدير PDF');return;}
 const filterParts=[];['f1','f2','f3','f4','f5'].forEach(id=>{const el=document.getElementById(id);if(!el||!el.value)return;const lab=document.getElementById('fl'+id.slice(1));filterParts.push(`${lab?.textContent||''}: ${el.value}`)});const q=document.getElementById('globalSearch')?.value?.trim();if(q)filterParts.push(`البحث: ${q}`);
 const contractors=unique(rows.map(r=>r.contractor)).length,workOrders=unique(rows.map(r=>r.workOrder)).length,types=unique(rows.map(r=>r.type)).length;
 const woCounts=safetyCounts(rows,'workOrder').filter(x=>x[0]!=='غير محدد'),repeated=woCounts.filter(x=>x[1]>1).length;
 const topContractors=safetyCounts(rows,'contractor').slice(0,7),topViolations=safetyCounts(rows,'violation').slice(0,7),topSections=safetyCounts(rows,'violationSection').filter(x=>x[0]!=='غير محدد').slice(0,7),topWorkOrders=woCounts.filter(x=>x[1]>1).slice(0,7);
 const maxOf=a=>Math.max(1,...a.map(x=>x[1]));const miniBars=(title,items)=>`<section class="summary-box"><h3>${esc(title)}</h3>${items.length?items.map(([name,n])=>`<div class="bar-row"><div class="bar-head"><span>${esc(name)}</span><b>${fmt(n)}</b></div><div class="bar-track"><i style="width:${Math.max(5,(n/maxOf(items))*100)}%"></i></div></div>`).join(''):'<div class="none">لا توجد بيانات</div>'}</section>`;
 const chartIds=[['executionTrendChart','اتجاه مخالفات التنفيذ عبر الزمن'],['executionContractorChart','أعلى المقاولين تسجيلًا للمخالفات'],['executionViolationChart','أكثر أنواع المخالفات تكرارًا'],['executionSupervisorChart','المخالفات حسب مشرف الموقع'],['executionTypeChart','المخالفات حسب نوع أمر العمل'],['executionSectionChart','المخالفات حسب قسم المخالفة']];
 const chartCards=chartIds.map(([id,title])=>{const c=document.getElementById(id);let src='';try{src=c?.toDataURL('image/png',1)||''}catch(e){}return src?`<section class="chart-card"><h3>${esc(title)}</h3><img src="${src}" alt="${esc(title)}"></section>`:''}).join('');
 const listCols=[['date','تاريخ المخالفة'],['workOrder','أمر العمل'],['type','نوع أمر العمل'],['contractor','المقاول'],['violation','المخالفة'],['violationSection','قسم المخالفة'],['supervisor','مشرف الموقع'],['editor','محرر المخالفة'],['reason','السبب / الإفادة'],['link','الرابط']];
 const tableRows=rows.map((r,idx)=>`<tr><td class="seq">${idx+1}</td>${listCols.map(([k])=>k==='link'?`<td class="link-cell">${r.link?`<a href="${esc(r.link)}" target="_blank" rel="noopener">فتح المخالفة</a>`:'-'}</td>`:`<td>${esc(r[k]||'')}</td>`).join('')}</tr>`).join('');
 const now=new Date(),today=now.toLocaleString('ar-SA'),reportId='VD-EXE-'+now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0')+'-'+String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0'),logoUrl=location.origin+'/company-logo.png',appliedFilters=filterParts.length?esc(filterParts.join(' • ')):'جميع البيانات';
 const totalPenalty=sum(rows,'penalty');
 win.document.write(buildCorporateViolationsPdf({title:'تقرير مخالفات التنفيذ',subtitle:'تقرير تنفيذي احترافي لتحليل مخالفات التنفيذ ومناطق التركّز حسب الفلاتر المطبقة',eyebrow:'VISION DIMENSIONS • EXECUTION VIOLATIONS ANALYTICS',reportId,today,rows,workOrders,contractors,types,repeated,totalPenalty,appliedFilters,logoUrl,topContractors,topViolations,topWorkOrders,topSections,miniBars,chartCards,listCols,tableRows}));
 win.document.close();
}

function buildCorporateViolationsPdf(o){
 const penaltyKpi=o.totalPenalty?`<div class="kpi orange"><span>إجمالي الغرامات</span><b>${money(o.totalPenalty)}</b><small>حسب البيانات المفلترة</small></div>`:`<div class="kpi orange"><span>أوامر متكررة المخالفات</span><b>${fmt(o.repeated)}</b><small>أكثر من سجل</small></div>`;
 return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(o.title)} - ${o.reportId}</title><style>@page{size:A4 landscape;margin:8mm 8mm 11mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Tahoma,Arial,sans-serif;color:#f5f9ff;background:#061a31;-webkit-print-color-adjust:exact;print-color-adjust:exact}h1,h2,h3,p{margin:0}.page{position:relative;min-height:185mm;background:radial-gradient(circle at 15% 18%,rgba(0,160,198,.22),transparent 27%),radial-gradient(circle at 88% 8%,rgba(246,162,26,.14),transparent 23%),linear-gradient(135deg,#061a31 0%,#082947 48%,#06385b 100%);padding:0 0 4mm}.page-break{break-after:page;page-break-after:always}.watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}.watermark img{width:300px;opacity:.055;filter:grayscale(.1)}.page>*{position:relative;z-index:1}.top-stripe{height:7px;background:linear-gradient(90deg,#1c2868 0%,#00a0c6 55%,#f6a21a 100%);margin:-8mm -8mm 8px}.report-header{display:grid;grid-template-columns:105px 1fr 185px;gap:15px;align-items:center;border-bottom:1px solid rgba(255,255,255,.16);padding-bottom:8px}.logo-box{height:72px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(255,255,255,.96)}.logo-box img{max-width:88px;max-height:64px}.title-wrap{text-align:center}.eyebrow{font-size:7px;color:#58d9ff;letter-spacing:1.3px;font-weight:800}.title-wrap h1{font-size:20px;color:#fff;margin:3px 0}.title-wrap p,.meta{font-size:8px;color:#b8c9df}.company-name{font-size:8px;color:#ffd58f;font-weight:800;margin-top:4px}.meta{line-height:1.8;text-align:left}.meta b{color:#fff}.filters{margin:8px 0 9px;border:1px solid rgba(255,255,255,.14);background:rgba(4,22,42,.55);border-radius:9px;padding:7px 9px;font-size:8px;color:#d8e6f6}.filters b{color:#ffd58f}.section-label{display:flex;align-items:center;gap:7px;margin:9px 0 6px}.section-label i{width:7px;height:7px;border-radius:2px;background:#f6a21a}.section-label h2{font-size:11px;color:#fff}.section-label span{font-size:7px;color:#8fb0cb;margin-right:auto}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.kpi,.summary-box,.chart-card{border:1px solid rgba(255,255,255,.13);background:linear-gradient(180deg,rgba(13,50,82,.9),rgba(5,32,58,.92));box-shadow:0 8px 24px rgba(0,0,0,.16)}.kpi{position:relative;overflow:hidden;border-radius:10px;padding:8px 10px;min-height:60px}.kpi:after{content:"";position:absolute;right:0;top:0;bottom:0;width:4px;background:#19b8e6}.kpi.orange:after{background:#f6a21a}.kpi.navy:after{background:#5d78ff}.kpi span{display:block;font-size:7px;color:#b8c9df}.kpi b{display:block;font-size:18px;color:#fff;margin-top:4px}.kpi small{font-size:6.5px;color:#8fb0cb}.summary-grid{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:8px;margin-top:8px}.summary-box{border-radius:10px;padding:8px;min-height:154px}.summary-box h3,.chart-card h3{font-size:8.5px;color:#fff;margin-bottom:7px;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:5px}.bar-row{margin:0 0 5px}.bar-head{display:flex;gap:7px;justify-content:space-between;font-size:6.6px}.bar-head span{max-width:84%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar-head b{color:#58d9ff}.bar-track{height:4px;background:rgba(255,255,255,.08);border-radius:99px;margin-top:2px;overflow:hidden}.bar-track i{display:block;height:100%;background:linear-gradient(90deg,#1c2868,#19b8e6,#f6a21a);border-radius:99px}.charts-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.chart-card{border-radius:10px;padding:7px;height:82mm;break-inside:avoid}.chart-card img{width:100%;height:69mm;object-fit:contain}.section-head{display:flex;justify-content:space-between;align-items:end;margin:0 0 6px}.section-head h2{font-size:11px;color:#fff}.section-head span{font-size:7px;color:#b8c9df}.table-shell{background:rgba(255,255,255,.97);border-radius:10px;padding:5px;color:#16213f}table{width:100%;border-collapse:collapse;font-size:6.5px;table-layout:fixed;background:#fff}thead{display:table-header-group}th,td{border:1px solid #dfe5ec;padding:3.2px 2.8px;vertical-align:top;word-break:break-word;line-height:1.35}th{background:linear-gradient(180deg,#1c2868,#007fba);color:#fff;font-weight:700}th:first-child,.seq{width:20px;text-align:center}th:nth-last-child(1),.link-cell{width:55px;text-align:center}.link-cell a{display:inline-block;background:#e9f7fb;color:#006d9f;border:1px solid #a9dce9;border-radius:4px;padding:2px 4px;text-decoration:none;font-weight:700;white-space:nowrap}tbody tr:nth-child(even){background:#f6f9fc}tr{page-break-inside:avoid}.footer{position:fixed;bottom:0;left:0;right:0;height:8mm;border-top:1px solid rgba(255,255,255,.12);background:#061a31;display:flex;align-items:center;justify-content:space-between;padding:0 8mm;font-size:6px;color:#9fb4ca;z-index:3}.footer b{color:#fff}.table-note{font-size:6.5px;color:#b8c9df;margin:5px 0 0}.table-note b{color:#58d9ff}</style></head><body><div class="watermark"><img src="${o.logoUrl}"></div><div class="footer"><b>شركة أبعاد الرؤية للاستشارات الهندسية</b><span>${o.reportId}</span><span>تقرير آلي من لوحة المخالفات</span></div><main class="page page-break"><div class="top-stripe"></div><header class="report-header"><div class="logo-box"><img src="${o.logoUrl}"></div><div class="title-wrap"><div class="eyebrow">${o.eyebrow}</div><h1>${esc(o.title)}</h1><p>${esc(o.subtitle)}</p><div class="company-name">شركة أبعاد الرؤية للاستشارات الهندسية</div></div><div class="meta"><b>رقم التقرير:</b> ${o.reportId}<br><b>تاريخ الإنشاء:</b> ${esc(o.today)}<br><b>عدد السجلات:</b> ${fmt(o.rows.length)}</div></header><div class="filters"><b>نطاق التقرير والفلاتر:</b> ${o.appliedFilters}</div><div class="section-label"><i></i><h2>المؤشرات التنفيذية الرئيسية</h2><span>Executive KPIs</span></div><div class="kpis"><div class="kpi orange"><span>إجمالي المخالفات</span><b>${fmt(o.rows.length)}</b><small>حسب النطاق الحالي</small></div><div class="kpi"><span>أوامر العمل الفريدة</span><b>${fmt(o.workOrders)}</b></div><div class="kpi navy"><span>المقاولون</span><b>${fmt(o.contractors)}</b></div><div class="kpi"><span>أنواع أوامر العمل</span><b>${fmt(o.types)}</b></div>${penaltyKpi}</div><div class="section-label"><i></i><h2>ملخصات التصنيف</h2><span>Ranked summaries</span></div><div class="summary-grid">${o.miniBars('أعلى المقاولين بالمخالفات',o.topContractors)}${o.miniBars('أكثر أنواع المخالفات تكرارًا',o.topViolations)}${o.miniBars('أوامر العمل الأكثر تكرارًا',o.topWorkOrders)}</div></main><main class="page page-break"><div class="top-stripe"></div><header class="report-header"><div class="logo-box"><img src="${o.logoUrl}"></div><div class="title-wrap"><div class="eyebrow">VISUAL ANALYTICS</div><h1>التحليلات الرسومية</h1><p>الشارتات تعكس نفس الفلاتر المطبقة على التقرير</p></div><div class="meta"><b>رقم التقرير:</b> ${o.reportId}<br><b>السجلات:</b> ${fmt(o.rows.length)}</div></header><div class="charts-grid">${o.chartCards}</div></main><main class="page"><div class="top-stripe"></div><header class="report-header"><div class="logo-box"><img src="${o.logoUrl}"></div><div class="title-wrap"><div class="eyebrow">DETAILED VIOLATION REGISTER</div><h1>قائمة المخالفات حسب الفلاتر</h1><p>السجل التفصيلي وروابط المخالفات المتاحة</p></div><div class="meta"><b>عدد النتائج:</b> ${fmt(o.rows.length)}<br><b>رقم التقرير:</b> ${o.reportId}</div></header><div class="section-head"><h2>السجل التفصيلي للمخالفات</h2><span>${o.appliedFilters}</span></div><div class="table-shell"><table><thead><tr><th>#</th>${o.listCols.map(x=>`<th>${esc(x[1])}</th>`).join('')}</tr></thead><tbody>${o.tableRows}</tbody></table></div><div class="table-note">يمكن الضغط على <b>فتح المخالفة</b> عند توفر الرابط الأصلي.</div></main><script>window.onload=()=>setTimeout(()=>window.print(),900)<\/script></body></html>`;
}

function exportSafetyReportPdf(){
 if(S.current!=='safety')return;
 const rows=S.filtered||[];
 if(!rows.length){toast('لا توجد بيانات مطابقة للفلاتر لتصديرها');return;}
 const win=window.open('','_blank');
 if(!win){toast('اسمح بالنوافذ المنبثقة لتصدير PDF');return;}

 const filterParts=[];
 ['f1','f2','f3','f4','f5'].forEach(id=>{
   const el=document.getElementById(id); if(!el||!el.value)return;
   const lab=document.getElementById('fl'+id.slice(1));
   filterParts.push(`${lab?.textContent||''}: ${el.value}`);
 });
 const q=document.getElementById('globalSearch')?.value?.trim();
 if(q)filterParts.push(`البحث: ${q}`);

 const contractors=unique(rows.map(r=>r.contractor)).length;
 const workOrders=unique(rows.map(r=>r.workOrder)).length;
 const types=unique(rows.map(r=>r.type)).length;
 const woCounts=safetyCounts(rows,'workOrder').filter(x=>x[0]!=='غير محدد');
 const repeated=woCounts.filter(x=>x[1]>1).length;
 const topContractors=safetyCounts(rows,'contractor').slice(0,7);
 const topViolations=safetyCounts(rows,'violation1').slice(0,7);
 const topSupervisors=safetyCounts(rows,'supervisor').slice(0,5);
 const topWorkOrders=woCounts.filter(x=>x[1]>1).slice(0,7);
 const topContractor=topContractors[0]||['-',0], topViolation=topViolations[0]||['-',0], topSupervisor=topSupervisors[0]||['-',0];
 const maxOf=a=>Math.max(1,...a.map(x=>x[1]));
 const miniBars=(title,items)=>`<section class="summary-box"><h3>${esc(title)}</h3>${items.length?items.map(([name,n])=>`<div class="bar-row"><div class="bar-head"><span>${esc(name)}</span><b>${fmt(n)}</b></div><div class="bar-track"><i style="width:${Math.max(5,(n/maxOf(items))*100)}%"></i></div></div>`).join(''):'<div class="none">لا توجد بيانات</div>'}</section>`;

 const chartIds=[
   ['safetyTrendChart','اتجاه المخالفات عبر الزمن'],['safetyContractorChart','أعلى المقاولين تسجيلًا للمخالفات'],
   ['safetyViolationChart','أكثر أنواع المخالفات تكرارًا'],['safetySupervisorChart','المخالفات حسب مشرف الموقع'],
   ['safetyTypeChart','المخالفات حسب نوع أمر العمل'],['safetyEditorChart','المخالفات حسب محرر المخالفة']
 ];
 const chartCards=chartIds.map(([id,title])=>{
   const c=document.getElementById(id); let src='';
   try{src=c?.toDataURL('image/png',1)||'';}catch(e){}
   return src?`<section class="chart-card"><h3>${esc(title)}</h3><img src="${src}" alt="${esc(title)}"></section>`:'';
 }).join('');

 const listCols=[['date','تاريخ المخالفة'],['workOrder','أمر العمل'],['type','نوع أمر العمل'],['contractor','المقاول'],['supervisor','مشرف الموقع'],['editor','محرر المخالفة'],['violation1','المخالفة 1'],['violation2','المخالفة 2'],['reason','سبب المخالفة'],['link','الرابط']];
 const tableRows=rows.map((r,idx)=>`<tr><td class="seq">${idx+1}</td>${listCols.map(([k])=>k==='link'?`<td class="link-cell">${r.link?`<a href="${esc(r.link)}" target="_blank" rel="noopener">فتح المخالفة</a>`:'-'}</td>`:`<td>${esc(r[k]||'')}</td>`).join('')}</tr>`).join('');
 const now=new Date(), today=now.toLocaleString('ar-SA');
 const reportId='VD-SAF-'+now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0')+'-'+String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0');
 const logoUrl=location.origin+'/company-logo.png';
 const appliedFilters=filterParts.length?esc(filterParts.join(' • ')):'جميع البيانات';
 const concentration=rows.length?((topContractor[1]/rows.length)*100).toFixed(1):'0.0';

 win.document.write(buildCorporateViolationsPdf({title:'تقرير مخالفات السلامة',subtitle:'تقرير تنفيذي احترافي لقراءة اتجاهات مخالفات السلامة ومناطق التركّز حسب الفلاتر المطبقة',eyebrow:'VISION DIMENSIONS • EXECUTIVE SAFETY ANALYTICS',reportId,today,rows,workOrders,contractors,types,repeated,totalPenalty:0,appliedFilters,logoUrl,topContractors,topViolations,topWorkOrders,topSections:topSupervisors,miniBars,chartCards,listCols,tableRows}));
 win.document.close();
 return;

 win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير مخالفات السلامة - ${reportId}</title><style>
 @page{size:A4 landscape;margin:8mm 8mm 11mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Tahoma,Arial,sans-serif;color:#16213f;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}h1,h2,h3,p{margin:0}.page{position:relative;min-height:185mm}.page-break{break-after:page;page-break-after:always}.watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:-1}.watermark img{width:255px;opacity:.035;filter:grayscale(.15)}
 .top-stripe{height:7px;background:linear-gradient(90deg,#1c2868 0%,#007fba 55%,#f6a21a 100%);margin:-8mm -8mm 8px}.report-header{display:grid;grid-template-columns:105px 1fr 185px;gap:15px;align-items:center;border-bottom:1px solid #dfe6ef;padding-bottom:8px}.logo-box{height:72px;display:flex;align-items:center;justify-content:center;border:1px solid #e4eaf2;border-radius:14px;background:#fff}.logo-box img{max-width:88px;max-height:64px}.title-wrap{text-align:center}.eyebrow{font-size:7px;color:#007fba;letter-spacing:1.3px;font-weight:800}.title-wrap h1{font-size:20px;color:#1c2868;margin:3px 0}.title-wrap p{font-size:8px;color:#667085}.company-name{font-size:8px;color:#1c2868;font-weight:800;margin-top:4px}.meta{font-size:7.5px;color:#667085;line-height:1.8;text-align:left}.meta b{color:#1c2868}.filters{margin:8px 0 9px;border:1px solid #dce8ef;background:linear-gradient(90deg,#f7fbfd,#fff9ee);border-radius:9px;padding:7px 9px;font-size:8px}.filters b{color:#1c2868}
 .section-label{display:flex;align-items:center;gap:7px;margin:9px 0 6px}.section-label i{width:7px;height:7px;border-radius:2px;background:#007fba}.section-label h2{font-size:11px;color:#1c2868}.section-label span{font-size:7px;color:#98a2b3;margin-right:auto}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.kpi{position:relative;overflow:hidden;border:1px solid #e1e7ef;border-radius:10px;padding:8px 10px;background:#fff;min-height:60px}.kpi:after{content:"";position:absolute;right:0;top:0;bottom:0;width:4px;background:#007fba}.kpi.orange:after{background:#f6a21a}.kpi.navy:after{background:#1c2868}.kpi span{display:block;font-size:7px;color:#667085}.kpi b{display:block;font-size:19px;color:#1c2868;margin-top:4px}.kpi small{font-size:6.5px;color:#98a2b3}.insights{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.insight{border:1px solid #e1e7ef;border-radius:10px;padding:8px;background:#fff}.insight label{font-size:6.5px;color:#007fba;font-weight:800}.insight strong{display:block;font-size:9px;color:#1c2868;margin:4px 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.insight p{font-size:6.8px;color:#667085;line-height:1.55}.summary-grid{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:8px;margin-top:8px}.summary-box{border:1px solid #e1e7ef;border-radius:10px;padding:8px;background:rgba(255,255,255,.96);min-height:154px}.summary-box h3{font-size:8.5px;color:#1c2868;margin-bottom:7px;border-bottom:1px solid #eef2f6;padding-bottom:5px}.bar-row{margin:0 0 5px}.bar-head{display:flex;gap:7px;justify-content:space-between;align-items:center;font-size:6.6px}.bar-head span{max-width:84%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar-head b{color:#007fba}.bar-track{height:4px;background:#edf2f5;border-radius:99px;margin-top:2px;overflow:hidden}.bar-track i{display:block;height:100%;background:linear-gradient(90deg,#1c2868,#007fba,#00a0c6);border-radius:99px}
 .charts-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.chart-card{border:1px solid #e1e7ef;border-radius:10px;padding:7px;background:#fff;height:82mm;break-inside:avoid}.chart-card h3{font-size:8.5px;color:#1c2868;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid #f0f3f6}.chart-card img{width:100%;height:69mm;object-fit:contain}.section-head{display:flex;justify-content:space-between;align-items:end;margin:0 0 6px}.section-head h2{font-size:11px;color:#1c2868}.section-head span{font-size:7px;color:#667085}
 table{width:100%;border-collapse:collapse;font-size:6.5px;table-layout:fixed;background:rgba(255,255,255,.97)}thead{display:table-header-group}th,td{border:1px solid #dfe5ec;padding:3.2px 2.8px;vertical-align:top;word-break:break-word;line-height:1.35}th{background:linear-gradient(180deg,#1c2868,#22377b);color:#fff;font-weight:700;font-size:6.4px}th:first-child,.seq{width:20px;text-align:center}th:nth-last-child(1),.link-cell{width:55px;text-align:center}.link-cell a{display:inline-block;background:#e9f7fb;color:#006d9f;border:1px solid #a9dce9;border-radius:4px;padding:2px 4px;text-decoration:none;font-weight:700;white-space:nowrap}tbody tr:nth-child(even){background:#f9fbfd}tr{page-break-inside:avoid}.footer{position:fixed;bottom:0;left:0;right:0;height:8mm;border-top:1px solid #dfe6ef;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 8mm;font-size:6px;color:#7b8798}.footer b{color:#1c2868}.footer .brandline{display:flex;align-items:center;gap:5px}.footer .dot{width:5px;height:5px;border-radius:50%;background:#f6a21a}.table-note{font-size:6.5px;color:#667085;margin:5px 0 0}.table-note b{color:#007fba}@media print{a{color:#006d9f!important;text-decoration:none!important}.page{min-height:auto}}
 </style></head><body><div class="watermark"><img src="${logoUrl}"></div><div class="footer"><div class="brandline"><span class="dot"></span><b>شركة أبعاد الرؤية للاستشارات الهندسية</b></div><span>${reportId}</span><span>تقرير آلي من لوحة مخالفات السلامة</span></div>
 <main class="page page-break"><div class="top-stripe"></div><header class="report-header"><div class="logo-box"><img src="${logoUrl}"></div><div class="title-wrap"><div class="eyebrow">VISION DIMENSIONS • EXECUTIVE SAFETY ANALYTICS</div><h1>تقرير مخالفات السلامة</h1><p>تقرير تنفيذي احترافي لقراءة اتجاهات المخالفات ومناطق التركّز حسب الفلاتر المطبقة</p><div class="company-name">شركة أبعاد الرؤية للاستشارات الهندسية</div></div><div class="meta"><b>رقم التقرير:</b> ${reportId}<br><b>تاريخ الإنشاء:</b> ${esc(today)}<br><b>عدد السجلات:</b> ${fmt(rows.length)}</div></header><div class="filters"><b>نطاق التقرير والفلاتر:</b> ${appliedFilters}</div>
 <div class="section-label"><i></i><h2>المؤشرات التنفيذية الرئيسية</h2><span>Executive KPIs</span></div><div class="kpis"><div class="kpi orange"><span>إجمالي سجلات المخالفات</span><b>${fmt(rows.length)}</b><small>حسب النطاق الحالي</small></div><div class="kpi"><span>أوامر العمل الفريدة</span><b>${fmt(workOrders)}</b><small>أوامر بها مخالفات</small></div><div class="kpi navy"><span>المقاولون</span><b>${fmt(contractors)}</b><small>ضمن النتائج</small></div><div class="kpi"><span>أنواع أوامر العمل</span><b>${fmt(types)}</b><small>تنوع الأعمال</small></div><div class="kpi orange"><span>أوامر متكررة المخالفات</span><b>${fmt(repeated)}</b><small>أكثر من سجل</small></div></div>
 <div class="section-label"><i></i><h2>أبرز القراءات</h2><span>Management insights</span></div><div class="insights"><div class="insight"><label>أعلى تركّز لدى مقاول</label><strong>${esc(topContractor[0])}</strong><p>${fmt(topContractor[1])} مخالفة تمثل ${concentration}% من نتائج التقرير الحالية.</p></div><div class="insight"><label>المخالفة الأكثر تكرارًا</label><strong>${esc(topViolation[0])}</strong><p>تم تسجيلها ${fmt(topViolation[1])} مرة ضمن النطاق المختار.</p></div><div class="insight"><label>أعلى مشرف موقع حسب السجلات</label><strong>${esc(topSupervisor[0])}</strong><p>مرتبط بـ ${fmt(topSupervisor[1])} سجل مخالفة في البيانات المفلترة.</p></div></div>
 <div class="section-label"><i></i><h2>ملخصات التصنيف</h2><span>Ranked summaries</span></div><div class="summary-grid">${miniBars('أعلى المقاولين بالمخالفات',topContractors)}${miniBars('أكثر أنواع المخالفات تكرارًا',topViolations)}${miniBars('أوامر العمل الأكثر تكرارًا',topWorkOrders)}</div></main>
 <main class="page page-break"><div class="top-stripe"></div><header class="report-header"><div class="logo-box"><img src="${logoUrl}"></div><div class="title-wrap"><div class="eyebrow">VISUAL ANALYTICS</div><h1>التحليلات الرسومية</h1><p>الشارتات أدناه تعكس نفس الفلاتر المطبقة على التقرير</p></div><div class="meta"><b>رقم التقرير:</b> ${reportId}<br><b>السجلات:</b> ${fmt(rows.length)}</div></header><div class="section-label"><i></i><h2>لوحة التحليل البصري</h2><span>Charts & trends</span></div><div class="charts-grid">${chartCards}</div></main>
 <main class="page"><div class="top-stripe"></div><header class="report-header"><div class="logo-box"><img src="${logoUrl}"></div><div class="title-wrap"><div class="eyebrow">DETAILED VIOLATION REGISTER</div><h1>قائمة المخالفات حسب الفلاتر</h1><p>السجل التفصيلي مع رابط المخالفة الأصلي القابل للضغط</p></div><div class="meta"><b>عدد النتائج:</b> ${fmt(rows.length)}<br><b>رقم التقرير:</b> ${reportId}</div></header><div class="section-head"><h2>السجل التفصيلي للمخالفات</h2><span>${appliedFilters}</span></div><table><thead><tr><th>#</th>${listCols.map(x=>`<th>${esc(x[1])}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table><div class="table-note">يمكن الضغط على <b>فتح المخالفة</b> للوصول إلى الرابط الأصلي المسجل في الشيت.</div></main><script>window.onload=()=>setTimeout(()=>window.print(),900)<\/script></body></html>`);
 win.document.close();
}

function renderPermitDelayKpis(rows){
 const total=rows.length;

 const normalized=rows.map(r=>({
   row:r,
   evaluation:String(r.evaluation||'').replace(/\s+/g,' ').trim()
 }));

 const notDelayed=normalized.filter(x=>exactStatus(x.evaluation,'غير متأخر')).length;

 const delayed3=normalized.filter(x=>{
   const s=x.evaluation;
   return exactStatus(s,'متأخر (3 أيام)') ||
          exactStatus(s,'متأخر (٣ أيام)') ||
          exactStatus(s,'متأخر(3 أيام)') ||
          exactStatus(s,'متأخر(٣ أيام)');
 }).length;

 const delayed6=normalized.filter(x=>{
   const s=x.evaluation;
   return exactStatus(s,'متأخر جدا (6 أيام)') ||
          exactStatus(s,'متأخر جداً (6 أيام)') ||
          exactStatus(s,'متأخر جدا (٦ أيام)') ||
          exactStatus(s,'متأخر جداً (٦ أيام)') ||
          exactStatus(s,'متأخر جدا(6 أيام)') ||
          exactStatus(s,'متأخر جداً(6 أيام)');
 }).length;

 const cards=[
   {
     label:'غير متأخر',
     value:notDelayed,
     pct:total?(notDelayed/total*100):0,
     cls:'permit-delay-ok',
     icon:'✓'
   },
   {
     label:'متأخر (3 أيام)',
     value:delayed3,
     pct:total?(delayed3/total*100):0,
     cls:'permit-delay-late',
     icon:'↑'
   },
   {
     label:'متأخر جدا (6 أيام)',
     value:delayed6,
     pct:total?(delayed6/total*100):0,
     cls:'permit-delay-critical',
     icon:'⇈'
   }
 ];

 document.getElementById('permitDelayKpis').innerHTML=cards.map(c=>`
   <article class="permit-delay-card ${c.cls}">
     <div class="permit-delay-icon">${c.icon}</div>
     <span>${esc(c.label)}</span>
     <strong>${fmt(c.value)}</strong>
     <small>${c.pct.toFixed(1)}% من السجلات المفلترة</small>
   </article>
 `).join('');
}

function renderPageKpis(key,rows){
 const pageKpis=document.getElementById('pageKpis');
 pageKpis.classList.toggle('emergency-kpi-board',key==='emergency');

 if(key==='emergency'){
   renderEmergencyKpis(rows,pageKpis);
   return;
 }

 let cards=[['إجمالي السجلات',rows.length]];
 const add=(l,v)=>cards.push([l,v]);

 if(key==='workorders'){
   const done=rows.filter(r=>exactStatus(r.status,'تم التنفيذ'));
   const notDone=rows.filter(r=>exactStatus(r.status,'لم يتم التنفيذ'));
   const totalValue=sum(rows,'value');
   const executedValue=sum(done,'value');

   const paidRows=rows.filter(r=>isPaid(r.payment));
   const paidValue=sum(paidRows,'value');

   const executedUnpaid=done.filter(r=>!isPaid(r.payment));
   const executedUnpaidValue=sum(executedUnpaid,'value');

   const c155Ready=rows.filter(r=>isReady155(r.contractor155)).length;
   const c155NotReady=rows.filter(r=>!isReady155(r.contractor155)).length;
   const e155Ready=rows.filter(r=>isReady155(r.consultant155)).length;
   const e155NotReady=rows.filter(r=>!isReady155(r.consultant155)).length;

   const permitRequired=rows.filter(r=>String(r.permitStatus||'').trim() && !has(r.permitStatus,'لا يتطلب')).length;
   const permitMissing=rows.filter(r=>!String(r.permitStatus||'').trim() || has(r.permitStatus,'لم') || has(r.permitStatus,'لا يوجد')).length;

   add('تم التنفيذ',done.length);
   add('لم يتم التنفيذ',notDone.length);
   add('نسبة التنفيذ',pct(done.length,rows.length));

   add('الإسنادات',money(totalValue));
   add('المنفذ',money(executedValue));
   add('المسدد',money(paidValue));
   add('منفذ ولم يسدد',money(executedUnpaidValue));
   add('نسبة سعر المنفذ من الإسنادات',pct(executedValue,totalValue));
   add('نسبة المسدد من المنفذ',pct(paidValue,executedValue));

   add('155 المقاول جاهز',c155Ready);
   add('155 المقاول غير جاهز',c155NotReady);
   add('155 الاستشاري جاهز',e155Ready);
   add('155 الاستشاري غير جاهز',e155NotReady);

   add('تصاريح بلدي مسجلة',permitRequired);
   add('تصاريح بلدي غير مكتملة',permitMissing);
 }else{
   if(rows.some(r=>'status'in r)){add('مكتمل / منتهي',rows.filter(r=>has(r.status,'تم')||has(r.status,'انته')).length)}
   if(rows.some(r=>'executionStatus'in r)){add('تم التنفيذ',rows.filter(r=>exactStatus(r.executionStatus,'تم التنفيذ')).length);add('لم يتم التنفيذ',rows.filter(r=>exactStatus(r.executionStatus,'لم يتم التنفيذ')).length)}
   if(rows.some(r=>'delay'in r)){add('تأخير شديد',rows.filter(r=>has(r.delay,'تأخير شديد')).length);add('تأخير متوسط',rows.filter(r=>has(r.delay,'تأخير متوسط')).length);add('تأخير بسيط',rows.filter(r=>has(r.delay,'تأخير بسيط')).length)}
   if(key==='permits'){
     const totalPermits=rows.length;
     const noPermitRequired=rows.filter(r=>has(r.permitStatus,'لا يتطلب')).length;
     const permitRequired=rows.filter(r=>{
       const s=String(r.permitStatus||'').trim();
       return s!=='' && !has(s,'لا يتطلب');
     }).length;
     const permitUndefined=Math.max(0,totalPermits-permitRequired-noPermitRequired);

     add('أوامر عمل تتطلب تصريح',permitRequired);
     add('أوامر عمل لا تتطلب تصريح',noPermitRequired);
     add('أوامر عمل غير محدد حالة التصريح',permitUndefined);
   }else if(rows.some(r=>'permitStatus'in r)){
     add('أوامر عمل تتطلب تصريح',rows.filter(r=>{
       const s=String(r.permitStatus||'').trim();
       return s!==''&&!has(s,'لا يتطلب');
     }).length);
     add('أوامر عمل لا تتطلب تصريح',rows.filter(r=>has(r.permitStatus,'لا يتطلب')).length);
   }
   if(key==='attachments'){add('تم الرفع',rows.filter(r=>has(r.status,'تم رفع')).length);add('غير مكتمل',rows.filter(r=>!has(r.status,'تم رفع')).length)}
   if(key==='violationsCombined'){
     add('مخالفات التنفيذ',rows.length);
     add('إجمالي الغرامات على المقاول من مخالفات التنفيذ',money(sum(rows,'penalty')));
     add('مقاولون',unique(rows.map(r=>r.contractor)).length);
   }
   if(key==='safety'){
     const uniqueWorkOrders=unique(rows.map(r=>r.workOrder)).length;
     const contractors=unique(rows.map(r=>r.contractor)).length;
     const supervisors=unique(rows.map(r=>r.supervisor)).length;
     const editors=unique(rows.map(r=>r.editor)).length;
     const workTypes=unique(rows.map(r=>r.type)).length;
     const repeatedWorkOrders=Object.values(rows.reduce((o,r)=>{const k=String(r.workOrder||'').trim();if(k)o[k]=(o[k]||0)+1;return o},{})).filter(n=>n>1).length;
     const twoViolations=rows.filter(r=>String(r.violation1||'').trim()&&String(r.violation2||'').trim()).length;
     cards=[['إجمالي سجلات المخالفات',rows.length],['أوامر العمل الفريدة',uniqueWorkOrders],['المقاولون',contractors],['مشرفو المواقع',supervisors],['محررو المخالفات',editors],['أنواع أوامر العمل',workTypes],['أوامر عمل بمخالفات متكررة',repeatedWorkOrders],['سجلات تحتوي مخالفتين',twoViolations]];
   }else if(key==='executionViolations'){add('لم يرسل إيميل',rows.filter(r=>has(r.emailStatus,'لم يتم')).length);add('مقاولون',unique(rows.map(r=>r.contractor)).length)}
   if(key==='minutes'){add('إجمالي الغرامات',money(sum(rows,'penalty')));add('تم رفع PDF',rows.filter(r=>has(r.uploadStatus,'PDF')).length)}
   if(key==='finance'){add('قيمة أوامر العمل',money(sum(rows,'workOrderValue')));add('القيمة النهائية',money(sum(rows,'netValue')));add('المستحق',money(sum(rows,'due')))}
   if(key==='emergency'){
     const done=rows.filter(r=>exactStatus(r.status,'منجز')).length;
     const running=rows.filter(r=>exactStatus(r.status,'جاري التنفيذ')).length;
     const notStarted=rows.filter(r=>exactStatus(r.status,'لم يتم البدء')).length;
     const blankStatus=rows.filter(r=>!String(r.status||'').trim()).length;

     add('منجز',done);
     add('جاري التنفيذ',running);
     add('لم يتم البدء',notStarted);
     add('الفراغات',blankStatus);
     add('نسبة الإنجاز',pct(done,rows.length));
     add('الأحياء / المواقع',unique(rows.map(r=>r.location)).length);
     add('المقاولون',unique(rows.map(r=>r.contractor)).length);
     add('المهندسون الاستشاريون',unique(rows.map(r=>r.engineer)).length);
     add('أنواع الأعمال',unique(rows.map(r=>r.description)).length);
   }
   if(key==='tasks'){add('تمت المعالجة',rows.filter(r=>has(r.attachments,'تم المعالجة')||has(r.resolved,'تم')).length);add('مهندسون',unique(rows.map(r=>r.engineer)).length)}
 }

 if(key==='violationsCombined'){
   cards=cards.filter(c=>c[0]!=='إجمالي السجلات');
 }
 pageKpis.innerHTML=cards.slice(0,18).map(c=>`<article class="mini-kpi"><span>${esc(c[0])}</span><strong>${typeof c[1]==='string'?c[1]:fmt(c[1])}</strong></article>`).join('');
}

function renderEmergencyKpis(rows,root){
 const filled=(r,key)=>String(r[key]||'').trim()!=='';
 const uniq=key=>unique(rows.map(r=>r[key]).filter(v=>String(v||'').trim())).length;
 const statusCount=value=>rows.filter(r=>exactStatus(r.status,value)).length;
 const textCount=(key,value)=>rows.filter(r=>exactStatus(r[key],value)).length;
 const validDurations=(fromKey,toKey)=>rows.map(r=>{
   const from=parseDashboardDate(r[fromKey]);
   const to=parseDashboardDate(r[toKey]);
   if(!from||!to)return null;
   const days=(to-from)/86400000;
   return days>=0?days:null;
 }).filter(v=>v!==null);
 const avgDays=values=>values.length?(values.reduce((a,b)=>a+b,0)/values.length):null;
 const durationText=values=>{
   const avg=avgDays(values);
   if(avg===null)return '—';
   if(avg<1)return `${(avg*24).toFixed(1)} ساعة`;
   return `${avg.toFixed(1)} يوم`;
 };
 const today=new Date();
 const isSameDay=(a,b)=>a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
 const assignedToday=rows.filter(r=>isSameDay(parseDashboardDate(r.assignedDate),today)).length;
 const assignedThisMonth=rows.filter(r=>{
   const d=parseDashboardDate(r.assignedDate);
   return d&&d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth();
 }).length;
 const sameDayCompleted=rows.filter(r=>isSameDay(parseDashboardDate(r.assignedDate),parseDashboardDate(r.endDate))).length;
 const done=statusCount('منجز');
 const running=statusCount('جاري التنفيذ');
 const notStarted=statusCount('لم يتم البدء');
 const blankStatus=rows.filter(r=>!filled(r,'status')).length;
 const scheduled=textCount('emergencyType','مجدول');
 const urgent=textCount('emergencyType','طارئ');
 const unclassifiedEmergency=Math.max(0,rows.length-scheduled-urgent);
 const archiveIsDone=row=>{
   const value=String(row.archive||'').replace(/\s+/g,' ').trim();
   if(!value)return false;
   return !/(^|\s)(لا|لم|غير)(\s|$)|غير مكتمل|ناقص/.test(value);
 };
 const archived=rows.filter(archiveIsDone).length;
 const notArchived=rows.length-archived;
 const responseDurations=validDurations('assignedDate','startDate');
 const executionDurations=validDurations('startDate','endDate');
 const totalDurations=validDurations('assignedDate','endDate');
 const groups=[
   {title:'الحالة والإنجاز',tone:'status',cards:[
     ['إجمالي الإشعارات',rows.length,'كامل النطاق المفلتر'],
     ['الإشعارات الفريدة',uniq('noticeNo'),'حسب رقم المهمة / الإشعار'],
     ['منجز',done,pct(done,rows.length)],
     ['جاري التنفيذ',running,pct(running,rows.length)],
     ['لم يتم البدء',notStarted,pct(notStarted,rows.length)],
     ['الفراغات',blankStatus,pct(blankStatus,rows.length)],
     ['نسبة الإنجاز',pct(done,rows.length),'من إجمالي الإشعارات'],
     ['إجمالي غير المنجز',running+notStarted+blankStatus,'جاري التنفيذ + لم يبدأ + الفراغات']
   ]},
   {title:'المتابعة الزمنية',tone:'time',cards:[
     ['مسند اليوم',assignedToday,'حسب تاريخ الإسناد'],
     ['مسند هذا الشهر',assignedThisMonth,'حسب تاريخ الإسناد'],
     ['تمت مباشرة العمل',rows.filter(r=>filled(r,'startDate')).length,pct(rows.filter(r=>filled(r,'startDate')).length,rows.length)],
     ['لم تبدأ بعد',rows.filter(r=>!filled(r,'startDate')).length,'لا يوجد تاريخ مباشرة'],
     ['لها تاريخ انتهاء',rows.filter(r=>filled(r,'endDate')).length,pct(rows.filter(r=>filled(r,'endDate')).length,rows.length)],
     ['إنجاز في نفس يوم الإسناد',sameDayCompleted,pct(sameDayCompleted,rows.length)],
     ['متوسط زمن المباشرة',durationText(responseDurations),`${responseDurations.length} سجل صالح`],
     ['متوسط مدة التنفيذ',durationText(executionDurations),`${executionDurations.length} سجل صالح`],
     ['متوسط الإسناد حتى الانتهاء',durationText(totalDurations),`${totalDurations.length} سجل صالح`]
   ]},
   {title:'طبيعة البلاغ والأرشفة',tone:'type',cards:[
     ['طارئ',urgent,pct(urgent,rows.length)],
     ['مجدول',scheduled,pct(scheduled,rows.length)],
     ['غير محدد مجدول/طارئ',unclassifiedEmergency,'تحتاج تصنيف'],
     ['تمت أرشفة المستندات',archived,pct(archived,rows.length)],
     ['لم تتم الأرشفة',notArchived,pct(notArchived,rows.length)],
     ['نسبة الأرشفة',pct(archived,rows.length),'من إجمالي الإشعارات']
   ]},
   {title:'التغطية التشغيلية',tone:'coverage',cards:[
     ['المحطات / المغذيات',uniq('station'),'قيم فريدة'],
     ['أوصاف الأعمال',uniq('description'),'قيم فريدة'],
     ['تصنيفات العمل',uniq('classification'),'قيم فريدة'],
     ['الأنواع',uniq('type'),'قيم فريدة'],
     ['الإدارات',uniq('administration'),'قيم فريدة'],
     ['الدوائر',uniq('circuit'),'قيم فريدة'],
     ['الأقسام',uniq('section'),'قيم فريدة'],
     ['المواقع',uniq('location'),'قيم فريدة'],
     ['الجهات الاستشارية',uniq('consultant'),'قيم فريدة'],
     ['الاستشاريون',uniq('engineer'),'أسماء فريدة'],
     ['المقاولون',uniq('contractor'),'قيم فريدة']
   ]},
   {title:'جودة واكتمال البيانات',tone:'quality',cards:[
     ['بدون رقم إشعار',rows.filter(r=>!filled(r,'noticeNo')).length,'العمود B — بيانات ناقصة'],
     ['بدون محطة / مغذي',rows.filter(r=>!filled(r,'station')).length,'العمود C — بيانات ناقصة'],
     ['بدون تاريخ إسناد',rows.filter(r=>!filled(r,'assignedDate')).length,'العمود D — بيانات ناقصة'],
     ['بدون تاريخ مباشرة العمل',rows.filter(r=>exactStatus(r.status,'منجز')&&!filled(r,'startDate')).length,'بيانات ناقصة — العمود E — للحالة منجز فقط'],
['بدون تاريخ انتهاء العمل',rows.filter(r=>exactStatus(r.status,'منجز')&&!filled(r,'endDate')).length,'بيانات ناقصة — العمود F — للحالة منجز فقط'],
     ['بدون وصف عمل',rows.filter(r=>!filled(r,'description')).length,'العمود G — بيانات ناقصة'],
     ['بدون تصنيف عمل',rows.filter(r=>!filled(r,'classification')).length,'العمود H — بيانات ناقصة'],
     ['بدون نوع',rows.filter(r=>!filled(r,'type')).length,'العمود I — بيانات ناقصة'],
     ['بدون إدارة',rows.filter(r=>!filled(r,'administration')).length,'العمود J — بيانات ناقصة'],
     ['بدون دائرة',rows.filter(r=>!filled(r,'circuit')).length,'العمود K — بيانات ناقصة'],
     ['بدون قسم',rows.filter(r=>!filled(r,'section')).length,'العمود L — بيانات ناقصة'],
     ['بدون مجدول / طارئ',rows.filter(r=>!filled(r,'emergencyType')).length,'العمود M — بيانات ناقصة'],
     ['بدون موقع',rows.filter(r=>!filled(r,'location')).length,'العمود N — بيانات ناقصة'],
     ['بدون استشاري',rows.filter(r=>!filled(r,'consultant')).length,'العمود O — بيانات ناقصة'],
     ['بدون اسم استشاري',rows.filter(r=>!filled(r,'engineer')).length,'العمود P — بيانات ناقصة'],
     ['بدون مقاول',rows.filter(r=>!filled(r,'contractor')).length,'العمود Q — بيانات ناقصة'],
     ['بدون حالة تنفيذ',rows.filter(r=>!filled(r,'status')).length,'العمود U — منجز / غير منجز'],
     ['بدون أرشفة مستندات',rows.filter(r=>!filled(r,'archive')).length,'العمود V — أرشفة المستندات']
   ]}
 ];

 root.innerHTML=groups.map(group=>`
   <section class="emergency-kpi-group emergency-kpi-${group.tone}">
     <div class="emergency-kpi-group-head"><h3>${esc(group.title)}</h3><span>${fmt(group.cards.length)} مؤشرات</span></div>
     <div class="emergency-kpi-cards">
       ${group.cards.map(card=>`<article class="mini-kpi emergency-mini-kpi"><span>${esc(card[0])}</span><strong>${typeof card[1]==='number'?fmt(card[1]):esc(card[1])}</strong><small>${esc(card[2]||'')}</small></article>`).join('')}
     </div>
   </section>
 `).join('');
}
function pickDimensions(key){
 const m={
 workorders:['section','status'],projects:['contractor','delay'],connections:['contractor','category'],permits:['permitStatus','contractor'],
 operations:['contractor','executionStatus'],closures:['section','payment'],assets:['group','approval'],emergency:['region','faultType'],
 tasks:['engineer','attachments'],attachments:['status','contractor'],safety:['contractor','violation1'],
 executionViolations:['contractor','violationSection'],minutes:['contractor','minuteType'],violationsCombined:['contractor','date'],finance:['paymentStatus','type']
 }; return m[key]||['contractor','status'];
}


function renderMonthlyExecutionViolationsChart(rows){
 const monthly={};

 rows.forEach(r=>{
   const d=parseDashboardDate(r.date);
   if(!d)return;

   const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
   if(!monthly[key]) monthly[key]={total:0,execution:0,minutes:0};

   monthly[key].total++;
   // الصفوف المدمجة تحمل نفس source حاليًا، لذلك نميز المصدر من وجود الغرامة/حقول المحضر.
   if(String(r.penalty||'').trim()!=='' || String(r.uploadStatus||'').trim()!=='') monthly[key].minutes++;
   else monthly[key].execution++;
 });

 const keys=Object.keys(monthly).sort();
 const labels=keys.map(monthLabelAr);
 const totals=keys.map(k=>monthly[k].total);
 const execution=keys.map(k=>monthly[k].execution);
 const minutes=keys.map(k=>monthly[k].minutes);

 if(S.charts.pageChart2)S.charts.pageChart2.destroy();
 const ctx=document.getElementById('pageChart2');
 if(!ctx)return;

 const valueLabels={
   id:'monthlyViolationsLabels',
   afterDatasetsDraw(chart){
     const {ctx}=chart;
     const meta=chart.getDatasetMeta(0);
     ctx.save();
     ctx.font='700 9px Cairo';
     ctx.fillStyle='#26354e';
     ctx.textAlign='center';
     meta.data.forEach((bar,i)=>ctx.fillText(fmt(totals[i]),bar.x,bar.y-8));
     ctx.restore();
   }
 };

 S.charts.pageChart2=new Chart(ctx,{
   type:'bar',
   data:{
     labels,
     datasets:[{
       label:'إجمالي مخالفات التنفيذ',
       data:totals,
       backgroundColor:'#e4505b',
       borderRadius:7,
       borderWidth:0,
       maxBarThickness:38
     }]
   },
   plugins:[valueLabels],
   options:{
     responsive:true,
     maintainAspectRatio:false,
     interaction:{mode:'index',intersect:false},
     onHover:(event,elements)=>{
       const canvas=event.native?.target||ctx;
       canvas.style.cursor=elements.length?'pointer':'default';
     },
     onClick:(event,elements)=>{
       if(!elements.length)return;
       const i=elements[0].index;
       const key=keys[i];
       toggleChartFilter('pageChart2','date',key,'شهر المخالفة','month',labels[i]);
     },
     plugins:{
       legend:{display:false},
       tooltip:{
         rtl:true,
         titleFont:{family:'Cairo'},
         bodyFont:{family:'Cairo'},
         callbacks:{
           label:c=>'الإجمالي: '+fmt(c.raw),
           afterLabel:c=>[
             'من سجل مخالفات التنفيذ: '+fmt(execution[c.dataIndex]),
             'من محاضر المخالفات: '+fmt(minutes[c.dataIndex])
           ]
         }
       }
     },
     scales:{
       x:{grid:{display:false},ticks:{font:{family:'Cairo',size:8},maxRotation:45,minRotation:0}},
       y:{beginAtZero:true,grid:{color:'#edf1f6'},ticks:{precision:0,font:{family:'Cairo',size:8}}}
     }
   }
 });
}

function parseDashboardDate(v){
 const s=String(v||'').trim();
 if(!s)return null;

 // dd/MM/yyyy أو d/M/yyyy، وكذلك الشرطات والنقاط.
 let m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s.*)?$/);
 if(m){
   const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
   return isNaN(d)?null:d;
 }

 // yyyy/MM/dd
 m=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:\s.*)?$/);
 if(m){
   const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
   return isNaN(d)?null:d;
 }

 const d=new Date(s);
 return isNaN(d)?null:d;
}

function monthLabelAr(key){
 const [y,m]=key.split('-').map(Number);
 const names=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
 return (names[m-1]||m)+' '+y;
}

function groupChart(id,type,rows,key,limit,filterField){
 const m={};
 rows.forEach(r=>{
   const x=String(r[key]||'غير محدد').trim()||'غير محدد';
   m[x]=(m[x]||0)+1;
 });

 const a=Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,limit||8);
 draw(
   id,type,
   a.map(x=>x[0]),
   a.map(x=>x[1]),
   filterField||key,
   a.map(x=>x[0]),
   a.map(x=>x[0])
 );
}

function draw(id,type,labels,values,filterField,filterValues,displayValues){
 if(S.charts[id])S.charts[id].destroy();

 const ctx=document.getElementById(id);
 if(!ctx)return;

 const palette=['#2878e8','#18aa7d','#f0a126','#7757d7','#e4505b','#22a8c5','#667ca8','#b26abc','#63b35e'];
 const active=activeChartFilter(id,S.current);

 let colors=selectedChartColors(id,labels,palette,S.current);

 // statusChart has a calculated "غير مكتمل" bucket.
 const dataset={data:values,backgroundColor:colors,borderWidth:type==='bar'?0:2,borderColor:'#fff',borderRadius:type==='bar'?7:0};

 S.charts[id]=new Chart(ctx,{
   type,
   data:{labels,datasets:[dataset]},
   options:{
     responsive:true,
     maintainAspectRatio:false,
     onHover:(event,elements)=>{
       const canvas=event.native?.target||ctx;
       canvas.style.cursor=elements.length?'pointer':'default';
     },
     onClick:(event,elements)=>{
       if(!elements.length || !filterField)return;

       const i=elements[0].index;
       const rawValue=(filterValues&&filterValues[i]!==undefined)?filterValues[i]:labels[i];
       const display=(displayValues&&displayValues[i]!==undefined)?displayValues[i]:labels[i];

       if(id==='statusChart' && rawValue==='__NOT_COMPLETED__'){
         const store=chartFilterStore('master');
         const current=store[id];
         if(current && current.mode==='not-completed'){
           delete store[id];
           renderChartFilterSummary();
           applyMasterFilters();
         }else{
           store[id]={
             field:'status',
             value:'__NOT_COMPLETED__',
             label:'حالة التنفيذ',
             mode:'not-completed',
             displayValue:'غير مكتمل'
           };
           renderChartFilterSummary();
           applyMasterFilters();
         }
         return;
       }

       toggleChartFilter(
         id,
         filterField,
         rawValue,
         LABELS[filterField]||filterField,
         'exact',
         display
       );
     },
     plugins:{
       legend:{
         display:type!=='bar',
         position:'bottom',
         labels:{boxWidth:8,usePointStyle:true,font:{family:'Cairo',size:8}}
       }
     },
     scales:type==='bar'?{
       x:{grid:{display:false},ticks:{font:{family:'Cairo',size:7},maxRotation:30}},
       y:{beginAtZero:true,grid:{color:'#edf1f6'},ticks:{font:{family:'Cairo',size:7}}}
     }:undefined
   }
 });
}

function tableHtml(rows,cols){
 if(!rows.length)return '<div class="empty">لا توجد بيانات مطابقة للفلاتر</div>';
 const head='<thead><tr>'+cols.map(c=>`<th>${esc(c.label||c[1])}</th>`).join('')+'</tr></thead>';
 const body='<tbody>'+rows.map(r=>'<tr>'+cols.map(c=>{const k=c.key||c[0],v=r[k]||'';return `<td>${cell(k,v)}</td>`}).join('')+'</tr>').join('')+'</tbody>';
 return `<table>${head}${body}</table>`;
}
function cell(k,v){
 const s=String(v||'');
 if(k==='link'){const u=s.trim();return u?`<a class="table-link" href="${esc(u)}" target="_blank" rel="noopener">فتح المخالفة</a>`:'—'} if(['status','executionStatus','delay','permitStatus','paymentStatus','approval','attachments','resolved','uploadStatus'].includes(k)){let cl=(has(s,'تم')||has(s,'Pass'))?'done':(has(s,'تأخير')||has(s,'لم')||has(s,'Fail'))?'bad':'';return `<span class="pill ${cl}">${esc(s)}</span>`} return esc(s);
}
function kpiGroupClass(k){
 const l=String(k.label||''), p=String(k.page||'');
 if(['إجمالي أوامر العمل','تم التنفيذ','غير مكتمل','نسبة الإنجاز'].includes(l)) return 'grp-work';
 if(['المشاريع','التوصيلات','العمليات'].includes(l)) return 'grp-type';
 if(l.includes('تأخير')||l.includes('أوشكت')||l.includes('متابعة استشارية')) return 'grp-delay';
 if(p==='safety'||p==='executionViolations'||p==='minutes'||p==='violationsCombined'||l.includes('مخالفات')||l.includes('غرامات')||l.includes('محاضر')) return 'grp-violations';
 if(p==='attachments'||l.includes('مرفقات')) return 'grp-attachments';
 if(l.includes('مقاولون')||l.includes('مهندسون')) return 'grp-resources';
 if(p==='emergency'||l.includes('طوارئ')) return 'grp-emergency';
 if(p==='tasks'||l.includes('مهام')||l.includes('إفادات')) return 'grp-tasks';
 return 'grp-other';
}
function formatKpi(k){if(k.isPercent)return Number(k.value||0).toFixed(1)+'%';if(k.isMoney)return money(k.value);return fmt(k.value)}
function unique(a){return [...new Set(a.map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'))}
function exactStatus(v,t){return String(v||'').replace(/\s+/g,' ').trim()===String(t||'').replace(/\s+/g,' ').trim()}
function has(v,t){return String(v||'').includes(t)}
function num(v){
 const n=Number(String(v||'')
   .replace(/,/g,'')
   .replace(/[^\d.-]/g,''));
 return isNaN(n)?0:n;
}
function pct(a,b){return (b?((Number(a)||0)/(Number(b)||0)*100):0).toFixed(1)+'%'}
function isPaid(v){
 const s=String(v||'').replace(/\s+/g,' ').trim();
 return ['تم السداد','مسدد','تم الدفع','مدفوع'].includes(s);
}
function isReady155(v){
 const s=String(v||'').replace(/\s+/g,' ').trim();
 if(!s)return false;
 return s==='جاهز'||s==='نعم'||s==='تم'||s==='مكتمل'||s==='تم الاستلام'||s==='تم الرفع';
}function fmt(v){return new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(Number(v||0))}
function money(v){return new Intl.NumberFormat('ar-SA',{notation:'compact',maximumFractionDigits:1}).format(Number(v||0))+' ر.س'}
function sum(rows,k){return rows.reduce((s,r)=>s+(Number(String(r[k]||'').replace(/,/g,'').replace(/[^\d.-]/g,''))||0),0)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}



/* Calculation help for the PDC meeting tab — aligned with the Makkah help style */
function bindMeetingCalculationHelp(){
 const modal=document.getElementById('meetingInfoModal');
 const modalTitle=document.getElementById('meetingInfoTitle');
 const modalText=document.getElementById('meetingInfoText');
 const page=document.getElementById('meetingPage');
 if(!modal||!modalText||!page)return;

 if(!document.getElementById('meetingCalcHelpRuntimeStyle')){
   const style=document.createElement('style');
   style.id='meetingCalcHelpRuntimeStyle';
   style.textContent=`
     #meetingPage .has-calc-help{position:relative!important}
     #meetingPage .calc-help-btn{position:absolute;top:6px;left:6px;z-index:9999;width:21px;height:21px;border-radius:50%;padding:0;border:1px solid rgba(47,111,178,.45);background:#fff;color:#2f6fb2;font:800 11px/1 Arial,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(26,73,120,.18);opacity:.95}
     #meetingPage .calc-help-btn:hover,#meetingPage .calc-help-btn:focus{transform:scale(1.08);background:#eaf3ff;outline:none}
     #meetingPage .calc-help-chart{top:8px;left:8px;width:23px;height:23px;font-size:12px}
     @media print{#meetingPage .calc-help-btn{display:none!important}}
   `;
   document.head.appendChild(style);
 }

 const cleanText=v=>String(v||'').replace(/\s+/g,' ').trim();
 const openHelp=(title,help)=>{
   if(modalTitle)modalTitle.textContent='ماذا يعني هذا الرقم؟ — '+title;
   modalText.textContent=help;
   modal.classList.add('show');
   modal.setAttribute('aria-hidden','false');
 };
 const addButton=(host,title,help,kind)=>{
   if(!host||host.querySelector(':scope > .calc-help-btn'))return;
   host.classList.add('has-calc-help');
   const btn=document.createElement('button');
   btn.type='button';
   btn.className='calc-help-btn calc-help-'+kind;
   btn.textContent='!';
   btn.title='ما معنى هذا الرقم وكيف تم حسابه؟';
   btn.setAttribute('aria-label','شرح معنى وحساب '+title);
   btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openHelp(title,help)});
   host.appendChild(btn);
 };
 const decorate=()=>{
   page.querySelectorAll('article.kpi-story-card,article.meeting-summary-card').forEach(el=>{
     const label=cleanText(el.querySelector(':scope > span')?.textContent)||'هذا المؤشر';
     const help=el.classList.contains('kpi-story-card')
       ? `«${label}» هو عدد الحالات التي وصلت إلى هذه المرحلة من الشجرة. النسبة الصغيرة توضح حصة هذا الفرع من إجمالي أوامر العمل وفق منهجية شجرة اجتماع الـ PDC، وتتغير الأرقام تلقائيًا مع الفلاتر.`
       : `«${label}» مؤشر مختصر محسوب من بيانات اجتماع الـ PDC وفق الشرط الموضح في منهجية الاجتماع، ويتغير تلقائيًا مع البيانات والفلاتر ذات الصلة.`;
     addButton(el,label,help,'card');
   });
   page.querySelectorAll('canvas').forEach(canvas=>{
     const host=canvas.closest('.panel')||canvas.parentElement;
     const title=cleanText(host?.querySelector('.panel-title h3,h3')?.textContent)||'هذا الشارت';
     addButton(host,title,`شارت «${title}» يجمع أوامر العمل الظاهرة حسب التصنيف الخاص به ويعرض توزيع الحالات. أي فلتر في اجتماع الـ PDC يطبق أولًا ثم يعاد حساب الشارت تلقائيًا.`,'chart');
   });
 };
 decorate();
 const observer=new MutationObserver(()=>requestAnimationFrame(decorate));
 observer.observe(page,{childList:true,subtree:true});
}

/* =========================
   THEME PICKER — 12 THEMES
   ========================= */
const DASHBOARD_THEMES=['light','lavender','purple','blue','sky','green','mint','orange','gold','pink','charcoal','navy'];
function applySavedTheme(){let t='light';try{t=localStorage.getItem('vd-dashboard-theme')||'light'}catch(e){}if(!DASHBOARD_THEMES.includes(t))t='light';setDashboardTheme(t,false)}
function setDashboardTheme(t,save=true){if(!DASHBOARD_THEMES.includes(t))t='light';document.body.classList.remove('theme-purple');if(t==='light')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',t);if(save){try{localStorage.setItem('vd-dashboard-theme',t)}catch(e){}}const s=document.getElementById('themeSelect');if(s)s.value=t;requestAnimationFrame(()=>Object.values(S.charts||{}).forEach(c=>{try{c.resize();c.update('none')}catch(e){}}))}

function showBoot(x){
 const boot=document.getElementById('boot');
 if(!boot)return;

 // بعد فتح الواجهة لأول مرة، أي تحميل لاحق يكون في الخلفية فقط.
 if(x && S.booted){
   boot.style.display='none';
   return;
 }

 boot.style.display=x?'grid':'none';

 if(!x){
   S.booted=true;
   document.body.classList.add('dashboard-ready');
 }
}
function fail(e){showBoot(false);toast('خطأ: '+(e?.message||e))}
function toast(t){const x=document.getElementById('toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),3500)}

/* =========================================================
   DASHBOARD USER PROFILE
   ========================================================= */

async function initDashboardUserProfile(){

  const profile =
    document.getElementById(
      'dashboardUserProfile'
    );

  const nameEl =
    document.getElementById(
      'dashboardUserName'
    );

  const roleEl =
    document.getElementById(
      'dashboardUserRole'
    );

  const initialEl =
    document.getElementById(
      'dashboardUserInitial'
    );

  const logoutButton =
    document.getElementById(
      'dashboardLogoutButton'
    );


  if(
    !profile ||
    !nameEl ||
    !roleEl ||
    !initialEl ||
    !logoutButton
  ){
    return;
  }


  try{

    const response =
      await fetch(
        '/api/auth/me',
        {
          credentials:'same-origin',
          cache:'no-store'
        }
      );


    if(response.status===401){

      window.location.replace('/login');

      return;
    }


    if(!response.ok){

      throw new Error(
        'Unable to load user session'
      );

    }


    const data =
      await response.json();


    if(
      !data ||
      !data.authenticated ||
      !data.user
    ){

      window.location.replace('/login');

      return;
    }


    const user=data.user;


    const displayName =
      String(
        user.name ||
        user.email ||
        ''
      ).trim();


    const displayRole =
      String(
        user.role || ''
      ).trim();


    nameEl.textContent =
      displayName || 'المستخدم';


    roleEl.textContent =
      displayRole;


    initialEl.textContent =
      displayName
        ? displayName.charAt(0)
        : 'U';


    profile.hidden=false;


  }catch(error){

    console.error(
      'User profile error:',
      error
    );

  }


  logoutButton.addEventListener(
    'click',
    async()=>{

      if(logoutButton.disabled){
        return;
      }

      logoutButton.disabled=true;

      try{

        await fetch(
          '/api/auth/logout',
          {
            method:'POST',
            credentials:'same-origin',
            headers:{
              'Content-Type':
                'application/json'
            }
          }
        );

      }catch(error){

        console.error(
          'Logout error:',
          error
        );

      }finally{

        window.location.replace(
          '/login'
        );

      }

    }
  );

}


/*
  Load authenticated user after DOM is ready.
*/

if(document.readyState==='loading'){

  document.addEventListener(
    'DOMContentLoaded',
    initDashboardUserProfile
  );

}else{

  initDashboardUserProfile();

}
