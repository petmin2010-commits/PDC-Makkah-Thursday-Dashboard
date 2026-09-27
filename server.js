const express = require('express');
const session = require('express-session');
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
const HR_SPREADSHEET_ID = process.env.HR_SPREADSHEET_ID || '1a2K0fPOlwBPvwOHKFmm6pYlk4x7jPKGAjGF2kqjQrxw';
const HR_SHEET = 'الكادر الفعلي والمعتمد حسب المصفوفة';
const memoryCache = new Map();
const valuesInFlight = new Map();

/* ==========================================
   PDC Dashboard Authentication
   ========================================== */

const USERS_SHEET = 'dp users';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'PDC-LOCAL-SESSION-CHANGE-BEFORE-PRODUCTION';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;

const loginAttempts = new Map();

function isValidEmail_(value){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || '').trim()
  );
}

function loginKey_(req,email){
  return String(req.ip || '') +
    '|' +
    String(email || '').trim().toLowerCase();
}

function loginState_(key){

  const now=Date.now();

  let x=loginAttempts.get(key);

  if(!x){
    x={
      count:0,
      first:now,
      blockedUntil:0
    };

    loginAttempts.set(key,x);
  }

  if(x.blockedUntil && now>=x.blockedUntil){
    x={
      count:0,
      first:now,
      blockedUntil:0
    };

    loginAttempts.set(key,x);
  }

  if(now-x.first>LOGIN_WINDOW_MS){
    x.count=0;
    x.first=now;
  }

  return x;
}

function registerLoginFailure_(key){

  const x=loginState_(key);

  x.count++;

  if(x.count>=LOGIN_MAX_ATTEMPTS){
    x.blockedUntil=Date.now()+LOGIN_BLOCK_MS;
  }

  loginAttempts.set(key,x);

  return x;
}

function clearLoginFailures_(key){
  loginAttempts.delete(key);
}

async function readDashboardUsers_(){

  /*
    dp users:
    A = Name
    B = Role
    C = Email
    D = Password
    E = Active / inactive
  */

  const values=await valuesGet(
    qSheet(USERS_SHEET)+'!A:E'
  );

  if(!Array.isArray(values) || values.length<2){
    return [];
  }

  return values
    .slice(1)
    .map(r=>({

      name:clean_(r[0]),

      role:clean_(r[1]),

      email:clean_(r[2])
        .toLowerCase(),

      password:String(
        r[3]==null ? '' : r[3]
      ).trim(),

      active:clean_(r[4])
        .toLowerCase()

    }))
    .filter(u=>u.email);
}

function publicUser_(user){

  return {
    name:user.name,
    role:user.role,
    email:user.email
  };

}

function requireAuth_(req,res,next){

  if(req.session && req.session.user){
    return next();
  }

  res.set('Cache-Control','no-store');

  return res.status(401).json({
    ok:false,
    error:'AUTH_REQUIRED'
  });
}


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
  const auth=new google.auth.GoogleAuth({credentials:creds, scopes:['https://www.googleapis.com/auth/spreadsheets']});
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

async function valuesGetFrom_(spreadsheetId,range){
  const key=spreadsheetId+'|'+range;
  if(valuesInFlight.has(key))return valuesInFlight.get(key);
  const pending=(async()=>{
    const sheets=await getSheets();
    const r=await sheets.spreadsheets.values.get({spreadsheetId,range,valueRenderOption:'FORMATTED_VALUE'});
    return r.data.values||[];
  })();
  valuesInFlight.set(key,pending);
  try{return await pending}finally{valuesInFlight.delete(key)}
}

const SMART_HISTORY_SHEET='Dashboard History';
const SMART_HISTORY_HEADERS=[
  'date','timestamp','project','totalOrders','completed','executionRate','health','qualityAvg','docScore',
  'totalIssues','critical','high','newIssues','resolvedIssues','issueKeysJson','categoriesJson','contractorsJson','version'
];

async function ensureSmartHistorySheet_(){
  assertConfig();
  const sheets=await getSheets();
  const meta=await sheets.spreadsheets.get({
    spreadsheetId:SPREADSHEET_ID,
    fields:'sheets.properties(sheetId,title)'
  });
  const exists=(meta.data.sheets||[]).some(s=>s.properties?.title===SMART_HISTORY_SHEET);
  if(!exists){
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId:SPREADSHEET_ID,
      requestBody:{requests:[{addSheet:{properties:{
        title:SMART_HISTORY_SHEET,
        gridProperties:{rowCount:5000,columnCount:18},
        rightToLeft:true
      }}}]}
    });
  }
  const headerRange=`${qSheet(SMART_HISTORY_SHEET)}!A1:R1`;
  const current=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:headerRange});
  const row=current.data.values?.[0]||[];
  if(SMART_HISTORY_HEADERS.some((h,i)=>row[i]!==h)){
    await sheets.spreadsheets.values.update({
      spreadsheetId:SPREADSHEET_ID,
      range:headerRange,
      valueInputOption:'RAW',
      requestBody:{values:[SMART_HISTORY_HEADERS]}
    });
  }
  return sheets;
}

function safeJsonParse_(v,fallback){
  try{return JSON.parse(String(v||''))}catch{return fallback}
}
function smartHistoryNum_(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*10)/10:0}
function smartIssueHashes_(keys){
  return [...new Set((Array.isArray(keys)?keys:[]).slice(0,1800).map(x=>
    crypto.createHash('sha1').update(String(x||'')).digest('hex').slice(0,12)
  ))];
}
function smartHistoryRowToObj_(r,rowNumber){
  return {
    rowNumber,
    date:String(r[0]||''),timestamp:String(r[1]||''),project:String(r[2]||''),
    totalOrders:smartHistoryNum_(r[3]),completed:smartHistoryNum_(r[4]),executionRate:smartHistoryNum_(r[5]),
    health:smartHistoryNum_(r[6]),qualityAvg:smartHistoryNum_(r[7]),docScore:smartHistoryNum_(r[8]),
    totalIssues:smartHistoryNum_(r[9]),critical:smartHistoryNum_(r[10]),high:smartHistoryNum_(r[11]),
    newIssues:smartHistoryNum_(r[12]),resolvedIssues:smartHistoryNum_(r[13]),
    issueKeys:safeJsonParse_(r[14],[]),categories:safeJsonParse_(r[15],{}),contractors:safeJsonParse_(r[16],{}),
    version:String(r[17]||'')
  };
}

async function saveSmartHistory(payload){
  const sheets=await ensureSmartHistorySheet_();
  const zone=APP.TZ||'Asia/Riyadh';
  const today=DateTime.now().setZone(zone).toFormat('yyyy-LL-dd');
  const timestamp=DateTime.now().setZone(zone).toFormat('yyyy-LL-dd HH:mm:ss');
  const summary=payload?.summary||{};
  const categories=payload?.categories&&typeof payload.categories==='object'?payload.categories:{};
  const contractors=payload?.contractors&&typeof payload.contractors==='object'?payload.contractors:{};
  const issueKeys=smartIssueHashes_(payload?.issueKeys);

  const historyRange=`${qSheet(SMART_HISTORY_SHEET)}!A2:R5000`;
  const raw=(await sheets.spreadsheets.values.get({
    spreadsheetId:SPREADSHEET_ID,range:historyRange,valueRenderOption:'UNFORMATTED_VALUE'
  })).data.values||[];
  const history=raw.map((r,i)=>smartHistoryRowToObj_(r,i+2)).filter(x=>x.date);
  const previous=[...history].filter(x=>x.date<today).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
  const previousKeys=new Set(previous?.issueKeys||[]);
  const currentKeys=new Set(issueKeys);
  const newIssues=previous?issueKeys.filter(k=>!previousKeys.has(k)).length:0;
  const resolvedIssues=previous?[...previousKeys].filter(k=>!currentKeys.has(k)).length:0;

  const row=[
    today,timestamp,APP.TITLE,
    smartHistoryNum_(summary.totalOrders),smartHistoryNum_(summary.completed),smartHistoryNum_(summary.executionRate),
    smartHistoryNum_(summary.health),smartHistoryNum_(summary.qualityAvg),smartHistoryNum_(summary.docScore),
    smartHistoryNum_(summary.totalIssues),smartHistoryNum_(summary.critical),smartHistoryNum_(summary.high),
    newIssues,resolvedIssues,JSON.stringify(issueKeys),JSON.stringify(categories),JSON.stringify(contractors),'v1'
  ];
  const todayRow=history.find(x=>x.date===today);
  if(todayRow){
    await sheets.spreadsheets.values.update({
      spreadsheetId:SPREADSHEET_ID,
      range:`${qSheet(SMART_HISTORY_SHEET)}!A${todayRow.rowNumber}:R${todayRow.rowNumber}`,
      valueInputOption:'RAW',requestBody:{values:[row]}
    });
  }else{
    await sheets.spreadsheets.values.append({
      spreadsheetId:SPREADSHEET_ID,
      range:`${qSheet(SMART_HISTORY_SHEET)}!A:R`,
      valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[row]}
    });
  }

  const current=smartHistoryRowToObj_(row,todayRow?.rowNumber||history.length+2);
  const compactHistory=[...history.filter(x=>x.date!==today),current]
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(-30)
    .map(x=>({date:x.date,health:x.health,qualityAvg:x.qualityAvg,executionRate:x.executionRate,totalIssues:x.totalIssues,critical:x.critical,high:x.high}));

  return {
    ok:true,source:'google-sheet',sheet:SMART_HISTORY_SHEET,today,updatedAt:timestamp,
    current:{date:today,...summary,newIssues,resolvedIssues},
    previous:previous?{
      date:previous.date,totalOrders:previous.totalOrders,completed:previous.completed,executionRate:previous.executionRate,
      health:previous.health,qualityAvg:previous.qualityAvg,docScore:previous.docScore,totalIssues:previous.totalIssues,
      critical:previous.critical,high:previous.high
    }:null,
    changes:{
      completed:previous?smartHistoryNum_(summary.completed)-previous.completed:0,
      executionRate:previous?smartHistoryNum_(summary.executionRate)-previous.executionRate:0,
      health:previous?smartHistoryNum_(summary.health)-previous.health:0,
      qualityAvg:previous?smartHistoryNum_(summary.qualityAvg)-previous.qualityAvg:0,
      totalIssues:previous?smartHistoryNum_(summary.totalIssues)-previous.totalIssues:0,
      critical:previous?smartHistoryNum_(summary.critical)-previous.critical:0,
      newIssues,resolvedIssues
    },
    history:compactHistory
  };
}

const WO360_HEADER_SCAN_ROWS=40;
const WO360_SYSTEM_SHEETS=['dp users','dashboard history'];

function wo360Norm_(v){
  return clean_(v).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase().replace(/\s+/g,' ').trim();
}
function wo360Key_(v){
  const raw=wo360Norm_(v).replace(/[\s\-_/\\]+/g,'');
  if(!raw)return '';
  if(/^\d+(?:\.0+)?$/.test(raw))return raw.replace(/\.0+$/,'');
  return raw;
}
function wo360HeaderIsWorkOrder_(v){
  const s=wo360Norm_(v).replace(/\s+/g,' ');
  if(!s)return false;
  if(['امر العمل','رقم امر العمل','رقم امر العمل uds','work order','work order no','work order number','wo','wo no'].includes(s))return true;
  if(s.includes('رقم امر العمل')&&!s.includes('نوع')&&!s.includes('قيم')&&!s.includes('رمز'))return true;
  return false;
}
function wo360Col_(n){
  let s='';n=Number(n)+1;
  while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}
  return s;
}
function wo360SafeSheet_(title){
  const n=wo360Norm_(title);
  if(WO360_SYSTEM_SHEETS.includes(n))return false;
  if(n.includes('password')||n.includes('كلمه المرور')||n.includes('تسجيل الدخول')||n==='users'||n==='user')return false;
  return true;
}
function wo360FieldLabel_(header,index){
  const h=clean_(header);
  return h||('عمود '+wo360Col_(index));
}

async function getWorkOrder360(workOrder){
  const target=wo360Key_(workOrder);
  if(!target)throw new Error('أدخل رقم أمر العمل أولاً');
  assertConfig();
  const sheets=await getSheets();
  const meta=await sheets.spreadsheets.get({
    spreadsheetId:SPREADSHEET_ID,
    fields:'properties(title),sheets.properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount))'
  });
  const spreadsheetTitle=clean_(meta.data.properties?.title)||APP.TITLE;
  const sheetDefs=(meta.data.sheets||[])
    .map(x=>x.properties||{})
    .filter(x=>x.title&&wo360SafeSheet_(x.title))
    .sort((a,b)=>(a.index||0)-(b.index||0));

  const scanRanges=sheetDefs.map(s=>`${qSheet(s.title)}!A1:ZZ${WO360_HEADER_SCAN_ROWS}`);
  const scanResp=scanRanges.length?await sheets.spreadsheets.values.batchGet({
    spreadsheetId:SPREADSHEET_ID,ranges:scanRanges,valueRenderOption:'FORMATTED_VALUE'
  }):{data:{valueRanges:[]}};
  const scans=scanResp.data.valueRanges||[];
  const candidates=[];

  sheetDefs.forEach((def,si)=>{
    const values=scans[si]?.values||[];
    let best=null;
    for(let r=0;r<Math.min(values.length,WO360_HEADER_SCAN_ROWS);r++){
      const row=values[r]||[];
      const cols=[];
      row.forEach((v,c)=>{if(wo360HeaderIsWorkOrder_(v))cols.push(c)});
      if(cols.length){best={headerRow:r+1,headers:row,columns:cols};break}
    }
    if(best)candidates.push({def,...best});
  });

  const colRanges=[];
  const colRefs=[];
  candidates.forEach(c=>{
    c.columns.forEach(col=>{
      colRanges.push(`${qSheet(c.def.title)}!${wo360Col_(col)}:${wo360Col_(col)}`);
      colRefs.push({candidate:c,col});
    });
  });
  const colResp=colRanges.length?await sheets.spreadsheets.values.batchGet({
    spreadsheetId:SPREADSHEET_ID,ranges:colRanges,valueRenderOption:'FORMATTED_VALUE'
  }):{data:{valueRanges:[]}};
  const colVals=colResp.data.valueRanges||[];
  const matches=[];

  colRefs.forEach((ref,i)=>{
    const vals=colVals[i]?.values||[];
    for(let r=ref.candidate.headerRow;r<vals.length;r++){
      const cell=vals[r]?.[0];
      if(wo360Key_(cell)===target){
        const rowNumber=r+1;
        const key=ref.candidate.def.title+'|'+rowNumber;
        if(!matches.some(m=>m.key===key)){
          matches.push({key,sheet:ref.candidate.def.title,rowNumber,headerRow:ref.candidate.headerRow,headers:ref.candidate.headers});
        }
      }
    }
  });

  const rowRanges=matches.map(m=>`${qSheet(m.sheet)}!A${m.rowNumber}:ZZ${m.rowNumber}`);
  const rowResp=rowRanges.length?await sheets.spreadsheets.values.batchGet({
    spreadsheetId:SPREADSHEET_ID,ranges:rowRanges,valueRenderOption:'FORMATTED_VALUE'
  }):{data:{valueRanges:[]}};
  const rowVals=rowResp.data.valueRanges||[];

  const records=matches.map((m,i)=>{
    const row=rowVals[i]?.values?.[0]||[];
    const fields=[];
    const width=Math.max(m.headers.length,row.length);
    for(let c=0;c<width;c++){
      const value=row[c];
      if(clean_(value)==='')continue;
      fields.push({column:wo360Col_(c),label:wo360FieldLabel_(m.headers[c],c),value:String(value)});
    }
    return {sheet:m.sheet,rowNumber:m.rowNumber,headerRow:m.headerRow,fields};
  });

  const bySheet=new Map();
  records.forEach(r=>{
    if(!bySheet.has(r.sheet))bySheet.set(r.sheet,[]);
    bySheet.get(r.sheet).push(r);
  });
  const sources=[...bySheet.entries()].map(([sheet,rows])=>{const def=sheetDefs.find(x=>x.title===sheet)||{};return {sheet,sheetId:def.sheetId,count:rows.length,records:rows}});
  return {
    ok:true,workOrder:clean_(workOrder),normalized:target,spreadsheetTitle,spreadsheetUrl:'https://docs.google.com/spreadsheets/d/'+SPREADSHEET_ID+'/edit',
    scannedSheets:sheetDefs.length,searchableSheets:candidates.length,
    matchedSheets:sources.length,totalRecords:records.length,sources,updatedAt:now_()
  };
}

async function getHrStaffData_(){
  const cacheKey='HR_STAFF_UNIFIED_V2';
  const hit=cacheGet(cacheKey); if(hit)return hit;
  const vals=await valuesGetFrom_(HR_SPREADSHEET_ID,qSheet(HR_SHEET)+'!A1:EP');
  if(vals.length<3)return {updatedAt:now_(),courses:[],rows:[]};
  const h1=vals[0]||[];
  const courseCols=[];
  for(let c=122;c<=133&&c<h1.length;c++){
    const title=clean_(h1[c]);
    if(title)courseCols.push({title,col:c});
  }
  const rows=[];
  vals.slice(2).forEach((r,i)=>{
    const code=clean_(r[1]), name=clean_(r[2]); if(!code&&!name)return;
    const project=clean_(r[4]);
    const city=project.includes('مكة')?'مكة':project.includes('جدة')?'جدة':'أخرى';
    const trainingRequired=num_(r[114]);
    const trainingUnavailable=num_(r[115]);
    const trainingBooked=num_(r[116]);
    const trainingScheduled=num_(r[117]);
    const trainingAvailableNotBooked=num_(r[118]);
    const trainingPendingAcademy=num_(r[119]);
    const trainingCompleted=num_(r[120]);
    const pctRaw=Number(String(r[121]||'').replace('%','').replace(',','.'));
    const trainingPct=Number.isFinite(pctRaw)?Math.round(pctRaw*10)/10:(trainingRequired?Math.round(trainingCompleted/trainingRequired*1000)/10:100);
    const missingCourses=[];
    const courseStatuses={};
    courseCols.forEach(c=>{
      const status=clean_(r[c.col]);
      courseStatuses[c.title]=status;
      if(status==='لا')missingCourses.push(c.title);
    });
    rows.push({
      row:i+3,code,name,nameEn:clean_(r[3]),project,city,role:clean_(r[6]),
      scheduleGroup:clean_(r[7]),sponsorship:clean_(r[12]),nationality:clean_(r[13]),
      id:clean_(r[14]),phone:clean_(r[15]),email:clean_(r[17]),
      cardNo:clean_(r[18]),cardExpiry:clean_(r[19]),cardStatus:clean_(r[20]),cardDays:clean_(r[21]),
      vehicle:clean_(r[22]),qualification:clean_(r[24]),
      electricityLeave:clean_(r[113]),
      trainingRequired,trainingUnavailable,trainingBooked,trainingScheduled,
      trainingAvailableNotBooked,trainingPendingAcademy,trainingCompleted,trainingPct,
      missingCourses,courseStatuses
    });
  });
  const out={updatedAt:now_(),courses:courseCols.map(x=>x.title),rows};
  cachePut(cacheKey,out,60); return out;
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
  for(const c of candidates){
    const nc=norm_(c);if(!nc)continue;
    let i=normalized.indexOf(nc);if(i>=0)return i;
    // منع المطابقة الكاذبة مع هيدرات قصيرة مثل «م».
    i=normalized.findIndex(h=>h&&h.length>=4&&nc.length>=4&&(h.includes(nc)||nc.includes(h)));
    if(i>=0)return i;
  }
  return -1;
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
  const keys=await valuesGet(`${qSheet(cfg.sheet)}!D2:D`);
  let last=-1;
  for(let i=keys.length-1;i>=0;i--){if(cleanWorkOrder_(keys[i]?.[0])){last=i;break}}
  if(last<0)return [];
  const vals=await valuesGet(`${qSheet(cfg.sheet)}!T2:BD${last+2}`);
  return vals.map((r,i)=>({
    _row:i+2,
    category:clean_(r[0]),
    executionEntity:clean_(r[1]),
    office:clean_(r[2]),
    duration:clean_(r[7]),
    delay:clean_(r[8]),
    consultantAction:clean_(r[9]),
    consultantDays:clean_(r[11]),
    consultant155:clean_(r[12]),
    consultant155Date:clean_(r[13]),
    contractorAction:clean_(r[14]),
    contractorDays:clean_(r[16]),
    contractor155:clean_(r[17]),
    contractor155Date:clean_(r[18]),
    contractorPosition:clean_(r[19]),
    permit:clean_(r[21]),
    payment:clean_(r[24]),
    advice:clean_(r[34]),
    stage:clean_(r[35]),
    stageStatus:clean_(r[36])
  }));
}

async function readConfiguredSheet_(cfg,cacheKey){
  const key='PDC_V3_'+cacheKey;
  if(cacheKey!=='workorders'){const hit=cacheGet(key);if(hit)return hit}
  const endColumn=cacheKey==='workorders'?'BD':cacheKey==='emergency'?'Z':cacheKey==='connections'?'AO':cacheKey==='permits'?'T':'AZ';  const values=await valuesGet(`${qSheet(cfg.sheet)}!A:${endColumn}`);
  const headerRow=cfg.headerRow||1;
  if(values.length<headerRow)return [];
  const headers=(values[headerRow-1]||[]).map(clean_);
  const map={}; cfg.fields.forEach(f=>{map[f[0]]=findHeader_(headers,f[2])});
  if(cacheKey==='workorders'){
    map.assignedDate=5;map.value=10;map.status=17;map.consultant155=31;map.contractor155=36;map.permitStatus=40;map.payment=43;map.stage=54;map.stageStatus=55;
  }
  if(cacheKey==='permits')Object.assign(map,{workOrder:3,contractor:4,type:5,assignedDate:6,duration:7,location:8,category:9,section:10,sectionNote:11,permitStatus:13,permitStart:14,permitEnd:15,permitNotes:16,actionTaken:17,days:18,evaluation:19});
  if(cacheKey==='connections')Object.assign(map,{workOrder:2,type:4,description:5,contractor:6,section:7,location:8,assignedDate:9,days:10,contractorAction:11,category:12,duration:13,delay:14,permit:15,permitStart:16,permitEnd:17,engineer:21,stage:22,stageStatus:23,office:24,detail:25,advice:28,adviceDate:29,adviceAge:30});
  if(cacheKey==='connections')Object.assign(map,{consultant155CompletionDate:32,timeRatio:35,excavationProgress:36,extensionProgress:37,progress:38,spi:39,executionStatus:40});
  let body=values.slice(headerRow);
  if(cacheKey==='permits'){
    let last=-1; for(let i=body.length-1;i>=0;i--){if(clean_(body[i]?.[3])!==''){last=i;break}} body=last>=0?body.slice(0,last+1):[];
  } else if(cacheKey==='connections'){
    let last=-1; for(let i=body.length-1;i>=0;i--){if(clean_(body[i]?.[2])!==''){last=i;break}} body=last>=0?body.slice(0,last+1):[];
  } else if(cacheKey!=='emergency') body=body.slice(0,APP.MAX_ROWS);
  const rows=[];
  body.forEach((r,idx)=>{
    const obj={_row:headerRow+1+idx},search=[];let meaningful=false;
    cfg.fields.forEach(f=>{const absolute=map[f[0]];let v=absolute>=0?clean_(r[absolute]):'';if(f[0]==='workOrder')v=cleanWorkOrder_(v);obj[f[0]]=v;if(v){meaningful=true;search.push(v)}});
    if(cacheKey==='emergency'&&!clean_(obj.noticeNo))return;
    if(cacheKey==='connections'&&!clean_(obj.workOrder))return;
    if(cacheKey==='permits'&&!clean_(obj.workOrder))return;
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
  return {title:APP.TITLE,updatedAt:now_(),master:{rows,kpis:getFastMasterKpis_(rows)},pageMeta:Object.keys(APP.PAGES).reduce((o,k)=>{const p=APP.PAGES[k];o[k]={title:p.title,finance:k==='finance',sheet:p.sheet||'',fields:(p.fields||[]).map(f=>({key:f[0],label:f[1]}))};return o},{})};
}
async function getSecondaryMasterKpis(){
  const x=await getMasterExtras_();
  return [kpi_('مخالفات التنفيذ',num_(x.executionViolations),'executionViolations','danger'),kpi_('محاضر مخالفة اثبات الحالة',num_(x.minutes),'minutes','warning'),kpi_('إجمالي الغرامات',x.penalties,'minutes','danger','ر.س',false,true),kpi_('مرفقات مرفوعة',x.attachmentsUploaded,'attachments','success',pct_(x.attachmentsUploaded,x.attachmentsTotal)),kpi_('مرفقات غير مكتملة',Math.max(0,x.attachmentsTotal-x.attachmentsUploaded),'attachments','warning'),kpi_('حالات الطوارئ',x.emergencyTotal,'emergency','purple'),kpi_('طوارئ منتهية',x.emergencyDone,'emergency','success',pct_(x.emergencyDone,x.emergencyTotal)),kpi_('المهام والإفادات',x.tasksTotal,'tasks','primary'),kpi_('مهام معالجة',x.tasksResolved,'tasks','success',pct_(x.tasksResolved,x.tasksTotal))];
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

async function readSheetColumnLinks_(sheetName,columnLetter){
  try{
    assertConfig();
    const sheets=await getSheets();
    const meta=await sheets.spreadsheets.get({
      spreadsheetId:SPREADSHEET_ID,
      ranges:[`${qSheet(sheetName)}!${columnLetter}2:${columnLetter}${Math.max(2,Math.min(APP.MAX_ROWS+1,5001))}`],
      includeGridData:true,
      fields:'sheets.data.rowData.values(hyperlink,userEnteredValue,textFormatRuns)'
    });
    const rowData=meta.data.sheets?.[0]?.data?.[0]?.rowData||[];
    const links=new Map();
    rowData.forEach((rd,i)=>{
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
    return links;
  }catch(e){
    console.warn('Sheet hyperlink enrichment skipped:',sheetName,columnLetter,e.message||e);
    return new Map();
  }
}

async function getExecutionViolationsPage_(){
  const cfg=APP.PAGES.executionViolations;
  const rows=await readConfiguredSheet_(cfg,'executionViolations');
  const links=await readSheetColumnLinks_(cfg.sheet,'N');
  rows.forEach(r=>{
    const u=links.get(Number(r._row));
    if(u)r.link=u;
    else if(!/^https?:\/\//i.test(clean_(r.link)))r.link='';
    r._search=[r.workOrder,r.type,r.workOrderCode,r.contractor,r.date,r.violation,r.violationSection,r.supervisor,r.editor,r.reason,r.emailStatus,r.emailTo].join(' ').toLowerCase();
  });
  return {key:'executionViolations',title:cfg.title,updatedAt:now_(),rows,columns:cfg.fields.map(f=>({key:f[0],label:f[1]})),filterKeys:cfg.filters||[]};
}

async function getMinutesPage_(){
  const cfg=APP.PAGES.minutes;
  const rows=await readConfiguredSheet_(cfg,'minutes');
  const excelLinks=await readSheetColumnLinks_(cfg.sheet,'AJ');
  const pdfLinks=await readSheetColumnLinks_(cfg.sheet,'AK');
  const pcloudLinks=await readSheetColumnLinks_(cfg.sheet,'AL');
  rows.forEach(r=>{
    const n=Number(r._row);
    r.excelLink=excelLinks.get(n)||(/^https?:\/\//i.test(clean_(r.excelLink))?r.excelLink:'');
    r.pdfLink=pdfLinks.get(n)||(/^https?:\/\//i.test(clean_(r.pdfLink))?r.pdfLink:'');
    r.pcloudLink=pcloudLinks.get(n)||(/^https?:\/\//i.test(clean_(r.pcloudLink))?r.pcloudLink:'');
    r._search=[r.minuteType,r.workOrder,r.type,r.contractor,r.region,r.workLocation,r.date,r.location,r.statement,r.editor,r.consultantRep,r.uploadStatus,r.source,r.notes].join(' ').toLowerCase();
  });
  return {key:'minutes',title:cfg.title,updatedAt:now_(),rows,columns:cfg.fields.map(f=>({key:f[0],label:f[1]})),filterKeys:cfg.filters||[]};
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

function smartDigits_(v){return String(v==null?'':v).replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/[۰-۹]/g,d=>'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])}
function smartDate_(v){const s=smartDigits_(clean_(v));if(!s)return null;const zone=APP.TZ||'Asia/Riyadh';let m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s.*)?$/);if(m){let x=DateTime.fromObject({year:+m[3],month:+m[2],day:+m[1]},{zone});if(x.isValid)return x.startOf('day')}m=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:\s.*)?$/);if(m){let x=DateTime.fromObject({year:+m[1],month:+m[2],day:+m[3]},{zone});if(x.isValid)return x.startOf('day')}let d=DateTime.fromISO(s,{zone});if(d.isValid)return d.startOf('day');for(const f of ['M/d/yyyy','MM/dd/yyyy','d/M/yy','M/d/yy']){d=DateTime.fromFormat(s,f,{zone});if(d.isValid)return d.startOf('day')}return null}
function smartWeekRange_(){const now=DateTime.now().setZone(APP.TZ||'Asia/Riyadh');const today=now.startOf('day');const sinceFriday=(today.weekday-5+7)%7;const start=today.minus({days:sinceFriday});const end=start.plus({days:6}).endOf('day');const prevStart=start.minus({days:7});const prevEnd=start.minus({days:1}).endOf('day');return {now,start,end,prevStart,prevEnd}}
function smartTextNorm_(v){return clean_(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim()}
function smartExplicitClosed_(r){const s=smartTextNorm_([r.status,r.detail,r.notes].filter(Boolean).join(' '));return ['مغلق','تم الاغلاق','تم اغلاق','تمت المعالجه','تم المعالجه','تم الحل','تمت المعالجه بالكامل'].some(x=>s.includes(x))}
function smartCountBy_(rows,key){const m=new Map();rows.forEach(r=>{const v=clean_(r[key])||'غير محدد';m.set(v,(m.get(v)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1])}
function smartWoMap_(rows){const m=new Map();rows.forEach(r=>{const k=cleanWorkOrder_(r.workOrder);if(!k)return;const x=m.get(k)||{count:0,contractor:''};x.count++;if(!x.contractor&&r.contractor)x.contractor=r.contractor;m.set(k,x)});return m}
function smartGapStats_(rows){const fields=[['workOrder','رقم أمر العمل'],['contractor','المقاول'],['date','التاريخ'],['violation','نوع المخالفة / المحضر']];const counts={};let affected=0;rows.forEach(r=>{let bad=false;fields.forEach(([k,l])=>{if(!clean_(r[k])){counts[l]=(counts[l]||0)+1;bad=true}});if(bad)affected++});return {affected,fields:Object.entries(counts).map(([field,count])=>({field,count})).sort((a,b)=>b.count-a.count)}}
function smartNormalizeViolations_(safety,execution,minutes){const rows=[];safety.forEach(r=>rows.push({source:'مخالفات السلامة',workOrder:r.workOrder||'',type:r.type||'',contractor:r.contractor||'',date:r.date||'',violation:[r.violation1,r.violation2].filter(Boolean).join(' / '),status:'',detail:r.reason||'',notes:'',penalty:0}));execution.forEach(r=>rows.push({source:'مخالفات التنفيذ',workOrder:r.workOrder||'',type:r.type||'',contractor:r.contractor||'',date:r.date||'',violation:r.violation||'',status:r.emailStatus||'',detail:r.reason||'',notes:r.emailNote||'',penalty:0}));minutes.forEach(r=>rows.push({source:'محاضر إثبات الحالة',workOrder:r.workOrder||'',type:r.type||'',contractor:r.contractor||'',date:r.date||'',violation:r.minuteType||r.penaltyItem1||'',status:r.uploadStatus||'',detail:r.statement||'',notes:r.notes||'',penalty:num_(r.penalty)}));rows.forEach(r=>{r.closed=smartExplicitClosed_(r);r._search=Object.values(r).join(' ').toLowerCase()});return rows}
async function getSmartThursdayPage_(){const cfg=APP.PAGES.smartThursday;const [safety,execution,minutes]=await Promise.all([readConfiguredSheet_(APP.PAGES.safety,'safety'),readConfiguredSheet_(APP.PAGES.executionViolations,'executionViolations'),readConfiguredSheet_(APP.PAGES.minutes,'minutes')]);const all=smartNormalizeViolations_(safety,execution,minutes);const rg=smartWeekRange_();const between=(r,a,b)=>{const d=smartDate_(r.date);return !!d&&d.toMillis()>=a.toMillis()&&d.toMillis()<=b.toMillis()};const current=all.filter(r=>between(r,rg.start,rg.end));const previous=all.filter(r=>between(r,rg.prevStart,rg.prevEnd));const curWo=smartWoMap_(current),prevWo=smartWoMap_(previous);const topContractor=smartCountBy_(current,'contractor')[0]||['—',0],topWorkOrder=smartCountBy_(current,'workOrder').filter(x=>x[0]!=='غير محدد')[0]||['—',0];const repeated=[...curWo].filter(([,x])=>x.count>1).sort((a,b)=>b[1].count-a[1].count).map(([workOrder,x])=>({workOrder,count:x.count,contractor:x.contractor}));const newWorkOrders=[...curWo].filter(([k])=>!prevWo.has(k)).map(([workOrder,x])=>({workOrder,count:x.count,contractor:x.contractor})).sort((a,b)=>b.count-a.count);const increased=[...curWo].filter(([k,x])=>prevWo.has(k)&&x.count>prevWo.get(k).count).map(([workOrder,x])=>({workOrder,current:x.count,previous:prevWo.get(workOrder).count,delta:x.count-prevWo.get(workOrder).count,contractor:x.contractor||prevWo.get(workOrder).contractor})).sort((a,b)=>b.delta-a.delta||b.current-a.current);const noMovement=[...prevWo].filter(([k])=>!curWo.has(k)).map(([workOrder,x])=>({workOrder,previous:x.count,contractor:x.contractor})).sort((a,b)=>b.previous-a.previous);const curGaps=smartGapStats_(current),prevGaps=smartGapStats_(previous);const gapMap=new Map(prevGaps.fields.map(x=>[x.field,x.count]));const gapChanges=curGaps.fields.map(x=>({field:x.field,current:x.count,previous:gapMap.get(x.field)||0,delta:x.count-(gapMap.get(x.field)||0)})).filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta);const sources=['مخالفات السلامة','مخالفات التنفيذ','محاضر إثبات الحالة'].map(source=>{const c=current.filter(r=>r.source===source).length,p=previous.filter(r=>r.source===source).length;return {source,current:c,previous:p,delta:c-p}});const closed=current.filter(r=>r.closed);const totalPenalty=current.reduce((s,r)=>s+num_(r.penalty),0);current.sort((a,b)=>(smartDate_(b.date)?.toMillis()||0)-(smartDate_(a.date)?.toMillis()||0));const fmt=d=>d.toFormat('dd/LL/yyyy');const report={generatedAt:now_(),period:{from:rg.start.toISODate(),to:rg.end.toISODate(),label:fmt(rg.start)+' — '+fmt(rg.end),complete:rg.now.startOf('day').toISODate()===rg.end.startOf('day').toISODate()},previousPeriod:{from:rg.prevStart.toISODate(),to:rg.prevEnd.toISODate(),label:fmt(rg.prevStart)+' — '+fmt(rg.prevEnd)},kpis:{total:current.length,previousTotal:previous.length,delta:current.length-previous.length,newRecords:current.length,closedExplicit:closed.length,repeatedWorkOrders:repeated.length,uniqueWorkOrders:curWo.size,topContractor:{name:topContractor[0],count:topContractor[1]},topWorkOrder:{name:topWorkOrder[0],count:topWorkOrder[1]},totalPenalty,dataGapRecords:curGaps.affected},sources,changes:{newWorkOrders:newWorkOrders.slice(0,20),increasedWorkOrders:increased.slice(0,20),noMovement:noMovement.slice(0,20),gapDelta:curGaps.affected-prevGaps.affected,gapFields:gapChanges.slice(0,10),closedExplicit:closed.slice(0,20).map(r=>({workOrder:r.workOrder,source:r.source,contractor:r.contractor,status:r.status||r.detail}))},rankings:{repeated:repeated.slice(0,20),contractors:smartCountBy_(current,'contractor').slice(0,10).map(([name,count])=>({name,count})),workOrders:smartCountBy_(current,'workOrder').filter(x=>x[0]!=='غير محدد').slice(0,10).map(([name,count])=>({name,count}))},notes:['المغلق/المعالج يُحتسب فقط عند وجود نص صريح مثل «مغلق» أو «تم الإغلاق» أو «تمت المعالجة» في الحقول النصية المتاحة.','إرسال الإيميل أو رفع المحضر لا يُعتبر إغلاقًا للمخالفة.','«لم تتحرك» تعني أوامر ظهرت في الأسبوع السابق ولم يظهر لها سجل مخالفة/محضر جديد في الأسبوع الحالي.']};return {key:'smartThursday',title:cfg.title,updatedAt:now_(),rows:current,columns:cfg.fields.map(f=>({key:f[0],label:f[1]})),filterKeys:[],report}}

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
    office:7, // العمود H مباشرة: مصدر الشارت والجدول حسب المكتب
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

async function getDataQualityPage_(){
  const pick=(rows,keys)=>rows.map(r=>{
    const o={_row:r._row};
    keys.forEach(k=>{o[k]=r[k]??''});
    return o;
  });
  const [projects,connections,permits,assets,emergency]=await Promise.all([
    readConfiguredSheet_(APP.PAGES.projects,'projects'),
    readConfiguredSheet_(APP.PAGES.connections,'connections'),
    readConfiguredSheet_(APP.PAGES.permits,'permits'),
    readConfiguredSheet_(APP.PAGES.assets,'assets'),
    readConfiguredSheet_(APP.PAGES.emergency,'emergency')
  ]);
  return {
    key:'dataQuality',
    title:'جودة البيانات',
    updatedAt:now_(),
    rows:[],
    columns:[],
    filterKeys:[],
    quality:{
      projects:pick(projects,['workOrder','contractor','engineer','stage','stageStatus','excavationTarget','extensionTarget','advice','adviceAge']),
      connections:pick(connections,['workOrder','contractor','engineer','stage','stageStatus','detail','advice','adviceAge']),
      permits:pick(permits,['workOrder','contractor','permitStatus','actionTaken','evaluation']),
      assets:pick(assets,['workOrder','contractor','location','installDate','engineer','plantingReview','plantingStatus','assetForm','procedure207','fieldReceipt','notes','resolved','systemReceipt']),
      emergency:pick(emergency,['noticeNo','station','assignedDate','startDate','endDate','description','classification','type','administration','circuit','section','emergencyType','location','consultant','engineer','contractor','status','archive'])
    }
  };
}

async function getPageData(pageKey){
  const cfg=APP.PAGES[pageKey];if(!cfg)throw new Error('صفحة غير معرفة: '+pageKey);
  if(pageKey==='dataQuality')return getDataQualityPage_();
  if(pageKey==='executionViolations')return getExecutionViolationsPage_();
  if(pageKey==='minutes')return getMinutesPage_();
  if(pageKey==='smartThursday')return getSmartThursdayPage_();
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

const PROJECT_NEWS_RETENTION_MS=72*60*60*1000;
const projectNewsState={snapshot:new Map(),events:new Map(),rowSnapshots:new Map()};

function newsExact_(v,x){return norm_(v)===norm_(x)}
function newsChecked_(v){return v===true||/^(true|نعم|تم|yes|1)$/i.test(clean_(v))}
function newsBlank_(r,k){return !clean_(r&&r[k])}
function newsPriority_(count,total){
  const rate=total?count/total:0;
  if(count>=50||rate>=0.20)return 'عاجل';
  if(count>=10||rate>=0.08)return 'مهم';
  return 'تحديث';
}
function newsEvent_(key,priority,category,title,summary){
  const date=DateTime.now().setZone(APP.TZ||'Asia/Riyadh').toISO();
  projectNewsState.events.set(key,{
    show:'نعم',date,priority,category,title,summary:summary||'',
    sender:'',emailUrl:'',messageId:'',syncedAt:now_(),
    source:'تحليل الشيتات',eventKey:key
  });
}
function newsFmt_(v,unit){
  const n=Number(v||0);
  const x=Math.abs(n-Math.round(n))<0.0001?String(Math.round(n)):String(Math.round(n*10)/10);
  return x+(unit||'');
}
function newsRowValue_(v){return clean_(v).replace(/\s+/g,' ').slice(0,180)}
function newsTrackRows_(pageKey,rows,idField,fields,category,label){
  const current=new Map();
  for(const r of rows||[]){
    const id=newsRowValue_(r[idField]||r.workOrder||r.noticeNo||r._row);
    if(!id)continue;
    const snap={};
    for(const [field] of fields)snap[field]=newsRowValue_(r[field]);
    current.set(id,snap);
  }
  const previous=projectNewsState.rowSnapshots.get(pageKey);
  projectNewsState.rowSnapshots.set(pageKey,current);
  if(!previous)return;
  let emitted=0;
  const maxPerCycle=35;
  for(const [id,cur] of current){
    if(emitted>=maxPerCycle)break;
    const old=previous.get(id);
    if(!old){
      newsEvent_('row:new:'+pageKey+':'+norm_(id),'تحديث','جديد • '+category,'سجل جديد في '+label+' — '+id,'تم رصد سجل جديد مباشرة من الشيت.');
      emitted++;
      continue;
    }
    for(const [field,fieldLabel] of fields){
      const before=old[field]||'',after=cur[field]||'';
      if(before===after)continue;
      const sig=crypto.createHash('sha1').update(before+'→'+after).digest('hex').slice(0,8);
      const completed=/(منجز|تم التنفيذ|تمت المراجعة|تم الاعتماد من pdc|تم اصدار التصريح|مرحلة الإغلاق|مرحلة الاغلاق|^نعم$|^تم$)/i.test(norm_(after));
      const priority=before&&!after?'مهم':completed?'إنجاز':'تحديث';
      newsEvent_('row:change:'+pageKey+':'+norm_(id)+':'+field+':'+sig,priority,'تغيير مباشر • '+category,'تغير '+fieldLabel+' — '+id,'من «'+(before||'فارغ')+'» إلى «'+(after||'فارغ')+'».');
      emitted++;
      if(emitted>=maxPerCycle)break;
    }
  }
  if(emitted>=maxPerCycle)newsEvent_('row:burst:'+pageKey,'مهم','تغييرات كثيفة • '+category,'تم رصد تغييرات كثيرة في '+label,'تم عرض أول '+maxPerCycle+' تغييرًا مباشرًا في هذه الدورة؛ يستمر الرصد في الدورة التالية.');
}
function newsTrackConfiguredRows_(pageKey,rows,idField){
  const cfg=APP.PAGES[pageKey]||{};
  const fields=(cfg.fields||[]).map(f=>[f[0],f[1]||f[0]]).filter(x=>x[0]&&x[0]!==idField);
  if(fields.length)newsTrackRows_(pageKey,rows,idField,fields,cfg.title||pageKey,cfg.title||pageKey);
}
function newsObserve_(o){
  const value=Number(o.value||0),prev=projectNewsState.snapshot.get(o.key),unit=o.unit||'';
  const widespread=o.kind==='issue'&&Number(o.total||0)>=10&&value/Number(o.total||1)>=0.95;
  const issueCategory=widespread?'فجوة شاملة • '+o.category:o.category;
  const issueNote=(widespread?'الملاحظة تشمل 95% أو أكثر من السجلات؛ راجع احتمال وجود فجوة تشغيلية عامة أو تغير/خلل في ربط العمود. ':'')+(o.note||'رصد تلقائي من بيانات المشروع الحالية');
  projectNewsState.snapshot.set(o.key,value);
  if(o.silent)return;
  if(prev===undefined){
    if(o.kind==='issue'&&value>0){
      newsEvent_(o.key,newsPriority_(value,o.total),issueCategory,(widespread?'فجوة شاملة — ':'')+o.label+': '+newsFmt_(value,unit)+' حالة',issueNote);
    }else if(o.kind==='progress'&&o.initialNews&&value>0){
      newsEvent_(o.key,'تحديث',o.category,o.label+' حاليًا: '+newsFmt_(value,unit),o.note||'قراءة حالية من بيانات المشروع.');
    }
    return;
  }
  if(prev===value)return;
  const delta=Math.round((value-prev)*10)/10;
  if(o.kind==='issue'){
    if(value===0&&prev>0){
      newsEvent_(o.key,'إنجاز','تمت المعالجة','تمت معالجة «'+o.label+'» بالكامل','كان عدد الحالات '+newsFmt_(prev,unit)+' وأصبح صفرًا.');
    }else if(value>0&&delta<0){
      newsEvent_(o.key,'تحسن','تحسن • '+o.category,'تحسن «'+o.label+'»: انخفضت الحالات من '+newsFmt_(prev,unit)+' إلى '+newsFmt_(value,unit),'تم خفض عدد الحالات بمقدار '+newsFmt_(Math.abs(delta),unit)+'. '+issueNote);
    }else if(value>0){
      newsEvent_(o.key,newsPriority_(value,o.total),issueCategory,(widespread?'فجوة شاملة — ':'')+o.label+': '+newsFmt_(value,unit)+' حالة — زيادة '+newsFmt_(Math.abs(delta),unit),'القيمة السابقة '+newsFmt_(prev,unit)+' والحالية '+newsFmt_(value,unit)+'. '+issueNote);
    }
  }else{
    if(delta>0&&o.goodUp===true){
      newsEvent_(o.key,'إنجاز',o.category,'تقدم «'+o.label+'»: +'+newsFmt_(delta,unit)+' — الإجمالي '+newsFmt_(value,unit),o.note||'تقدم تلقائي مرصود من بيانات المشروع.');
    }else if(delta<0&&o.goodUp===true){
      newsEvent_(o.key,'مهم','تراجع • '+o.category,'انخفاض «'+o.label+'» بمقدار '+newsFmt_(Math.abs(delta),unit)+' — الحالي '+newsFmt_(value,unit),o.note||'يستحسن مراجعة سبب الانخفاض.');
    }else{
      const word=delta>0?'ارتفع':'انخفض';
      newsEvent_(o.key,'تحديث',o.category,o.label+': '+newsFmt_(prev,unit)+' ← '+newsFmt_(value,unit),word+' المؤشر بمقدار '+newsFmt_(Math.abs(delta),unit)+'.');
    }
  }
}

function newsSmartAggregate_(observations){
  let added=0,resolved=0,qualityAdded=0,qualityResolved=0;
  const changed=[];
  for(const o of observations){
    const prev=projectNewsState.snapshot.get(o.key);
    if(prev===undefined)continue;
    const value=Number(o.value||0),delta=Math.round((value-Number(prev||0))*10)/10;
    if(!delta)continue;
    changed.push({o,prev:Number(prev||0),value,delta});
    if(o.kind==='issue'){
      if(delta>0){added+=delta;if(String(o.key).startsWith('dq:'))qualityAdded+=delta}
      else{resolved+=Math.abs(delta);if(String(o.key).startsWith('dq:'))qualityResolved+=Math.abs(delta)}
    }
  }
  if(resolved>0)newsEvent_('smart:resolved','إنجاز','Smart News Feed','تم إغلاق '+newsFmt_(resolved)+' ملاحظة تحليلية منذ آخر تحديث','يشمل التحسن الملاحظات التشغيلية وجودة البيانات التي انخفض عددها.');
  if(added>0)newsEvent_('smart:added','مهم','Smart News Feed','ظهرت '+newsFmt_(added)+' ملاحظة تحليلية جديدة منذ آخر تحديث','تم احتساب الزيادات الفعلية في قواعد التدقيق؛ قد يجمع السجل الواحد أكثر من نوع ملاحظة.');
  if(qualityResolved>0)newsEvent_('smart:qualityResolved','تحسن','جودة البيانات','تحسن جودة البيانات — تم إغلاق '+newsFmt_(qualityResolved)+' ملاحظة جودة','مقارنة بآخر قراءة للشيتات.');
  if(qualityAdded>0)newsEvent_('smart:qualityAdded','مهم','جودة البيانات','ظهرت '+newsFmt_(qualityAdded)+' ملاحظة جودة بيانات جديدة','تحتاج مراجعة الحقول أو السجلات التي تغيرت.');

  const byKey=new Map(changed.map(x=>[x.o.key,x]));
  const delayed=byKey.get('ops:delayedExecution');
  if(delayed?.delta>0)newsEvent_('smart:delayed','مهم','التأخير',newsFmt_(delayed.delta)+' حالة دخلت نطاق التأخير','ارتفع عدد أوامر العمل المتأخرة من '+newsFmt_(delayed.prev)+' إلى '+newsFmt_(delayed.value)+'.');
  if(delayed?.delta<0)newsEvent_('smart:delayed','إنجاز','التأخير','انخفض نطاق التأخير بمقدار '+newsFmt_(Math.abs(delayed.delta))+' حالة','انخفض عدد أوامر العمل المتأخرة من '+newsFmt_(delayed.prev)+' إلى '+newsFmt_(delayed.value)+'.');

  const completed=byKey.get('progress:workordersCompleted');
  if(completed?.delta>0)newsEvent_('smart:completed','إنجاز','التنفيذ','تم تنفيذ +'+newsFmt_(completed.delta)+' أمر عمل منذ آخر تحديث','ارتفع إجمالي أوامر العمل المنفذة إلى '+newsFmt_(completed.value)+'.');

  const docs=byKey.get('ops:docsNotReceived');
  if(docs?.delta<0)newsEvent_('smart:docs','إنجاز','مستندات المقاول','تحسن استلام المستندات — انخفض غير المستلم بمقدار '+newsFmt_(Math.abs(docs.delta))+' أمر','الحالات غير المستلمة أصبحت '+newsFmt_(docs.value)+'.');
  if(docs?.delta>0)newsEvent_('smart:docs','مهم','مستندات المقاول','زادت أوامر العمل غير المستلمة مستنداتها بمقدار '+newsFmt_(docs.delta),'الحالات غير المستلمة أصبحت '+newsFmt_(docs.value)+'.');

  const emergency=byKey.get('progress:emergencyCompleted');
  if(emergency?.delta>0)newsEvent_('smart:emergency','إنجاز','الطوارئ','تم إنجاز +'+newsFmt_(emergency.delta)+' إشعار طوارئ','إجمالي الإشعارات المنجزة أصبح '+newsFmt_(emergency.value)+'.');

  const attachments=byKey.get('progress:attachmentsUploaded');
  if(attachments?.delta>0)newsEvent_('smart:attachments','إنجاز','المرفقات','تم استكمال رفع +'+newsFmt_(attachments.delta)+' سجل مرفقات','إجمالي السجلات المرفوعة أصبح '+newsFmt_(attachments.value)+'.');

  const quality=byKey.get('progress:dataQualityScore');
  if(quality?.delta>0)newsEvent_('smart:qualityScore','تحسن','جودة البيانات','تحسن مؤشر جودة البيانات بمقدار '+newsFmt_(quality.delta,'%')+' — أصبح '+newsFmt_(quality.value,'%'),'المؤشر محسوب من قواعد اكتمال وجودة الحقول التي يتابعها الداشبورد.');
  if(quality?.delta<0)newsEvent_('smart:qualityScore','مهم','جودة البيانات','تراجع مؤشر جودة البيانات بمقدار '+newsFmt_(Math.abs(quality.delta),'%')+' — أصبح '+newsFmt_(quality.value,'%'),'ظهرت نواقص أو ملاحظات جديدة ضمن قواعد الجودة المتابعة.');

  const contractors=changed.filter(x=>String(x.o.key).startsWith('contractor:completed:')&&x.delta>0).sort((a,b)=>b.delta-a.delta).slice(0,3);
  contractors.forEach(x=>newsEvent_('smart:contractor:'+x.o.contractor,'إنجاز','المقاولون','المقاول «'+x.o.contractor+'» أنجز +'+newsFmt_(x.delta)+' أمر عمل','إجمالي المنفذ للمقاول أصبح '+newsFmt_(x.value)+' أمر عمل.'));
}
function newsQualityObservations_(q){
  const out=[],add=(section,title,key,label,rows,pred,note)=>{
    const list=Array.isArray(rows)?rows:[];
    out.push({key:`dq:${section}:${key}`,kind:'issue',category:`جودة البيانات • ${title}`,label,value:list.filter(pred).length,total:list.length,note});
  };
  const p=q.projects||[],c=q.connections||[],pm=q.permits||[],a=q.assets||[],e=q.emergency||[];
  add('projects','المشاريع','engineer','مشاريع بدون مهندس مسئول',p,r=>newsBlank_(r,'engineer'));
  add('projects','المشاريع','stage','مشاريع بدون مرحلة تنفيذ',p,r=>newsBlank_(r,'stage'));
  add('projects','المشاريع','stageStatus','مشاريع بدون حالة مرحلة',p,r=>newsBlank_(r,'stageStatus'));
  add('projects','المشاريع','excavationTarget','مشاريع بدون الحفر المستهدف',p,r=>newsBlank_(r,'excavationTarget'));
  add('projects','المشاريع','extensionTarget','مشاريع بدون التمديد المستهدف',p,r=>newsBlank_(r,'extensionTarget'));
  add('projects','المشاريع','advice','مشاريع بدون إفادة استشاري',p,r=>newsBlank_(r,'advice'));
  add('projects','المشاريع','oldAdvice','إفادات مشاريع قديمة',p,r=>!!clean_(r.adviceAge)&&!newsExact_(r.adviceAge,'جديدة'));
  add('connections','التوصيلات','engineer','توصيلات بدون مهندس مسئول',c,r=>newsBlank_(r,'engineer'));
  add('connections','التوصيلات','stage','توصيلات بدون مرحلة تنفيذ',c,r=>newsBlank_(r,'stage'));
  add('connections','التوصيلات','stageStatus','توصيلات بدون حالة مرحلة',c,r=>newsBlank_(r,'stageStatus'));
  add('connections','التوصيلات','advice','توصيلات بدون إفادة استشاري',c,r=>newsBlank_(r,'advice'));
  add('connections','التوصيلات','oldAdvice','إفادات توصيلات قديمة',c,r=>!!clean_(r.adviceAge)&&!newsExact_(r.adviceAge,'جديدة'));
  add('permits','التصاريح','permitStatus','تصاريح بدون حالة تصريح',pm,r=>newsBlank_(r,'permitStatus'));
  add('permits','التصاريح','lateNoAction','تصاريح متأخرة دون اتخاذ اللازم',pm,r=>!!clean_(r.evaluation)&&!newsExact_(r.evaluation,'غير متأخر')&&!newsChecked_(r.actionTaken));
  add('assets','الأصول','installDate','أصول تمت مراجعتها بدون تاريخ تركيب',a,r=>newsExact_(r.plantingReview,'تمت المراجعة')&&newsBlank_(r,'installDate'));
  add('assets','الأصول','engineer','أصول تمت مراجعتها بدون مهندس تركيب',a,r=>newsExact_(r.plantingReview,'تمت المراجعة')&&newsBlank_(r,'engineer'));
  add('assets','الأصول','plantingReview','أصول بدون مراجعة بيانات الزراعة',a,r=>newsBlank_(r,'plantingReview'));
  add('assets','الأصول','plantingStatus','أصول بدون حالة الزراعة',a,r=>newsBlank_(r,'plantingStatus'));
  add('assets','الأصول','assetForm','أصول بدون نموذج الأصول',a,r=>newsBlank_(r,'assetForm'));
  add('assets','الأصول','procedure207','أصول بدون إجراء 207',a,r=>newsBlank_(r,'procedure207'));
  add('assets','الأصول','fieldReceipt','أصول بدون الاستلام الميداني',a,r=>newsBlank_(r,'fieldReceipt'));
  add('assets','الأصول','resolved','ملاحظات أصول بدون بيان التلافي',a,r=>!!clean_(r.notes)&&newsBlank_(r,'resolved'));
  add('assets','الأصول','systemReceipt','أصول بدون حالة الاستلام على النظام',a,r=>newsBlank_(r,'systemReceipt'));
  add('emergency','الطوارئ','noticeNo','طوارئ بدون رقم إشعار',e,r=>newsBlank_(r,'noticeNo'));
  add('emergency','الطوارئ','assignedDate','طوارئ بدون تاريخ إسناد',e,r=>newsBlank_(r,'assignedDate'));
  add('emergency','الطوارئ','startDate','طوارئ منجزة بدون تاريخ مباشرة',e,r=>newsExact_(r.status,'منجز')&&newsBlank_(r,'startDate'));
  add('emergency','الطوارئ','endDate','طوارئ منجزة بدون تاريخ انتهاء',e,r=>newsExact_(r.status,'منجز')&&newsBlank_(r,'endDate'));
  add('emergency','الطوارئ','description','طوارئ بدون وصف عمل',e,r=>newsBlank_(r,'description'));
  add('emergency','الطوارئ','classification','طوارئ بدون تصنيف عمل',e,r=>newsBlank_(r,'classification'));
  add('emergency','الطوارئ','type','طوارئ بدون نوع',e,r=>newsBlank_(r,'type'));
  add('emergency','الطوارئ','administration','طوارئ بدون إدارة',e,r=>newsBlank_(r,'administration'));
  add('emergency','الطوارئ','circuit','طوارئ بدون دائرة',e,r=>newsBlank_(r,'circuit'));
  add('emergency','الطوارئ','section','طوارئ بدون قسم',e,r=>newsBlank_(r,'section'));
  add('emergency','الطوارئ','emergencyType','طوارئ بدون مجدول / طارئ',e,r=>newsBlank_(r,'emergencyType'));
  add('emergency','الطوارئ','location','طوارئ بدون موقع',e,r=>newsBlank_(r,'location'));
  add('emergency','الطوارئ','consultant','طوارئ بدون استشاري',e,r=>newsBlank_(r,'consultant'));
  add('emergency','الطوارئ','engineer','طوارئ بدون اسم استشاري',e,r=>newsBlank_(r,'engineer'));
  add('emergency','الطوارئ','contractor','طوارئ بدون مقاول',e,r=>newsBlank_(r,'contractor'));
  add('emergency','الطوارئ','status','طوارئ بدون حالة تنفيذ',e,r=>newsBlank_(r,'status'));
  add('emergency','الطوارئ','archive','طوارئ بدون أرشفة مستندات',e,r=>newsBlank_(r,'archive'));
  return out;
}
function newsDone_(v){
  const s=norm_(v);if(!s||s.startsWith('لم')||s==='false'||s==='لا')return false;
  return s==='تم'||s==='نعم'||s.startsWith('تم');
}
function newsDateValue_(v){
  const s=clean_(v);if(!s)return null;
  let d=DateTime.fromISO(s,{zone:APP.TZ||'Asia/Riyadh'});
  if(d.isValid)return d.startOf('day');
  for(const f of ['d/M/yyyy','dd/MM/yyyy','d-M-yyyy','dd-MM-yyyy','yyyy/M/d','yyyy-MM-dd']){
    d=DateTime.fromFormat(s,f,{zone:APP.TZ||'Asia/Riyadh'});
    if(d.isValid)return d.startOf('day');
  }
  return null;
}
function newsGap_(out,key,category,label,count,total,note){
  out.push({key,kind:'issue',category,label,value:Number(count||0),total:Number(total||0),note:note||''});
}
function newsExamples_(rows,key,pred,limit=6){
  return rows.filter(pred).map(r=>clean_(r[key]||r.workOrder||r.noticeNo||r._row)).filter(Boolean).slice(0,limit);
}
function newsGroups_(rows,key){
  const g=new Map();
  for(const r of rows){
    const k=clean_(r[key]);if(!k)continue;
    if(!g.has(k))g.set(k,[]);
    g.get(k).push(r);
  }
  return g;
}
function newsConflictGroups_(rows,key,fields){
  const g=newsGroups_(rows,key),examples=[];let count=0;
  for(const [k,a] of g){
    if(a.length<2)continue;
    const bad=fields.some(f=>new Set(a.map(r=>norm_(r[f])).filter(Boolean)).size>1);
    if(bad){count++;if(examples.length<6)examples.push(k);}
  }
  return {count,examples};
}
function newsSetFrom_(rows,key='workOrder'){
  return new Set(rows.map(r=>cleanWorkOrder_(r[key])).filter(Boolean));
}
function newsSetDiff_(a,b){return [...a].filter(x=>!b.has(x))}
async function newsSchemaObservations_(){
  const cacheKey='PDC_NEWS_SCHEMA_AUDIT_V2',hit=cacheGet(cacheKey);if(hit)return hit;
  const out=[];
  const pages=['workorders','projects','connections','permits','closures','assets','emergency','tasks','attachments'];
  for(const pageKey of pages){
    const cfg=APP.PAGES[pageKey];if(!cfg||!cfg.sheet)continue;
    try{
      const end=pageKey==='workorders'?'BD':pageKey==='emergency'?'Z':pageKey==='connections'?'AO':pageKey==='permits'?'T':'AZ';
      const vals=await valuesGet(qSheet(cfg.sheet)+'!A1:'+end+'2');
      const headers=(vals[0]||[]).map(clean_);
      const unmapped=(cfg.fields||[]).filter(f=>findHeader_(headers,f[2])<0);
      if(unmapped.length){
        newsGap_(out,'schema:'+pageKey+':unmapped','فجوة ربط/هيكل','حقول غير مرتبطة في '+cfg.title,unmapped.length,(cfg.fields||[]).length,'الحقول: '+unmapped.slice(0,8).map(f=>f[1]).join('، '));
      }
      const seen=new Map();
      headers.map(norm_).filter(Boolean).forEach(h=>seen.set(h,(seen.get(h)||0)+1));
      const dup=[...seen].filter(x=>x[1]>1);
      if(dup.length){
        newsGap_(out,'schema:'+pageKey+':duplicateHeaders','فجوة ربط/هيكل','هيدرات مكررة في '+cfg.title,dup.length,headers.length,'وجود هيدرات مكررة قد يسبب قراءة عمود غير مقصود.');
      }
    }catch(e){
      newsGap_(out,'schema:'+pageKey+':sourceError','فجوة ربط/هيكل','مصدر '+cfg.title+' غير قابل للقراءة',1,1,String(e.message||e).slice(0,220));
    }
  }
  cachePut(cacheKey,out,900);
  return out;
}
async function newsDeepAuditObservations_(){
  const out=[];
  out.push(...await newsSchemaObservations_());
  const safe=async key=>{
    const cfg=APP.PAGES[key];if(!cfg)return [];
    try{return await readConfiguredSheet_(cfg,key)}catch(e){return []}
  };
  const [projects,connections,permits,assets,emergency,closures,tasks,attachments]=await Promise.all([
    safe('projects'),safe('connections'),safe('permits'),safe('assets'),safe('emergency'),safe('closures'),safe('tasks'),safe('attachments')
  ]);
  const detail=[...projects,...connections];

  // رصد تغييرات الصفوف مباشرة: أي تعديل في أي حقل مرتبط يتحول إلى خبر مستقل.
  newsTrackConfiguredRows_('projects',projects,'workOrder');
  newsTrackConfiguredRows_('connections',connections,'workOrder');
  newsTrackConfiguredRows_('permits',permits,'workOrder');
  newsTrackConfiguredRows_('assets',assets,'workOrder');
  newsTrackConfiguredRows_('emergency',emergency,'noticeNo');
  newsTrackConfiguredRows_('closures',closures,'workOrder');
  newsTrackConfiguredRows_('attachments',attachments,'workOrder');

  // اكتمال الربط بين أوامر المشاريع/التوصيلات وورقة التصاريح.
  const detailSet=newsSetFrom_(detail),permitSet=newsSetFrom_(permits);
  const missingPermit=newsSetDiff_(detailSet,permitSet),extraPermit=newsSetDiff_(permitSet,detailSet);
  newsGap_(out,'rel:detailMissingPermit','فجوة ترابط','أوامر موجودة بالمشاريع/التوصيلات وغير موجودة بالتصاريح',missingPermit.length,detailSet.size,missingPermit.length?'أمثلة: '+missingPermit.slice(0,6).join('، '):'');
  newsGap_(out,'rel:permitMissingDetail','فجوة ترابط','أوامر موجودة بالتصاريح وغير موجودة بالمشاريع/التوصيلات',extraPermit.length,permitSet.size,extraPermit.length?'أمثلة: '+extraPermit.slice(0,6).join('، '):'');

  // نفس رقم أمر العمل داخل أكثر من مسار رئيسي.
  const projectSet=newsSetFrom_(projects),connectionSet=newsSetFrom_(connections);
  const overlap=[...projectSet].filter(x=>connectionSet.has(x));
  newsGap_(out,'rel:projectConnectionOverlap','فجوة تصنيف','أوامر مصنفة كمشاريع وتوصيلات في الوقت نفسه',overlap.length,detailSet.size,overlap.length?'أمثلة: '+overlap.slice(0,6).join('، '):'');

  // التكرار لا يعد خطأ بذاته؛ نبلغ فقط عندما يحمل المعرّف المكرر بيانات متعارضة.
  const conflicts=[
    ['connections',connections,'workOrder',['contractor','executionStatus','stage'],'أوامر توصيلات مكررة ببيانات/حالات متعارضة'],
    ['permits',permits,'workOrder',['contractor','permitStatus','evaluation'],'أوامر تصاريح مكررة بحالات متعارضة'],
    ['emergency',emergency,'noticeNo',['status','contractor','archive'],'إشعارات مكررة تحمل حالات متعارضة'],
    ['closures',closures,'workOrder',['contractor','docsReceived','docsReview'],'أوامر إغلاق مكررة بمواقف مستندات متعارضة']
  ];
  for(const [k,rows,idField,fields,label] of conflicts){
    const x=newsConflictGroups_(rows,idField,fields);
    newsGap_(out,'conflict:'+k,'تعارض بيانات',label,x.count,rows.length,x.count?'أمثلة: '+x.examples.join('، '):'');
  }

  // تسلسل دورة العمل: قواعد قوية لا تعتمد على تفسير احتمالي.
  const executedWrongStage=detail.filter(r=>newsExact_(r.executionStatus,'تم التنفيذ')&&!newsExact_(r.stage,'مرحلة الإغلاق'));
  newsGap_(out,'logic:executedWrongStage','تعارض منطقي','أوامر حالتها «تم التنفيذ» لكنها ليست بمرحلة الإغلاق',executedWrongStage.length,detail.length,executedWrongStage.length?'أمثلة: '+newsExamples_(executedWrongStage,'workOrder',()=>true).join('، '):'');

  const issuedMissingDates=permits.filter(r=>newsExact_(r.permitStatus,'تم اصدار التصريح')&&(newsBlank_(r,'permitStart')||newsBlank_(r,'permitEnd')));
  newsGap_(out,'logic:issuedPermitMissingDates','تعارض منطقي','تصاريح صادرة بدون تواريخ بداية/نهاية مكتملة',issuedMissingDates.length,permits.length,issuedMissingDates.length?'أمثلة: '+newsExamples_(issuedMissingDates,'workOrder',()=>true).join('، '):'');

  const enteredBeforeStatus=permits.filter(r=>newsExact_(r.permitStatus,'لم يتم ادخال التصريح')&&(clean_(r.permitStart)||clean_(r.permitEnd)));
  newsGap_(out,'logic:notEnteredWithDates','تعارض منطقي','تصاريح حالتها «لم يتم الإدخال» وبها تواريخ تصريح',enteredBeforeStatus.length,permits.length,enteredBeforeStatus.length?'أمثلة: '+newsExamples_(enteredBeforeStatus,'workOrder',()=>true).join('، '):'');

  const badPermitDates=permits.filter(r=>{const a=newsDateValue_(r.permitStart),b=newsDateValue_(r.permitEnd);return a&&b&&b<a});
  newsGap_(out,'logic:permitDateOrder','تعارض زمني','تاريخ نهاية التصريح أسبق من تاريخ البداية',badPermitDates.length,permits.length,badPermitDates.length?'أمثلة: '+newsExamples_(badPermitDates,'workOrder',()=>true).join('، '):'');

  const plantedNoReview=assets.filter(r=>newsExact_(r.plantingStatus,'تمت الزراعة')&&!newsExact_(r.plantingReview,'تمت المراجعة'));
  newsGap_(out,'logic:assetPlantedNoReview','تعارض منطقي','أصول حالتها «تمت الزراعة» دون اكتمال المراجعة',plantedNoReview.length,assets.length,plantedNoReview.length?'أمثلة: '+newsExamples_(plantedNoReview,'workOrder',()=>true).join('، '):'');

  const systemBeforeField=assets.filter(r=>newsDone_(r.systemReceipt)&&!newsDone_(r.fieldReceipt));
  newsGap_(out,'logic:assetSystemBeforeField','تعارض تسلسل','استلام أصول على النظام قبل الاستلام الميداني',systemBeforeField.length,assets.length,systemBeforeField.length?'أمثلة: '+newsExamples_(systemBeforeField,'workOrder',()=>true).join('، '):'');

  const approvedEmergencyNotDone=emergency.filter(r=>newsExact_(r.archive,'تم الاعتماد من PDC')&&!newsExact_(r.status,'منجز'));
  newsGap_(out,'logic:emergencyApprovedNotDone','تعارض منطقي','إشعارات معتمدة من PDC وحالة التنفيذ ليست «منجز»',approvedEmergencyNotDone.length,emergency.length,approvedEmergencyNotDone.length?'أمثلة: '+newsExamples_(approvedEmergencyNotDone,'noticeNo',()=>true).join('، '):'');

  const closureRules=[
    ['reviewBeforeReceive','مراجعة مستندات تمت قبل تسجيل استلامها من المقاول',r=>newsDone_(r.docsReview)&&!newsDone_(r.docsReceived)],
    ['stampBeforeReview','تختيم مستندات تم قبل اكتمال المراجعة',r=>newsDone_(r.stamp)&&!newsDone_(r.docsReview)],
    ['emailBeforeStamp','معاملة مرسلة بالإيميل قبل التختيم',r=>newsDone_(r.email)&&!newsDone_(r.stamp)],
    ['systemBeforeEmail','معاملة مرفوعة على النظام قبل تسجيل إرسالها بالإيميل',r=>newsDone_(r.systemUpload)&&!newsDone_(r.email)],
    ['certificateBeforeSystem','شهادة إنجاز معتمدة قبل تسجيل رفع المعاملة على النظام',r=>newsDone_(r.certificate)&&!newsDone_(r.systemUpload)]
  ];
  for(const [k,label,pred] of closureRules){
    const bad=closures.filter(pred);
    newsGap_(out,'logic:closure:'+k,'مراجعة تسلسل',label,bad.length,closures.length,bad.length?'هذه إشارة مراجعة للتأكد من اكتمال توثيق الخطوات السابقة. أمثلة: '+newsExamples_(bad,'workOrder',()=>true).join('، '):'');
  }

  // المهام: كل مهمة سابقة يجب أن يكون لها إفادة مستقلة.
  const today=DateTime.now().setZone(APP.TZ||'Asia/Riyadh').startOf('day');
  const pastNoStatement=tasks.filter(r=>{const d=newsDateValue_(r.date);return d&&d<today&&newsBlank_(r,'statement')});
  newsGap_(out,'tasks:pastNoStatement','متابعة المواقع','مهام أيام سابقة بدون إفادة موقع',pastNoStatement.length,tasks.length,pastNoStatement.length?'أمثلة صفوف: '+pastNoStatement.slice(0,6).map(r=>r._row).join('، '):'');

  const pastNoAttachments=tasks.filter(r=>{const d=newsDateValue_(r.date);return d&&d<today&&contains_(r.attachments,'لم يتم رفع')});
  newsGap_(out,'tasks:pastNoAttachments','متابعة المواقع','مهام أيام سابقة ما زالت بدون مرفقات',pastNoAttachments.length,tasks.length,pastNoAttachments.length?'أمثلة صفوف: '+pastNoAttachments.slice(0,6).map(r=>r._row).join('، '):'');

  for(const [k,label] of [['workOrder','مهام بدون رقم أمر عمل'],['engineer','مهام بدون مسؤول موقع'],['date','مهام بدون تاريخ'],['task','مهام بدون وصف مهمة']]){
    const bad=tasks.filter(r=>newsBlank_(r,k));
    newsGap_(out,'tasks:missing:'+k,'جودة بيانات • متابعة المواقع',label,bad.length,tasks.length,bad.length?'أمثلة صفوف: '+bad.slice(0,6).map(r=>r._row).join('، '):'');
  }

  if(attachments.length){
    const partial=attachments.filter(r=>contains_(r.status,'رفع جزئي'));
    const failed=attachments.filter(r=>contains_(r.status,'فشل'));
    const uploadedNoFiles=attachments.filter(r=>contains_(r.status,'تم رفع')&&num_(r.files)<=0);
    newsGap_(out,'attachments:partial','المرفقات','سجلات رفع جزئي للمرفقات',partial.length,attachments.length,partial.length?'أمثلة: '+newsExamples_(partial,'workOrder',()=>true).join('، '):'');
    newsGap_(out,'attachments:failed','المرفقات','سجلات فشل رفع المرفقات',failed.length,attachments.length,failed.length?'أمثلة: '+newsExamples_(failed,'workOrder',()=>true).join('، '):'');
    newsGap_(out,'attachments:uploadedNoFiles','تعارض منطقي','حالة «تم رفع مرفقات» بدون عدد ملفات موجب',uploadedNoFiles.length,attachments.length,uploadedNoFiles.length?'أمثلة: '+newsExamples_(uploadedNoFiles,'workOrder',()=>true).join('، '):'');
  }

  // الوصول إلى حد القراءة يعني احتمال وجود بيانات خارج نطاق الداشبورد.
  for(const [k,label,rows] of [['projects','المشاريع',projects],['connections','التوصيلات',connections],['permits','التصاريح',permits],['emergency','الطوارئ',emergency],['closures','الإغلاقات',closures],['tasks','المهام',tasks],['attachments','المرفقات',attachments]]){
    newsGap_(out,'limit:'+k,'فجوة تغطية','مصدر '+label+' وصل إلى حد القراءة '+APP.MAX_ROWS,rows.length>=APP.MAX_ROWS?1:0,1,rows.length>=APP.MAX_ROWS?'قد توجد سجلات إضافية لا تدخل في التحليل الحالي.':'');
  }
  return out;
}

async function buildLiveProjectNewsObservations_(){
  const obs=[];
  try{
    const dq=await getDataQualityPage_();
    const qObs=newsQualityObservations_(dq.quality||{});
    obs.push(...qObs);
    const qIssues=qObs.reduce((sum,x)=>sum+Number(x.value||0),0);
    const qChecks=qObs.reduce((sum,x)=>sum+Number(x.total||0),0);
    const qualityScore=qChecks?Math.max(0,Math.round((1-qIssues/qChecks)*1000)/10):100;
    obs.push({key:'progress:dataQualityScore',kind:'progress',category:'جودة البيانات',label:'مؤشر جودة البيانات',value:qualityScore,total:100,unit:'%',goodUp:true,initialNews:true,note:'محسوب من قواعد اكتمال وجودة الحقول التي يراقبها الداشبورد.'});
  }catch(e){console.warn('Project news data-quality analysis skipped:',e.message||e)}
  try{
    obs.push(...await newsDeepAuditObservations_());
  }catch(e){console.warn('Project news deep-audit analysis skipped:',e.message||e)}
  try{
    const m=await getWednesdayMeetingData(),rows=m.rows||[],total=rows.length;
    obs.push({key:'ops:delayedExecution',kind:'issue',category:'التنفيذ',label:'أوامر عمل متأخرة بالتنفيذ',value:num_(m.abKpis&&m.abKpis.delayedExecution)||rows.filter(r=>r.delayedExecution).length,total});
    obs.push({key:'ops:delayedClosure',kind:'issue',category:'الإغلاقات',label:'أوامر منفذة متأخرة في الإغلاق',value:rows.filter(r=>r.delayedClosure).length,total});
    obs.push({key:'ops:docsNotReceived',kind:'issue',category:'مستندات المقاول',label:'أوامر لم تُستلم مستنداتها من المقاول',value:rows.filter(r=>{const s=clean_(r.docsStatus);return /لم.*(استلام|تسل)/.test(s)}).length,total});
    obs.push({key:'progress:workordersTotal',kind:'progress',category:'أوامر العمل',label:'إجمالي أوامر العمل',value:total,total});
    obs.push({key:'progress:workordersCompleted',kind:'progress',category:'التنفيذ',label:'أوامر العمل المنفذة',value:rows.filter(r=>r.completed).length,total,goodUp:true,initialNews:true});
    const contractorProgress=new Map();
    for(const r of rows){
      const contractor=clean_(r.contractor);if(!contractor)continue;
      const x=contractorProgress.get(contractor)||{total:0,completed:0};
      x.total++;if(r.completed)x.completed++;contractorProgress.set(contractor,x);
    }
    for(const [contractor,x] of contractorProgress){
      obs.push({key:'contractor:completed:'+norm_(contractor),kind:'progress',category:'المقاولون',label:'أوامر المقاول المنفذة',value:x.completed,total:x.total,goodUp:true,silent:true,contractor});
    }
  }catch(e){console.warn('Project news work-order analysis skipped:',e.message||e)}
  try{
    const er=await readConfiguredSheet_(APP.PAGES.emergency,'emergency'),total=er.length;
    obs.push({key:'ops:emergencyIncomplete',kind:'issue',category:'الطوارئ',label:'إشعارات طوارئ غير منجزة',value:er.filter(r=>!newsExact_(r.status,'منجز')).length,total});
    obs.push({key:'progress:emergencyCompleted',kind:'progress',category:'الطوارئ',label:'إشعارات الطوارئ المنجزة',value:er.filter(r=>newsExact_(r.status,'منجز')).length,total,goodUp:true,initialNews:true});
  }catch(e){console.warn('Project news emergency analysis skipped:',e.message||e)}
  try{
    if(APP.PAGES.attachments){
      const ar=await readConfiguredSheet_(APP.PAGES.attachments,'attachments'),total=ar.length;
      obs.push({key:'ops:attachmentsPending',kind:'issue',category:'المرفقات',label:'سجلات مرفقات غير مكتملة الرفع',value:ar.filter(r=>!contains_(r.status,'تم رفع')).length,total});
      obs.push({key:'progress:attachmentsUploaded',kind:'progress',category:'المرفقات',label:'سجلات المرفقات المرفوعة',value:ar.filter(r=>contains_(r.status,'تم رفع')).length,total,goodUp:true,initialNews:true});
    }
  }catch(e){console.warn('Project news attachment analysis skipped:',e.message||e)}
  return obs;
}

async function getProjectNews(){
  const key='PDC_PROJECT_NEWS_LIVE_V3';
  const hit=cacheGet(key);if(hit)return hit;
  const observations=await buildLiveProjectNewsObservations_();
  newsSmartAggregate_(observations);
  observations.forEach(newsObserve_);
  const activeIssueKeys=new Set(observations.filter(o=>o.kind==='issue'&&Number(o.value||0)>0).map(o=>o.key));
  const cutoff=Date.now()-PROJECT_NEWS_RETENTION_MS;
  for(const [eventKey,event] of projectNewsState.events){
    const ts=Date.parse(event.date)||0;
    if(ts<cutoff&&!activeIssueKeys.has(eventKey))projectNewsState.events.delete(eventKey);
  }
  const order={عاجل:0,مهم:1,إنجاز:2,تحسن:2,تحديث:3};
  const rows=[...projectNewsState.events.values()]
    .filter(r=>activeIssueKeys.has(r.eventKey)||(Date.parse(r.date)||0)>=cutoff)
    .sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)||(order[a.priority]??9)-(order[b.priority]??9)||(activeIssueKeys.has(b.eventKey)?1:0)-(activeIssueKeys.has(a.eventKey)?1:0))
    .slice(0,180);
  const result={updatedAt:now_(),source:'live-sheet-analysis',retentionHours:72,rows};
  cachePut(key,result,20);
  return result;
}


const METHODS={getBootData,getSecondaryMasterKpis,getWorkOrderMasterEnrichment,getPageData,getWednesdayMeetingData,getMonitorData,getFullMonitorData,getProjectNews,saveSmartHistory,getWorkOrder360,clearDashboardCache};

const app=express();
const PUBLIC_DIR=path.join(__dirname,'public');
const INDEX_FILE=path.join(PUBLIC_DIR,'index.html');


app.set('trust proxy',1);

app.use(express.json({limit:'1mb'}));

app.use(session({

  name:'pdc.sid',

  secret:SESSION_SECRET,

  resave:false,

  saveUninitialized:false,

  rolling:true,

  cookie:{

    httpOnly:true,

    secure:process.env.NODE_ENV==='production',

    sameSite:'lax',

    maxAge:8 * 60 * 60 * 1000

  }

}));


// الصفحة الرئيسية صراحةً

/* ==========================================
   Authentication API
   ========================================== */

app.get('/api/auth/me',(req,res)=>{

  res.set('Cache-Control','no-store');

  if(!req.session || !req.session.user){

    return res.status(401).json({
      ok:false,
      authenticated:false
    });

  }

  res.json({
    ok:true,
    authenticated:true,
    user:req.session.user
  });

});


app.post('/api/auth/login',async(req,res)=>{

  try{

    res.set('Cache-Control','no-store');

    const email=String(
      req.body?.email || ''
    )
    .trim()
    .toLowerCase();

    const password=String(
      req.body?.password || ''
    );

    if(!isValidEmail_(email) || !password){

      return res.status(400).json({
        ok:false,
        error:'INVALID_INPUT'
      });

    }


    const key=loginKey_(req,email);

    const state=loginState_(key);


    if(state.blockedUntil>Date.now()){

      return res.status(429).json({
        ok:false,
        error:'TOO_MANY_ATTEMPTS'
      });

    }


    const users=await readDashboardUsers_();

    const user=users.find(
      u=>u.email===email
    );


    /*
      Temporarily using plain-text passwords
      as requested.
    */

    const passwordOK =
      !!user &&
      user.password===password;

    const accountActive =
      !!user &&
      user.active==='active';


    if(!passwordOK || !accountActive){

      registerLoginFailure_(key);

      return res.status(401).json({
        ok:false,
        error:'INVALID_CREDENTIALS'
      });

    }


    clearLoginFailures_(key);


    req.session.regenerate(err=>{

      if(err){

        console.error(
          'Session regenerate error:',
          err
        );

        return res.status(500).json({
          ok:false,
          error:'SESSION_ERROR'
        });

      }


      req.session.user=
        publicUser_(user);


      req.session.save(saveErr=>{

        if(saveErr){

          console.error(
            'Session save error:',
            saveErr
          );

          return res.status(500).json({
            ok:false,
            error:'SESSION_ERROR'
          });

        }


        res.json({

          ok:true,

          user:req.session.user

        });

      });

    });


  }catch(e){

    console.error(
      'Login error:',
      e
    );

    res.status(500).json({
      ok:false,
      error:'LOGIN_ERROR'
    });

  }

});


app.post('/api/auth/logout',(req,res)=>{

  res.set('Cache-Control','no-store');

  if(!req.session){

    res.clearCookie('pdc.sid');

    return res.json({
      ok:true
    });

  }


  req.session.destroy(()=>{

    res.clearCookie('pdc.sid');

    res.json({
      ok:true
    });

  });

});

app.get('/',(req,res)=>{

  if(!req.session || !req.session.user){
    return res.redirect('/login');
  }

  res.set('Cache-Control','no-store');

  res.sendFile(INDEX_FILE);

});

app.get('/login',(req,res)=>{

  if(req.session && req.session.user){
    return res.redirect('/');
  }

  res.set('Cache-Control','no-store');

  res.sendFile(
    path.join(PUBLIC_DIR,'login.html')
  );

});

// الملفات الثابتة
app.get('/index.html',(req,res)=>{

  if(!req.session || !req.session.user){
    return res.redirect('/login');
  }

  res.set('Cache-Control','no-store');

  res.sendFile(INDEX_FILE);

});

app.use(express.static(PUBLIC_DIR,{
  index:false
}));

app.get('/api/health',(req,res)=>res.json({
  ok:true,
  title:APP.TITLE,
  spreadsheetConfigured:!!SPREADSHEET_ID,
  publicDirExists:fs.existsSync(PUBLIC_DIR),
  indexExists:fs.existsSync(INDEX_FILE)
}));

app.get('/api/hr/staff',requireAuth_,async(req,res)=>{
  try{
    const result=await getHrStaffData_();
    res.set('Cache-Control','no-store');
    res.json({ok:true,...result});
  }catch(e){
    console.error(e);
    res.status(500).json({ok:false,error:e.message||String(e)});
  }
});

app.get('/api/monitor/summary',requireAuth_,async(req,res)=>{
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

app.get('/api/monitor/full',requireAuth_,async(req,res)=>{
  try{
    const result=await getFullMonitorData();
    res.set('Cache-Control','no-store');
    res.json(result);
  }catch(e){
    console.error(e);
    res.status(500).json({ok:false,error:e.message||String(e)});
  }
});

app.get('/api/monitor',requireAuth_,async(req,res)=>{
  try{
    const result=await getMonitorData();
    res.set('Cache-Control','no-store');
    res.json(result);
  }catch(e){
    console.error(e);
    res.status(500).json({ok:false,error:e.message||String(e)});
  }
});

app.post('/api/rpc',requireAuth_,async(req,res)=>{
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

  if(!req.session || !req.session.user){
    return res.redirect('/login');
  }

  res.set('Cache-Control','no-store');

  res.sendFile(INDEX_FILE);

});

app.listen(PORT,'0.0.0.0',()=>{
  console.log(`PDC Makkah website: http://0.0.0.0:${PORT}`);
  console.log(`Public directory: ${PUBLIC_DIR}`);
  console.log(`index.html exists: ${fs.existsSync(INDEX_FILE)}`);
});
