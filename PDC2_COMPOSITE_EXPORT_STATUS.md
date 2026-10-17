# PDC Meeting 2 — Consolidated report exporter (Makkah only)

## Current assembly
1. Generate **six operational slides** from live Makkah PDC2 summary. Blank/unavailable data appears as —. The styling is generated for this report; the six source slides in the 14 October reference PPTX are not modified or reused as old numeric pages.
2. Select **the latest complete Safety Corrective report** with nonzero sites/visits and at least one saved finding. More recent blank/incomplete draft reports are excluded **visibly**, not silently; the selected report's week and skipped-draft count appear on the PDC2 tab.
3. Select **the latest complete Quality Corrective report** by the same criteria.
4. Reuse the two existing report builders to embed their full approved covers, summary pages, finding pages with pictures and captions, and final pages without restyling.
5. Support future `window.VDGeneratorReportCenter.assembleLatest()` contract for generator/temporary-installation report, currently absent. Do not substitute old slide 39–44 data, do not add placeholders.
6. Render every section as 16:9 slides, export a single PDF or rasterized PowerPoint (one visually faithful image per page, **not editable text/charts**). Auto-download and attempt archival to the existing report archive/pCloud workflow. Download succeeds independently of cloud-upload success, and failures are displayed.

## Verification
- Run `node pdc-meeting-2-composite-smoke.cjs` for report selection, PDF/PPTX composition, 6+3+3 mock slides and archive call.
- Run `node pdc-meeting-2-native-assemblers-qa.cjs` for production Safety/Quality renderer output with approved covers and finding slides.
- Run `node pdc2-vendor-qa.cjs public/vendor/pptxgen.bundle.js` for PPTX browser bundle and output-file creation.
- Existing `pdc-meeting-2-show-all-smoke.cjs` remains in force.
- Test under production authentication by issuing a PDF and PPTX before considering exact visual format verified. User-supplied original first six slides have not been reconstructed pixel-for-pixel; that requires the private template or an approved first-six PDF available to Render in secure storage.

## Scope / privacy
- Makkah only. Jeddah sources, assets and template remain untouched.
- Never commit the 12.7MB private original PPTX or live site photos.
- Render only operates through authenticated Safety and Quality report APIs.
- PDF archive on pCloud may fail independently; failures are disclosed and no false archive URL is recorded.

## تصحيح مطابق للدرافت الأصلي لأول ست شرائح — 18 أكتوبر 2026

- تم تحديد ملف المصدر المحفوظ `report-templates/pdc2-original-20261014.pptx` واستخلاص أول ست شرائح أصلية منه دون تعديل عناصرها أو شارتاتها أو الشعارات؛ تحقق اختبار مطابقة ثنائية لملفات XML لكل شريحة قبل التحديث.
- يوجد **12 شارتًا أصليًا** وجداول وصور بالشريحة السادسة. ينفذ محرك `pdc-meeting-2-original-six.js` تحديث قيم الشرائح الأصلية وبيانات الشارتات من الشيت بدل إنشاء صفحات HTML بديلة. القيم غير المعروفة يجب ألا تبقى تاريخية؛ يستعمل صفرًا في الكاش وشرطة «—» للنص.
- يبدأ ملف PowerPoint بصيغ الشرائح الست الأصلية، ثم يلحق الشرائح المصورة من التقريرين الفرعيين (السلامة والجودة) مع الحفاظ على التصميم الخاص بهما.
- استخلصنا نسخة تحتوي على أول ست شرائح فقط من أصل 44، وحُذفت الصور والشرائح الخاصة بتقارير الأسابيع التاريخية. النسخة المصغرة بحجم 201,249 بايت، وملفات الشرائح الأصلية الست مطابقة ثنائيًا للمصدر.
- النسخة المصغرة في المستودع **مشفرة AES-256-GCM** في `private-assets/pdc2-original-first-six.pptx.enc`؛ **مفتاحها غير مخزن بالمستودع**. يجب ضبط متغير Render `PDC2_ORIGINAL_SIX_AES_KEY` في مساحة العمل التي يؤكدها المستخدم.
- الواجهة تفحص توافر القالب من `/api/pdc-meeting-2/template-six/status`. **لا يسمح بالضغط على التصدير قبل توافر المصدر المشفر ومفتاح الخادم والتقارير الصحيحة**.
- **PDF متوقف مؤقتًا**: لا يوجد حتى الآن محول PowerPoint رسمي يعيد إنتاج أول ست شرائح الأصلية بدقة، فلا يجوز الاستعاضة عن الأصل بصفحات HTML مختلفة.
- اختبارات: `pdc-meeting-2-original-six-server-qa.cjs` و`pdc-meeting-2-native-six-qa.cjs` و`pdc-meeting-2-composite-smoke.cjs`. اجتازت اختبارات التشفير والصلاحيات، وضم 6 شرائح أصلية مع شرائح أخرى داخل ملف PowerPoint دون إعادة رسم الست الأولى.
- لا تعتبر المطابقة البصرية في PDF أو نتائج الشارتات التي تفتقر إلى تصنيف من مصدر حي معتمدة حتى اختبار ملف صادر فعليًا وعرضه ببرنامج PowerPoint.
