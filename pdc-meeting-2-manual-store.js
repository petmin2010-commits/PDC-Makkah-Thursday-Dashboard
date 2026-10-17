'use strict';
/* PDC Meeting 2 weekly manual bridge.
 * Stored in the same Makkah workbook, one row per date range, with named columns.
 * No fake default values; blank means unknown. Version guards prevent stale overwrites.
 */
const SHEET='PDC Meeting 2 Manual Data';
const COUNT_FIELDS=[
 'approvedQuantities','purchaseOrders','paymentCertificates',
 'currentSites','closedSites','temporaryCables','generatorsTotal',
 'completedConnections','completedProjects','receivedConnections155','receivedProjects155'
];
const NAMES=[
 'PeriodKey','FromDate','ToDate','ApprovedQuantities','PurchaseOrders','PaymentCertificates','PaymentRate','NoticesByMonthJson',
 'CurrentSites','ClosedSites','TemporaryCables','GeneratorsTotal',
 'GeneratorObservations','GeneratorWorkOrder','GeneratorContractor','GeneratorWorkType','GeneratorWorkDescription',
 'GeneratorLocation','GeneratorFinding','GeneratorCorrectiveAction',
 'WeeklyCompletedConnections','WeeklyCompletedProjects','WeeklyReceivedConnections155','WeeklyReceivedProjects155',
 'UpdatedAt','UpdatedBy','Version','DataMode'
];
const col=n=>{let s='';for(let i=n;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};
const lastCol=col(NAMES.length);
const numOrNull=v=>v===''||v===null||v===undefined?null:Number(v);
const text=v=>String(v??'').replace(/[\u0000-\u001F]/g,' ').trim();
function readCount(v,label){
 if(v==null||String(v).trim()==='')return null;
 const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>100000000)throw Error('INVALID_COUNT_'+label);
 return n;
}
function readRate(v){
 if(v==null||String(v).trim()==='')return null;
 const n=Number(v);if(!Number.isFinite(n)||n<0||n>100||Math.round(n*1000)/1000!==n)throw Error('INVALID_PAYMENT_RATE');
 return n;
}
const dateOkay=v=>/^20\d{2}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
function validatePeriod(from,to){
 if(!dateOkay(from)||!dateOkay(to)||from>to||(Date.parse(to)-Date.parse(from))>62*86400000)throw Error('INVALID_PERIOD');
 return {from,to,key:from+'_'+to};
}
function cleanNotices(v){
 if(!Array.isArray(v))throw Error('INVALID_MONTHLY_NOTICES');
 if(v.length>24)throw Error('TOO_MANY_MONTHS');
 const unique=new Set();
 return v.map(row=>{
  const month=text(row?.month);
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||unique.has(month))throw Error('INVALID_OR_DUPLICATE_MONTH');
  unique.add(month);return {month,count:readCount(row?.count,month)};
 }).sort((a,b)=>a.month.localeCompare(b.month));
}
function sanitize(v){
 const src=v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const f=src.financial&&typeof src.financial==='object'?src.financial:{};
 const g=src.generators&&typeof src.generators==='object'?src.generators:{};
 const w=src.weekly&&typeof src.weekly==='object'?src.weekly:{};
 const financial={
  approvedQuantities:readCount(f.approvedQuantities,'approvedQuantities'),
  purchaseOrders:readCount(f.purchaseOrders,'purchaseOrders'),
  paymentCertificates:readCount(f.paymentCertificates,'paymentCertificates'),
  paymentRate:readRate(f.paymentRate),
  noticesByMonth:cleanNotices(f.noticesByMonth??[])
 };
 const generators={
  currentSites:readCount(g.currentSites,'currentSites'),
  closedSites:readCount(g.closedSites,'closedSites'),
  temporaryCables:readCount(g.temporaryCables,'temporaryCables'),
  generatorsTotal:readCount(g.generatorsTotal,'generatorsTotal'),
  observations:text(g.observations).slice(0,3000),
  workOrder:text(g.workOrder).slice(0,60),
  contractor:text(g.contractor).slice(0,180),
  workType:text(g.workType).slice(0,180),
  workDescription:text(g.workDescription).slice(0,1500),
  location:text(g.location).slice(0,250),
  finding:text(g.finding).slice(0,2000),
  correctiveAction:text(g.correctiveAction).slice(0,2000)
 };
 const weekly={
  completedConnections:readCount(w.completedConnections,'completedConnections'),
  completedProjects:readCount(w.completedProjects,'completedProjects'),
  receivedConnections155:readCount(w.receivedConnections155,'receivedConnections155'),
  receivedProjects155:readCount(w.receivedProjects155,'receivedProjects155')
 };
 return {financial,generators,weekly};
}
const blank=(period)=>({from:period.from,to:period.to,key:period.key,saved:false,version:0,
 updatedAt:'',updatedBy:'',...sanitize({})});
const encode=r=>[
 r.key,r.from,r.to,r.financial.approvedQuantities??'',r.financial.purchaseOrders??'',r.financial.paymentCertificates??'',r.financial.paymentRate??'',
 JSON.stringify(r.financial.noticesByMonth),
 r.generators.currentSites??'',r.generators.closedSites??'',r.generators.temporaryCables??'',r.generators.generatorsTotal??'',
 r.generators.observations,r.generators.workOrder,r.generators.contractor,r.generators.workType,r.generators.workDescription,r.generators.location,
 r.generators.finding,r.generators.correctiveAction,
 r.weekly.completedConnections??'',r.weekly.completedProjects??'',r.weekly.receivedConnections155??'',r.weekly.receivedProjects155??'',
 r.updatedAt,r.updatedBy,r.version,'MANUAL'
];
const decode=(a,period)=>{
 let months=[];try{months=JSON.parse(String(a[7]||'[]'))}catch(_){}
 const data=sanitize({financial:{
  approvedQuantities:a[3],purchaseOrders:a[4],paymentCertificates:a[5],paymentRate:a[6],noticesByMonth:months
 },generators:{
  currentSites:a[8],closedSites:a[9],temporaryCables:a[10],generatorsTotal:a[11],
  observations:a[12],workOrder:a[13],contractor:a[14],workType:a[15],
  workDescription:a[16],location:a[17],finding:a[18],correctiveAction:a[19]
 },weekly:{completedConnections:a[20],completedProjects:a[21],receivedConnections155:a[22],receivedProjects155:a[23]}});
 return {...blank(period),...data,saved:true,updatedAt:String(a[24]||''),updatedBy:String(a[25]||''),version:Number(a[26])||1};
};
module.exports=function install({app,requireAuth_,getSheets,SPREADSHEET_ID,qSheet,DateTime,APP}){
 let initPromise=null,queue=Promise.resolve();
 async function getMeta(){
  const api=await getSheets();
  const metadata=await api.spreadsheets.get({spreadsheetId:SPREADSHEET_ID,fields:'sheets.properties(title,sheetId,gridProperties.columnCount)'});
  return {api,prop:metadata.data.sheets?.find(x=>x.properties?.title===SHEET)?.properties};
 }
 async function ensure(){
  if(initPromise)return initPromise;
  initPromise=(async()=>{
   const {api,prop}=await getMeta();
   if(!prop){
    await api.spreadsheets.batchUpdate({spreadsheetId:SPREADSHEET_ID,requestBody:{requests:[{addSheet:{properties:{title:SHEET,hidden:true,gridProperties:{rowCount:1000,columnCount:NAMES.length,frozenRowCount:1}}}}]}});
    await api.spreadsheets.values.update({spreadsheetId:SPREADSHEET_ID,range:qSheet(SHEET)+'!A1:'+lastCol+'1',valueInputOption:'RAW',requestBody:{values:[NAMES]}});
   }else{
    if((prop.gridProperties?.columnCount||0)<NAMES.length)throw Error('PDC2_MANUAL_SHEET_COLUMN_LIMIT');
    const head=await api.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet(SHEET)+'!A1:'+lastCol+'1'});
    if(NAMES.some((h,i)=>head.data.values?.[0]?.[i]!==h))throw Error('PDC2_MANUAL_SHEET_SCHEMA_MISMATCH');
   }
   return api;
  })().catch(e=>{initPromise=null;throw e});
  return initPromise;
 }
 async function read(period){
  const {api,prop}=await getMeta();if(!prop)return {item:blank(period),rowNumber:null};
  const response=await api.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet(SHEET)+'!A2:'+lastCol});
  const records=response.data.values||[];
  let idx=-1;for(let i=0;i<records.length;i++)if(records[i]?.[0]===period.key)idx=i;
  return idx<0?{item:blank(period),rowNumber:null}:{item:decode(records[idx],period),rowNumber:idx+2};
 }
 async function save(period,data,req){
  const normalized=sanitize(data);
  await ensure();
  const current=await read(period);
  const wanted=Number(req.body?.version);
  if(!Number.isSafeInteger(wanted)||wanted<0||wanted!==current.item.version){
   const e=Error('RECORD_CHANGED_RELOAD');e.code=409;throw e;
  }
  const actor=text(req.session?.user?.name||req.session?.user?.email||req.session?.user?.username||'dashboard').slice(0,180);
  const now=DateTime.now().setZone(APP?.TZ||'Asia/Riyadh').toISO();
  const row={...blank(period),...normalized,saved:true,version:wanted+1,updatedAt:now,updatedBy:actor};
  const api=await getSheets();const values=[encode(row)];
  if(current.rowNumber){
   const a=current.rowNumber;
   await api.spreadsheets.values.update({spreadsheetId:SPREADSHEET_ID,range:qSheet(SHEET)+'!A'+a+':'+lastCol+a,valueInputOption:'RAW',requestBody:{values}});
  }else{
   await api.spreadsheets.values.append({spreadsheetId:SPREADSHEET_ID,range:qSheet(SHEET)+'!A:'+lastCol,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values}});
  }
  return row;
 }
 const guard=fn=>async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{
   const period=validatePeriod(String(req.query.from||req.body?.from||''),String(req.query.to||req.body?.to||''));
   res.json({ok:true,manual:await fn(period,req)});
  }catch(e){res.status(e.code||400).json({ok:false,error:String(e.message||e)})}
 };
 app.get('/api/pdc-meeting-2/manual',requireAuth_,guard(async p=>(await read(p)).item));
 app.put('/api/pdc-meeting-2/manual',requireAuth_,guard((p,req)=>{
  // Serialize writers on the current Render instance; version rejects stale clients.
  const job=queue.then(()=>save(p,req.body,req));queue=job.catch(()=>{});return job;
 }));
 async function listRecords(){
  const {api,prop}=await getMeta();if(!prop)return [];
  const response=await api.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet(SHEET)+'!A2:'+lastCol});
  const items=[],seen=new Set();
  for(const row of response.data.values||[]){
   try{
    const range=validatePeriod(String(row?.[1]||''),String(row?.[2]||''));
    if(seen.has(range.key))continue;seen.add(range.key);
    items.push(decode(row,range));
   }catch(e){/* malformed historical row: do not block the dashboard */}
  }
  return items.sort((a,b)=>b.to.localeCompare(a.to)||String(b.updatedAt).localeCompare(String(a.updatedAt)));
 }
 return {getRecord:async(from,to)=>(await read(validatePeriod(from,to))).item,
  listRecords,fieldNames:NAMES,sanitize};
};
