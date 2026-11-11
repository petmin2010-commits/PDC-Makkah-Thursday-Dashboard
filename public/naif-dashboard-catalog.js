/* Auto-audited Naif dashboard knowledge catalogue.
   28 primary navigation tabs + 4 first-class data sources without own nav buttons.
   This metadata is not permission granting or a live data snapshot. */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.NaifDashboardCatalog=api;
})(typeof window!=='undefined'?window:null,function(){'use strict';
 const entries=[
 {key:'master',label:'الرئيسية',kind:'dashboard',sources:['🏗️اوامر العمل','المرفقات','الطوارئ','المهام'],module:'app.js,master-executive.js',about:'الملخص التنفيذي لكافة أوامر العمل، الإسناد الشهري، حالة التنفيذ، الأقسام والإدارات وجداول المطابقة',sections:['مؤشرات الأداء الرئيسية','حجم الإسناد الشهري','نوع أوامر العمل','تنفيذ أوامر العمل','توزيع الأوامر','الإدارات','جدول أوامر العمل'],prompts:['ما نسبة الإنجاز في الرئيسية؟','اشرح مؤشرات الإسناد','لخص أوامر العمل']},
 {key:'projects',label:'المشاريع',kind:'sheet',sources:['⚡المشاريع العام'],module:'projects-analytics.js',about:'التقدم الميداني للمشاريع، المراحل الزمنية، التأخير، المقاول والمهندس وحالة 155',sections:['متوسط الإنجاز','التقدم الميداني','الحفر والتمديد','مؤشرات التأخير','SPI','مراحل الإغلاق'],prompts:['نسبة إنجاز المشاريع','من أكثر المقاولين تأخيرًا؟']},
 {key:'connections',label:'التوصيلات',kind:'sheet',sources:['🔌التوصيلات العام'],module:'connections-analytics.js',about:'طلبات التوصيلات وحالات التنفيذ ومراحل العمل والتأخير والتصاريح',sections:['حالة التنفيذ','نسبة التقدم','الحفر','التمديد','المدة الزمنية'],prompts:['ما نسبة إنجاز التوصيلات؟']},
 {key:'permits',label:'التصاريح',kind:'sheet',sources:['🧾التصاريح العام'],module:'permits-analytics.js',about:'تصاريح بلدي والإصدار والإجراءات ومدد التصاريح وحالات التأخير',sections:['إجمالي التصاريح','الصادرة','لا يتطلب','اتخاذ الإجراء','التأخير'],prompts:['كم تصريحًا صدر؟']},
 {key:'assets',label:'الأصول',kind:'sheet',sources:['🏭 الاصول'],module:'assets-analytics.js',about:'سجل الأصول والاختبارات والاستلام والزرع والنماذج وإجراء 207',sections:['مراجعة الزراعة','نموذج الأصول','الاستلام الميداني','إجراء 207','الاستلام بالنظام'],prompts:['ما نسبة اكتمال الأصول؟']},
 {key:'closures',label:'الإغلاقات',kind:'sheet',sources:['🧩الاقفالات العام'],module:'closures-trees.js',about:'الملفات المستلمة ومراجعتها وتختيمها وإرسالها ورفعها وإصدار شهادة الإنجاز',sections:['استلام المستندات','مراجعة المستندات','التختيم','الرفع على النظام','شهادة الإنجاز'],prompts:['ما معدل اكتمال الإغلاقات؟']},
 {key:'emergency',label:'الطوارئ',kind:'sheet',sources:['اشعارات الطوارئ'],module:'app.js',about:'الإشعارات الطارئة والمجدولة والحالات المنجزة وأرشفة المستندات',sections:['الإشعارات','حالة التنفيذ','الأرشفة','المقاول','المهندس'],prompts:['كم بلاغ طوارئ تم إنجازه؟']},
 {key:'tasks',label:'متابعة أعمال المواقع',kind:'sheet',sources:['📌المهام والافادات'],module:'site-followup.js',about:'الإفادات الميدانية والمهام والمرفقات وتوثيق السلامة والصور واستجابة المهندسين',sections:['المهام','الإفادات','المرفقات','السلامة','جاهزية 203 و190'],prompts:['كم إفادة تحتاج متابعة؟']},
 {key:'safety',label:'مخالفات السلامة',kind:'sheet',sources:['🚫مخالفات السلامة'],module:'violations-analytics.js',about:'مخالفات السلامة بحسب المقاول والمشرف ونوع المخالفة وتواريخها',sections:['المخالفات','المقاولون','المشرفون','روابط المستندات'],prompts:['ما أكثر مخالفات السلامة؟']},
 {key:'safetyCorrective',label:'تقرير السلامة والإجراءات التصحيحية',kind:'special',sources:['🚫مخالفات السلامة','تقارير الإجراءات التصحيحية'],module:'safety-corrective-report.js',api:'/api/safety-corrective',about:'تقرير الإجراءات التصحيحية لمخالفات السلامة مع دعم PDF وPPTX',sections:['الملاحظات','الإجراءات التصحيحية','الملخص','تصدير التقرير'],prompts:['اشرح تقرير السلامة والإجراءات التصحيحية']},
 {key:'qualityCorrective',label:'تقرير الجودة والإجراءات التصحيحية',kind:'special',sources:['تحليل جودة البيانات','تقارير الجودة والإجراءات التصحيحية'],module:'quality-corrective-report.js',api:'/api/quality-corrective',about:'تجميع ملاحظات جودة الأعمال والإفادات والإجراءات التصحيحية مع التقارير',sections:['نتائج الجودة','الملاحظات','الإجراءات التصحيحية','تصدير التقرير'],prompts:['اشرح تقرير الجودة والإجراءات التصحيحية']},
 {key:'engineeringInspection',label:'وكيل الفحص الهندسي الذكي',kind:'special',sources:['سجلات الفحص الهندسي'],module:'engineering-inspection-agent.js',api:'/api/engineering-inspections',about:'واجهة الفحص الهندسي الذكي وسجلات المراجعة والأدلة المصورة',sections:['الفحص','سجلات المراجعة','النتائج','الأدلة'],prompts:['ما وظيفة وكيل الفحص الهندسي؟']},
 {key:'temporaryGenerators',label:'تقرير المؤقتات والمولدات',kind:'special',sources:['تقارير المؤقتات والمولدات'],module:'temporary-generators-report.js',api:'/api/temporary-generators',about:'عرض المؤقتات والمولدات والتقارير والبيانات المساندة',sections:['المولدات','البيانات الفنية','التقارير','التصدير'],prompts:['اشرح تقرير المؤقتات والمولدات']},
 {key:'contractorSafety',label:'تقييم السلامة للمقاولين',kind:'special',sources:['Intellect','التقييم الأسبوعي'],module:'contractor-safety.js,contractor-safety-weekly.js',api:'/api/safety/contractor-evaluation',about:'تقييم التزام المقاولين بالسلامة ومؤشرات الأداء الأسبوعية',sections:['نسب الالتزام','تقييم المقاولين','التقييم الأسبوعي','التقارير'],prompts:['ما تقييم المقاولين في السلامة؟']},
 {key:'executionViolations',label:'مخالفات التنفيذ',kind:'sheet',sources:['🚫مخالفات التنفيذ'],module:'violations-analytics.js',about:'سجل المخالفات التنفيذية وموقف الإبلاغ والتأخير بحسب المقاول ونوع المخالفة',sections:['نوع المخالفة','المقاول','حالة البريد','المشرف'],prompts:['كم مخالفة تنفيذ مسجلة؟']},
 {key:'minutes',label:'محاضر مخالفة اثبات الحالة',kind:'sheet',sources:['🚫محاضر مخالفة اثبات الحالة'],module:'violations-analytics.js',about:'محاضر إثبات الحالة وقيم البنود والغرامات والتواريخ والمقاولين',sections:['محاضر المخالفات','بنود الغرامة','إجمالي الغرامات'],prompts:['ما إجمالي الغرامات؟']},
 {key:'dataQuality',label:'جودة البيانات',kind:'analysis',sources:['محرك جودة الإفادات'],module:'data-quality.js',about:'مراجعة الإفادات واكتشاف الإفادات الضعيفة والشكلية والتناقضات والفجوات',sections:['جودة الإفادات','الملاحظات','المؤشرات','التحليل'],prompts:['كم إفادة ضعيفة أو شكلية؟']},
 {key:'hrStaff',label:'الموارد البشرية للكادر',kind:'special',sources:['الكادر'],module:'hr-dashboard.js',api:'/api/hr/staff',about:'القوى العاملة والتدريب وبطاقات الموظفين والسيارات والوظائف',sections:['حالة الكادر','حالة التوظيف','الشواغر','التدريب','البطاقات','السيارات'],prompts:['كم عدد الكادر؟','ما نسبة إنجاز التدريب؟']},
 {key:'employeeEvaluation',label:'تقييم مهندسي المواقع',kind:'special',sources:['📌المهام والافادات','تقييم أداء المواقع'],module:'employee-evaluation.js',api:'/api/hr/employee-evaluation',about:'تقييم أداء مهندسي المواقع وفق الإفادات والمرفقات والسلامة والتوثيق',sections:['تقييم الأداء','الإفادات','السلامة','المرفقات','المؤشرات'],prompts:['ما مؤشرات تقييم مهندسي المواقع؟']},
 {key:'electricityEngineerEvaluation',label:'تقييم مهندسي شركة الكهرباء',kind:'special',sources:['⚡المشاريع العام','🔌التوصيلات العام','🏭 الاصول','جودة الإفادات'],module:'electricity-engineer-evaluation.js',api:'/api/hr/electricity-engineer-evaluation',about:'تقييم مهندسي الكهرباء عبر المشاريع والتوصيلات والأصول والالتزام بالإفادات',sections:['أداء المهندسين','نسب الإنجاز','الأصول','المتابعة'],prompts:['كيف يتم تقييم مهندسي الكهرباء؟']},
 {key:'wednesdayMeeting',label:'اجتماع الـ PDC',kind:'special',sources:['ملخص بيانات الاجتماع'],module:'app.js',about:'لوحة مراجعة الاجتماع وعرض أوامر العمل والمؤشرات والمحاضر',sections:['ملخص الاجتماع','المؤشرات','أوامر العمل','المتابعة'],prompts:['أعطني ملخص اجتماع PDC']},
 {key:'pdcMeeting2',label:'اجتماع PDC 2',kind:'special',sources:['ملخص اجتماع PDC 2'],module:'pdc-meeting-2.js,pdc-meeting-2-unfiltered.js',api:'/api/pdc-meeting-2/summary',about:'لوحة الاجتماع الثاني بعروضه المعتمدة ومؤشراته وتقاريره',sections:['المؤشرات','الشرائح','المتابعة','التصدير'],prompts:['اشرح اجتماع PDC 2']},
 {key:'smartThursday',label:'تقرير الخميس الذكي',kind:'analysis',sources:['مخالفات السلامة والتنفيذ','محاضر المخالفات','متابعة أسبوعية'],module:'smart-thursday.js,smart-thursday-portfolio.js',about:'مؤشرات ومقارنات أسبوعية وحالات الإنجاز والتأخير والتصعيد',sections:['الوضع الحالي','الاتجاهات','المقارنة الأسبوعية','التقرير التنفيذي'],prompts:['أعطني ملخص تقرير الخميس']},
 {key:'reportsCenter',label:'مركز التقارير العام',kind:'report',sources:['تقارير المنصة ومراكز التصدير'],module:'reports-center.js,reports-center-unified.js',about:'فهرس التقارير العامة وخيارات إنشاء وتصدير ملفات PDF وPPTX',sections:['اختيار التقرير','إنشاء التقرير','التصدير','المرفقات'],prompts:['ما التقارير المتاحة؟']},
 {key:'reportArchive',label:'سجل التقارير الصادرة',kind:'archive',sources:['VD Report Archive','pCloud'],module:'report-archive.js',api:'/api/report-archive',about:'السجل الإلكتروني للتقارير المصدرة وحالات الرفع والروابط والأرشفة',sections:['التقارير الصادرة','حالة الحفظ','الروابط','pCloud'],prompts:['كم تقريرًا صدر اليوم؟']},
 {key:'importantLinks',label:'الروابط المهمة',kind:'static',sources:['دليل روابط المشروع'],module:'important-links.js',about:'الروابط الرسمية والمرجعية المهمة للمشروع',sections:['روابط المشروع','المراجع','التقارير'],prompts:['ما الروابط المهمة؟']},
 {key:'excelExport',label:'مركز تقارير الاكسيل',kind:'report',sources:['قوائم أوراق الشيت','خيارات التصدير'],module:'excel-export.js',api:'/api/excel-export/sheets',about:'تصفية أوراق البيانات وإعداد تقارير Excel قابلة للتصدير',sections:['اختيار الورقة','الفلاتر','تصدير Excel'],prompts:['كيف أصدر تقرير Excel؟']},
 {key:'projectsReportEngine',label:'Projects Report Engine',kind:'special',sources:['⚡المشاريع العام','صور المشروعات','KMZ'],module:'projects-report-engine.js,projects-report-defaults.js',api:'/api/projects-report-engine/excel',about:'محرك تقارير المشاريع مع الصور والجداول والخرائط وملفات KMZ وPDF وExcel',sections:['بيانات المشاريع','الصور','KMZ','الرسومات','التقارير'],prompts:['كيف أستخدم محرك تقارير المشاريع؟']}
 ];
 const extra=[
 {key:'workorders',label:'بيانات أوامر العمل',source:'🏗️اوامر العمل',belongsTo:'master'},
 {key:'operations',label:'عمليات الإنشاءات',source:'🛠️العمليات بالانشاءات العام  ',belongsTo:'master'},
 {key:'attachments',label:'مرفقات المقاول',source:'حالة مرفقات المقاول',belongsTo:'master'},
 {key:'finance',label:'المعلومات المالية',source:'💰ماليات الكهرباء',belongsTo:'master'}
 ];
 const byKey=new Map(entries.map(e=>[e.key,e]));
 function normalize(v){return String(v||'').normalize('NFKC').toLowerCase()
  .replace(/[ً-ٰٟـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
 function find(q,allowedKeys){const terms=normalize(q);const allow=allowedKeys?new Set(allowedKeys):null;
  return entries.map(e=>{
   const tokens=[e.label,...e.sections,...e.prompts,e.key].map(normalize);
   const label=normalize(e.label);
   const primary=(label&&terms.includes(label))?label.length+20:0;
   const score=Math.max(primary,...tokens.slice(1).map(t=>t&&terms.includes(t)?Math.min(t.length,15):0));
   return {entry:e,score};
  }).filter(x=>x.score>0&&(!allow||allow.has(x.entry.key))).sort((a,b)=>b.score-a.score)[0]?.entry||null;
 }
 function audit(navKeys){
  const nav=[...new Set(navKeys.map(String))],indexed=nav.filter(k=>byKey.has(k)),missing=nav.filter(k=>!byKey.has(k));
  const orphan=entries.filter(e=>!nav.includes(e.key)).map(e=>e.key);
  const blank=entries.filter(e=>!e.label||!e.sources?.length||!e.module||!e.about||!e.sections?.length||!e.prompts?.length).map(e=>e.key);
  return {navigationTotal:nav.length,indexed:indexed.length,percent:nav.length?Math.round(indexed.length/nav.length*10000)/100:0,missing,orphan,blank,extraDataSources:extra.length,complete:nav.length===entries.length&&!missing.length&&!orphan.length&&!blank.length};
 }
 return Object.freeze({version:'2026-11-11-v1',entries:Object.freeze(entries),extra:Object.freeze(extra),byKey:key=>byKey.get(key)||null,find,normalize,audit});
});