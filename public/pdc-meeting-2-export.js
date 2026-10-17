(()=>{'use strict';
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=x=>x==null||x===''?'—':Number(x).toLocaleString('en-US');
const ksaDate=()=>{const v={};new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(x=>{if(x.type!=='literal')v[x.type]=x.value});return v.year+'-'+v.month+'-'+v.day};
let summary=null,sources=null,running=false;
async function get(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'}),j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(j.error||'SOURCE_READ_FAILED');return j;}
async function latest(kind){
 const base=kind==='safety'?'/api/safety-corrective':'/api/quality-corrective';
 const all=(await get(base+'/reports')).reports||[];
 const ordered=all.filter(r=>Number(r.totalSites||0)>0||Number(r.totalVisits||0)>0).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
 for(const item of ordered){
  const data=await get(base+'/reports/'+encodeURIComponent(item.id));
  if((data.findings||[]).length)return {report:data.report,count:data.findings.length,skipped:all.filter(x=>String(x.updatedAt||'')>String(item.updatedAt||'')).length};
 }
 return {report:null,reason:'لا يوجد تقرير مكتمل يحتوي على ملاحظات؛ لا تُستخدم المسودات الفارغة'};
}
function ready(){return !!summary&&!!sources?.safety?.report&&!!sources?.quality?.report&&!running;}
function indicators(){
 const host=$('pm2AggregateSources');if(!host)return;
 const arr=[
  ['الشرائح 1–6','جميع البيانات التشغيلية المتاحة حاليًا',true],
  ['آخر تقرير سلامة مكتمل',sources?.safety?.report?String(sources.safety.report.weekLabel||'')+' | '+sources.safety.count+' ملاحظات'+(sources.safety.skipped?' | تم استبعاد '+sources.safety.skipped+' مسودة أحدث':''):(sources?.safety?.reason||'جار تحديد المصدر'),!!sources?.safety?.report],
  ['آخر تقرير جودة مكتمل',sources?.quality?.report?String(sources.quality.report.weekLabel||'')+' | '+sources.quality.count+' ملاحظات'+(sources.quality.skipped?' | تم استبعاد '+sources.quality.skipped+' مسودة أحدث':''):(sources?.quality?.reason||'جار تحديد المصدر'),!!sources?.quality?.report],
  ['تقرير المؤقتات والمولدات','قيد الإنشاء — يضاف تلقائيًا إلى التجميع عند اكتمال مصدره',null]
 ];
 host.innerHTML=arr.map(([name,label,ok])=>'<div class="pm2-agg-line '+(ok===true?'ready':ok===false?'unready':'pending')+'"><b>'+esc(name)+'</b><span>'+esc(label)+'</span></div>').join('');
 for(const id of ['pm2ExportPptx','pm2ExportPdf'])$(id).disabled=!ready();
 $('pm2ExportsNote').textContent=ready()?'التصدير متاح للأجزاء المكتملة. المؤقتات تُضاف عند جاهزية تقريرها. تُصدّر صفحات PowerPoint كشرائح مصورة للمحافظة على المظهر؛ ولا تكون عناصرها قابلة للتعديل.':'يلزم تقرير سلامة وتقرير جودة صالحان قبل التجميع. لن تستخدم المنظومة بيانات قديمة لملء الملاحظات الناقصة.';
}
async function discover(){
 try{const [safety,quality]=await Promise.all([latest('safety'),latest('quality')]);sources={safety,quality};}
 catch(e){sources={safety:{reason:e.message},quality:{reason:e.message}};}
 indicators();
}
const bars=a=>{
 a=(a||[]).slice(0,12);if(!a.length)return '<p>لا يوجد تصنيف متاح</p>';
 const max=Math.max(1,...a.map(x=>Number(x.value)||0));
 return '<div class="pdc6bars">'+a.map(x=>'<div class="pdc6bar">'+esc(x.label)+'<em>'+num(x.value)+'</em><i><strong style="width:'+(100*(Number(x.value)||0)/max).toFixed(2)+'%"></strong></i></div>').join('')+'</div>';
};
const cards=a=>'<div class="pdc6cards">'+a.map(([k,v])=>'<div class="pdc6card"><span>'+esc(k)+'</span><b>'+num(v)+'</b></div>').join('')+'</div>';
const page=(n,title,body,source)=>'<section class="sheet pdc6"><header><div><small>VISION DIMENSIONS · PDC MAKKAH</small><h1>'+esc(n+'. '+title)+'</h1></div><div><img src="/company-logo.png"><img src="/assets/pdc-logo.png"></div></header><article>'+body+'</article><footer><span>'+esc(source)+'</span><span>اجتماع PDC 2 | '+new Date().toLocaleDateString('ar-SA',{timeZone:'Asia/Riyadh'})+'</span></footer></section>';
function six(a){
 const c=a.construction||{},p=a.permits||{},e=a.emergency||{},f=a.financial||{},w=a.weekly||{},m=a.manual||{};
 return [
  page(1,'الموقف التنفيذي للإنشاءات',cards([['إجمالي سجلات الأوامر',c.total],['تم التنفيذ',c.completed],['تم إدخال 155',c.received155],['لم يتم البدء',c.notStarted]])+'<h2>التوزيع حسب القسم</h2>'+bars(c.bySection),'أوامر العمل | جميع السجلات'),
  page(2,'أوامر العمل حسب المقاولين',cards([['أوامر العمل الفريدة',c.uniqueWorkOrders],['صفوف الأرقام المكررة',c.repeatedRows],['جار التنفيذ',c.inProgress],['لم يتم إدخال 155',c.notReceived155]])+'<h2>أوامر العمل حسب المقاول</h2>'+bars(c.byContractor),'أوامر العمل | جميع السجلات'),
  page(3,'التصاريح',cards([['إجمالي التصاريح',p.available?p.total:null]])+'<h2>حالات التصاريح</h2>'+bars(p.byStatus),'التصاريح العام | جميع السجلات'),
  page(4,'الطوارئ',cards([['إجمالي الإشعارات',e.available?e.total:null],['المنجزة',e.completed],['الجارية',e.inProgress],['لم تبدأ',e.notStarted]])+'<h2>حسب المقاول</h2>'+bars(e.byContractor),'إشعارات الطوارئ | جميع السجلات'),
  page(5,'المستخلصات وأوامر الشراء',cards([['الكميات المعتمدة',f.approvedQuantities],['أوامر الشراء',f.purchaseOrders],['المستخلصات',f.paymentCertificates],['نسبة الصرف %',f.paymentRate]])+'<h2>الإشعارات الشهرية</h2>'+bars((f.noticesByMonth||[]).map(x=>({label:x.month,value:x.count})))+'<p class="pdc6note">آخر إدخال مالي يدوي'+(m.saved?' للفترة '+esc(m.from)+' إلى '+esc(m.to):' غير متاح')+'؛ ليس رقمًا مُعتمدًا آليًا.</p>','المدخلات المالية المؤقتة'),
  page(6,'الإنجاز الأسبوعي واستلام 155',cards([['توصيلات منفذة',w.completedConnections],['مشاريع منفذة',w.completedProjects],['توصيلات 155',w.receivedConnections155],['مشاريع 155',w.receivedProjects155]])+'<p class="pdc6note">بيانات آخر أسبوع مدخل يدويًا؛ لا تُجمع مع الفترات السابقة.'+(m.saved?' الفترة: '+esc(m.from)+' إلى '+esc(m.to):'')+'</p>','سجل الإدخال الأسبوعي')
 ].join('');
}
const notify=x=>{if($('pm2ExportsNote'))$('pm2ExportsNote').textContent=x;};
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}
async function archive(blob,format,filename){
 try{return await window.VDReportArchive.record({reportName:'التقرير التجميعي لاجتماع PDC 2 - مكة',format,filename,blob});}
 catch(e){return {ok:false,error:String(e.message||e)}}
}
async function compose(format){
 if(!ready())return;
 const win=window.open('','_blank','width=1440,height=960');if(!win){notify('اسمح بالنوافذ المنبثقة لمعاينة شرائح التقرير.');return;}
 running=true;indicators();
 win.document.write('<html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font:20px Tahoma;padding:45px">جار تجميع شرائح التقرير...</body></html>');
 try{
  notify('قراءة أحدث تقرير سلامة وجودة مكتملين مع الصور والتعليقات...');
  const live=await get('/api/pdc-meeting-2/summary');
  const safety=await window.VDSafetyCorrectiveCenter.assemble(sources.safety.report.id);
  const quality=await window.VDQualityCorrectiveCenter.assemble(sources.quality.report.id);
  const generator=typeof window.VDGeneratorReportCenter?.assembleLatest==='function'?
   await window.VDGeneratorReportCenter.assembleLatest():null;
  const styles=await fetch('/pdc-meeting-2-print.css',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('PRINT_STYLE_MISSING');return r.text()});
  const body=six(live)+safety.html+quality.html+(generator?.html||'');
  const css=safety.css+'\n'+quality.css+'\n'+(generator?.css||'')+'\n'+styles+'\n@page{size:13.333333in 7.5in;margin:0}';
  const scripts=(safety.fitScript||'')+(quality.fitScript||'')+(generator?.fitScript||'');
  win.document.open();win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير اجتماع PDC 2 التجميعي</title><style>'+css+'</style></head><body>'+body+scripts+'</body></html>');win.document.close();
  await win.document.fonts?.ready;
  const pages=[...win.document.querySelectorAll('.sheet')],expected=6+safety.slideCount+quality.slideCount+(generator?.slideCount||0);
  if(pages.length!==expected)throw Error('SLIDE_COUNT_MISMATCH');
  const filename='VD_PDC2_Makkah_'+ksaDate()+'.'+(format==='PDF'?'pdf':'pptx');
  let blob;
  if(format==='PDF'){
   if(!window.VDReportPdfCapture)throw Error('PDF_CAPTURE_UNAVAILABLE');
   blob=await window.VDReportPdfCapture.createWindowPdfWide(win,'.sheet',(i,n)=>notify('تصدير PDF: الشريحة '+i+' من '+n));
  }else{
   const Pptx=window.pptxgen||window.PptxGenJS;if(typeof Pptx!=='function')throw Error('PPTX_LIBRARY_UNAVAILABLE');
   const pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.author='Vision Dimensions';pptx.subject='PDC 2 Makkah Consolidated';
   for(let i=0;i<pages.length;i++){
    notify('تصدير PowerPoint: الشريحة '+(i+1)+' من '+pages.length);
    const canvas=await window.html2canvas(pages[i],{backgroundColor:'#ffffff',scale:1.15,useCORS:true,allowTaint:false,logging:false});
    if(canvas.width<10||canvas.height<10)throw Error('EMPTY_SLIDE_'+(i+1));
    pptx.addSlide().addImage({data:canvas.toDataURL('image/jpeg',0.88),x:0,y:0,w:13.333333,h:7.5});
    canvas.width=0;canvas.height=0;
   }
   blob=await pptx.write({outputType:'blob'});
  }
  if(!(blob instanceof Blob)||blob.size<1000)throw Error('EMPTY_EXPORT');
  download(blob,filename);
  notify('تم تنزيل '+format+' من '+pages.length+' شريحة. جار رفع النسخة إلى pCloud...');
  const stored=await archive(blob,format,filename);
  notify('اكتمل التقرير التجميعي ('+pages.length+' شريحة): '+(stored?.ok?'تمت أرشفته على pCloud.':'تم تنزيل الملف؛ لم تكتمل الأرشفة: '+String(stored?.archiveError||stored?.error||'يرجى المراجعة'))+' المؤقتات قيد الإنشاء.');
 }catch(e){notify('تعذر التجميع: '+String(e.message||e));if(!win.closed)win.close();}
 finally{running=false;indicators();}
}
function init(){
 if(!$('pm2ExportPptx')||!$('pm2ExportPdf'))return;
 const div=document.createElement('div');div.id='pm2AggregateSources';div.className='pm2-aggregate-sources';
 const note=$('pm2ExportsNote');note.parentElement.insertBefore(div,note);
 $('pm2ExportPptx').addEventListener('click',()=>compose('PPTX'));
 $('pm2ExportPdf').addEventListener('click',()=>compose('PDF'));
 document.addEventListener('pm2:summary-loaded',e=>{summary=e.detail;discover()});
 indicators();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();