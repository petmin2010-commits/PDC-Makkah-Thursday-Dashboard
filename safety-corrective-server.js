'use strict';
const crypto=require('crypto');
const REPORTS='Safety Corrective Reports',FINDINGS='Safety Corrective Findings';
const RH=['ReportId','StartDate','EndDate','WeekLabel','TotalSites','VisitedSites','TotalVisits','PreparedBy','Notes','UpdatedAt','UpdatedBy','Highlights','ContractorBreakdown','ManualFindings','ManualOpen','ManualClosed'];
const FH=['ReportId','FindingId','WorkOrder','Contractor','Consultant','WorkType','Observation','CorrectiveAction','Status','BeforeDescription','AfterDescription','UpdatedAt','UpdatedBy'];
const idSafe=s=>String(s||'').trim().replace(/[^A-Za-z0-9_-]/g,'').slice(0,64);
const val=(x,n=1200)=>String(x??'').replace(/[\u0000-\u001F]/g,' ').trim().slice(0,n);
const natural=x=>{const n=Number(x);return Number.isFinite(n)&&n>=0?Math.min(10000000,Math.floor(n)):0};
module.exports=function installSafetyCorrective({app,requireAuth_,getSheets,SPREADSHEET_ID,qSheet,DateTime,APP,deletePhotos,getContractors}){
  let initPromise=null;
  const stamp=()=>DateTime.now().setZone(APP?.TZ||'Asia/Riyadh').toISO();
  const actor=req=>val(req.session?.user?.name||req.session?.user?.email||req.session?.user?.username||'dashboard',120);
  async function ready(){
    if(initPromise)return initPromise;
    initPromise=(async()=>{
      const sheets=await getSheets();
      const meta=await sheets.spreadsheets.get({spreadsheetId:SPREADSHEET_ID,fields:'sheets.properties(title,sheetId,gridProperties.columnCount)'});
      const sheetProps=new Map((meta.data.sheets||[]).map(s=>[s.properties?.title,s.properties]));
      for(const [title,headers] of [[REPORTS,RH],[FINDINGS,FH]]){
        if(!sheetProps.has(title))await sheets.spreadsheets.batchUpdate({spreadsheetId:SPREADSHEET_ID,requestBody:{requests:[{addSheet:{properties:{title,hidden:true,gridProperties:{rowCount:1500,columnCount:headers.length,frozenRowCount:1}}}}]}});
        else if((sheetProps.get(title)?.gridProperties?.columnCount||0)<headers.length){
          const properties=sheetProps.get(title);
          await sheets.spreadsheets.batchUpdate({spreadsheetId:SPREADSHEET_ID,requestBody:{requests:[{appendDimension:{sheetId:properties.sheetId,dimension:'COLUMNS',length:headers.length-properties.gridProperties.columnCount}}]}});
        }
        const range=qSheet(title)+'!A1:'+String.fromCharCode(64+headers.length)+'1';
        const current=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range});
        if(headers.some((h,i)=>current.data.values?.[0]?.[i]!==h))await sheets.spreadsheets.values.update({spreadsheetId:SPREADSHEET_ID,range,valueInputOption:'RAW',requestBody:{values:[headers]}});
      }
      return sheets;
    })().catch(e=>{initPromise=null;throw e});
    return initPromise;
  }
  async function all(sheet,cols){
    const sheets=await ready();
    const r=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet(sheet)+'!A2:'+cols});
    return (r.data.values||[]).map((data,index)=>({data,index:index+2})).filter(r=>r.data.some(x=>String(x??'').trim()));
  }
  async function upsert(sheet,record,keyIdx,cols){
    const sheets=await ready(),items=await all(sheet,cols);
    const prior=items.find(r=>r.data[keyIdx]===record[keyIdx]&&(sheet!==FINDINGS||r.data[0]===record[0]));
    const range=qSheet(sheet)+'!A'+(prior?.index||'')+':'+cols+(prior?.index||'');
    if(prior)await sheets.spreadsheets.values.update({spreadsheetId:SPREADSHEET_ID,range,valueInputOption:'RAW',requestBody:{values:[record]}});
    else await sheets.spreadsheets.values.append({spreadsheetId:SPREADSHEET_ID,range:qSheet(sheet)+'!A:'+cols,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[record]}});
  }
  async function removeRow(sheet,row,cols){
    const sheets=await ready();
    await sheets.spreadsheets.values.clear({spreadsheetId:SPREADSHEET_ID,range:qSheet(sheet)+'!A'+row+':'+cols+row});
  }

  // The added summary columns are report-specific and never mixed between cities.
  const summaryCount=n=>n===null||n===undefined||String(n).trim()===''?'':natural(n);
  function normalizeContractors(items){
    if(!Array.isArray(items))return [];
    return items.slice(0,60).map(x=>({name:val(x?.name,120),count:summaryCount(x?.count)}))
      .filter(x=>x.name).map(x=>({...x,count:x.count===''?0:x.count}));
  }
  function parseContractors(raw){
    try{return normalizeContractors(JSON.parse(String(raw||'[]')))}catch(_){return []}
  }
  // The finding records are the sole source of truth for contractor counts.
  // Existing report contractor names are retained (with zero when no findings).
  const contractorKey=s=>val(s,180).normalize('NFKC').replace(/\s+/g,' ').replace(/[\u0640\u064B-\u065F]/g,'').toLocaleLowerCase('ar');
  function derivedContractorBreakdown(findings,stored){
    const grouped=new Map();
    for(const row of normalizeContractors(stored)){
      const key=contractorKey(row.name);
      if(key&&!grouped.has(key))grouped.set(key,{name:row.name,count:0});
    }
    for(const finding of findings){
      const name=val(finding.contractor,180)||'غير محدد',key=contractorKey(name);
      if(!grouped.has(key))grouped.set(key,{name,count:0});
      grouped.get(key).count++;
    }
    return [...grouped.values()];
  }

  function metaRow(id,src,req){
    const sites=natural(src.totalSites),visited=natural(src.visitedSites);
    if(visited>sites)throw new Error('عدد المواقع التي تمت زيارتها لا يمكن أن يتجاوز عدد المواقع الإجمالي.');
    const highlight=String(src.highlights??'').replace(/\r/g,'').replace(/\u0000/g,'').trim().slice(0,3000);
    const contractors=normalizeContractors(src.contractorBreakdown);
    return [
      id,val(src.startDate,10),val(src.endDate,10),val(src.weekLabel,120),
      sites,visited,natural(src.totalVisits),val(src.preparedBy,180),val(src.notes,2000),
      stamp(),actor(req),highlight,JSON.stringify(contractors),
      summaryCount(src.manualFindings),summaryCount(src.manualOpen),summaryCount(src.manualClosed)
    ];
  }
  function metaObj(a){
    const count=x=>x===undefined||x===null||String(x).trim()===''?null:natural(x);
    return {
      id:a[0],startDate:a[1]||'',endDate:a[2]||'',weekLabel:a[3]||'',
      totalSites:natural(a[4]),visitedSites:natural(a[5]),totalVisits:natural(a[6]),
      preparedBy:a[7]||'',notes:a[8]||'',updatedAt:a[9]||'',updatedBy:a[10]||'',
      highlights:a[11]||'',contractorBreakdown:parseContractors(a[12]),
      manualFindings:count(a[13]),manualOpen:count(a[14]),manualClosed:count(a[15])
    };
  }
  function findingObj(a){
    return {reportId:a[0],id:a[1],workOrder:a[2]||'',contractor:a[3]||'',consultant:a[4]||'',workType:a[5]||'',observation:a[6]||'',correctiveAction:a[7]||'',status:a[8]||'مفتوحة',beforeDescription:a[9]||'',afterDescription:a[10]||'',updatedAt:a[11]||'',updatedBy:a[12]||''};
  }
  const run=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store');res.json({ok:true,...await fn(req)})}catch(e){console.error('safety corrective',e.message);res.status(400).json({ok:false,error:e.message||'تعذر تنفيذ العملية'})}};
  app.get('/api/safety-corrective/work-types',requireAuth_,run(async()=>{
    const sheets=await getSheets();
    const response=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet('info')+'!E2:F',valueRenderOption:'FORMATTED_VALUE'});
    const seen=new Set(),workTypes=[];
    for(const row of response.data.values||[]){
      const code=val(row[0],80),description=val(row[1],300);
      if(!code||seen.has(code))continue;
      seen.add(code);workTypes.push({code,description});
    }
    if(!seen.has('طارئ'))workTypes.push({code:'طارئ',description:'أعمال طارئة'});
    return {workTypes,source:'info!E2:F'};
  }));
  app.get('/api/safety-corrective/contractors',requireAuth_,run(async()=>({contractors:typeof getContractors==='function'?await getContractors():[]})));
  app.get('/api/safety-corrective/reports',requireAuth_,run(async()=>{
    const rows=await all(REPORTS,'P');
    return {reports:rows.map(r=>metaObj(r.data)).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))};
  }));
  app.post('/api/safety-corrective/reports',requireAuth_,run(async req=>{
    const id='SR'+crypto.randomBytes(6).toString('hex');
    const row=metaRow(id,req.body||{},req);
    if(!/^\d{4}-\d\d-\d\d$/.test(row[1])||!/^\d{4}-\d\d-\d\d$/.test(row[2])||row[1]>row[2])throw new Error('حدد تاريخ بداية ونهاية صالحين للتقرير.');
    await upsert(REPORTS,row,0,'P');
    return {report:metaObj(row)};
  }));
  app.put('/api/safety-corrective/reports/:id',requireAuth_,run(async req=>{
    const id=idSafe(req.params.id),found=(await all(REPORTS,'P')).find(r=>r.data[0]===id);
    if(!found)throw new Error('التقرير المطلوب غير موجود.');
    const changes={...metaObj(found.data),...(req.body||{})};
    const findings=(await all(FINDINGS,'M')).filter(item=>item.data[0]===id).map(item=>findingObj(item.data));
    changes.contractorBreakdown=derivedContractorBreakdown(findings,changes.contractorBreakdown);
    const row=metaRow(id,changes,req);
    if(!/^\d{4}-\d\d-\d\d$/.test(row[1])||!/^\d{4}-\d\d-\d\d$/.test(row[2])||row[1]>row[2])throw new Error('حدد تاريخ بداية ونهاية صالحين للتقرير.');
    await upsert(REPORTS,row,0,'P');return {report:metaObj(row)};
  }));
  app.get('/api/safety-corrective/reports/:id',requireAuth_,run(async req=>{
    const id=idSafe(req.params.id),r=(await all(REPORTS,'P')).find(x=>x.data[0]===id);
    if(!r)throw new Error('لم يتم العثور على التقرير.');
    const findings=(await all(FINDINGS,'M')).filter(x=>x.data[0]===id).map(x=>findingObj(x.data));
    const report=metaObj(r.data);
    report.contractorBreakdown=derivedContractorBreakdown(findings,report.contractorBreakdown);
    return {report,findings};
  }));
  app.post('/api/safety-corrective/reports/:id/findings',requireAuth_,run(async req=>{
    const reportId=idSafe(req.params.id);
    if(!(await all(REPORTS,'P')).some(x=>x.data[0]===reportId))throw new Error('احفظ التقرير أولاً.');
    const b=req.body||{},id=idSafe(b.id)||'F'+crypto.randomBytes(7).toString('hex');
    const allowed=['مفتوحة','مغلقة','جاري التصحيح'];
    const row=[reportId,id,val(b.workOrder,40),val(b.contractor,180),val(b.consultant,180),val(b.workType,80),val(b.observation,1700),val(b.correctiveAction,1700),allowed.includes(b.status)?b.status:'مفتوحة',val(b.beforeDescription,1000),val(b.afterDescription,1000),stamp(),actor(req)];
    await upsert(FINDINGS,row,1,'M');return {finding:findingObj(row)};
  }));
  app.delete('/api/safety-corrective/reports/:id/findings/:findingId',requireAuth_,run(async req=>{
    const reportId=idSafe(req.params.id),id=idSafe(req.params.findingId);
    const row=(await all(FINDINGS,'M')).find(x=>x.data[0]===reportId&&x.data[1]===id);
    if(!row)throw new Error('الملاحظة غير موجودة.');
    if(deletePhotos)await deletePhotos(reportId+'--'+id);await removeRow(FINDINGS,row.index,'M');return {deleted:true};
  }));
};
