(function(){
'use strict';
const $=s=>document.querySelector(s);

function activePageKey(){
 const a=$('.nav-item.active');
 return a?.dataset?.page || a?.id || 'master';
}
function favoriteKey(){ return 'vd.pdc.favorite.'+activePageKey(); }
function syncFavorite(){
 const b=$('#topFavoriteBtn'); if(!b)return;
 const on=localStorage.getItem(favoriteKey())==='1';
 b.classList.toggle('is-active',on);
 b.setAttribute('aria-pressed',on?'true':'false');
 b.title=on?'إزالة الصفحة الحالية من المفضلة':'إضافة الصفحة الحالية إلى المفضلة';
 b.textContent=on?'★':'☆';
}
function clickNav(selector){
 const el=$(selector);
 if(el){el.click();return true}
 return false;
}
function boot(){
 const reports=$('#topReportsBtn');
 const w360=$('#top360Btn');
 const fav=$('#topFavoriteBtn');

 reports?.addEventListener('click',()=>{
  if(!clickNav('.nav-item[data-page="reportsCenter"]')){
   const btn=[...document.querySelectorAll('.nav-item')].find(x=>/مركز التقارير|reports center/i.test(x.textContent||''));
   btn?.click();
  }
 });
 w360?.addEventListener('click',()=>{
  if(!clickNav('#workOrder360Nav')){
   const btn=[...document.querySelectorAll('.nav-item')].find(x=>/360/.test(x.textContent||''));
   btn?.click();
  }
 });
 fav?.addEventListener('click',()=>{
  const key=favoriteKey();
  const on=localStorage.getItem(key)==='1';
  localStorage.setItem(key,on?'0':'1');
  syncFavorite();
 });

 document.addEventListener('click',e=>{
  if(e.target.closest('.nav-item')) setTimeout(syncFavorite,0);
 });
 syncFavorite();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();