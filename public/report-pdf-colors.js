(()=>{
'use strict';
const risky=/\b(?:color|color-mix|oklch|oklab|lab|lch|hwb)\s*\(/i;
const palette=new Map();
const properties=['color','background-color','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','text-decoration-color','caret-color','column-rule-color','row-rule-color','text-emphasis-color','-webkit-text-fill-color','-webkit-text-stroke-color','fill','stroke'];
const decoration=['background-image','box-shadow','text-shadow','filter'];
function sanitize(doc,root){
 const view=doc.defaultView;
 if(!view||!root)return 0;
 const c=doc.createElement('canvas');c.width=c.height=1;
 const ctx=c.getContext('2d',{willReadFrequently:true});
 if(!ctx)return 0;
 const convert=source=>{
   const raw=String(source||'').trim();
   if(!risky.test(raw))return raw;
   if(palette.has(raw))return palette.get(raw);
   ctx.clearRect(0,0,1,1);
   ctx.fillStyle='#000';
   ctx.fillStyle=raw;
   ctx.fillRect(0,0,1,1);
   const v=ctx.getImageData(0,0,1,1).data;
   const rgba='rgba('+v[0]+','+v[1]+','+v[2]+','+(Math.round((v[3]/255)*1000)/1000)+')';
   palette.set(raw,rgba);
   return rgba;
 };
 const elements=[root,...root.querySelectorAll('*')];
 let count=0;
 const pseudoRules=[];
 elements.forEach((el,i)=>{
   const style=view.getComputedStyle(el);
   const fix=(computed,selector)=>{
     const patch=[];
     properties.forEach(key=>{
       const value=computed.getPropertyValue(key);
       if(risky.test(value)){
         patch.push(key+':'+convert(value)+' !important');
         count++;
       }
     });
     decoration.forEach(key=>{
       const value=computed.getPropertyValue(key);
       if(risky.test(value)||(key==='background-image'&&/gradient\s*\(/i.test(value))){patch.push(key+':none !important');count++}
     });
     if(!patch.length)return;
     if(!selector)patch.forEach(item=>{
       const colon=item.indexOf(':');
       el.style.setProperty(item.slice(0,colon),item.slice(colon+1).replace(/\s*!important$/,'').trim(),'important');
     });
     else pseudoRules.push(selector+'{'+patch.join(';')+'}');
   };
   fix(style,null);
   for(const pseudo of ['::before','::after']){
     const computed=view.getComputedStyle(el,pseudo);
     if(!computed||computed.content==='none')continue;
     const id='vdpdf'+i;
     el.setAttribute('data-vd-pdf-color',id);
     fix(computed,'[data-vd-pdf-color="'+id+'"]'+pseudo);
   }
 });
 if(pseudoRules.length){
   const sheet=doc.createElement('style');
   sheet.textContent=pseudoRules.join('\n');
   doc.head.appendChild(sheet);
 }
 return count;
}
window.VDReportColorCompatibility={sanitize};
})();
