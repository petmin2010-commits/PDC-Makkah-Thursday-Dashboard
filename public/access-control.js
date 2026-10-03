(function(){
'use strict';

const state={
  ready:false,
  allow:new Set(),
  all:false,
  observer:null
};

function norm(value){
  return String(value==null?'':value)
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g,'')
    .replace(/ـ/g,'')
    .replace(/[أإآ]/g,'ا')
    .replace(/ة/g,'ه')
    .replace(/ى/g,'ي')
    .replace(/[°º]/g,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}

const ROOM_CANON=norm('غرفة التدقيق الذكية');
const aliases=new Map([
  [norm('غرفة التحقيق الذكية'),ROOM_CANON],
  [norm('غرفة التدقيق الذكية'),ROOM_CANON]
]);
function canon(value){
  const n=norm(value);
  return aliases.get(n)||n;
}

function labelOf(el){
  if(!el)return '';
  const span=el.querySelector('span');
  return String(span?span.textContent:el.textContent||'').trim();
}

function canLabel(label){
  if(state.all)return true;
  const key=canon(label);
  if(state.allow.has(key))return true;
  if(key===canon('تصدير تقرير اكسيل')){
    return state.allow.has(canon('مركز التقارير'));
  }
  return false;
}

function canElement(el){
  return canLabel(labelOf(el));
}

function setElementAccess(el,allowed){
  el.hidden=!allowed;
  if(allowed){
    el.style.removeProperty('display');
    el.removeAttribute('aria-hidden');
  }else{
    el.style.display='none';
    el.setAttribute('aria-hidden','true');
    el.classList.remove('active');
  }
}

function syncSectionLabels(){
  document.querySelectorAll('#nav .nav-section-label').forEach(label=>{
    let node=label.nextElementSibling;
    let hasVisible=false;
    while(node && !node.classList.contains('nav-section-label')){
      if(node.classList.contains('nav-item') && !node.hidden && node.style.display!=='none'){
        hasVisible=true;
        break;
      }
      node=node.nextElementSibling;
    }
    label.hidden=!hasVisible;
    label.style.display=hasVisible?'':'none';
  });
}

function removeNoAccess(){
  document.getElementById('permissionDeniedPage')?.remove();
}

function showNoAccess(){
  document.querySelectorAll('.page').forEach(page=>page.classList.remove('active'));
  let box=document.getElementById('permissionDeniedPage');
  if(box)return;
  box=document.createElement('section');
  box.id='permissionDeniedPage';
  box.className='page active';
  box.innerHTML='<article class="panel" style="max-width:760px;margin:48px auto;text-align:center;padding:34px"><h2 style="margin:0 0 10px">لا توجد صلاحية لعرض أي صفحة</h2><p style="margin:0">يرجى مراجعة مسؤول النظام لتحديد الصفحات المسموحة من عمود الصلاحية.</p></article>';
  const main=document.querySelector('main');
  if(main)main.appendChild(box);
}

function ensureAllowedActive(){
  const allowedActive=[...document.querySelectorAll('#nav .nav-item.active')]
    .find(el=>canElement(el) && !el.hidden && el.style.display!=='none');
  if(allowedActive){
    removeNoAccess();
    return;
  }
  const first=[...document.querySelectorAll('#nav .nav-item')]
    .find(el=>canElement(el) && !el.hidden && el.style.display!=='none');
  if(first){
    removeNoAccess();
    first.click();
  }else{
    showNoAccess();
  }
}

function applyAccess(){
  if(!state.ready)return;
  document.querySelectorAll('.nav-item,[data-smart-target]').forEach(el=>{
    setElementAccess(el,canElement(el));
  });
  syncSectionLabels();
  ensureAllowedActive();
}

function deny(){
  if(typeof window.toast==='function'){
    window.toast('لا تملك صلاحية الدخول إلى هذه الصفحة');
  }
}

document.addEventListener('click',event=>{
  if(!state.ready)return;
  const target=event.target.closest('.nav-item,[data-smart-target]');
  if(!target || canElement(target))return;
  event.preventDefault();
  event.stopImmediatePropagation();
  deny();
},true);

function wrapOpenPage(){
  if(typeof window.openPage!=='function' || window.openPage.__vdPermissionWrapped)return;
  const original=window.openPage;
  const pageLabels={
    master:'الرئيسية',projects:'المشاريع',connections:'التوصيلات',permits:'التصاريح',
    assets:'الأصول',closures:'الإغلاقات',tasks:'متابعة أعمال المواقع',emergency:'الطوارئ',
    safety:'مخالفات السلامة',executionViolations:'مخالفات التنفيذ',
    minutes:'محاضر مخالفة إثبات الحالة',dataQuality:'جودة البيانات',hrStaff:'الموارد البشرية للكادر',
    employeeEvaluation:'تقييم مهندسي المواقع',electricityEngineerEvaluation:'تقييم مهندسي شركة الكهرباء',
    wednesdayMeeting:'اجتماع الـ PDC',smartThursday:'تقرير الخميس الذكي',
    reportsCenter:'مركز التقارير',importantLinks:'الروابط المهمة',excelExport:'تصدير تقرير اكسيل'
  };
  const wrapped=function(key){
    const label=pageLabels[key];
    if(state.ready && label && !canLabel(label)){
      deny();
      return;
    }
    return original.apply(this,arguments);
  };
  wrapped.__vdPermissionWrapped=true;
  window.openPage=wrapped;
}

async function start(){
  try{
    const response=await fetch('/api/auth/me',{
      credentials:'same-origin',
      cache:'no-store'
    });
    if(response.status===401){
      window.location.replace('/login');
      return;
    }
    if(!response.ok)throw new Error('PERMISSIONS_LOAD_FAILED');
    const data=await response.json();
    const permissions=Array.isArray(data?.user?.permissions)?data.user.permissions:[];
    state.allow=new Set(permissions.map(canon).filter(Boolean));
    state.all=permissions.some(v=>['*','all','الكل','جميع الصفحات','كامل الصلاحيات'].includes(norm(v)));
    state.ready=true;
    window.vdCanAccessLabel=canLabel;
    window.vdAllowedPages=()=>permissions.slice();
    wrapOpenPage();
    applyAccess();

    const nav=document.getElementById('nav');
    const smartHost=document.getElementById('smartPageHeroHost');
    state.observer=new MutationObserver(()=>applyAccess());
    if(nav)state.observer.observe(nav,{childList:true,subtree:true});
    if(smartHost)state.observer.observe(smartHost,{childList:true,subtree:true});
  }catch(error){
    console.error('Dashboard permissions error:',error);
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else{
  start();
}
})();
