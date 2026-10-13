'use strict';
// Schermen van de app: Klok, Uren, Rapport en Instellingen (zelfde opbouw als Views/*.swift).

// MARK: - Hulpmiddelen

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

const ICONS = {
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  list: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-6M13 17V7M18 17v-4"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  pencil: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8h8M7 12h10M7 16h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  xcircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  hammer: '<path d="m15 12-8.4 8.4a2.1 2.1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.9-1.9A2 2 0 0 1 19 8.2V7l-2.3-2.3a6 6 0 0 0-4.2-1.7H9l.9.8A6.2 6.2 0 0 1 12 8.4V10l2 2h1.2a2 2 0 0 1 1.4.6l1.9 1.9"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  download: '<path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>',
  restore: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5M8 13h8M8 17h5"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  photo: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  flash: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  minus: '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M8 12h8" stroke="#fff"/>',
  addhome: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
  clockq: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l3 2"/><path d="M17 17.5h.01"/>',
  filter: '<circle cx="12" cy="12" r="10"/><path d="M7 9h10M9 13h6M11 17h2"/>',
};
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function toggleHTML(id, checked) {
  return `<label class="switch"><input type="checkbox" id="${id}" role="switch" ${checked ? 'checked' : ''}><span></span></label>`;
}

/** Keuzes voor een keuzelijst; een naam die niet (meer) in de lijst staat blijft zichtbaar. */
function workTypeOptions(current) {
  const names = [...Store.workTypes];
  if (current && !names.includes(current)) names.push(current);
  return names.map(n => `<option value="${esc(n)}" ${n === current ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

/** Tekstveld met een knop om de tekst van papier te scannen (werfnummer of werfnaam). */
function scanFieldHTML(id, subject, value, capitalization) {
  return `<input class="input-plain" id="${id}" type="text" placeholder="Typ of scan" value="${esc(value)}"
      autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="${capitalization}">
    <button class="scan-btn" type="button" data-scan="${id}" data-subject="${subject}" aria-label="Scan ${subject}">${icon('scan')}</button>`;
}

/** Koppelt de scanknoppen in `root` aan hun tekstveld. */
function bindScanButtons(root) {
  for (const btn of $$('[data-scan]', root)) {
    btn.addEventListener('click', () => {
      const input = $('#' + btn.dataset.scan, root);
      startScan(btn.dataset.subject, text => {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }
}

function autosize(textarea) {
  const fit = () => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'; };
  textarea.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return fit;
}

// MARK: - Delen en opslaan

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Het deelmenu van iOS (WhatsApp, mail, AirDrop, Bewaar in Bestanden, …). Geeft true als er gedeeld is. */
async function shareFile(blob, name) {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      console.warn(err);
    }
  }
  download(blob, name);
  return true;
}

// MARK: - Vensters, meldingen en keuzemenu's

const overlays = () => $('#overlays');
const isOverlayOpen = () => overlays().children.length > 0;

function makeBackdrop(onClick) {
  const b = el('<div class="backdrop"></div>');
  if (onClick) b.addEventListener('click', onClick);
  overlays().appendChild(b);
  requestAnimationFrame(() => b.classList.add('show'));
  return b;
}

/**
 * Venster dat van onder openschuift, met links en rechts een knop (zoals een sheet op iOS).
 * left/right: { label, bold, onClick, disabled }
 */
function openSheet({ title, left, right, body, full = false, dark = false, onClose }) {
  const backdrop = makeBackdrop(full ? null : () => left?.dismiss !== false && close());
  const sheet = el(`<div class="sheet ${full ? 'full' : ''} ${dark ? 'dark' : ''}" role="dialog" aria-modal="true">
    <header class="navbar"><div class="navbar-row">
      <div class="navbar-left"></div><div class="navbar-title">${esc(title)}</div><div class="navbar-right"></div>
    </div></header>
    <div class="sheet-body"></div></div>`);
  const makeBtn = (cfg, holder) => {
    if (!cfg) return null;
    const b = el(`<button class="nav-btn ${cfg.bold ? 'bold' : ''}" type="button">${cfg.icon ? icon(cfg.icon) : ''}${esc(cfg.label ?? '')}</button>`);
    if (cfg.aria) b.setAttribute('aria-label', cfg.aria);
    b.disabled = !!cfg.disabled;
    b.addEventListener('click', () => cfg.onClick ? cfg.onClick(api) : close());
    $(holder, sheet).appendChild(b);
    return b;
  };
  const leftBtn = makeBtn(left, '.navbar-left');
  const rightBtn = makeBtn(right, '.navbar-right');
  $('.sheet-body', sheet).appendChild(body);
  overlays().appendChild(sheet);
  requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('show')));

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.activeElement?.blur?.();
    sheet.classList.remove('show');
    backdrop.classList.remove('show');
    setTimeout(() => { sheet.remove(); backdrop.remove(); onClose?.(); }, 320);
  }
  const api = {
    el: sheet, body, close,
    setRightDisabled(d) { if (rightBtn) rightBtn.disabled = d; },
    setTitle(t) { $('.navbar-title', sheet).textContent = t; },
    leftBtn, rightBtn,
  };
  return api;
}

/**
 * Melding in het midden van het scherm. buttons: [{ label, role: 'cancel' | 'destructive', value }]
 * Geeft de `value` (of het label) van de gekozen knop.
 */
function alertBox(title, message = '', buttons = [{ label: 'OK', role: 'cancel' }], { input } = {}) {
  return new Promise(resolve => {
    const backdrop = makeBackdrop();
    const wrap = el(`<div class="alert-wrap"><div class="alert" role="alertdialog">
      <div class="alert-text"><div class="alert-title">${esc(title)}</div>
      ${message ? `<div class="alert-msg">${esc(message)}</div>` : ''}
      ${input ? `<input class="alert-input" type="text" placeholder="${esc(input.placeholder ?? '')}" value="${esc(input.value ?? '')}" autocapitalize="sentences">` : ''}
      </div><div class="alert-buttons ${buttons.length > 2 ? 'stacked' : ''}"></div></div></div>`);
    // Twee knoppen naast elkaar: annuleren links. Gestapeld: annuleren onderaan.
    const ordered = buttons.length > 2
      ? [...buttons.filter(b => b.role !== 'cancel'), ...buttons.filter(b => b.role === 'cancel')]
      : [...buttons.filter(b => b.role === 'cancel'), ...buttons.filter(b => b.role !== 'cancel')];
    const field = $('.alert-input', wrap);
    for (const b of ordered) {
      const btn = el(`<button type="button" class="${b.role ?? ''}">${esc(b.label)}</button>`);
      btn.addEventListener('click', () => {
        const value = b.value ?? b.label;
        const text = field?.value;
        wrap.remove();
        backdrop.remove();
        resolve(input ? { value, text } : value);
      });
      $('.alert-buttons', wrap).appendChild(btn);
    }
    overlays().appendChild(wrap);
    requestAnimationFrame(() => $('.alert', wrap).classList.add('show'));
    if (field) setTimeout(() => { field.focus(); field.select(); }, 50);
  });
}

/** Keuzemenu onderaan (zoals confirmationDialog op iOS). Geeft de `value` van de knop, of null. */
function actionSheet(title, message, buttons) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      $('.action', wrap).classList.remove('show');
      backdrop.classList.remove('show');
      setTimeout(() => { wrap.remove(); backdrop.remove(); }, 280);
      resolve(value);
    };
    const backdrop = makeBackdrop();
    const wrap = el(`<div class="action-wrap"><div class="action">
      <div class="action-group">${title || message ? `<div class="action-head">${title ? `<b>${esc(title)}</b>` : ''}${esc(message ?? '')}</div>` : ''}</div>
      <div class="action-group"><button type="button" class="cancel">Annuleer</button></div></div></div>`);
    const group = $('.action-group', wrap);
    for (const b of buttons) {
      const btn = el(`<button type="button" class="${b.role ?? ''} ${title || message ? 'after-head' : ''}">${esc(b.label)}</button>`);
      btn.addEventListener('click', () => finish(b.value ?? b.label));
      group.appendChild(btn);
    }
    $('.cancel', wrap).addEventListener('click', () => finish(null));
    wrap.addEventListener('click', e => { if (e.target === wrap) finish(null); });
    overlays().appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => $('.action', wrap).classList.add('show')));
  });
}

// MARK: - Tabbladen

const TABS = [
  { id: 'clock', label: 'Klok', icon: 'clock' },
  { id: 'entries', label: 'Uren', icon: 'list' },
  { id: 'reports', label: 'Rapport', icon: 'chart' },
  { id: 'settings', label: 'Instellingen', icon: 'gear' },
];
let currentTab = 0;

function setupTabs() {
  const bar = $('#tabbar');
  TABS.forEach((t, i) => {
    const b = el(`<button class="tab ${i === 0 ? 'active' : ''}" type="button">${icon(t.icon)}<span>${t.label}</span></button>`);
    b.addEventListener('click', () => showTab(i));
    bar.appendChild(b);
  });
}

function showTab(i) {
  currentTab = i;
  $$('.tab').forEach((b, j) => b.classList.toggle('active', i === j));
  $$('.view').forEach((v, j) => v.classList.toggle('active', i === j));
  document.activeElement?.blur?.();
  if (i === 0) Clock.refresh();
  if (i === 1) Entries.refresh();
  if (i === 2) Reports.refresh();
  if (i === 3) Settings.refresh();
}

// MARK: - Klok

const Clock = {
  init() {
    const v = $('#view-clock');
    v.innerHTML = `
      <header class="navbar"><div class="navbar-row"><div class="navbar-title">Klok</div></div></header>
      <div class="content">
        <div id="c-install"></div>
        <div class="logo" role="img" aria-label="e. baillien"></div>
        <div class="card timer">
          <div class="timer-time" id="c-time">00:00:00</div>
          <div class="timer-sub" id="c-sub">Niet ingeklokt</div>
        </div>
        <div class="stack">
          <div class="card form-card">
            <div class="row"><span class="row-label">Werfnaam</span><div class="row-fill">${scanFieldHTML('c-job', 'werfnaam', '', 'words')}</div></div>
            <div class="row"><span class="row-label">Werfnummer</span><div class="row-fill">${scanFieldHTML('c-num', 'werfnummer', '', 'characters')}</div></div>
            <div class="row"><span class="row-label">Uitgevoerd werk</span><div class="row-fill"><select class="picker" id="c-type" aria-label="Uitgevoerd werk"></select></div></div>
            <div class="row"><label for="c-priv" class="row-label">Privéwerk</label>${toggleHTML('c-priv', false)}</div>
            <div class="row-wrap"><textarea class="note" id="c-note" rows="1" placeholder="Notitie (optioneel)"></textarea></div>
          </div>
          <div class="stack" id="c-buttons"></div>
        </div>
        <div class="tiles" id="c-tiles"></div>
      </div>`;
    bindScanButtons(v);
    this.fitNote = autosize($('#c-note'));

    // Wat je invult, hoort bij de lopende registratie, of bij de volgende als je niet ingeklokt bent.
    const bind = (id, apply, event = 'input') => {
      $(id).addEventListener(event, e => { apply(e.target); Store.save(); });
      $(id).addEventListener('change', () => Store.changed());
    };
    bind('#c-job', t => { const r = Store.running; if (r) r.jobName = t.value; else Store.draft.jobName = t.value; });
    bind('#c-num', t => { const r = Store.running; if (r) r.projectNumber = t.value; else Store.draft.projectNumber = t.value; });
    bind('#c-note', t => { const r = Store.running; if (r) r.note = t.value; else Store.draft.note = t.value; });
    bind('#c-type', t => { const r = Store.running; if (r) r.workType = t.value; else Store.settings.lastWorkType = t.value; }, 'change');
    bind('#c-priv', t => { const r = Store.running; if (r) r.isPrivate = t.checked; else Store.draft.isPrivate = t.checked; }, 'change');

    this.renderInstall();
    this.refresh();
    setInterval(() => { if (currentTab === 0 && !document.hidden) this.tick(); }, 1000);
  },

  /** Tip om de app op het beginscherm te zetten (alleen in Safari, niet als app). */
  renderInstall() {
    const box = $('#c-install');
    let dismissed = false;
    try { dismissed = localStorage.getItem('urenlog.installHint') === '1'; } catch { /* leeg */ }
    if (isStandalone() || dismissed) { box.innerHTML = ''; return; }
    const how = isIOS()
      ? 'Tik in Safari op het deel-icoon en kies <b style="display:inline">Zet op beginscherm</b>.'
      : 'Kies in het menu van je browser <b style="display:inline">App installeren</b> of <b style="display:inline">Toevoegen aan startscherm</b>.';
    box.innerHTML = `<div class="card install">${icon('addhome')}<div><b>Zet de app op je beginscherm</b>
      ${how} Dan werkt hij ook offline en blijven je uren veilig bewaard.</div>
      <button class="close" type="button" aria-label="Sluiten">${icon('x')}</button></div>`;
    $('.close', box).addEventListener('click', () => {
      try { localStorage.setItem('urenlog.installHint', '1'); } catch { /* leeg */ }
      box.innerHTML = '';
    });
  },

  refresh() {
    const r = Store.running;
    const src = r ?? { ...Store.draft, workType: Store.settings.lastWorkType };
    // Valt terug op de eerste keuze als de vorige keuze niet meer in de lijst staat.
    if (!r && !Store.workTypes.includes(Store.settings.lastWorkType) && Store.workTypes.length) {
      Store.settings.lastWorkType = Store.workTypes[0];
      src.workType = Store.workTypes[0];
    }
    const setValue = (id, value) => { const e = $(id); if (document.activeElement !== e && e.value !== value) e.value = value; };
    setValue('#c-job', src.jobName ?? '');
    setValue('#c-num', src.projectNumber ?? '');
    setValue('#c-note', src.note ?? '');
    this.fitNote();
    $('#c-priv').checked = !!src.isPrivate;
    const type = $('#c-type');
    if (document.activeElement !== type) type.innerHTML = workTypeOptions(src.workType);

    const box = $('#c-buttons');
    const state = r ? 'running' : 'idle';
    if (box.dataset.state !== state) {
      box.dataset.state = state;
      box.innerHTML = r
        ? `<button class="btn red" type="button" id="c-out">${icon('stop', 'filled')}Uitklokken</button>
           <button class="text-btn" type="button" id="c-edit">Begintijd aanpassen</button>`
        : `<button class="btn green" type="button" id="c-in">${icon('play', 'filled')}Inklokken</button>
           <button class="btn tinted" type="button" id="c-manual">${icon('pencil')}Uren manueel invoeren</button>`;
      if (r) {
        $('#c-out').addEventListener('click', () => this.clockOut());
        $('#c-edit').addEventListener('click', () => { const e = Store.running; if (e) openEntryEdit(e); });
      } else {
        $('#c-in').addEventListener('click', () => this.clockIn());
        // Wat bij de klok al is ingevuld, wordt meegenomen naar de manuele invoer.
        $('#c-manual').addEventListener('click', () => openEntryEdit(null, {
          ...Store.draft, workType: Store.settings.lastWorkType,
        }));
      }
    }
    this.tick();
  },

  tick() {
    const now = Date.now();
    const r = Store.running;
    $('#c-time').textContent = Fmt.clock(r ? exactWorked(r, now) : 0);
    $('#c-sub').textContent = r ? `Ingeklokt om ${Fmt.time(r.start)}` : 'Niet ingeklokt';
    const sum = iv => Fmt.duration(totalWorked(Store.entries.filter(e => Periods.contains(iv, e.start)), now));
    const tiles = [
      ['Vandaag', sum(Periods.day(now))],
      ['Deze week', sum(Periods.week(now))],
      ['Deze maand', sum(Periods.month(now))],
    ];
    $('#c-tiles').innerHTML = tiles.map(([t, v]) =>
      `<div class="tile"><div class="tile-title">${t}</div><div class="tile-value">${v}</div></div>`).join('');
  },

  clockIn() {
    const d = Store.draft;
    Store.add({
      start: Date.now(),
      projectNumber: d.projectNumber.trim(),
      workType: Store.settings.lastWorkType || Store.workTypes[0] || 'Allerlei',
      note: d.note,
      jobName: d.jobName.trim(),
      isPrivate: d.isPrivate,
    });
    navigator.vibrate?.(15);
    Store.changed();
  },

  clockOut() {
    const r = Store.running;
    if (!r) return;
    r.end = Date.now();
    Store.draft = { jobName: '', projectNumber: '', note: '', isPrivate: false };
    navigator.vibrate?.(15);
    Store.changed();
  },
};

// MARK: - Uren manueel invoeren of bewerken

/** Toevoegen (entry == null) of bewerken van een registratie. */
function openEntryEdit(entry, prefill = null) {
  const s = Store.settings;
  const today = new Date();
  const state = {
    jobName: entry?.jobName ?? prefill?.jobName ?? '',
    projectNumber: entry?.projectNumber ?? prefill?.projectNumber ?? '',
    workType: entry?.workType ?? prefill?.workType ?? s.lastWorkType ?? WorkTypes.defaults[0],
    // Nieuwe registraties starten met de uren die je de vorige keer manueel ingaf.
    day: entry ? new Date(entry.start) : today,
    startMinutes: entry ? D.minutesOf(entry.start) : s.manualStartMinutes,
    endMinutes: entry ? D.minutesOf(entry.end ?? Date.now()) : s.manualEndMinutes,
    stillRunning: entry ? entry.end == null : false,
    note: entry?.note ?? prefill?.note ?? '',
    isPrivate: entry?.isPrivate ?? prefill?.isPrivate ?? false,
  };
  const wasRunning = entry?.end == null && !!entry;

  const start = () => +D.atMinutes(state.day, state.startMinutes);
  /** Een einduur vóór het beginuur valt op de volgende dag. */
  const endsNextDay = () => state.endMinutes < state.startMinutes;
  const end = () => {
    const sameDay = D.atMinutes(state.day, state.endMinutes);
    return +(endsNextDay() ? D.addDays(sameDay, 1) : sameDay);
  };
  const isValid = () => state.stillRunning || end() > start();

  const body = el(`<div class="content">
    <div class="group">
      <div class="group-body">
        <div class="row"><span class="row-label">Werfnaam</span><div class="row-fill">${scanFieldHTML('e-job', 'werfnaam', state.jobName, 'words')}</div></div>
        <div class="row"><span class="row-label">Werfnummer</span><div class="row-fill">${scanFieldHTML('e-num', 'werfnummer', state.projectNumber, 'characters')}</div></div>
        <div class="row"><span class="row-label">Uitgevoerd werk</span><div class="row-fill"><select class="picker" id="e-type">${workTypeOptions(state.workType)}</select></div></div>
        <div class="row"><label for="e-priv" class="row-label">Privéwerk</label>${toggleHTML('e-priv', state.isPrivate)}</div>
      </div>
      <div class="group-footer">Privéwerk komt niet op het gewone rapport, maar op een apart privérapport.</div>
    </div>
    <div class="group">
      <div class="group-header">Tijd</div>
      <div class="group-body">
        <div class="row"><span class="row-label">Datum</span><div class="row-fill"><input type="date" class="picker-date" id="e-day" value="${D.ymd(state.day)}" required></div></div>
        <div class="row"><span class="row-label">Beginuur</span><div class="row-fill"><input type="time" class="picker-date" id="e-start" value="${D.hm(state.startMinutes)}" required></div></div>
        ${wasRunning ? `<div class="row"><label for="e-running" class="row-label">Klok loopt nog</label>${toggleHTML('e-running', state.stillRunning)}</div>` : ''}
        <div class="row e-endrow"><span class="row-label">Einduur</span><div class="row-fill"><input type="time" class="picker-date" id="e-end" value="${D.hm(state.endMinutes)}" required></div></div>
        <div class="row e-nextday"><span class="warn">${icon('moon')}Eindigt de volgende dag</span></div>
        <div class="row e-hours"><span class="row-label">Uren</span><span class="row-value num" id="e-hours"></span></div>
      </div>
    </div>
    <div class="group">
      <div class="group-header">Notitie</div>
      <div class="group-body"><div class="row"><textarea class="note" id="e-note" rows="2" placeholder="Wat heb je gedaan?">${esc(state.note)}</textarea></div></div>
    </div>
    <div class="group e-invalid"><div class="group-body"><div class="row error-row">${icon('warning')}Begin- en einduur mogen niet gelijk zijn.</div></div></div>
    ${entry ? '<div class="group"><div class="group-body"><button class="row button danger" type="button" id="e-delete">Registratie verwijderen</button></div></div>' : ''}
  </div>`);

  const sheet = openSheet({
    title: entry ? 'Uren bewerken' : 'Uren manueel invoeren',
    left: { label: 'Annuleer' },
    right: { label: 'Bewaar', bold: true, onClick: () => save() },
    body,
  });
  bindScanButtons(body);
  autosize($('#e-note', body));

  const update = () => {
    $('.e-endrow', body).classList.toggle('hidden', state.stillRunning);
    $('.e-hours', body).classList.toggle('hidden', state.stillRunning);
    $('.e-nextday', body).classList.toggle('hidden', state.stillRunning || !endsNextDay());
    $('#e-hours', body).textContent = Fmt.duration(workedMinutesMs(start(), end()));
    $('.e-invalid', body).classList.toggle('hidden', isValid());
    sheet.setRightDisabled(!isValid());
  };
  $('#e-job', body).addEventListener('input', e => { state.jobName = e.target.value; });
  $('#e-num', body).addEventListener('input', e => { state.projectNumber = e.target.value; });
  $('#e-type', body).addEventListener('change', e => { state.workType = e.target.value; });
  $('#e-priv', body).addEventListener('change', e => { state.isPrivate = e.target.checked; });
  $('#e-note', body).addEventListener('input', e => { state.note = e.target.value; });
  $('#e-day', body).addEventListener('change', e => { if (e.target.value) state.day = D.parseYmd(e.target.value); update(); });
  $('#e-start', body).addEventListener('change', e => { if (e.target.value) state.startMinutes = D.parseHm(e.target.value); update(); });
  $('#e-end', body).addEventListener('change', e => { if (e.target.value) state.endMinutes = D.parseHm(e.target.value); update(); });
  $('#e-running', body)?.addEventListener('change', e => {
    state.stillRunning = e.target.checked;
    // Einduur standaard op nu als je de klok stopt.
    if (!state.stillRunning) { state.endMinutes = D.minutesOf(new Date()); $('#e-end', body).value = D.hm(state.endMinutes); }
    update();
  });
  $('#e-delete', body)?.addEventListener('click', async () => {
    const choice = await actionSheet('Deze registratie verwijderen?', '', [{ label: 'Verwijder', role: 'destructive', value: 'delete' }]);
    if (choice === 'delete') {
      Store.remove(entry);
      Store.changed();
      sheet.close();
    }
  });
  update();

  function save() {
    if (!isValid()) return;
    const target = entry ?? Store.add({ start: start() });
    target.jobName = state.jobName.trim();
    target.projectNumber = state.projectNumber.trim();
    target.workType = state.workType;
    target.start = start();
    target.note = state.note;
    target.isPrivate = state.isPrivate;
    target.end = state.stillRunning ? null : end();
    if (!entry) {
      Store.settings.manualStartMinutes = state.startMinutes;
      Store.settings.manualEndMinutes = state.endMinutes;
    }
    Store.changed();
    sheet.close();
  }
}

// MARK: - Uren

const KINDS = [['work', 'Werk'], ['personal', 'Privé']];

const Entries = {
  /** Zoekt in werfnaam en werfnummer. */
  search: '',
  workType: null,
  kind: null,
  period: 'all',
  /** Een dag in de gekozen week of maand. */
  date: new Date(),

  init() {
    const v = $('#view-entries');
    v.innerHTML = `
      <header class="navbar"><div class="navbar-row"><div class="navbar-title">Uren</div>
        <div class="navbar-right"><button class="nav-btn" type="button" id="u-add" aria-label="Uren toevoegen">${icon('plus')}</button></div>
      </div></header>
      <div class="filterbar" id="u-filters"><div class="filterbar-inner">
        <div class="seg" id="u-period"><button type="button" data-p="all">Alles</button><button type="button" data-p="week">Week</button><button type="button" data-p="month">Maand</button></div>
        <div class="period-nav" id="u-nav">
          <button class="arrow" type="button" data-step="-1" aria-label="Vorige">${icon('left')}</button>
          <button class="title num" type="button" id="u-nav-title"></button>
          <button class="arrow" type="button" data-step="1" aria-label="Volgende">${icon('right')}</button>
        </div>
        <label class="search">${icon('search')}<input type="search" id="u-search" placeholder="Werfnaam of -nummer" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search">
          <button type="button" id="u-search-clear" class="hidden" aria-label="Wis zoekterm">${icon('xcircle')}</button></label>
        <div class="chips">
          <span class="chip" id="u-kind">${icon('person')}<span class="label"></span>${icon('down', 'down')}<select aria-label="Soort"></select></span>
          <span class="chip" id="u-type">${icon('hammer')}<span class="label"></span>${icon('down', 'down')}<select aria-label="Uitgevoerd werk"></select></span>
        </div>
        <div class="totals-line"><b class="num" id="u-total"></b><span class="count" id="u-count"></span>
          <button class="clear hidden" type="button" id="u-clear">Wis filters</button></div>
      </div></div>
      <div class="content" id="u-list"></div>`;

    $('#u-add').addEventListener('click', () => openEntryEdit(null));
    $$('#u-period button').forEach(b => b.addEventListener('click', () => {
      this.period = b.dataset.p;
      this.date = new Date();
      this.refresh();
    }));
    $$('#u-nav .arrow').forEach(b => b.addEventListener('click', () => {
      const n = Number(b.dataset.step);
      this.date = this.period === 'week' ? D.addDays(this.date, 7 * n) : D.addMonths(this.date, n);
      this.refresh();
    }));
    // Tik op de periode om terug te gaan naar deze week of maand.
    $('#u-nav-title').addEventListener('click', () => { this.date = new Date(); this.refresh(); });
    $('#u-search').addEventListener('input', e => { this.search = e.target.value; this.refresh(); });
    $('#u-search-clear').addEventListener('click', () => { this.search = ''; $('#u-search').value = ''; this.refresh(); });
    $('#u-kind select').addEventListener('change', e => { this.kind = e.target.value || null; this.refresh(); });
    $('#u-type select').addEventListener('change', e => { this.workType = e.target.value || null; this.refresh(); });
    $('#u-clear').addEventListener('click', () => {
      this.search = ''; this.workType = null; this.kind = null; this.period = 'all';
      $('#u-search').value = '';
      this.refresh();
    });
    setInterval(() => { if (currentTab === 1 && !document.hidden && Store.running) this.refresh(); }, 30000);
  },

  interval() {
    if (this.period === 'week') return Periods.week(this.date);
    if (this.period === 'month') return Periods.month(this.date);
    return null;
  },

  /** "Week 41: 05-10-2026 – 11-10-2026" of "Oktober 2026". */
  periodTitle() {
    const iv = this.interval();
    if (!iv) return '';
    if (this.period === 'month') return Fmt.month(this.date);
    return `Week ${D.isoWeek(iv.start)}: ${Fmt.date(iv.start)} – ${Fmt.date(+iv.end - 1)}`;
  },

  filtered() {
    const iv = this.interval();
    const text = this.search.trim().toLowerCase();
    return Store.entries.filter(e =>
      (!text || e.jobName.toLowerCase().includes(text) || e.projectNumber.toLowerCase().includes(text))
      && (this.workType == null || e.workType === this.workType)
      && (this.kind == null || e.isPrivate === (this.kind === 'personal'))
      && (!iv || Periods.contains(iv, e.start)))
      .sort((a, b) => b.start - a.start);
  },

  /** Keuzes uit Instellingen plus namen die alleen nog in oude registraties voorkomen. */
  workTypeNames() {
    const extra = [...new Set(Store.entries.map(e => e.workType))].filter(n => !Store.workTypes.includes(n)).sort();
    return [...Store.workTypes, ...extra];
  },

  refresh() {
    const hasEntries = Store.entries.length > 0;
    $('#u-filters').classList.toggle('hidden', !hasEntries);
    $$('#u-period button').forEach(b => b.classList.toggle('on', b.dataset.p === this.period));
    $('#u-nav').classList.toggle('hidden', this.period === 'all');
    $('#u-nav-title').textContent = this.periodTitle();
    $('#u-search-clear').classList.toggle('hidden', !this.search);

    const kindLabel = KINDS.find(k => k[0] === this.kind)?.[1] ?? 'Werk en privé';
    $('#u-kind .label').textContent = kindLabel;
    $('#u-kind').classList.toggle('on', this.kind != null);
    $('#u-kind select').innerHTML = `<option value="">Werk en privé</option>`
      + KINDS.map(([v, l]) => `<option value="${v}" ${v === this.kind ? 'selected' : ''}>${l}</option>`).join('');
    $('#u-type .label').textContent = this.workType ?? 'Alle werken';
    $('#u-type').classList.toggle('on', this.workType != null);
    $('#u-type select').innerHTML = `<option value="">Alle werken</option>`
      + this.workTypeNames().map(n => `<option value="${esc(n)}" ${n === this.workType ? 'selected' : ''}>${esc(n)}</option>`).join('');

    const list = this.filtered();
    const now = Date.now();
    $('#u-total').textContent = `Totaal: ${Fmt.hours(totalWorked(list, now))}`;
    $('#u-count').textContent = `· ${list.length} ${list.length === 1 ? 'registratie' : 'registraties'}`;
    const isFiltered = !!this.search || this.workType != null || this.kind != null || this.period !== 'all';
    $('#u-clear').classList.toggle('hidden', !isFiltered);

    const box = $('#u-list');
    if (!hasEntries) {
      box.innerHTML = `<div class="empty">${icon('clockq')}<h2>Nog geen uren</h2><p>Klok in via het tabblad Klok of voeg uren handmatig toe met +.</p></div>`;
      return;
    }
    if (!list.length) {
      box.innerHTML = `<div class="empty">${icon('filter')}<h2>Geen uren gevonden</h2><p>Er zijn geen uren voor deze filter. Kies een andere periode of wis de filters.</p></div>`;
      return;
    }
    // Per maand, nieuwste maand bovenaan.
    const months = new Map();
    for (const e of list) {
      const k = +D.monthStart(e.start);
      if (!months.has(k)) months.set(k, []);
      months.get(k).push(e);
    }
    box.innerHTML = '';
    for (const [month, entries] of [...months.entries()].sort((a, b) => b[0] - a[0])) {
      const group = el(`<div class="month-group">
        <div class="month-header"><span>${Fmt.month(month)}</span><span>${Fmt.hours(totalWorked(entries, now))}</span></div>
        <div class="group-body"></div></div>`);
      const body = $('.group-body', group);
      for (const e of entries) body.appendChild(this.row(e, now));
      box.appendChild(group);
    }
  },

  row(e, now) {
    const row = el(`<div class="swipe">
      <button class="swipe-action" type="button" tabindex="-1">Verwijder</button>
      <div class="swipe-content"><button class="entry" type="button">
        <div class="entry-main">
          <div class="entry-top"><span class="entry-date">${Fmt.date(e.start)}</span>
            ${e.projectNumber ? `<span class="badge">${esc(e.projectNumber)}</span>` : ''}
            ${e.isPrivate ? '<span class="badge private">Privé</span>' : ''}</div>
          <div class="entry-sub">${esc(e.workType)}${e.jobName ? ` · ${esc(e.jobName)}` : ''} · ${Fmt.time(e.start)} – ${e.end != null ? Fmt.time(e.end) : '<span class="running">bezig</span>'}</div>
          ${e.note ? `<div class="entry-note">${esc(e.note)}</div>` : ''}
        </div>
        <span class="entry-hours">${Fmt.duration(worked(e, now))}</span>
      </button></div></div>`);
    enableSwipe(row, () => openEntryEdit(e), () => { Store.remove(e); Store.changed(); });
    return row;
  },
};

/** Veeg naar links om te verwijderen (zoals in een lijst op iOS). */
let openSwipe = null;
function enableSwipe(row, onTap, onDelete) {
  const content = $('.swipe-content', row);
  const actionWidth = 96;
  let startX = 0, startY = 0, dx = 0, base = 0, dragging = null;
  const setX = (x, animate) => {
    content.classList.toggle('dragging', !animate);
    content.style.transform = x ? `translateX(${x}px)` : '';
  };
  const close = () => { setX(0, true); if (openSwipe === close) openSwipe = null; row.dataset.open = ''; };

  row.addEventListener('touchstart', e => {
    if (openSwipe && openSwipe !== close) openSwipe();
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    base = row.dataset.open ? -actionWidth : 0;
    dx = base;
    dragging = null;
  }, { passive: true });
  row.addEventListener('touchmove', e => {
    const x = e.touches[0].clientX - startX;
    const y = e.touches[0].clientY - startY;
    if (dragging === null && (Math.abs(x) > 8 || Math.abs(y) > 8)) dragging = Math.abs(x) > Math.abs(y);
    if (!dragging) return;
    e.preventDefault();
    dx = Math.min(0, base + x);
    setX(dx, false);
  }, { passive: false });
  row.addEventListener('touchend', () => {
    if (!dragging) return;
    if (dx < -row.offsetWidth * 0.6) { setX(-row.offsetWidth, true); setTimeout(onDelete, 200); }
    else if (dx < -actionWidth / 2) { setX(-actionWidth, true); row.dataset.open = '1'; openSwipe = close; }
    else close();
    dragging = null;
  });
  $('.entry', row).addEventListener('click', () => {
    if (row.dataset.open) { close(); return; }
    onTap();
  });
  $('.swipe-action', row).addEventListener('click', onDelete);
}

// MARK: - Rapport

const REPORT_PERIODS = [
  ['thisWeek', 'Deze week'], ['lastWeek', 'Vorige week'], ['thisMonth', 'Deze maand'], ['lastMonth', 'Vorige maand'],
  ['custom', 'Aangepast'],
];

const Reports = {
  period: 'thisWeek',
  /** Gewoon werk of privéwerk: nooit samen op hetzelfde rapport. */
  kind: 'work',
  customStart: D.addDays(new Date(), -14),
  customEnd: new Date(),
  jobName: '',
  projectNumber: '',

  init() {
    const v = $('#view-reports');
    v.innerHTML = `
      <header class="navbar"><div class="navbar-row"><div class="navbar-title">Rapport</div></div></header>
      <div class="content">
        <div class="group">
          <div class="seg" id="r-kind"><button type="button" data-k="work">Werk</button><button type="button" data-k="personal">Privé</button></div>
          <div class="group-footer" id="r-kind-note"></div>
        </div>
        <div class="group">
          <div class="group-header">Periode</div>
          <div class="group-body">
            <div class="row"><span class="row-label">Periode</span><div class="row-fill"><select class="picker" id="r-period">
              ${REPORT_PERIODS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div></div>
            <div class="row r-custom"><span class="row-label">Van</span><div class="row-fill"><input type="date" class="picker-date" id="r-from" required></div></div>
            <div class="row r-custom"><span class="row-label">Tot en met</span><div class="row-fill"><input type="date" class="picker-date" id="r-to" required></div></div>
            <div class="row"><span class="row-label">Werfnummer</span><div class="row-fill">${scanFieldHTML('r-num', 'werfnummer', '', 'characters')}</div></div>
            <div class="row"><span class="row-label">Werfnaam</span><div class="row-fill">${scanFieldHTML('r-job', 'werfnaam', '', 'words')}</div></div>
          </div>
        </div>
        <div class="group">
          <div class="group-header plain num" id="r-label"></div>
          <div class="report-tiles" id="r-tiles"></div>
        </div>
        <div class="group">
          <div class="group-header">Exporteren</div>
          <div class="group-body">
            <button class="row button" type="button" id="r-xlsx"><span class="icon-label">${icon('table')}Exporteer als Excel (.xlsx)</span></button>
            <button class="row button" type="button" id="r-pdf"><span class="icon-label">${icon('doc')}Exporteer als PDF</span></button>
          </div>
          <div class="group-footer">Uren in uren:minuten (9:45 is 9 uur en 45 minuten). Lopende registraties tellen pas mee nadat je hebt uitgeklokt.</div>
        </div>
        <div id="r-chart"></div>
        <div id="r-totals"></div>
      </div>`;
    bindScanButtons(v);
    $('#r-from').value = D.ymd(this.customStart);
    $('#r-to').value = D.ymd(this.customEnd);
    $$('#r-kind button').forEach(b => b.addEventListener('click', () => { this.kind = b.dataset.k; this.refresh(); }));
    $('#r-period').addEventListener('change', e => { this.period = e.target.value; this.refresh(); });
    $('#r-from').addEventListener('change', e => { if (e.target.value) { this.customStart = D.parseYmd(e.target.value); this.refresh(); } });
    $('#r-to').addEventListener('change', e => { if (e.target.value) { this.customEnd = D.parseYmd(e.target.value); this.refresh(); } });
    $('#r-num').addEventListener('input', e => { this.projectNumber = e.target.value; this.refresh(); });
    $('#r-job').addEventListener('input', e => { this.jobName = e.target.value; this.refresh(); });
    $('#r-xlsx').addEventListener('click', () => this.export(XLSXWriter));
    $('#r-pdf').addEventListener('click', () => this.export(PDFExporter));
  },

  interval(now = new Date()) {
    switch (this.period) {
      case 'thisWeek': return Periods.week(now);
      case 'lastWeek': return Periods.week(D.addDays(now, -7));
      case 'thisMonth': return Periods.month(now);
      case 'lastMonth': return Periods.month(D.addMonths(now, -1));
      default: {
        const a = D.startOfDay(Math.min(this.customStart, this.customEnd));
        const b = D.startOfDay(Math.max(this.customStart, this.customEnd));
        return { start: a, end: D.addDays(b, 1) };
      }
    }
  },

  /** Alleen afgeronde registraties tellen mee in het rapport. */
  entries() {
    const iv = this.interval();
    const number = this.projectNumber.trim().toLowerCase();
    const name = this.jobName.trim().toLowerCase();
    return Store.entries.filter(e => e.end != null
      && e.isPrivate === (this.kind === 'personal')
      && Periods.contains(iv, e.start)
      && (!name || e.jobName.toLowerCase().includes(name))
      && (!number || e.projectNumber.toLowerCase() === number))
      .sort((a, b) => a.start - b.start);
  },

  periodLabel() {
    const iv = this.interval();
    let label = `${Fmt.date(iv.start)} – ${Fmt.date(+iv.end - 1)}`;
    const number = this.projectNumber.trim();
    if (number) label += ` · werfnr. ${number}`;
    const name = this.jobName.trim();
    if (name) label += ` · ${name}`;
    return label;
  },

  /** Weekrapport, maandrapport, of urenrapport (zelf gekozen periode over meerdere weken). */
  layout() {
    if (this.period === 'thisWeek' || this.period === 'lastWeek') return 'week';
    if (this.period === 'thisMonth' || this.period === 'lastMonth') return 'month';
    const iv = this.interval();
    return +iv.end <= +Periods.week(iv.start).end ? 'week' : 'period';
  },

  refresh() {
    $$('#r-kind button').forEach(b => b.classList.toggle('on', b.dataset.k === this.kind));
    $('#r-kind-note').textContent = this.kind === 'personal'
      ? 'Alleen privéwerk. Gewoon werk staat op het werkrapport.'
      : 'Alleen gewoon werk. Privéwerk staat op een apart privérapport.';
    $('#r-period').value = this.period;
    $$('.r-custom').forEach(r => r.classList.toggle('hidden', this.period !== 'custom'));
    $('#r-label').textContent = this.periodLabel();

    const list = this.entries();
    const days = new Set(list.map(e => +D.startOfDay(e.start))).size;
    $('#r-tiles').innerHTML = [['Totaal uren', Fmt.hours(totalWorked(list))], ['Gewerkte dagen', days], ['Registraties', list.length]]
      .map(([t, v]) => `<div class="tile"><div class="tile-title">${t}</div><div class="tile-value">${v}</div></div>`).join('');

    this.renderChart(list);

    const totals = key => {
      const m = new Map();
      for (const e of list) m.set(key(e), (m.get(key(e)) ?? 0) + worked(e));
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const section = (title, items) => !items.length ? '' : `<div class="group"><div class="group-header">${title}</div>
      <div class="group-body">${items.map(([n, w]) => `<div class="row"><span class="row-label">${esc(n)}</span><span class="row-value num">${Fmt.hours(w)}</span></div>`).join('')}</div></div>`;
    $('#r-totals').innerHTML = section('Per uitgevoerd werk', totals(e => e.workType))
      + section('Per werfnummer', totals(e => e.projectNumber || 'Zonder nummer'));
  },

  /** Staafdiagram: uren per dag, of per maand bij een periode langer dan 62 dagen. */
  renderChart(list) {
    const box = $('#r-chart');
    if (!list.length) { box.innerHTML = ''; return; }
    const iv = this.interval();
    const byMonth = (+iv.end - +iv.start) > 62 * DAY_MS;
    const bucket = t => +(byMonth ? D.monthStart(t) : D.startOfDay(t));
    const next = d => byMonth ? D.addMonths(d, 1) : D.addDays(d, 1);
    const values = new Map();
    for (const e of list) values.set(bucket(e.start), (values.get(bucket(e.start)) ?? 0) + worked(e));
    const buckets = [];
    for (let d = new Date(bucket(iv.start)); d < iv.end; d = next(d)) buckets.push({ t: +d, ms: values.get(+d) ?? 0 });

    const W = 320, H = 180, left = 28, bottom = 20, top = 8;
    const maxHours = Math.max(...buckets.map(b => b.ms / 3600000), 1);
    const step = [1, 2, 4, 5, 10, 20, 25, 50, 100, 200].find(s => maxHours / s <= 4) ?? 500;
    const yMax = Math.ceil(maxHours / step) * step;
    const plotW = W - left, plotH = H - bottom - top;
    const slot = plotW / buckets.length;
    const barW = Math.max(2, Math.min(28, slot - 2));
    const y = h => top + plotH - (h / yMax) * plotH;

    let svg = '';
    for (let v = 0; v <= yMax; v += step) {
      svg += `<line class="grid" x1="${left}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`
        + `<text class="axis-label" x="${left - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
    }
    const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
    const shortMonths = ['jan.', 'feb.', 'mrt.', 'apr.', 'mei', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];
    buckets.forEach((b, i) => {
      const x = left + i * slot + (slot - barW) / 2;
      const hours = b.ms / 3600000;
      if (hours > 0) {
        const yy = y(hours), hgt = top + plotH - yy, r = Math.min(4, barW / 2, hgt);
        // Afgeronde bovenkant, rechte onderkant op de basislijn.
        svg += `<path class="bar" data-i="${i}" d="M${x},${top + plotH} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + barW - r} Q${x + barW},${yy} ${x + barW},${yy + r} V${top + plotH} Z"/>`;
      }
      svg += `<rect class="hit" data-i="${i}" x="${left + i * slot}" y="${top}" width="${slot}" height="${plotH}"/>`;
      if (i % labelEvery === 0) {
        const d = new Date(b.t);
        const label = byMonth ? shortMonths[d.getMonth()] : `${d.getDate()}/${d.getMonth() + 1}`;
        svg += `<text class="axis-label" x="${left + i * slot + slot / 2}" y="${H - 4}" text-anchor="middle">${label}</text>`;
      }
    });

    box.innerHTML = `<div class="group"><div class="group-header">Uren per ${byMonth ? 'maand' : 'dag'}</div>
      <div class="group-body chart-card chart"><div class="chart-tip" id="r-tip">Tik op een staaf voor de uren.</div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Uren per ${byMonth ? 'maand' : 'dag'}">${svg}</svg></div></div>`;
    const tip = $('#r-tip', box);
    const show = i => {
      const b = buckets[i];
      const label = byMonth ? Fmt.month(b.t) : `${FormReport.dayNames[D.dayIndex(b.t)]} ${Fmt.date(b.t)}`;
      tip.innerHTML = `${esc(label)}: <b>${Fmt.hours(b.ms)}</b>`;
      $$('.bar', box).forEach(p => p.classList.toggle('dim', Number(p.dataset.i) !== i));
    };
    $$('.hit', box).forEach(r => {
      r.addEventListener('click', () => show(Number(r.dataset.i)));
      r.addEventListener('mouseenter', () => show(Number(r.dataset.i)));
    });
  },

  makeReport() {
    return makeReportData({
      userName: Store.settings.userName, periodLabel: this.periodLabel(), interval: this.interval(),
      entries: this.entries(), workTypes: [...Store.workTypes], layout: this.layout(), isPrivate: this.kind === 'personal',
    });
  },

  async export(writer) {
    const buttons = [$('#r-xlsx'), $('#r-pdf')];
    buttons.forEach(b => { b.disabled = true; });
    try {
      const file = await writer.write(this.makeReport());
      openExportPreview(file);
    } catch (err) {
      console.error(err);
      alertBox('Exporteren mislukt', err.message || String(err));
    } finally {
      buttons.forEach(b => { b.disabled = false; });
    }
  },
};

/** Toont een geëxporteerd bestand (PDF of Excel), met een knop om het te delen. */
function openExportPreview(file) {
  const body = el('<div class="preview"><div class="scan-status"><span class="spinner"></span>Voorbeeld maken…</div></div>');
  openSheet({
    title: file.name, full: true,
    left: { label: 'Klaar' },
    right: { icon: 'share', label: 'Delen', aria: 'Delen', onClick: () => shareFile(file.blob, file.name) },
    body,
  });
  setTimeout(() => renderPreview(file, body).catch(err => {
    console.error(err);
    body.innerHTML = '<div class="scan-status">Geen voorbeeld beschikbaar. Tik op Delen om het bestand te openen of te bewaren.</div>';
  }), 350);
}

// MARK: - Instellingen

const Settings = {
  init() {
    const v = $('#view-settings');
    const s = Store.settings;
    v.innerHTML = `
      <header class="navbar"><div class="navbar-row"><div class="navbar-title">Instellingen</div></div></header>
      <div class="content">
        <div class="group">
          <div class="group-header">Profiel</div>
          <div class="group-body"><div class="row"><input class="input-plain" style="text-align:left" id="s-name" type="text" placeholder="Je naam" autocomplete="name" autocapitalize="words"></div></div>
          <div class="group-footer">Je naam staat bovenaan geëxporteerde rapporten.</div>
        </div>
        <div class="group">
          <div class="group-header">Keuzelijsten</div>
          <div class="group-body"><button class="row link" type="button" id="s-types">
            <span class="icon-label">${icon('hammer')}Uitgevoerde werken</span>
            <span class="row-value num" id="s-types-count"></span><span class="chev">${icon('right')}</span></button></div>
        </div>
        <div class="group">
          <div class="group-header">Opslag</div>
          <div class="group-body"><div class="row"><span class="row-label">Status</span><span class="row-value icon-label" style="gap:6px">${icon('phone')}Op dit toestel</span></div>
            <div class="row"><span class="row-label">Automatisch wissen</span><span class="row-value" id="s-protect"></span></div></div>
          <div class="group-footer"><p>Je uren staan alleen op dit toestel, niet op een server. Maak regelmatig een back-up, zodat je niets kwijtraakt als je toestel stuk of verloren gaat.</p>
          <p id="s-install-note"></p></div>
        </div>
        <div class="group">
          <div class="group-header">Back-up</div>
          <div class="group-body">
            <button class="row button" type="button" id="s-share"><span class="icon-label">${icon('share')}Back-up delen</span></button>
            <button class="row button" type="button" id="s-save"><span class="icon-label">${icon('download')}Back-up opslaan op toestel</span></button>
            <button class="row button" type="button" id="s-restore"><span class="icon-label">${icon('restore')}Back-up terugzetten</span></button>
            <div class="row"><label for="s-remind" class="row-label">Wekelijkse herinnering</label>${toggleHTML('s-remind', s.backupReminder)}</div>
            <div class="row s-remind-row"><span class="row-label">Dag</span><div class="row-fill"><select class="picker" id="s-day">
              ${BackupReminder.weekdays.map(([n, d]) => `<option value="${d}">${n}</option>`).join('')}</select></div></div>
            <div class="row s-remind-row"><span class="row-label">Uur</span><div class="row-fill"><input type="time" class="picker-date" id="s-time" required></div></div>
          </div>
          <div class="group-footer"><p>Bewaar een kopie van al je uren als bestand: deel ze via WhatsApp of mail, of bewaar ze in Bestanden of iCloud Drive. Met de wekelijkse herinnering vraagt de app je om dat te doen als je hem opent na het gekozen moment.</p>
          <p id="s-last"></p></div>
          <input type="file" id="s-file" accept=".json,application/json" class="hidden">
        </div>
        <div class="group">
          <div class="group-body"><div class="row"><span class="row-label">Versie</span><span class="row-value">1.0 (web)</span></div></div>
          <div class="footer-logo" role="img" aria-label="e. baillien"></div>
        </div>
      </div>`;

    $('#s-name').addEventListener('input', e => { Store.settings.userName = e.target.value; Store.save(); });
    $('#s-types').addEventListener('click', openWorkTypes);
    $('#s-share').addEventListener('click', () => shareBackup());
    $('#s-save').addEventListener('click', () => saveBackup());
    $('#s-restore').addEventListener('click', () => { $('#s-file').value = ''; $('#s-file').click(); });
    $('#s-file').addEventListener('change', e => openBackup(e.target.files[0]));
    const reminderChanged = () => {
      // Vanaf nu tellen: een moment dat al voorbij is, vraagt niet meteen om een back-up.
      Store.settings.reminderHandled = Date.now();
      Store.save();
      this.refresh();
    };
    $('#s-remind').addEventListener('change', e => { Store.settings.backupReminder = e.target.checked; reminderChanged(); });
    $('#s-day').addEventListener('change', e => { Store.settings.backupReminderDay = Number(e.target.value); reminderChanged(); });
    $('#s-time').addEventListener('change', e => { if (e.target.value) { Store.settings.backupReminderMinutes = D.parseHm(e.target.value); reminderChanged(); } });
  },

  refresh() {
    const s = Store.settings;
    const name = $('#s-name');
    if (document.activeElement !== name) name.value = s.userName;
    $('#s-types-count').textContent = Store.workTypes.length;
    $('#s-remind').checked = s.backupReminder;
    $$('.s-remind-row').forEach(r => r.classList.toggle('hidden', !s.backupReminder));
    $('#s-day').value = String(s.backupReminderDay);
    $('#s-time').value = D.hm(s.backupReminderMinutes);
    $('#s-last').textContent = s.lastBackupDate
      ? `Laatste back-up: ${Fmt.date(s.lastBackupDate)} om ${Fmt.time(s.lastBackupDate)}` : '';
    $('#s-install-note').textContent = isStandalone() ? ''
      : 'Zet de app op je beginscherm (in Safari: deel-icoon en dan Zet op beginscherm). Anders kan Safari je uren wissen als je de app een tijd niet gebruikt.';
    storageProtected().then(ok => {
      const box = $('#s-protect');
      box.textContent = ok ? 'Beschermd' : 'Niet beschermd';
      box.style.color = ok ? 'var(--green)' : 'var(--orange)';
    });
  },
};

/**
 * Beschermd tegen automatisch wissen: als app op het beginscherm (iOS wist dan niets na 7 dagen, want de teller
 * loopt alleen als je de app gebruikt), of als de browser de opslag als blijvend heeft aangeduid.
 */
async function storageProtected() {
  if (isIOS()) return isStandalone();
  try { return isStandalone() || !!(await navigator.storage?.persisted?.()); } catch { return isStandalone(); }
}

function backupBlob() { return new Blob([Backup.encoded()], { type: 'application/json' }); }

function markBackedUp() {
  Store.settings.lastBackupDate = Date.now();
  Store.settings.reminderHandled = Date.now();
  Store.save();
  Settings.refresh();
}

/** Back-up als bestand delen via het deelmenu (WhatsApp, mail, AirDrop, …). */
async function shareBackup() {
  try {
    if (await shareFile(backupBlob(), Backup.fileName)) markBackedUp();
  } catch (err) {
    alertBox('Back-up', `Back-up maken mislukt: ${err.message}`);
  }
}

async function saveBackup() {
  try {
    // Als app op het beginscherm van een iPhone kan Safari niet downloaden: dan via "Bewaar in Bestanden".
    if (isIOS() && isStandalone()) {
      if (await shareFile(backupBlob(), Backup.fileName)) markBackedUp();
    } else {
      download(backupBlob(), Backup.fileName);
      markBackedUp();
      alertBox('Back-up', 'De back-up is opgeslagen.');
    }
  } catch (err) {
    alertBox('Back-up', `Opslaan mislukt: ${err.message}`);
  }
}

async function openBackup(file) {
  if (!file) return;
  let backup;
  try {
    backup = Backup.decode(await file.text());
  } catch (err) {
    alertBox('Back-up', err.message);
    return;
  }
  const choice = await actionSheet(
    `Back-up van ${Fmt.date(backup.exportedAt)} met ${backup.entries.length} registraties terugzetten?`,
    'Samenvoegen voegt alleen registraties toe die nog niet bestaan. Alles vervangen wist eerst al je huidige uren. In beide gevallen worden ook je naam, de keuzelijst en de instellingen teruggezet.',
    [{ label: 'Samenvoegen met huidige uren', value: 'merge' }, { label: 'Alles vervangen', role: 'destructive', value: 'replace' }]);
  if (!choice) return;
  try {
    const result = Backup.restore(backup, choice === 'replace');
    let message = `${result.added} registraties teruggezet.`;
    if (result.skipped > 0) message += ` ${result.skipped} bestonden al en zijn overgeslagen.`;
    alertBox('Back-up', message);
  } catch (err) {
    alertBox('Back-up', `Terugzetten mislukt: ${err.message}`);
  }
}

/** Bij het openen van de app: vragen om een back-up als het gekozen moment voorbij is. */
async function checkBackupReminder() {
  if (!BackupReminder.isDue() || isOverlayOpen()) return;
  Store.settings.reminderHandled = Date.now();
  Store.save();
  showTab(3);
  const choice = await alertBox('Tijd voor een back-up', 'Maak een kopie van je uren, zodat je niets kwijtraakt.', [
    { label: 'Delen', value: 'share' }, { label: 'Opslaan op toestel', value: 'save' }, { label: 'Later', role: 'cancel', value: 'later' },
  ]);
  if (choice === 'share') shareBackup();
  if (choice === 'save') saveBackup();
}

// MARK: - Uitgevoerde werken

function openWorkTypes() {
  let editing = false;
  const body = el('<div class="content"><div class="group"><div class="group-body" id="w-list"></div><div class="group-footer" id="w-footer"></div></div></div>');
  const sheet = openSheet({
    title: 'Uitgevoerde werken',
    left: { label: 'Klaar', bold: true },
    right: { label: 'Wijzig', onClick: api => { editing = !editing; api.rightBtn.textContent = editing ? 'Gereed' : 'Wijzig'; render(); } },
    body,
    onClose: () => Store.changed(),
  });

  const missingDefaults = () => {
    const current = new Set(Store.workTypes.map(n => n.toLowerCase()));
    return WorkTypes.defaults.filter(n => !current.has(n.toLowerCase()));
  };

  function render() {
    const list = $('#w-list', body);
    list.innerHTML = '';
    Store.workTypes.forEach((name, i) => {
      const row = el(`<div class="row">
        ${editing ? `<button class="minus" type="button" aria-label="Verwijder ${esc(name)}">${icon('minus')}</button>` : ''}
        <button class="row-label w-name" type="button" style="flex:1;text-align:left">${esc(name)}</button>
        ${editing ? `<button class="reorder" type="button" data-move="-1" aria-label="Omhoog" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
          <button class="reorder" type="button" data-move="1" aria-label="Omlaag" ${i === Store.workTypes.length - 1 ? 'disabled' : ''}>${icon('down')}</button>` : ''}
      </div>`);
      $('.w-name', row).addEventListener('click', () => rename(name));
      $('.minus', row)?.addEventListener('click', async () => {
        const choice = await actionSheet(`"${name}" verwijderen?`, 'Bestaande uren behouden hun werk.', [{ label: 'Verwijder', role: 'destructive', value: 'delete' }]);
        if (choice === 'delete') { Store.workTypes.splice(Store.workTypes.indexOf(name), 1); Store.save(); render(); }
      });
      $$('.reorder', row).forEach(b => b.addEventListener('click', () => {
        const j = i + Number(b.dataset.move);
        [Store.workTypes[i], Store.workTypes[j]] = [Store.workTypes[j], Store.workTypes[i]];
        Store.save();
        render();
      }));
      list.appendChild(row);
    });
    const add = el(`<button class="row button" type="button"><span class="icon-label">${icon('plus')}Nieuw werk</span></button>`);
    add.addEventListener('click', addNew);
    list.appendChild(add);
    if (missingDefaults().length) {
      const restore = el('<button class="row button" type="button">Standaardkeuzes terugzetten</button>');
      restore.addEventListener('click', () => { Store.workTypes.push(...missingDefaults()); Store.save(); render(); });
      list.appendChild(restore);
    }
    $('#w-footer', body).textContent = 'Tik om te hernoemen, en tik op Wijzig om te verwijderen of de volgorde te veranderen. Bestaande uren behouden hun werk, ook als je een keuze verwijdert.';
  }

  async function addNew() {
    const r = await alertBox('Nieuw uitgevoerd werk', '', [{ label: 'Annuleer', role: 'cancel', value: 'cancel' }, { label: 'Bewaar', value: 'save' }],
      { input: { placeholder: 'Naam', value: '' } });
    if (r.value !== 'save') return;
    const clean = WorkTypes.clean(r.text);
    if (!clean || Store.workTypes.some(n => n.toLowerCase() === clean.toLowerCase())) return;
    Store.workTypes.push(clean);
    Store.save();
    render();
  }

  async function rename(old) {
    const r = await alertBox('Werk hernoemen', 'Uren met deze keuze krijgen ook de nieuwe naam.',
      [{ label: 'Annuleer', role: 'cancel', value: 'cancel' }, { label: 'Bewaar', value: 'save' }], { input: { placeholder: 'Naam', value: old } });
    if (r.value !== 'save') return;
    const clean = WorkTypes.clean(r.text);
    if (!clean || clean === old) return;
    const exists = Store.workTypes.some(n => n.toLowerCase() === clean.toLowerCase());
    if (exists && clean.toLowerCase() !== old.toLowerCase()) return;
    Store.workTypes[Store.workTypes.indexOf(old)] = clean;
    for (const e of Store.entries) if (e.workType === old) e.workType = clean;
    if (Store.settings.lastWorkType === old) Store.settings.lastWorkType = clean;
    Store.save();
    render();
  }

  render();
  return sheet;
}

// MARK: - Scannen
// De scanknop opent meteen de camera. Op de foto krijgt de gevonden tekst kaders; tik op de tekst en dat stuk
// wordt opnieuw gelezen op volle scherpte, net als de tekstscanner van de iPhone-app.

let ocrWorker = null;

function getOcrWorker() {
  if (!ocrWorker) {
    const base = new URL('vendor/tesseract/', location.href).href;
    ocrWorker = Tesseract.createWorker(['nld', 'eng'], 1, {
      workerPath: base + 'worker.min.js',
      corePath: base,
      langPath: base + 'lang',
      workerBlobURL: false,
    }).then(async worker => {
      await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' });
      return worker;
    }).catch(err => { ocrWorker = null; throw err; });
  }
  return ocrWorker;
}

/** Leest een beeld met een gegeven paginaindeling (7 = één regel, 6 = blok, 11 = losse tekst). */
let ocrMode = null;
async function ocr(canvas, mode) {
  const worker = await getOcrWorker();
  if (ocrMode !== mode) {
    await worker.setParameters({ tessedit_pageseg_mode: String(mode) });
    ocrMode = mode;
  }
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  return data;
}

/** Opent meteen de camera van het toestel. */
function takePhoto(onPhoto) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('capture', 'environment');
  input.className = 'hidden';
  document.body.appendChild(input);
  input.addEventListener('change', () => { const file = input.files[0]; input.remove(); if (file) onPhoto(file); });
  input.addEventListener('cancel', () => input.remove());
  input.click();
}

/** Laadt een foto rechtop: een <img> volgt de draaiing die de camera in het bestand zet. */
function loadPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Deze foto kan niet geopend worden.')); };
    img.src = url;
  });
}

// Beeldbewerking: grijs, contrast oprekken en schaduwen wegwerken, zodat de tekstherkenning beter leest.

function grayPixels(canvas) {
  const { width: w, height: h } = canvas;
  const rgba = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return gray;
}

/** Rekt het contrast op tussen de donkerste en lichtste 2 % van de pixels. */
function stretchContrast(gray) {
  const hist = new Uint32Array(256);
  for (const v of gray) hist[v]++;
  const cut = gray.length * 0.02;
  let lo = 0, hi = 255, n = 0;
  while (lo < 255 && (n += hist[lo]) < cut) lo++;
  n = 0;
  while (hi > 0 && (n += hist[hi]) < cut) hi--;
  if (hi - lo < 10) return gray;
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) out[i] = (gray[i] - lo) * 255 / (hi - lo);
  return out;
}

/** Zwart-wit met een drempel per omgeving (Bradley), zodat schaduwen en ongelijk licht verdwijnen. */
function adaptiveThreshold(gray, w, h, size, t = 0.15) {
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * iw + x + 1] = integral[y * iw + x + 1] + row;
    }
  }
  const out = new Uint8ClampedArray(gray.length);
  const r = Math.max(4, Math.floor(size / 2));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * iw + x1 + 1] - integral[y0 * iw + x1 + 1] - integral[(y1 + 1) * iw + x0] + integral[y0 * iw + x0];
      out[y * w + x] = gray[y * w + x] * count <= sum * (1 - t) ? 0 : 255;
    }
  }
  return out;
}

function grayCanvas(gray, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    img.data[j] = img.data[j + 1] = img.data[j + 2] = gray[i];
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Tekent een stuk van `source` op schaal `scale`, met witte rand. */
function cropCanvas(source, x, y, w, h, scale, border = 0) {
  // Een <video> of <img> heeft zijn echte afmetingen in videoWidth of naturalWidth.
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  w = Math.min(sw - x, Math.ceil(w));
  h = Math.min(sh - y, Math.ceil(h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale) + border * 2);
  c.height = Math.max(1, Math.round(h * scale) + border * 2);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, x, y, w, h, border, border, w * scale, h * scale);
  return c;
}

/** Tekens die rond een woord niet bij de tekst horen. */
const cleanScan = s => s.replace(/\s+/g, ' ')
  .replace(/^[\s|.,:;'"`’‘“”()[\]{}<>«»_~*]+|[\s|.,:;'"`’‘“”()[\]{}<>«»_~*]+$/g, '');

/** Werfnummers: geen spaties rond - en /, en letters die op cijfers lijken worden cijfers. */
function cleanNumber(s) {
  s = s.replace(/\s*([-/])\s*/g, '$1');
  return s.split(' ').map(token => {
    const digits = (token.match(/\d/g) ?? []).length;
    if (digits < token.replace(/[-/.]/g, '').length / 2) return token;
    return token.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8');
  }).join(' ');
}

function ocrLines(data, minConf = 25) {
  let lines = data.lines;
  if (!lines?.length && data.blocks) {
    lines = data.blocks.flatMap(b => (b.paragraphs ?? []).flatMap(p => p.lines ?? []));
  }
  return (lines ?? []).map(l => ({
    text: cleanScan(l.text ?? ''),
    bbox: l.bbox,
    conf: l.confidence ?? 100,
    words: (l.words ?? []).map(w => cleanScan(w.text ?? '')).filter(Boolean),
  })).filter(l => l.text && l.conf > minConf);
}

/** Opent de camera, en daarna de foto om op de tekst te tikken. */
function startScan(subject, onScan) {
  if (navigator.mediaDevices?.getUserMedia) openLiveScanner(subject, onScan);
  else takePhoto(file => openScanResult(subject, file, onScan));
}

/**
 * Live scannen: de camera in beeld met een richtkader. Wat in het kader staat, wordt telkens opnieuw gelezen;
 * tik op de herkende tekst om ze over te nemen.
 */
function openLiveScanner(subject, onScan) {
  const the = subject === 'werfnummer' ? 'het' : 'de';
  const body = el(`<div class="live">
    <video playsinline muted autoplay></video>
    <div class="live-center">
      <div class="live-hint">Richt het kader op ${the} ${esc(subject)}</div>
      <div class="live-frame"></div>
      <div class="live-result"><div class="live-status"><span class="spinner"></span>Camera starten…</div></div>
    </div>
    <div class="live-tools">
      <button type="button" class="live-tool" id="lv-photo">${icon('camera')}<span>Foto</span></button>
      <button type="button" class="live-tool hidden" id="lv-zoom"><b>1×</b><span>Zoom</span></button>
      <button type="button" class="live-tool hidden" id="lv-torch">${icon('flash')}<span>Lamp</span></button>
    </div>
  </div>`);
  let stream = null;
  let running = true;
  const sheet = openSheet({
    title: `${capitalize(subject)} scannen`, full: true, dark: true,
    left: { label: 'Annuleer' }, body,
    onClose: () => { running = false; stream?.getTracks().forEach(t => t.stop()); },
  });
  sheet.el.classList.add('live-sheet');
  const video = $('video', body);
  const frame = $('.live-frame', body);
  const result = $('.live-result', body);
  const setStatus = (text, busy = false) => {
    result.innerHTML = `<div class="live-status">${busy ? '<span class="spinner"></span>' : ''}${esc(text)}</div>`;
  };
  const clean = text => subject === 'werfnummer' ? cleanNumber(text) : text;
  const take = text => { onScan(clean(text)); sheet.close(); };

  // Overschakelen naar een foto (handig bij kleine tekst of handschrift).
  $('#lv-photo', body).addEventListener('click', () => takePhoto(file => {
    sheet.close();
    openScanResult(subject, file, onScan);
  }));

  start();

  async function start() {
    getOcrWorker().catch(() => {});
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
    } catch (err) {
      console.warn(err);
      if (!running) return;
      result.innerHTML = `<div class="live-status">Geen toegang tot de camera. Geef toegang via Instellingen › Safari › Camera, of neem een foto.</div>
        <button type="button" class="live-pick" id="lv-photo2">${icon('camera')} Foto nemen</button>`;
      $('#lv-photo2', result).addEventListener('click', () => $('#lv-photo', body).click());
      return;
    }
    if (!running) { stream.getTracks().forEach(t => t.stop()); return; }
    video.srcObject = stream;
    try { await video.play(); } catch { /* start vanzelf */ }
    setupTools(stream.getVideoTracks()[0]);
    setStatus('Tekstherkenning starten…', true);
    loop();
  }

  /** Zoom en lamp, als het toestel ze ondersteunt. */
  function setupTools(track) {
    const caps = track?.getCapabilities?.() ?? {};
    if (caps.zoom && caps.zoom.max >= 2) {
      const btn = $('#lv-zoom', body);
      const levels = [Math.max(1, caps.zoom.min), 2, Math.min(3, caps.zoom.max)].filter((v, i, a) => a.indexOf(v) === i);
      let i = 0;
      btn.classList.remove('hidden');
      btn.addEventListener('click', () => {
        i = (i + 1) % levels.length;
        track.applyConstraints({ advanced: [{ zoom: levels[i] }] }).catch(() => {});
        $('b', btn).textContent = `${levels[i]}×`;
      });
    }
    if (caps.torch) {
      const btn = $('#lv-torch', body);
      let on = false;
      btn.classList.remove('hidden');
      btn.addEventListener('click', () => {
        on = !on;
        track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
        btn.classList.toggle('on', on);
      });
    }
  }

  /** Het stuk van het camerabeeld dat in het kader staat (de video vult het scherm met object-fit: cover). */
  function frameCrop() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const v = video.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const scale = Math.max(v.width / vw, v.height / vh);
    const dx = (v.width - vw * scale) / 2, dy = (v.height - vh * scale) / 2;
    const x = (f.left - v.left - dx) / scale, y = (f.top - v.top - dy) / scale;
    const w = f.width / scale, h = f.height / scale;
    // Vergroten of verkleinen tot een hoogte waarbij de tekst goed leesbaar is.
    const k = Math.min(3, 120 / h);
    return cropCanvas(video, x, y, w, h, k, 10);
  }

  // Laatste uitkomsten: een tekst die twee keer na elkaar gelezen wordt, is zeker.
  let last = '';
  let shown = '';
  async function loop() {
    let variant = 0;
    while (running) {
      if (document.hidden || video.readyState < 2) { await new Promise(r => setTimeout(r, 300)); continue; }
      const crop = frameCrop();
      if (!crop) { await new Promise(r => setTimeout(r, 200)); continue; }
      try {
        const gray = stretchContrast(grayPixels(crop));
        // Om beurten grijs en zwart-wit (tegen schaduw en glans).
        const pixels = variant++ % 2 ? adaptiveThreshold(gray, crop.width, crop.height, 60) : gray;
        const data = await ocr(grayCanvas(pixels, crop.width, crop.height), 7);
        if (!running) return;
        const line = ocrLines(data, 0).sort((a, b) => b.conf - a.conf)[0];
        const text = line && (data.confidence ?? 0) >= 45 ? line.text : '';
        if (text) {
          const sure = text === last;
          last = text;
          if (sure || !shown) show(line, sure);
        } else {
          last = '';
          if (!shown) setStatus(`Zoeken naar tekst…`);
        }
      } catch (err) {
        console.error(err);
        if (!running) return;
        setStatus('Tekst herkennen is mislukt. Neem een foto.');
        return;
      }
      await new Promise(r => setTimeout(r, 80));
    }
  }

  function show(line, sure) {
    if (line.text === shown && !sure) return;
    shown = line.text;
    const words = line.words.length > 1 ? line.words : [];
    result.innerHTML = `<button type="button" class="live-pick ${sure ? 'sure' : ''}">${esc(clean(line.text))}</button>
      ${words.length ? `<div class="live-words">${words.map(w => `<button type="button">${esc(clean(w))}</button>`).join('')}</div>` : ''}
      <div class="live-status small">Tik om over te nemen</div>`;
    $('.live-pick', result).addEventListener('click', () => take(line.text));
    $$('.live-words button', result).forEach((b, i) => b.addEventListener('click', () => take(words[i])));
  }
}

function openScanResult(subject, firstFile, onScan) {
  const body = el(`<div>
    <div class="scan-status" id="sc-status"></div>
    <div class="scan-stage hidden" id="sc-stage"></div>
    <div class="scan-choices" id="sc-choices"></div>
    <div class="content"><button class="btn tinted" type="button" id="sc-again">${icon('camera')}Nieuwe foto</button></div>
    <div class="group-footer" style="padding:0 32px 24px;text-align:center">Lukt het niet, bijvoorbeeld bij handschrift? Tik dan in het tekstveld en kies <b>Scan tekst</b> van je iPhone.</div>
  </div>`);
  const sheet = openSheet({ title: `${capitalize(subject)} scannen`, left: { label: 'Annuleer' }, body });
  const status = $('#sc-status', body);
  const stage = $('#sc-stage', body);
  const choices = $('#sc-choices', body);
  const the = subject === 'werfnummer' ? 'het' : 'de';
  const setStatus = (text, busy = false) => { status.innerHTML = `${busy ? '<span class="spinner"></span>' : ''}${esc(text)}`; };
  const finish = text => {
    onScan(subject === 'werfnummer' ? cleanNumber(text) : text);
    sheet.close();
  };
  // Alleen het laatste verzoek telt (bij een nieuwe foto of een nieuwe tik).
  let job = 0;
  let photo = null;
  let lineHeight = 0;

  $('#sc-again', body).addEventListener('click', () => takePhoto(process));
  process(firstFile);

  async function process(file) {
    const id = ++job;
    stage.classList.add('hidden');
    stage.innerHTML = '';
    choices.innerHTML = '';
    setStatus('Foto laden…', true);
    let img;
    try { img = await loadPhoto(file); } catch (err) { setStatus(err.message); return; }

    // Volledige foto (max. 3200 px) om stukken scherp uit te knippen; kleinere versie om tekst te zoeken.
    const full = Math.min(1, 3200 / Math.max(img.naturalWidth, img.naturalHeight));
    photo = cropCanvas(img, 0, 0, img.naturalWidth, img.naturalHeight, full);
    const small = Math.min(1, 1600 / Math.max(photo.width, photo.height));
    const view = cropCanvas(photo, 0, 0, photo.width, photo.height, small);
    stage.appendChild(view);
    stage.classList.remove('hidden');
    if (id !== job) return;

    setStatus('Tekst zoeken…', true);
    let lines;
    try {
      const gray = stretchContrast(grayPixels(view));
      lines = ocrLines(await ocr(grayCanvas(gray, view.width, view.height), 11), 15);
    } catch (err) {
      console.error(err);
      if (id === job) setStatus('Tekst herkennen is mislukt. Probeer opnieuw of typ de tekst in.');
      return;
    }
    if (id !== job) return;

    const heights = lines.map(l => (l.bbox.y1 - l.bbox.y0) / small).sort((a, b) => a - b);
    lineHeight = heights.length ? heights[Math.floor(heights.length / 2)] : photo.height * 0.03;
    for (const line of lines) {
      const b = line.bbox;
      const box = el(`<button class="scan-box" type="button" aria-label="${esc(line.text)}"></button>`);
      Object.assign(box.style, {
        left: `${b.x0 / view.width * 100}%`, top: `${b.y0 / view.height * 100}%`,
        width: `${(b.x1 - b.x0) / view.width * 100}%`, height: `${(b.y1 - b.y0) / view.height * 100}%`,
      });
      box.addEventListener('click', e => {
        e.stopPropagation();
        $$('.scan-box', stage).forEach(x => x.classList.toggle('sel', x === box));
        readRegion(b.x0 / small, b.y0 / small, (b.x1 - b.x0) / small, (b.y1 - b.y0) / small, line);
      });
      stage.appendChild(box);
    }
    setStatus(lines.length ? `Tik op ${the} ${subject} op de foto.` : `Tik op ${the} ${subject} op de foto, of neem een scherpere foto van dichterbij.`);
  }

  // Tik naast de kaders: lees een strook rond die plek.
  stage.addEventListener('click', e => {
    if (!photo || e.target.closest('.scan-box')) return;
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * photo.width;
    const y = (e.clientY - rect.top) / rect.height * photo.height;
    $$('.scan-box', stage).forEach(b => b.classList.remove('sel'));
    const h = Math.max(lineHeight * 1.6, photo.height * 0.02);
    const w = photo.width * 0.7;
    readRegion(x - w / 2, y - h / 2, w, h, null);
  });

  /** Leest een stuk van de foto opnieuw, op volle scherpte en vergroot. */
  async function readRegion(x, y, w, h, line) {
    const id = ++job;
    const options = new Set();
    if (line) options.add(line.text);
    showChoices(options, true);
    try {
      // Rand rond de tekst, en vergroten tot ongeveer 48 px letterhoogte.
      const padY = h * 0.4, padX = h * 0.8;
      const scale = Math.min(4, Math.max(1, 48 / h), 2400 / (w + padX * 2));
      const crop = cropCanvas(photo, x - padX, y - padY, w + padX * 2, h + padY * 2, scale, 12);
      const gray = stretchContrast(grayPixels(crop));
      const mode = line ? 7 : 6;
      // Twee versies (grijs en zwart-wit); de zekerste uitkomst wint.
      const results = [];
      for (const variant of [gray, adaptiveThreshold(gray, crop.width, crop.height, Math.round(48 * 1.5))]) {
        const data = await ocr(grayCanvas(variant, crop.width, crop.height), mode);
        if (id !== job) return;
        results.push(data);
      }
      const best = results.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      const found = ocrLines(best, 10);
      options.clear();
      for (const l of found) {
        options.add(l.text);
        if (l.words.length > 1) l.words.forEach(word => options.add(word));
      }
      if (!options.size && line) options.add(line.text);
    } catch (err) {
      console.error(err);
    }
    if (id !== job) return;
    showChoices(options, false);
  }

  function showChoices(options, busy) {
    choices.innerHTML = '';
    if (busy) {
      choices.innerHTML = '<div class="scan-status" style="padding:4px"><span class="spinner"></span>Lezen…</div>';
      choices.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    if (!options.size) {
      choices.innerHTML = '<div class="scan-status" style="padding:4px">Hier is geen tekst gevonden. Tik precies op de tekst.</div>';
      return;
    }
    for (const text of options) {
      const btn = el(`<button type="button">${esc(subject === 'werfnummer' ? cleanNumber(text) : text)}</button>`);
      btn.addEventListener('click', () => finish(text));
      choices.appendChild(btn);
    }
    choices.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// MARK: - Installeren op het beginscherm
// In een gewoon Safari-tabblad mag iOS de gegevens wissen als de website 7 dagen niet gebruikt is.
// Als app op het beginscherm niet. Daarom toont de iPhone eerst hoe je de app daar zet.

function showInstallGate() {
  let skipped = false;
  try { skipped = sessionStorage.getItem('urenlog.browser') === '1'; } catch { /* leeg */ }
  if (!isIOS() || isStandalone() || skipped) return;
  const gate = el(`<div class="gate" role="dialog" aria-modal="true"><div class="gate-inner">
    <div class="logo" role="img" aria-label="e. baillien"></div>
    <h1>Zet de app op je beginscherm</h1>
    <p>Zo werkt hij ook zonder internet, en kan je iPhone je uren nooit automatisch wissen.</p>
    <ol class="card">
      <li><span class="step">1</span><span>Tik onderaan in Safari op het deel-icoon <span class="inline-icon">${icon('share')}</span></span></li>
      <li><span class="step">2</span><span>Scroll naar beneden en kies <b>Zet op beginscherm</b> <span class="inline-icon">${icon('addhome')}</span></span></li>
      <li><span class="step">3</span><span>Tik op <b>Voeg toe</b> en open de app voortaan via het nieuwe icoon.</span></li>
    </ol>
    <p class="small">Uren die je hier in Safari invult, staan niet in de app op je beginscherm: dat zijn twee aparte bewaarplaatsen.</p>
    <button class="text-btn" type="button" id="gate-skip">Toch in Safari gebruiken (niet aanbevolen)</button>
  </div></div>`);
  $('#gate-skip', gate).addEventListener('click', async () => {
    const choice = await alertBox('Toch in Safari gebruiken?',
      'In Safari kan iOS je uren wissen als je de website 7 dagen niet opent. Gebruik dit alleen om de app uit te proberen.',
      [{ label: 'Annuleer', role: 'cancel', value: 'no' }, { label: 'Toch gebruiken', role: 'destructive', value: 'yes' }]);
    if (choice !== 'yes') return;
    try { sessionStorage.setItem('urenlog.browser', '1'); } catch { /* leeg */ }
    gate.remove();
  });
  document.body.appendChild(gate);
}

// MARK: - Opstarten

function refreshAll() {
  Clock.refresh();
  if (currentTab === 1) Entries.refresh();
  if (currentTab === 2) Reports.refresh();
  Settings.refresh();
}

async function start() {
  await Store.load();
  setupTabs();
  Clock.init();
  Entries.init();
  Reports.init();
  Settings.init();
  Settings.refresh();
  Store.listeners.add(refreshAll);
  const tab = /tab=(\d)/.exec(location.hash);
  if (tab) showTab(Number(tab[1]));

  // Vraag het toestel om de gegevens niet zomaar te wissen.
  navigator.storage?.persist?.().then(() => Settings.refresh()).catch(() => {});
  showInstallGate();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    refreshAll();
    checkBackupReminder();
  });
  setTimeout(checkBackupReminder, 600);
  loadLogo();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline niet beschikbaar:', err));
  }
}

start();
