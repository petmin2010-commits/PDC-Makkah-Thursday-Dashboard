'use strict';
/* Live read-only briefings from existing dashboard aggregation methods.
   One country/city/project process per deployment; ACL applied before reads. */
const N=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const fmt=n=>Number(n||0).toLocaleString('ar-SA',{maximumFractionDigits:1});
const clip=(v,n=110)=>String(v??'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,n);
const group=(rows,key,cap=5)=>[...rows.reduce((m,r)=>{const val=clip(r[key]||'غير محدد',65);m.set(val,(m.get(val)||0)+1);return m;},new Map())]
 .sort((a,b)=>b[1]-a[1]).slice(0,cap);
const getTarget=(q,currentPage)=>{
 const nq=N(q);
 if(/تقرير الخميس|تقرير الخميس الذكي|الخميس الذكي/.test(nq))return 'smartThursday';
 if(/اجتماع pdc|اجتماع ال pdc|اجتماع بي دي سي/.test(nq)&&!/2|الثاني|٢/.test(nq))return 'wednesdayMeeting';
 if(currentPage==='smartThursday'||currentPage==='wednesdayMeeting'){
  if(/كم|عدد|نسب|مؤشر|بيانات|ملخص|حاله|اهم|تاخير|مقاولين|غرام|المستندات|التقارير/.test(nq))return currentPage;
 }
 return null;
};
function createNaifBriefings({getSmartThursdayPage_,getWednesdayMeetingData,canTab}){
 return async function ask({question,user,project,currentPage}){
  const tab=getTarget(question,currentPage);
  if(!tab)return null;
  if(!canTab(user,tab))return {answer:'لا تتوفر لك صلاحية قراءة '+(tab==='smartThursday'?'تقرير الخميس الذكي':'اجتماع PDC')+'.',connected:false,sources:[],project};
  try{
   if(tab==='smartThursday'){
    const page=await getSmartThursdayPage_();
    const report=page?.report||{},k=report.kpis||{},period=report.period||{},top=report.rankings?.contractors||[];
    const lines=[
     'الفترة: '+clip(period.label||period.from||'غير محددة',65),
     'ملاحظات/مخالفات الفترة الحالية: '+fmt(k.total),
     'الفترة السابقة: '+fmt(k.previousTotal)+'؛ الفارق: '+fmt(k.delta),
     'المغلق بتوثيق صريح: '+fmt(k.closedExplicit),
     'أوامر عمل فريدة: '+fmt(k.uniqueWorkOrders),
     'أوامر بها تكرار مخالفات: '+fmt(k.repeatedWorkOrders),
     'إجمالي الغرامات: '+fmt(k.totalPenalty)+' ريال',
     'سجلات بها فجوات بيانات: '+fmt(k.dataGapRecords)
    ];
    if(k.topContractor?.name)lines.push('أعلى مقاول بعدد الملاحظات: '+clip(k.topContractor.name,65)+' ('+fmt(k.topContractor.count)+')');
    if(/مقاول|توزيع|ترتيب/.test(N(question))&&top.length)lines.push('ترتيب المقاولين:\n'+top.slice(0,7).map(x=>'• '+clip(x.name,65)+': '+fmt(x.count)).join('\n'));
    return {answer:'مؤشرات تقرير الخميس الذكي — كهرباء '+project+':\n'+lines.map(x=>'• '+x).join('\n')+
     '\nالمصدر: محرك تقرير الخميس المدمج من مخالفات السلامة والتنفيذ ومحاضر إثبات الحالة، وليس تقديرًا عامًا. تاريخ التحديث: '+clip(page.updatedAt,46)+'.',
     project,connected:true,sources:[{page:'تقرير الخميس الذكي',sheet:'ملخص المخالفات الأسبوعية',records:page.rows?.length||0,updatedAt:page.updatedAt}]};
   }
   const data=await getWednesdayMeetingData();
   const rows=Array.isArray(data?.rows)?data.rows:[];
   const done=rows.filter(x=>x.completed).length,
     late=rows.filter(x=>x.delayedExecution).length,
     closure=rows.filter(x=>x.delayedClosure).length,
     pending155=rows.filter(x=>!/نعم|تم|مستلم/.test(N(x.consultant155Status))).length;
   const lines=[
    'إجمالي أوامر العمل: '+fmt(rows.length),
    'تم التنفيذ: '+fmt(done),
    'متأخر تنفيذ: '+fmt(late),
    'تأخر الإغلاق بعد التنفيذ: '+fmt(closure),
    'لم يثبت استلام/تسجيل 155 الاستشاري: '+fmt(pending155)
   ];
   if(rows.length)lines.push('نسبة التنفيذ: '+fmt(Math.round(done/rows.length*1000)/10)+'%');
   if(/توزيع|مقاول|المقاولين/.test(N(question)))lines.push('المقاولون الأعلى بعدد أوامر العمل:\n'+group(rows,'contractor').map(([k,v])=>'• '+k+': '+fmt(v)).join('\n'));
   if(/التصاريح/.test(N(question)))lines.push('حالات التصاريح:\n'+group(rows,'permitStatus').map(([k,v])=>'• '+k+': '+fmt(v)).join('\n'));
   return {answer:'مؤشرات اجتماع PDC — كهرباء '+project+':\n'+lines.map(x=>'• '+x).join('\n')+
    '\nالمصدر: ملخص اجتماع PDC من ورقة أوامر العمل، مع التمييز بين تأخر التنفيذ وتأخر الإغلاق. التحديث: '+clip(data.updatedAt,46)+'.',
    project,connected:true,sources:[{page:'اجتماع الـ PDC',sheet:'🏗️اوامر العمل',records:rows.length,updatedAt:data.updatedAt}]};
  }catch(error){
   return {answer:'تعذر قراءة بيانات '+(tab==='smartThursday'?'تقرير الخميس الذكي':'اجتماع PDC')+' من المصدر المصرح به؛ لن أقدّم قيمًا غير مؤكدة.'+
     (/429|quota|rate limit/.test(String(error?.message||error))?' السبب: تجاوز حد قراءة Google Sheets.':''),
    connected:false,project,sources:[]};
  }
 };
}
module.exports={createNaifBriefings,getTarget};