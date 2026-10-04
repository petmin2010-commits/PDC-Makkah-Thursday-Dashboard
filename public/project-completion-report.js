(() => {
  'use strict';

  const txt = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const esc = v => txt(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => {
    const m = txt(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  };
  const ratio = v => {
    const n = num(v);
    if (n == null) return null;
    return txt(v).includes('%') ? n / 100 : (n > 1.5 ? n / 100 : n);
  };
  const pct = v => v == null ? '—' : (v * 100).toFixed(1).replace('.0','') + '%';
  const has = (v, s) => txt(v).includes(s);
  const status = r => {
    const s = txt(r.executionStatus);
    if (s === 'تم التنفيذ') return 'تم التنفيذ';
    if (s.includes('موقوف') || s.includes('محول')) return 'موقوف/محول';
    return 'لم يتم التنفيذ';
  };
  const isProjectsReady = () => typeof S !== 'undefined' && S.current === 'projects' && Array.isArray(S.raw);

  function cityInfo() {
    const brand = document.querySelector('.brand-copy');
    const project = txt(brand?.querySelector('b')?.textContent) || 'العقد الموحد للإشراف على خدمات شبكات الطاقة';
    const city = txt(brand?.querySelector('strong')?.textContent) || txt(document.title) || 'إدارة الكهرباء';
    const contract = txt(brand?.querySelector('em')?.textContent).replace(/^رقم العقد\s*:\s*/,'');
    const cityEn = /مكة/i.test(city) ? 'Makkah' : /جدة/i.test(city) ? 'Jeddah' : 'PDC';
    return { project, city, contract, cityEn };
  }

  function primaryCause(r) {
    const st = txt(r.stage);
    const ph = txt(r.stageStatus);
    if (status(r) === 'موقوف/محول' || st === 'تحت المعالجة') return 'موقوف/محول أو تحت المعالجة';
    if (st.includes('التصاريح')) return 'التصاريح والتنسيقات';
    if (st.includes('مرحلة التشغيل') || ph.includes('حوكمة') || ph.includes('برنامج') || ph.includes('عوائق تشغيل') || ph.includes('تشغيل جزئي')) return 'التشغيل والحوكمة';
    if (st.includes('مرحلة الإغلاق')) return 'الإغلاق والمستندات';
    if (st.includes('التنفيذ') && (ph.includes('تركيب') || ph.includes('استبدال معدات'))) return 'تنفيذ وتركيب المعدات';
    if (st.includes('التنفيذ')) return 'التنفيذ الميداني';
    return 'أسباب أخرى';
  }

  function permitDetail(r) {
    const p = txt(r.permit);
    if (!p || p === '#N/A') return 'تصريح غير محدد';
    if (p.includes('لم يتم')) return 'لم يتم إدخال التصريح';
    if (p.includes('رفض') || p.includes('انتهاء التنسيق') || p.includes('ملغي')) return 'رفض/إلغاء أو تعثر التنسيق';
    if (p.includes('اصدار') || p.includes('إصدار')) return 'صدر التصريح وما زال الأمر غير منفذ';
    if (p.includes('قيد')) return 'قيد التنسيق والاعتماد';
    if (p.includes('لا يتطلب')) return 'لا يتطلب تصريح';
    return p;
  }

  function operationDetail(r) {
    const ph = txt(r.stageStatus);
    const note = txt(r.advice || r.detail || r.notes);
    if (ph.includes('تشغيل جزئي')) return 'تشغيل جزئي لم يكتمل';
    if (ph.includes('عوائق تشغيل')) return 'عوائق تشغيل';
    if (ph.includes('حوكمة') || ph.includes('برنامج')) {
      if (note.includes('رفض المشترك') || note.includes('رفض') && note.includes('الفصل')) return 'برنامج/حوكمة متعطل بسبب رفض الفصل';
      if (note.includes('GIS') || note.includes('عدم تطابق')) return 'برنامج/حوكمة متعطل بسبب عدم تطابق البيانات';
      if (note.includes('الصيانة') || note.includes('الطوارئ')) return 'انتظار برنامج/تنسيق مع الصيانة والطوارئ';
      return 'انتظار برنامج/حوكمة';
    }
    return ph || 'مرحلة تشغيل';
  }

  function executionDetail(r) {
    const ph = txt(r.stageStatus);
    const note = txt(r.advice || r.detail || r.notes);
    if (ph.includes('تركيب') || ph.includes('استبدال معدات')) {
      if (note.includes('موعد') && (note.includes('الصيانة') || note.includes('الطوارئ'))) return 'معدات جاهزة وتنتظر برنامج تشغيل';
      if (note.includes('مصروف') || note.includes('مواد') || note.includes('مولد')) return 'مادة/معدة أو تجهيزات تنفيذ';
      return 'تركيب/استبدال معدات';
    }
    if (ph.includes('حفر') || ph.includes('تمديد')) return 'حفر وتمديد';
    return ph || 'تنفيذ ميداني';
  }

  function delayBucket(r) {
    const d = txt(r.delay);
    if (status(r) === 'تم التنفيذ') return 'تم التنفيذ';
    if (status(r) === 'موقوف/محول') return 'موقوف/محول';
    if (d.includes('شديد')) return 'تأخير شديد';
    if (d.includes('عالي') || d.includes('عالٍ') || d.includes('عال')) return 'تأخير عالي';
    if (d.includes('متوسط')) return 'تأخير متوسط';
    if (d.includes('بسيط')) return 'تأخير بسيط';
    if (d.includes('أوشكت')) return 'أوشكت المدة على الانتهاء';
    if (d.includes('ضمن')) return 'ضمن المدة';
    return 'غير محدد';
  }

  function group(rows, keyFn) {
    const m = new Map();
    rows.forEach(r => {
      const k = txt(keyFn(r)) || 'غير محدد';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    return [...m.entries()].map(([name, rs]) => ({name, rows:rs, count:rs.length}));
  }

  function avgProgress(rows) {
    const vals = rows.map(r => ratio(r.progress)).filter(v => v != null && Number.isFinite(v));
    return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : null;
  }

  function reportData(rows) {
    const total = rows.length;
    const doneRows = rows.filter(r => status(r) === 'تم التنفيذ');
    const notDoneRows = rows.filter(r => status(r) === 'لم يتم التنفيذ');
    const stoppedRows = rows.filter(r => status(r) === 'موقوف/محول');
    const active = total - stoppedRows.length;
    const p100Open = notDoneRows.filter(r => (ratio(r.progress) || 0) >= 1);
    const severe = notDoneRows.filter(r => delayBucket(r) === 'تأخير شديد');
    const delayed = notDoneRows.filter(r => ['تأخير شديد','تأخير عالي','تأخير متوسط','تأخير بسيط'].includes(delayBucket(r)));
    const causes = group(notDoneRows, primaryCause).sort((a,b)=>b.count-a.count);
    const delays = group(notDoneRows, delayBucket).sort((a,b)=>b.count-a.count);
    const contractors = group(rows, r => r.contractor).map(g => ({
      name:g.name,total:g.count,
      notDone:g.rows.filter(r=>status(r)==='لم يتم التنفيذ').length,
      done:g.rows.filter(r=>status(r)==='تم التنفيذ').length,
      stopped:g.rows.filter(r=>status(r)==='موقوف/محول').length,
      progress:avgProgress(g.rows)
    })).sort((a,b)=>b.notDone-a.notDone || b.total-a.total);
    const locations = group(rows, r => r.location || r.region).map(g => ({
      name:g.name,total:g.count,
      notDone:g.rows.filter(r=>status(r)==='لم يتم التنفيذ').length,
      done:g.rows.filter(r=>status(r)==='تم التنفيذ').length,
      progress:avgProgress(g.rows)
    })).sort((a,b)=>b.notDone-a.notDone || b.total-a.total);
    const permits = notDoneRows.filter(r=>primaryCause(r)==='التصاريح والتنسيقات');
    const operations = notDoneRows.filter(r=>primaryCause(r)==='التشغيل والحوكمة');
    const equipment = notDoneRows.filter(r=>primaryCause(r)==='تنفيذ وتركيب المعدات');
    const execution = notDoneRows.filter(r=>primaryCause(r)==='التنفيذ الميداني');
    const permitDetails = group(permits, permitDetail).sort((a,b)=>b.count-a.count);
    const operationDetails = group(operations, operationDetail).sort((a,b)=>b.count-a.count);
    const executionDetails = group([...equipment,...execution], executionDetail).sort((a,b)=>b.count-a.count);
    return {
      rows,total,doneRows,notDoneRows,stoppedRows,active,p100Open,severe,delayed,causes,delays,
      contractors,locations,permits,operations,equipment,execution,permitDetails,operationDetails,executionDetails,
      completionRate:total?doneRows.length/total:null,
      activeCompletionRate:active?doneRows.length/active:null,
      avgProgress:avgProgress(rows)
    };
  }

  function barRows(items, total, max=10) {
    return items.slice(0,max).map(x => {
      const share = total ? Math.round((x.count/total)*100) : 0;
      return '<div class="bar-row"><span>'+esc(x.name)+'</span><div><i style="width:'+Math.max(2,share)+'%"></i></div><b>'+x.count.toLocaleString('ar-SA')+' <small>('+share+'%)</small></b></div>';
    }).join('');
  }

  function table(rows, columns) {
    if (!rows.length) return '<div class="empty">لا توجد بيانات ضمن النطاق الحالي.</div>';
    return '<table><thead><tr>'+columns.map(c=>'<th>'+esc(c[0])+'</th>').join('')+'</tr></thead><tbody>'+
      rows.map(r=>'<tr>'+columns.map(c=>'<td>'+c[1](r)+'</td>').join('')+'</tr>').join('')+
      '</tbody></table>';
  }

  function recommendations(d) {
    const a = [];
    const permitNotEntered = d.notDoneRows.filter(r=>permitDetail(r)==='لم يتم إدخال التصريح').length;
    const permitIssued = d.notDoneRows.filter(r=>permitDetail(r)==='صدر التصريح وما زال الأمر غير منفذ').length;
    if (permitNotEntered) a.push('تكوين قائمة عاجلة للأوامر التي لم يُدخل تصريحها وعددها <b>'+permitNotEntered+'</b>، مع مسؤول وتاريخ مستهدف لكل تصريح.');
    if (permitIssued) a.push('فصل الأوامر الصادر لها تصريح وما زالت غير منفذة وعددها <b>'+permitIssued+'</b> ونقل الجاهز منها مباشرة إلى خطة التنفيذ.');
    if (d.operations.length) a.push('إدارة أوامر التشغيل/الحوكمة كقائمة مستقلة وعددها <b>'+d.operations.length+'</b> وربطها ببرنامج أسبوعي مع PDC والصيانة والطوارئ.');
    if (d.equipment.length) a.push('إعطاء أوامر تركيب/استبدال المعدات مسار متابعة مستقل؛ عددها غير المنفذ <b>'+d.equipment.length+'</b> لأنها لا تعتمد بالضرورة على الحفر والتمديد.');
    if (d.p100Open.length) a.push('الأوامر ذات الإنجاز الميداني 100% وعددها <b>'+d.p100Open.length+'</b> لا تُعد منفذة نهائيًا قبل الوصول إلى مرحلة الإغلاق؛ تتابع كأوامر جاهزة للتشغيل/الإغلاق لا كأخطاء بيانات.');
    const top = d.contractors.filter(x=>x.notDone>0).slice(0,3);
    if (top.length) a.push('تركيز اجتماع المتابعة على أعلى المقاولين في غير المنفذ: <b>'+top.map(x=>esc(x.name)+' ('+x.notDone+')').join('، ')+'</b>.');
    if (d.severe.length) a.push('رفع قائمة التأخير الشديد وعددها <b>'+d.severe.length+'</b> كقائمة تدخل إداري منفصلة حتى لا تختلط بالأوامر ضمن المدة.');
    return a;
  }

  function getFilterText() {
    const parts = [];
    document.querySelectorAll('#filterBar .filter').forEach(box => {
      const sel = box.querySelector('select');
      if (!sel || !sel.value) return;
      const value = txt(sel.options?.[sel.selectedIndex]?.textContent || sel.value);
      if (!value || ['الكل','جميع البيانات'].includes(value)) return;
      const label = txt(box.querySelector('label')?.textContent) || 'فلتر';
      parts.push(label+': '+value);
    });
    const q = txt(document.getElementById('globalSearch')?.value);
    if (q) parts.push('بحث: '+q);
    return parts.length ? parts.join(' • ') : 'بدون فلاتر — جميع بيانات المشاريع';
  }

  function buildHtml(rows, scope) {
    const d = reportData(rows);
    const info = cityInfo();
    const now = new Date();
    const stamp = now.toLocaleString('ar-SA', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    const filterText = scope === 'general' ? 'تقرير عام — جميع بيانات المشاريع' : getFilterText();
    const recs = recommendations(d);
    const causeTotal = d.notDoneRows.length || 1;
    const p100Rows = d.p100Open.slice().sort((a,b)=>txt(a.stage).localeCompare(txt(b.stage),'ar'));
    const fileTitle = 'Project_Completion_Analysis_'+info.cityEn+'_'+now.toISOString().slice(0,10)+'_'+String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0');

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${fileTitle}</title><style>
      @page{size:A4 portrait;margin:9mm}
      *{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#18231e;background:#fff;font-size:10.5px;line-height:1.55}
      .cover{padding:18px 20px;border:2px solid #1d5c45;border-radius:14px;background:linear-gradient(135deg,#f6fbf8,#eef7f2);margin-bottom:12px}
      .brand{font-size:10px;letter-spacing:.6px;color:#527064;font-weight:700}.cover h1{font-size:23px;margin:5px 0;color:#123f30}.cover h2{font-size:14px;margin:0 0 8px;color:#446258}
      .meta{display:flex;gap:12px;flex-wrap:wrap;color:#53645d}.rule{margin-top:12px;padding:10px 12px;border-right:4px solid #d08b18;background:#fff8e8;font-weight:700}
      .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 14px}.kpi{border:1px solid #d8e3dc;border-radius:10px;padding:10px;background:#fff}
      .kpi span{display:block;color:#64756d;font-size:9px}.kpi b{display:block;font-size:20px;color:#154f3b;margin:2px 0}.kpi small{color:#75827c}
      h3{font-size:14px;color:#174d3a;margin:13px 0 6px;border-bottom:2px solid #e1ebe5;padding-bottom:4px}.section{break-inside:avoid;margin-bottom:10px}
      .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bar-row{display:grid;grid-template-columns:160px 1fr 70px;gap:7px;align-items:center;margin:5px 0}
      .bar-row>div{height:9px;background:#edf2ef;border-radius:9px;overflow:hidden}.bar-row i{display:block;height:100%;background:#2b765a;border-radius:9px}.bar-row b{text-align:left;font-size:9px}.bar-row small{font-weight:400;color:#777}
      table{width:100%;border-collapse:collapse;margin:5px 0 9px;table-layout:fixed}th,td{border:1px solid #d9e1dd;padding:5px 6px;vertical-align:top;word-wrap:break-word}th{background:#eaf4ee;color:#174d3a;font-size:9px}td{font-size:8.8px}
      .note{padding:8px 10px;background:#f5f8f6;border-right:3px solid #477a66;margin:6px 0}.warn{background:#fff8e8;border-color:#d08b18}
      ol{padding-right:20px}li{margin:5px 0}.footer{margin-top:16px;padding-top:8px;border-top:1px solid #dfe7e2;color:#748079;font-size:8px;text-align:center}
      .empty{padding:10px;background:#f4f5f4;color:#777}.page-break{break-before:page}
      @media print{.section{break-inside:avoid}thead{display:table-header-group}tr{break-inside:avoid}}
    </style></head><body>
    <section class="cover"><div class="brand">VISION DIMENSIONS • PDC PROJECT COMPLETION ANALYSIS</div>
      <h1>تحليل أسباب انخفاض إنجاز المشاريع</h1><h2>${esc(info.city)} — ${esc(info.project)}</h2>
      <div class="meta"><span>تاريخ السحب: ${esc(stamp)}</span>${info.contract?'<span>العقد: '+esc(info.contract)+'</span>':''}<span>${esc(filterText)}</span></div>
      <div class="rule">قاعدة التصنيف: وصول نسبة الإنجاز الميداني إلى 100% لا يحول أمر العمل إلى «تم التنفيذ» ما دام في مرحلة التنفيذ أو التشغيل/الحوكمة. يعتمد الإتمام النهائي عند الوصول إلى مرحلة الإغلاق وفق منطق الداشبورد.</div>
    </section>
    <section class="kpis">
      <div class="kpi"><span>إجمالي المشاريع</span><b>${d.total.toLocaleString('ar-SA')}</b><small>داخل نطاق التقرير</small></div>
      <div class="kpi"><span>تم التنفيذ</span><b>${d.doneRows.length.toLocaleString('ar-SA')}</b><small>${pct(d.completionRate)} من الإجمالي</small></div>
      <div class="kpi"><span>لم يتم التنفيذ</span><b>${d.notDoneRows.length.toLocaleString('ar-SA')}</b><small>${pct(d.total?d.notDoneRows.length/d.total:null)} من الإجمالي</small></div>
      <div class="kpi"><span>موقوف/محول</span><b>${d.stoppedRows.length.toLocaleString('ar-SA')}</b><small>خارج المسار التشغيلي المعتاد</small></div>
      <div class="kpi"><span>معدل الإتمام للأوامر النشطة</span><b>${pct(d.activeCompletionRate)}</b><small>تم التنفيذ ÷ (الإجمالي - الموقوف/المحول)</small></div>
      <div class="kpi"><span>متوسط الإنجاز الميداني</span><b>${pct(d.avgProgress)}</b><small>متوسط نسب الإنجاز المسجلة</small></div>
      <div class="kpi"><span>التأخير الشديد بين غير المنفذ</span><b>${d.severe.length.toLocaleString('ar-SA')}</b><small>${pct(d.notDoneRows.length?d.severe.length/d.notDoneRows.length:null)}</small></div>
      <div class="kpi"><span>كل المتأخر بين غير المنفذ</span><b>${d.delayed.length.toLocaleString('ar-SA')}</b><small>${pct(d.notDoneRows.length?d.delayed.length/d.notDoneRows.length:null)}</small></div>
      <div class="kpi"><span>100% وما زال قبل الإغلاق</span><b>${d.p100Open.length.toLocaleString('ar-SA')}</b><small>حالة صحيحة إذا ما زال في التنفيذ/التشغيل</small></div>
    </section>
    <section class="section"><h3>1) الأسباب الرئيسية للأوامر غير المنفذة</h3>
      <div class="two"><div>${barRows(d.causes,causeTotal,10)}</div><div class="note">القراءة تعتمد أولًا على المرحلة التشغيلية الحالية، ثم حالة المرحلة والتصريح. لذلك لا تُعامل نسبة 100% وحدها كحالة تنفيذ نهائي.</div></div>
    </section>
    <section class="section"><h3>2) تحليل التأخير للأوامر غير المنفذة</h3>${barRows(d.delays,causeTotal,10)}</section>
    <section class="section"><h3>3) تفاصيل التصاريح والتنسيقات</h3>${barRows(d.permitDetails,d.permits.length||1,10)}</section>
    <section class="section"><h3>4) التشغيل والحوكمة</h3>${barRows(d.operationDetails,d.operations.length||1,10)}</section>
    <section class="section"><h3>5) التنفيذ والمعدات</h3>${barRows(d.executionDetails,(d.equipment.length+d.execution.length)||1,10)}</section>
    <section class="section page-break"><h3>6) أعلى المقاولين تأثيرًا في غير المنفذ</h3>
      ${table(d.contractors.filter(x=>x.notDone>0).slice(0,12),[
        ['المقاول',x=>esc(x.name)],['إجمالي الأوامر',x=>String(x.total)],['غير منفذ',x=>'<b>'+x.notDone+'</b>'],['تم التنفيذ',x=>String(x.done)],['موقوف/محول',x=>String(x.stopped)],['متوسط الإنجاز',x=>pct(x.progress)]
      ])}
    </section>
    <section class="section"><h3>7) أعلى المواقع تأثيرًا في غير المنفذ</h3>
      ${table(d.locations.filter(x=>x.notDone>0).slice(0,12),[
        ['الموقع',x=>esc(x.name)],['إجمالي الأوامر',x=>String(x.total)],['غير منفذ',x=>'<b>'+x.notDone+'</b>'],['تم التنفيذ',x=>String(x.done)],['متوسط الإنجاز',x=>pct(x.progress)]
      ])}
    </section>
    <section class="section"><h3>8) الأوامر ذات إنجاز ميداني 100% وما زالت «لم يتم التنفيذ»</h3>
      <div class="note warn">هذه الحالات لا تعد أخطاء بيانات تلقائيًا. إذا كانت في التنفيذ أو مرحلة التشغيل/الحوكمة فهي تظل «لم يتم التنفيذ» حتى تنتقل إلى مرحلة الإغلاق.</div>
      ${table(p100Rows.slice(0,30),[
        ['أمر العمل',r=>esc(r.workOrder)],['المقاول',r=>esc(r.contractor)],['الموقع',r=>esc(r.location||r.region)],['المرحلة',r=>esc(r.stage)],['حالة المرحلة',r=>esc(r.stageStatus)],['سبب المتابعة',r=>esc(primaryCause(r))]
      ])}
    </section>
    <section class="section page-break"><h3>9) خطة الإجراءات المقترحة</h3><ol>${recs.map(x=>'<li>'+x+'</li>').join('')}</ol></section>
    <section class="section"><h3>10) منهجية التقرير</h3>
      <div class="note">المصدر هو بيانات تاب المشاريع في الداشبورد لحظة السحب. التصنيف النهائي يعتمد على «حالة التنفيذ» والمرحلة التشغيلية. أسباب التعثر تُشتق من مرحلة التنفيذ، حالة المرحلة، حالة التصريح، ونصوص المتابعة المتاحة. التقرير العام يستخدم جميع السجلات، بينما زر التقرير داخل تاب المشاريع يحترم الفلاتر الحالية.</div>
    </section>
    <div class="footer">شركة أبعاد الرؤية للاستشارات الهندسية • تقرير ديناميكي مولد من الداشبورد</div>
    </body></html>`;
    return { html, fileTitle };
  }

  function openPrintWindow() {
    const w = window.open('', '_blank');
    if (!w) {
      alert('يرجى السماح بالنوافذ المنبثقة لتصدير تقرير تحليل إنجاز المشاريع.');
      return null;
    }
    w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>جاري تجهيز التقرير</title></head><body style="font-family:Tahoma;direction:rtl;padding:30px">جاري تجهيز تحليل إنجاز المشاريع...</body></html>');
    w.document.close();
    return w;
  }

  function renderToWindow(w, rows, scope) {
    const out = buildHtml(rows, scope);
    w.document.open();
    w.document.write(out.html);
    w.document.close();
    w.document.title = out.fileTitle;
    setTimeout(() => { try { w.focus(); w.print(); } catch(e) { console.error(e); } }, 450);
  }

  async function waitForProjects() {
    for (let i=0;i<60;i+=1) {
      if (isProjectsReady() && S.raw.length) return true;
      await new Promise(r=>setTimeout(r,120));
    }
    return isProjectsReady();
  }

  async function exportGeneral() {
    const w = openPrintWindow();
    if (!w) return false;
    const previous = typeof S !== 'undefined' ? S.current : '';
    if (!isProjectsReady()) {
      if (typeof openPage === 'function') openPage('projects');
      else document.querySelector('.nav-item[data-page="projects"]')?.click();
    }
    const ok = await waitForProjects();
    if (!ok || !S.raw.length) {
      w.document.body.innerHTML = 'تعذر تحميل بيانات المشاريع.';
      return false;
    }
    renderToWindow(w, S.raw.slice(), 'general');
    if (previous === 'reportsCenter') setTimeout(()=>document.querySelector('.nav-item[data-page="reportsCenter"]')?.click(), 250);
    return true;
  }

  function exportCurrent() {
    const w = openPrintWindow();
    if (!w) return false;
    if (!isProjectsReady()) {
      w.document.body.innerHTML = 'افتح تاب المشاريع أولًا ثم أعد المحاولة.';
      return false;
    }
    const rows = Array.isArray(S.filtered) && S.filtered.length ? S.filtered.slice() : S.raw.slice();
    renderToWindow(w, rows, 'filtered');
    return true;
  }

  function installButton() {
    const hero = document.querySelector('#projectsAdvancedAnalytics .pa-hero');
    if (!hero || document.getElementById('projectCompletionAnalysisBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'projectCompletionAnalysisBtn';
    btn.textContent = '⤓ تحليل إنجاز المشاريع PDF';
    btn.title = 'تصدير تحليل أسباب انخفاض الإنجاز وفق الفلاتر الحالية';
    btn.style.cssText = 'border:0;border-radius:10px;padding:10px 14px;background:#175b43;color:#fff;font-family:inherit;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 5px 14px rgba(23,91,67,.18)';
    btn.addEventListener('click', exportCurrent);
    hero.appendChild(btn);
  }

  const observer = new MutationObserver(() => installButton());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {childList:true,subtree:true});
      setTimeout(installButton,300);
    });
  } else {
    observer.observe(document.body, {childList:true,subtree:true});
    setTimeout(installButton,300);
  }

  window.VDProjectCompletionReport = { exportCurrent, exportGeneral, buildHtml, reportData };
})();