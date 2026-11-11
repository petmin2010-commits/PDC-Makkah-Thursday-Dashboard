'use strict';
/* Naif HR dashboard expert: aggregate-only staff and training from the
   existing «الكادر» sheet; project city and HR tab permissions are mandatory. */
const norm=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}%]+/gu,' ').trim();
const fmt=x=>Number(x||0).toLocaleString('ar-SA',{maximumFractionDigits:1});
const num=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:0};
const text=v=>String(v??'').trim().slice(0,120);
function canReadHr(user){
 const p=(user?.permissions||[]).map(norm),role=norm(user?.role);
 return ['admin','administrator','مدير النظام'].includes(role)||
 p.some(x=>['*','all','الكل','جميع الصفحات','كامل الصلاحيات','hrstaff','الموارد البشريه للكادر','الموارد البشريه','الكادر'].includes(x));
}
function isHrQuestion(question,currentPage){
 if(currentPage==='hrStaff')return true;
 return /الكادر|القوى العامله|الموارد البشريه|الموظفين|الموظفون|الدورات التدريبيه|التدريب|البطاقات|بطاقات الموظفين|الشواغر|الشاغره|سيارات الكادر|كفاله الشركه|ساعات دوام الكادر/.test(norm(question));
}
const sum=(rows,k)=>rows.reduce((a,b)=>a+num(b[k]),0);
const avg=(rows,k)=>rows.length?Math.round(sum(rows,k)/rows.length*10)/10:0;
const dist=(rows,k)=>[...rows.reduce((m,r)=>{const name=text(r[k])||'غير محدد';m.set(name,(m.get(name)||0)+1);return m},new Map())]
 .sort((a,b)=>b[1]-a[1]).slice(0,8);
function createNaifHrExpert({getHrStaffData_}){
 return async function answer({question,user,project,currentPage}){
  if(!isHrQuestion(question,currentPage))return null;
  if(!canReadHr(user))return {answer:'لا تتوفر لحسابك صلاحية قراءة كروت الكادر والموارد البشرية في هذه اللوحة. لا أعرض إحصاءات الموظفين من تبويب غير مصرح به.',connected:false,sources:[],project};
  const q=norm(question),city=project==='مكة'?'مكة':'جدة';
  if(/شواغر|شاغره|وظائف خاليه/.test(q))return {answer:'مصدر نايف الحالي للكادر يقرأ بيانات العاملين المسجلين وبيانات التدريب والبطاقات فقط؛ ليس لدي من هذا المصدر جدول موثوق للشواغر. افتح تبويب الكادر للاطلاع على قسم الشواغر إن كان متاحًا.',connected:false,sources:[],project};
  let data;
  try{data=await getHrStaffData_()}catch(error){
   const quota=/429|quota|rate limit/i.test(String(error?.message||error));
   return {answer:'تعذر تحديث بيانات الكادر في مشروع '+city+' من ورقة «الكادر»'+(quota?' بسبب تجاوز حد قراءة Google Sheets.':'.')+' لن أختلق أرقامًا.',connected:false,sources:[],project};
  }
  const all=Array.isArray(data?.rows)?data.rows:[];
  const rows=all.filter(r=>norm(r.city)===norm(city));
  const expired=rows.filter(r=>/انته|منتهي/.test(norm(r.cardStatus))||Number(r.cardDays)<0&&String(r.cardDays??'').trim()).length;
  const soon=rows.filter(r=>/اوشك|قريب/.test(norm(r.cardStatus))||String(r.cardDays??'').trim()&&num(r.cardDays)>=0&&num(r.cardDays)<=30).length;
  const required=sum(rows,'trainingRequired'),done=sum(rows,'trainingCompleted');
  const complete=rows.filter(r=>num(r.trainingPct)>=100).length;
  const trainingInProgress=rows.filter(r=>num(r.trainingPct)<100).length;
  const company=rows.filter(r=>/ابعاد الرؤيه/.test(norm(r.sponsorship))).length;
  const engineers=rows.filter(r=>/مهندس/.test(norm(r.role))).length;
  const percent=required?Math.round(done/required*1000)/10:null;
  const lines=[
   'إجمالي العاملين المسجلين: '+fmt(rows.length),
   'المهندسون: '+fmt(engineers),
   'تحت كفالة أبعاد الرؤية: '+fmt(company),
   'مكتملو التدريب (100%): '+fmt(complete),
   'تدريب غير مكتمل: '+fmt(trainingInProgress),
   'متوسط نسبة إنجاز التدريب للأفراد: '+fmt(avg(rows,'trainingPct'))+'%',
   'الدورات المنجزة: '+fmt(done)+' من '+fmt(required)+' دورة مطلوبة'+(percent===null?'':'؛ نسبة الإنجاز المجمعة '+fmt(percent)+'%'),
   'البطاقات المنتهية: '+fmt(expired)+'، بطاقات ستنتهي خلال 30 يومًا أو موصوفة بأنها أوشكت: '+fmt(soon)
  ];
  let answer='مؤشرات الكادر — كهرباء '+city+' (مصدر «الكادر»، بيانات الموظفين المسجلين فقط):\n'+lines.map(x=>'• '+x).join('\n');
  if(/توزيع|حسب الوظيفه|المسميات|الوظائف|التخصصات|اقسام الكادر/.test(q))answer+='\nتوزيع الوظائف الأعلى عددًا:\n'+dist(rows,'role').map(([k,v])=>'• '+k+': '+fmt(v)).join('\n');
  if(/اسماء|الاسماء|من هم|مين الموظفين/.test(q)){
   // Only when explicitly requested and the HR view is authorized.
   const matching=/مهندسين|المهندسين|المهندس/.test(q)?rows.filter(r=>/مهندس/.test(norm(r.role))):rows;
   answer+='\nعينة من الأسماء الواردة في سجلات هذا المشروع (حتى 10):\n'+matching.slice(0,10)
    .map(r=>'• '+text(r.name)+' — '+text(r.role)+'؛ تدريب '+fmt(r.trainingPct)+'%').join('\n');
   if(matching.length>10)answer+='\nللاطلاع على بقية الأسماء استخدم تبويب الكادر مع الفلاتر.';
  }
  if(!rows.length)answer='لم أجد موظفين مرتبطين بكهرباء '+city+' ضمن القراءة الحالية لورقة «الكادر». لا يعني ذلك عدم وجودهم خارج هذا المصدر.';
  return {answer:answer+'\nالتحديث: '+text(data?.updatedAt||'غير محدد')+'. لم أدمج موظفي المدينة الأخرى، ولم أعرض بيانات اتصال شخصية. فلاتر التبويب المحلية ليست مطبقة على هذا الملخص.',project,connected:true,sources:[{page:'الموارد البشرية للكادر',sheet:'الكادر',records:rows.length,updatedAt:data?.updatedAt}]};
 };
}
module.exports={createNaifHrExpert,canReadHr,isHrQuestion};