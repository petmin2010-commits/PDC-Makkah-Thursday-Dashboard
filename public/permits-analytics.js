(function(){
'use strict';
const P={charts:{}};
const t=v=>String(v??'').replace(/\s+/g,' ').trim();
const e=v=>t(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>{const m=t(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
const pct=x=>x==null?'—':`${(x*100).toFixed(x>=1?0:1)}%`;
const has=(a,b)=>t(a).includes(b);
const eq=(a,b)=>t(a)===b;
const uniq=(rows,k)=>new Set(rows.map(x=>t(x[k])).filter(Boolean)).size;
function dte(v){
 const s=t(v);if(!s)return null;
 let m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);
 m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
 if(m){
   const a=+m[1],b=+m[2],y=+m[3];
   if(b>12)return new Date(y,a-1,b);
   if(a>12)return new Date(y,b-1,a);
   return new Date(y,b-1,a);
 }
 if(typeof parseDashboardDate==='function'){const d=parseDashboardDate(s);if(d&&!isNaN(d))return d}
 const d=new Date(s);return isNaN(d)?null:d;
}
const daysBetween=(a,b)=>{const x=dte(a),y=dte(b);return x&&y?Math.round((y-x)/86400000):null};
const daysFromToday=v=>{const d=dte(v);if(!d)return null;const z=new Date();z.setHours(0,0,0,0);d.setHours(0,0,0,0);return Math.round((d-z)/86400000)};
function permitBucket(z){
 const s=t(z.permitStatus);
 if(!s)return'غير محدد';
 if(s==='لا يتطلب')return'لا يتطلب';
 if(s.includes('تم اصدار'))return'تم إصدار التصريح';
 if(s.includes('لم يتم ادخال'))return'لم يتم إدخال التصريح';
 if(s.includes('قيد التنسيق'))return'قيد التنسيق والاعتماد';
 if(s.includes('بانتظار السداد'))return'بانتظار السداد';
 if(s.includes('رفض'))return'رفض / انتهاء التنسيق';
 if(s==='ملغي')return'ملغي';
 if(s.includes('مدن'))return'تصريح مدن فقط';
 return s;
}
function evalBucket(z){
 const s=t(z.evaluation);
 if(s.includes('متأخر جدا'))return'متأخر جدًا';
 if(s.includes('متأخر (3'))return'متأخر';
 if(s.includes('غير متأخر'))return'غير متأخر';
 return s||'غير محدد';
}
function actionYes(z){const s=t(z.actionTaken).toLowerCase();return s==='true'||s==='نعم'||s==='تم'||s==='yes'}
function isPending(z){return ['لم يتم إدخال التصريح','قيد التنسيق والاعتماد','بانتظار السداد','غير محدد'].includes(permitBucket(z))}
function isRejected(z){return ['رفض / انتهاء التنسيق','ملغي'].includes(permitBucket(z))}
function isIssued(z){return permitBucket(z)==='تم إصدار التصريح'}
function group(rows,k,fn=x=>t(x[k])||'غير محدد'){const m={};rows.forEach(x=>{const a=fn(x);m[a]=(m[a]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function avg(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
function root(){let x=document.getElementById('permitsAdvancedAnalytics');if(x)return x;const a=document.getElementById('genericPageCharts');if(!a)return null;x=document.createElement('section');x.id='permitsAdvancedAnalytics';a.parentNode.insertBefore(x,a);return x}
function destroy(){Object.values(P.charts).forEach(x=>{try{x.destroy()}catch{}});P.charts={}}
function draw(id,type,labels,datasets,extra={}){const el=document.getElementById(id);if(!el)return;P.charts[id]=new Chart(el,{type,data:{labels,datasets},options:Object.assign({responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,font:{family:'Cairo',size:8}}}}},extra)})}
function card(a,b,c='',tone=''){return `<article class="pe-card ${tone?'pe-'+tone:''}"><span>${e(a)}</span><strong>${typeof b==='number'?b.toLocaleString('ar-SA'):e(b)}</strong><small>${e(c)}</small></article>`}
function chart(id,title,sub,wide=false){return `<article class="panel pe-chart ${wide?'pe-wide':''}"><div class="panel-title"><span>${e(sub)}</span><h3>${e(title)}</h3></div><div class="pe-chart-box"><canvas id="${id}"></canvas></div></article>`}
function stacked(id,rows,key,bucketFn){const keys=group(rows,key).slice(0,10).map(x=>x[0]);const states=['تم إصدار التصريح','لا يتطلب','لم يتم إدخال التصريح','قيد التنسيق والاعتماد','بانتظار السداد','رفض / انتهاء التنسيق','ملغي','غير محدد'];draw(id,'bar',keys,states.map((s,i)=>({label:s,data:keys.map(k=>rows.filter(z=>(t(z[key])||'غير محدد')===k&&bucketFn(z)===s).length),backgroundColor:['#16a34a','#64748b','#dc2626','#f59e0b','#7c3aed','#ef4444','#991b1b','#cbd5e1'][i]})),{indexAxis:'y',scales:{x:{stacked:true,beginAtZero:true},y:{stacked:true}},plugins:{legend:{display:true,position:'bottom',labels:{usePointStyle:true,font:{family:'Cairo',size:7}}}}})}
function simple(id,rows,key,type='bar',limit=10,extra={},fn){const a=group(rows,key,fn).slice(0,limit);draw(id,type,a.map(x=>x[0]),[{label:'عدد الطلبات',data:a.map(x=>x[1]),backgroundColor:type==='bar'?'#2563eb':undefined}],extra)}
function score(z){
 let s=0;const ev=evalBucket(z),pb=permitBucket(z),days=n(z.days)||0;
 if(ev==='متأخر جدًا')s+=5;else if(ev==='متأخر')s+=3;
 if(pb==='لم يتم إدخال التصريح')s+=4;else if(pb==='قيد التنسيق والاعتماد')s+=3;else if(pb==='بانتظار السداد')s+=2;else if(pb==='غير محدد')s+=4;
 if(!actionYes(z)&&ev!=='غير متأخر')s+=3;
 if(days>=30&&isPending(z))s+=3;else if(days>=15&&isPending(z))s+=2;
 if(isRejected(z))s+=2;
 return s;
}
function pendingTable(rows){
 const a=rows.filter(z=>isPending(z)||isRejected(z)).sort((a,b)=>score(b)-score(a)||(n(b.days)||0)-(n(a.days)||0)).slice(0,25);
 if(!a.length)return'<div class="pe-empty">لا توجد طلبات تصريح عالقة ضمن الفلاتر الحالية.</div>';
 return `<div class="pe-wrap"><table><thead><tr><th>الأولوية</th><th>أمر العمل</th><th>المقاول</th><th>القسم</th><th>فئة العمل</th><th>حالة التصريح</th><th>الأيام منذ الإسناد</th><th>التقييم</th><th>إجراء/إنذار</th><th>ملاحظة القسم</th><th>ملاحظة التصريح</th></tr></thead><tbody>${a.map(z=>`<tr><td><b>${score(z)}</b></td><td>${e(z.workOrder)}</td><td>${e(z.contractor)}</td><td>${e(z.section)}</td><td>${e(z.category)}</td><td><span class="pe-pill">${e(permitBucket(z))}</span></td><td>${e(z.days)}</td><td>${e(evalBucket(z))}</td><td>${actionYes(z)?'نعم':'لا'}</td><td>${e(z.sectionNote)}</td><td>${e(z.permitNotes)}</td></tr>`).join('')}</tbody></table></div>`;
}
function expiryTable(rows){
 const a=rows.filter(isIssued).map(z=>({z,left:daysFromToday(z.permitEnd)})).filter(x=>x.left!=null&&x.left<=30).sort((a,b)=>a.left-b.left).slice(0,25);
 if(!a.length)return'<div class="pe-empty">لا توجد تصاريح منتهية أو قريبة الانتهاء ضمن الفلاتر الحالية.</div>';
 return `<div class="pe-wrap"><table><thead><tr><th>أمر العمل</th><th>المقاول</th><th>القسم</th><th>الموقع</th><th>بداية التصريح</th><th>نهاية التصريح</th><th>المتبقي</th><th>ملاحظات التصريح</th></tr></thead><tbody>${a.map(x=>`<tr><td>${e(x.z.workOrder)}</td><td>${e(x.z.contractor)}</td><td>${e(x.z.section)}</td><td>${e(x.z.location)}</td><td>${e(x.z.permitStart)}</td><td>${e(x.z.permitEnd)}</td><td><span class="pe-exp ${x.left<0?'bad':x.left<=7?'warn':''}">${x.left<0?'منتهي منذ '+Math.abs(x.left)+' يوم':x.left+' يوم'}</span></td><td>${e(x.z.permitNotes)}</td></tr>`).join('')}</tbody></table></div>`;
}
function render(rows){
 const x=root();if(!x)return;destroy();
 const total=rows.length,noReq=rows.filter(z=>permitBucket(z)==='لا يتطلب').length,issued=rows.filter(isIssued).length,pending=rows.filter(isPending).length,rejected=rows.filter(isRejected).length,other=total-noReq-issued-pending-rejected;
 const evOk=rows.filter(z=>evalBucket(z)==='غير متأخر').length,evLate=rows.filter(z=>evalBucket(z)==='متأخر').length,evSevere=rows.filter(z=>evalBucket(z)==='متأخر جدًا').length;
 const action=rows.filter(actionYes).length,noAction=total-action,delayed=rows.filter(z=>['متأخر','متأخر جدًا'].includes(evalBucket(z))),delayedNoAction=delayed.filter(z=>!actionYes(z)).length;
 const issuedRows=rows.filter(isIssued),endKnown=issuedRows.filter(z=>dte(z.permitEnd)),active=endKnown.filter(z=>(daysFromToday(z.permitEnd)??-1)>=0).length,expired=endKnown.filter(z=>(daysFromToday(z.permitEnd)??0)<0).length,exp7=endKnown.filter(z=>{const q=daysFromToday(z.permitEnd);return q!=null&&q>=0&&q<=7}).length,exp14=endKnown.filter(z=>{const q=daysFromToday(z.permitEnd);return q!=null&&q>=0&&q<=14}).length,missingEnd=issued-endKnown.length;
 const issueLags=issuedRows.map(z=>daysBetween(z.assignedDate,z.permitStart)).filter(v=>v!=null&&v>=0),validity=issuedRows.map(z=>{const q=daysBetween(z.permitStart,z.permitEnd);return q==null?null:q+1}).filter(v=>v!=null&&v>0);
 const issuedWithin=issuedRows.filter(z=>{const q=daysBetween(z.assignedDate,z.permitStart),dur=n(z.duration);return q!=null&&dur!=null&&q<=dur}).length;
 const issuedLate=issuedRows.filter(z=>{const q=daysBetween(z.assignedDate,z.permitStart),dur=n(z.duration);return q!=null&&dur!=null&&q>dur}).length;
 const pendingOverOfficial=rows.filter(z=>isPending(z)&&(n(z.days)||0)>(n(z.duration)||0)).length;
 const invalidDates=rows.filter(z=>{const a=dte(z.permitStart),b=dte(z.permitEnd);return a&&b&&b<a}).length;
 const missingStatus=rows.filter(z=>!t(z.permitStatus)).length,missingStartIssued=issuedRows.filter(z=>!dte(z.permitStart)).length,missingNotesPending=rows.filter(z=>isPending(z)&&!t(z.permitNotes)).length;
 const statuses=['تم إصدار التصريح','لا يتطلب','لم يتم إدخال التصريح','قيد التنسيق والاعتماد','بانتظار السداد','رفض / انتهاء التنسيق','ملغي','تصريح مدن فقط','غير محدد'];
 x.innerHTML=`<section class="pe-hero"><div><span>PERMITS CONTROL ROOM</span><h2>التحليل التنفيذي المتقدم للتصاريح</h2><p>قراءة مباشرة من «🧾التصاريح العام» A:T — الحالة، التأخير، الإجراء، زمن الإصدار وصلاحية التصريح.</p></div><b>${evSevere?evSevere+' طلب متأخر جدًا':expired?expired+' تصريح منتهي':'حالة التصاريح مستقرة ضمن الفلاتر الحالية'}</b></section>
 <section class="pe-groups">
  <div class="pe-group"><h3>ملخص التصاريح — N</h3><div>${card('إجمالي الطلبات',total)}${card('لا يتطلب تصريح',noReq,total?pct(noReq/total):'—','slate')}${card('تم إصدار التصريح',issued,total?pct(issued/total):'—','green')}${card('طلبات عالقة',pending,total?pct(pending/total):'—','amber')}${card('مرفوض / ملغي',rejected,'','red')}${card('حالات أخرى',other)}</div></div>
  <div class="pe-group"><h3>تفصيل حالة التصريح — N</h3><div>${statuses.map(s=>card(s,rows.filter(z=>permitBucket(z)===s).length,'',s==='تم إصدار التصريح'?'green':s==='لم يتم إدخال التصريح'||s==='رفض / انتهاء التنسيق'||s==='ملغي'?'red':s==='قيد التنسيق والاعتماد'||s==='بانتظار السداد'?'amber':'' )).join('')}</div></div>
  <div class="pe-group"><h3>تقييم الطلب — T</h3><div>${card('غير متأخر',evOk,total?pct(evOk/total):'—','green')}${card('متأخر 3 أيام',evLate,'','amber')}${card('متأخر جدًا 6 أيام+',evSevere,'','red')}${card('إجمالي المتأخر',evLate+evSevere,total?pct((evLate+evSevere)/total):'—','red')}${card('متأخر بلا إجراء',delayedNoAction,'R = لا','red')}</div></div>
  <div class="pe-group"><h3>الإجراء / الإنذار — R</h3><div>${card('تم اتخاذ اللازم',action,total?pct(action/total):'—','green')}${card('لم يتخذ إجراء',noAction,total?pct(noAction/total):'—')}${card('متأخر وتم اتخاذ إجراء',delayed.length-delayedNoAction,'','green')}${card('متأخر بدون إجراء',delayedNoAction,'','red')}${card('طلبات عالقة دون ملاحظة تصريح',missingNotesPending,'Q فارغ','amber')}</div></div>
  <div class="pe-group"><h3>صلاحية التصاريح — O / P</h3><div>${card('تصاريح سارية',active,'','green')}${card('تصاريح منتهية',expired,'','red')}${card('تنتهي خلال 7 أيام',exp7,'','amber')}${card('تنتهي خلال 14 يوم',exp14)}${card('صدر بدون تاريخ نهاية',missingEnd,'','red')}${card('متوسط مدة الصلاحية',avg(validity)==null?'—':avg(validity).toFixed(1)+' يوم')}</div></div>
  <div class="pe-group"><h3>سرعة إصدار التصريح — G / H / O</h3><div>${card('متوسط زمن الإصدار',avg(issueLags)==null?'—':avg(issueLags).toFixed(1)+' يوم','من الإسناد إلى بداية التصريح')}${card('صدر ضمن المدة الرسمية',issuedWithin,'','green')}${card('صدر بعد المدة الرسمية',issuedLate,'','red')}${card('عالق متجاوز المدة الرسمية',pendingOverOfficial,'S > H','red')}${card('متوسط الأيام منذ الإسناد',avg(rows.map(z=>n(z.days)).filter(v=>v!=null))?.toFixed(1)||'—','S')}</div></div>
  <div class="pe-group"><h3>التغطية التشغيلية</h3><div>${card('المقاولون',uniq(rows,'contractor'))}${card('الأقسام',uniq(rows,'section'))}${card('فئات العمل',uniq(rows,'category'))}${card('المواقع',uniq(rows,'location'))}${card('أنواع الأوامر',uniq(rows,'type'))}</div></div>
  <div class="pe-group"><h3>جودة البيانات</h3><div>${card('حالة تصريح غير محددة',missingStatus,'N فارغ','red')}${card('تصريح صادر بلا بداية',missingStartIssued,'O فارغ','red')}${card('تصريح صادر بلا نهاية',missingEnd,'P فارغ','red')}${card('نهاية قبل البداية',invalidDates,'P قبل O','red')}${card('طلب عالق بلا ملاحظة',missingNotesPending,'Q فارغ','amber')}</div></div>
 </section>
 <section class="pe-charts">
  ${chart('peStatus','توزيع حالات التصريح','N')}${chart('peEval','تقييم الطلب','T')}${chart('peAction','الإجراء / الإنذار','R')}${chart('peExpiry','صلاحية التصاريح الصادرة','O / P')}
  ${chart('peSection','الطلبات حسب القسم','K')}${chart('peCategory','الطلبات حسب فئة العمل','J')}${chart('peContractor','حالة التصريح حسب المقاول — أعلى 10','E × N',true)}${chart('peSectionStatus','حالة التصريح حسب القسم','K × N',true)}
  ${chart('peCategoryStatus','حالة التصريح حسب فئة العمل','J × N',true)}${chart('peTrend','اتجاه الإسناد والإصدار شهريًا','G / O',true)}
  ${chart('peIssueLag','زمن إصدار التصريح','G → O')}${chart('peValidity','مدة صلاحية التصريح','O → P')}${chart('pePendingAge','أعمار الطلبات العالقة','S')}${chart('peType','أكثر أنواع أوامر العمل','F')}
  ${chart('peLocation','أكثر المواقع بطلبات عالقة','I')}${chart('pePendingContractor','أكثر المقاولين بطلبات عالقة','E')}${chart('peEvalSection','التأخير حسب القسم','K × T',true)}
 </section>
 <section class="pe-actions"><article class="panel pe-table"><div class="panel-title"><span>ACTION PRIORITY</span><h3>طلبات التصاريح الأعلى أولوية للتدخل</h3></div>${pendingTable(rows)}</article><article class="panel pe-table"><div class="panel-title"><span>EXPIRY WATCH</span><h3>التصاريح المنتهية وقريبة الانتهاء</h3></div>${expiryTable(rows)}</article></section>`;
 draw('peStatus','doughnut',statuses,[{data:statuses.map(s=>rows.filter(z=>permitBucket(z)===s).length),backgroundColor:['#16a34a','#64748b','#dc2626','#f59e0b','#7c3aed','#ef4444','#991b1b','#0891b2','#cbd5e1']}]);
 draw('peEval','bar',['غير متأخر','متأخر','متأخر جدًا'],[{label:'الطلبات',data:[evOk,evLate,evSevere],backgroundColor:['#16a34a','#f59e0b','#dc2626']}]);
 draw('peAction','doughnut',['تم اتخاذ اللازم','لم يتخذ إجراء'],[{data:[action,noAction],backgroundColor:['#16a34a','#cbd5e1']}]);
 draw('peExpiry','doughnut',['ساري','منتهي','بدون تاريخ نهاية'],[{data:[active,expired,missingEnd],backgroundColor:['#16a34a','#dc2626','#cbd5e1']}]);
 simple('peSection',rows,'section','bar',8,{indexAxis:'y'});simple('peCategory',rows,'category','bar',10,{indexAxis:'y'});
 stacked('peContractor',rows,'contractor',permitBucket);stacked('peSectionStatus',rows,'section',permitBucket);stacked('peCategoryStatus',rows,'category',permitBucket);
 const assigned={},issuedM={};rows.forEach(z=>{const a=dte(z.assignedDate);if(a){const k=`${a.getFullYear()}-${String(a.getMonth()+1).padStart(2,'0')}`;assigned[k]=(assigned[k]||0)+1}const q=dte(z.permitStart);if(q&&isIssued(z)){const k=`${q.getFullYear()}-${String(q.getMonth()+1).padStart(2,'0')}`;issuedM[k]=(issuedM[k]||0)+1}});const months=[...new Set([...Object.keys(assigned),...Object.keys(issuedM)])].sort();draw('peTrend','line',months,[{label:'الإسناد',data:months.map(k=>assigned[k]||0),borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,.10)',tension:.3},{label:'بداية التصريح',data:months.map(k=>issuedM[k]||0),borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,.10)',tension:.3}]);
 const lagBands=[['0–3',v=>v>=0&&v<=3],['4–7',v=>v>=4&&v<=7],['8–14',v=>v>=8&&v<=14],['15–30',v=>v>=15&&v<=30],['>30',v=>v>30]];draw('peIssueLag','bar',lagBands.map(x=>x[0]+' يوم'),[{label:'تصاريح',data:lagBands.map(x=>issueLags.filter(x[1]).length),backgroundColor:'#2563eb'}]);
 const valBands=[['≤7',v=>v<=7],['8–30',v=>v>=8&&v<=30],['31–60',v=>v>=31&&v<=60],['61–90',v=>v>=61&&v<=90],['>90',v=>v>90]];draw('peValidity','bar',valBands.map(x=>x[0]+' يوم'),[{label:'تصاريح',data:valBands.map(x=>validity.filter(x[1]).length),backgroundColor:'#7c3aed'}]);
 const pendingRows=rows.filter(isPending),ageBands=[['0–2',v=>v>=0&&v<=2],['3–5',v=>v>=3&&v<=5],['6–14',v=>v>=6&&v<=14],['15–30',v=>v>=15&&v<=30],['31+',v=>v>=31]];draw('pePendingAge','bar',ageBands.map(x=>x[0]+' يوم'),[{label:'طلبات عالقة',data:ageBands.map(x=>pendingRows.filter(z=>x[1](n(z.days)||0)).length),backgroundColor:['#16a34a','#84cc16','#f59e0b','#f97316','#dc2626']}]);
 simple('peType',rows,'type','bar',12,{indexAxis:'y'});simple('peLocation',pendingRows,'location','bar',10,{indexAxis:'y'});simple('pePendingContractor',pendingRows,'contractor','bar',10,{indexAxis:'y'});
 const sections=group(rows,'section').map(x=>x[0]),evals=['غير متأخر','متأخر','متأخر جدًا'];draw('peEvalSection','bar',sections,evals.map((s,i)=>({label:s,data:sections.map(k=>rows.filter(z=>(t(z.section)||'غير محدد')===k&&evalBucket(z)===s).length),backgroundColor:['#16a34a','#f59e0b','#dc2626'][i]})),{scales:{x:{stacked:true},y:{stacked:true}}});
}
function sync(){const x=root();if(!x)return;const on=typeof S!=='undefined'&&S.current==='permits';x.style.display=on?'block':'none';const g=document.getElementById('genericPageCharts'),p=document.getElementById('executionPhaseAnalytics'),k=document.getElementById('pageKpis');if(on){if(g)g.style.display='none';if(p)p.style.display='none';if(k)k.style.display='none';render(Array.isArray(S.filtered)?S.filtered:[])}else{destroy()}}
if(typeof renderDataPage==='function'){const base=renderDataPage;renderDataPage=function(){base.apply(this,arguments);sync()}}
})();