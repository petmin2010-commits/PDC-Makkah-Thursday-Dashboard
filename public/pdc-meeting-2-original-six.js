(()=>{'use strict';
/** Preserve every PowerPoint object and placement in the first six original slides.
 * Only change text runs and chart caches; never replace them with HTML cards.
 * Extra report slides are appended as raster pages to the original PPTX ZIP.
 */
const xmlEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const val=v=>{if(typeof v==='string'&&/^\s*\d+(?:\.\d+)?\s*%\s*$/.test(v))return v.trim();return Number.isFinite(Number(v))&&v!==null&&v!==''?String(v):'—'};
const fillSeries=(text,values)=>{
 let seq=0;
 return text.replace(/<c:pt\b([^>]*)>\s*<c:v>[\s\S]*?<\/c:v>\s*<\/c:pt>/g,(tag,attributes)=>{
  // Called within a NUM cache only; category labels are processed separately.
  const idx=Number((attributes.match(/\bidx="(\d+)"/)||[])[1]||seq++);
  return '<c:pt '+attributes.trim()+'><c:v>'+xmlEsc(values?.[idx]??0)+'</c:v></c:pt>';
 });
};
function patchChart(xml,n,s){
 const c=s.construction||{},p=s.permits||{},e=s.emergency||{},f=s.financial||{};
 const cgroup=c.byBusinessType||{};
 const con=cgroup.connections||{},pro=cgroup.projects||{};
 const as=(o,key)=>Number(o?.[key])||0;
 const months=(f.noticesByMonth||[]).slice(-6);
 const chartValues={
  1:[[as(c,'completed'),as(c,'inProgress'),as(c,'notStarted')],[as(c,'total'),as(c,'total'),as(c,'total')]],
  2:[[Math.max(0,as(c,'total')-as(c,'received155')),as(c,'received155')]],
  3:[[as(con,'total'),as(pro,'total')],[as(con,'completed'),as(pro,'completed')],
     [as(con,'inProgress'),as(pro,'inProgress')],[as(con,'notStarted'),as(pro,'notStarted')]],
  4:[[0,0,0,0,0],[0,0,0,0,0]],5:[[0,0,0,0,0],[0,0,0,0,0]],
  6:[[as(con,'total'),as(pro,'total')],[as(con,'completed'),as(pro,'completed')],
     [as(con,'inProgress'),as(pro,'inProgress')],[as(con,'notStarted'),as(pro,'notStarted')]],
  7:[[as(p,'total'),0,0,0,0,0,0]],8:[[0,0,0]],
  9:[[...(e.byContractor||[]).slice(0,14).map(x=>Number(x.value)||0)]],
 10:[[as(e,'scheduled'),as(e,'unscheduled')]],
 11:[[...months.map(x=>Number(x.count)||0)]],
 12:[[as(f,'approvedQuantities'),as(f,'paymentCertificates'),as(f,'purchaseOrders')],[0,0,0]]
 };
 const sets=chartValues[n]||[];
 let index=0;
 const revised=xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g,ser=>{
  const values=sets[index++]||[];
  let result=ser.replace(/<c:val>[\s\S]*?<\/c:val>/g,part=>part.replace(/<c:numCache>[\s\S]*?<\/c:numCache>/g,cache=>fillSeries(cache,values)));
  const labels=n===9?(e.byContractor||[]).slice(0,14).map(x=>String(x.label)):n===11?months.map(x=>String(x.month)) :null;
  if(labels){
   result=result.replace(/<c:cat>[\s\S]*?<\/c:cat>/g,cat=>{
    return cat.replace(/<c:pt\b([^>]*)>\s*<c:v>[\s\S]*?<\/c:v>\s*<\/c:pt>/g,(tag,attrs)=>{
     const idx=Number((attrs.match(/\bidx="(\d+)"/)||[])[1]||0);
     return '<c:pt '+attrs.trim()+'><c:v>'+xmlEsc(labels[idx]||'—')+'</c:v></c:pt>';
    });
   });
  }
  return result;
 });
 // A chart's embedded historical Excel workbook must never override its new cache.
 return revised.replace(/<c:externalData\b[^>]*\/>/g,'').replace(/<c:externalData\b[^>]*>[\s\S]*?<\/c:externalData>/g,'');
}
function patchSlide(xml,n,s){
 const c=s.construction||{},e=s.emergency||{},f=s.financial||{};
 const num=(value,isPercent=false)=>val(value)+(isPercent&&value!==null&&value!==undefined?' %':'');
 const shapeValues={
  1:{'Rectangle 9':c.received155,'Rectangle 13':c.notStarted,'Rectangle 17':c.inProgress,
     'Rectangle 21':c.completed,'Rectangle 25':c.total},
  4:{'Rectangle 9':e.total?((Number(e.completed)||0)/Number(e.total)*100).toFixed(1)+' %':'—',
     'Rectangle 13':e.notStarted,'Rectangle 17':e.inProgress,'Rectangle 21':e.completed,
     'Rectangle 25':e.total,'Rectangle 29':e.scheduled,'Rectangle 33':e.unscheduled,
     'Rectangle 37':null,'Rectangle 41':null,'Rectangle 45':e.completed},
  5:{'Rectangle 9':num(f.paymentRate,true),'Rectangle 13':f.purchaseOrders,
     'Rectangle 17':f.paymentCertificates,'Rectangle 21':f.approvedQuantities,
     'Rectangle 25':e.total}
 }[n]||{};
 // Clean historical numeric runs BEFORE inserting live values. The old
 // post-processing rule accidentally erased the newly inserted live metrics.
 const blank=xml.replace(/<a:t>([\s\d.,%٠-٩٪]+)<\/a:t>/g,(_tag,t)=>
   /^\s*155\s*$/.test(t)?'<a:t>155</a:t>':'<a:t>—</a:t>');
 return blank.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>{
  const title=(shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)||[])[1]||'';
  let text=shape;
  if(Object.prototype.hasOwnProperty.call(shapeValues,title)){
   const replacement=xmlEsc(val(shapeValues[title]));
   let first=true;
   text=text.replace(/<a:t>[\s\S]*?<\/a:t>/g,tag=>{
    if(first){first=false;return '<a:t>'+replacement+'</a:t>'}
    return '<a:t></a:t>';
   });
  }else{
   // Missing values must not retain numeric data from the historical report.
   text=text.replace(/<a:t>([\s\S]*?)<\/a:t>/g,(tag,body)=>
      /^[\s\d.,%٠-٩٪]+$/.test(body)?'<a:t>—</a:t>':tag);
  }
  return text;
 });
}
// Fill native PowerPoint TABLES without moving/recreating any cell, color,
// line or font. Unmapped values remain blank rather than copying stale data.
function replaceTableValues(xml,slideNo,s){
 const set=(cell,value)=>{
  const text=value===null||value===undefined||value===''?'—':String(value);
  return cell.replace(/<a:t>[\s\S]*?<\/a:t>/,'<a:t>'+xmlEsc(text)+'</a:t>');
 };
 if(slideNo===2){
  const keys=['makkahConnections','makkahProjects','makkahCentral','makkahAutomation',
              'khulaisConnections','khulaisProjects','khulaisAutomation','total'];
  const groups=s.construction?.byRegionSection||{};
  return xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/,(table)=>{
   let row=-1;
   return table.replace(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g,(rowXml)=>{
    row++;if(row<3||row>10)return rowXml;
    const g=groups[keys[row-3]];
    if(!g)return rowXml;
    let cell=-1;
    return rowXml.replace(/<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/g,tc=>{
     cell++;
     const colVals={3:g.total,4:g.completed,7:g.inProgress,8:g.notStarted,14:g.received155,
      15:g.total?Math.round(1000*g.completed/g.total)/10+'%':'—'};
     return Object.prototype.hasOwnProperty.call(colVals,cell)?set(tc,colVals[cell]):tc;
    });
   });
  });
 }
 if(slideNo===6){
  const w=s.weekly||{};
  const sequences=[[w.completedConnections,w.receivedConnections155],[w.completedProjects,w.receivedProjects155]];
  let n=-1;
  return xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g,(table)=>{
   n++;
   let row=-1;
   return table.replace(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g,(rowXml)=>{
    row++;
    if((row!==1&&row!==3)||!sequences[n])return rowXml;
    return rowXml.replace(/<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/,tc=>set(tc,sequences[n][row===1?0:1]));
   });
  });
 }
 return xml;
}
const nudge=async(zip,s)=>{
 for(let i=1;i<=6;i++){
  const name='ppt/slides/slide'+i+'.xml';
  if(!zip.file(name))throw Error('ORIGINAL_SLIDE_MISSING_'+i);
  const updated=replaceTableValues(patchSlide(await zip.file(name).async('string'),i,s),i,s);
  zip.file(name,updated.replace(/<a:t>([^<]*[\u0600-\u06ff][^<]*)<\/a:t>/g,(_tag,t)=>
   '<a:t>'+t.replace(/\d+(?:[.,]\d+)?/g,n=>n==='155'?n:'—')+'</a:t>'));
 }
 for(let i=1;i<=12;i++){
  const name='ppt/charts/chart'+i+'.xml';
  if(!zip.file(name))throw Error('ORIGINAL_CHART_MISSING_'+i);
  zip.file(name,patchChart(await zip.file(name).async('string'),i,s));
 }
 // Remove embedded stale chart spreadsheets. Display uses the updated cached values.
 zip.forEach(name=>{if(name.startsWith('ppt/embeddings/'))zip.remove(name)});
 const ct=await zip.file('[Content_Types].xml').async('string');
 zip.file('[Content_Types].xml',ct.replace(/<Override\b[^>]*PartName="\/ppt\/embeddings\/[^"]+"[^>]*\/>/g,''));
};
async function mergeNative(templateBytes,sixData,reportBlob){
 if(!window.JSZip)throw Error('ZIP_LIBRARY_UNAVAILABLE');
 const original=await JSZip.loadAsync(templateBytes),newslides=await JSZip.loadAsync(reportBlob);
 const presentation=await original.file('ppt/presentation.xml')?.async('string');
 if(!presentation)throw Error('ORIGINAL_PRESENTATION_MISSING');
 const originalSlideCount=(presentation.match(/<p:sldId\b/g)||[]).length;
 if(originalSlideCount!==6)throw Error('ORIGINAL_SLIDE_COUNT_MUST_BE_SIX');
 await nudge(original,sixData);
 let pres=await original.file('ppt/presentation.xml').async('string');
 let rels=await original.file('ppt/_rels/presentation.xml.rels').async('string');
 let ct=await original.file('[Content_Types].xml').async('string');
 const pages=(await newslides.file('ppt/presentation.xml').async('string')).match(/<p:sldId\b/g)||[];
 const newNum=pages.length;
 if(!newNum)throw Error('NO_ATTACHED_REPORT_SLIDES');
 const usedIds=[...pres.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(m=>+m[1]);
 const usedRIds=[...rels.matchAll(/\bId="rId(\d+)"/g)].map(m=>+m[1]);
 let nextSlideId=Math.max(255,...usedIds)+1,nextRel=Math.max(0,...usedRIds)+1;
 const mslide=pres.match(/<\/p:sldIdLst>/),mrels=rels.match(/<\/Relationships>/);
 if(!mslide||!mrels)throw Error('INVALID_ORIGINAL_SLIDE_LIST');
 // Rename images to avoid colliding with original logos image1..4.
 const imageRemap=new Map();
 for(const name of Object.keys(newslides.files)){
  if(!/^ppt\/media\/[^/]+$/.test(name))continue;
  const target='ppt/media/PDC2_REPORT_'+name.split('/').pop();
  original.file(target,await newslides.file(name).async('uint8array'));
  imageRemap.set('../media/'+name.split('/').pop(),'../media/'+target.split('/').pop());
 }
 for(let i=1;i<=newNum;i++){
  const source='ppt/slides/slide'+i+'.xml',target='ppt/slides/slide'+(i+6)+'.xml';
  const content=await newslides.file(source)?.async('string');
  if(!content)throw Error('ATTACHMENT_SLIDE_MISSING_'+i);
  original.file(target,content);
  const relpath='ppt/slides/_rels/slide'+i+'.xml.rels';
  const relations=await newslides.file(relpath)?.async('string');
  if(!relations)throw Error('ATTACHMENT_SLIDE_RELATIONSHIP_MISSING_'+i);
  const clean=relations.replace(/<Relationship\b[^>]*\bType="[^"]*\/notesSlide"[^>]*\/>/g,'')
   .replace(/Target="\.\.\/slideLayouts\/[^"]+"/g,'Target="../slideLayouts/slideLayout7.xml"')
   .replace(/Target="([^"]+)"/g,(full,x)=>imageRemap.has(x)?'Target="'+imageRemap.get(x)+'"':full);
  original.file('ppt/slides/_rels/slide'+(i+6)+'.xml.rels',clean);
  pres=pres.replace('</p:sldIdLst>','<p:sldId id="'+(nextSlideId++)+'" r:id="rId'+nextRel+'"/></p:sldIdLst>');
  rels=rels.replace('</Relationships>','<Relationship Id="rId'+nextRel+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide'+(i+6)+'.xml"/></Relationships>');
  nextRel++;
  ct=ct.replace('</Types>','<Override PartName="/ppt/slides/slide'+(i+6)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');
 }
 for(const ext of ['jpeg','jpg','png']){
  if(imageRemap.size&&!new RegExp('Extension="'+ext+'"').test(ct))
   ct=ct.replace('</Types>','<Default Extension="'+ext+'" ContentType="image/'+(ext==='jpg'?'jpeg':ext)+'"/></Types>');
 }
 original.file('ppt/presentation.xml',pres);
 original.file('ppt/_rels/presentation.xml.rels',rels);
 original.file('[Content_Types].xml',ct);
 const result=await original.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});
 return {blob:result,slideCount:6+newNum,exactOriginalSix:true,chartsUpdated:12};
}
window.VDPdcOriginalSix={mergeNative};
})();