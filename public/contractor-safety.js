(()=>{
'use strict';
const root=()=>document.getElementById('contractorSafetyRoot');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const fmt=n=>Number(n||0).toLocaleString('en-US');
const avg=x=>x.length?Math.round(x.reduce((s,v)=>s+v,0)/x.length*10)/10:null;
const state={rows:[],loaded:false,error:'',loading:false,updatedAt:'',city:'',
 selected:{contractor:null,engineer:null},dateFrom:'',dateTo:'',query:'',severity:'all',limit:150,searches:{},month:''};
const uniq=a=>[...new Set(a.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
const fmtPct=n=>n===null?'—':Number(n).toFixed(1)+'%';
function filterRows(all=state.rows){
 return all.filter(r=>{
  if(state.selected.contractor&&!state.selected.contractor.has(r.contractor))return false;
  if(state.selected.engineer&&!state.selected.engineer.has(r.engineer))return false;
  if(state.dateFrom&&(!r.date||r.date<state.dateFrom))return false;
  if(state.dateTo&&(!r.date||r.date>state.dateTo))return false;
  if(state.month&&(!r.date||!r.date.startsWith(state.month)))return false;
  if(state.severity!=='all'&&!(state.severity==='a'?r.a:state.severity==='b'?r.b:r.c))return false;
  if(state.query&&!clean([r.workOrder,r.contractor,r.engineer,...(r.violations||[]).map(v=>v.label)].join(' ')).toLowerCase().includes(state.query.toLowerCase()))return false;
  return true;
 });
}
function stats(rows){
 const map=new Map();
 rows.forEach(r=>{
  if(!map.has(r.contractor))map.set(r.contractor,{name:r.contractor,inspections:0,scores:[],violations:0,a:0,b:0,c:0});
  const x=map.get(r.contractor);x.inspections++;if(Number.isFinite(r.score))x.scores.push(r.score);
  x.violations+=r.violations.length;x.a+=r.a;x.b+=r.b;x.c+=r.c;
 });
 return [...map.values()].map(x=>({...x,score:avg(x.scores),valid:x.scores.length}))
 .sort((a,b)=>(b.score??-1)-(a.score??-1)||b.inspections-a.inspections);
}
function multiple(key,label,values){
 const s=state.selected[key],chosen=s?s.size:values.length;
 const header=s?(chosen+' من '+values.length):'الكل';
 const options=values.map(v=>'<label class="cs-choice"><input type="checkbox" data-cs-select="'+key+'" value="'+esc(v)+'"'+(!s||s.has(v)?' checked':'')+'><span>'+esc(v)+'</span></label>').join('');
 return '<details class="cs-multiple" id="cs-menu-'+key+'"><summary>'+esc(label)+' <b>'+esc(header)+'</b></summary>'+
 '<div class="cs-multiple-body"><input type="search" data-cs-choice-search placeholder="بحث داخل القائمة..."><div class="cs-choice-list">'+options+'</div></div></details>';
}
function chartBar(label,value,max,detail,action=''){
 const width=max>0?Math.max(1,Math.min(100,value/max*100)):0;
 return '<div class="cs-bar-row" '+(action?'data-cs-pick="'+esc(action)+'" role="button" tabindex="0"':'')+'><div><span>'+esc(label)+'</span><b>'+esc(detail)+'</b></div><div class="cs-track"><i style="width:'+width+'%"></i></div></div>';
}
function violationStats(rows){
 const map=new Map();
 rows.forEach(r=>(r.violations||[]).forEach(v=>{
  const k=v.number+'|'+v.label;let x=map.get(k);
  if(!x){x={...v,count:0};map.set(k,x)}
  x.count++;
 }));
 return [...map.values()].sort((a,b)=>b.count-a.count);
}
function monthsOf(rows){
 const map=new Map();
 rows.forEach(r=>{if(!/^\d{4}-\d{2}/.test(r.date||''))return;const m=r.date.slice(0,7);
  if(!map.has(m))map.set(m,{month:m,n:0,grades:[],v:0});const x=map.get(m);
  x.n++;if(Number.isFinite(r.score))x.grades.push(r.score);x.v+=r.violations.length;
 });
 return [...map.values()].sort((a,b)=>a.month.localeCompare(b.month)).slice(-12);
}
function content(rows,printing=false){
 const ranking=stats(rows),scores=rows.filter(x=>Number.isFinite(x.score)).map(x=>x.score);
 const allViolations=rows.reduce((s,r)=>s+r.violations.length,0);
 const a=rows.reduce((s,r)=>s+r.a,0),b=rows.reduce((s,r)=>s+r.b,0),c=rows.reduce((s,r)=>s+r.c,0);
 const kp=(label,value,sub)=>'<article class="cs-kpi"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><em>'+esc(sub)+'</em></article>';
 const kpis='<div class="cs-kpis">'+[
  kp('عدد المقاولين',fmt(ranking.length),'مقاول ضمن البيانات المختارة'),
  kp('عمليات فحص السلامة',fmt(rows.length),'كل فحص سجل مستقل'),
  kp('متوسط التقييم',fmtPct(avg(scores)),fmt(scores.length)+' فحصًا بدرجة صالحة'),
  kp('إجمالي المخالفات',fmt(allViolations),'إجمالي بنود بها مخالفة'),
  kp('مخالفات الوزن المرتفع A',fmt(a),'وزن البند 7')
 ].join('')+'</div>';
 const tableRows=ranking.map((x,i)=>'<tr><td>'+(i+1)+'</td><td><button type="button" class="cs-name" data-cs-pick="'+esc(x.name)+'">'+esc(x.name)+'</button></td>'+
 '<td>'+fmt(x.inspections)+'</td><td>'+fmt(x.valid)+'</td><td><b class="cs-grade">'+fmtPct(x.score)+'</b></td><td>'+fmt(x.violations)+'</td><td>'+fmt(x.a)+'</td><td>'+fmt(x.b)+'</td><td>'+fmt(x.c)+'</td></tr>').join('');
 const rankingTable='<section class="cs-panel"><h3>مصفوفة تقييم المقاولين بالسلامة</h3><p>الترتيب حسب متوسط درجات الفحوص الصالحة؛ يُعرض حجم العينة بجوار الدرجة.</p>'+
 '<div class="cs-table-wrap"><table class="cs-table"><thead><tr><th>م</th><th>المقاول</th><th>الفحوص</th><th>ذات درجة</th><th>متوسط السلامة</th><th>المخالفات</th><th>A</th><th>B</th><th>C</th></tr></thead><tbody>'+tableRows+'</tbody></table></div></section>';
 const monthList=monthsOf(rows),violations=violationStats(rows);
 const maxMonthly=Math.max(1,...monthList.map(x=>x.n));
 const monthly='<section class="cs-panel"><h3>اتجاه الفحص والتقييم الشهري</h3><p>الفحوص شهريًا؛ متوسط التقييم مستخرج من العمود F فقط.</p>'+
 monthList.map(x=>chartBar(x.month,x.n,maxMonthly,fmt(x.n)+' فحص • '+fmtPct(avg(x.grades)))).join('')+'</section>';
 const maxViol=Math.max(1,...violations.slice(0,12).map(x=>x.count));
 const top='<section class="cs-panel"><h3>أكثر بنود السلامة تسجيلًا للمخالفات</h3><p>تفاصيل أنواع المخالفات بأوزانها الأصلية في نموذج Intellect.</p>'+
 violations.slice(0,12).map(x=>chartBar(x.label,x.count,maxViol,fmt(x.count)+' • وزن '+x.weight)).join('')+'</section>';
 const aShare=allViolations?Math.round(a/allViolations*1000)/10:0;
 const bShare=allViolations?Math.round(b/allViolations*1000)/10:0;
 const cShare=allViolations?Math.round(c/allViolations*1000)/10:0;
 const severity='<section class="cs-panel"><h3>تصنيف بنود المخالفات بحسب الوزن</h3>'+
 '<div class="cs-weight-grid"><div><b>A · 7</b><strong>'+fmt(a)+'</strong><span>'+aShare+'%</span></div>'+
 '<div><b>B · 2</b><strong>'+fmt(b)+'</strong><span>'+bShare+'%</span></div>'+
 '<div><b>C · 0.5</b><strong>'+fmt(c)+'</strong><span>'+cShare+'%</span></div></div>'+
 '<p>الأوزان مستخرجة من نفس معادلات ورقة Intellect، وهي أوزان بنود الفحص وليست مخالفات مالية.</p></section>';
 const scoreMax=100;
 const scoreBars='<section class="cs-panel"><h3>المقارنة البصرية بين المقاولين</h3><p>اضغط اسم أي مقاول لتصفية كافة المؤشرات.</p>'+
 ranking.slice(0,20).map(x=>chartBar(x.name,x.score??0,scoreMax,fmtPct(x.score)+' • '+fmt(x.valid)+' فحص',x.name)).join('')+'</section>';
 const graphs='<div class="cs-grid">'+scoreBars+monthly+top+severity+'</div>';
 const limit=printing?300:state.limit;
 const sorted=[...rows].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 const detailRows=sorted.slice(0,limit).map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.workOrder)+'</td>'+
 '<td>'+esc(r.contractor)+'</td><td>'+esc(r.engineer)+'</td><td>'+fmtPct(r.score)+'</td><td>'+fmt(r.a)+'</td><td>'+fmt(r.b)+'</td><td>'+fmt(r.c)+'</td>'+
 '<td class="cs-describe">'+esc((r.violations||[]).map(x=>x.label).join('؛ ')||'لا توجد مخالفة')+'</td></tr>').join('');
 const details='<section class="cs-panel"><h3>سجل عمليات الفحص التفصيلي</h3>'+
 '<p>معروض '+fmt(Math.min(sorted.length,limit))+' فحص من أصل '+fmt(sorted.length)+'. كل زيارة فحص مستقلة حتى عند تكرار رقم أمر العمل.</p>'+
 '<div class="cs-table-wrap"><table class="cs-table cs-detail"><thead><tr><th>م</th><th>التاريخ</th><th>أمر العمل</th><th>المقاول</th><th>المهندس</th><th>الدرجة</th><th>A</th><th>B</th><th>C</th><th>بنود المخالفات</th></tr></thead><tbody>'+detailRows+'</tbody></table></div>'+
 (!printing&&limit<rows.length?'<button type="button" id="csMore" class="cs-more">عرض فحوص إضافية</button>':'')+'</section>';
 const note='<section class="cs-method"><b>منهجية احتساب التقييم</b><p>درجة كل فحص من العمود F (نسبة النموذج G × 100) كما هي في Intellect. تقييم المقاول = متوسط درجات فحوصه التي تحتوي على تقييم صالح. الفحوص بلا درجة تُحتسب ضمن عدد الفحوص ولا تدخل في المتوسط. بند «لا ينطبق» مستبعد من مقام معادلة النموذج الأصلي. الأوزان: A = 7 وB = 2 وC = 0.5. لا يعتبر هذا التقرير ترتيبًا تعاقديًا أو اعتماد جزاءات رسمية.</p></section>';
 return kpis+note+graphs+rankingTable+details;
}
function controls(){
 const contractors=uniq(state.rows.map(x=>x.contractor)),engineers=uniq(state.rows.map(x=>x.engineer));
 return '<div class="cs-filters">'+
 multiple('contractor','المقاول',contractors)+multiple('engineer','مهندس الفحص',engineers)+
 '<label>من تاريخ<input type="date" id="csFrom" value="'+esc(state.dateFrom)+'"></label>'+
 '<label>إلى تاريخ<input type="date" id="csTo" value="'+esc(state.dateTo)+'"></label>'+
 '<label>تصنيف المخالفة<select id="csSeverity"><option value="all">جميع البنود</option><option value="a"'+(state.severity==='a'?' selected':'')+'>A · وزن 7</option><option value="b"'+(state.severity==='b'?' selected':'')+'>B · وزن 2</option><option value="c"'+(state.severity==='c'?' selected':'')+'>C · وزن 0.5</option></select></label>'+
 '<label>بحث أمر عمل أو بند<input type="search" id="csQuery" value="'+esc(state.query)+'" placeholder="رقم الأمر، المقاول، المخالفة..."></label>'+
 '<button type="button" id="csReset" class="cs-secondary">مسح الفلاتر</button>'+
 (state.month?'<button type="button" id="csClearMonth" class="cs-secondary">إلغاء شهر '+esc(state.month)+'</button>':'')+
 '</div>';
}
function render(){
 const host=root();if(!host)return;
 const city=document.title.includes('جدة')?'جدة':'مكة',data=state.loaded?filterRows():[];
 const status=state.loading?'جاري تحديث بيانات Intellect...':state.error?'<span class="cs-error">'+esc(state.error)+'</span>':state.loaded?'آخر قراءة: '+esc(new Date(state.updatedAt).toLocaleString('ar-SA')):'لم تُحمّل البيانات';
 host.innerHTML='<div class="cs-report">'+
 '<header class="cs-head"><div><span>VISION DIMENSIONS • SAFETY ASSESSMENT</span><h2>تقييم المقاولين بالسلامة — '+city+'</h2><p>نتائج فحوص السلامة والجودة من ورقة Intellect المستقلة لكل مدينة.</p></div>'+
 '<div class="cs-head-actions"><button type="button" id="csRefresh" class="cs-secondary">↻ تحديث</button><button type="button" id="csExport" class="cs-primary"'+(!state.loaded?' disabled':'')+'>↓ تصدير التقرير PDF</button></div></header>'+
 '<p class="cs-source">المصدر: السلامة والجودة '+city+' / Intellect · '+status+'</p>'+
 (state.loaded?controls()+'<div class="cs-results">عدد الفحوص المطابقة: <b>'+fmt(data.length)+'</b></div>'+content(data):'')+'</div>';
 bindUi(host);
}
function bindUi(host){
 host.querySelector('#csRefresh')?.addEventListener('click',()=>load(true));
 host.querySelector('#csExport')?.addEventListener('click',()=>exportPdf(false));
 host.querySelectorAll('[data-cs-choice-search]').forEach(el=>el.addEventListener('input',()=>{
  const q=clean(el.value).toLowerCase();
  el.closest('.cs-multiple').querySelectorAll('.cs-choice').forEach(choice=>choice.hidden=!clean(choice.textContent).toLowerCase().includes(q));
 }));
 host.querySelectorAll('[data-cs-select]').forEach(el=>el.addEventListener('change',()=>{
  const key=el.dataset.csSelect,opened=el.closest('details').id;
  const checks=[...host.querySelectorAll('[data-cs-select="'+key+'"]')];
  const selected=checks.filter(x=>x.checked).map(x=>x.value);
  state.selected[key]=selected.length===checks.length?null:new Set(selected);
  render();host.querySelector('#'+opened)?.setAttribute('open','');
 }));
 host.querySelectorAll('[data-cs-pick]').forEach(el=>el.addEventListener('click',()=>{
  state.selected.contractor=new Set([el.dataset.csPick]);state.limit=150;render();
  root()?.scrollIntoView({block:'start',behavior:'smooth'});
 }));
 host.querySelector('#csMore')?.addEventListener('click',()=>{state.limit+=150;render()});
 host.querySelector('#csReset')?.addEventListener('click',()=>{
  state.selected={contractor:null,engineer:null};state.dateFrom='';state.dateTo='';state.query='';state.severity='all';state.month='';state.limit=150;render();
 });
 host.querySelector('#csClearMonth')?.addEventListener('click',()=>{state.month='';render()});
 [['csFrom','dateFrom'],['csTo','dateTo'],['csSeverity','severity']].forEach(([id,key])=>{
  host.querySelector('#'+id)?.addEventListener('change',e=>{state[key]=e.target.value;state.limit=150;render()});
 });
 let searchTimer;
 host.querySelector('#csQuery')?.addEventListener('input',e=>{
  const value=e.target.value;clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{state.query=value;state.limit=150;render();
   const input=root()?.querySelector('#csQuery');if(input){input.focus();input.setSelectionRange(value.length,value.length)}
  },300);
 });
}
let pending=null;
async function load(refresh=false){
 if(pending)return pending;
 if(state.loaded&&!refresh){render();return}
 state.loading=true;state.error='';render();
 pending=(async()=>{
  try{
   const resp=await fetch('/api/safety/contractor-evaluation'+(refresh?'?refresh=1':''),{credentials:'same-origin',cache:'no-store'});
   const data=await resp.json();if(!resp.ok||!data.ok)throw new Error(data.error||'تعذر قراءة ورقة Intellect');
   state.rows=data.rows||[];state.updatedAt=data.updatedAt;state.city=data.city;state.loaded=true;state.error='';
  }catch(e){state.error=String(e.message||e)}
  finally{state.loading=false;pending=null;render()}
 })();
 return pending;
}
function exportPdf(general=false){
 const popup=window.open('','_blank');
 if(!popup){alert('يرجى السماح بفتح نافذة تصدير PDF');return}
 popup.document.write('<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقييم المقاولين بالسلامة</title></head><body>جاري إعداد تقرير السلامة...</body></html>');
 (async()=>{
  if(!state.loaded)await load();
  if(!state.loaded){popup.document.body.textContent=state.error||'لم تتوفر بيانات التقرير';return}
  const city=document.title.includes('جدة')?'جدة':'مكة',rows=general?state.rows:filterRows();
  const title='تقييم المقاولين بالسلامة - '+city;
  const filterText=general?'تقرير عام — كل المقاولين وجميع الفترات':'تقرير حسب الفلاتر المختارة';
  const markup='<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">'+
   '<title>'+esc(title)+'</title><link rel="stylesheet" href="/contractor-safety.css?v=20261015-1"></head>'+
   '<body class="cs-print"><main class="cs-report"><header class="cs-head">'+
   '<img class="cs-print-logo" src="/company-logo.png" alt="أبعاد الرؤية"><div><span>VISION DIMENSIONS • PDC</span>'+
   '<h1>'+esc(title)+'</h1><p>'+esc(filterText)+' · المصدر Intellect · '+new Date().toLocaleString('ar-SA')+'</p></div></header>'+
   '<p class="cs-source">درجة النموذج F؛ الأوزان 7 / 2 / 0.5 — عدد الفحوص '+fmt(rows.length)+'</p>'+
   content(rows,true)+'</main></body></html>';
  popup.document.open();popup.document.write(markup);popup.document.close();
  popup.onload=()=>setTimeout(()=>popup.print(),350);
  setTimeout(()=>{try{if(popup.document.readyState==='complete')popup.print()}catch(_){}},1000);
 })();
}
function activate(){
 document.body.classList.add('contractor-safety-active');
 if(typeof S!=='undefined')S.current='contractorSafety';
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page==='contractorSafety'));
 document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
 document.getElementById('contractorSafetyPage')?.classList.add('active');
 const filter=document.getElementById('filterBar');if(filter)filter.style.display='none';
 const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='none';
 const title=document.getElementById('pageTitle');if(title)title.textContent='تقييم المقاولين بالسلامة';
 load();
}
if(typeof openPage==='function'){
 const previous=openPage;
 openPage=function(key){
  if(key==='contractorSafety'){activate();return}
  document.body.classList.remove('contractor-safety-active');
  document.getElementById('contractorSafetyPage')?.classList.remove('active');
  const filter=document.getElementById('filterBar');if(filter)filter.style.display='';
  const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='';
  return previous(key);
 };
}
window.VDContractorSafety={exportGeneral:()=>exportPdf(true),exportCurrent:()=>exportPdf(false)};
})();
