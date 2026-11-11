'use strict';
/* Complete but permission-filtered Naif dashboard index and schema registry.
   The catalogue is about coverage of page definitions; it is not a live data access grant. */
const catalog=require('./public/naif-dashboard-catalog');
const N=catalog.normalize;
const perms=entity=>(entity?.permissions||[]).map(N);
const aliases={
 reportArchive:['مركز التقارير'],
 reportsCenter:['مركز التقارير'],
 excelExport:['تقارير الاكسيل','تقارير excel','تصدير تقرير اكسيل'],
 contractorSafety:['تقييم المقاولين بالسلامة'],
 safetyCorrective:['مخالفات السلامة'],
 qualityCorrective:['السلامة والجودة'],
 projectsReportEngine:['المشاريع'],
 pdcMeeting2:['اجتماع الـ pdc','اجتماع pdc','اجتماع مع pdc']
};
const keyLabels={
 master:['الرئيسية'],projects:['المشاريع'],connections:['التوصيلات'],permits:['التصاريح'],assets:['الأصول'],closures:['الإغلاقات'],
 emergency:['الطوارئ'],tasks:['متابعة أعمال المواقع'],safety:['مخالفات السلامة'],
 safetyCorrective:['تقرير السلامة والإجراءات التصحيحية'],qualityCorrective:['تقرير الجودة والإجراءات التصحيحية'],
 engineeringInspection:['وكيل الفحص الهندسي الذكي'],temporaryGenerators:['تقرير المؤقتات والمولدات'],
 contractorSafety:['تقييم السلامة للمقاولين'],executionViolations:['مخالفات التنفيذ'],
 minutes:['محاضر مخالفة اثبات الحالة'],dataQuality:['جودة البيانات'],
 hrStaff:['الموارد البشرية للكادر'],employeeEvaluation:['تقييم مهندسي المواقع'],electricityEngineerEvaluation:['تقييم مهندسي شركة الكهرباء'],
 wednesdayMeeting:['اجتماع الـ pdc'],pdcMeeting2:['اجتماع pdc 2'],smartThursday:['تقرير الخميس الذكي'],
 reportsCenter:['مركز التقارير العام'],reportArchive:['سجل التقارير الصادرة'],importantLinks:['الروابط المهمة'],
 excelExport:['مركز تقارير الاكسيل'],projectsReportEngine:['projects report engine']
};
function canTab(user,key){
 const entry=catalog.byKey(key);if(!entry)return false;
 const raw=Array.isArray(user?.permissions)?user.permissions:[];
 const p=perms(user),role=N(user?.role),all=raw.some(x=>String(x).trim()==='*')||p.some(x=>['all','الكل','جميع الصفحات','كامل الصلاحيات'].includes(x));
 if(all||['admin','administrator','مدير النظام'].includes(role))return true;
 const exact=[entry.label,...(keyLabels[key]||[])].map(N);
 if(user?.precisePermissions===true)return exact.some(label=>p.includes(label));
 return [...exact,...(aliases[key]||[]).map(N)].some(label=>p.includes(label));
}
function isCatalogQuestion(query){
 const q=N(query);
 return /فهرس|المفهرس|الفهرسه|الخريطه|خريطه|خارطه|كل التبويبات|جميع التبويبات|قائمه التبويبات|اسماء التبويبات|كل الشيتات|مصادر البيانات|اعمده|الاعمده|الحقول|شرح|اشرح|وظيفه|ماذا يحتوي|مكونات|الاقسام|التقارير المتاحه|ماهي التقارير|ما هي التقارير|كيف استخدم|كيف اعرف|مهام نايف|قدرات نايف/.test(q);
}
function selectedEntry(query){
 const q=N(query);
 const keyed=catalog.entries.filter(e=>q.includes(N(e.label))||q.includes(N(e.key))).sort((a,b)=>N(b.label).length-N(a.label).length);
 if(keyed.length)return keyed[0];
 // Prefer known short canonical expressions, but never guess from a generic field.
 return catalog.find(query);
}
function createNaifDashboardIndex({APP}){
 const audit=catalog.audit(catalog.entries.map(e=>e.key));
 if(!audit.complete)throw Error('NAIF_CATALOG_IS_INCOMPLETE');
 return function query({question,user,project,currentPage}){
  if(!isCatalogQuestion(question))return null;
  const allowed=catalog.entries.filter(e=>canTab(user,e.key));
  const q=N(question);
  if(!allowed.length)return {answer:'لا توجد تبويبات مصرح لك بعرض تفاصيلها في مشروع '+project+'.',connected:false,sources:[],project,mode:'catalog'};
  const match=selectedEntry(question);
  const focus=match&&canTab(user,match.key)?match:null;
  if(match&&!focus)return {answer:'التبويب المطلوب غير متاح ضمن صلاحيات حسابك، ولذلك لا أستعرض تفاصيله.',connected:false,sources:[],project,mode:'catalog'};
  const sourceInfo=e=>{
   const cfg=APP.PAGES[e.key];
   if(cfg?.fields?.length)return cfg.fields
    .filter(f=>Array.isArray(f)&&!/جوال|هويه|بريد|كلمه مرور|الراتب|رقم الهاتف/i.test(f[1]))
    .map(f=>f[1]).slice(0,55);
   return [];
  };
  const describe=e=>{
   const fields=sourceInfo(e);
   return 'تبويب «'+e.label+'»: '+e.about+'\n'+
    'القوائم والأقسام المعروفة: '+e.sections.join('، ')+'.\n'+
    'مصادر البيانات: '+e.sources.join('، ')+'.\n'+
    'الملفات البرمجية المرتبطة: '+e.module+'.'+
    (e.api?'\nواجهة البيانات المرتبطة: '+e.api+'.':'')+
    (fields.length?'\nالحقول المفهرسة: '+fields.join('، ')+'.':'')+
    '\nأمثلة للأسئلة: '+e.prompts.join('؛ ')+'.'+
    '\nنوع الربط: '+(e.kind==='sheet'?'شيت موصوف الحقول':e.kind==='analysis'?'محرك تحليل مستقل':e.kind==='archive'?'أرشيف مستقل':e.kind==='report'?'منشئ تقارير':'مكون داشبورد مستقل')+'.';
  };
  if(focus)return {answer:describe(focus)+'\nالمشروع الحالي: '+project+'. لا تُعرض أرقام أو ملفات من مصدر غير مصرح به.',
   connected:true,project,mode:'catalog',sources:[{page:focus.label,sheet:focus.sources.join('، ')}]};
  const count=allowed.length;
  const permittedExtra=catalog.extra.filter(x=>canTab(user,x.belongsTo));
  const showAll=/كل|جميع|الفهرس|خارطه|خريطه|الشيتات|المصادر/.test(q);
  const entries=showAll?allowed:allowed.slice(0,12);
  const answer='فهرس نايف لمشروع كهرباء '+project+': يوجد '+catalog.entries.length+' تبويبًا رئيسيًا في النسخة البرمجية.\n'+
   'المتاح لصلاحيات حسابك: '+count+' تبويبًا.\n'+
   'التبويبات ومصادرها:\n'+entries.map(e=>'• '+e.label+' — '+e.sources.join(' / ')).join('\n')+
   (!showAll&&count>entries.length?'\nاطلب «جميع التبويبات» لعرض بقية المصادر.':'')+
   (permittedExtra.length?'\nمصادر البيانات المضمنة داخل صفحات أخرى: '+permittedExtra.map(x=>x.label+' ('+x.source+')').join('؛ ')+'.':'')+
   '\nمؤشر تغطية الفهرس التعريفي: '+audit.indexed+'/'+audit.navigationTotal+' ('+audit.percent+'%). لا يعني هذا أن كل مصدر بيانات أو وظيفة تصدير قد تم اختبارها بحساب حي.';
  return {answer,connected:true,project,mode:'catalog',sources:entries.map(e=>({page:e.label,sheet:e.sources.join(', ')})),coverage:audit};
 };
}
module.exports={createNaifDashboardIndex,canTab,isCatalogQuestion,catalog};