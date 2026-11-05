'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const repo=__dirname,z=require(path.join(repo,'node_modules','fflate'));
const make=require(path.join(repo,'projects-report-excel-server.js')).buildProjectWorkbook;
const decode=(parts,file)=>z.strFromU8(parts[file]);
const attr=(row,name)=>row?.match(new RegExp('\\b'+name+'="([^"]*)"'))?.[1];
const cell=(xml,ref)=>{
 const row=xml.match(new RegExp('<row\\b[^>]*\\br="'+ref.match(/\d+/)[0]+'"[^>]*>[\\s\\S]*?<\\/row>'))?.[0]||'';
 return row.match(new RegExp('<c\\b[^>]*\\br="'+ref+'"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)'))?.[0]||'';
};
function sample(b,m,p,r){
 return {
  workOrder:'262087953',reportType:'يومي',reportNo:'004',projectTitle:'Test project',
  rdate:'2026-11-05',start:'2026-11-01',expected:'2026-11-30',actual:60,planned:50,engineer:'Engineer',
  boq:Array.from({length:b},(_,i)=>({
   'Text Value / Description':'BOQ_UNIQUE_'+(i+1),Unit:'M','Planned / Required Qty':100+i,
   'Executed / Issued Qty':40+i,'Period Qty':3+i,'Weight / Planned Progress %':1/b,Status:'متأخر'
  })),
  mats:Array.from({length:m},(_,i)=>({'Text Value / Description':'MAT_UNIQUE_'+(i+1),Unit:'EA','Planned / Required Qty':50,'Executed / Issued Qty':i+1,Status:'جزئي'})),
  permits:Array.from({length:p},(_,i)=>({'Field / Item / Permit No.':'PERM_UNIQUE_'+(i+1),'Responsible / Issuing Authority':'Authority','Location / Neighborhood':'Location',Status:'تم الإصدار','Planned / Required Qty':2,'Executed / Issued Qty':1})),
  risks:Array.from({length:r},(_,i)=>({'Text Value / Description':'RISK_UNIQUE_'+(i+1),Status:'مفتوح'}))
 };
}
for(const [boq,mats,permits,risks] of [[5,15,31,5],[6,15,31,5],[8,17,33,7],[20,25,40,12],[0,0,0,0]]){
 const extra=[Math.max(0,boq-5),Math.max(0,mats-15),Math.max(0,permits-31),Math.max(0,risks-5)];
 const at=r=>r+[[18,extra[0]],[36,extra[1]],[70,extra[2]],[78,extra[3]]].reduce((n,x)=>n+(r>=x[0]?x[1]:0),0);
 const sumRow=at(18),permitTotal=at(70),boqEnd=17+extra[0],materialsStart=at(21),permitsStart=at(39),risksStart=at(73);
 const parts=z.unzipSync(new Uint8Array(make(sample(boq,mats,permits,risks))));
 const sheet=decode(parts,'xl/worksheets/sheet1.xml');
 const workbook=decode(parts,'xl/workbook.xml');
 const chart=decode(parts,'xl/charts/chart1.xml');
 const drawing=decode(parts,'xl/drawings/drawing1.xml');
 const sheetCount=[...workbook.matchAll(/<sheet\b[^>]*sheetId="\d+"/g)].length;
 assert.equal(sheetCount,4,'use original template sheets only');

 assert.match(cell(sheet,'C'+sumRow),new RegExp('SUM\\(C13:C'+boqEnd+'\\)'),'boq total formula');
 assert.match(cell(sheet,'H'+sumRow),new RegExp('SUM\\(H13:H'+boqEnd+'\\)'),'weights');
 assert.match(cell(sheet,'G'+permitTotal),new RegExp('SUMIF\\(D'+permitsStart+':D'),'permits totals');
 if(boq){assert.ok(cell(sheet,'A'+(13+boq-1)).includes('BOQ_UNIQUE_'+boq),'last BOQ visibly inside main report')}
 if(mats){assert.ok(cell(sheet,'A'+(materialsStart+mats-1)).includes('MAT_UNIQUE_'+mats),'last material inside main')}
 if(permits){assert.ok(cell(sheet,'A'+(permitsStart+permits-1)).includes('PERM_UNIQUE_'+permits),'last permit inside main')}
 if(risks){assert.ok(cell(sheet,'A'+(risksStart+risks-1)).includes('RISK_UNIQUE_'+risks),'last risk inside main')}
 assert.match(cell(sheet,'A'+at(100)),/Engineer/,'signature row shifted');
 assert.ok(!sheet.includes('#REF!'),'no broken references');
 if(extra.some(Boolean)){
   assert.ok(workbook.includes('$I$'+at(100)),'print area expanded');
   assert.ok(drawing.includes('<xdr:row>'+(84+extra.reduce((a,b)=>a+b,0))+'</xdr:row>'),'drawing anchor shifted');
 }
 if(extra[0])assert.ok(sheet.includes('sqref="G13:G'+boqEnd+'"'),'percentage formatting covers added BOQ');
 assert.ok(chart.includes("'تقرير المشروع'!$A$13:$A$"+Math.max(13,12+Math.max(1,boq))),'chart covers BOQ data');
 // Save only the largest, to run strict XML validation separately if needed.

 console.log('PASS',path.basename(repo),'boq',boq,'materials',mats,'permits',permits,'risks',risks,'main sum',sumRow,'bytes',Object.keys(parts).length);
}
