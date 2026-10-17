'use strict';
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const puppeteer=require('C:/Users/a_salama/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const ROOT=path.resolve(__dirname,'..');
const cities=[path.basename(__dirname)];
const empty=(from,to)=>({from,to,key:from+'_'+to,saved:false,version:0,updatedAt:'',updatedBy:'',
 financial:{approvedQuantities:null,purchaseOrders:null,paymentCertificates:null,paymentRate:null,noticesByMonth:[]},
 generators:{currentSites:null,closedSites:null,temporaryCables:null,generatorsTotal:null,observations:'',workOrder:'',contractor:'',workType:'',workDescription:'',location:'',finding:'',correctiveAction:''},
 weekly:{completedConnections:null,completedProjects:null,receivedConnections155:null,receivedProjects155:null}});
const newer={...empty('2026-10-09','2026-10-15'),saved:true,version:2,updatedAt:'2026-10-16T09:00:00Z',financial:{...empty('','').financial,approvedQuantities:571,purchaseOrders:102,noticesByMonth:[{month:'2026-05',count:159}]}};
const older={...empty('2026-10-02','2026-10-08'),saved:true,version:1,updatedAt:'2026-10-09T09:00:00Z',financial:{...empty('','').financial,approvedQuantities:300,purchaseOrders:90}};
async function backend(city){
 const folder=path.join(ROOT,city),routes={};
 const app={get:(url,...f)=>{routes[url]=f.at(-1)}};
 const api={spreadsheets:{values:{get:async({range})=>({data:{values:
  range.includes('Safety Corrective Reports')?[
   ['S1','2026-10-09','2026-10-15','week2',92,0,73,0,0,'2026-10-16'],
   ['S0','2026-10-02','2026-10-08','week1',91,0,52,0,0,'2026-10-09']
  ]:range.includes('Safety Corrective Findings')?[
   ['S1','x1','','المقاول أ','','','ملاحظة السلامة','','مفتوح'],
   ['S0','x2','','المقاول ب','','','ملاحظة ثانية','','مغلق']
  ]:range.includes('Quality Corrective Reports')?[
   ['Q1','2026-10-09','2026-10-15','week2',87,0,87,0,0,'2026-10-16']
  ]:range.includes('Quality Corrective Findings')?[
   ['Q1','q1','','المقاول أ','','','ملاحظة الجودة','','مفتوح']
  ]:[]
 }})}}};
 require(path.join(folder,'pdc-meeting-2-server.js'))({app,requireAuth_:()=>{},getWednesdayMeetingData:async()=>({rows:[
  {workOrder:'1',completed:true,executionRaw:'تم التنفيذ',section:'المشاريع',contractor155Status:'مستلم 155',contractor:'المقاول أ'},
  {workOrder:'1',completed:true,executionRaw:'تم التنفيذ',section:'المشاريع'},
  {workOrder:'2',completed:false,executionRaw:'لم يتم البدء',section:'التوصيلات',contractor:'المقاول ب'}
 ]}),getPageData:async key=>({rows:key==='permits'?[{permitStatus:'تم الإصدار'},{permitStatus:'قيد التنسيق'}]:
   [{status:'منجز',contractor:'المقاول أ',emergencyType:'طارئ'},{status:'جاري التنفيذ',contractor:'المقاول ب',emergencyType:'مجدول'}]}),
 getSheets:async()=>api,SPREADSHEET_ID:'mock',qSheet:x=>x,APP:{},
 manualStore:{listRecords:async()=>[newer,older]}});
 let result=null,status=200;const res={set(){},json(x){result=x;return x},status(code){status=code;return this}};
 await routes['/api/pdc-meeting-2/summary']({query:{from:'2026-01-01',to:'2026-10-17'}},res);
 assert.equal(status,200,'no INVALID_PERIOD even with long supplied range');
 assert.equal(result.scope,'all');assert.equal(result.construction.total,3);assert.equal(result.construction.uniqueWorkOrders,2);assert.equal(result.construction.repeatedRows,1);assert.equal(result.construction.countBasis,'rows');assert.equal(result.permits.total,2);
 assert.equal(result.safety.reportsCount,2);assert.equal(result.safety.visits,125);assert.equal(result.safety.findings,2);
 assert.equal(result.quality.reportsCount,1);assert.equal(result.quality.findings,1);
 assert.equal(result.manualHistory.length,2);assert.equal(result.financial.purchaseOrders,102);
 assert.equal(result.weekly.available,false);assert.equal(result.exports.pdfReady,false);
 console.log(city+' SERVER PASS: all-time operational data, both safety reports, manual history, latest snapshot, no period validation');
}
async function browser(city,browser){
 const folder=path.join(ROOT,city),pub=path.join(folder,'public'),html=fs.readFileSync(path.join(pub,'index.html'),'utf8');
 assert(html.includes('pdc-meeting-2.js?v=20261018-row-count-4'));
 const page=await browser.newPage();
 await page.setContent('<html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><div id="pageTitle"></div><div id="filterBar"></div><aside class="sidebar"><nav id="nav"><button class="nav-item" data-page="wednesdayMeeting"><span>اجتماع PDC</span></button><button class="nav-item" id="pdcMeeting2Nav" data-page="pdcMeeting2"><span>اجتماع PDC 2</span></button></nav></aside><main><section class="page active" id="meetingPage"></section></main></body></html>');
 await page.evaluate(({newer,older})=>{
  window.__entries={[newer.from+'_'+newer.to]:newer,[older.from+'_'+older.to]:older};
  window.__requests=[];
  window.fetch=async(uri,options={})=>{
   const u=new URL(uri,'https://example.local'),p=u.searchParams,j=(data,status=200)=>({ok:status<400,status,json:async()=>data});
   window.__requests.push({url:u.pathname,search:u.search,method:options.method||'GET'});
   if(u.pathname.endsWith('/summary')){
    const entries=Object.values(window.__entries).sort((a,b)=>b.to.localeCompare(a.to));
    const m=entries[0]||{};
    return j({ok:true,scope:'all',updatedAt:'2026-10-17T15:00:00Z',period:{from:m.from,to:m.to},manual:m,manualHistory:entries,
     construction:{available:true,total:5,completed:2,inProgress:2,notStarted:1,received155:1,bySection:[],byContractor:[]},
     permits:{available:true,total:3,byStatus:[]},emergency:{available:true,total:2,completed:1,scheduled:1,byContractor:[]},
     safety:{available:true,reportsCount:2,visits:125,findings:2,byContractor:[]},
     quality:{available:true,reportsCount:1,visits:87,findings:1,byContractor:[]},
     financial:{...m.financial,available:true},generators:{...m.generators,available:false},weekly:{...m.weekly,available:false},
     exports:{pptxReady:false,pdfReady:false,reason:'تصدير كامل غير جاهز'}});
   }
   if(u.pathname.endsWith('/manual')&&options.method==='PUT'){
    const body=JSON.parse(options.body),key=body.from+'_'+body.to;
    const previous=window.__entries[key];
    if(previous&&previous.version!==body.version)return j({ok:false,error:'RECORD_CHANGED_RELOAD'},409);
    const after={...previous,...body,saved:true,version:body.version+1,updatedAt:'2026-10-17T15:01:00Z',updatedBy:'tester'};
    window.__entries[key]=after;return j({ok:true,manual:after});
   }
   if(u.pathname.endsWith('/manual')){
    const from=p.get('from'),to=p.get('to'),key=from+'_'+to;
    const m=window.__entries[key]||{from,to,key,saved:false,version:0,financial:{noticesByMonth:[]},generators:{},weekly:{}};
    return j({ok:true,manual:m});
   }
   return j({ok:false,error:'wrong mock route'},404);
  };
 },{newer,older});
 await page.addStyleTag({content:fs.readFileSync(path.join(pub,'pdc-meeting-2.css'),'utf8')});
 await page.addScriptTag({content:fs.readFileSync(path.join(pub,'pdc-meeting-2.js'),'utf8')});
 await page.addScriptTag({content:fs.readFileSync(path.join(pub,'pdc-meeting-2-manual.js'),'utf8')});
 await page.click('#pdcMeeting2Nav');
 await page.waitForFunction(()=>document.querySelector('#pm2ManualStatus')?.textContent.includes('البيانات محفوظة'),{timeout:8000});
 const values=await page.evaluate(()=>({
  topDates:document.querySelectorAll('.pm2-tools input[type="date"]').length,
  allLabel:document.querySelector('.pm2-all-indicator')?.textContent,
  total:document.querySelectorAll('.pm2-metric').length,
  history:document.querySelectorAll('.pm2-history tbody tr').length,
  histories:document.querySelector('.pm2-history')?.textContent||'',
  summaryReqs:window.__requests.filter(x=>x.url.endsWith('/summary')),
  manualInside:document.querySelector('#pm2ManualDetails #pm2From')&&document.querySelector('#pm2ManualDetails #pm2To')
 }));
 assert.equal(values.topDates,0);assert(values.manualInside);
 assert(values.allLabel.includes('بدون فلتر'));assert.equal(values.history,2);
 assert(values.histories.includes('571')&&values.histories.includes('300'));assert(values.total>=18);
 assert(values.summaryReqs.every(x=>x.search===''),'main summary must have no date params');
 await page.click('#pm2ManualDetails summary');
 await page.$eval('[data-manual-field="purchaseOrders"]',el=>{el.value='105';el.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.click('#pm2ManualSave');
 await page.waitForFunction(()=>document.querySelector('#pm2ManualAudit').textContent.includes('نسخة 3'),{timeout:8000});
 await page.waitForFunction(()=>document.querySelector('.pm2-history')?.textContent.includes('105'),{timeout:8000});
 assert.equal(await page.evaluate(()=>window.__requests.filter(x=>x.url.endsWith('/summary')).every(x=>x.search==='')),true);
 console.log(city+' BROWSER PASS: no global filter, all history rendered, manual week picker internal, independent save, live cards');
 await page.close();
}
(async()=>{const b=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});try{for(const city of cities){await backend(city);await browser(city,b)}}finally{await b.close()}})().catch(e=>{console.error(e.stack||e);process.exit(1)});
