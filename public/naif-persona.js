(()=>{'use strict';
/* Project-scoped Naif persona: conversational presentation with grounded navigation.
 * No simulated AI answer, no microphone access until user click, no outbound data.
 */
const project=(document.title.includes('مكة')?'مكة':'جدة'),labels=[['أوامر العمل','workorders'],['الطلبات','workorders'],['الرئيسية','master'],['المشاريع','projects'],['التوصيلات','connections'],['التصاريح','permits'],['الجودة','qualityCorrective'],['السلامة','safety'],['المقاولين','contractorSafety'],['التقارير','reportsCenter'],['المرفقات','siteFollowup'],['الاجتماعات','wednesdayMeeting']];
const engineer='<img src="/naif-realistic.svg?v=20261110-1" alt="المهندس نايف بصورة واقعية" draggable="false" loading="eager">';
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
dialog.innerHTML=`<div class="vd-naif-window"><div class="vd-naif-portrait">${engineer}<div><h2>المهندس نايف</h2><p>مساعد العمليات الذكي — مشروع ${project}</p><div class="vd-naif-status" role="status">جاهز للمساعدة</div></div></div><div class="vd-naif-content"><div class="vd-naif-header"><b>محادثة نايف</b><button type="button" class="vd-naif-close" aria-label="إغلاق">×</button></div><div class="vd-naif-messages" aria-live="polite"></div><div class="vd-naif-quick"><button data-query="أوامر العمل">أوامر العمل</button><button data-query="المشاريع">المشاريع</button><button data-query="التقارير">التقارير</button><button data-query="السلامة">السلامة</button><button data-query="كم الإفادات الضعيفة والشكلية؟">جودة الإفادات</button></div><form class="vd-naif-form"><input aria-label="سؤالك لنايف" placeholder="اسأل نايف عن المشروع أو افتح قسمًا..." required><button type="button" class="vd-naif-mic" aria-label="التحدث بالصوت" title="إملاء صوتي">🎤</button><button type="submit">إرسال</button><button type="button" class="vd-naif-sound" title="تفعيل أو إيقاف الصوت" aria-label="الصوت">🔊</button></form><p class="vd-naif-note">نايف مرتبط بنتائج جودة الإفادات المتاحة لحسابك، ويقرأها عند السؤال. لا يُعدّل التصنيفات أو السجل التاريخي، ولا يجري مكالمات هاتفية.</p></div></div>`;
document.body.append(dialog);const input=dialog.querySelector('input'),messages=dialog.querySelector('.vd-naif-messages'),status=dialog.querySelector('.vd-naif-status');let voice=false,recognition=null,previousFocus=null;
const state=(s,label)=>{dialog.dataset.state=s;status.textContent=label};
const say=text=>{if(!voice||!window.speechSynthesis)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ar-SA';u.rate=.92;u.onstart=()=>state('speaking','يتحدث');u.onend=()=>state('idle','جاهز للمساعدة');u.onerror=()=>state('idle','جاهز للمساعدة');window.speechSynthesis.speak(u)};
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

async function reply(question){const query=question.trim();if(!query)return;bubble(query,true);state('thinking','يبحث عن القسم المناسب');let answer='';
if(qualityIntent.test(query)){state('thinking','يقرأ نتائج جودة الإفادات');const result=await replyQuality(query);bubble(result,false);state('idle','جاهز للمساعدة');say(result);return;}
const found=labels.find(([title])=>query.includes(title));if(found){let target=[...document.querySelectorAll('#nav .nav-item[data-page]')].find(el=>el.dataset.page===found[1]);if(!target)target=[...document.querySelectorAll('#nav .nav-item[data-page]')].find(el=>el.textContent.includes(found[0]));if(target&&!target.hidden&&getComputedStyle(target).display!=='none'){target.click();answer='فتحت لك قسم '+found[0]+' في لوحة مشروع '+project+'. يمكنك مراجعة التفاصيل والفلاتر هناك.'}else{answer='قسم '+found[0]+' غير متاح في القائمة الحالية لصلاحيات حسابك؛ لا يمكنني فتح بيانات غير مصرّح بها.'}}
else if(/عرف نفسك|من أنت|مين انت|اسمك/.test(query))answer='أنا المهندس نايف، الشخصية الافتراضية لمتابعة عمليات مشروع كهرباء '+project+'. أساعدك في الوصول إلى أقسام الداشبورد، ويمكنك استخدام الكتابة أو الإملاء الصوتي.';
else if(/كم|عدد|نسبة|حالة|تأخير|ملخص|بيانات|تقرير/.test(query))answer='لإجابة دقيقة عن الأرقام أحتاج ربط محرك المحادثة بمصادر بيانات المشروع. حاليًا يمكنني فتح التبويب المطلوب، لكن لن أخمن أرقامًا أو نتائج.';
else answer='أنا نايف، مساعدك في مشروع '+project+'. اطلب مني فتح أوامر العمل، المشاريع، التوصيلات، التصاريح، السلامة أو التقارير. لم يتم بعد ربط محرك الإجابة الذكي أو المكالمات بهذه الواجهة.';
bubble(answer,false);state('idle','جاهز للمساعدة');say(answer)}
function open(){previousFocus=document.activeElement;dialog.hidden=false;launch.classList.add('active');launch.setAttribute('aria-expanded','true');if(!messages.children.length)bubble('مرحبًا، أنا المهندس نايف، مساعد مشروع كهرباء '+project+'. كيف أساعدك اليوم؟',false);input.focus()}
function close(){dialog.hidden=true;launch.classList.remove('active');launch.setAttribute('aria-expanded','false');if(recognition)try{recognition.stop()}catch(e){}window.speechSynthesis?.cancel();state('idle','جاهز للمساعدة');(previousFocus||launch).focus()}

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

launch.onclick=open;nav.addEventListener('click',e=>{if(e.target.closest('.nav-item')&& !e.target.closest('#vdNaifLauncher')&&!dialog.hidden)close()});dialog.querySelector('.vd-naif-close').onclick=close;dialog.addEventListener('click',e=>{if(e.target===dialog)close()});dialog.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
dialog.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const q=input.value;input.value='';reply(q)});
dialog.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>reply(b.dataset.query));
dialog.querySelector('.vd-naif-sound').onclick=e=>{voice=!voice;e.currentTarget.textContent=voice?'🔈':'🔊';e.currentTarget.title=voice?'إيقاف الصوت':'تفعيل الصوت';if(!voice)window.speechSynthesis?.cancel()};
dialog.querySelector('.vd-naif-mic').onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){bubble('التعرف على الصوت غير متاح في هذا المتصفح. يمكنك الكتابة.',false);return}if(recognition)try{recognition.abort()}catch(e){}recognition=new SR();recognition.lang='ar-SA';recognition.interimResults=false;recognition.onresult=e=>{input.value=e.results[0][0].transcript;state('idle','تم التقاط السؤال');input.focus()};recognition.onerror=()=>state('idle','تعذر التقاط الصوت');recognition.onend=()=>{if(dialog.dataset.state==='listening')state('idle','جاهز للمساعدة')};try{recognition.start();state('listening','يستمع الآن')}catch(e){state('idle','تعذر تشغيل الميكروفون')}};

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
