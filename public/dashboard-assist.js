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
 if(p==='violationsCombined')return 'مصدر مركب من أوراق مخالفات التنفيذ ومحاضر المخالفات';
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
function meetingClick(id,label){
 if(id==='wmExecutionChart'){const m={'أُنجز التنفيذ':'completed','متأخر تنفيذ':'delayed','قيد التنفيذ ضمن المدة':'within','أخرى':'other'};if(m[label]){S.meetingChartFilters[id]={mode:m[label],label};renderWednesdayMeeting()}return}
 if(id==='wmDelayChart'){S.meetingChartFilters[id]={field:'delayBucket',value:label,mode:'exact',label};renderWednesdayMeeting();return}
 if(MEETING[id]){S.meetingChartFilters[id]={field:MEETING[id],value:label,mode:'exact',label};renderWednesdayMeeting()}
}
function chartClick(c,e,ch){
 const es=ch.getElementsAtEventForMode(e,'nearest',{intersect:true},true);if(!es.length)return;const x=es[0],i=x.index,di=x.datasetIndex||0,l=clean(ch.data.labels&&ch.data.labels[i]),raw=ch.data.datasets&&ch.data.datasets[di]&&ch.data.datasets[di].data[i];
 if(page()==='hrStaff'&&window.HRDashboard){window.HRDashboard.filterFromChart(c.id,l);return}
 if(page()==='wednesdayMeeting'){meetingClick(c.id,l);return}
 if(c.id==='paExec'||c.id==='caExec'||c.id==='meStatus'){const f=rows().some(r=>'executionStatus'in r)?'executionStatus':'status';toggleChartFilter(c.id,f,l.includes('موقوف')?'موقوف/محول':l,'حالة التنفيذ','contains',l);return}
 if(c.id==='paAdvice'||c.id==='caAdvice'){toggleChartFilter(c.id,'adviceAge',l,'حداثة الإفادة','contains',l);return}
 if(c.id==='pa155'||c.id==='ca155'){const f=rows().some(r=>'consultant155Date'in r)?'consultant155Date':'consultant155';setF(c.id,{field:f,value:l,label:'155',mode:l.includes('لم')?'blank':'notblank',displayValue:l});return}
 if(c.id==='paScatter'||c.id==='caScatter'){const wo=raw&&typeof raw==='object'?clean(raw.workOrder):'';if(wo)toggleChartFilter(c.id,'workOrder',wo,'أمر العمل','exact',wo);return}
 if(c.id==='peAction'){setF(c.id,{field:'actionTaken',value:'',label:l,mode:l.includes('لم')?'blank':'notblank',displayValue:l});return}
 if(c.id==='peExpiry'){const v=l.includes('بدون')?'missing':l.includes('منتهي')?'expired':'active';setF(c.id,{field:'permitEnd',value:v,label:l,mode:'date-state',displayValue:l});return}
 if(c.id==='peIssueLag'||c.id==='peValidity'){const s=l.replace(/[–—]/g,'-'),ns=[...s.matchAll(/\d+/g)].map(x=>Number(x[0]));const over=s.includes('>');const f=c.id==='peIssueLag'?['assignedDate','permitStart']:['permitStart','permitEnd'];const q={fromField:f[0],toField:f[1],label:l,displayValue:l,mode:'date-diff-range'};if(over&&ns.length)q.gt=ns[0];else if(ns.length>=2){q.gte=ns[0];q.lte=ns[1]}else if(ns.length===1){q.lte=ns[0]}setF(c.id,q);return}
 if(c.id==='pePendingAge'){const s=l.replace(/[–—]/g,'-'),ns=[...s.matchAll(/\d+/g)].map(x=>Number(x[0]));const q={field:'days',label:l,displayValue:l,mode:'number-range',scale:'raw'};if(s.includes('+')&&ns.length)q.gte=ns[0];else if(ns.length>=2){q.gte=ns[0];q.lte=ns[1]}setF(c.id,q);return}
 if(c.id==='sfOutcome'){const v=l.includes('بدون إفادة')?'due-missing':l.includes('غير مستحق')?'notdue-missing':l.includes('لم يتم')||l.includes('لا يوجد')?'nowork':'productive';setF(c.id,{field:'statement',value:v,label:l,mode:'site-outcome',displayValue:l});return}
 if(c.id==='sfQuality'){const map={'الإحداثيات':'coordinates','مشرف المقاول':'contractorSupervisor','هاتف المشرف':'contractorPhone','وقت الانتهاء':'endTime','مهندس الموقع':'engineer','الموقع':'location','المصدر':'source','إفادة الموقع':'statement'};const fld=map[l];if(fld)setF(c.id,{field:fld,value:'',label:l,mode:'blank',displayValue:l});return}
 if(c.id==='me155'){const fld=i===0?'consultant155':'contractor155',ds=clean(ch.data.datasets&&ch.data.datasets[di]&&ch.data.datasets[di].label),yes=!ds.includes('لا');setF(c.id,{field:fld,value:'',label:l+' - '+ds,mode:yes?'notblank':'blank',displayValue:l+' - '+ds});return}
 if(BANDS[c.id]){const b=band(l);if(b){setF(c.id,Object.assign({field:BANDS[c.id][0],label:l,displayValue:l,mode:'number-range',scale:BANDS[c.id][1]?'ratio':'raw'},b))}return}
 const r=RULES[c.id];if(r){toggleChartFilter(c.id,r[0],l,r[0],r[1]||'exact',l);return}
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