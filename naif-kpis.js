'use strict';
/* Fast, read-only dashboard KPI answers. City, sheet and permissions are selected by the caller. */
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).trim();
const raw=v=>String(v??'').trim();
const number=v=>{const m=raw(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
const pct=(a,b)=>b?Math.round(a/b*1000)/10:0;
const fmt=v=>Number(v).toLocaleString('ar-SA',{maximumFractionDigits:1});
const percentValue=v=>{const s=raw(v),n=number(s);if(n===null)return null;return Math.max(0,Math.min(100,Math.round((s.includes('%')?n:(n>0&&n<=1?n*100:n))*10)/10));};
const avgPct=(rows,k)=>{const vals=rows.map(r=>percentValue(r[k])).filter(Number.isFinite);return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:null;};
const mean=(rows,k)=>{const vals=rows.map(r=>number(r[k])).filter(Number.isFinite);return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*100)/100:null;};
const total=(rows,k)=>rows.reduce((s,r)=>s+(number(r[k])||0),0);
const contains=(v,x)=>norm(v).includes(norm(x));
const done=v=>{const s=norm(v);return !!s&&!/لم يتم التنفيذ|غير منفذ|موقوف|محول/.test(s)&&(s==='تم التنفيذ'||s==='منجز'||s==='مكتمل'||s.includes('تم الانجاز')||s.startsWith('تم التنفيذ'));};
const negative=v=>/لم يتم|غير مكتمل|غير منجز|لا يوجد|لم يستلم|لم يرفع|قيد|معاد|ناقص|موقوف|محول|تحت المراجعه/.test(norm(v));
const positive=v=>!!norm(v)&&!negative(v)&&/تم|نعم|مكتمل|منجز|معتمد|صدر|مرفوع|جاهز|استلم|انته/.test(norm(v));
const fieldRate=(rows,k)=>pct(rows.filter(r=>positive(r[k])).length,rows.length);
const composite=(rows,keys)=>rows.length?pct(rows.reduce((a,r)=>a+keys.filter(k=>positive(r[k])).length,0),rows.length*keys.length):0;
const count=(rows,k,test)=>rows.filter(r=>test(r[k],r)).length;
const metricQuestion=q=>/نسب|انجاز|تقدم|مؤشر|مؤشرات|كروت|بطاقات|عداد|احصائ|ملخص|اجمالي|مجموع|متوسط|معدل|كم|عدد|حاله التنفيذ|التاخير|المتأخر|متاخر|spi|تكلف|غرام|مالي|مالية|تحصيل|توثيق|الرفع|اغلاق|مكتمل|منفذ/.test(norm(q));
const metricData=(page,rows)=>{
 const key=page.key;
 const list=[['إجمالي السجلات',fmt(rows.length)]];
 const add=(label,value,unit='')=>{if(value!==null&&Number.isFinite(Number(value)))list.push([label,fmt(value)+unit]);};
 const doneKey=['projects','connections','operations'].includes(key)?'executionStatus':'status';
 const completed=count(rows,doneKey,done);
 if(['workorders','projects','connections','operations','emergency'].includes(key)){
  add('تم التنفيذ',completed);
  add('غير منفذ / غير مكتمل',rows.length-completed);
  const average=avgPct(rows,'progress');
  add(['projects','connections','operations'].includes(key)?'نسبة التقدم الميداني':'نسبة الإنجاز',average===null?pct(completed,rows.length):average,'%');
  add('اكتمال التنفيذ',pct(completed,rows.length),'%');
 }
 if(['projects','connections','operations'].includes(key)){
  add('متوسط نسبة الإنجاز',avgPct(rows,'progress'),'%');
  add('متوسط إنجاز الحفر',avgPct(rows,'excavationProgress'),'%');
  add('متوسط إنجاز التمديد',avgPct(rows,'extensionProgress'),'%');
  add('متوسط النسبة الزمنية',avgPct(rows,'timeRatio'),'%');
  add('متوسط SPI',mean(rows,'spi'));
  add('أوامر وصلت 155 الاستشاري',count(rows,'consultant155Date',v=>!!raw(v)));
  add('100% ولم تصل مرحلة الإغلاق',count(rows,'progress', (v,r)=>percentValue(v)===100&&!contains(r.stage,'الإغلاق')));
 }
 if(key==='workorders'){
  add('المشاريع',count(rows,'section',v=>norm(v)==='مشاريع'));
  add('التوصيلات',count(rows,'section',v=>norm(v)==='توصيلات'));
  add('العمليات',count(rows,'section',v=>contains(v,'عمليات')));
  add('إجمالي قيمة أوامر العمل',total(rows,'value'));
  add('قيمة الأوامر المنفذة',rows.filter(r=>done(r.status)).reduce((s,r)=>s+(number(r.value)||0),0));
 }
 if(['projects','connections','operations','workorders'].includes(key)){
  add('تأخير بسيط',count(rows,'delay',v=>contains(v,'تأخير بسيط')));
  add('تأخير متوسط',count(rows,'delay',v=>contains(v,'تأخير متوسط')));
  add('تأخير شديد',count(rows,'delay',v=>contains(v,'تأخير شديد')));
 }
 if(key==='permits'){
  const issued=count(rows,'permitStatus',v=>/تم اصدار|تم الاصدار|صدر|معتمد/.test(norm(v)));
  const noNeed=count(rows,'permitStatus',v=>contains(v,'لا يتطلب'));
  add('تصاريح صادرة',issued);
  add('تصاريح لا تتطلب إصدارًا',noNeed);
  add('نسبة الإنجاز',pct(issued+noNeed,rows.length),'%');
  add('نسبة اتخاذ الإجراء',fieldRate(rows,'actionTaken'),'%');
 }
 if(key==='closures'){
  add('اكتمال دورة الإغلاق',composite(rows,['docsReceived','docsReview','stamp','email','systemUpload','assetsUpload','certificate']),'%');
  add('شهادة الإنجاز',fieldRate(rows,'certificate'),'%');
 }
 if(key==='assets'){
  add('اكتمال مسار الأصول',composite(rows,['plantingReview','assetForm','fieldReceipt','procedure207','systemReceipt']),'%');
  add('الاستلام على النظام',fieldRate(rows,'systemReceipt'),'%');
 }
 if(key==='emergency'){
  add('أرشفة المستندات',fieldRate(rows,'archive'),'%');
 }
 if(key==='attachments'){
  add('نسبة الرفع',fieldRate(rows,'status'),'%');
  add('اكتمال أنواع المرفقات',composite(rows,['photos','safetyForms','supervisionForms','assetTests','asbuilt']),'%');
 }
 if(key==='tasks'){
  add('توثيق الإفادة الميدانية',pct(count(rows,'statement',v=>!!raw(v)),rows.length),'%');
  add('معالجة المرفقات',pct(rows.filter(r=>positive(r.resolved)||positive(r.attachments)).length,rows.length),'%');
 }
 if(key==='finance'){
  const billed=rows.reduce((s,r)=>s+(number(r.invoiceTotal)||number(r.netValue)||number(r.workOrderValue)||0),0);
  const paid=total(rows,'paid');
  add('إجمالي القيمة',billed);
  add('المدفوع',paid);
  add('نسبة التحصيل',billed?Math.min(100,pct(paid,billed)):fieldRate(rows,'paymentStatus'),'%');
 }
 if(key==='minutes')add('إجمالي الغرامات',total(rows,'penalty'));
 if(key==='safety'||key==='executionViolations'||key==='minutes'){
  add('أوامر العمل الفريدة',new Set(rows.map(r=>raw(r.workOrder)).filter(Boolean)).size);
  add('عدد المقاولين',new Set(rows.map(r=>raw(r.contractor)).filter(Boolean)).size);
 }
 return list;
};
function answerNaifKpis({question,project,page,rows}){
 if(!metricQuestion(question)||!Array.isArray(rows))return null;
 // Do not replace detailed work-order or person lookup with unfiltered aggregates.
 if(/\d{4,}/.test(norm(question))||/رقم امر العمل|برقم امر العمل|باسم المهندس|اسم المقاول/.test(norm(question)))return null;
 const metrics=metricData(page,rows),q=norm(question),all=/جميع|كل|كافه|كافة|لخص|ملخص|الكروت|البطاقات|المؤشرات|العدادات/.test(q);
 const stop=new Set(['كم','عدد','ما','ماهي','ماهو','نسبه','نسبة','في','من','المشاريع','المشروع','التوصيلات','التصاريح','الاوامر','العمل','الداشبورد','المؤشر','قيمة','معدل','المعدل','متوسط','اجمالي','الحاليه','الحالي']);
 const tokens=q.split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>2&&!stop.has(x));
 let list=metrics;
 if(!all&&tokens.length){
   const matches=metrics.map(m=>{const title=norm(m[0]);return {m,score:tokens.reduce((n,t)=>n+(title.includes(t)?3:0),0)};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
   if(matches.length)list=matches.slice(0,4).map(x=>x.m);
   else if(/نسب|انجاز|تقدم/.test(q))list=metrics.filter(m=>/نسبه الانجاز|نسبه التقدم|نسبه التحصيل|نسبه الرفع|اكتمال/.test(norm(m[0]))).slice(0,3);
   else if(/كم|عدد|اجمالي/.test(q))list=metrics.slice(0,2);
 }
 if(!list.length)return null;
 return 'مؤشرات '+page.title+' — مشروع كهرباء '+project+' (بدون فلاتر العرض المحلية):\n'+list.slice(0,24).map(m=>'• '+m[0]+': '+m[1]).join('\n')+'\nالمصدر: '+page.sheet+'، من بيانات المشروع المصرح بها. عند تطبيق فلاتر داخل التبويب استخدم كروت الشاشة للحصول على القيم المفلترة.';
}
module.exports={answerNaifKpis,metricQuestion,metricData};
