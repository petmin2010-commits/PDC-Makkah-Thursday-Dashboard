/* Source-accurate generator slides: never rebuild the PDC background, logo, cards or safety grids in HTML. */
(function(){
'use strict';
const root='/generator-template/';
const enc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fixed=(x,d=0)=>Math.max(0,Number(x)||0).toLocaleString('en-US',{maximumFractionDigits:d});
const block=(text,cls,x,y,w,h,style='')=>
 '<div class="tg-original-field '+cls+'" style="left:'+x+'in;top:'+y+'in;width:'+w+'in;height:'+h+'in;'+style+'">'+enc(text)+'</div>';
const backdrop=(src,content='',cls='')=>
 '<section class="sheet tg-slide tg-original-page '+cls+'"><img class="tg-original-background" src="'+root+src+'" alt="" decoding="sync">'+content+'</section>';
function image(photos,slot,x,y,w,h){
 const photo=(photos||[]).find(x=>Number(x.slot)===slot);
 if(!photo?.dataUrl)return '';
 return '<img class="tg-original-photo" src="'+enc(photo.dataUrl)+'" alt="صورة توثيق الملاحظة" style="left:'+x+'in;top:'+y+'in;width:'+w+'in;height:'+h+'in">';
}
function detailPage(row){
 const f=row?.f||{},photos=row?.photos||[];
 const line=[
 block(f.workOrder||'', 'tg-detail-value',10.08,2.46,2.52,.3),
 block(f.contractor||'', 'tg-detail-value',10.04,3.43,2.58,.27),
 block(f.workType||'', 'tg-detail-value',10.03,4.40,2.60,.28),
 block(f.workDescription||'', 'tg-detail-value',10.06,5.35,2.58,.28),
 block(f.location||'', 'tg-detail-value',10.05,6.12,2.60,.29),
 image(photos,1,6.06,1.32,2.55,3.82),
 image(photos,5,1.08,1.33,2.98,3.85),
 block(f.beforeDescription||f.observation||'', 'tg-description',5.44,5.73,3.40,.62, 'font-size:'+(String(f.beforeDescription||f.observation||'').length>65?14:18)+'pt'),
 block(f.correctiveAction||'', 'tg-description',.71,5.77,3.75,.56, 'font-size:'+(String(f.correctiveAction||'').length>65?14:18)+'pt')
 ].join('');
 return backdrop('shared_5.webp',line,'tg-original-detail');
}
function build(report,rows,city){
 if(!report)throw Error('اختر تقرير المؤقتات المحفوظ أولاً.');
 const jeddah=/جدة|Jeddah/i.test(city||report.city||'');
 const metrics=[
  block(fixed(report.currentSites),'tg-kpi',10.20,1.65,2.29,.52),
  block(fixed(report.closedSites),'tg-kpi',6.92,1.65,2.29,.52),
  block(fixed(report.temporaryCables),'tg-kpi',3.97,1.65,2.29,.52),
  block(fixed(report.generatorsTotal),'tg-kpi',.70,1.65,2.29,.52)
 ].join('');
 const cleanRows=Array.isArray(rows)?rows:[];
 const notes=cleanRows.map(x=>String(x.f?.observation||'').trim()).filter(Boolean);
 const limit=notes.length>5?notes.slice(0,5).concat('…'):notes;
 const listing=limit.map(n=>'<li>'+enc(n)+'</li>').join('');
 const summary=backdrop('shared_2.webp',metrics+
   '<ul class="tg-summary-notes">'+listing+'</ul>','tg-original-summary');
 const slides=[
  backdrop(jeddah?'jeddah_1.webp':'makkah_1.webp','','tg-original-cover'),
  summary,
  backdrop('shared_3.webp','','tg-original-checklist'),
  backdrop('shared_4.webp','','tg-original-checklist'),
  ...(cleanRows.length?cleanRows:[{f:{},photos:[]}]).map(detailPage),
  backdrop('shared_6.webp','','tg-original-end')
 ];
 return {html:slides.join(''),css:styles(),slideCount:slides.length};
}
function styles(){return String.raw`
@page{size:13.333333in 7.5in;margin:0}
body{margin:0;background:#fff;font-family:Arial,Tahoma,sans-serif;direction:rtl}
*{box-sizing:border-box}
.tg-original-page{direction:rtl;position:relative;width:13.333333in!important;height:7.5in!important;padding:0!important;margin:0!important;overflow:hidden;background:white;page-break-after:always;break-after:page}
.tg-original-background{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none}
.tg-original-field{position:absolute;display:flex;justify-content:center;align-items:center;white-space:pre-wrap;overflow:hidden;text-align:center;direction:rtl;color:#082f62;line-height:1.12}
.tg-kpi{font-size:21pt;font-family:Arial,Tahoma,sans-serif;color:#174a8c}
.tg-detail-value{font-size:17pt;line-height:1.1;font-weight:700;color:#001d5d;font-family:"Segoe UI",Tahoma,Arial,sans-serif}
.tg-description{font-size:20pt;line-height:1.18;color:#080808;font-family:"Segoe UI",Tahoma,Arial,sans-serif;align-items:center}
.tg-original-photo{position:absolute;object-fit:cover;display:block}
.tg-summary-notes{position:absolute;top:3.65in;right:.98in;width:11.4in;height:3.13in;margin:0;padding:0 .25in 0 0;direction:rtl;overflow:hidden;line-height:1.5;font-size:28pt;text-align:right;color:#000;font-family:"Segoe UI",Tahoma,Arial,sans-serif}
.tg-summary-notes li{padding-bottom:.07in}
@media screen{
 body.tgr-print-preview{background:#e9edf2}
 .tg-original-page{box-shadow:0 6px 20px rgba(8,25,46,.15);margin:15px auto!important}
}
@media print{.tg-original-page{margin:0!important;box-shadow:none!important}}
`;}
window.VDGeneratorOriginalDeck={build,styles};
})();
