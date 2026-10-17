'use strict';
const assert=require('node:assert/strict');
const repo=require('node:path').resolve(__dirname);
const install=require('./pdc-meeting-2-manual-store');
async function run(){
 const sheet={exists:false,headers:[],rows:[],colCount:0},routes={};
 const api={spreadsheets:{
  get:async()=>({data:{sheets:sheet.exists?[{properties:{title:'PDC Meeting 2 Manual Data',sheetId:42,gridProperties:{columnCount:sheet.colCount}}}]:[]}}),
  batchUpdate:async args=>{const p=args.requestBody.requests[0].addSheet.properties;sheet.exists=true;sheet.colCount=p.gridProperties.columnCount;return {data:{}}},
  values:{
   get:async({range})=>({data:{values:range.includes('!A1:')?[sheet.headers]:sheet.rows}}),
   update:async({range,requestBody})=>{if(range.includes('!A1:'))sheet.headers=requestBody.values[0];else{const row=Number(range.match(/!A(\d+)/)?.[1]||2)-2;sheet.rows[row]=requestBody.values[0]}return {data:{}}},
   append:async({requestBody})=>{sheet.rows.push(requestBody.values[0]);return {data:{}}}
  }
 }};
 const app={get:(url,...f)=>routes['GET '+url]=f.at(-1),put:(url,...f)=>routes['PUT '+url]=f.at(-1)};
 const stubDt={now:()=>({setZone:()=>({toISO:()=>new Date().toISOString()})})};
 const svc=install({app,requireAuth_:()=>{},getSheets:async()=>api,SPREADSHEET_ID:'mock-makkah',qSheet:x=>"'"+x+"'",DateTime:stubDt,APP:{TZ:'Asia/Riyadh'}});
 const call=async(method,url,body={})=>{
  let status=200,result=null;
  const res={set:()=>{},status:x=>{status=x;return res},json:data=>{result={status,data};return result}};
  await routes[method+' '+url]({query:method==='GET'?body:{},body:method==='PUT'?body:{},session:{user:{email:'editor@example.test'}}},res);
  return result;
 };
 const dates={from:'2026-10-09',to:'2026-10-15'};
 const start=await call('GET','/api/pdc-meeting-2/manual',dates);
 assert.equal(start.status,200);assert.equal(start.data.manual.saved,false);
 assert.equal(sheet.exists,false,'read must not create sheet');
 const payload={...dates,version:0,financial:{approvedQuantities:571,purchaseOrders:102,paymentCertificates:131,paymentRate:0,noticesByMonth:[{month:'2026-05',count:159},{month:'2026-06',count:135}]},
  generators:{currentSites:0,closedSites:3,temporaryCables:0,generatorsTotal:1,observations:'عدم وجود أشرطة تحذيرية',workOrder:'7075',contractor:'منصور المساعد',workType:'استبدال طوارئ',workDescription:'استبدال محطة بكدج',location:'العزيزية',finding:'عدم وجود أشرطة تحذيرية حول المولدات',correctiveAction:'تم تعديل الوضع'},
  weekly:{completedConnections:49,completedProjects:6,receivedConnections155:10,receivedProjects155:1}};
 const saved=await call('PUT','/api/pdc-meeting-2/manual',payload);
 assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.data.manual.version,1);
 assert.equal(sheet.exists,true);assert.equal(sheet.headers.length,svc.fieldNames.length);
 assert.equal(sheet.rows.length,1);assert.equal(sheet.rows[0][27],'MANUAL');
 const restored=await call('GET','/api/pdc-meeting-2/manual',dates);
 assert.equal(restored.data.manual.financial.purchaseOrders,102);
 assert.equal(restored.data.manual.financial.noticesByMonth.length,2);
 assert.equal(restored.data.manual.generators.generatorsTotal,1);
 assert.equal(restored.data.manual.generators.closedSites,3);
 assert.equal(restored.data.manual.weekly.receivedConnections155,10);
 assert.equal(restored.data.manual.updatedBy,'editor@example.test');
 const stale=await call('PUT','/api/pdc-meeting-2/manual',payload);
 assert.equal(stale.status,409);assert.equal(stale.data.error,'RECORD_CHANGED_RELOAD');
 const changed=await call('PUT','/api/pdc-meeting-2/manual',{...payload,version:1,financial:{...payload.financial,purchaseOrders:105}});
 assert.equal(changed.status,200);assert.equal(changed.data.manual.version,2);
 assert.equal(sheet.rows.length,1,'same week updates the same row');
 assert.equal(sheet.rows[0][4],105);
 const different=await call('GET','/api/pdc-meeting-2/manual',{from:'2026-10-16',to:'2026-10-22'});
 assert.equal(different.data.manual.saved,false);
 const outOfRange=await call('PUT','/api/pdc-meeting-2/manual',{...payload,version:2,financial:{...payload.financial,paymentRate:140}});
 assert.equal(outOfRange.status,400);
 const badMonth=await call('PUT','/api/pdc-meeting-2/manual',{...payload,version:2,financial:{...payload.financial,noticesByMonth:[{month:'2026-13',count:2}]}});
 assert.equal(badMonth.status,400);
 console.log('PASS: per-week Google Sheet storage, nullable counts, monthly trends, read-back, author/date, upsert, version conflict, invalid value rejected');
}
run().catch(e=>{console.error(e);process.exit(1)});
