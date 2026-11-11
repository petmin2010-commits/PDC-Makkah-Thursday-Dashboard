'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {APP}=require('./app-config');
const {createNaifInvestigations,isInvestigation,correlate,id}=require('./naif-investigation');
function fixture(){
 const sources={
  workorders:[{_row:2,workOrder:'123456789',status:'لم يتم التنفيذ',delay:'تأخير شديد',contractor:'مقاول ألف',engineer:'مهندس باء'},{_row:3,workOrder:'222333444',status:'تم التنفيذ'}],
  projects:[{_row:5,workOrder:'123456789',stage:'الحفر',stageStatus:'متوقف',delay:'تأخير شديد'}],
  permits:[{_row:8,workOrder:'123456789',permitStatus:'لم يصدر'}],
  closures:[{_row:9,workOrder:'123456789',docsReceived:'لم يستلم'}],
  tasks:[{_row:4,workOrder:'123456789',resolved:'معلق'}],
  connections:[],operations:[],attachments:[],assets:[],safety:[],executionViolations:[],minutes:[]
 };
 const reads=[];
 const ask=createNaifInvestigations({APP,readConfiguredSheet:async(_,k)=>{reads.push(k);return sources[k]||[]},canPage:(u,k)=>u.permissions.includes(k),now:()=>new Date('2026-11-11T10:00:00Z')});
 return {ask,reads};
}
test('natural Arabic why/relationship questions route to investigation',()=>{
 assert.equal(isInvestigation('لماذا تأخرت المشاريع وما العلاقة بين التصاريح والتأخير؟'),true);
 assert.equal(isInvestigation('ما هي نسبة إنجاز المشاريع؟'),false);
});
test('only exact canonical work order identifiers are joined',()=>{
 assert.equal(id('123456789'),'123456789');
 assert.equal(id('١٢٣٤٥٦٧٨٩'),'123456789');
 assert.equal(id('123456'), '123456');
 assert.equal(id('123'),null);
 const {joined,unmatched}=correlate([{key:'workorders',sheet:'أوامر',rows:[{_row:2,workOrder:'123456789',contractor:'شركة واحدة'},{_row:3,workOrder:'222333444',contractor:'شركة واحدة'},{_row:4,contractor:'شركة واحدة'}]}]);
 assert.equal(joined.size,2);
 assert.equal(unmatched.length,1);
});
test('joins stage, permits, closures and site reports with evidence locations',async()=>{
 const {ask,reads}=fixture();
 const r=await ask({question:'لماذا تأخر أمر العمل 123456789؟',user:{permissions:['workorders','projects','permits','closures','tasks']},project:'مكة'});
 assert.equal(r.connected,true);
 assert.equal(r.metrics.crossSource,1);
 assert.match(r.answer,/تصريح غير مكتمل/);
 assert.match(r.answer,/تعثر استلام المستندات/);
 assert.match(r.answer,/صف 8/);
 assert.match(r.answer,/الحفر/);
 assert.match(r.answer,/لا يكفي لإثبات المسؤولية/);
 assert.ok(reads.every(k=>['workorders','projects','permits','closures','tasks'].includes(k)));
});
test('explicitly unauthorized sources are refused without reading',async()=>{
 const {ask,reads}=fixture();
 const r=await ask({question:'حلل أسباب تأخر التصاريح',user:{permissions:['workorders']},project:'مكة'});
 assert.equal(r.connected,false);
 assert.match(r.answer,/غير مصرح/);
 assert.deepEqual(reads,[]);
});
test('no fabricated reasons if order not in authorized data',async()=>{
 const {ask}=fixture();
 const r=await ask({question:'حلل أسباب أمر العمل 999888777',user:{permissions:['workorders','projects']},project:'جدة'});
 assert.match(r.answer,/لم أعثر/);
 assert.equal(r.connected,true);
});
test('result names exact city and cites the city-local source',async()=>{
 const {ask}=fixture();
 const r=await ask({question:'لماذا تأخر أمر العمل 123456789؟',user:{permissions:['projects','workorders']},project:'جدة'});
 assert.match(r.answer,/كهرباء جدة/);
 assert.match(r.answer,/⚡المشاريع العام|أوامر العمل/);
 assert.doesNotMatch(r.answer,/كهرباء مكة/);
});
test('voice and typed chat route investigative questions via authenticated server',()=>{
 const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
 const persona=fs.readFileSync(path.join(__dirname,'public/naif-persona.js'),'utf8');
 assert.match(server,/askNaifInvestigation_/);
 assert.match(server,/const investigation=isInvestigation\(question\)/);
 assert.match(persona,/if\(isNaifStageQuery\(q\)\|\|isNaifInvestigationQuery\(q\)\)return replyKnowledge\(q\)/);
 assert.match(persona,/if\(isNaifStageQuery\(query\)\|\|isNaifInvestigationQuery\(query\)\)/);
});
