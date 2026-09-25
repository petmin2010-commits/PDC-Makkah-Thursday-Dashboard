(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let paused=false,lastRows=[];
function tone(v){
  const s=String(v||'').trim();
  if(/عاجل|urgent/i.test(s))return 'urgent';
  if(/مهم|important/i.test(s))return 'important';
  return 'update';
}
function cleanDate(v){
  const s=String(v||'').trim();if(!s)return '';
  const d=new Date(s);if(isNaN(d))return s;
  try{return new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{day:'2-digit',month:'short'}).format(d)}catch{return s}
}
function sourceBadge(v){
  const s=String(v||'').trim();
  if(/شيت|sheet/i.test(s))return {cls:'sheet',label:'📊 الشيتات'};
  return {cls:'email',label:'📧 البريد'};
}
function item(r){
  const href=r.emailUrl?esc(r.emailUrl):'#';
  const attrs=r.emailUrl?' target="_blank" rel="noopener noreferrer"':'';
  const src=sourceBadge(r.source);
  return '<a class="news-item" href="'+href+'"'+attrs+'>'+
    '<span class="news-source '+src.cls+'">'+src.label+'</span>'+
    '<span class="news-priority '+tone(r.priority)+'">'+esc(r.priority||'تحديث')+'</span>'+
    '<span class="news-category">'+esc(r.category||'عام')+'</span>'+
    '<span class="news-title">'+esc(r.title||'')+'</span>'+
    (r.date?'<span class="news-date">'+esc(cleanDate(r.date))+'</span>':'')+
    '</a><span class="news-sep">◆</span>';
}
function render(rows){
  lastRows=Array.isArray(rows)?rows:[];
  const host=document.getElementById('projectNewsTicker'),track=document.getElementById('projectNewsTrack'),btn=document.getElementById('projectNewsPause');
  if(!host||!track)return;
  if(!lastRows.length){
    host.classList.add('is-empty');
    track.innerHTML='<span>لا توجد أخبار مهمة حاليًا — الأخبار ستأتي من البريد المختار ومن التغييرات الجوهرية في شيتات المشروع.</span>';
    if(btn)btn.style.display='none';
    return;
  }
  host.classList.remove('is-empty');
  if(btn)btn.style.display='';
  const body=lastRows.map(item).join('');
  track.innerHTML=body+body;
  const dur=Math.max(30,Math.min(110,lastRows.length*8));
  track.style.setProperty('--news-duration',dur+'s');
}
function load(){
  if(!window.google?.script?.run)return;
  google.script.run.withSuccessHandler(p=>render(p?.rows||[])).withFailureHandler(()=>render([])).getProjectNews();
}
document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.getElementById('projectNewsPause');
  if(btn)btn.addEventListener('click',()=>{
    paused=!paused;
    const host=document.getElementById('projectNewsTicker');
    host?.classList.toggle('is-paused',paused);
    btn.textContent=paused?'▶':'❚❚';
    btn.setAttribute('aria-label',paused?'تشغيل شريط الأخبار':'إيقاف شريط الأخبار');
  });
  load();
  setInterval(load,5*60*1000);
});
window.refreshProjectNews=load;
})();