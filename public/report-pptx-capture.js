(()=>{'use strict';
/* Uses identical page capture parameters and image geometry to the approved PDF output.
   No modification to the PDF export module is required. */
const PW=297,PH=167.063,SW=13.333333,SH=7.5;
const inX=mm=>mm*SW/PW,inY=mm=>mm*SH/PH;
async function ready(doc){
 await doc.fonts?.ready;
 await Promise.all([...doc.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
   const timer=setTimeout(resolve,8000),done=()=>{clearTimeout(timer);resolve()};
   img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});
 })));
}
async function createWindowPptxWide(win,selector='.sheet',progress){
 const Pptx=window.PptxGenJS||window.pptxgen;
 if(typeof Pptx!=='function')throw Error('PPTX_LIBRARY_UNAVAILABLE');
 if(typeof window.html2canvas!=='function'||typeof window.VDReportColorCompatibility?.sanitize!=='function')throw Error('CAPTURE_LIBRARY_UNAVAILABLE');
 if(!win||win.closed||!win.document?.body)throw Error('REPORT_NOT_READY');
 const doc=win.document,pages=[...doc.querySelectorAll(selector)];
 if(!pages.length)throw Error('REPORT_HAS_NO_PAGES');
 await ready(doc);
 const pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.author='Vision Dimensions';pptx.subject='Quality corrective report — PDF visual parity';
 for(let i=0;i<pages.length;i++){
  if(win.closed)throw Error('REPORT_WINDOW_CLOSED');
  if(typeof progress==='function')progress(i+1,pages.length);
  const page=pages[i];page.setAttribute('data-vd-pdf-capture-target','1');
  let canvas;
  try{
   canvas=await window.html2canvas(page,{backgroundColor:'#fff',scale:1.35,useCORS:true,allowTaint:false,logging:false,removeContainer:true,scrollX:0,scrollY:0,
    onclone:cloned=>{
     const clone=cloned.querySelector('[data-vd-pdf-capture-target="1"]');
     if(!clone)throw Error('PPTX_CLONED_PAGE_MISSING');
     window.VDReportColorCompatibility.sanitize(cloned,clone);
    }});
  }finally{page.removeAttribute('data-vd-pdf-capture-target');}
  if(canvas.width<10||canvas.height<10)throw Error('EMPTY_SLIDE_'+(i+1));
  const ratio=Math.min(289/canvas.width,159/canvas.height);
  const w=canvas.width*ratio,h=canvas.height*ratio,x=4+(289-w)/2,y=4+(159-h)/2;
  const slide=pptx.addSlide();slide.background={color:'FFFFFF'};
  slide.addImage({data:canvas.toDataURL('image/jpeg',0.82),x:inX(x),y:inY(y),w:inX(w),h:inY(h)});
  canvas.width=0;canvas.height=0;
 }
 const blob=await pptx.write({outputType:'blob'});
 if(!(blob instanceof Blob)||blob.size<1000)throw Error('EMPTY_PPTX');
 return {blob,slideCount:pages.length};
}
function download(blob,filename){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
window.VDReportPptxCapture={createWindowPptxWide,download};
})();