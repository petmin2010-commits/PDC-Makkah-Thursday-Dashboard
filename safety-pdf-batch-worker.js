'use strict';
const fs=require('fs');
(async()=>{
 const input=process.argv[2],output=process.argv[3];
 if(!input||!output)throw Error('MISSING_PDF_BATCH_PATH');
 const {pptxToPdf}=await import('officetopdf-js');
 const pdf=Buffer.from(await pptxToPdf(fs.readFileSync(input)));
 if(pdf.length<500||pdf.subarray(0,5).toString('ascii')!=='%PDF-')throw Error('INVALID_BATCH_PDF');
 fs.writeFileSync(output,pdf);
})().catch(error=>{console.error('SAFETY_PDF_BATCH_ERROR:',error?.stack||error);process.exitCode=1;});
