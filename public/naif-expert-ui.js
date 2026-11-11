/* Naif dashboard expert: exact current-page rendered evidence, navigation,
   dashboard catalogue and verified metric methodology.
   No background scraping, data mutation, or cross-city network calls. */
(() => {'use strict';
const normalize=v=>String(v??'').normalize('NFKC').toLowerCase()
 .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
 .replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
 .replace(/[^\p{L}\p{N}%]+/gu,' ').trim();
const clip=(x,n=150)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
const visible=el=>{
 if(!el||el.hidden||!el.getClientRects?.().length)return false;
 const s=window.getComputedStyle?.(el);
 return (!s||s.display!=='none'&&s.visibility!=='hidden') &&
  !el.closest('[aria-hidden="true"],[hidden]');
};
const activeNav=()=>document.querySelector('#nav .nav-item.active[data-page]');
const activeKey=()=>activeNav()?.dataset.page||document.querySelector('#masterPage.active')?'master':'';
function currentKey(){
 const nav=activeNav();if(nav)return nav.dataset.page||'';
 const active=document.querySelector('#masterPage.active');if(active)return 'master';
 const page=document.querySelector('.page.active[id]');
 return page?.id||'';
}
function navEntries(){
 return [...document.querySelectorAll('#nav .nav-item[data-page]')]
 .filter(el=>visible(el)&&el.dataset.page)
 .map(el=>({key:el.dataset.page,label:clip(el.textContent.replace(/^[^A-Za-z\u0621-\u064A]+/,'').trim(),95),el}));
}
function activeRoot(){
 const key=currentKey();
 const found=document.querySelector('#'+(window.CSS?.escape?.(key)||key)+'Page.active');
 if(found&&visible(found))return found;
 const roots=[...document.querySelectorAll('.page.active,main.active,#masterPage.active,#dataPage.active,#meetingPage.active,#reportsCenterPage.active,#reportArchivePage.active')]
 .filter(el=>visible(el)&&!el.closest('.vd-naif,.vd-naif-dock'));
 return roots.find(el=>el.querySelector('.master-card,.mini-kpi,[class*="kpi"],canvas,.pa-card,.ca-card,.aa-card,.pe-card'))||roots[0]||null;
}
function cardsFrom(root){
 if(!root)return[];
 const selectors=['.master-card','.mini-kpi','.pa-card','.ca-card','.pe-card','.aa-card',
 '.kpi-card','.kpi-item','.kpi-tile','.kpi-box','.kpi','.metric-card','.stat-card',
 '.stat-item','.summary-card','.summary-kpi','.info-card','.dashboard-card',
 '[class*="-kpi-"]','[class*="-stat-card"]','[data-kpi]'];
 const cards=[],seen=new Set();
 const elements=[...root.querySelectorAll(selectors.join(','))].slice(0,550);
 for(const el of elements){
  if(!visible(el)||el.closest('.vd-naif,.vd-naif-dock'))continue;
  if(el.querySelectorAll(selectors.join(',')).length&&el.textContent?.length>320)continue;
  const valueEl=el.querySelector('strong,[class*="value"],.number,.kpi-number,b');
  const labelEl=el.querySelector('.kpi-label,.card-label,.metric-label,.stat-label,.label,span,h4,h3,p');
  const label=clip(labelEl?.textContent,110),value=clip(valueEl?.textContent,105);
  if(!label||!value||label===value||value.length>90||!/[0-9٠-٩۰-۹%٪]/.test(value))continue;
  if(!/[A-Za-z\u0621-\u064A]/.test(label))continue;
  const ref=normalize(label)+'|'+value;
  if(seen.has(ref))continue;seen.add(ref);
  const detail=clip(el.querySelector('small,.note,.kpi-subtitle,.card-subtitle')?.textContent,125);
  cards.push({label,value,detail});
 }
 return cards.slice(0,140);
}
function chartsFrom(root){
 if(!root||!window.Chart?.getChart)return[];
 const charts=[];
 for(const canvas of [...root.querySelectorAll('canvas')].slice(0,65)){
  if(!visible(canvas))continue;
  const chart=window.Chart.getChart(canvas);
  if(!chart?.data?.labels?.length)continue;
  const parent=canvas.closest('article,.panel,section,.chart-card')||canvas.parentElement;
  const title=clip(parent?.querySelector('h2,h3,h4,.panel-title,.chart-title')?.textContent||canvas.getAttribute('aria-label')||canvas.id,105);
  const labels=chart.data.labels.slice(0,24).map(x=>clip(Array.isArray(x)?x.join(' '):x,48));
  const series=(chart.data.datasets||[]).slice(0,4).map(set=>({
    name:clip(set.label||'القيم',65),
    values:labels.map((label,i)=>({label,value:typeof set.data?.[i]==='object'?(set.data[i]?.y??null):set.data?.[i]}))
     .filter(x=>x.value!==null&&x.value!==undefined).slice(0,18)
  }));
  if(title&&series.some(s=>s.values.length))charts.push({title,series});
 }
 return charts.slice(0,30);
}
function currentSnapshot(){
 const root=activeRoot(),key=currentKey(),nav=navEntries();
 const title=clip(document.getElementById('pageTitle')?.textContent||activeNav()?.textContent||key||'الرئيسية');
 const cards=cardsFrom(root),charts=chartsFrom(root);
 const filterText=clip(document.querySelector('#chartFilterSummary.show')?.textContent||'',220);
 const displayedRows=root?[...root.querySelectorAll('tbody tr')].filter(visible).length:0;
 return {root,key,title,cards,charts,filterText,displayedRows,nav};
}
const pageAliases={
 master:['الرئيسية','اللوحة الرئيسية','المؤشرات العامة','الداشبورد الرئيسي'],
 workorders:['أوامر العمل','الاوامر','الطلبات'],
 projects:['المشاريع'],
 connections:['التوصيلات'],
 permits:['التصاريح','بلدي'],
 assets:['الأصول','المعدات'],
 closures:['الإغلاقات','الاقفالات'],
 emergency:['الطوارئ','الاشعارات'],
 tasks:['متابعة أعمال المواقع','الافادات'],
 dataQuality:['جودة البيانات','الافادات الوهمية'],
 safety:['مخالفات السلامة'],
 executionViolations:['مخالفات التنفيذ'],
 minutes:['محاضر مخالفة','محاضر اثبات الحالة'],
 finance:['المالية','المستخلصات'],
 hrStaff:['الكادر','الموارد البشرية'],
 reportArchive:['سجل التقارير الصادرة','ارشيف التقارير'],
 reportsCenter:['مركز التقارير','التقارير العامة'],
 excelExport:['مركز تقارير الاكسيل','الاكسيل'],
 projectsReportEngine:['projects report engine','تقرير المشاريع'],
 contractorSafety:['تقييم السلامة للمقاولين'],
 qualityCorrective:['تقرير الجودة والإجراءات التصحيحية'],
 safetyCorrective:['تقرير السلامة والإجراءات التصحيحية'],
 engineeringInspection:['وكيل الفحص الهندسي'],
 temporaryGenerators:['تقرير المؤقتات','المولدات'],
 wednesdayMeeting:['اجتماع pdc'],
 pdcMeeting2:['اجتماع pdc 2'],
 employeeEvaluation:['تقييم مهندسي المواقع'],
 electricityEngineerEvaluation:['تقييم مهندسي شركة الكهرباء'],
 importantLinks:['الروابط المهمة']
};
function requestedNav(q,nav){
 const n=normalize(q);
 return nav.map(item=>{
  const terms=[item.label,...(pageAliases[item.key]||[])].map(normalize).filter(x=>x.length>=3);
  const score=Math.max(0,...terms.map(t=>n.includes(t)?t.length:0));
  return {item,score};
 }).filter(x=>x.score).sort((a,b)=>b.score-a.score)[0]?.item||null;
}
const queryTerms=q=>normalize(q).split(' ').filter(w=>w.length>2&&!/^(ما|ماهي|هو|كم|عدد|الداشبورد|اللوحه|التبويب|عندي|اعطني|الحاليه|حاليا|المشروع|مشروع|عندنا|الان|اليوم|في|من|على|عن|الى|هل|نسبه|القيم|بيانات|المؤشر)$/.test(w));
const aliases={انجاز:['تقدم','اكتمال','تنفيذ'],تقدم:['انجاز','اكتمال'],متاخر:['تاخير'],صادر:['تصدير'],مسدد:['مدفوع'],منجز:['تم التنفيذ']};
function cardScore(card,q){
 const title=normalize(card.label),tokens=queryTerms(q),s=normalize(q);
 let v=tokens.reduce((n,word)=>n+(title.includes(word)?5:(aliases[word]||[]).some(a=>title.includes(a))?2:0),0);
 if(/نسب|انجاز|تقدم/.test(s)&&/نسبه الانجاز|نسبه التقدم|نسبه التنفيذ/.test(title))v+=3;
 if(/الغرام/.test(s)&&/غرام/.test(title))v+=2;
 return v;
}
const hasMetricIntent=q=>/كم|عدد|نسب|انجاز|تقدم|كروت|بطاقات|مؤشر|احصائ|قيمة|قيمه|حاله|اجمالي|المنفذ|تاخير|متاخر|مسدد|التحصيل|متوسط|ملخص|شارت|رسم|مخطط|اكثر|اعلى|توزيع|ارقام|جدول|صفوف/.test(normalize(q));
const allIntent=q=>/جميع المؤشرات|كل المؤشرات|جميع الكروت|كل الكروت|لخص الكروت|ملخص المؤشرات|ملخص التبويب|اشرح المؤشرات|البطاقات الظاهرة/.test(normalize(q));
const chartIntent=q=>/رسم|شارت|مخطط|توزيع الرسم|الشارتات|الرسوم البيانية/.test(normalize(q));
const navigationIntent=q=>/^(?:افتح|انتقل|اذهب|روح|ودني|وريني|اعرض التبويب|افتح تبويب|حولني الى)\s/.test(normalize(q));
const methodology={
 projects:'في تبويب المشاريع، نسبة التقدم تعتمد على متوسط قيم حقل «نسبة الإنجاز» للسجلات التي تحتوي قيمة صالحة، بينما نسبة التنفيذ المكتمل تُحسب من عدد الأوامر ذات حالة تنفيذ مكتملة إلى إجمالي الأوامر. النسبتان ليستا متطابقتين بالضرورة.',
 connections:'التوصيلات لها مقياسان مختلفان: متوسط التقدم الميداني من حقل نسبة الإنجاز، ونسبة التنفيذ المكتمل من حالة التنفيذ. يفصل الداشبورد بينهما.',
 workorders:'في تبويب أوامر العمل، نسبة الإنجاز هي عدد أوامر العمل بحالة «تم التنفيذ» مقسومًا على إجمالي الأوامر في النطاق المفلتر، مع ضرورة التمييز بين مراحل التنفيذ ومراحل الإغلاق.',
 emergency:'مؤشر إنجاز الطوارئ يحسب الأوامر المنجزة من إجمالي الإشعارات المقروءة؛ ومؤشر أرشفة المستندات منفصل عن إنجاز الأعمال.',
 closures:'مؤشر اكتمال الإغلاق يجمع حالة استلام المستندات ومراجعتها وختمها وإرسالها ورفعها ومستندات الأصول وشهادة الإنجاز؛ لا يكفي تنفيذ العمل وحده لاعتبار الإغلاق مكتملًا.',
 permits:'مؤشر التصاريح يتضمن الحالات الصادرة أو المعتمدة أو «لا يتطلب»، وتبقى نسبة اتخاذ الإجراء مؤشرًا آخر.',
 assets:'مؤشر الأصول يحسب اكتمال مراحل مراجعة الزراعة ونموذج الأصول والاستلام الميداني وإجراء 207 والاستلام على النظام.',
 tasks:'مؤشر متابعة الأعمال الميدانية يميّز بين وجود إفادة الموقع وبين معالجة المرفقات؛ الإفادة موجودة لا تعني أن المرفقات عولجت.',
 finance:'نسبة التحصيل تُقرأ مقارنةً بإجمالي القيم المالية المسجلة والمدفوع منها، ويجب عدم الخلط بين الإسنادات والفواتير والمستخلصات والمدفوع فعليًا.'
};
function answer(q){
 const query=clip(q,1350),norm=normalize(query),snapshot=currentSnapshot();
 if(!query||!snapshot.nav.length)return null;
 if(navigationIntent(query)){
  const target=requestedNav(query,snapshot.nav);
  if(!target)return 'لم أجد تبويبًا مطابقًا في القائمة المتاحة لحسابك. هذه بعض التبويبات الظاهرة: '+snapshot.nav.slice(0,8).map(x=>x.label).join('، ')+'.';
  target.el.click();
  return 'فتحت تبويب «'+target.label+'» في لوحة المشروع الحالية. لا أتعامل مع تبويب مخفي أو غير مصرح به.';
 }
 if(/كيف.*(?:تحسب|يحسب|حساب)|معادله|منهجيه|كيف يتم احتساب|شرح حساب|طريقة حساب/.test(norm)){
  const target=requestedNav(query,snapshot.nav);
  const key=target?.key||snapshot.key;
  if(methodology[key])return 'منهجية المؤشر في '+(target?.label||snapshot.title)+': '+methodology[key]+' يمكنني أيضًا إظهار القيمة الحالية من التبويب إذا كان معروضًا.';
 }
 if(/ما هي التبويبات|جميع التبويبات|خارطة الداشبورد|خريطة الداشبورد|اقسام الداشبورد|ماذا تعرف عن النظام|وش تعرف عن النظام|تعرف كل التبويبات/.test(norm)){
  return 'التبويبات الظاهرة لحسابك في هذه اللوحة ('+snapshot.nav.length+'):\n'+snapshot.nav.map(x=>'• '+x.label).join('\n')+'\nهذه قائمة واجهات مرئية، وليست ضمانًا لوجود مصدر بيانات مفهرس لكل تبويب.';
 }
 const mentioned=requestedNav(query,snapshot.nav);
 if(mentioned&&mentioned.key!==snapshot.key){
  // Never answer from the current page when the requested data belongs elsewhere.
  return null;
 }
 if(!hasMetricIntent(query))return null;
 const source='المصدر: الكروت/الرسوم المعروضة في تبويب «'+snapshot.title+'» باللوحة الحالية'+(snapshot.filterText?'، وفلاتر الرسم الحالية: '+snapshot.filterText:'')+'.';
 if(chartIntent(query)&&snapshot.charts.length){
  const tokens=queryTerms(query);
  const ranked=snapshot.charts.map(c=>({c,score:tokens.reduce((a,w)=>a+(normalize(c.title).includes(w)?5:0),0)})).sort((a,b)=>b.score-a.score);
  const chosen=ranked[0]?.score>0?ranked.slice(0,2).map(x=>x.c):snapshot.charts.slice(0,2);
  return chosen.map(c=>'الرسم «'+c.title+'»:\n'+c.series.map(s=>s.name+': '+s.values.slice(0,12).map(x=>x.label+' = '+clip(x.value,40)).join('، ')).join('\n')).join('\n\n')+'\n'+source;
 }
 if(/صفوف|صف في الجدول|سطر في الجدول/.test(norm)&&snapshot.displayedRows){
  return 'عدد الصفوف المعروضة حاليًا في الجدول: '+snapshot.displayedRows+'. هذا عدد الصفوف الظاهرة وليس بالضرورة إجمالي سجلات الشيت بسبب الصفحات والفلاتر.\n'+source;
 }
 if(allIntent(query)&&snapshot.cards.length){
  return 'مؤشرات التبويب الحالي ('+snapshot.cards.length+' كرتًا/مؤشرًا مقروءًا):\n'+snapshot.cards.slice(0,48).map(c=>'• '+c.label+': '+c.value+(c.detail?' — '+c.detail:'')).join('\n')+(snapshot.cards.length>48?'\nبقية المؤشرات متاحة بتحديد اسم القسم.':'')+'\n'+source;
 }
 if(!snapshot.cards.length)return null;
 const matches=snapshot.cards.map(c=>({c,score:cardScore(c,query)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 if(!matches.length)return null;
 // A specific question gets a small, verifiable subset rather than unrelated cards.
 return matches.slice(0,5).map(x=>'• '+x.c.label+': '+x.c.value+(x.c.detail?' ('+x.c.detail+')':'')).join('\n')+'\n'+source;
}
window.NaifExpertUI={answer,currentSnapshot,navEntries,methodology};
})();