(()=>{
'use strict';
const root=()=>document.getElementById('importantLinksRoot');

function renderImportantLinks(){
  const host=root();if(!host)return;
  host.innerHTML=
    '<div class="il-pdf-shell">'+
      '<iframe class="il-pdf-frame" src="/barcode-dashboard.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH" title="لوحة الروابط المهمة"></iframe>'+
    '</div>';
}
function activate(){
  if(typeof S!=='undefined')S.current='importantLinks';
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page==='importantLinks'));
  ['masterPage','meetingPage','dataPage'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
  document.getElementById('importantLinksPage')?.classList.add('active');
  const fb=document.getElementById('filterBar');if(fb)fb.style.display='none';
  const topSearch=document.querySelector('.top-actions .search');if(topSearch)topSearch.style.display='none';
  const title=document.getElementById('pageTitle');if(title)title.textContent='الروابط المهمة';
  renderImportantLinks();
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
window.renderImportantLinks=renderImportantLinks;
})();