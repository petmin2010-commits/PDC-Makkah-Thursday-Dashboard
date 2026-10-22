(()=>{
let emergencyLoading=false,meetingLoading=false;
const el=id=>document.getElementById(id),norm=v=>String(v||'').trim().replace(/\s*\/\s*/g,'/'),pct=(n,t)=>(t?Math.round(n/t*1000)/10:0)+'% من الإجمالي';

function meetingDocumentsFirstHtml(rows,total,pct,fmt,esc){
 const norm=v=>String(v==null?'':v).trim().replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ');
 const yesNo=v=>norm(v).replace(/[أإآ]/g,'ا');
 const docReceived=rows.filter(r=>norm(r.docsStatus)==='تم الاستلام من المقاول');
 const docMissing=rows.filter(r=>norm(r.docsStatus)==='لم يتم الاستلام من المقاول');
 const docOther=rows.filter(r=>!['تم الاستلام من المقاول','لم يتم الاستلام من المقاول'].includes(norm(r.docsStatus)));
 const documentGroups=[
  {label:'تم الاستلام من المقاول',rows:docReceived,css:'bf-received'},
  {label:'لم يتم الاستلام من المقاول',rows:docMissing,css:'bf-not-received'}
 ];
 if(docOther.length)documentGroups.push({label:'حالة مستندات غير محددة',rows:docOther,css:'bf-unspecified'});
 const card=(css,label,n)=>'<article class="kpi-story-card '+css+'"><span>'+esc(label)+'</span><strong>'+fmt(n)+'</strong><small>'+pct(n,total)+'</small></article>';
 const contractor155=items=>{
  const received=items.filter(r=>yesNo(r.contractor155Status)==='نعم').length;
  const notReceived=items.filter(r=>yesNo(r.contractor155Status)==='لا').length;
  const unknown=items.length-received-notReceived;
  const cards=card('ak-uds-card','مستلم 155 للمقاول',received)+card('ak-uds-card','غير مستلم 155 للمقاول',notReceived);
  const note=unknown?'<p class="ak-uds-unknown">حالات 155 غير محددة: '+fmt(unknown)+'</p>':'';
  return '<div class="ak-uds-children">'+cards+'</div>'+note;
 };
 const anomaly155Html=items=>{
  // Count only AK=yes among BF=not received; parent filters execution=completed.
  const yesCount=items.filter(r=>yesNo(r.contractor155Status)==='نعم').length;
  const label='فحص إدخال 155 بدون مستندات على UDS';
  return '<div class="kpi-story-greatgrandchildren bg-level anomaly-155-level">'+
   '<div class="bg-state-node anomaly-155-node">'+card('kpi-story-greatgrandchild anomaly-155-card',label,yesCount)+'</div></div>';
 };
 const bgHtml=items=>{
  const groups=new Map();
  items.forEach(r=>{
   const label=norm(r.docsSubStatus)||'غير محدد';
   if(!groups.has(label))groups.set(label,[]);
   groups.get(label).push(r);
  });
  if(!groups.size)return '';
  // Display sequence matches approved Jeddah tree irrespective of item counts.
  // Reordered for presentation only: row membership, values, and totals are unchanged.
  const rank=label=>{
   const name=norm(label).toLowerCase();
   if(/معاد[ةه]?\s+للمقاول/.test(name))return 0;
   if(/قيد\s+مراجعة\s+الاستشاري/.test(name))return 1;
   if(/قيد\s+مراجعة\s*(?:ال\s*)?pdc/.test(name))return 2;
   if(/^تم\s+الرفع\s*\(\s*uds\s*\)$/.test(name))return 4;
   return 3; // All unexpected source states remain visible before the UDS node.
  };
  const sortedStates=Array.from(groups.entries()).sort((a,b)=>rank(a[0])-rank(b[0])||b[1].length-a[1].length);
  return '<div class="kpi-story-greatgrandchildren bg-level">'+
   sortedStates.map(([label,group])=>
    '<div class="bg-state-node">'+card('kpi-story-greatgrandchild',label,group.length)+
    (norm(label)==='تم الرفع (UDS)'?contractor155(group):'')+'</div>'
   ).join('')+'</div>';
 };
 return '<div class="kpi-story-children bf-level docs-first-level">'+
  documentGroups.map(group=>'<div class="kpi-story-child-node '+group.css+'">'+
   card('kpi-story-child',group.label,group.rows.length)+(group.css==='bf-not-received'?anomaly155Html(group.rows):bgHtml(group.rows))+'</div>').join('')+'</div>';
}

function meetingTreeHtml(rows){
 const total=rows.length,done=rows.filter(r=>norm(r.executionRaw)==='تم التنفيذ'),not=rows.filter(r=>norm(r.executionRaw)==='لم يتم التنفيذ');
 const stopped=rows.filter(r=>['موقوف/محول','متوقف/محول','موقوف','محول','متوقف'].includes(norm(r.executionRaw)));
 const docsFirstCompletedHtml=meetingDocumentsFirstHtml(done,total,pct,fmt,esc);
 const count=(arr,key)=>{const m={};arr.forEach(r=>{const x=String(r[key]||'غير محدد').trim()||'غير محدد';m[x]=(m[x]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])};
 const bc=count(not,'nonExecutionStatus');
 const bcHtml=(bc.length?bc:[['غير محدد',0]]).map(([x,n])=>'<article class="kpi-story-card kpi-story-child"><span>'+esc(x)+'</span><strong>'+fmt(n)+'</strong><small>'+pct(n,total)+'</small></article>').join('');
 const jeddah=String(document.querySelector('.brand-copy strong')?.textContent||'').includes('جدة'),toContractor=jeddah?' للمقاول':' المقاول',stoppedLabel='موقوف/محول';
 return '<div class="kpi-story target-tree"><article class="kpi-story-card kpi-story-root"><span>إجمالي أوامر العمل</span><strong>'+fmt(total)+'</strong><small>100% من إجمالي الأوامر</small></article><div class="kpi-story-level1"><section class="kpi-story-node completed"><article class="kpi-story-card"><span>تم التنفيذ</span><strong>'+fmt(done.length)+'</strong><small>'+pct(done.length,total)+'</small></article>'+docsFirstCompletedHtml+'</section><section class="kpi-story-node incomplete"><article class="kpi-story-card"><span>لم يتم التنفيذ</span><strong>'+fmt(not.length)+'</strong><small>'+pct(not.length,total)+'</small></article><div class="kpi-story-children bc-level">'+bcHtml+'</div></section><section class="kpi-story-node stopped"><article class="kpi-story-card"><span>'+stoppedLabel+'</span><strong>'+fmt(stopped.length)+'</strong><small>'+pct(stopped.length,total)+'</small></article></section></div></div>';
}
function renderEmergencyCopy(rows){const x=el('closuresEmergencyTree');if(x&&typeof renderEmergencyStatusTree==='function'){x.innerHTML='';renderEmergencyStatusTree(Array.isArray(rows)?rows:[],x,false)}}
function renderMeetingCopy(){const x=el('closuresMeetingTree');if(x)x.innerHTML=meetingTreeHtml(Array.isArray(S?.meetingRows)?S.meetingRows:[])}
function loadEmergency(){const c=S?.pageCache?.emergency;if(c?.rows){renderEmergencyCopy(c.rows);return}if(emergencyLoading)return;emergencyLoading=true;google.script.run.withSuccessHandler(p=>{emergencyLoading=false;if(S?.pageCache)S.pageCache.emergency=p||{rows:[]};if(S.current==='closures')renderEmergencyCopy(p?.rows||[])}).withFailureHandler(()=>{emergencyLoading=false;const x=el('closuresEmergencyTree');if(x)x.innerHTML='<div class="empty">تعذر تحميل شجرة الطوارئ</div>'}).getPageData('emergency')}
function loadMeeting(){if(S?.meeting){renderMeetingCopy();return}if(meetingLoading)return;meetingLoading=true;google.script.run.withSuccessHandler(p=>{meetingLoading=false;S.meeting=p||{rows:[]};S.meetingRows=Array.isArray(S.meeting.rows)?S.meeting.rows:[];if(S.current==='closures')renderMeetingCopy()}).withFailureHandler(()=>{meetingLoading=false;const x=el('closuresMeetingTree');if(x)x.innerHTML='<div class="empty">تعذر تحميل شجرة اجتماع الـ PDC</div>'}).getWednesdayMeetingData()}
function ensure(){const s=el('closuresCopiedTreesSection'),a=el('closuresArchiveSection');if(!s)return;const on=S?.current==='closures';s.style.display=on?'block':'none';if(a){a.style.display=on?'block':'none';if(on){const f=el('closuresArchiveFrame');if(f&&!f.src)f.src=f.dataset.src||''}}if(!on)return;const m=el('closuresMeetingTree'),e=el('closuresEmergencyTree');if(m&&!m.innerHTML.trim())m.innerHTML='<div class="empty">جاري تحميل شجرة اجتماع الـ PDC...</div>';if(e&&!e.innerHTML.trim())e.innerHTML='<div class="empty">جاري تحميل شجرة الطوارئ...</div>';loadMeeting();loadEmergency()}
if(typeof openPage==='function'){const previous=openPage;openPage=function(key){const out=previous(key),s=el('closuresCopiedTreesSection'),a=el('closuresArchiveSection');if(s)s.style.display=key==='closures'?'block':'none';if(a)a.style.display=key==='closures'?'block':'none';if(key==='closures')setTimeout(ensure,0);return out}}
window.renderClosuresCopiedTrees=ensure;
})();