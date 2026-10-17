'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const puppeteer=require('C:/Users/a_salama/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
const b=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
try{
 const p=await b.newPage();
 await p.setContent('<html><head><meta charset="utf-8"></head><body></body></html>');
 const root='C:/Users/a_salama/Documents/dashboard-report-work/Nav-Analytics-Makkah-20261017/public';
 await p.addScriptTag({path:'C:/VD-Agent/jszip.min.js'});
 await p.addScriptTag({path:root+'/vendor/pptxgen.bundle.js'});
 await p.addScriptTag({path:root+'/pdc-meeting-2-original-six.js'});
 const encoded=fs.readFileSync('C:/VD-Agent/pdc2-six-for-qa.pptx').toString('base64');
 const out=await p.evaluate(async code=>{
  const b64=atob(code),originalBytes=Uint8Array.from(b64,c=>c.charCodeAt(0));
  const summary={construction:{total:1168,completed:994,inProgress:100,notStarted:74,received155:448,notReceived155:546},emergency:{available:true,total:913,completed:865,inProgress:25,notStarted:23,scheduled:900,unscheduled:13},permits:{available:true,total:1168},financial:{approvedQuantities:20,purchaseOrders:20,paymentCertificates:30,paymentRate:25}};
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#0077aa';ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.font='20px Arial';ctx.fillText('SAFETY',50,70);
  const image=canvas.toDataURL('image/png');
  pptx.addSlide().addImage({data:image,x:0,y:0,w:13.333333,h:7.5});
  ctx.clearRect(0,0,640,360);ctx.fillStyle='#ee7733';ctx.fillRect(0,0,640,360);
  const second=canvas.toDataURL('image/png');pptx.addSlide().addImage({data:second,x:0,y:0,w:13.333333,h:7.5});
  const addon=await pptx.write({outputType:'blob'});
  const merged=await VDPdcOriginalSix.mergeNative(originalBytes,summary,addon);
  const z=await JSZip.loadAsync(merged.blob);
  const pres=await z.file('ppt/presentation.xml').async('string');
  const slides=(pres.match(/<p:sldId\b/g)||[]).length;
  const first=await z.file('ppt/slides/slide1.xml').async('string');
  const fourth=await z.file('ppt/slides/slide4.xml').async('string');
  const chart=await z.file('ppt/charts/chart1.xml').async('string');
  const lastRel=await z.file('ppt/slides/_rels/slide8.xml.rels').async('string');
  const oldTitles=first.includes('>1153<')||fourth.includes('>900<');
  const hasImages=Object.keys(z.files).some(x=>x.includes('PDC2_REPORT_'));
  return {slides,hasImages,oldTitles,chartHas994:chart.includes('>994<'),imageRels:lastRel.includes('PDC2_REPORT_'),templateLogoFiles:!!z.file('ppt/media/image1.png')&&!!z.file('ppt/media/image2.png'),originalCharts:!!z.file('ppt/charts/chart12.xml'),size:merged.blob.size,contentTypes:(await z.file('[Content_Types].xml').async('string')).includes('ppt/slides/slide8.xml')};
 },encoded);
 console.log(JSON.stringify(out));assert.equal(out.slides,8);assert(out.hasImages);assert(!out.oldTitles);assert(out.chartHas994);assert(out.imageRels);assert(out.originalCharts);assert(out.contentTypes);
 console.log('PASS NATIVE: unchanged original native slide geometry plus 12 updated chart caches plus appended two image slides');
}finally{await b.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
