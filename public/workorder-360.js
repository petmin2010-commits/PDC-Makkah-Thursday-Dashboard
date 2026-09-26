(function(){
'use strict';
const W360={data:null,loading:false};
function el(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function rpc(method,args=[]){return fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})}).then(async r=>{const x=await r.json().catch(()=>({}));if(!r.ok||x.ok===false)throw new Error(x.error||('HTTP '+r.status));return x.result})}
function install(){
 if(el('workOrder360Page'))return;
 const nav=el('nav');if(!nav)return;
 const anchor=el('smartCenterNav');
 const label=document.createElement('div');label.className='nav-section-label wo360-label';label.textContent='التحليل الشامل';
 const btn=document.createElement('button');btn.type='button';btn.id='workOrder360Nav';btn.className='nav-item';btn.innerHTML='🔎 <span>Work Order 360°</span>';
 if(anchor){nav.insertBefore(label,anchor);nav.insertBefore(btn,anchor)}else{nav.appendChild(label);nav.appendChild(btn)}
 const main=document.querySelector('main');if(!main)return;
 const page=document.createElement('section');page.id='workOrder360Page';page.className='page wo360-page';page.innerHTML=markup();
 main.insertBefore(page,main.firstChild);
 btn.addEventListener('click',openPage360);
 nav.addEventListener('click',e=>{const item=e.target.closest('.nav-item');if(item&&item.id!=='workOrder360Nav')leave()});
 bind();
}
function markup(){return `
<div class="wo360-hero">
 <div class="wo360-hero-top"><div><span class="wo360-eyebrow">WORK ORDER INTELLIGENCE • FULL SOURCE VIEW</span><h2>🔎 Work Order 360°</h2><p>ابحث برقم أمر العمل وسأجمع كل ظهور له من جميع أوراق ملف Google Sheet الرئيسي، مع عرض كل معلومة غير فارغة مهما كانت صغيرة.</p></div><span class="wo360-file" id="wo360File">المصدر: ملف المشروع الرئيسي</span></div>
 <div class="wo360-search"><input id="wo360Input" inputmode="numeric" autocomplete="off" placeholder="أدخل رقم أمر العمل..."><button id="wo360Search">بحث شامل</button></div>
 <div class="wo360-help">البحث تطابق دقيق لرقم أمر العمل، ويستبعد فقط أوراق النظام وتسجيل الدخول.</div>
</div>
<div id="wo360Body" class="wo360-state"><b>جاهز للبحث</b><span>أدخل رقم أمر العمل لعرض كل المعلومات المتاحة عنه داخل الملف الرئيسي.</span></div>`}
function bind(){el('wo360Search').onclick=search;el('wo360Input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}})}
function openPage360(){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));el('workOrder360Page')?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id==='workOrder360Nav'));
 if(el('filterBar'))el('filterBar').style.display='none';if(el('pageTitle'))el('pageTitle').textContent='Work Order 360°';
 setTimeout(()=>el('wo360Input')?.focus(),50)
}
function leave(){el('workOrder360Page')?.classList.remove('active');if(el('filterBar'))el('filterBar').style.display=''}
async function search(){
 if(W360.loading)return;const q=clean(el('wo360Input').value);if(!q){el('wo360Input').focus();return}
 W360.loading=true;el('wo360Body').className='wo360-state';el('wo360Body').innerHTML='<span class="wo360-loader"></span><b>جاري البحث الشامل...</b><span>يتم فحص أوراق الملف الرئيسي وتجميع كل الصفوف المطابقة.</span>';
 try{W360.data=await rpc('getWorkOrder360',[q]);render(W360.data)}
 catch(e){el('wo360Body').className='wo360-state';el('wo360Body').innerHTML='<b>تعذر تنفيذ البحث</b><span>'+esc(e.message||e)+'</span>'}
 finally{W360.loading=false}
}
function fieldValueHtml(v){
 const s=String(v==null?'':v);
 if(/^https?:\/\//i.test(s.trim()))return '<a href="'+esc(s.trim())+'" target="_blank" rel="noopener">'+esc(s)+'</a>';
 return esc(s);
}
function allFields(data){const out=[];(data.sources||[]).forEach(s=>(s.records||[]).forEach(r=>(r.fields||[]).forEach(f=>out.push({...f,sheet:s.sheet,rowNumber:r.rowNumber}))));return out}
function pickHighlights(data){
 const fs=allFields(data),rules=[
  ['الحالة',['حالة التنفيذ','الحالة','مرحلة التنفيذ','حالة المرحلة']],
  ['المقاول',['المقاول']],
  ['المهندس / المسؤول',['المهندس','مسؤول الموقع','اسم الاستشاري','محرر']],
  ['الموقع',['الموقع','موقع المهمة','موقع أمر العمل']],
  ['نوع أمر العمل',['نوع أمر العمل','نوع الامر','النوع']],
  ['تاريخ الإسناد',['تاريخ الإسناد','تاريخ الاسناد']],
  ['التأخير',['التأخير','اشعارات التاخير']],
  ['نسبة الإنجاز',['نسبة الإنجاز','نسبة الانجاز','progress']],
  ['التصريح',['حالة التصريح','التصريح']],
  ['الإفادة',['إفادة الاستشاري','افادة الاستشاري','إفادة الموقع']]
 ];
 const result=[];const seen=new Set();
 for(const [title,needles] of rules){
  const hit=fs.find(f=>needles.some(n=>clean(f.label).includes(n))&&clean(f.value));
  if(hit&&!seen.has(title)){seen.add(title);result.push({title,value:hit.value,source:hit.sheet})}
 }
 return result.slice(0,12)
}
function render(data){
 el('wo360File').textContent='المصدر: '+(data.spreadsheetTitle||'ملف المشروع الرئيسي');
 if(!data.totalRecords){el('wo360Body').className='wo360-summary';el('wo360Body').innerHTML='<div class="wo360-no-results"><b>لم يتم العثور على أمر العمل '+esc(data.workOrder)+'</b><p>تم فحص '+Number(data.scannedSheets||0).toLocaleString('ar-SA')+' ورقة، منها '+Number(data.searchableSheets||0).toLocaleString('ar-SA')+' ورقة تحتوي عمود أمر عمل يمكن البحث فيه.</p></div>';return}
 const fields=allFields(data),highlights=pickHighlights(data),sourceNav=(data.sources||[]).map((s,i)=>'<button class="wo360-source-chip" data-target="wo360source'+i+'">'+esc(s.sheet)+' • '+s.count+'</button>').join('');
 el('wo360Body').className='';el('wo360Body').innerHTML=`
 <div class="wo360-kpis">
  <div class="wo360-kpi"><span>رقم أمر العمل</span><strong>${esc(data.workOrder)}</strong></div>
  <div class="wo360-kpi"><span>الأوراق التي ظهر بها</span><strong>${data.matchedSheets}</strong></div>
  <div class="wo360-kpi"><span>السجلات المطابقة</span><strong>${data.totalRecords}</strong></div>
  <div class="wo360-kpi"><span>المعلومات غير الفارغة</span><strong>${fields.length}</strong></div>
 </div>
 <article class="wo360-summary"><div class="wo360-titlebar"><div><span>EXECUTIVE SNAPSHOT</span><h3>ملخص سريع — دون حذف التفاصيل</h3></div><span>${esc(data.updatedAt||'')}</span></div>
  <div class="wo360-summary-grid">${highlights.length?highlights.map(x=>'<div class="wo360-highlight"><small>'+esc(x.title)+' • '+esc(x.source)+'</small><b>'+fieldValueHtml(x.value)+'</b></div>').join(''):'<div class="wo360-highlight"><small>الملخص</small><b>تم العثور على السجلات، والتفاصيل الكاملة موضحة أدناه.</b></div>'}</div>
 </article>
 <div class="wo360-source-nav">${sourceNav}</div>
 <div id="wo360Sources">${(data.sources||[]).map((s,i)=>renderSource(data,s,i)).join('')}</div>`;
 document.querySelectorAll('.wo360-source-chip').forEach(b=>b.onclick=()=>el(b.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function renderSource(data,source,i){
 const base=(data.spreadsheetUrl||'')+(source.sheetId!=null?'#gid='+source.sheetId:'');
 const rows=(source.records||[]).map((r,ri)=>`<div class="wo360-record"><div class="wo360-record-head"><b>السجل ${ri+1} • الصف ${r.rowNumber}</b><span>هيدر المصدر: الصف ${r.headerRow}</span></div><div class="wo360-fields">${(r.fields||[]).map(f=>`<div class="wo360-field"><small><span>${esc(f.label)}</span><span>${esc(f.column)}</span></small><b>${fieldValueHtml(f.value)}</b></div>`).join('')}</div></div>`).join('');
 return `<details class="wo360-source" id="wo360source${i}" open><summary><div><div class="wo360-source-name">${esc(source.sheet)}</div><div class="wo360-source-meta">${source.count} سجل مطابق</div></div><div class="wo360-source-actions">${base?'<a class="wo360-open-link" href="'+esc(base)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">فتح المصدر</a>':''}</div></summary>${rows}</details>`
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,220));else setTimeout(install,220);
})();