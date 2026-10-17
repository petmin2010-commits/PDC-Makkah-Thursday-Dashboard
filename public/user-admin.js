(function(){
'use strict';
const $=(s,p=document)=>p.querySelector(s),$$=(s,p=document)=>[...p.querySelectorAll(s)];
const state={users:[],groups:[],selected:'',creating:false,original:null,permissions:new Set(),search:'',permSearch:'',loaded:false,saving:false};
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[x]));
const api=async(url,body)=>{
 const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const json=await r.json().catch(()=>({}));
 if(!r.ok||!json.ok)throw Error(json.error||'تعذر الاتصال بالخادم');
 return json;
};
const errorLabels={ADMIN_REQUIRED:'هذا الإجراء متاح لمدير النظام فقط',EMAIL_EXISTS:'هذا البريد مسجل مسبقًا',USER_CHANGED_RELOAD:'تم تعديل المستخدم من مصدر آخر. أعد تحميل البيانات.',INVALID_USER_DATA:'راجع الاسم والدور والبريد والصلاحيات',PASSWORD_LENGTH:'كلمة المرور الجديدة يجب أن تكون بين 10 و128 حرفًا',PASSWORD_REQUIRED:'أدخل كلمة مرور للمستخدم الجديد',CANNOT_DISABLE_SELF:'لا يمكنك تعطيل حسابك',CANNOT_REVOKE_SELF:'لا يمكنك إلغاء صلاحيتك الإدارية',DUPLICATE_SHEET_EMAIL:'البريد مكرر في ورقة المستخدمين',READ_FAILED:'تعذر قراءة ورقة المستخدمين',WRITE_FAILED:'تعذر حفظ التعديلات في Google Sheets'};
function showError(message){const el=$('#uaMessage');if(el){el.textContent=errorLabels[message]||message;el.classList.add('error');el.hidden=false}}
function showSuccess(message){const el=$('#uaMessage');if(el){el.textContent=message;el.classList.remove('error');el.hidden=false}}
function showPage(){
 $$('.page').forEach(p=>p.classList.remove('active'));$('#userAdminPage')?.classList.add('active');
 $$('#nav .nav-item').forEach(n=>n.classList.toggle('active',n.id==='userAdminNav'));
 if($('#filterBar'))$('#filterBar').style.display='none';
 if($('#pageTitle'))$('#pageTitle').textContent='إدارة المستخدمين والصلاحيات';
 render();
}
function closePage(){
 $('#userAdminPage')?.classList.remove('active');
 if($('#filterBar'))$('#filterBar').style.removeProperty('display');
}
function installNav(){
 const nav=$('#nav');if(!nav||$('#userAdminNav'))return;
 const group=$('#nav .vd-nav-group[data-group-key="admin"] .vd-nav-group-items');
 const btn=document.createElement('button');btn.type='button';btn.id='userAdminNav';btn.className='nav-item';
 btn.innerHTML='⚙ <span>إدارة المستخدمين والصلاحيات</span>';btn.addEventListener('click',showPage);
 (group||nav).appendChild(btn);
 nav.addEventListener('click',e=>{if(e.target.closest('.nav-item')&&!e.target.closest('#userAdminNav'))closePage()});
 const main=$('main');if(!main)return;
 const page=document.createElement('section');page.id='userAdminPage';page.className='page vd-user-admin';
 page.innerHTML='<div class="ua-shell"><div class="ua-header"><div><small>USER ACCESS CONTROL</small><h2>إدارة المستخدمين والصلاحيات</h2><p>مرتبطة مباشرة بورقة dp users الخاصة بهذا الداشبورد. لن تُعرض كلمات المرور المحفوظة.</p></div><button class="ua-button ghost" id="uaRefresh" type="button">↻ تحديث</button></div><div class="ua-message" id="uaMessage" hidden></div><div class="ua-grid"><div class="ua-users"><div class="ua-sidehead"><h3>المستخدمون</h3><button class="ua-button" id="uaNew" type="button">+ إضافة مستخدم</button></div><input id="uaSearch" type="search" placeholder="ابحث بالاسم أو البريد..." aria-label="بحث المستخدمين"><div class="ua-userlist" id="uaUserList"></div></div><div class="ua-detail" id="uaDetail"></div></div></div>';
 main.appendChild(page);
 $('#uaRefresh').onclick=load;
 $('#uaNew').onclick=()=>select('',true);
 $('#uaSearch').addEventListener('input',e=>{state.search=e.target.value;renderUsers()});
 $('#uaUserList').addEventListener('click',e=>{const b=e.target.closest('[data-email]');if(b)select(b.dataset.email,false)});
 $('#uaDetail').addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='save')save();
  if(action==='all')toggleGroup(null);
  if(action==='group')toggleGroup(Number(button.dataset.group));
  if(action==='copy'){
   const u=state.users.find(x=>x.email===$('#uaCopy')?.value);if(u){state.permissions=new Set(u.permissions);renderDetails()}
  }
 });
 $('#uaDetail').addEventListener('input',e=>{
  if(e.target.id==='uaPermissionSearch'){
   state.permSearch=e.target.value;$$('.ua-permission').forEach(n=>n.hidden=!n.textContent.toLowerCase().includes(state.permSearch.toLowerCase()))
  }
 });
 $('#uaDetail').addEventListener('change',e=>{
  if(e.target.matches('input[data-permission]')){
   if(e.target.checked)state.permissions.add(e.target.dataset.permission);else state.permissions.delete(e.target.dataset.permission);
   const count=$('#uaCount');if(count)count.textContent=state.permissions.size+' تابات محددة';
  }
 });
}
function renderUsers(){
 const q=state.search.trim().toLowerCase();
 const filtered=state.users.filter(u=>(u.name+' '+u.email+' '+u.role).toLowerCase().includes(q));
 $('#uaUserList').innerHTML=filtered.length?filtered.map(u=>'<button type="button" class="ua-user '+(state.selected===u.email&&!state.creating?'selected':'')+'" data-email="'+esc(u.email)+'"><span class="ua-avatar">'+esc((u.name||u.email).slice(0,1))+'</span><span class="ua-user-main"><b>'+esc(u.name||u.email)+'</b><small>'+esc(u.email)+'</small><small>'+esc(u.role)+'</small></span><span class="ua-status '+(u.active?'on':'off')+'">'+(u.active?'نشط':'معطّل')+'</span></button>').join(''):'<p class="ua-empty">لا يوجد مستخدمون مطابقون.</p>';
}
function renderDetails(){
 const u=state.creating?{name:'',role:'',email:'',active:true,permissions:[],version:''}:state.users.find(x=>x.email===state.selected);
 if(!u){$('#uaDetail').innerHTML='<div class="ua-empty">اختر مستخدمًا من القائمة أو أضف حسابًا جديدًا.</div>';return}
 const all=state.groups.flatMap(g=>g.tabs);
 const groups=state.groups.map((g,index)=>'<fieldset class="ua-group"><legend>'+esc(g.title)+'</legend><button class="ua-button ghost group-select" type="button" data-action="group" data-group="'+index+'">تحديد / إلغاء المجموعة</button><div class="ua-checks">'+g.tabs.map(t=>'<label class="ua-permission"><input type="checkbox" data-permission="'+esc(t)+'" '+(state.permissions.has(t)?'checked':'')+'><span>'+esc(t)+'</span></label>').join('')+'</div></fieldset>').join('');
 const currentEmail=state.selected||'';
 const choices=state.users.filter(x=>x.email!==currentEmail).map(x=>'<option value="'+esc(x.email)+'">'+esc(x.name+' — '+x.email)+'</option>').join('');
 $('#uaDetail').innerHTML='<div class="ua-detailhead"><div><h3>'+(state.creating?'إضافة مستخدم جديد':'بيانات المستخدم وصلاحياته')+'</h3><p>التغييرات لا تُحفظ إلا بالضغط على زر الحفظ.</p></div><button class="ua-button ghost" data-action="all">تحديد / إلغاء الكل</button></div><div class="ua-fields"><label>الاسم الكامل<input id="uaName" maxlength="120" value="'+esc(u.name)+'" placeholder="اسم المستخدم"></label><label>الدور / المسمى<input id="uaRole" maxlength="120" value="'+esc(u.role)+'" placeholder="المسمى الوظيفي"></label><label>البريد الإلكتروني<input id="uaEmail" type="email" maxlength="254" value="'+esc(u.email)+'" '+(state.creating?'':'readonly')+'></label><label>حالة الحساب<select id="uaActive"><option value="active" '+(u.active?'selected':'')+'>نشط</option><option value="inactive" '+(!u.active?'selected':'')+'>معطّل</option></select></label><label class="ua-wide">كلمة مرور '+(state.creating?'للحساب الجديد':'جديدة (اختياري)')+'<input id="uaPassword" type="password" minlength="10" maxlength="128" autocomplete="new-password" placeholder="'+(state.creating?'10 أحرف على الأقل':'اتركه فارغًا للإبقاء على الحالية')+'"></label></div><div class="ua-perm-header"><div><h3>صلاحيات الوصول للتابات</h3><small id="uaCount">'+state.permissions.size+' تابات محددة</small></div><input type="search" id="uaPermissionSearch" placeholder="بحث داخل التابات..."></div><div class="ua-groups">'+groups+'</div><div class="ua-copy"><label>نسخ صلاحيات مستخدم آخر <select id="uaCopy"><option value="">اختر مستخدمًا...</option>'+choices+'</select></label><button data-action="copy" type="button" class="ua-button ghost">نسخ</button></div><div class="ua-actions"><span>سيتم حفظ الصلاحيات في العمود G دون تعديل صورة المستخدم.</span><button id="uaSave" type="button" class="ua-button" data-action="save">حفظ المستخدم والصلاحيات</button></div>';
}
function toggleGroup(index){
 const group=index==null?state.groups.flatMap(x=>x.tabs):state.groups[index]?.tabs;
 if(!group)return;
 const full=group.every(t=>state.permissions.has(t));
 group.forEach(t=>full?state.permissions.delete(t):state.permissions.add(t));
 renderDetails();
}
function render(){if(!state.loaded)return;renderUsers();renderDetails()}
function select(email,creating){state.selected=email;state.creating=creating;state.permissions=new Set(creating?[]:(state.users.find(x=>x.email===email)?.permissions||[]));state.permSearch='';render();$('#uaMessage').hidden=true;}
async function load(){
 $('#uaRefresh').disabled=true;
 try{
  const data=await api('/api/user-admin');
  state.users=data.users||[];state.groups=data.groups||[];state.loaded=true;
  const keep=state.users.some(x=>x.email===state.selected);
  select(keep?state.selected:(state.users[0]?.email||''),false);showSuccess('تم تحديث البيانات من ورقة dp users');
 }catch(e){showError(e.message)}finally{$('#uaRefresh').disabled=false}
}
async function save(){
 if(state.saving)return;
 const orig=state.creating?null:state.users.find(x=>x.email===state.selected);
 const body={mode:state.creating?'create':'update',name:$('#uaName').value.trim(),role:$('#uaRole').value.trim(),email:$('#uaEmail').value.trim().toLowerCase(),active:$('#uaActive').value==='active',password:$('#uaPassword').value,permissions:[...state.permissions],version:orig?.version||''};
 if(!body.name||!body.role||!body.email){showError('يرجى إدخال الاسم والمسمى والبريد');return}
 state.saving=true;const btn=$('#uaSave');btn.disabled=true;btn.textContent='جاري الحفظ...';
 try{await api('/api/user-admin/save',body);await load();select(body.email,false);showSuccess('تم حفظ المستخدم وصلاحياته بنجاح في Google Sheets');}catch(e){showError(e.message)}finally{state.saving=false;const saveBtn=$('#uaSave');if(saveBtn)saveBtn.disabled=false}
}
async function start(){
 try{
  const me=await api('/api/auth/me');
  if(!me.user?.canManageUsers)return;
  const nav=$('#nav');if(!nav)return;
  if(!nav.classList.contains('vd-sidebar-ready'))await new Promise(resolve=>{const ob=new MutationObserver(()=>{if(nav.classList.contains('vd-sidebar-ready')){ob.disconnect();resolve()}});ob.observe(nav,{attributes:true,attributeFilter:['class']});setTimeout(()=>{ob.disconnect();resolve()},1400)});
  installNav();load();
 }catch(e){console.warn('User management unavailable:',e.message)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
