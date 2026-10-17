'use strict';
const fs=require('fs'),path=require('path'),pptxgen=require('pptxgenjs');
const NAVY='082D4D',BLUE='145B94',ORANGE='F39132',TEAL='16A299',RED='CF5064',SLATE='42617A',PAPER='F3F7FB',WHITE='FFFFFF';
const COLORS=[ORANGE,BLUE,TEAL,'7867D3',RED,'5A8F69','B78139','2C70B6'];
const S={W:13.333,H:7.5};
const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const safeNum=v=>Number.isFinite(Number(v))?Number(v):0;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const pct=n=>n===null?'—':Number(n).toFixed(1)+'%';
const comm=n=>Number(n||0).toLocaleString('en-US');
function metrics(rows){
 const groups=new Map(),issues=new Map(),monthly=new Map(),scores=[],weights={a:0,b:0,c:0};
 let total=0;
 for(const r of rows){
  const name=clean(r.contractor)||'غير محدد';
  if(!groups.has(name))groups.set(name,{name,inspections:0,scores:[],violations:0,issues:new Map()});
  const c=groups.get(name);c.inspections++;
  if(Number.isFinite(r.score)){c.scores.push(r.score);scores.push(r.score)}
  const month=String(r.date||'').slice(0,7);
  if(/^\d{4}-\d{2}$/.test(month)){
   if(!monthly.has(month))monthly.set(month,{month,count:0,scores:[]});
   const t=monthly.get(month);t.count++;if(Number.isFinite(r.score))t.scores.push(r.score);
  }
  for(const v of r.violations||[]){
   const key=String(v.number);
   const item=issues.get(key)||{key,label:clean(v.label)||'مخالفة '+key,count:0,weight:safeNum(v.weight)};
   item.count++;issues.set(key,item);
   const own=c.issues.get(key)||{...item,count:0};own.count++;c.issues.set(key,own);
   c.violations++;total++;
   if(v.weight===7)weights.a++;else if(v.weight===2)weights.b++;else weights.c++;
  }
 }
 const rank=[...groups.values()].map(x=>({...x,valid:x.scores.length,score:avg(x.scores),top:[...x.issues.values()].sort((a,b)=>b.count-a.count).slice(0,4)}))
  .sort((a,b)=>(b.score??-1)-(a.score??-1)||b.inspections-a.inspections);
 return {rank,issues:[...issues.values()].sort((a,b)=>b.count-a.count),months:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)).slice(-12),scores,score:avg(scores),total,weights};
}
function filter(rows,params){
 const sel=params&&typeof params==='object'?params:{};
 const asSet=(key)=>Array.isArray(sel[key])&&sel[key].length?new Set(sel[key].slice(0,300).map(clean)):null;
 const contractors=asSet('contractors'),engineers=asSet('engineers'),workOrders=asSet('workOrders'),violations=asSet('violations');
 const from=/^\d{4}-\d{2}-\d{2}$/.test(sel.from||'')?sel.from:'';
 const to=/^\d{4}-\d{2}-\d{2}$/.test(sel.to||'')?sel.to:'';
 const q=clean(sel.query).toLowerCase().slice(0,120),severity=['a','b','c'].includes(sel.severity)?sel.severity:'';
 return rows.filter(r=>{
  if(contractors&&!contractors.has(r.contractor))return false;
  if(engineers&&!engineers.has(r.engineer))return false;
  if(workOrders&&!workOrders.has(r.workOrder))return false;
  if(violations&&!(r.violations||[]).some(v=>violations.has(String(v.number))))return false;
  if(from&&(!r.date||r.date<from))return false;
  if(to&&(!r.date||r.date>to))return false;
  if(severity&&!r[severity])return false;
  if(q&&!clean([r.contractor,r.engineer,r.workOrder,...(r.violations||[]).map(v=>v.label)].join(' ')).toLowerCase().includes(q))return false;
  return true;
 });
}
function rec(label){
 if(/مياه|شرب/.test(label))return 'التحقق من توفير مياه الشرب الكافية لجميع العاملين.';
 if(/مظلة|حرار/.test(label))return 'متابعة وسائل الوقاية من الإجهاد الحراري ومناطق الراحة.';
 if(/تعميد|تأهيل|بطاقة/.test(label))return 'التحقق من بطاقات التأهيل والتعميد قبل بدء العمل.';
 if(/تصريح/.test(label))return 'مراجعة تصاريح العمل والتأكد من سريانها.';
 return 'متابعة إجراءات المعالجة والتوعية الميدانية حول هذا البند.';
}
function addText(slide,value,x,y,w,h,size=14,color=NAVY,opt={}){
 slide.addText(String(value??''),{x,y,w,h,fontFace:'Arial',fontSize:size,color,margin:0,breakLine:false,rtlMode:true,align:'right',valign:'mid',...opt});
}
function rect(pptx,slide,x,y,w,h,fill,rad=.12,lineColor=null){
 slide.addShape(rad?pptx.ShapeType.roundRect:pptx.ShapeType.rect,{x,y,w,h,rectRadius:rad,radius:rad,fill:{color:fill},line:{color:lineColor||fill},radius:rad});
}
function line(pptx,slide,x1,y1,x2,y2,c,width=1){
 slide.addShape(pptx.ShapeType.line,{x:x1,y:y1,w:x2-x1,h:y2-y1,line:{color:c,width}});
}
function header(pptx,title,subtitle,section){
 const s=pptx.addSlide();s.background={color:PAPER};
 rect(pptx,s,0,0,S.W,1.25,NAVY,0);
 rect(pptx,s,0,1.19,S.W,.08,ORANGE,0);
 addText(s,section.toUpperCase(),.62,.19,5.0,.22,11,'FFB36E',{align:'left',rtlMode:false,bold:true,charSpacing:1});
 addText(s,title,5.55,.22,7.1,.47,26,WHITE,{bold:true});
 addText(s,subtitle,4.6,.78,8.06,.25,11,'D3E7F7');
 rect(pptx,s,0,7.13,S.W,.37,'E3EDF5',0);
 addText(s,'VISION DIMENSIONS  •  SAFETY & QUALITY  •  INTELLECT',.65,7.20,7.6,.15,8,'56748A',{align:'left',rtlMode:false});
 return s;
}
function box(pptx,slide,x,y,w,h){rect(pptx,slide,x,y,w,h,WHITE,.12,'D8E4F0')}
function bar(pptx,slide,label,value,max,x,y,w,color,description='',fs=12){
 addText(slide,label,x,y,w*.66,.24,fs,NAVY,{bold:true,fit:'shrink'});
 addText(slide,description||comm(value),x+w*.69,y,w*.31,.23,10,ORANGE,{bold:true});
 rect(pptx,slide,x,y+.31,w,.09,'E4EEF5',.03);
 if(value>0)rect(pptx,slide,x,y+.31,Math.max(.03,w*value/Math.max(1,max)),.09,color,.02);
}
function chunks(arr,n){return Array.from({length:Math.ceil(arr.length/n)},(_,i)=>arr.slice(i*n,(i+1)*n))}
function kpi(pptx,s,x,label,value,accent,caption){
 box(pptx,s,x,1.64,2.93,1.44);rect(pptx,s,x,1.64,2.93,.10,accent,0);
 addText(s,label,x+.15,1.89,2.6,.25,14,SLATE,{bold:true});
 addText(s,value,x+.15,2.16,2.6,.43,29,NAVY,{bold:true});
 addText(s,caption,x+.15,2.66,2.6,.20,10,SLATE);
}
function tableRow(pptx,s,row,y,cols,alt){
 if(alt)rect(pptx,s,.73,y,11.9,.42,'ECF4FA',0);
 for(let i=0;i<cols.length;i++)addText(s,clean(row[i]),cols[i].x,y+.04,cols[i].w,.28,cols[i].size||12,cols[i].color||NAVY,{bold:i===0});
}
async function create(rows,meta={}){
 const pptx=new pptxgen();pptx.layout='LAYOUT_WIDE';pptx.author='Vision Dimensions Engineering Consultancy';pptx.subject='Contractor Safety Performance';pptx.title='تقييم السلامة للمقاولين';pptx.lang='ar-SA';
 const m=metrics(rows),city=meta.city||'مكة',period=meta.general?'كامل الفترة':meta.period||'كامل المدة';
 let s=pptx.addSlide();s.background={color:NAVY};
 rect(pptx,s,0,0,13.333,7.5,NAVY,0);
 rect(pptx,s,0,0,4.4,7.5,BLUE,0);
 rect(pptx,s,0,0,1.15,7.5,ORANGE,0);
 s.addShape(pptx.ShapeType.ellipse,{x:-1.1,y:1.7,w:5.5,h:5.5,fill:{color:BLUE,transparency:18},line:{color:WHITE,transparency:100}});
 addText(s,'VISION DIMENSIONS  •  PDC',6.6,.55,5.9,.33,17,'FFA94C',{rtlMode:false,bold:true,align:'left',charSpacing:1});
 addText(s,'تقييم السلامة للمقاولين',3.2,2.10,9.15,.70,39,WHITE,{bold:true});
 addText(s,'تقرير السلامة والصحة المهنية - '+city,3.3,2.98,9.0,.50,24,'FFC47E',{bold:true});
 addText(s,'مقاولو العقد الموحد | '+period,3.3,3.72,9.0,.40,18,'D8E8F4');
 addText(s,'عدد الفحوص: '+comm(rows.length)+'     •     المصدر: Intellect',3.3,4.38,9.0,.40,16,WHITE);
 addText(s,'أبعاد الرؤية للاستشارات الهندسية',3.0,6.73,9.35,.30,18,WHITE,{bold:true});
 const logo=path.join(__dirname,'public','company-logo.png');
 if(fs.existsSync(logo))try{s.addImage({path:logo,x:11.25,y:.53,w:1.0,h:.62,transparency:0})}catch(_){}
 s=header(pptx,'الملخص التنفيذي','أداء السلامة بمواقع العمل ضمن الفترة المختارة','EXECUTIVE OVERVIEW');
 kpi(pptx,s,10.04,'عمليات الفحص',comm(rows.length),BLUE,'كل فحص سجل مستقل');
 kpi(pptx,s,6.97,'عدد المقاولين',comm(m.rank.length),ORANGE,'مقاولو الفترة');
 kpi(pptx,s,3.90,'متوسط التقييم',pct(m.score),TEAL,comm(m.scores.length)+' فحصًا بدرجة');
 kpi(pptx,s,.83,'المخالفات',comm(m.total),RED,'مجموع بنود المخالفات');
 box(pptx,s,.82,3.45,11.71,2.85);
 addText(s,'تصنيف المخالفات حسب وزن البند',5.55,3.72,6.58,.35,20,BLUE,{bold:true});
 [['A · 7',m.weights.a,ORANGE],['B · 2',m.weights.b,BLUE],['C · 0.5',m.weights.c,TEAL]].forEach(([label,value,c],i)=>{
  const x=8.4-i*3.6;rect(pptx,s,x,4.35,3.2,1.43,'EAF3FA',.1);
  addText(s,label,x+.2,4.57,2.75,.27,16,SLATE,{bold:true});
  addText(s,comm(value),x+.2,4.85,2.75,.38,26,c,{bold:true});
  addText(s,pct(m.total?value/m.total*100:0)+' من المخالفات',x+.2,5.37,2.75,.22,10,SLATE);
 });
 const ranks=chunks(m.rank,10);if(!ranks.length)ranks.push([]);
 for(let i=0;i<ranks.length;i++){
  s=header(pptx,'تقييم تطبيق لائحة السلامة','ترتيب المقاولين حسب متوسط الدرجات وعدد الفحوص الصحيحة · '+(i+1)+' / '+ranks.length,'CONTRACTOR EVALUATION');
  box(pptx,s,.75,1.55,11.84,5.12);
  ranks[i].forEach((x,j)=>bar(pptx,s,x.name,Number(x.score)||0,100,1.1,1.78+j*.455,11.0,COLORS[j%COLORS.length],pct(x.score)+' · '+comm(x.valid)+' فحص',12));
 }
 s=header(pptx,'الملاحظات الأكثر تكرارًا','أكثر 8 أنواع مخالفات حسب تكرار بند الفحص','VIOLATIONS PROFILE');
 box(pptx,s,.75,1.53,11.84,5.12);
 const top=m.issues.slice(0,8),issueMax=Math.max(1,...top.map(x=>x.count));
 top.forEach((x,i)=>bar(pptx,s,x.label,x.count,issueMax,1.08,1.72+i*.56,10.95,COLORS[i%COLORS.length],comm(x.count)+' · '+pct(m.total?x.count/m.total*100:0),12));
 if(!top.length)addText(s,'لا توجد مخالفات مسجلة في الفترة',2,3.2,9,.4,22,SLATE);
 s=header(pptx,'اتجاه الفحوص الشهري','عدد الفحوص ومتوسط التقييم لكل شهر','MONTHLY TREND');
 box(pptx,s,.75,1.52,11.84,5.14);
 const mx=Math.max(1,...m.months.map(x=>x.count));
 m.months.forEach((x,i)=>bar(pptx,s,x.month,x.count,mx,1.08,1.7+i*.375,10.9,COLORS[i%COLORS.length],comm(x.count)+' فحص · '+pct(avg(x.scores)),11));
 if(!m.months.length)addText(s,'لا توجد بيانات شهرية',2,3.2,9,.4,19,SLATE);
 s=header(pptx,'إجراءات التحسين المقترحة','بنود المتابعة ناتجة عن المخالفات المرصودة فعلًا','FIELD ACTIONS');
 const actions=m.issues.slice(0,4);
 actions.forEach((x,i)=>{
  const col=i%2,row=Math.floor(i/2),bx=6.75-col*5.98,by=1.62+row*2.33;
  box(pptx,s,bx,by,5.62,2.12);
  rect(pptx,s,bx+4.84,by+.15,.53,.53,ORANGE,.10);
  addText(s,String(i+1),bx+4.96,by+.25,.28,.26,17,WHITE,{bold:true,align:'center',rtlMode:false});
  addText(s,x.label,bx+.21,by+.18,4.48,.43,16,BLUE,{bold:true,fit:'shrink'});
  addText(s,comm(x.count)+' حالة · '+pct(m.total?x.count/m.total*100:0),bx+.21,by+.64,4.5,.27,11,ORANGE,{bold:true});
  addText(s,rec(x.label),bx+.21,by+1.03,5.10,.76,14,SLATE,{fit:'shrink'});
 });
 if(!actions.length)addText(s,'لا توجد مخالفات في هذه الفترة؛ يوصى بالاستمرار في الفحص الوقائي.',1.5,3.1,10.3,.4,19,SLATE);
 const ranked=[...m.rank].sort((a,b)=>b.violations-a.violations);
 const contractorParts=chunks(ranked,2);
 for(let i=0;i<contractorParts.length;i++){
  s=header(pptx,'مخالفات كل مقاول','أكثر أربعة بنود تكرارًا لكل مقاول · '+(i+1)+' / '+contractorParts.length,'CONTRACTOR DRILLDOWN');
  contractorParts[i].forEach((x,j)=>{
   const bx=j===0?6.85:.74;
   box(pptx,s,bx,1.55,5.76,5.17);
   rect(pptx,s,bx,1.55,5.76,.84,'E0EFF9',0);
   addText(s,x.name,bx+.17,1.72,5.30,.31,18,BLUE,{bold:true,fit:'shrink'});
   addText(s,comm(x.inspections)+' فحص · '+pct(x.score)+' تقييم · '+comm(x.violations)+' مخالفة',bx+.20,2.44,5.2,.26,12,SLATE);
   const vMax=Math.max(1,...x.top.map(v=>v.count));
   x.top.forEach((v,k)=>bar(pptx,s,v.label,v.count,vMax,bx+.20,2.95+k*.77,5.35,COLORS[k%COLORS.length],comm(v.count),11));
   if(!x.top.length)addText(s,'لا توجد مخالفات مسجلة',bx+.3,3.55,5.1,.34,15,TEAL);
  });
 }
 if(meta.detailed){
  const details=chunks([...rows].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,300),11);
  for(let k=0;k<details.length;k++){
   s=header(pptx,'ملحق الفحوص التفصيلي','أحدث '+comm(Math.min(300,rows.length))+' فحص · '+(k+1)+' / '+details.length,'INSPECTION APPENDIX');
   rect(pptx,s,.74,1.62,11.88,.41,BLUE,0);
   const xs=[{x:11.93,w:.38},{x:10.65,w:1.1},{x:8.8,w:1.55},{x:4.4,w:4.1},{x:2.6,w:1.5},{x:.9,w:1.5}];
   ['م','التاريخ','أمر العمل','المقاول','الدرجة','المخالفات'].forEach((name,i)=>addText(s,name,xs[i].x,1.68,xs[i].w,.22,11,WHITE,{bold:true}));
   details[k].forEach((r,i)=>{
    if(i%2===0)rect(pptx,s,.74,2.05+i*.39,11.88,.39,'E6EFF6',0);
    [String(k*11+i+1),r.date,r.workOrder,r.contractor,pct(r.score),String((r.violations||[]).length)].forEach((v,j)=>addText(s,v,xs[j].x,2.08+i*.39,xs[j].w,.24,10,NAVY,{fit:'shrink'}));
   });
  }
 }
 s=header(pptx,'المنهجية ومرجع البيانات','تُستخدم أوزان نموذج Intellect الأصلي دون تغيير','METHODOLOGY');
 box(pptx,s,.79,1.58,11.78,5.05);
 const methods=[
 ['درجة الفحص','تُقرأ كما هي من العمود F في ورقة Intellect.'],
 ['تقييم المقاول','متوسط درجات عمليات الفحص الصحيحة؛ لا تدخل السجلات الفارغة في المتوسط.'],
 ['تكرار المخالفة','كل بند مخالفة في كل فحص مستقل، بما في ذلك فحوص متعددة لنفس أمر العمل.'],
 ['أوزان البنود','A = 7، B = 2، C = 0.5، مع استبعاد «لا ينطبق» حسب النموذج الأصلي.'],
 ['مصدر البيانات','السلامة والجودة '+city+' / Intellect · '+period],
 ['حدود التقرير','تحليل متابعة، لا يمثل اعتماد جزاءات تعاقدية أو غرامات مالية.']
 ];
 methods.forEach(([label,value],i)=>{
  const y=1.89+i*.68;
  rect(pptx,s,10.60,y,.15,.40,i%2===0?ORANGE:TEAL,0);
  addText(s,label,8.25,y,2.21,.31,15,BLUE,{bold:true});
  addText(s,value,1.12,y,6.97,.40,14,SLATE,{fit:'shrink'});
  if(i<methods.length-1)line(pptx,s,1.05,y+.55,12.23,y+.55,'E0EAF3',1);
 });
 for(let i=0;i<pptx._slides.length;i++){
  if(i===0)continue;
  addText(pptx._slides[i],(i+1)+' / '+pptx._slides.length,11.4,7.20,1.1,.17,9,ORANGE,{rtlMode:false,align:'right',bold:true});
 }
 return pptx.write({outputType:'nodebuffer'});
}
module.exports=({app,requireAuth_,getSheets,spreadsheetId,city})=>{
 app.post('/api/safety/contractor-evaluation/presentation',requireAuth_,async(req,res)=>{
  try{
   const request=req.body||{},details=!!request.detailed,all=!!request.general;
   const format=String(request.format||'pptx').toLowerCase();
   if(format!=='pdf'&&format!=='pptx')return res.status(400).json({ok:false,error:'صيغة التقرير غير مدعومة'});
   const data=await require('./contractor-safety-server').getData({getSheets,spreadsheetId,city});
   const filtered=all?data.rows:filter(data.rows,request.filters);
   if(!Array.isArray(filtered))throw Error('Invalid safety filter');
   const period=all?'كامل الفترة':String(request.period||'كامل المدة').slice(0,140);
   // Every PDF page comes from an actual slide of the approved PPTX presentation.
   // The bounded converter splits pages to avoid exceeding Render's 512 MiB memory cap.
   const meta={city:city==='Jeddah'?'جدة':'مكة',period,general:all,detailed:details};
   const buffer=format==='pdf'
     ? await require('./safety-pdf-bounded').create(filtered,meta)
     : await require('./safety-reference-presentation').create(filtered,meta);
   const name='VD_Contractor_Safety_'+city+'_'+(all?'General':'Filtered')+'_'+new Date().toISOString().slice(0,10)+'.'+format;
   res.set('Cache-Control','no-store');
   res.set('Content-Type',format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.presentationml.presentation');
   res.set('Content-Disposition','attachment; filename="'+name+'"');
   res.end(buffer);
  }catch(error){console.error('Contractor Safety report export:',error);res.status(500).json({ok:false,error:'تعذر تجهيز ملف التقرير: '+String(error.message||error)})}
 });
};
module.exports._test={filter,metrics,create};
