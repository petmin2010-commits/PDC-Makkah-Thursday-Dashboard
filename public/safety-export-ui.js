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
 '<button type="button" data-csd-format="pdf"><span class="cs-download-icon cs-icon-pdf">PDF</span><b>ملف PDF</b><small>شرائح أفقية ملونة 16:9 جاهزة للطباعة أو الحفظ كـ PDF</small></button>'+
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
 const ctx=current,meta=options(ctx);
 const popup=format==='pdf'?window.open('','_blank'):null;
 if(format==='pdf'&&!popup){setStatus('يرجى السماح بفتح نافذة الحفظ كـ PDF.',true);return}
 busy=true;
 document.querySelectorAll('[data-csd-format]').forEach(x=>x.disabled=true);
 setStatus(format==='pptx'?'جاري إنشاء شرائح PowerPoint...':'جاري إعداد شرائح PDF...');
 try{
  if(!ctx.loaded())await ctx.load();
  if(!ctx.loaded())throw Error(ctx.error()||'تعذر قراءة ورقة Intellect');
  if(format==='pdf'){
   const content=window.VDSafetyDeck?.render(ctx.rows(),meta);
   if(!content)throw Error('تعذر تحميل قالب التقرير.');
   popup.document.open();popup.document.write(content);popup.document.close();
   let triggered=false;
   const print=()=>{if(triggered||popup.closed)return;triggered=true;try{popup.focus();window.VDReportArchive?.record({reportName:'تقييم السلامة للمقاولين',format:'PDF',filename:'VD_Contractor_Safety.pdf'});popup.print()}catch(_){}};
   popup.addEventListener('load',()=>setTimeout(print,600),{once:true});
   setTimeout(()=>{if(!triggered&&popup.document.readyState==='complete')print()},1600);
  }else{
   const req={general:meta.general,detailed:meta.detailed,period:meta.period,filters:ctx.filters()};
   const res=await fetch('/api/safety/contractor-evaluation/presentation',{
    method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(req)
   });
   if(!res.ok){const e=await res.json().catch(()=>({}));throw Error(e.error||'تعذر إنشاء ملف PowerPoint')}
   const blob=await res.blob();
   if(blob.size<1000)throw Error('ملف PowerPoint فارغ');
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='VD_Contractor_Safety_'+(meta.city==='جدة'?'Jeddah':'Makkah')+'_'+(meta.general?'General':'Filtered')+'_'+new Date().toISOString().slice(0,10)+'.pptx';
   document.body.appendChild(a);a.click();a.remove();window.VDReportArchive?.record({reportName:'تقييم السلامة للمقاولين',format:'PPTX',filename:a.download,blob});
   setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  busy=false;close();
 }catch(error){
  if(popup&&!popup.closed)popup.close();
  busy=false;
  document.querySelectorAll('[data-csd-format]').forEach(x=>x.disabled=false);
  setStatus(String(error.message||error),true);
 }
}
window.VDSafetyExporter={open};
})();
