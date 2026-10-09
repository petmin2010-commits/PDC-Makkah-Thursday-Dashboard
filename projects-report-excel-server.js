const fs=require('fs');
const path=require('path');
const {unzipSync,zipSync,strToU8,strFromU8}=require('fflate');

const TEMPLATE_PATH=path.join(__dirname,'projects-report-template.xlsx');
const SHEET1='xl/worksheets/sheet1.xml';
const SHEET2='xl/worksheets/sheet2.xml';
const SHEET3='xl/worksheets/sheet3.xml';
const CHART1='xl/charts/chart1.xml';
const CHART2='xl/charts/chart2.xml';
const BLANK_JPEG=Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAUABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKACiiigAooooAKKKKAP/2Q==','base64');

function xmlEsc(v){
  return String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function clean(v){return String(v??'').replace(/\s+/g,' ').trim()}
function num(v){
  const s=String(v??'').replace(/,/g,'').replace('%','').trim();
  if(!s)return null;
  const n=Number(s);
  return Number.isFinite(n)?n:null;
}
function ratio(v){
  const n=num(v); if(n==null)return null;
  return String(v??'').includes('%')||Math.abs(n)>1?n/100:n;
}
function parseDate(v){
  if(v instanceof Date&&!isNaN(v))return v;
  const s=clean(v); if(!s)return null;
  let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m)return new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));
  m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if(m)return new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  const d=new Date(s); return isNaN(d)?null:new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
}
function excelSerial(v){
  const d=parseDate(v); if(!d)return null;
  return Math.round((d.getTime()-Date.UTC(1899,11,30))/86400000);
}
function norm(v){
  return clean(v).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
}
function reEsc(s){return String(s).replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}
function cellAttrs(xml,ref){
  const safe=reEsc(ref);
  const re2=new RegExp('<c\\b([^>]*\\br="'+safe+'"[^>]*)\\s*\\/>');
  const m2=xml.match(re2); if(m2)return {re:re2,attrs:m2[1]};
  const re1=new RegExp('<c\\b([^>]*\\br="'+safe+'"[^>]*?[^/])>[\\s\\S]*?<\\/c>');
  const m1=xml.match(re1); if(m1)return {re:re1,attrs:m1[1]};
  return null;
}
function setCell(xml,ref,value,kind='string'){
  const hit=cellAttrs(xml,ref);
  let attrs=(hit?.attrs||(' r="'+ref+'"')).replace(/\s+t="[^"]*"/g,'').replace(/\/\s*$/,'');
  let body='';
  if(kind==='formula'){
    const f=String(value??'').replace(/^=/,'');
    body='<f>'+xmlEsc(f)+'</f>';
  }else if(kind==='number'){
    const raw=value;
    if(raw!==null&&raw!==undefined&&String(raw).trim()!==''){
      const n=Number(raw);
      if(Number.isFinite(n))body='<v>'+String(n)+'</v>';
    }
  }else if(value!==null&&value!==undefined&&String(value)!==''){
    attrs+=' t="inlineStr"';
    body='<is><t xml:space="preserve">'+xmlEsc(value)+'</t></is>';
  }
  const cell=body?'<c'+attrs+'>'+body+'</c>':'<c'+attrs+'/>';
  if(hit)return xml.replace(hit.re,()=>cell);
  const rowNo=Number((ref.match(/\d+$/)||[])[0]||0);
  const rr=new RegExp('(<row\\b[^>]*\\br="'+rowNo+'"[^>]*>)([\\s\\S]*?)(<\\/row>)');
  if(rr.test(xml))return xml.replace(rr,(m,a,b,c)=>a+b+cell+c);
  return xml;
}
function setRowHidden(xml,row,hidden){
  const re=new RegExp('<row\\b([^>]*\\br="'+row+'"[^>]*)>');
  return xml.replace(re,(m,attrs)=>{
    attrs=attrs.replace(/\s+hidden="[^"]*"/g,'');
    return '<row'+attrs+(hidden?' hidden="1"':'')+'>';
  });
}
function ensureRow(xml,row,styleRow=3){
  if(new RegExp('<row\\b[^>]*\\br="'+row+'"[^>]*>').test(xml))return xml;
  const source=(xml.match(new RegExp('<row\\b[^>]*\\br="'+styleRow+'"[^>]*>[\\s\\S]*?<\\/row>'))||[])[0];
  if(!source)return xml;
  let clone=source.replace(new RegExp('r="'+styleRow+'"','g'),'r="'+row+'"');
  clone=clone.replace(/<c\b([^>]*\br="[A-Z]+)\d+("[^>]*)>[\s\S]*?<\/c>/g,(m,a,b)=>'<c'+a+row+b+'/>');
  clone=clone.replace(/<c\b([^>]*\br="[A-Z]+)\d+("[^>]*)\/>/g,(m,a,b)=>'<c'+a+row+b+'/>');
  return xml.replace('</sheetData>',clone+'</sheetData>');
}
function clearRange(xml,cols,start,end){
  for(let r=start;r<=end;r++)for(const c of cols)xml=setCell(xml,c+r,null,'string');
  return xml;
}
function statusFromProgress(done,planned){
  if(!planned||planned<=0)return '';
  const p=done/planned;
  if(p>=0.999)return 'مكتمل';
  if(done>0)return 'جاري';
  return 'لم يبدأ';
}
function dailyUnitLabel(unit){
  const u=clean(unit).toUpperCase();
  return ({M:'متر',M2:'م²',KM:'كم',EA:'عدد',NO:'عدد',KIT:'طقم',LS:''})[u]||clean(unit);
}
function activeDailyBoq(report){
  return (Array.isArray(report.boq)?report.boq:[]).filter(r=>(num(r?.['Period Qty'])||0)>0);
}
function primaryDailyBoq(report){
  const rows=activeDailyBoq(report);if(!rows.length)return null;
  return rows.find(r=>clean(r?.['Text Value / Description']).includes('حفر'))||
         rows.find(r=>['M','M2','KM'].includes(clean(r?.Unit).toUpperCase()))||
         rows[0];
}
function currentDailyHistoryRow(report,history){
  const primary=primaryDailyBoq(report);
  const executed=primary?num(primary['Period Qty']):null;
  const lastTarget=[...(history||[])].reverse().map(x=>num(x?.row?.['Planned / Required Qty'])).find(x=>x!=null&&x>0);
  const plannedQty=primary?num(primary['Planned / Required Qty']):null;
  const duration=num(report.contractDuration);
  const target=lastTarget!=null?lastTarget:(plannedQty!=null&&duration>0?Math.round((plannedQty/duration)*100)/100:null);
  const summary=activeDailyBoq(report).map(r=>{
    const q=num(r?.['Period Qty']),unit=dailyUnitLabel(r?.Unit),label=clean(r?.['Text Value / Description']||r?.['Field / Item / Permit No.']);
    return label+(q!=null?' '+q.toLocaleString('en-US',{maximumFractionDigits:2}):'')+(unit?' '+unit:'');
  }).filter(Boolean).join(' + ');
  return {
    'Period Qty':executed??'',
    'Planned / Required Qty':target??'',
    'Text Value / Description':summary,
    'Responsible / Issuing Authority':clean(report.preparedBy)
  };
}
function filteredHistory(report){
  const start=parseDate(report.start),end=parseDate(report.rdate);
  const map=new Map();
  for(const r of Array.isArray(report.planRows)?report.planRows:[]){
    const d=parseDate(r?.['Start / Observation Date']||r?.['End / Expected Date']);
    if(!d||(start&&d<start)||(end&&d>end))continue;
    const actual=ratio(r?.['Numeric Value']);
    const planned=ratio(r?.['Weight / Planned Progress %']);
    if(actual==null&&planned==null)continue;
    const key=d.toISOString().slice(0,10);
    const old=map.get(key)||{date:key,actual:null,planned:null,row:r};
    if(actual!=null)old.actual=actual;
    if(planned!=null)old.planned=planned;
    old.row=r; map.set(key,old);
  }
  const out=[...map.values()].sort((a,b)=>parseDate(a.date)-parseDate(b.date));
  if(end&&report.actual!=null){
    const key=end.toISOString().slice(0,10),a=Number(report.actual)/100,current=currentDailyHistoryRow(report,out);
    const hit=out.find(x=>x.date===key);
    if(hit){hit.actual=a;hit.planned=report.planned==null?hit.planned:Number(report.planned)/100;hit.row={...(hit.row||{}),...current};}
    else out.push({date:key,actual:a,planned:report.planned==null?null:Number(report.planned)/100,row:current});
    out.sort((a,b)=>parseDate(a.date)-parseDate(b.date));
  }
  return out.slice(-35);
}
function periodProgress(report){
  let weighted=0,count=0,totalWeight=0;
  for(const r of Array.isArray(report.boq)?report.boq:[]){
    const q=num(r?.['Planned / Required Qty']),p=num(r?.['Period Qty']),w=ratio(r?.['Weight / Planned Progress %']);
    if(q&&q>0&&p!=null&&w!=null){weighted+=w*Math.max(0,p/q);totalWeight+=w;count++}
  }
  return count&&Math.abs(totalWeight-1)<=0.005?weighted:null;
}
function reportNote(v){
  const s=clean(v);
  if(!s)return '';
  if(/^Imported from Excel report\b/i.test(s))return '';
  if(/^تم الاستيراد من/i.test(s))return '';
  return s;
}
function getPrepared(report){
  if(clean(report.preparedBy))return clean(report.preparedBy);
  return clean(report.engineer);
}
function jpegBuffer(dataUrl){
  const m=String(dataUrl||'').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/i);
  if(!m)return null;
  try{const b=Buffer.from(m[1],'base64');return b.length?b:null}catch(e){return null}
}
function imageSlotMap(){
  return [
    {slot:1,media:4,cell:'A13'},{slot:2,media:3,cell:'B13'},{slot:3,media:2,cell:'C13'},{slot:4,media:1,cell:'D13'},
    {slot:5,media:8,cell:'A25'},{slot:6,media:7,cell:'B25'},{slot:7,media:6,cell:'C25'},{slot:8,media:5,cell:'D25'}
  ];
}
function patchChart(xml,replacements){
  for(const [from,to] of replacements)xml=xml.split(from).join(to);
  xml=xml.replace(/<c:numCache>[\s\S]*?<\/c:numCache>/g,'');
  xml=xml.replace(/<c:strCache>[\s\S]*?<\/c:strCache>/g,'');
  return xml;
}
function patchCalc(parts){
  delete parts['xl/calcChain.xml'];
  if(parts['xl/_rels/workbook.xml.rels']){
    let s=strFromU8(parts['xl/_rels/workbook.xml.rels']);
    s=s.replace(/<Relationship\b[^>]*Type="[^"]*\/calcChain"[^>]*\/>/g,'');
    parts['xl/_rels/workbook.xml.rels']=strToU8(s);
  }
  if(parts['[Content_Types].xml']){
    let s=strFromU8(parts['[Content_Types].xml']);
    s=s.replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g,'');
    parts['[Content_Types].xml']=strToU8(s);
  }
  if(parts['xl/workbook.xml']){
    let s=strFromU8(parts['xl/workbook.xml']);
    if(/<calcPr\b/.test(s))s=s.replace(/<calcPr\b[^>]*\/>/,'<calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');
    else s=s.replace('</workbook>','<calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
    parts['xl/workbook.xml']=strToU8(s);
  }
}
function buildProjectWorkbook(report){
  if(!fs.existsSync(TEMPLATE_PATH))throw new Error('قالب Excel غير موجود على الخادم.');
  const parts=unzipSync(new Uint8Array(fs.readFileSync(TEMPLATE_PATH)));
  let s1=strFromU8(parts[SHEET1]),s2=strFromU8(parts[SHEET2]);
  const boq=Array.isArray(report.boq)?report.boq:[];
  const mats=Array.isArray(report.mats)?report.mats:[];
  const permits=Array.isArray(report.permits)?report.permits:[];
  const risks=Array.isArray(report.risks)?report.risks:[];
  if(boq.length>5)throw new Error('للحفاظ على الشكل الأصلي حرفيًا، قالب Excel يدعم حتى 5 بنود تنفيذ.');
  if(mats.length>15)throw new Error('للحفاظ على الشكل الأصلي حرفيًا، قالب Excel يدعم حتى 15 صنف مواد.');
  if(permits.length>31)throw new Error('للحفاظ على الشكل الأصلي حرفيًا، قالب Excel يدعم حتى 31 تصريحًا.');
  if(risks.length>5)throw new Error('للحفاظ على الشكل الأصلي حرفيًا، قالب Excel يدعم حتى 5 عوائق.');

  const reportType=clean(report.reportType)||'يومي';
  const reportNo=clean(report.reportNo)||'001';
  const consultant=clean(report.consultant)||'شركة أبعاد الرؤية للاستشارات الهندسية';
  const secFollowup=clean(report.secFollowup)||clean(report.engineer);
  const preparedBy=getPrepared(report);
  const rd=excelSerial(report.rdate),sd=excelSerial(report.start),ed=excelSerial(report.expected);
  const contractDuration=num(report.contractDuration);
  const actualRatio=report.actual==null?null:Number(report.actual)/100;
  const actualFallback=actualRatio==null?'0':String(actualRatio);
  const header=[
    ['B3',report.workOrder,'string'],['E3',reportType,'string'],['G3',rd,'number'],['I3',reportNo,'string'],
    ['B4',report.projectTitle,'string'],['G4',report.location,'string'],['B5',report.desc,'string'],
    ['B6',report.contractor,'string'],['E6',consultant,'string'],['H6',secFollowup,'string'],
    ['B7',sd,'number'],['D7',ed,'number'],['F7',contractDuration,'number'],
    ['H7',report.daysUntilOperation==null?null:Number(report.daysUntilOperation),'number'],
    ['A10','IF(ABS(SUM($H$13:$H$17)-1)<=0.0001,SUM($K$13:$K$17),'+actualFallback+')','formula'],
    ['B10',report.planned==null?null:Number(report.planned)/100,'number'],
    ['D10','$A$10-$B$10','formula'],
    ['E10','IF($A$10>=0.999,"مكتمل",IF($D$10>=0,"وفق المخطط",IF($D$10>=-0.1,"تحت المتابعة","متأخر")))','formula'],
    ['F10',report.periodProgress==null?periodProgress(report):Number(report.periodProgress)/100,'number'],
    ['H10',report.dailyRequired==null?null:Number(report.dailyRequired)/100,'number']
  ];
  for(const [ref,v,k] of header)s1=setCell(s1,ref,v,k);

  s1=clearRange(s1,['A','B','C','D','E','F','G','H','I','K'],13,17);
  for(let i=0;i<5;i++){
    const row=13+i,r=boq[i]; if(!r)continue;
    const planned=num(r['Planned / Required Qty']),done=num(r['Executed / Issued Qty']),period=num(r['Period Qty']),weight=ratio(r['Weight / Planned Progress %']);
    s1=setCell(s1,'A'+row,clean(r['Text Value / Description']||r['Field / Item / Permit No.']),'string');
    s1=setCell(s1,'B'+row,clean(r.Unit),'string');
    s1=setCell(s1,'C'+row,planned,'number');
    s1=setCell(s1,'D'+row,done,'number');
    s1=setCell(s1,'E'+row,period,'number');
    s1=setCell(s1,'F'+row,'IF($A'+row+'="","",$C'+row+'-$D'+row+')','formula');
    s1=setCell(s1,'G'+row,'IF($A'+row+'="","",IFERROR(MIN($D'+row+'/$C'+row+',1),0))','formula');
    s1=setCell(s1,'H'+row,weight,'number');
    s1=setCell(s1,'I'+row,clean(r.Status)||statusFromProgress(done,planned),'string');
    s1=setCell(s1,'K'+row,'IF($A'+row+'="",0,IFERROR(MIN($D'+row+'/$C'+row+',1),0)*$H'+row+')','formula');
  }
  for(const [ref,f] of [
    ['C18','SUM(C13:C17)'],['D18','SUM(D13:D17)'],['E18','SUM(E13:E17)'],['F18','SUM(F13:F17)'],
    ['G18','$A$10'],['H18','SUM(H13:H17)'],
    ['I18','IF(COUNTA(H13:H17)=0,"⚠ لم يتم إدخال الأوزان",IF(ABS(H18-1)>0.0001,"⚠ مجموع الأوزان ≠ 100%","✔"))']
  ])s1=setCell(s1,ref,f,'formula');

  s1=clearRange(s1,['A','B','C','D','E','F','G','H'],21,35);
  for(let i=0;i<15;i++){
    const row=21+i,r=mats[i]; if(!r)continue;
    s1=setCell(s1,'A'+row,clean(r['Text Value / Description']),'string');
    s1=setCell(s1,'B'+row,clean(r.Unit),'string');
    s1=setCell(s1,'C'+row,num(r['Planned / Required Qty']),'number');
    s1=setCell(s1,'D'+row,num(r['Executed / Issued Qty']),'number');
    s1=setCell(s1,'E'+row,'IF($A'+row+'="","",$C'+row+'-$D'+row+')','formula');
    s1=setCell(s1,'F'+row,'IF($A'+row+'="","",IFERROR($D'+row+'/$C'+row+',0))','formula');
    s1=setCell(s1,'G'+row,clean(r.Status),'string');
    s1=setCell(s1,'H'+row,reportNote(r.Notes),'string');
  }

  s1=clearRange(s1,['A','B','C','D','E','F','G','H','I'],39,69);
  for(let i=0;i<31;i++){
    const row=39+i,r=permits[i]; if(!r)continue;
    s1=setCell(s1,'A'+row,clean(r['Field / Item / Permit No.']),'string');
    s1=setCell(s1,'B'+row,clean(r['Responsible / Issuing Authority']),'string');
    s1=setCell(s1,'C'+row,clean(r['Location / Neighborhood']),'string');
    s1=setCell(s1,'D'+row,clean(r.Status),'string');
    s1=setCell(s1,'E'+row,excelSerial(r['Start / Observation Date']),'number');
    s1=setCell(s1,'F'+row,excelSerial(r['End / Expected Date']),'number');
    s1=setCell(s1,'G'+row,num(r['Planned / Required Qty']),'number');
    s1=setCell(s1,'H'+row,num(r['Executed / Issued Qty']),'number');
    s1=setCell(s1,'I'+row,'IF($A'+row+'="","",IFERROR(MIN($H'+row+'/$G'+row+',1),0))','formula');
  }
  s1=setCell(s1,'A70','إجمالي التصاريح الصادرة','string');
  s1=setCell(s1,'G70','SUMIF(D39:D69,"تم الإصدار",G39:G69)','formula');
  s1=setCell(s1,'H70','SUMIF(D39:D69,"تم الإصدار",H39:H69)','formula');
  s1=setCell(s1,'I70','IFERROR(H70/G70,0)','formula');

  s1=clearRange(s1,['A','B','C','D','E','F','G','H','I'],73,77);
  for(let i=0;i<5;i++){
    const row=73+i,r=risks[i]; if(!r)continue;
    s1=setCell(s1,'A'+row,clean(r['Text Value / Description']),'string');
    s1=setCell(s1,'B'+row,clean(r['Category / Impact']),'string');
    s1=setCell(s1,'C'+row,clean(r['Impact Level']||r.Notes),'string');
    s1=setCell(s1,'D'+row,clean(r['Action / Support Required']),'string');
    s1=setCell(s1,'F'+row,clean(r['Responsible / Issuing Authority']),'string');
    s1=setCell(s1,'G'+row,excelSerial(r['Start / Observation Date']),'number');
    s1=setCell(s1,'H'+row,'IF($A'+row+'="","",IF(OR($I'+row+'="تم الحل",$I'+row+'="مغلق"),"مغلق",IF($G'+row+'="","",$G$3-$G'+row+')))','formula');
    s1=setCell(s1,'I'+row,clean(r.Status),'string');
  }

  const period=(Array.isArray(report.periodRows)?report.periodRows:[]).map(r=>clean(r['Text Value / Description']||r.Notes)).filter(Boolean).join(' + ');
  const management=(Array.isArray(report.managementRows)?report.managementRows:[]).map(r=>clean(r['Text Value / Description']||r['Action / Support Required']||r.Notes)).filter(Boolean).join(' + ');
  s1=setCell(s1,'A79',period,'string');
  s1=setCell(s1,'A81',management,'string');
  s1=setCell(s1,'A100',preparedBy,'string');
  s1=setCell(s1,'D100',null,'string');
  s1=setCell(s1,'G100',null,'string');

  const hist=filteredHistory(report);
  const todayKey=parseDate(report.rdate)?.toISOString().slice(0,10);
  const prior=hist.filter(h=>h.date<todayKey&&h.actual!=null).at(-1);
  const currentActual=actualRatio;
  // Daily progress is the delta against the most recent earlier cumulative snapshot.
  s1=setCell(s1,'F10',prior&&currentActual!=null?Math.max(0,currentActual-prior.actual):null,'number');
  for(let r=3;r<=37;r++)s2=ensureRow(s2,r,3);
  s2=clearRange(s2,['A','B','C','D','E','F'],3,37);
  for(let i=0;i<35;i++){
    const row=3+i,h=hist[i]; if(!h)continue;
    const raw=h.row||{};
    s2=setCell(s2,'A'+row,excelSerial(h.date),'number');
    s2=setCell(s2,'B'+row,h.actual,'number');
    s2=setCell(s2,'C'+row,num(raw['Period Qty']),'number');
    s2=setCell(s2,'D'+row,num(raw['Planned / Required Qty']),'number');
    s2=setCell(s2,'E'+row,clean(raw['Text Value / Description']),'string');
    s2=setCell(s2,'F'+row,clean(raw['Responsible / Issuing Authority']||preparedBy),'string');
  }

  // Remove template row hiding and cramped heights from exported report rows.
  s1=s1.replace(/<row\b[^>]*>/g,tag=>tag.replace(/\s+hidden="[^"]*"/g,'').replace(/\s+ht="[^"]*"/g,'').replace(/\s+customHeight="[^"]*"/g,''));
  parts[SHEET1]=strToU8(s1); parts[SHEET2]=strToU8(s2);
  const projectImages=Array.isArray(report.images)?report.images:[];
  const bySlot=new Map(projectImages.map(x=>[Number(x.slot),x]));
  if(parts[SHEET3]){
    let s3=strFromU8(parts[SHEET3]);
    s3=clearRange(s3,['A','B','C','D'],13,13);
    s3=clearRange(s3,['A','B','C','D'],24,25);
    // Enlarge both photo galleries and give their captions generous space.
    s3=s3.replace(/<col\b[^>]*>/g,tag=>tag.replace(/\bwidth="[^"]*"/,'width="34"'));
    s3=s3.replace(/<row\b[^>]*>/g,tag=>{
      const n=Number((tag.match(/\br="(\d+)"/)||[])[1]);
      const height=n===13||n===25?56:((n>=2&&n<=12)||(n>=14&&n<=24)?29:null);
      if(height==null)return tag;
      const selfClosing=/\/\s*>$/.test(tag);
      const base=tag.replace(/\s+ht="[^"]*"/g,'').replace(/\s+customHeight="[^"]*"/g,'');
      return base.replace(/\/?>$/, '')+' ht="'+height+'" customHeight="1"'+(selfClosing?'/>':'>');
    });
    for(const m of imageSlotMap()){
      const img=bySlot.get(m.slot);
      s3=setCell(s3,m.cell,clean(img?.caption),'string');
    }
    parts[SHEET3]=strToU8(s3);
  }
  for(const m of imageSlotMap()){
    const img=bySlot.get(m.slot),buf=jpegBuffer(img?.dataUrl);
    parts['xl/media/image'+m.media+'.jpeg']=new Uint8Array(buf||BLANK_JPEG);
  }
  if(parts[CHART1]){
    const end=Math.max(13,12+Math.max(1,boq.length));
    parts[CHART1]=strToU8(patchChart(strFromU8(parts[CHART1]),[
      ["'تقرير المشروع'!$A$13:$A$14","'تقرير المشروع'!$A$13:$A$"+end],
      ["'تقرير المشروع'!$C$13:$C$14","'تقرير المشروع'!$C$13:$C$"+end],
      ["'تقرير المشروع'!$D$13:$D$14","'تقرير المشروع'!$D$13:$D$"+end]
    ]));
  }
  if(parts[CHART2]){
    parts[CHART2]=strToU8(patchChart(strFromU8(parts[CHART2]),[
      ["'سجل الإنجاز اليومي'!$A$3:$A$37","'سجل الإنجاز اليومي'!$A$3:$A$37"],
      ["'سجل الإنجاز اليومي'!$B$3:$B$37","'سجل الإنجاز اليومي'!$B$3:$B$37"]
    ]));
  }
  patchCalc(parts);
  return Buffer.from(zipSync(parts,{level:6}));
}

module.exports=function installProjectsReportExcel(ctx){
  const {app,requireAuth_,APP,DateTime,loadProjectImages}=ctx;
  app.post('/api/projects-report-engine/excel',requireAuth_,async(req,res)=>{
    try{
      const report=req.body?.report;
      if(!report||!clean(report.workOrder))return res.status(400).json({ok:false,error:'أنشئ التقرير أولاً قبل تصدير Excel.'});
      const images=typeof loadProjectImages==='function'?await loadProjectImages(report.workOrder):[];
      const buffer=buildProjectWorkbook({...report,images});
      const city=/مكة|makkah/i.test(APP.TITLE)?'MAK':'JED';
      const stamp=DateTime.now().setZone(APP.TZ||'Asia/Riyadh').toFormat('yyyyLLdd_HHmmss');
      const safeWo=clean(report.workOrder).replace(/[^0-9A-Za-z_-]+/g,'-').slice(0,40);
      const filename='VD-PDC-'+city+'-WO-'+safeWo+'-'+stamp+'.xlsx';
      res.set('Cache-Control','no-store');
      res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition','attachment; filename="'+filename+'"; filename*=UTF-8\'\''+encodeURIComponent(filename));
      res.send(buffer);
    }catch(e){
      console.error('Projects Report Engine Excel export:',e);
      res.status(400).json({ok:false,error:e.message||String(e)});
    }
  });
};
module.exports.buildProjectWorkbook=buildProjectWorkbook;