(()=>{
'use strict';

const state={
  loaded:false,
  sheets:[],
  sheet:'',
  headerRow:1,
  columns:[],
  selected:new Set(),
  filters:new Map(),
  excluded:new Map(),
  filterRowCount:0,
  filtersLoaded:false,
  loadingFilters:false,
  columnsDirty:false,
  filterRequestId:0
};

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase();
const enc=v=>encodeURIComponent(String(v??''));
const dec=v=>{try{return decodeURIComponent(v)}catch{return String(v??'')}};

function root(){return $('#excelExportRoot')}
function setStatus(text,type=''){
  const el=$('#excelExportStatus');
  if(!el)return;
  el.className='xe-status '+type;
  el.textContent=text||'';
}
async function jsonFetch(url,options={}){
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.ok===false)throw new Error(data.error||'تعذر إكمال الطلب');
  return data;
}

function shell(){
  const el=root();if(!el)return;
  el.innerHTML=`
    <section class="xe-hero">
      <div>
        <span>GOOGLE SHEETS • CUSTOM FILTERED XLSX</span>
        <h2>تصدير تقرير اكسيل</h2>
        <p>اختر الورقة، ثم الأعمدة، ثم استبعد فقط القيم التي لا تريدها. جميع قيم الفلاتر تكون محددة افتراضيًا، ويتم تصدير القيم المحسوبة فقط بدون المعادلات.</p>
      </div>
      <div class="xe-badge">XLSX</div>
    </section>

    <section class="xe-panel">
      <div class="xe-flow">
        <article class="xe-stage xe-stage-sheet is-ready" id="xeSheetStep">
          <div class="xe-stage-head">
            <span class="xe-step-no">1</span>
            <div><strong>اختيار الورقة</strong><small>اختر ورقة Google Sheet المطلوبة</small></div>
          </div>
          <select id="xeSheet"><option value="">جاري تحميل الأوراق...</option></select>
        </article>

        <div class="xe-flow-line"></div>

        <article class="xe-stage is-disabled" id="xeColumnsStep">
          <div class="xe-stage-head">
            <span class="xe-step-no">2</span>
            <div><strong>اختيار الأعمدة</strong><small>قائمة متعددة الاختيار بعلامات صح</small></div>
          </div>
          <div class="xe-multi" id="xeColumnsMulti">
            <button type="button" class="xe-multi-trigger" id="xeColumnsTrigger" disabled>
              <span><b>اختر الأعمدة المطلوبة</b><small>لم يتم اختيار أعمدة</small></span>
              <em id="xeColumnsCount">0</em><i>⌄</i>
            </button>
            <div class="xe-multi-menu" id="xeColumnsMenu" hidden>
              <div class="xe-menu-tools">
                <button type="button" data-xe-cols="all">تحديد الكل</button>
                <button type="button" data-xe-cols="none">إلغاء الكل</button>
              </div>
              <div class="xe-search"><span>⌕</span><input id="xeColumnSearch" placeholder="ابحث عن اسم عمود..."></div>
              <div id="xeColumnsList" class="xe-check-list"></div>
              <button type="button" id="xeColumnsDone" class="xe-menu-done">تم — تجهيز الفلاتر</button>
            </div>
          </div>
        </article>

        <div class="xe-flow-line"></div>

        <article class="xe-stage is-disabled" id="xeFiltersStep">
          <div class="xe-stage-head">
            <span class="xe-step-no">3</span>
            <div><strong>فلاتر الأعمدة</strong><small>كل القيم محددة ✓ افتراضيًا — أزل الصح لاستبعاد القيمة</small></div>
          </div>
          <div id="xeFilterList" class="xe-filter-list">
            <div class="xe-placeholder">اختر الأعمدة أولًا لتجهيز الفلاتر.</div>
          </div>
        </article>
      </div>

      <div class="xe-actions">
        <div id="excelExportStatus" class="xe-status"></div>
        <button id="xeExport" class="xe-export" type="button" disabled>⬇ تصدير تقرير اكسيل</button>
      </div>
    </section>`;

  $('#xeSheet')?.addEventListener('change',e=>applySheet(e.target.value));
  $('#xeColumnsTrigger')?.addEventListener('click',toggleColumnsMenu);
  $('#xeColumnsDone')?.addEventListener('click',()=>closeColumnsMenu(true));
  $('#xeExport')?.addEventListener('click',exportWorkbook);

  document.addEventListener('pointerdown',onOutsidePointer,true);
  document.addEventListener('keydown',onEscape);
}
function onOutsidePointer(e){
  const menu=$('#xeColumnsMenu');
  if(!menu||menu.hidden)return;
  if(e.target.closest('#xeColumnsMulti'))return;
  closeColumnsMenu(!e.target.closest('#xeSheet'));
}
function onEscape(e){
  if(e.key==='Escape'&&!$('#xeColumnsMenu')?.hidden)closeColumnsMenu(true);
}

async function loadSheets(force=false){
  if(state.loaded&&!force){renderSheetOptions();return}
  setStatus('جاري تجهيز قائمة الأوراق...');
  const data=await jsonFetch('/api/excel-export/sheets',{cache:'default'});
  state.loaded=true;
  state.sheets=Array.isArray(data.sheets)?data.sheets:[];
  renderSheetOptions();
  setStatus(state.sheets.length?'اختر الورقة المطلوبة لبدء إعداد التقرير.':'لا توجد أوراق متاحة للتصدير.');
}

function renderSheetOptions(){
  const select=$('#xeSheet');if(!select)return;
  select.innerHTML='<option value="">— اختر الورقة —</option>'+
    state.sheets.map(s=>'<option value="'+esc(s.title)+'">'+esc(s.title)+'</option>').join('');
  if(state.sheet&&state.sheets.some(s=>s.title===state.sheet))select.value=state.sheet;
}

function resetAfterSheet(){
  state.selected.clear();
  state.filters.clear();
  state.excluded.clear();
  state.filterRowCount=0;
  state.filtersLoaded=false;
  state.loadingFilters=false;
  state.columnsDirty=false;
  state.filterRequestId++;
  renderColumnTrigger();
  renderFiltersPlaceholder('اختر الأعمدة أولًا لتجهيز الفلاتر.');
  syncExportButton();
}

function applySheet(sheet){
  closeColumnsMenu(false);
  state.sheet=sheet;
  const def=state.sheets.find(s=>s.title===sheet);
  state.headerRow=Number(def?.headerRow||1);
  state.columns=Array.isArray(def?.columns)?def.columns:[];
  resetAfterSheet();

  const step=$('#xeColumnsStep');
  const trigger=$('#xeColumnsTrigger');
  if(!sheet||!def){
    step?.classList.add('is-disabled');
    if(trigger)trigger.disabled=true;
    setStatus('اختر الورقة المطلوبة.');
    return;
  }

  step?.classList.remove('is-disabled');
  step?.classList.add('is-ready');
  if(trigger)trigger.disabled=false;
  renderColumnList();
  setStatus('تم اختيار ورقة «'+sheet+'». اختر الأعمدة المطلوبة.');
  setTimeout(()=>openColumnsMenu(),80);
}

function selectedColumns(){
  return [...state.selected].map(Number).sort((a,b)=>a-b);
}

function selectedColumnDefs(){
  const selected=state.selected;
  return state.columns.filter(c=>selected.has(Number(c.index)));
}

function renderColumnTrigger(){
  const trigger=$('#xeColumnsTrigger'),count=$('#xeColumnsCount');
  if(!trigger)return;
  const defs=selectedColumnDefs();
  if(count)count.textContent=String(defs.length);
  const b=$('b',trigger),small=$('small',trigger);
  if(!defs.length){
    if(b)b.textContent='اختر الأعمدة المطلوبة';
    if(small)small.textContent='لم يتم اختيار أعمدة';
    return;
  }
  if(b)b.textContent=defs.length===1?defs[0].label:(defs.length+' أعمدة محددة');
  if(small){
    const names=defs.slice(0,3).map(c=>c.label).join('، ');
    small.textContent=names+(defs.length>3?' ...':'');
  }
}
function renderColumnList(){
  const list=$('#xeColumnsList');if(!list)return;
  list.innerHTML=state.columns.map(c=>{
    const idx=Number(c.index);
    const checked=state.selected.has(idx)?' checked':'';
    return '<label class="xe-check-row xe-column-row" data-label="'+esc(norm(c.label))+'">'+
      '<input type="checkbox" data-col-index="'+idx+'"'+checked+'>'+
      '<span><b>'+esc(c.label)+'</b><small>'+esc(c.letter||'')+'</small></span>'+
      '</label>';
  }).join('');

  $$('.xe-column-row input',list).forEach(input=>input.addEventListener('change',()=>{
    const idx=Number(input.dataset.colIndex);
    if(input.checked)state.selected.add(idx);
    else{
      state.selected.delete(idx);
      state.filters.delete(idx);
      state.excluded.delete(idx);
    }
    state.columnsDirty=true;
    state.filtersLoaded=false;
    renderColumnTrigger();
    markFiltersPending();
    syncExportButton();
  }));

  const search=$('#xeColumnSearch');if(search)search.oninput=filterColumnList;
  $$('[data-xe-cols]').forEach(btn=>{
    if(btn.dataset.xeBound==='1')return;
    btn.dataset.xeBound='1';
    btn.addEventListener('click',()=>setAllColumns(btn.dataset.xeCols==='all'));
  });
}

function filterColumnList(){
  const q=norm($('#xeColumnSearch')?.value);
  $$('.xe-column-row').forEach(row=>{
    row.classList.toggle('is-hidden',!!q&&!row.dataset.label.includes(q));
  });
}

function setAllColumns(on){
  $$('.xe-column-row input').forEach(input=>{
    input.checked=on;
    const idx=Number(input.dataset.colIndex);
    if(on)state.selected.add(idx);
    else{
      state.selected.delete(idx);
      state.filters.delete(idx);
      state.excluded.delete(idx);
    }
  });
  state.columnsDirty=true;
  state.filtersLoaded=false;
  renderColumnTrigger();
  markFiltersPending();
  syncExportButton();
}

function toggleColumnsMenu(){
  const menu=$('#xeColumnsMenu');
  if(!menu)return;
  if(menu.hidden)openColumnsMenu();
  else closeColumnsMenu(true);
}
function openColumnsMenu(){
  if(!state.sheet)return;
  const menu=$('#xeColumnsMenu'),trigger=$('#xeColumnsTrigger');
  if(!menu||trigger?.disabled)return;
  menu.hidden=false;
  trigger.classList.add('is-open');
  trigger.setAttribute('aria-expanded','true');
}
function closeColumnsMenu(apply){
  const menu=$('#xeColumnsMenu'),trigger=$('#xeColumnsTrigger');
  if(menu){
    menu.hidden=true;
    trigger?.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded','false');
  }
  if(apply&&state.columnsDirty){
    state.columnsDirty=false;
    if(state.selected.size)loadFilterOptions();
    else renderFiltersPlaceholder('اختر عمودًا واحدًا على الأقل لتجهيز الفلاتر.');
  }
}

function markFiltersPending(){
  const step=$('#xeFiltersStep');
  if(!state.selected.size){
    step?.classList.add('is-disabled');
    renderFiltersPlaceholder('اختر الأعمدة أولًا لتجهيز الفلاتر.');
    return;
  }
  step?.classList.remove('is-disabled');
  step?.classList.add('is-ready');
  renderFiltersPlaceholder('أغلق قائمة الأعمدة أو اضغط «تم» لتجهيز فلاتر القيم.');
}
function renderFiltersPlaceholder(text,loading=false){
  const host=$('#xeFilterList');if(!host)return;
  host.innerHTML='<div class="xe-placeholder'+(loading?' is-loading':'')+'">'+(loading?'<i></i>':'')+esc(text)+'</div>';
}

async function loadFilterOptions(){
  const cols=selectedColumns();
  if(!state.sheet||!cols.length)return;
  const requestId=++state.filterRequestId;
  state.loadingFilters=true;
  state.filtersLoaded=false;
  $('#xeFiltersStep')?.classList.remove('is-disabled');
  $('#xeFiltersStep')?.classList.add('is-ready');
  renderFiltersPlaceholder('جاري تجهيز قيم الفلاتر...',true);
  setStatus('جاري قراءة القيم المميزة للأعمدة المختارة...');
  syncExportButton();

  try{
    const data=await jsonFetch('/api/excel-export/filter-options',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sheet:state.sheet,columns:cols,headerRow:state.headerRow})
    });
    if(requestId!==state.filterRequestId)return;

    const nextFilters=new Map();
    (data.filters||[]).forEach(f=>{
      const idx=Number(f.index);
      const values=Array.isArray(f.values)?f.values.map(x=>({value:String(x?.value??''),count:Number(x?.count||0)})):[];
      nextFilters.set(idx,{index:idx,label:f.label||'',letter:f.letter||'',values});
      const allowed=new Set(values.map(x=>x.value));
      const previous=state.excluded.get(idx)||new Set();
      state.excluded.set(idx,new Set([...previous].filter(v=>allowed.has(v))));
    });

    [...state.excluded.keys()].forEach(idx=>{if(!nextFilters.has(idx))state.excluded.delete(idx)});
    state.filters=nextFilters;
    state.filterRowCount=Number(data.rowCount||0);
    state.filtersLoaded=true;
    state.loadingFilters=false;
    renderFilters();
    setStatus('تم تجهيز '+nextFilters.size+' فلتر. جميع القيم محددة افتراضيًا ✓. أزل الصح فقط عن القيم التي تريد استبعادها.','success');
  }catch(e){
    if(requestId!==state.filterRequestId)return;
    state.loadingFilters=false;
    state.filtersLoaded=false;
    renderFiltersPlaceholder(e.message||'تعذر تجهيز الفلاتر.');
    setStatus(e.message,'error');
  }finally{
    if(requestId===state.filterRequestId)syncExportButton();
  }
}

function renderFilters(){
  const host=$('#xeFilterList');if(!host)return;
  const ordered=selectedColumns().map(idx=>state.filters.get(idx)).filter(Boolean);
  if(!ordered.length){
    renderFiltersPlaceholder('لا توجد قيم متاحة للفلاتر.');
    return;
  }

  host.innerHTML=ordered.map((f,i)=>{
    const excluded=state.excluded.get(f.index)||new Set();
    const selectedCount=Math.max(0,f.values.length-excluded.size);
    const summary=excluded.size===0?'الكل محدد':(selectedCount+' من '+f.values.length);
    return '<details class="xe-filter-group" data-filter-index="'+f.index+'"'+(i===0?' open':'')+'>'+
      '<summary>'+
        '<span class="xe-filter-title"><b>'+esc(f.label)+'</b><small>'+esc(f.letter||'')+' • '+f.values.length+' قيمة</small></span>'+
        '<em class="xe-filter-summary">'+esc(summary)+'</em><i>⌄</i>'+
      '</summary>'+
      '<div class="xe-filter-body">'+
        '<div class="xe-filter-toolbar">'+
          '<div class="xe-search"><span>⌕</span><input class="xe-value-search" placeholder="ابحث داخل '+esc(f.label)+'..."></div>'+
          '<div class="xe-filter-actions"><button type="button" data-filter-all="1">تحديد الكل</button><button type="button" data-filter-all="0">إلغاء الكل</button></div>'+
        '</div>'+
        '<div class="xe-value-list">'+f.values.map((item,n)=>{
          const checked=excluded.has(item.value)?'':' checked';
          const label=item.value===''?'(فارغ)':item.value;
          return '<label class="xe-check-row xe-value-row" data-value-key="'+esc(enc(item.value))+'" data-label="'+esc(norm(label))+'">'+
            '<input type="checkbox" data-value-no="'+n+'"'+checked+'>'+
            '<span><b>'+esc(label)+'</b><small>'+item.count+' صف</small></span>'+
          '</label>';
        }).join('')+'</div>'+
      '</div>'+
    '</details>';
  }).join('');

  $$('.xe-filter-group',host).forEach(bindFilterGroup);
}
function bindFilterGroup(group){
  const idx=Number(group.dataset.filterIndex);
  const filter=state.filters.get(idx);
  if(!filter)return;

  $('.xe-value-search',group)?.addEventListener('input',e=>{
    const q=norm(e.target.value);
    $$('.xe-value-row',group).forEach(row=>{
      row.classList.toggle('is-hidden',!!q&&!row.dataset.label.includes(q));
    });
  });

  $$('.xe-value-row input',group).forEach(input=>input.addEventListener('change',()=>{
    const row=input.closest('.xe-value-row');
    const value=dec(row?.dataset.valueKey||'');
    let excluded=state.excluded.get(idx);
    if(!excluded){excluded=new Set();state.excluded.set(idx,excluded)}
    if(input.checked)excluded.delete(value);
    else excluded.add(value);
    updateFilterSummary(group,idx);
  }));

  $$('[data-filter-all]',group).forEach(btn=>btn.addEventListener('click',()=>{
    const on=btn.dataset.filterAll==='1';
    let excluded=state.excluded.get(idx);
    if(!excluded){excluded=new Set();state.excluded.set(idx,excluded)}
    excluded.clear();
    if(!on)filter.values.forEach(item=>excluded.add(item.value));
    $$('.xe-value-row input',group).forEach(input=>input.checked=on);
    updateFilterSummary(group,idx);
  }));
}

function updateFilterSummary(group,idx){
  const filter=state.filters.get(idx);
  const excluded=state.excluded.get(idx)||new Set();
  if(!filter)return;
  const selected=Math.max(0,filter.values.length-excluded.size);
  const el=$('.xe-filter-summary',group);
  if(el){
    el.textContent=excluded.size===0?'الكل محدد':(selected===0?'لا توجد قيم':selected+' من '+filter.values.length);
    el.classList.toggle('has-exclusions',excluded.size>0);
  }
  syncExportButton();
}

function collectExcludeFilters(){
  const out={};
  for(const idx of selectedColumns()){
    const set=state.excluded.get(idx);
    if(set&&set.size)out[String(idx)]=[...set];
  }
  return out;
}

function syncExportButton(){
  const btn=$('#xeExport');if(!btn)return;
  btn.disabled=!state.sheet||state.selected.size===0||!state.filtersLoaded||state.loadingFilters;
}

function filenameFromDisposition(value){
  const utf=String(value||'').match(/filename\*=UTF-8''([^;]+)/i);
  if(utf){try{return decodeURIComponent(utf[1])}catch{}}
  const plain=String(value||'').match(/filename="?([^";]+)"?/i);
  return plain?.[1]||'Excel_Report.xlsx';
}
async function exportWorkbook(){
  const cols=selectedColumns();
  if(!state.sheet||!cols.length||!state.filtersLoaded)return;

  const btn=$('#xeExport'),old=btn.textContent;
  btn.disabled=true;
  btn.classList.add('is-loading');
  btn.textContent='جاري تجهيز ملف Excel...';
  setStatus('جاري تطبيق الفلاتر وإنشاء التقرير...');

  try{
    const r=await fetch('/api/excel-export',{
      method:'POST',
      credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sheet:state.sheet,
        columns:cols,
        headerRow:state.headerRow,
        excludeFilters:collectExcludeFilters()
      })
    });
    if(!r.ok){
      const e=await r.json().catch(()=>({}));
      throw new Error(e.error||'تعذر إنشاء ملف Excel');
    }

    const blob=await r.blob();
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=filenameFromDisposition(r.headers.get('content-disposition'));
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1200);

    const rows=Number(r.headers.get('x-excel-filtered-rows')||0);
    setStatus('تم إنشاء التقرير بالقيم فقط بعد تطبيق الفلاتر'+(Number.isFinite(rows)?' — '+rows+' صف':'')+'.','success');
  }catch(e){
    setStatus(e.message,'error');
  }finally{
    btn.classList.remove('is-loading');
    btn.textContent=old;
    syncExportButton();
  }
}

async function renderExcelExportTool(){
  if(!root())return;
  if(!$('#xeSheet'))shell();
  try{await loadSheets(false)}catch(e){setStatus(e.message,'error')}
}

window.renderExcelExportTool=renderExcelExportTool;
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{if(root())shell()},{once:true});
}else if(root())shell();
})();
