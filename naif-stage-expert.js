'use strict';
/* Precise execution-stage data from city-local authorized dashboard sheets.
 * Do not turn requests for stage/status into generic chart descriptions.
 * Read-only, source-specific, bounded and cache-aware. */
const N=v=>String(v??'').normalize('NFKC').toLowerCase()
 .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
 .replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
 .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const fmt=n=>Number(n||0).toLocaleString('ar-SA',{maximumFractionDigits:1});
const value=v=>String(v??'').replace(/[\r\n\t\u0000-\u001f]+/g,' ').trim().slice(0,100);
function isStageQuestion(query){
 const q=N(query);
 return /مرحله التنفيذ|حاله المرحله|مراحل التنفيذ|حالات المراحل|توزيع المراحل|حاله مراحل|مرحله الانجاز/.test(q)
  && !/^(?:اشرح|كيف تحسب|كيف يتم حساب|تعريف|ما معنى|ما المقصود)/.test(q);
}
const sourceNames={projects:['المشاريع','مشاريع'],connections:['التوصيلات','توصيلات'],operations:['العمليات','الانشاءات'],workorders:['اوامر العمل','اوامر','الطلبات']};
function chooseSources(query,currentPage,APP,canPage,user){
 const q=N(query);
 const keys=['projects','connections','operations','workorders'].filter(k=>APP.PAGES[k]?.fields?.some(f=>f[0]==='stage')&&APP.PAGES[k]?.fields?.some(f=>f[0]==='stageStatus'));
 const requested=keys.filter(k=>sourceNames[k].some(s=>q.includes(N(s))));
 if(requested.length)return {keys:requested.filter(k=>canPage(user,k)),denied:requested.some(k=>!canPage(user,k))};
 const available=keys.filter(k=>canPage(user,k));
 if(!available.length)return {keys:[],denied:true};
 if(/كل المصادر|جميع المصادر|جميع الاقسام|كل الاقسام|كل المشاريع والتوصيلات/.test(q))return {keys:available,denied:false};
 if(available.includes(currentPage))return {keys:[currentPage],denied:false};
 return {keys:[available.includes('projects')?'projects':available[0]],denied:false};
}
const series=(rows,key,max=18)=>{
 const counts=new Map();
 for(const r of rows){const v=value(r?.[key])||'غير محدد';counts.set(v,(counts.get(v)||0)+1);}
 return {totalDistinct:counts.size,groups:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,max)};
};
const pairs=(rows,max=18)=>{
 const counts=new Map();
 for(const r of rows){
  const a=value(r.stage)||'غير محدد',b=value(r.stageStatus)||'غير محدد',k=a+'\u241f'+b;
  const old=counts.get(k);if(old)old.count++;else counts.set(k,{stage:a,status:b,count:1});
 }
 return {totalDistinct:counts.size,groups:[...counts.values()].sort((a,b)=>b.count-a.count).slice(0,max)};
};
function summarize(page,rows,at,stale){
 if(!Array.isArray(rows)||!rows.length)return 'لا توجد سجلات مقروءة حاليًا في تبويب «'+page.title+'»، فلا يمكنني استنتاج أعداد للمراحل.';
 const stages=series(rows,'stage'),statuses=series(rows,'stageStatus'),matrix=pairs(rows);
 const total=rows.length;
 const nonemptyStage=rows.filter(r=>value(r.stage)).length,nonemptyStatus=rows.filter(r=>value(r.stageStatus)).length;
 const formatGroup=([label,n])=>'• '+label+': '+fmt(n)+' ('+fmt(Math.round(n/total*1000)/10)+'%)';
 const list=(data)=>data.groups.map(formatGroup).join('\n')+(data.totalDistinct>data.groups.length?'\nهناك '+fmt(data.totalDistinct-data.groups.length)+' قيمة إضافية لم تُعرض بسبب طول القائمة.':'');
 return 'بيانات «'+page.title+'» — الشيت «'+page.sheet+'»:\n'+
  'إجمالي السجلات: '+fmt(total)+'، مرحلة التنفيذ محددة في '+fmt(nonemptyStage)+' سجل، وحالة المرحلة محددة في '+fmt(nonemptyStatus)+' سجل.\n'+
  '\nمرحلة التنفيذ (توزيع القيم):\n'+list(stages)+
  '\n\nحالة المرحلة (توزيع القيم):\n'+list(statuses)+
  '\n\nالربط بين «مرحلة التنفيذ» و«حالة المرحلة»:\n'+matrix.groups.map(x=>'• '+x.stage+' ← '+x.status+': '+fmt(x.count)).join('\n')+
  (matrix.totalDistinct>matrix.groups.length?'\nهناك '+fmt(matrix.totalDistinct-matrix.groups.length)+' تركيبة إضافية لم تُعرض.':'')+
  '\nتاريخ آخر قراءة ناجحة: '+new Date(at).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'})+'.'+
  (stale?'\nتنبيه: هذه أرقام من آخر قراءة ناجحة، ولم ينجح تحديث المصدر الآن.':'');
}
function createNaifStageExpert({APP,readConfiguredSheet,canPage,now=()=>new Date()}){
 const cache=new Map(),inflight=new Map();
 async function read(key){
  const entry=cache.get(key),t=Date.now();
  if(entry&&entry.expires>t)return entry;
  if(inflight.has(key))return inflight.get(key);
  const task=(async()=>{
   try{
    const rows=await readConfiguredSheet(APP.PAGES[key],key);
    if(!Array.isArray(rows))throw Error('SOURCE_NOT_ARRAY');
    const fresh={rows,at:now().toISOString(),expires:Date.now()+90000,stale:false};
    cache.set(key,fresh);return fresh;
   }catch(err){
    if(entry){const stale={...entry,expires:Date.now()+30000,stale:true};cache.set(key,stale);return stale;}
    throw err;
   }
  })().finally(()=>inflight.delete(key));
  inflight.set(key,task);
  return task;
 }
 return async function ask({question,currentPage,user,project}){
  if(!isStageQuestion(question))return null;
  const source=chooseSources(question,currentPage,APP,canPage,user);
  if(source.denied)return {answer:'السؤال يشير إلى مصدر غير مصرح لك بقراءته في لوحة كهرباء '+project+'. لن أستبدله بشيت آخر.',sources:[],connected:false,project,mode:'stage'};
  if(!source.keys.length)return {answer:'لا تتوفر لك صلاحية قراءة حقلي مرحلة التنفيذ وحالة المرحلة من أي مصدر متصل.',sources:[],connected:false,project,mode:'stage'};
  const results=await Promise.all(source.keys.map(async key=>{
   const page={key,title:APP.PAGES[key].title,sheet:APP.PAGES[key].sheet};
   try{
    const data=await read(key);
    return {page,count:data.rows.length,answer:summarize(page,data.rows,data.at,data.stale),at:data.at,stale:data.stale};
   }catch(e){return {page,error:'تعذر قراءة المصدر الآن',answer:'تعذر قراءة '+page.title+' من الشيت «'+page.sheet+'»؛ لا أُصدر أرقامًا دون دليل.'};}
  }));
  const good=results.filter(r=>!r.error);
  return {answer:'قراءة مباشرة لحقلي «مرحلة التنفيذ» و«حالة المرحلة» — كهرباء '+project+':\n\n'+results.map(x=>x.answer).join('\n\n')+
   '\n\nالمصدر: حقلا stage وstageStatus من الشيتات المذكورة، وفق صلاحيات الحساب. الأرقام تشمل كامل الشيت المقروء دون فلاتر المتصفح المحلية.'+
   (source.keys.length>1?'\nمهم: مصادر الصفحات قد تتداخل؛ لا تجمع إجمالي سجلاتها كأنها أوامر مستقلة.':''),
   sources:good.map(x=>({page:x.page.title,sheet:x.page.sheet,records:x.count,readAt:x.at,stale:!!x.stale})),
   connected:good.length>0,project,mode:'stage'};
 };
}
module.exports={createNaifStageExpert,isStageQuestion,chooseSources,series,pairs,summarize};