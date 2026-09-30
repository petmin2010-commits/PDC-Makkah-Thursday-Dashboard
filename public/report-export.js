(() => {
  'use strict';

  const REPORT_ID = 'vdReportV2';
  const MODAL_ID = 'vdReportExportModal';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getActivePageKey() {
    return document.querySelector('.nav-item.active')?.dataset?.page || '';
  }

  function getActivePage() {
    const key = getActivePageKey();

    if (key === 'master') return document.getElementById('masterPage');
    if (key === 'wednesdayMeeting') return document.getElementById('meetingPage');
    if (key) return document.getElementById('dataPage');

    return [...document.querySelectorAll('.page')]
      .find(page => isDisplayedWithin(page, document.body))
      || document.querySelector('.page.active');
  }

  function getActivePageName() {
    const nav = document.querySelector('.nav-item.active');

    return nav?.querySelector('span')?.textContent?.trim()
      || document.getElementById('pageTitle')?.textContent?.trim()
      || 'تقرير الداشبورد';
  }

  function getBrandInfo() {
    const box = document.querySelector('.brand-copy');
    const project = box?.querySelector('b')?.textContent?.trim()
      || 'العقد الموحد للإشراف على خدمات شبكات الطاقة';
    const city = box?.querySelector('strong')?.textContent?.trim()
      || document.title
      || 'إدارة الكهرباء';
    const contractText = box?.querySelector('em')?.textContent?.trim()
      || '';
    const contract = contractText.replace(/^رقم العقد\s*:\s*/,'').trim();
    return { project, city, contract, contractText };
  }

  function isDisplayedWithin(el, boundary = document.body) {
    if (!el) return false;

    let node = el;

    while (node) {
      if (node.hidden) return false;
      if (node.getAttribute?.('aria-hidden') === 'true') return false;

      const style = window.getComputedStyle(node);

      if (
        style.display === 'none' ||
        style.visibility === 'hidden'
      ) {
        return false;
      }

      if (node === boundary) break;
      node = node.parentElement;
    }

    return true;
  }

  function getAppliedFilters() {
    const result = [];
    const seen = new Set();
    const source = getActivePage();

    const addSelect = (select, label, boundary) => {
      if (!select || !select.value) return;
      if (!isDisplayedWithin(select, boundary || document.body)) return;

      const id =
        select.id || select.name || label || select.value;

      if (seen.has(id)) return;
      seen.add(id);

      const value =
        select.options?.[select.selectedIndex]?.textContent?.trim()
        || select.value;

      result.push({
        label: label || 'فلتر',
        value
      });
    };

    document.querySelectorAll('#filterBar .filter').forEach(box => {
      if (!isDisplayedWithin(box, document.body)) return;

      addSelect(
        box.querySelector('select'),
        box.querySelector('label')?.textContent?.trim(),
        document.body
      );
    });

    if (source) {
      source.querySelectorAll('select').forEach(select => {
        const box =
          select.closest('.filter,.meeting-filter,.wm-filter,.toolbar-field,.field');

        const label =
          box?.querySelector('label')?.textContent?.trim()
          || select.getAttribute('aria-label')
          || select.name
          || 'فلتر';

        addSelect(select, label, source);
      });
    }

    return result;
  }

  function isVisible(el) {
    const page = getActivePage();
    return isDisplayedWithin(el, page || document.body);
  }

  function cleanupClone(root) {
    if (!root) return;

    root.querySelectorAll(
      [
        'button',
        '.meeting-info-btn',
        '.emergency-help-btn',
        '.info-btn',
        '.help-btn',
        '.tooltip',
        '.toast'
      ].join(',')
    ).forEach(el => el.remove());

    root.querySelectorAll('input,select,textarea').forEach(el => {
      const value =
        el.options?.[el.selectedIndex]?.textContent
        || el.value
        || '';

      const span = document.createElement('span');
      span.textContent = value;
      span.className = 'vd-report-static-value';

      el.replaceWith(span);
    });
  }

  function pruneHiddenClone(source, clone) {
    const sourceNodes =
      [source, ...source.querySelectorAll('*')];

    const cloneNodes =
      [clone, ...clone.querySelectorAll('*')];

    for (
      let i = sourceNodes.length - 1;
      i > 0;
      i -= 1
    ) {
      const sourceNode = sourceNodes[i];
      const cloneNode = cloneNodes[i];

      if (!cloneNode?.parentNode) continue;

      if (!isDisplayedWithin(sourceNode, source)) {
        cloneNode.remove();
      }
    }
  }

  function cloneWithCanvases(source) {
    const clone = source.cloneNode(true);

    const sourceCanvases = [...source.querySelectorAll('canvas')];
    const cloneCanvases = [...clone.querySelectorAll('canvas')];

    sourceCanvases.forEach((canvas, index) => {
      const clonedCanvas = cloneCanvases[index];

      if (!clonedCanvas) return;

      if (!isDisplayedWithin(canvas, source)) {
        clonedCanvas.remove();
        return;
      }

      try {
        const img = document.createElement('img');

        img.className = 'vd-report-chart-image';
        img.alt = 'Chart';
        img.src = canvas.toDataURL('image/png', 1);

        clonedCanvas.replaceWith(img);
      } catch (_) {
        clonedCanvas.remove();
      }
    });

    pruneHiddenClone(source, clone);
    cleanupClone(clone);

    return clone;
  }

  function findKpis(page) {
    const selector = [
      '.emergency-mini-kpi',
      '.master-kpi',
      '.kpi-card',
      '.kpi',
      '.mini-kpi',
      '.metric-card',
      '.stat-card'
    ].join(',');

    const elements = [...page.querySelectorAll(selector)]
      .filter(isVisible);

    /*
      منع أخذ container و card داخله في نفس الوقت.
    */
    return elements.filter(el => {
      return !el.querySelector(selector);
    });
  }

  function getPanels(page) {
    const panels = [...page.querySelectorAll('.panel, article.panel')]
      .filter(isVisible);

    return panels.filter(panel => {
      const parentPanel = panel.parentElement?.closest('.panel');
      return !parentPanel;
    });
  }

  function isDetailedDataPanel(panel) {
    if (!panel) return false;

    if (panel.querySelector('#dataTable')) return true;
    if (panel.id === 'dataTable') return true;

    const text = panel.textContent || '';

    return (
      text.includes('البيانات التفصيلية') ||
      text.includes('البيانات التفصيليه')
    );
  }

  function isTreePanel(panel) {
    if (!panel) return false;

    const marker = [
      panel.id || '',
      panel.className || '',
      panel.textContent?.slice(0, 250) || ''
    ].join(' ').toLowerCase();

    return (
      marker.includes('tree') ||
      marker.includes('شجرة') ||
      marker.includes('تشجير')
    );
  }

  function isChartPanel(panel) {
    return !!panel?.querySelector('canvas');
  }

  function isTablePanel(panel) {
    return !!panel?.querySelector('table, .table-wrap');
  }

  function chunk(array, size) {
    const output = [];

    for (let i = 0; i < array.length; i += size) {
      output.push(array.slice(i, i + size));
    }

    return output;
  }

  function createPage(title, subtitle, extraClass = '') {
    const section = document.createElement('section');

    section.className =
      `vd-report-v2-page ${extraClass}`.trim();

    section.innerHTML = `
      <header class="vd-report-section-header">
        <div>
          <span>VISION DIMENSIONS</span>
          <h2>${escapeHtml(title)}</h2>
        </div>

        ${
          subtitle
            ? `<p>${escapeHtml(subtitle)}</p>`
            : ''
        }
      </header>

      <div class="vd-report-section-body"></div>

      <footer class="vd-report-footer">
        <span>Vision Dimensions</span>
        <span>شركة أبعاد الرؤية للاستشارات الهندسية</span>
        <span>${escapeHtml(getBrandInfo().contractText || '')}</span>
      </footer>
    `;

    return section;
  }

  function buildCover(report, reportType, kpis) {
    const filters = getAppliedFilters();
    const brand = getBrandInfo();
    const now = new Date();

    const cover = document.createElement('section');

    cover.className =
      'vd-report-v2-page vd-report-cover';

    const coverKpis = kpis.slice(0, 6);

    cover.innerHTML = `
      <div class="vd-report-cover-top">

        <div class="vd-report-cover-brand">
          <img
            src="/company-logo.png"
            alt="Vision Dimensions"
          >

          <div>
            <strong>
              شركة أبعاد الرؤية للاستشارات الهندسية
            </strong>

            <span>
              VISION DIMENSIONS ENGINEERING CONSULTANCY
            </span>
          </div>
        </div>

        <div class="vd-report-cover-badge">
          ${
            reportType === 'full'
              ? 'تقرير كامل'
              : 'تقرير تنفيذي'
          }
        </div>

      </div>

      <div class="vd-report-cover-title">

        <small>
          ${escapeHtml(brand.project)}
        </small>

        <h1>
          ${escapeHtml(getActivePageName())}
        </h1>

        <p>
          ${escapeHtml(brand.city)}
        </p>

        <strong>
          ${escapeHtml(brand.contractText || '')}
        </strong>

      </div>

      <div class="vd-report-cover-meta">

        <div>
          <span>تاريخ التقرير</span>
          <b>
            ${now.toLocaleDateString('ar-SA')}
          </b>
        </div>

        <div>
          <span>وقت الإصدار</span>
          <b>
            ${
              now.toLocaleTimeString(
                'ar-SA',
                {
                  hour: '2-digit',
                  minute: '2-digit'
                }
              )
            }
          </b>
        </div>

        <div>
          <span>الفلاتر</span>
          <b>
            ${
              filters.length
                ? filters.length + ' فلتر مطبق'
                : 'جميع البيانات'
            }
          </b>
        </div>

      </div>

      <div class="vd-report-cover-kpis"></div>

      ${
        filters.length
          ? `
            <div class="vd-report-cover-filters">
              <strong>الفلاتر المطبقة</strong>

              <div>
                ${
                  filters.map(filter => `
                    <span>
                      ${escapeHtml(filter.label)}:
                      <b>${escapeHtml(filter.value)}</b>
                    </span>
                  `).join('')
                }
              </div>
            </div>
          `
          : ''
      }

      <div class="vd-report-cover-footer">
        VISION DIMENSIONS
      </div>
    `;

    const grid =
      cover.querySelector('.vd-report-cover-kpis');

    coverKpis.forEach(kpi => {
      const cloned = kpi.cloneNode(true);

      cleanupClone(cloned);

      cloned.classList.add('vd-report-kpi-clone');

      grid.appendChild(cloned);
    });

    report.appendChild(cover);
  }

  function buildKpiPages(report, kpis) {
    if (!kpis.length) return;

    const groups = chunk(kpis, 24);

    groups.forEach((group, index) => {
      const page = createPage(
        'المؤشرات الرئيسية',
        groups.length > 1
          ? `المجموعة ${index + 1} من ${groups.length}`
          : 'ملخص مؤشرات الأداء',
        'vd-report-kpi-page'
      );

      const body =
        page.querySelector('.vd-report-section-body');

      const grid = document.createElement('div');

      grid.className = 'vd-report-kpi-grid';

      group.forEach(kpi => {
        const cloned = kpi.cloneNode(true);

        cleanupClone(cloned);

        cloned.classList.add('vd-report-kpi-clone');

        grid.appendChild(cloned);
      });

      body.appendChild(grid);
      report.appendChild(page);
    });
  }

  function fitTreeClone(sourcePanel, clonedPanel, wrapper) {
    const rect = sourcePanel.getBoundingClientRect();

    const width = Math.max(
      1,
      Math.ceil(sourcePanel.scrollWidth || 0),
      Math.ceil(rect.width || 0)
    );

    const height = Math.max(
      1,
      Math.ceil(sourcePanel.scrollHeight || 0),
      Math.ceil(rect.height || 0)
    );

    const maxWidth = 1000;
    const maxHeight = 575;

    const scale = Math.min(
      1,
      maxWidth / width,
      maxHeight / height
    );

    clonedPanel.classList.add('vd-report-tree-fit');
    clonedPanel.style.width = width + 'px';
    clonedPanel.style.maxWidth = 'none';
    clonedPanel.style.transformOrigin = 'top center';
    clonedPanel.style.transform =
      'scale(' + scale + ')';

    wrapper.style.height =
      (Math.ceil(height * scale) + 8) + 'px';

    wrapper.style.minHeight = '0';
    wrapper.style.overflow = 'hidden';
    wrapper.dataset.treeScale = scale.toFixed(3);
  }

  function buildTreePages(report, trees) {
    trees.forEach((panel, index) => {
      const title =
        panel.querySelector('h1,h2,h3,.panel-title')
          ?.textContent?.trim()
        || `تحليل تشجيري ${index + 1}`;

      const page = createPage(
        title,
        'العلاقات والتوزيع التشجيري',
        'vd-report-tree-page'
      );

      const body =
        page.querySelector('.vd-report-section-body');

      const wrapper = document.createElement('div');

      wrapper.className = 'vd-report-tree-wrapper';

      const marker =
        `${panel.id} ${panel.textContent}`.toLowerCase();

      if (
        marker.includes('status tree') ||
        marker.includes('حالة التنفيذ')
      ) {
        wrapper.classList.add(
          'vd-report-tree-wrapper-large'
        );
      }

      const clonedTree =
        cloneWithCanvases(panel);

      wrapper.appendChild(clonedTree);
      fitTreeClone(panel, clonedTree, wrapper);

      body.appendChild(wrapper);
      report.appendChild(page);
    });
  }

  function buildChartPages(report, charts) {
    if (!charts.length) return;

    const groups = chunk(charts, 4);

    groups.forEach((group, index) => {
      const page = createPage(
        'التحليلات والرسوم البيانية',
        groups.length > 1
          ? `صفحة التحليلات ${index + 1}`
          : 'التحليلات المرئية',
        'vd-report-chart-page'
      );

      const body =
        page.querySelector('.vd-report-section-body');

      const grid = document.createElement('div');

      grid.className = 'vd-report-chart-grid';

      group.forEach(panel => {
        const cloned =
          cloneWithCanvases(panel);

        cloned.classList.add(
          'vd-report-chart-card'
        );

        grid.appendChild(cloned);
      });

      body.appendChild(grid);
      report.appendChild(page);
    });
  }

  function buildTablePages(
    report,
    tables,
    includeDetails
  ) {
    tables.forEach(panel => {
      const detailed =
        isDetailedDataPanel(panel);

      if (detailed && !includeDetails) return;

      const title =
        panel.querySelector('h1,h2,h3,.panel-title')
          ?.textContent?.trim()
        || (
          detailed
            ? 'ملحق البيانات التفصيلية'
            : 'جدول ملخص'
        );

      const page = createPage(
        title,
        detailed
          ? 'البيانات التفصيلية الكاملة'
          : 'ملخص البيانات',
        detailed
          ? 'vd-report-detail-page'
          : 'vd-report-table-page'
      );

      const body =
        page.querySelector('.vd-report-section-body');

      const cloned =
        cloneWithCanvases(panel);

      cloned.classList.add(
        detailed
          ? 'vd-report-detail-panel'
          : 'vd-report-summary-table'
      );

      body.appendChild(cloned);
      report.appendChild(page);
    });
  }

  function buildMiscPages(report, panels) {
    if (!panels.length) return;

    chunk(panels, 2).forEach(group => {
      const page = createPage(
        'تفاصيل إضافية',
        'معلومات داعمة للتقرير',
        'vd-report-misc-page'
      );

      const body =
        page.querySelector('.vd-report-section-body');

      group.forEach(panel => {
        body.appendChild(
          cloneWithCanvases(panel)
        );
      });

      report.appendChild(page);
    });
  }

  function buildReport(type = 'executive') {
    const source = getActivePage();

    if (!source) {
      alert('لم يتم العثور على التاب الحالي.');
      return null;
    }

    document.getElementById(REPORT_ID)?.remove();

    const report =
      document.createElement('main');

    report.id = REPORT_ID;
    report.className = 'vd-report-v2';

    const kpis = findKpis(source);
    const panels = getPanels(source);

    const trees = [];
    const charts = [];
    const tables = [];
    const misc = [];

    panels.forEach(panel => {
      if (isChartPanel(panel)) {
        charts.push(panel);
        return;
      }

      if (isTreePanel(panel)) {
        trees.push(panel);
        return;
      }

      if (isTablePanel(panel)) {
        tables.push(panel);
        return;
      }

      const containsKpi =
        panel.querySelector(
          [
            '.emergency-mini-kpi',
            '.master-kpi',
            '.kpi-card',
            '.kpi',
            '.mini-kpi',
            '.metric-card',
            '.stat-card'
          ].join(',')
        );

      if (!containsKpi) {
        misc.push(panel);
      }
    });

    buildCover(report, type, kpis);
    buildKpiPages(report, kpis);
    buildTreePages(report, trees);
    buildChartPages(report, charts);

    buildTablePages(
      report,
      tables,
      type === 'full'
    );

    buildMiscPages(report, misc);

    document.body.appendChild(report);

    return report;
  }

  function cleanupReport() {
    document.body.classList.remove(
      'vd-report-v2-mode'
    );

    document.getElementById(REPORT_ID)?.remove();
  }

  function printReport(type) {
    closeModal();

    const report = buildReport(type);

    if (!report) return;

    const oldTitle = document.title;

    document.title =
      `Vision Dimensions - ${getActivePageName()}`;

    document.body.classList.add(
      'vd-report-v2-mode'
    );

    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;

      cleaned = true;

      document.title = oldTitle;

      cleanupReport();
    };

    window.addEventListener(
      'afterprint',
      cleanup,
      { once: true }
    );

    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 350);
    });

    /*
      احتياط في حالة متصفح لا يرسل afterprint.
    */
    setTimeout(() => {
      if (
        !document.body.classList.contains(
          'vd-report-v2-mode'
        )
      ) return;

      cleanup();
    }, 120000);
  }

  function closeModal() {
    document
      .getElementById(MODAL_ID)
      ?.classList.remove('open');
  }

  function showModal() {
    let modal =
      document.getElementById(MODAL_ID);

    if (!modal) {
      modal = document.createElement('div');

      modal.id = MODAL_ID;
      modal.className = 'vd-report-export-modal';

      modal.innerHTML = `
        <div class="vd-report-export-dialog">

          <button
            type="button"
            class="vd-report-export-close"
            aria-label="إغلاق"
          >
            ×
          </button>

          <div class="vd-report-export-icon">
            📄
          </div>

          <h2>تصدير تقرير</h2>

          <p>
            اختر نوع التقرير المطلوب للتاب الحالي
          </p>

          <div class="vd-report-export-options">

            <button
              type="button"
              data-report-type="executive"
              class="vd-report-option primary"
            >
              <strong>تقرير تنفيذي</strong>
              <span>
                المؤشرات والأشجار والشارتات
                والجداول الملخصة
              </span>
            </button>

            <button
              type="button"
              data-report-type="full"
              class="vd-report-option"
            >
              <strong>تقرير كامل</strong>
              <span>
                يشمل أيضًا ملحق البيانات التفصيلية
              </span>
            </button>

          </div>

          <div class="vd-report-print-note">
            عند ظهور نافذة الطباعة:
            ألغِ خيار
            <b>Headers and footers</b>
            للحصول على تقرير نظيف بدون رابط المتصفح
            وتاريخ Chrome.
          </div>

        </div>
      `;

      document.body.appendChild(modal);

      modal
        .querySelector(
          '.vd-report-export-close'
        )
        .addEventListener(
          'click',
          closeModal
        );

      modal.addEventListener(
        'click',
        event => {
          if (event.target === modal) {
            closeModal();
          }
        }
      );

      modal
        .querySelectorAll(
          '[data-report-type]'
        )
        .forEach(button => {
          button.addEventListener(
            'click',
            () => {
              printReport(
                button.dataset.reportType
              );
            }
          );
        });
    }

    modal.classList.add('open');
  }

  function hideLegacyExportButtons() {
    [
      'printBtn',
      'exportSafetyPdfBtn',
      'exportExecutionPdfBtn',
      'stpExportReport',
      'stpExportHtml'
    ].forEach(id => {
      const button = document.getElementById(id);

      if (!button) return;

      button.style.display = 'none';
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });
  }

  function ensurePageReportButton(page) {
    if (!page) return;

    let bar =
      page.querySelector(':scope > .vd-tab-report-actions');

    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'vd-tab-report-actions';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'vd-tab-report-btn';
      button.title = 'إنشاء تقرير للتاب الحالي فقط';
      button.textContent = '⤓ تصدير تقرير';

      bar.appendChild(button);
      page.insertBefore(bar, page.firstChild);
    }

    const button =
      bar.querySelector('.vd-tab-report-btn');

    if (button && !button.dataset.bound) {
      button.dataset.bound = '1';
      button.addEventListener('click', showModal);
    }
  }

  function installPageReportButtons() {
    [
      'masterPage',
      'meetingPage',
      'dataPage'
    ].forEach(id => {
      ensurePageReportButton(
        document.getElementById(id)
      );
    });
  }

  function install() {
    hideLegacyExportButtons();
    installPageReportButtons();

    const observer = new MutationObserver(() => {
      hideLegacyExportButtons();
      installPageReportButtons();
    });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  window.VDReportExport = {
    showModal,
    printReport
  };

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      install
    );
  } else {
    install();
  }
})();