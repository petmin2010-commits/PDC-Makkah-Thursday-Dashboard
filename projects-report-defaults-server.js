'use strict';

const SHEET='Projects Report Engine Data';
const HEADERS=[
 'Record ID','Work Order','Section','Sequence','Field / Item / Permit No.','Text Value / Description',
 'Numeric Value','Unit','Planned / Required Qty','Executed / Issued Qty','Period Qty','Weight / Planned Progress %',
 'Status','Start / Observation Date','End / Expected Date','Responsible / Issuing Authority','Location / Neighborhood',
 'Category / Impact','Action / Support Required','URL / Attachment','Notes','Updated At','Updated By'
];
const DATA_HEADERS=HEADERS.slice(1);
const SECTIONS=new Set([
 'PROJECT_EXTRA','BOQ_ITEM','MATERIAL','PERMIT_DETAIL','PLAN_POINT','MILESTONE',
 'ISSUE_RISK','PERIOD_SUMMARY','MANAGEMENT_NOTE','IMAGE','SIGNATURE'
]);
const MAX_ROWS_PER_WO=500;

function clean(v){return String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim()}
function safeWo(v){return clean(v).replace(/[^0-9A-Za-z_-]/g,'').slice(0,80)}
function safeText(v,max=4000){return clean(v).slice(0,max)}
function userLabel(req){return clean(req?.session?.user?.name||req?.session?.user?.email||req?.session?.user?.username||'dashboard')}

module.exports=function installProjectDefaults(ctx){
 const {app,requireAuth_,getSheets,SPREADSHEET_ID,qSheet,APP,DateTime,invalidateProjectReportDataCache}=ctx;
 let sheetReady=null;
 let indexCache={at:0,rows:null};
 const INDEX_TTL_MS=15000;

 async function ensureSheet(){
  const sheets=await getSheets();
  if(sheetReady)return {sheets,sheetId:sheetReady.sheetId};
  const meta=await sheets.spreadsheets.get({spreadsheetId:SPREADSHEET_ID,fields:'sheets.properties(sheetId,title,gridProperties)'});
  let found=(meta.data.sheets||[]).find(s=>s.properties?.title===SHEET);
  if(!found){
   const add=await sheets.spreadsheets.batchUpdate({
    spreadsheetId:SPREADSHEET_ID,
    requestBody:{requests:[{addSheet:{properties:{title:SHEET,gridProperties:{rowCount:5000,columnCount:23,frozenRowCount:1}}}}]}
   });
   found={properties:add.data.replies?.[0]?.addSheet?.properties};
  }
  const h=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:`${qSheet(SHEET)}!A1:W1`});
  const row=h.data.values?.[0]||[];
  if(HEADERS.some((x,i)=>row[i]!==x)){
   await sheets.spreadsheets.values.update({
    spreadsheetId:SPREADSHEET_ID,range:`${qSheet(SHEET)}!A1:W1`,valueInputOption:'RAW',requestBody:{values:[HEADERS]}
   });
  }
  sheetReady={sheetId:found.properties.sheetId};
  return {sheets,sheetId:sheetReady.sheetId};
 }

 async function indexRows_(force=false){
  if(!force&&indexCache.rows&&Date.now()-indexCache.at<INDEX_TTL_MS)return indexCache.rows;
  const {sheets}=await ensureSheet();
  const r=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:`${qSheet(SHEET)}!B2:C`});
  const rows=(r.data.values||[]).map((v,i)=>({row:i+2,wo:clean(v[0]),section:clean(v[1])}));
  indexCache={at:Date.now(),rows};
  return rows;
 }

 function groupRows_(nums){
  const sorted=[...new Set(nums)].sort((a,b)=>a-b),out=[];
  for(const n of sorted){const last=out[out.length-1];if(last&&n===last.end+1)last.end=n;else out.push({start:n,end:n})}
  return out;
 }

 function objectFromRow_(v,rowNumber){
  const o={_row:rowNumber};
  DATA_HEADERS.forEach((h,i)=>o[h]=v[i]??'');
  return o;
 }

 async function loadDefaults(workOrder){
  const wo=safeWo(workOrder);if(!wo)return [];
  const {sheets}=await ensureSheet(),idx=await indexRows_();
  const nums=idx.filter(x=>x.wo===wo).map(x=>x.row);
  const groups=groupRows_(nums);if(!groups.length)return [];
  const ranges=groups.map(g=>`${qSheet(SHEET)}!B${g.start}:W${g.end}`);
  const r=await sheets.spreadsheets.values.batchGet({spreadsheetId:SPREADSHEET_ID,ranges,valueRenderOption:'FORMATTED_VALUE'});
  const out=[];
  groups.forEach((g,gi)=>{
   const vals=r.data.valueRanges?.[gi]?.values||[];
   for(let i=0;i<=g.end-g.start;i++){
    const v=vals[i]||[];
    if(clean(v[0])===wo)out.push(objectFromRow_(v,g.start+i));
   }
  });
  return out.sort((a,b)=>{
   const sa=clean(a.Section),sb=clean(b.Section);
   return sa.localeCompare(sb)||Number(a.Sequence||0)-Number(b.Sequence||0)||Number(a._row||0)-Number(b._row||0);
  });
 }

 function normalizeRow_(raw,wo,seq,now,by){
  const section=clean(raw?.Section).toUpperCase();
  if(!SECTIONS.has(section))throw new Error('نوع سجل غير مدعوم: '+section);
  const v=[
   wo,section,Number.isFinite(Number(raw?.Sequence))?Number(raw.Sequence):seq,
   safeText(raw?.['Field / Item / Permit No.'],500),
   safeText(raw?.['Text Value / Description'],4000),
   raw?.['Numeric Value']??'',
   safeText(raw?.Unit,120),
   raw?.['Planned / Required Qty']??'',
   raw?.['Executed / Issued Qty']??'',
   raw?.['Period Qty']??'',
   raw?.['Weight / Planned Progress %']??'',
   safeText(raw?.Status,500),
   safeText(raw?.['Start / Observation Date'],120),
   safeText(raw?.['End / Expected Date'],120),
   safeText(raw?.['Responsible / Issuing Authority'],1000),
   safeText(raw?.['Location / Neighborhood'],1000),
   safeText(raw?.['Category / Impact'],1000),
   safeText(raw?.['Action / Support Required'],4000),
   safeText(raw?.['URL / Attachment'],4000),
   safeText(raw?.Notes,4000),
   now,by
  ];
  return v;
 }

 async function saveDefaults(workOrder,rows,updatedBy){
  const wo=safeWo(workOrder);if(!wo)throw new Error('رقم أمر العمل غير صالح.');
  if(!Array.isArray(rows))throw new Error('بيانات الحفظ غير صالحة.');
  if(rows.length>MAX_ROWS_PER_WO)throw new Error('عدد السجلات أكبر من الحد المسموح.');
  const {sheets}=await ensureSheet(),idx=await indexRows_();
  const existing=idx.filter(x=>x.wo===wo).map(x=>x.row).sort((a,b)=>a-b);
  if(existing.length){
   await sheets.spreadsheets.values.batchClear({
    spreadsheetId:SPREADSHEET_ID,
    requestBody:{ranges:existing.map(n=>`${qSheet(SHEET)}!B${n}:W${n}`)}
   });
  }
  let saved=[];
  let assigned=[];
  if(rows.length){
   const occupied=idx.filter(x=>x.wo&&x.wo!==wo).map(x=>x.row);
   let next=Math.max(1,...occupied,...existing)+1;
   for(let i=0;i<rows.length;i++)assigned.push(i<existing.length?existing[i]:next++);
   const now=DateTime.now().setZone(APP?.TZ||'Asia/Riyadh').toISO();
   const by=safeText(updatedBy,500);
   const counters={};
   const data=rows.map((raw,i)=>{
    const sec=clean(raw?.Section).toUpperCase();
    counters[sec]=(counters[sec]||0)+1;
    const values=normalizeRow_(raw,wo,counters[sec],now,by);
    return {range:`${qSheet(SHEET)}!B${assigned[i]}:W${assigned[i]}`,values:[values]};
   });
   await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId:SPREADSHEET_ID,
    requestBody:{valueInputOption:'RAW',data}
   });
   saved=data.map((d,i)=>objectFromRow_(d.values[0],assigned[i]));
  }
  const kept=idx.filter(x=>x.wo!==wo);
  const added=saved.map((r,i)=>({row:assigned[i],wo,section:clean(r.Section)}));
  indexCache={at:Date.now(),rows:[...kept,...added].sort((a,b)=>a.row-b.row)};
  if(typeof invalidateProjectReportDataCache==='function')invalidateProjectReportDataCache();
  return saved;
 }

 app.get('/api/projects-report-engine/defaults/:workOrder',requireAuth_,async(req,res)=>{
  try{
   const rows=await loadDefaults(req.params.workOrder);
   res.set('Cache-Control','no-store');
   res.json({ok:true,workOrder:safeWo(req.params.workOrder),rows,sections:[...SECTIONS]});
  }catch(e){
   console.error('Project defaults load:',e);
   res.status(500).json({ok:false,error:e.message||String(e)});
  }
 });

 app.put('/api/projects-report-engine/defaults/:workOrder',requireAuth_,async(req,res)=>{
  try{
   const rows=await saveDefaults(req.params.workOrder,req.body?.rows||[],userLabel(req));
   res.set('Cache-Control','no-store');
   res.json({ok:true,workOrder:safeWo(req.params.workOrder),rows});
  }catch(e){
   console.error('Project defaults save:',e);
   res.status(400).json({ok:false,error:e.message||String(e)});
  }
 });

 app.delete('/api/projects-report-engine/defaults/:workOrder',requireAuth_,async(req,res)=>{
  try{
   await saveDefaults(req.params.workOrder,[],userLabel(req));
   res.set('Cache-Control','no-store');
   res.json({ok:true,workOrder:safeWo(req.params.workOrder),rows:[]});
  }catch(e){
   console.error('Project defaults delete:',e);
   res.status(400).json({ok:false,error:e.message||String(e)});
  }
 });

 return {loadDefaults,saveDefaults,ensureSheet};
};
