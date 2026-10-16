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
 let visitsWithViolation=0,totalWeighted=0;
 for(const r of rows){
  const name=clean(r.contractor)||'مقاول غير محدد';
  if(!map.has(name))map.set(name,{name,count:0,scores:[],issues:new Map(),visitsWithViolation:0,weighted:0,highWeight:0});
  const c=map.get(name);c.count++;
  const month=String(r.date||'').slice(0,7);
  if(/^\d{4}-\d{2}$/.test(month)){
   if(!monthly.has(month))monthly.set(month,{month,count:0,scores:[],issueCount:0,visitsWithViolation:0});
   const m=monthly.get(month);m.count++;
   if(Number.isFinite(r.score))m.scores.push(r.score);
   m.issueCount+=(r.violations||[]).length;
   if((r.violations||[]).length)m.visitsWithViolation++;
  }
  if(Number.isFinite(r.score)){c.scores.push(r.score);points.push(r.score)}
  if((r.violations||[]).length){visitsWithViolation++;c.visitsWithViolation++}
  for(const v of r.violations||[]){
   const label=clean(v.label)||'مخالفة '+v.number,key=String(v.number);
   if(!issues.has(key))issues.set(key,{number:v.number,label,count:0});
   issues.get(key).count++;
   if(!c.issues.has(key))c.issues.set(key,{number:v.number,label,count:0});
   c.issues.get(key).count++;
   // Weights are the numeric item weights provided by Intellect, not a legal severity category.
   const w=[7,2,.5].includes(Number(v.weight))?Number(v.weight):0;
   c.weighted+=w;totalWeighted+=w;
   if(w===7)c.highWeight++;
  }
 }
 const contractors=[...map.values()].map(x=>({...x,score:avg(x.scores),
   violationCount:[...x.issues.values()].reduce((s,v)=>s+v.count,0),
   rate:x.count?100*[...x.issues.values()].reduce((s,v)=>s+v.count,0)/x.count:0,
   weightedRate:x.count?100*x.weighted/x.count:0,
   issues:[...x.issues.values()].sort((a,b)=>b.count-a.count||a.number-b.number)}))
   .sort((a,b)=>(b.score??-1)-(a.score??-1)||b.count-a.count);
 const outIssues=[...issues.values()].sort((a,b)=>b.count-a.count||a.number-b.number);
 return {contractors,issues:outIssues,avg:avg(points),valid:points.length,
  unscored:rows.length-points.length,visitsWithViolation,totalWeighted,
  weightedRate:rows.length?100*totalWeighted/rows.length:0,
  totalViolations:outIssues.reduce((s,x)=>s+x.count,0),
  monthly:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month))};
}
function slideFrom(pptx,index,cleanVersion=false){
 const slide=pptx.addSlide();slide.background={color:WHITE};
 slide._safetyTemplate={index,cleanVersion};
 const name=(cleanVersion?'clean-':'slide-')+imgNum(index)+'.jpg';
 const file=path.join(ASSETS,name);
 if(!fs.existsSync(file))throw new Error('قالب السلامة الأصلي مفقود: '+name);
 slide.addImage({path:file,x:0,y:0,w:W,h:H});
 // The template's "watch" button and play symbol are baked into the background image.
 // Make those exact visual regions clickable without changing the design.
 if(index===3&&!cleanVersion){
  const url='https://youtu.be/oCOgBIT7tWc?si=Uz4y0x7HeaejTpYp';
  for(const hit of [{x:8.98,y:5.41,w:1.41,h:.42},{x:3.55,y:3.70,w:1.10,h:1.10}]){
   slide.addShape(pptx.ShapeType.rect,{...hit,
    fill:{color:'FFFFFF',transparency:100},
    line:{color:'FFFFFF',transparency:100},
    hyperlink:{url,tooltip:'مشاهدة الفيديو التمهيدي على YouTube'}});
  }
 }
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

function reportPeriod(rows,meta){
 const months=[...new Set(rows.map(r=>String(r.date||'').slice(0,7)).filter(s=>/^\d{4}-\d{2}$/.test(s)))].sort();
 const span=months.length?(months[0]===months[months.length-1]?months[0]:months[0]+' إلى '+months[months.length-1]):'لا توجد تواريخ في النطاق';
 return {span,months};
}
function reportCover(pptx,rows,meta,data){
 const slide=pptx.addSlide();slide.background={color:WHITE};
 shape(pptx,slide,0,0,W,1.28,BLUE);shape(pptx,slide,0,1.26,W,.09,ORANGE);
 txt(slide,'شركة أبعاد الرؤية للاستشارات الهندسية',.82,.31,9.97,.37,
  {color:WHITE,fontSize:21,bold:true,align:'right'});
 const logo=path.join(ASSETS,'footer-logo.png');
 if(fs.existsSync(logo))slide.addImage({path:logo,x:.88,y:1.73,w:3.1,h:.49});
 txt(slide,'تقرير تقييم السلامة والصحة المهنية للمقاولين',
  .86,2.75,9.97,.78,{fontSize:29,color:BLUE,bold:true,align:'right'});
 txt(slide,'العقد الموحد للإشراف على خدمات شبكات الطاقة',
  1.02,3.72,9.78,.40,{fontSize:18,color:ORANGE,bold:true,align:'right'});
 shape(pptx,slide,.85,4.43,9.98,1.31,'F0F6FA','D9E5EF',true);
 const period=reportPeriod(rows,meta);
 txt(slide,'المشروع: '+clean(meta.city||'مكة')+'      |      نطاق البيانات: '+period.span,
  1.07,4.68,9.55,.33,{fontSize:15,color:BLUE,bold:true,align:'right'});
 txt(slide,(meta.general?'جميع بيانات المشروع':'البيانات حسب الفلاتر المختارة')+
  '      |      الفحوص: '+num(rows.length)+'      |      المقاولون: '+num(data.contractors.length),
  1.07,5.17,9.52,.30,{fontSize:13,color:'385973',align:'right'});
 txt(slide,'المصدر: ورقة Intellect الخاصة بالمشروع، تاريخ إصدار التقرير: '+new Date().toISOString().slice(0,10),
  1.0,6.86,9.75,.35,{fontSize:11,color:'4F738C',align:'right'});
 txt(slide,'تقرير تحليلي للفترة المحددة – وفق نطاق التصدير',
  1.0,7.38,9.74,.26,{fontSize:10.5,color:'67839A',align:'right'});
}
function reportAgenda(pptx,rows,meta){
 const s=pptx.addSlide();s.background={color:'F4F8FC'};
 shape(pptx,s,0,0,W,1.28,BLUE);shape(pptx,s,0,1.25,W,.07,ORANGE);
 txt(s,'محاور التقرير',.88,.35,9.97,.47,{fontSize:25,color:WHITE,bold:true,align:'right'});
 txt(s,'فهرس مطابق لأقسام التقرير الحالي',.92,.96,9.9,.24,{fontSize:11,color:'D6E8F5',align:'right'});
 const sections=[
  ['1','التعريف والسلامة','الغلاف، الفيديو التمهيدي، الشهادات ونطاق البيانات'],
  ['2','ملخص الأداء','الفحوص والدرجات الصالحة والمخالفات المسجلة'],
  ['3','تحليل المقاولين','الدرجات وعينات الفحص ومؤشرات المتابعة المرجحة'],
  ['4','المخالفات والاتجاهات','التوزيع الشهري وكافة البنود وأبرز المخالفات'],
  ['5','التوعية والإجراءات','أولويات التصحيح وإحاطة السلامة ومسؤوليات المتابعة'],
  ['6','التحقق والتحسين','دورة إغلاق الملاحظات ومؤشرات قياس التغير']
 ];
 sections.forEach((a,i)=>{
  const col=i%2,row=Math.floor(i/2),x=.78+col*5.21,y=1.75+row*1.62;
  shape(pptx,s,x,y,5.02,1.44,WHITE,'D7E3EF',true);
  shape(pptx,s,x+4.39,y+.16,.46,.46,i%2?ORANGE:BLUE,null,true);
  txt(s,a[0],x+4.42,y+.27,.40,.23,{fontSize:14,color:WHITE,bold:true,rtlMode:false});
  txt(s,a[1],x+.2,y+.18,4.05,.36,{fontSize:16,color:BLUE,bold:true,align:'right'});
  txt(s,a[2],x+.24,y+.74,4.5,.42,{fontSize:11.5,color:'4F6981',align:'right'});
 });
 txt(s,'تُحدّث مؤشرات التقرير تلقائيًا وفق بيانات Intellect وفلاتر التصدير.',
  .92,7.10,9.95,.31,{fontSize:11,color:BLUE,align:'right'});
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
   txt(s,label,x+.14,iy,cw-.78,three?.46:groups.length<=2?.55:.22,{fontSize:three?9.6:groups.length<=2?12.2:7.5,color:BLUE,align:'right',fit:'shrink',valign:'mid'});
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


const GUIDANCE_BLUE='123F68',GUIDANCE_TEAL='168D82',GUIDANCE_PAPER='F4F8FC';
const GUIDANCE_GRAY='526B82',GUIDANCE_WARN='C97929';
const shortLabel=(value,max=110)=>{
 const str=clean(value);
 return str.length>max?str.slice(0,max-1)+'…':str;
};
function guideFrame(pptx,meta,title,subtitle,tag){
 const slide=pptx.addSlide();
 slide.background={color:GUIDANCE_PAPER};
 shape(pptx,slide,0,0,W,1.43,GUIDANCE_BLUE);
 shape(pptx,slide,0,1.40,W,.055,ORANGE);
 txt(slide,title,.64,.36,10.35,.49,{fontSize:24,color:WHITE,bold:true,align:'right'});
 txt(slide,subtitle,.64,.95,10.35,.28,{fontSize:12,color:'DDEDF8',align:'right'});
 txt(slide,clean(meta.city||'المشروع')+'  |  '+clean(meta.period||'كامل الفترة'),.73,7.77,5.35,.23,{fontSize:10.2,color:GUIDANCE_GRAY,align:'right'});
 txt(slide,tag,6.64,7.77,4.34,.23,{fontSize:9.8,color:GUIDANCE_GRAY,align:'left'});
 return slide;
}
function guidePanel(pptx,s,x,y,w,h,title,value,secondary,accent=GUIDANCE_TEAL){
 shape(pptx,s,x,y,w,h,WHITE,'D8E5F0',true);
 shape(pptx,s,x+w-.08,y,.08,h,accent);
 txt(s,title,x+.16,y+.15,w-.42,.30,{fontSize:12.7,color:GUIDANCE_BLUE,align:'right',bold:true});
 txt(s,value,x+.17,y+.53,w-.43,.51,{fontSize:27,color:accent,align:'right',bold:true,rtlMode:false});
 txt(s,secondary,x+.17,y+1.12,w-.44,.39,{fontSize:10.4,color:GUIDANCE_GRAY,align:'right',fit:'shrink'});
}
function issueRecommendation(label){
 const t=clean(label);
 if(/تدريب|اجتماع ما قبل البدء|العمل الآمن|تقييم المخاطر|إحاطة/.test(t))
  return 'إحاطة سلامة قبل العمل بلغة يفهمها العاملون، وتوثيق الحضور ثم التحقق من الاستيعاب ميدانيًا.';
 if(/مظلة|الظل|حرارة|الحار|الإجهاد الحراري|شمس/.test(t))
  return 'توفير مظلات أو مناطق ظل ومياه شرب وفترات راحة مناسبة، والتحقق ميدانيًا من ضوابط الإجهاد الحراري.';
 if(/مياه الشرب|كمية كافية|مياه/.test(t))
  return 'توفير كميات كافية من مياه الشرب الآمنة لجميع العمال والتأكد من سهولة الوصول إليها طوال فترة العمل.';
 if(/حفر|حفريات|خندق|كابل|مرافق|ردم|تربة/.test(t))
  return 'مراجعة تصريح الحفر وتحديد الخدمات المدفونة وتدعيم الحفر قبل استئناف الأعمال.';
 if(/كهرب|عزل|تأريض|جهد|توصيل|مغذي/.test(t))
  return 'التحقق من العزل والتصريح ومن تنفيذ العمل بأفراد مخولين ووسائل حماية مناسبة.';
 if(/معدات|رافعة|آلي|سائق|قيادة|تشغيل/.test(t))
  return 'فحص المعدة وصلاحية المشغل ومسار الحركة ومنطقة العزل المحيطة.';
 if(/خوذة|سترة|حذاء|نظارة|قفاز|وقاية|حزام/.test(t))
  return 'فحص معدات الوقاية وتوفير المقاسات المناسبة والتأكد من استخدامها في الموقع.';
 if(/حريق|طفاي|إطفاء|مسعف|إسعاف/.test(t))
  return 'فحص التجهيزات والطوارئ وتوافر معدات الإسعاف والإطفاء وأفراد الاستجابة.';
 if(/تأهيل|تعليمات/.test(t))
  return 'التحقق من التأهيل المناسب وشرح التعليمات وتوثيق حضور التدريب وفهم متطلبات المهمة.';
 if(/لوح|حاجز|تحذير|مرور|عزل موقع/.test(t))
  return 'تحديد حدود العمل وتأمين الحواجز والإشارات ومسارات المشاة والمركبات.';
 return 'معاينة البند ميدانيًا، تحديد السبب الجذري، وتنفيذ الإجراء مع إثباتات قابلة للتحقق.';
}
function guideReading(pptx,data,rows,meta){
 const s=guideFrame(pptx,meta,'كيف نقرأ نتائج السلامة؟',
  'قراءة وصفية للأرقام الفعلية؛ تكرار المخالفة لا يعني عدد حوادث أو إصابات.','تحليل مستخرج من Intellect');
 const n=rows.length,withIssues=data.visitsWithViolation||0,per100=n?data.totalViolations/n*100:0;
 const cards=[
  ['الفحوص التي تضمنت مخالفة',num(withIssues),pct(n?withIssues/n*100:0)+' من الفحوص',GUIDANCE_WARN],
  ['مخالفات لكل 100 فحص',per100.toFixed(1),'مجموع بنود المخالفة ÷ عدد الفحوص × 100',GUIDANCE_BLUE],
  ['اكتمال بيانات التقييم',pct(n?data.valid/n*100:0),num(data.unscored)+' فحوص بلا درجة صالحة',GUIDANCE_TEAL]
 ];
 cards.forEach((c,i)=>guidePanel(pptx,s,.61+i*3.61,1.77,3.41,1.64,...c));
 txt(s,'البنود الأعلى تكرارًا في نطاق التقرير',.80,3.74,10.20,.32,{fontSize:17,bold:true,color:GUIDANCE_BLUE,align:'right'});
 const top=data.issues.slice(0,3);
 top.forEach((v,i)=>{
  const y=4.19+i*.93;
  shape(pptx,s,.74,y,10.18,.79,i%2===0?'E6F1F8':WHITE,'D9E7F0',true);
  txt(s,shortLabel(v.label,115),4.53,y+.13,6.06,.43,{fontSize:12.4,color:GUIDANCE_BLUE,bold:true,align:'right',fit:'shrink'});
  txt(s,num(v.count)+' مرة',2.56,y+.20,1.82,.28,{fontSize:13.5,color:GUIDANCE_WARN,bold:true,align:'center'});
  txt(s,pct(data.totalViolations?v.count/data.totalViolations*100:0),.97,y+.20,1.34,.29,
   {fontSize:14,color:GUIDANCE_TEAL,bold:true,rtlMode:false});
 });
 txt(s,'تفسير مهم: يمكن تسجيل أكثر من بند مخالف في الفحص نفسه، وقد تتكرر زيارات أمر العمل الواحد لمهام مختلفة.',
  .86,7.23,9.96,.29,{fontSize:10.5,color:GUIDANCE_GRAY,align:'right'});
}
function guidePriorityActions(pptx,data,meta){
 const s=guideFrame(pptx,meta,'أولويات الإجراءات التصحيحية',
  'التوصيات التالية مقترحة بناءً على أكثر بنود المخالفات تسجيلًا، وتخضع للتحقق الميداني.','نتائج البيانات + توصيات مهنية');
 const top=data.issues.slice(0,3);
 for(let i=0;i<3;i++){
  const issue=top[i],y=1.72+i*1.72;
  shape(pptx,s,.70,y,10.25,1.53,WHITE,'D8E6F0',true);
  shape(pptx,s,10.72,y,.19,1.53,[GUIDANCE_WARN,GUIDANCE_BLUE,GUIDANCE_TEAL][i]);
  if(issue){
   txt(s,'الأولوية '+(i+1)+'  |  '+num(issue.count)+' رصد',7.18,y+.12,3.30,.30,
       {fontSize:14,color:GUIDANCE_BLUE,bold:true,align:'right'});
   txt(s,shortLabel(issue.label,120),.99,y+.43,9.51,.45,
       {fontSize:12.4,color:'264A65',align:'right',bold:true,fit:'shrink'});
   txt(s,'الإجراء المقترح: '+issueRecommendation(issue.label),.99,y+.96,9.51,.40,
       {fontSize:12.1,color:GUIDANCE_GRAY,align:'right',fit:'shrink'});
  }else{
   txt(s,'لا توجد مخالفة إضافية ضمن البيانات المختارة.',1.0,y+.42,9.50,.43,{fontSize:14,color:GUIDANCE_GRAY});
  }
 }
 shape(pptx,s,.82,7.02,10.00,.44,'E7F0F6');
 txt(s,'تُعتمد الإجراءات النهائية وفق خطورة الموقع وإجراءات المشروع، وليس ترتيب العدد وحده.',
 .96,7.09,9.72,.27,{fontSize:10.7,color:GUIDANCE_BLUE,align:'right'});
}
function guideContractorFollowup(pptx,data,meta){
 const s=guideFrame(pptx,meta,'أين نركز المتابعة الميدانية؟',
  'فرز استرشادي وفق التكرار ووزن بند Intellect وحجم عينة الفحص، وليس تصنيفًا تعاقديًا.',
  'تحليل مستخرج من Intellect');
 const projectRate=data.weightedRate||0;
 const ordered=data.contractors.map(c=>{
  const tier=c.count<20?'عينة محدودة':c.highWeight>0&&c.weightedRate>projectRate?'أولوية أعلى':
   c.weightedRate>projectRate?'مراجعة مركزة':'متابعة دورية';
  return {...c,tier};
 }).sort((a,b)=>(b.count>=20?1:0)-(a.count>=20?1:0)||b.weightedRate-a.weightedRate||b.violationCount-a.violationCount).slice(0,5);
 shape(pptx,s,.75,1.74,10.13,.76,GUIDANCE_BLUE);
 const cols=[['المقاول',7.65,3.03],['فحوص',6.52,.99],['بنود / وزن 7',4.75,1.58],['نقاط مرجحة / 100',2.60,1.96],['المتابعة',.94,1.52]];
 cols.forEach(([name,x,w])=>txt(s,name,x,1.93,w,.40,{fontSize:10.1,bold:true,color:WHITE,align:'center'}));
 ordered.forEach((c,i)=>{
  const y=2.70+i*.76;
  shape(pptx,s,.75,y,10.13,.69,i%2===0?'E8F2F8':WHITE,'DDE8F1');
  txt(s,shortLabel(c.name,52),7.65,y+.10,3.03,.40,{fontSize:11.3,color:GUIDANCE_BLUE,bold:true,align:'right'});
  txt(s,num(c.count),6.52,y+.19,.99,.27,{fontSize:12,color:'315974',align:'center'});
  txt(s,num(c.violationCount)+' / '+num(c.highWeight),4.75,y+.18,1.58,.28,{fontSize:11.2,color:GUIDANCE_WARN,bold:true,align:'center'});
  txt(s,c.weightedRate.toFixed(1),2.60,y+.17,1.96,.29,{fontSize:12.5,color:GUIDANCE_BLUE,align:'center',rtlMode:false});
  txt(s,c.tier,.94,y+.16,1.52,.34,
    {fontSize:10.6,color:c.tier==='عينة محدودة'?'995C31':GUIDANCE_TEAL,align:'center',bold:true});
 });
 txt(s,'المعادلة: نقاط مرجحة لكل 100 فحص = مجموع أوزان البنود المخالفة (7 / 2 / 0.5) ÷ عدد الفحوص × 100.',
  .87,6.60,9.98,.39,{fontSize:10.6,color:GUIDANCE_BLUE,align:'right',fit:'shrink'});
 txt(s,'الأولوية مؤشّر فرز فقط؛ تُراجع الخطورة الميدانية والتكرار ونوع الأعمال. المقاول ذو العينة الصغيرة يحتاج تحققًا إضافيًا.',
  .87,7.11,9.98,.34,{fontSize:10.3,color:'8A5A2F',align:'right',fit:'shrink'});
}
function guideToolbox(pptx,meta,data){
 const s=guideFrame(pptx,meta,'إحاطة السلامة قبل بدء العمل',
  'قائمة تحقق عامة مع إبراز أكثر المخالفات الفعلية تكرارًا في الفترة المختارة.','توعية مهنية + أعداد من Intellect');
 const items=[
  ['01','تقييم مخاطر المهمة','مراجعة موقع العمل وتحديد الخدمات والمخاطر وتوزيع الأدوار قبل التنفيذ.'],
  ['02','التصاريح والعزل','التحقق من التصاريح والعزل الكهربائي بواسطة أشخاص مخولين حسب الإجراءات المعتمدة.'],
  ['03','الحفريات وحماية الموقع','تحديد المرافق المدفونة وفحص تدعيم الحفر والحواجز ومسارات المرور.'],
  ['04','معدات الوقاية','فحص الخوذة والسترة والأحذية ومعدات الوقاية الخاصة بطبيعة المهمة.'],
  ['05','الحرارة والطوارئ','توافر مياه الشرب والراحة المناسبة ونقاط الاتصال والإنقاذ والإسعاف.'],
  ['06','التواصل والتوقف الآمن','التأكد من فهم الفريق لخطة العمل ورفع المخاطر وإيقاف العمل غير الآمن وفق صلاحيات الموقع.']
 ];
 items.forEach((a,i)=>{
  const col=i%2,row=Math.floor(i/2),x=.76+col*5.15,y=1.74+row*1.73;
  shape(pptx,s,x,y,4.95,1.55,WHITE,'D6E4EF',true);
  shape(pptx,s,x+4.29,y+.17,.49,.50,i%2?GUIDANCE_TEAL:GUIDANCE_BLUE,null,true);
  txt(s,a[0],x+4.31,y+.26,.45,.22,{fontSize:12.8,color:WHITE,bold:true,rtlMode:false});
  txt(s,a[1],x+.18,y+.17,3.95,.33,{fontSize:14.2,bold:true,color:GUIDANCE_BLUE,align:'right'});
  txt(s,a[2],x+.24,y+.66,4.45,.60,{fontSize:11.75,color:GUIDANCE_GRAY,align:'right',fit:'shrink'});
 });
 const priority=(data.issues||[]).slice(0,2).map(v=>shortLabel(v.label,36)+' ('+num(v.count)+')').join(' | ');
 txt(s,priority?'محور إحاطة موجّه بحسب الرصد: '+priority:'لا توجد مخالفات حالية لتخصيص الإحاطة.',
  .93,6.92,9.90,.30,{fontSize:10.6,color:GUIDANCE_BLUE,align:'right',fit:'shrink'});
 txt(s,'تنبيه: لا تحل هذه الشريحة محل تقييم المخاطر الخاص بالمهمة أو تعليمات المالك والمقاول المعتمدة.',
  .93,7.29,9.90,.30,{fontSize:10.3,color:'995C31',align:'right'});
}
function guideClosure(pptx,meta){
 const s=guideFrame(pptx,meta,'دورة معالجة الملاحظة وإغلاقها',
  'سير عمل مقترح لربط كل مخالفة بمسؤول وإجراء ودليل إغلاق.','إجراء متابعة مقترح – غير تعاقدي');
 const steps=[
  ['1','رصد وتوثيق','معرّف الملاحظة / أمر العمل / التاريخ / الموقع','مهندس السلامة'],
  ['2','تقييم الخطورة','درجة الأولوية / الضبط الفوري / دليل الحالة','مسؤول الموقع'],
  ['3','خطة تصحيح','المقاول / مسؤول الإجراء / الموعد المستهدف','المقاول'],
  ['4','تحقق بالإثبات','صور قبل وبعد / تاريخ إعادة الفحص / النتيجة','الاستشاري / السلامة'],
  ['5','اعتماد الإغلاق','حالة الإغلاق / تاريخ الاعتماد / إعادة المعالجة','المخول بالاعتماد']
 ];
 steps.forEach((step,i)=>{
  const y=1.71+i*1.05;
  shape(pptx,s,.85,y,9.98,.88,i%2===0?WHITE:'E7F0F7','D5E4EE',true);
  shape(pptx,s,9.95,y+.15,.56,.55,i===4?GUIDANCE_TEAL:GUIDANCE_BLUE,null,true);
  txt(s,step[0],9.97,y+.28,.52,.24,{fontSize:13.5,color:WHITE,bold:true,rtlMode:false});
  txt(s,step[1],7.52,y+.16,2.24,.29,{fontSize:13.5,color:GUIDANCE_BLUE,bold:true,align:'right'});
  txt(s,step[2],3.22,y+.16,4.05,.48,{fontSize:11.5,color:GUIDANCE_GRAY,align:'right',fit:'shrink'});
  txt(s,step[3],1.05,y+.24,2.05,.31,{fontSize:10.9,color:GUIDANCE_WARN,align:'center'});
 });
 txt(s,'عند وجود خطر وشيك: يُطبق إجراء السيطرة الفوري وفق متطلبات السلامة وصلاحيات المشروع قبل متابعة التسلسل.',
  .98,7.22,9.77,.35,{fontSize:11.1,color:'995C31',align:'right'});
}
function guideMeasurement(pptx,data,rows,meta){
 const s=guideFrame(pptx,meta,'مؤشرات قياس التحسن في المتابعة القادمة',
  'مقارنة وصفية بين أحدث شهرين ظاهرين ضمن الفلاتر، دون افتراض تساوي حجم العمل أو نوعه.',
  'مقاييس من البيانات + هدف مقترح');
 const n=rows.length,visits=data.visitsWithViolation||0,issueRate=n?visits/n*100:0,per100=n?data.totalViolations/n*100:0;
 const latest=data.monthly.filter(x=>x.count>0).slice(-2);
 const hasComparison=latest.length===2;
 const entries=[
  ['الفحوص بمخالفة',pct(issueRate),'نسبة الفحوص التي تضمنت بندًا واحدًا على الأقل'],
  ['بنود مخالفة / 100 فحص',per100.toFixed(1),'عدد البنود المخالفة، وليس عدد الحوادث'],
  ['متوسط الدرجة الصالحة',pct(data.avg),'متوسط '+num(data.valid)+' فحص بدرجة صالحة'],
  ['اكتمال التقييم',pct(n?100*data.valid/n:0),'هدف مقترح: تسجيل درجة لكل فحص']
 ];
 entries.forEach((e,i)=>{
  const x=.85+(i%2)*5.10,y=1.73+Math.floor(i/2)*1.51;
  shape(pptx,s,x,y,4.90,1.38,WHITE,'D8E5F0',true);
  txt(s,e[0],x+.20,y+.13,4.43,.28,{fontSize:12.5,color:GUIDANCE_BLUE,bold:true,align:'right'});
  txt(s,e[1],x+.20,y+.49,2.12,.39,{fontSize:22.0,color:i===1?GUIDANCE_WARN:GUIDANCE_TEAL,bold:true,rtlMode:false});
  txt(s,e[2],x+.20,y+1.05,4.44,.22,{fontSize:9.9,color:GUIDANCE_GRAY,align:'right',fit:'shrink'});
 });
 shape(pptx,s,.86,5.00,9.96,1.62,'E2EFF7','D3E4EF',true);
 if(hasComparison){
  const [prev,curr]=latest,pr=100*prev.visitsWithViolation/prev.count,cr=100*curr.visitsWithViolation/curr.count,
        diff=cr-pr;
  txt(s,'الفحوص بمخالفة: '+prev.month+' ('+pct(pr)+') ← '+curr.month+' ('+pct(cr)+')',
   1.02,5.22,9.43,.41,{fontSize:15.3,color:GUIDANCE_BLUE,bold:true,align:'right'});
  txt(s,'التغير: '+(diff>0?'+':'')+diff.toFixed(1)+' نقطة مئوية | عينتا الفحص: '+num(prev.count)+' ثم '+num(curr.count),
   1.05,5.85,9.32,.29,{fontSize:11.6,color:GUIDANCE_GRAY,align:'right'});
 }else{
  txt(s,'المقارنة الشهرية غير متاحة: يلزم شهران على الأقل ضمن البيانات المحددة.',
   1.02,5.39,9.48,.54,{fontSize:13.0,color:GUIDANCE_BLUE,bold:true,align:'right'});
 }
 txt(s,'هدف مقترح لا يمثل اعتمادًا تعاقديًا: استكمال درجات الفحوص وتحسين مؤشرات المخالفات عبر فترات متماثلة.',
  .92,6.88,9.85,.32,{fontSize:10.7,color:GUIDANCE_BLUE,align:'right'});
 txt(s,'لا يمكن احتساب المتأخر والمغلق من Intellect وحدها؛ تتطلب المتابعة سجل إجراءات بإثباتات وتواريخ.',
  .92,7.30,9.85,.32,{fontSize:10.4,color:'995C31',align:'right'});
}
function appendGuidance(pptx,data,rows,meta){
 guideReading(pptx,data,rows,meta);
 guidePriorityActions(pptx,data,meta);
 guideContractorFollowup(pptx,data,meta);
 guideToolbox(pptx,meta,data);
 guideClosure(pptx,meta);
 guideMeasurement(pptx,data,rows,meta);
}

// Add PDC beside SEC and Vision Dimensions on every PowerPoint page.
// Consistent triple-brand treatment. Template photos already embed SEC and Vision;
// add only the transparent PDC mark beside them. Dynamic pages get a compact,
// transparent white-on-navy group in the free left header area (not over titles).
function applySafetyPageLogos(pptx){
 const pair=path.join(ASSETS,'footer-logo.png');
 const pairWhite=path.join(ASSETS,'brand-pair-white.png');
 const pdcClear=path.join(ASSETS,'pdc-logo-clear.png');
 const pdcWhite=path.join(ASSETS,'pdc-logo-white.png');
 for(const asset of [pair,pairWhite,pdcClear,pdcWhite]){
  if(!fs.existsSync(asset))throw Error('SAFETY_BRANDING_ASSET_MISSING_'+path.basename(asset));
 }
 const photoPositions={
  1:{x:3.85,y:1.48,w:1.13,h:.43},
  3:{x:3.83,y:6.78,w:1.14,h:.43},
  5:{x:3.82,y:6.28,w:1.16,h:.43},
  6:{x:10.55,y:5.70,w:1.06,h:.43},
  7:{x:4.51,y:6.78,w:1.13,h:.43},
  8:{x:4.51,y:6.78,w:1.13,h:.43},
  9:{x:4.51,y:6.78,w:1.13,h:.43},
  10:{x:4.51,y:6.78,w:1.13,h:.43},
  11:{x:4.51,y:6.78,w:1.13,h:.43},
  12:{x:10.55,y:6.34,w:1.06,h:.43},
  13:{x:9.44,y:3.44,w:1.11,h:.43}
 };
 for(const slide of pptx._slides){
  const index=slide._safetyTemplate?.index;
  if(index===2){
   // Original invocation page has no brand marks; group all three on its footer.
   slide.addImage({path:pair,x:.76,y:7.12,w:2.67,h:.48});
   slide.addImage({path:pdcClear,x:3.56,y:7.12,w:1.05,h:.48});
  }else if(index){
   const at=photoPositions[index];
   if(!at)throw Error('UNKNOWN_SAFETY_TEMPLATE_'+index);
   slide.addImage({path:index===13?pdcWhite:pdcClear,...at});
  }else{
   // Avoid the original large opaque block that obscured headings.
   slide.addImage({path:pairWhite,x:.40,y:.44,w:2.19,h:.30});
   slide.addImage({path:pdcWhite,x:2.72,y:.39,w:.88,h:.40});
  }
 }
}
async function create(rows,meta={}){
 const pptx=new pptxgen();
 pptx.defineLayout({name:'SAFETY_A4_LANDSCAPE',width:W,height:H});
 pptx.layout='SAFETY_A4_LANDSCAPE';pptx.author='Vision Dimensions Engineering Consultancy';
 pptx.subject='Contractor Safety evaluation from isolated Intellect source';
 pptx.title='تقييم السلامة للمقاولين';pptx.lang='ar-SA';pptx.company='Vision Dimensions';
 const data=scoreData(rows),period=meta.general?'كامل الفترة':clean(meta.period)||'كامل المدة';
 // Preserve the approved cover exactly as supplied; do not replace it with a generated cover.
 slideFrom(pptx,1);
 slideFrom(pptx,2);
 slideFrom(pptx,3);
 reportAgenda(pptx,rows,{...meta,period});
 slideFrom(pptx,5);
 slideFrom(pptx,6);
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
 appendGuidance(pptx,data,rows,{...meta,period});
 slideFrom(pptx,12);slideFrom(pptx,13);
 applySafetyPageLogos(pptx);
 return pptx.write({outputType:'nodebuffer'});
}
module.exports={create,scoreData};
