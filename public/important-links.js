(()=>{
'use strict';
const CFG={
  "city": "مكة",
  "contract": "4400023406",
  "spreadsheetId": "1K_V0cvjBdD_5YLPygWjVgvPMzS1O88PCCOYUuoIH9uY",
  "groups": [
    {
      "title": "الرئيسية",
      "sub": "MASTER CONTROL",
      "icon": "⌂",
      "links": [
        {
          "title": "🏗️اوامر العمل",
          "gid": 1068069007,
          "desc": "المصدر الرئيسي لأوامر العمل والقيم والحالات"
        },
        {
          "title": "Data Base",
          "gid": 403020384,
          "desc": "قاعدة البيانات المساندة للربط والتحقق"
        },
        {
          "title": "info",
          "gid": 284849862,
          "desc": "بيانات مرجعية وإعدادات مساندة"
        }
      ]
    },
    {
      "title": "المشاريع",
      "sub": "PROJECTS",
      "icon": "⚡",
      "links": [
        {
          "title": "⚡المشاريع العام",
          "gid": 1457012854,
          "desc": "المتابعة التنفيذية للمشاريع"
        },
        {
          "title": "🏗️اوامر العمل",
          "gid": 1068069007,
          "desc": "مرجع أمر العمل والإسناد والقيمة"
        },
        {
          "title": "🧾التصاريح العام",
          "gid": 1155296020,
          "desc": "حالة التصاريح المرتبطة بالمشاريع"
        }
      ]
    },
    {
      "title": "التوصيلات",
      "sub": "CONNECTIONS",
      "icon": "◉",
      "links": [
        {
          "title": "🔌التوصيلات العام",
          "gid": 65539543,
          "desc": "المتابعة الرئيسية لأعمال التوصيلات"
        },
        {
          "title": "🏗️اوامر العمل",
          "gid": 1068069007,
          "desc": "بيانات أوامر العمل الأساسية"
        },
        {
          "title": "🧾التصاريح العام",
          "gid": 1155296020,
          "desc": "التصاريح المرتبطة بأعمال التوصيلات"
        }
      ]
    },
    {
      "title": "التصاريح",
      "sub": "PERMITS",
      "icon": "▤",
      "links": [
        {
          "title": "🧾التصاريح العام",
          "gid": 1155296020,
          "desc": "المصدر الرئيسي لحالة التصاريح"
        },
        {
          "title": "⚡المشاريع العام",
          "gid": 1457012854,
          "desc": "مرجع المشاريع وحالة التصريح"
        },
        {
          "title": "🔌التوصيلات العام",
          "gid": 65539543,
          "desc": "مرجع التوصيلات وحالة التصريح"
        }
      ]
    },
    {
      "title": "الأصول",
      "sub": "ASSETS",
      "icon": "⬡",
      "links": [
        {
          "title": "🏭 الاصول",
          "gid": 921433620,
          "desc": "اختبارات واعتمادات واستلام الأصول"
        },
        {
          "title": "🧩الاقفالات العام",
          "gid": 244949191,
          "desc": "مرجع الإغلاق والاستلام المرتبط"
        },
        {
          "title": "🏗️اوامر العمل",
          "gid": 1068069007,
          "desc": "بيانات أمر العمل الأساسية"
        }
      ]
    },
    {
      "title": "الإغلاقات",
      "sub": "CLOSURES",
      "icon": "✓",
      "links": [
        {
          "title": "🧩الاقفالات العام",
          "gid": 244949191,
          "desc": "المصدر الرئيسي لمراحل الإغلاق"
        },
        {
          "title": "ربط الاغلاقات",
          "gid": 305544392,
          "desc": "ربط ومطابقة بيانات الإغلاقات"
        },
        {
          "title": "🏗️اوامر العمل",
          "gid": 1068069007,
          "desc": "مرجع أمر العمل وحالته التنفيذية"
        }
      ]
    },
    {
      "title": "متابعة أعمال المواقع",
      "sub": "SITE FOLLOW-UP",
      "icon": "✦",
      "links": [
        {
          "title": "📌المهام والافادات",
          "gid": 496031151,
          "desc": "المصدر الأساسي للمهام والإفادات الميدانية"
        },
        {
          "title": "ربط حالة المستندات",
          "gid": 1203497752,
          "desc": "متابعة وربط موقف المستندات والمرفقات"
        },
        {
          "title": "🏗️اوامر العمل",
          "gid": 1068069007,
          "desc": "مرجع أمر العمل ونوعه ومقاوله"
        }
      ]
    },
    {
      "title": "الطوارئ",
      "sub": "EMERGENCY",
      "icon": "⚠",
      "links": [
        {
          "title": "اشعارات الطوارئ",
          "gid": 283924004,
          "desc": "المصدر الرئيسي لإشعارات الطوارئ"
        },
        {
          "title": "📌المهام والافادات",
          "gid": 496031151,
          "desc": "الإفادات الميدانية المرتبطة بالتنفيذ"
        },
        {
          "title": "ربط حالة المستندات",
          "gid": 1203497752,
          "desc": "موقف المستندات المرتبطة"
        }
      ]
    },
    {
      "title": "اجتماع الـ PDC",
      "sub": "PDC MEETING",
      "icon": "▥",
      "links": [
        {
          "title": "🏗️اوامر العمل",
          "gid": 1068069007,
          "desc": "قاعدة الاجتماع وموقف أوامر العمل"
        },
        {
          "title": "ربط حالة المستندات",
          "gid": 1203497752,
          "desc": "حالة تسليم ومراجعة المستندات"
        },
        {
          "title": "ربط الاغلاقات",
          "gid": 305544392,
          "desc": "موقف الإغلاقات والربط"
        }
      ]
    },
    {
      "title": "مخالفات السلامة",
      "sub": "SAFETY",
      "icon": "⚠",
      "links": [
        {
          "title": "🚫مخالفات السلاممة",
          "gid": 2129916751,
          "desc": "سجل مخالفات السلامة"
        },
        {
          "title": "📌المهام والافادات",
          "gid": 496031151,
          "desc": "ربط المخالفة بالمهمة والموقع"
        },
        {
          "title": "📞أرشفة و تواصل",
          "gid": 1050816614,
          "desc": "الأرشفة والتواصل والمتابعة"
        }
      ]
    },
    {
      "title": "مخالفات التنفيذ",
      "sub": "EXECUTION VIOLATIONS",
      "icon": "⚠",
      "links": [
        {
          "title": "🚫مخالفات التنفيذ",
          "gid": 1492002852,
          "desc": "السجل الرئيسي لمخالفات التنفيذ"
        },
        {
          "title": "📌المهام والافادات",
          "gid": 496031151,
          "desc": "مرجع المهمة والإفادة الميدانية"
        },
        {
          "title": "📞أرشفة و تواصل",
          "gid": 1050816614,
          "desc": "أرشفة المخالفات والمراسلات"
        }
      ]
    }
  ]
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=gid=>'https://docs.google.com/spreadsheets/d/'+CFG.spreadsheetId+'/edit#gid='+gid;
const root=()=>document.getElementById('importantLinksRoot');
function render(q=''){
  const host=root();if(!host)return;
  const needle=String(q||'').trim().toLowerCase();
  const groups=CFG.groups.filter(g=>!needle||[g.title,g.sub,...g.links.flatMap(x=>[x.title,x.desc])].join(' ').toLowerCase().includes(needle));
  host.innerHTML=
    '<div class="il-root" style="display:block">'+
      '<section class="il-hero"><div><span>IMPORTANT PROJECT LINKS</span><h2>الروابط المهمة</h2><p>روابط مباشرة لأهم أوراق Google Sheets المرتبطة بكل جزء من الداشبورد — '+esc(CFG.city)+'.</p></div><div class="il-contract"><span>رقم العقد</span><strong>'+esc(CFG.contract)+'</strong></div></section>'+
      '<div class="il-tools"><label class="il-search"><span>⌕</span><input id="importantLinksSearch" type="search" placeholder="ابحث باسم التاب أو الشيت..."></label><div class="il-count">المجموع <b>'+CFG.groups.reduce((s,g)=>s+g.links.length,0)+'</b> رابط</div></div>'+
      '<section class="il-grid">'+
        (groups.length?groups.map(g=>
          '<article class="il-group" data-search="'+esc([g.title,g.sub,...g.links.flatMap(x=>[x.title,x.desc])].join(' ').toLowerCase())+'">'+
            '<div class="il-group-head"><div class="il-group-title"><span class="il-group-icon">'+esc(g.icon)+'</span><div><span>'+esc(g.sub)+'</span><h3>'+esc(g.title)+'</h3></div></div><span class="il-group-badge">3 شيتات</span></div>'+
            '<div class="il-links">'+g.links.map(x=>
              '<a class="il-link" href="'+url(x.gid)+'" target="_blank" rel="noopener noreferrer" title="'+esc(x.title)+'">'+
                '<span class="il-sheet-icon">▦</span><span class="il-link-copy"><strong>'+esc(x.title)+'</strong><small>'+esc(x.desc)+'</small></span><span class="il-open">فتح الشيت ↗</span>'+
              '</a>'
            ).join('')+'</div>'+
          '</article>'
        ).join(''):'<div class="il-empty">لا توجد روابط مطابقة لبحثك.</div>')+
      '</section>'+
    '</div>';
  const input=document.getElementById('importantLinksSearch');
  if(input){input.value=q;input.oninput=()=>{const v=input.value;render(v);const n=document.getElementById('importantLinksSearch');if(n){n.focus();try{n.setSelectionRange(v.length,v.length)}catch{}}}}
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