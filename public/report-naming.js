(() => {
  'use strict';

  const TYPE_MAP = {
    master: 'Dashboard',
    projects: 'Projects',
    connections: 'Connections',
    permits: 'Permits',
    assets: 'Assets',
    closures: 'Closures',
    tasks: 'SiteFollowUp',
    emergency: 'Emergency',
    safety: 'SafetyViolations',
    executionViolations: 'ExecutionViolations',
    minutes: 'CaseMinutes',
    dataQuality: 'DataQuality',
    hrStaff: 'HR',
    employeeEvaluation: 'SiteEngineerEvaluation',
    electricityEngineerEvaluation: 'SECEngineerEvaluation',
    wednesdayMeeting: 'PDCMeeting',
    smartThursday: 'SmartThursday',
    importantLinks: 'ImportantLinks',
    reportsCenter: 'ReportsCenter'
  };

  const ARABIC_MAP = {
    master: 'تقرير الرئيسية',
    projects: 'تقرير المشاريع',
    connections: 'تقرير التوصيلات',
    permits: 'تقرير التصاريح',
    assets: 'تقرير الأصول',
    closures: 'تقرير الإغلاقات',
    tasks: 'تقرير متابعة أعمال المواقع',
    emergency: 'تقرير الطوارئ',
    safety: 'تقرير مخالفات السلامة',
    executionViolations: 'تقرير مخالفات التنفيذ',
    minutes: 'تقرير محاضر إثبات الحالة',
    dataQuality: 'تقرير جودة البيانات',
    hrStaff: 'تقرير الموارد البشرية للكادر',
    employeeEvaluation: 'تقرير تقييم مهندسي المواقع',
    electricityEngineerEvaluation: 'تقرير تقييم مهندسي شركة الكهرباء',
    wednesdayMeeting: 'تقرير اجتماع الـ PDC',
    smartThursday: 'تقرير الخميس الذكي',
    importantLinks: 'تقرير الروابط المهمة',
    reportsCenter: 'مركز التقارير'
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function timestamp(date = new Date()) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      '_' + pad(date.getHours()) + '-' + pad(date.getMinutes()) + '-' + pad(date.getSeconds());
  }  function city(value = '') {
    const s = String(value || '').toLowerCase();
    if (s.includes('جدة') || s.includes('jeddah')) return 'Jeddah';
    if (s.includes('مكة') || s.includes('makkah') || s.includes('mecca')) return 'Makkah';
    return 'Project';
  }

  function currentCity() {
    const brand = document.querySelector('.brand-copy strong')?.textContent?.trim() || '';
    return city(brand || document.title || location.hostname);
  }

  function pageKey() {
    return document.querySelector('.nav-item.active')?.dataset?.page || '';
  }

  function isVisible(el) {
    if (!el || el.hidden) return false;
    const st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  }

  function meaningfulValue(el) {
    if (!el || !isVisible(el)) return false;
    const type = String(el.type || '').toLowerCase();
    if (['button','submit','hidden','file'].includes(type)) return false;
    if (['checkbox','radio'].includes(type)) return !!el.checked;
    const v = String(el.value || '').trim();
    if (!v) return false;
    return !['all','الكل','جميع البيانات','كامل المدة'].includes(v.toLowerCase());
  }  function hasFilters() {
    if (window.__VD_REPORT_SCOPE_OVERRIDE === 'General') return false;
    if (window.__VD_REPORT_SCOPE_OVERRIDE === 'Filtered') return true;

    const controls = [
      ...document.querySelectorAll('#filterBar select, #filterBar input'),
      ...document.querySelectorAll('#violationPeriodSlicer input'),
      ...document.querySelectorAll('.page.active select, .page.active input'),
      document.getElementById('globalSearch')
    ].filter(Boolean);

    return [...new Set(controls)].some(meaningfulValue);
  }

  function scope(forceScope = '') {
    const forced = forceScope || window.__VD_REPORT_SCOPE_OVERRIDE || '';
    if (forced === 'General' || forced === 'Filtered') return forced;
    return hasFilters() ? 'Filtered' : 'General';
  }

  function reportType(key = pageKey()) {
    return TYPE_MAP[key] || 'Report';
  }

  function arabicTitle(key = pageKey(), forceScope = '') {
    const base = ARABIC_MAP[key] || 'تقرير';
    const reportScope = scope(forceScope || '');
    return base + (reportScope === 'Filtered' ? ' المفلتر' : ' العام');
  }

  function build(options = {}) {
    const reportKey = options.key || pageKey();
    const type = options.type || reportType(reportKey);
    const cityName = options.city ? city(options.city) : currentCity();
    const reportScope = scope(options.scope || '');
    const stamp = timestamp(options.date || new Date());
    return ['VD', cityName, type, reportScope, stamp].join('_');
  }

  window.VDReportNaming = {
    build,
    timestamp,
    city,
    currentCity,
    pageKey,
    reportType,
    arabicTitle,
    scope,
    hasFilters,
    TYPE_MAP,
    ARABIC_MAP
  };
})();