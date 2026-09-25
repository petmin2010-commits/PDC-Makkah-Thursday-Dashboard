(()=>{
'use strict';
const CFG={
  "city": "مكة",
  "contract": "4400023406",
  "groups": [
    {
      "title": "الروابط الأساسية",
      "sub": "PROJECT LINKS",
      "icon": "🔗",
      "links": [
        {
          "title": "دليل الإشراف",
          "href": "https://u.pcloud.link/publink/show?code=XZFpTU5ZRP6zfa55xhjrnCAbstX40ydpP2MV",
          "desc": "دليل الإشراف لكل فريق المشروع"
        },
        {
          "title": "بوت نظام الإشراف",
          "href": "https://t.me/MacaelcBot",
          "desc": "بوت نظام الإشراف لفريق المشروع"
        },
        {
          "title": "نظام شيت المشروع",
          "href": "https://docs.google.com/spreadsheets/d/1K_V0cvjBdD_5YLPygWjVgvPMzS1O88PCCOYUuoIH9uY/edit?gid=1068069007#gid=1068069007",
          "desc": "نظام شيت المشروع لفريق العمل بالكهرباء"
        },
        {
          "title": "دليل البوت",
          "href": "https://u.pcloud.link/publink/show?code=XZosKU5ZiVtnMpYUbQ0oJoGTAQuEl8q3s4AV",
          "desc": "دليل استخدام البوت لكل فريق المشروع"
        }
      ]
    },
    {
      "title": "السلامة والأرشفة",
      "sub": "SAFETY & ARCHIVE",
      "icon": "📎",
      "links": [
        {
          "title": "رابط فورم السلامة",
          "href": "https://q.me-qr.com/QDJLYhfU",
          "desc": "فورم السلامة لمهندسي الموقع"
        },
        {
          "title": "رابط نظام السلامة",
          "href": "https://docs.google.com/spreadsheets/d/1bu5hfCL9kLtVpYdV50tlZCHyhWnSyeHvIEqU0ItM8u0/edit?gid=1679664111#gid=1679664111",
          "desc": "نظام السلامة لمهندسي السلامة"
        },
        {
          "title": "رابط الأرشفة للمشروع",
          "href": "https://u.pcloud.link/publink/show?code=kZEhzO5ZlLp6CDhas28W5xwOs8AYUBHAqI5y",
          "desc": "أرشفة المشروع لفريق العمل بالكهرباء"
        },
        {
          "title": "PDC دليل الإشراف",
          "href": "https://u.pcloud.link/publink/show?code=XZFpTU5ZRP6zfa55xhjrnCAbstX40ydpP2MV",
          "desc": "دليل الإشراف PDC لكل فريق المشروع"
        }
      ]
    }
  ]
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=x=>x.href;
const root=()=>document.getElementById('importantLinksRoot');

function buildGroups(q=''){
  const needle=String(q||'').trim().toLowerCase();
  if(!needle)return CFG.groups;
  return CFG.groups.map(g=>{
    const own=[g.title,g.sub].join(' ').toLowerCase().includes(needle);
    const links=g.links.filter(x=>own||[x.title,x.desc].join(' ').toLowerCase().includes(needle));
    return links.length?{...g,links}:null;
  }).filter(Boolean);
}

function render(q=''){
  const host=root();if(!host)return;
  const groups=buildGroups(q);
  const total=groups.reduce((s,g)=>s+g.links.length,0);
  host.innerHTML=
    '<div class="il-root" style="display:block">'+
      '<section class="il-hero">'+
        '<div><span>IMPORTANT PROJECT LINKS</span><h2>الروابط المهمة</h2>'+
        '<p>اضغط على «اضغط هنا لفتح الرابط» لفتح الشيت مباشرة — '+esc(CFG.city)+'.</p></div>'+
        '<div class="il-contract"><span>رقم العقد</span><strong>'+esc(CFG.contract)+'</strong></div>'+
      '</section>'+
      '<div class="il-tools">'+
        '<label class="il-search"><span>⌕</span><input id="importantLinksSearch" type="search" placeholder="ابحث باسم التاب أو الشيت..."></label>'+
        '<div class="il-count">الروابط الظاهرة <b>'+total+'</b></div>'+
      '</div>'+
      '<section class="il-grid">'+
        (groups.length?groups.map((g,gi)=>
          '<article class="il-group">'+
            '<div class="il-group-head">'+
              '<div class="il-group-title"><span class="il-group-icon">'+esc(g.icon)+'</span><div><span>'+esc(g.sub)+'</span><h3>'+esc(g.title)+'</h3></div></div>'+
              '<span class="il-group-badge">'+g.links.length+' روابط</span>'+
            '</div>'+
            '<div class="il-link-grid">'+
              g.links.map((x)=>{
                const href=url(x);
                return '<article class="il-link-card">'+
                  '<div class="il-link-title">'+esc(x.title)+'</div>'+
                  '<small class="il-link-desc">'+esc(x.desc)+'</small>'+
                  '<a class="il-open-link" href="'+href+'" target="_blank" rel="noopener noreferrer">اضغط هنا لفتح الرابط</a>'+
                '</article>';
              }).join('')+
            '</div>'+
          '</article>'
        ).join(''):'<div class="il-empty">لا توجد روابط مطابقة لبحثك.</div>')+
      '</section>'+
    '</div>';
  const input=document.getElementById('importantLinksSearch');
  if(input){
    input.value=q;
    input.oninput=()=>{
      const v=input.value;render(v);
      const n=document.getElementById('importantLinksSearch');
      if(n){n.focus();try{n.setSelectionRange(v.length,v.length)}catch{}}
    };
  }
}

function activate(){
  if(typeof S!=='undefined')S.current='importantLinks';
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page==='importantLinks'));
  ['masterPage','meetingPage','dataPage'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
  document.getElementById('importantLinksPage')?.classList.add('active');
  const fb=document.getElementById('filterBar');if(fb)fb.style.display='none';
  const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='none';
  const title=document.getElementById('pageTitle');if(title)title.textContent='الروابط المهمة';
  render('');
}
if(typeof openPage==='function'){
  const previous=openPage;
  openPage=function(key){
    const page=document.getElementById('importantLinksPage');
    const fb=document.getElementById('filterBar');
    const topSearch=document.querySelector('.top-actions .search');
    if(key==='importantLinks'){activate();return}
    if(page)page.classList.remove('active');
    if(fb)fb.style.display='';
    if(topSearch)topSearch.style.display='';
    return previous(key);
  };
}
window.renderImportantLinks=render;
})();