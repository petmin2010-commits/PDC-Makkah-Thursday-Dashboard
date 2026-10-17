'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const puppeteer=require('C:/Users/a_salama/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const DIR=__dirname,pub=path.join(DIR,'public');
(async()=>{
const b=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu','--disable-popup-blocking']});
try{
 const page=await b.newPage();
 await page.setContent('<html dir="rtl" lang="ar"><head><meta charset="utf-8"></head><body><section id="pdcMeeting2Page"><div class="pm2-panel pm2-exports"><button id="pm2ExportPptx" disabled>PowerPoint</button><button id="pm2ExportPdf" disabled>PDF</button><p id="pm2ExportsNote"></p></div></section></body></html>');
 await page.evaluate(()=>{
  window.__compositeTest={downloads:0,archives:[],docSlides:0,format:''};
  const safety=[{id:'S-LATEST',updatedAt:'2026-10-17T21:44:00',totalSites:93,totalVisits:73,weekLabel:'السلامة المعتمدة'},{id:'S-DRAFT',updatedAt:'2026-10-18T02:00:00',totalSites:0,totalVisits:0,weekLabel:'مسودة فارغة'}];
  const quality=[{id:'Q-LATEST',updatedAt:'2026-10-17T14:40:00',totalSites:87,totalVisits:87,weekLabel:'الجودة المعتمدة'}];
  const sheet={ok:true,updatedAt:'2026-10-18T00:00:00',construction:{total:1168,completed:994,received155:448,uniqueWorkOrders:986,repeatedRows:182,notStarted:6,inProgress:10,notReceived155:546,bySection:[{label:'المشاريع',value:500}],byContractor:[]},permits:{available:true,total:1168,byStatus:[]},emergency:{total:913,available:true,completed:865,inProgress:5,notStarted:1,byContractor:[]},manual:{saved:true,from:'2026-10-09',to:'2026-10-15'},financial:{approvedQuantities:20,purchaseOrders:20,paymentCertificates:30,paymentRate:25,noticesByMonth:[]},weekly:{completedConnections:20,completedProjects:20,receivedConnections155:30,receivedProjects155:20}};
  window.fetch=async uri=>{
   const url=new URL(uri,'https://test.example');
   const json=x=>({ok:true,json:async()=>x});
   if(url.pathname.endsWith('pdc-meeting-2-print.css'))return {ok:true,text:async()=>'.sheet{min-height:100px}'};
   if(url.pathname==='/api/pdc-meeting-2/summary')return json(sheet);
   if(url.pathname==='/api/safety-corrective/reports')return json({ok:true,reports:safety});
   if(url.pathname==='/api/quality-corrective/reports')return json({ok:true,reports:quality});
   if(url.pathname.startsWith('/api/safety-corrective/reports/'))return json({ok:true,report:safety[0],findings:[{id:'sf'}]});
   if(url.pathname.startsWith('/api/quality-corrective/reports/'))return json({ok:true,report:quality[0],findings:[{id:'qf'}]});
   throw Error('Unexpected fetch '+url.pathname);
  };
  window.VDSafetyCorrectiveCenter={assemble:async id=>{
   if(id!=='S-LATEST')throw Error('wrong safety id');
   return {html:'<section class="sheet approved-page safety-slide">Safety cover</section><section class="sheet safety-slide">Safety observation</section><section class="sheet safety-slide">Safety end</section>',css:'.safety-slide{height:100px}',slideCount:3,fitScript:''};
  }};
  window.VDQualityCorrectiveCenter={assemble:async id=>{
   if(id!=='Q-LATEST')throw Error('wrong quality id');
   return {html:'<section class="sheet quality-slide">Quality cover</section><section class="sheet quality-slide">Quality observation</section><section class="sheet quality-slide">Quality end</section>',css:'.quality-slide{height:100px}',slideCount:3,fitScript:''};
  }};
  window.VDReportPdfCapture={createWindowPdfWide:async(win,sel)=>{window.__compositeTest.docSlides=win.document.querySelectorAll(sel).length;return new Blob([new Uint8Array(1200)],{type:'application/pdf'});}};
  window.VDReportArchive={record:async opts=>{window.__compositeTest.archives.push({format:opts.format,size:opts.blob.size});return {ok:true}}};
  window.pptxgen=class{constructor(){this.slides=0}addSlide(){this.slides++;return {addImage:()=>{}}}async write(){window.__compositeTest.docSlides=this.slides;return new Blob([new Uint8Array(1800)])}};
  window.html2canvas=async()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;return c};
  window.URL.createObjectURL=()=>{window.__compositeTest.downloads++;return 'blob:mock'};
  window.URL.revokeObjectURL=()=>{};
  window.open=()=>{
   const iframe=document.createElement('iframe');document.body.append(iframe);
   const fake=iframe.contentWindow;
   return fake;
  };
 });
 await page.addScriptTag({content:fs.readFileSync(path.join(pub,'pdc-meeting-2-export.js'),'utf8')});
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('pm2:summary-loaded',{detail:{ok:true}})));
 await page.waitForFunction(()=>document.getElementById('pm2ExportPptx').disabled===false,{timeout:6000});
 const sources=await page.$eval('#pm2AggregateSources',el=>el.textContent);
 assert(sources.includes('مسودة أحدث'),sources);
 assert(sources.includes('المؤقتات'));
 await page.click('#pm2ExportPdf');
 await page.waitForFunction(()=>window.__compositeTest.archives.length===1,{timeout:8000});
 let state=await page.evaluate(()=>window.__compositeTest);
 assert.equal(state.docSlides,12);
 assert.equal(state.archives[0].format,'PDF');
 await page.click('#pm2ExportPptx');
 await page.waitForFunction(()=>window.__compositeTest.archives.length===2,{timeout:8000});
 state=await page.evaluate(()=>window.__compositeTest);
 assert.equal(state.docSlides,12);
 assert.equal(state.archives[1].format,'PPTX');
 assert.equal(state.downloads,2);
 console.log('PASS: latest non-empty safety and quality, six live slides + complete sections, both exports, archive registry, generators optional');
 await page.close();
}finally{await b.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
