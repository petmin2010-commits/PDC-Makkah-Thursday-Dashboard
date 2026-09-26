(function(){
'use strict';
const DQ={sections:[],selected:null};
const t=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const esc=v=>t(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(Number(v||0));
const norm=v=>t(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
const blank=(r,k)=>!t(r&&r[k]);
const checked=v=>v===true||/^(true|نعم|تم|yes|1)$/i.test(t(v));
const exact=(v,x)=>norm(v)===norm(x);
const rowId=(r,section)=>t(r.workOrder||r.noticeNo)||(section==='emergency'?'إشعار':'سجل')+' — صف '+(r._row||'—');
const ctx=(r)=>t(r.contractor||r.engineer||r.location)||'—';

function missing(label,col,field,header,note){
 return {label,col,field,header,note:note||('العمود '+col+' — بيانات ناقصة'),issue:r=>blank(r,field),value:()=> 'فارغ'};
}
function custom(label,col,header,note,predicate,value){
 return {label,col,header,note,issue:predicate,value:value||(()=> '—')};
}

function definitions(q){
 return [
  {key:'projects',title:'المشاريع',subtitle:'⚡ المشاريع العام',rows:q.projects||[],cards:[
   missing('بدون مهندس مسئول','U','engineer','المهندس المسئول'),
   missing('بدون مرحلة تنفيذ','V','stage','مرحلة التنفيذ'),
   missing('بدون حالة مرحلة','W','stageStatus','حالة المرحلة'),
   missing('بدون الحفر المستهدف','X','excavationTarget','الحفر المستهدف'),
   missing('بدون التمديد المستهدف','Z','extensionTarget','التمديد المستهدف'),
   missing('بدون إفادة استشاري','AC','advice','إفادة الاستشاري'),
   custom('إفادات قديمة','AE','حالة الإفادة','العمود AE — يحسب كل إدخال غير «جديدة»',r=>!!t(r.adviceAge)&&!exact(r.adviceAge,'جديدة'),r=>t(r.adviceAge))
  ]},
  {key:'connections',title:'التوصيلات',subtitle:'🔌 التوصيلات العام',rows:q.connections||[],cards:[
   missing('بدون مهندس مسئول','V','engineer','المهندس المسئول'),
   missing('بدون مرحلة تنفيذ','W','stage','مرحلة التنفيذ'),
   missing('بدون حالة مرحلة','X','stageStatus','حالة المرحلة'),
   missing('بدون إفادة استشاري','AC','advice','إفادة الاستشاري'),
   custom('إفادات قديمة','AE','حالة الإفادة','العمود AE — يحسب كل إدخال غير «جديدة»',r=>!!t(r.adviceAge)&&!exact(r.adviceAge,'جديدة'),r=>t(r.adviceAge))
  ]},
  {key:'permits',title:'التصاريح',subtitle:'🧾 التصاريح العام',rows:q.permits||[],cards:[
   missing('بدون حالة تصريح','N','permitStatus','حالة التصريح'),
   custom('متأخر ولم يتم اتخاذ اللازم','R + T','اتخاذ اللازم للحالات المتأخرة','R يجب أن يكون ✓ عندما تكون T غير «غير متأخر»',
    r=>!!t(r.evaluation)&&!exact(r.evaluation,'غير متأخر')&&!checked(r.actionTaken),
    r=>'T: '+(t(r.evaluation)||'فارغ')+' | R: '+(checked(r.actionTaken)?'✓':'غير محدد / غير مفعّل'))
  ]},
  {key:'assets',title:'الأصول',subtitle:'🏭 الأصول',rows:q.assets||[],cards:[
   missing('بدون تاريخ تركيب المعدة','I','installDate','تاريخ تركيب المعدة'),
   missing('بدون اسم مهندس التركيب','J','engineer','اسم المهندس المسئول عن التركيب'),
   missing('بدون مراجعة بيانات الزراعة','K','plantingReview','مراجعة بيانات الزراعة'),
   missing('بدون حالة الزراعة','L','plantingStatus','حالة الزراعة'),
   missing('بدون نموذج الأصول','M','assetForm','نموذج الأصول'),
   missing('بدون إجراء 207','N','procedure207','إجراء 207'),
   missing('بدون الاستلام الميداني','O','fieldReceipt','الاستلام الميداني'),
   custom('بدون بيان تلافي الملاحظات','Q','هل تم تلافيها','العمود Q — يُحتسب فارغًا فقط عند وجود ملاحظة مكتوبة في العمود P',r=>!!t(r.notes)&&blank(r,'resolved'),()=> 'فارغ'),
   missing('بدون حالة استلام الأصول على النظام','R','systemReceipt','استلام الأصول على النظام')
  ]},
  {key:'emergency',title:'الطوارئ',subtitle:'⚠ إشعارات الطوارئ',rows:q.emergency||[],cards:[
   missing('بدون رقم إشعار','B','noticeNo','رقم الإشعار'),
   missing('بدون تاريخ إسناد','D','assignedDate','تاريخ الإسناد'),
   custom('بدون تاريخ مباشرة العمل','E','تاريخ مباشرة العمل','العمود E — مطلوب للحالة «منجز» فقط',r=>exact(r.status,'منجز')&&blank(r,'startDate'),()=> 'فارغ'),
   custom('بدون تاريخ انتهاء العمل','F','تاريخ انتهاء العمل','العمود F — مطلوب للحالة «منجز» فقط',r=>exact(r.status,'منجز')&&blank(r,'endDate'),()=> 'فارغ'),
   missing('بدون وصف عمل','G','description','وصف العمل'),
   missing('بدون تصنيف عمل','H','classification','تصنيف العمل'),
   missing('بدون نوع','I','type','النوع'),
   missing('بدون إدارة','J','administration','الإدارة'),
   missing('بدون دائرة','K','circuit','الدائرة'),
   missing('بدون قسم','L','section','القسم'),
   missing('بدون مجدول / طارئ','M','emergencyType','مجدول / طارئ'),
   missing('بدون موقع','N','location','الموقع'),
   missing('بدون استشاري','O','consultant','الاستشاري'),
   missing('بدون اسم استشاري','P','engineer','اسم الاستشاري'),
   missing('بدون مقاول','Q','contractor','المقاول'),
   missing('بدون حالة تنفيذ','U','status','حالة التنفيذ','العمود U — منجز / غير منجز'),
   missing('بدون أرشفة مستندات','V','archive','أرشفة المستندات','العمود V — أرشفة المستندات')
  ]}
 ];
}

function ensure(){
 const dataPage=document.getElementById('dataPage');if(!dataPage)return null;
 let root=document.getElementById('dataQualityDashboard');
 if(!root){
  root=document.createElement('section');
  root.id='dataQualityDashboard';
  root.className='dq-dashboard';
  root.style.display='none';
  const k=document.getElementById('pageKpis');
  dataPage.insertBefore(root,k||dataPage.firstChild);
  const detail=document.getElementById('dataTable')?.closest('.panel');
  if(detail)detail.classList.add('dq-generic-detail');
 }
 return root;
}

function issueRows(section,card){return section.rows.filter(card.issue)}
function sectionStats(section){
 const affected=new Set(),counts=[];
 section.cards.forEach(card=>{
  const rows=issueRows(section,card);counts.push(rows.length);
  rows.forEach(r=>affected.add(r._row));
 });
 const issues=counts.reduce((a,b)=>a+b,0);
 const totalCells=section.rows.length*section.cards.length;
 const completionRate=totalCells?((totalCells-issues)/totalCells)*100:100;
 return {issues,affected:affected.size,counts,totalCells,completionRate};
}

function renderDetails(section,card){
 const root=document.getElementById('dqIssueDetails');if(!root)return;
 const rows=issueRows(section,card);
 root.innerHTML=`
  <div class="dq-detail-head">
   <div><span>ISSUE DRILLDOWN</span><h3>${esc(section.title)} — ${esc(card.label)}</h3><small>${esc(card.note)}</small></div>
   <div class="dq-detail-count">${fmt(rows.length)} حالة</div>
  </div>
  ${rows.length? `<div class="dq-table-wrap"><table><thead><tr><th>#</th><th>صف الشيت</th><th>المعرف</th><th>المقاول / المسؤول</th><th>القيمة الحالية</th><th>قاعدة الجودة</th></tr></thead><tbody>
   ${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r._row||'—')}</td><td><b>${esc(rowId(r,section.key))}</b></td><td>${esc(ctx(r))}</td><td>${esc(card.value(r))}</td><td>${esc(card.note)}</td></tr>`).join('')}
  </tbody></table></div>` : '<div class="dq-empty">لا توجد حالات مخالفة لهذه القاعدة حاليًا.</div>'}`;
 root.scrollIntoView({behavior:'smooth',block:'start'});
}

function render(){
 const root=ensure();if(!root)return;
 const q=S.page&&S.page.quality?S.page.quality:{};
 const sections=definitions(q);DQ.sections=sections;
 const stats=sections.map(sectionStats);
 const totalIssues=stats.reduce((s,x)=>s+x.issues,0);
 const totalAffected=stats.reduce((s,x)=>s+x.affected,0);

 root.innerHTML=`
 <section class="dq-hero">
  <div><span>DATA QUALITY CONTROL</span><h2>مركز مراقبة جودة البيانات</h2><p>مراقبة مباشرة لنواقص الإدخال وقواعد الجودة في المشاريع والتوصيلات والتصاريح والأصول والطوارئ. اضغط على أي كارت لعرض السجلات التي تحتاج معالجة.</p></div>
  <div class="dq-hero-score"><strong>${fmt(totalIssues)}</strong><span>ملاحظات جودة</span><small>${fmt(totalAffected)} حالات متأثرة عبر الأقسام</small></div>
 </section>
 <section class="dq-overview">
  ${sections.map((s,i)=>`<button class="dq-overview-card" type="button" data-go="${esc(s.key)}"><span>${esc(s.title)}</span><strong>${fmt(stats[i].issues)}</strong><small>${fmt(stats[i].affected)} سجل متأثر</small></button>`).join('')}
 </section>
 ${sections.map((section,si)=>`
 <section class="dq-section" id="dq-${esc(section.key)}">
  <div class="dq-section-head"><div><span>${esc(section.subtitle)}</span><h3>${esc(section.title)}</h3></div><div class="dq-section-metrics"><div><b>${fmt(stats[si].issues)}</b><small>ملاحظات جودة</small></div><div class="dq-quality-rate"><b>${stats[si].completionRate.toFixed(1)}%</b><small>نسبة جودة البيانات</small><em>${fmt(stats[si].totalCells-stats[si].issues)} / ${fmt(stats[si].totalCells)} خلية مكتملة</em></div></div></div>
  <div class="dq-cards">
   ${section.cards.map((card,ci)=>{const count=stats[si].counts[ci];return `
    <button type="button" class="dq-card ${count?'has-issue':'is-ok'}" data-si="${si}" data-ci="${ci}" title="${esc(card.note)}">
     <i>i</i><span>${esc(card.label)}</span><strong>${fmt(count)}</strong><small>العمود ${esc(card.col)} — ${esc(card.header)}</small>
    </button>`}).join('')}
  </div>
 </section>`).join('')}
 <section id="dqIssueDetails" class="dq-details">
  <div class="dq-detail-placeholder"><b>تفاصيل الحالات</b><span>اضغط على أي كارت أعلاه لعرض الصفوف التي تحتاج مراجعة.</span></div>
 </section>`;

 root.querySelectorAll('.dq-card').forEach(btn=>btn.addEventListener('click',()=>{
  const s=sections[Number(btn.dataset.si)],c=s.cards[Number(btn.dataset.ci)];
  renderDetails(s,c);
 }));
 root.querySelectorAll('.dq-overview-card').forEach(btn=>btn.addEventListener('click',()=>{
  document.getElementById('dq-'+btn.dataset.go)?.scrollIntoView({behavior:'smooth',block:'start'});
 }));
}

function sync(){
 const dataPage=document.getElementById('dataPage'),root=ensure();if(!dataPage||!root)return;
 const on=typeof S!=='undefined'&&S.current==='dataQuality';
 dataPage.classList.toggle('data-quality-mode',on);
 root.style.display=on?'block':'none';
 document.getElementById('filterBar')?.classList.toggle('dq-filter-hidden',on);
 if(on)render();
}

ensure();
if(typeof renderDataPage==='function'){
 const base=renderDataPage;
 renderDataPage=function(){base.apply(this,arguments);sync()};
}
if(typeof openPage==='function'){
 const baseOpenPage=openPage;
 window.openPage=function(key){
  if(key!=='dataQuality'){
   document.getElementById('dataPage')?.classList.remove('data-quality-mode');
   document.getElementById('dataQualityDashboard')?.style.setProperty('display','none');
   document.getElementById('filterBar')?.classList.remove('dq-filter-hidden');
  }
  return baseOpenPage.apply(this,arguments);
 };
}
window.renderDataQualityDashboard=sync;
})();