(function(){
'use strict';
const t=v=>String(v==null?'':v).replace(/\s+/g,' ').trim(),r1=v=>Math.round(Number(v||0)*10)/10;
const n=v=>{const m=t(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):0},pct=(a,b)=>b?r1(Number(a||0)/Number(b)*100):0;
const norm=v=>t(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toLowerCase();
const isDone=v=>{const s=norm(v);return s==='تم التنفيذ'||s==='منجز'||s==='مكتمل'||s.includes('تم التنفيذ')||s.includes('تم الانجاز')};
const negative=v=>{const s=norm(v);return !!s&&['لم يتم','غير مكتمل','غير منجز','لا يوجد','لم يستلم','لم يرفع','قيد','معاد','ناقص','موقوف','محول','تحت المراجعه'].some(x=>s.includes(x))};
const positive=v=>{const s=norm(v);return !!s&&!negative(v)&&['تم','نعم','مكتمل','منجز','معتمد','صدر','مرفوع','جاهز','استلم','انته'].some(x=>s.includes(x))};
const pnum=v=>{const s=t(v);if(!s)return null;let x=n(s);if(!Number.isFinite(x))return null;if(!s.includes('%')&&x>0&&x<=1)x*=100;return Math.max(0,Math.min(100,r1(x)))};
const avgPct=(rows,key)=>{const a=rows.map(x=>pnum(x?.[key])).filter(x=>x!==null);return a.length?r1(a.reduce((s,x)=>s+x,0)/a.length):null};
const fieldRate=(rows,key)=>rows.length?pct(rows.filter(x=>positive(x?.[key])).length,rows.length):0;
const composite=(rows,keys)=>{if(!rows.length)return 0;let d=0,z=0;rows.forEach(x=>keys.forEach(k=>{z++;if(positive(x?.[k]))d++}));return pct(d,z)};
function metric(key,rows){rows=Array.isArray(rows)?rows:[];if(key==='workorders'){const done=rows.filter(x=>isDone(x.status)).length;return {key,rate:pct(done,rows.length),completed:done,total:rows.length,primaryLabel:'نسبة الإنجاز'};}
if(['projects','connections','operations'].includes(key)){const progress=avgPct(rows,'progress'),done=rows.filter(x=>isDone(x.executionStatus)).length,exec=pct(done,rows.length);return {key,rate:progress===null?exec:progress,completed:done,total:rows.length,primaryLabel:'نسبة التقدم',secondaryLabel:'تنفيذ مكتمل',secondaryRate:exec};}
if(key==='permits'){const done=rows.filter(x=>{const s=norm(x.permitStatus);return s.includes('لا يتطلب')||s.includes('تم اصدار')||s.includes('تم الاصدار')||s.includes('صدر')||s.includes('معتمد')}).length;return {key,rate:pct(done,rows.length),completed:done,total:rows.length,primaryLabel:'نسبة الإنجاز',secondaryLabel:'اتخاذ الإجراء',secondaryRate:fieldRate(rows,'actionTaken')};}
if(key==='closures'){const c=rows.filter(x=>positive(x.certificate)).length;return {key,rate:composite(rows,['docsReceived','docsReview','stamp','email','systemUpload','assetsUpload','certificate']),completed:c,total:rows.length,primaryLabel:'اكتمال دورة الإغلاق',secondaryLabel:'شهادة الإنجاز',secondaryRate:pct(c,rows.length)};}
if(key==='assets'){const c=rows.filter(x=>positive(x.systemReceipt)).length;return {key,rate:composite(rows,['plantingReview','assetForm','fieldReceipt','procedure207','systemReceipt']),completed:c,total:rows.length,primaryLabel:'اكتمال مسار الأصول',secondaryLabel:'الاستلام على النظام',secondaryRate:pct(c,rows.length)};}
if(key==='emergency'){const c=rows.filter(x=>isDone(x.status)).length;return {key,rate:pct(c,rows.length),completed:c,total:rows.length,primaryLabel:'نسبة الإنجاز',secondaryLabel:'أرشفة المستندات',secondaryRate:fieldRate(rows,'archive')};}
if(key==='attachments'){const c=rows.filter(x=>positive(x.status)).length;return {key,rate:pct(c,rows.length),completed:c,total:rows.length,primaryLabel:'نسبة الرفع',secondaryLabel:'اكتمال أنواع المرفقات',secondaryRate:composite(rows,['photos','safetyForms','supervisionForms','assetTests','asbuilt'])};}
if(key==='tasks'){const c=rows.filter(x=>t(x.statement)).length;return {key,rate:pct(c,rows.length),completed:c,total:rows.length,primaryLabel:'توثيق الإفادة الميدانية',secondaryLabel:'معالجة المرفقات',secondaryRate:pct(rows.filter(x=>positive(x.resolved)||positive(x.attachments)).length,rows.length)};}
if(key==='finance'){const total=rows.reduce((s,x)=>s+(n(x.invoiceTotal)||n(x.netValue)||n(x.workOrderValue)),0),paid=rows.reduce((s,x)=>s+n(x.paid),0),c=rows.filter(x=>positive(x.paymentStatus)).length;return {key,rate:total?Math.min(100,pct(paid,total)):fieldRate(rows,'paymentStatus'),completed:c,total:rows.length,primaryLabel:'نسبة التحصيل'};}return null;}
window.VDKpiLogic={metric,isDone,positive,negative,pct,avgPct,fieldRate,composite,pnum,norm};
})();