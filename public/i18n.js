(() => {
  'use strict';

  const STORAGE_KEY = 'vd_dashboard_language';
  const PAIRS = [
    ['المتابعة التشغيلية','Operational Monitoring'],
    ['المتابعة الادارية','Administrative Monitoring'],
    ['الرئيسية','Dashboard'],
    ['لوحة المتابعة الرئيسية','Main Dashboard'],
    ['المشاريع','Projects'],
    ['التوصيلات','Connections'],
    ['التصاريح','Permits'],
    ['الأصول','Assets'],
    ['الإغلاقات','Closures'],
    ['متابعة أعمال المواقع','Site Work Follow-up'],
    ['الطوارئ','Emergency'],
    ['مخالفات السلامة','Safety Violations'],
    ['مخالفات التنفيذ','Execution Violations'],
    ['محاضر مخالفة اثبات الحالة','Case Verification Minutes'],
    ['جودة البيانات','Data Quality'],
    ['الموارد البشرية للكادر','Staff HR'],
    ['تقييم مهندسي المواقع','Site Engineers Evaluation'],
    ['تقييم مهندسي شركة الكهرباء','SEC Engineers Evaluation'],
    ['اجتماع الـ PDC','PDC Meeting'],
    ['تقرير الخميس الذكي','Smart Thursday Report'],
    ['مركز التقارير','Report Center'],
    ['الروابط المهمة','Important Links'],
    ['تصدير تقرير اكسيل','Export Excel Report']
  ];  PAIRS.push(
    ['بحث في الصفحة الحالية...','Search current page...'],
    ['بحث','Search'],
    ['طباعة','Print'],
    ['تحديث','Refresh'],
    ['تسجيل الخروج','Sign Out'],
    ['ألوان الواجهة','Interface Colors'],
    ['اختر ستايل فاتح أو غامق','Choose a light or dark style'],
    ['نوع الألوان','Color Mode'],
    ['فاتح','Light'],
    ['غامق','Dark'],
    ['أبيض','White'],
    ['لافندر','Lavender'],
    ['موف','Purple'],
    ['أزرق','Blue'],
    ['سماوي','Sky Blue'],
    ['أخضر','Green'],
    ['نعناعي','Mint'],
    ['برتقالي','Orange'],
    ['ذهبي','Gold'],
    ['وردي','Pink'],
    ['فحمي','Charcoal'],
    ['كحلي','Navy'],
    ['ليلي أزرق','Midnight Blue'],
    ['أخضر داكن','Dark Green'],
    ['موف داكن','Dark Purple'],
    ['خمري داكن','Burgundy'],
    ['يتم حفظ اختيارك تلقائيًا على هذا الجهاز','Your choice is saved automatically on this device']
  );  PAIRS.push(
    ['الإدارة','Department'],
    ['القسم','Section'],
    ['المقاول','Contractor'],
    ['المهندس','Engineer'],
    ['الحالة','Status'],
    ['النوع','Type'],
    ['الدائرة','Circuit'],
    ['الموقع','Location'],
    ['الاستشاري','Consultant'],
    ['اسم الاستشاري','Consultant Name'],
    ['وصف العمل','Work Description'],
    ['تصنيف العمل','Work Classification'],
    ['تاريخ الإسناد','Assignment Date'],
    ['تاريخ مباشرة العمل','Work Start Date'],
    ['تاريخ انتهاء العمل','Work End Date'],
    ['تاريخ آخر إفادة','Last Update Date'],
    ['تاريخ اخر افادة','Last Update Date'],
    ['الإفادة','Update'],
    ['افادة الاستشاري','Consultant Update'],
    ['رقم أمر العمل','Work Order Number'],
    ['رقم امر العمل','Work Order Number'],
    ['أمر العمل','Work Order'],
    ['جهة التنفيذ','Execution Entity'],
    ['نوع العمل','Work Type'],
    ['أيام التأخير','Delay Days'],
    ['جميع البيانات','All Data'],
    ['الكل','All'],
    ['اختر','Select']
  );  PAIRS.push(
    ['إجمالي أوامر العمل','Total Work Orders'],
    ['إجمالي الإشعارات','Total Notifications'],
    ['إجمالي','Total'],
    ['مكتمل','Completed'],
    ['متبقي','Remaining'],
    ['منجز','Completed'],
    ['غير منجز','Not Completed'],
    ['تم التنفيذ','Completed'],
    ['لم يتم التنفيذ','Not Completed'],
    ['موقوف/محول','Stopped / Transferred'],
    ['موقوف / محول','Stopped / Transferred'],
    ['موقوف','Stopped'],
    ['محول','Transferred'],
    ['متوقف','Stopped'],
    ['مستلم 155 للمقاول','Contractor 155 Received'],
    ['غير مستلم 155 للمقاول','Contractor 155 Not Received'],
    ['مستلم 155 المقاول','Contractor 155 Received'],
    ['غير مستلم 155 المقاول','Contractor 155 Not Received'],
    ['تم الاستلام من المقاول','Received from Contractor'],
    ['لم يتم الاستلام من المقاول','Not Received from Contractor'],
    ['لم يستلم من المقاول','Not Received from Contractor'],
    ['قيد مراجعة الاستشاري','Under Consultant Review'],
    ['معاد للمقاول بملاحظات','Returned to Contractor with Comments'],
    ['جاهز للرفع لـPDC','Ready for PDC Upload'],
    ['قيد مراجعة الـPDC','Under PDC Review'],
    ['معاد للاستشاري بملاحظات','Returned to Consultant with Comments'],
    ['تم الاعتماد من PDC','Approved by PDC']
  );  PAIRS.push(
    ['مرحلة الإغلاق','Closure Stage'],
    ['مرحلة الاغلاق','Closure Stage'],
    ['تحت المعالجة','Under Processing'],
    ['ضمن المدة','Within Due Date'],
    ['أوشكت','Near Due Date'],
    ['متأخر عن المدة','Overdue'],
    ['تأخير بسيط','Minor Delay'],
    ['تأخير متوسط','Moderate Delay'],
    ['تأخير عالي','High Delay'],
    ['جديدة','New'],
    ['افادة قديمة','Old Update'],
    ['افادة قديمة جدا','Very Old Update'],
    ['اهمال بالمتابعة','Follow-up Neglect'],
    ['اهمال شديد بالمتابعة','Severe Follow-up Neglect'],
    ['لا يوجد افادة','No Update'],
    ['نعم','Yes'],
    ['لا','No'],
    ['طارئ','Emergency'],
    ['مجدول','Scheduled'],
    ['جاري التنفيذ','In Progress'],
    ['لم يتم البدء','Not Started'],
    ['أرشفة المستندات','Document Archiving'],
    ['نسبة الإنجاز','Completion Rate'],
    ['نسبة الانجاز','Completion Rate'],
    ['طريقة الاحتساب','Calculation Method'],
    ['إغلاق','Close'],
    ['إلغاء','Cancel'],
    ['حفظ','Save'],
    ['تطبيق','Apply'],
    ['مسح','Clear'],
    ['إعادة ضبط','Reset']
  );  PAIRS.push(
    ['فترة التقرير الزمنية','Report Period'],
    ['من تاريخ','From Date'],
    ['إلى تاريخ','To Date'],
    ['كامل المدة','Full Period'],
    ['آخر أسبوع','Last Week'],
    ['الأسبوع الحالي','Current Week'],
    ['الأساس: تاريخ الإسناد','Basis: Assignment Date'],
    ['التقارير التشغيلية','Operational Reports'],
    ['المخالفات والجودة','Violations & Quality'],
    ['الموارد والتقييم','HR & Evaluation'],
    ['التقارير الإدارية','Administrative Reports'],
    ['تقرير المشاريع العام','General Projects Report'],
    ['تقرير التوصيلات العام','General Connections Report'],
    ['تقرير التصاريح العام','General Permits Report'],
    ['تقرير الأصول العام','General Assets Report'],
    ['تقرير الإغلاقات العام','General Closures Report'],
    ['تقرير الطوارئ العام','General Emergency Report'],
    ['تقرير مخالفات السلامة العام','General Safety Violations Report'],
    ['تقرير مخالفات التنفيذ العام','General Execution Violations Report'],
    ['تقرير جودة البيانات العام','General Data Quality Report'],
    ['تقرير الروابط المهمة العام','General Important Links Report'],
    ['تصدير التقرير PDF','Export PDF Report'],
    ['تصدير تقرير الروابط PDF','Export Links PDF Report'],
    ['اضغط هنا','Click Here'],
    ['امسح للوصول','Scan to Open']
  );  PAIRS.push(
    ['شركة أبعاد الرؤية للاستشارات الهندسية','Vision Dimensions Engineering Consultancy'],
    ['إدارة كهرباء مكة','Makkah Electricity Department'],
    ['إدارة كهرباء جدة','Jeddah Electricity Department'],
    ['مكة','Makkah'],
    ['جدة','Jeddah'],
    ['عدد السجلات','Records'],
    ['عدد النتائج','Results'],
    ['السجلات','Records'],
    ['النتائج','Results'],
    ['العدد','Count'],
    ['النسبة','Percentage'],
    ['التصنيف','Category'],
    ['الصفحة','Page'],
    ['صفحة','Page'],
    ['من الإجمالي','of Total'],
    ['من إجمالي الأوامر','of Total Orders'],
    ['غير محدد','Unspecified'],
    ['لا توجد بيانات','No Data'],
    ['جاري التحميل...','Loading...'],
    ['جاري تحميل البيانات...','Loading data...'],
    ['تعذر تحميل البيانات','Failed to load data'],
    ['آخر تحديث','Last Update'],
    ['اليوم','Today'],
    ['هذا الأسبوع','This Week'],
    ['هذا الشهر','This Month']
  );  PAIRS.push(
    ['تقرير مخالفات التنفيذ','Execution Violations Report'],
    ['تقرير مخالفات السلامة','Safety Violations Report'],
    ['إجمالي المخالفات','Total Violations'],
    ['أوامر العمل الفريدة','Unique Work Orders'],
    ['المقاولون','Contractors'],
    ['أنواع أوامر العمل','Work Order Types'],
    ['إجمالي الغرامات','Total Penalties'],
    ['أوامر متكررة المخالفات','Repeated Violation Orders'],
    ['أكثر من سجل','More than One Record'],
    ['حسب النطاق الحالي','Within Current Scope'],
    ['المؤشرات التنفيذية الرئيسية','Executive KPIs'],
    ['ملخصات التصنيف','Classification Summaries'],
    ['أعلى المقاولين بالمخالفات','Top Contractors by Violations'],
    ['أكثر أنواع المخالفات تكرارًا','Most Frequent Violation Types'],
    ['أوامر العمل الأكثر تكرارًا','Most Repeated Work Orders'],
    ['التحليلات الرسومية','Visual Analytics'],
    ['الشارتات تعكس نفس الفلاتر المطبقة على التقرير','Charts reflect the same report filters'],
    ['قائمة المخالفات حسب الفلاتر','Violations List by Filters'],
    ['السجل التفصيلي للمخالفات','Detailed Violations Register'],
    ['فتح المخالفة','Open Violation'],
    ['نطاق التقرير والفلاتر','Report Scope & Filters'],
    ['رقم التقرير','Report ID'],
    ['تاريخ الإنشاء','Generated At'],
    ['تقرير آلي من لوحة المخالفات','Automated Dashboard Report']
  );

  PAIRS.push(
    ['إجمالي السجلات','Total Records'],
    ['المغلق الموثق*','Documented Closed'],
    ['أوامر متكررة','Repeated Orders'],
    ['أعلى مقاول','Top Contractor'],
    ['أعلى أمر عمل','Top Work Order'],
    ['فجوات البيانات','Data Gaps'],
    ['التغير عن الأسبوع السابق','Change vs Previous Week'],
    ['ماذا تغيّر منذ الخميس الماضي؟','What Changed Since Last Thursday?'],
    ['أوامر جديدة','New Orders'],
    ['بدون تحديث جديد','No New Update'],
    ['تغير فجوات البيانات','Data Gap Change'],
    ['تفاصيل الأسبوع','Weekly Details'],
    ['المصدر','Source'],
    ['التاريخ','Date'],
    ['المخالفة/المحضر','Violation / Minute'],
    ['الغرامة','Penalty'],
    ['ملاحظات الاحتساب','Calculation Notes'],
    ['الفترة','Period'],
    ['مقارنة بـ','Compared with'],
    ['إصدار','Generated'],
    ['السابق','Previous'],
    ['الحالي','Current'],
    ['التغير','Change']
  );

  PAIRS.push(
    ['تقارير التنفيذ والمتابعة اليومية','Daily Execution & Follow-up Reports'],
    ['تقارير الرقابة والتدقيق','Control & Audit Reports'],
    ['تقارير الكادر ونتائج التقييم','Staff & Evaluation Reports'],
    ['التقارير الدورية والاجتماعات','Periodic & Meeting Reports'],
    ['تقرير اللوحة الرئيسية العام','General Dashboard Report'],
    ['تقرير متابعة أعمال المواقع العام','General Site Work Follow-up Report'],
    ['تقرير محاضر إثبات الحالة العام','General Case Verification Minutes Report'],
    ['تقرير الموارد البشرية للكادر العام','General Staff HR Report'],
    ['تقرير تقييم مهندسي المواقع العام','General Site Engineers Evaluation Report'],
    ['تقرير تقييم مهندسي شركة الكهرباء العام','General SEC Engineers Evaluation Report'],
    ['تقرير اجتماع الـ PDC العام','General PDC Meeting Report'],
    ['تقرير الخميس الذكي العام','General Smart Thursday Report'],
    ['تقرير الطوارئ العام','General Emergency Report'],
    ['الروابط الأساسية','Core Links'],
    ['السلامة والأرشفة','Safety & Archive'],
    ['دورات التأهيل','Qualification Courses'],
    ['دليل الإشراف','Supervision Guide'],
    ['بوت نظام الإشراف','Supervision System Bot'],
    ['نظام شيت المشروع','Project Sheet System'],
    ['دليل البوت','Bot Guide'],
    ['رابط فورم السلامة','Safety Form Link'],
    ['رابط نظام السلامة','Safety System Link'],
    ['رابط الأرشفة للمشروع','Project Archive Link'],
    ['اضغط هنا لفتح الرابط','Click Here to Open Link'],
    ['لا توجد روابط مطابقة لبحثك.','No links match your search.'],
    ['إجمالي الروابط','Total Links'],
    ['تاريخ إصدار التقرير','Report Date'],
    ['رقم العقد','Contract No.'],
    ['رابط','Link'],
    ['روابط','Links'],
    ['المصدر: تاب','Source Tab:'],
    ['تقرير متاح','Available Report'],
    ['تقارير','Reports'],
    ['تجميع موحد لكل تقارير الداشبورد. جميع الأزرار هنا تُنشئ تقريرًا عامًا بدون فلاتر مطبقة.','Unified access to all dashboard reports. Every button here generates a general report with no filters applied.']
  );

  const AR_EN = new Map(PAIRS);
  const EN_AR = new Map();
  PAIRS.forEach(([ar,en]) => {
    if (!EN_AR.has(en)) EN_AR.set(en, ar);
  });

  const arKeys = [...AR_EN.keys()].sort((a,b) => b.length - a.length);
  const enKeys = [...EN_AR.keys()].sort((a,b) => b.length - a.length);
  const originalText = new WeakMap();
  const originalAttrs = new WeakMap();
  let language = localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar';
  let queued = false;

  function hasArabic(value) {
    return /[\u0600-\u06FF]/.test(String(value || ''));
  }

  function translateString(value, lang = language, allowPhrase = true) {
    const raw = String(value ?? '');
    const trimmed = raw.trim();
    if (!trimmed) return raw;

    const direct = lang === 'en' ? AR_EN.get(trimmed) : EN_AR.get(trimmed);
    if (direct) return raw.replace(trimmed, direct);
    if (!allowPhrase) return raw;

    let out = raw;
    const keys = lang === 'en' ? arKeys : enKeys;
    const dict = lang === 'en' ? AR_EN : EN_AR;    for (const key of keys) {
      if (out.includes(key)) out = out.split(key).join(dict.get(key));
    }
    return out;
  }

  function isFreeTextContext(node) {
    const el = node.parentElement;
    return !!el?.closest(
      'textarea,pre,code,.notes,.note-text,.feedback,.engineer-note,' +
      '.consultant-note,.statement,.raw-text,.free-text,td'
    );
  }

  function translateTextNode(node, lang) {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const current = node.nodeValue || '';
    if (!current.trim()) return;

    if (lang === 'ar') {
      const original = originalText.get(node);
      if (original !== undefined) node.nodeValue = original;
      return;
    }

    if (hasArabic(current)) originalText.set(node, current);
    const source = hasArabic(current) ? current : (originalText.get(node) ?? current);
    const translated = translateString(source, 'en', !isFreeTextContext(node));
    if (translated !== current) node.nodeValue = translated;
  }

  function attrStore(el) {
    let store = originalAttrs.get(el);
    if (!store) {
      store = new Map();
      originalAttrs.set(el, store);
    }
    return store;
  }  function translateAttributes(el, lang) {
    const attrs = ['placeholder','title','aria-label','data-empty-text'];
    const store = attrStore(el);

    attrs.forEach(name => {
      if (!el.hasAttribute?.(name)) return;
      const current = el.getAttribute(name) || '';

      if (lang === 'ar') {
        if (store.has(name)) el.setAttribute(name, store.get(name));
        return;
      }

      if (hasArabic(current)) store.set(name, current);
      const source = hasArabic(current) ? current : (store.get(name) ?? current);
      const translated = translateString(source, 'en', true);
      if (translated !== current) el.setAttribute(name, translated);
    });
  }

  function walk(root, lang = language) {
    const base = root?.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
    if (!base) return;

    if (base.nodeType === Node.ELEMENT_NODE) translateAttributes(base, lang);
    const doc = base.ownerDocument || (root.nodeType === Node.DOCUMENT_NODE ? root : document);
    const walker = doc.createTreeWalker(base, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

    let node = walker.currentNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, lang);
      else if (node.nodeType === Node.ELEMENT_NODE) translateAttributes(node, lang);
      node = walker.nextNode();
    }
  }  function translateChart(chart, lang) {
    if (!chart) return;
    try {
      const data = chart.data || chart.config?.data;
      if (Array.isArray(data?.labels)) {
        data.labels = data.labels.map(v =>
          typeof v === 'string' ? translateString(v, lang, true) : v
        );
      }

      (data?.datasets || []).forEach(ds => {
        if (typeof ds.label === 'string') ds.label = translateString(ds.label, lang, true);
      });

      const options = chart.options || chart.config?.options || {};
      const titleNodes = [
        options.plugins?.title,
        options.plugins?.subtitle
      ];

      titleNodes.forEach(x => {
        if (typeof x?.text === 'string') x.text = translateString(x.text, lang, true);
      });

      Object.values(options.scales || {}).forEach(scale => {
        if (typeof scale?.title?.text === 'string') {
          scale.title.text = translateString(scale.title.text, lang, true);
        }
      });

      chart.update?.('none');
    } catch (_) {}
  }

  function translateCharts(lang = language) {
    const ChartCtor = window.Chart;
    if (!ChartCtor?.instances) return;
    Object.values(ChartCtor.instances).forEach(chart => translateChart(chart, lang));
  }  function applyDirection(doc = document, lang = language) {
    const html = doc.documentElement;
    if (!html) return;
    html.lang = lang === 'en' ? 'en' : 'ar';
    html.dir = lang === 'en' ? 'ltr' : 'rtl';
    doc.body?.classList.toggle('vd-lang-en', lang === 'en');
    doc.body?.classList.toggle('vd-lang-ar', lang !== 'en');
  }

  function updateControl() {
    const button = document.getElementById('vdLanguageButton');
    const label = document.getElementById('vdLanguageLabel');
    if (button) button.setAttribute('aria-label', language === 'en' ? 'Change language' : 'تغيير اللغة');
    if (label) label.textContent = language === 'en' ? 'English' : 'العربية';

    document.querySelectorAll('[data-vd-lang]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vdLang === language);
      btn.setAttribute('aria-pressed', btn.dataset.vdLang === language ? 'true' : 'false');
    });
  }

  function applyLanguage(lang, persist = true) {
    language = lang === 'en' ? 'en' : 'ar';
    if (persist) localStorage.setItem(STORAGE_KEY, language);

    applyDirection(document, language);
    walk(document, language);
    translateCharts(language);
    updateControl();

    window.dispatchEvent(new CustomEvent('vd:languagechange', {
      detail: { language }
    }));
  }  function injectStyles() {
    if (document.getElementById('vdI18nStyles')) return;
    const style = document.createElement('style');
    style.id = 'vdI18nStyles';
    style.textContent =
      '.vd-language-wrap{position:relative;display:inline-flex;align-items:center}' +
      '.vd-language-button{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:8px 11px;border:1px solid rgba(111,126,150,.22);border-radius:12px;background:var(--card,#fff);color:inherit;font:inherit;font-size:10px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(27,47,68,.06)}' +
      '.vd-language-button:hover{transform:translateY(-1px);box-shadow:0 7px 16px rgba(27,47,68,.10)}' +
      '.vd-language-menu{position:absolute;z-index:10050;top:calc(100% + 7px);inset-inline-end:0;min-width:142px;padding:6px;border:1px solid rgba(111,126,150,.20);border-radius:13px;background:var(--card,#fff);box-shadow:0 14px 34px rgba(24,42,62,.18)}' +
      '.vd-language-menu[hidden]{display:none!important}.vd-language-menu button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border:0;border-radius:9px;background:transparent;color:inherit;font:inherit;font-size:10px;font-weight:750;cursor:pointer}' +
      '.vd-language-menu button:hover,.vd-language-menu button.active{background:rgba(86,74,190,.10);color:#5142ad}' +
      'html[dir="ltr"] .nav-item,html[dir="ltr"] .nav-section-label,html[dir="ltr"] th,html[dir="ltr"] td{text-align:left}' +
      'html[dir="ltr"] .kpi-story-card,html[dir="ltr"] .master-card,html[dir="ltr"] .filter-field{text-align:left}' +
      'html[dir="ltr"] input,html[dir="ltr"] select,html[dir="ltr"] textarea{direction:ltr;text-align:left}';
    document.head.appendChild(style);
  }

  function injectControl() {
    if (document.getElementById('vdLanguageWrap')) return;
    const host = document.querySelector('.top-actions');
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.id = 'vdLanguageWrap';
    wrap.className = 'vd-language-wrap';
    wrap.innerHTML =
      '<button id="vdLanguageButton" class="vd-language-button" type="button" aria-haspopup="menu" aria-expanded="false">' +
      '<span aria-hidden="true">🌐</span><span id="vdLanguageLabel">العربية</span><span aria-hidden="true">⌄</span></button>' +
      '<div id="vdLanguageMenu" class="vd-language-menu" role="menu" hidden>' +
      '<button type="button" data-vd-lang="ar" role="menuitem">العربية <span>AR</span></button>' +
      '<button type="button" data-vd-lang="en" role="menuitem">English <span>EN</span></button></div>';

    host.appendChild(wrap);    const button = wrap.querySelector('#vdLanguageButton');
    const menu = wrap.querySelector('#vdLanguageMenu');

    button.addEventListener('click', ev => {
      ev.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    menu.addEventListener('click', ev => {
      const item = ev.target.closest('[data-vd-lang]');
      if (!item) return;
      applyLanguage(item.dataset.vdLang, true);
      menu.hidden = true;
      button.setAttribute('aria-expanded','false');
    });

    document.addEventListener('click', ev => {
      if (wrap.contains(ev.target)) return;
      menu.hidden = true;
      button.setAttribute('aria-expanded','false');
    });
  }

  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      walk(document, language);
      if (language === 'en') translateCharts('en');
    });
  });  function translateRoot(root, lang = language) {
    if (!root) return;
    const doc = root.nodeType === Node.DOCUMENT_NODE ? root : root.ownerDocument;
    if (doc) applyDirection(doc, lang);
    walk(root, lang);
  }

  function boot() {
    injectStyles();
    injectControl();
    applyLanguage(language, false);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder','title','aria-label']
    });

    setInterval(() => {
      if (language === 'en') translateCharts('en');
    }, 1600);
  }

  window.VDI18n = {
    setLanguage: lang => applyLanguage(lang, true),
    getLanguage: () => language,
    t: (value, lang = language) => translateString(value, lang, true),
    translateRoot,
    translateCharts: () => translateCharts(language),
    dictionary: AR_EN
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();