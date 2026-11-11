'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {APP}=require('./app-config');
const {createNaifStageExpert,isStageQuestion}=require('./naif-stage-expert');
const source=[
 {_row:2,stage:'الحفر',stageStatus:'جاري التنفيذ'},
 {_row:3,stage:'التمديد',stageStatus:'تم الانتهاء'},
 {_row:4,stage:'الحفر',stageStatus:'تم الانتهاء'},
 {_row:5,stage:'',stageStatus:''}
];
function engine(reads){
 return createNaifStageExpert({
  APP,
  readConfiguredSheet:async(_,key)=>{reads.push(key);return key==='projects'?source:key==='connections'?[{stage:'فحص',stageStatus:'جاري'}]:[]},
  canPage:(user,key)=>user.permissions.includes(key),
  now:()=>new Date('2026-11-11T08:42:00Z')
 });
}
test('accepts precisely the Arabic sentence in the screenshot',()=>{
 assert.equal(isStageQuestion('أحتاج البيانات من مرحلة التنفيذ وحالة المرحلة'),true);
 assert.equal(isStageQuestion('اشرح معنى مرحلة التنفيذ'),false);
});
test('gives stage and stage-status breakdown from real column mappings',async()=>{
 const reads=[],ask=engine(reads);
 const r=await ask({question:'أحتاج البيانات من مرحلة التنفيذ وحالة المرحلة',
  user:{permissions:['projects']},currentPage:'master',project:'مكة'});
 assert.deepEqual(reads,['projects']);
 assert.equal(r.connected,true);
 assert.match(r.answer,/الشيت «⚡المشاريع العام»/);
 assert.match(r.answer,/مرحلة التنفيذ \(توزيع القيم\)/);
 assert.match(r.answer,/حالة المرحلة \(توزيع القيم\)/);
 assert.match(r.answer,/الحفر: ٢/);
 assert.match(r.answer,/جاري التنفيذ: ١/);
 assert.match(r.answer,/الحفر ← جاري التنفيذ: ١/);
 assert.deepEqual(r.sources.map(x=>x.page),['المشاريع']);
});
test('keeps a specifically requested source, rather than defaulting to projects',async()=>{
 const reads=[],ask=engine(reads);
 const r=await ask({question:'ما حالة المرحلة في التوصيلات؟',
  user:{permissions:['connections','projects']},currentPage:'master',project:'جدة'});
 assert.deepEqual(reads,['connections']);
 assert.match(r.answer,/التوصيلات/);
 assert.doesNotMatch(r.answer,/«المشاريع»/);
});
test('rejects an explicitly requested source outside permissions',async()=>{
 const reads=[],ask=engine(reads);
 const r=await ask({question:'أعطني مرحلة التنفيذ في التوصيلات',
  user:{permissions:['projects']},currentPage:'master',project:'مكة'});
 assert.equal(r.connected,false);
 assert.match(r.answer,/غير مصرح/);
 assert.deepEqual(reads,[]);
});
test('returns honest zero-data notice instead of invented status counts',async()=>{
 const ask=engine([]);
 const r=await ask({question:'ما مرحلة التنفيذ في العمليات؟',
  user:{permissions:['operations']},currentPage:'master',project:'مكة'});
 assert.match(r.answer,/لا توجد سجلات مقروءة/);
 assert.doesNotMatch(r.answer,/الحفر: ٢/);
});
test('forced realtime tool: no answer may bypass authenticated lookup',()=>{
 const server=fs.readFileSync(require('node:path').join(__dirname,'naif-realtime-server.js'),'utf8');
 const voice=fs.readFileSync(require('node:path').join(__dirname,'public/naif-realtime.js'),'utf8');
 const persona=fs.readFileSync(require('node:path').join(__dirname,'public/naif-persona.js'),'utf8');
 assert.match(server,/tool_choice:\s*'required'/);
 assert.match(voice,/tool_choice:'none'/);
 assert.ok(!voice.includes("send({type:'response.create',response:{output_modalities:['audio']}})"));
 assert.match(persona,/if\(isNaifStageQuery\(q\)\|\|isNaifInvestigationQuery\(q\)\)return replyKnowledge\(q\)/);
});
