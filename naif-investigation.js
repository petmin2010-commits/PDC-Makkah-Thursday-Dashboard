'use strict';
/* Evidence-based cross-sheet work-order investigations. Read-only and ACL-scoped. */
const N=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const fmt=n=>Number(n||0).toLocaleString('ar-SA',{maximumFractionDigits:1});
const clean=x=>String(x??'').replace(/[\r\n\u0000-\u001f]+/g,' ').trim().slice(0,100);
const id=x=>{const t=N(x).replace(/[\s-]/g,'');return /^\d{6,18}$/.test(t)?t:null};
const issue=x=>/متاخر|تاخير|ناقص|غير مكتمل|لم يتم|لم يستلم|لم يرفع|لم يصدر|غير صادر|معلق|متوقف|مرفوض|غير معتمد|اعاده|غير منفذ/.test(N(x));
const isInvestigation=q=>/لماذا|ليه|ليش|سبب|اسباب|جذري|تحليل|حلل|اربط|العلاقه|الارتباط|الاختناق|المعوقات|المتسبب|المسؤول|المسئول|اخطر|المخاطر|توصيه|توصيات|اقترح|التصعيد|تاخرت|متاخر|تاخير|تقييم الاداء|من الاكثر|360|ملف الامر|تتبع الامر/.test(N(q));
const names={workorders:'أوامر العمل',projects:'المشاريع',connections:'التوصيلات',operations:'العمليات الإنشائية',permits:'التصاريح',closures:'الإغلاقات',assets:'الأصول',tasks:'الإفادات',attachments:'مرفقات المقاول',safety:'مخالفات السلامة',executionViolations:'مخالفات التنفيذ',minutes:'محاضر المخالفات'};
const sourceOrder=['workorders','projects','connections','operations','permits','closures','assets','tasks','attachments','safety','executionViolations','minutes'];
function chooseSources(q,APP,canPage,user){
 const available=sourceOrder.filter(k=>APP.PAGES[k]?.sheet);
 const authorized=available.filter(k=>canPage(user,k));
 const s=N(q);
 const explicit=available.filter(k=>s.includes(N(names[k])));
 if(explicit.some(k=>!authorized.includes(k)))return {selected:[],denied:true};
 if(!authorized.length)return {selected:[],denied:true};
 const main=explicit.length?explicit:authorized.filter(k=>['workorders','projects','connections'].includes(k));
 const context=authorized.filter(k=>!main.includes(k)&&['permits','closures','tasks','attachments','safety','executionViolations','minutes'].includes(k));
 return {selected:[...new Set([...main,...context,...authorized])].slice(0,8),denied:false};
}
function correlate(sources){
 const joined=new Map(),unmatched=[];
 for(const src of sources)for(const row of src.rows){
  const k=id(row.workOrder)||id(row.workOrderCode);
  if(!k){unmatched.push({source:src.key,row:row._row});continue;}
  if(!joined.has(k))joined.set(k,{id:k,records:[],sources:new Set(),contractors:new Set(),engineers:new Set()});
  const item=joined.get(k);
  item.records.push({source:src.key,sheet:src.sheet,row:row._row||null,data:row});
  item.sources.add(src.key);
  if(clean(row.contractor))item.contractors.add(clean(row.contractor));
  if(clean(row.engineer))item.engineers.add(clean(row.engineer));
 }
 return {joined,unmatched};
}
function evidenceFor(items){
 const evidence=[],seen=new Set();
 const add=(item,rule,label,detail,severity,action)=>{
  const tag=item.id+'|'+rule;
  if(seen.has(tag))return;
  seen.add(tag);
  evidence.push({order:item.id,rule,label,detail:clean(detail),severity,action,source:item.source,sheet:item.sheet,row:item.row});
 };
 for(const record of items){
  const r=record.data,source=record.source,order=id(r.workOrder)||id(r.workOrderCode);
  if(!order)continue;
  const p={...record,id:order};
  if(['workorders','projects','connections','operations'].includes(source)){
   if(issue(r.delay))add(p,'delay','تأخير مسجل',r.delay,3,'التحقق من تواريخ التأخير وأسبابه المسجلة');
   if(issue(r.stageStatus))add(p,'stage','تعثر مرحلة',clean(r.stage)+' / '+clean(r.stageStatus),2,'تحديث سبب توقف المرحلة');
   if(issue(r.permit))add(p,'permit-work','تعثر تصريح',r.permit,2,'مطابقة حالة التصريح مع سجل بلدي');
   if(/لم يتم التنفيذ|غير منفذ/.test(N(r.status||r.executionStatus)))add(p,'execution','عدم اكتمال التنفيذ',r.executionStatus||r.status,2,'مراجعة البرنامج الزمني والأعمال المتبقية');
  }
  if(source==='permits'&&issue(r.permitStatus))add(p,'permit','تصريح غير مكتمل',r.permitStatus,3,'التأكد من متطلبات التصريح والجهة المختصة');
  if(source==='closures')for(const [field,label] of [['docsReceived','استلام المستندات'],['docsReview','مراجعة المستندات'],['systemUpload','رفع المستندات'],['certificate','شهادة الإنجاز']])
   if(issue(r[field]))add(p,'closure-'+field,'تعثر '+label,r[field],2,'التحقق من حالة '+label);
  if(source==='attachments'&&(issue(r.status)||issue(r.notes)))add(p,'attachments','نقص مرفقات',r.status||r.notes,2,'استكمال المرفقات وتوثيق تاريخ الاستلام');
  if(source==='tasks'&&(issue(r.resolved)||issue(r.attachments)))add(p,'field','إفادة/مرفقات معلقة',r.resolved||r.attachments,1,'طلب إفادة محدثة من الموقع');
  if(['safety','executionViolations','minutes'].includes(source))add(p,'violation-'+source,'مخالفة أو محضر',r.violation||r.violation1||r.minuteType||'سجل مخالفة',2,'مراجعة أثر المخالفة قبل استنتاج السبب');
 }
 return evidence;
}
function createNaifInvestigations({APP,readConfiguredSheet,canPage,now=()=>new Date()}){
 const cache=new Map(),inflight=new Map();
 async function read(k){
  const previous=cache.get(k),t=Date.now();
  if(previous&&previous.expires>t)return previous;
  if(inflight.has(k))return inflight.get(k);
  const promise=(async()=>{
   try{
    const rows=await readConfiguredSheet(APP.PAGES[k],k);
    if(!Array.isArray(rows))throw Error('INVALID_SOURCE');
    const data={key:k,sheet:APP.PAGES[k].sheet,rows,readAt:now().toISOString(),expires:Date.now()+90000,stale:false};
    cache.set(k,data);return data;
   }catch(e){
    if(previous){const old={...previous,stale:true,expires:Date.now()+30000};cache.set(k,old);return old;}
    throw e;
   }
  })().finally(()=>inflight.delete(k));
  inflight.set(k,promise);return promise;
 }
 return async function investigate({question,user,project}){
  if(!isInvestigation(question))return null;
  const selection=chooseSources(question,APP,canPage,user);
  if(selection.denied)return {answer:'هذا التحليل يتطلب مصدرًا غير مصرح به لحسابك. لن أستبدله ببيانات غير متعلقة بالسؤال.',sources:[],connected:false,project,mode:'investigation'};
  const outcomes=await Promise.all(selection.selected.map(async k=>{try{return await read(k)}catch{return {key:k,sheet:APP.PAGES[k].sheet,error:true}}}));
  const good=outcomes.filter(s=>Array.isArray(s.rows));
  if(!good.length)return {answer:'تعذر الاتصال بالمصادر المصرح بها؛ لا تتوفر أدلة لتحليل الأسباب.',sources:[],connected:false,project,mode:'investigation'};
  const {joined,unmatched}=correlate(good);
  const order=N(question).match(/(?:^|\s)(\d{6,18})(?=\s|$)/)?.[1]||null;
  if(order&&!joined.has(order))return {answer:'لم أعثر على أمر العمل '+order+' ضمن المصادر التي تمكنت من قراءتها. لا يمكنني استنتاج أسباب موثقة له.',connected:true,project,mode:'investigation',sources:good.map(s=>({page:names[s.key],sheet:s.sheet,records:s.rows.length}))};
  const items=order?joined.get(order).records:[...joined.values()].flatMap(x=>x.records);
  const evidence=evidenceFor(items),risks=new Map();
  for(const e of evidence){
   const r=risks.get(e.order)||{order:e.order,score:0,findings:[]};r.score+=e.severity;r.findings.push(e);risks.set(e.order,r);
  }
  const ranked=[...risks.values()].sort((a,b)=>b.score-a.score).slice(0,8);
  const groups=new Map();
  for(const e of evidence){
   const g=groups.get(e.rule)||{label:e.label,orders:new Set(),sample:e};
   g.orders.add(e.order);groups.set(e.rule,g);
  }
  const lines=[
   'تحليل تشغيلي مترابط — كهرباء '+project+(order?' — أمر العمل '+order:''),
   'قرأت '+fmt(good.length)+' مصدرًا، بإجمالي '+fmt(good.reduce((a,s)=>a+s.rows.length,0))+' سجل. عدد أوامر العمل الفريدة '+fmt(joined.size)+'؛ المشتركة بين مصادر متعددة '+fmt([...joined.values()].filter(x=>x.sources.size>1).length)+'.',
   'سجلات لم يمكن ربطها برقم أمر عمل صالح: '+fmt(unmatched.length)+'.',
   'إشارات التعثر المسجلة (لا تثبت السببية):\n'+([ ...groups.values()].sort((a,b)=>b.orders.size-a.orders.size).slice(0,8).map(g=>'• '+g.label+': '+fmt(g.orders.size)+' أمر؛ مثال '+g.sample.order+' ('+names[g.sample.source]+'، صف '+(g.sample.row||'غير معلوم')+')').join('\n')||'لا توجد إشارات صريحة في الحقول المقروءة.')
  ];
  if(order){
   const r=joined.get(order);
   lines.push('السجلات المرتبطة بهذا الأمر: '+[...r.sources].map(x=>names[x]).join('، '));
   if(r.contractors.size)lines.push('المقاول المسجل: '+[...r.contractors].slice(0,4).join('، '));
   if(r.engineers.size)lines.push('المهندس المسجل: '+[...r.engineers].slice(0,4).join('، '));
   if(evidence.length)lines.push('أدلة هذا الأمر:\n'+evidence.slice(0,12).map(e=>'• '+e.label+': '+e.detail+' ['+names[e.source]+'، صف '+(e.row||'غير معلوم')+']').join('\n'));
  }else if(ranked.length)lines.push('الأوامر الأولى بالمراجعة حسب كثافة وشدة الإشارات (ليس ترتيب المسؤولية):\n'+ranked.map(r=>'• '+r.order+': '+r.findings.map(e=>e.label).slice(0,3).join('، ')).join('\n'));
  const actions=[...new Set(evidence.map(e=>e.action))].slice(0,6);
  if(actions.length)lines.push('إجراءات التحقق المقترحة:\n'+actions.map(x=>'• '+x).join('\n'));
  const failures=outcomes.filter(s=>s.error).map(s=>names[s.key]);
  if(failures.length)lines.push('المصادر غير المتاحة: '+failures.join('، ')+'. النتيجة جزئية.');
  if(good.some(s=>s.stale))lines.push('بعض السجلات من قراءة مخزنة غير لحظية.');
  lines.push('تنبيه مهني: التزامن بين مخالفة أو تصريح وتأخير لا يكفي لإثبات المسؤولية أو السبب الجذري. يلزم دعم الاستنتاج بالتواريخ والإفادات والمستندات ومراجعة المختص.');
  lines.push('وقت التحليل (السعودية): '+now().toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'}));
  return {answer:lines.join('\n\n'),connected:true,project,mode:'investigation',metrics:{workOrders:joined.size,crossSource:[...joined.values()].filter(x=>x.sources.size>1).length,signals:evidence.length,unmatched:unmatched.length,failedSources:failures.length},
   sources:good.map(s=>({page:names[s.key],sheet:s.sheet,records:s.rows.length,readAt:s.readAt,stale:s.stale}))};
 };
}
module.exports={createNaifInvestigations,isInvestigation,chooseSources,correlate,evidenceFor,id,N};