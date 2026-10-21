'use strict';
const crypto = require('crypto');
const TAB = 'وكيل الفحص الهندسي الذكي';
const SHEET = 'AI Engineering Inspections';
const HEAD = ['ID','CreatedAt','UpdatedAt','WorkOrder','Contractor','Engineer','WorkType','Location','Summary','FindingsJson','Status','Reviewer','ImageCount','Actor','ReferenceNotes'];
const cell = (s,n=2500) => String(s ?? '').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
module.exports = function installEngineeringInspection({app, requireAuth_, getSheets, SPREADSHEET_ID, qSheet}) {
  const permitted = req => {
    const u=req.session?.user || {};
    const permissions=Array.isArray(u.permissions) ? u.permissions : [];
    const role=cell(u.role,100).toLowerCase();
    return permissions.includes(TAB) || permissions.some(x=>['*','all','الكل','جميع الصفحات','كامل الصلاحيات'].includes(String(x).toLowerCase())) ||
      ['admin','administrator','مدير','مدير المشروع','مدير الفرع','المدير العام','مدير عام','مدير النظام','مدير الإدارة','مدير الادارة'].includes(role);
  };
  const gate = (req,res,next) => permitted(req) ? next() : res.status(403).json({ok:false,error:'NO_INSPECTION_PERMISSION'});
  const send = fn => async (req,res) => {
    try {res.set('Cache-Control','no-store');res.json({ok:true,...await fn(req)});}
    catch(e){console.error('[engineering-inspection]',e.message);res.status(e.status||500).json({ok:false,error:e.publicError||'تعذر تنفيذ العملية؛ راجع اتصال البيانات أو إعداد خدمة الفحص.'});}
  };
  const actor=req=>cell(req.session?.user?.name||req.session?.user?.email||'مستخدم',120);
  let sheetPromise=null;
  async function ready(){
    if(!SPREADSHEET_ID)throw new Error('SPREADSHEET_ID missing');
    if(!sheetPromise)sheetPromise=(async()=>{
      const sheets=await getSheets();
      const meta=await sheets.spreadsheets.get({spreadsheetId:SPREADSHEET_ID,fields:'sheets.properties(title,sheetId,gridProperties.columnCount)'});
      const found=(meta.data.sheets||[]).find(x=>x.properties?.title===SHEET);
      if(!found)await sheets.spreadsheets.batchUpdate({spreadsheetId:SPREADSHEET_ID,requestBody:{requests:[{addSheet:{properties:{title:SHEET,hidden:true,gridProperties:{rowCount:2000,columnCount:HEAD.length,frozenRowCount:1}}}}]}});
      else if((found.properties?.gridProperties?.columnCount||0)<HEAD.length){await sheets.spreadsheets.batchUpdate({spreadsheetId:SPREADSHEET_ID,requestBody:{requests:[{appendDimension:{sheetId:found.properties.sheetId,dimension:'COLUMNS',length:HEAD.length-found.properties.gridProperties.columnCount}}]}});}
      const range=qSheet(SHEET)+'!A1:O1';
      const old=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range});
      if(HEAD.some((h,i)=>old.data.values?.[0]?.[i]!==h))await sheets.spreadsheets.values.update({spreadsheetId:SPREADSHEET_ID,range,valueInputOption:'RAW',requestBody:{values:[HEAD]}});
      return sheets;
    })().catch(e=>{sheetPromise=null;throw e});
    return sheetPromise;
  }
  async function rows(){
    const sheets=await ready();
    const result=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet(SHEET)+'!A2:O',valueRenderOption:'FORMATTED_VALUE'});
    return (result.data.values||[]).map((r,i)=>({row:i+2,data:r})).filter(x=>x.data[0]);
  }
  const toRecord=a=>({id:a[0],createdAt:a[1],updatedAt:a[2],workOrder:a[3],contractor:a[4],engineer:a[5],workType:a[6],location:a[7],summary:a[8],findings:(()=>{try{return JSON.parse(a[9]||'[]')}catch{return []}})(),status:a[10],reviewer:a[11],imageCount:Number(a[12]||0),actor:a[13],referenceNotes:a[14]||''});
  app.get('/api/engineering-inspections/status',requireAuth_,gate,send(async()=>({configured:!!process.env.OPENAI_API_KEY,model:process.env.OPENAI_IMAGE_MODEL||'gpt-4.1-mini'})));
  app.get('/api/engineering-inspections',requireAuth_,gate,send(async()=>({records:(await rows()).slice(-200).reverse().map(x=>toRecord(x.data))})));
  app.post('/api/engineering-inspections/analyze',requireAuth_,gate,send(async req=>{
    if(!process.env.OPENAI_API_KEY){const e=new Error('AI_NOT_CONFIGURED');e.status=503;e.publicError='AI_NOT_CONFIGURED';throw e;}
    const b=req.body||{},images=b.images;
    if(!Array.isArray(images)||images.length<1||images.length>3||images.some(x=>typeof x!=='string'||!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(x)||x.length>260000)){
      const e=new Error('INVALID_IMAGES');e.status=400;e.publicError='ارفع حتى 3 صور JPG/PNG/WebP واضحة، مع ضغط كل صورة إلى 190 كيلوبايت تقريبًا.';throw e;
    }
    const prompt='أنت مساعد تدقيق بصري في مشاريع أعمال كهرباء التوزيع والأعمال المدنية في السعودية. افحص فقط ما يظهر بوضوح. لا تختلق قياسات، ولا تحكم بمخالفة معيارية دون سند أو مخطط. استخدم صياغة ملاحظة محتملة عندما يكون الدليل غير كاف. ميّز بين عيوب التنفيذ، السلامة، ونواقص التوثيق. ممنوع إصدار اعتماد هندسي نهائي. إذا كانت الصور قبل وبعد، فقارن بينها دون افتراض تطابق زاوية التصوير. أعد JSON صالحًا فقط بالمفاتيح: summary (نص عربي موجز), visibility_limits (نص عربي), findings (مصفوفة حتى 10 عناصر، كل عنصر يحتوي title, category من تنفيذ/سلامة/توثيق, severity من عالية/متوسطة/منخفضة, confidence من مرتفعة/متوسطة/منخفضة, evidence وصف الدليل المرئي, recommendation توصية محددة, verification ما يحتاج تحقق ميداني أو من المواصفات). إذا لا ملاحظات واضحة أعد findings فارغة واذكر أن ذلك ليس شهادة مطابقة. السياق: '+JSON.stringify({workOrder:cell(b.workOrder,100),workType:cell(b.workType,120),location:cell(b.location,200),referenceNotes:cell(b.referenceNotes,3500),photoMode:cell(b.photoMode,30)});
    const response=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.OPENAI_IMAGE_MODEL||'gpt-4.1-mini',temperature:0.1,response_format:{type:'json_object'},messages:[{role:'user',content:[{type:'text',text:prompt},...images.map(url=>({type:'image_url',image_url:{url,detail:'high'}}))]}],max_completion_tokens:1800}),
      signal:AbortSignal.timeout(75000)
    }).catch(e=>{throw new Error('AI_TRANSPORT '+e.message)});
    if(!response.ok){const detail=await response.text();console.error('[engineering-inspection] model API',response.status,detail.slice(0,300));const e=new Error('AI_API_FAILED');e.status=503;e.publicError='خدمة التحليل غير متاحة حاليًا ('+response.status+'). راجع إعدادات النموذج ومفتاح API.';throw e;}
    const data=await response.json(),raw=data.choices?.[0]?.message?.content;
    let obj;try{obj=JSON.parse(raw)}catch{const e=new Error('AI_RESPONSE_INVALID');e.status=502;e.publicError='تعذر قراءة نتيجة التحليل، أعد المحاولة.';throw e;}
    const findings=Array.isArray(obj.findings)?obj.findings.slice(0,10).map(x=>({title:cell(x.title,200),category:cell(x.category,40),severity:cell(x.severity,40),confidence:cell(x.confidence,40),evidence:cell(x.evidence,700),recommendation:cell(x.recommendation,900),verification:cell(x.verification,650)})):[];
    return {analysis:{summary:cell(obj.summary,1800),visibilityLimits:cell(obj.visibility_limits,1400),findings},reviewRequired:true};
  }));
  app.post('/api/engineering-inspections',requireAuth_,gate,send(async req=>{
    const b=req.body||{},analysis=b.analysis||{};
    if(!cell(b.workOrder,100)||!Array.isArray(analysis.findings)||analysis.findings.length>10){const e=new Error('INVALID_RECORD');e.status=400;e.publicError='رقم أمر العمل ونتيجة التحليل مطلوبان.';throw e;}
    const id='AIQ-'+crypto.randomBytes(6).toString('hex'),at=new Date().toISOString();
    const findings=analysis.findings.map(x=>({title:cell(x.title,200),category:cell(x.category,50),severity:cell(x.severity,50),confidence:cell(x.confidence,50),evidence:cell(x.evidence,650),recommendation:cell(x.recommendation,650),verification:cell(x.verification,650)}));
    const row=[id,at,at,cell(b.workOrder,100),cell(b.contractor,180),cell(b.engineer,180),cell(b.workType,140),cell(b.location,200),cell(analysis.summary,1800),JSON.stringify(findings),'قيد المراجعة','',Math.min(3,Math.max(0,Number(b.imageCount)||0)),actor(req),cell(b.referenceNotes,1800)];
    const sheets=await ready();await sheets.spreadsheets.values.append({spreadsheetId:SPREADSHEET_ID,range:qSheet(SHEET)+'!A:O',valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[row]}});
    return {record:toRecord(row),photoStorage:'metadata-only'};
  }));
  app.post('/api/engineering-inspections/:id/review',requireAuth_,gate,send(async req=>{
    const id=cell(req.params.id,40),b=req.body||{};
    if(!['معتمدة بعد المراجعة','تحتاج إعادة فحص','مغلقة'].includes(b.status)){const e=new Error('INVALID_STATUS');e.status=400;e.publicError='حالة المراجعة غير صالحة.';throw e;}
    const all=await rows(),hit=all.find(x=>x.data[0]===id);
    if(!hit){const e=new Error('NOT_FOUND');e.status=404;e.publicError='السجل غير موجود.';throw e;}
    const record=hit.data.slice();while(record.length<HEAD.length)record.push('');record[2]=new Date().toISOString();record[10]=b.status;record[11]=actor(req);
    const sheets=await ready();await sheets.spreadsheets.values.update({spreadsheetId:SPREADSHEET_ID,range:qSheet(SHEET)+'!A'+hit.row+':O'+hit.row,valueInputOption:'RAW',requestBody:{values:[record]}});
    return {record:toRecord(record)};
  }));
};
