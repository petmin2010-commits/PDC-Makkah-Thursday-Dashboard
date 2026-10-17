(()=>{
'use strict';
function updateNotice(detail){
 const status=detail?.status;
 if(!['pending','archived','file-missing','capture-failed'].includes(status))return;
 let panel=document.getElementById('vdPcloudSyncNotice');
 if(!panel){
  panel=document.createElement('aside');panel.id='vdPcloudSyncNotice';panel.setAttribute('role','status');
  panel.style.cssText='position:fixed;bottom:14px;left:16px;z-index:210000;max-width:420px;direction:rtl;text-align:right;background:#f8fbfd;border:1px solid #bdd7e4;border-right:5px solid #bd8b24;color:#173e5b;border-radius:10px;box-shadow:0 6px 20px #12324d36;padding:12px 16px;font:bold 13px/1.9 Tahoma,Arial';
  document.body.append(panel);
 }
 panel.replaceChildren();
 const msg=document.createElement('span');
 msg.textContent=status==='archived'?'تم حفظ التقرير في pCloud وتسجيل رابطه بنجاح.':
   status==='pending'?'رفع التقرير غير مكتمل بعد. سيُعاد تلقائيًا من هذه الجلسة أو عند فتح النظام مجددًا من هذا المتصفح.':
   status==='file-missing'?'لا يمكن تسجيل رابط تقرير دون ملف إلكتروني صالح.':
   'فشل إنشاء ملف PDF؛ لن يُسجل كمحفوظ.';
 panel.append(msg);
 if(status==='pending'){
  const button=document.createElement('button');button.type='button';button.textContent='إعادة المحاولة الآن';
  button.style.cssText='display:block;margin-top:8px;padding:5px 11px;border:0;border-radius:6px;color:white;background:#145941;cursor:pointer;font:inherit';
  button.onclick=()=>window.VDReportArchive?.retryPending?.().catch(console.warn);
  panel.append(button);
 }else{
  setTimeout(()=>{if(panel.isConnected&&panel.dataset.status===status)panel.remove()},6500);
 }
 panel.dataset.status=status;
}
window.addEventListener('vd:report-archive-status',e=>updateNotice(e.detail));
})();
