(function(){
'use strict';
const PAGE_ID='projectsReportEnginePage',NAV_ID='projectsReportEngineNav',EXTRA_SHEET='Projects Report Engine Data';
const state={loading:false,data:null,wo:'',extraSheetId:'',report:null,map:null,mapManager:null,mapLocations:[],mapSnapshot:'',images:[],photoPending:{},photoDraft:{},photoBusy:{}};
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
const num=v=>{const s=String(v??'').replace(/,/g,'').replace('%','').trim();if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null};
const pct=v=>{const n=num(v);return n==null?null:(String(v).includes('%')?n:(Math.abs(n)<=1?n*100:n))};
const fmtNum=v=>{const n=num(v);return n==null?'—':n.toLocaleString('en-US',{maximumFractionDigits:2})};
const fmtPct=v=>{const n=pct(v);return n==null?'—':n.toLocaleString('en-US',{maximumFractionDigits:2})+'%'};
const ltr=v=>'<span class="pre-ltr">'+esc(v==null?'—':v)+'</span>';
function ksaTodayIso(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const p={};parts.forEach(x=>{if(x.type!=='literal')p[x.type]=x.value});
 return (p.year||'')+'-'+(p.month||'')+'-'+(p.day||'');
}
function ksaTodayDmy(){const s=ksaTodayIso().split('-');return s.length===3?s[2]+'/'+s[1]+'/'+s[0]:new Date().toLocaleDateString('en-GB')}
function reportReferenceDate(){
 const d=new Date(ksaTodayIso()+'T12:00:00');
 d.setDate(d.getDate()-1);
 return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
function rpc(method,args=[]){return fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})}).then(async r=>{const x=await r.json().catch(()=>({}));if(!r.ok||x.ok===false)throw new Error(x.error||('HTTP '+r.status));return x.result})}
function install(){
 const nav=$(NAV_ID);if(!nav||$(PAGE_ID))return;
 const main=document.querySelector('main');if(!main)return;
 const page=document.createElement('section');page.id=PAGE_ID;page.className='page pre-page';page.innerHTML=markup();main.insertBefore(page,main.firstChild);
 nav.onclick=openPage;document.getElementById('nav')?.addEventListener('click',e=>{const b=e.target.closest('.nav-item');if(b&&b.id!==NAV_ID)leave()});
 $('preSearchBtn').onclick=search;$('preInput').addEventListener('input',e=>{e.target.value=String(e.target.value||'').replace(/\D/g,'').slice(0,10)});$('preInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}});
 $('prePrintBtn').onclick=openExportChooser;
 const photosGrid=$('prePhotosGrid');
 photosGrid?.addEventListener('change',handlePhotoFileChange);
 photosGrid?.addEventListener('input',handlePhotoCaptionInput);
 photosGrid?.addEventListener('click',handlePhotoAction);
 $('preExportClose').onclick=closeExportChooser;
 $('preExportPdf').onclick=()=>{closeExportChooser();printReport()};
 $('preExportExcel').onclick=exportProjectExcel;
 $('preExportModal').addEventListener('click',e=>{if(e.target===$('preExportModal'))closeExportChooser()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeExportChooser()});
 const saved=localStorage.getItem('vd.projectsReportEngine.wo')||'';if(saved)$('preInput').value=saved;
 renderPhotoManager();
}
function markup(){return `
<div class="pre-hero">
 <div><span class="pre-eyebrow">DYNAMIC WORK ORDER REPORTING</span><h2>Projects Report Engine</h2><p>تقرير مشروع ديناميكي يدمج بيانات أمر العمل الحية مع البيانات الإضافية المخصصة للتقرير، بدون تكرار حقول موجودة أصلًا.</p></div>
</div>
<div class="pre-searchbar">
 <input id="preInput" inputmode="numeric" maxlength="10" pattern="[0-9]{1,10}" autocomplete="off" placeholder="رقم أمر العمل">
 <button id="preSearchBtn" type="button">سحب بيانات التقرير</button>
</div>
<div id="preBody" class="pre-state"><b>محرك التقرير جاهز</b><span>اختر أي رقم أمر عمل. سيُسحب الموجود من أوراق المشروع تلقائيًا، وتُستخدم صفحة Projects Report Engine Data فقط للبيانات غير الموجودة.</span></div>
${mapBlock()}
${photosManagerBlock()}
<div class="pre-bottom-export" id="preBottomExport"><button id="prePrintBtn" type="button">تصدير التقرير</button></div>
<div id="preExportModal" class="pre-export-modal" hidden>
 <div class="pre-export-dialog" role="dialog" aria-modal="true" aria-labelledby="preExportTitle">
  <button id="preExportClose" class="pre-export-close" type="button" aria-label="إغلاق">×</button>
  <span class="pre-export-eyebrow">EXPORT PROJECT REPORT</span>
  <h3 id="preExportTitle">اختر صيغة تصدير التقرير</h3>
  <p>سيتم تصدير نفس أمر العمل والبيانات الظاهرة حاليًا.</p>
  <div class="pre-export-options">
   <button id="preExportPdf" class="pre-export-option" type="button"><b>PDF</b><strong>تقرير PDF رسمي</strong><small>نسخة جاهزة للطباعة والأرشفة.</small></button>
   <button id="preExportExcel" class="pre-export-option" type="button"><b>XLSX</b><strong>تقرير Excel</strong><small>بنفس نموذج Excel الأصلي مع المعادلات والشارتات.</small></button>
  </div>
 </div>
</div>`}
function openPage(){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(PAGE_ID)?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id===NAV_ID));
 const fb=$('filterBar');if(fb)fb.style.display='none';if($('pageTitle'))$('pageTitle').textContent='Projects Report Engine';
 document.body.classList.add('vd-projects-report-engine-active');setTimeout(()=>{if(!state.map)initReportMap(state.data);$('preInput')?.focus()},80)
}
function leave(){document.body.classList.remove('vd-projects-report-engine-active');$(PAGE_ID)?.classList.remove('active');const fb=$('filterBar');if(fb&&document.querySelector('.nav-item.active')?.dataset.page!=='reportsCenter')fb.style.display=''}
function openDataSheet(){const u=state.data?.spreadsheetUrl;if(u)window.open(u+(state.extraSheetId?'#gid='+state.extraSheetId:''),'_blank','noopener');else alert('أنشئ التقرير أولاً لتحديد ملف المصدر.')}
function openExportChooser(){
 if(!state.report){alert('أنشئ التقرير أولاً ثم اختر صيغة التصدير.');return}
 if(hasUnsavedPhotos()){alert('يوجد صور أو تعليقات غير محفوظة. احفظها أولاً حتى تتطابق نسخة Excel وPDF.');return}
 const m=$('preExportModal');if(m)m.hidden=false;
}
function closeExportChooser(){const m=$('preExportModal');if(m)m.hidden=true}
function exportFilename(disposition,fallback){
 const raw=String(disposition||'');
 const star=raw.match(/filename\*=UTF-8''([^;]+)/i);
 if(star){try{return decodeURIComponent(star[1])}catch(e){}}
 const plain=raw.match(/filename="?([^";]+)"?/i);
 return plain?.[1]||fallback;
}
async function exportProjectExcel(){
 if(!state.report){alert('أنشئ التقرير أولاً ثم اختر Excel.');return}
 const btn=$('preExportExcel'),old=btn?.innerHTML;
 try{
  if(btn){btn.disabled=true;btn.innerHTML='<b>...</b><strong>جاري إنشاء Excel</strong><small>يتم تجهيز القالب والمعادلات والشارتات.</small>'}
  const response=await fetch('/api/projects-report-engine/excel',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report:state.report})
  });
  if(!response.ok){
   let msg='تعذر تصدير Excel';
   try{const j=await response.json();msg=j.error||msg}catch(e){}
   throw new Error(msg);
  }
  const blob=await response.blob();
  const fallback='VD-Project-Report-WO-'+clean(state.report.workOrder)+'.xlsx';
  const filename=exportFilename(response.headers.get('Content-Disposition'),fallback);
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  closeExportChooser();
 }catch(e){alert(e.message||String(e))}
 finally{if(btn){btn.disabled=false;btn.innerHTML=old}}
}
async function search(){
 if(state.loading)return;const wo=clean($('preInput').value);if(!wo){$('preInput').focus();return}
 state.loading=true;state.wo=wo;state.images=[];state.photoPending={};state.photoDraft={};state.photoBusy={};localStorage.setItem('vd.projectsReportEngine.wo',wo);
 renderPhotoManager('جاري تحميل صور المشروع...');
 $('preBody').className='pre-state';$('preBody').innerHTML='<span class="pre-loader"></span><b>جاري تكوين التقرير...</b><span>تجميع البيانات الأصلية والإضافية الخاصة بأمر العمل.</span>';
 try{
  state.data=await rpc('getWorkOrder360',[wo]);
  if(window.__VDReportEnsureInputIndicators)await window.__VDReportEnsureInputIndicators(wo);
  render(state.data);
  if(state.report){try{await loadProjectImages(wo)}catch(imgErr){console.warn('Project images load failed',imgErr);state.images=[];state.photoPending={};state.photoDraft={};renderPhotoManager('تعذر تحميل الصور المحفوظة')}}
 }catch(e){$('preBody').className='pre-state error';$('preBody').innerHTML='<b>تعذر إنشاء التقرير</b><span>'+esc(e.message||e)+'</span>'}
 finally{state.loading=false;renderPhotoManager()}
}
function toObj(record){const o={};(record?.fields||[]).forEach(f=>o[clean(f.label)]=f.value);return o}
function source(data,name){return (data.sources||[]).find(s=>norm(s.sheet)===norm(name))}
function sourceLike(data,name){const n=norm(name);return (data.sources||[]).find(s=>norm(s.sheet)===n||norm(s.sheet).includes(n))}
function sourceExactValue(data,sheetName,label){
 const s=sourceLike(data,sheetName);if(!s)return '';
 const wanted=norm(label);
 for(const r of s.records||[])for(const f of r.fields||[])if(norm(f.label)===wanted&&clean(f.value))return f.value;
 return '';
}
function extraRows(data){const s=source(data,EXTRA_SHEET);state.extraSheetId=s?.sheetId||'';return (s?.records||[]).map(r=>({...toObj(r),_row:r.rowNumber}))}
function originalFields(data){
 const out=[];
 const primary='أوامر العمل',fallback='مشاريع داش بورد غير تابعة لل pdc';
 const ranked=(data.sources||[]).filter(s=>norm(s.sheet)!==norm(EXTRA_SHEET)).sort((a,b)=>{
  const rank=s=>norm(s.sheet)===norm(primary)?0:norm(s.sheet)===norm(fallback)?1:2;
  return rank(a)-rank(b);
 });
 ranked.forEach(s=>(s.records||[]).forEach(r=>(r.fields||[]).forEach(f=>out.push({sheet:s.sheet,label:clean(f.label),value:f.value}))));
 return out;
}
function workOrderBasic(data,labels){
 const fields=originalFields(data);
 const primary=fields.filter(f=>norm(f.sheet)===norm('أوامر العمل'));
 const fallback=fields.filter(f=>norm(f.sheet)===norm('مشاريع داش بورد غير تابعة لل pdc'));
 return val(primary,labels)||val(fallback,labels)||val(fields.filter(f=>!primary.includes(f)&&!fallback.includes(f)),labels);
}
function pick(fs,labels){
 for(const wanted of labels){const nw=norm(wanted);const hit=fs.find(f=>norm(f.label)===nw&&clean(f.value));if(hit)return hit}
 for(const wanted of labels){const nw=norm(wanted);const hit=fs.find(f=>norm(f.label).includes(nw)&&clean(f.value));if(hit)return hit}
 return null
}
function val(fs,labels){return pick(fs,labels)?.value||''}
function extraBy(rows,key){return rows.find(r=>norm(r['Field / Item / Permit No.'])===norm(key))}
function extraValue(row){return row?.['Text Value / Description']||row?.['Numeric Value']||row?.['Responsible / Issuing Authority']||row?.['Start / Observation Date']||row?.['End / Expected Date']||''}
function reportDate(rows){const pts=rows.filter(r=>r.Section==='PLAN_POINT').map(r=>r['Start / Observation Date']).filter(Boolean).map(v=>({v,d:dateObj(v)})).filter(x=>x.d).sort((a,b)=>a.d-b.d);return pts.at(-1)?.v||''}
function dateObj(v){const s=clean(v);let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);const d=new Date(s);return isNaN(d)?null:d}
function daysBetween(a,b){const x=dateObj(a),y=dateObj(b);return x&&y?Math.round((y-x)/86400000):null}
function reportDayNumber(startValue,endValue){
 const first=dateObj(startValue),last=dateObj(endValue);
 if(!first||!last)return null;
 const d=new Date(first.getFullYear(),first.getMonth(),first.getDate(),12);
 const end=new Date(last.getFullYear(),last.getMonth(),last.getDate(),12);
 if(d>end)return 0;
 let count=0;
 while(d<=end){if(d.getDay()!==5)count++;d.setDate(d.getDate()+1)}
 return count;
}
function contractDurationWithWeekends(startValue,durationValue){
 const start=dateObj(startValue),raw=num(durationValue),target=raw==null?null:Math.floor(raw);
 if(!start||target==null||target<=0)return null;
 const d=new Date(start.getFullYear(),start.getMonth(),start.getDate(),12,0,0);
 let fridayDays=0;
 for(let i=0;i<target;i++){
  if(d.getDay()===5)fridayDays++;
  d.setDate(d.getDate()+1);
 }
 return target+fridayDays;
}
function statusClass(s){
 const n=norm(s);
 if(n.includes('مرفوض')||n.includes('لم يتم')||n.startsWith('لم ')||n.includes('غير مصروف'))return'bad';
 if(n.includes('ملغي'))return'cancelled';
 if(n.includes('منتهي'))return'expired';
 if(n.includes('جزئي')||n.includes('تنسيق')||n.includes('اعتماد')||n.includes('جاري')||n.includes('قيد'))return'warn';
 if(n.includes('بالكامل')||n.includes('اصدار')||n.includes('مكتمل')||n.includes('تم الصرف'))return'ok';
 return'';
}
function completion(row){
 const planned=num(row['Planned / Required Qty']),done=num(row['Executed / Issued Qty']);
 if(planned==null||planned<=0||done==null)return null;
 return Math.max(0,Math.min(100,(done/planned)*100));
}
function ratio(v){
 const n=num(v);
 if(n==null)return null;
 return String(v??'').includes('%')||Math.abs(n)>1?n/100:n;
}
function weightedBoqMetrics(rows){
 let totalWeight=0,weighted=0,weightedRows=0,usableRows=0;
 rows.forEach(r=>{
  const w=ratio(r['Weight / Planned Progress %']);
  if(w==null)return;
  weightedRows++;totalWeight+=w;
  if(r._completion!=null){weighted+=w*(r._completion/100);usableRows++}
 });
 const hasWeights=weightedRows>0;
 const valid=rows.length>0&&weightedRows===rows.length&&usableRows===rows.length&&Math.abs(totalWeight-1)<=0.005;
 return{hasWeights,valid,totalWeightPct:totalWeight*100,progress:valid?weighted*100:null};
}
function materialSummary(rows){
 const total=rows.length;let full=0,partial=0,none=0;
 rows.forEach(r=>{const n=norm(r.Status);if(n.includes('بالكامل'))full++;else if(n.includes('جزئي'))partial++;else if(n.includes('لم يتم')||n.startsWith('لم ')||n.includes('غير مصروف'))none++});
 return{total,full,partial,none,other:Math.max(0,total-full-partial-none)};
}
function permitSummary(rows){
 const out={total:rows.length,issued:0,expired:0,rejected:0,cancelled:0,coord:0,other:0};
 rows.forEach(r=>{const n=norm(r.Status);if(n.includes('مرفوض'))out.rejected++;else if(n.includes('ملغي'))out.cancelled++;else if(n.includes('منتهي'))out.expired++;else if(n.includes('تنسيق')||n.includes('اعتماد')||n.includes('قيد'))out.coord++;else if(n.includes('اصدار'))out.issued++;else out.other++});
 return out;
}
function miniSummary(items,cls=''){
 return '<div class="pre-summary-strip '+cls+'">'+items.map(x=>'<div><small>'+esc(x[0])+'</small><b class="'+(x[2]||'')+'">'+(x[3]?'':esc(x[1]))+(x[3]||'')+'</b></div>').join('')+'</div>';
}
function svgText(v){return esc(clean(v)).replace(/&amp;/g,'&amp;')}
function shortLabel(v,max=24){const s=clean(v);return s.length>max?s.slice(0,max-1)+'…':s}
function boqSummary(rows){
 let running=0,notStarted=0,completed=0,unverified=0;
 rows.forEach(r=>{
  const quantity=Number(r['Planned / Required Qty']),executed=Number(r['Executed / Issued Qty']);
  const hasQuantity=r['Planned / Required Qty']!==''&&r['Planned / Required Qty']!=null&&Number.isFinite(quantity)&&quantity>0;
  const hasExecuted=r['Executed / Issued Qty']!==''&&r['Executed / Issued Qty']!=null&&Number.isFinite(executed);
  const percentage=Number(r._completion);
  if(hasQuantity&&hasExecuted){
   if(executed<=0)notStarted++;
   else if(executed>=quantity)completed++;
   else running++;
  }else if(r._completion!=null&&Number.isFinite(percentage)){
   if(percentage<=0)notStarted++;
   else if(percentage>=100)completed++;
   else running++;
  }else unverified++;
 });
 return{total:rows.length,running,notStarted,completed,unverified};
}
function riskSummary(rows){
 const out={total:rows.length,open:0,solved:0,high:0,medium:0,low:0};
 rows.forEach(r=>{
  const st=norm(r.Status),impact=norm(r['Impact Level']||r.Notes||'');
  if(st.includes('تم الحل')||st.includes('مغلق'))out.solved++;else out.open++;
  if(impact.includes('عالي'))out.high++;else if(impact.includes('متوسط'))out.medium++;else if(impact.includes('منخفض'))out.low++;
 });
 return out;
}
function riskBlock(rows,reportDateValue){
 if(!rows.length)return '';
 const sum=riskSummary(rows);
 const summary=miniSummary([
  ['إجمالي العوائق',sum.total,'pre-ltr'],
  ['مفتوح',sum.open,'bad-text'],
  ['تم الحل',sum.solved,'ok-text'],
  ['أثر عالي',sum.high,'bad-text'],
  ['أثر متوسط',sum.medium,'warn-text'],
  ['أثر منخفض',sum.low,'ok-text']
 ],'pre-risk-summary');
 const body=rows.map(r=>{
  const solved=norm(r.Status).includes('تم الحل')||norm(r.Status).includes('مغلق');
  const age=solved?'مغلق':(daysBetween(r['Start / Observation Date'],reportDateValue)??'—');
  return '<tr>'+cell(r['Text Value / Description'])+cell(r['Category / Impact'])+cell(r['Impact Level']||r.Notes)+cell(r['Action / Support Required'])+cell(r['Responsible / Issuing Authority'])+cell(r['Start / Observation Date'],'pre-num')+cell(age,'pre-num')+cell(r.Status,'status '+statusClass(r.Status))+'</tr>';
 }).join('');
 return '<section class="pre-panel pre-risk-panel pre-table-page"><div class="pre-panel-head"><div><span>ISSUES / RISKS</span><h3>أبرز التحديات والعوائق</h3></div><b>'+rows.length+'</b></div>'+summary+'<div class="pre-table-wrap"><table><thead><tr><th>التحدي / العائق</th><th>التصنيف</th><th>درجة الأثر</th><th>الإجراء المتخذ</th><th>الجهة المسؤولة</th><th>تاريخ الرصد</th><th>العمر</th><th>الحالة</th></tr></thead><tbody>'+body+'</tbody></table></div></section>';
}
function narrativeBlock(periodRows,managementRows){
 const period=periodRows.map(r=>clean(r['Text Value / Description']||r.Notes)).filter(Boolean);
 const notes=managementRows.map(r=>clean(r['Text Value / Description']||r['Action / Support Required']||r.Notes)).filter(Boolean);
 if(!period.length&&!notes.length)return '';
 return '<section class="pre-panel pre-narrative-panel pre-print-section">'+(period.length?'<div class="pre-narrative-part"><span>PERIOD SUMMARY</span><h3>ملخص المنفذ خلال الفترة</h3>'+period.map(x=>'<p>'+esc(x)+'</p>').join('')+'</div>':'')+(notes.length?'<div class="pre-narrative-part"><span>MANAGEMENT NOTES</span><h3>الإجراءات المطلوبة والدعم المطلوب</h3>'+notes.map(x=>'<p>'+esc(x)+'</p>').join('')+'</div>':'')+'</section>';
}
function boqChart(rows){
 if(!rows.length)return '';
 return '<div class="pre-chart-card pre-boq-chart"><div class="pre-chart-title"><span>PLANNED VS EXECUTED</span><h4>مقارنة الكمية المخططة بإجمالي المنفذ لكل بند</h4></div><div class="pre-bar-chart">'+rows.map(r=>{
   const p=num(r['Planned / Required Qty'])||0,d=num(r['Executed / Issued Qty'])||0;
   const completionPct=p>0?Math.max(0,Math.min(100,(d/p)*100)):0;
   return '<div class="pre-bar-row"><div class="pre-bar-label" title="'+esc(r['Text Value / Description'])+'">'+esc(shortLabel(r['Text Value / Description'],34))+'</div><div class="pre-bar-area"><div class="pre-bar-track"><i class="planned" style="width:100%"></i></div><div class="pre-bar-track"><i class="actual" style="width:'+completionPct+'%"></i></div></div><div class="pre-bar-values"><span>'+fmtNum(p)+' '+esc(r.Unit||'')+'</span><b>'+fmtNum(d)+' '+esc(r.Unit||'')+'</b></div></div>';
 }).join('')+'</div><div class="pre-chart-legend"><span><i class="planned"></i>المخطط لكل بند = 100%</span><span><i class="actual"></i>المنفذ كنسبة من مخطط البند</span></div></div>';
}
function historyPoints(planRows,startValue,reportDateValue,currentActual,injectCurrent=true){
 const startD=dateObj(startValue),reportD=dateObj(reportDateValue);
 const byDate=new Map();
 (planRows||[]).forEach(r=>{
  const date=r['Start / Observation Date']||r['End / Expected Date']||'';
  const d=dateObj(date);
  if(!d)return;
  if(startD&&d<startD)return;
  if(reportD&&d>reportD)return;
  const planned=pct(r['Weight / Planned Progress %']);
  const actual=pct(r['Numeric Value']);
  if(planned==null&&actual==null)return;
  const key=d.toISOString().slice(0,10);
  const prev=byDate.get(key)||{date:key,planned:null,actual:null};
  if(planned!=null)prev.planned=planned;
  if(actual!=null)prev.actual=actual;
  byDate.set(key,prev);
 });
 const points=[...byDate.values()].sort((a,b)=>dateObj(a.date)-dateObj(b.date));
 if(injectCurrent&&reportD&&currentActual!=null){
  const key=reportD.toISOString().slice(0,10);
  const hit=points.find(p=>p.date===key);
  if(hit)hit.actual=currentActual;
  else points.push({date:key,planned:null,actual:currentActual});
  points.sort((a,b)=>dateObj(a.date)-dateObj(b.date));
 }
 return points;
}
function latestHistoryActual(planRows,startValue,reportDateValue){
 const pts=historyPoints(planRows,startValue,reportDateValue,null,false).filter(p=>p.actual!=null);
 return pts.length?pts[pts.length-1]:null;
}
function progressHistoryChart(planRows,currentActual,reportDateValue,startValue){
 const points=historyPoints(planRows,startValue,reportDateValue,currentActual,true);
 if(!points.length)return '';
 const n=Math.max(points.length,1),w=820,h=220,padL=42,padR=18,padT=18,padB=42,plotW=w-padL-padR,plotH=h-padT-padB;
 const x=i=>padL+(n===1?plotW/2:(i/(n-1))*plotW),y=v=>padT+plotH-(Math.max(0,Math.min(100,v||0))/100)*plotH;
 const line=key=>points.filter(p=>p[key]!=null).map((p,i)=>{const originalIndex=points.indexOf(p);return (i?'L':'M')+x(originalIndex).toFixed(1)+' '+y(p[key]).toFixed(1)}).join(' ');
 const dots=key=>points.filter(p=>p[key]!=null).map(p=>{const i=points.indexOf(p);return '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(p[key]).toFixed(1)+'" r="3.8" class="'+key+'"></circle>'}).join('');
 const labels=points.map((p,i)=>'<text x="'+x(i).toFixed(1)+'" y="'+(h-13)+'" text-anchor="middle">'+esc(shortLabel(p.date,10))+'</text>').join('');
 const grid=[0,25,50,75,100].map(v=>'<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+y(v)+'" y2="'+y(v)+'"></line><text x="'+(padL-8)+'" y="'+(y(v)+3)+'" text-anchor="end">'+v+'%</text>').join('');
 return '<div class="pre-chart-card pre-history-chart"><div class="pre-chart-title"><span>CUMULATIVE PROGRESS CURVE</span><h4>منحنى تقدم الإنجاز التراكمي</h4></div><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="منحنى تقدم الإنجاز التراكمي"><g class="grid">'+grid+'</g><path class="series planned" d="'+line('planned')+'"></path><path class="series actual" d="'+line('actual')+'"></path>'+dots('planned')+dots('actual')+'<g class="axis-labels">'+labels+'</g></svg><div class="pre-chart-legend"><span><i class="planned"></i>المخطط</span><span><i class="actual"></i>الفعلي</span></div>'+(points.length<2?'<small class="pre-chart-note">سيظهر المنحنى التاريخي تلقائيًا مع إضافة نقاط زمنية صحيحة داخل فترة المشروع.</small>':'')+'</div>';
}
function render(data){
 const rows=extraRows(data),fs=originalFields(data),extras=rows.filter(r=>r.Section==='PROJECT_EXTRA');
 if(!data.totalRecords){state.report=null;$('preBody').className='pre-state';$('preBody').innerHTML='<b>لم يتم العثور على أمر العمل '+esc(data.workOrder)+'</b><span>لا توجد سجلات مطابقة في ملف المشروع.</span>';return}
 const ex=k=>extraValue(extraBy(extras,k));
 const projectTitle=ex('PROJECT_TITLE')||workOrderBasic(data,['وصف امر العمل','وصف امر العمل uds','شرح تفصيل امر العمل'])||'مشروع '+data.workOrder;
 const desc=ex('DETAILED_WORK_DESCRIPTION')||workOrderBasic(data,['شرح تفصيل امر العمل','وصف امر العمل','وصف امر العمل uds']);
 const contractor=workOrderBasic(data,['المقاول','المقاول uds'])||ex('CONTRACTOR_REPORT_NAME');
 const location=workOrderBasic(data,['الموقع','الموقع / المنطقة','موقع المشروع']);
 const engineer=workOrderBasic(data,['المهندس المسئول','المهندس المسؤول']);
 const stage=workOrderBasic(data,['مرحلة التنفيذ']);
 const stageStatus=workOrderBasic(data,['حالة المرحلة','حالة التنفيذ','حالة الامر وفقا لمتابعة المهندس المسئول']);
 const reportType=ex('REPORT_TYPE')||'يومي';
 const reportNo=String(reportDayNumber(ex('ACTUAL_START_DATE')||workOrderBasic(data,['تاريخ المباشرة','تاريخ البدء','تاريخ بدء التنفيذ']),reportReferenceDate())??'');
 const contractDuration=workOrderBasic(data,['المدة uds','المدة التعاقدية (يوم)','المدة التعاقدية','مدة امر العمل','مدة أمر العمل','مدة التنفيذ','مدة المشروع'])||ex('CONTRACTUAL_DURATION_DAYS');
 const consultant='شركة أبعاد الرؤية للاستشارات الهندسية';
 const secFollowup=ex('SEC_FOLLOWUP_ENGINEER')||workOrderBasic(data,['مهندس المتابعة','مهندس شركة الكهرباء','المهندس المسئول','المهندس المسؤول']);
 const signatureValue=key=>extraValue(rows.find(r=>r.Section==='SIGNATURE'&&norm(r['Field / Item / Permit No.'])===norm(key)));
 const preparedBy=signatureValue('PREPARED_BY')||engineer;
 const reviewedBy=signatureValue('REVIEWED_BY');
 const approvedBy=signatureValue('APPROVED_BY');
 const liveActual=pct(val(fs,['نسبة الانجاز الكلية','نسبة الإنجاز الكلية']));
 const planRows=rows.filter(r=>r.Section==='PLAN_POINT');
  const start=dateObj(ex('ACTUAL_START_DATE')||workOrderBasic(data,['تاريخ المباشرة','تاريخ البدء','تاريخ بدء التنفيذ']));
 const expected=ex('EXPECTED_OPERATION_DATE');
 const rdate=reportReferenceDate();
 const contractDurationCalendar=contractDurationWithWeekends(start,contractDuration);
 const validPlanPoints=historyPoints(planRows,start,rdate,null,false).filter(p=>p.planned!=null);
 const plannedExtra=pct(ex('PLANNED_PROGRESS'));
 const planned=contractDurationCalendar>0&&daysBetween(start,rdate)!=null?Math.min(100,Math.max(0,((daysBetween(start,rdate)+1)/contractDurationCalendar)*100)):null;
 const datedProgress=historyPoints(planRows,start,rdate,null,false).filter(p=>p.actual!=null);
 const referenceIso=reportReferenceDate().split('/').reverse().join('-');
 const referenceSnapshot=datedProgress.find(p=>p.date===referenceIso)||null;
 const previousDay=datedProgress.filter(p=>p.date<referenceIso).at(-1);

 const elapsed=daysBetween(start,rdate),remaining=contractDurationCalendar>0&&elapsed!=null?Math.max(0,contractDurationCalendar-Math.max(0,elapsed+1)):null;
 const boq=rows.filter(r=>r.Section==='BOQ_ITEM').map(r=>({...r,_completion:completion(r)}));
 const boqMetric=weightedBoqMetrics(boq);
 const actual=boqMetric.valid?boqMetric.progress:liveActual;
 const actualSource=boqMetric.valid?'CALC-BOQ':'LIVE';
 // Current weighted BOQ is authoritative; a historical snapshot for today may be stale.
 const periodBase=actual;
 const periodProgress=periodBase==null||!previousDay||previousDay.actual>periodBase+0.000001?null:Math.max(0,periodBase-previousDay.actual);
 const variance=actual!=null&&planned!=null?actual-planned:null;
 const projectStatus=actual==null?'':actual>=99.9?'مكتمل':variance==null?'':variance>=0?'وفق المخطط':variance>=-10?'تحت المتابعة':'متأخر';
 const dailyRequired=actual==null||remaining==null?null:actual>=99.999?0:remaining>0?(100-actual)/remaining:null;
 const mats=rows.filter(r=>r.Section==='MATERIAL'),permits=rows.filter(r=>r.Section==='PERMIT_DETAIL');
 const risks=rows.filter(r=>r.Section==='ISSUE_RISK'),periodRows=rows.filter(r=>r.Section==='PERIOD_SUMMARY'),managementRows=rows.filter(r=>r.Section==='MANAGEMENT_NOTE');
 const matSum=materialSummary(mats),permitSum=permitSummary(permits);
 const issuedLen=permits.filter(r=>norm(r.Status).includes('اصدار')).reduce((a,r)=>a+(num(r['Planned / Required Qty'])||0),0);
 const doneLen=permits.filter(r=>norm(r.Status).includes('اصدار')).reduce((a,r)=>a+(num(r['Executed / Issued Qty'])||0),0);
 const permitExecution=issuedLen>0?(doneLen/issuedLen)*100:null;
 const historyLast=latestHistoryActual(planRows,start,rdate);
 const historyDiff=historyLast&&actual!=null?historyLast.actual-actual:null;
 const qualityAlerts=[];
 const unverifiedBoq=boqSummary(boq).unverified;
 if(unverifiedBoq)qualityAlerts.push(unverifiedBoq+' بند/بنود لم يمكن تصنيفها لغياب كميات صالحة.');
 if(actual!=null&&actual<99.999&&remaining===0)qualityAlerts.push('انتهت المدة الحسابية دون اكتمال المشروع؛ لا يمكن حساب معدل يومي مطلوب دون إعادة جدولة.');
 if(boqMetric.hasWeights&&!boqMetric.valid)qualityAlerts.push('مجموع أوزان البنود = '+boqMetric.totalWeightPct.toFixed(2)+'%؛ لم يتم اعتماد الإنجاز المرجح وتم الرجوع إلى نسبة الإنجاز الحية.');
 if(historyDiff!=null&&Math.abs(historyDiff)>0.5)qualityAlerts.push('آخر إنجاز تاريخي مسجل '+historyLast.actual.toFixed(2)+'% يختلف عن الإنجاز الحالي '+actual.toFixed(2)+'% بفارق '+Math.abs(historyDiff).toFixed(2)+' نقطة.');
 const report={workOrder:data.workOrder,projectTitle,desc,contractor,location,engineer,stage,stageStatus,reportType,reportNo,contractDuration,contractDurationCalendar,consultant,secFollowup,preparedBy,reviewedBy,approvedBy,actual,actualSource,liveActual,planned,periodProgress,variance,projectStatus,dailyRequired,start,expected,rdate,elapsed,remaining,boq,boqMetric,mats,permits,risks,periodRows,managementRows,matSum,permitSum,issuedLen,doneLen,permitExecution,planRows,qualityAlerts};
 state.report=report;
 window.__VDProjectsReportEngineReport=report;
 window.__VDProjectsReportEngineData=data;
 // Read the identical six KPI results calculated inside the report input tabs.
 // This prevents report summary cards from drifting from the data-entry indicators.
 const inputKpis=window.__VDReportInputIndicators?.(data.workOrder)||null;
 const summaryActual=inputKpis?inputKpis.actual:actual;
 const summaryPlanned=inputKpis?inputKpis.planned:(contractDurationCalendar>0?100/contractDurationCalendar:null);
 const summaryVariance=summaryActual!=null&&summaryPlanned!=null?summaryActual-summaryPlanned:null;
 const summaryStatus=inputKpis?inputKpis.status:projectStatus;
 const inputPeriodText=document.querySelector('.prd-indicators-section [data-indicator-output="period"]')?.textContent?.trim();
 const inputPeriodNumber=inputPeriodText&&/^[-+]?\d+(?:\.\d+)?\s*%$/.test(inputPeriodText)?Number.parseFloat(inputPeriodText):null;
 const storedPeriodRaw=String(ex('PERIOD_PROGRESS')||'').trim();
 const storedPeriodNumber=/^[-+]?\d+(?:\.\d+)?\s*%?$/.test(storedPeriodRaw)?Number.parseFloat(storedPeriodRaw):null;
 const calculatedPeriodCandidate=inputPeriodNumber!=null?inputPeriodNumber:(inputKpis?inputKpis.period:periodProgress);
 const summaryPeriod=storedPeriodNumber!=null&&storedPeriodNumber>=0&&storedPeriodNumber<=summaryActual+0.0001?storedPeriodNumber:(calculatedPeriodCandidate!=null&&calculatedPeriodCandidate>=0&&calculatedPeriodCandidate<=summaryActual+0.0001?calculatedPeriodCandidate:null);
 const summaryDaily=inputKpis?inputKpis.daily:dailyRequired;
 // Keep downstream Excel/PDF report data aligned with the displayed input indicators.
 report.periodProgress=summaryPeriod;
 report.dailyRequired=summaryDaily;
 const cards=[
  {label:'نسبة الإنجاز الكلية',value:summaryActual==null?'—':fmtPct(summaryActual),src:actualSource,ltr:true},
  {label:'نسبة الإنجاز المخططة',value:summaryPlanned==null?'—':fmtPct(summaryPlanned),src:'CALC',ltr:true},
  {label:'الانحراف',value:summaryVariance==null?'—':((summaryVariance>=0?'+':'')+summaryVariance.toFixed(2)+'%'),src:'CALC',ltr:true,bad:summaryVariance!=null&&summaryVariance<0},
  {label:'حالة المشروع',value:summaryStatus||'—',src:'CALC',ltr:false,bad:summaryStatus==='متأخر'},
  {label:'إنجاز الفترة منذ آخر تقرير (اليوم السابق)',value:summaryPeriod==null?'—':summaryPeriod.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'%',src:'EXTRA',ltr:true},
  {label:'المعدل اليومي المطلوب',value:summaryDaily==null?'—':fmtPct(summaryDaily),src:'CALC',ltr:true}
 ];
 $('preBody').className='pre-report';$('preBody').innerHTML=`
 <section class="pre-summary pre-print-section">
  <div class="pre-title"><div><span>WORK ORDER ${esc(data.workOrder)}</span><h2>${esc(projectTitle)}</h2><p>${esc(desc||'')}</p></div><div class="pre-report-meta"><b>تاريخ التقرير</b><span class="pre-ltr">${esc(rdate)}</span><small>${esc(stage)} ${stageStatus?'• '+esc(stageStatus):''}</small></div></div>
  <div class="pre-facts">
   ${fact('المقاول',contractor,'LIVE')}${fact('الموقع',location,'LIVE')}${fact('المهندس المسؤول',engineer,'LIVE')}${fact('مهندس متابعة الكهرباء',secFollowup,ex('SEC_FOLLOWUP_ENGINEER')?'EXTRA':'LIVE')}
   ${fact('تاريخ بدء التنفيذ',start,ex('ACTUAL_START_DATE')?'EXTRA':'LIVE',true)}${fact('تاريخ التشغيل المتوقع',expected,'EXTRA',true)}
   ${fact('المدة التعاقدية (يوم)',contractDuration,'LIVE',true)}${fact('المتبقي على التشغيل (يوم)',contractDurationCalendar==null?'—':contractDurationCalendar,'CALC',true)}
  </div>
 </section>
 <div class="pre-kpis pre-print-section">${cards.map(c=>'<article class="pre-kpi '+(c.bad?'bad':'')+'"><small>'+esc(c.label)+' • '+c.src+'</small><strong'+(c.ltr?' class="pre-ltr"':'')+'>'+esc(c.value)+'</strong>'+(c.sub?'<em>'+esc(c.sub)+'</em>':'')+'</article>').join('')}</div>
 ${qualityAlerts.length?'<div class="pre-quality-alert pre-print-section"><b>تنبيه اتساق البيانات</b>'+qualityAlerts.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':''}
 ${progressBlock(actual,planned)}
 ${progressHistoryChart(planRows,actual,rdate,start)}
 ${boqBlock(boq,actual,planned,variance)}
 ${materialsBlock(mats,matSum)}
 ${permitsBlock(permits,permitSum,issuedLen,doneLen,permitExecution)}
 ${riskBlock(risks,rdate)}
 ${narrativeBlock(periodRows,managementRows)}
 ${extraBlock(extras)}
 <div class="pre-source-note">تم العثور على أمر العمل في <b>${data.matchedSheets}</b> ورقة / مصدر و <b>${data.totalRecords}</b> سجل. البيانات الموسومة LIVE تأتي من أوراق المشروع الحالية، وEXTRA من صفحة الإدخال الإضافية.</div>`;
 setTimeout(()=>initReportMap(data),80);
}
function fact(k,v,src,isLtr=false){if(v instanceof Date&&!Number.isNaN(v.getTime()))v=String(v.getDate()).padStart(2,'0')+'/'+String(v.getMonth()+1).padStart(2,'0')+'/'+v.getFullYear();return '<div class="pre-fact"><small>'+esc(k)+' • '+src+'</small><b'+(isLtr?' class="pre-ltr"':'')+'>'+esc(v||'—')+'</b></div>'}
function progressBlock(actual,planned){
 const a=Math.max(0,Math.min(100,actual||0)),p=Math.max(0,Math.min(100,planned||0));
 return `<section class="pre-panel pre-progress-panel pre-print-section"><div class="pre-panel-head"><div><span>PROGRESS CONTROL</span><h3>التقدم الفعلي مقابل المخطط</h3></div></div>
 <div class="pre-progress-row"><b>الفعلي</b><div class="pre-track"><i style="width:${a}%"></i></div><strong class="pre-ltr">${actual==null?'—':actual.toFixed(2)+'%'}</strong></div>
 <div class="pre-progress-row planned"><b>المخطط</b><div class="pre-track"><i style="width:${p}%"></i></div><strong class="pre-ltr">${planned==null?'—':planned.toFixed(2)+'%'}</strong></div></section>`
}
function cell(v,cls=''){return '<td'+(cls?' class="'+cls+'"':'')+'>'+esc(v==null||v===''?'—':v)+'</td>'}
function boqBlock(rows,actual,planned,variance){
 if(!rows.length)return '';
 const sum=boqSummary(rows);
 const summary=miniSummary([
  ['إجمالي البنود',sum.total,'pre-ltr'],
  ['جاري التنفيذ',sum.running,'warn-text'],
  ['لم يبدأ',sum.notStarted,'bad-text'],
  ['الإنجاز الفعلي',actual==null?'—':actual.toFixed(2)+'%','pre-ltr'],
  ['المخطط',planned==null?'—':planned.toFixed(2)+'%','pre-ltr'],
  ['الانحراف',variance==null?'—':(variance>=0?'+':'')+variance.toFixed(2)+'%',variance!=null&&variance<0?'bad-text':'ok-text']
 ],'pre-boq-summary');
 const body=rows.map(r=>'<tr>'+
  cell(r['Field / Item / Permit No.'],'pre-system-col')+
  cell(r['Text Value / Description'])+
  cell(r.Unit,'pre-num')+
  cell(fmtNum(r['Planned / Required Qty']),'pre-num')+
  cell(fmtNum(r['Executed / Issued Qty']),'pre-num')+
  cell(fmtNum(r['Period Qty']),'pre-num')+
  cell(r._completion==null?'—':r._completion.toFixed(2)+'%','pre-num')+
  cell(r['Weight / Planned Progress %']?fmtPct(r['Weight / Planned Progress %']):'—','pre-num')+
  cell(r.Status,'status '+statusClass(r.Status))+'</tr>').join('');
 return `<section class="pre-panel pre-boq-panel pre-table-page"><div class="pre-panel-head"><div><span>BOQ / PROGRESS</span><h3>بنود التنفيذ</h3></div><b>${rows.length}</b></div>${summary}${boqChart(rows)}<div class="pre-table-wrap"><table><thead><tr><th class="pre-system-col">الكود</th><th>البند</th><th>الوحدة</th><th>المخطط</th><th>المنفذ</th><th>الفترة</th><th>% إنجاز البند</th><th>الوزن</th><th>الحالة</th></tr></thead><tbody>${body}</tbody></table></div></section>`
}
function materialsBlock(rows,sum){
 if(!rows.length)return '';
 const summary=miniSummary([
  ['إجمالي الأصناف',sum.total,'pre-ltr'],
  ['مصروف بالكامل',sum.full,'ok-text'],
  ['مصروف جزئي',sum.partial,'warn-text'],
  ['لم يتم الصرف',sum.none,'bad-text']
 ],'pre-material-summary');
 const body=rows.map(r=>'<tr>'+cell(r['Text Value / Description'])+cell(r.Unit,'pre-num')+cell(fmtNum(r['Planned / Required Qty']),'pre-num')+cell(fmtNum(r['Executed / Issued Qty']),'pre-num')+cell(r.Status,'status '+statusClass(r.Status))+'</tr>').join('');
 return `<section class="pre-panel pre-material-panel pre-table-page"><div class="pre-panel-head"><div><span>MATERIAL CONTROL</span><h3>المواد</h3></div><b>${rows.length}</b></div>${summary}<div class="pre-table-wrap"><table><thead><tr><th>الصنف</th><th>الوحدة</th><th>المطلوب</th><th>المصروف</th><th>الحالة</th></tr></thead><tbody>${body}</tbody></table></div></section>`
}
function permitsBlock(rows,sum,issuedLen,doneLen,execution){
 if(!rows.length)return '';
 const summary=miniSummary([
  ['إجمالي التصاريح',sum.total,'pre-ltr'],
  ['تم الإصدار',sum.issued,'ok-text'],
  ['منتهي',sum.expired,'expired-text'],
  ['مرفوض',sum.rejected,'bad-text'],
  ['طلب ملغي',sum.cancelled,'cancelled-text'],
  ['قيد التنسيق والاعتماد',sum.coord,'warn-text']
 ],'pre-permit-summary');
 const body=rows.map(r=>'<tr>'+
  cell(r['Field / Item / Permit No.'])+
  cell(r['Responsible / Issuing Authority'])+
  cell(r['Location / Neighborhood'])+
  cell(r.Status,'status '+statusClass(r.Status))+
  cell(r['Start / Observation Date'],'pre-num')+
  cell(r['End / Expected Date'],'pre-num')+
  cell(fmtNum(r['Planned / Required Qty']),'pre-num')+
  cell(fmtNum(r['Executed / Issued Qty']),'pre-num')+'</tr>').join('');
 return `<section class="pre-panel pre-permits-panel pre-table-page"><div class="pre-panel-head"><div><span>PERMIT PORTFOLIO</span><h3>التصاريح التفصيلية</h3></div><div class="pre-mini-kpis"><span>أطوال الصادر <b class="pre-ltr">${fmtNum(issuedLen)} م</b></span><span>منجز على الصادر <b class="pre-ltr">${fmtNum(doneLen)} م</b></span><span>نسبة التنفيذ <b class="pre-ltr">${execution==null?'—':execution.toFixed(2)+'%'}</b></span></div></div>${summary}<div class="pre-table-wrap"><table><thead><tr><th>رقم / مرحلة التصريح</th><th>الجهة</th><th>الموقع</th><th>الحالة</th><th>البداية</th><th>النهاية</th><th>الطول</th><th>المنجز</th></tr></thead><tbody>${body}</tbody></table></div></section>`
}
function extraBlock(rows){
 const hidden=new Set(['PROJECT_TITLE','DETAILED_WORK_DESCRIPTION','ACTUAL_START_DATE','EXPECTED_OPERATION_DATE','SEC_FOLLOWUP_ENGINEER','REPORT_DATE','CONTRACTOR_REPORT_NAME','CONTRACTUAL_DURATION_DAYS','CONSULTANT_NAME','REPORT_TYPE','REPORT_NO']);
 const show=rows.filter(r=>!hidden.has(r['Field / Item / Permit No.']));
 if(!show.length)return '';
 return `<section class="pre-panel pre-print-section"><div class="pre-panel-head"><div><span>REPORT-SPECIFIC DATA</span><h3>بيانات إضافية خاصة بالتقرير</h3></div></div><div class="pre-extra-grid">${show.map(r=>'<div><small>'+esc(r['Field / Item / Permit No.'])+'</small><b>'+esc(extraValue(r)||'—')+'</b></div>').join('')}</div></section>`
}

function photosManagerBlock(){
 return '<section class="pre-panel pre-photos-manager" id="prePhotosPanel">'+
 '<div class="pre-panel-head"><div><span>SITE EXECUTION PHOTOS</span><h3>صور التنفيذ بالموقع</h3></div><div class="pre-mini-kpis"><span id="prePhotosSummary">0 / 8 صور محفوظة</span></div></div>'+
 '<p class="pre-photos-help">ارفع حتى 8 صور، واكتب تعليق كل صورة ثم اضغط حفظ الصورة والتعليق. ستظهر بنفس الترتيب في Excel وفي صفحة مستقلة بعد الخريطة داخل PDF.</p>'+
 '<div id="prePhotosGrid" class="pre-photos-grid"></div></section>';
}
function imageAt(slot){return (state.images||[]).find(x=>Number(x.slot)===Number(slot))||null}
function photoCaption(slot){const saved=imageAt(slot)?.caption||'';return Object.prototype.hasOwnProperty.call(state.photoDraft,slot)?state.photoDraft[slot]:saved}
function isCaptionDirty(slot){return clean(photoCaption(slot))!==clean(imageAt(slot)?.caption||'')}
function hasUnsavedPhotos(){return Object.keys(state.photoPending||{}).length>0||Array.from({length:8},(_,i)=>i+1).some(isCaptionDirty)}
function updatePhotoSummary(message){
 const el=$('prePhotosSummary');if(!el)return;
 const saved=(state.images||[]).filter(x=>x.dataUrl).length,dirty=hasUnsavedPhotos();
 el.textContent=message||(saved+' / 8 صور محفوظة'+(dirty?' • توجد تعديلات غير محفوظة':''));
}
function renderPhotoManager(message){
 const grid=$('prePhotosGrid');if(!grid)return;
 const ready=!!state.report&&!!state.wo&&!state.loading;
 let html='';
 for(let slot=1;slot<=8;slot++){
  const saved=imageAt(slot),pending=state.photoPending[slot],src=pending||saved?.dataUrl||'',caption=photoCaption(slot),busy=!!state.photoBusy[slot],dirty=!!pending||isCaptionDirty(slot);
  html+='<article class="pre-photo-card'+(dirty?' dirty':'')+'" data-photo-slot="'+slot+'">'+
   '<div class="pre-photo-head"><b>الصورة '+slot+'</b><span>'+(saved?.dataUrl?'محفوظة':'فارغة')+(pending?' • جديدة':'')+'</span></div>'+
   '<div class="pre-photo-preview">'+(src?'<img src="'+esc(src)+'" alt="صورة تنفيذ '+slot+'">':'<div><b>لا توجد صورة</b><span>ارفع صورة من الموقع</span></div>')+'</div>'+
   '<textarea data-photo-caption="'+slot+'" maxlength="800" placeholder="اكتب تعليق الصورة..." '+(!ready||busy?'disabled':'')+'>'+esc(caption)+'</textarea>'+
   '<div class="pre-photo-actions">'+
    '<label class="pre-photo-upload'+(!ready||busy?' disabled':'')+'">⬆ '+(src?'استبدال الصورة':'رفع الصورة')+'<input type="file" accept="image/*" data-photo-file="'+slot+'" '+(!ready||busy?'disabled':'')+'></label>'+
    '<button type="button" class="pre-photo-save" data-photo-save="'+slot+'" '+(!ready||busy||!src?'disabled':'')+'>'+(busy?'جاري الحفظ...':'حفظ الصورة والتعليق')+'</button>'+
    '<button type="button" class="pre-photo-delete" data-photo-delete="'+slot+'" '+(!ready||busy||(!src&&!saved)?'disabled':'')+'>حذف</button>'+
   '</div>'+
  '</article>';
 }
 grid.innerHTML=html;
 updatePhotoSummary(message||(!ready?'أنشئ التقرير أولاً لرفع الصور':''));
}
async function loadProjectImages(wo){
 const r=await fetch('/api/projects-report-engine/images/'+encodeURIComponent(wo),{cache:'no-store'});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||j.ok===false)throw new Error(j.error||'تعذر تحميل صور التنفيذ');
 state.images=Array.isArray(j.images)?j.images:[];
 state.photoPending={};state.photoDraft={};state.photoBusy={};
 state.images.forEach(x=>{state.photoDraft[Number(x.slot)]=x.caption||''});
 renderPhotoManager();
 return state.images;
}
function handlePhotoCaptionInput(e){
 const t=e.target.closest('[data-photo-caption]');if(!t)return;
 const slot=Number(t.dataset.photoCaption);state.photoDraft[slot]=t.value;updatePhotoSummary();
 t.closest('.pre-photo-card')?.classList.toggle('dirty',isCaptionDirty(slot)||!!state.photoPending[slot]);
}
async function handlePhotoFileChange(e){
 const input=e.target.closest('[data-photo-file]');if(!input||!input.files?.[0])return;
 const slot=Number(input.dataset.photoFile);
 try{
  state.photoBusy[slot]=true;renderPhotoManager('جاري تجهيز الصورة '+slot+'...');
  state.photoPending[slot]=await compressPhotoFile(input.files[0]);
 }catch(err){alert(err.message||String(err))}
 finally{state.photoBusy[slot]=false;renderPhotoManager()}
}
async function handlePhotoAction(e){
 const save=e.target.closest('[data-photo-save]'),del=e.target.closest('[data-photo-delete]');
 if(save){await savePhotoSlot(Number(save.dataset.photoSave));return}
 if(del){await deletePhotoSlot(Number(del.dataset.photoDelete))}
}
function replaceSavedImage(image){
 const slot=Number(image.slot),rest=(state.images||[]).filter(x=>Number(x.slot)!==slot);
 state.images=[...rest,image].sort((a,b)=>Number(a.slot)-Number(b.slot));
}
async function savePhotoSlot(slot){
 if(!state.report||!state.wo)return alert('أنشئ التقرير أولاً.');
 const saved=imageAt(slot),dataUrl=state.photoPending[slot]||saved?.dataUrl||'',caption=photoCaption(slot);
 if(!dataUrl)return alert('اختر صورة أولاً.');
 state.photoBusy[slot]=true;renderPhotoManager('جاري حفظ الصورة '+slot+'...');
 try{
  const r=await fetch('/api/projects-report-engine/images/'+encodeURIComponent(state.wo)+'/'+slot,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caption,dataUrl})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.ok===false)throw new Error(j.error||'تعذر حفظ الصورة');
  replaceSavedImage(j.image);delete state.photoPending[slot];state.photoDraft[slot]=j.image.caption||'';
 }catch(err){alert(err.message||String(err))}
 finally{state.photoBusy[slot]=false;renderPhotoManager()}
}
async function deletePhotoSlot(slot){
 if(!state.report||!state.wo)return;
 if(!confirm('حذف الصورة '+slot+' وتعليقها من التقرير؟'))return;
 state.photoBusy[slot]=true;renderPhotoManager('جاري حذف الصورة '+slot+'...');
 try{
  const r=await fetch('/api/projects-report-engine/images/'+encodeURIComponent(state.wo)+'/'+slot,{method:'DELETE'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.ok===false)throw new Error(j.error||'تعذر حذف الصورة');
  state.images=(state.images||[]).filter(x=>Number(x.slot)!==slot);delete state.photoPending[slot];delete state.photoDraft[slot];
 }catch(err){alert(err.message||String(err))}
 finally{state.photoBusy[slot]=false;renderPhotoManager()}
}
function canvasBlob(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('تعذر ضغط الصورة.')),'image/jpeg',quality))}
function blobDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('تعذر قراءة الصورة.'));r.readAsDataURL(blob)})}
async function compressPhotoFile(file){
 if(!file||!String(file.type||'').startsWith('image/'))throw new Error('اختر ملف صورة صالحًا.');
 if(file.size>25*1024*1024)throw new Error('حجم الصورة الأصلية كبير جدًا.');
 const url=URL.createObjectURL(file),img=new Image();
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('تعذر فتح الصورة.'));img.src=url});
  let maxW=1500,maxH=1100,scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight);
  let w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
  let canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  let ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
  let q=.86,blob=await canvasBlob(canvas,q);
  while(blob.size>480*1024&&q>.58){q-=.07;blob=await canvasBlob(canvas,q)}
  if(blob.size>520*1024){
   const c2=document.createElement('canvas');c2.width=Math.round(w*.78);c2.height=Math.round(h*.78);
   const c2x=c2.getContext('2d');c2x.fillStyle='#fff';c2x.fillRect(0,0,c2.width,c2.height);c2x.drawImage(canvas,0,0,c2.width,c2.height);
   canvas=c2;blob=await canvasBlob(canvas,.64);
  }
  const dataUrl=await blobDataUrl(blob);
  if(String(dataUrl).length>880000)throw new Error('لم يمكن ضغط الصورة للحجم المناسب. اختر صورة أصغر.');
  return dataUrl;
 }finally{URL.revokeObjectURL(url)}
}
function photosPdfBlock(images){
 const by=new Map((images||[]).map(x=>[Number(x.slot),x]));let cards='';
 for(let slot=1;slot<=8;slot++){
  const x=by.get(slot),src=x?.dataUrl||'',caption=clean(x?.caption)||'بدون تعليق';
  cards+='<article class="pre-photo-pdf-card">'+
   (src?'<img src="'+esc(src)+'" alt="صورة تنفيذ '+slot+'">':'<div class="pre-photo-pdf-empty">لا توجد صورة</div>')+
   '<div class="pre-photo-pdf-caption"><b>الصورة '+slot+'</b><span>'+esc(caption)+'</span></div></article>';
 }
 return '<section class="pre-panel pre-photos-pdf-panel pre-print-section" id="prePhotosPdfPanel"><div class="pre-panel-head"><div><span>SITE EXECUTION PHOTOS</span><h3>صور التنفيذ بالموقع</h3></div><b>8 خانات</b></div><div class="pre-photos-pdf-grid">'+cards+'</div></section>';
}

function mapBlock(){
 return '<section class="pre-panel pre-map-panel pre-print-section" id="preMapPanel">'+
 '<div class="pre-panel-head"><div><span>GEOGRAPHIC CONTROL / KMZ</span><h3>خريطة أمر العمل والطبقات الجغرافية</h3></div><div class="pre-mini-kpis"><span id="preMapSummary">جاهزة لرفع KMZ / KML</span></div></div>'+
 '<div class="pre-map-upload-row"><button id="preMapKmzUploadBtn" class="pre-map-kmz-upload" type="button">⬆ رفع KMZ متعدد</button><input id="preMapKmzFileInput" class="map-file-input" type="file" accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml" multiple><span>يمكن اختيار أكثر من ملف KMZ / KML في نفس المرة أو إضافة ملفات جديدة لاحقًا؛ كل ملف يظهر كطبقة مستقلة.</span></div>'+
 '<div class="pre-map-toolbar">'+
  '<div class="pre-map-tools">'+
   '<button type="button" class="pre-map-tool active" id="preMapStreetBtn">خريطة الشوارع</button>'+
   '<button type="button" class="pre-map-tool" id="preMapSatelliteBtn">صور جوية</button>'+
   '<button type="button" class="pre-map-tool active" id="preMapLocationLayerBtn">موقع أمر العمل</button>'+
   '<button type="button" class="pre-map-tool" id="preMapFitBtn">⌖ ملاءمة</button>'+
   '<button type="button" class="pre-map-tool" id="preMapResetBtn">↺ إعادة الضبط</button>'+
   '<button type="button" class="pre-map-tool" id="preMapFullscreenBtn">⛶ توسعة</button>'+


  '</div>'+
  '<div class="pre-map-search-wrap"><input id="preMapSearchInput" type="search" autocomplete="off" placeholder="بحث داخل مواقع أمر العمل..."><div id="preMapSearchResults" class="pre-map-search-results"></div></div>'+
 '</div>'+
 '<div id="preMapKmzLayers" class="map-kmz-layers" aria-live="polite"></div>'+
 '<div class="map-stage pre-map-stage" id="preProjectMapStage"><div id="preProjectMap" class="pre-map-canvas"></div>'+
 '<div class="pre-map-legend"><span><i class="pre-map-dot"></i> موقع من بيانات أمر العمل</span><span class="map-kmz-legend"><i></i> KMZ / KML</span><em id="preMapVisibleSummary">—</em></div></div>'+
 '<div id="preMapMessage" class="pre-map-message">يمكن رفع أكثر من ملف KMZ/KML أو سحب الملف وإفلاته مباشرة على الخريطة.</div>'+
 '</section>';
}
function geoDigits(v){
 return String(v==null?'':v).replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/٫/g,'.').replace(/،/g,',');
}
function geoPair(a,b){
 a=Number(a);b=Number(b);
 const latOk=x=>Number.isFinite(x)&&x>=15&&x<=33,lonOk=x=>Number.isFinite(x)&&x>=34&&x<=56;
 if(latOk(a)&&lonOk(b))return [a,b];
 if(lonOk(a)&&latOk(b))return [b,a];
 return null;
}
function geoPairFromText(v){
 let s=geoDigits(v);try{s=decodeURIComponent(s)}catch(e){}
 const patterns=[
  /@(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
  /[?&](?:q|query|ll|center|destination)=(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i,
  /(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/
 ];
 for(const re of patterns){const m=s.match(re);if(m){const p=geoPair(m[1],m[2]);if(p)return p}}
 return null;
}
function extractReportLocations(data){
 const out=[],seen=new Set(),push=(lat,lon,label,source,fields)=>{
  const p=geoPair(lat,lon);if(!p)return;
  const key=p[0].toFixed(6)+','+p[1].toFixed(6);if(seen.has(key))return;seen.add(key);
  out.push({lat:p[0],lon:p[1],label:clean(label)||('موقع '+(out.length+1)),source:clean(source),fields:(fields||[]).filter(x=>clean(x.value)).slice(0,10)});
 };
 (data?.sources||[]).forEach(src=>(src.records||[]).forEach(rec=>{
  const fields=(rec.fields||[]).map(f=>({label:clean(f.label),value:clean(f.value)})).filter(f=>f.label||f.value);
  let lat=null,lon=null;
  fields.forEach(f=>{
   const n=norm(f.label),v=geoDigits(f.value).trim();
   if(/^-?\d{1,3}(?:\.\d+)?$/.test(v)){
    if(n==='lat'||n.includes('latitude')||n.includes('خط العرض')||n.includes('احداثي شمال')||n.includes('الاحداثي شمال'))lat=Number(v);
    if(n==='lon'||n==='lng'||n==='long'||n.includes('longitude')||n.includes('خط الطول')||n.includes('احداثي شرق')||n.includes('الاحداثي شرق'))lon=Number(v);
   }
  });
  const label=fields.find(f=>/وصف|مشروع|موقع|محطه|محطة|station|project|location/i.test(norm(f.label)))?.value||('أمر العمل '+(data.workOrder||''));
  if(lat!=null&&lon!=null)push(lat,lon,label,src.sheet,fields);
  fields.forEach(f=>{
   const n=norm(f.label);
   if(!/موقع|احداث|coordinate|location|link|رابط|خرائط|maps/i.test(n)&&!/https?:\/\//i.test(f.value))return;
   const p=geoPairFromText(f.value);if(p)push(p[0],p[1],label,src.sheet,fields);
  });
 }));
 return out;
}
function reportMapPopup(loc){
 const details=(loc.fields||[]).filter(f=>clean(f.label)&&clean(f.value)).slice(0,8).map(f=>'<div><span>'+esc(f.label)+'</span><b>'+esc(f.value)+'</b></div>').join('');
 return '<div class="map-popup-card"><div class="map-card-head"><span class="map-kind project">أمر العمل</span><b>'+esc(loc.label)+'</b></div><div class="map-card-grid">'+
 '<div><span>المصدر</span><b>'+esc(loc.source||'بيانات المشروع')+'</b></div><div><span>الإحداثيات</span><b class="pre-ltr">'+loc.lat.toFixed(6)+', '+loc.lon.toFixed(6)+'</b></div>'+details+'</div></div>';
}
function initReportMap(data){
 const host=$('preProjectMap');if(!host)return;
 if(state.map){try{state.map.remove()}catch(e){}state.map=null;state.mapManager=null}
 if(!window.L){host.innerHTML='<div class="pre-map-empty"><b>تعذر تحميل الخريطة</b><span>تحقق من الاتصال بالإنترنت ثم أعد تحميل الصفحة.</span></div>';return}
 const L=window.L,brand=getBrand(),center=brand.code==='MAK'?[21.4225,39.8262]:brand.code==='JED'?[21.5433,39.1728]:[21.5,39.5];
 const map=L.map(host,{zoomControl:true,attributionControl:true,preferCanvas:true}).setView(center,12);state.map=map;state.mapSnapshot='';
 const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,crossOrigin:true,attribution:'&copy; OpenStreetMap'});
 const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,crossOrigin:true,attribution:'Tiles &copy; Esri'});
 street.addTo(map);
 const locationLayer=L.layerGroup().addTo(map);
 L.control.layers({'خريطة الشوارع':street,'صور جوية':satellite},{'موقع أمر العمل':locationLayer},{position:'bottomright',collapsed:true}).addTo(map);
 const locations=extractReportLocations(data);state.mapLocations=locations;
 const searchItems=[],locationBounds=L.latLngBounds([]);
 locations.forEach((loc,i)=>{
  const marker=L.circleMarker([loc.lat,loc.lon],{radius:7,color:'#fff',weight:2,fillColor:'#168a72',fillOpacity:.96});
  marker.bindTooltip(esc(loc.label),{direction:'top',sticky:true,opacity:.97,className:'vd-map-tooltip'});
  marker.bindPopup(reportMapPopup(loc),{maxWidth:440,className:'vd-map-popup'});
  marker.addTo(locationLayer);locationBounds.extend([loc.lat,loc.lon]);
  searchItems.push({label:loc.label,search:norm([loc.label,loc.source,...loc.fields.map(f=>f.label+' '+f.value)].join(' ')),marker,lat:loc.lat,lon:loc.lon});
 });
 const message=$('preMapMessage'),say=msg=>{if(message)message.textContent=msg};
 const updateSummary=(kmzVisible,kmzTotal)=>{
  const summary=$('preMapSummary'),visible=$('preMapVisibleSummary'),parts=[];
  if(locations.length)parts.push(locations.length+' موقع');else parts.push('لا توجد إحداثيات مباشرة');
  if(kmzTotal)parts.push(kmzVisible+' / '+kmzTotal+' KMZ');
  if(summary)summary.textContent=parts.join(' • ');
  if(visible)visible.textContent=parts.join(' • ');
 };
 const fitAll=()=>{
  const b=L.latLngBounds([]);if(locationBounds.isValid())b.extend(locationBounds);state.mapManager?.extendBounds?.(b);
  if(b.isValid())map.fitBounds(b,{padding:[42,42],maxZoom:16});else map.setView(center,12);
 };
 state.mapManager=window.VDKMZ?.init({
  workOrder:data?.workOrder,
  map,input:$('preMapKmzFileInput'),button:$('preMapKmzUploadBtn'),host:$('preMapKmzLayers'),stage:$('preProjectMapStage'),toast:say,
  onSummary:(visible,total)=>{updateSummary(visible,total);setTimeout(fitAll,60)}
 })||null;
 updateSummary(state.mapManager?.visibleCount?.()||0,state.mapManager?.totalCount?.()||0);
 const setBase=which=>{
  if(which==='satellite'){if(map.hasLayer(street))map.removeLayer(street);if(!map.hasLayer(satellite))satellite.addTo(map)}
  else{if(map.hasLayer(satellite))map.removeLayer(satellite);if(!map.hasLayer(street))street.addTo(map)}
  $('preMapStreetBtn')?.classList.toggle('active',which==='street');$('preMapSatelliteBtn')?.classList.toggle('active',which==='satellite');
 };
 $('preMapStreetBtn').onclick=()=>setBase('street');$('preMapSatelliteBtn').onclick=()=>setBase('satellite');
 $('preMapLocationLayerBtn').onclick=e=>{const b=e.currentTarget;if(map.hasLayer(locationLayer)){map.removeLayer(locationLayer);b.classList.remove('active')}else{locationLayer.addTo(map);b.classList.add('active')}};
 $('preMapFitBtn').onclick=fitAll;
 $('preMapResetBtn').onclick=()=>{setBase('street');if(!map.hasLayer(locationLayer))locationLayer.addTo(map);$('preMapLocationLayerBtn')?.classList.add('active');const q=$('preMapSearchInput');if(q)q.value='';const rr=$('preMapSearchResults');if(rr){rr.innerHTML='';rr.classList.remove('show')}fitAll();say('تمت إعادة ضبط الخريطة')};
 const panel=$('preMapPanel'),full=$('preMapFullscreenBtn');
 if(panel&&full)full.onclick=()=>{panel.classList.toggle('pre-map-fullscreen');document.body.classList.toggle('pre-map-fullscreen-open',panel.classList.contains('pre-map-fullscreen'));full.textContent=panel.classList.contains('pre-map-fullscreen')?'✕ إغلاق التوسعة':'⛶ توسعة';setTimeout(()=>{map.invalidateSize();fitAll()},180)};
 const q=$('preMapSearchInput'),results=$('preMapSearchResults'),close=()=>{if(results){results.innerHTML='';results.classList.remove('show')}};
 if(q&&results){q.oninput=()=>{const x=norm(q.value);if(x.length<2){close();return}const hits=searchItems.map((v,i)=>({...v,i})).filter(v=>v.search.includes(x)).slice(0,12);results.innerHTML=hits.length?hits.map(v=>'<button type="button" data-pre-map-result="'+v.i+'"><span>موقع</span><b>'+esc(v.label)+'</b></button>').join(''):'<div class="pre-map-search-empty">لا توجد نتائج مطابقة</div>';results.classList.add('show')};results.onclick=e=>{const b=e.target.closest('[data-pre-map-result]');if(!b)return;const x=searchItems[Number(b.dataset.preMapResult)];if(!x)return;if(!map.hasLayer(locationLayer))locationLayer.addTo(map);map.setView([x.lat,x.lon],17,{animate:true});x.marker.openPopup();q.value=x.label;close()}};
 setTimeout(()=>{map.invalidateSize();fitAll()},180);
}
async function captureReportMap(){
 const stage=document.getElementById('preProjectMapStage')||document.getElementById('preProjectMap');
 if(!stage||!state.map||typeof window.html2canvas!=='function')return '';
 try{
  state.map.invalidateSize();await new Promise(r=>setTimeout(r,300));
  const canvas=await Promise.race([window.html2canvas(stage,{useCORS:true,allowTaint:false,backgroundColor:'#eef5f7',scale:1.6,logging:false,ignoreElements:el=>el.classList?.contains('leaflet-control-container')}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Map capture timeout')),12000))]);
  state.mapSnapshot=canvas.toDataURL('image/png',.94);return state.mapSnapshot;
 }catch(e){console.warn('Projects Report map capture failed',e);return ''}
}

function getBrand(){
 const box=document.querySelector('.brand-copy');
 const city=clean(box?.querySelector('strong')?.textContent)||'إدارة الكهرباء';
 const contract=clean(box?.querySelector('em')?.textContent)||'';
 return{city,contract,code:norm(city).includes('مكه')?'MAK':norm(city).includes('جده')?'JED':'PDC'}
}
function compactDate(v){const d=dateObj(v);if(!d)return String(v||'').replace(/\D/g,'');return String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')}
function methodologyAppendix(){
 const calculationExamples=[["إنجاز البند", "نسبة الإنجاز = MIN(100, 100 × إجمالي المنفذ ÷ الكمية المخططة)", "2,000 ÷ 6,900 × 100 = 28.99%"], ["مساهمة البند", "مساهمة البند = وزن البند (%) × نسبة إنجازه (%) ÷ 100", "25 × 20 ÷ 100 = 5 نقاط"], ["الإنجاز الكلي", "الإنجاز الكلي = مجموع مساهمات البنود، بشرط مجموع الأوزان = 100%", "مجموع المساهمات الموزونة"], ["المدة النهائية", "المدة النهائية = المدة التعاقدية + أيام الجمعة داخلها بدءاً من تاريخ البدء", "40 + 6 = 46 يوماً"], ["المخطط التراكمي", "المخطط = MIN(100, الأيام المنقضية × 100 ÷ المدة النهائية)", "3 × 100 ÷ 46 = 6.52%"], ["الانحراف", "الانحراف بالنقاط = الإنجاز الفعلي الكلي − المخطط التراكمي", "10.16 − 6.52 = +3.64 نقطة"], ["إنجاز الفترة", "إنجاز الفترة = الإنجاز الحالي − أحدث إنجاز سابق مؤرخ؛ السالب/المفقود يعرض —", "10.16 − 8.20 = 1.96 نقطة"], ["المتبقي من الكميات", "المتبقي = MAX(0, الكمية المخططة − إجمالي المنفذ)", "6,900 − 2,000 = 4,900 متر"], ["حالة البند", "عند صفر: لم يبدأ؛ عند 100%: مكتمل؛ خلاف ذلك تُقارن المساهمة الفعلية بالمخططة", "متقدم / حسب المخطط / متأخر"], ["المعدل اليومي المطلوب", "المعدل = (100 − الإنجاز الكلي) ÷ المدة المستخدمة بالمؤشر", "معدل تقديري وليس المنفذ اليومي"], ["نسبة صرف المادة", "نسبة الصرف = 100 × المصروف ÷ المطلوب", "يحسب لكل مادة ووحدتها"], ["تنفيذ أطوال التصاريح", "نسبة التنفيذ = 100 × مجموع المنجز الصادر ÷ مجموع الأطوال الصادرة", "تستبعد الحالات غير الصادرة"]];

 const sections=[
 ['01','مصادر البيانات','يجمع التقرير بيانات أوامر العمل والسجلات التكميلية في Projects Report Engine Data. LIVE مصدر مباشر، EXTRA بيانات مكملة، CALC حساب آلي، وCALC-BOQ حساب من جدول البنود.'],
 ['02','إنجاز البند','يُقرأ إجمالي التنفيذ التراكمي والكمية المستهدفة لنفس البند وبنفس الوحدة. نسبة الإنجاز = (إجمالي المنفذ ÷ الكمية المخططة) × 100، ويُحدّد العرض عند 100% حتى إذا تجاوز التنفيذ الكمية. مثال: تنفيذ 2,000 متر من 6,900 متر = 28.99%. عند غياب الكمية المخططة أو كونها صفراً لا يُعتمد المؤشر، وتُراجع قيمة البند قبل إصدار التقرير.'],
 ['03','الإنجاز الكلي','يُضرب إنجاز كل بند في وزنه النسبي، ثم تُجمع مساهمات البنود للحصول على الإنجاز الكلي للمشروع: مجموع (وزن البند × نسبة إنجازه). مثال: بند وزنه 25% وإنجازه 20% يضيف 5 نقاط مئوية إلى الإجمالي. يجب أن يبلغ مجموع أوزان جميع البنود 100% وأن تكون الكميات صحيحة، ولا يجوز جمع أطوال وأعداد ووحدات مختلفة مباشرة بوصفها نسبة إنجاز واحدة.'],
 ['04','الإنجاز المخطط','المدة النهائية المستخدمة في التخطيط = المدة التعاقدية + أيام الجمعة الواقعة داخل المدة التعاقدية ابتداءً من تاريخ بدء التنفيذ الفعلي، وفق قاعدة المشروع المعتمدة. يُحسب معدل التخطيط اليومي = 100 ÷ المدة النهائية؛ ثم الإنجاز التراكمي المخطط = المعدل × الأيام المنقضية حتى تاريخ التقرير، ويُحصر بين 0 و100%. يجب تدقيق تاريخ البدء ومرجع يوم التقرير عند مراجعة أي اختلاف.'],
 ['05','الانحراف والحالة','الانحراف بالنقاط المئوية = الإنجاز الفعلي الكلي − الإنجاز المخطط التراكمي. موجب يعني التقدم، وسالب التأخر، وصفر المطابقة؛ بينما الحالة تتبع قواعد التصنيف المبرمجة.'],
 ['06','إنجاز الفترة منذ آخر تقرير','إنجاز الفترة هو الفرق بالنقاط المئوية بين الإنجاز التراكمي الحالي المحسوب من البنود الموزونة، وأحدث إنجاز تراكمي سابق مؤرخ في سجل PLAN_POINT. مثال: 10.16% حالياً مقابل 8.20% سابقاً = 1.96 نقطة. إذا غاب السجل السابق تظهر (—) بدلاً من اعتبار البداية صفراً. وإذا كانت القراءة السابقة أكبر من الحالية تُوقف النتيجة السالبة ويُلزم تدقيق التاريخ أو الكميات قبل اعتماد التقرير.'],
 ['07','المعدل اليومي المطلوب','المعدل اليومي المطلوب لاستكمال المشروع = (100 − الإنجاز الكلي) ÷ أيام التنفيذ المتبقية من تاريخ التقرير المرجعي وحتى نهاية المدة. إذا انتهت المدة ولم يكتمل المشروع تظهر حالة تستوجب إعادة التخطيط. المؤشر مختلف عن إنجاز الفترة اليومية.'],
 ['08','أيام التنفيذ المنقضية','تُحسب من تاريخ البدء الفعلي حتى تاريخ التقرير المرجعي شاملًا تاريخ البدء، مع استبعاد الجمعة فقط، والسبت محسوب. تقرير اليوم السابق يظل مرجعه ذلك اليوم حتى لو صُدّر صباح اليوم التالي.'],
 ['09','الكميات والمواد','المتبقي = المطلوب − المنفذ/المنصرف. حالة التنفيذ: لم يبدأ عند الصفر، جاري عند التنفيذ الجزئي، ومنجز عند اكتمال المطلوب. وحالة المواد تعكس عدم الصرف أو الصرف الجزئي أو الكامل.'],
 ['10','التصاريح والوثائق','ملخص التصاريح يحصي الحالات المسجلة. تعرض الخريطة مواقع وطبقات KMZ/KML الظاهرة عند التصدير؛ الصور وتعليقاتها توثيق للأعمال ولا تحل محل قياس الكميات.'],
 ['11','العوائق والتحقق','تُعرض المخاطر بحسب أثرها وحالتها وتاريخها. راجع أوزان البنود، تواريخ آخر تقرير، الكميات، ومصدر كل مؤشر قبل اعتماد النتائج.'],
 ['12','التحقق من الجودة','تُراجع مصادر المؤشرات قبل اعتماد التقرير: هل مجموع الأوزان 100%؟ هل تتطابق كميات البنود مع سجل المقاول؟ هل أحدث سجل إنجاز أقدم من تاريخ التقرير؟ وهل توجد اختلافات بين الجدول والكارت والرسم البياني؟ عند وجود اختلاف توضح الملاحظة مصدره دون استبدال البيانات تلقائياً.'],
 ['13','تفسير الرسم التراكمي','المنحنى الأزرق يمثل نسب الإنجاز التراكمية الفعلية المسجلة في تواريخها، والمنحنى الآخر يمثل نسب التخطيط في التواريخ ذاتها. انحدار الخط يوضح سرعة التقدم لا حجم الأعمال وحده، وتقارب الخطين يعني تقارب الأداء، ولا تُستنتج نتيجة نهائية من نقطة واحدة.'],
 ['14','التوثيق والاعتماد','صور التنفيذ توثيق بصري للموقع وتشمل أوصاف الأعمال وتواريخها وفق المتاح. الخريطة وسيلة لتحديد مواقع الأعمال وليست اعتماداً مساحياً للكميات. يتحقق معد التقرير من المرفقات والأوصاف والمواقع، ويعتمد المسؤول النتائج بعد مطابقتها مع سجلات المشروع.'],
 ['15','قراءة الإشارات اللونية','الأخضر يبرز الحالات المكتملة أو السليمة، والأزرق يعرض المعلومات ومؤشرات المتابعة، والبرتقالي ينبه إلى حالات تتطلب متابعة، والأحمر يشير إلى تعثر أو ملاحظة تستوجب التحقق. لا تُعتمد الألوان وحدها؛ اقرأ النص والقيمة وتاريخها والمصدر المصاحب.']
 ];
 return '<section class="pre-guide-appendix"><header class="pre-guide-title"><span>APPENDIX · REPORT METHODOLOGY</span><h2>دليل قراءة التقرير ومنهجية الاحتساب</h2><p>ملحق تفسيري ثابت، يُرفق تلقائياً بتقرير PDF ولا يُغيّر البيانات الأساسية.</p></header><div class="pre-guide-grid">'+sections.map(s=>'<article class="pre-guide-item"><b>'+s[0]+'</b><div><h3>'+s[1]+'</h3><p>'+s[2]+'</p></div></article>').join('')+'</div><section class="pre-formula-appendix"><h2>معادلات الاحتساب وأمثلة تطبيقية</h2><p>توضيحات حسابية مرجعية للبطاقات والمؤشرات.</p><div class="pre-formula-grid">'+calculationExamples.map((f,i)=>'<article class="pre-formula-card"><b>'+String(i+1).padStart(2,'0')+'</b><div><h3>'+f[0]+'</h3><p>'+f[1]+'</p><small>'+f[2]+'</small></div></article>').join('')+'</div></section><div class="pre-guide-foot"><strong>ملاحظة اعتماد:</strong> في حال اختلاف قيمة داخل البطاقة عن الرسم البياني أو السجل التاريخي، يجب مراجعة المصدر وتاريخ التقرير قبل الاعتماد النهائي.</div></section>';
}
async function printReport(){
 if(!state.report||!document.querySelector('#preBody.pre-report')){alert('أنشئ التقرير أولاً ثم اضغط تصدير التقرير PDF.');return}
 const brand=getBrand(),r=state.report,title='VD-PDC-'+brand.code+'-WO-'+r.workOrder+'-'+compactDate(r.rdate)+'-R01';
 const win=window.open('','_blank','width=1400,height=900');
 if(!win){alert('يرجى السماح بالنوافذ المنبثقة لتصدير PDF.');return}
 win.document.open();
 win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(title)+'</title></head><body style="font-family:Arial,Tahoma,sans-serif;padding:40px;text-align:center;color:#36516f">جاري تجهيز التقرير والخريطة...</body></html>');
 win.document.close();
 const mapImage=await captureReportMap();
 if(win.closed)return;
 const clone=document.querySelector('#preBody.pre-report').cloneNode(true);
 clone.querySelectorAll('.pre-system-col,.pre-source-note,.vd-universal-info,.calc-help-btn,.vd-info-host > .vd-universal-info').forEach(x=>x.remove());
 clone.querySelectorAll('.pre-table-wrap').forEach(x=>{x.style.overflow='visible'});
 let mapPanel=clone.querySelector('#preMapPanel');
 if(!mapPanel){mapPanel=document.createElement('section');const before=clone.querySelector('.pre-risk-panel,.pre-narrative-panel');if(before)before.before(mapPanel);else clone.appendChild(mapPanel)}
 if(mapPanel){
  const visibleKmz=(window.VDKMZ?.uploads||[]).filter(x=>x.visible).length,totalKmz=(window.VDKMZ?.uploads||[]).length;
  const summary=(state.mapLocations.length?state.mapLocations.length+' موقع من بيانات أمر العمل':'لا توجد إحداثيات مباشرة')+(totalKmz?' • '+visibleKmz+' من '+totalKmz+' طبقة KMZ/KML':'');
  mapPanel.className='pre-panel pre-map-pdf-panel pre-print-section';
  mapPanel.innerHTML='<div class="pre-panel-head"><div><span>GEOGRAPHIC CONTROL / KMZ</span><h3>الخريطة والطبقات الجغرافية</h3></div><b>'+esc(summary)+'</b></div>'+
   (mapImage?'<img class="pre-map-pdf-image" src="'+mapImage+'" alt="خريطة أمر العمل والطبقات الجغرافية">':'<div class="pre-map-pdf-missing">تعذر التقاط صورة الخريطة آليًا. أعد فتح التقرير بعد اكتمال تحميل الخريطة.</div>');
 }
 const photoWrap=document.createElement('div');photoWrap.innerHTML=photosPdfBlock(state.images);
 const photoPanel=photoWrap.firstElementChild;if(photoPanel){if(mapPanel)mapPanel.after(photoPanel);else clone.appendChild(photoPanel)}
 clone.insertAdjacentHTML('beforeend',methodologyAppendix());
 const css=printCss();
 win.document.open();
 win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+css+'</style></head><body>'+
 '<div class="pdf-watermark" aria-hidden="true"><img src="'+location.origin+'/company-logo.png" alt=""></div>'+
 '<header class="pdf-header"><div class="pdf-brand"><img src="'+location.origin+'/company-logo.png" alt="شعار أبعاد الرؤية"><div><b>شركة أبعاد الرؤية للاستشارات الهندسية</b><span>'+esc(brand.city)+'</span></div></div><div class="pdf-meta"><span>PROJECT CONTROL • WO '+esc(r.workOrder)+'</span><img class="pdf-pdc-logo" src="'+location.origin+'/pdc-logo.jpg" alt="شعار PDC"></div></header>'+
 '<main class="pdf-main">'+clone.outerHTML+'</main>'+
 '<footer class="pdf-footer"><span>Vision Dimensions Engineering Consultancy</span><span>'+esc(brand.contract)+'</span><span>WO '+esc(r.workOrder)+'</span></footer>'+
 '</body></html>');
 win.document.close();
 const go=async()=>{
  const imgs=[...win.document.images];
  await Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{const timer=setTimeout(resolve,8000);const done=()=>{clearTimeout(timer);resolve()};img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true})})));
  setTimeout(()=>{win.focus();win.print()},350);
 };
 if(win.document.readyState==='complete')go();else win.addEventListener('load',go,{once:true});
}
function printCss(){return `
@page{size:A4 landscape;margin:17mm 9mm 13mm;@bottom-right{content:"صفحة " counter(page) " من " counter(pages);font:700 8pt Arial;color:#60758d}@bottom-left{content:"Vision Dimensions";font:700 8pt Arial;color:#60758d}}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#243d59;font-family:Arial,Tahoma,sans-serif;direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pdf-header{position:fixed;top:-13mm;left:0;right:0;height:11mm;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #bfcddd;padding-bottom:2mm;background:#fff;z-index:10}.pdf-brand{display:flex;align-items:center;gap:3mm}.pdf-brand img{height:8mm;width:auto}.pdf-brand b{display:block;font-size:9pt;color:#173656}.pdf-brand span{display:block;font-size:6.8pt;color:#6c7e91;margin-top:.5mm}.pdf-meta{text-align:left;direction:ltr}.pdf-meta strong{display:block;font-size:9pt;color:#173656}.pdf-meta span{display:block;font-size:6.8pt;color:#6c7e91;margin-top:.5mm}.pdf-footer{position:fixed;bottom:-9mm;left:0;right:0;height:7mm;border-top:1px solid #ccd7e2;display:flex;justify-content:space-between;align-items:center;font-size:6.5pt;color:#6c7e91;background:#fff}.pdf-main{width:100%}.pre-report{display:block}.pre-summary,.pre-panel{background:#fff;border:1px solid #ccd9e6;border-radius:4mm;padding:4mm;margin:0 0 3.2mm;box-shadow:none}.pre-title{display:flex;justify-content:space-between;gap:6mm;align-items:flex-start}.pre-title>div:first-child{flex:1}.pre-title>div>span,.pre-panel-head span{display:block;font-size:6pt;font-weight:800;letter-spacing:.8pt;color:#527da7;direction:ltr}.pre-title h2{font-size:15pt;margin:1mm 0;color:#173656}.pre-title p{font-size:7.3pt;line-height:1.6;margin:0;color:#60758d}.pre-report-meta{min-width:38mm;text-align:left}.pre-report-meta b{display:block;font-size:6pt;color:#7d8fa1}.pre-report-meta span{display:block;font-size:9pt;font-weight:800;color:#173656;margin-top:.5mm}.pre-report-meta small{display:block;font-size:6.3pt;color:#718398;margin-top:1mm}.pre-facts,.pre-extra-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin-top:3mm}.pre-fact,.pre-extra-grid>div{border:1px solid #dce5ed;border-radius:2mm;padding:2mm 2.5mm;background:#fbfdff}.pre-fact small,.pre-extra-grid small{display:block;font-size:5.7pt;color:#8091a3;margin-bottom:.7mm}.pre-fact b,.pre-extra-grid b{font-size:7.3pt;color:#253e5a}.pre-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin:0 0 3.2mm}.pre-kpi{border:1px solid #d8e2ec;border-radius:3mm;padding:2.5mm;background:#fff;min-height:18mm}.pre-kpi small{display:block;font-size:5.5pt;color:#8191a2}.pre-kpi strong{display:block;font-size:14pt;color:#193b60;margin-top:1.5mm}.pre-kpi em{display:block;font-style:normal;font-size:6pt;color:#7a8da1;margin-top:.6mm}.pre-kpi.bad strong,.bad-text{color:#bd3f49!important}.ok-text{color:#187b50!important}.warn-text{color:#a96f0b!important}.expired-text{color:#6f5a34!important}.cancelled-text{color:#68798a!important}.pre-quality-alert{display:flex;flex-direction:column;gap:1mm;padding:2.5mm 3mm;margin:0 0 3mm;border:1px solid #f0d49b;border-radius:3mm;background:#fff9ed;color:#72511b;break-inside:avoid}.pre-quality-alert b{font-size:7pt}.pre-quality-alert span{font-size:6pt;line-height:1.45}.pre-panel-head{display:flex;justify-content:space-between;align-items:center;gap:4mm;margin-bottom:2.5mm}.pre-panel-head h3{font-size:10pt;color:#223f5e;margin:.7mm 0 0}.pre-panel-head>b{font-size:8pt;color:#5f7590}.pre-progress-row{display:grid;grid-template-columns:18mm 1fr 18mm;gap:2mm;align-items:center;margin:2mm 0}.pre-progress-row>b{font-size:7pt}.pre-progress-row>strong{text-align:left;font-size:7.5pt}.pre-track{height:3mm;background:#edf2f6;border-radius:99mm;overflow:hidden}.pre-track i{display:block;height:100%;background:#2c80bf}.pre-progress-row.planned .pre-track i{background:#8ba6be}.pre-summary-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:1.8mm;margin-bottom:2.5mm}.pre-boq-summary{grid-template-columns:repeat(6,1fr)}.pre-risk-summary{grid-template-columns:repeat(6,1fr)}.pre-permit-summary{grid-template-columns:repeat(6,1fr)}.pre-summary-strip>div{border:1px solid #dce5ed;border-radius:2mm;padding:1.7mm 2mm;background:#f8fbfd;text-align:center}.pre-summary-strip small{display:block;font-size:5.4pt;color:#74889b}.pre-summary-strip b{display:block;font-size:10pt;color:#203e5e;margin-top:.6mm}.pre-mini-kpis{display:flex;gap:1.5mm;flex-wrap:wrap}.pre-mini-kpis span{font-size:5.7pt;border:1px solid #d8e3ed;border-radius:99mm;padding:1.2mm 2mm}.pre-chart-card{border:1px solid #dbe5ee;border-radius:3mm;padding:2.5mm;margin:2mm 0 2.8mm;background:#fff;break-inside:avoid;page-break-inside:avoid}.pre-chart-title span{display:block;font-size:5.5pt;font-weight:800;letter-spacing:.7pt;color:#557fa7;direction:ltr}.pre-chart-title h4{margin:.6mm 0 2mm;font-size:8pt;color:#29445f}.pre-history-chart svg{display:block;width:100%;height:44mm}.pre-history-chart .grid line{stroke:#e5edf3;stroke-width:1}.pre-history-chart .grid text,.pre-history-chart .axis-labels text{fill:#73879b;font-size:9px}.pre-history-chart .series{fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.pre-history-chart .series.planned{stroke:#8ca8bf}.pre-history-chart .series.actual{stroke:#2e82bd}.pre-history-chart circle.planned{fill:#8ca8bf}.pre-history-chart circle.actual{fill:#2e82bd}.pre-chart-legend{display:flex;gap:4mm;margin-top:1.4mm;font-size:5.7pt;color:#667b90}.pre-chart-legend span{display:flex;align-items:center;gap:1.2mm}.pre-chart-legend i{display:inline-block;width:7mm;height:1.6mm;border-radius:99mm}.pre-chart-legend i.planned{background:#8ca8bf}.pre-chart-legend i.actual{background:#2e82bd}.pre-chart-note{display:block;font-size:5.5pt;color:#76899c;margin-top:1mm}.pre-bar-chart{display:flex;flex-direction:column;gap:1.6mm}.pre-bar-row{display:grid;grid-template-columns:52mm 1fr 34mm;gap:2mm;align-items:center}.pre-bar-label{font-size:5.8pt;font-weight:700;color:#425b74;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pre-bar-area{display:flex;flex-direction:column;gap:.8mm}.pre-bar-track{height:1.8mm;background:#edf2f6;border-radius:99mm;overflow:hidden}.pre-bar-track i{display:block;height:100%;border-radius:inherit}.pre-bar-track i.planned{background:#8ca8bf}.pre-bar-track i.actual{background:#2e82bd}.pre-bar-values{display:grid;grid-template-columns:1fr 1fr;gap:1mm;direction:ltr;font-size:5.4pt;text-align:center;color:#71859a}.pre-bar-values b{color:#2e82bd}.pre-table-wrap{border:1px solid #dfe7ee;border-radius:2mm;overflow:visible}.pre-table-wrap table{width:100%;border-collapse:collapse;table-layout:auto}.pre-table-wrap thead{display:table-header-group}.pre-table-wrap tr{break-inside:avoid;page-break-inside:avoid}.pre-table-wrap th{background:#eaf5ee;color:#314e64;font-size:6pt;padding:1.6mm 1.5mm;text-align:right;white-space:nowrap;border-bottom:1px solid #cfe0d6}.pre-table-wrap td{font-size:6.2pt;padding:1.6mm 1.5mm;border-top:1px solid #e4ebf1;color:#2f475f;vertical-align:top}.pre-table-wrap td.status{font-weight:800}.pre-table-wrap td.status.ok{color:#187b50}.pre-table-wrap td.status.warn{color:#a96f0b}.pre-table-wrap td.status.expired{color:#6f5a34}.pre-table-wrap td.status.cancelled{color:#68798a}.pre-table-wrap td.status.bad{color:#bd3f49}.pre-ltr,.pre-num{direction:ltr;unicode-bidi:isolate;text-align:center}.pre-ltr{display:inline-block}.pre-print-section{break-inside:avoid;page-break-inside:avoid}.pre-table-page{break-before:page;page-break-before:always}.pre-boq-panel,.pre-material-panel,.pre-permits-panel,.pre-risk-panel{break-inside:auto;page-break-inside:auto}.pre-boq-panel .pre-panel-head,.pre-boq-panel .pre-summary-strip,.pre-boq-panel .pre-chart-card,.pre-material-panel .pre-panel-head,.pre-material-panel .pre-summary-strip,.pre-permits-panel .pre-panel-head,.pre-permits-panel .pre-summary-strip,.pre-risk-panel .pre-panel-head,.pre-risk-panel .pre-summary-strip{break-inside:avoid;page-break-inside:avoid}.pre-narrative-panel{display:grid;grid-template-columns:repeat(2,1fr);gap:3mm}.pre-narrative-part{border:1px solid #dce5ed;border-radius:3mm;padding:3mm;background:#fbfdff}.pre-narrative-part>span{display:block;font-size:5.5pt;font-weight:800;letter-spacing:.7pt;color:#557fa7;direction:ltr}.pre-narrative-part h3{margin:.8mm 0 1.5mm;font-size:8pt;color:#29445f}.pre-narrative-part p{margin:0 0 1mm;font-size:6.2pt;line-height:1.5;color:#536b83}.pre-map-pdf-panel{break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid}.pre-map-pdf-image{display:block;width:100%;height:auto;max-height:155mm;object-fit:contain;border:1px solid #d7e3ed;border-radius:3mm;background:#eef5f7}.pre-map-pdf-missing{height:70mm;display:grid;place-items:center;border:1px dashed #cbd9e5;border-radius:3mm;color:#6d8196;font-size:8pt;background:#fbfdff}.pre-photos-pdf-panel{break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid}.pre-photos-pdf-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}.pre-photo-pdf-card{border:1px solid #d7e3ed;border-radius:2.5mm;overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid}.pre-photo-pdf-card img,.pre-photo-pdf-empty{display:block;width:100%;height:55mm;object-fit:cover;background:#f2f6f9}.pre-photo-pdf-empty{display:grid;place-items:center;color:#8091a3;font-size:7pt}.pre-photo-pdf-caption{padding:2mm 2.3mm;min-height:15mm;border-top:1px solid #dce5ed}.pre-photo-pdf-caption b{display:block;font-size:6pt;color:#557fa7;margin-bottom:.8mm}.pre-photo-pdf-caption span{display:block;font-size:6.5pt;line-height:1.45;color:#2f475f;overflow-wrap:anywhere}.pre-source-note{display:none}.pre-system-col{display:none!important}.vd-universal-info,.calc-help-btn,.vd-info-modal{display:none!important}

/* 2026 editorial print-system: stronger type, color, and pagination */
@page{size:A4 landscape;margin:16mm 11mm 16mm}
html,body{color:#1d334a;font-family:Tahoma,Arial,sans-serif;font-size:9pt}
.pdf-header{background:#f7fbff;border-bottom:2px solid #168f91;height:12mm}
.pdf-brand b{font-size:10pt}.pdf-brand span,.pdf-meta span{font-size:8pt}
.pdf-footer{border-top:2px solid #168f91;color:#375570;font-size:8pt}
.pdf-main{padding-bottom:2mm}
.pre-summary,.pre-panel{border:1px solid #c8d9e7;border-top:3px solid #1e839d;border-radius:3mm;padding:4.3mm;margin-bottom:4mm}
.pre-summary{background:linear-gradient(115deg,#f1f8ff 0%,#ffffff 65%);border-top-color:#173e68}
.pre-title h2{font-size:19pt;line-height:1.25;color:#133a5b}
.pre-title p{font-size:9pt;color:#415d73;line-height:1.6}
.pre-title>div>span,.pre-panel-head span,.pre-chart-title span,.pre-narrative-part>span{font-size:7pt;letter-spacing:.1pt;white-space:normal;overflow-wrap:anywhere;max-width:100%;direction:auto}
.pre-panel-head span{display:none!important}.pre-panel-head{align-items:flex-start;min-width:0}.pre-panel-head>div{min-width:0;flex:1}
.pre-panel-head h3{font-size:13pt;line-height:1.35;color:#153d5e}
.pre-panel-head>b{font-size:10pt;background:#dff3ec;color:#067659;padding:1.2mm 2.7mm;border-radius:2mm;white-space:nowrap}
.pre-fact,.pre-extra-grid>div{background:#f3f8fd;border-color:#cfdfec;padding:2.7mm}
.pre-fact small,.pre-extra-grid small{font-size:7pt;color:#496b84}.pre-fact b,.pre-extra-grid b{font-size:9pt}
.pre-kpis{gap:2.2mm}.pre-kpi{background:#edf6fc;border-color:#bcd8ea;border-top:2.5px solid #2588b6;min-height:20mm;padding:2.6mm}
.pre-kpi:nth-child(3n+1){border-top-color:#14987c;background:#effaf6}
.pre-kpi:nth-child(3n+2){border-top-color:#e8a83c;background:#fffaed}
.pre-kpi small{font-size:7pt;color:#49687f;line-height:1.35}
.pre-kpi strong{font-size:16pt;color:#123c5c}
.pre-kpi em{font-size:7pt;color:#5d768b}
.pre-summary-strip>div{background:#edf6fc;border-color:#c6dce9;padding:2.3mm 2mm}
.pre-summary-strip>div:nth-child(3n+1){background:#eaf8f3;border-color:#bde2d5}
.pre-summary-strip>div:nth-child(3n+2){background:#fff7e9;border-color:#f0dcb4}
.pre-summary-strip small{font-size:7pt;color:#526a7c}.pre-summary-strip b{font-size:12pt;color:#123d5d}
.pre-chart-card{border-color:#c5d9e7;background:#f9fcff;padding:3.5mm}
.pre-chart-title h4{font-size:10.5pt}.pre-chart-legend{font-size:7.5pt}
.pre-chart-note{font-size:7pt}.pre-bar-label{font-size:7.2pt}
.pre-bar-values{font-size:7pt}.pre-bar-track{height:2.2mm}
.pre-history-chart svg{height:102mm}
.pre-table-wrap{border-color:#bfd5e4;overflow:visible}
.pre-table-wrap table{width:100%;table-layout:fixed}
.pre-table-wrap th{background:#17486a!important;color:#fff!important;font-size:8pt;line-height:1.3;padding:2.4mm 1.4mm;white-space:normal}
.pre-table-wrap td{font-size:8pt;line-height:1.35;padding:2.2mm 1.4mm;overflow-wrap:anywhere;word-break:normal}
.pre-table-wrap tr:nth-child(even) td{background:#f0f6fa}
.pre-table-wrap tr{break-inside:avoid;page-break-inside:avoid}
.pre-table-wrap thead{display:table-header-group}
.pre-permits-panel,.pre-material-panel,.pre-boq-panel,.pre-risk-panel{break-inside:auto;page-break-inside:auto}
.pre-permits-panel{padding-bottom:6mm}
.pre-narrative-part{background:#f0f7fa;border-color:#c9dfe8;padding:3.5mm}
.pre-narrative-part h3{font-size:10pt}.pre-narrative-part p{font-size:8pt}
.pre-map-pdf-panel,.pre-photos-pdf-panel{break-before:page;page-break-before:always}
.pre-map-pdf-image{max-height:145mm;border:2px solid #afd0e1}
.pre-photo-pdf-card{border-color:#bcd5e7}
.pre-photo-pdf-caption b{font-size:8pt}.pre-photo-pdf-caption span{font-size:8pt;line-height:1.5}
.pre-quality-alert b{font-size:9pt}.pre-quality-alert span{font-size:8pt}
/* PDF QA 2026-10-08: keep running headers/footers clear of long tables */
@page{size:A4 landscape;margin:23mm 11mm 20mm}
.pdf-header{top:-18mm;height:12mm;z-index:20;background:#fff;padding:0 1mm 1.5mm;border-bottom:2px solid #168f91}
.pdf-footer{bottom:-15mm;height:9mm;z-index:20;background:#fff;padding:1mm;border-top:2px solid #168f91}
.pre-panel-head{margin-bottom:2.5mm}
.pre-panel-head>div{max-width:80%}
.pre-history-chart svg{height:83mm;width:calc(100% - 14mm);margin-inline:7mm;overflow:visible}
.pre-history-chart{padding-inline:3mm;overflow:visible}
.pre-material-panel .pre-table-wrap td,.pre-permits-panel .pre-table-wrap td{font-size:7.25pt;line-height:1.2;padding:1.2mm 1.3mm}
.pre-material-panel .pre-table-wrap th,.pre-permits-panel .pre-table-wrap th{font-size:7.5pt;padding:1.8mm 1.2mm}
.pre-material-panel .pre-summary-strip,.pre-permits-panel .pre-summary-strip{margin-bottom:1.8mm}
.pre-material-panel .pre-summary-strip>div,.pre-permits-panel .pre-summary-strip>div{padding:1.5mm}
.pre-material-panel .pre-table-wrap td:first-child{width:47%}
.pre-boq-panel .pre-table-wrap td{font-size:7.3pt;line-height:1.3;padding:1.5mm}
.pre-table-wrap th,.pre-table-wrap td{vertical-align:middle}
.pre-table-wrap table{page-break-inside:auto;break-inside:auto}
.pre-table-wrap thead{display:table-header-group}
.pre-print-section:not(.pre-map-pdf-panel):not(.pre-photos-pdf-panel){scroll-margin:0}
.pre-map-pdf-image{max-height:130mm}
.pre-photo-pdf-card img,.pre-photo-pdf-empty{height:50mm}
.pre-photos-pdf-grid{gap:2.4mm}
/* 2026-10-08 PRINT FIX: Chromium page margin elements, no fixed overlays */
@page{
 size:A4 landscape;
 margin:15mm 11mm 14mm;
 @top-left{content:"Vision Dimensions | PROJECT CONTROL";color:#294b69;font:700 8pt Arial}
 @top-right{content:"PDC • WO REPORT";color:#177e91;font:700 8pt Arial}
 @bottom-left{content:"Vision Dimensions Engineering Consultancy";color:#526b82;font:700 7.5pt Arial}
 @bottom-right{content:"Page " counter(page) " / " counter(pages);color:#526b82;font:700 7.5pt Arial}
}
.pdf-header,.pdf-footer{display:none!important}
.pdf-main{margin:0;padding:0;width:100%}
.pre-summary,.pre-panel{margin-top:0}
.pre-history-chart{overflow:hidden}
.pre-history-chart svg{max-width:100%;width:100%;height:77mm;margin:0;overflow:visible}
.pre-panel-head>div{max-width:100%}
.pre-chart-card{break-inside:avoid}
.pre-map-pdf-panel,.pre-photos-pdf-panel{break-before:page;page-break-before:always}.pre-guide-appendix{break-before:page;page-break-before:always;color:#183b57;direction:rtl}
.pre-guide-title{padding:5mm;background:#16496e;color:#fff;border-radius:3mm;margin-bottom:3mm}
.pre-guide-title span{display:block;color:#bbe3f4;font:700 8pt Arial;direction:ltr}
.pre-guide-title h2{font-size:17pt;margin:1.5mm 0}.pre-guide-title p{font-size:8pt;margin:0;color:#fff}
.pre-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm 3.5mm}
.pre-guide-item{display:flex;gap:2.5mm;padding:2.4mm;border:1px solid #cce0ea;border-right:3px solid #158995;border-radius:2mm;background:#f2f8fc;break-inside:avoid}
.pre-guide-item:nth-child(3n+2){border-right-color:#d49c31;background:#fffaef}
.pre-guide-item:nth-child(3n+3){border-right-color:#159574;background:#f0faf5}
.pre-guide-item>b{color:#187b94;font-size:10pt}.pre-guide-item h3{font-size:9.5pt;margin:0 0 1mm}
.pre-guide-item p{font-size:7.2pt;line-height:1.5;margin:0}
.pre-guide-foot{margin-top:3mm;padding:3mm;background:#fff7e9;border:1px solid #ebd19c;border-radius:2mm;font-size:8pt}
/* Premium engineering-report art direction */
.pre-summary{padding:6mm;border-top:4px solid #0d6280;background:linear-gradient(120deg,#ebf6fc,#fff 80%)}
.pre-title h2{font-size:22pt;font-weight:900;color:#113c59}
.pre-title p{font-size:9.5pt;color:#3f6379}
.pre-report-meta{background:#fff;border:1px solid #c5dce9;border-radius:3mm;padding:3mm}
.pre-fact,.pre-extra-grid>div{background:#fff;border-radius:3mm;padding:3mm;min-height:15mm}
.pre-fact b,.pre-extra-grid b{font-size:9.5pt;color:#153c54}
.pre-kpi{min-height:24mm;border-radius:3mm;padding:3mm;border-top-width:3px}
.pre-kpi small{font-size:7.4pt;font-weight:700}
.pre-kpi strong{font-size:18pt;font-weight:900}
.pre-kpi.bad{background:#fff0f0;border-color:#efc7ca}
.pre-panel-head h3{font-size:15pt;font-weight:900;color:#123c57}
.pre-summary-strip>div{padding:3mm 2mm;border-radius:2.5mm}
.pre-summary-strip b{font-size:13pt;font-weight:900}
.pre-chart-card{padding:4mm;background:#f8fbfe;border-radius:3mm}
.pre-chart-title h4{font-size:11pt;font-weight:900}
.pre-track{height:4mm}
.pre-bar-track{height:3mm}
.pre-table-wrap th{background:#103d5a!important;color:#fff!important;font-size:8pt;font-weight:900}
.pre-table-wrap td{font-size:8pt;line-height:1.4;color:#244459}
.pre-table-wrap tr:nth-child(even) td{background:#edf5fa}
.pre-photo-pdf-card{border:1px solid #bcd5e4;border-radius:3mm}
.pre-photo-pdf-card img,.pre-photo-pdf-empty{height:53mm}
.pre-photo-pdf-caption{background:#f2f8fc;min-height:18mm;padding:2.5mm}
.pre-photo-pdf-caption b{font-size:8.5pt;color:#116982}
.pre-photo-pdf-caption span{font-size:8.2pt;line-height:1.5}
.pre-map-pdf-image{max-height:150mm;border:2px solid #bbd7e6}
.pre-guide-title{background:linear-gradient(110deg,#123a60,#087d93);padding:6mm}
.pre-guide-item{padding:3mm}
.pre-guide-item h3{font-size:10.2pt}
.pre-guide-item p{font-size:7.6pt;line-height:1.55}
/* Branded printable masthead and translucent watermark */
@page{size:A4 landscape;margin:25mm 11mm 15mm;@top-left{content:none}@top-right{content:none}}
.pdf-header{display:flex!important;position:fixed;top:-22mm;left:0;right:0;height:19mm;padding:2mm 1mm;background:#fff;border-bottom:2px solid #13849b;z-index:50;align-items:center;justify-content:space-between}
.pdf-brand img{height:14mm;width:24mm;max-width:24mm;object-fit:contain}
.pdf-brand b{font-size:9pt}.pdf-brand span{font-size:7pt}
.pdf-meta{display:flex;align-items:center;gap:4mm;direction:ltr}
.pdf-meta>span{font-size:7pt;font-weight:700;color:#56758a}
.pdf-pdc-logo{height:14mm;width:26mm;object-fit:contain}
.pdf-watermark{position:fixed;top:52mm;right:76mm;width:130mm;height:110mm;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:-1;opacity:.045}
.pdf-watermark img{width:100mm;max-height:100mm;object-fit:contain}
.pdf-main{position:relative;z-index:1;background:transparent}
.pre-guide-item p{font-size:8.3pt;line-height:1.7}
.pre-guide-item h3{font-size:11pt}
.pre-guide-item{break-inside:avoid;page-break-inside:avoid}
.pre-guide-foot{font-size:9pt;line-height:1.65}

.pre-formula-appendix{break-before:page;page-break-before:always;padding-top:2mm}
.pre-formula-appendix>h2{font-size:16pt;color:#103b5a;margin:0 0 2mm;border-bottom:2px solid #11869d;padding-bottom:3mm}
.pre-formula-appendix>p{font-size:8.5pt;color:#537086;margin:0 0 4mm}
.pre-formula-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm 4mm}
.pre-formula-card{display:flex;gap:2.5mm;padding:3mm;background:#f2f8fc;border:1px solid #c8dfe9;border-right:3px solid #12899c;border-radius:2.5mm;break-inside:avoid}
.pre-formula-card>b{font-size:12pt;color:#0b8395}
.pre-formula-card h3{font-size:9.5pt;color:#133f5a;margin:0 0 1mm}
.pre-formula-card p{font-size:8.1pt;line-height:1.65;margin:0 0 1mm}
.pre-formula-card small{font-size:7.5pt;color:#167b70;font-weight:700}
/* QA: hold cards and section titles away from repeating footer */
.pre-table-wrap td,.pre-table-wrap th{overflow-wrap:anywhere}
.pre-permits-panel .pre-table-wrap table{table-layout:fixed}
.pre-permits-panel .pre-table-wrap td{font-size:6.5pt;line-height:1.45}
.pre-guide-appendix{break-inside:auto;page-break-inside:auto}
.pre-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.4mm 3mm}
.pre-guide-item{padding:2.4mm 3mm}
.pre-guide-item p{font-size:7.7pt;line-height:1.5}
.pre-guide-item h3{font-size:9.6pt}
.pre-guide-foot{break-inside:avoid;page-break-inside:avoid;margin:3mm 0 0;padding:3mm;background:#f6fafc;border:1px solid #d8e5ec}
.pre-formula-card{padding:2.5mm}
.pre-formula-card p{font-size:7.5pt;line-height:1.5}
.pre-formula-card small{font-size:7pt;line-height:1.35}
.pre-narrative-panel,.pre-photo-pdf-card,.pre-guide-item{break-inside:avoid;page-break-inside:avoid}
.pre-guide-foot{margin-top:2mm;padding:2mm;font-size:7.5pt;line-height:1.4}.pre-formula-grid{gap:2mm 3mm}.pre-formula-card{padding:1.7mm 2mm;break-inside:avoid}.pre-formula-card p{font-size:7pt;line-height:1.3}.pre-formula-card small{font-size:6.6pt;line-height:1.25}.pre-formula-appendix{margin-bottom:0;padding-bottom:0}.pre-photos-pdf-panel{break-inside:auto;page-break-inside:auto}.pre-photo-pdf-card{break-inside:avoid;page-break-inside:avoid}
/* Print pagination correction 2026-10-09: keep content clear of running brand strips */
@page{size:A4 landscape;margin:24mm 12mm 23mm;@bottom-left{content:"Vision Dimensions Engineering Consultancy";font:700 7.5pt Arial;color:#526b82}@bottom-right{content:"Page " counter(page) " / " counter(pages);font:700 7.5pt Arial;color:#526b82}}
.pdf-header{position:fixed;top:-21mm;height:16mm;max-height:16mm;padding:1mm 1mm 1.5mm;z-index:20}
.pdf-footer{display:none!important}
.pdf-main{padding:0 0 1mm!important;overflow:visible}
.pre-panel,.pre-summary{max-width:100%;overflow:visible}
.pre-table-wrap{overflow:visible!important}
.pre-table-wrap table{break-inside:auto!important;page-break-inside:auto!important}
.pre-table-wrap thead{display:table-header-group}
.pre-table-wrap tr{break-inside:avoid;page-break-inside:avoid}
.pre-table-wrap th,.pre-table-wrap td{vertical-align:top;overflow-wrap:anywhere}
.pre-material-panel,.pre-permits-panel,.pre-boq-panel,.pre-risk-panel{break-inside:auto!important;page-break-inside:auto!important}
.pre-material-panel .pre-panel-head,.pre-permits-panel .pre-panel-head,.pre-boq-panel .pre-panel-head,.pre-risk-panel .pre-panel-head{break-after:avoid;page-break-after:avoid}
.pre-photos-pdf-panel{break-inside:auto!important;page-break-inside:auto!important}
.pre-photos-pdf-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2mm}
.pre-photo-pdf-card{break-inside:avoid!important;page-break-inside:avoid!important;min-width:0}
.pre-photo-pdf-card img,.pre-photo-pdf-empty{height:43mm!important;max-height:43mm}
.pre-photo-pdf-caption{min-height:14mm;padding:1.5mm 2mm;overflow-wrap:anywhere}
.pre-photo-pdf-caption span{font-size:7pt;line-height:1.32}
.pre-guide-grid{display:block;column-count:2;column-gap:3mm}
.pre-guide-item{display:flex;break-inside:avoid!important;page-break-inside:avoid!important;margin:0 0 2mm;padding:2mm 2.5mm}
.pre-guide-item p{font-size:7.5pt;line-height:1.4}
.pre-guide-title{break-after:avoid;page-break-after:avoid}
.pre-formula-appendix{break-before:page;page-break-before:always}
.pre-formula-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2mm 3mm}
.pre-formula-card{break-inside:avoid!important;page-break-inside:avoid!important}
.pre-formula-card p,.pre-formula-card small{unicode-bidi:plaintext}
.pre-history-chart svg{height:66mm;max-height:66mm}
/* Archive print safety: disable Chromium fixed masthead repetition that overlays page content. */
@page{size:A4 landscape;margin:17mm 11mm 17mm;@top-left{content:url("${location.origin}/company-logo.png");}@top-center{content:"VISION DIMENSIONS | PROJECT CONTROL | PDC";font:700 8pt Arial;color:#284e69}@top-right{content:url("${location.origin}/pdc-logo.jpg");}@bottom-left{content:"Vision Dimensions Engineering Consultancy";font:700 7pt Arial;color:#526b82}@bottom-right{content:"Page " counter(page) " / " counter(pages);font:700 7pt Arial;color:#526b82}}
.pdf-header,.pdf-footer{display:none!important;position:static!important}
.pre-table-wrap tr{break-inside:avoid!important;page-break-inside:avoid!important}
.pre-permits-panel .pre-table-wrap th,.pre-permits-panel .pre-table-wrap td{font-size:6.35pt!important;padding:.85mm 1.1mm!important;line-height:1.16!important}
.pre-boq-panel .pre-table-wrap th,.pre-boq-panel .pre-table-wrap td{font-size:7pt!important;padding:1.1mm 1.1mm!important;line-height:1.26!important}
.pre-extra-panel,.pre-narrative-panel{break-inside:auto!important;page-break-inside:auto!important}
.pre-guide-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;column-count:auto!important;gap:2.5mm 3mm!important}
.pre-guide-item{margin:0!important;min-width:0}
.pre-guide-item p{overflow-wrap:anywhere}
.pre-map-pdf-image{max-height:133mm!important}
.pdf-footer{z-index:60;background:white}


`}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,260));else setTimeout(install,260);
})();