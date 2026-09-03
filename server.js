const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');
const { DateTime } = require('luxon');
const { APP } = require('./app-config');

function loadEnvFile(){
  const p=path.join(__dirname,'.env');
  if(!fs.existsSync(p)) return;
  for(const raw of fs.readFileSync(p,'utf8').split(/\r?\n/)){
    const line=raw.trim(); if(!line || line.startsWith('#')) continue;
    const i=line.indexOf('='); if(i<0) continue;
    const k=line.slice(0,i).trim(), v=line.slice(i+1).trim();
    if(!(k in process.env)) process.env[k]=v;
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';
const memoryCache = new Map();

function credentialsFromEnv(){
  if(process.env.GOOGLE_SERVICE_ACCOUNT_JSON){
    try { return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON); }
    catch(e){ throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON ليس JSON صالحًا'); }
  }
  const p=path.join(__dirname,'credentials.json');
  if(fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8'));
  return null;
}

async function getSheets(){
  const creds=credentialsFromEnv();
  if(!creds) throw new Error('لم يتم إعداد حساب Google Service Account. ضع credentials.json أو GOOGLE_SERVICE_ACCOUNT_JSON.');
  const auth=new google.auth.GoogleAuth({credentials:creds, scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
  return google.sheets({version:'v4', auth});
}

function assertConfig(){
  if(!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID غير موجود. انسخه من رابط Google Sheet وضعه داخل ملف .env.');
}
function qSheet(name){ return `'${String(name).replace(/'/g,"''")}'`; }

async function valuesGet(range){
  assertConfig();
  const sheets=await getSheets();
  const r=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID, range, valueRenderOption:'FORMATTED_VALUE'});
  return r.data.values || [];
}

function cacheGet(key){
  const x=memoryCache.get(key); if(!x) return null;
  if(Date.now()>x.exp){memoryCache.delete(key);return null}
  return x.value;
}
function cachePut(key,value,seconds=APP.CACHE_SECONDS){memoryCache.set(key,{value,exp:Date.now()+seconds*1000})}
function clearDashboardCache(){memoryCache.clear();return true}

function clean_(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function norm_(v){return clean_(v).replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/[^\u0600-\u06FFa-zA-Z0-9]/g,'')}
function cleanWorkOrder_(v){let s=clean_(v); if(/^\d+(\.\d+)?E\+\d+$/i.test(s)){const n=Number(s);if(!isNaN(n))return String(Math.round(n));}return s.replace(/\.0$/,'')}
function contains_(v,t){return clean_(v).indexOf(t)!==-1}
function num_(v){const n=Number(String(v||'').replace(/,/g,'').replace(/[^\d.-]/g,''));return isNaN(n)?0:n}
function sum_(rows,k){return rows.reduce((s,r)=>s+num_(r[k]),0)}
function unique_(a){return [...new Set(a.map(clean_).filter(Boolean))]}
function countContains_(rows,k,t){return rows.filter(r=>contains_(r[k],t)).length}
function countExact_(rows,k,t){return rows.filter(r=>clean_(r[k])===t).length}
function pct_(a,b){return b?Math.round(a/b*1000)/10:0}
function yesNo_(v){const s=clean_(v);return s.includes('نعم')?'نعم':s.includes('لا')?'لا':s}
function isCompletedStatus_(v){return clean_(v).replace(/\s+/g,' ').trim()==='تم التنفيذ'}
function kpi_(label,value,page,tone,sub,isPercent,isMoney){return {label,value,page,tone:tone||'primary',sub:sub||'',isPercent:!!isPercent,isMoney:!!isMoney}}
function now_(){return DateTime.now().setZone(APP.TZ||'Asia/Riyadh').toFormat('yyyy-LL-dd HH:mm:ss')}
function findHeader_(headers,candidates){
  const normalized=headers.map(norm_);
  for(const c of candidates){const nc=norm_(c);let i=normalized.indexOf(nc);if(i>=0)return i;i=normalized.findIndex(h=>h&&nc&&(h.includes(nc)||nc.includes(h)));if(i>=0)return i}return -1;
}

async function readWorkOrdersBoot_(){
  const cfg=APP.PAGES.workorders;
  const vals=await valuesGet(`${qSheet(cfg.sheet)}!D2:S`);
  const rows=[];
  vals.slice(0,APP.MAX_ROWS).forEach((r,i)=>{
    const workOrder=cleanWorkOrder_(r[0]); if(!workOrder)return;
    const obj={_row:i+2,workOrder,type:clean_(r[1]),assignedDate:clean_(r[2]),contractor:clean_(r[3]),region:clean_(r[4]),location:clean_(r[5]),value:clean_(r[7]),safetyViolations:clean_(r[9]),executionViolations:clean_(r[10]),engineer:clean_(r[13]),status:clean_(r[14]),section:clean_(r[15])};
    obj._search=[obj.workOrder,obj.type,obj.contractor,obj.region,obj.location,obj.engineer,obj.status,obj.section,obj.value,obj.assignedDate].join(' ').toLowerCase();
    rows.push(obj);
  });
  return rows;
}

async function getWorkOrderMasterEnrichment(){
  const cfg=APP.PAGES.workorders;
  const vals=await valuesGet(`${qSheet(cfg.sheet)}!AB2:AE`);
  return vals.slice(0,APP.MAX_ROWS).map((r,i)=>({_row:i+2,delay:clean_(r[0]),consultantDays:clean_(r[3])}));
}

async function readConfiguredSheet_(cfg,cacheKey){
  const key='PDC_V3_'+cacheKey;
  if(cacheKey!=='workorders'){const hit=cacheGet(key);if(hit)return hit}
  const values=await valuesGet(`${qSheet(cfg.sheet)}!A:${cacheKey==='workorders'?'BD':'AZ'}`);
  const headerRow=cfg.headerRow||1;
  if(values.length<headerRow)return [];
  const headers=(values[headerRow-1]||[]).map(clean_);
  const map={}; cfg.fields.forEach(f=>{map[f[0]]=findHeader_(headers,f[2])});
  if(cacheKey==='workorders'){
    map.assignedDate=5;map.value=10;map.status=17;map.consultant155=31;map.contractor155=36;map.permitStatus=40;map.payment=43;map.stage=54;map.stageStatus=55;
  }
  if(cacheKey==='permits')map.evaluation=19;
  if(cacheKey==='emergency'){
    Object.assign(map,{noticeNo:1,assignedDate:3,startDate:4,endDate:5,description:6,classification:7,type:8,administration:9,circuit:10,section:11,emergencyType:12,location:13,consultant:14,engineer:15,contractor:16,contractorReceiver:17,pdcEngineer:18,status:20,archive:21});
  }
  let body=values.slice(headerRow);
  if(cacheKey==='permits'){
    let last=-1; for(let i=body.length-1;i>=0;i--){if(clean_(body[i]?.[3])!==''){last=i;break}} body=last>=0?body.slice(0,last+1):[];
  } else if(cacheKey!=='emergency') body=body.slice(0,APP.MAX_ROWS);
  const rows=[];
  body.forEach((r,idx)=>{
    const obj={_row:headerRow+1+idx},search=[];let meaningful=false;
    cfg.fields.forEach(f=>{const absolute=map[f[0]];let v=absolute>=0?clean_(r[absolute]):'';if(f[0]==='workOrder')v=cleanWorkOrder_(v);obj[f[0]]=v;if(v){meaningful=true;search.push(v)}});
    if(cacheKey==='emergency'&&!clean_(obj.noticeNo))return;
    if(meaningful){obj._search=search.join(' ').toLowerCase();rows.push(obj)}
  });
  if(cacheKey!=='workorders')cachePut(key,rows);
  return rows;
}

function getFastMasterKpis_(rows){
  const total=rows.length,completed=rows.filter(r=>isCompletedStatus_(r.status)).length;
  return [
    kpi_('إجمالي أوامر العمل',total,'workorders','primary'),kpi_('تم التنفيذ',completed,'workorders','success',pct_(completed,total)),kpi_('غير مكتمل',Math.max(0,total-completed),'workorders','warning'),kpi_('نسبة الإنجاز',pct_(completed,total),'workorders','success','من إجمالي الأوامر',true),kpi_('المشاريع',countExact_(rows,'section','مشاريع'),'projects','primary'),kpi_('التوصيلات',countExact_(rows,'section','توصيلات'),'connections','primary'),kpi_('العمليات',countContains_(rows,'section','عمليات'),'operations','purple'),kpi_('مخالفات السلامة',sum_(rows,'safetyViolations'),'safety','danger'),kpi_('مقاولون نشطون',unique_(rows.map(r=>r.contractor)).length,'workorders','primary'),kpi_('مهندسون مسؤولون',unique_(rows.map(r=>r.engineer)).length,'workorders','primary')
  ];
}

async function getMasterExtras_(){
  const key='PDC_V2_MASTER_EXTRA_MERGED_V2',hit=cacheGet(key);if(hit)return hit;
  const out={attachmentsTotal:0,attachmentsUploaded:0,emergencyTotal:0,emergencyDone:0,tasksTotal:0,tasksResolved:0,minutes:0,executionViolations:0,penalties:0};
  try{const a=await readConfiguredSheet_(APP.PAGES.attachments,'attachments');out.attachmentsTotal=a.length;out.attachmentsUploaded=a.filter(r=>contains_(r.status,'تم رفع')).length}catch(e){}
  try{const x=await readConfiguredSheet_(APP.PAGES.emergency,'emergency');out.emergencyTotal=x.length;out.emergencyDone=x.filter(r=>contains_(r.status,'تم الانتهاء')||contains_(r.status,'مغلق')).length}catch(e){}
  try{const t=await readConfiguredSheet_(APP.PAGES.tasks,'tasks');out.tasksTotal=t.length;out.tasksResolved=t.filter(r=>contains_(r.attachments,'تم المعالجة')||contains_(r.resolved,'تم')).length}catch(e){}
  try{const v=await readConfiguredSheet_(APP.PAGES.executionViolations,'executionViolations');out.executionViolations=v.length}catch(e){}
  try{const m=await readConfiguredSheet_(APP.PAGES.minutes,'minutes');out.minutes=m.length;out.penalties=sum_(m,'penalty')}catch(e){}
  cachePut(key,out);return out;
}

async function getBootData(){
  const rows=await readWorkOrdersBoot_();
  return {title:APP.TITLE,updatedAt:now_(),master:{rows,kpis:getFastMasterKpis_(rows)},pageMeta:Object.keys(APP.PAGES).reduce((o,k)=>{const p=APP.PAGES[k];o[k]={title:p.title,finance:k==='finance'};return o},{})};
}
async function getSecondaryMasterKpis(){
  const x=await getMasterExtras_();
  return [kpi_('مخالفات التنفيذ',num_(x.executionViolations)+num_(x.minutes),'violationsCombined','danger'),kpi_('إجمالي الغرامات على المقاول من مخالفات التنفيذ',x.penalties,'violationsCombined','danger','ر.س',false,true),kpi_('مرفقات مرفوعة',x.attachmentsUploaded,'attachments','success',pct_(x.attachmentsUploaded,x.attachmentsTotal)),kpi_('مرفقات غير مكتملة',Math.max(0,x.attachmentsTotal-x.attachmentsUploaded),'attachments','warning'),kpi_('حالات الطوارئ',x.emergencyTotal,'emergency','purple'),kpi_('طوارئ منتهية',x.emergencyDone,'emergency','success',pct_(x.emergencyDone,x.emergencyTotal)),kpi_('المهام والإفادات',x.tasksTotal,'tasks','primary'),kpi_('مهام معالجة',x.tasksResolved,'tasks','success',pct_(x.tasksResolved,x.tasksTotal))];
}
async function getSafetyReportPage_(){
  const cfg=APP.PAGES.safety;
  const rows=await readConfiguredSheet_(cfg,'safety');
  try{
    assertConfig();
    const sheets=await getSheets();
    const meta=await sheets.spreadsheets.get({
      spreadsheetId:SPREADSHEET_ID,
      ranges:[`${qSheet(cfg.sheet)}!N2:N${Math.max(2,Math.min(APP.MAX_ROWS+1,5001))}`],
      includeGridData:true,
      fields:'sheets.data.rowData.values(hyperlink,userEnteredValue,textFormatRuns)'
    });
    const cellRows=meta.data.sheets?.[0]?.data?.[0]?.rowData||[];
    const links=new Map();
    cellRows.forEach((rd,i)=>{
      const cell=rd.values?.[0]||{};
      let url=clean_(cell.hyperlink);
      if(!url){
        const formula=clean_(cell.userEnteredValue?.formulaValue);
        const m=formula.match(/HYPERLINK\(\s*["']([^"']+)["']/i);
        if(m)url=m[1];
      }
      if(!url){
        const runs=cell.textFormatRuns||[];
        url=clean_(runs.find(x=>x?.format?.link?.uri)?.format?.link?.uri);
      }
      if(url)links.set(i+2,url);
    });
    rows.forEach(r=>{
      const enriched=links.get(Number(r._row));
      if(enriched)r.link=enriched;
      else if(!/^https?:\/\//i.test(clean_(r.link)))r.link='';
    });
  }catch(e){
    console.warn('Safety hyperlink enrichment skipped:',e.message||e);
  }
  rows.forEach(r=>{
    r._search=[r.workOrder,r.type,r.workOrderCode,r.contractor,r.date,r.violation1,r.violation2,r.supervisor,r.editor,r.reason].join(' ').toLowerCase();
  });
  return {key:'safety',title:cfg.title,updatedAt:now_(),rows,columns:cfg.fields.map(f=>({key:f[0],label:f[1]})),filterKeys:cfg.filters||[]};
}

async function getCombinedViolationsPage_(){
  const execution=await readConfiguredSheet_(APP.PAGES.executionViolations,'executionViolations');
  // Enrich execution-violation PDF hyperlinks from column N (the sheet stores them as cell hyperlinks).
  try{
    assertConfig();
    const cfg=APP.PAGES.executionViolations;
    const sheets=await getSheets();
    const meta=await sheets.spreadsheets.get({
      spreadsheetId:SPREADSHEET_ID,
      ranges:[`${qSheet(cfg.sheet)}!N2:N${Math.max(2,Math.min(APP.MAX_ROWS+1,5001))}`],
      includeGridData:true,
      fields:'sheets.data.rowData.values(hyperlink,userEnteredValue,textFormatRuns)'
    });
    const cellRows=meta.data.sheets?.[0]?.data?.[0]?.rowData||[];
    const links=new Map();
    cellRows.forEach((rd,i)=>{
      const cell=rd.values?.[0]||{};
      let url=clean_(cell.hyperlink);
      if(!url){const formula=clean_(cell.userEnteredValue?.formulaValue);const m=formula.match(/HYPERLINK\(\s*["']([^"']+)["']/i);if(m)url=m[1]}
      if(!url){const runs=cell.textFormatRuns||[];url=clean_(runs.find(x=>x?.format?.link?.uri)?.format?.link?.uri)}
      if(url)links.set(i+2,url);
    });
    execution.forEach(r=>{const u=links.get(Number(r._row));if(u)r.link=u;else if(!/^https?:\/\//i.test(clean_(r.link)))r.link='';});
  }catch(e){console.warn('Execution violation hyperlink enrichment skipped:',e.message||e)}
  const minutes=await readConfiguredSheet_(APP.PAGES.minutes,'minutes'); const rows=[];
  execution.forEach(r=>{const x={source:'مخالفات التنفيذ',workOrder:r.workOrder||'',type:r.type||'',contractor:r.contractor||'',region:'',location:'',date:r.date||'',violation:r.violation||'',violationSection:r.violationSection||'',supervisor:r.supervisor||'',editor:r.editor||'',reason:r.reason||'',link:r.link||'',emailStatus:r.emailStatus||'',uploadStatus:'',penalty:'',_row:r._row||''};x._search=Object.values(x).join(' ').toLowerCase();rows.push(x)});
  minutes.forEach(r=>{const x={source:'محاضر المخالفات',workOrder:r.workOrder||'',type:r.type||'',contractor:r.contractor||'',region:r.region||'',location:r.location||'',date:r.date||'',violation:r.minuteType||'',violationSection:'',supervisor:'',editor:r.editor||'',reason:r.statement||'',link:'',emailStatus:'',uploadStatus:r.uploadStatus||'',penalty:r.penalty||'',_row:r._row||''};x._search=Object.values(x).join(' ').toLowerCase();rows.push(x)});
  const cfg=APP.PAGES.violationsCombined;
  return {key:'violationsCombined',title:cfg.title,updatedAt:now_(),rows,columns:cfg.fields.filter(f=>f[0]!=='source').map(f=>({key:f[0],label:f[1]})),filterKeys:cfg.filters||[],summary:{executionCount:execution.length,minutesCount:minutes.length,totalCount:rows.length,totalPenalty:sum_(minutes,'penalty')}};
}

function meetingDelayBucket_(days){
  const n=Math.max(0,num_(days));
  if(n<=0)return 'بدون تأخير (صفر أو أقل)';
  if(n<=10)return 'من 1 إلى 10 أيام';
  if(n<=20)return 'من 11 إلى 20 يوم';
  if(n<=30)return 'من 21 إلى 30 يوم';
  if(n<=45)return 'من 31 إلى 45 يوم';
  return 'أكثر من 45 يوم';
}

function meetingExecutionStatus_(delayStatus,status){
  const d=clean_(delayStatus);
  const s=clean_(status);

  // المصدر الرسمي لاحتساب "أُنجز التنفيذ" هو العمود R فقط:
  // حالة الأمر وفقاً لمتابعة المهندس المسؤول.
  if(s==='تم التنفيذ')return 'أُنجز التنفيذ';

  // إذا لم يكن منفذاً حسب R، نستفيد من حالة التأخير لتقسيم الأعمال الجارية.
  if(contains_(s,'موقوف')||contains_(s,'محول')||contains_(d,'موقوف'))return 'موقوف / محول';
  const dn=d.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
  // ضمن المدة + أوشك/أوشكت على الانتهاء = ضمن المدة.
  if(dn.includes('ضمن المدة')||dn.includes('اوشك')||dn.includes('اوشكت'))return 'قيد التنفيذ ضمن المدة';
  // أي نوع/درجة تأخير أو متأخر = متأخر تنفيذ، بغض النظر عن عدد أيام التأخير.
  if(dn.includes('تاخير')||dn.includes('متاخر'))return 'متأخر تنفيذ';

  return s||d||'غير محدد';
}

function meetingPermitStatus_(v){
  const s=clean_(v);
  if(!s)return 'غير محدد';
  if(contains_(s,'لا يتطلب'))return 'لا يتطلب';
  if(contains_(s,'اصدار')||contains_(s,'إصدار'))return 'تم الإصدار';
  if(contains_(s,'تقديم'))return 'تم التقديم';
  if(contains_(s,'تنسيق'))return 'قيد التنسيق';
  return s;
}

async function getWednesdayMeetingData(){
  const key='PDC_WEDNESDAY_MEETING_V8';
  const hit=cacheGet(key);
  if(hit)return hit;

  const cfg=APP.PAGES.workorders;
  const values=await valuesGet(`${qSheet(cfg.sheet)}!A:BG`);
  if(!values.length)return {updatedAt:now_(),rows:[]};

  const headers=(values[0]||[]).map(clean_);
  const col=(candidates,fallback=-1)=>{
    const i=findHeader_(headers,candidates);
    return i>=0?i:fallback;
  };

  const ix={
    workOrder:col(['أمر العمل','امر العمل'],3),
    assignedDate:col(['تاريخ الاسناد','تاريخ الإسناد'],5),
    contractor:col(['المقاول'],6),
    region:col(['الادارة بشركة الكهرباء','الإدارة بشركة الكهرباء'],7),
    workType:col(['وصف امر العمل uds','وصف أمر العمل uds','وصف امر العمل'],15),
    status:col(['حالة الامر وفقا لمتابعة المهندس المسئول','حالة الأمر وفقا لمتابعة المهندس المسؤول'],17),
    section:col(['القسم'],18),
    category:col(['فئة العمل'],19),
    office:col(['جهة التنفيذ بشركة الكهرباء'],20),
    daysSince:col(['عدد الايام منذ الاسناد','عدد الأيام منذ الإسناد'],25),
    duration:col(['المدة uds','المدة'],26),
    delayStatus:27, // العمود AB مباشرة: موقف التأخير
    contractor155Status:36, // العمود AK مباشرة: مستلم / غير مستلم 155 للمقاول
    permitStatus:col(['حالة التصريح من بلدي','حالة التصريح'],40),
    advice:col(['إفادة الاستشاري','افادة الاستشاري'],53),
    stage:col(['مرحلة التنفيذ'],54),
    nonExecutionStatus:54, // العمود BC مباشرة: حالات أوامر العمل غير المنفذة
    stageStatus:col(['حالة المرحلة'],55),
    delayBucket:col(['شريحة ايام التاخير','شريحة أيام التأخير'],56),
    docsStatus:57, // العمود BF مباشرة: حالة استلام مستندات المقاول
    docsSubStatus:58 // العمود BG مباشرة: تفصيل المستندات المستلمة
  };


  const rows=[];
  values.slice(1,1+APP.MAX_ROWS).forEach((r,i)=>{
    const workOrder=cleanWorkOrder_(r[ix.workOrder]);
    if(!workOrder)return;

    const daysSince=num_(r[ix.daysSince]);
    const duration=num_(r[ix.duration]);
    const delayDays=Math.max(0,daysSince-duration);
    const delayStatus=clean_(r[ix.delayStatus]);
    const status=clean_(r[ix.status]);
    const executionStatus=meetingExecutionStatus_(delayStatus,status);
    const completed=status==='تم التنفيذ';
    const category=clean_(r[ix.category])||'غير محدد';

    // حالة التصاريح تعتمد كليًا ومباشرة على العمود AO.
    // لا يوجد فلتر "يحتاج تصريح" ولا استنتاج من فئة العمل.
    const permitStatus=String(r[ix.permitStatus]??'').trim()||'غير محدد';

    const stage=clean_(r[ix.stage]);
    const stageStatus=clean_(r[ix.stageStatus]);
    const delayedClosure=
      completed &&
      contains_(stage,'الإغلاق') &&
      stageStatus!=='تم الانتهاء';

    const docsStatus=clean_(r[ix.docsStatus])||'غير محدد';
    const docsSubStatus=clean_(r[ix.docsSubStatus])||'غير محدد';

    const obj={
      _row:i+2,
      workOrder,
      assignedDate:clean_(r[ix.assignedDate]),
      contractor:clean_(r[ix.contractor])||'غير محدد',
      region:clean_(r[ix.region])||'غير محدد',
      office:clean_(r[ix.office])||clean_(r[ix.region])||'غير محدد',
      section:clean_(r[ix.section])||'غير محدد',
      category,
      workType:clean_(r[ix.workType])||'غير محدد',
      executionRaw:status,
      executionStatus,
      completed,
      withinDuration:executionStatus==='قيد التنفيذ ضمن المدة',
      delayedExecution:executionStatus==='متأخر تنفيذ',
      delayedClosure,
      delayStatus,
      contractor155Status:clean_(r[ix.contractor155Status])||'غير محدد',
      nonExecutionStatus:clean_(r[ix.nonExecutionStatus])||'غير محدد',
      delayDays,
      delayBucket:clean_(r[ix.delayBucket])||'غير محدد',
      permitStatus,
      docsStatus,
      docsSubStatus,
      stage,
      stageStatus:clean_(r[ix.stageStatus]),
      advice:clean_(r[ix.advice])
    };
    obj._search=[
      obj.workOrder,obj.contractor,obj.region,obj.office,obj.section,obj.category,
      obj.workType,obj.executionStatus,obj.delayStatus,obj.permitStatus,obj.docsStatus,obj.docsSubStatus,
      obj.stage,obj.stageStatus,obj.advice
    ].join(' ').toLowerCase();
    rows.push(obj);
  });

  const payload={updatedAt:now_(),rows};
  cachePut(key,payload,120);
  return payload;
}

async function getPageData(pageKey){
  const cfg=APP.PAGES[pageKey];if(!cfg)throw new Error('صفحة غير معرفة: '+pageKey);
  if(pageKey==='violationsCombined')return getCombinedViolationsPage_();
  if(pageKey==='safety')return getSafetyReportPage_();
  const rows=await readConfiguredSheet_(cfg,pageKey);
  return {key:pageKey,title:cfg.title,updatedAt:now_(),rows,columns:cfg.fields.map(f=>({key:f[0],label:f[1]})),filterKeys:cfg.filters||[]};
}


function isDelayedLabel_(v){
  const s=clean_(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
  if(!s)return false;
  if(s.includes('ضمن المدة')||s.includes('اوشك')||s.includes('اوشكت'))return false;
  return s.includes('تاخير')||s.includes('متاخر');
}

async function getMonitorData(){
  // Aggregate-only endpoint for remote KPI monitoring. No row-level data is exposed.
  const rows=await readWorkOrdersBoot_();
  const total=rows.length;
  const completed=rows.filter(r=>isCompletedStatus_(r.status)).length;
  const incomplete=Math.max(0,total-completed);
  const projects=countExact_(rows,'section','مشاريع');
  const connections=countExact_(rows,'section','توصيلات');
  const operations=rows.filter(r=>contains_(r.section,'عمليات')).length;
  const safetyViolations=sum_(rows,'safetyViolations');
  const activeContractors=unique_(rows.map(r=>r.contractor)).length;
  const responsibleEngineers=unique_(rows.map(r=>r.engineer)).length;

  let delayedWorkOrders=0;
  try{
    const enrichment=await getWorkOrderMasterEnrichment();
    delayedWorkOrders=enrichment.filter(r=>isDelayedLabel_(r.delay)).length;
  }catch(e){
    console.warn('Monitor delay enrichment skipped:',e.message||e);
  }

  const x=await getMasterExtras_();
  const executionViolations=num_(x.executionViolations)+num_(x.minutes);
  const attachmentsTotal=num_(x.attachmentsTotal);
  const attachmentsUploaded=num_(x.attachmentsUploaded);
  const emergencyTotal=num_(x.emergencyTotal);
  const emergencyDone=num_(x.emergencyDone);
  const tasksTotal=num_(x.tasksTotal);
  const tasksResolved=num_(x.tasksResolved);

  return {
    ok:true,
    project:APP.TITLE,
    updatedAt:now_(),
    kpis:{
      totalWorkOrders:total,
      completedWorkOrders:completed,
      incompleteWorkOrders:incomplete,
      completionRate:pct_(completed,total),
      delayedWorkOrders,
      delayedRate:pct_(delayedWorkOrders,total),
      projects,
      connections,
      operations,
      safetyViolations,
      executionViolations,
      activeContractors,
      responsibleEngineers,
      attachmentsTotal,
      attachmentsUploaded,
      attachmentsUploadRate:pct_(attachmentsUploaded,attachmentsTotal),
      emergencyTotal,
      emergencyDone,
      emergencyCompletionRate:pct_(emergencyDone,emergencyTotal),
      tasksTotal,
      tasksResolved,
      tasksResolutionRate:pct_(tasksResolved,tasksTotal)
    }
  };
}


function monitorNumberish_(v){
  const s=clean_(v);
  if(!s)return null;
  // Arabic/English formatted numbers, percentages and currency values.
  const normalized=s
    .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/,/g,'')
    .replace(/٪/g,'%')
    .replace(/%/g,'')
    .replace(/[^0-9.\-]/g,'');
  if(!normalized || normalized==='-' || normalized==='.' || normalized==='-.')return null;
  const n=Number(normalized);
  return Number.isFinite(n)?n:null;
}

function monitorTopValues_(rows,key,limit=12){
  const counts=new Map();
  for(const r of rows){
    const v=clean_(r[key]); if(!v)continue;
    counts.set(v,(counts.get(v)||0)+1);
  }
  return [...counts.entries()]
    .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'ar'))
    .slice(0,limit)
    .map(([value,count])=>({value,count,rate:pct_(count,rows.length)}));
}

function monitorFieldProfile_(rows,field){
  const [key,label]=field;
  const vals=rows.map(r=>clean_(r[key]));
  const nonEmpty=vals.filter(Boolean);
  const uniqueCount=new Set(nonEmpty).size;
  const nums=nonEmpty.map(monitorNumberish_).filter(v=>v!==null);
  const numericRatio=nonEmpty.length?nums.length/nonEmpty.length:0;
  const idLike=/^(workOrder|noticeNo|station|poNo|paymentNo|statementNo|sap|coordinates|link)$/i.test(key);
  const out={
    key,label,
    nonEmpty:nonEmpty.length,
    empty:rows.length-nonEmpty.length,
    completenessRate:pct_(nonEmpty.length,rows.length),
    uniqueCount,
    topValues:monitorTopValues_(rows,key,12)
  };
  if(!idLike && nums.length && numericRatio>=0.6){
    const sum=nums.reduce((a,b)=>a+b,0);
    out.numeric={
      count:nums.length,
      sum:Math.round(sum*100)/100,
      average:Math.round((sum/nums.length)*100)/100,
      min:Math.min(...nums),
      max:Math.max(...nums)
    };
  }
  return out;
}

function monitorDuplicates_(rows,key){
  if(!key)return {key:null,duplicateRows:0,duplicateValues:0};
  const m=new Map();
  for(const r of rows){const v=clean_(r[key]);if(v)m.set(v,(m.get(v)||0)+1)}
  const d=[...m.entries()].filter(([,c])=>c>1);
  return {
    key,
    duplicateRows:d.reduce((s,[,c])=>s+(c-1),0),
    duplicateValues:d.length,
    top:d.sort((a,b)=>b[1]-a[1]).slice(0,10).map(([value,count])=>({value,count}))
  };
}

function monitorPageSummary_(pageKey,cfg,rows){
  const fields=(cfg.fields||[]).map(f=>monitorFieldProfile_(rows,f));
  const primary=(cfg.fields||[]).some(f=>f[0]==='workOrder')?'workOrder':
    (cfg.fields||[]).some(f=>f[0]==='noticeNo')?'noticeNo':null;
  const importantKeys=['contractor','engineer','section','status','delay','permit','permitStatus','executionStatus','stage','stageStatus','category','region','office','resolved','attachments','paymentStatus','sapStatus','approval','evaluation','emailStatus','uploadStatus','source','type'];
  const breakdowns={};
  for(const k of importantKeys){
    if((cfg.fields||[]).some(f=>f[0]===k))breakdowns[k]=monitorTopValues_(rows,k,20);
  }
  return {
    key:pageKey,
    title:cfg.title,
    sheet:cfg.sheet,
    rowCount:rows.length,
    fieldCount:(cfg.fields||[]).length,
    duplicates:monitorDuplicates_(rows,primary),
    breakdowns,
    fields
  };
}

async function getFullMonitorData(){
  const executive=await getMonitorData();
  const pages={};
  const errors=[];
  const keys=Object.keys(APP.PAGES);
  for(const pageKey of keys){
    const cfg=APP.PAGES[pageKey];
    try{
      const payload=await getPageData(pageKey);
      const rows=Array.isArray(payload?.rows)?payload.rows:[];
      pages[pageKey]=monitorPageSummary_(pageKey,cfg,rows);
    }catch(e){
      errors.push({page:pageKey,title:cfg.title,error:e.message||String(e)});
      pages[pageKey]={key:pageKey,title:cfg.title,sheet:cfg.sheet,available:false,error:e.message||String(e)};
    }
  }

  // High-level data-quality and change fingerprint for reliable automated comparisons.
  let totalRows=0,totalEmptyCells=0,totalCells=0,totalDuplicateRows=0;
  for(const p of Object.values(pages)){
    if(!p || p.available===false)continue;
    totalRows+=p.rowCount||0;
    totalDuplicateRows+=p.duplicates?.duplicateRows||0;
    for(const f of p.fields||[]){totalEmptyCells+=f.empty||0; totalCells+=(f.empty||0)+(f.nonEmpty||0)}
  }
  const compactForHash={kpis:executive.kpis,pages:Object.fromEntries(Object.entries(pages).map(([k,p])=>[k,{rowCount:p.rowCount,breakdowns:p.breakdowns,duplicates:p.duplicates}]))};
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify(compactForHash)).digest('hex').slice(0,24);
  return {
    ok:true,
    project:APP.TITLE,
    updatedAt:now_(),
    fingerprint,
    executive:executive.kpis,
    coverage:{
      configuredPages:keys.length,
      availablePages:keys.length-errors.length,
      unavailablePages:errors.length,
      totalRowsAcrossPages:totalRows,
      totalDuplicateRows,
      emptyCellRate:pct_(totalEmptyCells,totalCells)
    },
    pages,
    errors
  };
}

const METHODS={getBootData,getSecondaryMasterKpis,getWorkOrderMasterEnrichment,getPageData,getWednesdayMeetingData,getMonitorData,getFullMonitorData,clearDashboardCache};

const app=express();
const PUBLIC_DIR=path.join(__dirname,'public');
const INDEX_FILE=path.join(PUBLIC_DIR,'index.html');

app.use(express.json({limit:'1mb'}));

// الصفحة الرئيسية صراحةً
app.get('/',(req,res)=>{
  res.sendFile(INDEX_FILE);
});

// الملفات الثابتة
app.use(express.static(PUBLIC_DIR));

app.get('/api/health',(req,res)=>res.json({
  ok:true,
  title:APP.TITLE,
  spreadsheetConfigured:!!SPREADSHEET_ID,
  publicDirExists:fs.existsSync(PUBLIC_DIR),
  indexExists:fs.existsSync(INDEX_FILE)
}));

app.get('/api/monitor/summary',async(req,res)=>{
  try{
    // Lightweight endpoint for scheduled checks: reuses aggregate KPIs only.
    const result=await getMonitorData();
    res.set('Cache-Control','no-store');
    res.json({
      ok:true,
      project:result.project,
      updatedAt:result.updatedAt,
      kpis:result.kpis,
      monitoringMode:'summary'
    });
  }catch(e){
    console.error(e);
    res.status(500).json({ok:false,error:e.message||String(e)});
  }
});

app.get('/api/monitor/full',async(req,res)=>{
  try{
    const result=await getFullMonitorData();
    res.set('Cache-Control','no-store');
    res.json(result);
  }catch(e){
    console.error(e);
    res.status(500).json({ok:false,error:e.message||String(e)});
  }
});

app.get('/api/monitor',async(req,res)=>{
  try{
    const result=await getMonitorData();
    res.set('Cache-Control','no-store');
    res.json(result);
  }catch(e){
    console.error(e);
    res.status(500).json({ok:false,error:e.message||String(e)});
  }
});

app.post('/api/rpc',async(req,res)=>{
  try{
    const {method,args=[]}=req.body||{};
    if(!METHODS[method])return res.status(404).json({ok:false,error:'Method not allowed'});
    const result=await METHODS[method](...(Array.isArray(args)?args:[]));
    res.json({ok:true,result});
  }
  catch(e){
    console.error(e);
    res.status(500).json({ok:false,error:e.message||String(e)});
  }
});

// أي مسار خاص بالواجهة يرجع index.html
app.use((req,res)=>{
  res.sendFile(INDEX_FILE);
});

app.listen(PORT,'0.0.0.0',()=>{
  console.log(`PDC Jeddah website: http://0.0.0.0:${PORT}`);
  console.log(`Public directory: ${PUBLIC_DIR}`);
  console.log(`index.html exists: ${fs.existsSync(INDEX_FILE)}`);
});
