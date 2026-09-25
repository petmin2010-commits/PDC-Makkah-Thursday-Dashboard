(()=>{
'use strict';

const CFG={
  defaultCity:(document.querySelector('.brand-copy strong')?.textContent||'').includes('مكة')?'مكة':'جدة'
};
const root=()=>document.getElementById('hrStaffRoot');
const EMPTY='—';
let state={
  rows:[],courses:[],updatedAt:'',loaded:false,charts:{},
  filters:{city:CFG.defaultCity,role:'الكل',card:'الكل',sponsor:'الكل',nationality:'الكل',training:'الكل',vehicle:'الكل',search:''}
};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').trim();
const num=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null};
const unique=a=>[...new Set(a.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
const pct=(a,b)=>b?Math.round(a/b*100):0;
const isCompany=r=>clean(r.sponsorship).includes('ابعاد الرؤية');
const vehicleState=r=>{
  const v=clean(r.vehicle);
  if(!v)return 'غير محدد';
  if(v==='يحتاج')return 'يحتاج سيارة';
  if(v==='خاصة')return 'سيارة خاصة';
  if(v==='لا يحتاج')return 'لا يحتاج';
  return 'سيارة مسلمة';
};
const trainingBand=r=>{
  const p=Number(r.trainingPct||0);
  if(p>=100)return 'مكتمل 100%';
  if(p>=75)return '75% - 99%';
  if(p>=50)return '50% - 74%';
  return 'أقل من 50%';
};
const expiryBand=r=>{
  if(r.cardStatus==='لا يوجد')return 'لا يوجد';
  const d=num(r.cardDays);
  if(r.cardStatus==='انتهت'||(d!==null&&d<0))return 'منتهية';
  if(d!==null&&d<=30)return '0 - 30 يوم';
  if(d!==null&&d<=60)return '31 - 60 يوم';
  return 'أكثر من 60 يوم';
};
const clsCard=s=>s==='سارية'?'ok':String(s).includes('أوشكت')?'warn':s==='انتهت'||s==='لا يوجد'?'bad':'neutral';

function destroyCharts(){
  Object.values(state.charts).forEach(c=>{try{c.destroy()}catch{}});
  state.charts={};
}
function optionList(values,current){
  return ['الكل',...unique(values)].map(v=>'<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(v)+'</option>').join('');
}
function filtered(){
  const f=state.filters,q=f.search.trim().toLowerCase();
  return state.rows.filter(r=>{
    if(f.city!=='الكل'&&r.city!==f.city)return false;
    if(f.role!=='الكل'&&r.role!==f.role)return false;
    if(f.card!=='الكل'&&r.cardStatus!==f.card)return false;
    if(f.sponsor!=='الكل'&&(f.sponsor==='أبعاد الرؤية'?!isCompany(r):isCompany(r)))return false;
    if(f.nationality!=='الكل'&&r.nationality!==f.nationality)return false;
    if(f.training!=='الكل'&&trainingBand(r)!==f.training)return false;
    if(f.vehicle!=='الكل'&&vehicleState(r)!==f.vehicle)return false;
    if(q&&![r.name,r.nameEn,r.code,r.role,r.project,r.cardStatus,r.qualification,r.sponsorship,r.email,r.phone].join(' ').toLowerCase().includes(q))return false;
    return true;
  });
}
function countBy(rows,getter){
  const m={};rows.forEach(r=>{const k=clean(getter(r))||'غير محدد';m[k]=(m[k]||0)+1});return m;
}
function avgTraining(rows){return rows.length?Math.round(rows.reduce((s,r)=>s+Number(r.trainingPct||0),0)/rows.length):0}
function sumField(rows,key){return rows.reduce((s,r)=>s+Number(r[key]||0),0)}
function kpis(rows){
  const total=rows.length;
  const makkah=rows.filter(r=>r.city==='مكة').length,jeddah=rows.filter(r=>r.city==='جدة').length;
  const saudis=rows.filter(r=>r.nationality==='سعودي').length;
  const company=rows.filter(isCompany).length;
  const assignedCars=rows.filter(r=>vehicleState(r)==='سيارة مسلمة').length;
  const needCars=rows.filter(r=>vehicleState(r)==='يحتاج سيارة').length;
  const valid=rows.filter(r=>r.cardStatus==='سارية').length;
  const soon=rows.filter(r=>String(r.cardStatus).includes('أوشكت')).length;
  const expired=rows.filter(r=>r.cardStatus==='انتهت').length;
  const noCard=rows.filter(r=>r.cardStatus==='لا يوجد').length;
  const in30=rows.filter(r=>{const d=num(r.cardDays);return d!==null&&d>=0&&d<=30}).length;
  const trainingFull=rows.filter(r=>Number(r.trainingPct)>=100).length;
  const trainingIncomplete=rows.filter(r=>Number(r.trainingPct)<100).length;
  const leaveObtained=rows.filter(r=>clean(r.electricityLeave)&&!['لا','غير مطلوبة'].includes(clean(r.electricityLeave))).length;
  const required=sumField(rows,'trainingRequired'),completed=sumField(rows,'trainingCompleted');
  const unavailable=sumField(rows,'trainingUnavailable'),booked=sumField(rows,'trainingBooked');
  const scheduled=sumField(rows,'trainingScheduled'),pending=sumField(rows,'trainingPendingAcademy');
  const availableNotBooked=sumField(rows,'trainingAvailableNotBooked');
  return [
    ['إجمالي الكادر',total,'primary','موظف'],
    ['مكة',makkah,'primary',pct(makkah,total)+'%'],
    ['جدة',jeddah,'primary',pct(jeddah,total)+'%'],
    ['السعوديون',saudis,'primary',pct(saudis,total)+'%'],
    ['على كفالة أبعاد الرؤية',company,'primary',pct(company,total)+'%'],
    ['سيارات مسلمة',assignedCars,'primary','يحتاج '+needCars],
    ['بطاقات سارية',valid,'ok',pct(valid,total)+'%'],
    ['قاربت على الانتهاء',soon,'warn','تنبيه'],
    ['بطاقات منتهية',expired,'bad','إجراء عاجل'],
    ['بدون بطاقة',noCard,'bad','إجراء مطلوب'],
    ['تنتهي خلال 30 يوم',in30,'warn','من السارية'],
    ['شهادة الإجازة من الكهرباء',leaveObtained,'primary',pct(leaveObtained,total)+'% من الكادر'],
    ['مكتملو التدريب 100%',trainingFull,'ok',pct(trainingFull,total)+'%'],
    ['غير مكتملين تدريبياً',trainingIncomplete,trainingIncomplete?'warn':'ok',pct(trainingIncomplete,total)+'%'],
    ['متوسط اكتمال التدريب',avgTraining(rows)+'%','primary','للفلاتر الحالية'],
    ['إجمالي الدورات المطلوبة',required,'primary','متطلبات تدريب'],
    ['الدورات المنجزة',completed,'ok',required?pct(completed,required)+'% من المطلوب':'0%'],
    ['الدورات المحجوزة',booked,'primary','متاح وتم الحجز'],
    ['الدورات المجدولة',scheduled,'primary','لها موعد'],
    ['تحت جدولة الأكاديمية',pending,'warn','مسجلة ومدفوعة'],
    ['غير متاح حجزها',unavailable,unavailable?'warn':'ok','عدم توفر/متطلب سابق'],
    ['متاحة ولم يتم حجزها',availableNotBooked,availableNotBooked?'bad':'ok','تحتاج إجراء']
  ];
}

function renderShell(rows){
  const f=state.filters;
  const roles=state.rows.filter(r=>f.city==='الكل'||r.city===f.city).map(r=>r.role);
  return '<div class="hr-wrap">'+
    '<section class="hr-hero">'+
      '<div><span>HUMAN RESOURCES • UNIFIED STAFF MATRIX</span><h2>الموارد البشرية للكادر</h2>'+
      '<p>تحليل موحد لكادر مشروعي مكة وجدة — البطاقات، التدريب، الوظائف، الكفالة والسيارات.</p></div>'+
      '<div class="hr-hero-meta"><small>آخر قراءة</small><b>'+esc(state.updatedAt||EMPTY)+'</b></div>'+
    '</section>'+
    '<section class="hr-filter-panel">'+
      '<div class="hr-filter-grid">'+
        '<label><span>المدينة</span><select id="hrCity">'+optionList(['مكة','جدة'],f.city)+'</select></label>'+
        '<label><span>الوظيفة</span><select id="hrRole">'+optionList(roles,f.role)+'</select></label>'+
        '<label><span>حالة البطاقة</span><select id="hrCard">'+optionList(state.rows.map(r=>r.cardStatus),f.card)+'</select></label>'+
        '<label><span>الكفالة</span><select id="hrSponsor">'+optionList(['أبعاد الرؤية','غير أبعاد الرؤية'],f.sponsor)+'</select></label>'+
        '<label><span>السعودة</span><select id="hrNationality">'+optionList(state.rows.map(r=>r.nationality),f.nationality)+'</select></label>'+
        '<label><span>اكتمال التدريب</span><select id="hrTraining">'+optionList(['مكتمل 100%','75% - 99%','50% - 74%','أقل من 50%'],f.training)+'</select></label>'+
        '<label><span>السيارة</span><select id="hrVehicle">'+optionList(['سيارة مسلمة','يحتاج سيارة','سيارة خاصة','لا يحتاج','غير محدد'],f.vehicle)+'</select></label>'+
        '<label class="hr-search"><span>بحث شامل</span><input id="hrSearch" value="'+esc(f.search)+'" placeholder="اسم، كود، وظيفة، بطاقة..."></label>'+
      '</div>'+
      '<div class="hr-filter-actions"><button id="hrReset" class="ghost-btn">مسح الفلاتر</button><button id="hrRefresh" class="primary-btn">↻ تحديث البيانات</button><strong>'+rows.length+' موظف مطابق</strong></div>'+
    '</section>'+
    '<section class="hr-section-head"><div><span>EXECUTIVE KPIs</span><h3>المؤشرات التنفيذية</h3></div><p>جميع المؤشرات تتغير مباشرة مع الفلاتر.</p></section>'+
    '<div class="hr-kpis">'+kpis(rows).map(c=>'<article class="hr-kpi '+c[2]+'"><span>'+esc(c[0])+'</span><strong>'+esc(c[1])+'</strong><small>'+esc(c[3])+'</small></article>').join('')+'</div>'+
    '<section class="hr-section-head"><div><span>ANALYTICS</span><h3>التحليل البياني</h3></div><p>قراءة سريعة لتكوين الكادر وجاهزيته.</p></section>'+
    '<div class="hr-charts">'+
      chartBox('hrCityChart','توزيع الكادر حسب المدينة','CITY MIX')+
      chartBox('hrRoleChart','توزيع الوظائف','ROLE MIX','wide')+
      chartBox('hrSponsorChart','الكفالة','SPONSORSHIP')+
      chartBox('hrCardChart','حالة بطاقات الأمن الصناعي','SECURITY CARDS')+
      chartBox('hrExpiryChart','شرائح انتهاء البطاقات','EXPIRY RISK')+
      chartBox('hrTrainingChart','مستوى اكتمال التدريب','TRAINING READINESS')+
      chartBox('hrTrainingPipelineChart','موقف الدورات التدريبية','TRAINING PIPELINE','wide')+
      chartBox('hrMissingCourseChart','أكثر الدورات نقصًا','TRAINING GAPS','wide')+
      chartBox('hrCityTrainingChart','مقارنة التدريب بين مكة وجدة','CITY TRAINING','wide')+
      chartBox('hrQualificationChart','توزيع المؤهلات','QUALIFICATIONS')+
      chartBox('hrVehicleChart','حالة السيارات','VEHICLES')+
      chartBox('hrLeaveChart','شهادة الإجازة من الكهرباء','ELECTRICITY CLEARANCE')+
    '</div>'+
    renderAlerts(rows)+
    renderCitySummary(rows)+
    renderRoleSummary(rows)+
    renderMainTable(rows)+
  '</div>';
}
function chartBox(id,title,sub,extra){
  return '<article class="panel hr-chart '+(extra||'')+'"><div class="panel-title"><span>'+sub+'</span><h3>'+title+'</h3></div><div class="hr-canvas-wrap"><canvas id="'+id+'"></canvas></div></article>';
}

function renderAlerts(rows){
  const cardRows=rows.filter(r=>['منتهية','لا يوجد'].includes(r.cardStatus)||String(r.cardStatus).includes('أوشكت')||(num(r.cardDays)!==null&&num(r.cardDays)<=60))
    .sort((a,b)=>(num(a.cardDays)??9999)-(num(b.cardDays)??9999)).slice(0,12);
  const trainingRows=rows.filter(r=>Number(r.trainingPct)<100).sort((a,b)=>Number(a.trainingPct)-Number(b.trainingPct)).slice(0,12);
  const cardTable=cardRows.length?'<table class="hr-mini-table"><thead><tr><th>الموظف</th><th>المدينة</th><th>الحالة</th><th>المتبقي</th></tr></thead><tbody>'+
    cardRows.map(r=>'<tr><td><b>'+esc(r.name)+'</b><small>'+esc(r.role)+'</small></td><td>'+esc(r.city)+'</td><td><span class="hr-status '+clsCard(r.cardStatus)+'">'+esc(r.cardStatus)+'</span></td><td>'+esc(r.cardDays||EMPTY)+'</td></tr>').join('')+'</tbody></table>':'<div class="hr-empty">لا توجد تنبيهات بطاقات ضمن الفلاتر الحالية.</div>';
  const trainingTable=trainingRows.length?'<table class="hr-mini-table"><thead><tr><th>الموظف</th><th>المدينة</th><th>الاكتمال</th><th>ناقص</th></tr></thead><tbody>'+
    trainingRows.map(r=>'<tr><td><b>'+esc(r.name)+'</b><small>'+esc(r.role)+'</small></td><td>'+esc(r.city)+'</td><td><b>'+esc(r.trainingPct)+'%</b></td><td>'+esc((r.missingCourses||[]).length)+'</td></tr>').join('')+'</tbody></table>':'<div class="hr-empty">جميع الموظفين المطابقين مكتملو التدريب.</div>';
  return '<section class="hr-section-head"><div><span>ACTION CENTER</span><h3>مركز التنبيهات والإجراءات</h3></div><p>الأولوية للبطاقات والتدريب غير المكتمل.</p></section>'+
    '<div class="hr-alert-grid"><article class="panel"><div class="panel-title"><span>CARD ALERTS</span><h3>بطاقات تحتاج متابعة</h3></div>'+cardTable+'</article>'+
    '<article class="panel"><div class="panel-title"><span>TRAINING ALERTS</span><h3>أقل الموظفين اكتمالًا في التدريب</h3></div>'+trainingTable+'</article></div>';
}
function renderCitySummary(rows){
  const cities=['مكة','جدة'];
  const body=cities.map(city=>{
    const a=rows.filter(r=>r.city===city);
    const expired=a.filter(r=>r.cardStatus==='انتهت').length;
    const noCard=a.filter(r=>r.cardStatus==='لا يوجد').length;
    const full=a.filter(r=>Number(r.trainingPct)>=100).length;
    const saudis=a.filter(r=>r.nationality==='سعودي').length;
    const cars=a.filter(r=>vehicleState(r)==='سيارة مسلمة').length;
    return '<tr><td><b>'+city+'</b></td><td>'+a.length+'</td><td>'+saudis+'</td><td>'+expired+'</td><td>'+noCard+'</td><td>'+avgTraining(a)+'%</td><td>'+full+'</td><td>'+cars+'</td></tr>';
  }).join('');
  return '<section class="hr-section-head"><div><span>CITY SUMMARY</span><h3>مقارنة تشغيلية بين مكة وجدة</h3></div></section>'+
    '<article class="panel"><div class="table-wrap"><table class="hr-summary-table"><thead><tr><th>المدينة</th><th>الكادر</th><th>سعوديون</th><th>بطاقات منتهية</th><th>بدون بطاقة</th><th>متوسط التدريب</th><th>مكتمل 100%</th><th>سيارات مسلمة</th></tr></thead><tbody>'+body+'</tbody></table></div></article>';
}

function renderRoleSummary(rows){
  const roles=unique(rows.map(r=>r.role));
  const body=roles.map(role=>{
    const mm=rows.filter(r=>r.role===role&&r.city==='مكة').length;
    const jj=rows.filter(r=>r.role===role&&r.city==='جدة').length;
    return '<tr><td><b>'+esc(role)+'</b></td><td>'+mm+'</td><td>'+jj+'</td><td><b>'+(mm+jj)+'</b></td></tr>';
  }).join('');
  return '<section class="hr-section-head"><div><span>ROLE SUMMARY</span><h3>ملخص الكادر حسب الوظيفة</h3></div></section>'+
    '<article class="panel"><div class="table-wrap"><table class="hr-summary-table"><thead><tr><th>الوظيفة</th><th>مكة</th><th>جدة</th><th>الإجمالي</th></tr></thead><tbody>'+body+'</tbody></table></div></article>';
}
function renderMainTable(rows){
  return '<section class="hr-section-head"><div><span>STAFF DETAILS</span><h3>التفاصيل الكاملة للكادر</h3></div><p>تم استبعاد الرواتب والتواجد الفعلي حسب طلب الإدارة.</p></section>'+
    '<article class="panel"><div class="panel-head"><div class="panel-title"><span>DETAIL LIST</span><h3>بيانات الكادر المطابقة للفلاتر</h3></div><b>'+rows.length+'</b></div>'+
    '<div class="table-wrap large"><table class="hr-table"><thead><tr>'+
    '<th>الكود</th><th>الاسم</th><th>المدينة</th><th>المشروع</th><th>الوظيفة</th><th>الكفالة</th><th>السعودة</th><th>المؤهل</th><th>حالة البطاقة</th><th>تاريخ الانتهاء</th><th>الأيام</th><th>السيارة</th><th>إجازة الكهرباء</th><th>نسبة التدريب</th><th>مطلوبة</th><th>منجزة</th><th>محجوزة</th><th>مجدولة</th><th>غير متاحة</th><th>تحت جدولة الأكاديمية</th><th>متاحة ولم تحجز</th><th>الدورات الناقصة</th>'+
    '</tr></thead><tbody>'+rows.map(r=>'<tr>'+
      '<td>'+esc(r.code)+'</td><td><b>'+esc(r.name)+'</b><small>'+esc(r.nameEn)+'</small></td><td>'+esc(r.city)+'</td><td>'+esc(r.project)+'</td><td>'+esc(r.role)+'</td>'+
      '<td>'+esc(r.sponsorship)+'</td><td>'+esc(r.nationality)+'</td><td>'+esc(r.qualification)+'</td>'+
      '<td><span class="hr-status '+clsCard(r.cardStatus)+'">'+esc(r.cardStatus||EMPTY)+'</span></td><td>'+esc(r.cardExpiry||EMPTY)+'</td><td>'+esc(r.cardDays||EMPTY)+'</td><td>'+esc(r.vehicle||EMPTY)+'</td>'+
      '<td>'+esc(r.electricityLeave||EMPTY)+'</td>'+
      '<td><div class="hr-progress"><span><i style="width:'+Math.max(0,Math.min(100,Number(r.trainingPct||0)))+'%"></i></span><b>'+esc(r.trainingPct)+'%</b><small>'+esc(r.trainingCompleted)+'/'+esc(r.trainingRequired)+'</small></div></td>'+
      '<td>'+esc(r.trainingRequired)+'</td><td>'+esc(r.trainingCompleted)+'</td><td>'+esc(r.trainingBooked)+'</td><td>'+esc(r.trainingScheduled)+'</td><td>'+esc(r.trainingUnavailable)+'</td><td>'+esc(r.trainingPendingAcademy)+'</td><td>'+esc(r.trainingAvailableNotBooked)+'</td>'+
      '<td class="hr-missing">'+esc((r.missingCourses||[]).join('، ')||'مكتمل')+'</td></tr>').join('')+'</tbody></table></div></article>';
}

function bind(){
  const map={hrCity:'city',hrRole:'role',hrCard:'card',hrSponsor:'sponsor',hrNationality:'nationality',hrTraining:'training',hrVehicle:'vehicle'};
  Object.entries(map).forEach(([id,key])=>{
    const el=document.getElementById(id);if(el)el.onchange=()=>{state.filters[key]=el.value;render()};
  });
  const search=document.getElementById('hrSearch');
  if(search)search.oninput=()=>{state.filters.search=search.value;render();setTimeout(()=>{const n=document.getElementById('hrSearch');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},0)};
  document.getElementById('hrReset')?.addEventListener('click',()=>{
    state.filters={city:CFG.defaultCity,role:'الكل',card:'الكل',sponsor:'الكل',nationality:'الكل',training:'الكل',vehicle:'الكل',search:''};render();
  });
  document.getElementById('hrRefresh')?.addEventListener('click',()=>load(true));
}
function chart(id,type,labels,data,options){
  const canvas=document.getElementById(id);if(!canvas||typeof Chart==='undefined')return;
  state.charts[id]=new Chart(canvas,{type,data:{labels,datasets:data},options:Object.assign({
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{family:'Cairo',size:9}}}},
    scales:(type==='doughnut'||type==='pie')?{}:{x:{ticks:{font:{family:'Cairo',size:8}},grid:{display:false}},y:{ticks:{font:{family:'Cairo',size:8}},grid:{color:'rgba(120,130,150,.12)'}}}
  },options||{})});
}
function renderCharts(rows){
  const city=countBy(rows,r=>r.city);
  chart('hrCityChart','doughnut',Object.keys(city),[{data:Object.values(city)}],{cutout:'64%'});

  const roles=Object.entries(countBy(rows,r=>r.role)).sort((a,b)=>b[1]-a[1]).slice(0,12);
  chart('hrRoleChart','bar',roles.map(x=>x[0]),[{label:'عدد الموظفين',data:roles.map(x=>x[1])}],{indexAxis:'y',plugins:{legend:{display:false}}});

  const sponsor={'أبعاد الرؤية':rows.filter(isCompany).length,'جهات أخرى':rows.filter(r=>!isCompany(r)).length};
  chart('hrSponsorChart','doughnut',Object.keys(sponsor),[{data:Object.values(sponsor)}],{cutout:'64%'});

  const cards=countBy(rows,r=>r.cardStatus||'غير محدد');
  chart('hrCardChart','doughnut',Object.keys(cards),[{data:Object.values(cards)}],{cutout:'64%'});

  const bands=['منتهية','0 - 30 يوم','31 - 60 يوم','أكثر من 60 يوم','لا يوجد'];
  const exp=countBy(rows,expiryBand);
  chart('hrExpiryChart','bar',bands,[{label:'الموظفون',data:bands.map(x=>exp[x]||0)}],{plugins:{legend:{display:false}}});

  const tBands=['مكتمل 100%','75% - 99%','50% - 74%','أقل من 50%'];
  const tb=countBy(rows,trainingBand);
  chart('hrTrainingChart','bar',tBands,[{label:'الموظفون',data:tBands.map(x=>tb[x]||0)}],{plugins:{legend:{display:false}}});

  const pipelineLabels=['الدورات المطلوبة','المنجزة','المحجوزة','المجدولة','تحت جدولة الأكاديمية','غير متاح حجزها','متاحة ولم تحجز'];
  const pipelineValues=[
    sumField(rows,'trainingRequired'),sumField(rows,'trainingCompleted'),sumField(rows,'trainingBooked'),
    sumField(rows,'trainingScheduled'),sumField(rows,'trainingPendingAcademy'),
    sumField(rows,'trainingUnavailable'),sumField(rows,'trainingAvailableNotBooked')
  ];
  chart('hrTrainingPipelineChart','bar',pipelineLabels,[{label:'عدد الدورات',data:pipelineValues}],{plugins:{legend:{display:false}}});

  const missing={};rows.forEach(r=>(r.missingCourses||[]).forEach(c=>missing[c]=(missing[c]||0)+1));
  const miss=Object.entries(missing).sort((a,b)=>b[1]-a[1]).slice(0,12);
  chart('hrMissingCourseChart','bar',miss.length?miss.map(x=>x[0]):['لا توجد دورات ناقصة'],[{label:'عدد الموظفين الناقص لديهم',data:miss.length?miss.map(x=>x[1]):[0]}],{indexAxis:'y',plugins:{legend:{display:false}}});

  const cities=['مكة','جدة'];
  const allCityRows={مكة:state.rows.filter(r=>r.city==='مكة'),جدة:state.rows.filter(r=>r.city==='جدة')};
  chart('hrCityTrainingChart','bar',cities,[
    {label:'متوسط اكتمال التدريب %',data:cities.map(c=>avgTraining(allCityRows[c]))},
    {label:'مكتملون 100% %',data:cities.map(c=>pct(allCityRows[c].filter(r=>Number(r.trainingPct)>=100).length,allCityRows[c].length))}
  ],{scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%',font:{family:'Cairo',size:8}}},x:{ticks:{font:{family:'Cairo',size:9}},grid:{display:false}}}});

  const quals=Object.entries(countBy(rows,r=>r.qualification)).sort((a,b)=>b[1]-a[1]).slice(0,10);
  chart('hrQualificationChart','bar',quals.map(x=>x[0]),[{label:'عدد الموظفين',data:quals.map(x=>x[1])}],{indexAxis:'y',plugins:{legend:{display:false}}});

  const vehicles=countBy(rows,vehicleState);
  chart('hrVehicleChart','doughnut',Object.keys(vehicles),[{data:Object.values(vehicles)}],{cutout:'64%'});

  const leave={
    'حاصل':rows.filter(r=>clean(r.electricityLeave)&&!['لا','غير مطلوبة'].includes(clean(r.electricityLeave))).length,
    'غير حاصل':rows.filter(r=>clean(r.electricityLeave)==='لا').length,
    'غير مطلوبة':rows.filter(r=>clean(r.electricityLeave)==='غير مطلوبة'||!clean(r.electricityLeave)).length
  };
  chart('hrLeaveChart','doughnut',Object.keys(leave),[{data:Object.values(leave)}],{cutout:'64%'});
}
function render(){
  const host=root();if(!host)return;
  destroyCharts();
  const rows=filtered();
  host.innerHTML=renderShell(rows);
  bind();
  requestAnimationFrame(()=>renderCharts(rows));
}
async function load(force=false){
  const host=root();if(host&&!state.loaded)host.innerHTML='<div class="hr-loading"><div class="spinner"></div><b>جاري تحميل وتحليل بيانات الكادر...</b></div>';
  try{
    const r=await fetch('/api/hr/staff'+(force?'?t='+Date.now():''));
    const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'تعذر تحميل البيانات');
    state.rows=j.rows||[];state.courses=j.courses||[];state.updatedAt=j.updatedAt||'';state.loaded=true;render();
  }catch(e){if(host)host.innerHTML='<div class="hr-error">'+esc(e.message||e)+'</div>'}
}
function activate(){
  if(typeof S!=='undefined')S.current='hrStaff';
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page==='hrStaff'));
  ['masterPage','meetingPage','dataPage','importantLinksPage'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
  document.getElementById('hrStaffPage')?.classList.add('active');
  const fb=document.getElementById('filterBar');if(fb)fb.style.display='none';
  const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='none';
  const title=document.getElementById('pageTitle');if(title)title.textContent='الموارد البشرية للكادر';
  load(false);
}
if(typeof openPage==='function'){
  const previous=openPage;
  openPage=function(key){
    if(key==='hrStaff'){activate();return}
    document.getElementById('hrStaffPage')?.classList.remove('active');
    const fb=document.getElementById('filterBar');if(fb)fb.style.display='';
    const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='';
    return previous(key);
  };
}
})();