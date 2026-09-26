(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let paused=false,lastRows=[];
function tone(v){const s=String(v||'').trim();if(/عاجل|urgent/i.test(s))return 'urgent';if(/مهم|important/i.test(s))return 'important';return 'update';}
function cleanDate(v){const s=String(v||'').trim();if(!s)return '';const d=new Date(s);if(isNaN(d))return s;try{return new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d)}catch{return s}}
function item(r){const tip=r.summary?' title="'+esc(r.summary)+'"':'';return '<span class="news-item"'+tip+'><span class="news-source sheet">🧠 تدقيق تحليلي</span><span class="news-priority '+tone(r.priority)+'">'+esc(r.priority||'تحديث')+'</span><span class="news-category">'+esc(r.category||'عام')+'</span><span class="news-title">'+esc(r.title||'')+'</span>'+(r.date?'<span class="news-date">'+esc(cleanDate(r.date))+'</span>':'')+'</span><span class="news-sep">◆</span>';}
function render(rows){lastRows=Array.isArray(rows)?rows:[];const host=document.getElementById('projectNewsTicker'),track=document.getElementById('projectNewsTrack'),btn=document.getElementById('projectNewsPause');if(!host||!track)return;
if(!lastRows.length){host.classList.add('is-empty');track.innerHTML='<span>لا توجد فجوات نشطة أو تحديثات جديدة — التدقيق يعتمد على الشيتات والداشبورد فقط.</span>';if(btn)btn.style.display='none';return;}
host.classList.remove('is-empty');if(btn)btn.style.display='';const body=lastRows.map(item).join('');track.innerHTML=body+body;const dur=Math.max(30,Math.min(360,lastRows.length*9));track.style.setProperty('--news-duration',dur+'s');}
function load(){if(!window.google?.script?.run)return;google.script.run.withSuccessHandler(p=>render(p?.rows||[])).withFailureHandler(()=>render([])).getProjectNews();}
document.addEventListener('DOMContentLoaded',()=>{const btn=document.getElementById('projectNewsPause');if(btn)btn.addEventListener('click',()=>{paused=!paused;const host=document.getElementById('projectNewsTicker');host?.classList.toggle('is-paused',paused);btn.textContent=paused?'▶':'❚❚';btn.setAttribute('aria-label',paused?'تشغيل شريط الأخبار':'إيقاف شريط الأخبار');});load();setInterval(load,5*60*1000);});
window.refreshProjectNews=load;
})();