'use strict';
/**
 * Convert the final, personalized source PPTX to PDF using an installed Office
 * renderer, rather than independently laying out a second document.
 * Never serve a synthetic or mismatched "PDF" if no renderer is available.
 */
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const BIN=process.env.LIBREOFFICE_PATH||'libreoffice';
async function run(cmd,args,timeout=80000){
 return new Promise((resolve,reject)=>{
  const proc=spawn(cmd,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const errors=[];
  const kill=setTimeout(()=>{proc.kill('SIGKILL');reject(Error('PDF_RENDER_TIMEOUT'))},timeout);
  proc.stderr.on('data',buf=>errors.push(String(buf).slice(0,700)));
  proc.on('error',error=>{clearTimeout(kill);reject(error)});
  proc.on('exit',code=>{clearTimeout(kill);code===0?resolve():reject(Error('PDF_RENDER_FAILED '+code+' '+errors.join('').slice(0,1000)))});
 });
}
async function convertPptxBuffer(pptx){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'vd-temporary-generators-'));
 const input=path.join(temp,'report.pptx'),pdf=path.join(temp,'report.pdf');
 try{
  await fs.writeFile(input,pptx);
  const profile=path.join(temp,'office-profile');
  const bin=process.platform==='win32'?(process.env.LIBREOFFICE_PATH||'C:\\Program Files\\LibreOffice\\program\\soffice.exe'):BIN;
  try{await run(bin,['-env:UserInstallation=file:///'+profile.replace(/\\/g,'/'),'--headless','--convert-to','pdf:impress_pdf_Export','--outdir',temp,input])}
  catch(error){if(error.code==='ENOENT'||error.code==='EACCES')throw Object.assign(Error('PDF_RENDERER_UNAVAILABLE'),{status:503});throw error}
  const bytes=await fs.readFile(pdf);
  if(bytes.length<1500||bytes.subarray(0,4).toString()!=='%PDF')throw Error('PDF_CONVERSION_INVALID');
  return bytes;
 }finally{await fs.rm(temp,{recursive:true,force:true}).catch(()=>{})}
}
module.exports={convertPptxBuffer};
