'use strict';
const {strFromU8,strToU8}=require('fflate');
const MAIN='xl/worksheets/sheet1.xml';
function expandProjectTemplate(parts,report){
  const len=name=>Array.isArray(report?.[name])?report[name].length:0;
  const specs=[
    {key:'boq',start:13,base:5,insert:18,extra:Math.max(0,len('boq')-5)},
    {key:'mats',start:21,base:15,insert:36,extra:Math.max(0,len('mats')-15)},
    {key:'permits',start:39,base:31,insert:70,extra:Math.max(0,len('permits')-31)},
    {key:'risks',start:73,base:5,insert:78,extra:Math.max(0,len('risks')-5)}
  ];
  const at=n=>n+specs.reduce((count,s)=>count+(n>=s.insert?s.extra:0),0);
  const end=spec=>at(spec.insert-1)+spec.extra;
  const ranges=Object.fromEntries(specs.map(s=>[s.key,{start:at(s.start),end:end(s),total:Math.max(s.base,len(s.key))}]));
  if(!specs.some(x=>x.extra))return {xml:strFromU8(parts[MAIN]),at,ranges,changed:false};
  if(at(100)>1048576)throw new Error('تجاوز حجم التقرير الحد المسموح في Excel.');
  const matchCell=(ref)=>/^(\$?[A-Z]{1,3})(\$?)(\d+)$/i.exec(ref);
  function moveCell(token){
    const m=matchCell(token);
    return m?m[1]+m[2]+at(Number(m[3])):token;
  }
  function moveRange(token){
    const m=/^(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?$/i.exec(token);
    if(!m)return token;
    if(!m[2])return moveCell(m[1]);
    const first=matchCell(m[1]),last=matchCell(m[2]);
    let lastRow=at(Number(last[3]));
    for(const s of specs){
      if(s.extra>0&&Number(last[3])===s.insert-1&&Number(first[3])<=s.start){
        lastRow+=s.extra;
      }
    }
    return moveCell(m[1])+':'+last[1]+last[2]+lastRow;
  }
  function moveReferences(value){
    return String(value).replace(/(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)/gi,t=>moveRange(t));
  }
  const source=strFromU8(parts[MAIN]);
  const sheetData=source.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if(!sheetData)throw new Error('تعذر العثور على جدول بيانات قالب Excel.');
  const rows=[...sheetData[1].matchAll(/<row\b[^>]*\/>|<row\b[^>]*>[\s\S]*?<\/row>/g)].map(m=>m[0]);
  const originals=new Map();
  for(const rowXml of rows){
    const m=rowXml.match(/<row\b[^>]*\br="(\d+)"/);
    if(m)originals.set(Number(m[1]),rowXml);
  }
  function moveRow(raw,from,to){
    const head=raw.match(/^<row\b[^>]*>/);
    if(!head)throw new Error('Invalid source row '+from);
    return raw.replace(head[0],head[0].replace(/\br="\d+"/,'r="'+to+'"'))
      .replace(/(<c\b[^>]*\br=")([A-Z]+)(\d+)(")/g,(all,a,col,n,b)=>a+col+to+b);
  }
  function cloneBlank(lastRow,newRow){
    const raw=originals.get(lastRow);
    if(!raw)throw new Error('Missing style row '+lastRow);
    let head=raw.match(/^<row\b[^>]*>/)[0].replace(/\br="\d+"/,'r="'+newRow+'"');
    head=head.replace(/\s+spans="[^"]*"/g,'');
    const cells=[...raw.matchAll(/<c\b([^>]*?)\/>|<c\b([^>]*?)>[\s\S]*?<\/c>/g)];
    const blank=cells.map(m=>{
      const a=m[1]||m[2]||'';
      const col=(a.match(/\br="([A-Z]+)\d+"/)||[])[1];
      if(!col)return '';
      const style=(a.match(/\bs="(\d+)"/)||[])[1];
      return '<c r="'+col+newRow+'"'+(style?' s="'+style+'"':'')+'/>';
    }).join('');
    return head+blank+'</row>';
  }
  const byInsert=new Map(specs.filter(s=>s.extra>0).map(s=>[s.insert,s]));
  const remapped=[];
  for(const [oldNo,raw] of originals){
    const insertion=byInsert.get(oldNo);
    if(insertion){
      const styleRow=insertion.insert-1;
      for(let k=0;k<insertion.extra;k++){
        remapped.push(cloneBlank(styleRow,at(styleRow)+1+k));
      }
    }
    remapped.push(moveRow(raw,oldNo,at(oldNo)));
  }

  let xml=source.replace(sheetData[0],()=>'<sheetData>'+remapped.join('')+'</sheetData>');

  // Relocate all defined ranges (merge cells, print ranges, filters, validation and conditional formatting).
  xml=xml.replace(/\b(ref|sqref|activeCell)="([^"]*)"/g,(m,key,val)=>key+'="'+val.split(/(\s+)/).map(part=>/\s/.test(part)?part:moveReferences(part)).join('')+'"');


  xml=xml.replace(/(<f\b(?![^>]*\/>)[^>]*>)([\s\S]*?)(<\/f>)/g,(m,a,expr,c)=>a+moveReferences(expr)+c);


  xml=xml.replace(/(<xm:f>)([\s\S]*?)(<\/xm:f>)/g,(m,a,expr,c)=>a+moveReferences(expr)+c);
  // Keep original chart and signatures in place on the newly expanded main report.
  for(const name of ['xl/drawings/drawing1.xml']){
    if(!parts[name])continue;
    let draw=strFromU8(parts[name]);
    draw=draw.replace(/(<(?:xdr:)?row>)(\d+)(<\/(?:xdr:)?row>)/g,(m,a,n,c)=>{
      const old=Number(n);
      const newZero=old+specs.reduce((v,s)=>v+(old>=s.insert-1?s.extra:0),0);
      return a+newZero+c;
    });
    parts[name]=strToU8(draw);
  }
  const workbookPart='xl/workbook.xml';
  if(parts[workbookPart]){
    let workbook=strFromU8(parts[workbookPart]);
    workbook=workbook.replace(/(<definedName\b[^>]*localSheetId="0"[^>]*>)([\s\S]*?)(<\/definedName>)/g,
      (m,a,expr,c)=>a+moveReferences(expr)+c);
    parts[workbookPart]=strToU8(workbook);
  }
  parts[MAIN]=strToU8(xml);
  return {xml,at,ranges,changed:true};
}
module.exports=expandProjectTemplate;
