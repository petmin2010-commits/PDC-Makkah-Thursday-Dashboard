'use strict';
/* Offline regression tests: node naif-expert.test.cjs
 * No real user data, credentials, Google Sheet reads or OpenAI calls. */
const assert=require('node:assert/strict');
const {APP}=require('./app-config');
const {createNaifExpert}=require('./naif-expert-engine');
const {createNaifHrExpert}=require('./naif-hr-expert');
async function main(){
 const rows={
  workorders:[
   {_row:2,workOrder:'242165400',status:'تم التنفيذ',contractor:'الأول',engineer:'سالم',value:'1000',delay:'تأخير شديد'},
   {_row:3,workOrder:'242165401',status:'لم يتم التنفيذ',contractor:'الثاني',engineer:'زيد',value:'2000',delay:'ضمن المدة'}
  ],
  projects:[
   {_row:2,workOrder:'242165400',progress:'60%',executionStatus:'لم يتم التنفيذ',contractor:'الأول',engineer:'سالم',delay:'تأخير شديد'},
   {_row:3,workOrder:'242165402',progress:'100%',executionStatus:'تم التنفيذ',contractor:'الأول',engineer:'زيد',delay:'ضمن المدة'}
  ],
  emergency:[{_row:2,noticeNo:'12222333',status:'منجز'}]
 };
 const ask=createNaifExpert({
  APP,readConfiguredSheet:async(_,key)=>rows[key]||[],
  getNaifAdviceQuality:async()=>({adviceIntelligence:{trackedOrders:10,counts:{weak:2,substantive:5,pending:3}}}),
  canPage:(user,key)=>user?.permissions?.includes('*')||user?.permissions?.includes(key),
  now:()=>new Date('2026-11-11T08:00:00Z')
 });
 async function query(question,permissions,project='مكة',currentPage='master'){
  return ask({question,user:{permissions},project,currentPage});
 }
 let r=await query('ما هي الشيتات المتاحة؟',['workorders','projects']);
 assert.match(r.answer,/المشاريع/);
 assert.doesNotMatch(r.answer,/الكادر/);
 r=await query('كم نسبة إنجاز المشاريع؟',['projects']);
 assert.match(r.answer,/٨٠%/);
 r=await query('كم عدد أوامر العمل المنفذة؟',['workorders']);
 assert.match(r.answer,/تم التنفيذ: ١/);
 r=await query('حالة أمر العمل 242165400',['workorders']);
 assert.match(r.answer,/242165400/);
 r=await query('توزيع المشاريع حسب المهندسين',['projects']);
 assert.match(r.answer,/سالم/);
 r=await query('من أكثر المقاولين تأخيرًا في المشاريع؟',['projects']);
 assert.match(r.answer,/الأول: ١/);
 r=await query('ملخص شامل للمشروع',['workorders','projects','emergency']);
 assert.match(r.answer,/الطوارئ/);
 r=await query('نسبة إنجاز المشاريع في جدة',['projects']);
 assert.match(r.answer,/لا أملك حق دمج/);
 r=await query('نسبة إنجاز المشاريع',['workorders']);
 assert.match(r.answer,/غير متاح ضمن صلاحيات/);
 r=await query('الإفادات الضعيفة في جودة البيانات',['dataQuality']);
 assert.match(r.answer,/ضعيفة ٢/);
 const askHr=createNaifHrExpert({getHrStaffData_:async()=>({updatedAt:'2026-11-11',rows:[
  {name:'أ',city:'مكة',role:'مهندس',trainingPct:90,trainingRequired:10,trainingCompleted:9,cardDays:20,cardStatus:'أوشكت',sponsorship:'ابعاد الرؤية'},
  {name:'ب',city:'جدة',role:'فني',trainingPct:30,trainingRequired:10,trainingCompleted:3,cardDays:-2,cardStatus:'انتهت',sponsorship:'اخرى'}
 ]})});
 const hr=q=>askHr({question:q,user:{permissions:['*']},project:'مكة',currentPage:'master'});
 r=await hr('ما نسبة التدريب بالكادر؟');
 assert.match(r.answer,/إجمالي العاملين المسجلين: ١/);
 assert.doesNotMatch(r.answer,/٢ موظف/);
 r=await askHr({question:'إحصائيات الكادر',user:{permissions:['projects']},project:'مكة',currentPage:'master'});
 assert.equal(r.connected,false);
 assert.match(r.answer,/صلاحية/);
 console.log('NAIF_EXPERT_REGRESSION_PASS');
}
main().catch(err=>{console.error(err);process.exitCode=1});