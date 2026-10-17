'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const puppeteer=require('C:/Users/a_salama/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const root=__dirname;
async function serverTest(){
 const routes={};
 const app={get:(url,...handlers)=>{routes[url]=handlers[handlers.length-1]}};
 const getSheets=async()=>({spreadsheets:{values:{get:async({range})=>({data:{values:range.includes('Safety Corrective Reports')?[
  ['S1','2026-10-09','2026-10-15','الأسبوع الثاني',92,0,73,'','','2026-10-15T10:00:00'],
  ['OLD','2026-10-01','2026-10-08','الأقدم',92,0,88]
 ]:range.includes('Safety Corrective Findings')?[
  ['S1','f1','123','شركة أولى','','','ملاحظة السلامة','','مفتوح'],
  ['S1','f2','124','شركة ثانية','','','ملاحظة أخرى','','مغلق']
 ]:[]}})}}});
 require('./pdc-meeting-2-server')({app,requireAuth_:(req,res,next)=>next?.(),getWednesdayMeetingData:async()=>({rows:[
   {workOrder:'1',completed:true,executionRaw:'تم التنفيذ',section:'التوصيلات',contractor155Status:'مستلم 155',contractor:'أ'},
   {workOrder:'1',completed:true,executionRaw:'تم التنفيذ'},
   {workOrder:'2',completed:false,executionRaw:'جاري العمل',section:'المشاريع',contractor:'ب'},
   {workOrder:'3',completed:false,executionRaw:'لم يتم البدء',section:'المشاريع',contractor:'ب'}
  ]}),getPageData:async name=>({rows:name==='permits'?[{permitStatus:'تم الاصدار'},{permitStatus:'قيد التنسيق'}]:[{status:'منجز',contractor:'أ',emergencyType:'طارئ'},{status:'جاري التنفيذ',contractor:'ب',emergencyType:'مجدول'}]}),getSheets,SPREADSHEET_ID:'test',qSheet:x=>x,APP:{},manualStore:{getRecord:async(from,to)=>({from,to,key:from+'_'+to,saved:false,version:0,financial:{approvedQuantities:null,purchaseOrders:null,paymentCertificates:null,paymentRate:null,noticesByMonth:[]},generators:{currentSites:null,closedSites:null,temporaryCables:null,generatorsTotal:null,observations:'',workOrder:'',contractor:'',workType:'',workDescription:'',location:'',finding:'',correctiveAction:''},weekly:{completedConnections:null,completedProjects:null,receivedConnections155:null,receivedProjects155:null}})}});
 const result=await new Promise((resolve,reject)=>{
  routes['/api/pdc-meeting-2/summary']({query:{from:'2026-10-09',to:'2026-10-15'}},
   {set:()=>{},json:resolve,status:()=>({json:reject})});
 });
 assert.equal(result.construction.total,3);
 assert.equal(result.construction.completed,1);
 assert.equal(result.construction.inProgress,1);
 assert.equal(result.construction.notStarted,1);
 assert.equal(result.construction.received155,1);
 assert.equal(result.permits.total,2);
 assert.equal(result.emergency.total,2);
 assert.equal(result.safety.findings,2);
 assert.equal(result.safety.visits,73);
 assert.equal(result.quality.available,false);
 assert.equal(result.exports.pptxReady,false);
 console.log('PASS server: dedupe work orders, live status categories, permit and emergency data, matching weekly safety, no fabricated exports');
}
async function browserTest(){
 const source=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
 const meeting=source.indexOf('data-page="wednesdayMeeting"');
 const meeting2=source.indexOf('data-page="pdcMeeting2"');
 const third=source.indexOf('data-page="smartThursday"');
 assert(meeting>0&&meeting2>meeting&&third>meeting2,'nav item not after old PDC meeting');
 assert(source.includes('/pdc-meeting-2.js?v='),'JS not loaded');
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 try{
  const page=await browser.newPage();
  await page.setContent('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><div id="pageTitle"></div><div id="filterBar"></div><aside class="sidebar"><nav id="nav"><button id="wednesdayMeetingNav" class="nav-item" data-page="wednesdayMeeting"><span>اجتماع PDC</span></button><button id="pdcMeeting2Nav" class="nav-item" data-page="pdcMeeting2"><span>اجتماع PDC 2</span></button></nav></aside><main><section class="page active" id="meetingPage"></section></main></body></html>');
  await page.evaluate(()=>window.fetch=async()=>({ok:true,json:async()=>({
   ok:true,updatedAt:'2026-10-17T10:00:00Z',construction:{available:true,total:3,completed:1,notStarted:1,inProgress:1,received155:1,bySection:[{label:'مشاريع',value:2}],byContractor:[]},
   permits:{available:true,total:2,byStatus:[{label:'تم',value:1}]},emergency:{available:true,total:2,completed:1,scheduled:1,byContractor:[]},
   safety:{available:false,reason:'No saved report'},quality:{available:false,reason:'No saved report'},
   weekly:{available:false,reason:'Missing completion-date source'},financial:{available:false,reason:'Missing finance'},generators:{available:false,reason:'Missing generator'},
   exports:{pptxReady:false,pdfReady:false,reason:'Data unavailable'}
  })}));
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'public','pdc-meeting-2.js'),'utf8')});
  await page.click('#pdcMeeting2Nav');
  await page.waitForFunction(()=>document.querySelector('#pm2Results').textContent.includes('الإنشاءات'),{timeout:5000});
  const v=await page.evaluate(()=>({active:document.querySelector('#pdcMeeting2Page').classList.contains('active'),cards:document.querySelectorAll('.pm2-metric').length,sections:document.querySelectorAll('.pm2-section').length,buttons:[...document.querySelectorAll('.pm2-exports button')].every(x=>x.disabled),current:document.querySelector('#meetingPage').classList.contains('active'),barCount:document.querySelectorAll('.pm2-bar').length}));
  assert(v.active&&!v.current&&v.cards>=10&&v.sections===5&&v.buttons&&v.barCount>=2,JSON.stringify(v));
  await page.click('#wednesdayMeetingNav');
  const gone=await page.$eval('#pdcMeeting2Page',e=>!e.classList.contains('active'));
  assert(gone,'PDC2 page remains open after navigating away');
  console.log('PASS UI: menu order, live dashboard metrics/charts, no misleading exports, old meeting remains reachable');
 }finally{await browser.close();}
}
(async()=>{await serverTest();await browserTest()})().catch(e=>{console.error(e);process.exit(1)});
