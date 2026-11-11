/* Naif factual answers to the project-specific issued reports register.
   The real archive API enforces the same user permissions as the Reports tab. */
(() => { 'use strict';
const norm=v=>String(v??'').normalize('NFKC').toLowerCase()
 .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
 .replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
 .replace(/\s+/g,' ').trim();
function isArchiveQuestion(q){
 const s=norm(q);
 return /(?:سجل|ارشيف)\s*(?:ال)?تقارير/.test(s)||
 /(?:تقارير|تقرير).*(?:الصادر|الصدر|صدرت|الصادره|المصدر|المحفوظ|المرفوع|المسجل|المصدّر|المصدره|التصدير|ارشيف|السجل|انتاج|pcloud|بي كلاود)/.test(s)||
 /(?:ما|كم|اعرض|اذكر|لخص|ملخص|كل|اخر)\s+(?:ال)?تقارير(?:\s|$)/.test(s)||
 /(?:صادر|صدر|محفوظ).*?(?:تقارير|تقرير)/.test(s)||
 /(?:التقارير الصادرة|سجل التصدير)/.test(s);
}
function isNavigation(q){
 const s=norm(q);
 return /^(?:افتح|انتقل|اذهب|روح|ودني|اذهب الى|افتح لي|اعرض التبويب|افتح تبويب)(?:\s|$)/.test(s);
}
const safe=(x,n=110)=>String(x??'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,n);
const fmt=n=>Number(n||0).toLocaleString('ar-SA');
const statusSaved=item=>Boolean(String(item?.fileId||'').trim()||String(item?.url||'').trim()||/محفوظ في/.test(String(item?.status||'')));
const statusFailed=item=>/فشل|تعذر|خطأ|غير مكتمل/i.test(String(item?.status||''));
function ksaDate(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const get=x=>parts.find(v=>v.type===x)?.value||'';
 return [get('year'),get('month'),get('day')].join('-');
}
function formatResponse(q, data, city){
 const all=Array.isArray(data?.items)?data.items:[];
 const text=norm(q),today=ksaDate();
 const scopeToday=/(?:^|\s)اليوم(?:\s|$)|بتاريخ اليوم|النهارده/.test(text);
 const scopeMonth=/هذا الشهر|الشهر الحالي|الشهر ده/.test(text);
 const scopeWeek=/هذا الاسبوع|الاسبوع الحالي|اخر اسبوع|آخر اسبوع/.test(text);
 const requestedFormat=/\bpdf\b|بي دي اف/.test(text)?'PDF':
   /\bxlsx\b|اكسيل|إكسيل|excel/.test(text)?'XLSX':
   /\bpptx\b|باوربوينت|بوربوينت|powerpoint/.test(text)?'PPTX':null;
 let period='كامل السجل المتاح';
 let items=all;
 if(scopeToday){period='اليوم '+today;items=items.filter(x=>safe(x.date,30)===today);}
 else if(scopeMonth){period='شهر '+today.slice(0,7);items=items.filter(x=>safe(x.date,30).startsWith(today.slice(0,7)));}
 else if(scopeWeek){
  period='آخر 7 أيام';
  const cutoff=new Date(today+'T00:00:00Z').getTime()-6*24*60*60*1000;
  items=items.filter(x=>{const time=new Date(safe(x.date,30)+'T00:00:00Z').getTime();return Number.isFinite(time)&&time>=cutoff;});
 }
 if(requestedFormat){items=items.filter(x=>safe(x.format,20).toUpperCase()===requestedFormat);period+=' – صيغة '+requestedFormat;}
 const saved=items.filter(statusSaved).length;
 const failed=items.filter(x=>!statusSaved(x)&&statusFailed(x)).length;
 const other=Math.max(0,items.length-saved-failed);
 const place='مشروع كهرباء '+city;
 const countOnly=/^(?:كم|عدد|اجمالي|إجمالي)(?:\s|$)/.test(text)&&!/اخر|آخر|اسم|اذكر|اعرض|ماهي/.test(text);
 let answer='سجل التقارير الصادرة — '+place+' ('+period+').\n'+
  'إجمالي التقارير المسجلة: '+fmt(items.length)+'، المحفوظة أو المرتبطة بملف: '+fmt(saved)+
  '، المتعثرة: '+fmt(failed)+'، الجاري استكمالها أو غير المحفوظة: '+fmt(other)+'.';
 if(!countOnly&&items.length){
  answer+='\nآخر '+fmt(Math.min(5,items.length))+' تقارير في هذا النطاق:\n'+items.slice(0,5).map((x,i)=>
   fmt(i+1)+'. '+safe(x.reportName||x.filename||'تقرير بلا اسم',130)+'، '+safe(x.date,25)+
   (x.time?' '+safe(x.time,18):'')+'، '+safe(x.format,12)+'، الحالة: '+safe(x.status||'غير محددة',55)+'.'
  ).join('\n');
 }
 if(!items.length)answer+='\nلم يُرجع سجل التقارير أي تقارير مطابقة لهذا النطاق؛ لا يعني ذلك عدم وجود تقارير خارج نطاق السجل.';
 if(all.length>=1000)answer+='\nملاحظة: الأرقام تخص آخر 1000 سجل فقط، وهو الحد الذي يعرضه مصدر الأرشيف.';
 answer+='\nالمصدر المباشر: تبويب «سجل التقارير الصادرة» من ورقة VD Report Archive، وليس كروت المشاريع.';
 return answer;
}
async function answer(q,city){
 const query=safe(q,1400);
 if(!isArchiveQuestion(query))return null;
 const location=city==='مكة'?'مكة':'جدة';
 if(isNavigation(query)){
  const tab=[...document.querySelectorAll('#nav .nav-item[data-page="reportArchive"]')]
   .find(el=>!el.hidden&&getComputedStyle(el).display!=='none'&&el.getAttribute('aria-hidden')!=='true');
  if(!tab)return 'تبويب سجل التقارير الصادرة غير متاح في القائمة الحالية؛ راجع صلاحيات حسابك.';
  tab.click();
  return 'فتحت تبويب «سجل التقارير الصادرة» لمشروع كهرباء '+location+'؛ ستظهر التقارير المتاحة حسب صلاحياتك.';
 }
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),22000);
 try{
  const r=await fetch('/api/report-archive',{method:'GET',credentials:'same-origin',cache:'no-store',signal:abort.signal,headers:{Accept:'application/json'}});
  if(r.status===401)return 'انتهت جلسة الدخول. سجل الدخول مجددًا لعرض سجل التقارير الصادرة.';
  if(r.status===403)return 'لا تمتلك صلاحية قراءة سجل التقارير الصادرة في مشروع '+location+'. لن أعرض بيانات غير مصرح بها.';
  if(!r.ok)return 'تعذر الآن قراءة سجل التقارير الصادرة بمشروع '+location+' من مصدره الفعلي (رمز '+r.status+'). لن أعطيك أرقامًا تقديرية.';
  const data=await r.json();
  if(!data?.ok||!Array.isArray(data.items))return 'لم يرجع سجل التقارير الصادرة بيانات موثوقة، لذا لن أخمّن العدد.';
  const sourceCity=data.city==='Makkah'?'مكة':data.city==='Jeddah'?'جدة':null;
  if(!sourceCity||sourceCity!==location)return 'تعذر تأكيد أن مصدر التقارير يخص مشروع '+location+'. أوقفت العرض لمنع خلط بيانات المدن.';
  return formatResponse(query,data,location);
 }catch(e){
  return e?.name==='AbortError'?'استغرقت قراءة سجل التقارير الصادرة وقتًا أطول من المعتاد. لا توجد أرقام مؤكدة الآن، حاول إعادة السؤال.':
   'تعذر الاتصال بأرشيف التقارير لمشروع '+location+'. لن أقدّم معلومات غير متحقّق منها.';
 }finally{clearTimeout(timer);}
}
window.NaifReportArchive={isArchiveQuestion,answer,formatResponse};
})();