(()=>{
'use strict';
// Dynamic additions inspired by the weekly contractor safety report (pp. 7-11).
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=v=>Number(v||0).toLocaleString('en-US');
const percent=(a,b)=>b>0?(100*a/b).toFixed(1)+'%':'0.0%';
const colors=['#1262a3','#f28a28','#17a38e','#7d72c7','#e45f65'];
const priorities=[
 {number:9,title:'عدم ارتداء مهمات الوقاية الشخصية',advice:'تكثيف التوعية الميدانية والتأكد من ارتداء مهمات الوقاية الشخصية الصالحة والمطابقة للمواصفات.'},
 {number:1,title:'عدم حمل بطاقة التعميد والتأهيل',advice:'التحقق من حمل بطاقات التعميد والتأهيل قبل بدء العمل ومراجعتها خلال الجولات.'},
 {number:17,title:'عدم سلامة المعدات',advice:'تعزيز فحص وصيانة المعدات ومراجعة سلامتها قبل التشغيل.'},
 {number:3,title:'عدم التدريب على إجراءات العمل الآمن',advice:'تأكيد التدريب على إجراءات العمل الآمن وتقييم المخاطر ومراجعة فهم العاملين لها.'},
 {number:13,title:'عدم وضع حواجز الحماية في أماكنها الصحيحة',advice:'متابعة تركيب الحواجز في مواقعها الصحيحة واستكمال متطلبات العزل والحماية في الموقع.'}
];
function aggregate(rows){
 const result=new Map();
 let total=0;
 for(const row of rows||[])for(const violation of row.violations||[]){
  const no=Number(violation.number);if(!Number.isInteger(no))continue;
  const x=result.get(no)||{number:no,label:String(violation.label||'مخالفة '+no).trim(),count:0,weight:violation.weight};
  x.count++;result.set(no,x);total++;
 }
 return {total,issues:[...result.values()].sort((a,b)=>b.count-a.count||a.number-b.number),byNumber:result};
}
function empty(){return '<p class="cs-weekly-empty">لا توجد مخالفات مسجلة ضمن الفلاتر الحالية.</p>'}
function fullDistribution(agg){
 const top=Math.max(1,...agg.issues.map(x=>x.count));
 const items=agg.issues.map(x=>{
  const share=percent(x.count,agg.total);
  return '<div class="cs-weekly-type"><div class="cs-weekly-type-head"><span><b class="cs-issue-number">'+x.number+'</b> '+esc(x.label)+'</span><strong>'+format(x.count)+' <small>('+share+')</small></strong></div>'+
   '<div class="cs-weekly-track"><i style="width:'+x.count/top*100+'%"></i></div></div>';
 }).join('');
 return '<section class="cs-panel cs-weekly-long"><div class="cs-weekly-section-title"><span>WEEKLY REPORT • ALL VIOLATIONS</span>'+
  '<h3>نسب تكرار جميع أنواع المخالفات</h3><p>العدد ونسبة كل مخالفة من إجمالي '+format(agg.total)+' حالة مخالفة داخل الفترة والفلاتر الحالية. لا تُعد نسبة من إجمالي الفحوص.</p></div>'+
  (agg.total?'<div class="cs-weekly-types">'+items+'</div>':empty())+'</section>';
}
function topPie(topFive){
 const total=topFive.reduce((sum,x)=>sum+x.count,0);
 if(!total)return empty();
 const radius=65,circ=2*Math.PI*radius;
 let used=0;
 const paths=topFive.map((x,i)=>{
  const length=x.count/total*circ, offset=-used;used+=length;
  return '<circle cx="110" cy="110" r="'+radius+'" fill="none" stroke="'+colors[i]+'" stroke-width="35"'+
   ' stroke-dasharray="'+length+' '+(circ-length)+'" stroke-dashoffset="'+offset+'" transform="rotate(-90 110 110)">'+
   '<title>'+esc(x.label)+': '+format(x.count)+' ('+percent(x.count,total)+')</title></circle>';
 }).join('');
 return '<svg class="cs-weekly-pie" role="img" aria-label="توزيع أكثر خمس مخالفات تكرارًا" viewBox="0 0 220 220">'+
 '<circle cx="110" cy="110" r="'+radius+'" stroke="#e4eaf1" stroke-width="35" fill="none"/>'+paths+
 '<text x="110" y="106" text-anchor="middle" font-size="25" font-weight="800" fill="#183b61">'+format(total)+'</text>'+
 '<text x="110" y="127" text-anchor="middle" font-size="10" fill="#5e7183">تكرار ضمن الخمس</text></svg>';
}
function topFiveChart(agg){
 const top=agg.issues.slice(0,5);
 const subtotal=top.reduce((s,x)=>s+x.count,0);
 const legend=top.map((x,i)=>'<li class="cs-weekly-pie-item">'+
  '<span class="cs-weekly-swatch" style="background:'+colors[i]+'"></span>'+
  '<div><b>'+esc(x.label)+'</b><small>'+format(x.count)+' حالة • '+percent(x.count,subtotal)+' من الخمس • '+percent(x.count,agg.total)+' من الكل</small></div></li>').join('');
 return '<section class="cs-panel cs-weekly-topfive"><div class="cs-weekly-section-title"><span>WEEKLY REPORT • TOP FIVE</span>'+
  '<h3>أكبر خمس مخالفات تكرارًا</h3><p>توزيع نسبي بين المخالفات الخمس الأكثر تسجيلًا، مع بيان النسبة من جميع المخالفات.</p></div>'+
  (agg.total?'<div class="cs-weekly-pie-layout">'+topPie(top)+'<ol class="cs-weekly-legend">'+legend+'</ol></div>':empty())+'</section>';
}
function priorityInsights(agg){
 const cards=priorities.map((x,i)=>{
  const count=agg.byNumber.get(x.number)?.count||0;
  return '<article class="cs-weekly-insight"><div class="cs-weekly-insight-head">'+
   '<span class="cs-weekly-insight-number">'+String(i+1).padStart(2,'0')+'</span>'+
   '<strong>'+esc(x.title)+'</strong></div>'+
   '<p class="cs-weekly-observed">الرصد بالفترة: <b>'+format(count)+' حالة</b> · <b>'+percent(count,agg.total)+'</b> من المخالفات</p>'+
   '<p>'+esc(x.advice)+'</p></article>';
 }).join('');
 return '<section class="cs-panel cs-weekly-long cs-weekly-priorities"><div class="cs-weekly-section-title"><span>WEEKLY REPORT • FIELD ACTIONS</span>'+
 '<h3>أبرز خمس ملاحظات سلامة وإجراءات التحسين المقترحة</h3>'+
 '<p>بنود متابعة مستوحاة من التقرير الأسبوعي المرجعي؛ أعداد الرصد تُحتسب من Intellect وفق الفلاتر، والتوصيات ليست إثباتًا لسبب حدوث المخالفة.</p></div>'+
 '<div class="cs-weekly-insights">'+cards+'</div></section>';
}
function perContractor(rows){
 const groups=new Map();
 for(const r of rows||[]){
  const name=String(r.contractor||'').trim();if(!name)continue;
  if(!groups.has(name))groups.set(name,{name,inspections:0,issues:new Map(),total:0});
  const group=groups.get(name);group.inspections++;
  for(const v of r.violations||[]){
   const num=Number(v.number);
   const x=group.issues.get(num)||{number:num,label:String(v.label||'مخالفة '+num),count:0};
   x.count++;group.issues.set(num,x);group.total++;
  }
 }
 const cards=[...groups.values()].sort((a,b)=>b.total-a.total||b.inspections-a.inspections||a.name.localeCompare(b.name,'ar')).map(group=>{
  const items=[...group.issues.values()].sort((a,b)=>b.count-a.count||a.number-b.number).slice(0,5);
  const max=Math.max(1,...items.map(x=>x.count));
  const chart=items.length?items.map((x,i)=>
   '<div class="cs-contractor-issue"><div><span><b>'+x.number+'</b> '+esc(x.label)+'</span>'+
   '<strong>'+format(x.count)+' • '+percent(x.count,group.total)+'</strong></div>'+
   '<div class="cs-weekly-track"><i style="width:'+x.count/max*100+'%;background:'+colors[i]+'"></i></div></div>').join(''):empty();
  return '<article class="cs-weekly-contractor"><h4>'+esc(group.name)+'</h4>'+
   '<p>'+format(group.inspections)+' عملية فحص • '+format(group.total)+' مخالفة • أكبر خمس مخالفات</p>'+
   chart+'</article>';
 }).join('');
 return '<section class="cs-panel cs-weekly-long cs-weekly-contractors"><div class="cs-weekly-section-title"><span>WEEKLY REPORT • CONTRACTOR DRILLDOWN</span>'+
 '<h3>أكثر خمس مخالفات تكرارًا لكل مقاول</h3><p>تتغير النتائج حسب فلاتر المقاول والفترة والمهندس؛ النسبة من إجمالي مخالفات نفس المقاول.</p></div>'+
 '<div class="cs-weekly-contractor-grid">'+(cards||empty())+'</div></section>';
}
function render(rows){
 const agg=aggregate(rows);
 return '<div class="cs-weekly-report">'+
  '<header class="cs-weekly-heading"><span>SAFETY INSPECTION INSIGHTS</span><h2>تحليلات السلامة حسب الفترة — مقاولون العقد الموحد</h2>'+
  '<p>تحليل تلقائي من الفحوص المسجلة في Intellect، ولا يعيد استخدام نسب أو أرقام شهر أكتوبر الموجودة في المرجع.</p></header>'+
  '<div class="cs-weekly-objectives"><p><b>هدف التقرير:</b> قياس الالتزام بمتطلبات السلامة في مواقع عمل المقاولين.</p>'+
  '<p><b>محاور المتابعة:</b> استعراض الملاحظات المرصودة والمتكررة، وتوزيع المخالفات وتقييم المقاولين.</p>'+
  '<p><b>التعاون الميداني:</b> دعم التنسيق بين الاستشاري والمقاول لتحسين إجراءات السلامة والتأهيل والتدريب.</p></div>'+
  priorityInsights(agg)+
  '<div class="cs-weekly-overview">'+topFiveChart(agg)+fullDistribution(agg)+'</div>'+
  perContractor(rows)+'</div>';
}
window.VDSafetyWeeklyInsights={render,aggregate};
})();
