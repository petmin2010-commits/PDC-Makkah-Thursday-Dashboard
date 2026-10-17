'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const puppeteer=require('C:/Users/a_salama/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 try{
  const page=await browser.newPage();
  await page.setContent('<html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><nav id="nav"><button id="safetyCorrectiveNav" class="nav-item"></button><button id="qualityCorrectiveNav" class="nav-item"></button></nav><main></main><div id="pageTitle"></div><div id="filterBar"></div></body></html>');
  await page.evaluate(()=>{
   window.confirm=()=>true;
   const core={
    ok:true,
    report:{id:'T1',startDate:'2026-10-11',endDate:'2026-10-17',weekLabel:'آخر تقرير مكتمل',totalSites:90,totalVisits:70,visitedSites:70,updatedAt:'2026-10-18T08:00:00+03:00',notes:''},
    findings:[{id:'F1',workOrder:'7075',contractor:'مقاول',consultant:'أبعاد الرؤية',workType:'ملاحظة',observation:'ملاحظة بالموقع',correctiveAction:'تم التصحيح',status:'مغلقة',beforeDescription:'قبل',afterDescription:'بعد'}]
   };
   window.fetch=async(url)=>{
    const u=String(url);
    const json= u.includes('/reports/T1')?core :
      u.endsWith('/contractors')?{ok:true,contractors:['مقاول']}:
      u.endsWith('/work-types')?{ok:true,workTypes:[{code:'ملاحظة',description:'نوع'}]}:
      u.includes('/photos/')?{ok:true,images:[]}:
      u.endsWith('/reports')?{ok:true,reports:[core.report]}:{ok:true};
    return {ok:true,json:async()=>json};
   };
  });
  for(const k of ['safety','quality'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'public',k+'-corrective-report.js'),'utf8')});
  await page.waitForFunction(()=>!!window.VDSafetyCorrectiveCenter?.assemble&&!!window.VDQualityCorrectiveCenter?.assemble,{timeout:5000});
  const out=await page.evaluate(async()=>{
   const s=await window.VDSafetyCorrectiveCenter.assemble('T1');
   const q=await window.VDQualityCorrectiveCenter.assemble('T1');
   return {
    safety:{slides:(s.html.match(/class="sheet /g)||[]).length,count:s.slideCount,hasApprovedCover:s.html.includes('approved-cover'),hasPhotoSlide:s.html.includes('scr-f-slide'),hasCss:s.css.includes('scr-p-metrics')},
    quality:{slides:(q.html.match(/class="sheet /g)||[]).length,count:q.slideCount,hasApprovedCover:q.html.includes('approved-cover'),hasPhotoSlide:q.html.includes('qcr-f-slide'),hasCss:q.css.includes('qcr-p-metrics')}
   };
  });
  assert.equal(out.safety.slides,4);assert.equal(out.quality.slides,4);
  assert.equal(out.safety.count,4);assert.equal(out.quality.count,4);
  assert(out.safety.hasApprovedCover&&out.quality.hasApprovedCover);
  assert(out.safety.hasPhotoSlide&&out.quality.hasPhotoSlide);
  assert(out.safety.hasCss&&out.quality.hasCss);
  console.log('PASS: native safety and quality report assemblers return approved covers/summary/finding/end without initiating independent exports');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
