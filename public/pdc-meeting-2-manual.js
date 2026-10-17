(()=>{'use strict';
const get=id=>document.getElementById(id),API='/api/pdc-meeting-2/manual';
const spec=[
 ['approvedQuantities','ما تم اعتماد كمياته','financial',0],
 ['purchaseOrders','عدد أوامر الشراء','financial',0],
 ['paymentCertificates','عدد المستخلصات','financial',0],
 ['paymentRate','نسبة الصرف %','financial',0.001],
 ['currentSites','عدد المواقع الحالية','generators',0],
 ['closedSites','عدد المواقع المغلقة','generators',0],
 ['temporaryCables','عدد الكابلات المؤقتة','generators',0],
 ['generatorsTotal','عدد المولدات الإجمالي','generators',0],
 ['completedConnections','التوصيلات المنفذة خلال الأسبوع','weekly',0],
 ['completedProjects','المشاريع المنفذة خلال الأسبوع','weekly',0],
 ['receivedConnections155','التوصيلات مستلمة 155 خلال الأسبوع','weekly',0],
 ['receivedProjects155','المشاريع مستلمة 155 خلال الأسبوع','weekly',0],
];
const strings=[
 ['observations','أبرز ملاحظات المؤقتات والمولدات','textarea',2000],
 ['workOrder','رقم أمر العمل','input',60],
 ['contractor','المقاول','input',180],
 ['workType','نوع أمر العمل','input',180],
 ['workDescription','وصف العمل','textarea',1200],
 ['location','الموقع','input',250],
 ['finding','الملاحظة المرصودة','textarea',1500],
 ['correctiveAction','الإجراء التصحيحي','textarea',1500]
];
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let state={loaded:false,saved:false,dirty:false,saving:false,from:'',to:'',version:0};
function numField([key,label,section,step]){
 return '<label class="pm2-manual-field"><span>'+esc(label)+'</span><input type="number" inputmode="decimal" data-manual-field="'+esc(key)+'" data-manual-section="'+section+'" min="0" max="'+(key==='paymentRate'?100:100000000)+'" step="'+(step||1)+'" placeholder="غير مدخل"></label>';
}
function strField([key,label,type,max]){
 const inner=type==='textarea'?'<textarea rows="2" maxlength="'+max+'" data-manual-string="'+esc(key)+'"></textarea>':
  '<input type="text" maxlength="'+max+'" data-manual-string="'+esc(key)+'">';
 return '<label class="pm2-manual-field"><span>'+esc(label)+'</span>'+inner+'</label>';
}
function mount(){
 const root=get('pm2Results'),before=root?.parentElement;if(!root||!before||get('pm2ManualDetails'))return;
 const panel=document.createElement('details');panel.id='pm2ManualDetails';panel.className='pm2-panel pm2-manual';
 panel.innerHTML='<summary><span>إدخال يدوي مؤقت — بيانات التقرير الأسبوعي</span><small>حفظ منفصل لكل فترة داخل شيت مكة</small></summary>'+
  '<div class="pm2-manual-intro">الحقول الفارغة تعني «غير متاح» وليست صفرًا. تُحدَّث الكروت بعد الحفظ، وتبقى بيانات كل فترة محفوظة مستقلة. يظهر اسم آخر مستخدم وتاريخ التعديل.</div>'+
  '<div class="pm2-manual-groups">'+
   '<section><h3>المستخلصات وأوامر الشراء</h3><div class="pm2-manual-grid">'+spec.filter(s=>s[2]==='financial').map(numField).join('')+'</div>'+
   '<label class="pm2-manual-field"><span>الاتجاه الشهري للإشعارات (سطر لكل شهر: 2026-05: 159)</span><textarea id="pm2ManualNotices" rows="4" placeholder="2026-05: 159&#10;2026-06: 135"></textarea></label></section>'+
   '<section><h3>المؤقتات والمولدات</h3><div class="pm2-manual-grid">'+spec.filter(s=>s[2]==='generators').map(numField).join('')+'</div>'+
    '<div class="pm2-manual-grid">'+strings.map(strField).join('')+'</div></section>'+
   '<section><h3>الإنجاز الأسبوعي واستلام 155</h3><div class="pm2-manual-grid">'+spec.filter(s=>s[2]==='weekly').map(numField).join('')+'</div></section>'+
  '</div><div class="pm2-manual-actions"><button type="button" id="pm2ManualSave" disabled>حفظ البيانات اليدوية</button><button type="button" class="pm2-secondary" id="pm2ManualReload">استعادة البيانات المحفوظة</button><span id="pm2ManualStatus" role="status">اختر الفترة وانتظر تحديث البيانات.</span></div>'+
  '<small id="pm2ManualAudit" class="pm2-muted">مصدر الإدخال: PDC Meeting 2 Manual Data</small>';
 before.insertBefore(panel,root);
 panel.querySelectorAll('input,textarea').forEach(n=>n.addEventListener('input',()=>{
  if(state.loaded&&!state.saving){state.dirty=true;get('pm2ManualSave').disabled=false;status('تغييرات لم تُحفظ بعد.')}
 }));
 get('pm2ManualSave').onclick=save;
 get('pm2ManualReload').onclick=async()=>{
  if(state.dirty&&!window.confirm('سيتم إلغاء التعديلات غير المحفوظة. هل تريد الاستمرار؟'))return;
  await reload();
 };
 // Capture date changes before base UI refresh so users cannot silently lose unsaved edits.
 for(const key of ['pm2From','pm2To']){
  get(key)?.addEventListener('change',e=>{
   if(!state.dirty)return;
   if(!window.confirm('هناك إدخالات يدوية غير محفوظة. الانتقال إلى فترة أخرى دون حفظ؟')){
    e.stopImmediatePropagation();e.target.value=key==='pm2From'?state.from:state.to;return;
   }
   state.dirty=false;state.loaded=false;get('pm2ManualSave').disabled=true;
  },true);
 }
 document.addEventListener('pm2:summary-loaded',e=>{
  const data=e.detail,period=data?.period,manual=data?.manual;if(!period||!manual)return;
  if(!state.loaded||period.from!==state.from||period.to!==state.to||!state.dirty)fill(manual);
 });
}
function status(message,error=false){const e=get('pm2ManualStatus');if(e){e.textContent=message;e.classList.toggle('error',error)}}
function fill(manual){
 const from=manual.from||get('pm2From').value,to=manual.to||get('pm2To').value;
 state={...state,from,to,loaded:true,saved:Boolean(manual.saved),version:manual.version||0,dirty:false};
 spec.forEach(([k,,section])=>{const input=document.querySelector('[data-manual-field="'+k+'"]');if(input)input.value=manual[section]?.[k]??''});
 strings.forEach(([k])=>{const input=document.querySelector('[data-manual-string="'+k+'"]');if(input)input.value=manual.generators?.[k]??''});
 get('pm2ManualNotices').value=(manual.financial?.noticesByMonth||[]).map(n=>n.month+': '+n.count).join('\n');
 get('pm2ManualSave').disabled=true;
 status(manual.saved?'البيانات محفوظة لهذه الفترة.':'لم يتم إدخال بيانات يدوية لهذه الفترة بعد.');
 get('pm2ManualAudit').textContent=manual.saved?'آخر تعديل: '+new Date(manual.updatedAt).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'})+' — بواسطة '+(manual.updatedBy||'غير معروف')+' — نسخة '+manual.version:
  'لا توجد بيانات يدوية محفوظة لهذه الفترة. يحفظ الإدخال في PDC Meeting 2 Manual Data.';
}
function monthly(text){
 const result=[],seen=new Set();
 for(const line of text.split(/\r?\n/)){
  if(!line.trim())continue;
  const m=line.trim().match(/^(20\d{2}-(?:0[1-9]|1[0-2]))\s*[:=،,]\s*(\d+)$/);
  if(!m||seen.has(m[1]))throw Error('صيغة الاتجاه الشهري غير صحيحة أو يوجد شهر مكرر: '+line);
  seen.add(m[1]);const n=Number(m[2]);if(!Number.isSafeInteger(n)||n>100000000)throw Error('عدد الإشعارات غير صالح');
  result.push({month:m[1],count:n});
 }
 if(result.length>24)throw Error('حد أقصى 24 شهرًا في الاتجاه الشهري');
 return result.sort((a,b)=>a.month.localeCompare(b.month));
}
function collect(){
 const v={financial:{noticesByMonth:monthly(get('pm2ManualNotices').value)},generators:{},weekly:{}};
 for(const [key,,section] of spec){
  const el=document.querySelector('[data-manual-field="'+key+'"]');if(!el)continue;
  const str=el.value.trim();let num=null;
  if(str){
   num=Number(str);if(!Number.isFinite(num)||num<0||num>100000000||(key==='paymentRate'?num>100||Math.round(num*1000)/1000!==num:!Number.isSafeInteger(num)))
    throw Error('قيمة غير صحيحة في '+el.closest('label')?.querySelector('span')?.textContent);
  }
  v[section][key]=num;
 }
 for(const [key] of strings){const el=document.querySelector('[data-manual-string="'+key+'"]');v.generators[key]=el?.value?.trim()||'';}
 return v;
}
async function reload(){
 const from=get('pm2From').value,to=get('pm2To').value;
 if(!from||!to||from>to)return;
 status('جار قراءة الإدخال المحفوظ...');get('pm2ManualReload').disabled=true;
 try{
  const r=await fetch(API+'?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to),{credentials:'same-origin',cache:'no-store'});
  const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'تعذر قراءة الإدخال');
  fill(j.manual);
 }catch(e){status('تعذر الاستعادة: '+String(e.message||e),true)}
 finally{get('pm2ManualReload').disabled=false;}
}
async function save(){
 if(state.saving||!state.loaded||!state.dirty)return;
 const from=get('pm2From').value,to=get('pm2To').value;
 if(from!==state.from||to!==state.to){status('تم تغيير الفترة. اضغط تحديث البيانات أولًا.',true);return;}
 let body;try{body={from,to,version:state.version,...collect()}}catch(e){status(e.message,true);return;}
 state.saving=true;get('pm2ManualSave').disabled=true;
 status('جار حفظ بيانات الأسبوع على Google Sheets...');
 try{
  const r=await fetch(API,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'تعذر الحفظ');
  fill(j.manual);status('تم الحفظ بنجاح. يتم تحديث الكروت الآن.');
  get('pm2Refresh')?.click();
 }catch(e){
  status(e.message==='RECORD_CHANGED_RELOAD'?'تغيرت البيانات بواسطة مستخدم آخر. استخدم زر استعادة البيانات للمراجعة قبل الحفظ.':'فشل الحفظ: '+String(e.message||e),true);
  get('pm2ManualSave').disabled=false;
 }finally{state.saving=false;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();