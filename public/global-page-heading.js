(function(){
'use strict';

const TITLES={
  master:'لوحة المتابعة الرئيسية',
  projects:'لوحة متابعة المشاريع',
  connections:'لوحة متابعة التوصيلات',
  permits:'لوحة متابعة التصاريح',
  assets:'لوحة متابعة الأصول',
  closures:'لوحة متابعة الإغلاقات',
  tasks:'لوحة متابعة أعمال المواقع',
  emergency:'لوحة متابعة الطوارئ',
  safety:'لوحة مخالفات السلامة',
  executionViolations:'لوحة مخالفات التنفيذ',
  minutes:'لوحة محاضر مخالفة إثبات الحالة',
  dataQuality:'لوحة جودة البيانات',
  hrStaff:'لوحة الموارد البشرية للكادر',
  employeeEvaluation:'لوحة تقييم مهندسي المواقع',
  electricityEngineerEvaluation:'لوحة تقييم مهندسي شركة الكهرباء',
  wednesdayMeeting:'لوحة اجتماع الـ PDC',
  smartThursday:'لوحة تقرير الخميس الذكي',
  importantLinks:'لوحة الروابط المهمة'
};

function navLabel(btn){
  return String(btn?.querySelector('span')?.textContent||btn?.textContent||'')
    .replace(/\s+/g,' ')
    .trim();
}

function fallbackTitle(label){
  if(!label)return 'لوحة المتابعة';
  if(label.startsWith('لوحة'))return label;
  if(label.includes('تقييم')||label.includes('مخالفات')||label.includes('محاضر')||label.includes('جودة')||label.includes('الموارد البشرية')||label.includes('تقرير'))return 'لوحة '+label;
  return 'لوحة متابعة '+label;
}

function updateGlobalPageHeading(){
  const root=document.getElementById('globalPageHeading');
  const title=document.getElementById('globalPageHeadingTitle');
  if(!root||!title)return;

  const active=document.querySelector('#nav .nav-item.active');
  const key=active?.dataset?.page||'master';
  const label=navLabel(active);
  title.textContent=TITLES[key]||fallbackTitle(label||key);
  root.dataset.page=key;
}

function bind(){
  const nav=document.getElementById('nav');
  if(!nav)return;

  nav.addEventListener('click',e=>{
    if(e.target.closest('.nav-item'))setTimeout(updateGlobalPageHeading,0);
  },true);

  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.type==='attributes'&&m.attributeName==='class')){
      updateGlobalPageHeading();
    }
  });

  observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  updateGlobalPageHeading();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);
else bind();

window.VDUpdateGlobalPageHeading=updateGlobalPageHeading;
})();