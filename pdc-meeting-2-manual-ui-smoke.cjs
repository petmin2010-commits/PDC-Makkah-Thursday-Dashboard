'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const puppeteer=require('C:/Users/a_salama/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const root=__dirname;
const empty=(from,to)=>({from,to,key:from+'_'+to,saved:false,version:0,updatedAt:'',updatedBy:'',
 financial:{approvedQuantities:null,purchaseOrders:null,paymentCertificates:null,paymentRate:null,noticesByMonth:[]},
 generators:{currentSites:null,closedSites:null,temporaryCables:null,generatorsTotal:null,observations:'',workOrder:'',contractor:'',workType:'',workDescription:'',location:'',finding:'',correctiveAction:''},
 weekly:{completedConnections:null,completedProjects:null,receivedConnections155:null,receivedProjects155:null}});
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 try{
  const page=await browser.newPage();
  await page.setContent('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"></head><body><div id="pageTitle"></div><div id="filterBar"></div><aside class="sidebar"><nav id="nav"><button class="nav-item" data-page="wednesdayMeeting"><span>اجتماع PDC</span></button><button class="nav-item" id="pdcMeeting2Nav" data-page="pdcMeeting2"><span>اجتماع PDC 2</span></button></nav></aside><main><section class="page active" id="meetingPage">Existing Meeting</section></main></body></html>');
  await page.evaluate(emptySrc=>{
   window.__manualCopies={};window.__saveRequests=[];
   window.__emptySrc=emptySrc;
   window.__makeBlank=(from,to)=>{
    const template=JSON.parse(window.__emptySrc);
    template.from=from;template.to=to;template.key=from+'_'+to;return template;
   };
   window.fetch=async(url,options={})=>{
    const address=new URL(url,'https://unit-test.local'),from=address.searchParams.get('from'),to=address.searchParams.get('to');
    const json=data=>({ok:true,json:async()=>data});
    if(address.pathname.endsWith('/manual')&&options.method==='PUT'){
     const body=JSON.parse(options.body);window.__saveRequests.push(body);
     const key=body.from+'_'+body.to,prior=window.__manualCopies[key]||window.__makeBlank(body.from,body.to);
     const next={...prior,...body,saved:true,version:body.version+1,updatedAt:'2026-10-17T20:00:00Z',updatedBy:'tester'};
     window.__manualCopies[key]=next;return json({ok:true,manual:next});
    }
    if(address.pathname.endsWith('/manual'))return json({ok:true,manual:window.__manualCopies[from+'_'+to]||window.__makeBlank(from,to)});
    if(address.pathname.endsWith('/summary')){
     const m=window.__manualCopies[from+'_'+to]||window.__makeBlank(from,to);
     return json({ok:true,period:{from,to},updatedAt:'2026-10-17T20:00:00Z',
      construction:{available:true,total:3,completed:1,notStarted:1,inProgress:1,received155:1,bySection:[{label:'مشاريع',value:2}],byContractor:[]},
      permits:{available:true,total:2,byStatus:[{label:'تم',value:2}]},emergency:{available:true,total:2,completed:1,scheduled:1,byContractor:[]},
      safety:{available:false,reason:'not in period'},quality:{available:false,reason:'not in period'},
      manual:m,weekly:{...m.weekly,available:m.saved},financial:{...m.financial,available:m.saved},generators:{...m.generators,available:m.saved},
      exports:{pptxReady:false,pdfReady:false,reason:'Not ready'}});
    }
    return {ok:false,json:async()=>({ok:false,error:'Unknown mock path'})};
   };
  },JSON.stringify(empty('2026-10-09','2026-10-15')));
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'public','pdc-meeting-2.js'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'public','pdc-meeting-2-manual.js'),'utf8')});
  await page.click('#pdcMeeting2Nav');
  await page.waitForFunction(()=>document.querySelector('#pm2ManualStatus')?.textContent.includes('لم يتم إدخال'),{timeout:6000});
  assert.equal(await page.$eval('#pm2ManualSave',e=>e.disabled),true);
  await page.click('#pm2ManualDetails summary');
  await page.$eval('[data-manual-field="approvedQuantities"]',el=>{el.value='571';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.$eval('[data-manual-field="purchaseOrders"]',el=>{el.value='102';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.$eval('[data-manual-field="paymentRate"]',el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.$eval('[data-manual-field="currentSites"]',el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.$eval('[data-manual-field="closedSites"]',el=>{el.value='3';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.$eval('[data-manual-field="generatorsTotal"]',el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.$eval('[data-manual-string="finding"]',el=>{el.value='عدم وجود أشرطة تحذيرية';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.$eval('#pm2ManualNotices',el=>{el.value='2026-05: 159\n2026-06: 135';el.dispatchEvent(new Event('input',{bubbles:true}))});
  assert.equal(await page.$eval('#pm2ManualSave',el=>el.disabled),false);
  await page.click('#pm2ManualSave');
  await page.waitForFunction(()=>window.__saveRequests.length===1&&document.querySelector('#pm2ManualStatus')?.textContent.includes('محفوظة'),{timeout:6000});
  const state=await page.evaluate(()=>({save:window.__saveRequests[0],version:document.querySelector('#pm2ManualAudit').textContent,current:document.querySelector('[data-manual-field="purchaseOrders"]').value,metric:document.querySelector('#pm2Results').textContent}));
  assert.equal(state.save.version,0);
  assert.equal(state.save.financial.approvedQuantities,571);
  assert.equal(state.save.financial.noticesByMonth.length,2);
  assert.equal(state.save.generators.closedSites,3);
  assert(state.version.includes('نسخة 1'));
  assert(state.metric.includes('571'));
  await page.$eval('#pm2ManualNotices',el=>{el.value='2026-99: 5';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.click('#pm2ManualSave');
  await page.waitForFunction(()=>document.querySelector('#pm2ManualStatus').textContent.includes('صيغة الاتجاه الشهري'),{timeout:6000});
  assert.equal(await page.evaluate(()=>window.__saveRequests.length),1,'invalid trend must not save');
  console.log('PASS UI: manually enter finance/generator metrics, monthly trend, week save, reload summary KPIs, validation blocking invalid periods');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
