'use strict';
/**
 * PDC Meeting 2 — unfiltered dashboard summary.
 * Operational sheets are read at their current full scope; saved corrective
 * reports are aggregated across all reporting periods. Weekly manual values
 * remain isolated by week and only the latest saved snapshot is shown in KPIs.
 */
module.exports=function installPdcMeeting2({app,requireAuth_,getWednesdayMeetingData,getPageData,getSheets,SPREADSHEET_ID,qSheet,APP,manualStore}){
 const normalize=s=>String(s??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
 const countBy=(rows,key)=>{
  const map=new Map();for(const r of rows){const v=String(r?.[key]??'').trim();if(v)map.set(v,(map.get(v)||0)+1);}
  return [...map].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
 };
 const done=s=>/^(تم التنفيذ|منجز|تم الانجاز|مكتمل)$/.test(normalize(s));
 const pending=s=>/^(لم يتم التنفيذ|لم يتم البدء|لم يبدأ)$/.test(normalize(s));
 const inProgress=s=>/^(جاري العمل|جار العمل|جاري التنفيذ|قيد التنفيذ)$/.test(normalize(s));
 const validDate=v=>/^20\d{2}-\d{2}-\d{2}$/.test(String(v));
 const reports={
  safety:{meta:'Safety Corrective Reports',findings:'Safety Corrective Findings'},
  quality:{meta:'Quality Corrective Reports',findings:'Quality Corrective Findings'}
 };
 async function aggregateCorrective(kind){
  try{
   const sheets=await getSheets(),source=reports[kind];
   const [meta,notes]=await Promise.all([
    sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet(source.meta)+'!A2:P'}),
    sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:qSheet(source.findings)+'!A2:M'})
   ]);
   const unique=new Map();
   for(const row of meta.data.values||[]){
    const id=String(row?.[0]||'').trim();
    if(!id)continue;
    const old=unique.get(id);
    if(!old||String(row?.[9]||'')>=String(old[9]||''))unique.set(id,row);
   }
   const reportsArr=[...unique.values()].sort((a,b)=>String(b[2]||'').localeCompare(String(a[2]||'')));
   if(!reportsArr.length)return {available:false,reason:'لا توجد تقارير محفوظة حتى الآن',reportsCount:0};
   const ids=new Set(unique.keys());
   const findings=(notes.data.values||[]).filter(r=>ids.has(String(r?.[0]||'').trim()));
   const closed=findings.filter(r=>/^(مغلق|تم الاغلاق|تم الاعتماد)$/.test(normalize(r[8]))).length;
   const sites=reportsArr.reduce((n,r)=>n+(Number(r[4])||0),0);
   const visits=reportsArr.reduce((n,r)=>n+(Number(r[6])||0),0);
   const periods=reportsArr.filter(r=>validDate(r[1])&&validDate(r[2]));
   const earliest=periods.length?[...periods].sort((a,b)=>String(a[1]).localeCompare(String(b[1])))[0][1]:null;
   const latest=periods.length?[...periods].sort((a,b)=>String(b[2]).localeCompare(String(a[2])))[0][2]:null;
   return {available:true,source:source.meta,reportsCount:reportsArr.length,
    from:earliest,to:latest,week:'جميع التقارير المحفوظة',sites,visits,
    coverage:sites>0?+(100*visits/sites).toFixed(1):null,
    findings:findings.length,closed,open:findings.length-closed,
    byContractor:countBy(findings.map(x=>({contractor:x[3]})),'contractor'),
    highlights:findings.map(x=>String(x[6]||'').trim()).filter(Boolean).slice(0,12),
    readyForMedia:false,mediaReason:'الصور قبل وبعد تحتاج ربطًا مستقلًا بالتقرير التجميعي'};
  }catch(e){return {available:false,reason:'تعذر قراءة سجلات '+(kind==='safety'?'السلامة':'الجودة')+': '+String(e.message||e).slice(0,140)};}
 }
 const emptyManual=()=>({
  saved:false,from:'',to:'',version:0,updatedAt:'',updatedBy:'',
  financial:{approvedQuantities:null,purchaseOrders:null,paymentCertificates:null,paymentRate:null,noticesByMonth:[]},
  generators:{currentSites:null,closedSites:null,temporaryCables:null,generatorsTotal:null,
   observations:'',workOrder:'',contractor:'',workType:'',workDescription:'',location:'',finding:'',correctiveAction:''},
  weekly:{completedConnections:null,completedProjects:null,receivedConnections155:null,receivedProjects155:null}
 });
 async function summary(){
  const [meeting,permitPage,emergencyPage,safety,quality,manualHistory]=await Promise.all([
   getWednesdayMeetingData(),
   getPageData('permits').catch(e=>({error:String(e.message||e),rows:[]})),
   getPageData('emergency').catch(e=>({error:String(e.message||e),rows:[]})),
   aggregateCorrective('safety'),aggregateCorrective('quality'),
   manualStore.listRecords().catch(e=>{console.warn('[pdc2] manual records',String(e.message||e));return []})
  ]);
  // Same counting unit as the main dashboard: each populated work-order row.
  // Repeated order numbers can represent separate records; never collapse them.
  const work=(meeting.rows||[]).filter(r=>String(r?.workOrder||'').trim());
  const distinctIds=new Set(work.map(r=>String(r.workOrder).trim()));
  const uniqueWorkOrders=distinctIds.size;
  const repeatedRows=work.length-uniqueWorkOrders;
  const complete=work.filter(r=>r.completed===true||done(r.executionRaw));
  const notStarted=work.filter(r=>pending(r.executionRaw)),progress=work.filter(r=>inProgress(r.executionRaw));
  // AK (هل تم إدخال 155 للمقاول) holds نعم / لا, not the text "مستلم".
  // Same classification as the existing main-dashboard execution tree:
  // AK=نعم is counted only within rows with execution status تم التنفيذ.
  const byBusinessType={connections:{total:0,completed:0,inProgress:0,notStarted:0},projects:{total:0,completed:0,inProgress:0,notStarted:0}};
  for(const item of work){
   const category=normalize([item.section,item.category].filter(Boolean).join(' '));
   const key=/توصيل|اتصال/.test(category)?'connections':/مشروع|مشاريع/.test(category)?'projects':null;
   if(!key)continue;
   byBusinessType[key].total++;
   if(item.completed===true||done(item.executionRaw))byBusinessType[key].completed++;
   else if(inProgress(item.executionRaw))byBusinessType[key].inProgress++;
   else if(pending(item.executionRaw))byBusinessType[key].notStarted++;
  }
  const received155=complete.filter(r=>normalize(r.contractor155Status)==='نعم').length;
  const notReceived155=complete.filter(r=>normalize(r.contractor155Status)==='لا').length;
  const permits=permitPage.error?{available:false,reason:permitPage.error}:
   {available:true,total:permitPage.rows.length,byStatus:countBy(permitPage.rows,'permitStatus'),from:'ورقة التصاريح — جميع السجلات'};
  const emergency=emergencyPage.error?{available:false,reason:emergencyPage.error}:(()=>{
   const rows=emergencyPage.rows||[];
   return {available:true,total:rows.length,completed:rows.filter(r=>done(r.status)).length,
    inProgress:rows.filter(r=>inProgress(r.status)).length,notStarted:rows.filter(r=>pending(r.status)).length,
    scheduled:rows.filter(r=>/مجدول/.test(normalize(r.emergencyType))).length,
    unscheduled:rows.filter(r=>/طارئ/.test(normalize(r.emergencyType))).length,
    bySection:countBy(rows,'section'),byContractor:countBy(rows,'contractor').slice(0,14),
    byArchive:countBy(rows,'archive'),from:'ورقة الطوارئ — جميع السجلات'};
  })();
  const latestManual=manualHistory[0]||emptyManual();
  return {ok:true,scope:'all',updatedAt:new Date().toISOString(),
   period:{from:latestManual.from||'',to:latestManual.to||''},
   template:{originalSlideCount:44,aspect:'16:9',version:'2026-10-14'},
   construction:{available:true,total:work.length,uniqueWorkOrders,repeatedRows,countBasis:'rows',
    completed:complete.length,notStarted:notStarted.length,
    inProgress:progress.length,received155,notReceived155,byBusinessType,
    unclassified:Math.max(0,work.length-complete.length-notStarted.length-progress.length),
    bySection:countBy(work,'section'),byCategory:countBy(work,'category'),byContractor:countBy(work,'contractor').slice(0,15),
    from:'أوامر العمل — جميع السجلات'},
   permits,emergency,safety,quality,manual:latestManual,manualHistory,
   weekly:{...latestManual.weekly,available:latestManual.saved&&Object.values(latestManual.weekly).some(x=>x!==null),
    source:latestManual.saved?'آخر إدخال يدوي محفوظ: '+latestManual.from+' — '+latestManual.to:'لم تسجل بيانات أسبوعية بعد',
    updatedAt:latestManual.updatedAt},
   financial:{...latestManual.financial,available:latestManual.saved&&Object.entries(latestManual.financial).some(([k,v])=>k==='noticesByMonth'?v.length>0:v!==null),
    source:latestManual.saved?'آخر إدخال يدوي محفوظ: '+latestManual.from+' — '+latestManual.to:'لا توجد بيانات مالية يدوية بعد',
    updatedAt:latestManual.updatedAt},
   generators:{...latestManual.generators,available:latestManual.saved&&Object.values(latestManual.generators).some(v=>v!==null&&v!==''),
    source:latestManual.saved?'آخر إدخال يدوي محفوظ: '+latestManual.from+' — '+latestManual.to:'لا توجد بيانات للمولدات بعد',
    updatedAt:latestManual.updatedAt},
   exports:{pptxReady:false,pdfReady:false,
    reason:'تحديث مؤشرات جميع البيانات مفعل؛ تصدير الشرائح الكاملة يتطلب إكمال ربط صور القالب المعتمد'}};
 }
 app.get('/api/pdc-meeting-2/summary',requireAuth_,async(req,res)=>{
  try{res.set('Cache-Control','no-store');res.json(await summary());}
  catch(e){res.status(503).json({ok:false,error:String(e.message||e)});}
 });
};