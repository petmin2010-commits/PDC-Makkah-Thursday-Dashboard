(function(){
  'use strict';

  async function applyDashboardUserPhoto(){
    const avatar=document.querySelector('.dashboard-user-avatar');
    const initial=document.getElementById('dashboardUserInitial');
    if(!avatar || !initial) return;

    try{
      const response=await fetch('/api/auth/me',{
        credentials:'same-origin',
        cache:'no-store'
      });
      if(!response.ok) return;

      const data=await response.json();
      const user=data && data.authenticated ? data.user : null;
      const photoUrl=String(user && user.image || '').trim();
      if(!photoUrl) return;

      let img=document.getElementById('dashboardUserPhoto');
      if(!img){
        img=document.createElement('img');
        img.id='dashboardUserPhoto';
        img.className='dashboard-user-photo';
        img.hidden=true;
        avatar.prepend(img);
      }
      img.alt=user && user.name ? 'صورة '+user.name : 'صورة المستخدم';
      img.onload=()=>{
        img.hidden=false;
        initial.hidden=true;
        avatar.classList.add('has-photo');
      };
      img.onerror=()=>{
        img.hidden=true;
        initial.hidden=false;
        avatar.classList.remove('has-photo');
      };
      img.src=photoUrl;
    }catch(error){
      console.warn('User photo could not be loaded',error);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',applyDashboardUserPhoto,{once:true});
  }else{
    applyDashboardUserPhoto();
  }
})();
