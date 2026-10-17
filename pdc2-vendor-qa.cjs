'use strict';
const puppeteer=require('C:/Users/a_salama/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 try{
  const page=await browser.newPage();await page.setContent('<html><body></body></html>');
  await page.addScriptTag({path:process.argv[2]});
  const x=await page.evaluate(()=>({lower:typeof window.pptxgen,upper:typeof window.PptxGenJS,others:Object.keys(window).filter(x=>/pptx/i.test(x)).slice(0,10)}));
  console.log(JSON.stringify(x));if(x.lower!=='function'&&x.upper!=='function')throw Error('PPTX_EXPORT_NOT_INSTALLED');
  const exported=await page.evaluate(async()=>{const P=window.pptxgen||window.PptxGenJS;const p=new P();p.layout='LAYOUT_WIDE';p.addSlide().addText('PDC2 test',{x:1,y:1,w:6,h:1});const result=await p.write({outputType:'blob'});return {size:result.size,type:result.type}});
  console.log('PPTX_WRITE='+JSON.stringify(exported));if(exported.size<2000)throw Error('PPTX_WRITE_FAILED');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
