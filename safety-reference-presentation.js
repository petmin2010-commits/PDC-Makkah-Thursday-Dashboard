'use strict';
// Template-matched PowerPoint: exact images rendered from the user-supplied 13-page reference PDF.
// Facts/charts on data slides are regenerated from Intellect; reference data is never reused.
const path=require('path'),fs=require('fs'),pptxgen=require('pptxgenjs');
const ASSETS=path.join(__dirname,'safety-reference');
const W=11.6929,H=8.2677,BLUE='164B88',ORANGE='F58A21',RED='87301F',WHITE='FFFFFF';
const PIE=['4285F4','F04438','F5BD0E','2FA856','FF7611','80AEEF','F8B1B9','A4D99A','1388B6','65359C','864B17','F52D54','C3EAE9','FDBE9C','3258A4'];
const clean=s=>String(s==null?'':s).replace(/\s+/g,' ').trim();
const avg=v=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
const pct=n=>n==null?'—':Number(n).toFixed(1)+'%';
const num=n=>Number(n||0).toLocaleString('en-US');
const chunk=(xs,count)=>Array.from({length:Math.ceil(xs.length/count)},(_,i)=>xs.slice(i*count,(i+1)*count));
const imgNum=n=>String(n).padStart(2,'0');
function scoreData(rows){
 const map=new Map(),issues=new Map(),points=[];
 for(const r of rows){
  const name=clean(r.contractor)||'مقاول غير محدد';
  if(!map.has(name))map.set(name,{name,count:0,scores:[],issues:new Map()});
  const c=map.get(name);c.count++;
  if(Number.isFinite(r.score)){c.scores.push(r.score);points.push(r.score)}
  for(const v of r.violations||[]){
   const label=clean(v.label)||'مخالفة '+v.number,key=String(v.number);
   if(!issues.has(key))issues.set(key,{number:v.number,label,count:0});
   issues.get(key).count++;
   if(!c.issues.has(key))c.issues.set(key,{number:v.number,label,count:0});
   c.issues.get(key).count++;
  }
 }
 const contractors=[...map.values()].map(x=>({...x,score:avg(x.scores),
   issues:[...x.issues.values()].sort((a,b)=>b.count-a.count||a.number-b.number)}))
   .sort((a,b)=>(b.score??-1)-(a.score??-1)||b.count-a.count);
 return {contractors,issues:[...issues.values()].sort((a,b)=>b.count-a.count||a.number-b.number),avg:avg(points)};
}
function slideFrom(pptx,index,cleanVersion=false){
 const slide=pptx.addSlide();slide.background={color:WHITE};
 const name=(cleanVersion?'clean-':'slide-')+imgNum(index)+'.jpg';
 const file=path.join(ASSETS,name);
 if(!fs.existsSync(file))throw new Error('قالب السلامة الأصلي مفقود: '+name);
 slide.addImage({path:file,x:0,y:0,w:W,h:H});
 return slide;
}
function txt(slide,t,x,y,w,h,opt={}){
 slide.addText(String(t??''),{x,y,w,h,margin:0,fontFace:'Arial',fontSize:11,color:BLUE,align:'center',valign:'mid',
 rtlMode:true,fit:'shrink',breakLine:false,...opt});
}
function shape(pptx,slide,x,y,w,h,fill,stroke=null,rad=false){
 slide.addShape(rad?pptx.ShapeType.roundRect:pptx.ShapeType.rect,{
 x,y,w,h,rectRadius:rad?.12:undefined,
 fill:{color:fill},line:{color:stroke||fill,width:stroke?1.0:0}});
}
function line(pptx,s,x,y,w,h,c,width=1){s.addShape(pptx.ShapeType.line,{x:w<0?x+w:x,y:h<0?y+h:y,w:Math.abs(w),h:Math.abs(h),line:{color:c,width}})}
function periodName(period){
 const matches=[...clean(period).matchAll(/\b(202[0-9])-(\d\d)\b/g)];
 const names=['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
 if(matches.length>1&&matches[0][0]!==matches[matches.length-1][0])return names[Number(matches[0][2])]+' - '+names[Number(matches[matches.length-1][2])]+' '+matches[matches.length-1][1];
 if(matches.length)return names[Number(matches[0][2])]+' '+matches[0][1];
 return period==='كامل الفترة'?'جميع الفترات':clean(period)||'فترة التقرير';
}
function titleMonth(pptx,s,title,period){
 // Cover original static October/date text only; everything else keeps original geometry.
 shape(pptx,s,2.85,.48,6.0,.91,WHITE);
 txt(s,title,2.75,.72,6.3,.28,{fontSize:15.5,bold:true,color:BLUE});
 txt(s,periodName(period),3.9,1.05,3.8,.26,{fontSize:14.6,bold:true,color:BLUE});
}
function noteSlide(pptx,s,details){
 shape(pptx,s,.70,4.08,10.30,1.10,BLUE);
 const order=[...details.issues.slice(0,5)];
 for(let i=0;i<5;i++){
  const issue=order[i]||null,x=9.06-i*2.02,w=1.84;
  // The same five-card arrangement as the source presentation.
  shape(pptx,s,x,2.65,w,4.0,WHITE,'EEEEEE',true);
  txt(s,String(i+1).padStart(2,'0'),x+.38,2.86,w-.76,.28,{fontSize:16,bold:true,color:ORANGE});
  const iconFile=path.join(ASSETS,'icon-'+imgNum(i+1)+'.png');
  if(fs.existsSync(iconFile))s.addImage({path:iconFile,x:x+.54,y:3.31,w:.75,h:.68});
  const heading=issue?(issue.number+' - '+issue.label):'لا توجد مخالفة';
  txt(s,heading,x+.14,4.37,w-.28,.85,{fontSize:10.1,color:'292929',bold:true,breakLine:false,valign:'top',fit:'shrink'});
  txt(s,issue?'تكرار الملاحظة '+num(issue.count)+' مرة في الفترة المختارة':'لم تُرصد مخالفة إضافية ضمن الفلاتر.',
      x+.18,5.29,w-.36,.67,{fontSize:10,color:'333333',valign:'top'});
  txt(s,'متابعة إجراءات السلامة والتأكد من تطبيق ضوابط الوقاية في الموقع',
      x+.17,5.88,w-.34,.63,{fontSize:8.7,color:'333333',valign:'top'});
 }
}
function rankSlide(pptx,s,data){
 const xs=data.contractors;
 // Same plot framing, orange pseudo-3D columns and vertical labels.
 shape(pptx,s,1.21,1.91,9.12,4.87,WHITE,'CFCFCF');
 const left=1.78,right=9.71,top=2.13,bottom=5.37;
 for(let j=0;j<=4;j++){
  const y=bottom-j*(bottom-top)/4;
  line(pptx,s,left,y,right-left,0,'D4D4D4',.5);
  txt(s,String(j*25)+'.00',1.22,y-.11,.40,.18,{fontSize:7.1,color:RED,align:'right',rtlMode:false});
 }
 const first=xs.slice(0,12),n=first.length;
 if(!n){txt(s,'لا توجد درجات فحوص متاحة للفترة المحددة',2.1,3.4,7.5,.6,{fontSize:16});return}
 const usable=right-left-.5,step=usable/n,barW=Math.min(.44,step*.69);
 first.forEach((c,i)=>{
  const x=left+.16+i*step,score=Math.max(0,Math.min(100,c.score??0)),height=(bottom-top)*score/100;
  const y=bottom-height,depth=Math.min(.1,barW*.26);
  shape(pptx,s,x+depth,y-.10,barW,height,'9D5F27');
  shape(pptx,s,x,y,barW,height,'E79235');
  shape(pptx,s,x,y-.105,barW,.10,'F4AF63');
  txt(s,score.toFixed(2),x-.2,3.72,barW+.4,.19,{fontSize:8.2,color:RED,bold:true,rtlMode:false});
  txt(s,c.name,x-.30,bottom+.49,barW+.62,.31,{fontSize:8,color:RED,vert:'vert270',fit:'shrink'});
 });
}
function svgEscape(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function darken(hex,f=.72){
 return [0,2,4].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*f).toString(16).padStart(2,'0')).join('');
}
function pieImage(items){
 const source=items.filter(x=>Number(x.count)>0),raw=source.reduce((a,b)=>a+b.count,0);
 const data=source.length?source:[{count:1,color:PIE[0]}];const total=raw||1;
 const cx=330,cy=189,rx=245,ry=154,dy=23;
 let a=-Math.PI/2,parts=[];
 function wedge(start,end,offset){
  const large=end-start>Math.PI?1:0;
  const x1=cx+rx*Math.cos(start),y1=cy+offset+ry*Math.sin(start),
  x2=cx+rx*Math.cos(end),y2=cy+offset+ry*Math.sin(end);
  return 'M '+cx+' '+(cy+offset)+' L '+x1+' '+y1+' A '+rx+' '+ry+' 0 '+large+' 1 '+x2+' '+y2+' Z';
 }
 for(let i=0;i<data.length;i++){
  const item=data[i],b=a+2*Math.PI*item.count/total;
  const color=item.color||PIE[i%PIE.length];
  parts.push({a,b,color});
  a=b;
 }
 const bottom=parts.map(v=>'<path d="'+wedge(v.a,v.b,dy)+'" fill="#'+darken(v.color,.68)+'"/>').join('');
 const top=parts.map(v=>'<path d="'+wedge(v.a,v.b,0)+'" fill="#'+v.color+'"/>').join('');
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="660" height="425" viewBox="0 0 660 425">'+bottom+top+'</svg>';
 return 'data:image/svg+xml;base64,'+Buffer.from(svg,'utf8').toString('base64');
}
function pieSlide(pptx,s,issues,mode,period){
 const all=issues.filter(v=>v.count>0),max=mode==='top'?5:20,selected=all.slice(0,max);
 if(mode==='top')titleMonth(pptx,s,'نسب تكرار أكبر خمس مخالفات لجميع المقاولين مع جميع الاستشاريين',period);
 else titleMonth(pptx,s,'نسب تكرار جميع أنواع المخالفات لجميع المقاولين مع جميع الاستشاريين',period);
 shape(pptx,s,1.20,1.56,9.31,5.04,WHITE,'D0D0D0');
 if(!selected.length){txt(s,'لا توجد مخالفات مسجلة في الفترة المحددة',2.8,3.3,6.0,.4,{fontSize:19});return;}
 const chart=selected.length>12?{x:3.53,y:2.21,w:4.28,h:3.61}:{x:3.13,y:2.07,w:4.92,h:3.96};
 s.addImage({data:pieImage(selected),...chart});
 const count=selected.reduce((a,b)=>a+b.count,0),spots=Math.ceil(selected.length/2),rowHeight=Math.min(.53,4.03/Math.max(1,spots));
 selected.forEach((v,i)=>{
  const side=i%2,idx=Math.floor(i/2),x=side===0?7.85:.84,
   y=2.14+idx*rowHeight,w=side===0?2.60:2.44;
  const text=(v.number?String(v.number)+' - ':'')+v.label;
  txt(s,text,x,y,w,rowHeight*.57,{fontSize:mode==='top'?9.4:7.5,color:RED,align:side===0?'right':'left',bold:true});
  txt(s,(v.count/count*100).toFixed(1)+'%',x,y+rowHeight*.60,w,.16,
     {fontSize:7.9,color:'888888',rtlMode:false,align:side===0?'right':'left'});
  line(pptx,s,side===0?7.96:3.49,y+rowHeight*.49,side===0?2.05:-2.15,0,'979797',.44);
 });
}
function contractorSlide(pptx,s,groups,serial,total){
 // Quad pie layout precisely matched to source page 11.
 shape(pptx,s,.70,1.82,10.29,5.47,WHITE,'111111');
 line(pptx,s,5.89,1.83,0,5.44,'111111',1.5);
 line(pptx,s,.70,4.35,10.29,0,'111111',1.5);
 const positions=[
  {x:6.12,y:1.83,w:4.78,h:2.42},
  {x:.93,y:1.83,w:4.78,h:2.42},
  {x:6.12,y:4.38,w:4.78,h:2.60},
  {x:.93,y:4.38,w:4.78,h:2.60}
 ];
 for(let i=0;i<4;i++){
  const part=positions[i],c=groups[i];
  if(!c)continue;
  txt(s,c.name,part.x+.08,part.y+.03,part.w-.16,.25,{fontSize:13.5,bold:true,color:BLUE});
  shape(pptx,s,part.x+.16,part.y+.36,part.w-.32,part.h-.42,WHITE,'D8D8D8');
  if(c.issues.length){
   const list=c.issues.slice(0,5);
   s.addImage({data:pieImage(list),x:part.x+1.02,y:part.y+.56,w:part.w-1.90,h:part.h-1.01});
   txt(s,num(c.issues.reduce((t,v)=>t+v.count,0))+' مخالفة',part.x+.42,part.y+part.h-.43,part.w-.8,.19,{fontSize:8.2,color:RED});
  }else{
   txt(s,'لا توجد مخالفات مسجلة',part.x+.35,part.y+1.08,part.w-.7,.38,{fontSize:14,color:'536A75'});
  }
 }
 const footer=path.join(ASSETS,'footer-logo.png');
 if(fs.existsSync(footer))s.addImage({path:footer,x:.81,y:6.96,w:3.25,h:.43});
 if(total>1)txt(s,'صفحة المقاولين '+serial+' / '+total,4.0,7.37,3.7,.24,{fontSize:10.4,color:BLUE,bold:true});
}
async function create(rows,meta={}){
 const pptx=new pptxgen();
 pptx.defineLayout({name:'SAFETY_A4_LANDSCAPE',width:W,height:H});
 pptx.layout='SAFETY_A4_LANDSCAPE';pptx.author='Vision Dimensions Engineering Consultancy';
 pptx.subject='Contractor Safety: source-template visual fidelity';
 pptx.title='تقرير السلامة والصحة المهنية لمقاولي العقد الموحد';
 pptx.lang='ar-SA';pptx.company='Vision Dimensions';
 const data=scoreData(rows),period=meta.general?'كامل الفترة':clean(meta.period)||'كامل المدة';
 for(let page=1;page<=6;page++)slideFrom(pptx,page);
 let s=slideFrom(pptx,7,true);noteSlide(pptx,s,data);
 const parts=chunk(data.contractors,12);
 for(const subset of (parts.length?parts:[[]])){
  s=slideFrom(pptx,8,true);
  rankSlide(pptx,s,{contractors:subset});
 }
 s=slideFrom(pptx,9,true);pieSlide(pptx,s,data.issues,'all',period);
 s=slideFrom(pptx,10,true);pieSlide(pptx,s,data.issues,'top',period);
 const contractorParts=chunk([...data.contractors].sort((a,b)=>b.issues.reduce((x,v)=>x+v.count,0)-a.issues.reduce((x,v)=>x+v.count,0)),4);
 for(let i=0;i<(contractorParts.length||1);i++){
  s=slideFrom(pptx,11,true);
  contractorSlide(pptx,s,contractorParts[i]||[],i+1,Math.max(1,contractorParts.length));
 }
 slideFrom(pptx,12);slideFrom(pptx,13);
 return pptx.write({outputType:'nodebuffer'});
}
module.exports={create,scoreData};
