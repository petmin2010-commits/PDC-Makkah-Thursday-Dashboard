'use strict';
/* Naif dashboard expert: deterministic, permission-scoped, evidence-first.
 * Source of truth: current project's configured sheets, not invented LLM knowledge.
 * Read-only; refuses unknown or unauthorized sources; bounded quota-aware reads.
 */
const {metricData}=require('./naif-kpis');
const N=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[^\p{L}\p{N}%]+/gu,' ').trim();
const fmt=n=>Number(n).toLocaleString('ar-SA',{maximumFractionDigits:1});
const clip=(v,n=180)=>String(v??'').trim().slice(0,n);
const forbidden=/(?:password|passcode|secret|token|api.?key|credential|private.?key|المستخدمين|الرواتب|الاجور|كلمة.?المرور|رقم.?الهويه|رقم.?الجوال|الهاتف|البريد|الرمز.?السري)/i;
const aliases={
 workorders:['اوامر العمل','امر العمل','الاوامر','الطلبات','work orders','wo'],
 projects:['المشاريع','مشاريع','project progress','نسبة انجاز المشاريع'],
 connections:['التوصيلات','توصيل','التوصيلة'],
 permits:['التصاريح','التصريح','بلدي'],
 operations:['العمليات بالانشاءات','العمليات','الانشاءات'],
 closures:['الاغلاقات','الاقفالات','اغلاق','مستندات الاغلاق'],
 assets:['الاصول','العدات','المعدات','العدادات'],
 emergency:['الطوارئ','الاشعارات','البلاغات'],
 dataQuality:['جودة البيانات','جودة الافادات','الافادات الوهمية'],
 tasks:['متابعة اعمال المواقع','المهام والافادات','افادات الموقع','المهام'],
 attachments:['المرفقات','ملفات المقاول','حالة مرفقات المقاول'],
 safety:['مخالفات السلامة','السلامة','مخالفات السلامه'],
 executionViolations:['مخالفات التنفيذ'],
 minutes:['محاضر المخالفات','اثبات الحالة','غرامات المقاولين','المحاضر'],
 smartThursday:['تقرير الخميس','تقرير الخميس الذكي'],
 finance:['المالية','المستخلصات','التحصيل','المدفوعات','حالة الدفع','الماليات']
};
const navigationOnly=['reportArchive','reportsCenter','excelExport','hrStaff','employeeEvaluation','electricityEngineerEvaluation','projectsReportEngine','contractorSafety','qualityCorrective','engineeringInspection','temporaryGenerators','wednesdayMeeting','pdcMeeting2','safetyCorrective','importantLinks'];
const stop=new Set(['المشروع','مشروع','الكهرباء','مكة','جدة','نايف','التبويب','تاب','الداشبورد','اللوحة','اليوم','حاليا','الان','الآن','كم','عدد','ما','ماهي','اعطني','اعرض','من','في','الى','على','عن','وايش','ابغى','احتاج','أريد','القيم']);
const words=q=>N(q).split(' ').filter(w=>w.length>2&&!stop.has(w));
const has=(q,re)=>re.test(N(q));
const richIntent=q=>/نسب|انجاز|تقدم|مؤشر|مؤشرات|كرت|كروت|بطاقات|عدد|كم|اجمالي|مجموع|متوسط|معدل|قيم|مبلغ|غرام|تاخير|متاخر|متاخره|حاله|الوضع|احصائ|تحصيل|منفذ|منجز|لم يتم|مكتمل|غير مكتمل|متاخر|مرفقات|العدد|التوزيع|ملخص|اهم/.test(N(q));
const isCatalog=q=>/ماذا تعرف|تقدر تعمل|ماذا تستطيع|قدراتك|امكانياتك|مصادرك|تعرف ايه|تعرف ايش|كل التبويبات|جميع التبويبات|قائمة التبويبات|قائمه الشيتات|الشيتات المتاحه|خارطة النظام|خريطه النظام|عرفني بالداشبورد|اشرح الداشبورد/.test(N(q));
const isBroad=q=>/ملخص شامل|ملخص تنفيذي|ملخص المشروع|حالة المشروع|حاله المشروع|الوضع العام|اداء المشروع|تقرير شامل|اعطني الملخص|لخص لي المشروع|جميع المؤشرات|كل المؤشرات|ملخص كامل/.test(N(q));
const relevantFields=(cfg)=>Array.isArray(cfg?.fields)?cfg.fields.filter(f=>Array.isArray(f)&&!forbidden.test(f[0])&&!forbidden.test(f[1])):[];
const safeFields=(row,cfg,terms=[],max=9)=>{
 const fields=relevantFields(cfg);
 const preferred=['workOrder','noticeNo','date','assignedDate','contractor','engineer','status','executionStatus','stage','stageStatus','progress','delay','permitStatus','paymentStatus','description','advice'];
 const scored=fields.map(f=>({field:f,score:terms.some(w=>N(f[0]+' '+f[1]).includes(w))?8:preferred.indexOf(f[0])>=0?4-preferred.indexOf(f[0])/30:0}))
  .filter(x=>clip(row[x.field[0]]).length).sort((a,b)=>b.score-a.score).slice(0,max);
 return scored.map(x=>x.field[1]+': '+clip(row[x.field[0]],90)).join('، ');
};
const metricRank=(m,query)=>{
 const label=N(m[0]),q=N(query),tokens=words(query).filter(w=>!['المشاريع','اوامر','العمل','التوصيلات','الطوارئ'].includes(w));
 let score=tokens.reduce((a,w)=>a+(label.includes(w)?4:0),0);
 if(/نسب|انجاز|تقدم/.test(q)&&/نسبه التقدم|نسبه الانجاز|متوسط نسبه الانجاز|اكتمال/.test(label))score+=7;
 if(/اجمالي|عدد|كم/.test(q)&&/اجمالي السجلات|اجمالي/.test(label))score+=2;
 if(/التاخير|متاخر/.test(q)&&/تاخير/.test(label))score+=7;
 if(/المالي|ريال|قيمه|غرام|المبالغ/.test(q)&&/قيمه|غرام|المدفوع|الاجمالي/.test(label))score+=5;
 return score;
};
const groupField=q=>{
 const s=N(q);
 if(/مهندس|المهندسين|استشاري/.test(s))return 'engineer';
 if(/مقاول|المقاولين/.test(s))return 'contractor';
 if(/الادار|المنطقه/.test(s))return 'region';
 if(/مرحله|المرحله/.test(s))return 'stage';
 if(/التاخير|التأخير/.test(s))return 'delay';
 if(/قسم|اقسام/.test(s))return 'section';
 if(/حاله التصريح/.test(s))return 'permitStatus';
 if(/نوع العمل|انواع الاعمال/.test(s))return 'type';
 if(/حاله الدفع/.test(s))return 'paymentStatus';
 if(/حال|وضع|منجز|منفذ/.test(s))return 'executionStatus';
 return null;
};
const wantsGroup=q=>/حسب|لكل|توزيع|اكثر|اعلى|اقل|الاول|ترتيب|من المتاخر|اكبر|المقاولين|المهندسين|الاقسام|مقارن/.test(N(q));
const numberId=q=>N(q).match(/(?:^|\s)(\d{6,15})(?=\s|$)/)?.[1]||'';
const sourceScore=(p,q,tokens)=>{
 const all=[p.title,p.key,p.sheet,...(aliases[p.key]||[])].map(N).filter(Boolean);
 // Titles and aliases must match as phrases, not arbitrary generic tokens.
 const exact=all.some(t=>t.length>=4&&(' '+q+' ').includes(' '+t+' '))?25:0;
 const partial=all.some(t=>t.length>=6&&q.includes(t))?12:0;
 const shared=tokens.reduce((n,w)=>n+(all.some(t=>t.includes(w))?3:0),0);
 const field=(p.cfg.fields||[]).reduce((n,f)=>n+(tokens.some(w=>N(f[1]||'').includes(w))?1:0),0);
 return exact+partial+shared+Math.min(field,4);
};
function createNaifExpert({APP,readConfiguredSheet,getNaifAdviceQuality,canPage,now=()=>new Date()}){
 const pages=Object.entries(APP.PAGES).map(([key,cfg])=>({
  key,title:cfg.title||key,sheet:cfg.sheet||'',cfg,queryable:!!cfg.sheet||key==='dataQuality'
 }));
 const cache=new Map(), inflight=new Map();
 async function read(page){
  if(page.key==='dataQuality'){
   const d=await getNaifAdviceQuality();
   return {rows:[],quality:d,readAt:now().toISOString(),stale:!!d.stale};
  }
  if(!page.sheet)throw Error('SOURCE_HAS_NO_SHEET');
  const key=page.key,hit=cache.get(key),t=Date.now();
  if(hit&&hit.expires>t)return {...hit.value,cached:true};
  if(inflight.has(key))return inflight.get(key);
  const task=(async()=>{
   const rows=await readConfiguredSheet(page.cfg,key);
   const value={rows:Array.isArray(rows)?rows:[],readAt:now().toISOString(),cached:false};
   cache.set(key,{value,expires:Date.now()+(key==='workorders'?90000:180000)});
   return value;
  })().finally(()=>inflight.delete(key));
  inflight.set(key,task);
  return task;
 }
 const authorized=(user)=>pages.filter(x=>typeof canPage==='function'&&canPage(user,x.key));
 const origin=p=>'التبويب '+p.title+(p.sheet?' / الشيت «'+p.sheet+'»':' / محرك التحليل المستقل');
 async function inspect(p,query,tokens){
  try{
   const data=await read(p);
   if(p.key==='dataQuality'){
    const q=data.quality?.adviceIntelligence||{},c=q.counts||{};
    return {p,count:Number(q.trackedOrders||0),answer:'جودة الإفادات — '+origin(p)+': أوامر تحت الرقابة '+fmt(q.trackedOrders||0)+'؛ إفادات جوهرية '+fmt(c.substantive||0)+'، ضعيفة '+fmt(c.weak||0)+'، شكلية/مشتبهة '+fmt(c.suspicious||0)+'، بانتظار التحليل '+fmt(c.pending||0)+'.'+(data.stale?' (آخر لقطة مخزنة — غير لحظية)':''),readAt:data.readAt,stale:data.stale};
   }
   const all=data.rows,def=p.cfg,id=numberId(query);
   if(id){
    const matches=all.filter(r=>[r.workOrder,r.noticeNo,r.paymentNo,r.equipmentNo].some(v=>N(v)===id)).slice(0,7);
    if(!matches.length)return {p,count:all.length,answer:'لم أجد أمر عمل/معاملة برقم '+id+' في '+origin(p)+' ضمن السجلات المقروءة.',readAt:data.readAt};
    return {p,count:all.length,answer:'بحث رقم '+id+' في '+origin(p)+' — '+fmt(matches.length)+' نتائج:\n'+matches.map(r=>'• الصف '+r._row+': '+safeFields(r,def,tokens,12)).join('\n'),readAt:data.readAt};
   }
   const m=metricData(p,all);
   if(!richIntent(query)&&!wantsGroup(query)){
    const matches=all.map(r=>{const hit=tokens.reduce((acc,t)=>acc+(N(relevantFields(def).map(f=>r[f[0]]).join(' ')).includes(t)?1:0),0);return {r,hit};})
     .filter(x=>x.hit>0).sort((a,b)=>b.hit-a.hit).slice(0,5);
    return {p,count:all.length,answer:origin(p)+': عدد السجلات '+fmt(all.length)+'.'+(matches.length?'\nأبرز '+fmt(matches.length)+' سجلات مرتبطة بالسؤال:\n'+matches.map(x=>'• الصف '+x.r._row+': '+safeFields(x.r,def,tokens)).join('\n'):'\nلم أجد سجلات تطابق كلمات السؤال في هذا المصدر.'),readAt:data.readAt};
   }
   const showAll=/كل|جميع|ملخص|شامل|لخص|اشرح/.test(N(query));
   const selected=showAll?m.slice(0,16):m.map((v,i)=>({v,i,score:metricRank(v,query)})).sort((a,b)=>b.score-a.score).filter(x=>x.score>0).slice(0,7).map(x=>x.v);
   let answer=origin(p)+' — السجلات '+fmt(all.length)+'.';
   if(selected.length)answer+='\n'+selected.map(([label,value])=>'• '+label+': '+value).join('\n');
   if(wantsGroup(query)){
    let field=groupField(query);
    if(field==='executionStatus'&&!all.some(r=>r.executionStatus))field='status';
    if(field&&!all.some(r=>Object.prototype.hasOwnProperty.call(r,field)))field=null;
    if(field){
     const buckets=new Map();
     for(const row of all){const v=clip(row[field],95)||'غير محدد';buckets.set(v,(buckets.get(v)||0)+1);}
     const top=[...buckets].sort((a,b)=>b[1]-a[1]).slice(0,10);
     answer+='\nتوزيع «'+(def.fields.find(f=>f[0]===field)?.[1]||field)+'» — أكبر '+fmt(top.length)+' فئات:\n'+top.map(([k,v])=>'• '+k+': '+fmt(v)).join('\n');
     if(buckets.size>10)answer+='\n(توجد '+fmt(buckets.size-10)+' فئات أخرى غير معروضة)';
    }else answer+='\nلم أجد حقل توزيع يطابق السؤال في هذه الورقة؛ لن أخمّن التقسيم.';
   }
   if(!selected.length&&!wantsGroup(query)){
    const termRows=all.map(r=>{const v=relevantFields(def).filter(f=>tokens.some(t=>N(f[1]+' '+f[0]).includes(t)));return {r,v,hit:v.reduce((a,f)=>a+(clip(r[f[0]])?1:0),0)}}).filter(x=>x.hit>0).slice(0,5);
    if(termRows.length)answer+='\nنماذج من البيانات:\n'+termRows.map(x=>'• صف '+x.r._row+': '+safeFields(x.r,def,tokens)).join('\n');
    else answer+='\nلا توجد قيمة محسوبة موثوقة لهذا المؤشر المحدد في المصدر.';
   }
   return {p,count:all.length,answer,readAt:data.readAt,cached:data.cached};
  }catch(error){
   const quota=/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(String(error?.message||error));
   return {p,error:quota?'تم بلوغ حد قراءة Google Sheets':'المصدر غير متاح حاليًا',answer:origin(p)+': '+(quota?'تعذر التحديث بسبب حد طلبات Google Sheets.':'تعذر قراءة البيانات الآن.')+' لا أقدّم رقمًا تقديريًا.'};
  }
 }
 return async function ask({question,user,project,currentPage}){
  const query=clip(question,1500),q=N(query),tokens=words(query);
  if(query.length<2)return {answer:'اكتب سؤالك عن تبويب أو مؤشر أو أمر عمل محدد.',sources:[],connected:false};
  const allowed=authorized(user);
  const publicPages=allowed.map(p=>({key:p.key,title:p.title,source:p.sheet||'محرك مستقل',queryable:p.queryable}));
  if(!allowed.length)return {answer:'لا تتوفر لك تبويبات بيانات تشغيلية مصرح بها في مشروع '+project+'. راجع مدير النظام.',sources:[],connected:false,project};
  if(isCatalog(query)){
   return {answer:'أنا نايف، خبير لوحة كهرباء '+project+' ضمن صلاحيات الحساب. أستطيع شرح طريقة قراءة المؤشرات، حساب نسب الإنجاز، تتبع أوامر العمل، تجميع حالات المقاولين والمهندسين، مراجعة التأخيرات، التصاريح، الطوارئ، الأصول، المستخلصات والمخالفات من المصادر المصرح بها. هذه مصادر البيانات المتاحة:\n'+allowed.map(p=>'• '+p.title+' ← '+(p.sheet||'تحليل مستقل')).join('\n')+'\nالمنصة تحتوي كذلك على واجهات وتقارير خاصة؛ أستطيع قراءة كروتها المعروضة عبر الواجهة، ولا أدّعي قراءة تفاصيلها غير المتصلة. لا أعدّل البيانات أو الصلاحيات.',sources:publicPages,project,connected:true,mode:'catalog'};
  }
  const named=allowed.filter(p=>sourceScore(p,q,tokens)>=12).sort((a,b)=>sourceScore(b,q,tokens)-sourceScore(a,q,tokens));
  // If a forbidden tab is explicitly requested, never silently substitute a different sheet.
  const disallowed=pages.filter(p=>!allowed.includes(p)&&sourceScore(p,q,tokens)>=17);
  if(!named.length&&disallowed.length&&disallowed.some(x=>!['projects','workorders','tasks'].includes(x.key)))
   return {answer:'سؤالك يتعلق بتبويب غير متاح ضمن صلاحيات حسابك في كهرباء '+project+'. لا أعرض بياناته أو أستبدله بمصدر آخر.',sources:[],connected:false,project};
  const broad=isBroad(query);
  let selected;
  if(named.length)selected=named.slice(0,/\bو\b|مقارنه|مقارنة|جميع|كل/.test(q)?3:2);
  else if(currentPage&&allowed.some(p=>p.key===currentPage&&p.queryable))selected=[allowed.find(p=>p.key===currentPage)];
  else if(broad)selected=['workorders','projects','emergency'].map(k=>allowed.find(p=>p.key===k)).filter(Boolean);
  else if(numberId(query))selected=['workorders','projects','connections'].map(k=>allowed.find(p=>p.key===k)).filter(Boolean);
  else if(/مالي|ريال|مستخلص|تحصيل|دفع|تكلف/.test(q))selected=[allowed.find(p=>p.key==='finance')].filter(Boolean);
  else if(/تأخير|متاخر|انجاز|نسب/.test(q))selected=[allowed.find(p=>p.key==='workorders'),allowed.find(p=>p.key==='projects')].filter(Boolean);
  else selected=[allowed.find(p=>p.key==='workorders')||allowed.find(p=>p.queryable)].filter(Boolean);
  selected=selected.filter(p=>p.queryable).slice(0,3);
  if(!selected.length)return {answer:'هذا السؤال مرتبط بوحدة غير متصلة بمحرك بيانات نايف حتى الآن. راجع الكروت الظاهرة في تبويبها أو اطلب مصدرًا محددًا؛ لن أختلق أرقامًا.',sources:[],connected:false,project};
  const results=await Promise.all(selected.map(p=>inspect(p,query,tokens)));
  const good=results.filter(x=>!x.error),bad=results.filter(x=>x.error);
  const parts=results.map(x=>x.answer);
  const scopes=good.map(x=>({page:x.p.title,sheet:x.p.sheet,records:x.count,readAt:x.readAt}));
  const localTime=now().toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'});
  return {answer:'نتيجة '+project+' من مصادر الداشبورد المصرح بها:\n'+parts.join('\n\n')+
   '\n\nوقت الاستعلام (السعودية): '+localTime+'.'+(bad.length?' بعض المصادر غير متاحة؛ النتائج المعروضة تخص المصادر الناجحة فقط.':'')+
   '\nملاحظة: هذه قراءة من الشيتات ولا تشمل فلاتر المتصفح المحلية. للاطلاع على قيم الفلاتر الحالية اسأل نايف وأنت داخل التبويب المعروض.',
   sources:scopes,connected:good.length>0,project,mode:'expert',sourceErrors:bad.map(x=>x.p.title)};
 };
}
module.exports={createNaifExpert,N,isCatalog,isBroad,sourceScore};
