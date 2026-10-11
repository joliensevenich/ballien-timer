'use strict';
// Gegevens, datums, opmaak en back-up. Dezelfde regels als de iPhone-app (Model/*.swift).

const DAY_MS = 86400000;
const pad2 = n => String(n).padStart(2, '0');

// MARK: - Datums (week begint op maandag, weeknummers volgens ISO)

const D = {
  startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; },
  addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  addMonths(d, n) {
    const x = new Date(d);
    const day = x.getDate();
    x.setDate(1);
    x.setMonth(x.getMonth() + n);
    x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
    return x;
  },
  /** 0 = maandag … 6 = zondag */
  dayIndex(d) { return (new Date(d).getDay() + 6) % 7; },
  weekStart(d) { const x = D.startOfDay(d); return D.addDays(x, -D.dayIndex(x)); },
  monthStart(d) { d = new Date(d); return new Date(d.getFullYear(), d.getMonth(), 1); },
  isoWeek(d) {
    const x = D.startOfDay(d);
    x.setDate(x.getDate() + 3 - D.dayIndex(x)); // donderdag van die week
    const jan4 = new Date(x.getFullYear(), 0, 4);
    return 1 + Math.round(((x - jan4) / DAY_MS - 3 + D.dayIndex(jan4)) / 7);
  },
  minutesOf(d) { d = new Date(d); return d.getHours() * 60 + d.getMinutes(); },
  atMinutes(day, minutes) {
    const x = new Date(day);
    x.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return x;
  },
  /** "2026-10-03" voor <input type="date"> en bestandsnamen. */
  ymd(d) { d = new Date(d); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; },
  parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  /** "07:30" voor <input type="time">. */
  hm(minutes) { return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`; },
  parseHm(s) { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); },
};

const Periods = {
  day(d) { const s = D.startOfDay(d); return { start: s, end: D.addDays(s, 1) }; },
  week(d) { const s = D.weekStart(d); return { start: s, end: D.addDays(s, 7) }; },
  month(d) { const s = D.monthStart(d); return { start: s, end: new Date(s.getFullYear(), s.getMonth() + 1, 1) }; },
  contains(iv, t) { return t >= +iv.start && t < +iv.end; },
};

// MARK: - Opmaak

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september',
  'oktober', 'november', 'december'];
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

const Fmt = {
  /** "7u 45m" */
  duration(ms) { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}u ${pad2(m % 60)}m`; },
  /** "07:05:33" */
  clock(ms) {
    const s = Math.floor(ms / 1000);
    return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s % 3600 / 60))}:${pad2(s % 60)}`;
  },
  /** "7:45" (uren:minuten) */
  hours(ms) { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}:${pad2(m % 60)}`; },
  /** "03-10-2026" */
  date(d) { d = new Date(d); return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`; },
  /** "Oktober 2026" */
  month(d) { d = new Date(d); return `${capitalize(MONTHS[d.getMonth()])} ${d.getFullYear()}`; },
  time(d) { d = new Date(d); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; },
};

// MARK: - Gewerkte tijd

/** Tijd in hele minuten (seconden tellen niet mee), zonder afronding: van 07:30 tot 16:15 is 8u45. */
function workedMinutesMs(start, end) {
  return Math.max(0, (Math.floor(end / 60000) - Math.floor(start / 60000)) * 60000);
}
const worked = (e, now = Date.now()) => workedMinutesMs(e.start, e.end ?? now);
const exactWorked = (e, now = Date.now()) => Math.max(0, (e.end ?? now) - e.start);
const totalWorked = (list, now = Date.now()) => list.reduce((t, e) => t + worked(e, now), 0);

// MARK: - Uitgevoerde werken

const WorkTypes = {
  defaults: ['Allerlei', 'Zagen', 'Afplakken', 'CNC', 'Monteren'],
  /** Oudere versies bewaarden een vaste sleutel in plaats van de naam. */
  legacy: { allerlei: 'Allerlei', zagen: 'Zagen', afplakken: 'Afplakken', cnc: 'CNC', monteren: 'Monteren' },
  /** Komma's en aanhalingstekens weg: die breken de keuzelijst in Excel. */
  clean(name) { return name.replace(/,/g, ' ').replace(/"/g, '').split(/\s+/).filter(Boolean).join(' '); },
  name(raw) { return WorkTypes.legacy[raw] ?? raw; },
};

// MARK: - Opslag (alleen op dit toestel)
// Elke wijziging gaat naar localStorage én naar IndexedDB. IndexedDB legt een wijziging meteen vast;
// localStorage soms pas na enkele seconden. Bij het opstarten telt de nieuwste kopie.

const KEY = 'urenlog.v1';

const IDB = {
  db: null,
  open() {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const req = indexedDB.open('urenlog', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('data');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.db;
  },
  async get() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction('data').objectStore('data').get(KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  },
  async put(value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('data', 'readwrite');
      tx.objectStore('data').put(value, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
};

const defaultSettings = () => ({
  userName: '',
  lastWorkType: '',
  manualStartMinutes: 7 * 60 + 30,
  manualEndMinutes: 16 * 60,
  /** Standaard aan: een back-up is de enige bescherming als het toestel stuk of kwijt is. */
  backupReminder: true,
  /** 1 = maandag … 7 = zondag (zoals in de back-up). */
  backupReminderDay: 5,
  backupReminderMinutes: 16 * 60,
  lastBackupDate: 0,
  /** Wanneer de back-upvraag laatst getoond of weggeklikt is. */
  reminderHandled: 0,
});

const Store = {
  entries: [],
  workTypes: [],
  settings: defaultSettings(),
  /** Gegevens voor de volgende registratie, zolang je niet ingeklokt bent. */
  draft: { jobName: '', projectNumber: '', note: '', isPrivate: false },
  listeners: new Set(),

  async load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { /* leeg */ }
    try {
      const stored = await IDB.get();
      if (stored && (!data || (stored.savedAt ?? 0) > (data.savedAt ?? 0))) data = stored;
    } catch (err) { console.warn('IndexedDB niet beschikbaar:', err); }
    if (data) {
      this.entries = data.entries ?? [];
      this.workTypes = data.workTypes ?? [];
      this.settings = { ...defaultSettings(), ...(data.settings ?? {}) };
      this.draft = { ...this.draft, ...(data.draft ?? {}) };
    } else {
      // Eerste keer: standaardlijst aanmaken; de herinnering telt vanaf nu.
      this.workTypes = [...WorkTypes.defaults];
      this.settings.reminderHandled = Date.now();
    }
    for (const e of this.entries) e.workType = WorkTypes.name(e.workType);
    if (!this.workTypes.includes(this.settings.lastWorkType)) this.settings.lastWorkType = this.workTypes[0] ?? '';
  },

  save() {
    const data = {
      savedAt: Date.now(), entries: this.entries, workTypes: this.workTypes, settings: this.settings, draft: this.draft,
    };
    let saved = false;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      saved = true;
    } catch (err) { console.error(err); }
    IDB.put(JSON.parse(JSON.stringify(data))).catch(err => {
      console.error(err);
      if (!saved) alertBox('Opslaan mislukt', 'Er is geen ruimte meer op dit toestel om je uren te bewaren.');
    });
  },

  changed() { this.save(); for (const fn of this.listeners) fn(); },

  get running() { return this.entries.filter(e => e.end == null).sort((a, b) => a.start - b.start)[0] ?? null; },

  add(fields) {
    const e = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
      start: Date.now(), end: null, projectNumber: '', workType: 'Allerlei', note: '', jobName: '',
      isPrivate: false, createdAt: Date.now(), ...fields,
    };
    this.entries.push(e);
    return e;
  },

  remove(entry) { this.entries = this.entries.filter(e => e !== entry); },
};

// MARK: - Back-up (zelfde bestand als de iPhone- en Android-app)

const BackupError = {
  unreadable: 'Dit bestand is geen geldige back-up van e. baillien - Timer.',
  tooNew: 'Deze back-up is gemaakt met een nieuwere versie van e. baillien - Timer. Werk de app eerst bij.',
};

const Backup = {
  currentVersion: 1,

  /** Zoals de iPhone-app: ISO 8601 zonder milliseconden. */
  iso(ms) { return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z'); },

  make() {
    const s = Store.settings;
    const settings = {
      backupReminder: s.backupReminder,
      backupReminderDay: s.backupReminderDay,
      backupReminderMinutes: s.backupReminderMinutes,
      lastWorkType: s.lastWorkType || undefined,
      manualEndMinutes: s.manualEndMinutes,
      manualStartMinutes: s.manualStartMinutes,
      userName: s.userName,
    };
    const entries = [...Store.entries].sort((a, b) => a.start - b.start).map(e => ({
      createdAt: this.iso(e.createdAt),
      end: e.end == null ? undefined : this.iso(e.end),
      isPrivate: e.isPrivate ? true : undefined,
      job: e.jobName ? e.jobName : undefined,
      note: e.note,
      projectNumber: e.projectNumber,
      start: this.iso(e.start),
      workType: e.workType,
    }));
    return {
      app: 'UrenLog', entries, exportedAt: this.iso(Date.now()), jobs: [], settings,
      version: this.currentVersion, workTypes: [...Store.workTypes],
    };
  },

  encoded() { return JSON.stringify(this.make(), null, 2); },

  get fileName() { return `baillien-timer-backup-${D.ymd(new Date())}.json`; },

  decode(text) {
    let b;
    try { b = JSON.parse(text); } catch { throw new Error(BackupError.unreadable); }
    if (!b || b.app !== 'UrenLog' || typeof b.version !== 'number' || !Array.isArray(b.entries)) {
      throw new Error(BackupError.unreadable);
    }
    if (b.version > this.currentVersion) throw new Error(BackupError.tooNew);
    const date = v => { const t = Date.parse(v); if (Number.isNaN(t)) throw new Error(BackupError.unreadable); return t; };
    b.entries = b.entries.map(r => ({
      start: date(r.start),
      end: r.end == null ? null : date(r.end),
      projectNumber: r.projectNumber ?? '',
      workType: r.workType ?? 'Allerlei',
      note: r.note ?? '',
      createdAt: r.createdAt ? date(r.createdAt) : Date.now(),
      job: r.job ?? null,
      isPrivate: r.isPrivate ?? false,
    }));
    b.exportedAt = b.exportedAt ? date(b.exportedAt) : Date.now();
    return b;
  },

  key(start, end, projectNumber) {
    return `${Math.trunc(start / 1000)}|${end == null ? '-' : Math.trunc(end / 1000)}|${projectNumber}`;
  },

  /** replace: eerst alles wissen; anders samenvoegen en bestaande registraties overslaan. */
  restore(b, replace) {
    if (replace) {
      Store.entries = [];
      if (Array.isArray(b.workTypes)) Store.workTypes = [];
    }
    if (Array.isArray(b.workTypes)) {
      for (const name of b.workTypes) {
        if (!Store.workTypes.some(n => n.toLowerCase() === String(name).toLowerCase())) Store.workTypes.push(String(name));
      }
    }
    const existing = new Set(replace ? [] : Store.entries.map(e => this.key(e.start, e.end, e.projectNumber)));
    const result = { added: 0, skipped: 0 };
    for (const r of b.entries) {
      const key = this.key(r.start, r.end, r.projectNumber);
      if (existing.has(key)) { result.skipped++; continue; }
      existing.add(key);
      Store.add({
        start: r.start, end: r.end, projectNumber: r.projectNumber, workType: WorkTypes.name(r.workType),
        note: r.note, jobName: r.job ?? '', isPrivate: r.isPrivate, createdAt: r.createdAt,
      });
      result.added++;
    }
    if (b.settings) this.applySettings(b.settings);
    if (!Store.workTypes.includes(Store.settings.lastWorkType)) Store.settings.lastWorkType = Store.workTypes[0] ?? '';
    Store.changed();
    return result;
  },

  /** Wat ontbreekt (oudere back-ups) blijft zoals het is. */
  applySettings(s) {
    const t = Store.settings;
    const inDay = m => Number.isInteger(m) && m >= 0 && m < 24 * 60;
    if (typeof s.userName === 'string' && s.userName.trim()) t.userName = s.userName;
    if (Number.isInteger(s.backupReminderDay) && s.backupReminderDay >= 1 && s.backupReminderDay <= 7) {
      t.backupReminderDay = s.backupReminderDay;
    }
    if (inDay(s.backupReminderMinutes)) t.backupReminderMinutes = s.backupReminderMinutes;
    if (inDay(s.manualStartMinutes)) t.manualStartMinutes = s.manualStartMinutes;
    if (inDay(s.manualEndMinutes)) t.manualEndMinutes = s.manualEndMinutes;
    if (typeof s.lastWorkType === 'string' && s.lastWorkType) t.lastWorkType = s.lastWorkType;
    if (typeof s.backupReminder === 'boolean') {
      t.backupReminder = s.backupReminder;
      t.reminderHandled = Date.now();
    }
  },
};

// MARK: - Wekelijkse herinnering
// Een website kan geen melding plannen. Daarom vraagt de app het bij het openen, als het gekozen
// moment (dag en uur) voorbij is sinds de laatste back-up.

const BackupReminder = {
  weekdays: [['Maandag', 1], ['Dinsdag', 2], ['Woensdag', 3], ['Donderdag', 4], ['Vrijdag', 5], ['Zaterdag', 6],
    ['Zondag', 7]],

  /** Het laatste gekozen moment vóór of op `now`. */
  lastMoment(now = new Date()) {
    const s = Store.settings;
    let t = D.atMinutes(D.addDays(D.weekStart(now), s.backupReminderDay - 1), s.backupReminderMinutes);
    if (t > now) t = D.addDays(t, -7);
    return +t;
  },

  isDue() {
    const s = Store.settings;
    if (!s.backupReminder || !Store.entries.length) return false;
    const moment = this.lastMoment();
    return s.lastBackupDate < moment && s.reminderHandled < moment;
  },
};
