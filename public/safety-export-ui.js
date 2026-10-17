(()=>{
'use strict';
const $=sel=>document.querySelector(sel);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
let current=null,busy=false;
function close(){if(busy)return;document.querySelector('#csDownloadOverlay')?.remove();current=null}
function open(ctx){
 if(!ctx)return;close();current=ctx;
 const div=document.createElement('div');div.id='csDownloadOverlay';div.className='cs-download-overlay';
 div.innerHTML='<div class="cs-download-dialog" role="dialog" aria-modal="true" aria-labelledby="csDownloadTitle">'+
 '<header class="cs-download-head"><div><small>VISION DIMENSIONS · REPORT STUDIO</small><h2 id="csDownloadTitle">تنزيل تقييم السلامة للمقاولين</h2>'+
 '<p>'+esc(ctx.general?'التقرير العام · كافة الفترات والمقاولين':'التقرير حسب الفلاتر · '+ctx.period())+'</p></div>'+
 '<button type="button" class="cs-download-close" id="csDownloadClose" aria-label="إغلاق">×</button></header>'+
 '<div class="cs-download-body"><p class="cs-download-intro">اختر صيغة التقرير. يقدم التنسيقان نفس التحليلات التنفيذية بهوية العرض التقديمي، مع المحافظة على بيانات مكة وجدة منفصلة.</p>'+
 '<div class="cs-download-types">'+
 '<button type="button" data-csd-format="pdf"><span class="cs-download-icon cs-icon-pdf">PDF</span><b>ملف PDF</b><small>مطابق لشرائح PowerPoint المعتمدة بالغلاف والشعارات والمقاس نفسه</small></button>'+
 '<button type="button" data-csd-format="pptx"><span class="cs-download-icon cs-icon-ppt">PPTX</span><b>عرض PowerPoint</b><small>شرائح قابلة للتحرير مع النصوص والكروت ومخططات الأعمدة</small></button></div>'+
 '<label class="cs-download-option"><input type="checkbox" id="csDownloadDetails"><span><b>إضافة ملحق الفحوص التفصيلي</b><small>اختياري · حتى آخر 300 فحص؛ جميع المؤشرات تُحسب دائمًا من كامل الفترة المختارة</small></span></label>'+
 '<p class="cs-download-status" id="csDownloadStatus" aria-live="polite"></p></div>'+
 '<footer><span>المصدر: السلامة والجودة / Intellect</span><button type="button" id="csDownloadCancel">إلغاء</button></footer></div>';
 document.body.appendChild(div);
 $('#csDownloadClose').addEventListener('click',close);
 $('#csDownloadCancel').addEventListener('click',close);
 div.addEventListener('click',e=>{if(e.target===div)close()});
 div.querySelectorAll('[data-csd-format]').forEach(x=>x.addEventListener('click',()=>choose(x.dataset.csdFormat)));
 div.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 $('#csDownloadClose').focus();
}
function setStatus(value,isError=false){
 const el=$('#csDownloadStatus');if(el){el.textContent=value;el.classList.toggle('error',isError)}
}
function options(ctx){
 const detailed=!!$('#csDownloadDetails')?.checked;
 return {city:ctx.city(),general:!!ctx.general,detailed,period:ctx.general?'كامل الفترة':ctx.period()};
}
async function choose(format){
 if(!current||busy)return;
 if(format!=='pdf'&&format!=='pptx')return;
 const ctx=current,meta=options(ctx);
 busy=true;
 document.querySelectorAll('[data-csd-format]').forEach(x=>x.disabled=true);
 setStatus(format==='pptx'?'جاري إنشاء شرائح PowerPoint...':'جاري تحويل شرائح PowerPoint نفسها إلى PDF...');
 try{
  if(!ctx.loaded())await ctx.load();
  if(!ctx.loaded())throw Error(ctx.error()||'تعذر قراءة ورقة Intellect');
  const req={format,general:meta.general,detailed:meta.detailed,period:meta.period,filters:ctx.filters()};
  const res=await fetch('/api/safety/contractor-evaluation/presentation',{
   method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(req)
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw Error(e.error||('تعذر إصدار التقرير (HTTP '+res.status+'). أعد المحاولة أو سجّل الدخول مجددًا عند انتهاء الجلسة.'))}
  const blob=await res.blob();
  if(blob.size<1000)throw Error('ملف التقرير فارغ');
  if(format==='pdf'&&!(await blob.slice(0,5).text()).startsWith('%PDF-'))throw Error('ملف PDF غير صالح');
  const name='VD_Contractor_Safety_'+(meta.city==='جدة'?'Jeddah':'Makkah')+'_'+(meta.general?'General':'Filtered')+'_'+new Date().toISOString().slice(0,10)+'.'+format;
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  // The exact downloaded bytes are logged and archived, without re-rendering HTML.
  Promise.resolve(window.VDReportArchive?.record({reportName:'تقييم السلامة للمقاولين',format:format.toUpperCase(),filename:name,blob}))
   .catch(e=>console.warn('Safety report archive failed',e?.message||e));
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  busy=false;close();
 }catch(error){
  busy=false;
  document.querySelectorAll('[data-csd-format]').forEach(x=>x.disabled=false);
  setStatus(String(error.message||error),true);
 }
}
window.VDSafetyExporter={open};
})();
