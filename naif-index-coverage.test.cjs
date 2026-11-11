'use strict';
/* Self-auditing dashboard index (Node 18+):
   node --test naif-index-coverage.test.cjs
   Does not connect to Google, OpenAI, Render, pCloud, or use secrets. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalogue=require('./public/naif-dashboard-catalog');
const index=require('./naif-dashboard-index');
const {APP}=require('./app-config');
const html=fs.readFileSync(path.join(__dirname,'public/index.html'),'utf8');
const navPart=html.split('id="nav">')[1]?.split('</nav>')[0]||'';
const keys=[...navPart.matchAll(/data-page="([^"]+)"/g)].map(x=>x[1]);
const indexAsk=index.createNaifDashboardIndex({APP});
test('navigation tab list is exactly mapped, no omissions or extra entries',()=>{
 const report=catalogue.audit(keys);
 assert.equal(report.complete,true,JSON.stringify(report));
 assert.equal(report.percent,100);
 assert.equal(keys.length,28);
});
test('every tab includes documentation, section index, actual module file and source',()=>{
 for(const page of catalogue.entries){
  assert.ok(page.label&&page.about&&page.sections.length&&page.prompts.length&&page.sources.length,page.key);
  for(const file of page.module.split(',')){
   assert.ok(fs.existsSync(path.join(__dirname,'public',file.trim())),page.key+': missing '+file);
  }
  if(page.kind==='sheet'){
   assert.ok(APP.PAGES[page.key]?.sheet,page.key+': source not registered');
   assert.ok(page.sources.some(s=>s.trim()===APP.PAGES[page.key].sheet.trim()),page.key+': sheet mismatch');
   assert.ok(APP.PAGES[page.key].fields?.length,page.key+': field map missing');
  }
 }
});
test('four additional data sources are indexed',()=>{
 for(const e of catalogue.extra){
  assert.ok(APP.PAGES[e.key]?.sheet,e.key);
  assert.equal(e.source.trim(),APP.PAGES[e.key].sheet.trim(),e.key);
 }
});
test('all 28 page names return an authorized source-specific description',()=>{
 for(const e of catalogue.entries){
  const r=indexAsk({question:'اشرح '+e.label,user:{permissions:['*']},project:'مكة'});
  assert.ok(r?.answer?.includes('تبويب «'+e.label+'»'),e.key);
  assert.ok(r.answer.includes(e.sources[0]),e.key+': wrong source');
 }
});
test('precise tab permissions cannot be bypassed by legacy aliases',()=>{
 assert.equal(index.canTab({permissions:['المشاريع']},'projects'),true);
 assert.equal(index.canTab({permissions:['المشاريع']},'hrStaff'),false);
 assert.equal(index.canTab({permissions:['مركز التقارير'],precisePermissions:true},'reportArchive'),false);
 assert.equal(index.canTab({permissions:['مركز التقارير'],precisePermissions:false},'reportArchive'),true);
 assert.equal(index.canTab({permissions:['*']},'engineeringInspection'),true);
});
test('all clients and correct backend expert modules are wired',()=>{
 const scripts=['naif-dashboard-catalog.js','naif-specialized-index.js','naif-expert-ui.js','naif-persona.js','naif-realtime.js'];
 const pos=scripts.map(s=>html.indexOf('/'+s));
 assert.ok(pos.every(p=>p>=0),JSON.stringify(pos));
 assert.ok(pos.slice(1).every((p,i)=>p>pos[i]),'script order');
 const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
 for(const symbol of ['createNaifDashboardIndex','createNaifExpert','createNaifHrExpert','createNaifBriefings',"method==='askNaifExpert'"]){
  assert.ok(server.includes(symbol),'missing '+symbol);
 }
});
test('specialized knowledge does not mutate any project records',()=>{
 const s=fs.readFileSync(path.join(__dirname,'public/naif-specialized-index.js'),'utf8');
 assert.ok(s.includes("method:'GET'"));
 assert.ok(!/method\s*:\s*['"](?:POST|PUT|DELETE|PATCH)/i.test(s));
 const topics=['employeeEvaluation','electricityEngineerEvaluation','contractorSafety','pdcMeeting2','qualityCorrective','safetyCorrective','temporaryGenerators','engineeringInspection','excelExport'];
 for(const topic of topics)assert.ok(s.includes("key:'"+topic+"'"),topic);
});
test('catalogue source and project access remain read-only',()=>{
 const s=fs.readFileSync(path.join(__dirname,'naif-dashboard-index.js'),'utf8');
 assert.ok(s.includes('canTab'));
 assert.ok(s.includes('لا تُعرض أرقام أو ملفات من مصدر غير مصرح'));
});
