/* Permission-scoped read-only specialized modules for Naif in Makkah/Jeddah.
   GET only. No mutation, downloads, exports, hidden tab scraping, or cross-city fetch. */
(()=>{'use strict';
 const N=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const txt=(v,n=95)=>String(v??'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,n);
 const fmt=n=>Number(n||0).toLocaleString('ar-SA',{maximumFractionDigits:1});
 const num=v=>{const n=Number(String(v??'').replace(/[,%٪]/g,''));return Number.isFinite(n)?n:null;};
 const targets=[
  {key:'employeeEvaluation',re:/تقييم مهندسي المواقع|تقييم مهندسين المواقع|تقييم موظفي المواقع/,url:'/api/hr/employee-evaluation',kind:'employee'},
  {key:'electricityEngineerEvaluation',re:/تقييم مهندسي الكهرباء|تقييم مهندسي شركه الكهرباء|تقييم مهندس الكهرباء/,url:'/api/hr/electricity-engineer-evaluation',kind:'electricity'},
  {key:'contractorSafety',re:/تقييم المقاولين|تقييم السلامه للمقاولين|سلامه المقاولين/,url:'/api/safety/contractor-evaluation',kind:'contractor'},
  {key:'pdcMeeting2',re:/اجتماع pdc 2|اجتماع pdc2|اجتماع بي دي سي 2/,url:'/api/pdc-meeting-2/summary',kind:'meeting2'},
  {key:'qualityCorrective',re:/تقرير الجوده والاجراءات التصحيحيه|الجوده والاجراءات التصحيحيه/,url:'/api/quality-corrective/reports',kind:'reports'},
  {key:'safetyCorrective',re:/تقرير السلامه والاجراءات التصحيحيه|السلامه والاجراءات التصحيحيه/,url:'/api/safety-corrective/reports',kind:'reports'},
  {key:'temporaryGenerators',re:/تقرير المؤقتات والمولدات|تقارير المؤقتات|تقارير المولدات|المولدات والمؤقتات/,url:'/api/temporary-generators/reports',kind:'reports'},
  {key:'engineeringInspection',re:/وكيل الفحص الهندسي|الفحص الهندسي الذكي|سجلات الفحص الهندسي/,url:'/api/engineering-inspections',kind:'inspection'},
  {key:'excelExport',re:/مركز تقارير الاكسيل|التصدير للاكسيل|تقارير excel|تقارير اكسل|تقارير اكسيل/,url:'/api/excel-export/sheets',kind:'excel'}
 ];
 const readWords=/كم|عدد|نسبه|انجاز|متوسط|اعطني|حاله|ملخص|ماهي|ما هي|بيانات|نتائج|الموجوده|المسجله|الصادره|التقارير|اخر|المتأخر|اقل|اعلى|اكثر|توزيع|المتعثّر|سجلات|قائمه|جميع/;
 const notSensitive=v=>!/users|user|credentials|password|secret|token|db users|dp users|المستخدمين|كلمات المرور|الصلاحيات|رواتب|هويات/.test(N(v));
 const isVisibleNav=key=>{
  const item=[...document.querySelectorAll('#nav .nav-item[data-page]')].find(x=>x.dataset.page===key);
  if(!item||item.hidden||item.getAttribute('aria-hidden')==='true'||!item.getClientRects().length)return false;
  const s=window.getComputedStyle(item);
  if(s.display==='none'||s.visibility==='hidden')return false;
  if(typeof window.vdCanAccessLabel==='function'&&!window.vdCanAccessLabel((item.querySelector('span')||item).textContent.trim()))return false;
  return true;
 };
 function targetFor(question){
  const q=N(question);
  if(/فهرس|جميع التبويبات|كل التبويبات|مصادر البيانات|اسماء التبويبات|خارطه الداشبورد|خريطه الداشبورد/.test(q))return null;
  if(/كيف|شرح|اشرح|ما هو|ماهي وظائف/.test(q)&&!readWords.test(q))return null;
  const active=document.querySelector('#nav .nav-item.active[data-page]')?.dataset.page;
  const explicit=window.NaifDashboardCatalog?.find?.(question);
  // A named different tab must not be answered from the current specialist page.
  if(explicit&&explicit.key!==active&&!targets.some(t=>t.key===explicit.key&&t.re.test(q)))return null;
  return targets.find(x=>x.re.test(q))||
    (readWords.test(q)&&targets.find(x=>x.key===active))||null;
 }
 async function fetchData(url){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),23000);
  try{
   const response=await fetch(url,{method:'GET',credentials:'same-origin',cache:'no-store',
    headers:{Accept:'application/json'},signal:ctrl.signal});
   if(response.status===403)return {denied:true};
   if(response.status===401)return {expired:true};
   if(!response.ok)return {error:'فشل مصدر البيانات (HTTP '+response.status+').'};
   const body=await response.json().catch(()=>null);
   if(!body||body.ok===false)return {error:txt(body?.error||'تعذر تحليل رد المصدر',140)};
   return {body};
  }catch(e){
   return {error:e.name==='AbortError'?'انتهت مهلة قراءة المصدر.':'تعذر الاتصال بمصدر البيانات.'};
  }finally{clearTimeout(timer);}
 }
 const breakdown=(rows,key,max=5)=>{
  const map=new Map();
  for(const r of rows){const x=txt(r?.[key]||'غير محدد',62);map.set(x,(map.get(x)||0)+1);}
  return [...map].sort((a,b)=>b[1]-a[1]).slice(0,max).map(([name,c])=>'• '+name+': '+fmt(c)).join('\n');
 };
 function summarize(kind,body,city,question){
  const q=N(question);
  const lines=[];
  let source='',updated=body.updatedAt||body.generatedAt||'';
  if(kind==='employee'){
   const rows=Array.isArray(body.rows)?body.rows:[];
   const eng=new Set(rows.map(x=>txt(x.engineer)).filter(Boolean));
   const work=new Set(rows.map(x=>txt(x.workOrder)).filter(Boolean));
   const attachments=rows.filter(x=>/لم يتم|غير مرفق|ناقص|غير مكتمل/.test(N(x.attachments))).length;
   const safety=rows.reduce((a,r)=>a+(num(r.safetyViolations)||0),0);
   lines.push('إجمالي سجلات التقييم: '+fmt(rows.length),'عدد المهندسين بالمصدر: '+fmt(eng.size),'أوامر العمل الفريدة: '+fmt(work.size),
    'سجلات فيها نقص صريح بالمرفقات: '+fmt(attachments),'مخالفات السلامة المدوّنة بالمصدر: '+fmt(safety));
   if(/توزيع|اكثر المهندسين|حسب المهندس/.test(q))lines.push('أعلى المهندسين حسب عدد سجلات المهام:\n'+breakdown(rows,'engineer'));
   source='تقييم مهندسي المواقع / 📌المهام والافادات';
  }else if(kind==='electricity'){
   const projects=Array.isArray(body.projects)?body.projects:[],connections=Array.isArray(body.connections)?body.connections:[],assets=Array.isArray(body.assets)?body.assets:[];
   const all=[...projects,...connections,...assets];
   const engines=new Set(all.map(x=>txt(x.engineer)).filter(Boolean));
   const values=[...projects,...connections].map(x=>num(x.progress)).filter(x=>x!==null&&x>=0&&x<=100);
   const avg=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10:null;
   lines.push('سجلات المشاريع: '+fmt(projects.length),'سجلات التوصيلات: '+fmt(connections.length),'سجلات الأصول: '+fmt(assets.length),
    'المهندسون المرتبطون بالسجلات: '+fmt(engines.size));
   if(avg!==null)lines.push('متوسط تقدم الأعمال ذات نسبة مسجلة: '+fmt(avg)+'% (حُسب من '+fmt(values.length)+' قيمة صالحة)');
   if(/توزيع|اكثر المهندسين|حسب المهندس/.test(q))lines.push('أعلى المهندسين حسب السجلات:\n'+breakdown(all,'engineer'));
   source='تقييم مهندسي الكهرباء / المشاريع والتوصيلات والأصول';
  }else if(kind==='contractor'){
   if(body.city&&body.city!==(city==='مكة'?'Makkah':'Jeddah'))return 'المصدر أعاد بيانات مدينة مختلفة، لذلك امتنعت عن عرضها.';
   const rows=Array.isArray(body.rows)?body.rows:[];
   const names=new Set(rows.map(x=>txt(x.contractor)).filter(Boolean));
   const v=rows.map(x=>num(x.score)).filter(x=>x!==null&&x>=0&&x<=100);
   lines.push('سجلات تقييم السلامة: '+fmt(rows.length),'عدد المقاولين: '+fmt(names.size));
   if(v.length)lines.push('متوسط درجة الالتزام المسجلة: '+fmt(v.reduce((a,b)=>a+b,0)/v.length)+'%');
   lines.push('الملاحظات المسجلة في بنود التقييم: '+fmt(rows.reduce((a,r)=>a+(Array.isArray(r.violations)?r.violations.length:0),0)));
   if(/حسب المقاول|توزيع|اكثر المقاولين/.test(q))lines.push('عدد سجلات التقييم بحسب المقاول:\n'+breakdown(rows,'contractor'));
   source='Intellect / تقييم السلامة للمقاولين';
  }else if(kind==='reports'){
   const rows=Array.isArray(body.reports)?body.reports:[];
   lines.push('عدد التقارير المسجلة: '+fmt(rows.length));
   if(rows.length)lines.push('أحدث 5 تقارير:\n'+rows.slice(0,5).map((r,i)=>
    '• '+fmt(i+1)+'. '+txt(r.title||r.reportName||r.name||r.id||'تقرير',85)+'، حالة: '+txt(r.status||r.state||'غير محددة',45)+'.').join('\n'));
   source='سجل التقارير الخاص بالتبويب';
  }else if(kind==='inspection'){
   const rows=Array.isArray(body.records)?body.records:[];
   lines.push('سجلات الفحص الهندسي المتاحة: '+fmt(rows.length));
   if(rows.length)lines.push('توزيع حالات الفحص:\n'+breakdown(rows,'status'));
   if(rows.length===200)lines.push('المصدر يعرض آخر 200 سجل فقط، وليس جميع السجلات التاريخية.');
   source='AI Engineering Inspections / الفحص الهندسي';
  }else if(kind==='excel'){
   const collection=Array.isArray(body.sheets)?body.sheets:Array.isArray(body.items)?body.items:Array.isArray(body.data)?body.data:[];
   const labels=collection.map(x=>typeof x==='string'?x:x?.title||x?.name||'').filter(x=>x&&notSensitive(x));
   lines.push('الأوراق المصرح بعرضها من مركز Excel: '+fmt(labels.length));
   if(labels.length)lines.push('أمثلة لأسماء الأوراق: '+labels.slice(0,18).map(x=>txt(x,55)).join('، ')+'.');
   source='مركز تقارير Excel / قائمة الأوراق';
  }else if(kind==='meeting2'){
   const summary=body.summary&&typeof body.summary==='object'?body.summary:body;
   const label={total:'إجمالي السجلات',completed:'المكتملة',delayed:'المتأخرة',notCompleted:'غير المكتملة',reportsCount:'التقارير المحفوظة',pending:'المعلقة',execution:'نسبة التنفيذ'};
   const nums=Object.entries(label).filter(([key])=>typeof summary[key]==='number').map(([key,arabic])=>'• '+arabic+': '+fmt(summary[key]));
   if(nums.length)lines.push(nums.join('\n'));
   else lines.push('تم الاتصال بمصدر اجتماع PDC 2، لكن لا تتوفر حقول رقمية موحدة لعرض ملخص موثوق.');
   source='ملخص اجتماع PDC 2';
  }
  if(!lines.length)return null;
  return 'بيانات تبويب '+source+' — مشروع كهرباء '+city+':\n'+lines.map(v=>v.startsWith('• ')?v:'• '+v).join('\n')+
   (updated?'\nآخر تحديث مسجل: '+txt(updated,48)+'.':'')+
   '\nالمصدر: '+source+'؛ القيم من استعلام البيانات الفعلي، وليست مستنتجة من شيت آخر. لا تطبق فلاتر المتصفح المحلية على هذا الملخص.';
 }
 async function answer(question,project){
  const target=targetFor(question);
  if(!target)return null;
  if(!isVisibleNav(target.key))return 'لا تمتلك صلاحية الاطلاع على تبويب «'+(window.NaifDashboardCatalog?.byKey?.(target.key)?.label||target.key)+'» في حسابك الحالي.';
  const c=project==='مكة'?'مكة':'جدة';
  const result=await fetchData(target.url);
  if(result.denied)return 'رفض المصدر قراءة بيانات هذا التبويب بسبب الصلاحيات، ولن أحاول تجاوزه.';
  if(result.expired)return 'انتهت جلسة الدخول، سجل الدخول مجددًا قبل استعلام البيانات.';
  if(result.error)return 'تعذر استعلام مصدر '+target.key+': '+result.error+' لا أعرض أرقامًا تقديرية.';
  return summarize(target.kind,result.body,c,question);
 }
 window.NaifSpecializedIndex={answer,targetFor,isVisibleNav,summarize};
})();