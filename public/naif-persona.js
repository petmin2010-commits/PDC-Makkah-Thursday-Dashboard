(()=>{'use strict';
/* Project-scoped Naif persona: conversational presentation with grounded navigation.
 * No simulated AI answer, no microphone access until user click, no outbound data.
 */
const project=(document.title.includes('مكة')?'مكة':'جدة'),labels=[['أوامر العمل','workorders'],['الطلبات','workorders'],['الرئيسية','master'],['المشاريع','projects'],['التوصيلات','connections'],['التصاريح','permits'],['الجودة','qualityCorrective'],['السلامة','safety'],['المقاولين','contractorSafety'],['التقارير','reportsCenter'],['المرفقات','siteFollowup'],['الاجتماعات','wednesdayMeeting']];
const engineer='<img src="/naif-realistic.svg?v=20261110-logo-cat2-2" alt="المهندس نايف بصورة واقعية" draggable="false" loading="eager">';
function init(){if(document.querySelector('.vd-naif[role="dialog"]'))return;
const nav=document.getElementById('nav');if(!nav)return;
let launch=document.getElementById('vdNaifLauncher');
if(!launch){
  launch=document.createElement('button');launch.id='vdNaifLauncher';launch.type='button';launch.className='nav-item vd-naif-nav-item';launch.innerHTML='<span aria-hidden="true">👷🏻‍♂️</span> <span>المهندس نايف</span>';
  const adminLabel=[...nav.querySelectorAll('.nav-section-label')].find(el=>el.textContent.includes('المتابعة الادارية'));
  if(adminLabel)adminLabel.after(launch);else nav.append(launch);
}
launch.setAttribute('aria-haspopup','dialog');launch.setAttribute('aria-expanded','false');
const dialog=document.createElement('section');dialog.className='vd-naif';dialog.hidden=true;dialog.dataset.state='idle';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','نايف، مساعد مشروع '+project);
dialog.innerHTML=`<div class="vd-naif-window"><div class="vd-naif-portrait">${engineer}<div><h2>المهندس نايف</h2><p>مساعد العمليات الذكي — مشروع ${project}</p><div class="vd-naif-status" role="status">جاهز للمساعدة</div></div></div><div class="vd-naif-content"><div class="vd-naif-header"><b>محادثة نايف</b><button type="button" class="vd-naif-close" aria-label="إغلاق">×</button></div><div class="vd-naif-messages" aria-live="polite"></div><div class="vd-naif-quick"><button data-query="أوامر العمل">أوامر العمل</button><button data-query="المشاريع">المشاريع</button><button data-query="التقارير">التقارير</button><button data-query="السلامة">السلامة</button><button data-query="كم الإفادات الضعيفة والشكلية؟">جودة الإفادات</button></div><form class="vd-naif-form"><input aria-label="سؤالك لنايف" placeholder="اسأل نايف عن المشروع أو افتح قسمًا..." required><button type="button" class="vd-naif-mic" aria-label="التحدث بالصوت" title="إملاء صوتي">🎤</button><button type="button" class="vd-naif-call" title="مكالمة صوتية داخل المنصة" aria-pressed="false">📞 مكالمة نايف</button><button type="button" class="vd-naif-conversation" title="وضع المحادثة الصوتية التلقائية" aria-pressed="false">🗣️ محادثة</button><button type="button" class="vd-naif-teach" title="اقترح معرفة جديدة لنايف">📖 علّم نايف</button><button type="button" class="vd-naif-review" title="مراجعة الدروس المعلقة - للمدير">✅ اعتماد الدروس</button><button type="submit">إرسال</button><button type="button" class="vd-naif-sound" title="تفعيل أو إيقاف الصوت" aria-label="الصوت">🔊</button></form><p class="vd-naif-note">نايف خبير قراءة بيانات وكروت وشارتات الداشبورد حسب صلاحياتك. يذكر مصدر كل إجابة ولا يغيّر البيانات أو الصلاحيات.</p></div></div>`;
document.body.append(dialog);const input=dialog.querySelector('input'),messages=dialog.querySelector('.vd-naif-messages'),status=dialog.querySelector('.vd-naif-status');let voice=false,recognition=null,previousFocus=null,conversationMode=false;
const state=(s,label)=>{dialog.dataset.state=s;status.textContent=label};
/* Browser-speech fallback: Arabic voice selection, chunking and accurate technical codes. */
let speechGeneration=0;
const stopSpeech=()=>{speechGeneration++;try{window.speechSynthesis?.cancel?.()}catch(e){}speechInProgress=false};
const spokenArabic=text=>{
 const digits=['صفر','واحد','اثنين','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة'];
 return String(text??'').replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
  .replace(/\b(?:401|801|155|802|\d{7,15})\b/g,x=>x.split('').map(d=>digits[Number(d)]||d).join('، '))
  .replace(/\bPDC\b/gi,'بي دي سي').replace(/\bUDS\b/gi,'يو دي إس').replace(/\bSPI\b/gi,'إس بي آي');
};
const chunksForVoice=(text,max=155)=>{
 const chunks=[];let segment='';
 for(const word of String(text).split(/\s+/).filter(Boolean)){
  if(segment&&(segment.length+word.length+1>max)){chunks.push(segment);segment=word;}
  else segment+=(segment?' ':'')+word;
 }
 if(segment)chunks.push(segment);return chunks;
};
const say=text=>{
 if(window.NaifRealtimeVoice?.isActive?.()||window.NaifRealtimeVoice?.isConnecting?.())return;
 if(!voice||!window.speechSynthesis||typeof window.SpeechSynthesisUtterance!=='function'){
  if(callActive){awaitingVoiceAnswer=false;listen()}return;
 }
 stopSpeech();const id=speechGeneration;
 const synth=window.speechSynthesis;
 const voices=synth.getVoices?.()||[];
 const male=/hamed|fahd|faris|shakir|shaker|omar|mohamed|mohammad|ahmed|tariq|naayf|nayef|male|حامد|فهد|فارس|شاكر|عمر|محمد|أحمد|طارق|نايف|رجالي/i;
 const preferred=voices.filter(v=>/^ar(?:-|_|$)/i.test(v.lang||''));
 const selected=preferred.find(v=>male.test(v.name||'')&&/^ar[-_]SA$/i.test(v.lang||''))||preferred.find(v=>male.test(v.name||''))||preferred.find(v=>/^ar[-_]SA$/i.test(v.lang||''))||preferred[0];
 const parts=chunksForVoice(spokenArabic(text).slice(0,7500));
 if(!parts.length){awaitingVoiceAnswer=false;if(callActive)listen();return}
 speechInProgress=true;stopRecognition();let index=0;
 const finish=()=>{
  if(id!==speechGeneration)return;
  speechInProgress=false;awaitingVoiceAnswer=false;
  state('idle',callActive?'مكالمة نايف — يستمع':'جاهز للمساعدة');
  if(callActive)listen();
 };
 const next=()=>{
  if(id!==speechGeneration)return;
  if(index>=parts.length)return finish();
  const utterance=new window.SpeechSynthesisUtterance(parts[index++]);
  utterance.lang=selected?.lang||'ar-SA';if(selected)utterance.voice=selected;
  utterance.rate=.91;utterance.pitch=.93;
  utterance.onstart=()=>{if(id===speechGeneration)state('speaking','نايف يتحدث معك بالعربية...')};
  utterance.onend=()=>{if(id===speechGeneration)next()};
  utterance.onerror=e=>{
   if(id!==speechGeneration)return;
   if(['interrupted','canceled'].includes(e?.error))return finish();
   next();
  };
  try{synth.speak(utterance)}catch(e){finish()}
 };
 next();
};
const bubble=(text,isUser)=>{const item=document.createElement('div');item.className='vd-naif-bubble'+(isUser?' user':'');item.textContent=text;messages.append(item);messages.scrollTop=messages.scrollHeight};

/* Read-only bridge to the existing advice-quality engine. Never reclassify or write sheet data. */
const qualityIntent=/جود[ةه]|إفاد|افاد|جوهري|شكلي|وهمي|مشتبه|ضعيف|إهمال|اهمال/i;
const numeral=n=>Number(n||0).toLocaleString('ar-SA');
const qualityNav=()=>[...document.querySelectorAll('#nav [data-page="dataQuality"]')].find(e=>!e.hidden&&getComputedStyle(e).display!=='none');
function qualityAnswer(query,ai){
 const counts=ai.counts||{},age=ai.age||{},orders=Array.isArray(ai.currentOrders)?ai.currentOrders:[];
 const classifications={weak:'ضعيف',suspicious:'شكلي',substantive:'جوهري',pending:'بانتظار'};
 let type=/وهمي|شكلي|مشتبه/.test(query)?'suspicious':/ضعيف/.test(query)?'weak':/جوهري/.test(query)?'substantive':/انتظار|لم تحلل/.test(query)?'pending':/15|١٥|إهمال شديد/.test(query)?'severe':/3|٣|تأخر|متأخر|متابع/.test(query)?'stale':'';
 const days=r=>Number(r.daysSinceSubstantive);
 const selected=type==='stale'?orders.filter(r=>Number.isFinite(days(r))&&days(r)>=3):type==='severe'?orders.filter(r=>Number.isFinite(days(r))&&days(r)>=15):type?orders.filter(r=>type==='suspicious'?r.classification==='شكلي'||String(r.classification||'').includes('مشتبه'):String(r.classification||'').includes(classifications[type])):orders;
 const total={suspicious:counts.suspicious,weak:counts.weak,substantive:counts.substantive,pending:counts.pending,severe:age.severe,stale:['old','veryOld','neglect','severe'].reduce((s,k)=>s+Number(age[k]||0),0)};
 let answer='نتائج محرك جودة الإفادات في '+project+' (المصدر: تبويب جودة البيانات):\n';
 answer+='أوامر تحت الرقابة: '+numeral(ai.trackedOrders)+'؛ جوهرية: '+numeral(counts.substantive)+'؛ ضعيفة: '+numeral(counts.weak)+'؛ شكلية/مشتبهة: '+numeral(counts.suspicious)+'؛ بانتظار التحليل: '+numeral(counts.pending)+'؛ دون متابعة جوهرية 3+ أيام: '+numeral(total.stale)+'؛ 15+ يوم: '+numeral(age.severe)+'.';
 if(!ai.agentEnabled)answer+='\nتنبيه: محرك التحليل الذكي غير مفعل حاليًا؛ بعض الحالات قد تكون بانتظار تحليل.';
 if(ai.error)answer+='\nتنبيه من المصدر: '+String(ai.error).slice(0,180);
 const wantsPeople=/من |مين|المهندس|المهندسين|أسماء|اسماء|اعرض|تفاصيل|قائمة|أكثر|اكثر|حسب/.test(query);
 if(wantsPeople){
   const groups=new Map();for(const row of selected){const name=String(row.engineer||'غير محدد').trim();groups.set(name,(groups.get(name)||0)+1)}
   const top=[...groups].sort((a,b)=>b[1]-a[1]).slice(0,10);
   answer+='\n'+(type?'الحالات المطلوبة':'توزيع الحالات الحالية')+': '+numeral(type?total[type]??selected.length:selected.length)+'.';
   if(top.length)answer+='\nأبرز المهندسين: '+top.map(([name,n])=>name+' ('+numeral(n)+')').join('، ')+'.';
   else answer+='\nلا توجد سجلات تفصيلية متاحة في بيانات المصدر لهذه الفئة.';
 }
 answer+='\nأوامر العمل في مرحلة الإغلاق مستبعدة من فحص الجودة وفق قواعد النظام.';
 return answer;
}
async function replyQuality(query){
 const nav=qualityNav();
 if(!nav)return 'تبويب جودة البيانات غير متاح بصلاحيات الحساب الحالية؛ لن أعرض أرقامًا دون مصدر مصرح به.';
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),18000);
 try{
   const response=await fetch('/api/rpc',{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'getNaifAdviceQuality',args:[]})});
   if(response.status===401||response.status===403)return 'انتهت الجلسة أو ليست لديك صلاحية قراءة جودة البيانات. سجّل الدخول بحساب مخول.';
   if(!response.ok){
     const body=await response.json().catch(()=>({}));
     const quota=/quota|429|rate limit/i.test(String(body.error||''));
     return quota?'تعذّر تحديث نتائج جودة الإفادات مؤقتًا بسبب بلوغ الحد المسموح لقراءات Google Sheets. أعد المحاولة لاحقًا؛ لن أعرض أرقامًا غير مؤكدة.':'تعذر الاتصال بمحرك جودة الإفادات (HTTP '+response.status+'). أعد المحاولة لاحقًا.';
   }
   const payload=await response.json();const page=payload?.result;
   if(!payload?.ok||page?.key!=='dataQuality'||!page.adviceIntelligence)return 'لم أجد نتائج موثوقة من محرك جودة الإفادات؛ لن أخمن النتائج.';
   const answer=qualityAnswer(query,page.adviceIntelligence);
   return page.stale?'هذه آخر نتائج ناجحة محفوظة بتاريخ '+String(page.updatedAt||'غير محدد')+'، وليست قراءة لحظية بسبب تعذر تحديث Google Sheets.\n'+answer:answer;
 }catch(e){
   if(e.name==='AbortError')return 'استغرقت قراءة جودة الإفادات وقتًا أطول من المعتاد؛ أوقفت الانتظار لتظل المحادثة متاحة. حاول لاحقًا.';
   return 'تعذر الوصول إلى نتائج جودة الإفادات الحالية. أعد المحاولة لاحقًا. ('+String(e.message||e).slice(0,100)+')';
 }finally{clearTimeout(timeout)}
}


// Read the actual KPI cards and chart data already rendered for THIS logged-in
// dashboard and its currently applied filters. Never crawl another city/site.
const naifMetricNorm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function naifActivePage(){
 return document.querySelector('#nav .nav-item.active[data-page]')?.dataset.page
  ||(document.querySelector('#masterPage.active')?'master':'');
}
function naifVisible(el){
 if(!el||!el.getClientRects().length)return false;
 const s=getComputedStyle(el);
 return s.display!=='none'&&s.visibility!=='hidden';
}
function naifDisplayMetrics(){
 const root=document.querySelector('#masterPage.active,#dataPage.active,#meetingPage.active,#reportsCenterPage.active,#excelExportPage.active');
 const pageKey=naifActivePage(),title=(document.getElementById('pageTitle')?.textContent||pageKey).trim();
 if(!root||!naifVisible(root))return {pageKey,title,cards:[],charts:[]};
 const cards=[],seen=new Set();
 const selectors=['.master-card','.mini-kpi','.pa-card','.ca-card','.pe-card','.aa-card',
   '.permit-delay-card','.permit-delay-kpi','.emergency-kpi','.summary-kpi',
   '.kpi-card','.metric-card','.stat-card','.kpi-tile','.kpi-item','.kpi-box','.summary-card'];
 for(const el of root.querySelectorAll(selectors.join(','))){
  if(!naifVisible(el))continue;
  const labelEl=el.querySelector('span,.card-label,.kpi-label,.metric-label,.stat-label,label');
  const valueEl=el.querySelector('strong,.card-value,.kpi-value,.metric-value,.stat-value,b');
  if(!labelEl||!valueEl)continue;
  const label=String(labelEl.textContent||'').replace(/\s+/g,' ').trim().slice(0,105);
  const value=String(valueEl.textContent||'').replace(/\s+/g,' ').trim().slice(0,115);
  if(!label||!value||label===value||!/[0-9٠-٩۰-۹%٪—]|ر\.س/.test(value))continue;
  const key=naifMetricNorm(label)+'|'+value;
  if(seen.has(key))continue;
  seen.add(key);
  const note=String(el.querySelector('small')?.textContent||'').replace(/\s+/g,' ').trim().slice(0,95);
  cards.push({label,value,note});
 }
 const charts=[];
 if(window.Chart?.getChart){
  for(const canvas of root.querySelectorAll('canvas')){
   if(!naifVisible(canvas))continue;
   const chart=window.Chart.getChart(canvas);
   if(!chart?.data?.labels?.length)continue;
   const heading=canvas.closest('article,.panel,section')?.querySelector('h3,h2,.panel-title')?.textContent?.trim()||canvas.id;
   if(!heading)continue;
   const labels=chart.data.labels.slice(0,24),sets=(chart.data.datasets||[]).slice(0,4);
   const series=sets.map(set=>({name:String(set.label||'المؤشر').slice(0,55),values:labels.map((name,i)=>({
    name:String(name).slice(0,55),value:typeof set.data?.[i]==='object'?(set.data[i]?.y??null):set.data?.[i]
   })).filter(v=>v.value!==null&&v.value!==undefined)}));
   charts.push({title:String(heading).slice(0,125),series});
  }
 }
 return {pageKey,title,cards:cards.slice(0,130),charts:charts.slice(0,45)};
}
function naifIndicatorAnswer(question){
 const q=naifMetricNorm(question),page=naifDisplayMetrics();
 if(!page.cards.length&&!page.charts.length)return null;
 const current=page.pageKey;
 // A question naming another tab must use server-side authorization and its
 // own Google Sheet, rather than accidentally returning the main dashboard KPI.
 const scopes={projects:['المشاريع'],connections:['التوصيلات'],permits:['التصاريح','بلدي'],workorders:['اوامر العمل'],
   emergency:['الطوارئ'],assets:['الاصول'],safety:['السلامه'],executionViolations:['مخالفات التنفيذ'],
   finance:['الماليه','المستخلصات'],tasks:['الافادات','المهام'],closures:['الاغلاقات']};
 const named=Object.entries(scopes).find(([key,terms])=>terms.some(term=>q.includes(naifMetricNorm(term))));
 if(named&&named[0]!==current)return null;
 const all=/جميع|كل الكروت|كل المؤشرات|الكروت|البطاقات|المؤشرات|العدادات|الاحصائيات/.test(q);
 const chartIntent=/شارت|رسم|رسوم|مخطط|توزيع|اتجاه/.test(q);
 if(!all&&!chartIntent&&!/نسب|انجاز|تقدم|كم|عدد|اجمالي|متوسط|معدل|قيمة|تكلفة|حال|تأخير|متاخر|منفذ|مكتمل|مؤشر|spi|غرام|تصريح|تحصيل/.test(q))return null;
 const source='المصدر: كروت ومؤشرات '+page.title+' في لوحة كهرباء '+project+' وفق الفلاتر المطبّقة حاليًا.';
 if(all){
  const cards=page.cards.slice(0,65).map(c=>'• '+c.label+': '+c.value+(c.note?' ('+c.note+')':''));
  const chartTitles=page.charts.slice(0,18).map(c=>c.title);
  return (cards.length?'الكروت الظاهرة في التبويب الحالي:\n'+cards.join('\n'):'لا توجد كروت رقمية في التبويب الحالي.')
   +(chartTitles.length?'\nالشارتات المتاحة: '+chartTitles.join('، ')+'.':'')
   +(page.cards.length>65?'\nيوجد المزيد من الكروت؛ حدد القسم لعرضه.':'')+'\n'+source;
 }
 const stop=new Set(['ما','هي','هو','كم','عدد','في','عن','من','على','الى','الي','الداشبورد','المشروع','مشروع','المشاريع','نسبة','نسبه','اعطني','طلع','المؤشر','الحالي','الحاليه']);
 const tokens=q.split(' ').filter(w=>w.length>2&&!stop.has(w));
 const alternate=t=>t==='انجاز'?['تقدم','اكتمال']:t==='تقدم'?['انجاز']:t==='المنفذ'?['تنفيذ']:t==='متاخر'?['تاخير']:t==='غرامات'?['غرامه']:t==='اجمالي'?['مجموع']:t==='تحصيل'?['سداد']: [];
 const scored=page.cards.map(c=>{
  const label=naifMetricNorm(c.label);
  let score=tokens.reduce((s,t)=>s+(label.includes(t)?4:alternate(t).some(a=>label.includes(a))?2:0),0);
  if(/نسب|انجاز|تقدم/.test(q)&&/نسبه التقدم|نسبه الانجاز|متوسط الانجاز/.test(label))score+=2;
  if(/نسبه التقدم/.test(label)&&/انجاز|تقدم/.test(q))score+=2;
  return {c,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 if(scored.length&&!chartIntent){
  const top=scored.slice(0,Math.min(scored.length,5));
  return top.map(x=>'• '+x.c.label+': '+x.c.value+(x.c.note?' ('+x.c.note+')':'')).join('\n')+'\n'+source;
 }
 if(chartIntent&&page.charts.length){
  const ch=page.charts.map(c=>{
   const name=naifMetricNorm(c.title);
   return {c,score:tokens.reduce((s,t)=>s+(name.includes(t)?3:alternate(t).some(a=>name.includes(a))?1:0),0)};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,2);
  if(ch.length)return ch.map(({c})=>'الشارت: '+c.title+'\n'+c.series.map(set=>set.name+': '+set.values.slice(0,12).map(v=>v.name+' '+v.value).join('، ')).join('\n')).join('\n')+'\n'+source;
 }
 return null;
}

const isNaifStageQuery=q=>{
 const normalized=naifMetricNorm(q);
 return /مرحله التنفيذ|حاله المرحله|مراحل التنفيذ|حالات المراحل|توزيع المراحل|مرحله الانجاز/.test(normalized)
  && !/^(اشرح|كيف تحسب|كيف يتم حساب|تعريف|ما معني|ما المقصود)/.test(normalized);
};
async function replyKnowledge(query){
 // Stage columns are direct data sources, not metadata or generic KPI cards.
 if(!isNaifStageQuery(query)){
  const special=await window.NaifSpecializedIndex?.answer?.(query,project);
  if(special)return special;
  const current=window.NaifExpertUI?.answer?.(query);
  if(current)return current;
 }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),33000);
  try{
   const response=await fetch('/api/rpc',{
    method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({method:'askNaifExpert',args:[query,naifActivePage()]})
   });
   if(response.status===401||response.status===403)
    return 'انتهت جلسة الدخول أو لا تتوفر لك صلاحية استعلام بيانات هذا التبويب.';
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||!payload.ok)
    return 'تعذر الوصول لمحرك معرفة نايف حاليًا ('+String(payload.error||response.status).slice(0,85)+').';
   if(payload.result?.answer)return payload.result.answer;
   return 'لم يرجع محرك المعرفة إجابة مؤكدة لهذا السؤال. اطلب التبويب أو المؤشر المقصود.';
  }catch(e){
   if(e.name==='AbortError')return 'تجاوزت قراءة بعض مصادر البيانات المهلة المحددة. لم أستنتج أي أرقام؛ حاول السؤال عن تبويب محدد أو أعد المحاولة.';
   return 'تعذر استعلام مصادر المشروع الآن: '+String(e.message||e).slice(0,90);
  }finally{clearTimeout(timer)}
}
async function reply(question){const query=question.trim();if(!query)return;bubble(query,true);state('thinking','يبحث عن القسم المناسب');let answer='';
if(isNaifStageQuery(query)){const result=await replyKnowledge(query);bubble(result,false);state('idle','جاهز للمساعدة');say(result);return;}
const visibleExpert=window.NaifExpertUI?.answer?.(query);
if(visibleExpert){bubble(visibleExpert,false);state('idle','جاهز للمساعدة');say(visibleExpert);return;}
if(window.NaifReportArchive?.isArchiveQuestion?.(query)){
 const report=await window.NaifReportArchive.answer(query,project);
 bubble(report||'تعذر قراءة أرشيف التقارير.',false);state('idle','جاهز للمساعدة');say(report||'تعذر قراءة أرشيف التقارير.');return;
}
if(qualityIntent.test(query)){state('thinking','يقرأ نتائج جودة الإفادات');const result=await replyQuality(query);bubble(result,false);state('idle','جاهز للمساعدة');say(result);return;}
// Navigation requests remain clickable; other questions use the authorized live-data knowledge engine.
if(!/^(افتح|انتقل|اذهب|روح|ودني|اعرض التبويب|افتح تبويب)/.test(query)&&!/^(عرف نفسك|من انت|مين انت|اسمك)/.test(query)){
 state('thinking','يبحث في شيتات وتبويبات '+project);
 const result=await replyKnowledge(query);bubble(result,false);state('idle','جاهز للمساعدة');say(result);return;
}
const found=labels.find(([title])=>query.includes(title));if(found){let target=[...document.querySelectorAll('#nav .nav-item[data-page]')].find(el=>el.dataset.page===found[1]);if(!target)target=[...document.querySelectorAll('#nav .nav-item[data-page]')].find(el=>el.textContent.includes(found[0]));if(target&&!target.hidden&&getComputedStyle(target).display!=='none'){target.click();answer='فتحت لك قسم '+found[0]+' في لوحة مشروع '+project+'. يمكنك مراجعة التفاصيل والفلاتر هناك.'}else{answer='قسم '+found[0]+' غير متاح في القائمة الحالية لصلاحيات حسابك؛ لا يمكنني فتح بيانات غير مصرّح بها.'}}
else if(/عرف نفسك|من أنت|مين انت|اسمك/.test(query))answer='أنا المهندس نايف، مساعد معرفة مشروع كهرباء '+project+'. أقرأ الكروت والشارتات الظاهرة والفلاتر الحالية، وأستعلم من الشيتات المصرح بها عن أوامر العمل والتقدم والتأخيرات والمقاولين والمهندسين، مع ذكر مصدر الأرقام وعدم تخمين القيم.';
else if(/كم|عدد|نسبة|حالة|تأخير|ملخص|بيانات|تقرير/.test(query))answer='اسألني عن اسم المؤشر أو أمر العمل وسأرجع إلى المصدر المصرح به. لا أعرض أرقامًا دون دليل.';
else answer='أنا نايف، خبير الداشبورد لمشروع '+project+'. اسألني عن الكروت والشارتات أو أوامر العمل أو قل «ما هي قدراتك؟» لأعرض مصادر المعرفة المتاحة.';
bubble(answer,false);state('idle','جاهز للمساعدة');say(answer)}
function open(){previousFocus=document.activeElement;dialog.hidden=false;launch.classList.add('active');launch.setAttribute('aria-expanded','true');if(!messages.children.length)bubble('مرحبًا، أنا المهندس نايف، مساعد مشروع كهرباء '+project+'. كيف أساعدك اليوم؟',false);input.focus()}
function close(){window.NaifRealtimeVoice?.cancelDictation?.();window.NaifRealtimeVoice?.stop?.('أُغلقت محادثة نايف.');endCall();dialog.hidden=true;launch.classList.remove('active');launch.setAttribute('aria-expanded','false');if(recognition)try{recognition.stop()}catch(e){}window.speechSynthesis?.cancel();state('idle','جاهز للمساعدة');(previousFocus||launch).focus()}

/* Movable Naif companion: pointer-drag on desktop and touch, with persistent position. */
const dock=document.createElement('aside');
dock.className='vd-naif-dock';
dock.setAttribute('aria-label','شخصية نايف القابلة للسحب');
dock.innerHTML='<div class="vd-naif-dock-tools"><button type="button" class="vd-naif-dock-hide" aria-label="إخفاء نايف" title="إخفاء">×</button><button type="button" class="vd-naif-dock-size" aria-label="تغيير حجم نايف" title="تكبير أو تصغير">⤢</button></div><div class="vd-naif-dock-grip" role="button" tabindex="0" aria-label="اسحب نايف إلى أي مكان، أو اضغط لفتح المحادثة" title="اسحب لتحريك نايف، اضغط للمحادثة">'+engineer+'</div><span class="vd-naif-dock-caption">نايف · اسحبني</span>';
document.body.append(dock);
const dockGrip=dock.querySelector('.vd-naif-dock-grip');
const positionKey='vd-naif-dock-v1-'+project;
const visibilityKey='vd-naif-dock-hidden-v1-'+project;
let dockSize=120,activeDrag=null;
function storePosition(){try{localStorage.setItem(positionKey,JSON.stringify({left:dock.offsetLeft,top:dock.offsetTop,size:dockSize}))}catch(e){}}
function constrainDock(x,y){return {left:Math.max(0,Math.min(Math.round(x),Math.max(0,innerWidth-dock.offsetWidth))),top:Math.max(0,Math.min(Math.round(y),Math.max(0,innerHeight-dock.offsetHeight)))}}
function moveDock(x,y){const p=constrainDock(x,y);dock.style.left=p.left+'px';dock.style.top=p.top+'px';dock.style.right='auto';dock.style.bottom='auto'}
try{const saved=JSON.parse(localStorage.getItem(positionKey)||'null');if(saved&&Number.isFinite(saved.size))dockSize=Math.max(80,Math.min(180,saved.size));dock.style.setProperty('--naif-dock-width',dockSize+'px');if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top))moveDock(saved.left,saved.top);else moveDock(Math.max(0,innerWidth-145),Math.max(0,innerHeight-220));if(localStorage.getItem(visibilityKey)==='1')dock.hidden=true}catch(e){moveDock(Math.max(0,innerWidth-145),Math.max(0,innerHeight-220))}
window.addEventListener('resize',()=>{moveDock(dock.offsetLeft,dock.offsetTop)});
dockGrip.addEventListener('pointerdown',e=>{if(e.button!==0)return;activeDrag={id:e.pointerId,x:e.clientX,y:e.clientY,left:dock.offsetLeft,top:dock.offsetTop,moved:false};dockGrip.setPointerCapture(e.pointerId);dock.classList.add('dragging');e.preventDefault()});
dockGrip.addEventListener('pointermove',e=>{if(!activeDrag||activeDrag.id!==e.pointerId)return;const dx=e.clientX-activeDrag.x,dy=e.clientY-activeDrag.y;if(Math.hypot(dx,dy)>5)activeDrag.moved=true;if(activeDrag.moved)moveDock(activeDrag.left+dx,activeDrag.top+dy)});
function endDockDrag(e){if(!activeDrag||activeDrag.id!==e.pointerId)return;const moved=activeDrag.moved;activeDrag=null;dock.classList.remove('dragging');if(moved)storePosition();else open()}
dockGrip.addEventListener('pointerup',endDockDrag);
dockGrip.addEventListener('pointercancel',e=>{if(activeDrag&&activeDrag.id===e.pointerId){activeDrag=null;dock.classList.remove('dragging');storePosition()}});
dockGrip.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}else if(e.key.startsWith('Arrow')){e.preventDefault();const delta= e.shiftKey?30:10;moveDock(dock.offsetLeft+(e.key==='ArrowRight'?delta:e.key==='ArrowLeft'?-delta:0),dock.offsetTop+(e.key==='ArrowDown'?delta:e.key==='ArrowUp'?-delta:0));storePosition()}});
dock.querySelector('.vd-naif-dock-size').addEventListener('click',()=>{dockSize=dockSize>=180?80:dockSize+20;dock.style.setProperty('--naif-dock-width',dockSize+'px');moveDock(dock.offsetLeft,dock.offsetTop);storePosition()});
const restore=document.createElement('button');restore.type='button';restore.className='vd-naif-dock-restore';restore.textContent='إظهار نايف';restore.hidden=true;document.body.append(restore);
function setDockHidden(hidden){dock.hidden=hidden;restore.hidden=!hidden;try{localStorage.setItem(visibilityKey,hidden?'1':'0')}catch(e){}}
dock.querySelector('.vd-naif-dock-hide').addEventListener('click',()=>setDockHidden(true));
restore.addEventListener('click',()=>setDockHidden(false));
setDockHidden(dock.hidden);

launch.onclick=open;nav.addEventListener('click',e=>{if(e.target.closest('.nav-item')&&!e.target.closest('#vdNaifLauncher')&&!dialog.hidden&&!window.NaifRealtimeVoice?.isActive?.()&&!window.NaifRealtimeVoice?.isConnecting?.())close()});dialog.querySelector('.vd-naif-close').onclick=close;dialog.addEventListener('click',e=>{if(e.target===dialog)close()});dialog.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
dialog.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const q=input.value;input.value='';reply(q)});
dialog.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>reply(b.dataset.query));
let realtimePlaybackEnabled=true;
dialog.querySelector('.vd-naif-sound').onclick=e=>{
 const live=window.NaifRealtimeVoice;
 if(live?.isActive?.()||live?.isConnecting?.()){
  realtimePlaybackEnabled=!realtimePlaybackEnabled;live.setPlayback?.(realtimePlaybackEnabled);
  e.currentTarget.textContent=realtimePlaybackEnabled?'🔊':'🔈';
  e.currentTarget.title=realtimePlaybackEnabled?'كتم صوت نايف':'تشغيل صوت نايف';
  return;
 }
 voice=!voice;e.currentTarget.textContent=voice?'🔊':'🔈';
 e.currentTarget.title=voice?'إيقاف قراءة الردود':'تشغيل قراءة الردود';
 if(!voice){stopSpeech();awaitingVoiceAnswer=false;if(callActive)listen()}
};
const naifApi=async(method,args=[])=>{
 const response=await fetch('/api/rpc',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.ok)throw Error(data.error||'تعذر الاتصال بالخادم');
 return data.result;
};

/* In-browser voice call: no phone dialing or outgoing calls, user permission only. */
let callActive=false,micMuted=false,awaitingVoiceAnswer=false,speechInProgress=false,callEpoch=0,listenRetry=null;
const callButton=dialog.querySelector('.vd-naif-call'),conversationButton=dialog.querySelector('.vd-naif-conversation'),micButton=dialog.querySelector('.vd-naif-mic');
function renderCall(){
 callButton.textContent=callActive?'📵 إنهاء المكالمة':'📞 مكالمة نايف';
 callButton.setAttribute('aria-pressed',String(callActive));
 callButton.classList.toggle('is-active',callActive);
 conversationButton.hidden=true;
 
 micButton.textContent=callActive?(micMuted?'🔇':'🎙️'):'🎤';
 micButton.title=callActive?(micMuted?'تشغيل الميكروفون':'كتم الميكروفون'):'إملاء صوتي';
 dialog.classList.toggle('vd-naif-in-call',callActive);
}
function stopRecognition(){
 if(listenRetry!==null){clearTimeout(listenRetry);listenRetry=null}
 if(recognition){const old=recognition;recognition=null;old.onend=null;old.onresult=null;old.onerror=null;try{old.abort()}catch(e){}}
}
function endCall(){
 callActive=false;conversationMode=false;micMuted=false;awaitingVoiceAnswer=false;callEpoch++;
 stopRecognition();window.speechSynthesis?.cancel();speechInProgress=false;renderCall();
 if(!dialog.hidden)state('idle','جاهز للمساعدة');
}
function listen(){
 if(!callActive||micMuted||awaitingVoiceAnswer||speechInProgress||dialog.hidden||recognition)return;
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){endCall();bubble('المكالمة الصوتية غير مدعومة في هذا المتصفح. استخدم Chrome أو Edge مع السماح بالميكروفون.',false);return}
 const epoch=callEpoch;
 let heard=false;const rec=new SR();recognition=rec;rec.lang='ar-SA';rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=1;
 rec.onresult=e=>{
   if(epoch!==callEpoch||!callActive)return;
   const question=String(e.results?.[0]?.[0]?.transcript||'').trim();
   if(!question)return;heard=true;awaitingVoiceAnswer=true;stopRecognition();
   state('thinking','سمعت سؤالك؛ أبحث عن الإجابة');
   reply(question).catch(err=>{awaitingVoiceAnswer=false;bubble('تعذر الرد الصوتي: '+String(err.message||err),false);listen()});
 };
 rec.onerror=e=>{
   if(epoch!==callEpoch)return;
   const fatal=['not-allowed','service-not-allowed','audio-capture'].includes(e.error);
   if(fatal){endCall();bubble('تعذر تشغيل الميكروفون ('+e.error+'). تحقق من أذونات المتصفح.',false)}
 };
 rec.onend=()=>{
   if(recognition===rec)recognition=null;
   if(epoch===callEpoch&&callActive&&!heard&&!awaitingVoiceAnswer&&!micMuted&&!speechInProgress)listenRetry=setTimeout(()=>{listenRetry=null;listen()},500);
 };
 try{rec.start();state('listening','مكالمة نايف — يستمع إليك')}catch(e){recognition=null;endCall();bubble('تعذر بدء المكالمة الصوتية: '+String(e.message||e),false)}
}
function beginCall(){
 if(callActive){endCall();return}
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){bubble('المكالمة المباشرة تتطلب متصفحًا يدعم التعرف الصوتي مثل Chrome أو Edge.',false);return}
 if(!window.isSecureContext){bubble('يلزم فتح لوحة المشروع عبر HTTPS لتفعيل الميكروفون.',false);return}
 callActive=true;conversationMode=true;micMuted=false;voice=true;callEpoch++;awaitingVoiceAnswer=false;
 renderCall();state('idle','جارٍ بدء مكالمة نايف');
 listen();
}
// Shared answer path for typed messages and live Arabic calls. It never
// modifies source data and never bypasses the currently authorized dashboard.
window.NaifVoiceBridge={
 project,state,bubble,
 stopClassic:()=>{endCall();stopSpeech()},
 answer:async question=>{
  const q=String(question||'').trim().slice(0,1200);
  if(!q)return 'لم يصل سؤال واضح؛ كرره من فضلك.';
  if(isNaifStageQuery(q))return replyKnowledge(q);
  if(window.NaifReportArchive?.isArchiveQuestion?.(q))return window.NaifReportArchive.answer(q,project);
  const visibleExpert=window.NaifExpertUI?.answer?.(q);
  if(visibleExpert)return visibleExpert;
  if(/^(افتح|انتقل|اذهب|روح|ودني|اعرض التبويب|افتح تبويب)/.test(q)){
   const found=labels.find(([title])=>q.includes(title));
   if(!found)return 'حدد القسم المطلوب من القائمة المصرح بها.';
   let target=[...document.querySelectorAll('#nav .nav-item[data-page]')].find(el=>el.dataset.page===found[1]);
   if(!target)target=[...document.querySelectorAll('#nav .nav-item[data-page]')].find(el=>el.textContent.includes(found[0]));
   if(!target||target.hidden||getComputedStyle(target).display==='none')return 'هذا التبويب غير متاح في صلاحيات حسابك.';
   target.click();
   return 'تم فتح تبويب '+found[0]+' في لوحة مشروع كهرباء '+project+'.';
  }
  if(/^(عرف نفسك|من انت|مين انت|اسمك)/.test(q))return 'أنا المهندس نايف، خبير معلومات داشبورد كهرباء '+project+'. أفهم الأسئلة بالعربية وأجيب من الكروت والشارتات والشيتات المصرح بها، مع توضيح المصدر ومراعاة الفلاتر. لا أختلق أرقامًا ولا أعدل البيانات.';
  if(qualityIntent.test(q))return replyQuality(q);
  return replyKnowledge(q);
 },
 transcript:t=>{state('thinking','فهم نايف سؤالك بالعربية.')},
 setDictation:t=>{input.value=String(t||'').slice(0,3000);input.focus();}
};
conversationButton.hidden=true;conversationButton.setAttribute('aria-hidden','true');
callButton.addEventListener('click',async()=>{
 const live=window.NaifRealtimeVoice;
 if(live?.isActive?.()||live?.isConnecting?.()){live.stop('تم إنهاء مكالمة نايف.');return}
 if(callActive){endCall();return}
 if(live?.start){
  const handled=await live.start();
  if(handled)return;
  bubble('المكالمة المباشرة غير مهيأة أو غير مدعومة حاليًا؛ سأستخدم المحادثة العربية المتوافقة مع المتصفح.',false);
 }
 beginCall();
});

dialog.querySelector('.vd-naif-teach').onclick=async()=>{
 const question=window.prompt('ما السؤال أو المعلومة التي تريد تعليمها لنايف؟');
 if(!question)return;
 const answer=window.prompt('ما الإجابة أو التصحيح الصحيح؟ (سيُراجع قبل اعتماده)');
 if(!answer)return;
 const page=([...document.querySelectorAll('#nav .nav-item[data-page]')].find(el=>el.classList.contains('active'))?.dataset.page)||'';
 try{
 const result=await naifApi('submitNaifLesson',[page,question,answer]);
 bubble('تم تسجيل الدرس للمراجعة. لن يستخدمه نايف في إجابات المشروع قبل الاعتماد. ('+result.status+')',false);
 }catch(e){bubble('تعذر تسجيل الدرس: '+e.message,false)}
};
dialog.querySelector('.vd-naif-review').onclick=async()=>{
 try{
 const lessons=await naifApi('getNaifPendingLessons');
 if(!lessons.length){bubble('لا توجد دروس بانتظار الاعتماد.',false);return}
 const panel=document.createElement('div');panel.className='vd-naif-bubble';
 const heading=document.createElement('strong');heading.textContent='الدروس بانتظار المراجعة ('+lessons.length+')';panel.append(heading);
 for(const lesson of lessons){
 const line=document.createElement('div');line.style.cssText='padding:8px 0;border-top:1px solid #ddd';
 const detail=document.createElement('p');detail.textContent='سؤال: '+lesson.question+' | تصحيح: '+lesson.answer+' | مقدم: '+lesson.submittedBy;
 const accept=document.createElement('button'),reject=document.createElement('button');
 accept.type=reject.type='button';accept.textContent='اعتماد';reject.textContent='رفض';
 accept.onclick=async()=>{try{await naifApi('reviewNaifLesson',[lesson.id,true]);line.remove();bubble('تم اعتماد الدرس.',false)}catch(e){bubble('تعذر الاعتماد: '+e.message,false)}};
 reject.onclick=async()=>{try{await naifApi('reviewNaifLesson',[lesson.id,false]);line.remove();bubble('تم رفض الدرس.',false)}catch(e){bubble('تعذر الرفض: '+e.message,false)}};
 line.append(detail,accept,reject);panel.append(line);
 }
 messages.append(panel);messages.scrollTop=messages.scrollHeight;
 }catch(e){bubble('مراجعة الدروس متاحة لمدير النظام فقط. '+e.message,false)}
};
micButton.onclick=async()=>{
 if(window.NaifRealtimeVoice?.isActive?.()){window.NaifRealtimeVoice.toggleMute();return}
 if(window.NaifRealtimeVoice?.isConnecting?.())return;
 if(callActive){micMuted=!micMuted;if(micMuted){stopRecognition();state('idle','الميكروفون مكتوم')}else listen();renderCall();return}
 if(window.NaifRealtimeVoice?.dictate){const handled=await window.NaifRealtimeVoice.dictate();if(handled)return;}
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){bubble('التعرف على الصوت غير متاح في هذا المتصفح. يمكنك الكتابة.',false);return}
 stopRecognition();const rec=new SR();recognition=rec;rec.lang='ar-SA';rec.interimResults=false;
 rec.onresult=e=>{input.value=e.results[0][0].transcript;state('idle','تم التقاط السؤال');input.focus()};
 rec.onerror=()=>state('idle','تعذر التقاط الصوت');
 rec.onend=()=>{if(recognition===rec)recognition=null;if(dialog.dataset.state==='listening')state('idle','جاهز للمساعدة')};
 try{rec.start();state('listening','يستمع الآن')}catch(e){recognition=null;state('idle','تعذر تشغيل الميكروفون')}
};

 // Embed the same Naif persona within both quality-related tabs, without replacing quality tools.
 function installQualityPersona(){
   ['qualityCorrectivePage','engineeringInspectionPage'].forEach(pageId=>{
     const page=document.getElementById(pageId);
     if(!page||page.querySelector('[data-naif-quality-card]'))return;
     const card=document.createElement('section');
     card.className='vd-naif-quality-card';
     card.dataset.naifQualityCard='true';
     card.setAttribute('aria-label','المهندس نايف — مساعد الجودة');
     const pic=document.createElement('div');pic.className='vd-naif-quality-avatar';pic.innerHTML=engineer;
     const info=document.createElement('div');info.className='vd-naif-quality-info';
     const heading=document.createElement('h3');heading.textContent='المهندس نايف — مساعد الجودة';
     const description=document.createElement('p');description.textContent='شخصية نايف التفاعلية متاحة هنا للمحادثة الصوتية والنصية والتنقل بين أقسام المشروع. لا تُغيّر نتائج الفحص أو تقارير الجودة.';
     const button=document.createElement('button');button.type='button';button.className='vd-naif-quality-open';button.textContent='تحدث مع نايف';button.addEventListener('click',open);
     info.append(heading,description,button);card.append(pic,info);
     page.prepend(card);
   });
 }
 installQualityPersona();
 const qualityMain=document.querySelector('main');
 if(qualityMain){
   const observer=new MutationObserver(()=>installQualityPersona());
   observer.observe(qualityMain,{childList:true});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
