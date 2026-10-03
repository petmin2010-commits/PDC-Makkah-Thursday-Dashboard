(() => {
  'use strict';

  const GROUPS = [
    {
      title: 'التقارير التشغيلية',
      subtitle: 'تقارير التنفيذ والمتابعة اليومية',
      items: [
        ['master','تقرير اللوحة الرئيسية العام','⌂'],
        ['projects','تقرير المشاريع العام','⚡'],
        ['connections','تقرير التوصيلات العام','◉'],
        ['permits','تقرير التصاريح العام','▤'],
        ['assets','تقرير الأصول العام','⬡'],
        ['closures','تقرير الإغلاقات العام','✓'],
        ['tasks','تقرير متابعة أعمال المواقع العام','✦'],
        ['emergency','تقرير الطوارئ العام','⚠']
      ]
    },
    {
      title: 'المخالفات والجودة',
      subtitle: 'تقارير الرقابة والتدقيق',
      items: [
        ['safety','تقرير مخالفات السلامة العام','⚠'],
        ['executionViolations','تقرير مخالفات التنفيذ العام','🚫'],
        ['minutes','تقرير محاضر إثبات الحالة العام','▣'],
        ['dataQuality','تقرير جودة البيانات العام','◆']
      ]
    },    {
      title: 'الموارد والتقييم',
      subtitle: 'تقارير الكادر ونتائج التقييم',
      items: [
        ['hrStaff','تقرير الموارد البشرية للكادر العام','👥'],
        ['employeeEvaluation','تقرير تقييم مهندسي المواقع العام','★'],
        ['electricityEngineerEvaluation','تقرير تقييم مهندسي شركة الكهرباء العام','◈']
      ]
    },
    {
      title: 'التقارير الإدارية',
      subtitle: 'التقارير الدورية والاجتماعات',
      items: [
        ['wednesdayMeeting','تقرير اجتماع الـ PDC العام','▥'],
        ['smartThursday','تقرير الخميس الذكي العام','▣'],
        ['importantLinks','تقرير الروابط المهمة العام','🔗']
      ]
    }
  ];

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  function visible(el) {
    if (!el || el.hidden) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function navFor(key) {
    return document.querySelector('.nav-item[data-page="' + key + '"]');
  }  function activeFilterControls() {
    const nodes = [
      ...document.querySelectorAll('#filterBar select, #filterBar input'),
      ...document.querySelectorAll('.page.active select, .page.active input')
    ];
    const search = document.getElementById('globalSearch');
    if (search) nodes.push(search);
    return [...new Set(nodes)].filter(el => {
      if (!el || !visible(el)) return false;
      const type = String(el.type || '').toLowerCase();
      return !['hidden','button','submit','file'].includes(type);
    });
  }

  function snapshotFilters() {
    return activeFilterControls()
      .filter(el => el.id)
      .map(el => ({
        id: el.id,
        value: el.value,
        checked: !!el.checked,
        type: String(el.type || '').toLowerCase()
      }));
  }

  function restoreFilters(snapshot) {
    (snapshot || []).forEach(item => {
      const el = document.getElementById(item.id);
      if (!el) return;
      if (['checkbox','radio'].includes(item.type)) el.checked = item.checked;
      else el.value = item.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }  async function clearAllFilters() {
    const resetButtons = [
      document.getElementById('clearFilters'),
      ...document.querySelectorAll('.page.active .clear-btn, .page.active [id$="Reset"], .page.active [id*="reset"], .page.active [data-action="reset"]')
    ].filter((el, i, arr) => el && arr.indexOf(el) === i && visible(el));

    resetButtons.forEach(btn => {
      try { btn.click(); } catch (_) {}
    });

    await delay(120);

    activeFilterControls().forEach(el => {
      const tag = el.tagName;
      const type = String(el.type || '').toLowerCase();
      if (tag === 'SELECT') {
        const emptyOption = [...el.options].find(o => o.value === '');
        if (emptyOption) el.value = '';
        else el.selectedIndex = 0;
      } else if (['checkbox','radio'].includes(type)) {
        el.checked = false;
      } else {
        el.value = '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await delay(450);
  }

  async function waitForPage(key) {
    for (let i = 0; i < 45; i += 1) {
      const active = navFor(key)?.classList.contains('active');
      const boot = document.getElementById('boot');
      const loading = boot && visible(boot);
      if (active && !loading) return true;
      await delay(140);
    }
    return !!navFor(key)?.classList.contains('active');
  }

  async function exportGeneral(key, button) {
    const target = navFor(key);
    const center = navFor('reportsCenter');
    if (!target) return;

    const preopenedWindow =
      key === 'importantLinks'
        ? window.open('', '_blank')
        : null;
    const previousScopeOverride = window.__VD_REPORT_SCOPE_OVERRIDE;
    window.__VD_REPORT_SCOPE_OVERRIDE = 'General';

    button.disabled = true;
    button.classList.add('is-loading');
    const original = button.textContent;
    button.textContent = 'جاري تجهيز التقرير...';

    target.click();
    await waitForPage(key);
    await delay(180);

    const snapshot = snapshotFilters();
    await clearAllFilters();

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      restoreFilters(snapshot);
      if (previousScopeOverride === undefined) delete window.__VD_REPORT_SCOPE_OVERRIDE;
      else window.__VD_REPORT_SCOPE_OVERRIDE = previousScopeOverride;
      button.disabled = false;
      button.classList.remove('is-loading');
      button.textContent = original;
      setTimeout(() => center?.click(), 80);
    };

    if (key === 'smartThursday') {
      const special = document.getElementById('stpExportReport');
      if (special) {
        special.click();
        setTimeout(finish, 900);
      } else {
        finish();
      }
      return;
    }

    if (key === 'importantLinks' && typeof window.exportImportantLinksReport === 'function') {
      if (!preopenedWindow) {
        alert('يرجى السماح بالنوافذ المنبثقة لتصدير تقرير الروابط.');
        finish();
        return;
      }
      window.exportImportantLinksReport(preopenedWindow);
      setTimeout(finish, 900);
      return;
    }

    const api = window.VDReportExport;
    const exportFn =
      typeof api?.exportCurrentTab === 'function'
        ? api.exportCurrentTab
        : typeof api?.exportCurrent === 'function'
          ? api.exportCurrent
          : typeof api?.showModal === 'function'
            ? api.showModal
            : null;

    if (!exportFn) {
      const originalButton =
        document.querySelector('#vdUnifiedReportAction .vd-tab-report-btn');
      if (originalButton) {
        window.addEventListener('afterprint', finish, { once: true });
        originalButton.click();
        setTimeout(finish, 5000);
        return;
      }

      alert('تعذر تشغيل أداة تصدير التقرير.');
      finish();
      return;
    }

    window.addEventListener('afterprint', finish, { once: true });
    exportFn();
    setTimeout(finish, 5000);
  }

  function renderReportsCenter() {
    const root = document.getElementById('reportsCenterRoot');
    if (!root) return;

    const groups = GROUPS.map(group => {
      const items = group.items.filter(([key]) => navFor(key));
      if (!items.length) return '';
      const cards = items.map(([key, label, icon]) => {
        const tabName = navFor(key)?.querySelector('span')?.textContent?.trim() || label;
        return '<article class="rc-card">' +
          '<div class="rc-card-icon">' + icon + '</div>' +
          '<div class="rc-card-copy"><strong>' + label + '</strong><small>المصدر: تاب ' + tabName + '</small></div>' +
          '<button type="button" class="rc-export-btn" data-report-page="' + key + '">تصدير التقرير PDF</button>' +
        '</article>';
      }).join('');
      return '<section class="rc-group"><div class="rc-group-head"><div><h3>' + group.title + '</h3><p>' + group.subtitle + '</p></div><span>' + items.length + ' تقارير</span></div><div class="rc-grid">' + cards + '</div></section>';
    }).join('');

    const total = GROUPS.reduce((sum, g) => sum + g.items.filter(([key]) => navFor(key)).length, 0);
    root.innerHTML =
      '<div class="rc-hero"><div><span>VISION DIMENSIONS • REPORT CENTER</span><h2>مركز التقارير</h2><p>تجميع موحد لكل تقارير الداشبورد. جميع الأزرار هنا تُنشئ تقريرًا عامًا بدون فلاتر مطبقة.</p></div><div class="rc-total"><b>' + total + '</b><span>تقرير متاح</span></div></div>' +
      groups;

    root.querySelectorAll('[data-report-page]').forEach(btn => {
      btn.addEventListener('click', () => exportGeneral(btn.dataset.reportPage, btn));
    });
  }

  window.renderReportsCenter = renderReportsCenter;
  renderReportsCenter();
})();