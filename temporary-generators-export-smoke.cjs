'use strict';
const assert=require('node:assert/strict');
const {unzipSync,strFromU8}=require('fflate');
const {DateTime}=require('luxon');
const install=require('./temporary-generators-server');
function sheetMock(){
  const source={
    get:async()=>({data:{sheets:[
      {properties:{title:'Temporary Generators Reports',sheetId:19,gridProperties:{columnCount:20}}},
      {properties:{title:'Temporary Generators Findings',sheetId:20,gridProperties:{columnCount:15}}}
    ]}}),
    values:{
      get:async ({range})=>{
        if(range.includes('!A1:T1'))return {data:{values:[['ReportId','StartDate','EndDate','WeekLabel','TotalSites','VisitedSites','TotalVisits','PreparedBy','Notes','UpdatedAt','UpdatedBy','Highlights','ContractorBreakdown','ManualFindings','ManualOpen','ManualClosed','CurrentSites','ClosedSites','TemporaryCables','GeneratorsTotal']]}};
        if(range.includes('!A1:O1'))return {data:{values:[['ReportId','FindingId','WorkOrder','Contractor','Consultant','WorkType','Observation','CorrectiveAction','Status','BeforeDescription','AfterDescription','UpdatedAt','UpdatedBy','Location','WorkDescription']]}};
        if(range.includes('!A2:T'))return {data:{values:[['TGTEST','2026-10-11','2026-10-17','Weekly Report',9,8,8,'Tester','','2026-10-18T10:00:00+03:00','Tester','','[]','','','',7,2,3,4]]}};
        if(range.includes('!A2:O'))return {data:{values:[]}};
        throw Error('Unexpected range '+range);
      }
    },
    batchUpdate:async()=>{throw Error('Unexpected sheet mutation')}
  };
  return {spreadsheets:source};
}
async function run(city,expectedCity){
 const routes={};
 const app={get:(route,...handlers)=>{routes[route]=handlers.at(-1)},post:()=>{},put:()=>{},delete:()=>{}};
 install({app,requireAuth_:(req,res,next)=>next(),getSheets:async()=>sheetMock(),SPREADSHEET_ID:'dummy',qSheet:x=>"'"+x+"'",DateTime,APP:{TITLE:city,TZ:'Asia/Riyadh'},getFindingPhotos:async()=>[],deletePhotos:async()=>{}});
 const endpoint=routes['/api/temporary-generators/reports/:id/pptx'];
 assert.equal(typeof endpoint,'function');
 const response={statusCode:200,headers:{},body:null,set(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(data){this.body=data;return this},send(bytes){this.body=bytes;return this}};
 await endpoint({params:{id:'TGTEST'},session:{user:{name:'tester'}}},response);
 assert.equal(response.statusCode,200,JSON.stringify(response.body));
 assert(Buffer.isBuffer(response.body),'PPTX must be a binary download');
 assert(response.headers['Content-Disposition'].includes(expectedCity+'_Weekly.pptx'),'Wrong city filename');
 assert.equal(response.headers['Content-Type'],'application/vnd.openxmlformats-officedocument.presentationml.presentation');
 const pptx=unzipSync(new Uint8Array(response.body));
 assert(pptx['ppt/presentation.xml']);
 const presentation=strFromU8(pptx['ppt/presentation.xml']);
 assert((presentation.match(/<p:sldId\b/g)||[]).length>=6,'Generated deck lacks source slides');
 console.log('PASS '+expectedCity+' native generator PPTX endpoint: '+response.body.length+' bytes, original deck intact, valid Content-Disposition');
}
(async()=>{await run('PDC Makkah Dashboard','Makkah');await run('PDC Jeddah Dashboard','Jeddah');})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
