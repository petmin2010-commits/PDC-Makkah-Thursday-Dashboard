(function(){
'use strict';
const ALL=new Set(['','الكل','كل القيم']);
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const arr=v=>(Array.isArray(v)?v:[v]).map(norm).filter(x=>x&&!ALL.has(x));
function values(sel){if(!sel)return[];return Array.isArray(sel._vdSelected)?arr(sel._vdSelected):arr(sel.value)}
function match(value,selection){const a=arr(selection);return !a.length||a.includes(norm(value))}
function ui(sel){return sel?sel._vdMultiUi:null}
function label(sel){const a=values(sel);if(!a.length)return sel?.dataset.vdAllText||'الكل';if(a.length===1)return a[0];return a.length+' قيم محددة'}
function render(sel){
 const u=ui(sel);if(!u)return;
 const q=norm(u.search.value).toLowerCase(),chosen=new Set(values(sel));u.list.innerHTML='';let visible=0;
 for(const o of Array.from(sel.options)){
  const v=norm(o.value),t=norm(o.textContent);if(!v||ALL.has(v)||ALL.has(t))continue;
  if(q&&!t.toLowerCase().includes(q)&&!v.toLowerCase().includes(q))continue;visible++;
  const row=document.createElement('label');row.className='vd-ms-option';
  const cb=document.createElement('input');cb.type='checkbox';cb.checked=chosen.has(v);cb.value=v;
  const sp=document.createElement('span');sp.textContent=t;
  cb.onchange=()=>{const next=new Set(values(sel));cb.checked?next.add(v):next.delete(v);set(sel,[...next]);};
  row.append(cb,sp);u.list.appendChild(row);
 }
 if(!visible)u.list.innerHTML='<div class="vd-ms-empty">لا توجد قيم مطابقة</div>';
 u.button.querySelector('span').textContent=label(sel);u.button.classList.toggle('has-values',values(sel).length>0);
}
function set(sel,next,opt={}){
 if(!sel)return;const available=new Set(Array.from(sel.options).map(o=>norm(o.value)).filter(Boolean));
 const clean=arr(next).filter(v=>available.has(v));sel._vdSelected=clean;sel.value=clean[0]||'';render(sel);
 if(!opt.silent)sel.dispatchEvent(new Event('change',{bubbles:true}));
}
function clear(sel,opt={}){set(sel,[],opt)}
function refresh(sel,opt={}){if(sel)enhance(sel,{selected:opt.selected!==undefined?opt.selected:values(sel),allText:opt.allText})}
function closeOthers(except){document.querySelectorAll('.vd-ms.open').forEach(x=>{if(x!==except)x.classList.remove('open')})}
function enhance(sel,opt={}){
 if(!sel||sel.tagName!=='SELECT'||sel.id==='themeSelect')return sel;
 let u=ui(sel);
 if(!u){
  sel.classList.add('vd-ms-native');
  const wrap=document.createElement('div');wrap.className='vd-ms';
  const button=document.createElement('button');button.type='button';button.className='vd-ms-button';button.innerHTML='<span>الكل</span><b>⌄</b>';
  const panel=document.createElement('div');panel.className='vd-ms-panel';
  const search=document.createElement('input');search.type='search';search.className='vd-ms-search';search.placeholder='بحث داخل الفلتر...';
  const actions=document.createElement('div');actions.className='vd-ms-actions';
  const all=document.createElement('button');all.type='button';all.textContent='تحديد الكل';
  const none=document.createElement('button');none.type='button';none.textContent='مسح';
  const list=document.createElement('div');list.className='vd-ms-list';
  actions.append(all,none);panel.append(search,actions,list);wrap.append(button,panel);sel.insertAdjacentElement('afterend',wrap);
  u={wrap,button,panel,search,list,all,none};sel._vdMultiUi=u;
  button.onclick=e=>{e.stopPropagation();const will=!wrap.classList.contains('open');closeOthers(wrap);wrap.classList.toggle('open',will);if(will){search.value='';render(sel);setTimeout(()=>search.focus(),0)}};
  search.oninput=()=>render(sel);panel.onclick=e=>e.stopPropagation();
  all.onclick=()=>{const q=norm(search.value).toLowerCase(),opts=Array.from(sel.options).filter(o=>{const v=norm(o.value),t=norm(o.textContent);return v&&!ALL.has(v)&&!ALL.has(t)&&(!q||t.toLowerCase().includes(q)||v.toLowerCase().includes(q))}).map(o=>o.value);set(sel,[...new Set([...values(sel),...opts])])};
  none.onclick=()=>clear(sel);
  if(!window.__vdMultiFilterDocBound){document.addEventListener('click',()=>closeOthers(null));window.__vdMultiFilterDocBound=true}
 }
 if(opt.allText)sel.dataset.vdAllText=opt.allText;
 set(sel,opt.selected!==undefined?opt.selected:values(sel),{silent:true});
 return sel;
}
window.VDMultiFilter={values,match,set,clear,refresh,enhance,isActive:sel=>values(sel).length>0};
})();