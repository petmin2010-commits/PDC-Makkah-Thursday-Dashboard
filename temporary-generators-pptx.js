
'use strict';
const fs=require('fs'),path=require('path');
const {unzipSync,zipSync,strToU8,strFromU8}=require('fflate');
const template=path.join(__dirname,'templates','temporary-generators-original.pptx');
const blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR/oAAAAASUVORK5CYII=','base64');
const e=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const un=x=>String(x).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const slideXml=z=>strFromU8(z);
const layoutFixes=JSON.parse(fs.readFileSync(path.join(__dirname,'templates','temporary-generators-layout-fixes.json'),'utf8'));
function applySourceLayoutFixes(xml,slideNo){
 const list=layoutFixes.slides[String(slideNo)]||[];
 for(const item of list){
  let matched=0;
  xml=xml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g,shape=>{
   if(!new RegExp('<p:cNvPr[^>]*id="'+item.shapeId+'"').test(shape))return shape;
   matched++;
   const unit=x=>String(Math.round(x*914400));
   shape=shape.replace(/(<p:spPr>[\s\S]*?<a:xfrm[^>]*>[\s\S]*?<a:off x=")[^"]+(" y=")[^"]+("\s*\/\>\s*<a:ext cx=")[^"]+(" cy=")[^"]+/,('$1'+unit(item.left)+'$2'+unit(item.top)+'$3'+unit(item.width)+'$4'+unit(item.height)));
   shape=shape.replace(/(<a:bodyPr\b[^>]*)(\/?>)/, (whole,begin,end)=>begin.replace(/\sanchor="[^"]+"/,'')+' anchor="ctr"'+end);
   shape=shape.replace(/(<a:pPr\b[^>]*)(\/?>)/, (whole,begin,end)=>begin.replace(/\salgn="[^"]+"/,'')+' algn="ctr"'+end);
   if(item.fontPt)shape=shape.replace(/(<a:(?:rPr|endParaRPr)\b[^>]*\bsz=")[^"]+/g,'$1'+Math.round(item.fontPt*100));
   return shape;
  });
  if(matched!==1)throw Error('Generator source fix failed for slide '+slideNo+' shape '+item.shapeId+' (found '+matched+')');
 }
 return xml;
}
const write=(zip,key,s)=>{zip[key]=strToU8(s)};
function setShape(xml,check,value,keepFirst=false,firstUseful=false){
 let found=0;
 const result=xml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g,block=>{
  const all=[...block.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];
  const whole=all.map(x=>un(x[1])).join('');
  if(!check(whole)||!all.length)return block;
  found++;
  let index=0,done=false;
  return block.replace(/(<a:t[^>]*>)([\s\S]*?)(<\/a:t>)/g,(full,a,old,c)=>{
   const i=index++;if(keepFirst&&i===0)return full;
   if(firstUseful&&i===0&&!(un(old).trim()))return full;
   if(!done){done=true;return a+e(value)+c}
   return a+c;
  });
 });
 return {xml:result,found};
}
function field(xml,key,value){
 const r=setShape(xml,txt=>txt.includes(key),value,true);
 if(!r.found)throw Error('Missing PPTX shape: '+key);
 return r.xml;
}
function summarise(xml,report,findings){
 const numbers=[Number(report.currentSites)||0,Number(report.closedSites)||0,Number(report.temporaryCables)||0,Number(report.generatorsTotal)||0];
 let step=0;
 xml=xml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g,shape=>{
  const match=shape.match(/<a:t>([01])<\/a:t>/);
  if(match&&step<4){
   const n=step++;
   return shape.replace(/<a:t>[01]<\/a:t>/,'<a:t>'+e(numbers[n])+'</a:t>');
  }
  return shape;
 });
 if(step!==4)throw Error('Expected four original temporary KPI shapes, got '+step);
 const notes=findings.map(f=>String(f.observation||'').trim()).filter(Boolean).slice(0,7).join(' — ')||'لا توجد ملاحظات مرصودة خلال الفترة';
 const summary=setShape(xml,txt=>txt.includes('عدم وجود أشرطة تحذيرية حول المولدات'),notes,false,true);
 if(!summary.found)throw Error('Missing summary observation shape');
 return summary.xml;
}
function updateSlide43(xml,f){
 const fields=[['رقم امر العمل ',f.workOrder],['المقاول ',f.contractor],['نوع امر العمل ',f.workType],['وصف العمل',f.workDescription],['الموقع :',f.location],
 ['الملاحظات :',f.observation],['التصحيح:',f.correctiveAction||'في انتظار التصحيح']];
 for(const [key,value] of fields)xml=field(xml,key,String(value||'—'));
 return xml;
}
function replaceRelTarget(xml,rid,target){
 const regex=new RegExp('(<Relationship\\b(?=[^>]*\\bId="'+rid+'")[^>]*\\bTarget=")[^"]+(")');
 if(!regex.test(xml))throw Error('Missing slide image relationship '+rid);
 return xml.replace(regex,(all,start,end)=>start+'../media/'+target+end);
}
function attachImages(zip,rel,photos,n){
 for(const [rid,slot,part] of [['rId7',1,'before'],['rId8',5,'after']]){
  const photo=(photos||[]).find(x=>Number(x.slot)===slot);
  const match=photo?.dataUrl?.match(/^data:image\/jpe?g;base64,([A-Za-z0-9+/=]+)$/i);
  const ext=match?'jpeg':'png';
  const filename='tg'+n+'_'+part+'.'+ext;
  zip['ppt/media/'+filename]=new Uint8Array(match?Buffer.from(match[1],'base64'):blank);
  rel=replaceRelTarget(rel,rid,filename);
 }
 return rel;
}
async function build({report,findings,getPhotos}){
 if(!fs.existsSync(template))throw Error('Original PPTX template not installed');
 const zip=unzipSync(new Uint8Array(fs.readFileSync(template)));
 const notes=Array.isArray(findings)?findings:[];
 const detail=notes.length?notes:[{workOrder:'—',contractor:'—',workType:'—',workDescription:'—',location:'—',observation:'لا توجد ملاحظات',correctiveAction:'—',id:'none'}];
 let cover=applySourceLayoutFixes(slideXml(zip['ppt/slides/slide39.xml']),39);
 const city=(report.city||'').includes('جدة')?'بجدة':'بمكة';
 cover=cover.replace('بمكة ',city+' ');
 write(zip,'ppt/slides/slide39.xml',cover);
 write(zip,'ppt/slides/slide40.xml',summarise(slideXml(zip['ppt/slides/slide40.xml']),report,notes));
 const detailSource=applySourceLayoutFixes(slideXml(zip['ppt/slides/slide43.xml']),43);
 const relSource=slideXml(zip['ppt/slides/_rels/slide43.xml.rels']);
 const appended=[];
 for(let i=0;i<detail.length;i++){
  const item=detail[i];
  const number=i===0?43:44+i;
  const slide='ppt/slides/slide'+number+'.xml';
  const rel='ppt/slides/_rels/slide'+number+'.xml.rels';
  write(zip,slide,updateSlide43(detailSource,item));
  const photos=item.id==='none'?[]:await getPhotos(report.id+'--'+item.id);
  write(zip,rel,attachImages(zip,relSource,photos,i+1));
  if(i>0)appended.push({number,rid:'rId'+(60+i),id:500+i});
 }
 if(appended.length){
  let presentation=slideXml(zip['ppt/presentation.xml']);
  const newEntries=appended.map(x=>'<p:sldId id="'+x.id+'" r:id="'+x.rid+'"/>').join('');
  const ending=/<p:sldId\b[^>]*r:id="rId45"[^>]*\/>/;
  if(!ending.test(presentation))throw Error('Original end slide not found');
  presentation=presentation.replace(ending,m=>newEntries+m);
  write(zip,'ppt/presentation.xml',presentation);
  let relationships=slideXml(zip['ppt/_rels/presentation.xml.rels']);
  relationships=relationships.replace('</Relationships>',appended.map(x=>'<Relationship Id="'+x.rid+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide'+x.number+'.xml"/>').join('')+'</Relationships>');
  write(zip,'ppt/_rels/presentation.xml.rels',relationships);
  let contentTypes=slideXml(zip['[Content_Types].xml']);
  contentTypes=contentTypes.replace('</Types>',appended.map(x=>'<Override PartName="/ppt/slides/slide'+x.number+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('')+'</Types>');
  write(zip,'[Content_Types].xml',contentTypes);
 }
 return Buffer.from(zipSync(zip,{level:4}));
}
module.exports={build};
