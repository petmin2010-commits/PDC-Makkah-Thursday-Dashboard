(function(window){
'use strict';
const normalize=value=>String(value??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).toLowerCase().trim();
function dateKey(value){
 const s=normalize(value);
 let match=s.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/),year,month,day;
 if(match){year=Number(match[1]);month=Number(match[2]);day=Number(match[3]);}
 else{match=s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})/);
  if(!match)return '';day=Number(match[1]);month=Number(match[2]);year=Number(match[3]);}
 const check=new Date(Date.UTC(year,month-1,day));
 if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return '';
 return [year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
}
if(typeof module==='object'&&module.exports)module.exports={dateKey,normalize};
const document=window&&window.document;
if(!document)return;
function install(host){
 if(!host||host.querySelector('.dq-detail-filters'))return;
 const table=host.querySelector('.dq-table-wrap table');
 if(!table)return;
 const rows=[...table.querySelectorAll('tbody tr')].map(row=>({row,cells:[...row.cells].map(td=>td.textContent.trim())}));
 if(!rows.length)return;
 const headings=[...table.querySelectorAll('thead th')].map(th=>normalize(th.textContent));
 const find=(...aliases)=>headings.findIndex(h=>aliases.some(a=>normalize(a)===h));
 const columns={
  date:find('تاريخ الإفادة الجديدة','تاريخ الإفادة','تاريخ المخالفة','تاريخ المحضر','تاريخ'),
  order:find('أمر العمل','رقم أمر العمل','المعرف'),
  engineer:find('المهندس','المهندس المسؤول','المهندس المسئول'),
  source:find('المصدر','القسم'),
  stage:find('المرحلة','مرحلة التنفيذ'),
  contractor:find('المقاول','المقاول / المسؤول'),
  classification:find('التصنيف'),
  score:find('الدرجة')
 };
 const toolbar=document.createElement('section');toolbar.className='dq-detail-filters';toolbar.dir='rtl';toolbar.setAttribute('aria-label','تصفية نتائج الجدول');
 const controls={};
 function field(label,element){
  const wrap=document.createElement('label');wrap.className='dq-detail-filter';
  const text=document.createElement('span');text.textContent=label;
  element.setAttribute('aria-label',label);
  wrap.append(text,element);toolbar.append(wrap);
  return element;
 }
 function addText(key,label,placeholder){
  const input=document.createElement('input');input.type='search';input.placeholder=placeholder;input.autocomplete='off';
  controls[key]=field(label,input);input.addEventListener('input',apply);
 }
 function addSelect(key,label){
  const idx=columns[key];if(idx<0)return;
  const input=document.createElement('select');
  const all=document.createElement('option');all.value='';all.textContent='الكل';input.append(all);
  [...new Set(rows.map(r=>r.cells[idx]).filter(s=>s&&s!=='—'))]
   .sort((a,b)=>a.localeCompare(b,'ar',{numeric:true}))
   .forEach(s=>{const option=document.createElement('option');option.value=s;option.textContent=s;input.append(option)});
  controls[key]=field(label,input);input.addEventListener('change',apply);
 }
 if(columns.date>=0){
  for(const [key,label] of [['from','من تاريخ'],['to','إلى تاريخ']]){
   const input=document.createElement('input');input.type='date';controls[key]=field(label,input);input.addEventListener('change',apply);
  }
 }
 if(columns.order>=0)addText('order','أمر العمل','رقم الأمر أو جزء منه');
 addSelect('engineer','المهندس');
 addSelect('source','القسم / المصدر');
 addSelect('stage','المرحلة');
 addSelect('classification','التصنيف');
 addSelect('contractor','المقاول / المسؤول');
 if(columns.score>=0){
  const input=document.createElement('input');input.type='number';input.min=0;input.max=100;input.step=1;input.placeholder='0–100';
  controls.score=field('أقل درجة مقبولة',input);input.addEventListener('input',apply);
 }
 addText('search','بحث شامل','ابحث في جميع الأعمدة');
 const actions=document.createElement('div');actions.className='dq-detail-filter-actions';
 const output=document.createElement('output');output.className='dq-detail-filter-count';output.setAttribute('aria-live','polite');output.setAttribute('aria-atomic','true');
 const reset=document.createElement('button');reset.className='dq-detail-filter-reset';reset.type='button';reset.textContent='مسح الفلاتر';
 reset.addEventListener('click',()=>{Object.values(controls).forEach(el=>{el.value=''});apply()});
 actions.append(output,reset);toolbar.append(actions);
 const noMatch=document.createElement('p');noMatch.className='dq-detail-filter-empty';noMatch.textContent='لا توجد سجلات مطابقة للفلاتر المختارة.';noMatch.hidden=true;
 table.closest('.dq-table-wrap').before(toolbar,noMatch);
 function apply(){
  let visible=0;
  for(const record of rows){
   const cell=key=>columns[key]<0?'':record.cells[columns[key]]||'';
   let ok=true;
   if(controls.order?.value&&!normalize(cell('order')).includes(normalize(controls.order.value)))ok=false;
   for(const key of ['engineer','source','stage','classification','contractor'])
    if(controls[key]?.value&&cell(key)!==controls[key].value)ok=false;
   if(controls.from?.value||controls.to?.value){
    const date=dateKey(cell('date'));
    if(!date||(controls.from?.value&&date<controls.from.value)||(controls.to?.value&&date>controls.to.value))ok=false;
   }
   if(controls.score&&controls.score.value!==''){
    const score=Number(normalize(cell('score')).split('/')[0]);
    if(!Number.isFinite(score)||score<Number(controls.score.value))ok=false;
   }
   const q=normalize(controls.search.value);
   if(q&&!record.cells.some(value=>normalize(value).includes(q)))ok=false;
   record.row.classList.toggle('dq-row-filtered',!ok);
   if(ok)visible++;
  }
  output.value='المعروض '+visible.toLocaleString('ar-SA')+' من '+rows.length.toLocaleString('ar-SA')+' حالة';
  output.textContent=output.value;
  noMatch.hidden=visible>0;
 }
 apply();
}
function init(){
 const dashboard=document.getElementById('dataQualityDashboard');
 if(!dashboard)return;
 const observer=new MutationObserver(()=>install(document.getElementById('dqIssueDetails')));
 observer.observe(dashboard,{subtree:true,childList:true});
 install(document.getElementById('dqIssueDetails'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:null);
