(()=>{
'use strict';
// Export the same assembled report pages as a browser-generated PDF Blob.
// Keep the existing print preview available; upload only after an actual PDF is produced.
async function captureCompatible(Canvas,page,options){
 if(!window.VDReportColorCompatibility?.sanitize)throw Error('PDF_COLOR_COMPAT_UNAVAILABLE');
 page.setAttribute('data-vd-pdf-capture-target','1');
 try{
   return await Canvas(page,{...options,onclone:cloned=>{
     const target=cloned.querySelector('[data-vd-pdf-capture-target="1"]');
     if(!target)throw Error('PDF_CLONED_PAGE_MISSING');
     // The print-only body rule hides the html2canvas iframe's layout.
     // Adjust the isolated clone only; keep the user's print preview unchanged.
     const copy=cloned.getElementById('vdReportV2');
     if(copy&&cloned.body.classList.contains('vd-report-v2-mode')){
       cloned.body.classList.remove('vd-report-v2-mode');
       for(const sibling of cloned.body.children){
         if(sibling!==copy)sibling.style.setProperty('display','none','important');
       }
       copy.style.setProperty('display','block','important');
     }
     window.VDReportColorCompatibility.sanitize(cloned,target);

   }});
 }finally{
   page.removeAttribute('data-vd-pdf-capture-target');
 }
}
async function createPdf(report){
 const Canvas=window.html2canvas, Pdf=window.jspdf?.jsPDF;
 if(typeof Canvas!=='function'||typeof Pdf!=='function')throw Error('PDF_LIBRARY_UNAVAILABLE');
 if(!report?.isConnected)throw Error('REPORT_NOT_READY');
 const pages=[...report.querySelectorAll('.vd-report-v2-page')];
 if(!pages.length)throw Error('REPORT_HAS_NO_PAGES');
 await document.fonts?.ready;
 const originals={width:report.style.width,maxWidth:report.style.maxWidth};
 report.style.width='283mm';
 report.style.maxWidth='283mm';
 const pdf=new Pdf({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 try{
   for(let i=0;i<pages.length;i++){
     const page=pages[i];
     const canvas=await captureCompatible(Canvas,page,{backgroundColor:'#fff',scale:1.25,useCORS:true,allowTaint:false,logging:false,removeContainer:true,scrollX:0,scrollY:0,windowWidth:1160});
     if(canvas.width<10||canvas.height<10)throw Error('EMPTY_REPORT_PAGE_'+(i+1));
     if(i)pdf.addPage('a4','landscape');
     const image=canvas.toDataURL('image/jpeg',0.76);
     const ratio=Math.min(283/canvas.width,196/canvas.height);
     const width=canvas.width*ratio,height=canvas.height*ratio;
     pdf.addImage(image,'JPEG',7+(283-width)/2,7+(196-height)/2,width,height,undefined,'FAST');
     canvas.width=0;canvas.height=0;
   }
   const blob=pdf.output('blob');
   if(blob.size<800||blob.size>23*1024*1024)throw Error('PDF_FILE_SIZE_'+Math.ceil(blob.size/1024/1024)+'MB');
   return blob;
 }finally{
   report.style.width=originals.width;
   report.style.maxWidth=originals.maxWidth;
 }
}
async function createWindowPdf(win,selector='.page',onProgress){
 const Canvas=window.html2canvas,Pdf=window.jspdf?.jsPDF;
 if(typeof Canvas!=='function'||typeof Pdf!=='function')throw Error('PDF_LIBRARY_UNAVAILABLE');
 if(!win||win.closed||!win.document?.body)throw Error('REPORT_NOT_READY');
 const doc=win.document;
 const pages=[...doc.querySelectorAll(selector||'.page')];
 if(!pages.length)throw Error('REPORT_NOT_READY');
 await doc.fonts?.ready;
 await Promise.all([...doc.images].map(img=>img.complete?Promise.resolve():new Promise(done=>{const timer=setTimeout(done,8000);const complete=()=>{clearTimeout(timer);done()};img.addEventListener('load',complete,{once:true});img.addEventListener('error',complete,{once:true})})));
 const pdf=new Pdf({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 for(let i=0;i<pages.length;i++){
   if(win.closed)throw Error('REPORT_NOT_READY');
   if(typeof onProgress==='function')onProgress(i+1,pages.length);
   const canvas=await captureCompatible(Canvas,pages[i],{backgroundColor:'#fff',scale:1.35,useCORS:true,allowTaint:false,logging:false,removeContainer:true,scrollX:0,scrollY:0});
   if(canvas.width<10||canvas.height<10)throw Error('REPORT_NOT_READY');
   if(i)pdf.addPage('a4','landscape');
   const image=canvas.toDataURL('image/jpeg',0.82);
   const ratio=Math.min(283/canvas.width,196/canvas.height);
   const width=canvas.width*ratio,height=canvas.height*ratio;
   pdf.addImage(image,'JPEG',7+(283-width)/2,7+(196-height)/2,width,height,undefined,'FAST');
   canvas.width=0;canvas.height=0;
 }
 const blob=pdf.output('blob');
 if(blob.size<800||blob.size>23*1024*1024)throw Error('PDF_FILE_SIZE_'+Math.ceil(blob.size/1024/1024)+'MB');
 return blob;
}
window.VDReportPdfCapture={createPdf,createWindowPdf};
})();
