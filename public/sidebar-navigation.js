(()=>{
'use strict';
const COLLAPSE_KEY='vd.sidebar.collapsed';
const GROUP_KEY='vd.sidebar.group';
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
const groupMeta=label=>{
 const t=norm(label);
 if(t.includes('التشغيل'))return{key:'operations',title:'المتابعة التشغيلية',icon:'▦'};
 if(t.includes('التحليل')||t.includes('التقارير'))return{key:'analytics',title:'التحليل الذكي و التقارير',icon:'▥'};
 return{key:'admin',title:'المتابعة الادارية',icon:'⚙'};
};
function groups(nav){return $$('.vd-nav-group',nav)}
function setOneOpen(nav,target,persist=true){
 groups(nav).forEach(g=>{const on=g===target;g.classList.toggle('is-open',on);$('.vd-nav-group-head',g)?.setAttribute('aria-expanded',String(on))});
 if(target&&persist)try{localStorage.setItem(GROUP_KEY,target.dataset.groupKey||'')}catch(e){}
}
function activeGroup(nav){
 const item=$('.nav-item.active',nav);
 return item?.closest('.vd-nav-group')||null;
}
function installSearch(sidebar,nav){
 if($('#sidebarNavSearch',sidebar))return;
 const box=document.createElement('div');box.className='vd-sidebar-search';
 box.innerHTML='<button type="button" class="vd-sidebar-search-clear" aria-label="مسح البحث">×</button><input id="sidebarNavSearch" type="search" autocomplete="off" placeholder="ابحث عن شاشة..."><span class="vd-sidebar-search-icon" aria-hidden="true">⌕</span>';
 sidebar.insertBefore(box,nav);
 const input=$('#sidebarNavSearch',box),clear=$('.vd-sidebar-search-clear',box);
 const run=()=>{
  const q=norm(input.value);
  groups(nav).forEach(g=>{
   let hits=0;
   $$('.nav-item',g).forEach(item=>{const match=!q||norm(item.textContent).includes(q);item.classList.toggle('vd-nav-search-hidden',!match);if(match)hits++});
   g.classList.toggle('vd-nav-search-nohit',!!q&&!hits);
   if(q&&hits){g.classList.add('is-open');$('.vd-nav-group-head',g)?.setAttribute('aria-expanded','true')}
  });
  clear.classList.toggle('is-visible',!!q);
  if(!q){groups(nav).forEach(g=>g.classList.remove('vd-nav-search-nohit'));setOneOpen(nav,activeGroup(nav)||groups(nav)[0],false)}
 };
 input.addEventListener('input',run);
 clear.addEventListener('click',()=>{input.value='';run();input.focus()});
 nav.addEventListener('click',e=>{if(e.target.closest('.nav-item')&&input.value){input.value='';run()}});
}
function installToggle(sidebar){
 if($('#sidebarCollapseToggle'))return;
 const btn=document.createElement('button');btn.type='button';btn.id='sidebarCollapseToggle';btn.className='vd-sidebar-toggle';
 document.body.appendChild(btn);
 const apply=collapsed=>{
  document.body.classList.toggle('vd-sidebar-collapsed',collapsed);
  btn.textContent=collapsed?'›':'‹';
  btn.setAttribute('aria-label',collapsed?'إظهار القائمة':'إخفاء القائمة وتوسيع الشاشة');
  btn.title=collapsed?'إظهار القائمة':'إخفاء القائمة وتوسيع الشاشة';
  try{localStorage.setItem(COLLAPSE_KEY,collapsed?'1':'0')}catch(e){}
 };
 let collapsed=false;try{collapsed=localStorage.getItem(COLLAPSE_KEY)==='1'}catch(e){}
 apply(collapsed);btn.addEventListener('click',()=>apply(!document.body.classList.contains('vd-sidebar-collapsed')));
}
function buildGroups(nav){
 if(nav.dataset.vdGrouped==='1')return;
 const raw=[...nav.children],frag=document.createDocumentFragment();let body=null;
 raw.forEach(el=>{
  if(el.classList?.contains('nav-section-label')){
   const meta=groupMeta(el.textContent),wrap=document.createElement('section');wrap.className='vd-nav-group';wrap.dataset.groupKey=meta.key;
   wrap.innerHTML='<button type="button" class="vd-nav-group-head" aria-expanded="false"><span class="vd-nav-group-icon">'+meta.icon+'</span><span class="vd-nav-group-title">'+meta.title+'</span><span class="vd-nav-group-chevron">⌄</span></button><div class="vd-nav-group-items"></div>';
   frag.appendChild(wrap);body=$('.vd-nav-group-items',wrap);el.remove();return;
  }
  if(el.classList?.contains('nav-item')){if(!body){const wrap=document.createElement('section');wrap.className='vd-nav-group';wrap.dataset.groupKey='operations';wrap.innerHTML='<button type="button" class="vd-nav-group-head" aria-expanded="false"><span class="vd-nav-group-icon">▦</span><span class="vd-nav-group-title">المتابعة التشغيلية</span><span class="vd-nav-group-chevron">⌄</span></button><div class="vd-nav-group-items"></div>';frag.appendChild(wrap);body=$('.vd-nav-group-items',wrap)}body.appendChild(el)}
 });
 nav.appendChild(frag);nav.dataset.vdGrouped='1';
 groups(nav).forEach(g=>$('.vd-nav-group-head',g)?.addEventListener('click',()=>{
  const open=g.classList.contains('is-open');if(open){g.classList.remove('is-open');$('.vd-nav-group-head',g).setAttribute('aria-expanded','false')}else setOneOpen(nav,g,true)
 }));
 let preferred=null;try{preferred=localStorage.getItem(GROUP_KEY)}catch(e){}
 const initial=activeGroup(nav)||groups(nav).find(g=>g.dataset.groupKey===preferred)||groups(nav)[0];setOneOpen(nav,initial,false);
 nav.addEventListener('click',e=>{const item=e.target.closest('.nav-item');if(item){const g=item.closest('.vd-nav-group');if(g)setOneOpen(nav,g,true)}});
 new MutationObserver(muts=>{if($('#sidebarNavSearch')?.value)return;if(muts.some(m=>m.type==='attributes'&&m.target.classList?.contains('nav-item')&&m.target.classList.contains('active'))){const g=activeGroup(nav);if(g)setOneOpen(nav,g,false)}})
  .observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 nav.classList.add('vd-sidebar-ready');
}
function boot(){
 const sidebar=$('.sidebar'),nav=$('#nav');if(!sidebar||!nav)return;
 installToggle(sidebar);
 let tries=0;const wait=()=>{tries++;if($('#smartCenterNav',nav)||tries>=8){buildGroups(nav);installSearch(sidebar,nav)}else setTimeout(wait,90)};
 setTimeout(wait,160);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
