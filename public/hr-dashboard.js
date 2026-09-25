(()=>{
'use strict';
const CFG={defaultCity:(document.querySelector('.brand-copy strong')?.textContent||'').includes('مكة')?'مكة':'جدة'};
const root=()=>document.getElementById('hrStaffRoot');
let state={rows:[],city:CFG.defaultCity,search:'',loaded:false};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clsCard=s=>s==='سارية'?'ok':s.includes('أوشكت')?'warn':s==='انتهت'||s==='لا يوجد'?'bad':'';
function filtered(){
  const q=state.search.trim().toLowerCase();
  return state.rows.filter(r=>(!state.city||state.city==='الكل'||r.city===state.city)&&(!q||[r.name,r.nameEn,r.code,r.role,r.project,r.cardStatus,r.qualification,r.email].join(' ').toLowerCase().includes(q)));
}
function kpis(rows){
  const total=rows.length, saudis=rows.filter(r=>r.nationality==='سعودي').length;
  const expired=rows.filter(r=>r.cardStatus==='انتهت').length;
  const noCard=rows.filter(r=>r.cardStatus==='لا يوجد').length;
  const soon=rows.filter(r=>String(r.cardStatus).includes('أوشكت')).length;
  const ready=rows.filter(r=>r.trainingPct===100).length;
  return [
    ['إجمالي الكادر',total,'primary'],['السعوديون',saudis,'primary'],
    ['بطاقات منتهية',expired,'bad'],['بدون بطاقة',noCard,'bad'],
    ['بطاقات قاربت الانتهاء',soon,'warn'],['اكتمال الدورات',total?Math.round(ready/total*100)+'%':'0%','ok']
  ];
}
function render(){
  const host=root(); if(!host)return;
  const rows=filtered(), cards=kpis(rows);
  host.innerHTML=
  '<div class="hr-wrap">'+
    '<section class="hr-hero"><div><span>HUMAN RESOURCES</span><h2>الموارد البشرية للكادر</h2><p>متابعة موحدة لكادر مشروعي مكة وجدة من نفس المصدر.</p></div><div class="hr-badge">المصدر الموحد</div></section>'+
    '<div class="hr-tools">'+
      '<label><span>المدينة</span><select id="hrCity"><option value="الكل">الكل</option><option value="مكة">مكة</option><option value="جدة">جدة</option></select></label>'+
      '<label class="hr-search"><span>بحث</span><input id="hrSearch" placeholder="اسم، كود، وظيفة، حالة بطاقة..."></label>'+
      '<button id="hrRefresh" class="primary-btn">↻ تحديث</button>'+
    '</div>'+
    '<div class="hr-kpis">'+cards.map(c=>'<article class="hr-kpi '+c[2]+'"><span>'+esc(c[0])+'</span><strong>'+esc(c[1])+'</strong></article>').join('')+'</div>'+
    '<article class="panel"><div class="panel-head"><div class="panel-title"><span>STAFF LIST</span><h3>بيانات الكادر</h3></div><b>'+rows.length+'</b></div>'+
      '<div class="table-wrap large"><table class="hr-table"><thead><tr><th>الكود</th><th>الاسم</th><th>المدينة</th><th>المشروع</th><th>الوظيفة</th><th>الكفالة</th><th>السعودة</th><th>المؤهل</th><th>البطاقة</th><th>الانتهاء</th><th>الأيام</th><th>السيارة</th><th>اكتمال الدورات</th><th>الدورات الناقصة</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+esc(r.code)+'</td><td><b>'+esc(r.name)+'</b><small>'+esc(r.nameEn)+'</small></td><td>'+esc(r.city)+'</td><td>'+esc(r.project)+'</td><td>'+esc(r.role)+'</td><td>'+esc(r.sponsorship)+'</td><td>'+esc(r.nationality)+'</td><td>'+esc(r.qualification)+'</td><td><span class="hr-status '+clsCard(r.cardStatus)+'">'+esc(r.cardStatus)+'</span></td><td>'+esc(r.cardExpiry)+'</td><td>'+esc(r.cardDays)+'</td><td>'+esc(r.vehicle)+'</td><td><b>'+esc(r.trainingPct)+'%</b><small>'+esc(r.trainingCompleted)+' / '+esc(r.trainingRequired)+'</small></td><td>'+esc((r.missingCourses||[]).slice(0,3).join('، '))+(r.missingCourses?.length>3?'…':'')+'</td></tr>').join('')+
      '</tbody></table></div></article></div>';
  const city=document.getElementById('hrCity'); if(city){city.value=state.city;city.onchange=()=>{state.city=city.value;render()}}
  const search=document.getElementById('hrSearch'); if(search){search.value=state.search;search.oninput=()=>{state.search=search.value;render();const n=document.getElementById('hrSearch');n?.focus()}}
  document.getElementById('hrRefresh')?.addEventListener('click',()=>load(true));
}
async function load(force=false){
  const host=root(); if(host&&!state.loaded)host.innerHTML='<div class="hr-loading">جاري تحميل بيانات الكادر...</div>';
  try{
    const r=await fetch('/api/hr/staff'+(force?'?t='+Date.now():''));
    const j=await r.json(); if(!r.ok||!j.ok)throw new Error(j.error||'تعذر تحميل البيانات');
    state.rows=j.rows||[];state.loaded=true;render();
  }catch(e){if(host)host.innerHTML='<div class="hr-error">'+esc(e.message||e)+'</div>'}
}
function activate(){
  if(typeof S!=='undefined')S.current='hrStaff';
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page==='hrStaff'));
  ['masterPage','meetingPage','dataPage','importantLinksPage'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
  document.getElementById('hrStaffPage')?.classList.add('active');
  const fb=document.getElementById('filterBar');if(fb)fb.style.display='none';
  const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='none';
  const title=document.getElementById('pageTitle');if(title)title.textContent='الموارد البشرية للكادر';
  load(false);
}
if(typeof openPage==='function'){
  const previous=openPage;
  openPage=function(key){
    if(key==='hrStaff'){activate();return}
    document.getElementById('hrStaffPage')?.classList.remove('active');
    const fb=document.getElementById('filterBar');if(fb)fb.style.display='';
    const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='';
    return previous(key);
  };
}
})();