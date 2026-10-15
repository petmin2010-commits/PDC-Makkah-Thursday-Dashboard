(()=>{
'use strict';
const state={term:'',from:'',to:'',selected:{},open:'',queries:{}};
const FIELD={issuer:'issuer',report:'reportName',type:'format',status:'status'};
const LABELS={issuer:'مُصدِر التقرير',report:'اسم التقرير',type:'صيغة التقرير',status:'حالة حفظ التقرير'};
const clean=v=>String(v==null?'':v).trim();
const archiveStatus=r=>r.fileId?'محفوظ في pCloud':r.url?'رابط محفوظ':/فشل|تعذر/i.test(r.status||'')?'فشل الحفظ':'بانتظار الحفظ';
const value=(r,key)=>key==='status'?archiveStatus(r):clean(r[FIELD[key]])||'غير محدد';
function apply(items){
 return (items||[]).filter(r=>{
  const d=clean(r.date);
  if(state.from&&d<state.from)return false;
  if(state.to&&d>state.to)return false;
  if(state.term&&!([r.date,r.time,r.issuer,r.email,r.reportName,r.format,r.filename,r.status,r.url].join(' ').toLocaleLowerCase('ar').includes(state.term.toLocaleLowerCase('ar'))))return false;
  return Object.keys(FIELD).every(k=>!state.selected[k]||state.selected[k].has(value(r,k)));
 });
}
function reset(){state.term='';state.from='';state.to='';state.selected={};state.queries={};state.open=''}
function node(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x}
function makeSelect(key,items,rerender){
 const values=[...new Set(items.map(r=>value(r,key)))].sort((a,b)=>a.localeCompare(b,'ar'));
 const selected=state.selected[key];
 const shell=node('details','ra-filter');
 shell.open=state.open===key;
 const summary=node('summary','','');
 const count=selected?values.filter(v=>selected.has(v)).length:values.length;
 summary.textContent=LABELS[key]+' · '+(selected?count+' من '+values.length:'الكل');
 shell.append(summary);
 shell.addEventListener('toggle',()=>{if(shell.open)state.open=key;else if(state.open===key)state.open=''});
 const panel=node('div','ra-dropdown');
 const search=node('input','','');search.type='search';search.placeholder='بحث ضمن '+LABELS[key];search.setAttribute('aria-label','بحث '+LABELS[key]);search.value=state.queries[key]||'';
 panel.append(search);
 const actions=node('div','ra-filter-actions');
 const all=node('button','','تحديد الكل');all.type='button';actions.append(all);
 const none=node('button','','إلغاء التحديد');none.type='button';actions.append(none);
 panel.append(actions);
 const options=node('div','ra-filter-options');panel.append(options);
 const paintOptions=()=>{
  options.replaceChildren();
  const filtered=values.filter(v=>v.toLocaleLowerCase('ar').includes(search.value.toLocaleLowerCase('ar')));
  filtered.forEach(v=>{
   const label=node('label','ra-option'),checkbox=node('input');
   checkbox.type='checkbox';checkbox.checked=!state.selected[key]||state.selected[key].has(v);
   checkbox.addEventListener('change',()=>{
    const next=state.selected[key]?new Set(state.selected[key]):new Set(values);
    if(checkbox.checked)next.add(v);else next.delete(v);
    state.selected[key]=next.size===values.length?null:next;
    state.open=key;state.queries[key]=search.value;rerender();
   });
   label.append(checkbox,node('span','',v));options.append(label);
  });
  if(!filtered.length)options.append(node('p','ra-no-filter-result','لا توجد قيم مطابقة'));
 };
 search.addEventListener('input',()=>{state.queries[key]=search.value;paintOptions()});
 all.addEventListener('click',()=>{state.selected[key]=null;state.open=key;rerender()});
 none.addEventListener('click',()=>{state.selected[key]=new Set();state.open=key;rerender()});
 paintOptions();shell.append(panel);return shell;
}
function mount(container,all,rerender){
 const section=node('section','ra-archive-filters');
 const title=node('div','ra-filter-title');
 title.append(node('strong','','فلاتر سجل التقارير الصادرة'),node('small','','مرتبطة بالتاريخ والمُصدِر والتقرير والحفظ في pCloud فقط'));
 section.append(title);
 const textSearch=node('input','ra-archive-search');textSearch.type='search';textSearch.value=state.term;textSearch.placeholder='بحث برقم التقرير أو اسم الملف أو المُصدِر أو التاريخ';textSearch.setAttribute('aria-label','البحث في سجلات التقارير');
 textSearch.addEventListener('input',()=>{state.term=textSearch.value;rerender();const next=container.querySelector('.ra-archive-search');if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length)}});
 section.append(textSearch);
 const controls=node('div','ra-archive-filter-grid');
 const from=node('label','ra-date-field');from.append(node('span','','من تاريخ الإصدار'));
 const fi=node('input');fi.type='date';fi.value=state.from;fi.setAttribute('aria-label','من تاريخ الإصدار');
 fi.addEventListener('change',()=>{state.from=fi.value;rerender()});from.append(fi);controls.append(from);
 const to=node('label','ra-date-field');to.append(node('span','','إلى تاريخ الإصدار'));
 const ti=node('input');ti.type='date';ti.value=state.to;ti.setAttribute('aria-label','إلى تاريخ الإصدار');
 ti.addEventListener('change',()=>{state.to=ti.value;rerender()});to.append(ti);controls.append(to);
 Object.keys(FIELD).forEach(k=>controls.append(makeSelect(k,all,rerender)));
 section.append(controls);
 const results=apply(all);
 const counts=node('div','ra-archive-summary');
 const metrics=[
  ['إجمالي التقارير',all.length],
  ['نتائج الفلاتر',results.length],
  ['المحفوظة في pCloud',results.filter(r=>!!r.fileId).length],
  ['لم تُحفظ بعد',results.filter(r=>!r.fileId&&!r.url).length]
 ];
 metrics.forEach(([label,count])=>{const card=node('div','ra-summary-card');card.append(node('span','',label),node('strong','',String(count)));counts.append(card)});
 section.append(counts);
 const bottom=node('div','ra-filter-bottom');
 const resetButton=node('button','ra-reset','إعادة ضبط الفلاتر');resetButton.type='button';resetButton.addEventListener('click',()=>{reset();rerender()});
 bottom.append(resetButton);
 const excelButton=node('button','ra-download','تصدير النتائج CSV');excelButton.type='button';excelButton.addEventListener('click',()=>exportCSV(results));
 bottom.append(excelButton);
 const pdfButton=node('button','ra-print','تصدير التقرير PDF');pdfButton.type='button';pdfButton.addEventListener('click',()=>window.print());bottom.append(pdfButton);
 section.append(bottom);
 container.append(section);
 return results;
}
function exportCSV(items){
 const fields=['date','time','issuer','email','reportName','format','filename','status','url'];
 const titles=['التاريخ','الوقت','المُصدِر','البريد الإلكتروني','اسم التقرير','الصيغة','اسم الملف','حالة الحفظ','رابط التقرير'];
 const safe=v=>{
  let x=clean(v);
  if(/^[=+\-@\t\r]/.test(x))x="'"+x;
  return '"'+x.replace(/"/g,'""')+'"';
 };
 const csv='\uFEFF'+[titles.map(safe).join(','),...items.map(item=>fields.map(k=>safe(k==='status'?archiveStatus(item):item[k])).join(','))].join('\r\n');
 const uri=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=node('a');a.href=uri;a.download='VD_Report_Archive_'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),2000);
}
window.VDReportArchiveFilters={state,apply,mount,reset,exportCSV,archiveStatus,get term(){return state.term},set term(v){state.term=v}};
})();
