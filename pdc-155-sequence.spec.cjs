const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{},document:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/public/pdc-155-sequence.js','utf8'),context);
const api=context.window.PDC155Sequence;
const rows=[
 {workOrder:'1',consultant155Status:'نعم',contractor155Status:'لا',consultant155Date:''},
 {workOrder:'2',consultant155Status:'نعم',contractor155Status:'نعم',consultant155Date:'25/10/2026',contractor155Date:'26/10/2026'},
 {workOrder:'3',consultant155Status:'نعم',contractor155Status:'نعم',consultant155Date:'26/10/2026',contractor155Date:'25/10/2026'},
 {workOrder:'4',consultant155Status:'نعم',contractor155Status:'نعم',consultant155Date:'',contractor155Date:'25/10/2026'},
 {workOrder:'5',consultant155Status:'لا',contractor155Status:'نعم',consultant155Date:'24/10/2026',contractor155Date:'25/10/2026'},
 {workOrder:'6',consultant155Status:'نعم',contractor155Status:'نعم',consultant155Date:'2026-10-24 09:20:00',contractor155Date:'2026-10-24 10:20:00'},
 {workOrder:'7',consultant155Status:'نعم',contractor155Status:'غير محدد',consultant155Date:'24/10/2026'},
 {workOrder:'8',consultant155Status:'نعم',contractor155Status:'نعم',consultant155Date:'٢٤/١٠/٢٠٢٦',contractor155Date:'٢٥/١٠/٢٠٢٦'},
 {workOrder:'9',consultant155Status:'نعم',contractor155Status:'نعم',consultant155Date:'32/10/2026',contractor155Date:'25/10/2026'}
];
assert.deepEqual(Array.from(api.analyze(rows),r=>r.workOrder),['1','2','6','8']);
assert(api.timestamp('25/10/2026')<api.timestamp('26/10/2026'));
assert.equal(api.timestamp('32/10/2026'),null);
const rendered=api.branch(rows,9,(n,t)=>(n/t*100).toFixed(0)+'% من الإجمالي',String,String);
assert(rendered.includes('فحص إدخال 155 استشاري قبل 155 مقاول'));
assert(rendered.includes('<strong>4</strong>'));
console.log('PASS sequence 155: status, chronology, Arabic dates, time, missing/invalid values, card count');
