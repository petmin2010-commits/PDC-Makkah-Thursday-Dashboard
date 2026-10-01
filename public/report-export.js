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
        const liveChart =
          window.Chart?.getChart?.(canvas);

        if (liveChart) {
          try {
            liveChart.stop?.();
            liveChart.update?.('none');
          } catch (_) {}
        }

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
          تقرير فني
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

  function dataQualityCardData(card) {
    if (!card) return null;

    return {
      label:
        card.querySelector('span')?.textContent?.trim()
        || 'مؤشر جودة',
      value:
        card.querySelector('strong')?.textContent?.trim()
        || '0',
      note:
        card.querySelector('small')?.textContent?.trim()
        || card.getAttribute('title')
        || '',
      detail:
        card.getAttribute('title')
        || '',
      issue:
        card.classList.contains('has-issue'),
      ok:
        card.classList.contains('is-ok')
    };
  }

  function appendDataQualityCards(container, cards) {
    cards
      .filter(Boolean)
      .forEach(card => {
        const item = document.createElement('article');

        item.className =
          'vd-dq-rule-card ' +
          (
            card.issue
              ? 'has-issue'
              : card.ok
                ? 'is-ok'
                : ''
          );

        item.innerHTML = `
          <div class="vd-dq-rule-top">
            <span>${escapeHtml(card.label)}</span>
            <b>${escapeHtml(card.value)}</b>
          </div>
          ${card.note
            ? `<small>${escapeHtml(card.note)}</small>`
            : ''}
          ${card.detail && card.detail !== card.note
            ? `<p>${escapeHtml(card.detail)}</p>`
            : ''}
        `;

        container.appendChild(item);
      });
  }

  function buildDataQualityReport(report) {
    const root =
      document.getElementById('dataQualityDashboard');

    if (!root) return false;

    const hero = root.querySelector('.dq-hero');
    const overview = [
      ...root.querySelectorAll('.dq-overview-card')
    ];

    const heroIssues =
      hero?.querySelector('.dq-hero-score-main strong')
        ?.textContent?.trim()
      || '0';

    const heroRate =
      hero?.querySelector('.dq-hero-score-main b')
        ?.textContent?.trim()
      || '100%';

    const heroAffected =
      hero?.querySelector('.dq-hero-score small')
        ?.textContent?.trim()
      || '';

    /*
      غلاف جودة البيانات يبنى كصفحة تقرير عادية،
      وليس عبر buildCover العام. هذا يمنع Chrome من
      إنشاء صفحة بيضاء إضافية بين الغلاف وأول صفحة بيانات.
    */
    const brand = getBrandInfo();
    const now = new Date();
    const filters = getAppliedFilters();

    const cover = createPage(
      'جودة البيانات',
      brand.city,
      'vd-report-data-quality-cover'
    );

    const coverBody =
      cover.querySelector('.vd-report-section-body');

    coverBody.innerHTML = `
      <section class="vd-dq-cover-meta">
        <div>
          <span>المشروع</span>
          <b>${escapeHtml(brand.project)}</b>
        </div>
        <div>
          <span>رقم العقد</span>
          <b>${escapeHtml(brand.contract || brand.contractText || '')}</b>
        </div>
        <div>
          <span>تاريخ التقرير</span>
          <b>${escapeHtml(now.toLocaleDateString('ar-SA'))}</b>
        </div>
        <div>
          <span>وقت الإصدار</span>
          <b>${escapeHtml(now.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}))}</b>
        </div>
        <div>
          <span>الفلاتر</span>
          <b>${filters.length ? filters.length + ' فلتر مطبق' : 'جميع البيانات'}</b>
        </div>
      </section>
      <section class="vd-dq-cover-summary">
        <div class="vd-dq-cover-grid"></div>
      </section>
    `;

    const grid =
      coverBody.querySelector('.vd-dq-cover-grid');

    const overall = [
      {
        label: 'ملاحظات الجودة',
        value: heroIssues,
        note: heroAffected,
        issue: Number(
          String(heroIssues).replace(/[^0-9.-]/g, '')
        ) > 0
      },
      {
        label: 'نسبة جودة البيانات',
        value: heroRate,
        note: 'النسبة الإجمالية لاكتمال قواعد الجودة',
        ok: true
      },
      ...overview.map(dataQualityCardData)
    ];

    appendDataQualityCards(grid, overall);
    report.appendChild(cover);

    const sections = [
      ...root.querySelectorAll('.dq-section')
    ].map(section => {
      const metrics =
        [...section.querySelectorAll(
          '.dq-section-metrics > div'
        )].map(metric => ({
          value:
            metric.querySelector('b')?.textContent?.trim()
            || '',
          label:
            metric.querySelector('small')?.textContent?.trim()
            || '',
          note:
            metric.querySelector('em')?.textContent?.trim()
            || ''
        }));

      return {
        title:
          section.querySelector('.dq-section-head h3')
            ?.textContent?.trim()
          || 'قسم جودة',
        subtitle:
          section.querySelector('.dq-section-head span')
            ?.textContent?.trim()
          || '',
        metrics,
        cards:
          [...section.querySelectorAll('.dq-card')]
            .map(dataQualityCardData)
      };
    });

    const makeSectionBlock = section => {
      const block = document.createElement('section');
      block.className = 'vd-dq-section-block';

      const metricsHtml = section.metrics
        .map(metric => `
          <div class="vd-dq-metric">
            <b>${escapeHtml(metric.value)}</b>
            <span>${escapeHtml(metric.label)}</span>
            ${metric.note
              ? `<small>${escapeHtml(metric.note)}</small>`
              : ''}
          </div>
        `)
        .join('');

      block.innerHTML = `
        <div class="vd-dq-section-head">
          <div>
            <span>${escapeHtml(section.subtitle)}</span>
            <h3>${escapeHtml(section.title)}</h3>
          </div>
          <div class="vd-dq-section-metrics">
            ${metricsHtml}
          </div>
        </div>
        <div class="vd-dq-rule-grid"></div>
      `;

      appendDataQualityCards(
        block.querySelector('.vd-dq-rule-grid'),
        section.cards
      );

      return block;
    };

    /*
      توزيع الأقسام على صفحات ثابتة لمنع التزاحم:
      المشاريع + التوصيلات / التصاريح + الأصول / الطوارئ.
    */
    const sectionGroups = [
      sections.slice(0, 2),
      sections.slice(2, 4),
      sections.slice(4, 5)
    ].filter(group => group.length);

    sectionGroups.forEach((group, index) => {
      const titles =
        group.map(item => item.title).join(' + ');

      const page = createPage(
        'قواعد جودة البيانات',
        titles,
        'vd-report-data-quality-page'
      );

      const body =
        page.querySelector('.vd-report-section-body');

      group.forEach(section => {
        body.appendChild(
          makeSectionBlock(section)
        );
      });

      report.appendChild(page);
    });

    /*
      وكيل جودة الإفادات.
    */
    const ai = root.querySelector('.dq-ai-advice');

    if (ai) {
      const page = createPage(
        'وكيل الذكاء الاصطناعي لجودة الإفادات',
        'AI ADVICE QUALITY AGENT',
        'vd-report-data-quality-page vd-report-dq-ai-page'
      );

      const body =
        page.querySelector('.vd-report-section-body');

      const intro = document.createElement('section');
      intro.className = 'vd-dq-ai-intro';

      const status =
        ai.querySelector('.dq-ai-status b')
          ?.textContent?.trim()
        || '';

      const statusNote =
        ai.querySelector('.dq-ai-status small')
          ?.textContent?.trim()
        || '';

      const description =
        ai.querySelector('.dq-ai-head p')
          ?.textContent?.trim()
        || '';

      intro.innerHTML = `
        <div>
          <h3>وكيل الذكاء الاصطناعي لتحليل جودة الإفادات</h3>
          <p>${escapeHtml(description)}</p>
        </div>
        <aside>
          <b>${escapeHtml(status)}</b>
          <small>${escapeHtml(statusNote)}</small>
        </aside>
      `;

      body.appendChild(intro);

      const grid = document.createElement('div');
      grid.className = 'vd-dq-rule-grid vd-dq-ai-grid';

      appendDataQualityCards(
        grid,
        [...ai.querySelectorAll('.dq-ai-cards > *')]
          .map(dataQualityCardData)
      );

      body.appendChild(grid);
      report.appendChild(page);
    }

    /*
      التدقيق الذكي المتقدم.
    */
    const audit =
      root.querySelector('.dq-smart-audit');

    if (audit) {
      const page = createPage(
        'التدقيق الذكي المتقدم',
        'SMART DATA AUDIT',
        'vd-report-data-quality-page vd-report-dq-audit-page'
      );

      const body =
        page.querySelector('.vd-report-section-body');

      const intro = document.createElement('section');
      intro.className = 'vd-dq-audit-intro';

      const total =
        audit.querySelector('.dq-smart-total b')
          ?.textContent?.trim()
        || '0';

      const note =
        audit.querySelector('.dq-smart-head p')
          ?.textContent?.trim()
        || '';

      intro.innerHTML = `
        <div>
          <h3>التدقيق الذكي المتقدم</h3>
          <p>${escapeHtml(note)}</p>
        </div>
        <aside>
          <b>${escapeHtml(total)}</b>
          <small>ملاحظة ذكية</small>
        </aside>
      `;

      body.appendChild(intro);

      const grid = document.createElement('div');
      grid.className = 'vd-dq-rule-grid vd-dq-audit-grid';

      appendDataQualityCards(
        grid,
        [...audit.querySelectorAll('.dq-smart-card')]
          .map(dataQualityCardData)
      );

      body.appendChild(grid);
      report.appendChild(page);
    }

    /*
      إذا كان المستخدم فتح Drilldown قبل التصدير،
      نضيف الجدول الظاهر كملحق أخير بدل تجاهله.
    */
    const details =
      root.querySelector('#dqIssueDetails');

    if (
      details &&
      !details.querySelector('.dq-detail-placeholder') &&
      details.textContent.trim()
    ) {
      const page = createPage(
        details.querySelector('h3')
          ?.textContent?.trim()
          || 'تفاصيل حالات الجودة',
        'CURRENT DRILLDOWN',
        'vd-report-data-quality-detail-page'
      );

      const body =
        page.querySelector('.vd-report-section-body');

      const cloned =
        details.cloneNode(true);

      cloned
        .querySelectorAll('button')
        .forEach(button => button.remove());

      cloned.classList.add('vd-dq-detail-clone');
      body.appendChild(cloned);
      report.appendChild(page);
    }

    return true;
  }

  function buildSafetyReport(report) {
    const source = document.getElementById('dataPage');
    const safety = document.getElementById('safetyMasterAnalytics');
    if (!source || !safety) return false;

    const kpis = findKpis(source).slice(0, 8);
    const filters = getAppliedFilters();
    const brand = getBrandInfo();
    const period = document.querySelector('#vpsSummary b')?.textContent?.trim() || 'كامل المدة';
    const countText = document.getElementById('dataCount')?.textContent?.trim() || '';
    const filterText = filters.length
      ? filters.map(x => `${x.label}: ${x.value}`).join(' • ')
      : 'جميع البيانات';

    const safetyChartIds = [
      'safetyTrendChart',
      'safetyContractorChart',
      'safetyViolationChart',
      'safetySupervisorChart',
      'safetyTypeChart',
      'safetyEditorChart'
    ];

    const normalizeSafetyChart = id => {
      const chart = window.Chart?.getChart?.(id);
      if (!chart) return;
      const ink = '#172b5f';
      const grid = 'rgba(23,43,95,.10)';

      chart.options.devicePixelRatio = 2;
      chart.options.plugins = chart.options.plugins || {};
      chart.options.plugins.legend = chart.options.plugins.legend || {};
      chart.options.plugins.legend.labels = {
        ...(chart.options.plugins.legend.labels || {}),
        color: ink,
        font: {
          ...(chart.options.plugins.legend.labels?.font || {}),
          family: 'Cairo',
          size: 10,
          weight: '700'
        }
      };

      const scales = chart.options.scales || {};
      Object.values(scales).forEach(scale => {
        if (!scale) return;
        scale.ticks = {
          ...(scale.ticks || {}),
          color: ink,
          font: {
            ...(scale.ticks?.font || {}),
            family: 'Cairo',
            size: 10,
            weight: '700'
          }
        };
        if (scale.grid?.display !== false) {
          scale.grid = { ...(scale.grid || {}), color: grid };
        }
      });

      try {
        chart.resize?.();
        chart.update?.('none');
      } catch (_) {}
    };

    safetyChartIds.forEach(normalizeSafetyChart);

    const chartTop = id => {
      const chart = window.Chart?.getChart?.(id);
      const labels = chart?.data?.labels || [];
      const data = chart?.data?.datasets?.[0]?.data || [];
      if (!labels.length || !data.length) return ['—', '—'];
      let best = 0;
      data.forEach((value, i) => {
        if (Number(value || 0) > Number(data[best] || 0)) best = i;
      });
      return [String(labels[best] ?? '—'), String(data[best] ?? '—')];
    };

    const overview = createPage(
      'تقرير مخالفات السلامة',
      'SAFETY MASTER REPORT',
      'vd-report-safety-overview'
    );
    const overviewBody = overview.querySelector('.vd-report-section-body');
    const meta = document.createElement('div');
    meta.className = 'vd-safety-meta';
    meta.innerHTML = `
      <div><span>الإدارة</span><b>${escapeHtml(brand.city)}</b></div>
      <div><span>رقم العقد</span><b>${escapeHtml(brand.contract || '—')}</b></div>
      <div><span>الفترة</span><b>${escapeHtml(period)}</b></div>
      <div><span>النتائج</span><b>${escapeHtml(countText || '—')}</b></div>
      <div class="vd-safety-meta-wide"><span>الفلاتر المطبقة</span><b>${escapeHtml(filterText)}</b></div>
    `;
    overviewBody.appendChild(meta);

    if (kpis.length) {
      const grid = document.createElement('div');
      grid.className = 'vd-safety-kpi-grid';
      kpis.forEach(kpi => {
        const cloned = kpi.cloneNode(true);
        cleanupClone(cloned);
        cloned.classList.add('vd-report-kpi-clone');
        grid.appendChild(cloned);
      });
      overviewBody.appendChild(grid);
    }

    const topContractor = chartTop('safetyContractorChart');
    const topViolation = chartTop('safetyViolationChart');
    const topSupervisor = chartTop('safetySupervisorChart');
    const topType = chartTop('safetyTypeChart');
    const insights = document.createElement('div');
    insights.className = 'vd-safety-insights';
    insights.innerHTML = [
      ['أعلى مقاول بالمخالفات', topContractor[0], topContractor[1] + ' مخالفة'],
      ['أكثر مخالفة تكرارًا', topViolation[0], topViolation[1] + ' مخالفة'],
      ['أعلى مشرف حسب السجلات', topSupervisor[0], topSupervisor[1] + ' مخالفة'],
      ['أكثر أنواع أوامر العمل', topType[0], topType[1] + ' مخالفة']
    ].map(x => `
      <article>
        <span>${escapeHtml(x[0])}</span>
        <strong>${escapeHtml(x[1])}</strong>
        <small>${escapeHtml(x[2])}</small>
      </article>
    `).join('');
    overviewBody.appendChild(insights);
    report.appendChild(overview);

    const ranks = [...safety.querySelectorAll('.safety-rank-grid .panel')].filter(isVisible);
    if (ranks.length) {
      const rankPage = createPage(
        'التصنيفات الرئيسية لمخالفات السلامة',
        'أوامر العمل المتكررة وترتيب المقاولين',
        'vd-report-safety-ranking-page'
      );
      const rankGrid = document.createElement('div');
      rankGrid.className = 'vd-safety-rank-grid';
      ranks.forEach(panel => {
        const cloned = cloneWithCanvases(panel);
        cloned.classList.add('vd-report-summary-table');
        rankGrid.appendChild(cloned);
      });
      rankPage.querySelector('.vd-report-section-body').appendChild(rankGrid);
      report.appendChild(rankPage);
    }

    const charts = [...safety.querySelectorAll('.safety-master-grid .panel')].filter(isVisible);
    chunk(charts, 4).forEach((group, index) => {
      const page = createPage(
        'التحليلات الرسومية لمخالفات السلامة',
        `الصفحة ${index + 1} من ${Math.ceil(charts.length / 4)}`,
        'vd-report-safety-chart-page'
      );
      if (group.length <= 2) page.classList.add('vd-report-safety-chart-page-last');
      const body = page.querySelector('.vd-report-section-body');
      const grid = document.createElement('div');
      grid.className = 'vd-report-chart-grid vd-safety-chart-grid';
      group.forEach(panel => {
        const cloned = cloneWithCanvases(panel);
        cloned.classList.add('vd-report-chart-card');
        grid.appendChild(cloned);
      });
      body.appendChild(grid);
      report.appendChild(page);
    });

    const table = document.querySelector('#dataTable table');
    const rows = table ? [...table.querySelectorAll('tbody tr')] : [];
    if (table && rows.length) {
      chunk(rows, 8).forEach((group, index, groups) => {
        const page = createPage(
          'السجل التفصيلي لمخالفات السلامة',
          `صفحة ${index + 1} من ${groups.length} • ${rows.length} سجل`,
          'vd-report-safety-detail-page'
        );
        const copy = table.cloneNode(false);
        copy.className = 'vd-report-safety-table';
        const head = table.querySelector('thead')?.cloneNode(true);
        if (head) copy.appendChild(head);
        const bodyRows = document.createElement('tbody');
        group.forEach(row => bodyRows.appendChild(row.cloneNode(true)));
        copy.appendChild(bodyRows);
        cleanupClone(copy);
        copy.querySelectorAll('th,td').forEach(cell => cell.setAttribute('dir', 'auto'));
        page.querySelector('.vd-report-section-body').appendChild(copy);
        report.appendChild(page);
      });
    }
    return true;
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

    if (getActivePageKey() === 'safety') {
      if (!buildSafetyReport(report)) {
        alert('تعذر تجهيز تقرير مخالفات السلامة.');
        return null;
      }

      document.body.appendChild(report);
      return report;
    }

    if (getActivePageKey() === 'dataQuality') {
      if (!buildDataQualityReport(report)) {
        alert('تعذر تجهيز بيانات جودة البيانات للتقرير.');
        return null;
      }

      document.body.appendChild(report);
      return report;
    }

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
    /*
      التصدير موحّد ومباشر مثل تقرير الخميس:
      لا توجد نافذة لاختيار نوع التقرير.
      يتم إنشاء التقرير الكامل للتاب النشط فقط.
    */
    document.getElementById(MODAL_ID)?.remove();
    printReport('full');
  }

  function hideLegacyExportButtons() {
    [
      'printBtn',
      'exportSafetyPdfBtn',
      'exportExecutionPdfBtn',
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
      button.title = 'تصدير التقرير الكامل للتاب الحالي مباشرة';
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

  function syncPageReportButton() {
    const key = getActivePageKey();

    document
      .querySelectorAll('.vd-tab-report-actions')
      .forEach(bar => {
        bar.style.display =
          key === 'smartThursday'
            ? 'none'
            : 'flex';
      });

    const thursdayButton =
      document.getElementById('stpExportReport');

    if (thursdayButton) {
      thursdayButton.style.display =
        key === 'smartThursday'
          ? ''
          : 'none';
    }
  }

  function install() {
    document.getElementById(MODAL_ID)?.remove();
    hideLegacyExportButtons();
    installPageReportButtons();
    syncPageReportButton();

    document.addEventListener(
      'click',
      event => {
        if (!event.target.closest?.('.nav-item')) return;
        setTimeout(syncPageReportButton, 0);
      }
    );

    const observer = new MutationObserver(() => {
      hideLegacyExportButtons();
      installPageReportButtons();
      syncPageReportButton();
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
    exportCurrentTab: () => printReport('full'),
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