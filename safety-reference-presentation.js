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
 const map=new Map(),issues=new Map(),points=[],monthly=new Map();
 let visitsWithViolation=0;
 for(const r of rows){
  const name=clean(r.contractor)||'مقاول غير محدد';
  if(!map.has(name))map.set(name,{name,count:0,scores:[],issues:new Map(),visitsWithViolation:0});
  const c=map.get(name);c.count++;
  const month=String(r.date||'').slice(0,7);
  if(/^\d{4}-\d{2}$/.test(month)){
   if(!monthly.has(month))monthly.set(month,{month,count:0,scores:[]});
   const m=monthly.get(month);m.count++;
   if(Number.isFinite(r.score))m.scores.push(r.score);
  }
  if(Number.isFinite(r.score)){c.scores.push(r.score);points.push(r.score)}
  if((r.violations||[]).length){visitsWithViolation++;c.visitsWithViolation++}
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
 const outIssues=[...issues.values()].sort((a,b)=>b.count-a.count||a.number-b.number);
 return {contractors,issues:outIssues,avg:avg(points),valid:points.length,
  unscored:rows.length-points.length,visitsWithViolation,
  totalViolations:outIssues.reduce((s,x)=>s+x.count,0),
  monthly:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month))};
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

function summarySlide(pptx,rows,meta,data){
 const s=pptx.addSlide();s.background={color:'F4F8FC'};
 shape(pptx,s,0,0,W,1.26,BLUE);
 shape(pptx,s,0,1.23,W,.07,ORANGE);
 txt(s,'الملخص التنفيذي لتقييم السلامة',2.1,.30,7.6,.45,{fontSize:23,color:WHITE,bold:true});
 txt(s,'المشروع: '+clean(meta.city||'مكة')+'    |    '+(meta.general?'جميع البيانات':'حسب الفلاتر المختارة'),.9,.86,9.95,.23,{fontSize:12,color:'DFECFC'});
 const cards=[
  ['عمليات الفحص',num(rows.length),BLUE],
  ['المقاولون',num(data.contractors.length),ORANGE],
  ['متوسط الدرجات',pct(data.avg),'148B81'],
  ['مخالفات البنود',num(data.totalViolations),'BD4E4E'],
  ['درجات صالحة',num(data.valid),'416C9B'],
  ['بلا درجات صالحة',num(data.unscored),'99555A']
 ];
 for(let i=0;i<cards.length;i++){
  const [label,value,accent]=cards[i],col=i%3,row=Math.floor(i/3);
  const x=.75+col*3.69,y=1.64+row*1.35;
  shape(pptx,s,x,y,3.43,1.10,WHITE,'D6E4F0',true);
  shape(pptx,s,x,y,.085,1.10,accent);
  txt(s,label,x+.24,y+.14,2.93,.28,{fontSize:13,color:BLUE,bold:true});
  txt(s,value,x+.24,y+.48,2.91,.39,{fontSize:27,color:accent,bold:true,rtlMode:false});
 }
 const top=data.contractors.slice().sort((a,b)=>b.issues.reduce((z,x)=>z+x.count,0)-a.issues.reduce((z,x)=>z+x.count,0)).slice(0,3);
 txt(s,'المقاولون الأعلى في مخالفات البنود',1.06,4.54,9.67,.32,{fontSize:16,color:BLUE,bold:true});
 top.forEach((c,i)=>{
  const violations=c.issues.reduce((sum,v)=>sum+v.count,0);
  shape(pptx,s,1.04,4.95+i*.56,9.69,.45,i%2===0?'EAF3FA':'F7FAFD');
  txt(s,c.name,6.4,5.03+i*.56,4.13,.22,{fontSize:12,color:BLUE,bold:true,align:'right'});
  txt(s,num(violations)+' مخالفة',3.82,5.03+i*.56,2.18,.20,{fontSize:11,color:'C86424'});
  txt(s,pct(data.totalViolations?violations/data.totalViolations*100:0)+' من الإجمالي',1.12,5.03+i*.56,2.2,.20,{fontSize:11,color:'3D647E'});
 });
 txt(s,'المصدر: ورقة Intellect الخاصة بالمشروع. المؤشرات من البيانات المفلترة فقط؛ الشرائح التعريفية الثابتة من القالب المرجعي.',.68,7.49,10.30,.33,{fontSize:9,color:'59758C'});
 txt(s,'الفترة: '+clean(meta.period||'كامل المدة'),.70,7.05,10.28,.26,{fontSize:11,color:BLUE});
 return s;
}
function rankSlide(pptx,s,data,period,index,total){
 const xs=data.contractors;
 shape(pptx,s,1.08,1.36,9.48,5.64,WHITE,'DAE5EE');
 titleMonth(pptx,s,'تقييم المقاولين – '+index+' / '+total,period);
 txt(s,'متوسط الدرجات (%)  ·  حجم عينة الفحوص ذات درجات صالحة',2.16,1.75,7.20,.22,{fontSize:10.5,color:'506E86'});
 if(!xs.length){txt(s,'لا توجد درجات صالحة للفترة المحددة',2.1,3.3,7.5,.6,{fontSize:16});return}
 const maxWidth=4.25;
 xs.forEach((c,i)=>{
  const y=2.12+i*.63,score=Math.max(0,Math.min(100,c.score??0));
  shape(pptx,s,1.44,y+.34,maxWidth,.12,'E3EEF6');
  if(score>0)shape(pptx,s,1.44,y+.34,maxWidth*score/100,.12,score<90?'C8604E':score<95?'E5943B':'248E83');
  txt(s,pct(c.score),1.37,y+.04,1.08,.27,{fontSize:13.1,bold:true,color:score<90?'B84435':'174B78',rtlMode:false});
  txt(s,c.name,5.92,y+.02,4.2,.28,{fontSize:13,color:BLUE,bold:true,align:'right',fit:'shrink'});
  txt(s,num(c.scores.length)+' فحص بدرجة',5.92,y+.30,4.0,.19,{fontSize:10,color:'64798C',align:'right'});
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

function pieSlide(pptx,s,selected,mode,period,serial,totalPages,grandTotal){
 const isTop=mode==='top',title=isTop?'أكبر خمس مخالفات':'توزيع أنواع المخالفات';
 titleMonth(pptx,s,title+(totalPages>1?' ('+serial+' / '+totalPages+')':''),period);
 shape(pptx,s,1.05,1.68,9.57,5.33,WHITE,'DAE5EE');
 txt(s,'النسبة من إجمالي جميع المخالفات المسجلة ('+num(grandTotal)+')، لا من مجموع البنود المعروضة',1.33,1.79,8.91,.27,{fontSize:10.3,color:'446B86',bold:true});
 const peak=Math.max(1,...selected.map(x=>x.count));
 selected.forEach((v,i)=>{
  const y=2.13+i*.90;
  if(i%2===0)shape(pptx,s,1.30,y,9.07,.80,'F0F6FB');
  const label=String(v.number)+' – '+clean(v.label).replace(/^\d{1,2}\s*[-–:.)]\s*/,'');
  txt(s,label,4.35,y+.06,5.80,.55,{fontSize:11.3,color:BLUE,bold:true,align:'right',fit:'shrink',valign:'mid'});
  txt(s,num(v.count)+' مرة',2.75,y+.16,1.42,.24,{fontSize:11,color:'B76D24',rtlMode:false});
  txt(s,pct(grandTotal?v.count/grandTotal*100:0),1.36,y+.16,1.32,.24,{fontSize:11,color:'446B86',bold:true,rtlMode:false});
  const w=6.2,fromX=3.95;
  shape(pptx,s,fromX,y+.70,w,.08,'D8E8F2');
  if(v.count)shape(pptx,s,fromX,y+.70,w*v.count/peak,.08,PIE[i%PIE.length]);
 });
 if(!selected.length)txt(s,'لا توجد مخالفات في الفترة المحددة',2.2,3.5,7.2,.6,{fontSize:16});
}
function monthlySlide(pptx,s,items,period,serial,totalPages){
 titleMonth(pptx,s,'اتجاه الفحص الشهري ('+serial+' / '+totalPages+')',period);
 shape(pptx,s,1.07,1.68,9.56,5.34,WHITE,'DBE5F0');
 txt(s,'عدد الفحوص، ومتوسط الدرجات الصالحة بكل شهر',2.5,1.80,7.28,.25,{fontSize:11,color:'466D85'});
 const max=Math.max(1,...items.map(x=>x.count));
 items.forEach((m,i)=>{
  const y=2.15+i*.74;
  txt(s,m.month,8.5,y+.04,1.43,.26,{fontSize:12.2,color:BLUE,rtlMode:false,bold:true});
  txt(s,num(m.count)+' فحص',6.65,y+.04,1.66,.26,{fontSize:11.2,color:'B66F24'});
  txt(s,'متوسط '+pct(avg(m.scores)),1.32,y+.04,2.25,.26,{fontSize:11,color:'3A6A82'});
  shape(pptx,s,3.76,y+.14,2.68,.13,'E0EBF4');
  if(m.count)shape(pptx,s,3.76,y+.14,2.68*m.count/max,.13,'4F96CF');
  txt(s,num(m.scores.length)+' بدرجة صالحة',6.65,y+.34,3.18,.18,{fontSize:9.6,color:'758B9A'});
 });
 if(!items.length)txt(s,'لا توجد بيانات شهرية',3,3.4,5,.5,{fontSize:16});
}

function contractorSlide(pptx,s,groups,serial,total){
 shape(pptx,s,.70,1.81,10.28,5.47,WHITE,'CEDDE8');
 const three=groups.length===3;
 const cols=three?3:2,rowsCount=three?1:(groups.length<=2?1:2);
 const cw=10.12/cols,ch=5.20/rowsCount;
 groups.forEach((c,i)=>{
  const col=i%cols,row=Math.floor(i/cols);
  const x=.79+col*cw,y=1.89+row*ch;
  shape(pptx,s,x,y,cw-.10,ch-.12,i%2===0?'F4F8FC':'EDF5FB','DCE8F2');
  txt(s,c.name,x+.16,y+.12,cw-.42,.32,{fontSize:three?12.8:12.0,bold:true,color:BLUE,align:'right',fit:'shrink'});
  const totalViol=c.issues.reduce((total,v)=>total+v.count,0);
  txt(s,num(c.count)+' فحص | '+num(totalViol)+' مخالفة',x+.16,y+.49,cw-.42,.20,{fontSize:9.6,color:'A55A29',align:'right'});
  const selected=c.issues.slice(0,5),peak=Math.max(1,...selected.map(v=>v.count));
  if(!selected.length){txt(s,'لا توجد مخالفات مسجلة',x+.38,y+1.02,cw-.75,.38,{fontSize:12.5,color:'4B7D8A'});return}
  const gap=three?.67:groups.length<=2?.79:.36;
  selected.forEach((issue,k)=>{
   const iy=y+(three?.98:groups.length<=2?1.01:.83)+k*gap;
   const label=String(issue.number)+' – '+clean(issue.label).replace(/^\d{1,2}\s*[-–:.)]\s*/,'');
   txt(s,label,x+.14,iy,cw-.78,three?.46:groups.length<=2?.55:.22,{fontSize:three?9.6:groups.length<=2?11.3:7.5,color:BLUE,align:'right',fit:'shrink',valign:'mid'});
   txt(s,num(issue.count),x+cw-.61,iy+(three?.10:groups.length<=2?.20:.02),.40,.20,{fontSize:three?10.2:groups.length<=2?11.1:8.3,color:'AB6528',bold:true,rtlMode:false});
   const trackW=cw-.40;
   shape(pptx,s,x+.14,iy+(three?.51:groups.length<=2?.64:.25),trackW,.065,'DDE9F1');
   shape(pptx,s,x+.14,iy+(three?.51:groups.length<=2?.64:.25),trackW*issue.count/peak,.065,PIE[k%PIE.length]);
  });
 });
 const footer=path.join(ASSETS,'footer-logo.png');
 if(fs.existsSync(footer))s.addImage({path:footer,x:.81,y:7.02,w:3.00,h:.39});
 txt(s,'أكثر 5 بنود لكل مقاول – صفحة '+serial+' / '+total,4.25,7.39,5.80,.22,{fontSize:10.2,color:BLUE,bold:true});
}

async function create(rows,meta={}){
 const pptx=new pptxgen();
 pptx.defineLayout({name:'SAFETY_A4_LANDSCAPE',width:W,height:H});
 pptx.layout='SAFETY_A4_LANDSCAPE';pptx.author='Vision Dimensions Engineering Consultancy';
 pptx.subject='Contractor Safety evaluation from isolated Intellect source';
 pptx.title='تقييم السلامة للمقاولين';pptx.lang='ar-SA';pptx.company='Vision Dimensions';
 const data=scoreData(rows),period=meta.general?'كامل الفترة':clean(meta.period)||'كامل المدة';
 for(let page=1;page<=6;page++)slideFrom(pptx,page);
 summarySlide(pptx,rows,{...meta,period},data);
 let s=slideFrom(pptx,7,true);noteSlide(pptx,s,data);
 const ranks=chunk(data.contractors,7);
 for(let i=0;i<(ranks.length||1);i++){
  s=slideFrom(pptx,8,true);
  rankSlide(pptx,s,{contractors:ranks[i]||[]},period,i+1,Math.max(1,ranks.length));
 }
 const months=chunk(data.monthly,6);
 for(let i=0;i<(months.length||1);i++){
  s=slideFrom(pptx,8,true);
  monthlySlide(pptx,s,months[i]||[],period,i+1,Math.max(1,months.length));
 }
 const allViol=data.issues.filter(v=>v.count>0);
 const grouped=chunk(allViol,5);
 for(let i=0;i<(grouped.length||1);i++){
  s=slideFrom(pptx,9,true);
  pieSlide(pptx,s,grouped[i]||[],'all',period,i+1,Math.max(1,grouped.length),data.totalViolations);
 }
 s=slideFrom(pptx,10,true);
 pieSlide(pptx,s,allViol.slice(0,5),'top',period,1,1,data.totalViolations);
 const orderedContractors=data.contractors.slice().sort((a,b)=>b.issues.reduce((x,v)=>x+v.count,0)-a.issues.reduce((x,v)=>x+v.count,0));
 const contractorGroups=[];
 for(let i=0;i<orderedContractors.length;){const left=orderedContractors.length-i,count=left===3?3:Math.min(2,left);contractorGroups.push(orderedContractors.slice(i,i+count));i+=count;}
 for(let i=0;i<(contractorGroups.length||1);i++){
  s=slideFrom(pptx,11,true);
  contractorSlide(pptx,s,contractorGroups[i]||[],i+1,Math.max(1,contractorGroups.length));
 }
 slideFrom(pptx,12);slideFrom(pptx,13);
 return pptx.write({outputType:'nodebuffer'});
}
module.exports={create,scoreData};
