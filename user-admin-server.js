'use strict';
const crypto=require('crypto');
const USERS_SHEET='dp users';
const ACL_VERSION='v2';
const ADMIN_ROLES=new Set(['مدير','مدير المشروع','مدير الفرع','المدير العام','مدير عام','مدير النظام','مدير الإدارة','مدير الادارة','مدير الاداره','admin','administrator']);
const groups=[
 {title:'المتابعة التشغيلية',tabs:['الرئيسية','المشاريع','التوصيلات','التصاريح','الأصول','الإغلاقات','الطوارئ','متابعة أعمال المواقع']},
 {title:'التحليل الذكي والتقارير',tabs:['مركز التحليل الذكي','ذاكرة المشروع الزمنية','غرفة التحقيق الذكية','محرك القرار المفسر','Work Order 360°','تقرير الخميس الذكي','Projects Report Engine']},
 {title:'تقارير مركزية',tabs:['مركز التقارير العام','مركز تقارير الاكسيل','سجل التقارير الصادرة']},
 {title:'السلامة ومخالفاتها وتقاريرها',tabs:['مخالفات السلامة','تقرير السلامة والإجراءات التصحيحية','تقييم السلامة للمقاولين']},
 {title:'الجودة ومخالفاتها وتقاريرها',tabs:['تقرير الجودة والإجراءات التصحيحية','مخالفات التنفيذ','محاضر مخالفة اثبات الحالة']},
 {title:'المتابعة الإدارية',tabs:['جودة البيانات','الموارد البشرية للكادر','تقييم مهندسي المواقع','تقييم مهندسي شركة الكهرباء','اجتماع الـ PDC','اجتماع PDC 2','الروابط المهمة']}
];
const allowedTabs=new Set(groups.flatMap(g=>g.tabs));
const emailOf=x=>String(x||'').trim().toLowerCase();
const str=x=>String(x==null?'':x).trim();
const normalize=x=>str(x).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
const qSheet=s=>"'"+s.replace(/'/g,"''")+"'";
const checkEmail=x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
function isAdmin(user){
 if(!user||emailOf(user.email)===''||str(user.active).toLowerCase()!=='active')return false;
 const whitelist=str(process.env.DASHBOARD_USER_ADMIN_EMAILS).split(/[,;\s]+/).map(emailOf).filter(Boolean);
 if(whitelist.length)return whitelist.includes(emailOf(user.email));
 return ADMIN_ROLES.has(normalize(user.role));
}
function hashPassword(value){
 const salt=crypto.randomBytes(18).toString('hex');
 const derived=crypto.scryptSync(value,salt,32).toString('hex');
 return 'scrypt$'+salt+'$'+derived;
}
function verifyPassword(input,stored){
 if(typeof input!=='string'||input.length>4096||!stored)return false;
 if(stored.startsWith('scrypt$')){
  const parts=stored.split('$');if(parts.length!==3||!/^([0-9a-f]{36})$/.test(parts[1])||!/^([0-9a-f]{64})$/.test(parts[2]))return false;
  const x=crypto.scryptSync(input,parts[1],32),y=Buffer.from(parts[2],'hex');return crypto.timingSafeEqual(x,y);
 }
 const a=Buffer.from(input,'utf8'),b=Buffer.from(stored,'utf8');
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function install(app,{getSheets,spreadsheetId,requireAuth}){
 const versions=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 let lock=Promise.resolve();
 const enqueue=fn=>{const current=lock.then(fn);lock=current.catch(()=>{});return current};
 async function readRows(){
  const sheets=await getSheets();
  let data;
  try{data=await sheets.spreadsheets.values.get({spreadsheetId,range:qSheet(USERS_SHEET)+'!A:H',valueRenderOption:'FORMULA'})}
  catch(error){
   if(Number(error?.code||error?.response?.status)!==400||!/range|grid|column/i.test(String(error.message)))throw error;
   data=await sheets.spreadsheets.values.get({spreadsheetId,range:qSheet(USERS_SHEET)+'!A:G',valueRenderOption:'FORMULA'});
  }
  return {sheets,rows:data.data.values||[]};
 }
 function parseUser(row,index){
  const perms=str(row[6]).split(/\s*[,،;|\n]+\s*/).map(str).filter(Boolean);
  const full=perms.some(x=>['*','all','الكل','جميع الصفحات','كامل الصلاحيات'].includes(normalize(x)));
  const granular=str(row[7])===ACL_VERSION;
  const expanded=new Set(perms.filter(x=>allowedTabs.has(x)));
  if(!granular){
   const contains=x=>perms.some(p=>normalize(p)===normalize(x));
   if(contains('المشاريع'))expanded.add('Projects Report Engine');
   if(contains('مخالفات السلامة'))expanded.add('تقرير السلامة والإجراءات التصحيحية');
   if(contains('السلامة والجودة'))expanded.add('تقرير الجودة والإجراءات التصحيحية');
   if(contains('مركز التقارير')){expanded.add('مركز التقارير العام');expanded.add('سجل التقارير الصادرة')}
   if(contains('تقارير الاكسيل')||contains('تقارير Excel'))expanded.add('مركز تقارير الاكسيل');
   if(contains('غرفة التدقيق الذكية'))expanded.add('غرفة التحقيق الذكية');
   if(contains('تقييم المقاولين بالسلامة')||contains('تقيم السلامة للمقاولين'))expanded.add('تقييم السلامة للمقاولين');
  }
  return {row:index+1,name:str(row[0]),role:str(row[1]),email:emailOf(row[2]),active:str(row[4]).toLowerCase()==='active',
   photo:str(row[5]),permissions:full?Array.from(allowedTabs):[...expanded],legacy:!granular,version:versions(row),all:full};
 }
 function sameUser(req,rows){
  const email=emailOf(req.session?.user?.email);
  return rows.slice(1).map((r,i)=>({r,row:i+2})).find(x=>emailOf(x.r[2])===email);
 }
 const guard=async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  try{
   const {rows}=await readRows();
   const current=sameUser(req,rows);
   if(!current||!isAdmin({email:current.r[2],role:current.r[1],active:current.r[4]}))return res.status(403).json({ok:false,error:'ADMIN_REQUIRED'});
   req.currentAdmin=emailOf(current.r[2]);next();
  }catch(error){console.error('User admin verification failed',error.message);res.status(503).json({ok:false,error:'ADMIN_CHECK_FAILED'})}
 };
 const sameOrigin=(req,res,next)=>{
  if(!/^application\/json\b/i.test(req.headers['content-type']||''))return res.status(415).json({ok:false,error:'JSON_REQUIRED'});
  const origin=req.headers.origin;
  if(origin){try{const expected=new URL('https://'+req.get('host'));if(new URL(origin).host!==expected.host)return res.status(403).json({ok:false,error:'ORIGIN_DENIED'});}catch{return res.status(403).json({ok:false,error:'ORIGIN_DENIED'});}}
  return next();
 };
 app.get('/api/user-admin',requireAuth,guard,async(req,res)=>{
  try{
   const {rows}=await readRows();
   const users=rows.slice(1).map((r,i)=>parseUser(r,i+1)).filter(u=>u.email);
   res.json({ok:true,groups,users,city:process.env.DASHBOARD_CITY||'',admin:req.currentAdmin});
  }catch(e){console.error('User admin read',e.message);res.status(503).json({ok:false,error:'READ_FAILED'})}
 });
 app.post('/api/user-admin/save',requireAuth,guard,sameOrigin,async(req,res)=>{
  await enqueue(async()=>{
   try{
    const body=req.body||{},name=str(body.name),role=str(body.role),email=emailOf(body.email),password=str(body.password);
    const mode=body.mode==='create'?'create':'update',status=body.active===true?'active':'inactive';
    const supplied=Array.isArray(body.permissions)?body.permissions:[];
    const permissions=[...new Set(supplied.map(str).filter(x=>allowedTabs.has(x)))];
    if(!name||name.length>120||!role||role.length>120||!checkEmail(email)||email.length>254||supplied.length>80||permissions.length!==supplied.length)
      return res.status(400).json({ok:false,error:'INVALID_USER_DATA'});
    if(password&&(password.length<10||password.length>128))return res.status(400).json({ok:false,error:'PASSWORD_LENGTH'});
    if(mode==='create'&&!password)return res.status(400).json({ok:false,error:'PASSWORD_REQUIRED'});
    const {sheets,rows}=await readRows();
    const metadata=await sheets.spreadsheets.get({spreadsheetId,fields:'sheets(properties(sheetId,title,gridProperties(columnCount)))'});
    const userTab=(metadata.data.sheets||[]).find(x=>x.properties?.title===USERS_SHEET);
    if(!userTab) return res.status(503).json({ok:false,error:'USERS_SHEET_MISSING'});
    if(Number(userTab.properties?.gridProperties?.columnCount||0)<8){
     await sheets.spreadsheets.batchUpdate({spreadsheetId,requestBody:{requests:[{appendDimension:{sheetId:userTab.properties.sheetId,dimension:'COLUMNS',length:8-Number(userTab.properties.gridProperties.columnCount||0)}}]}});
    }
    const current=sameUser(req,rows);
    if(!current||!isAdmin({email:current.r[2],role:current.r[1],active:current.r[4]}))return res.status(403).json({ok:false,error:'ADMIN_REQUIRED'});
    const matches=rows.slice(1).map((r,i)=>({r,row:i+2})).filter(x=>emailOf(x.r[2])===email);
    if(matches.length>1)return res.status(409).json({ok:false,error:'DUPLICATE_SHEET_EMAIL'});
    const perms=permissions.join(', ');
    if(mode==='create'){
     if(matches.length)return res.status(409).json({ok:false,error:'EMAIL_EXISTS'});
     await sheets.spreadsheets.values.append({spreadsheetId,range:qSheet(USERS_SHEET)+'!A:H',valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',
       requestBody:{values:[[name,role,email,hashPassword(password),status,'',perms,ACL_VERSION]]}});
    }else{
     const target=matches[0];if(!target)return res.status(404).json({ok:false,error:'USER_NOT_FOUND'});
     if(!str(body.version)||body.version!==versions(target.r))return res.status(409).json({ok:false,error:'USER_CHANGED_RELOAD'});
     if(email===req.currentAdmin&&status==='inactive')return res.status(400).json({ok:false,error:'CANNOT_DISABLE_SELF'});
     if(email===req.currentAdmin&&!isAdmin({email,role,active:status}))return res.status(400).json({ok:false,error:'CANNOT_REVOKE_SELF'});
     const n=target.row;
     const data=[
      {range:qSheet(USERS_SHEET)+'!A'+n+':B'+n,values:[[name,role]]},
      {range:qSheet(USERS_SHEET)+'!E'+n,values:[[status]]},
      {range:qSheet(USERS_SHEET)+'!G'+n,values:[[perms]]},
      {range:qSheet(USERS_SHEET)+'!H'+n,values:[[ACL_VERSION]]}
     ];
     if(password)data.push({range:qSheet(USERS_SHEET)+'!D'+n,values:[[hashPassword(password)]]});
     await sheets.spreadsheets.values.batchUpdate({spreadsheetId,requestBody:{valueInputOption:'RAW',data}});
    }
    console.info('[dashboard-user-admin]',JSON.stringify({actor:req.currentAdmin,target:email,action:mode,status,permissions:permissions.length,at:new Date().toISOString()}));
    res.json({ok:true});
   }catch(e){console.error('User admin write error',e.message);res.status(503).json({ok:false,error:'WRITE_FAILED'})}
  });
 });
}
module.exports={install,isAdmin,hashPassword,verifyPassword,ACL_VERSION,groups};
