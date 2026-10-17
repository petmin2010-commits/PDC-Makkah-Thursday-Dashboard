(()=>{
'use strict';
/* The single export directory. Every entry points at an existing exporter;
   source-specific editors stay the authority for their data and formatting. */
const GROUPS=[
 {key:'operational',title:'التقارير التشغيلية',subtitle:'متابعة أوامر العمل والإنجاز والمواقع',items:[
  ['master','التقرير التنفيذي العام','PDF','layout-dashboard'],
  ['projects','تقرير المشاريع','PDF','hard-hat'],
  ['projectCompletionAnalysis','تحليل إنجاز المشاريع','PDF','chart-column'],
  ['connections','تقرير التوصيلات','PDF','plug'],
  ['permits','تقرير التصاريح','PDF','file-check'],
  ['assets','تقرير الأصول','PDF','boxes'],
  ['closures','تقرير الإغلاقات','PDF','check-check'],
  ['tasks','تقرير متابعة أعمال المواقع','PDF','clipboard-list'],
  ['emergency','تقرير الطوارئ','PDF','siren']
 ]},
 {key:'quality',title:'السلامة والجودة والامتثال',subtitle:'ملاحظات المواقع والإجراءات التصحيحية والتدقيق',items:[
  ['safety','تقرير مخالفات السلامة','PDF','shield-alert'],
  ['safetyCorrective','تقرير السلامة والإجراءات التصحيحية الأسبوعي','PDF','shield-check'],
  ['qualityCorrective','تقرير الجودة والإجراءات التصحيحية الأسبوعي','PDF','badge-check'],
  ['contractorSafety','تقييم السلامة للمقاولين','PDF / PPTX','users'],
  ['executionViolations','تقرير مخالفات التنفيذ','PDF','alert-triangle'],
  ['minutes','تقرير المحاضر وإثباتات الحالة','PDF','files'],
  ['dataQuality','تقرير جودة البيانات','PDF','list-checks']
 ]},
 {key:'evaluations',title:'التقييمات والموارد البشرية',subtitle:'شؤون الموظفين وتقييم مهندسي المشروع',items:[
  ['hrStaff','تقرير الكادر والموارد البشرية','PDF','users-round'],
  ['employeeEvaluation','تقييم مهندسي المواقع','PDF','user-check'],
  ['electricityEngineerEvaluation','تقييم مهندسي شركة الكهرباء','PDF','award']
 ]},
 {key:'periodic',title:'التقارير الأسبوعية والفنية',subtitle:'المتابعة الدورية وتقارير أوامر العمل المتخصصة',items:[
  ['wednesdayMeeting','تقرير اجتماع PDC','PDF','calendar-days'],
  ['pdcMeeting2','تقرير اجتماع PDC 2 التجميعي','PDF / PPTX','presentation'],
  ['smartThursday','تقرير الخميس الذكي','PDF','chart-line'],
  ['importantLinks','تقرير الروابط المهمة وQR','PDF','link'],
  ['projectsReportEnginePdf','Projects Report Engine — تقرير أمر العمل','PDF','file-text'],
  ['projectsReportEngineExcel','Projects Report Engine — ملف أمر العمل','XLSX','file-spreadsheet'],
  ['excelExport','التصدير المخصص للأوراق والأعمدة','XLSX','sheet']
 ]},
 {key:'archive',title:'سجل وأرشفة التقارير',subtitle:'تصدير سجلات التقارير الصادرة',items:[
  ['archivePdf','سجل التقارير والأرشفة','PDF','archive'],
  ['archiveCsv','بيانات سجل التقارير','CSV','table']
 ]}
];
const LABELS={projectCompletionAnalysis:'projects',projectsReportEnginePdf:'projectsReportEngine',projectsReportEngineExcel:'projectsReportEngine',archivePdf:'reportArchive',archiveCsv:'reportArchive'};
const SPECIAL=new Set(['safetyCorrective','qualityCorrective','projectsReportEnginePdf','projectsReportEngineExcel','excelExport','archivePdf','archiveCsv']);
const $=(q,scope=document)=>scope.querySelector(q);
const $$=(q,scope=document)=>[...scope.querySelectorAll(q)];
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s??'').trim();
const nav=k=>$('#nav .nav-item[data-page="'+(LABELS[k]||k)+'"]');
function permitted(key){
 const node=nav(key);
 if(!node||node.hidden||getComputedStyle(node).display==='none'||node.getAttribute('aria-hidden')==='true')return false;
 const label=clean(node.querySelector('span')?.textContent||node.textContent);
 return typeof window.vdCanAccessLabel!=='function'||window.vdCanAccessLabel(label);
}
function entries(){return GROUPS.map(g=>({...g,items:g.items.filter(item=>permitted(item[0]))})).filter(g=>g.items.length)}
let query='',group='all',busy=false,dialog=null;
function matches(item){return clean([item[1],item[2],item[0]].join(' ')).toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar'))}
function render(){
 const root=$('#reportsCenterRoot');if(!root)return;
 const gs=entries(),n=gs.reduce((s,g)=>s+g.items.length,0);
 const visible=gs.map(g=>({...g,items:g.items.filter(item=>(group==='all'||group===g.key)&&matches(item))})).filter(g=>g.items.length);
 const shown=visible.reduce((s,g)=>s+g.items.length,0);
 root.innerHTML='<header class="rc-hero rc-unified-hero"><div><span>VISION DIMENSIONS | CENTRAL REPORT STUDIO</span><h2>مركز التقارير</h2><p>جميع التقارير المتاحة لحسابك، منظمة حسب التخصص. اختر نوع التقرير لإصداره من مولده الأصلي دون تغيير بياناته أو تصميمه.</p></div><div class="rc-total"><b>'+n+'</b><span>نوع تصدير متاح</span></div></header>'+
  '<div class="rc-control-strip"><label class="rc-quick-search"><span>ابحث عن تقرير</span><input id="rcSearchInput" type="search" autocomplete="off" placeholder="مثال: السلامة، الجودة، الخميس، Excel..." value="'+esc(query)+'"></label><span id="rcSearchCount">عرض '+shown+' من '+n+'</span></div>'+
  '<div class="rc-tab-strip" role="group" aria-label="تصنيف التقارير">'+
   '<button type="button" data-rc-group="all" class="'+(group==='all'?'active':'')+'">جميع التقارير</button>'+
   gs.map(g=>'<button type="button" data-rc-group="'+g.key+'" class="'+(group===g.key?'active':'')+'">'+esc(g.title)+' <small>'+g.items.length+'</small></button>').join('')+'</div>'+
   (visible.length?visible.map(g=>'<section class="rc-group" data-rc-section="'+g.key+'"><div class="rc-group-head"><div><h3>'+esc(g.title)+'</h3><p>'+esc(g.subtitle)+'</p></div><span>'+g.items.length+' خيارات</span></div><div class="rc-grid">'+g.items.map(item=>card(item)).join('')+'</div></section>').join(''):'<p class="rc-no-result">لا توجد تقارير مطابقة للبحث الحالي. جرّب كلمة أخرى.</p>');
 $('#rcSearchInput',root)?.addEventListener('input',e=>{
    const selectionStart=e.target.selectionStart, selectionEnd=e.target.selectionEnd;
    query=e.target.value;render();
    const input=$('#rcSearchInput');if(input){input.focus();try{input.setSelectionRange(selectionStart,selectionEnd)}catch(_){}}
 });
 $$('[data-rc-group]',root).forEach(b=>b.addEventListener('click',()=>{group=b.dataset.rcGroup;render()}));
 $$('[data-report-page]',root).forEach(b=>b.addEventListener('click',()=>dispatch(b.dataset.reportPage,b)));
}
function card([key,label,format]){
 const special=key==='excelExport'||key.startsWith('projectsReportEngine')||key==='safetyCorrective'||key==='qualityCorrective'||key==='pdcMeeting2';
 const act=key==='excelExport'?'اختيار الأعمدة والتصدير':key==='projectsReportEnginePdf'?'إعداد تقرير PDF':key==='projectsReportEngineExcel'?'إعداد ملف Excel':key==='archiveCsv'?'تصدير CSV':(special?'اختيار التقرير والتصدير':'تصدير التقرير');
 return '<article class="rc-card rc-unified-card"><div class="rc-card-copy"><strong>'+esc(label)+'</strong><small>'+esc(nav(key)?.querySelector('span')?.textContent?.trim()||label)+'</small><span class="rc-format">'+esc(format)+'</span></div><button class="rc-export-btn" type="button" data-report-page="'+esc(key)+'">'+act+'</button></article>';
}
function back(){if(nav('reportsCenter'))nav('reportsCenter').click()}
function errorMessage(e){const msg=e?.message||String(e||'تعذر التصدير');alert(msg)}
function lock(btn,on){busy=on;if(btn){btn.disabled=on;btn.classList.toggle('is-loading',on)}}
async function dispatch(key,btn){
 if(busy)return;
 if(!permitted(key)){alert('لا تتوفر صلاحية استخدام هذا التقرير.');return}
 if(key==='safetyCorrective'||key==='qualityCorrective')return chooseCorrective(key);
 if(key==='projectsReportEnginePdf'||key==='projectsReportEngineExcel')return chooseProjectReport(key);
 if(key==='excelExport'){nav('excelExport')?.click();$('#xeSheet')?.focus();return}
 if(key==='pdcMeeting2'){nav('pdcMeeting2')?.click();return}
 if(key==='archivePdf'||key==='archiveCsv')return archiveExport(key,btn);
 if(key==='contractorSafety')return window.VDContractorSafety?.exportGeneral?.()??alert('أداة التقييم غير متاحة.');
 if(key==='projectCompletionAnalysis')return window.VDLegacyReportsCenter?.exportProjectCompletionAnalysis(btn)??alert('مولد التقرير غير جاهز.');
 return window.VDLegacyReportsCenter?.exportGeneral(key,btn)??alert('مولد التقرير غير جاهز.');
}
function overlay(title,description,content,action,onConfirm){
 closeDialog();
 const layer=document.createElement('div');layer.className='rc-modal-overlay';layer.id='rcModalOverlay';
 layer.innerHTML='<div class="rc-dialog" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="rcModalTitle">'+
 '<div class="rc-dialog-title"><div><h3 id="rcModalTitle">'+esc(title)+'</h3><p>'+esc(description)+'</p></div><button type="button" class="rc-modal-x" data-close title="إغلاق">×</button></div>'+
 '<div class="rc-dialog-body">'+content+'<p class="rc-modal-error" role="alert" hidden></p></div>'+
 '<div class="rc-dialog-actions"><button type="button" data-close>إلغاء</button><button type="button" class="rc-export-btn" id="rcModalSubmit">'+esc(action)+'</button></div></div>';
 document.body.append(layer);dialog=layer;
 $$('[data-close]',layer).forEach(b=>b.addEventListener('click',closeDialog));
 layer.addEventListener('click',e=>{if(e.target===layer)closeDialog()});
 layer.addEventListener('keydown',e=>{if(e.key==='Escape')closeDialog()});
 $('#rcModalSubmit',layer).addEventListener('click',()=>onConfirm(layer));
 return layer;
}
function closeDialog(){if(dialog){dialog.remove();dialog=null}}
function showError(layer,msg){const el=$('.rc-modal-error',layer);if(el){el.hidden=false;el.textContent=msg}const submit=$('#rcModalSubmit',layer);if(submit)submit.disabled=false}
async function chooseCorrective(key){
 const safety=key==='safetyCorrective', endpoint=safety?'/api/safety-corrective':'/api/quality-corrective';
 const title=safety?'تقرير السلامة والإجراءات التصحيحية':'تقرير الجودة والإجراءات التصحيحية';
 const layer=overlay(title,'اختر التقرير الأسبوعي المحفوظ. سيتم تصدير PDF بنفس القالب المعتمد للغلاف والنهاية.',
 '<label class="rc-dialog-label">التقرير الأسبوعي<select id="rcCorrectiveSelect"><option value="">جارٍ تحميل التقارير...</option></select></label>', 'تصدير PDF',async modal=>{
  const select=$('#rcCorrectiveSelect',modal),id=select?.value;if(!id){showError(modal,'اختر تقريرًا محفوظًا أولًا.');return}
  // Open synchronously with the user click, avoiding popup blockers.
  const win=window.open('','_blank','width=1440,height=920');if(!win){showError(modal,'اسمح بالنوافذ المنبثقة لتصدير التقرير.');return}
  lock($('#rcModalSubmit',modal),true);
  try{
   const exporter=safety?window.VDSafetyCorrectiveCenter:window.VDQualityCorrectiveCenter;
   if(!exporter)throw Error('مولّد التقرير غير متاح.');
   closeDialog();nav(key)?.click();
   await exporter.prepare(id);
   await exporter.exportPDF(win);
   setTimeout(back,400);
  }catch(e){try{if(!win.closed)win.close()}catch(_){};back();errorMessage(e)}finally{busy=false}
 });
 try{
  const res=await fetch(endpoint+'/reports',{credentials:'same-origin',cache:'no-store'}),json=await res.json();
  if(!res.ok||json.ok===false)throw Error(json.error||'تعذر تحميل التقارير');
  if(dialog!==layer)return;
  const select=$('#rcCorrectiveSelect',layer);
  select.innerHTML='<option value="">اختر التقرير...</option>'+
   (json.reports||[]).map(r=>'<option value="'+esc(r.id)+'">'+esc((r.weekLabel||'تقرير أسبوعي')+' | '+(r.startDate||'')+' - '+(r.endDate||''))+'</option>').join('');
  if(!(json.reports||[]).length)showError(layer,'لا توجد تقارير محفوظة بعد. أنشئ تقريرًا في تبويب '+(safety?'السلامة':'الجودة')+' أولًا.');
 }catch(e){if(dialog===layer)showError(layer,e.message)}
}
function chooseProjectReport(key){
 const excel=key==='projectsReportEngineExcel';
 const layer=overlay('Projects Report Engine', 'أدخل رقم أمر العمل لإصدار التقرير بنفس مدخلاته وصوره المحفوظة.',
 '<label class="rc-dialog-label">رقم أمر العمل<input id="rcWorkOrder" type="text" dir="ltr" inputmode="numeric" maxlength="10" placeholder="رقم أمر العمل (حتى 10 أرقام)" autocomplete="off"></label>',
 excel?'تصدير Excel':'تصدير PDF',async modal=>{
  const wo=clean($('#rcWorkOrder',modal)?.value);if(!/^[0-9]{1,10}$/.test(wo)){showError(modal,'أدخل رقم أمر عمل صحيحًا من 1 إلى 10 أرقام.');return}
  const win=excel?null:window.open('','_blank','width=1400,height=900');
  if(!excel&&!win){showError(modal,'اسمح بالنوافذ المنبثقة للتصدير.');return}
  lock($('#rcModalSubmit',modal),true);
  try{
   const api=window.VDProjectsReportCenter;if(!api)throw Error('مولّد مشاريع أمر العمل غير متاح.');
   closeDialog();nav('projectsReportEngine')?.click();
   await api.loadWO(wo);
   if(excel)await api.exportExcel();else await api.exportPDF(win);
   setTimeout(back,500);
  }catch(e){if(win)try{win.close()}catch(_){};back();errorMessage(e)}finally{busy=false}
 });
 $('#rcWorkOrder',layer)?.focus();
}
async function archiveExport(key,btn){
 lock(btn,true);
 try{
  nav('reportArchive')?.click();
  let target=null;
  for(let i=0;i<30;i++){
   target=key==='archiveCsv'?$('.ra-download'):$('.ra-print');
   if(target&&!target.disabled)break;
   await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(!target)throw Error('أداة تصدير سجل التقارير غير جاهزة. افتح تبويب أرشفة التقارير وحاول مرة أخرى.');
  target.click();if(key==='archiveCsv')setTimeout(back,350);
 }catch(e){errorMessage(e)}finally{lock(btn,false)}
}
window.renderReportsCenter=render;
window.VDUnifiedReportsCenter={render,entries,groups:GROUPS,dispatch,closeDialog};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();
