'use strict';
/**
 * PDC Meeting 2 read-only aggregation for the 44-slide approved source deck.
 * Missing/unverified metrics are null, never copied from the old PowerPoint.
 */
module.exports=function installPdcMeeting2({app,requireAuth_,getWednesdayMeetingData,getPageData,getSheets,SPREADSHEET_ID,qSheet,APP}){
 const normalize=s=>String(s??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
 const countBy=(rows,key)=>{const m=new Map();for(const row of rows){const raw=String(row[key]??'').trim();if(raw)m.set(raw,(m.get(raw)||0)+1);}return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));};
 const done=s=>/^(تم التنفيذ|منجز|تم الانجاز|مكتمل)$/.test(normalize(s));
 const pending=s=>/^(لم يتم التنفيذ|لم يتم البدء|لم يبدأ)$/.test(normalize(s));
 const inProgress=s=>/^(جاري العمل|جار العمل|جاري التنفيذ|قيد التنفيذ)$/.test(normalize(s));
 const validDate=v=>/^20\d\d-\d\d-\d\d$/.test(String(v));
 const reports={
  safety:{meta:'Safety Corrective Reports',findings:'Safety Corrective Findings'},
  quality:{meta:'Quality Corrective Reports',findings:'Quality Corrective Findings'}
 };
 async function matchingCorrective(kind,from,to){
   try{
    const sheets=await getSheets(), source=reports[kind];
    const [a,b]=await Promise.all([
     sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet(source.meta)+'!A2:P'}),
     sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet(source.findings)+'!A2:M'})
    ]);
    const matches=(a.data.values||[]).filter(x=>x[0]&&validDate(x[1])&&validDate(x[2])&&x[1]>=from&&x[2]<=to)
      .sort((x,y)=>String(y[9]||'').localeCompare(String(x[9]||'')));
    if(!matches.length)return {available:false,reason:'لا يوجد تقرير محفوظ لهذه الفترة'};
    const r=matches[0],findings=(b.data.values||[]).filter(x=>x[0]===r[0]);
    const status=normalize;
    const closed=findings.filter(x=>/^(مغلق|تم الاغلاق|تم الاعتماد)$/.test(status(x[8]))).length;
    return {available:true,source:source.meta,reportId:r[0],week:r[3]||'',from:r[1],to:r[2],
      sites:Number(r[4])||0,visits:Number(r[6])||0,coverage:Number(r[4])>0?+(100*(Number(r[6])||0)/Number(r[4])).toFixed(1):null,
      findings:findings.length,closed,open:findings.length-closed,
      byContractor:countBy(findings.map(x=>({contractor:x[3]})),'contractor'),
      highlights:findings.map(x=>String(x[6]||'').trim()).filter(Boolean).slice(0,8),
      readyForMedia:false, mediaReason:'الصور قبل وبعد تحتاج ربط مرفقات التقرير المحفوظ'};
   }catch(e){return {available:false,reason:'تعذر قراءة سجل '+(kind==='safety'?'السلامة':'الجودة')+': '+String(e.message||e).slice(0,140)};}
 }
 async function summary(from,to){
  if(!validDate(from)||!validDate(to)||from>to||((Date.parse(to)-Date.parse(from))/86400000)>62)throw Error('INVALID_PERIOD');
  const [meeting,permitPage,emergencyPage,safety,quality]=await Promise.all([
    getWednesdayMeetingData(),
    getPageData('permits').catch(e=>({error:String(e.message||e),rows:[]})),
    getPageData('emergency').catch(e=>({error:String(e.message||e),rows:[]})),
    matchingCorrective('safety',from,to),matchingCorrective('quality',from,to)
  ]);
  const unique=new Map();
  for(const row of meeting.rows||[]){
   const id=String(row.workOrder||'').trim();
   if(id&&!unique.has(id))unique.set(id,row);
  }
  const work=[...unique.values()];
  const doneRows=work.filter(r=>r.completed===true||done(r.executionRaw));
  const notStarted=work.filter(r=>pending(r.executionRaw));
  const progress=work.filter(r=>inProgress(r.executionRaw));
  const count155=work.filter(r=>{const s=normalize(r.contractor155Status);return /مستلم/.test(s)&&!/غير مستلم|لم يستلم|لم يتم استلام/.test(s)}).length;
  const permits=permitPage.error?{available:false,reason:permitPage.error}:{available:true,total:permitPage.rows.length,byStatus:countBy(permitPage.rows,'permitStatus'),from:'ورقة التصاريح'};
  const emergency=emergencyPage.error?{available:false,reason:emergencyPage.error}:(()=>{
   const rows=emergencyPage.rows||[];
   return {available:true,total:rows.length,completed:rows.filter(r=>done(r.status)).length,
    inProgress:rows.filter(r=>inProgress(r.status)).length,notStarted:rows.filter(r=>pending(r.status)).length,
    scheduled:rows.filter(r=>/مجدول/.test(normalize(r.emergencyType))).length,
    unscheduled:rows.filter(r=>/طارئ/.test(normalize(r.emergencyType))).length,
    bySection:countBy(rows,'section'),byContractor:countBy(rows,'contractor').slice(0,14),
    byArchive:countBy(rows,'archive'),from:'ورقة الطوارئ'};
  })();
  return {ok:true,updatedAt:new Date().toISOString(),period:{from,to},
   template:{originalSlideCount:44,aspect:'16:9',version:'2026-10-14'},
   construction:{available:true,total:work.length,completed:doneRows.length,
     notStarted:notStarted.length,inProgress:progress.length,received155:count155,
     unclassified:Math.max(0,work.length-doneRows.length-notStarted.length-progress.length),
     bySection:countBy(work,'section'),byCategory:countBy(work,'category'),
     byContractor:countBy(work,'contractor').slice(0,15),from:'أوامر العمل - اجتماع PDC'},
   permits,emergency,safety,quality,
   weekly:{available:false,reason:'تاريخ التنفيذ الفعلي وتاريخ اعتماد 155 غير مربوطين بعد لهذا التقرير'},
   financial:{available:false,reason:'لا يوجد مصدر معتمد لأوامر الشراء والمستخلصات ونسبة الصرف'},
   generators:{available:false,reason:'لم يُحدد مصدر أعمال المؤقتات والمولدات والصور'},
   exports:{pptxReady:false,pdfReady:false,reason:'التقرير الكامل غير جاهز للتصدير حتى ربط الصور والمؤقتات والبيانات المالية وتحديث جميع مخططات القالب'}};
 }
 app.get('/api/pdc-meeting-2/summary',requireAuth_,async(req,res)=>{
  try{const result=await summary(String(req.query.from||''),String(req.query.to||''));res.set('Cache-Control','no-store');res.json(result)}
  catch(e){res.status(400).json({ok:false,error:String(e.message||e)})}
 });
};
