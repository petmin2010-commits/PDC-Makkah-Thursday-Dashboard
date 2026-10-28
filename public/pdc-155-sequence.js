/* Audit: consultant 155 entered before contractor 155. Shared by meeting/closures trees. */
(function(){
  'use strict';
  const records=new Map();
  let nextId=0;
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalized=v=>String(v??'').trim().replace(/[أإآ]/g,'ا').replace(/\s+/g,' ');
  const latin=v=>String(v??'').replace(/[٠-٩]/g,ch=>String(ch.charCodeAt(0)-1632)).replace(/[۰-۹]/g,ch=>String(ch.charCodeAt(0)-1776));
  function timestamp(value){
    if(value instanceof Date)return Number.isFinite(+value)?+value:null;
    const text=latin(value).trim();
    if(!text)return null;
    if(/^\d{5}(?:\.\d+)?$/.test(text)){
      const num=Number(text);
      if(num>20000&&num<90000)return Math.round((num-25569)*86400000);
    }
    let match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if(match){
      const d=Number(match[1]),m=Number(match[2])-1,y=Number(match[3]);
      const date=new Date(Date.UTC(y,m,d,+match[4]||0,+match[5]||0,+match[6]||0));
      return date.getUTCFullYear()===y&&date.getUTCMonth()===m&&date.getUTCDate()===d?+date:null;
    }
    match=text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:Z)?$/i);
    if(match){
      const y=+match[1],m=+match[2]-1,d=+match[3];
      const date=new Date(Date.UTC(y,m,d,+match[4]||0,+match[5]||0,+match[6]||0));
      return date.getUTCFullYear()===y&&date.getUTCMonth()===m&&date.getUTCDate()===d?+date:null;
    }
    const parsed=Date.parse(text);
    return Number.isFinite(parsed)?parsed:null;
  }
  function analyze(rows){
    return (Array.isArray(rows)?rows:[]).flatMap(row=>{
      if(normalized(row.consultant155Status)!=='نعم')return [];
      const contractor=normalized(row.contractor155Status);
      if(contractor==='لا')return [{...row,sequenceReason:'تم إدخال 155 للاستشاري بينما 155 المقاول غير مستلم'}];
      if(contractor!=='نعم')return [];
      const consultantTime=timestamp(row.consultant155Date);
      const contractorTime=timestamp(row.contractor155Date);
      if(consultantTime===null||contractorTime===null||consultantTime>=contractorTime)return [];
      return [{...row,sequenceReason:'تاريخ إدخال 155 الاستشاري يسبق تاريخ 155 المقاول'}];
    });
  }
  function branch(rows,total,pct,fmt,escape){
    const found=analyze(rows),id='seq155-'+(++nextId);
    records.set(id,found);
    const label='فحص إدخال 155 استشاري قبل 155 مقاول';
    return '<div class="ak-uds-sequence"><article class="kpi-story-card anomaly-155-card sequence-155-card" role="button" tabindex="0" data-seq155="'+id+'" title="عرض المعاملات المخالفة">'+
      '<span>'+escape(label)+'</span><strong>'+fmt(found.length)+'</strong><small>'+pct(found.length,total)+'</small></article></div>';
  }
  function openDetails(id){
    const rows=records.get(id);if(!rows)return;
    let overlay=document.getElementById('sequence155Overlay');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='sequence155Overlay';overlay.className='sequence-155-overlay';
      document.body.appendChild(overlay);
    }
    const header='<div class="sequence-155-dialog-head"><h3>فحص إدخال 155 استشاري قبل 155 مقاول</h3><button type="button" data-close-seq155 aria-label="إغلاق">×</button></div>';
    const head='<thead><tr><th>أمر العمل</th><th>المقاول</th><th>155 المقاول</th><th>تاريخ المقاول (AL)</th><th>155 الاستشاري</th><th>تاريخ الاستشاري (AG)</th><th>سبب المخالفة</th></tr></thead>';
    const body=rows.map(r=>'<tr><td>'+escapeHtml(r.workOrder)+'</td><td>'+escapeHtml(r.contractor)+'</td><td>'+escapeHtml(r.contractor155Status)+'</td><td>'+escapeHtml(r.contractor155Date||'—')+'</td><td>'+escapeHtml(r.consultant155Status)+'</td><td>'+escapeHtml(r.consultant155Date||'—')+'</td><td>'+escapeHtml(r.sequenceReason)+'</td></tr>').join('');
    overlay.innerHTML='<section class="sequence-155-dialog" role="dialog" aria-modal="true" aria-label="مخالفات تسلسل استلام 155" dir="rtl">'+header+
      '<p>عدد المعاملات المخالفة: <b>'+rows.length+'</b>. يُستبعد من مقارنة التواريخ أي سجل ينقصه أحد التاريخين. كما يُعد إدخال الاستشاري مع حالة «لا» للمقاول مخالفة.</p>'+
      (rows.length?'<div class="sequence-155-table-wrap"><table>'+head+'<tbody>'+body+'</tbody></table></div>':'<p>لا توجد معاملات مخالفة ضمن هذا الفرع.</p>')+'</section>';
    overlay.classList.add('open');
    overlay.querySelector('[data-close-seq155]')?.focus();
  }
  document.addEventListener('click',event=>{
    const card=event.target.closest?.('[data-seq155]');
    if(card){openDetails(card.dataset.seq155);return;}
    if(event.target.matches?.('[data-close-seq155]')||event.target.id==='sequence155Overlay')
      document.getElementById('sequence155Overlay')?.classList.remove('open');
  });
  document.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches?.('[data-seq155]')){event.preventDefault();openDetails(event.target.dataset.seq155);}
    if(event.key==='Escape')document.getElementById('sequence155Overlay')?.classList.remove('open');
  });
  window.PDC155Sequence={timestamp,analyze,branch};
})();
