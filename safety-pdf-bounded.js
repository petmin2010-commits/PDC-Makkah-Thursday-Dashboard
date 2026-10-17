'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawn}=require('child_process');
const {PDFDocument}=require('pdf-lib');
const deck=require('./safety-reference-presentation');
const MAX_BATCH_SLIDES=3;
const PROCESS_TIMEOUT_MS=45000;
const LINUX_MEMORY_CEILING=440*1024*1024;
let queue=Promise.resolve();
let peakMemoryObserved=0;

function memoryUsed(){
 if(process.platform!=='linux')return 0;
 for(const file of ['/sys/fs/cgroup/memory.current','/sys/fs/cgroup/memory/memory.usage_in_bytes']){
  try{const n=Number(fs.readFileSync(file,'utf8').trim());if(Number.isFinite(n)&&n>0)return n}catch(_){}
 }
 return 0;
}
function convertIsolated(input,output){
 return new Promise((resolve,reject)=>{
  const detached=process.platform!=='win32';
  const child=spawn(process.execPath,[path.join(__dirname,'safety-pdf-batch-worker.js'),input,output],{
   stdio:['ignore','ignore','pipe'],detached,
   env:{...process.env,NODE_OPTIONS:'--max-old-space-size=128'}
  });
  let stderr='',reason='';
  const kill=()=>{
   try{if(detached)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL')}catch(_){}
  };
  const timer=setTimeout(()=>{reason='SAFETY_PDF_CONVERSION_TIMEOUT';kill()},PROCESS_TIMEOUT_MS);
  const watch=setInterval(()=>{
   const used=memoryUsed();
   if(used>peakMemoryObserved)peakMemoryObserved=used;
   if(used>LINUX_MEMORY_CEILING){reason='SAFETY_PDF_CONVERSION_MEMORY_LIMIT';kill()}
  },75);
  child.stderr.on('data',part=>{stderr=(stderr+String(part)).slice(-1400)});
  child.once('error',e=>{clearTimeout(timer);clearInterval(watch);reject(e)});
  child.once('close',code=>{
   clearTimeout(timer);clearInterval(watch);
   if(code===0&&fs.existsSync(output))resolve();
   else reject(Error(reason||('SAFETY_PDF_BATCH_EXIT_'+code+(stderr?' '+stderr:''))));
  });
 });
}
async function makePdf(rows,meta={}){
 peakMemoryObserved=0;
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'vd-safety-pdf-'));
 try{
  const total=await deck.create(rows,{...meta,countOnly:true});
  if(!Number.isSafeInteger(total)||total<1||total>500)throw Error('INVALID_REPORT_SLIDE_COUNT');
  const combined=await PDFDocument.create();
  let index=0;
  while(index<total){
   let size=Math.min(MAX_BATCH_SLIDES,total-index),done=false;
   while(!done){
    const source=path.join(folder,'batch.pptx'),output=path.join(folder,'batch.pdf');
    try{
     fs.writeFileSync(source,await deck.create(rows,{...meta,slideRange:[index,index+size]}));
     await convertIsolated(source,output);
     const batch=await PDFDocument.load(fs.readFileSync(output));
     if(batch.getPageCount()!==size)throw Error('SAFETY_PDF_BATCH_PAGE_MISMATCH');
     const pages=await combined.copyPages(batch,batch.getPageIndices());
     for(const page of pages)combined.addPage(page);
     index+=size;done=true;
    }catch(error){
     if(size===1)throw error;
     console.warn('Safety PDF batch retrying one slide:',error.message);
     size=1;
    }finally{
     for(const file of [source,output]){try{fs.unlinkSync(file)}catch(_){}}
    }
   }
  }
  if(combined.getPageCount()!==total)throw Error('SAFETY_PDF_PAGE_COUNT_MISMATCH');
  const bytes=Buffer.from(await combined.save({useObjectStreams:true}));
  if(bytes.subarray(0,5).toString('ascii')!=='%PDF-')throw Error('INVALID_SAFETY_PDF');
  console.info('Safety PDF bounded conversion:',total,'slides, peak cgroup memory',Math.round(peakMemoryObserved/1048576),'MiB');
  return bytes;
 }finally{fs.rmSync(folder,{recursive:true,force:true})}
}
function create(rows,meta){
 const work=queue.then(()=>makePdf(rows,meta));
 queue=work.catch(()=>{});
 return work;
}
module.exports={create};
