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
  loading:new Set()
};

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFKC').trim().toLowerCase();
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
  const el=root();
  if(!el)return;
  el.innerHTML=`
    <div class="xe-builder">
      <aside class="xe-side">
        <label class="xe-side-label">1. اختر ورقة Google Sheets</label>
        <select id="xeSheet" class="xe-sheet-select">
          <option value="">جاري تحميل الأوراق...</option>
        </select>
        <p class="xe-side-help">
          يتم إظهار الأعمدة الفعلية من الورقة المختارة، ويُصدَّر التقرير بالقيم النهائية فقط بدون المعادلات.
          اختر الورقة ثم أزل تحديد أي عمود أو قيمة لا تريدها.
        </p>
      </aside>
      <section id="xeMain" class="xe-main">
        <div class="xe-empty">
          <b>جاري تجهيز الأوراق...</b>
          <span>يتم قراءة بنية Google Sheets مباشرة.</span>
        </div>
      </section>
    </div>`;
  $('#xeSheet')?.addEventListener('change',e=>applySheet(e.target.value));
}

async function loadSheets(force=false){
  if(state.loaded&&!force){
    renderSheetOptions();
    if(state.sheet)renderBuilder();
    return;
  }
  setStatus('جاري تجهيز قائمة الأوراق...');
  const data=await jsonFetch('/api/excel-export/sheets',{cache:'default'});
  state.loaded=true;
  state.sheets=Array.isArray(data.sheets)?data.sheets:[];
  renderSheetOptions();
  if(!state.sheet&&state.sheets.length){
    applySheet(state.sheets[0].title);
  }else if(state.sheet){
    renderBuilder();
  }else{
    renderEmpty('لا توجد أوراق متاحة للتصدير.');
  }
}

function renderSheetOptions(){
  const select=$('#xeSheet');
  if(!select)return;
  select.innerHTML='<option value="">— اختر الورقة —</option>'+
    state.sheets.map(s=>'<option value="'+esc(s.title)+'">'+esc(s.title)+'</option>').join('');
  if(state.sheet&&state.sheets.some(s=>s.title===state.sheet))select.value=state.sheet;
}

function applySheet(sheet){
  state.sheet=sheet||'';
  const def=state.sheets.find(s=>s.title===state.sheet);
  state.headerRow=Number(def?.headerRow||1);
  state.columns=Array.isArray(def?.columns)?def.columns:[];
  state.selected=new Set(state.columns.map(c=>Number(c.index)));
  state.filters.clear();
  state.excluded.clear();
  state.loading.clear();
  renderSheetOptions();
  if(!def){
    renderEmpty('اختر ورقة Google Sheets المطلوبة.');
    return;
  }
  renderBuilder();
}

function renderEmpty(text){
  const main=$('#xeMain');
  if(!main)return;
  main.innerHTML='<div class="xe-empty"><b>'+esc(text)+'</b><span>يمكنك اختيار الورقة من القائمة الجانبية.</span></div>';
}

function selectedDefs(){
  return state.columns.filter(c=>state.selected.has(Number(c.index)));
}

function renderBuilder(){
  const main=$('#xeMain');
  if(!main||!state.sheet)return;
  const defs=selectedDefs();
  main.innerHTML=`
    <div class="xe-panel-head">
      <div>
        <b>2. اختر الأعمدة</b>
        <span id="xeColumnSummary">${defs.length} من ${state.columns.length} عمود محدد</span>
      </div>
      <div class="xe-column-actions">
        <button id="xeColsAll" type="button">تحديد كل الأعمدة</button>
        <button id="xeColsNone" type="button">إلغاء تحديد الكل</button>
      </div>
    </div>

    <div id="xeColumnList" class="xe-column-list">
      ${state.columns.map(c=>{
        const idx=Number(c.index);
        return '<label class="xe-column-choice">'+
          '<input type="checkbox" data-xe-col="'+idx+'" '+(state.selected.has(idx)?'checked':'')+'>'+
          '<span>'+esc(c.label)+'</span><small>['+esc(c.letter||'')+']</small>'+
        '</label>';
      }).join('')}
    </div>

    <div class="xe-panel-head xe-filters-head">
      <div>
        <b>3. فلاتر الأعمدة المختارة</b>
        <span>الافتراضي: جميع القيم محددة</span>
      </div>
    </div>

    <div id="xeFiltersHost" class="xe-filters-host"></div>

    <div class="xe-footer">
      <div id="excelExportStatus" class="xe-status">جميع الفلاتر محددة افتراضيًا.</div>
      <button id="xeExport" class="xe-export-btn" type="button">تصدير ملف Excel بالقيم فقط</button>
    </div>`;

  $$('[data-xe-col]',main).forEach(input=>input.addEventListener('change',()=>{
    const idx=Number(input.dataset.xeCol);
    if(input.checked){
      state.selected.add(idx);
    }else{
      state.selected.delete(idx);
      state.filters.delete(idx);
      state.excluded.delete(idx);
      state.loading.delete(idx);
    }
    updateColumnSummary();
    renderFilterTriggers();
    syncExportButton();
  }));

  $('#xeColsAll')?.addEventListener('click',()=>{
    state.columns.forEach(c=>state.selected.add(Number(c.index)));
    $$('[data-xe-col]',main).forEach(x=>x.checked=true);
    updateColumnSummary();
    renderFilterTriggers();
    syncExportButton();
  });

  $('#xeColsNone')?.addEventListener('click',()=>{
    state.selected.clear();
    state.filters.clear();
    state.excluded.clear();
    state.loading.clear();
    $$('[data-xe-col]',main).forEach(x=>x.checked=false);
    updateColumnSummary();
    renderFilterTriggers();
    syncExportButton();
  });

  $('#xeExport')?.addEventListener('click',exportWorkbook);
  renderFilterTriggers();
  syncExportButton();
}

function updateColumnSummary(){
  const el=$('#xeColumnSummary');
  if(el)el.textContent=state.selected.size+' من '+state.columns.length+' عمود محدد';
}

function filterCaption(idx){
  const f=state.filters.get(idx);
  const excluded=state.excluded.get(idx)||new Set();
  if(!f||excluded.size===0)return 'الكل';
  const selected=Math.max(0,f.values.length-excluded.size);
  return selected+' من '+f.values.length;
}

function renderFilterTriggers(){
  const host=$('#xeFiltersHost');
  if(!host)return;
  const defs=selectedDefs();
  if(!defs.length){
    host.innerHTML='<div class="xe-filter-empty">اختر عمودًا واحدًا على الأقل ليظهر فلتره هنا.</div>';
    return;
  }

  host.innerHTML=defs.map(c=>{
    const idx=Number(c.index);
    return '<div class="xe-filter" data-filter-index="'+idx+'">'+
      '<button class="xe-filter-trigger" type="button">'+
        '<span class="xe-filter-label">'+esc(c.label)+'</span>'+
        '<span class="xe-filter-caption">'+esc(filterCaption(idx))+'</span>'+
        '<i>⌄</i>'+
      '</button>'+
      '<div class="xe-filter-pop" hidden>'+
        '<div class="xe-filter-loading">اضغط لقراءة قيم الفلتر...</div>'+
      '</div>'+
    '</div>';
  }).join('');

  $$('.xe-filter-trigger',host).forEach(btn=>btn.addEventListener('click',async e=>{
    e.stopPropagation();
    const box=btn.closest('.xe-filter');
    const idx=Number(box.dataset.filterIndex);
    const pop=$('.xe-filter-pop',box);
    const willOpen=pop.hidden;
    closeFilterPops(box);
    pop.hidden=!willOpen;
    box.classList.toggle('open',willOpen);
    if(willOpen)await ensureFilterLoaded(idx,box);
  }));
}

function closeFilterPops(except=null){
  $$('.xe-filter').forEach(box=>{
    if(box===except)return;
    box.classList.remove('open');
    const pop=$('.xe-filter-pop',box);
    if(pop)pop.hidden=true;
  });
}

async function ensureFilterLoaded(idx,box){
  if(state.filters.has(idx)){
    renderFilterPop(idx,box);
    return;
  }
  if(state.loading.has(idx))return;
  state.loading.add(idx);
  const pop=$('.xe-filter-pop',box);
  if(pop)pop.innerHTML='<div class="xe-filter-loading"><i></i> جاري قراءة القيم...</div>';

  try{
    const data=await jsonFetch('/api/excel-export/filter-options',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sheet:state.sheet,columns:[idx],headerRow:state.headerRow})
    });
    const f=Array.isArray(data.filters)?data.filters[0]:null;
    if(!f)throw new Error('لا توجد قيم متاحة لهذا العمود');
    const values=Array.isArray(f.values)?f.values.map(x=>({
      value:String(x?.value??''),
      count:Number(x?.count||0)
    })):[];
    state.filters.set(idx,{
      index:idx,
      label:f.label||'',
      letter:f.letter||'',
      values
    });
    if(!state.excluded.has(idx))state.excluded.set(idx,new Set());
    renderFilterPop(idx,box);
    refreshTrigger(idx);
  }catch(e){
    if(pop)pop.innerHTML='<div class="xe-filter-error">'+esc(e.message||'تعذر قراءة القيم')+'</div>';
  }finally{
    state.loading.delete(idx);
  }
}

function renderFilterPop(idx,box){
  const f=state.filters.get(idx);
  const pop=$('.xe-filter-pop',box);
  if(!f||!pop)return;
  const excluded=state.excluded.get(idx)||new Set();
  pop.innerHTML=
    '<div class="xe-filter-search"><span>⌕</span><input type="search" placeholder="ابحث داخل القيم..."></div>'+
    '<div class="xe-filter-actions"><button type="button" data-filter-act="all">تحديد الكل</button><button type="button" data-filter-act="none">إلغاء الكل</button></div>'+
    '<div class="xe-filter-options">'+
      f.values.map(item=>{
        const value=item.value;
        const label=value===''?'(فارغ)':value;
        return '<label class="xe-filter-option" data-text="'+esc(norm(label))+'" data-value="'+esc(enc(value))+'">'+
          '<input type="checkbox" '+(excluded.has(value)?'':'checked')+'>'+
          '<span>'+esc(label)+'</span><small>'+item.count+'</small>'+
        '</label>';
      }).join('')+
    '</div>';

  $('.xe-filter-search input',pop)?.addEventListener('input',e=>{
    const q=norm(e.target.value);
    $$('.xe-filter-option',pop).forEach(row=>{
      row.style.display=!q||row.dataset.text.includes(q)?'flex':'none';
    });
  });

  $$('[data-filter-act]',pop).forEach(btn=>btn.addEventListener('click',()=>{
    const on=btn.dataset.filterAct==='all';
    let set=state.excluded.get(idx);
    if(!set){set=new Set();state.excluded.set(idx,set)}
    set.clear();
    if(!on)f.values.forEach(item=>set.add(item.value));
    $$('.xe-filter-option input',pop).forEach(input=>input.checked=on);
    refreshTrigger(idx);
  }));

  $$('.xe-filter-option input',pop).forEach(input=>input.addEventListener('change',()=>{
    const row=input.closest('.xe-filter-option');
    const value=dec(row?.dataset.value||'');
    let set=state.excluded.get(idx);
    if(!set){set=new Set();state.excluded.set(idx,set)}
    if(input.checked)set.delete(value);else set.add(value);
    refreshTrigger(idx);
  }));
}

function refreshTrigger(idx){
  const box=$('.xe-filter[data-filter-index="'+idx+'"]');
  const caption=box?$('.xe-filter-caption',box):null;
  if(caption)caption.textContent=filterCaption(idx);
}

function collectExcludeFilters(){
  const out={};
  for(const idx of [...state.selected]){
    const set=state.excluded.get(idx);
    if(set&&set.size)out[String(idx)]=[...set];
  }
  return out;
}

function syncExportButton(){
  const btn=$('#xeExport');
  if(btn)btn.disabled=!state.sheet||state.selected.size===0;
}

function filenameFromDisposition(value){
  const utf=String(value||'').match(/filename\*=UTF-8''([^;]+)/i);
  if(utf){try{return decodeURIComponent(utf[1])}catch{}}
  const plain=String(value||'').match(/filename="?([^";]+)"?/i);
  return plain?.[1]||'Excel_Report.xlsx';
}

async function exportWorkbook(){
  const cols=[...state.selected].map(Number).sort((a,b)=>a-b);
  if(!state.sheet||!cols.length)return;
  const btn=$('#xeExport');
  const old=btn.textContent;
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
    setStatus('تم تصدير التقرير بالقيم فقط'+(Number.isFinite(rows)?' — '+rows+' صف':'')+'.','success');
  }catch(e){
    setStatus(e.message,'error');
  }finally{
    btn.classList.remove('is-loading');
    btn.textContent=old;
    syncExportButton();
  }
}

document.addEventListener('pointerdown',e=>{
  if(e.target.closest('.xe-filter'))return;
  closeFilterPops();
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeFilterPops()});

async function renderExcelExportTool(){
  if(!root())return;
  if(!$('#xeSheet'))shell();
  try{await loadSheets(false)}catch(e){
    renderEmpty(e.message||'تعذر تحميل الأوراق.');
    setStatus(e.message,'error');
  }
}

window.renderExcelExportTool=renderExcelExportTool;
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{if(root())shell()},{once:true});
}else if(root())shell();
})();
