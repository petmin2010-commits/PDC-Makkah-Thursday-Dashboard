(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let paused=false,lastRows=[],timer=null,offset=0,lastFeedSig='';
function tone(v){const s=String(v||'').trim();if(/عاجل|urgent/i.test(s))return 'urgent';if(/مهم|important|تنبيه/i.test(s))return 'important';if(/إنجاز|انجاز|تحسن|نجاح|achievement|improvement/i.test(s))return 'positive';return 'update'}
function cleanDate(v){const s=String(v||'').trim();if(!s)return '';const d=new Date(s);if(isNaN(d))return s;try{return new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d)}catch{return s}}
function item(r){const tip=r.summary?' title="'+esc(r.summary)+'"':'';return '<span class="news-item"'+tip+'><span class="news-source sheet">Smart News ⚡</span><span class="news-priority '+tone(r.priority)+'">'+esc(r.priority||'تحديث')+'</span><span class="news-category">'+esc(r.category||'عام')+'</span><span class="news-title">'+esc(r.title||'')+'</span>'+(r.date?'<span class="news-date">'+esc(cleanDate(r.date))+'</span>':'')+'</span><span class="news-sep">◆</span>'}
function stopMotion(){if(timer){clearInterval(timer);timer=null}}
function startMotion(){
 stopMotion();const track=document.getElementById('projectNewsTrack'),group=track?.querySelector('.news-group');
 if(!track||!group||lastRows.length<2)return;
 const cycle=Math.max(0,group.offsetWidth);
 if(cycle<=0){offset=0;track.style.transform='translateX(0px)';return}
 offset=-cycle;track.style.transform='translateX('+offset+'px)';
 timer=setInterval(()=>{
  if(paused)return;
  offset+=1;
  if(offset>=0)offset=-cycle;
  track.style.transform='translateX('+offset+'px)';
 },45);
}
function render(rows){
 lastRows=Array.isArray(rows)?rows.filter(Boolean):[];
 const host=document.getElementById('projectNewsTicker'),track=document.getElementById('projectNewsTrack'),btn=document.getElementById('projectNewsPause');
 if(!host||!track)return;
 stopMotion();track.style.transform='translateX(0px)';
 if(!lastRows.length){
  host.classList.add('is-empty');track.innerHTML='<span class="news-empty-message">لا توجد أخبار جديدة أو فجوات نشطة حاليًا.</span>';
  if(btn)btn.style.display='none';return;
 }
 host.classList.remove('is-empty');if(btn)btn.style.display='';
 const body=lastRows.slice(0,140).map(item).join('');
 track.innerHTML='<span class="news-group">'+body+'</span><span class="news-group" aria-hidden="true">'+body+'</span>';
 requestAnimationFrame(()=>requestAnimationFrame(startMotion));
}
async function load(){
 const track=document.getElementById('projectNewsTrack');
 try{
  const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},cache:'no-store',body:JSON.stringify({method:'getProjectNews',args:[]})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.ok===false)throw new Error(data.error||('HTTP '+r.status));
  const rows=data.result?.rows||[];
  const sig=rows.map(x=>[x.eventKey||'',x.date||'',x.title||''].join('|')).join('¦');
  if(sig!==lastFeedSig){lastFeedSig=sig;render(rows);}
 }catch(e){
  console.error('Smart News load failed:',e);
  if(track)track.innerHTML='<span class="news-empty-message">تعذر تحميل الأخبار الذكية — اضغط تحديث الصفحة.</span>';
 }
}
function boot(){
 const btn=document.getElementById('projectNewsPause');
 if(btn)btn.addEventListener('click',()=>{
  paused=!paused;
  document.getElementById('projectNewsTicker')?.classList.toggle('is-paused',paused);
  btn.textContent=paused?'▶':'❚❚';btn.setAttribute('aria-label',paused?'تشغيل شريط الأخبار':'إيقاف شريط الأخبار');
 });
 load();setInterval(load,60*1000);
 window.addEventListener('focus',load);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
 window.addEventListener('resize',()=>{if(lastRows.length)startMotion()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.refreshProjectNews=load;
})();