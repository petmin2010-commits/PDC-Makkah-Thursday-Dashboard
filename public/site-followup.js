(function(){
'use strict';

const SF={charts:{},supportRows:null,supportLoading:false};
const t=v=>String(v??'').replace(/\s+/g,' ').trim();
const e=v=>t(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number(v||0).toLocaleString('ar-SA');
const pct=(a,b)=>b?((a/b)*100).toFixed(1)+'%':'—';
const has=(v,s)=>t(v).toLowerCase().includes(String(s).toLowerCase());
const uniq=(rows,key)=>new Set(rows.map(r=>t(r[key])).filter(Boolean)).size;

function parseDate(v){
  const s=t(v); if(!s)return null;
  let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(m){const d=new Date(+m[1],+m[2]-1,+m[3]);return isNaN(d)?null:d}
  m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if(m){
    const a=+m[1],b=+m[2],y=+m[3]; let mo,da;
    if(b>12){mo=a;da=b}else if(a>12){da=a;mo=b}else{mo=a;da=b}
    const d=new Date(y,mo-1,da); return isNaN(d)?null:d;
  }
  const d=new Date(s); return isNaN(d)?null:d;
}
function dkey(d){return d?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):''}
let _nowCache={ts:0,value:null};
function riyadhNow(){
  const stamp=Date.now();if(_nowCache.value&&stamp-_nowCache.ts<30000)return _nowCache.value;
  const dateParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const timeParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const o={}; dateParts.forEach(p=>o[p.type]=p.value); timeParts.forEach(p=>o[p.type]=p.value);
  const value={key:o.year+'-'+o.month+'-'+o.day,minutes:(+o.hour||0)*60+(+o.minute||0)};_nowCache={ts:stamp,value};return value;
}
function dayLabel(k){
  if(!k)return '—';
  const [y,m,d]=k.split('-').map(Number);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(y,m-1,d));
}
function rowDateKey(r){if(Object.prototype.hasOwnProperty.call(r,'_sfDateKey'))return r._sfDateKey;return r._sfDateKey=dkey(parseDate(r.date))}
function due(r){
  const k=rowDateKey(r); if(!k)return false;
  const now=riyadhNow();
  return k<now.key || (k===now.key && now.minutes>=990); // 16:30 Riyadh
}
function statementPresent(r){return !!t(r.statement)}
function noWork(r){
  const s=t(r.statement).toLowerCase();
  if(!s)return false;
  return /(no\s*work|no\s*answer|لم يتم العمل|لم يتم البدء|لم يبدأ|لم يباشر|تأجيل|التأجيل|التاجيل|مؤجل|تم التأجيل|تم التاجيل|عدم وجود|لا يوجد عمل|عدم توفر|عدم تواجد)/i.test(s);
}
function productive(r){return statementPresent(r)&&!noWork(r)}
function primaryUploaded(r){const s=t(r.attachments);return s.includes('تم رفع مرفقات')||s==='تم الرفع'||s==='مرفوع'}
function primaryPending(r){return has(r.attachments,'لم يتم رفع')}
function resolved(r){const s=t(r.resolved);return s.includes('تم')||s.includes('لا يحتاج')}
function supportUploaded(r){
  const s=t(r.status);
  return !!s && !s.includes('لم') && (s.includes('تم')||s.includes('رفع')||s.includes('مكتمل'));
}
function supportMap(rows){
  const m=new Map();
  (rows||[]).forEach(r=>{const w=t(r.workOrder);if(!w)return;(m.get(w)||m.set(w,[]).get(w)).push(r)});
  return m;
}
function group(rows,key,fn){
  const m=new Map();
  rows.forEach(r=>{const x=fn?fn(r):(t(r[key])||'غير محدد');m.set(x,(m.get(x)||0)+1)});
  return [...m].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'ar'));
}
function root(){
  let x=document.getElementById('siteFollowupAnalytics'); if(x)return x;
  const g=document.getElementById('genericPageCharts'); if(!g)return null;
  x=document.createElement('section'); x.id='siteFollowupAnalytics'; x.className='sf-root';
  g.parentNode.insertBefore(x,g); return x;
}
function destroy(){Object.values(SF.charts).forEach(c=>{try{c.destroy()}catch{}});SF.charts={}}
function draw(id,type,labels,datasets,options={}){
  const c=document.getElementById(id); if(!c)return;
  if(SF.charts[id]){try{SF.charts[id].destroy()}catch{}}
  SF.charts[id]=new Chart(c,{type,data:{labels,datasets},options:Object.assign({
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{position:'bottom',labels:{usePointStyle:true,font:{family:'Cairo',size:8}}}}
  },options)});
}
function card(label,value,sub='',tone=''){
  return '<article class="sf-card '+(tone?'sf-'+tone:'')+'"><span>'+e(label)+'</span><strong>'+e(value)+'</strong><small>'+e(sub)+'</small></article>';
}
function chart(id,title,sub,wide=false){
  return '<article class="panel sf-chart '+(wide?'sf-wide':'')+'"><div class="panel-title"><span>'+e(sub)+'</span><h3>'+e(title)+'</h3></div><div class="sf-chart-box"><canvas id="'+id+'"></canvas></div></article>';
}
function latestDay(rows){
  const keys=rows.map(rowDateKey).filter(Boolean).sort();
  const today=riyadhNow().key;
  const key=keys.includes(today)?today:(keys.length?keys[keys.length-1]:'');
  return {key,rows:key?rows.filter(r=>rowDateKey(r)===key):[],isToday:key===today};
}
function exactDuplicateCount(rows){
  const seen=new Set();let n=0;
  rows.forEach(r=>{const k=[t(r.workOrder),rowDateKey(r),t(r.task),t(r.engineer),t(r.location)].join('|').toLowerCase();if(!k.replace(/\|/g,''))return;if(seen.has(k))n++;else seen.add(k)});
  return n;
}
function multiTaskWorkOrders(rows){
  const m=new Map();
  rows.forEach(r=>{const k=t(r.workOrder)+'|'+rowDateKey(r);if(!t(r.workOrder)||!rowDateKey(r))return;(m.get(k)||m.set(k,new Set()).get(k)).add(t(r.task))});
  return [...m.values()].filter(s=>s.size>1).length;
}
function readiness(rows,key,label){
  const g=Object.fromEntries(group(rows,key));
  return {ready:g['جاهز']||0,notReady:g['غير جاهز']||0,noNeed:g['لا يحتاج']||0,blank:g['غير محدد']||g['']||0,label};
}
function attachmentSupport(rows){
  const filteredWos=new Set(rows.map(r=>t(r.workOrder)).filter(Boolean));
  return (SF.supportRows||[]).filter(r=>filteredWos.has(t(r.workOrder)));
}
function mismatchInfo(rows){
  const map=supportMap(attachmentSupport(rows)),primary=new Map();
  rows.forEach(r=>{
    const w=t(r.workOrder);if(!w)return;
    let x=primary.get(w);if(!x){x={row:r,uploaded:false,pending:false};primary.set(w,x)}
    if(primaryUploaded(r))x.uploaded=true;if(primaryPending(r))x.pending=true;
  });
  const out=[];
  for(const [w,x] of primary){
    const support=map.get(w)||[],secUploaded=support.some(supportUploaded);let issue='';
    if(x.uploaded&&!support.length)issue='مرفوع في الإفادات ولا يوجد سجل بورقة المرفقات';
    else if(x.pending&&secUploaded)issue='الإفادات تقول غير مرفوع بينما ورقة المرفقات بها رفع';
    if(issue)out.push({workOrder:w,contractor:t(x.row.contractor),engineer:t(x.row.engineer),issue,supportStatus:support.map(z=>t(z.status)).filter(Boolean).join(' / ')});
  }
  return out;
}
function actionScore(r,smap){
  let s=0,why=[];
  if(due(r)&&!statementPresent(r)){s+=5;why.push('إفادة مستحقة')}
  if(noWork(r)){s+=3;why.push('تأجيل/لا يوجد عمل')}
  if(due(r)&&primaryPending(r)){s+=3;why.push('مرفقات غير مرفوعة')}
  if(due(r)&&primaryPending(r)&&!resolved(r)){s+=3;why.push('مشكلة مرفقات مفتوحة')}
  if(t(r.readiness203)==='غير جاهز'){s+=1;why.push('203 غير جاهز')}
  if(t(r.readiness190)==='غير جاهز'){s+=1;why.push('190 غير جاهز')}
  if(!t(r.coordinates)){s+=1;why.push('بدون إحداثيات')}
  if(due(r)&&!t(r.endTime)){s+=1;why.push('وقت الانتهاء ناقص')}
  const support=smap.get(t(r.workOrder))||[];
  if(primaryUploaded(r)&&!support.length){s+=2;why.push('رفع غير مطابق')}
  if(primaryPending(r)&&support.some(supportUploaded)){s+=2;why.push('تعارض المرفقات')}
  return {score:s,why:why.join('، ')};
}
function actionTable(rows){
  const smap=supportMap(attachmentSupport(rows));
  const a=rows.map(r=>({r,...actionScore(r,smap)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(rowDateKey(b.r)).localeCompare(rowDateKey(a.r))).slice(0,50);
  if(!a.length)return '<div class="sf-empty">لا توجد عناصر تحتاج تدخلًا ضمن الفلاتر الحالية.</div>';
  return '<div class="sf-table-wrap"><table><thead><tr><th>أولوية</th><th>التاريخ</th><th>أمر العمل</th><th>المهمة</th><th>الموقع</th><th>مسؤول الموقع</th><th>المقاول</th><th>الإفادة</th><th>المرفقات</th><th>سبب التنبيه</th></tr></thead><tbody>'+
    a.map(x=>'<tr><td><b class="sf-score">'+x.score+'</b></td><td>'+e(x.r.date)+'</td><td>'+e(x.r.workOrder)+'</td><td>'+e(x.r.task)+'</td><td>'+e(x.r.location)+'</td><td>'+e(x.r.engineer)+'</td><td>'+e(x.r.contractor)+'</td><td>'+e(statementPresent(x.r)?(noWork(x.r)?'تأجيل/لا يوجد عمل':'وردت'):(due(x.r)?'مستحقة':'منتظرة'))+'</td><td>'+e(x.r.attachments)+'</td><td>'+e(x.why)+'</td></tr>').join('')+
    '</tbody></table></div>';
}
function currentDayTable(rows,latest){
  const a=latest.rows.slice().sort((a,b)=>t(a.engineer).localeCompare(t(b.engineer),'ar')||t(a.location).localeCompare(t(b.location),'ar'));
  if(!a.length)return '<div class="sf-empty">لا توجد مهام في اليوم التشغيلي المحدد.</div>';
  return '<div class="sf-table-wrap"><table><thead><tr><th>أمر العمل</th><th>المهمة</th><th>الموقع</th><th>المسؤول</th><th>المقاول</th><th>التواجد</th><th>الانتهاء</th><th>الإفادة</th><th>203</th><th>190</th><th>المرفقات</th></tr></thead><tbody>'+
    a.map(r=>'<tr><td>'+e(r.workOrder)+'</td><td>'+e(r.task)+'</td><td>'+e(r.location)+'</td><td>'+e(r.engineer)+'</td><td>'+e(r.contractor)+'</td><td>'+e(r.attendance)+'</td><td>'+e(r.endTime)+'</td><td class="sf-statement">'+e(statementPresent(r)?(noWork(r)?'تأجيل/لا يوجد عمل':t(r.statement)):(due(r)?'⚠ مستحقة ولم تسجل':'بانتظار الإفادة'))+'</td><td>'+e(r.readiness203)+'</td><td>'+e(r.readiness190)+'</td><td>'+e(r.attachments)+'</td></tr>').join('')+
    '</tbody></table></div>';
}
function engineerTable(rows){
  const m=new Map();
  rows.forEach(r=>{
    const k=t(r.engineer)||'غير محدد';
    let x=m.get(k);if(!x){x={name:k,total:0,due:0,statements:0,noWork:0,uploaded:0,sites:new Set(),last:''};m.set(k,x)}
    x.total++;if(due(r))x.due++;if(due(r)&&statementPresent(r))x.statements++;if(noWork(r))x.noWork++;if(primaryUploaded(r))x.uploaded++;if(t(r.location))x.sites.add(t(r.location));const dk=rowDateKey(r);if(dk>x.last)x.last=dk;
  });
  const a=[...m.values()].sort((a,b)=>b.total-a.total);
  return '<div class="sf-table-wrap"><table><thead><tr><th>مسؤول الموقع</th><th>المهام</th><th>المواقع</th><th>إفادات مستحقة</th><th>وردت</th><th>الالتزام</th><th>تأجيل/لا عمل</th><th>مرفقات مرفوعة</th><th>آخر نشاط</th></tr></thead><tbody>'+
   a.map(x=>'<tr><td>'+e(x.name)+'</td><td>'+fmt(x.total)+'</td><td>'+fmt(x.sites.size)+'</td><td>'+fmt(x.due)+'</td><td>'+fmt(x.statements)+'</td><td>'+pct(x.statements,x.due)+'</td><td>'+fmt(x.noWork)+'</td><td>'+fmt(x.uploaded)+'</td><td>'+e(dayLabel(x.last))+'</td></tr>').join('')+
   '</tbody></table></div>';
}
function contractorTable(rows){
  const m=new Map();
  rows.forEach(r=>{
    const k=t(r.contractor)||'غير محدد';let x=m.get(k);if(!x){x={name:k,total:0,noWork:0,pending:0,open:0,sites:new Set(),wos:new Set()};m.set(k,x)}
    x.total++;if(noWork(r))x.noWork++;if(due(r)&&primaryPending(r))x.pending++;if(primaryPending(r)&&!resolved(r))x.open++;if(t(r.location))x.sites.add(t(r.location));if(t(r.workOrder))x.wos.add(t(r.workOrder));
  });
  const a=[...m.values()].sort((a,b)=>b.total-a.total);
  return '<div class="sf-table-wrap"><table><thead><tr><th>المقاول</th><th>المهام</th><th>أوامر العمل</th><th>المواقع</th><th>تأجيل/لا عمل</th><th>معدل التعثر</th><th>مرفقات مستحقة</th><th>مشكلات رفع مفتوحة</th></tr></thead><tbody>'+
   a.map(x=>'<tr><td>'+e(x.name)+'</td><td>'+fmt(x.total)+'</td><td>'+fmt(x.wos.size)+'</td><td>'+fmt(x.sites.size)+'</td><td>'+fmt(x.noWork)+'</td><td>'+pct(x.noWork,x.total)+'</td><td>'+fmt(x.pending)+'</td><td>'+fmt(x.open)+'</td></tr>').join('')+
   '</tbody></table></div>';
}
function reconcileTable(rows){
  if(SF.supportRows===null)return '<div class="sf-empty">جاري تحميل ورقة المرفقات المساندة...</div>';
  const a=mismatchInfo(rows);
  if(!a.length)return '<div class="sf-empty">لا توجد تعارضات ظاهرة بين الإفادات وورقة المرفقات ضمن الفلاتر الحالية.</div>';
  return '<div class="sf-table-wrap"><table><thead><tr><th>أمر العمل</th><th>المقاول</th><th>مسؤول الموقع</th><th>التعارض</th><th>حالة ورقة المرفقات</th></tr></thead><tbody>'+
    a.slice(0,60).map(x=>'<tr><td>'+e(x.workOrder)+'</td><td>'+e(x.contractor)+'</td><td>'+e(x.engineer)+'</td><td>'+e(x.issue)+'</td><td>'+e(x.supportStatus||'لا يوجد سجل')+'</td></tr>').join('')+
    '</tbody></table></div>';
}
function loadSupport(){
  if(SF.supportRows!==null||SF.supportLoading)return;
  SF.supportLoading=true;
  google.script.run.withSuccessHandler(p=>{
    SF.supportLoading=false;SF.supportRows=Array.isArray(p?.rows)?p.rows:[];
    if(S.current==='tasks')render(Array.isArray(S.filtered)?S.filtered:[]);
  }).withFailureHandler(()=>{SF.supportLoading=false;SF.supportRows=[];if(S.current==='tasks')render(Array.isArray(S.filtered)?S.filtered:[])}).getPageData('attachments');
}
function render(rows){
  const x=root();if(!x)return;destroy();loadSupport();
  const now=riyadhNow(),latest=latestDay(rows),eligible=rows.filter(due);
  const statements=eligible.filter(statementPresent),missing=eligible.filter(r=>!statementPresent(r));
  const noWorkRows=rows.filter(noWork),productiveRows=rows.filter(productive);
  const latestStatements=latest.rows.filter(statementPresent).length,latestNoWork=latest.rows.filter(noWork).length,latestUploaded=latest.rows.filter(primaryUploaded).length;
  const latestPending=latest.rows.filter(r=>!statementPresent(r)).length;
  const uploaded=rows.filter(primaryUploaded).length,pendingAttach=rows.filter(r=>due(r)&&primaryPending(r)).length,openAttach=rows.filter(r=>due(r)&&primaryPending(r)&&!resolved(r)).length;
  const attendance=rows.filter(r=>t(r.attendance)).length,endTime=rows.filter(r=>t(r.endTime)).length,fullAttendance=rows.filter(r=>t(r.attendance)&&t(r.endTime)).length;
  const r203=readiness(rows,'readiness203','203'),r190=readiness(rows,'readiness190','190');
  const q={coords:rows.filter(r=>!t(r.coordinates)).length,supervisor:rows.filter(r=>!t(r.contractorSupervisor)).length,phone:rows.filter(r=>!t(r.contractorPhone)).length,end:eligible.filter(r=>!t(r.endTime)).length,engineer:rows.filter(r=>!t(r.engineer)).length,location:rows.filter(r=>!t(r.location)).length,statement:missing.length,source:rows.filter(r=>!t(r.source)).length};
  const support=attachmentSupport(rows),supportWos=new Set(support.map(r=>t(r.workOrder)).filter(Boolean)).size,mismatch=mismatchInfo(rows).length;
  const qualityChecks=rows.length*5,qualityGood=Math.max(0,qualityChecks-(q.coords+q.supervisor+q.phone+q.engineer+q.location));
  const qualityRate=qualityChecks?pct(qualityGood,qualityChecks):'—';

  x.innerHTML=
  '<section class="sf-hero"><div><span>SITE OPERATIONS CONTROL ROOM</span><h2>متابعة أعمال المواقع</h2><p>المصدر الأساسي: ورقة «📌المهام والافادات»؛ ورقة المرفقات تستخدم للمطابقة والتحقق. الإفادة تصبح مستحقة بعد 4:30 م بتوقيت السعودية في تاريخ المهمة.</p></div><div class="sf-hero-badge"><span>'+(latest.isToday?'تشغيل اليوم':'آخر يوم ضمن الفلاتر')+'</span><strong>'+e(dayLabel(latest.key))+'</strong><small>'+fmt(latest.rows.length)+' مهمة</small></div></section>'+
  '<section class="sf-groups">'+
   '<div class="sf-group"><h3>تشغيل '+(latest.isToday?'اليوم':'آخر يوم مسجل')+'</h3><div>'+
    card('المهام',fmt(latest.rows.length),'السجلات المخططة/الميدانية','blue')+
    card('أوامر العمل',fmt(uniq(latest.rows,'workOrder')),'فريدة')+
    card('المواقع',fmt(uniq(latest.rows,'location')),'مواقع نشطة')+
    card('مسؤولو المواقع',fmt(uniq(latest.rows,'engineer')),'أفراد نشطون')+
    card('المقاولون',fmt(uniq(latest.rows,'contractor')),'مقاولون نشطون')+
    card('الإفادات الواردة',fmt(latestStatements),pct(latestStatements,latest.rows.length),'green')+
    card('بانتظار الإفادة',fmt(latestPending),latest.isToday&&now.minutes<990?'لم يحل موعد 4:30 م بعد':'تحتاج متابعة',latest.isToday&&now.minutes<990?'amber':'red')+
    card('مرفقات مرفوعة',fmt(latestUploaded),pct(latestUploaded,latest.rows.length),'green')+
    card('تأجيل / لا يوجد عمل',fmt(latestNoWork),pct(latestNoWork,latest.rows.length),latestNoWork?'amber':'green')+
   '</div></div>'+
   '<div class="sf-group"><h3>الالتزام بالإفادات والإنتاج الميداني</h3><div>'+
    card('المهام المستحقة',fmt(eligible.length),'حتى موعد الإفادة')+
    card('إفادات مستلمة',fmt(statements.length),pct(statements.length,eligible.length),'green')+
    card('مستحق بلا إفادة',fmt(missing.length),pct(missing.length,eligible.length),missing.length?'red':'green')+
    card('نسبة الالتزام',pct(statements.length,eligible.length),'الإفادات ÷ المهام المستحقة',missing.length?'amber':'green')+
    card('إفادة بدون تعثر',fmt(productiveRows.length),pct(productiveRows.length,rows.filter(statementPresent).length),'green')+
    card('تأجيل / لا يوجد عمل',fmt(noWorkRows.length),pct(noWorkRows.length,rows.filter(statementPresent).length),noWorkRows.length?'amber':'green')+
    card('متوسط المهام/مسؤول',uniq(latest.rows,'engineer')?(latest.rows.length/uniq(latest.rows,'engineer')).toFixed(1):'—','في اليوم التشغيلي')+
   '</div></div>'+
   '<div class="sf-group"><h3>المرفقات والمعالجة — ربط المصدرين</h3><div>'+
    card('تم رفع مرفقات',fmt(uploaded),pct(uploaded,rows.length),'green')+
    card('غير مرفوعة ومستحقة',fmt(pendingAttach),pct(pendingAttach,eligible.length),pendingAttach?'red':'green')+
    card('مشكلات رفع مفتوحة',fmt(openAttach),'لم يتم رفع + غير معالجة',openAttach?'red':'green')+
    card('أوامر موثقة بورقة المرفقات',fmt(supportWos),'مطابقة على رقم أمر العمل')+
    card('تعارض بين الورقتين',fmt(mismatch),'يحتاج مراجعة',mismatch?'amber':'green')+
   '</div></div>'+
   '<div class="sf-group"><h3>جاهزية الموقع والحضور</h3><div>'+
    card('203 — جاهز',fmt(r203.ready),pct(r203.ready,rows.length),'green')+
    card('203 — غير جاهز',fmt(r203.notReady),pct(r203.notReady,rows.length),r203.notReady?'amber':'green')+
    card('190 — جاهز',fmt(r190.ready),pct(r190.ready,rows.length),'green')+
    card('190 — غير جاهز',fmt(r190.notReady),pct(r190.notReady,rows.length),r190.notReady?'amber':'green')+
    card('وقت التواجد مسجل',fmt(attendance),pct(attendance,rows.length))+
    card('وقت الانتهاء مسجل',fmt(endTime),pct(endTime,rows.length))+
    card('سجل حضور مكتمل',fmt(fullAttendance),pct(fullAttendance,rows.length),fullAttendance<rows.length?'amber':'green')+
   '</div></div>'+
   '<div class="sf-group"><h3>التغطية التشغيلية</h3><div>'+
    card('إجمالي المهام',fmt(rows.length),'ضمن الفلاتر الحالية','blue')+
    card('أوامر العمل الفريدة',fmt(uniq(rows,'workOrder'))) +
    card('أنواع المهام',fmt(uniq(rows,'task'))) +
    card('المواقع',fmt(uniq(rows,'location'))) +
    card('مسؤولو المواقع',fmt(uniq(rows,'engineer'))) +
    card('المقاولون',fmt(uniq(rows,'contractor'))) +
    card('أوامر متعددة المهام/اليوم',fmt(multiTaskWorkOrders(rows)),'ليست تكرارًا بالضرورة')+
    card('تكرار مطابق محتمل',fmt(exactDuplicateCount(rows)),'أمر + تاريخ + مهمة + مسؤول + موقع',exactDuplicateCount(rows)?'amber':'green')+
   '</div></div>'+
   '<div class="sf-group"><h3>جودة بيانات الموقع</h3><div>'+
    card('اكتمال البيانات الأساسية',qualityRate,'الموقع/المسؤول/الإحداثيات/مشرف المقاول/الجوال',qualityRate==='100.0%'?'green':'amber')+
    card('بدون إحداثيات',fmt(q.coords),'K فارغ',q.coords?'amber':'green')+
    card('بدون مشرف مقاول',fmt(q.supervisor),'L فارغ',q.supervisor?'amber':'green')+
    card('بدون جوال مشرف',fmt(q.phone),'M فارغ',q.phone?'amber':'green')+
    card('بدون وقت انتهاء — مستحق',fmt(q.end),'O فارغ للمهام المستحقة',q.end?'amber':'green')+
    card('بدون مسؤول موقع',fmt(q.engineer),'Q فارغ',q.engineer?'red':'green')+
    card('بدون موقع',fmt(q.location),'J فارغ',q.location?'red':'green')+
    card('بدون مصدر',fmt(q.source),'U فارغ',q.source?'amber':'green')+
   '</div></div>'+
  '</section>'+
  '<section class="sf-charts">'+
    chart('sfDaily','الاتجاه اليومي — آخر 21 يوم تشغيل','المهام / الإفادات / المرفقات / التعثر',true)+
    chart('sfOutcome','نتيجة المتابعة الميدانية','الإفادة')+
    chart('sfEngineer','التزام الإفادات حسب مسؤول الموقع — أعلى 12','Q × T',true)+
    chart('sfContractor','التعثر حسب المقاول — أعلى 12','H × T',true)+
    chart('sfTask','أكثر المهام تكرارًا','I')+
    chart('sfLocation','أكثر المواقع نشاطًا','J')+
    chart('sfSource','مصدر التكليف','U')+
    chart('sfAttachments','حالة المرفقات في ورقة الإفادات','V')+
    chart('sf203','جاهزية 203','R')+
    chart('sf190','جاهزية 190','S')+
    chart('sfQuality','نواقص جودة بيانات الموقع','K/L/M/O/Q/J/U',true)+
    chart('sfLatestLoad','عبء العمل في اليوم التشغيلي حسب المسؤول','Q',true)+
    chart('sfSupport','التحقق من ورقة المرفقات المساندة','مطابقة أمر العمل',true)+
  '</section>'+
  '<section class="sf-tables">'+
   '<article class="panel sf-table"><div class="panel-title"><span>ACTION CENTER</span><h3>قائمة التدخل والأولوية</h3></div>'+actionTable(rows)+'</article>'+
   '<article class="panel sf-table"><div class="panel-title"><span>DAILY FIELD BOARD</span><h3>مهام '+e(dayLabel(latest.key))+'</h3></div>'+currentDayTable(rows,latest)+'</article>'+
   '<article class="panel sf-table"><div class="panel-title"><span>SITE TEAM PERFORMANCE</span><h3>أداء مسؤولي المواقع</h3></div>'+engineerTable(rows)+'</article>'+
   '<article class="panel sf-table"><div class="panel-title"><span>CONTRACTOR PERFORMANCE</span><h3>أداء المقاولين ميدانيًا</h3></div>'+contractorTable(rows)+'</article>'+
   '<article class="panel sf-table"><div class="panel-title"><span>ATTACHMENT RECONCILIATION</span><h3>مطابقة الإفادات مع ورقة المرفقات</h3></div>'+reconcileTable(rows)+'</article>'+
  '</section>';

  const days=new Map();
  rows.forEach(r=>{const k=rowDateKey(r);if(!k)return;let z=days.get(k);if(!z){z={total:0,statements:0,uploaded:0,noWork:0};days.set(k,z)}z.total++;if(statementPresent(r))z.statements++;if(primaryUploaded(r))z.uploaded++;if(noWork(r))z.noWork++});
  const da=[...days].sort((a,b)=>a[0].localeCompare(b[0])).slice(-21);
  draw('sfDaily','line',da.map(x=>x[0]),[
    {label:'المهام',data:da.map(x=>x[1].total),borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,.08)',tension:.25},
    {label:'الإفادات',data:da.map(x=>x[1].statements),borderColor:'#16a34a',tension:.25},
    {label:'المرفقات',data:da.map(x=>x[1].uploaded),borderColor:'#7c3aed',tension:.25},
    {label:'تأجيل/لا عمل',data:da.map(x=>x[1].noWork),borderColor:'#f59e0b',tension:.25}
  ],{scales:{y:{beginAtZero:true}}});

  const dueMissing=missing.length,notDue=rows.filter(r=>!due(r)&&!statementPresent(r)).length;
  draw('sfOutcome','doughnut',['إفادة بدون تعثر','تأجيل / لا عمل','مستحق بلا إفادة','لم يحل موعده'],[{data:[productiveRows.length,noWorkRows.length,dueMissing,notDue],backgroundColor:['#16a34a','#f59e0b','#dc2626','#94a3b8']}]);

  const eng=group(rows,'engineer').slice(0,12).map(x=>x[0]);
  draw('sfEngineer','bar',eng,[
    {label:'إفادة مستلمة',data:eng.map(k=>rows.filter(r=>(t(r.engineer)||'غير محدد')===k&&due(r)&&statementPresent(r)).length),backgroundColor:'#16a34a',stack:'x'},
    {label:'مستحق بلا إفادة',data:eng.map(k=>rows.filter(r=>(t(r.engineer)||'غير محدد')===k&&due(r)&&!statementPresent(r)).length),backgroundColor:'#dc2626',stack:'x'}
  ],{indexAxis:'y',scales:{x:{stacked:true,beginAtZero:true},y:{stacked:true}}});

  const con=group(rows,'contractor').slice(0,12).map(x=>x[0]);
  draw('sfContractor','bar',con,[
    {label:'إفادة بدون تعثر',data:con.map(k=>rows.filter(r=>(t(r.contractor)||'غير محدد')===k&&productive(r)).length),backgroundColor:'#16a34a',stack:'x'},
    {label:'تأجيل/لا عمل',data:con.map(k=>rows.filter(r=>(t(r.contractor)||'غير محدد')===k&&noWork(r)).length),backgroundColor:'#f59e0b',stack:'x'},
    {label:'مستحق بلا إفادة',data:con.map(k=>rows.filter(r=>(t(r.contractor)||'غير محدد')===k&&due(r)&&!statementPresent(r)).length),backgroundColor:'#dc2626',stack:'x'}
  ],{indexAxis:'y',scales:{x:{stacked:true,beginAtZero:true},y:{stacked:true}}});

  const task=group(rows,'task').slice(0,12),loc=group(rows,'location').slice(0,12),src=group(rows,'source').slice(0,8),att=group(rows,'attachments').slice(0,8);
  draw('sfTask','bar',task.map(x=>x[0]),[{label:'المهام',data:task.map(x=>x[1]),backgroundColor:'#2563eb'}],{indexAxis:'y'});
  draw('sfLocation','bar',loc.map(x=>x[0]),[{label:'المهام',data:loc.map(x=>x[1]),backgroundColor:'#0891b2'}],{indexAxis:'y'});
  draw('sfSource','doughnut',src.map(x=>x[0]),[{data:src.map(x=>x[1]),backgroundColor:['#2563eb','#7c3aed','#16a34a','#f59e0b','#64748b']}]);
  draw('sfAttachments','doughnut',att.map(x=>x[0]),[{data:att.map(x=>x[1]),backgroundColor:['#16a34a','#dc2626','#2563eb','#f59e0b','#64748b']}]);
  draw('sf203','doughnut',['جاهز','غير جاهز','لا يحتاج','غير محدد'],[{data:[r203.ready,r203.notReady,r203.noNeed,rows.length-r203.ready-r203.notReady-r203.noNeed],backgroundColor:['#16a34a','#f59e0b','#2563eb','#cbd5e1']}]);
  draw('sf190','doughnut',['جاهز','غير جاهز','لا يحتاج','غير محدد'],[{data:[r190.ready,r190.notReady,r190.noNeed,rows.length-r190.ready-r190.notReady-r190.noNeed],backgroundColor:['#16a34a','#f59e0b','#2563eb','#cbd5e1']}]);
  draw('sfQuality','bar',['إحداثيات','مشرف مقاول','جوال المشرف','وقت الانتهاء','مسؤول الموقع','الموقع','المصدر','إفادة مستحقة'],[{label:'سجلات ناقصة',data:[q.coords,q.supervisor,q.phone,q.end,q.engineer,q.location,q.source,q.statement],backgroundColor:'#f59e0b'}],{indexAxis:'y'});

  const ldEng=group(latest.rows,'engineer').slice(0,15);
  draw('sfLatestLoad','bar',ldEng.map(x=>x[0]),[{label:'مهام اليوم التشغيلي',data:ldEng.map(x=>x[1]),backgroundColor:'#2563eb'}],{indexAxis:'y'});

  if(SF.supportRows===null){
    draw('sfSupport','bar',['جاري التحميل'],[{label:'',data:[0],backgroundColor:'#cbd5e1'}]);
  }else{
    const filteredSupport=attachmentSupport(rows);
    const anyComponents=filteredSupport.some(r=>['photos','safetyForms','supervisionForms','assetTests','asbuilt','other'].some(k=>t(r[k])));
    if(anyComponents){
      const comps=[['الصور','photos'],['السلامة','safetyForms'],['الإشراف','supervisionForms'],['اختبارات الأصول','assetTests'],['As-built','asbuilt'],['أخرى','other']];
      draw('sfSupport','bar',comps.map(x=>x[0]),[{label:'سجلات بها بيانات',data:comps.map(x=>filteredSupport.filter(r=>t(r[x[1]])).length),backgroundColor:'#7c3aed'}],{indexAxis:'y'});
    }else{
      const sg=group(filteredSupport,'status').slice(0,10);
      draw('sfSupport','bar',sg.map(x=>x[0]),[{label:'أوامر/سجلات',data:sg.map(x=>x[1]),backgroundColor:'#7c3aed'}],{indexAxis:'y'});
    }
  }
}
function sync(){
  const x=root();if(!x)return;
  const on=typeof S!=='undefined'&&S.current==='tasks';x.style.display=on?'block':'none';
  const g=document.getElementById('genericPageCharts'),p=document.getElementById('executionPhaseAnalytics'),k=document.getElementById('pageKpis');
  if(on){
    if(g)g.style.display='none';if(p)p.style.display='none';if(k)k.style.display='none';
    const names={engineer:'مسؤول الموقع',contractor:'المقاول',source:'المصدر',attachments:'حالة المرفقات',task:'وصف المهمة'};
    (S.filterKeys||[]).slice(0,5).forEach((f,i)=>{const lab=document.getElementById('fl'+(i+1));if(lab&&names[f])lab.textContent=names[f]});
    render(Array.isArray(S.filtered)?S.filtered:[]);
  }else{destroy()}
}
if(typeof renderDataPage==='function'){const base=renderDataPage;renderDataPage=function(){base.apply(this,arguments);sync()}}
if(typeof openPage==='function'){const baseOpen=openPage;openPage=function(key){if(key==='attachments')key='tasks';return baseOpen(key)}}
})();