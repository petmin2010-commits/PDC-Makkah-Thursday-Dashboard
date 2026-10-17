(()=>{'use strict';
 const PAGE='pdcMeeting2Page',NAV='pdcMeeting2Nav',API='/api/pdc-meeting-2/summary';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const fmt=n=>n==null?'—':Number(n).toLocaleString('en-US');
 let active=false,last=null,loading=false;
 const period=()=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const d={};parts.forEach(x=>{if(x.type!=='literal')d[x.type]=x.value});
  const t=new Date(Date.UTC(+d.year,+d.month-1,+d.day)),day=t.getUTCDay(),back=(day-4+7)%7;
  t.setUTCDate(t.getUTCDate()-back);const end=t.toISOString().slice(0,10);t.setUTCDate(t.getUTCDate()-6);
  return {from:t.toISOString().slice(0,10),to:end};
 };
 const metric=(name,value,sub='')=>'<article class="pm2-metric"><span>'+esc(name)+'</span><strong>'+fmt(value)+'</strong><small>'+esc(sub)+'</small></article>';
 const message=(title,status)=>'<div class="pm2-source"><b>'+esc(title)+'</b><span class="'+(status.available?'ok':'missing')+'">'+(status.available?'متاح':'غير مكتمل')+'</span><p>'+esc(status.available?(status.week||status.source||status.from||'مصدر متصل'):(status.reason||'مصدر غير متاح'))+'</p></div>';
 function bars(title,arr){
  const rows=(arr||[]).slice(0,12),max=Math.max(1,...rows.map(x=>+x.value||0));
  return '<section class="pm2-chart"><h3>'+esc(title)+'</h3>'+(rows.length?rows.map(x=>
   '<div class="pm2-bar"><div><span>'+esc(x.label)+'</span><b>'+fmt(x.value)+'</b></div><i><em style="width:'+((+x.value||0)/max*100).toFixed(2)+'%"></em></i></div>').join(''):'<p class="pm2-muted">لا توجد بيانات قابلة للعرض.</p>')+'</section>';
 }
 function update(){
  const root=$('pm2Results');if(!root||!last)return;
  const a=last;
  $('pm2Snapshot').textContent='تاريخ القراءة: '+new Date(a.updatedAt).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'})+' — تقرير الفترة المختارة، أما مؤشرات أوامر العمل فهي الحالة الحالية';
  root.innerHTML='<section class="pm2-section"><header><h3>1. الإنشاءات وأوامر العمل</h3><small>الورقة الحية — بدون احتساب الأمر المكرر أكثر من مرة</small></header>'+
   '<div class="pm2-metrics">'+metric('إجمالي أوامر العمل',a.construction.total)+metric('تم التنفيذ',a.construction.completed)+metric('جار العمل (حالة صريحة)',a.construction.inProgress)+metric('لم يتم البدء (حالة صريحة)',a.construction.notStarted)+metric('مستلم 155',a.construction.received155)+'</div>'+
   '<div class="pm2-two">'+bars('توزيع الأوامر حسب القسم',a.construction.bySection)+bars('أعلى المقاولين حسب عدد الأوامر',a.construction.byContractor)+'</div></section>'+
   '<section class="pm2-section"><header><h3>2. التصاريح والطوارئ</h3><small>تحديث مباشر من الورقتين</small></header>'+
   '<div class="pm2-metrics">'+metric('التصاريح المسجلة',a.permits.available?a.permits.total:null)+metric('إشعارات الطوارئ',a.emergency.available?a.emergency.total:null)+metric('الطوارئ المنجزة',a.emergency.available?a.emergency.completed:null)+metric('الطوارئ المجدولة',a.emergency.available?a.emergency.scheduled:null)+'</div>'+
   '<div class="pm2-two">'+bars('حالات التصاريح',a.permits.byStatus)+bars('أعلى مقاولي الطوارئ',a.emergency.byContractor)+'</div></section>'+
   '<section class="pm2-section"><header><h3>3. السلامة والجودة</h3><small>تقارير الإجراءات التصحيحية المحفوظة للفترة نفسها</small></header>'+
   '<div class="pm2-metrics">'+metric('زيارات السلامة',a.safety.available?a.safety.visits:null)+metric('ملاحظات السلامة',a.safety.available?a.safety.findings:null)+metric('زيارات الجودة',a.quality.available?a.quality.visits:null)+metric('ملاحظات الجودة',a.quality.available?a.quality.findings:null)+'</div>'+
   '<div class="pm2-two">'+bars('ملاحظات السلامة حسب المقاول',a.safety.byContractor)+bars('ملاحظات الجودة حسب المقاول',a.quality.byContractor)+'</div></section>'+
   '<section class="pm2-section"><header><h3>4. البيانات اليدوية المؤقتة</h3><small>كل قيمة مرتبطة بالأسبوع المختار، مع توثيق المصدر</small></header>'+
   '<div class="pm2-metrics">'+metric('ما تم اعتماد كمياته',a.financial.approvedQuantities,a.financial.available?'إدخال يدوي':'غير مدخل')+
   metric('المستخلصات',a.financial.paymentCertificates)+metric('أوامر الشراء',a.financial.purchaseOrders)+
   metric('نسبة الصرف %',a.financial.paymentRate)+metric('مواقع المولدات الحالية',a.generators.currentSites)+
   metric('مواقع المولدات المغلقة',a.generators.closedSites)+metric('الكابلات المؤقتة',a.generators.temporaryCables)+
   metric('المولدات الإجمالية',a.generators.generatorsTotal)+'</div>'+
   '<div class="pm2-two">'+bars('الاتجاه الشهري للإشعارات',a.financial.noticesByMonth?.map(x=>({label:x.month,value:x.count})))+
   bars('الإنجاز الأسبوعي واستلام 155',[
    {label:'توصيلات منفذة',value:a.weekly.completedConnections},{label:'مشاريع منفذة',value:a.weekly.completedProjects},
    {label:'توصيلات مستلمة 155',value:a.weekly.receivedConnections155},{label:'مشاريع مستلمة 155',value:a.weekly.receivedProjects155}
   ].filter(x=>x.value!==null&&x.value!==undefined))+'</div>'+
   (a.generators.finding||a.generators.correctiveAction||a.generators.observations?
      '<div class="pm2-case"><h3>ملاحظات المؤقتات والمولدات</h3><p>'+esc(a.generators.observations||'')+'</p>'+
      '<p><b>رقم أمر العمل:</b> '+esc(a.generators.workOrder||'—')+' | <b>المقاول:</b> '+esc(a.generators.contractor||'—')+' | <b>الموقع:</b> '+esc(a.generators.location||'—')+'</p>'+
      '<p><b>الملاحظة:</b> '+esc(a.generators.finding||'—')+'</p><p><b>التصحيح:</b> '+esc(a.generators.correctiveAction||'—')+'</p></div>':'')+
    '</section>'+
   '<section class="pm2-section"><header><h3>5. مطابقة الشرائح الـ 44 ومصادر البيانات</h3></header><div class="pm2-sources">'+
   message('الشرائح 1–2 | الإنشاءات',a.construction)+message('الشريحة 3 | التصاريح',a.permits)+message('الشريحتان 4–5 | الطوارئ',a.emergency)+
   message('الشريحة 6 | الإنجاز الأسبوعي',a.weekly)+message('الشرائح 7–24 | السلامة',a.safety)+message('الشرائح 25–38 | الجودة',a.quality)+
   message('بيانات المستخلصات وأوامر الشراء',a.financial)+message('الشرائح 39–44 | المؤقتات والمولدات',a.generators)+'</div></section>';
  $('pm2ExportsNote').textContent=a.exports.reason;
  $('pm2ExportPptx').disabled=!a.exports.pptxReady;
  $('pm2ExportPdf').disabled=!a.exports.pdfReady;
 }
 async function refresh(){
  if(!active||loading)return;const from=$('pm2From')?.value,to=$('pm2To')?.value;
  if(!from||!to||from>to){$('pm2Status').textContent='يرجى اختيار فترة صحيحة';return}
  loading=true;$('pm2Refresh').disabled=true;$('pm2Status').textContent='جار قراءة المصادر الحية...';
  try{const r=await fetch(API+'?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to),{credentials:'same-origin',cache:'no-store'});
   const json=await r.json();if(!r.ok||!json.ok)throw Error(json.error||'تعذر القراءة');
   last=json;update();document.dispatchEvent(new CustomEvent('pm2:summary-loaded',{detail:json}));$('pm2Status').textContent='تم تحديث البيانات';
  }catch(e){$('pm2Status').textContent='تعذر التحديث: '+String(e.message||e);}
  finally{loading=false;$('pm2Refresh').disabled=false;}
 }
 function show(){
  active=true;document.querySelectorAll('main .page').forEach(e=>e.classList.remove('active'));
  $(PAGE).classList.add('active');document.querySelectorAll('#nav .nav-item').forEach(x=>x.classList.toggle('active',x.id===NAV));
  if($('pageTitle'))$('pageTitle').textContent='اجتماع PDC 2';
  if($('filterBar'))$('filterBar').style.display='none';
  document.body.classList.add('pm2-active');
  if(!last)refresh();else update();
 }
 function hide(){active=false;$(PAGE)?.classList.remove('active');document.body.classList.remove('pm2-active');}
 function init(){
  const nav=$(NAV),main=document.querySelector('main');if(!nav||!main||$(PAGE))return;
  const section=document.createElement('section');section.id=PAGE;section.className='page pm2-page';
  section.innerHTML='<div class="pm2-head"><div><small>PDC | WEEKLY CONSOLIDATED REPORT</small><h2>اجتماع PDC 2</h2><p>تجميع مباشر لمؤشرات الإنشاءات والتصاريح والطوارئ وتقارير السلامة والجودة، باستخدام العرض المرجعي المعتمد المكون من 44 شريحة.</p></div><span class="pm2-count">44 شريحة في القالب</span></div>'+
   '<div class="pm2-panel pm2-tools"><label>من تاريخ <input id="pm2From" type="date"></label><label>إلى تاريخ <input id="pm2To" type="date"></label><button type="button" id="pm2Refresh">تحديث البيانات</button><span id="pm2Status"></span></div>'+
   '<p class="pm2-muted" id="pm2Snapshot"></p><div id="pm2Results"></div>'+
   '<div class="pm2-panel pm2-exports"><h3>تصدير التقرير بالفورمات الأصلي</h3><p>القالب المعتمد محفوظ كما هو دون تغيير الشعارات أو الغلاف أو الشرائح الداخلية. لا يُسمح بإصدار تقرير كامل يحمل أرقامًا أو صورًا تاريخية غير محدثة.</p><div><button type="button" id="pm2ExportPptx" disabled>تصدير PowerPoint</button><button type="button" id="pm2ExportPdf" disabled>تصدير PDF</button></div><p class="pm2-muted" id="pm2ExportsNote">تجري مطابقة مصادر التقرير.</p></div>';
  main.appendChild(section);const w=period();$('pm2From').value=w.from;$('pm2To').value=w.to;
  $('pm2Refresh').addEventListener('click',refresh);
  $('pm2From').addEventListener('change',()=>{last=null;refresh()});
  $('pm2To').addEventListener('change',()=>{last=null;refresh()});
  nav.onclick=e=>{e.stopImmediatePropagation();show();};
  document.querySelectorAll('#nav .nav-item').forEach(b=>{if(b!==nav)b.addEventListener('click',hide)});
  setInterval(()=>{if(active)refresh()},300000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();