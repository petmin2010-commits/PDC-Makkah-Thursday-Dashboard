'use strict';
const {strToU8,strFromU8}=require('fflate');
const WORKBOOK='xl/workbook.xml';
const RELS='xl/_rels/workbook.xml.rels';
const TYPES='[Content_Types].xml';
const XML_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function esc(v){
  return String(v==null?'':v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function cell(ref,v){
  if(v===null||v===undefined||v==='')return '';
  if(v&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(v,'formula'))
    return '<c r="'+ref+'"><f>'+esc(v.formula)+'</f></c>';
  if(typeof v==='number'){
    return Number.isFinite(v)?'<c r="'+ref+'"><v>'+v+'</v></c>':'';
  }
  return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is></c>';
}
const f=x=>({formula:x});
function addSheet(parts,name,headers,rows,description){
  let sheetNo=4;
  while(parts['xl/worksheets/sheet'+sheetNo+'.xml'])sheetNo++;
  const workbook=strFromU8(parts[WORKBOOK]);
  const rels=strFromU8(parts[RELS]);
  const types=strFromU8(parts[TYPES]);
  if(!workbook.includes('</sheets>')||!rels.includes('</Relationships>')||!types.includes('</Types>'))
    throw new Error('تعذر إدراج أوراق التفاصيل في قالب Excel.');
  const sheetIds=[...workbook.matchAll(/<sheet\b[^>]*\bsheetId="(\d+)"/g)].map(m=>Number(m[1]));
  const relIds=[...rels.matchAll(/\bId="rId(\d+)"/g)].map(m=>Number(m[1]));
  const id=Math.max(0,...sheetIds)+1;
  const rId=Math.max(0,...relIds)+1;
  const cols=Math.max(headers.length,1);
  const last=rows.length+2;
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if(cols>26||last>1048576)throw new Error('بيانات التقرير تتجاوز الحد القياسي لورقة Excel.');
  const rowsXml=[
    '<row r="1">'+cell('A1',description)+'</row>',
    '<row r="2">'+headers.map((v,i)=>cell(letters[i]+'2',v)).join('')+'</row>'
  ];
  rows.forEach((values,i)=>{
    const n=i+3;
    rowsXml.push('<row r="'+n+'">'+values.map((v,j)=>cell(letters[j]+n,v)).join('')+'</row>');
  });
  const columnXml=Array.from({length:cols},(_,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(i===0?56:(i===1?22:20))+'" customWidth="1"/>').join('');
  const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<worksheet xmlns="'+XML_NS+'"><dimension ref="A1:'+letters[cols-1]+last+'"/>'
    +'<sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>'
    +'<sheetFormatPr defaultRowHeight="21"/><cols>'+columnXml+'</cols>'
    +'<sheetData>'+rowsXml.join('')+'</sheetData>'
    +'<autoFilter ref="A2:'+letters[cols-1]+last+'"/></worksheet>';
  parts['xl/worksheets/sheet'+sheetNo+'.xml']=strToU8(xml);
  parts[WORKBOOK]=strToU8(workbook.replace('</sheets>','<sheet name="'+esc(name)+'" sheetId="'+id+'" r:id="rId'+rId+'"/></sheets>'));
  parts[RELS]=strToU8(rels.replace('</Relationships>','<Relationship Id="rId'+rId+'" Type="'+REL_NS+'/worksheet" Target="worksheets/sheet'+sheetNo+'.xml"/></Relationships>'));
  parts[TYPES]=strToU8(types.replace('</Types>','<Override PartName="/xl/worksheets/sheet'+sheetNo+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'));
  return {name,start:3,end:last};
}
module.exports=function addOverflowSheets(parts,report,util){
  const {clean,num,ratio,reportNote}=util;
  const result={};
  const boq=Array.isArray(report.boq)?report.boq:[];
  const mats=Array.isArray(report.mats)?report.mats:[];
  const permits=Array.isArray(report.permits)?report.permits:[];
  const risks=Array.isArray(report.risks)?report.risks:[];
  if(boq.length>5){
    const rows=boq.map((r,i)=>{
      const n=i+3;
      return [
        clean(r['Text Value / Description']||r['Field / Item / Permit No.']),clean(r.Unit),
        num(r['Planned / Required Qty']),num(r['Executed / Issued Qty']),num(r['Period Qty']),
        f('IF($A'+n+'="","",$C'+n+'-$D'+n+')'),
        f('IF($A'+n+'="","",IFERROR(MIN($D'+n+'/$C'+n+',1),0))'),
        ratio(r['Weight / Planned Progress %']),clean(r.Status),'',
        f('IF($A'+n+'="",0,IFERROR(MIN($D'+n+'/$C'+n+',1),0)*$H'+n+')')
      ];
    });
    result.boq=addSheet(parts,'تفاصيل التنفيذ',
      ['وصف بند التنفيذ','الوحدة','الكمية المخططة','الكمية المنفذة','كمية الفترة','المتبقي','نسبة الإنجاز','الوزن','الحالة','ملاحظات','الإنجاز الموزون'],
      rows,'كامل بنود التنفيذ ('+boq.length+' بند) - تشمل المعادلات جميع البنود');
  }
  if(mats.length>15){
    const rows=mats.map((r,i)=>{
      const n=i+3;
      return [clean(r['Text Value / Description']),clean(r.Unit),num(r['Planned / Required Qty']),
        num(r['Executed / Issued Qty']),f('IF($A'+n+'="","",$C'+n+'-$D'+n+')'),
        f('IF($A'+n+'="","",IFERROR($D'+n+'/$C'+n+',0))'),clean(r.Status),reportNote(r.Notes)];
    });
    result.mats=addSheet(parts,'تفاصيل المواد',
      ['الصنف','الوحدة','الكمية المطلوبة','الكمية المصروفة','المتبقي','نسبة الصرف','الحالة','ملاحظات'],
      rows,'كامل أصناف المواد ('+mats.length+' صنف)');
  }
  if(permits.length>31){
    const rows=permits.map((r,i)=>{
      const n=i+3;
      return [clean(r['Field / Item / Permit No.']),clean(r['Responsible / Issuing Authority']),
        clean(r['Location / Neighborhood']),clean(r.Status),clean(r['Start / Observation Date']),
        clean(r['End / Expected Date']),num(r['Planned / Required Qty']),num(r['Executed / Issued Qty']),
        f('IF($A'+n+'="","",IFERROR(MIN($H'+n+'/$G'+n+',1),0))')];
    });
    result.permits=addSheet(parts,'تفاصيل التصاريح',
      ['رقم التصريح','الجهة','الموقع','الحالة','تاريخ البداية','تاريخ النهاية','العدد المطلوب','العدد الصادر','نسبة الإنجاز'],
      rows,'كامل التصاريح ('+permits.length+' تصريح)');
  }
  if(risks.length>5){
    const rows=risks.map(r=>[
      clean(r['Text Value / Description']),clean(r['Category / Impact']),
      clean(r['Impact Level']||r.Notes),clean(r['Action / Support Required']),'',
      clean(r['Responsible / Issuing Authority']),clean(r['Start / Observation Date']),'',clean(r.Status)
    ]);
    result.risks=addSheet(parts,'تفاصيل المعوقات',
      ['العائق','التصنيف','درجة التأثير','الإجراء المطلوب','ملاحظات','الجهة المسؤولة','تاريخ الرصد','المدة','الحالة'],
      rows,'كامل المعوقات ('+risks.length+' عائق)');
  }
  return result;
};
