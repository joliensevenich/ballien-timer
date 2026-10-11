'use strict';
// Rapporten in de layout van het papieren formulier "Weekrapport - Atelier".
// Zelfde regels als Export/*.swift: één Excel-tabblad, een PDF met één of meer A4-pagina's.

// MARK: - Rapportgegevens

/** Losgekoppeld van de opslag, zodat de exporters puur met waarden werken. */
function makeReportData({ userName, periodLabel, interval, entries, workTypes, layout, isPrivate }) {
  const rows = entries.map(e => ({
    start: e.start, end: e.end ?? e.start, worked: worked(e), projectNumber: e.projectNumber,
    workType: e.workType, project: e.jobName, note: e.note,
    get hours() { return this.worked / 3600000; },
  })).sort((a, b) => a.start - b.start);
  return {
    userName, periodLabel, interval, rows, workTypes, layout, isPrivate,
    /** "Uren_2026-10-01_2026-10-31", of "Prive_…" voor privéwerk */
    get fileBaseName() {
      return `${isPrivate ? 'Prive' : 'Uren'}_${D.ymd(interval.start)}_${D.ymd(+interval.end - 1)}`;
    },
  };
}

// MARK: - Blad

const XLStyleNames = ['normal', 'title', 'label', 'value', 'weekDate', 'legend', 'note', 'text', 'hours', 'code',
  'totalLabel', 'totalValue', 'weekRow', 'weekTotal', 'weekTotalLabel'];
const S = Object.fromEntries(XLStyleNames.map((n, i) => [n, i]));

/** Opmaak per stijl; de volgorde komt overeen met `cellXfs` in de stijlen. */
const XLStyle = XLStyleNames.map((name, i) => {
  const is = (...names) => names.includes(name);
  // Lettertype: 0 normaal, 1 vet, 2 titel, 3 klein, 4 klein cursief.
  const fontId = is('title') ? 2 : is('legend') ? 3 : is('note') ? 4
    : is('code', 'totalLabel', 'weekRow', 'weekTotal', 'weekTotalLabel') ? 1 : 0;
  // Opvulling: 0 geen, 2 grijs.
  const fillId = is('title', 'label', 'legend', 'note', 'totalLabel', 'totalValue', 'weekRow', 'weekTotal',
    'weekTotalLabel') ? 2 : 0;
  // Rand: 0 geen, 1 dik rondom, 2 uren-cel, 3 code-cel, 4/5/6 begin, midden en einde van de weekregel.
  const borderId = is('normal') ? 0 : is('hours') ? 2 : is('code') ? 3 : is('weekRow') ? 4
    : is('weekTotalLabel') ? 5 : is('weekTotal') ? 6 : 1;
  const numFmtId = is('hours', 'totalValue', 'weekTotal') ? 164 : 0;
  const alignment = is('normal') ? ''
    : is('weekDate', 'text', 'weekRow') ? '<alignment horizontal="left" vertical="center" indent="1"/>'
    : is('weekTotalLabel') ? '<alignment horizontal="right" vertical="center" indent="1"/>'
    : is('note') ? '<alignment horizontal="center" vertical="center" wrapText="1"/>'
    : '<alignment horizontal="center" vertical="center"/>';
  return {
    id: i, fontId, fillId, borderId, numFmtId, alignment,
    // Voor het tekenen (PDF): lettergrootte in punten, vet, cursief, uitlijning, tekstomloop.
    fontSize: [10, 10, 20, 9, 8][fontId],
    isBold: fontId === 1,
    isItalic: fontId === 4,
    isGray: fillId === 2,
    alignsLeft: is('weekDate', 'text', 'weekRow'),
    alignsRight: is('weekTotalLabel'),
    wraps: is('note'),
    leftLine: [0, 5, 6].includes(borderId) ? 'none' : borderId === 3 ? 'thin' : 'thick',
    rightLine: [0, 4, 5].includes(borderId) ? 'none' : borderId === 2 ? 'thin' : 'thick',
  };
});

const XL = {
  text: v => ({ t: 'text', v }),
  number: v => ({ t: 'number', v }),
  formula: (f, cached) => ({ t: 'formula', f, cached }),
  blank: { t: 'blank' },
};

/** Tijd als deel van een dag, getoond als uren:minuten ("9:45"), zoals Excel met [h]:mm. */
function hoursMinutes(days) {
  const m = Math.round(days * 24 * 60);
  return `${Math.floor(m / 60)}:${pad2(m % 60)}`;
}

/** Tekst zoals Excel ze toont. */
function cellDisplay(cell) {
  const v = cell.value;
  switch (v.t) {
    case 'text': return v.v;
    case 'number': return XLStyle[cell.style].numFmtId === 164 ? hoursMinutes(v.v) : String(Math.trunc(v.v));
    case 'formula': return hoursMinutes(v.cached);
    default: return '';
  }
}

function footer(left = '', center = '', right = '') { return { left, center, right }; }
const excelCodes = f => (f.left ? '&L' + f.left : '') + (f.center ? '&C' + f.center : '') + (f.right ? '&R' + f.right : '');
/** Gewone tekst in een Excel-voettekst (een & moet dubbel). */
const footerLiteral = text => text.replace(/&/g, '&&');

class XLSheet {
  constructor(name, columnWidths) {
    this.name = name;
    /** Kolombreedtes in tekens, zoals in Excel. */
    this.columnWidths = columnWidths;
    /** Rijhoogtes in punten, per rijnummer (vanaf 1). */
    this.rowHeights = {};
    this.cells = new Map();
    this.ranges = [];
    this.image = null;
    this.printTitleRows = null;
    this.footer = null;
    this.firstPageFooter = null;
  }

  set(row, column, value, style) {
    if (!this.cells.has(row)) this.cells.set(row, new Map());
    this.cells.get(row).set(column, { value, style });
  }

  /** Voegt cellen samen; elke cel krijgt de opmaak, zodat de randen overal kloppen. */
  merge(row, column, lastRow, lastColumn, value, style) {
    for (let r = row; r <= lastRow; r++) for (let c = column; c <= lastColumn; c++) this.set(r, c, XL.blank, style);
    this.set(row, column, value, style);
    if (lastRow > row || lastColumn > column) this.ranges.push({ row, column, lastRow, lastColumn });
  }

  get merges() {
    return this.ranges.map(r => `${XLSheet.ref(r.row, r.column)}:${XLSheet.ref(r.lastRow, r.lastColumn)}`);
  }

  get lastRow() {
    return Math.max(1, ...this.cells.keys(), ...Object.keys(this.rowHeights).map(Number));
  }

  rowHeight(row) { return this.rowHeights[row] ?? 15; }

  /** Breedte in pixels zoals Excel die tekent (Arial 10). */
  static columnPixels(characters) { return Math.floor(characters * 7 + 5); }
  static rowPixels(points) { return points * 4 / 3; }

  static column(index) {
    let n = index + 1, name = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      name = String.fromCharCode(65 + r) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  static ref(row, column) { return `${XLSheet.column(column)}${row}`; }
}

// MARK: - Formulier

const FormReport = {
  dayNames: ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'],
  note: 'Vul het aantal uren in (uren:minuten) en noteer hierbij de code van de uitgevoerde taak',
  /** Minimaal aantal lijnen op het formulier (lege lijnen om op papier aan te vullen). */
  minimumLines: 20,
  totalRowHeight: 38,
  weekRowHeight: 26,
  /** Breedte gedeeld door hoogte van `logo_excel.png`. */
  logoAspect: 912 / 321,
  /** A: werfnummer, B: werfnaam, daarna per dag een kolom uren en een kolom code. */
  columnWidths: [17, 34, ...Array(7).fill([8, 5]).flat()],

  /** Bruikbare hoogte van een A4-pagina (marges van 24 pt) in pixels van het blad. */
  get pageHeight() {
    const sheetWidth = this.columnWidths.reduce((t, w) => t + XLSheet.columnPixels(w), 0);
    const scale = (595.2 - 48) / sheetWidth;
    return (841.8 - 48) / scale;
  },

  /** Korte code per uitgevoerd werk, zoals in de legende van het formulier (Z, A, C, M, …). */
  codes(names) {
    const preferred = { zagen: 'Z', afplakken: 'A', cnc: 'C', monteren: 'M', montage: 'M', allerlei: 'AL' };
    const result = {};
    const used = new Set();
    for (const name of names) {
      const code = preferred[name.toLowerCase()];
      if (code && !used.has(code)) { result[name] = code; used.add(code); }
    }
    for (const name of names) {
      if (result[name] !== undefined) continue;
      const letters = name.toUpperCase().replace(/[^\p{L}]/gu, '') || 'X';
      const candidates = [];
      for (let n = 1; n <= Math.min(3, letters.length); n++) candidates.push(letters.slice(0, n));
      for (let n = 2; n <= 99; n++) candidates.push(letters[0] + n);
      const code = candidates.find(c => !used.has(c));
      result[name] = code;
      used.add(code);
    }
    return result;
  },

  /** Excel: één tabblad, met herhaalde kopregels bij het afdrukken. */
  sheet(report) {
    const form = this.makeForm(report);
    return this.build(form, form.items, Math.max(this.minimumLines, form.items.length), true, true);
  },

  /** PDF: één of meer A4-pagina's, elk met de kopregels en zoveel mogelijk lijnen. Totalen op de laatste. */
  pages(report) {
    const form = this.makeForm(report);
    const probe = new XLSheet('', this.columnWidths);
    const headerRows = this.header(probe, form);
    let headerHeight = 0;
    for (let r = 1; r <= headerRows; r++) headerHeight += XLSheet.rowPixels(probe.rowHeight(r));
    const totalHeight = XLSheet.rowPixels(this.totalRowHeight);
    const height = item => XLSheet.rowPixels(item.kind === 'line' ? 36 : this.weekRowHeight);
    const pageHeight = this.pageHeight;

    // Pagina's vullen tot ze vol zijn; een weekregel komt nooit alleen onderaan een pagina.
    const chunks = [];
    let current = [];
    let used = headerHeight;
    for (const item of form.items) {
      if (used + height(item) > pageHeight && current.length) {
        const carry = [];
        if (current[current.length - 1].kind === 'week') carry.push(current.pop());
        chunks.push(current);
        current = carry;
        used = headerHeight + carry.reduce((t, i) => t + height(i), 0);
      }
      current.push(item);
      used += height(item);
    }
    // De totaalregel moet op de laatste pagina passen.
    if (used + totalHeight > pageHeight && current.length > 1) {
      const last = current.pop();
      chunks.push(current);
      current = [last];
    }
    chunks.push(current);

    return chunks.map((items, i) => {
      // Eén pagina: aangevuld tot het formulier met minstens 20 lijnen.
      const slots = chunks.length === 1 ? Math.max(this.minimumLines, items.length) : items.length;
      const page = this.build(form, items, slots, i === chunks.length - 1, false);
      if (chunks.length > 1) {
        // Vanaf pagina 2 staan ook naam en periode in de voettekst.
        const number = `Pagina ${i + 1} van ${chunks.length}`;
        page.footer = i === 0 ? footer('', number, '') : footer(form.userName, number, form.period);
      }
      return page;
    });
  },

  // MARK: Inhoud

  makeForm(report) {
    // Legende in de volgorde van het papieren formulier (Z, A, C, M), daarna de andere werken.
    const formOrder = ['zagen', 'afplakken', 'cnc', 'monteren', 'montage'];
    const extra = [...new Set(report.rows.map(r => r.workType))].filter(n => !report.workTypes.includes(n)).sort();
    const rank = (name, offset) => {
      const i = formOrder.indexOf(name.toLowerCase());
      return i >= 0 ? i : formOrder.length + offset;
    };
    const legend = [...report.workTypes, ...extra]
      .map((name, offset) => ({ name, key: rank(name, offset) }))
      .sort((a, b) => a.key - b.key)
      .map(x => x.name);
    const codes = this.codes(legend);

    let from = D.startOfDay(report.interval.start);
    let to = D.startOfDay(+report.interval.end - 1);
    let title, label, sheetName;
    // Privéwerk krijgt een eigen rapport.
    const place = report.isPrivate ? 'PRIVÉ' : 'ATELIER';
    switch (report.layout) {
      case 'week':
        // Een weekrapport toont altijd de hele week, van maandag tot zondag.
        from = D.weekStart(report.interval.start);
        to = D.addDays(from, 6);
        title = `WEEKRAPPORT - ${place}`;
        label = 'WEEK:';
        sheetName = `Week ${D.isoWeek(from)}`;
        break;
      case 'month':
        title = `MAANDRAPPORT - ${place}`;
        label = 'MAAND:';
        sheetName = Fmt.month(from);
        break;
      default:
        title = `URENRAPPORT - ${place}`;
        label = 'PERIODE:';
        sheetName = 'Rapport';
    }

    const items = [];
    const totals = Array(7).fill(0);
    const byWeek = new Map();
    for (const row of report.rows) {
      const k = +D.weekStart(row.start);
      if (!byWeek.has(k)) byWeek.set(k, []);
      byWeek.get(k).push(row);
    }
    const sum = rows => rows.reduce((t, r) => t + r.hours, 0);
    for (const weekStart of [...byWeek.keys()].sort((a, b) => a - b)) {
      const weekRows = byWeek.get(weekStart);
      if (report.layout !== 'week') {
        const weekEnd = D.addDays(weekStart, 6);
        items.push({
          kind: 'week',
          text: `Week ${D.isoWeek(weekStart)}:  ${Fmt.date(weekStart)} – ${Fmt.date(weekEnd)}`,
          total: sum(weekRows),
        });
      }
      // Werk je meerdere dagen aan dezelfde werf, dan krijgt elke dag een eigen lijn. De lijnen volgen
      // de week: eerst maandag (in de volgorde van werken), dan dinsdag, enzovoort.
      const grouped = new Map();
      for (const r of weekRows) {
        const key = JSON.stringify([r.projectNumber, r.project, r.workType, D.dayIndex(r.start)]);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(r);
      }
      const keys = [...grouped.keys()].map(k => {
        const [number, name, workType, day] = JSON.parse(k);
        return { k, number, name, workType, day, first: Math.min(...grouped.get(k).map(r => r.start)) };
      }).sort((a, b) => a.first !== b.first ? a.first - b.first
        : a.number.localeCompare(b.number, 'nl', { numeric: true, sensitivity: 'base' }));
      const weekTotals = Array(7).fill(0);
      for (const key of keys) {
        const hours = sum(grouped.get(key.k));
        totals[key.day] += hours;
        weekTotals[key.day] += hours;
        items.push({
          kind: 'line',
          line: { number: key.number, name: key.name, code: codes[key.workType] ?? '', day: key.day, hours },
        });
      }
      if (report.layout !== 'week') items.push({ kind: 'weekTotals', totals: weekTotals });
    }

    return {
      title, label, sheetName, layout: report.layout, from, to, items, totals, legend, codes,
      userName: report.userName,
      /** "05-10-2026 – 11-10-2026" */
      period: `${Fmt.date(from)} – ${Fmt.date(to)}`,
    };
  },

  /** Het formulier met de kop, `slots` rijen (aangevuld met lege lijnen) en eventueel de totalen. */
  build(form, items, slots, showTotal, excelPages) {
    const s = new XLSheet(form.sheetName, this.columnWidths);
    const lastColumn = this.columnWidths.length - 1;
    const headerRow = this.header(s, form);
    const first = headerRow + 1;
    const isLine = i => i.kind === 'line';

    // Lijnen en weekregels
    const hourColumns = [0, 1, 2, 3, 4, 5, 6].map(d => XLSheet.column(2 + d * 2));
    for (let i = 0; i < slots; i++) {
      const row = first + i;
      s.rowHeights[row] = 36;
      const item = i < items.length ? items[i] : null;
      if (item?.kind === 'week') {
        // Grijze weekregel met rechts "Totaal uren:" en het totaal van die week, als één grijs blok.
        let lines = 0;
        for (let j = i + 1; j < items.length && isLine(items[j]); j++) lines++;
        const range = hourColumns.map(c => `${c}${row + 1}:${c}${row + Math.max(lines, 1)}`).join(',');
        s.rowHeights[row] = this.weekRowHeight;
        s.merge(row, 0, row, lastColumn - 6, XL.text(item.text), S.weekRow);
        s.merge(row, lastColumn - 5, row, lastColumn - 2, XL.text('Totaal uren:'), S.weekTotalLabel);
        s.merge(row, lastColumn - 1, row, lastColumn, XL.formula(`SUM(${range})`, item.total / 24), S.weekTotal);
      } else if (item?.kind === 'weekTotals') {
        // Grijze regel met de gewerkte uren per dag van die week, zoals onderaan het weekrapport.
        let lines = 0;
        for (let j = i - 1; j >= 0 && isLine(items[j]); j--) lines++;
        s.rowHeights[row] = this.weekRowHeight;
        s.merge(row, 0, row, 1, XL.text('TOTAAL GEWERKTE UREN:'), S.totalLabel);
        hourColumns.forEach((column, d) => {
          const formula = lines > 0 ? `SUM(${column}${row - lines}:${column}${row - 1})` : '0';
          s.merge(row, 2 + d * 2, row, 3 + d * 2, XL.formula(formula, item.totals[d] / 24), S.totalValue);
        });
      } else {
        const line = item?.line ?? null;
        s.set(row, 0, line ? XL.text(line.number) : XL.blank, S.text);
        s.set(row, 1, line ? XL.text(line.name) : XL.blank, S.text);
        for (let d = 0; d < 7; d++) {
          const filled = line?.day === d;
          // Excel bewaart tijd als deel van een dag; met opmaak [u]:mm toont het 9:45.
          s.set(row, 2 + d * 2, filled ? XL.number(line.hours / 24) : XL.blank, S.hours);
          s.set(row, 3 + d * 2, filled ? XL.text(line.code) : XL.blank, S.code);
        }
      }
    }

    if (showTotal) {
      const total = first + slots;
      s.rowHeights[total] = this.totalRowHeight;
      if (form.layout === 'week') {
        // Weekrapport: totalen per dag
        s.merge(total, 0, total, 1, XL.text('TOTAAL GEWERKTE UREN:'), S.totalLabel);
        hourColumns.forEach((column, d) => {
          s.merge(total, 2 + d * 2, total, 3 + d * 2,
            XL.formula(`SUM(${column}${first}:${column}${total - 1})`, form.totals[d] / 24), S.totalValue);
        });
      } else {
        // Maand- of urenrapport: één totaal, de som van de weektotalen bij de weekregels.
        const weekCell = XLSheet.column(lastColumn - 1);
        const weekRows = items.map((it, i) => it.kind === 'week' ? i : -1).filter(i => i >= 0);
        const range = weekRows.length ? weekRows.map(i => `${weekCell}${first + i}`).join(',') : '0';
        s.merge(total, 0, total, 1, XL.text(form.layout === 'month' ? 'TOTAAL MAAND:' : 'TOTAAL PERIODE:'), S.totalLabel);
        s.merge(total, 2, total, lastColumn,
          XL.formula(`SUM(${range})`, form.totals.reduce((a, b) => a + b, 0) / 24), S.totalValue);
      }
    }

    // Afdrukken in Excel: kopregels bovenaan elke pagina; vanaf pagina 2 ook naam en periode in de voettekst.
    if (excelPages) {
      s.printTitleRows = [1, headerRow];
      s.footer = footer(footerLiteral(form.userName), 'Pagina &P van &N', footerLiteral(form.period));
      s.firstPageFooter = footer('', 'Pagina &P van &N', '');
    }
    return s;
  },

  /** Kop van het formulier (titel, logo, naam, periode, legende en kolomtitels); geeft de rij met kolomtitels terug. */
  header(s, form) {
    const lastColumn = this.columnWidths.length - 1;
    const legend = form.legend;

    // Titel
    s.rowHeights[1] = 30;
    s.merge(1, 0, 1, lastColumn, XL.text(form.title), S.title);

    // Kop: naam, periode en legende
    const codeRows = Math.max(2, Math.floor((legend.length + 1) / 2));
    const noteRow = 3 + codeRows;
    s.rowHeights[2] = 34;
    s.merge(2, 2, 2, 3, XL.text('NAAM:'), S.label);
    s.merge(2, 4, 2, 11, XL.text(form.userName), S.value);
    s.merge(2, 12, 2, 15, XL.text('LEGENDE:'), S.label);
    for (let r = 0; r < codeRows; r++) {
      const row = 3 + r;
      s.rowHeights[row] = 28;
      for (let half = 0; half < 2; half++) {
        const i = r * 2 + half;
        const text = i < legend.length ? `${form.codes[legend[i]] ?? ''}: ${legend[i].toUpperCase()}` : '';
        s.merge(row, 12 + half * 2, row, 13 + half * 2, XL.text(text), S.legend);
      }
    }
    s.rowHeights[noteRow] = 40;
    s.merge(noteRow, 12, noteRow, 15, XL.text(this.note), S.note);

    const span = noteRow - 3 + 1;
    const vanEnd = 3 + Math.floor(span / 2) - 1;
    s.merge(3, 2, noteRow, 3, XL.text(form.label), S.label);
    s.merge(3, 4, vanEnd, 11, XL.text(`VAN   ${Fmt.date(form.from)}`), S.weekDate);
    s.merge(vanEnd + 1, 4, noteRow, 11, XL.text(`TOT   ${Fmt.date(form.to)}`), S.weekDate);

    // Vak voor het logo
    s.merge(2, 0, noteRow, 1, XL.blank, S.label);

    // Kolomtitels
    const header = noteRow + 1;
    s.rowHeights[header] = 26;
    s.set(header, 0, XL.text('WERFNUMMER:'), S.label);
    s.set(header, 1, XL.text('WERFNAAM:'), S.label);
    this.dayNames.forEach((day, d) => s.merge(header, 2 + d * 2, header, 3 + d * 2, XL.text(day), S.label));

    // Logo gecentreerd in het vak linksboven
    const areaWidth = XLSheet.columnPixels(this.columnWidths[0]) + XLSheet.columnPixels(this.columnWidths[1]);
    const top = XLSheet.rowPixels(s.rowHeight(1));
    let areaHeight = 0;
    for (let r = 2; r <= noteRow; r++) areaHeight += XLSheet.rowPixels(s.rowHeight(r));
    const width = Math.min(areaWidth - 48, (areaHeight - 24) * this.logoAspect);
    const height = width / this.logoAspect;
    s.image = {
      width: areaWidth, height: top + areaHeight,
      content: { x: (areaWidth - width) / 2, y: top + (areaHeight - height) / 2, width, height },
    };
    return header;
  },
};

// MARK: - ZIP (zonder compressie, genoeg voor .xlsx)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

class ZipWriter {
  constructor() { this.parts = []; this.central = []; this.offset = 0; this.count = 0; }

  add(path, contents) {
    if (typeof contents === 'string') contents = new TextEncoder().encode(contents);
    const name = new TextEncoder().encode(path);
    const crc = crc32(contents);
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const date = ((Math.max(now.getFullYear(), 1980) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);       // versie nodig
    local.setUint16(6, 0x0800, true);   // UTF-8 bestandsnamen
    local.setUint16(8, 0, true);        // geen compressie
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, contents.length, true);
    local.setUint32(22, contents.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, time, true);
    central.setUint16(14, date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, contents.length, true);
    central.setUint32(24, contents.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, this.offset, true);

    this.parts.push(new Uint8Array(local.buffer), name, contents);
    this.central.push(new Uint8Array(central.buffer), name);
    this.offset += 30 + name.length + contents.length;
    this.count++;
  }

  finalize() {
    const cdSize = this.central.reduce((t, p) => t + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.count, true);
    end.setUint16(10, this.count, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...this.central, new Uint8Array(end.buffer)],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}

// MARK: - Excel (.xlsx)

const xmlEscape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const Workbook = {
  /** sheets: [XLSheet], image: PNG-bytes die op elk blad met een `image` getoond worden. */
  xlsx(sheets, image) {
    const zip = new ZipWriter();
    const hasDrawing = sheet => !!image && !!sheet.image;
    zip.add('[Content_Types].xml', this.contentTypes(sheets, hasDrawing));
    zip.add('_rels/.rels', this.rels([['officeDocument', 'xl/workbook.xml']]));
    zip.add('xl/workbook.xml', this.workbookXML(sheets));
    zip.add('xl/_rels/workbook.xml.rels', this.rels([
      ...sheets.map((_, i) => ['worksheet', `worksheets/sheet${i + 1}.xml`]), ['styles', 'styles.xml'],
    ]));
    zip.add('xl/styles.xml', this.styles());
    sheets.forEach((sheet, i) => {
      const n = i + 1;
      const drawing = hasDrawing(sheet);
      zip.add(`xl/worksheets/sheet${n}.xml`, this.sheetXML(sheet, drawing));
      if (drawing) {
        zip.add(`xl/worksheets/_rels/sheet${n}.xml.rels`, this.rels([['drawing', `../drawings/drawing${n}.xml`]]));
        zip.add(`xl/drawings/drawing${n}.xml`, this.drawingXML(sheet, sheet.image));
        zip.add(`xl/drawings/_rels/drawing${n}.xml.rels`, this.rels([['image', '../media/image1.png']]));
      }
    });
    if (image) zip.add('xl/media/image1.png', image);
    return zip.finalize();
  },

  contentTypes(sheets, hasDrawing) {
    let xml = XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Default Extension="png" ContentType="image/png"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    sheets.forEach((sheet, i) => {
      xml += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
      if (hasDrawing(sheet)) {
        xml += `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
      }
    });
    return xml + '</Types>';
  },

  rels(items) {
    return XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + items.map(([type, target], i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join('')
      + '</Relationships>';
  },

  workbookXML(sheets) {
    let xml = XML_HEAD + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    sheets.forEach((sheet, i) => { xml += `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`; });
    xml += '</sheets>';
    const titles = sheets.map((sheet, i) => {
      if (!sheet.printTitleRows) return '';
      const name = sheet.name.replace(/'/g, "''");
      const [a, b] = sheet.printTitleRows;
      return `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${xmlEscape(`'${name}'!$${a}:$${b}`)}</definedName>`;
    }).join('');
    if (titles) xml += `<definedNames>${titles}</definedNames>`;
    return xml + '</workbook>';
  },

  sheetXML(sheet, drawing) {
    let xml = XML_HEAD + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
      + '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols>';
    sheet.columnWidths.forEach((w, i) => { xml += `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`; });
    xml += '</cols><sheetData>';
    const parts = [];
    for (let row = 1; row <= sheet.lastRow; row++) {
      const h = sheet.rowHeights[row];
      let r = `<row r="${row}"${h !== undefined ? ` ht="${h}" customHeight="1"` : ''}>`;
      const cells = [...(sheet.cells.get(row) ?? new Map()).entries()].sort((a, b) => a[0] - b[0]);
      for (const [column, cell] of cells) {
        const ref = XLSheet.ref(row, column);
        const v = cell.value;
        if (v.t === 'text') r += `<c r="${ref}" t="inlineStr" s="${cell.style}"><is><t xml:space="preserve">${xmlEscape(v.v)}</t></is></c>`;
        else if (v.t === 'number') r += `<c r="${ref}" s="${cell.style}"><v>${v.v}</v></c>`;
        else if (v.t === 'formula') r += `<c r="${ref}" s="${cell.style}"><f>${xmlEscape(v.f)}</f><v>${v.cached}</v></c>`;
        else r += `<c r="${ref}" s="${cell.style}"/>`;
      }
      parts.push(r + '</row>');
    }
    xml += parts.join('') + '</sheetData>';
    const merges = sheet.merges;
    if (merges.length) xml += `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;
    xml += '<pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>';
    // Passend in de breedte; Excel verdeelt de lijnen zelf over zoveel pagina's als nodig.
    xml += '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>';
    if (sheet.footer) {
      xml += `<headerFooter${sheet.firstPageFooter ? ' differentFirst="1"' : ''}>`;
      xml += `<oddFooter>${xmlEscape(excelCodes(sheet.footer))}</oddFooter>`;
      if (sheet.firstPageFooter) xml += `<firstFooter>${xmlEscape(excelCodes(sheet.firstPageFooter))}</firstFooter>`;
      xml += '</headerFooter>';
    }
    if (drawing) xml += '<drawing r:id="rId1"/>';
    return xml + '</worksheet>';
  },

  /** Zet een positie in pixels om naar een cel plus verschuiving (in EMU) binnen die cel. */
  anchor(sheet, x, y) {
    let column = 0, left = x;
    while (column < sheet.columnWidths.length - 1 && left >= XLSheet.columnPixels(sheet.columnWidths[column])) {
      left -= XLSheet.columnPixels(sheet.columnWidths[column]);
      column++;
    }
    let row = 1, top = y;
    while (top >= XLSheet.rowPixels(sheet.rowHeight(row))) {
      top -= XLSheet.rowPixels(sheet.rowHeight(row));
      row++;
    }
    return { column, columnOffset: Math.trunc(left * 9525), row: row - 1, rowOffset: Math.trunc(top * 9525) };
  },

  drawingXML(sheet, picture) {
    const a = this.anchor(sheet, 0, 0);
    const b = this.anchor(sheet, picture.width, picture.height);
    const cx = Math.trunc(picture.width * 9525);
    const cy = Math.trunc(picture.height * 9525);
    return XML_HEAD
      + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<xdr:twoCellAnchor editAs="oneCell">'
      + `<xdr:from><xdr:col>${a.column}</xdr:col><xdr:colOff>${a.columnOffset}</xdr:colOff><xdr:row>${a.row}</xdr:row><xdr:rowOff>${a.rowOffset}</xdr:rowOff></xdr:from>`
      + `<xdr:to><xdr:col>${b.column}</xdr:col><xdr:colOff>${b.columnOffset}</xdr:colOff><xdr:row>${b.row}</xdr:row><xdr:rowOff>${b.rowOffset}</xdr:rowOff></xdr:to>`
      + '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>'
      + '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
      + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>`
      + '<xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>';
  },

  styles() {
    const medium = 'style="medium"><color auto="1"/>';
    const thin = 'style="thin"><color auto="1"/>';
    let xml = XML_HEAD + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<numFmts count="1"><numFmt numFmtId="164" formatCode="[h]:mm"/></numFmts>'
      + '<fonts count="5">'
      + '<font><sz val="10"/><name val="Arial"/></font>'
      + '<font><b/><sz val="10"/><name val="Arial"/></font>'
      + '<font><sz val="20"/><name val="Arial"/></font>'
      + '<font><sz val="9"/><name val="Arial"/></font>'
      + '<font><i/><sz val="8"/><name val="Arial"/></font>'
      + '</fonts>'
      + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
      + '<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill></fills>'
      + '<borders count="7"><border><left/><right/><top/><bottom/><diagonal/></border>'
      + `<border><left ${medium}</left><right ${medium}</right><top ${medium}</top><bottom ${medium}</bottom><diagonal/></border>`
      + `<border><left ${medium}</left><right ${thin}</right><top ${medium}</top><bottom ${medium}</bottom><diagonal/></border>`
      + `<border><left ${thin}</left><right ${medium}</right><top ${medium}</top><bottom ${medium}</bottom><diagonal/></border>`
      + `<border><left ${medium}</left><right/><top ${medium}</top><bottom ${medium}</bottom><diagonal/></border>`
      + `<border><left/><right/><top ${medium}</top><bottom ${medium}</bottom><diagonal/></border>`
      + `<border><left/><right ${medium}</right><top ${medium}</top><bottom ${medium}</bottom><diagonal/></border>`
      + '</borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + `<cellXfs count="${XLStyle.length}">`;
    for (const st of XLStyle) {
      xml += `<xf numFmtId="${st.numFmtId}" fontId="${st.fontId}" fillId="${st.fillId}" borderId="${st.borderId}" xfId="0"`
        + ' applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"'
        + (st.alignment ? ` applyAlignment="1">${st.alignment}</xf>` : '/>');
    }
    return xml + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  },
};

// MARK: - Logo

let logoImage = null;
function loadLogo() {
  if (!logoImage) {
    logoImage = new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'logo_excel.png';
    });
  }
  return logoImage;
}

/** Doorzichtige afbeelding vanaf A1 met het logo op de juiste plek, scherp genoeg om te printen. */
async function logoPicture(logo, placement) {
  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(placement.width * scale);
  canvas.height = Math.round(placement.height * scale);
  const c = placement.content;
  canvas.getContext('2d').drawImage(logo, c.x * scale, c.y * scale, c.width * scale, c.height * scale);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

const XLSXWriter = {
  async write(report) {
    const sheet = FormReport.sheet(report);
    const logo = await loadLogo();
    const image = logo && sheet.image ? await logoPicture(logo, sheet.image) : null;
    const blob = Workbook.xlsx([sheet], image);
    return { blob, name: `${report.fileBaseName}.xlsx`, sheets: [sheet], kind: 'xlsx' };
  },
};

// MARK: - Tekenen (PDF en voorbeeld op het scherm)

const PAGE = { width: 595.2, height: 841.8 };
const MARGIN = 24;

/**
 * Tekent een blad in `rect` (bovenaan, horizontaal gecentreerd) via een `painter`, in pixels van het blad.
 * De painter is jsPDF (PDF) of een canvas (voorbeeld op het scherm).
 */
function drawSheet(sheet, logo, rect, makePainter) {
  const columnX = [0];
  for (const w of sheet.columnWidths) columnX.push(columnX[columnX.length - 1] + XLSheet.columnPixels(w));
  const rowY = [0];
  for (let r = 1; r <= sheet.lastRow; r++) rowY.push(rowY[rowY.length - 1] + XLSheet.rowPixels(sheet.rowHeight(r)));
  const width = columnX[columnX.length - 1];
  const height = rowY[rowY.length - 1];
  const scale = Math.min(rect.width / width, rect.height / height);
  const p = makePainter(rect.x + (rect.width - width * scale) / 2, rect.y, scale);

  const frame = r => ({
    x: columnX[r.column], y: rowY[r.row - 1],
    w: columnX[r.lastColumn + 1] - columnX[r.column], h: rowY[r.lastRow] - rowY[r.row - 1],
  });

  // Elke zichtbare cel of samengevoegd blok, met de cel linksboven.
  const hidden = new Set();
  for (const m of sheet.ranges) {
    for (let r = m.row; r <= m.lastRow; r++) {
      for (let c = m.column; c <= m.lastColumn; c++) if (r !== m.row || c !== m.column) hidden.add(`${r},${c}`);
    }
  }
  const blocks = [];
  for (const [row, cells] of sheet.cells) {
    for (const [column, cell] of cells) {
      if (hidden.has(`${row},${column}`)) continue;
      const range = sheet.ranges.find(m => m.row === row && m.column === column)
        ?? { row, column, lastRow: row, lastColumn: column };
      blocks.push([frame(range), cell]);
    }
  }

  for (const [r, cell] of blocks) if (XLStyle[cell.style].isGray) p.fill(r.x, r.y, r.w, r.h);

  if (sheet.image && logo) {
    const c = sheet.image.content;
    p.image(logo, c.x, c.y, c.width, c.height);
  }

  for (const [r, cell] of blocks) drawText(p, cell, r);

  for (const [r, cell] of blocks) {
    const st = XLStyle[cell.style];
    if (st.borderId === 0) continue;
    p.line(r.x, r.y, r.x + r.w, r.y, 2);
    p.line(r.x, r.y + r.h, r.x + r.w, r.y + r.h, 2);
    if (st.leftLine !== 'none') p.line(r.x, r.y, r.x, r.y + r.h, st.leftLine === 'thick' ? 2 : 0.75);
    if (st.rightLine !== 'none') p.line(r.x + r.w, r.y, r.x + r.w, r.y + r.h, st.rightLine === 'thick' ? 2 : 0.75);
  }
  p.done?.();
}

function drawText(p, cell, r) {
  const text = cellDisplay(cell);
  if (!text) return;
  const st = XLStyle[cell.style];
  // Lettergrootte in punten omgezet naar de pixels van het blad.
  const size = st.fontSize * 4 / 3;
  p.font(size, st.isBold, st.isItalic);
  const box = { x: r.x + 4, y: r.y + 2, w: r.w - 8, h: r.h - 4 };
  const lineHeight = size * 1.15;

  let lines;
  if (st.wraps) {
    lines = [];
    for (const word of text.split(' ')) {
      const last = lines[lines.length - 1];
      if (last !== undefined && p.width(last + ' ' + word) <= box.w) lines[lines.length - 1] = last + ' ' + word;
      else lines.push(word);
    }
    lines = lines.slice(0, Math.max(1, Math.floor(box.h / lineHeight)));
  } else {
    let t = text;
    if (p.width(t) > box.w) {
      while (t.length > 1 && p.width(t + '…') > box.w) t = t.slice(0, -1);
      t += '…';
    }
    lines = [t];
  }

  const midY = box.y + box.h / 2;
  lines.forEach((line, i) => {
    const y = midY + (i - (lines.length - 1) / 2) * lineHeight;
    const w = p.width(line);
    const x = st.alignsLeft ? box.x : st.alignsRight ? box.x + box.w - w : box.x + (box.w - w) / 2;
    p.text(line, x, y);
  });
}

/** Painter voor jsPDF: tekent in punten op de pagina. */
function pdfPainter(doc) {
  return (ox, oy, k) => ({
    fill(x, y, w, h) { doc.setFillColor(217, 217, 217); doc.rect(ox + x * k, oy + y * k, w * k, h * k, 'F'); },
    line(x1, y1, x2, y2, lw) {
      doc.setDrawColor(0); doc.setLineWidth(lw * k); doc.setLineCap('square');
      doc.line(ox + x1 * k, oy + y1 * k, ox + x2 * k, oy + y2 * k);
    },
    image(img, x, y, w, h) { doc.addImage(img, 'PNG', ox + x * k, oy + y * k, w * k, h * k, 'logo', 'FAST'); },
    font(size, bold, italic) {
      doc.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'));
      doc.setFontSize(size * k);
    },
    width(text) { return doc.getTextWidth(text) / k; },
    text(t, x, y) { doc.setTextColor(0); doc.text(t, ox + x * k, oy + y * k, { baseline: 'middle' }); },
  });
}

/** Painter voor een canvas (voorbeeld op het scherm); `ctx` heeft al de juiste schaal voor de pagina. */
function canvasPainter(ctx) {
  return (ox, oy, k) => {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    ctx.textBaseline = 'middle';
    return {
      fill(x, y, w, h) { ctx.fillStyle = '#d9d9d9'; ctx.fillRect(x, y, w, h); },
      line(x1, y1, x2, y2, lw) {
        ctx.strokeStyle = '#000'; ctx.lineWidth = lw; ctx.lineCap = 'square';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      },
      image(img, x, y, w, h) { ctx.drawImage(img, x, y, w, h); },
      font(size, bold, italic) {
        ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px Arial, Helvetica, sans-serif`;
      },
      width(text) { return ctx.measureText(text).width; },
      text(t, x, y) { ctx.fillStyle = '#000'; ctx.fillText(t, x, y); },
      done() { ctx.restore(); },
    };
  };
}

const PDFExporter = {
  async write(report) {
    const logo = await loadLogo();
    const pages = FormReport.pages(report);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: [PAGE.width, PAGE.height], compress: true });
    doc.setProperties({ title: `Urenrapport ${report.periodLabel}`, author: report.userName, creator: 'e. baillien - Timer' });
    const area = { x: MARGIN, y: MARGIN, width: PAGE.width - 2 * MARGIN, height: PAGE.height - 2 * MARGIN };
    pages.forEach((sheet, i) => {
      if (i > 0) doc.addPage([PAGE.width, PAGE.height]);
      drawSheet(sheet, logo, area, pdfPainter(doc));
      if (sheet.footer) {
        // Voettekst onderaan de pagina: links, midden en rechts.
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(64);
        const y = PAGE.height - MARGIN + 4;
        const f = sheet.footer;
        if (f.left) doc.text(f.left, MARGIN, y, { baseline: 'top' });
        if (f.center) doc.text(f.center, PAGE.width / 2, y, { baseline: 'top', align: 'center' });
        if (f.right) doc.text(f.right, PAGE.width - MARGIN, y, { baseline: 'top', align: 'right' });
      }
    });
    return { blob: doc.output('blob'), name: `${report.fileBaseName}.pdf`, sheets: pages, kind: 'pdf' };
  },
};

/** Voorbeeld op het scherm: een canvas per PDF-pagina, of het hele Excel-blad. */
async function renderPreview(file, container) {
  const logo = await loadLogo();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  container.innerHTML = '';
  for (const sheet of file.sheets) {
    let w, h, area;
    if (file.kind === 'pdf') {
      w = PAGE.width; h = PAGE.height;
      area = { x: MARGIN, y: MARGIN, width: PAGE.width - 2 * MARGIN, height: PAGE.height - 2 * MARGIN };
    } else {
      let sw = 0, sh = 0;
      for (const cw of sheet.columnWidths) sw += XLSheet.columnPixels(cw);
      for (let r = 1; r <= sheet.lastRow; r++) sh += XLSheet.rowPixels(sheet.rowHeight(r));
      w = sw + 16; h = sh + 16;
      area = { x: 8, y: 8, width: sw, height: sh };
    }
    // Grote bladen kleiner tekenen: Safari weigert heel grote canvassen.
    const px = Math.min(dpr * 1.5, Math.sqrt(16e6 / (w * h)), 30000 / h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * px);
    canvas.height = Math.round(h * px);
    canvas.className = 'preview-page';
    canvas.style.aspectRatio = `${w} / ${h}`;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(px, px);
    drawSheet(sheet, logo, area, canvasPainter(ctx));
    if (file.kind === 'pdf' && sheet.footer) {
      ctx.font = '9px -apple-system, Helvetica, sans-serif';
      ctx.fillStyle = '#404040';
      ctx.textBaseline = 'top';
      const y = PAGE.height - MARGIN + 4;
      const f = sheet.footer;
      ctx.textAlign = 'left'; ctx.fillText(f.left, MARGIN, y);
      ctx.textAlign = 'center'; ctx.fillText(f.center, PAGE.width / 2, y);
      ctx.textAlign = 'right'; ctx.fillText(f.right, PAGE.width - MARGIN, y);
    }
    container.appendChild(canvas);
  }
}
