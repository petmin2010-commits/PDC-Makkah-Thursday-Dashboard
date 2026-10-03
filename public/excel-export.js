(()=>{
'use strict';

const state={loaded:false,sheets:[],sheet:'',headerRow:1,columns:[]};
const $=(s,p=document)=>p.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function root(){return $('#excelExportRoot')}
function setStatus(text,type=''){
  const el=$('#excelExportStatus');
  if(!el)return;
  el.className='xe-status '+type;
  el.textContent=text||'';
}
async function jsonFetch(url,options){
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.ok===false)throw new Error(data.error||'تعذر إكمال الطلب');
  return data;
}

function shell(){
  const el=root();if(!el)return;
  el.innerHTML=`
    <section class="xe-hero">
      <div><span>GOOGLE SHEETS • VALUE ONLY EXPORT</span><h2>تصدير تقرير اكسيل</h2>
      <p>اختر ورقة Google Sheet ثم الأعمدة المطلوبة. يتم تصدير القيم المحسوبة فقط بدون نقل أي معادلات.</p></div>
      <div class="xe-badge">XLSX</div>
    </section>
    <section class="xe-panel">
      <div class="xe-step"><b>1</b><div><strong>اختر الورقة</strong><small>الأوراق الظاهرة والمتاحة فقط</small></div></div>
      <select id="xeSheet"><option value="">جاري تحميل الأوراق...</option></select>
      <div id="xeColumnsArea" class="xe-columns-area is-empty">اختر ورقة لعرض الأعمدة.</div>
      <div class="xe-actions">
        <div id="excelExportStatus" class="xe-status"></div>
        <button id="xeExport" class="xe-export" type="button" disabled>⬇ تصدير تقرير اكسيل</button>
      </div>
    </section>`;
  $('#xeSheet')?.addEventListener('change',e=>loadColumns(e.target.value));
  $('#xeExport')?.addEventListener('click',exportWorkbook);
}
async function loadSheets(force=false){
  if(state.loaded&&!force){renderSheetOptions();return}
  setStatus('جاري قراءة الأوراق...');
  const data=await jsonFetch('/api/excel-export/sheets?t='+Date.now());
  state.loaded=true;state.sheets=data.sheets||[];
  renderSheetOptions();
  setStatus(state.sheets.length?'اختر الورقة المطلوبة.':'لا توجد أوراق متاحة للتصدير.');
}
function renderSheetOptions(){
  const select=$('#xeSheet');if(!select)return;
  select.innerHTML='<option value="">— اختر الورقة —</option>'+
    state.sheets.map(s=>'<option value="'+esc(s.title)+'">'+esc(s.title)+'</option>').join('');
  if(state.sheet&&state.sheets.some(s=>s.title===state.sheet))select.value=state.sheet;
}
async function loadColumns(sheet){
  state.sheet=sheet;state.columns=[];state.headerRow=1;
  const area=$('#xeColumnsArea'),btn=$('#xeExport');
  if(btn)btn.disabled=true;
  if(!sheet){if(area){area.className='xe-columns-area is-empty';area.textContent='اختر ورقة لعرض الأعمدة.'}return}
  if(area){area.className='xe-columns-area is-loading';area.textContent='جاري قراءة أسماء الأعمدة...'}
  setStatus('جاري تحليل رؤوس الأعمدة...');
  try{
    const data=await jsonFetch('/api/excel-export/columns?sheet='+encodeURIComponent(sheet)+'&t='+Date.now());
    state.headerRow=data.headerRow||1;state.columns=data.columns||[];
    renderColumns();
    setStatus('تم العثور على '+state.columns.length+' عمود. اختر الأعمدة المطلوبة.');
  }catch(e){
    if(area){area.className='xe-columns-area is-empty';area.textContent=e.message}
    setStatus(e.message,'error');
  }
}
function renderColumns(){
  const area=$('#xeColumnsArea');if(!area)return;
  if(!state.columns.length){area.className='xe-columns-area is-empty';area.textContent='لم يتم العثور على عناوين أعمدة.';return}
  area.className='xe-columns-area';
  area.innerHTML=`
    <div class="xe-columns-head">
      <div><strong>2. اختر الأعمدة المطلوبة</strong><small>صف العناوين المكتشف: ${state.headerRow}</small></div>
      <div class="xe-column-tools">
        <button type="button" data-xe-all="1">تحديد الكل</button>
        <button type="button" data-xe-all="0">إلغاء الكل</button>
      </div>
    </div>
    <div class="xe-search"><span>⌕</span><input id="xeColumnSearch" placeholder="ابحث عن اسم عمود..."></div>
    <div id="xeColumnsGrid" class="xe-grid">${state.columns.map(c=>
      '<label class="xe-col" data-label="'+esc(c.label).toLowerCase()+'"><input type="checkbox" value="'+c.index+'"><span><b>'+esc(c.label)+'</b><small>'+esc(c.letter)+'</small></span></label>'
    ).join('')}</div>`;
  area.querySelectorAll('[data-xe-all]').forEach(b=>b.addEventListener('click',()=>{
    const on=b.dataset.xeAll==='1';
    area.querySelectorAll('.xe-col:not(.is-hidden) input').forEach(x=>x.checked=on);
    syncExportButton();
  }));
  $('#xeColumnSearch')?.addEventListener('input',e=>{
    const q=String(e.target.value||'').trim().toLowerCase();
    area.querySelectorAll('.xe-col').forEach(x=>x.classList.toggle('is-hidden',q&&!x.dataset.label.includes(q)));
  });
  area.querySelectorAll('input[type="checkbox"]').forEach(x=>x.addEventListener('change',syncExportButton));
}
function selectedColumns(){
  return [...document.querySelectorAll('#xeColumnsGrid input:checked')].map(x=>Number(x.value));
}
function syncExportButton(){
  const btn=$('#xeExport');if(btn)btn.disabled=!state.sheet||selectedColumns().length===0;
}
function filenameFromDisposition(value){
  const utf=String(value||'').match(/filename\*=UTF-8''([^;]+)/i);
  if(utf){try{return decodeURIComponent(utf[1])}catch{}}
  const plain=String(value||'').match(/filename="?([^";]+)"?/i);
  return plain?.[1]||'Excel_Report.xlsx';
}
async function exportWorkbook(){
  const cols=selectedColumns();
  if(!state.sheet||!cols.length)return;
  const btn=$('#xeExport'),old=btn.textContent;
  btn.disabled=true;btn.classList.add('is-loading');btn.textContent='جاري تجهيز ملف Excel...';
  setStatus('جاري قراءة القيم وإنشاء ملف Excel...');
  try{
    const r=await fetch('/api/excel-export',{
      method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sheet:state.sheet,columns:cols,headerRow:state.headerRow})
    });
    if(!r.ok){
      const e=await r.json().catch(()=>({}));
      throw new Error(e.error||'تعذر إنشاء ملف Excel');
    }
    const blob=await r.blob();
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=filenameFromDisposition(r.headers.get('content-disposition'));
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1200);
    setStatus('تم إنشاء التقرير بالقيم فقط بدون المعادلات.','success');
  }catch(e){setStatus(e.message,'error')}
  finally{btn.classList.remove('is-loading');btn.textContent=old;syncExportButton()}
}
async function renderExcelExportTool(){
  if(!root())return;
  if(!$('#xeSheet'))shell();
  try{await loadSheets(false)}catch(e){setStatus(e.message,'error')}
}
window.renderExcelExportTool=renderExcelExportTool;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(root())shell()},{once:true});
else if(root())shell();
})();
