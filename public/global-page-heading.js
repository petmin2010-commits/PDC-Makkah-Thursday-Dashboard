(function(){
'use strict';

const PAGE_META={
  master:{
    eyebrow:'MAIN DASHBOARD • CONTROL HUB',
    title:'لوحة المتابعة الرئيسية',
    subtitle:'ملخص تنفيذي موحد لحالة المشروع ومؤشرات الأداء الرئيسية.',
    icon:'⌂',
    from:'#17355f',to:'#2b7de9',accent:'#76c7ff'
  },
  projects:{
    eyebrow:'PROJECTS OPERATIONS • DELIVERY VIEW',
    title:'متابعة المشاريع',
    subtitle:'متابعة أوامر المشاريع ونسب الإنجاز والتقدم التنفيذي بالمواقع.',
    icon:'⚡',
    from:'#5f3a12',to:'#e79b24',accent:'#ffd06d'
  },
  connections:{
    eyebrow:'CONNECTIONS TRACKER • FIELD DELIVERY',
    title:'متابعة التوصيلات',
    subtitle:'متابعة أوامر التوصيلات وحالة التنفيذ والإنجاز الميداني.',
    icon:'◎',
    from:'#143b66',to:'#3b8df3',accent:'#82c7ff'
  },
  permits:{
    eyebrow:'PERMITS CONTROL ROOM • APPROVAL FLOW',
    title:'متابعة التصاريح',
    subtitle:'متابعة إصدار التصاريح وحالة الطلبات والتأخيرات والإغلاقات.',
    icon:'▤',
    from:'#0f4a61',to:'#1da9c9',accent:'#72e5f4'
  },
  assets:{
    eyebrow:'ASSETS VERIFICATION • FIELD RECORDS',
    title:'متابعة الأصول',
    subtitle:'متابعة تسجيل الأصول واختبارات التركيب وجودة البيانات الفنية.',
    icon:'⬡',
    from:'#37265f',to:'#875fe0',accent:'#c4adff'
  },
  closures:{
    eyebrow:'CLOSURES CONTROL • COMPLETION VIEW',
    title:'متابعة الإغلاقات',
    subtitle:'متابعة الأعمال في مرحلة الإغلاق ونسب الاكتمال والمتبقي.',
    icon:'✓',
    from:'#0c5034',to:'#1eb87c',accent:'#7ce1b6'
  },
  tasks:{
    eyebrow:'SITE OPERATIONS • DAILY FOLLOW-UP',
    title:'متابعة أعمال المواقع',
    subtitle:'متابعة المهام اليومية وحالة التنفيذ والإفادات الميدانية.',
    icon:'✦',
    from:'#153e66',to:'#278fd1',accent:'#83d5ff'
  },
  emergency:{
    eyebrow:'EMERGENCY RESPONSE • LIVE STATUS',
    title:'متابعة إشعارات الطوارئ',
    subtitle:'متابعة الإشعارات الطارئة والمجدولة وسرعة الاستجابة والإنجاز.',
    icon:'⚠',
    from:'#641729',to:'#ef4d69',accent:'#ff9aae'
  },
  safety:{
    eyebrow:'SAFETY CONTROL • COMPLIANCE VIEW',
    title:'مخالفات السلامة',
    subtitle:'تحليل مخالفات السلامة والاتجاهات والإجراءات التصحيحية.',
    icon:'⚠',
    from:'#6c4211',to:'#ef9622',accent:'#ffd276'
  },
  executionViolations:{
    eyebrow:'EXECUTION QUALITY • VIOLATIONS ANALYTICS',
    title:'مخالفات التنفيذ',
    subtitle:'تحليل مخالفات التنفيذ وتكرارها ومصادرها وحالة المعالجة.',
    icon:'⊘',
    from:'#5a1728',to:'#dc385d',accent:'#ff8ba1'
  },
  minutes:{
    eyebrow:'CASE VIOLATION MINUTES • EVIDENCE VIEW',
    title:'محاضر مخالفة إثبات الحالة',
    subtitle:'قراءة المحاضر والغرامات والمقاولين وحالة الرفع ومصادر البيانات.',
    icon:'≡',
    from:'#3b2868',to:'#8551ce',accent:'#c7a6ff'
  },
  dataQuality:{
    eyebrow:'DATA QUALITY • SMART VALIDATION',
    title:'جودة البيانات',
    subtitle:'قياس اكتمال البيانات وكشف الفجوات والتناقضات ومتابعة جودة السجلات.',
    icon:'◆',
    from:'#0d5448',to:'#24b89b',accent:'#86f1d8'
  },
  hrStaff:{
    eyebrow:'HUMAN RESOURCES • STAFF CONTROL',
    title:'الموارد البشرية للكادر',
    subtitle:'متابعة الكادر والتوزيع والحالة الوظيفية والتدريب ومتطلبات المشروع.',
    icon:'◆',
    from:'#5a1f73',to:'#c03ce4',accent:'#eda7ff'
  },
  employeeEvaluation:{
    eyebrow:'SITE ENGINEERS • PERFORMANCE VIEW',
    title:'تقييم مهندسي المواقع',
    subtitle:'تقييم الأداء الميداني وجودة المتابعة ونسب الإنجاز ومؤشرات الالتزام.',
    icon:'★',
    from:'#17467d',to:'#368cf4',accent:'#91c9ff'
  },
  electricityEngineerEvaluation:{
    eyebrow:'UTILITY ENGINEERS • PERFORMANCE VIEW',
    title:'تقييم مهندسي شركة الكهرباء',
    subtitle:'تحليل أداء مهندسي شركة الكهرباء وفق مؤشرات المتابعة والإنجاز وجودة البيانات.',
    icon:'◈',
    from:'#153968',to:'#2878e8',accent:'#82c6ff'
  },
  wednesdayMeeting:{
    eyebrow:'PDC MEETING • MANAGEMENT BRIEF',
    title:'اجتماع الـ PDC',
    subtitle:'ملخص إداري للمؤشرات والقرارات والملاحظات المطلوبة قبل اجتماع الـ PDC.',
    icon:'▦',
    from:'#6a4709',to:'#efa914',accent:'#ffe184'
  },
  smartThursday:{
    eyebrow:'SMART THURSDAY • WEEKLY EXECUTIVE BRIEF',
    title:'تقرير الخميس الذكي',
    subtitle:'ملخص أسبوعي ذكي للتقدم والتغيرات والمؤشرات والقرارات المطلوبة.',
    icon:'▣',
    from:'#57400f',to:'#d79a22',accent:'#ffe08a'
  },
  importantLinks:{
    eyebrow:'PROJECT RESOURCES • QUICK ACCESS',
    title:'الروابط المهمة',
    subtitle:'وصول سريع إلى الأنظمة والملفات والروابط التشغيلية المعتمدة للمشروع.',
    icon:'↗',
    from:'#3e2c6f',to:'#6958d9',accent:'#b9afff'
  }
};

const DEFAULT_META={
  eyebrow:'VISION DIMENSIONS • PROJECT CONTROL',
  title:'لوحة المتابعة',
  subtitle:'عرض تنفيذي موحد لبيانات المشروع.',
  icon:'◆',
  from:'#17355f',to:'#2b7de9',accent:'#76c7ff'
};

function navLabel(btn){
  return String(btn?.querySelector('span')?.textContent||btn?.textContent||'')
    .replace(/\s+/g,' ')
    .trim();
}

function fallbackTitle(label){
  if(!label)return DEFAULT_META.title;
  if(label.startsWith('لوحة'))return label;
  if(label.includes('تقييم')||label.includes('مخالفات')||label.includes('محاضر')||label.includes('جودة')||label.includes('الموارد البشرية')||label.includes('تقرير'))return 'لوحة '+label;
  return 'لوحة متابعة '+label;
}

function ensureStructure(root){
  if(root.querySelector('.gph-copy'))return;
  const currentTitle=String(root.querySelector('h1')?.textContent||DEFAULT_META.title).trim();
  root.innerHTML=
    '<div class="gph-copy">'+
      '<span id="globalPageHeadingEyebrow" class="gph-eyebrow">'+DEFAULT_META.eyebrow+'</span>'+
      '<div class="gph-title-line">'+
        '<span id="globalPageHeadingIcon" class="gph-icon" aria-hidden="true">'+DEFAULT_META.icon+'</span>'+
        '<h1 id="globalPageHeadingTitle">'+currentTitle+'</h1>'+
      '</div>'+
      '<p id="globalPageHeadingSubtitle" class="gph-subtitle">'+DEFAULT_META.subtitle+'</p>'+
    '</div>';
}

function updateGlobalPageHeading(){
  const root=document.getElementById('globalPageHeading');
  if(!root)return;
  ensureStructure(root);

  const active=document.querySelector('#nav .nav-item.active');

  const smartSectionIds=new Set([
    'smartCenterNav',
    'temporalMemoryNav',
    'investigationRoomNav',
    'explainableDecisionNav',
    'workOrder360Nav'
  ]);

  const hideForSmartSection=
    smartSectionIds.has(active?.id||'')
    || active?.dataset?.page==='smartThursday';

  if(hideForSmartSection)root.style.setProperty('display','none','important');
  else root.style.removeProperty('display');

  if(hideForSmartSection)return;

  const key=active?.dataset?.page||'master';
  const label=navLabel(active);
  const meta=PAGE_META[key]||{
    ...DEFAULT_META,
    title:fallbackTitle(label||key)
  };

  const eyebrow=document.getElementById('globalPageHeadingEyebrow');
  const title=document.getElementById('globalPageHeadingTitle');
  const subtitle=document.getElementById('globalPageHeadingSubtitle');
  const icon=document.getElementById('globalPageHeadingIcon');

  if(eyebrow)eyebrow.textContent=meta.eyebrow;
  if(title)title.textContent=meta.title;
  if(subtitle)subtitle.textContent=meta.subtitle;
  if(icon)icon.textContent=meta.icon;

  root.dataset.page=key;
  root.style.setProperty('--gph-from',meta.from);
  root.style.setProperty('--gph-to',meta.to);
  root.style.setProperty('--gph-accent',meta.accent);
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