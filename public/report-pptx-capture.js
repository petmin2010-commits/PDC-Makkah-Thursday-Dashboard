(()=>{
'use strict';
/*
 * Native, editable PPTX export for Safety / Quality corrective reports.
 * Each slide is reconstructed from DOM elements as editable PPT shapes,
 * text boxes, table cells and separate photographic/logo image objects.
 * Importantly: no html2canvas, PDF-page raster or full-slide screenshot.
 * PDF creation is a completely separate, unchanged workflow.
 */
const SLIDE_W=13.333333,SLIDE_H=7.5;
const IGNORE=new Set(['SCRIPT','STYLE','NOSCRIPT','BUTTON','INPUT','SELECT','TEXTAREA','TEMPLATE']);
const SHAPE_SKIP=new Set(['IMG','SVG']);
const MAX_NODES=15000,MAX_SLIDES=400;
const rgbHex=raw=>{
 if(!raw)return null;
 const src=String(raw).trim(),hex=src.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
 if(hex){
  const h=hex[1].length===3?hex[1].split('').map(x=>x+x).join(''):hex[1];
  if(h.length===8&&parseInt(h.slice(6),16)<4)return null;
  return h.slice(0,6).toUpperCase();
 }
 const m=src.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s\/]+([\d.]+))?\s*\)/i);
 if(!m||m[4]!==undefined&&Number(m[4])<.03)return null;
 return [1,2,3].map(i=>Math.max(0,Math.min(255,Math.round(Number(m[i])))).toString(16).padStart(2,'0')).join('').toUpperCase();
};
function gradientColor(css){
 const bg=String(css.backgroundImage||'');
 if(!/gradient\(/i.test(bg))return null;
 // The browser may serialize gradient stops using rgb(), rgba() or hex.
 const m=bg.match(/rgba?\([^)]+\)|#[\da-f]{6}|#[\da-f]{3}/i);
 return m?rgbHex(m[0]):null;
}
function box(rect,origin){
 const x=(rect.left-origin.left)*origin.sx;
 const y=(rect.top-origin.top)*origin.sy;
 const w=rect.width*origin.sx,h=rect.height*origin.sy;
 const ix=Math.max(0,x),iy=Math.max(0,y);
 const iw=Math.min(SLIDE_W,Math.max(0,x+w))-ix;
 const ih=Math.min(SLIDE_H,Math.max(0,y+h))-iy;
 if(!Number.isFinite(iw)||!Number.isFinite(ih)||iw<=.003||ih<=.003)return null;
 return {x:ix,y:iy,w:iw,h:ih};
}
function visible(css,rect){
 return css&&css.display!=='none'&&css.visibility!=='hidden'&&css.visibility!=='collapse'&&
  Number(css.opacity||1)>.015&&rect&&rect.width>.3&&rect.height>.3;
}
function cssOf(doc,el){return doc.defaultView.getComputedStyle(el);}
function addRect(pptx,slide,loc,fill,border,radius){
 if(!loc)return;
 if(!fill&&!border)return;
 const type=radius>=7?pptx.ShapeType.roundRect:pptx.ShapeType.rect;
 const opt={...loc,rotate:0};
 opt.fill=fill?{color:fill}:{color:'FFFFFF',transparency:100};
 opt.line=border?{color:border.color,width:border.width}:{color:'FFFFFF',transparency:100};
 slide.addShape(type,opt);
}
function stroke(css){
 const widths=['Top','Right','Bottom','Left'].map(side=>parseFloat(css['border'+side+'Width'])||0);
 const i=widths.findIndex(x=>x>=.6);
 if(i<0)return null;
 const side=['Top','Right','Bottom','Left'][i],color=rgbHex(css['border'+side+'Color']);
 if(!color||css['border'+side+'Style']==='none')return null;
 return {color,width:Math.max(.25,Math.min(3.5,widths[i]*.7))};
}
function colorOf(css){return rgbHex(css.backgroundColor)||gradientColor(css);}
function fontPx(css){const p=parseFloat(css.fontSize);return Number.isFinite(p)&&p>0?p:16;}
function textData(node,css){
 const value=String(node.nodeValue||'');
 if(!value.trim())return null;
 if(css.whiteSpace==='pre'||css.whiteSpace==='pre-wrap'||css.whiteSpace==='pre-line')
  return value.replace(/^\s+|\s+$/g,'');
 return value.replace(/\s+/g,' ').trim();
}
function addTextNode(slide,node,el,css,origin,doc){
 const value=textData(node,css);
 if(!value)return false;
 let rect=null;
 try{const range=doc.createRange();range.selectNodeContents(node);rect=range.getBoundingClientRect();range.detach?.();}catch(_){}
 if(!rect||rect.width<=.1||rect.height<=.1)rect=el.getBoundingClientRect();
 const pos=box(rect,origin);if(!pos)return false;
 // A little horizontal and vertical slack prevents clipped Arabic text.
 const direction=css.direction==='ltr'?'ltr':'rtl';
 const px=fontPx(css),pt=px*72*origin.sx;
 const c=rgbHex(css.color)||'173D64';
 const bold=Number(css.fontWeight)>=600||/bold/i.test(String(css.fontWeight));
 let align=css.textAlign==='center'?'center':css.textAlign==='left'?'left':css.textAlign==='right'?'right':direction==='rtl'?'right':'left';
 const extra=Math.min(.09,Math.max(.035,pos.w*.03));
 const x=Math.max(0,pos.x-extra/2),w=Math.min(SLIDE_W-x,pos.w+extra);
 const y=Math.max(0,pos.y-.008),h=Math.min(SLIDE_H-y,Math.max(pos.h+.05,pt/72*1.17));
 if(w<=.015||h<=.01)return false;
 slide.addText(value,{
  x,y,w,h,margin:0,breakLine:false,fontFace:'Arial',fontSize:Math.max(5,Math.min(48,pt)),
  color:c,bold,rtlMode:direction==='rtl',align,valign:'mid',vertAnchor:'mid',
  fit:'shrink',transparency:0,italic:css.fontStyle==='italic',
  underline:css.textDecorationLine?.includes('underline')?{color:c}:undefined,
  paraSpaceAfterPt:0,lang:direction==='rtl'?'ar-SA':'en-US'
 });
 return true;
}
function addArrow(pptx,slide,loc,css){
 const fill=colorOf(css)||'F18C2D';
 slide.addShape(pptx.ShapeType.rightArrow||pptx.ShapeType.chevron||pptx.ShapeType.rect,
  {...loc,rotate:0,line:{color:fill,transparency:100},fill:{color:fill}});
}
async function imageData(img,win,cache){
 const src=String(img.currentSrc||img.getAttribute('src')||img.src||'').trim();
 if(!src)return null;
 if(src.startsWith('data:image/'))return src;
 let url;
 try{url=new URL(src,win.location?.href||win.document?.baseURI||window.location.href).href;}catch(_){return null;}
 if(cache.has(url))return cache.get(url);
 const p=(async()=>{
  const response=await window.fetch(url,{credentials:new URL(url).origin===window.location.origin?'same-origin':'omit',mode:'cors'});
  if(!response.ok)throw Error('PPTX_IMAGE_HTTP_'+response.status);
  const blob=await response.blob();
  if(!blob.type.startsWith('image/'))throw Error('PPTX_IMAGE_TYPE');
  return await new Promise((resolve,reject)=>{
    const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=()=>reject(f.error||Error('PPTX_IMAGE_READ'));f.readAsDataURL(blob);
  });
 })();
 cache.set(url,p);return p;
}
function addImageElement(slide,el,loc,css,data){
 if(!data||!loc)return false;
 const width=Number(el.naturalWidth)||Number(el.width)||1,height=Number(el.naturalHeight)||Number(el.height)||1;
 const fit=css.objectFit||'fill';let dst={...loc};
 if((fit==='contain'||fit==='scale-down')&&width>0&&height>0){
  const scale=Math.min(loc.w/width,loc.h/height);
  dst={x:loc.x+(loc.w-width*scale)/2,y:loc.y+(loc.h-height*scale)/2,w:width*scale,h:height*scale};
 }
 slide.addImage({data,...dst,altText:el.getAttribute('alt')||''});
 return true;
}
function backgroundUrl(style){
 const bg=String(style.backgroundImage||'');
 const m=bg.match(/url\(["']?([^)"']+)["']?\)/i);
 return m?m[1]:null;
}
async function addBackgroundImage(slide,el,loc,css,win,cache){
 const path=backgroundUrl(css);if(!path)return false;
 const fake={currentSrc:path,getAttribute(){return path;},src:path};
 const data=await imageData(fake,win,cache);
 if(!data)return false;
 slide.addImage({data,...loc,altText:'Report background visual'});
 return true;
}
async function renderElement(pptx,slide,el,origin,doc,win,cache,counters,depth=0){
 if(!el||el.nodeType!==1||depth>48)return;
 if(counters.nodes++>MAX_NODES)throw Error('PPTX_TOO_MANY_ELEMENTS');
 if(IGNORE.has(el.tagName)||el.closest?.('.print-actions'))return;
 const rect=el.getBoundingClientRect(),css=cssOf(doc,el);
 if(!visible(css,rect))return;
 const pos=box(rect,origin);
 if(!pos)return;
 if(el.tagName==='IMG'){
  const data=await imageData(el,win,cache);
  if(!data)throw Error('PPTX_MISSING_IMAGE');
  if(addImageElement(slide,el,pos,css,data))counters.images++;
  return;
 }
 const back=colorOf(css),border=stroke(css);
 if(!SHAPE_SKIP.has(el.tagName)){
  if(back||border){addRect(pptx,slide,pos,back,border,parseFloat(css.borderRadius)||0);counters.shapes++;}
  if(backgroundUrl(css)){await addBackgroundImage(slide,el,pos,css,win,cache);counters.images++;}
  if(el.classList?.contains('scr-f-arrow')||el.classList?.contains('qcr-f-arrow')){addArrow(pptx,slide,pos,css);counters.shapes++;}
 }
 for(const child of el.childNodes){
  if(child.nodeType===3){
   if(addTextNode(slide,child,el,css,origin,doc))counters.texts++;
  }else if(child.nodeType===1){
   await renderElement(pptx,slide,child,origin,doc,win,cache,counters,depth+1);
  }
 }
}
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
 if(!win||win.closed||!win.document?.body)throw Error('REPORT_NOT_READY');
 const doc=win.document,pages=[...doc.querySelectorAll(selector)];
 if(!pages.length)throw Error('REPORT_HAS_NO_PAGES');
 if(pages.length>MAX_SLIDES)throw Error('PPTX_TOO_MANY_SLIDES');
 await ready(doc);
 const pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.author='Vision Dimensions';
 pptx.title=doc.title||'Editable Safety and Quality Report';pptx.subject='Native editable shapes and table cells';pptx.lang='ar-SA';
 const counts=[],images=new Map();
 for(let i=0;i<pages.length;i++){
  if(win.closed)throw Error('REPORT_WINDOW_CLOSED');
  if(typeof progress==='function')progress(i+1,pages.length);
  const page=pages[i],rect=page.getBoundingClientRect();
  if(rect.width<50||rect.height<50)throw Error('INVALID_SLIDE_GEOMETRY_'+(i+1));
  const sx=SLIDE_W/rect.width,sy=SLIDE_H/rect.height;
  const origin={left:rect.left,top:rect.top,sx,sy};
  const slide=pptx.addSlide();slide.background={color:'FFFFFF'};
  const n={texts:0,shapes:0,images:0,nodes:0};
  await renderElement(pptx,slide,page,origin,doc,win,images,n);
  if(n.texts<1)throw Error('EDITABLE_TEXT_MISSING_SLIDE_'+(i+1));
  counts.push(n);
 }
 const blob=await pptx.write({outputType:'blob'});
 if(!(blob instanceof Blob)||blob.size<1000)throw Error('EMPTY_PPTX');
 return {blob,slideCount:pages.length,editable:true,objects:counts};
}
function download(blob,filename){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
window.VDReportPptxCapture={createWindowPptxWide,download,mode:'editable-objects'};
})();
