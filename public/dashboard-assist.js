(()=>{
'use strict';
const PAGE_ALIAS={master:'workorders',wednesdayMeeting:'workorders'};
const RULES={
safetyTrendChart:['date','month'],safetyContractorChart:['contractor'],safetyViolationChart:['violation1'],safetySupervisorChart:['supervisor'],safetyTypeChart:['type'],safetyEditorChart:['editor'],
executionTrendChart:['date','month'],executionContractorChart:['contractor'],executionViolationChart:['violation'],executionSupervisorChart:['supervisor'],executionTypeChart:['type'],executionSectionChart:['violationSection'],
paStage:['stage'],paStatus:['stageStatus'],paPermit:['permit'],paDelay:['delay'],paType:['description'],paLocation:['location'],paContractor:['contractor'],paEngineer:['engineer'],paTrend:['assignedDate','month'],
caCategory:['category'],caStage:['stage'],caStageStatus:['stageStatus'],caDelay:['delay'],caPermit:['permit'],caOffice:['office'],caType:['description'],caLocation:['location'],caContractor:['contractor'],caEngineer:['engineer'],caCatExec:['category'],caTrend:['assignedDate','month'],
peStatus:['permitStatus'],peEval:['evaluation'],peSection:['section'],peCategory:['category'],peContractor:['contractor'],peSectionStatus:['section'],peCategoryStatus:['category'],peType:['type'],peLocation:['location'],pePendingContractor:['contractor'],peTrend:['assignedDate','month'],peEvalSection:['section'],
sfEngineer:['engineer'],sfContractor:['contractor'],sfTask:['task'],sfLocation:['location'],sfSource:['source'],sfAttachments:['attachments'],sf203:['readiness203'],sf190:['readiness190'],sfLatestLoad:['engineer'],sfDaily:['date','month'],
meSectionCount:['section'],meSectionValue:['section'],meSection:['section'],meStage:['stage'],meStageStatus:['stageStatus'],mePermit:['permit'],meCategory:['category'],meContractor:['contractor'],meContractorStatus:['contractor'],meEngineer:['engineer'],meMonthly:['assignedDate','month']
};
const BANDS={paProgress:['progress',1],caProgress:['progress',1],paTime:['timeRatio',1],caTime:['timeRatio',1],caSpi:['spi',0]};
const MEETING={wmOfficeChart:'officeSummary',wmCategoryChart:'category',wmContractorChart:'contractor',wmWorkTypeChart:'workType',wmPermitChart:'permitStatus',wmDocsChart:'docsSubStatus'};
const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function page(){try{return S.current||'master'}catch(e){return'master'}}
function rows(){try{return page()==='master'?(S.masterRows||[]):page()==='wednesdayMeeting'?(S.meetingRows||[]):(S.raw||[])}catch(e){return[]}}
function meta(){try{const k=PAGE_ALIAS[page()]||page();return S.boot&&S.boot.pageMeta?S.boot.pageMeta[k]:null}catch(e){return null}}
function source(){
 const p=page(),m=meta();
 if(p==='hrStaff')return 'ملف «ادارة فروع مكه و الطائف وجدة» — ورقة «الكادر الفعلي والمعتمد حسب المصفوفة»';
 if(p==='importantLinks')return 'لوحة الروابط الأصلية المعتمدة للمشروع';
 if(p==='executionViolations')return 'Google Sheet — ورقة «🚫مخالفات التنفيذ»';
 if(p==='minutes')return 'Google Sheet — ورقة «🚫محاضر مخالفة اثبات الحالة»';
 return m&&m.sheet?'Google Sheet — ورقة «'+m.sheet+'»':'مصدر بيانات التاب الحالي من Google Sheets';
}
function title(el){const q=el&&el.querySelector?el.querySelector(':scope > .panel-title h3,:scope > .panel-head .panel-title h3,:scope > span,:scope > h3,.panel-title h3'):null;return clean((q&&q.textContent)||(el&&el.getAttribute&&el.getAttribute('aria-label'))||'الكائن')}
function hint(el){const q=el&&el.querySelector?el.querySelector(':scope > .panel-title span,:scope > .panel-head .panel-title span,:scope > small,.panel-title span'):null;const a=clean(q&&q.textContent),c=el&&el.querySelector?el.querySelector('canvas'):null;return[a,a&&c&&c.id?'معرّف الشارت: '+c.id:(c&&c.id?'معرّف الشارت: '+c.id:'')].filter(Boolean).join(' — ')}
function kind(el){
 if(el.matches&&el.matches('.master-card,.mini-kpi,.kpi-story-card,.meeting-summary-card,.hr-kpi,.pa-card,.ca-card,.pe-card,.sf-card,.me-card,.emergency-kpi-card'))return'card';
 if(el.querySelector&&el.querySelector('canvas'))return'chart';
 if(el.querySelector&&el.querySelector('table,.table-wrap'))return'table';
 return'panel';
}
function calc(el){
 const k=kind(el),t=title(el),h=hint(el);
 if(k==='table')return'يعرض الصفوف المطابقة للفلاتر النشطة مباشرة من مصدر التاب، ويتغير عدد الصفوف عند تطبيق أي فلتر يدوي أو تفاعلي.';
 if(k==='chart')return(/متوسط|نسبة|SPI|إنجاز|زمني|قيمة/i.test(t)?'يُعاد احتساب المؤشر من الصفوف المطابقة للفلاتر الحالية باستخدام التجميع/المتوسط/النسبة الموضحة بعنوان الشارت.':'يتم تجميع الصفوف المطابقة للفلاتر الحالية حسب البعد الظاهر في الشارت ثم حساب عدد السجلات لكل فئة.')+(h?' المرجع: '+h+'.':'');
 const s=clean(el.querySelector&&el.querySelector(':scope > small')&&el.querySelector(':scope > small').textContent);
 if(k==='card')return'القيمة محسوبة من الصفوف المطابقة للفلاتر الحالية وفق شرط الكارت «'+t+'».'+(s?' أساس/ملاحظة الاحتساب: '+s+'.':'');
 return'عنصر تحليلي يتحدث تلقائيًا مع الفلاتر النشطة في الصفحة.'+(h?' المرجع: '+h+'.':'');
}
function modal(){
 let m=document.getElementById('vdUniversalInfoModal');if(m)return m;
 m=document.createElement('div');m.id='vdUniversalInfoModal';m.className='vd-info-modal';m.setAttribute('aria-hidden','true');
 m.innerHTML='<div class="vd-info-dialog" role="dialog" aria-modal="true"><div class="vd-info-head"><div><small>CALCULATION & SOURCE</small><h3 class="vd-info-title">تفاصيل الاحتساب</h3></div><button type="button" class="vd-info-close">×</button></div><div class="vd-info-body"></div></div>';
 document.body.appendChild(m);const close=()=>{m.classList.remove('show');m.setAttribute('aria-hidden','true')};m.querySelector('.vd-info-close').onclick=close;m.onclick=e=>{if(e.target===m)close()};return m;
}
function openInfo(el){
 const m=modal(),t=title(el),h=hint(el);m.querySelector('.vd-info-title').textContent=t;
 m.querySelector('.vd-info-body').innerHTML='<div class="vd-info-row"><b>نوع الكائن</b><span>'+esc(kind(el)==='card'?'كارت':kind(el)==='chart'?'شارت':kind(el)==='table'?'جدول':'عنصر تحليلي')+'</span></div>'+
 '<div class="vd-info-row"><b>كيفية الاحتساب</b><span>'+esc(calc(el))+'</span></div>'+
 '<div class="vd-info-row"><b>مصدر البيانات</b><span>'+esc(source())+'</span></div>'+
 (h?'<div class="vd-info-row"><b>الحقل / المرجع</b><span>'+esc(h)+'</span></div>':'')+
 '<div class="vd-info-row"><b>التفاعل</b><span>الفلاتر اليدوية والفلاتر الناتجة عن الضغط على الكروت والشارتات تعمل معًا، ويعاد احتساب بقية عناصر الصفحة على نفس النطاق.</span></div>';
 m.classList.add('show');m.setAttribute('aria-hidden','false');
}
function info(el){
 if(!el||el.dataset.vdInfoBound==='1'||el.closest('.vd-info-modal'))return;el.dataset.vdInfoBound='1';el.classList.add('vd-info-host');
 if(el.querySelector(':scope > .calc-help-btn'))return;
 const b=document.createElement('button');b.type='button';b.className='vd-universal-info';b.textContent='!';b.title='كيفية ومصدر الاحتساب';b.onclick=e=>{e.preventDefault();e.stopPropagation();openInfo(el)};el.appendChild(b);
}
function decorate(){const p=document.querySelector('.page.active');if(!p)return;p.querySelectorAll('article,.panel,.meeting-excel-card,.meeting-table-card,.pa-table,.ca-table,.pe-table,.sf-table,.hr-chart').forEach(info)}
function run(){try{if(page()==='master')applyMasterFilters();else applyFilters()}catch(e){}}
function setF(id,f){try{const st=chartFilterStore(page()),c=st[id],same=c&&JSON.stringify(c)===JSON.stringify(f);if(same)delete st[id];else st[id]=f;renderChartFilterSummary();run()}catch(e){}}
function band(label){
 const s=clean(label).replace(/[–—]/g,'-'),n=[...s.matchAll(/-?\d+(?:\.\d+)?/g)].map(x=>Number(x[0]));
 if(s.startsWith('<')&&n.length)return{lt:n[0]/100};if(s.startsWith('>')&&n.length)return{gt:n[0]/100};if(s==='0%')return{gte:0,lte:0};if(n.length===1&&s.includes('100%'))return{gte:1};if(n.length>=2)return{gte:n[0]/100,lte:n[1]/100};return null;
}
function exactField(label){const a=rows();if(!a.length)return null;let best=null,bn=0;Object.keys(a[0]).filter(k=>!k.startsWith('_')).forEach(k=>{let c=0;a.forEach(r=>{if(clean(r[k])===label)c++});if(c>bn){bn=c;best=k}});return bn?best:null}
function setMeetingChartFilter(id,f){
 const cur=S.meetingChartFilters[id],same=cur&&JSON.stringify(cur)===JSON.stringify(f);
 if(same)delete S.meetingChartFilters[id];else S.meetingChartFilters[id]=f;
 renderWednesdayMeeting();
}
function meetingClick(id,label){
 if(id==='wmExecutionChart'){const m={'أُنجز التنفيذ':'completed','متأخر تنفيذ':'delayed','قيد التنفيذ ضمن المدة':'within','أخرى':'other'};if(m[label])setMeetingChartFilter(id,{mode:m[label],label});return}
 if(id==='wmDelayChart'){setMeetingChartFilter(id,{field:'delayBucket',value:label,mode:'exact',label});return}
 if(MEETING[id])setMeetingChartFilter(id,{field:MEETING[id],value:label,mode:'exact',label});
}
function chartClick(c,e,ch){
 const es=ch.getElementsAtEventForMode(e,'nearest',{intersect:true},true);if(!es.length)return;
 const x=es[0],i=x.index,di=x.datasetIndex||0,l=clean(ch.data.labels&&ch.data.labels[i]),ds=clean(ch.data.datasets&&ch.data.datasets[di]&&ch.data.datasets[di].label),raw=ch.data.datasets&&ch.data.datasets[di]&&ch.data.datasets[di].data[i];
 const pg=page();
 if(pg==='hrStaff'&&window.HRDashboard){window.HRDashboard.filterFromChart(c.id,l,ds);return}
 if(pg==='employeeEvaluation'&&window.EmployeeEvaluationDashboard){window.EmployeeEvaluationDashboard.filterFromChart(c.id,l,ds);return}
 if(pg==='electricityEngineerEvaluation'&&window.ElectricityEngineerEvaluationDashboard){window.ElectricityEngineerEvaluationDashboard.filterFromChart(c.id,l,ds);return}
 if(pg==='smartThursday'&&window.SmartThursdayPortfolio){window.SmartThursdayPortfolio.filterFromChart(c.id,l,ds,i,di);return}
 if(pg==='wednesdayMeeting'){meetingClick(c.id,l);return}

 if(c.id==='paExec'||c.id==='caExec'||c.id==='meStatus'){setF(c.id,{mode:'derived',kind:'execution-status',value:l.includes('موقوف')?'موقوف/محول':l,label:'حالة التنفيذ',displayValue:l});return}
 if(c.id==='paAdvice'||c.id==='caAdvice'){setF(c.id,{mode:'derived',kind:'advice-bucket',value:l,label:'حداثة الإفادة',displayValue:l});return}
 if(c.id==='pa155'||c.id==='ca155'){const a=rows(),f=a.some(r=>'consultant155Date'in r)?'consultant155Date':a.some(r=>'consultant155CompletionDate'in r)?'consultant155CompletionDate':'consultant155';setF(c.id,{field:f,value:l,label:'155',mode:l.includes('لم')?'blank':'notblank',displayValue:l});return}
 if(c.id==='paScatter'||c.id==='caScatter'){const wo=raw&&typeof raw==='object'?clean(raw.workOrder):'';if(wo)toggleChartFilter(c.id,'workOrder',wo,'أمر العمل','exact',wo);return}
 if(c.id==='paPhysical'){const f={'الحفر':'excavationProgress','التمديد':'extensionProgress','الإنجاز الكلي':'progress'}[l];if(f)setF(c.id,{field:f,value:'',label:l,mode:'notblank',displayValue:l});return}
 if(c.id==='paBlocker'){setF(c.id,{mode:'derived',kind:'project-blocker',value:l,label:'الاختناق',displayValue:l});return}
 if(c.id==='caBlocker'){setF(c.id,{mode:'derived',kind:'connection-blocker',value:l,label:'الاختناق',displayValue:l});return}
 if(c.id==='caCategory'){setF(c.id,{field:'category',mode:'derived',kind:'category-display',value:l,label:'التصنيف',displayValue:l});return}
 if(c.id==='paDelay'||c.id==='caDelay'||c.id==='meDelay'){let v=l;if(l.includes('أوشكت'))v='أوشكت المدة';if(l.includes('عال'))v='تأخير عالي';setF(c.id,{mode:'derived',kind:'delay-bucket',value:v,label:'التأخير',displayValue:l});return}

 const stackedStatus={paContractor:'contractor',paEngineer:'engineer',caContractor:'contractor',caEngineer:'engineer',meSection:'section',meContractorStatus:'contractor'};
 if(stackedStatus[c.id]){setF(c.id,{field:stackedStatus[c.id],mode:'derived',kind:'field-status',dimensionValue:l,statusValue:ds,label:stackedStatus[c.id],value:l+' / '+ds,displayValue:l+' • '+ds});return}
 if(c.id==='caCatExec'){setF(c.id,{field:'category',mode:'derived',kind:'category-status',dimensionValue:l,statusValue:ds,label:'التصنيف / التنفيذ',value:l+' / '+ds,displayValue:l+' • '+ds});return}

 if(c.id==='peStatus'){setF(c.id,{mode:'derived',kind:'permit-bucket',value:l,label:'حالة التصريح',displayValue:l});return}
 if(c.id==='peEval'){setF(c.id,{mode:'derived',kind:'permit-eval',value:l,label:'تقييم الطلب',displayValue:l});return}
 if(c.id==='peAction'){setF(c.id,{mode:'derived',kind:'action-state',value:l.includes('لم')?'no':'yes',label:'الإجراء',displayValue:l});return}
 if(c.id==='peExpiry'){const v=l.includes('بدون')?'missing':l.includes('منتهي')?'expired':'active';setF(c.id,{field:'permitEnd',value:v,label:'صلاحية التصريح',mode:'date-state',displayValue:l});return}
 if(c.id==='peTrend'){const f=di===1?'permitStart':'assignedDate';toggleChartFilter(c.id,f,l,'الشهر','month',l);return}
 if(c.id==='peIssueLag'||c.id==='peValidity'){const s=l.replace(/[–—]/g,'-'),ns=[...s.matchAll(/\d+/g)].map(x=>Number(x[0]));const over=s.includes('>'),f=c.id==='peIssueLag'?['assignedDate','permitStart']:['permitStart','permitEnd'],q={fromField:f[0],toField:f[1],label:l,displayValue:l,mode:'date-diff-range'};if(over&&ns.length)q.gt=ns[0];else if(ns.length>=2){q.gte=ns[0];q.lte=ns[1]}else if(ns.length===1){q.lte=ns[0]}setF(c.id,q);return}
 if(c.id==='pePendingAge'){const s=l.replace(/[–—]/g,'-'),ns=[...s.matchAll(/\d+/g)].map(x=>Number(x[0])),q={field:'days',label:l,displayValue:l,mode:'number-range',scale:'raw'};if(s.includes('+')&&ns.length)q.gte=ns[0];else if(ns.length>=2){q.gte=ns[0];q.lte=ns[1]}setF(c.id,q);return}
 const stackedPermit={peContractor:'contractor',peSectionStatus:'section',peCategoryStatus:'category'};
 if(stackedPermit[c.id]){setF(c.id,{field:stackedPermit[c.id],mode:'derived',kind:'field-permit',dimensionValue:l,statusValue:ds,label:'حالة التصريح',value:l+' / '+ds,displayValue:l+' • '+ds});return}
 if(c.id==='peEvalSection'){setF(c.id,{field:'section',mode:'derived',kind:'field-eval',dimensionValue:l,statusValue:ds,label:'القسم / التقييم',value:l+' / '+ds,displayValue:l+' • '+ds});return}

 if(c.id==='sfOutcome'){const v=l==='مستحق بلا إفادة'?'due-missing':l==='لم يحل موعده'?'notdue-missing':(l.includes('تأجيل')||l.includes('لا عمل'))?'nowork':'productive';setF(c.id,{field:'statement',value:v,label:'نتيجة المتابعة',mode:'site-outcome',displayValue:l});return}
 if(c.id==='sfDaily'){setF(c.id,{field:'date',value:l,label:'تاريخ المهمة',mode:'day',displayValue:l});return}
 if(c.id==='sfQuality'){const map={'إحداثيات':'coordinates','مشرف مقاول':'contractorSupervisor','جوال المشرف':'contractorPhone','وقت الانتهاء':'endTime','مسؤول الموقع':'engineer','الموقع':'location','المصدر':'source','إفادة مستحقة':'statement'},fld=map[l];if(fld)setF(c.id,{field:fld,value:'',label:l,mode:(l==='وقت الانتهاء'||l==='إفادة مستحقة')?'site-due-blank':'blank',displayValue:l});return}
 if(c.id==='sfSupport'&&window.SiteFollowupDashboard){const values=window.SiteFollowupDashboard.supportWorkOrders(l);setF(c.id,{field:'workOrder',values,label:'المرفقات المساندة',value:l,mode:'in-list',displayValue:l});return}

 if(c.id==='me155'){const fld=i===0?'consultant155':'contractor155',yes=!ds.includes('لا');setF(c.id,{field:fld,mode:'derived',kind:'yes-no',value:yes?'yes':'no',label:l+' - '+ds,displayValue:l+' - '+ds});return}

 if(BANDS[c.id]){const b=band(l);if(b)setF(c.id,Object.assign({field:BANDS[c.id][0],label:l,displayValue:l,mode:'number-range',scale:BANDS[c.id][1]?'ratio':'raw'},b));return}
 const r=RULES[c.id];
 if(r){if(l==='غير محدد')setF(c.id,{field:r[0],value:'',label:r[0],mode:'blank',displayValue:l});else toggleChartFilter(c.id,r[0],l,r[0],r[1]||'exact',l);return}
 const f=exactField(l);if(f)toggleChartFilter(c.id,f,l,f,'exact',l);
}
function chartNative(ch){return typeof(ch&&ch.options&&ch.options.onClick)==='function'}
function canvas(c){
 if(c.dataset.vdInteractive==='1')return;c.dataset.vdInteractive='1';
 c.addEventListener('mousemove',e=>{const ch=window.Chart&&Chart.getChart?Chart.getChart(c):null;if(!ch||chartNative(ch))return;try{c.style.cursor=ch.getElementsAtEventForMode(e,'nearest',{intersect:true},true).length?'pointer':'default'}catch(x){}});
 c.addEventListener('click',e=>{const ch=window.Chart&&Chart.getChart?Chart.getChart(c):null;if(!ch||chartNative(ch))return;try{chartClick(c,e,ch)}catch(x){console.warn(x)}});
}
function meetCard(l){const m={'تم التنفيذ':'completed','أُنجز التنفيذ':'completed','متأخر تنفيذ':'delayed','قيد التنفيذ ضمن المدة':'within','متأخر إغلاق':'closure'};if(l.includes('إجمالي أوامر العمل')){S.meetingChartFilters={};renderWednesdayMeeting();return true}if(m[l]){S.meetingChartFilters['card-'+l]={mode:m[l],label:l};renderWednesdayMeeting();return true}if(l.includes('مستندات لم')){S.meetingChartFilters['card-docs']={field:'docsSubStatus',value:'لم تُسلّم من المقاول',mode:'contains',label:l};renderWednesdayMeeting();return true}return false}
function cardAct(c){
 const l=title(c);if(!l)return;if(page()==='hrStaff'&&window.HRDashboard){window.HRDashboard.filterFromCard(l);return}if(page()==='wednesdayMeeting'&&meetCard(l))return;
 if(/إجمالي|المجموع الكلي/.test(l)){try{clearChartFilters(page());run()}catch(e){}return}
 const a=rows(),has=k=>a.some(r=>Object.prototype.hasOwnProperty.call(r,k)),ex=(f,v,m)=>{if(has(f))toggleChartFilter('card-'+l,f,v==null?l:v,f,m||'exact',l)};
 if(l==='تم التنفيذ'||l==='لم يتم التنفيذ'||l.includes('موقوف')){const f=has('executionStatus')?'executionStatus':'status';ex(f,l.includes('موقوف')?'موقوف/محول':l,'contains');return}
 if(['منجز','جاري التنفيذ','لم يتم البدء'].includes(l)){ex('status',l);return}
 if(l.includes('بدون مسؤول')||l.includes('بدون مهندس')){setF('card-'+l,{field:has('engineer')?'engineer':'supervisor',value:'',label:l,mode:'blank',displayValue:l});return}
 if(l.includes('بدون تفصيل')){setF('card-'+l,{field:'detail',value:'',label:l,mode:'blank',displayValue:l});return}
 if(l.includes('وصل 155')){setF('card-'+l,{field:has('consultant155Date')?'consultant155Date':'consultant155',value:'',label:l,mode:'notblank',displayValue:l});return}
 if(l.includes('تم إصدار التصريح')){ex(has('permit')?'permit':'permitStatus','اصدار','contains');return}
 if(l.includes('لا يتطلب تصريح')){ex(has('permit')?'permit':'permitStatus','لا يتطلب','contains');return}
 if(l.includes('المقاولون')){setF('card-'+l,{field:'contractor',value:'',label:l,mode:'notblank',displayValue:l});return}
 if(l.includes('المسؤولون')||l.includes('المهندسون')){setF('card-'+l,{field:has('engineer')?'engineer':'supervisor',value:'',label:l,mode:'notblank',displayValue:l});return}
 if(l.includes('المواقع')){setF('card-'+l,{field:'location',value:'',label:l,mode:'notblank',displayValue:l});return}
 if(l.includes('أنواع الأعمال')){setF('card-'+l,{field:has('description')?'description':'type',value:'',label:l,mode:'notblank',displayValue:l});return}
 if(l.includes('متوسط الإنجاز')||l.includes('نسبة الإنجاز')){setF('card-'+l,{field:'progress',value:'',label:l,mode:'notblank',displayValue:l});return}
 if(l.includes('متوسط SPI')){setF('card-'+l,{field:'spi',value:'',label:l,mode:'notblank',displayValue:l});return}
 if(l.includes('متوسط AJ')||l.includes('النسبة الزمنية')){setF('card-'+l,{field:'timeRatio',value:'',label:l,mode:'notblank',displayValue:l});return}
 const f=exactField(l);if(f)toggleChartFilter('card-'+l,f,l,f,'exact',l);
}
function card(c){
 if(c.dataset.vdCardInteractive==='1')return;c.dataset.vdCardInteractive='1';c.classList.add('vd-filter-card');c.setAttribute('tabindex','0');
 if(c.classList.contains('master-card'))c.onclick=null;else if(typeof c.onclick==='function')return;
 c.addEventListener('click',e=>{if(e.target.closest('.vd-universal-info,.calc-help-btn,a,button,select,input'))return;cardAct(c)});
 c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();cardAct(c)}});
}
function bind(){const p=document.querySelector('.page.active');if(!p)return;p.querySelectorAll('canvas').forEach(canvas);p.querySelectorAll('.master-card,.mini-kpi,.kpi-story-card,.meeting-summary-card,.hr-kpi,.pa-card,.ca-card,.pe-card,.sf-card,.me-card,.emergency-kpi-card').forEach(card)}
function pulse(){decorate();bind()}
document.addEventListener('DOMContentLoaded',()=>{modal();pulse();const o=new MutationObserver(()=>requestAnimationFrame(pulse));o.observe(document.body,{childList:true,subtree:true});setInterval(pulse,1200)});
})();