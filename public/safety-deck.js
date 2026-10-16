(()=>{
'use strict';
// Fixed 16:9, print-ready executive safety presentation, all facts derive from filtered Intellect rows.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const n=v=>Number(v||0).toLocaleString('en-US');
const pct=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
const piece=(xs,size)=>Array.from({length:Math.ceil(xs.length/size)},(_,i)=>xs.slice(i*size,(i+1)*size));
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const safeRows=rows=>Array.isArray(rows)?rows:[];
const color=['#f28a2a','#1679b1','#14a599','#786cda','#d65c67','#4b9a72','#cf8926','#2d69bb'];
function summarize(rows){
 const contractors=new Map(),issues=new Map(),monthly=new Map();
 const levels={a:0,b:0,c:0};
 let totals=0;const scores=[];
 for(const r of rows){
  const name=String(r.contractor||'غير محدد').trim();
  if(!contractors.has(name))contractors.set(name,{name,inspections:0,scores:[],violations:0,withViolation:0,issues:new Map()});
  const c=contractors.get(name);c.inspections++;
  if((r.violations||[]).length)c.withViolation++;
  if(typeof r.score==='number'&&Number.isFinite(r.score)){c.scores.push(r.score);scores.push(r.score)}
  const month=String(r.date||'').slice(0,7);
  if(/^\d{4}-\d{2}$/.test(month)){
   if(!monthly.has(month))monthly.set(month,{month,inspections:0,scores:[]});
   monthly.get(month).inspections++;
   if(Number.isFinite(r.score))monthly.get(month).scores.push(r.score);
  }
  for(const v of (r.violations||[])){
   const key=String(v.number);
   const obj=issues.get(key)||{key,label:String(v.label||'مخالفة '+key),count:0,weight:Number(v.weight)||.5};
   obj.count++;issues.set(key,obj);
   const own=c.issues.get(key)||{key,label:obj.label,count:0};own.count++;c.issues.set(key,own);
   totals++;c.violations++;
   if(Number(v.weight)===7)levels.a++;else if(Number(v.weight)===2)levels.b++;else levels.c++;
  }
 }
 const rank=[...contractors.values()].map(x=>({...x,score:avg(x.scores),valid:x.scores.length,
    top:[...x.issues.values()].sort((a,b)=>b.count-a.count).slice(0,4)}))
   .sort((a,b)=>(b.score??-1)-(a.score??-1)||b.inspections-a.inspections);
 return {rank,issues:[...issues.values()].sort((a,b)=>b.count-a.count),monthly:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)),totals,levels,scores,avgScore:avg(scores),unscored:rows.length-scores.length,visitsWithViolation:rows.filter(x=>(x.violations||[]).length).length};
}
function hCard(label,value,sub,accent){
 return '<div class="csd-kpi" style="--accent:'+accent+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></div>';
}
function bar(label,count,max,meta,col){
 return '<div class="csd-bar"><div class="csd-bar-head"><span>'+esc(label)+'</span><strong>'+esc(meta)+'</strong></div>'+
 '<div class="csd-track"><i style="width:'+(max?Math.min(100,100*count/max):0)+'%;background:'+col+'"></i></div></div>';
}
const slide=(section,title,subtitle,body)=>'<section class="csd-slide"><div class="csd-slide-top"><div><small>'+esc(section)+'</small><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p></div><b class="csd-slide-mark">VD<span>•</span>PDC</b></div><div class="csd-slide-body">'+body+'</div><footer><span>VISION DIMENSIONS · SAFETY & QUALITY · INTELLECT</span><span class="csd-page-count"></span></footer></section>';
function render(rows,meta={}){
 rows=safeRows(rows);const s=summarize(rows),city=meta.city||'مكة',range=meta.general?'كامل الفترة':'الفترة: '+(meta.period||'كامل المدة');
 const title='تقييم السلامة للمقاولين';
 const pages=[];
 pages.push('<section class="csd-slide csd-cover"><div class="csd-cover-blobs"></div>'+
 '<div class="csd-cover-stripe">PDC · SAFETY PERFORMANCE / 2026</div>'+
 '<div class="csd-cover-copy"><span class="csd-overline">VISION DIMENSIONS FOR ENGINEERING CONSULTANCY</span>'+
 '<h1>'+title+'</h1><h2>'+esc(city)+'</h2><p>تقرير السلامة والصحة المهنية لمقاولي العقد الموحد</p>'+
 '<div class="csd-cover-tags"><b>'+esc(range)+'</b><b>المصدر: Intellect</b><b>'+n(rows.length)+' فحص</b></div></div>'+
 '<div class="csd-cover-bottom"><b>أبعاد الرؤية للاستشارات الهندسية</b><span>'+new Date().toLocaleDateString('en-GB')+'</span></div></section>');
 const main=hCard('عمليات الفحص',n(rows.length),'كل زيارة فحص مستقلة',color[1])+
 hCard('المقاولون',n(s.rank.length),'ضمن الفترة المختارة',color[0])+
 hCard('متوسط التقييم',pct(s.avgScore),'من '+n(s.scores.length)+' درجة صالحة',color[2])+
 hCard('بنود المخالفات',n(s.totals),'إجمالي مخالفات البنود',color[4]);
 const levels=['A · وزن 7','B · وزن 2','C · وزن 0.5'].map((label,i)=>{
  const num=[s.levels.a,s.levels.b,s.levels.c][i];
  return '<div class="csd-level"><b>'+label+'</b><strong>'+n(num)+'</strong><span>'+pct(s.totals?num/s.totals*100:0)+' من المخالفات</span></div>';
 }).join('');
 pages.push(slide('EXECUTIVE OVERVIEW','الملخص التنفيذي','أداء السلامة والالتزام في مواقع العمل', '<div class="csd-kpis">'+main+'</div>'+
 '<div class="csd-quality-strip"><b>اكتمال درجات الفحص</b><span>'+n(s.scores.length)+' بدرجة صالحة</span><span>'+n(s.unscored)+' دون درجة صالحة ('+pct(rows.length?s.unscored/rows.length*100:0)+')</span><span>'+n(s.visitsWithViolation)+' فحصًا تضمن مخالفة ('+pct(rows.length?s.visitsWithViolation/rows.length*100:0)+')</span></div>'+
 '<div class="csd-two"><div class="csd-box"><h3>توزيع المخالفات حسب وزن البند</h3><div class="csd-levels">'+levels+'</div></div>'+
 '<div class="csd-box csd-insight"><h3>قراءة سريعة</h3><p>متوسط السلامة <strong>'+pct(s.avgScore)+'</strong> مستخرج من درجات الفحوص الصحيحة فقط.</p>'+
 '<p>تُحتسب المخالفات حسب عدد مرات رصد بنودها وليس عدد أوامر العمل.</p>'+
 '<p>نتائج الفحص تعكس الفترة المحددة، ولا تمثل اعتمادًا للجزاءات التعاقدية.</p></div></div>'));
 const rankParts=piece(s.rank,7);if(!rankParts.length)rankParts.push([]);
 for(let k=0;k<rankParts.length;k++){
  const group=rankParts[k];
  const bars=group.map((x,i)=>bar(x.name,Number(x.score)||0,100,pct(x.score)+'  ·  '+n(x.valid)+' فحص بدرجة',color[i%color.length])).join('');
  pages.push(slide('CONTRACTOR SAFETY SCORES','تقييم المقاولين','متوسط نتيجة الفحوص الصالحة · ترتيب تنازلي · '+(k+1)+' / '+rankParts.length,
   '<div class="csd-box csd-ranking">'+(bars||'<p class="csd-empty">لا توجد فحوص في الفترة المختارة.</p>')+'</div>'+
   '<div class="csd-footnote">يُعرض حجم العينة لتوضيح الفارق بين المقاولين ذوي عدد الفحوص المحدود والكبير.</div>'));
 }
 const risk=[...s.rank].sort((a,b)=>b.violations-a.violations).slice(0,5);
 const riskMax=Math.max(1,...risk.map(x=>x.violations));
 const riskBars=risk.map((x,i)=>bar(x.name,x.violations,riskMax,n(x.violations)+' مخالفة · '+pct(s.totals?x.violations/s.totals*100:0)+' من الإجمالي',color[i%color.length])).join('');
 pages.push(slide('VIOLATION CONCENTRATION','تركيز مخالفات المقاولين','المقاولون الأعلى في عدد المخالفات المرصودة · مقارنة وصفية لا تمثل جزاءات تعاقدية',
   '<div class="csd-box csd-risk">'+(riskBars||'<p class="csd-empty">لا توجد مخالفات مسجلة.</p>')+'</div>'+
   '<div class="csd-risk-foot">عدد المخالفات = مجموع البنود المخالفة عبر الزيارات؛ وقد تتضمن الزيارة الواحدة أكثر من مخالفة. لا يساوي عدد المخالفات عدد الزيارات أو عدد أوامر العمل.</div>'));
 const most=s.issues.slice(0,8),maxIssue=Math.max(1,...most.map(v=>v.count));
 const issueParts=piece(most,4);if(!issueParts.length)issueParts.push([]);
 for(let k=0;k<issueParts.length;k++){
   const issueBars=issueParts[k].map((v,i)=>bar(v.label,v.count,maxIssue,n(v.count)+' حالة · '+pct(s.totals?v.count/s.totals*100:0),color[(k*4+i)%color.length])).join('');
   pages.push(slide('VIOLATION PROFILE','الملاحظات الأكثر تكرارًا','أكثر ثمانية بنود سلامة رصدًا · '+(k+1)+' / '+issueParts.length,
   '<div class="csd-box csd-issues csd-issue-detail">'+(issueBars||'<p class="csd-empty">لا توجد مخالفات مسجلة.</p>')+'</div>'));
 }
 const monthTop=Math.max(1,...s.monthly.map(x=>x.inspections));
 const monthParts=piece(s.monthly,7);if(!monthParts.length)monthParts.push([]);
 for(let k=0;k<monthParts.length;k++){
  const monthBars=monthParts[k].map((x,i)=>bar(x.month,x.inspections,monthTop,n(x.inspections)+' فحص · '+pct(avg(x.scores)),color[(k*7+i)%color.length])).join('');
  pages.push(slide('MONTHLY TREND','اتجاه الفحص الشهري','جميع الأشهر المسجلة حسب الفترة المحددة · '+(k+1)+' / '+monthParts.length,
   '<div class="csd-box csd-issues csd-monthly">'+(monthBars||'<p class="csd-empty">لا توجد تواريخ صالحة للفترة المختارة.</p>')+'</div>'));
 }
 const recommendations=s.issues.slice(0,4).map((x,i)=>{
  let action='تكثيف الزيارات الميدانية ومتابعة تنفيذ إجراءات المعالجة وفق متطلبات السلامة.';
  if(/شرب|مياه/.test(x.label))action='التحقق من توافر مياه الشرب بكميات كافية للعاملين في مواقع العمل.';
  else if(/مظلة|حرار/.test(x.label))action='التأكد من توفير وسائل الوقاية من الإجهاد الحراري ومناطق الراحة المناسبة.';
  else if(/بطاقة|تعميد|تأهيل/.test(x.label))action='التحقق من بطاقات التعميد والتأهيل وتوثيق صلاحيتها قبل مباشرة الأعمال.';
  else if(/تصريح/.test(x.label))action='مراجعة تصاريح العمل وسريانها قبل السماح ببدء الأعمال.';
  return '<div class="csd-action"><span>'+(i+1)+'</span><div><b>'+esc(x.label)+'</b><small>'+n(x.count)+' رصد · '+pct(s.totals?x.count/s.totals*100:0)+'</small><p>'+esc(action)+'</p></div></div>';
 }).join('');
 pages.push(slide('FIELD IMPROVEMENT','أولويات التحسين','التوصيات مرتبطة بالمخالفات المسجلة وليست تشخيصًا نهائيًا للأسباب',
 '<div class="csd-actions">'+(recommendations||'<div class="csd-box"><h3>لا توجد مخالفات في الفترة المختارة</h3><p>يوصى بالاستمرار في التفتيش الوقائي وتوثيق الجولات.</p></div>')+'</div>'));
 const sortedContractors=[...s.rank].sort((a,b)=>b.violations-a.violations);
 const contractors=[];
 for(let i=0;i<sortedContractors.length;){
  const rest=sortedContractors.length-i;
  const size=rest===3?3:Math.min(2,rest);
  contractors.push(sortedContractors.slice(i,i+size));i+=size;
 }
 for(let k=0;k<contractors.length;k++){
  const cards=contractors[k].map(x=>{
   const top=x.top.map((v,i)=>bar(v.label,v.count,Math.max(1,...x.top.map(y=>y.count)),n(v.count)+' حالة',color[i%color.length])).join('');
   return '<div class="csd-contractor"><div class="csd-contractor-head"><h3>'+esc(x.name)+'</h3><p>'+n(x.inspections)+' فحص · '+pct(x.score)+' تقييم · '+n(x.violations)+' مخالفة</p></div>'+
     '<div class="csd-contractor-list">'+(top||'<p class="csd-empty">لا توجد مخالفات مسجلة.</p>')+'</div></div>';
  }).join('');
  pages.push(slide('CONTRACTOR BREAKDOWN','تفاصيل المقاولين','أكثر المخالفات لكل مقاول · '+(k+1)+' / '+contractors.length,
   '<div class="csd-contractor-grid'+(contractors[k].length===3?' csd-contractor-grid-three':contractors[k].length===1?' csd-contractor-grid-one':'')+'">'+cards+'</div>'));
 }
 if(meta.detailed){
  const details=piece([...rows].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,300),12);
  details.forEach((items,index)=>{
   const tr=items.map((r,i)=>'<tr><td>'+n(index*12+i+1)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.workOrder)+'</td><td>'+esc(r.contractor)+'</td><td>'+pct(r.score)+'</td><td>'+n((r.violations||[]).length)+'</td></tr>').join('');
   pages.push(slide('INSPECTION APPENDIX','سجل الفحوص المختصر','آخر '+n(Math.min(rows.length,300))+' فحص من إجمالي '+n(rows.length)+' · '+(index+1)+' / '+details.length,
    '<table class="csd-table"><thead><tr><th>#</th><th>التاريخ</th><th>أمر العمل</th><th>المقاول</th><th>الدرجة</th><th>بنود المخالفات</th></tr></thead><tbody>'+tr+'</tbody></table>'));
  });
 }
 pages.push(slide('METHODOLOGY','منهجية الحساب والاعتماد','مرجع احتساب مؤشرات السلامة في التقرير',
 '<div class="csd-method"><p><b>درجة الفحص:</b> تقرأ مباشرة من العمود F في Intellect.</p>'+
 '<p><b>متوسط المقاول:</b> المتوسط الحسابي للفحوص التي تحتوي على درجة صالحة، مع عرض عددها.</p>'+
 '<p><b>المخالفة:</b> كل بند مسجل عليه مخالفة يُحتسب مرة لكل زيارة فحص. قد تتكرر زيارات نفس أمر العمل.</p>'+
 '<p><b>سلامة بيانات الدرجات:</b> الفحوص بلا درجات صالحة تدخل في عدد الفحوص ولا تدخل في متوسط التقييم.</p>'+
 '<p><b>الأوزان:</b> A = 7، B = 2، C = 0.5 بحسب النموذج الأصلي. لا يترتب عليها جزاء مالي تلقائي.</p>'+
 '<p><b>المصدر:</b> السلامة والجودة '+esc(city)+' / ورقة Intellect · '+esc(range)+'</p>'+
 '</div>'));
 const total=pages.length;
 return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'+
 '<title>'+title+' - '+esc(city)+'</title><base href="'+esc(location.origin)+'/">'+
 '<link rel="stylesheet" href="/safety-deck.css?v=20261017-layout-1"></head><body>'+pages.map((x,i)=>x.replace('class="csd-page-count"></span>','class="csd-page-count">'+(i+1)+' / '+total+'</span>')).join('')+'</body></html>';
}
window.VDSafetyDeck={render,summarize};
})();
