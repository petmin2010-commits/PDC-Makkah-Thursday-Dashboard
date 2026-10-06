(function(){
'use strict';
const PAGE_ID='projectsReportEnginePage',NAV_ID='projectsReportEngineNav',EXTRA_SHEET='Projects Report Engine Data';
const state={loading:false,data:null,wo:'',extraSheetId:''};
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
const num=v=>{const n=Number(String(v??'').replace(/,/g,'').replace('%','').trim());return Number.isFinite(n)?n:null};
const pct=v=>{const n=num(v);return n==null?null:(String(v).includes('%')?n:(Math.abs(n)<=1?n*100:n))};
const fmtNum=v=>{const n=num(v);return n==null?'—':n.toLocaleString('en-US',{maximumFractionDigits:2})};
const fmtPct=v=>{const n=pct(v);return n==null?'—':n.toLocaleString('en-US',{maximumFractionDigits:2})+'%'};
function rpc(method,args=[]){return fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})}).then(async r=>{const x=await r.json().catch(()=>({}));if(!r.ok||x.ok===false)throw new Error(x.error||('HTTP '+r.status));return x.result})}
function install(){
 const nav=$(NAV_ID);if(!nav||$(PAGE_ID))return;
 const main=document.querySelector('main');if(!main)return;
 const page=document.createElement('section');page.id=PAGE_ID;page.className='page pre-page';page.innerHTML=markup();main.insertBefore(page,main.firstChild);
 nav.onclick=openPage;document.getElementById('nav')?.addEventListener('click',e=>{const b=e.target.closest('.nav-item');if(b&&b.id!==NAV_ID)leave()});
 $('preSearchBtn').onclick=search;$('preInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}});
 $('prePrintBtn').onclick=()=>window.print();$('preOpenDataBtn').onclick=openDataSheet;
 const saved=localStorage.getItem('vd.projectsReportEngine.wo')||'';if(saved)$('preInput').value=saved;
}
function markup(){return `
<div class="pre-hero">
 <div><span class="pre-eyebrow">DYNAMIC WORK ORDER REPORTING</span><h2>Projects Report Engine</h2><p>تقرير مشروع ديناميكي يدمج بيانات أمر العمل الحية مع البيانات الإضافية المخصصة للتقرير، بدون تكرار حقول موجودة أصلًا.</p></div>
 <div class="pre-actions"><button id="preOpenDataBtn" type="button">فتح بيانات التقرير</button><button id="prePrintBtn" type="button">تصدير / طباعة PDF</button></div>
</div>
<div class="pre-searchbar"><input id="preInput" inputmode="numeric" autocomplete="off" placeholder="ابحث برقم أمر العمل..."><button id="preSearchBtn" type="button">إنشاء التقرير</button></div>
<div id="preBody" class="pre-state"><b>محرك التقرير جاهز</b><span>اختر أي رقم أمر عمل. سيُسحب الموجود من أوراق المشروع تلقائيًا، وتُستخدم صفحة Projects Report Engine Data فقط للبيانات غير الموجودة.</span></div>`}
function openPage(){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(PAGE_ID)?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id===NAV_ID));
 const fb=$('filterBar');if(fb)fb.style.display='none';if($('pageTitle'))$('pageTitle').textContent='Projects Report Engine';
 document.body.classList.add('vd-projects-report-engine-active');setTimeout(()=>$('preInput')?.focus(),50)
}
function leave(){document.body.classList.remove('vd-projects-report-engine-active');$(PAGE_ID)?.classList.remove('active');const fb=$('filterBar');if(fb&&document.querySelector('.nav-item.active')?.dataset.page!=='reportsCenter')fb.style.display=''}
function openDataSheet(){const u=state.data?.spreadsheetUrl;if(u)window.open(u+(state.extraSheetId?'#gid='+state.extraSheetId:''),'_blank','noopener');else alert('أنشئ التقرير أولاً لتحديد ملف المصدر.')}
async function search(){
 if(state.loading)return;const wo=clean($('preInput').value);if(!wo){$('preInput').focus();return}
 state.loading=true;state.wo=wo;localStorage.setItem('vd.projectsReportEngine.wo',wo);
 $('preBody').className='pre-state';$('preBody').innerHTML='<span class="pre-loader"></span><b>جاري تكوين التقرير...</b><span>تجميع البيانات الأصلية والإضافية الخاصة بأمر العمل.</span>';
 try{state.data=await rpc('getWorkOrder360',[wo]);render(state.data)}
 catch(e){$('preBody').className='pre-state error';$('preBody').innerHTML='<b>تعذر إنشاء التقرير</b><span>'+esc(e.message||e)+'</span>'}
 finally{state.loading=false}
}
function toObj(record){const o={};(record?.fields||[]).forEach(f=>o[clean(f.label)]=f.value);return o}
function source(data,name){return (data.sources||[]).find(s=>norm(s.sheet)===norm(name))}
function extraRows(data){const s=source(data,EXTRA_SHEET);state.extraSheetId=s?.sheetId||'';return (s?.records||[]).map(r=>({...toObj(r),_row:r.rowNumber}))}
function originalFields(data){
 const out=[];
 (data.sources||[]).filter(s=>norm(s.sheet)!==norm(EXTRA_SHEET)).forEach(s=>{
  (s.records||[]).forEach(r=>{
   (r.fields||[]).forEach(f=>out.push({sheet:s.sheet,label:clean(f.label),value:f.value}));
  });
 });
 return out;
}
function pick(fs,labels){
 for(const wanted of labels){const nw=norm(wanted);const hit=fs.find(f=>norm(f.label)===nw&&clean(f.value));if(hit)return hit}
 for(const wanted of labels){const nw=norm(wanted);const hit=fs.find(f=>norm(f.label).includes(nw)&&clean(f.value));if(hit)return hit}
 return null
}
function val(fs,labels){return pick(fs,labels)?.value||''}
function extraBy(rows,key){return rows.find(r=>norm(r['Field / Item / Permit No.'])===norm(key))}
function extraValue(row){return row?.['Text Value / Description']||row?.['Numeric Value']||row?.['Responsible / Issuing Authority']||row?.['Start / Observation Date']||row?.['End / Expected Date']||''}
function reportDate(rows){const pts=rows.filter(r=>r.Section==='PLAN_POINT').map(r=>r['Start / Observation Date']).filter(Boolean);return pts.at(-1)||''}
function dateObj(v){const s=clean(v);let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);const d=new Date(s);return isNaN(d)?null:d}
function daysBetween(a,b){const x=dateObj(a),y=dateObj(b);return x&&y?Math.round((y-x)/86400000):null}
function statusClass(s){const n=norm(s);if(n.includes('تم')||n.includes('كامل')||n.includes('اصدار'))return'ok';if(n.includes('جاري')||n.includes('تنسيق')||n.includes('جزئي'))return'warn';if(n.includes('مرفوض')||n.includes('لم'))return'bad';return''}
function render(data){
 const rows=extraRows(data),fs=originalFields(data),extras=rows.filter(r=>r.Section==='PROJECT_EXTRA');
 if(!data.totalRecords){$('preBody').className='pre-state';$('preBody').innerHTML='<b>لم يتم العثور على أمر العمل '+esc(data.workOrder)+'</b><span>لا توجد سجلات مطابقة في ملف المشروع.</span>';return}
 const ex=k=>extraValue(extraBy(extras,k));
 const projectTitle=ex('PROJECT_TITLE')||val(fs,['وصف امر العمل','وصف امر العمل uds','شرح تفصيل امر العمل'])||'مشروع '+data.workOrder;
 const desc=ex('DETAILED_WORK_DESCRIPTION')||val(fs,['شرح تفصيل امر العمل','وصف امر العمل','وصف امر العمل uds']);
 const contractor=val(fs,['المقاول','المقاول uds']);
 const location=val(fs,['الموقع']);
 const engineer=val(fs,['المهندس المسئول','المهندس المسؤول']);
 const stage=val(fs,['مرحلة التنفيذ']);
 const stageStatus=val(fs,['حالة المرحلة','حالة التنفيذ','حالة الامر وفقا لمتابعة المهندس المسئول']);
 const actual=pct(val(fs,['نسبة الانجاز الكلية','نسبة الإنجاز الكلية']));
 const planRow=rows.filter(r=>r.Section==='PLAN_POINT').at(-1),planned=pct(planRow?.['Weight / Planned Progress %']);
 const variance=actual!=null&&planned!=null?actual-planned:null;
 const start=ex('ACTUAL_START_DATE')||val(fs,['تاريخ الاسناد','تاريخ الإسناد']);
 const expected=ex('EXPECTED_OPERATION_DATE');
 const rdate=reportDate(rows)||new Date().toLocaleDateString('en-GB');
 const elapsed=daysBetween(start,rdate),remaining=expected?daysBetween(rdate,expected):null;
 const boq=rows.filter(r=>r.Section==='BOQ_ITEM'),mats=rows.filter(r=>r.Section==='MATERIAL'),permits=rows.filter(r=>r.Section==='PERMIT_DETAIL');
 const issued=permits.filter(r=>norm(r.Status).includes('اصدار')).length;
 const issuedLen=permits.filter(r=>norm(r.Status).includes('اصدار')).reduce((a,r)=>a+(num(r['Planned / Required Qty'])||0),0);
 const doneLen=permits.reduce((a,r)=>a+(num(r['Executed / Issued Qty'])||0),0);
 const cards=[
  ['الإنجاز الفعلي',actual==null?'—':fmtPct(actual),'live'],
  ['المخطط حتى تاريخ التقرير',planned==null?'—':fmtPct(planned),'manual'],
  ['الانحراف',variance==null?'—':(variance>=0?'+':'')+variance.toFixed(2)+'%','calc'],
  ['الأيام المنقضية',elapsed==null?'—':elapsed,'calc'],
  ['الأيام المتبقية',remaining==null?'—':remaining,'calc'],
  ['التصاريح الصادرة',permits.length?issued+' / '+permits.length:'—','manual']
 ];
 $('preBody').className='pre-report';$('preBody').innerHTML=`
 <section class="pre-summary">
  <div class="pre-title"><div><span>WORK ORDER ${esc(data.workOrder)}</span><h2>${esc(projectTitle)}</h2><p>${esc(desc||'')}</p></div><div class="pre-report-meta"><b>تاريخ التقرير</b><span>${esc(rdate)}</span><small>${esc(stage)} ${stageStatus?'• '+esc(stageStatus):''}</small></div></div>
  <div class="pre-facts">
   ${fact('المقاول',contractor,'LIVE')}${fact('الموقع',location,'LIVE')}${fact('المهندس المسؤول',engineer,'LIVE')}${fact('مهندس متابعة الكهرباء',ex('SEC_FOLLOWUP_ENGINEER'),'EXTRA')}
   ${fact('تاريخ البدء الفعلي',start,ex('ACTUAL_START_DATE')?'EXTRA':'LIVE')}${fact('التشغيل المتوقع',expected,'EXTRA')}
  </div>
 </section>
 <div class="pre-kpis">${cards.map(c=>'<article class="pre-kpi '+(c[0]==='الانحراف'&&variance<0?'bad':'')+'"><small>'+esc(c[0])+' • '+sourceTag(c[2])+'</small><strong>'+esc(c[1])+'</strong></article>').join('')}</div>
 ${progressBlock(actual,planned)}
 ${tableBlock('بنود التنفيذ','BOQ / PROGRESS',boq,['Field / Item / Permit No.','Text Value / Description','Unit','Planned / Required Qty','Executed / Issued Qty','Period Qty','Weight / Planned Progress %','Status'],['الكود','البند','الوحدة','المخطط','المنفذ','الفترة','الوزن','الحالة'])}
 ${tableBlock('المواد','MATERIAL CONTROL',mats,['Text Value / Description','Unit','Planned / Required Qty','Executed / Issued Qty','Status'],['الصنف','الوحدة','المطلوب','المصروف','الحالة'])}
 ${permitsBlock(permits,issuedLen,doneLen)}
 ${extraBlock(extras)}
 <div class="pre-source-note">تم العثور على أمر العمل في <b>${data.matchedSheets}</b> ورقة / مصدر و <b>${data.totalRecords}</b> سجل. البيانات الموسومة LIVE تأتي من أوراق المشروع الحالية، وEXTRA من صفحة الإدخال الإضافية.</div>`;
}
function sourceTag(t){return t==='live'?'LIVE':t==='manual'?'EXTRA':'CALC'}
function fact(k,v,src){return '<div class="pre-fact"><small>'+esc(k)+' • '+src+'</small><b>'+esc(v||'—')+'</b></div>'}
function progressBlock(actual,planned){
 const a=Math.max(0,Math.min(100,actual||0)),p=Math.max(0,Math.min(100,planned||0));
 return `<section class="pre-panel"><div class="pre-panel-head"><div><span>PROGRESS CONTROL</span><h3>التقدم الفعلي مقابل المخطط</h3></div></div>
 <div class="pre-progress-row"><b>الفعلي</b><div class="pre-track"><i style="width:${a}%"></i></div><strong>${actual==null?'—':actual.toFixed(2)+'%'}</strong></div>
 <div class="pre-progress-row planned"><b>المخطط</b><div class="pre-track"><i style="width:${p}%"></i></div><strong>${planned==null?'—':planned.toFixed(2)+'%'}</strong></div></section>`
}
function tableBlock(title,en,rows,keys,heads){
 if(!rows.length)return '';
 return `<section class="pre-panel"><div class="pre-panel-head"><div><span>${en}</span><h3>${esc(title)}</h3></div><b>${rows.length}</b></div><div class="pre-table-wrap"><table><thead><tr>${heads.map(h=>'<th>'+esc(h)+'</th>').join('')}</tr></thead><tbody>${rows.map(r=>'<tr>'+keys.map(k=>'<td'+(k==='Status'?' class="status '+statusClass(r[k])+'"':'')+'>'+esc(r[k]||'—')+'</td>').join('')+'</tr>').join('')}</tbody></table></div></section>`
}
function permitsBlock(rows,issuedLen,doneLen){
 if(!rows.length)return '';
 const keys=['Field / Item / Permit No.','Responsible / Issuing Authority','Location / Neighborhood','Status','Start / Observation Date','End / Expected Date','Planned / Required Qty','Executed / Issued Qty'];
 const heads=['رقم / مرحلة التصريح','الجهة','الموقع','الحالة','البداية','النهاية','الطول','المنجز'];
 return `<section class="pre-panel"><div class="pre-panel-head"><div><span>PERMIT PORTFOLIO</span><h3>التصاريح التفصيلية</h3></div><div class="pre-mini-kpis"><span>أطوال الصادر <b>${fmtNum(issuedLen)} م</b></span><span>منجز مسجل <b>${fmtNum(doneLen)} م</b></span></div></div><div class="pre-table-wrap"><table><thead><tr>${heads.map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody>${rows.map(r=>'<tr>'+keys.map(k=>'<td'+(k==='Status'?' class="status '+statusClass(r[k])+'"':'')+'>'+esc(r[k]||'—')+'</td>').join('')+'</tr>').join('')}</tbody></table></div></section>`
}
function extraBlock(rows){
 const hidden=new Set(['PROJECT_TITLE','DETAILED_WORK_DESCRIPTION','ACTUAL_START_DATE','EXPECTED_OPERATION_DATE','SEC_FOLLOWUP_ENGINEER']);
 const show=rows.filter(r=>!hidden.has(r['Field / Item / Permit No.']));
 if(!show.length)return '';
 return `<section class="pre-panel"><div class="pre-panel-head"><div><span>REPORT-SPECIFIC DATA</span><h3>بيانات إضافية خاصة بالتقرير</h3></div></div><div class="pre-extra-grid">${show.map(r=>'<div><small>'+esc(r['Field / Item / Permit No.'])+'</small><b>'+esc(extraValue(r)||'—')+'</b></div>').join('')}</div></section>`
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,260));else setTimeout(install,260);
})();