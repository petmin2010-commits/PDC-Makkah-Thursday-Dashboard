'use strict';

const SHEET='Projects Report Engine Images';
const HEADERS=['ProjectRef','Slot','Kind','ChunkIndex','Caption','Mime','DataChunk','Updated At','Updated By'];
const CHUNK_SIZE=35000;
const MAX_DATA_URL=900000;

function clean(v){return String(v??'').trim()}
function safeWo(v){return clean(v).replace(/[^0-9A-Za-z_-]/g,'').slice(0,80)}
function safeCaption(v){return String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,800)}
function userLabel(req){return clean(req?.session?.user?.name||req?.session?.user?.email||req?.session?.user?.username||'dashboard')}

module.exports=function installProjectImages(ctx){
  const {app,requireAuth_,getSheets,SPREADSHEET_ID,qSheet,DateTime}=ctx;
  let sheetCache=null;

  async function ensureSheet(){
    if(sheetCache)return sheetCache;
    const sheets=await getSheets();
    const meta=await sheets.spreadsheets.get({spreadsheetId:SPREADSHEET_ID,fields:'sheets.properties(sheetId,title,hidden,gridProperties)'});
    let found=(meta.data.sheets||[]).find(s=>s.properties?.title===SHEET);
    if(!found){
      const add=await sheets.spreadsheets.batchUpdate({
        spreadsheetId:SPREADSHEET_ID,
        requestBody:{requests:[{addSheet:{properties:{title:SHEET,hidden:true,gridProperties:{rowCount:2500,columnCount:9,frozenRowCount:1}}}}]}
      });
      const props=add.data.replies?.[0]?.addSheet?.properties;
      found={properties:props};
    }else if(!found.properties.hidden){
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId:SPREADSHEET_ID,
        requestBody:{requests:[{updateSheetProperties:{properties:{sheetId:found.properties.sheetId,hidden:true},fields:'hidden'}}]}
      });
    }
    const headerRange=`${qSheet(SHEET)}!A1:I1`;
    const header=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:headerRange});
    const row=header.data.values?.[0]||[];
    if(HEADERS.some((h,i)=>row[i]!==h)){
      await sheets.spreadsheets.values.update({spreadsheetId:SPREADSHEET_ID,range:headerRange,valueInputOption:'RAW',requestBody:{values:[HEADERS]}});
    }
    sheetCache={sheets,sheetId:found.properties.sheetId};
    return sheetCache;
  }

  async function indexRows_(){
    const {sheets}=await ensureSheet();
    const r=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:`${qSheet(SHEET)}!A2:B`});
    return (r.data.values||[]).map((v,i)=>({row:i+2,v}));
  }
  function groupedRanges_(rowNumbers){
    const nums=[...new Set(rowNumbers)].sort((a,b)=>a-b),groups=[];
    for(const n of nums){
      const last=groups[groups.length-1];
      if(last&&n===last.end+1)last.end=n;else groups.push({start:n,end:n});
    }
    return groups;
  }
  async function rowsForWorkOrder_(wo){
    const {sheets}=await ensureSheet(),idx=await indexRows_();
    const nums=idx.filter(x=>clean(x.v[0])===wo).map(x=>x.row);
    const groups=groupedRanges_(nums);if(!groups.length)return [];
    const ranges=groups.map(g=>`${qSheet(SHEET)}!A${g.start}:I${g.end}`);
    const r=await sheets.spreadsheets.values.batchGet({spreadsheetId:SPREADSHEET_ID,ranges});
    const valueRanges=r.data.valueRanges||[],out=[];
    groups.forEach((g,gi)=>{
      const vals=valueRanges[gi]?.values||[];
      for(let i=0;i<=g.end-g.start;i++)out.push({row:g.start+i,v:vals[i]||[]});
    });
    return out;
  }

  async function loadImages(workOrder){
    const wo=safeWo(workOrder); if(!wo)return [];
    const rows=await rowsForWorkOrder_(wo),groups=new Map();
    for(const x of rows){
      const v=x.v;if(clean(v[0])!==wo)continue;
      const slot=Number(v[1]);if(!(slot>=1&&slot<=8))continue;
      if(!groups.has(slot))groups.set(slot,{slot,caption:'',mime:'image/jpeg',chunks:[],updatedAt:'',updatedBy:''});
      const g=groups.get(slot),kind=clean(v[2]);
      if(kind==='META'){
        g.caption=clean(v[4]);g.mime=clean(v[5])||'image/jpeg';g.updatedAt=clean(v[7]);g.updatedBy=clean(v[8]);
      }else if(kind==='CHUNK'){
        g.chunks.push({i:Number(v[3])||0,data:clean(v[6])});
      }
    }
    return [...groups.values()].sort((a,b)=>a.slot-b.slot).map(g=>{
      g.chunks.sort((a,b)=>a.i-b.i);
      const b64=g.chunks.map(x=>x.data).join('');
      return {slot:g.slot,caption:g.caption,mime:g.mime,dataUrl:b64?`data:${g.mime};base64,${b64}`:'',updatedAt:g.updatedAt,updatedBy:g.updatedBy};
    });
  }

  async function clearSlot_(wo,slot){
    const {sheets}=await ensureSheet(),rows=await indexRows_();
    const ranges=rows.filter(x=>clean(x.v[0])===wo&&Number(x.v[1])===slot).map(x=>`${qSheet(SHEET)}!A${x.row}:I${x.row}`);
    if(ranges.length)await sheets.spreadsheets.values.batchClear({spreadsheetId:SPREADSHEET_ID,requestBody:{ranges}});
  }

  async function saveImage(workOrder,slot,payload,updatedBy){
    const wo=safeWo(workOrder),n=Number(slot);
    if(!wo)throw new Error('رقم أمر العمل غير صالح.');
    if(!(n>=1&&n<=8))throw new Error('رقم خانة الصورة غير صالح.');
    const caption=safeCaption(payload?.caption);
    if(payload?.remove){await clearSlot_(wo,n);return {slot:n,removed:true}}

    const dataUrl=clean(payload?.dataUrl);
    if(!dataUrl)throw new Error('اختر صورة قبل الحفظ.');
    if(dataUrl.length>MAX_DATA_URL)throw new Error('حجم الصورة بعد الضغط أكبر من الحد المسموح. اختر صورة أصغر.');
    const m=dataUrl.match(/^data:(image\/(?:jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/i);
    if(!m)throw new Error('يجب حفظ الصورة بصيغة JPEG.');
    const mime='image/jpeg';
    await clearSlot_(wo,n);
    const b64=m[2],chunks=[];
    for(let i=0;i<b64.length;i+=CHUNK_SIZE)chunks.push(b64.slice(i,i+CHUNK_SIZE));
    const {sheets}=await ensureSheet();
    const now=DateTime.now().setZone(ctx.APP?.TZ||'Asia/Riyadh').toISO();
    const rows=[[wo,n,'META',0,caption,mime,'',now,clean(updatedBy)]];
    chunks.forEach((c,i)=>rows.push([wo,n,'CHUNK',i+1,'',mime,c,now,clean(updatedBy)]));
    const idx=await indexRows_();
    const used=idx.filter(x=>clean(x.v[0])).map(x=>x.row);
    const startRow=used.length?Math.max(...used)+1:2;
    const endRow=startRow+rows.length-1;
    await sheets.spreadsheets.values.update({
      spreadsheetId:SPREADSHEET_ID,
      range:`${qSheet(SHEET)}!A${startRow}:I${endRow}`,
      valueInputOption:'RAW',
      requestBody:{values:rows}
    });
    return {slot:n,caption,mime,dataUrl,updatedAt:now,updatedBy:clean(updatedBy)};
  }

  app.get('/api/projects-report-engine/images/:workOrder',requireAuth_,async(req,res)=>{
    try{res.set('Cache-Control','no-store');res.json({ok:true,images:await loadImages(req.params.workOrder)})}
    catch(e){console.error('Project images load:',e);res.status(500).json({ok:false,error:e.message||String(e)})}
  });
  app.post('/api/projects-report-engine/images/:workOrder/:slot',requireAuth_,async(req,res)=>{
    try{const image=await saveImage(req.params.workOrder,req.params.slot,req.body||{},userLabel(req));res.set('Cache-Control','no-store');res.json({ok:true,image})}
    catch(e){console.error('Project image save:',e);res.status(400).json({ok:false,error:e.message||String(e)})}
  });
  app.delete('/api/projects-report-engine/images/:workOrder/:slot',requireAuth_,async(req,res)=>{
    try{const image=await saveImage(req.params.workOrder,req.params.slot,{remove:true},userLabel(req));res.set('Cache-Control','no-store');res.json({ok:true,image})}
    catch(e){console.error('Project image delete:',e);res.status(400).json({ok:false,error:e.message||String(e)})}
  });

  return {loadImages,saveImage,ensureSheet};
};
