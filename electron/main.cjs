const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;
const port = process.env.DEV_PORT || "5174";

// ═══════ AUTO-UPDATER ═══════
let autoUpdater = null;
let mainWin = null;
function sendToRenderer(channel, ...args) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, ...args);
}
function setupAutoUpdater() {
  if (isDev) return; // skip in dev mode
  try {
    const { autoUpdater: au } = require("electron-updater");
    autoUpdater = au;
    autoUpdater.autoDownload = false; // let user decide
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => sendToRenderer("update:status", "checking"));
    autoUpdater.on("update-available", (info) => sendToRenderer("update:status", "available", { version: info.version, releaseDate: info.releaseDate }));
    autoUpdater.on("update-not-available", () => sendToRenderer("update:status", "not-available"));
    autoUpdater.on("download-progress", (prog) => sendToRenderer("update:status", "downloading", { percent: Math.round(prog.percent) }));
    autoUpdater.on("update-downloaded", (info) => sendToRenderer("update:status", "downloaded", { version: info.version }));
    autoUpdater.on("error", (err) => sendToRenderer("update:status", "error", { message: err?.message || String(err) }));

    // Check for updates 3 seconds after launch, then every 4 hours
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
  } catch (e) {
    console.error("Auto-updater setup failed:", e.message);
  }
}

// ═══════ PATHS ═══════
function getDataDir() {
  if (isDev) return path.join(__dirname, "..", "dev-data");
  return path.join(app.getPath("userData"), "data");
}
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function getDbPath() { const d = getDataDir(); ensureDir(d); return path.join(d, "clik.db"); }

// ═══════ SQLite ═══════
let db = null;

const JSON_COLS = {
  jobs: ["cb", "ff", "cbInvoices", "ffInvoices"],
  invoices: ["items", "displayFields", "jobData", "payments", "invoicedCodes", "taxComponents"],
  apRecords: ["items", "payments"],
};

function safeParseJSON(str, fallback = []) { try { return JSON.parse(str || JSON.stringify(fallback)); } catch (_) { return fallback; } }
function rowToObj(table, row) {
  if (!row) return null;
  const obj = { ...row };
  for (const c of (JSON_COLS[table] || [])) {
    if (obj[c] !== undefined && obj[c] !== null && typeof obj[c] === "string") {
      try { obj[c] = JSON.parse(obj[c]); } catch (_) { obj[c] = c.endsWith("s") ? [] : {}; }
    } else if (obj[c] === null || obj[c] === undefined) {
      obj[c] = c.endsWith("s") ? [] : {};
    }
  }
  if (table === "jobs") { obj.cbEnabled = !!obj.cbEnabled; obj.ffEnabled = !!obj.ffEnabled; }
  return obj;
}

function objToRow(table, obj) {
  const row = { ...obj };
  for (const c of (JSON_COLS[table] || [])) {
    if (row[c] !== undefined && typeof row[c] !== "string") row[c] = JSON.stringify(row[c]);
  }
  if (table === "jobs") {
    if (row.cbEnabled !== undefined) row.cbEnabled = row.cbEnabled ? 1 : 0;
    if (row.ffEnabled !== undefined) row.ffEnabled = row.ffEnabled ? 1 : 0;
  }
  return row;
}

function runMigrations() {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
  const getVer = () => { const r = db.prepare("SELECT value FROM meta WHERE key='schema_version'").get(); return r ? parseInt(r.value) : 0; };
  const setVer = v => db.prepare("INSERT OR REPLACE INTO meta (key,value) VALUES ('schema_version',?)").run(String(v));
  let ver = getVer();

  if (ver < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, address TEXT DEFAULT '', contact TEXT DEFAULT '', email TEXT DEFAULT '', phone TEXT DEFAULT '', brokerageFee TEXT DEFAULT '', paymentTerms TEXT DEFAULT '30', createdAt TEXT DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_cust_name ON customers(name);
      CREATE INDEX IF NOT EXISTS idx_cust_code ON customers(code);
      CREATE TABLE IF NOT EXISTS payees (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, address TEXT DEFAULT '', contact TEXT DEFAULT '', email TEXT DEFAULT '', phone TEXT DEFAULT '', createdAt TEXT DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_pay_name ON payees(name);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, customer TEXT NOT NULL, province TEXT DEFAULT 'Ontario', cbEnabled INTEGER DEFAULT 0, ffEnabled INTEGER DEFAULT 0, bl TEXT DEFAULT '', ior TEXT DEFAULT '', ccn TEXT DEFAULT '', "transaction" TEXT DEFAULT '', mbl TEXT DEFAULT '', hbl TEXT DEFAULT '', cntr TEXT DEFAULT '', size TEXT DEFAULT '', quantity TEXT DEFAULT '', quantityUom TEXT DEFAULT 'PLT', weight TEXT DEFAULT '', volume TEXT DEFAULT '', shipper TEXT DEFAULT '', cnee TEXT DEFAULT '', pol TEXT DEFAULT '', polAtd TEXT DEFAULT '', pod TEXT DEFAULT '', podEta TEXT DEFAULT '', remark TEXT DEFAULT '', cb TEXT DEFAULT '{}', ff TEXT DEFAULT '{}', cbInvoices TEXT DEFAULT '[]', ffInvoices TEXT DEFAULT '[]', createdAt TEXT DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_job_cust ON jobs(customer);
      CREATE INDEX IF NOT EXISTS idx_job_bl ON jobs(bl);
      CREATE TABLE IF NOT EXISTS invoices (invoiceNumber TEXT PRIMARY KEY, type TEXT NOT NULL, customer TEXT NOT NULL, province TEXT DEFAULT '', date TEXT DEFAULT '', jobId TEXT NOT NULL, items TEXT DEFAULT '[]', subtotal REAL DEFAULT 0, taxAmount REAL DEFAULT 0, total REAL DEFAULT 0, displayFields TEXT DEFAULT '{}', jobData TEXT DEFAULT '{}', payments TEXT DEFAULT '[]', dueDate TEXT DEFAULT '', invoicedCodes TEXT DEFAULT '[]', fxRate REAL DEFAULT 0, createdAt TEXT DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_inv_job ON invoices(jobId);
      CREATE INDEX IF NOT EXISTS idx_inv_cust ON invoices(customer);
      CREATE INDEX IF NOT EXISTS idx_inv_date ON invoices(date);
      CREATE TABLE IF NOT EXISTS apRecords (id TEXT PRIMARY KEY, jobId TEXT DEFAULT '', customer TEXT DEFAULT '', payee TEXT NOT NULL, date TEXT DEFAULT '', items TEXT DEFAULT '[]', total REAL DEFAULT 0, type TEXT DEFAULT 'Disbursement', payments TEXT DEFAULT '[]', dueDate TEXT DEFAULT '', invoiceNum TEXT DEFAULT '', fxRate REAL DEFAULT 0, memo TEXT DEFAULT '', createdAt TEXT DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_ap_job ON apRecords(jobId);
      CREATE INDEX IF NOT EXISTS idx_ap_payee ON apRecords(payee);
      CREATE INDEX IF NOT EXISTS idx_ap_date ON apRecords(date);
      CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, value INTEGER DEFAULT 1);
      INSERT OR IGNORE INTO counters (key,value) VALUES ('nextJobId',1),('nextCustSeq',1),('nextPayeeSeq',1),('nextCBInvoice',1),('nextFFInvoice',1),('nextAPId',1),('nextGeneralId',1);
    `);
    setVer(1);
  }
  if (ver < 2) {
    db.exec(`CREATE TABLE IF NOT EXISTS company_settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`);
    const defaults = [['companyName',''],['address',''],['taxId',''],['businessNumber',''],['notesTerms',''],['phone',''],['email',''],['website','']];
    const ins = db.prepare("INSERT OR IGNORE INTO company_settings (key, value) VALUES (?, ?)");
    defaults.forEach(([k, v]) => ins.run(k, v));
    setVer(2);
  }
  if (ver < 3) {
    try { db.exec("ALTER TABLE invoices ADD COLUMN closedDate TEXT DEFAULT ''"); } catch (_) {}
    try { db.exec("ALTER TABLE apRecords ADD COLUMN closedDate TEXT DEFAULT ''"); } catch (_) {}
    setVer(3);
  }
  if (ver < 4) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inv_closed ON invoices(closedDate);
      CREATE INDEX IF NOT EXISTS idx_inv_type ON invoices(type);
      CREATE INDEX IF NOT EXISTS idx_inv_date_closed ON invoices(date, closedDate);
      CREATE INDEX IF NOT EXISTS idx_ap_closed ON apRecords(closedDate);
      CREATE INDEX IF NOT EXISTS idx_ap_type ON apRecords(type);
      CREATE INDEX IF NOT EXISTS idx_ap_date_closed ON apRecords(date, closedDate);
      CREATE INDEX IF NOT EXISTS idx_ap_invoiceNum ON apRecords(invoiceNum);
    `);
    setVer(4);
  }
  if (ver < 5) {
    try { db.exec("ALTER TABLE jobs ADD COLUMN closingDate TEXT DEFAULT ''"); } catch (_) {}
    db.exec("CREATE INDEX IF NOT EXISTS idx_job_closing ON jobs(closingDate)");
    setVer(5);
  }
  if (ver < 6) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        UNIQUE(type, code)
      )
    `);
    setVer(6);
  }
  if (ver < 7) {
    try { db.exec("ALTER TABLE apRecords ADD COLUMN currency TEXT DEFAULT 'CAD'"); } catch (_) {}
    try { db.exec("ALTER TABLE apRecords ADD COLUMN paidDate TEXT DEFAULT ''"); } catch (_) {}
    setVer(7);
  }
  if (ver < 8) {
    try { db.exec("ALTER TABLE jobs ADD COLUMN closedMonth TEXT DEFAULT ''"); } catch (_) {}
    try { db.exec("ALTER TABLE apRecords ADD COLUMN closedMonth TEXT DEFAULT ''"); } catch (_) {}
    db.exec("CREATE INDEX IF NOT EXISTS idx_job_closedMonth ON jobs(closedMonth)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_ap_closedMonth ON apRecords(closedMonth)");
    setVer(8);
  }
  if (ver < 9) {
    try { db.exec("ALTER TABLE jobs ADD COLUMN seal TEXT DEFAULT ''"); } catch (_) {}
    setVer(9);
  }
  if (ver < 10) {
    try { db.exec("ALTER TABLE invoices ADD COLUMN invoiceCurrency TEXT DEFAULT 'CAD'"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN taxLabel TEXT DEFAULT ''"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN taxRate REAL DEFAULT 0"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN taxComponents TEXT DEFAULT '[]'"); } catch (_) {}
    setVer(10);
  }
}

function initDB() {
  const Database = require("better-sqlite3");
  db = new Database(getDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations();
}

// ═══════ COUNTER HELPERS ═══════
function getCounter(key) { return db.prepare("SELECT value FROM counters WHERE key=?").get(key)?.value || 1; }
function incCounter(key) {
  const txn = db.transaction(() => {
    const v = db.prepare("SELECT value FROM counters WHERE key=?").get(key)?.value || 1;
    db.prepare("UPDATE counters SET value=? WHERE key=?").run(v + 1, key);
    return v;
  });
  return txn();
}

// ═══════ UNINVOICED CALC (batch, no N+1) ═══════
const CB_CODES = ["CLC","CDT","CDX","ACI","ISF","RPP","HDC","OTC","EXM"];
const FF_CODES = ["TKC","HDC","PPC","STR","WTC","OTC","WHI","WHO","OPC","PLT","BOL","CLC","ACI","CDT","CDX"];
function calcUninvoiced(dateFrom, dateTo) {
  const allInvCodes = {};
  db.prepare("SELECT invoiceNumber, invoicedCodes FROM invoices").all().forEach(r => {
    allInvCodes[r.invoiceNumber] = safeParseJSON(r.invoicedCodes, []);
  });
  let jobQuery = "SELECT id, cb, ff, cbInvoices, ffInvoices FROM jobs WHERE 1=1";
  const params = [];
  if (dateFrom) { jobQuery += " AND createdAt>=?"; params.push(dateFrom + "T00:00:00.000Z"); }
  if (dateTo) { jobQuery += " AND createdAt<=?"; params.push(dateTo + "T23:59:59.999Z"); }
  const allJobs = db.prepare(jobQuery).all(...params);
  const byCode = {}; let arTotal = 0, apTotal = 0;
  for (const j of allJobs) {
    const cb = safeParseJSON(j.cb, {});
    const ff = safeParseJSON(j.ff, {});
    const cbInvs = safeParseJSON(j.cbInvoices, []);
    const ffInvs = safeParseJSON(j.ffInvoices, []);
    const cbInvCodes = new Set();
    for (const invNum of cbInvs) { for (const c of (allInvCodes[invNum] || [])) cbInvCodes.add(c); }
    const ffInvCodes = new Set();
    for (const invNum of ffInvs) { for (const c of (allInvCodes[invNum] || [])) ffInvCodes.add(c); }
    for (const code of CB_CODES) { if (!cbInvCodes.has(code)) { const amt = parseFloat(cb[code]) || 0; if (amt > 0) { byCode[code] = (byCode[code] || 0) + amt; arTotal += amt; if (cb[code + "_disb"]) apTotal += amt; } } }
    for (const code of FF_CODES) { if (!ffInvCodes.has(code)) { const amt = parseFloat(ff[code]) || 0; if (amt > 0) { byCode[code] = (byCode[code] || 0) + amt; arTotal += amt; } } }
  }
  return { byCode, arTotal, apTotal };
}

// ═══════ IPC HANDLERS ═══════
function safeHandle(channel, fn) {
  ipcMain.handle(channel, async (...args) => {
    try { return await fn(...args); }
    catch (e) { console.error(`[IPC ERROR] ${channel}:`, e.message); return null; }
  });
}
function setupIPC() {
  // ── COMPANY SETTINGS ──
  safeHandle("company:get", () => {
    const rows = db.prepare("SELECT key, value FROM company_settings").all();
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    return obj;
  });
  safeHandle("company:set", (_, data) => {
    const upsert = db.prepare("INSERT INTO company_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
    const txn = db.transaction(() => { for (const [k, v] of Object.entries(data)) upsert.run(k, v || ""); });
    txn();
    return true;
  });

  // ── CUSTOMERS ──
  safeHandle("customers:list", () => db.prepare("SELECT * FROM customers ORDER BY code").all().map(r => rowToObj("customers", r)));
  safeHandle("customers:add", (_, d) => { const seq = incCounter("nextCustSeq"); const code = `A${seq}`; const id = `CUST-${code}`; const row = { id, code, address: "", contact: "", email: "", phone: "", brokerageFee: "", paymentTerms: "30", ...d, }; db.prepare("INSERT INTO customers (id,code,name,address,contact,email,phone,brokerageFee,paymentTerms) VALUES (@id,@code,@name,@address,@contact,@email,@phone,@brokerageFee,@paymentTerms)").run(row); return { ...row }; });
  safeHandle("customers:update", (_, id, d) => { const sets = Object.keys(d).map(k => `${k}=@${k}`).join(","); db.prepare(`UPDATE customers SET ${sets} WHERE id=@id`).run({ ...d, id }); });
  safeHandle("customers:delete", (_, id) => db.prepare("DELETE FROM customers WHERE id=?").run(id));
  safeHandle("customers:findByName", (_, name) => { const r = db.prepare("SELECT * FROM customers WHERE name=?").get(name); return r ? rowToObj("customers", r) : null; });
  safeHandle("customers:exists", (_, name) => !!db.prepare("SELECT 1 FROM customers WHERE LOWER(name)=LOWER(?)").get(name));
  safeHandle("customers:nextCode", () => `A${getCounter("nextCustSeq")}`);

  // ── PAYEES ──
  safeHandle("payees:list", () => db.prepare("SELECT * FROM payees ORDER BY code").all().map(r => rowToObj("payees", r)));
  safeHandle("payees:add", (_, d) => { const seq = incCounter("nextPayeeSeq"); const code = `B${seq}`; const id = `PAYEE-${code}`; const row = { id, code, address: "", contact: "", email: "", phone: "", ...d }; db.prepare("INSERT INTO payees (id,code,name,address,contact,email,phone) VALUES (@id,@code,@name,@address,@contact,@email,@phone)").run(row); return { ...row }; });
  safeHandle("payees:update", (_, id, d) => { const sets = Object.keys(d).map(k => `${k}=@${k}`).join(","); db.prepare(`UPDATE payees SET ${sets} WHERE id=@id`).run({ ...d, id }); });
  safeHandle("payees:delete", (_, id) => db.prepare("DELETE FROM payees WHERE id=?").run(id));
  safeHandle("payees:exists", (_, name) => !!db.prepare("SELECT 1 FROM payees WHERE LOWER(name)=LOWER(?)").get(name));
  safeHandle("payees:nextCode", () => `B${getCounter("nextPayeeSeq")}`);

  // ── JOBS ──
  safeHandle("jobs:list", (_, { limit = 200, offset = 0, search = "", closingFrom = "", closingTo = "" } = {}) => {
    let sql = "SELECT * FROM jobs WHERE 1=1";
    const params = [];
    if (search) { const q = `%${search}%`; sql += " AND (id LIKE ? OR bl LIKE ? OR mbl LIKE ? OR customer LIKE ?)"; params.push(q, q, q, q); }
    if (closingFrom) { sql += " AND closingDate>=?"; params.push(closingFrom); }
    if (closingTo) { sql += " AND closingDate<=?"; params.push(closingTo); }
    sql += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    return db.prepare(sql).all(...params).map(r => rowToObj("jobs", r));
  });
  safeHandle("jobs:count", (_, { search = "", closingFrom = "", closingTo = "" } = {}) => {
    let sql = "SELECT COUNT(*) as c FROM jobs WHERE 1=1";
    const params = [];
    if (search) { const q = `%${search}%`; sql += " AND (id LIKE ? OR bl LIKE ? OR mbl LIKE ? OR customer LIKE ?)"; params.push(q, q, q, q); }
    if (closingFrom) { sql += " AND closingDate>=?"; params.push(closingFrom); }
    if (closingTo) { sql += " AND closingDate<=?"; params.push(closingTo); }
    return db.prepare(sql).all(...params).length > 0 ? db.prepare(sql).get(...params).c : 0;
  });
  safeHandle("jobs:get", (_, id) => { const r = db.prepare("SELECT * FROM jobs WHERE id=?").get(id); return r ? rowToObj("jobs", r) : null; });
  safeHandle("jobs:add", (_, d) => {
    const seq = incCounter("nextJobId");
    const id = `CLIK-${String(seq).padStart(5, "0")}`;
    const row = objToRow("jobs", { id, province: "Ontario", cbEnabled: false, ffEnabled: false, bl: "", ior: "", ccn: "", transaction: "", mbl: "", hbl: "", cntr: "", size: "", seal: "", quantity: "", quantityUom: "PLT", weight: "", volume: "", shipper: "", cnee: "", pol: "", polAtd: "", pod: "", podEta: "", remark: "", cb: {}, ff: {}, cbInvoices: [], ffInvoices: [], closingDate: "", closedMonth: "", createdAt: new Date().toISOString(), ...d });
    db.prepare(`INSERT INTO jobs (id,customer,province,cbEnabled,ffEnabled,bl,ior,ccn,"transaction",mbl,hbl,cntr,size,seal,quantity,quantityUom,weight,volume,shipper,cnee,pol,polAtd,pod,podEta,remark,cb,ff,cbInvoices,ffInvoices,closingDate,closedMonth,createdAt) VALUES (@id,@customer,@province,@cbEnabled,@ffEnabled,@bl,@ior,@ccn,@transaction,@mbl,@hbl,@cntr,@size,@seal,@quantity,@quantityUom,@weight,@volume,@shipper,@cnee,@pol,@polAtd,@pod,@podEta,@remark,@cb,@ff,@cbInvoices,@ffInvoices,@closingDate,@closedMonth,@createdAt)`).run(row);
    return rowToObj("jobs", db.prepare("SELECT * FROM jobs WHERE id=?").get(id));
  });
  safeHandle("jobs:update", (_, id, d) => {
    const row = objToRow("jobs", d);
    const sets = Object.keys(row).filter(k => k !== "id").map(k => k === "transaction" ? `"transaction"=@transaction` : `${k}=@${k}`).join(",");
    db.prepare(`UPDATE jobs SET ${sets} WHERE id=@id`).run({ ...row, id });
    return rowToObj("jobs", db.prepare("SELECT * FROM jobs WHERE id=?").get(id));
  });
  safeHandle("jobs:countByCustomer", (_, customerName) => db.prepare("SELECT COUNT(*) as c FROM jobs WHERE customer=?").get(customerName).c);
  safeHandle("jobs:bulkClose", (_, ids, closedMonth) => {
    const stmt = db.prepare("UPDATE jobs SET closedMonth=? WHERE id=?");
    const tx = db.transaction(() => { for (const id of ids) stmt.run(closedMonth, id); });
    tx();
  });
  safeHandle("jobs:bulkReopen", (_, ids) => {
    const stmt = db.prepare("UPDATE jobs SET closedMonth='' WHERE id=?");
    const tx = db.transaction(() => { for (const id of ids) stmt.run(id); });
    tx();
  });
  safeHandle("ap:bulkClose", (_, ids, closedMonth) => {
    const stmt = db.prepare("UPDATE apRecords SET closedMonth=? WHERE id=?");
    const tx = db.transaction(() => { for (const id of ids) stmt.run(closedMonth, id); });
    tx();
  });
  safeHandle("ap:bulkReopen", (_, ids) => {
    const stmt = db.prepare("UPDATE apRecords SET closedMonth='' WHERE id=?");
    const tx = db.transaction(() => { for (const id of ids) stmt.run(id); });
    tx();
  });

  // Aggregate profit per job (SQL-side, no full table scan)
  safeHandle("jobs:profitMap", (_, jobIds) => {
    if (!jobIds || jobIds.length === 0) return {};
    const placeholders = jobIds.map(() => "?").join(",");
    const arRows = db.prepare(`SELECT jobId, SUM(total) as ar FROM invoices WHERE jobId IN (${placeholders}) GROUP BY jobId`).all(...jobIds);
    const apRows = db.prepare(`SELECT jobId, SUM(total) as ap FROM apRecords WHERE jobId IN (${placeholders}) GROUP BY jobId`).all(...jobIds);
    const pm = {};
    arRows.forEach(r => { pm[r.jobId] = { ar: r.ar || 0, ap: 0 }; });
    apRows.forEach(r => { if (!pm[r.jobId]) pm[r.jobId] = { ar: 0, ap: 0 }; pm[r.jobId].ap = r.ap || 0; });
    return pm;
  });

  // ── INVOICES ──
  safeHandle("invoices:list", (_, { jobId, customer, dateFrom, dateTo, type, limit, offset = 0 } = {}) => {
    let sql = "SELECT * FROM invoices WHERE 1=1";
    const params = {};
    if (jobId) { sql += " AND jobId=@jobId"; params.jobId = jobId; }
    if (customer) { sql += " AND customer=@customer"; params.customer = customer; }
    if (dateFrom) { sql += " AND date>=@dateFrom"; params.dateFrom = dateFrom; }
    if (dateTo) { sql += " AND date<=@dateTo"; params.dateTo = dateTo; }
    if (type && type !== "All") { sql += " AND type=@type"; params.type = type; }
    sql += " ORDER BY date DESC";
    if (limit) { sql += " LIMIT @limit OFFSET @offset"; params.limit = limit; params.offset = offset; }
    return db.prepare(sql).all(params).map(r => rowToObj("invoices", r));
  });
  safeHandle("invoices:get", (_, num) => { const r = db.prepare("SELECT * FROM invoices WHERE invoiceNumber=?").get(num); return r ? rowToObj("invoices", r) : null; });
  safeHandle("invoices:add", (_, d) => {
    const row = objToRow("invoices", { province: "", date: "", items: [], subtotal: 0, taxAmount: 0, total: 0, displayFields: {}, jobData: {}, payments: [], dueDate: "", invoicedCodes: [], fxRate: 0, invoiceCurrency: "CAD", taxLabel: "", taxRate: 0, taxComponents: [], createdAt: new Date().toISOString(), ...d });
    db.prepare("INSERT INTO invoices (invoiceNumber,type,customer,province,date,jobId,items,subtotal,taxAmount,total,displayFields,jobData,payments,dueDate,invoicedCodes,fxRate,invoiceCurrency,taxLabel,taxRate,taxComponents,createdAt) VALUES (@invoiceNumber,@type,@customer,@province,@date,@jobId,@items,@subtotal,@taxAmount,@total,@displayFields,@jobData,@payments,@dueDate,@invoicedCodes,@fxRate,@invoiceCurrency,@taxLabel,@taxRate,@taxComponents,@createdAt)").run(row);
    return rowToObj("invoices", db.prepare("SELECT * FROM invoices WHERE invoiceNumber=?").get(d.invoiceNumber));
  });
  safeHandle("invoices:update", (_, num, d) => {
    const row = objToRow("invoices", d);
    const sets = Object.keys(row).filter(k => k !== "invoiceNumber").map(k => `${k}=@${k}`).join(",");
    db.prepare(`UPDATE invoices SET ${sets} WHERE invoiceNumber=@invoiceNumber`).run({ ...row, invoiceNumber: num });
    return rowToObj("invoices", db.prepare("SELECT * FROM invoices WHERE invoiceNumber=?").get(num));
  });
  safeHandle("invoices:byJob", (_, jobId) => db.prepare("SELECT * FROM invoices WHERE jobId=? ORDER BY date DESC").all(jobId).map(r => rowToObj("invoices", r)));
  safeHandle("invoices:nextNum", (_, type) => {
    const key = type === "CB" ? "nextCBInvoice" : "nextFFInvoice";
    const seq = incCounter(key);
    return `${type}-${String(seq).padStart(5, "0")}`;
  });
  safeHandle("invoices:stats", (_, { dateFrom, dateTo } = {}) => {
    let where = "1=1";
    const p = {};
    if (dateFrom) { where += " AND date>=@dateFrom"; p.dateFrom = dateFrom; }
    if (dateTo) { where += " AND date<=@dateTo"; p.dateTo = dateTo; }
    const rows = db.prepare(`SELECT invoiceNumber, total, payments, date, dueDate, customer, type, jobId FROM invoices WHERE ${where}`).all(p);
    return rows.map(r => ({ ...r, payments: safeParseJSON(r.payments, []) }));
  });
  safeHandle("invoices:count", (_, { dateFrom, dateTo, type } = {}) => {
    let where = "1=1"; const p = {};
    if (dateFrom) { where += " AND date>=@dateFrom"; p.dateFrom = dateFrom; }
    if (dateTo) { where += " AND date<=@dateTo"; p.dateTo = dateTo; }
    if (type && type !== "All") { where += " AND type=@type"; p.type = type; }
    return db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE ${where}`).get(p).c;
  });

  // ── AP RECORDS ──
  safeHandle("ap:list", (_, { dateFrom, dateTo, payee, limit, offset = 0 } = {}) => {
    let sql = "SELECT * FROM apRecords WHERE 1=1";
    const params = {};
    if (dateFrom) { sql += " AND date>=@dateFrom"; params.dateFrom = dateFrom; }
    if (dateTo) { sql += " AND date<=@dateTo"; params.dateTo = dateTo; }
    if (payee) { sql += " AND payee=@payee"; params.payee = payee; }
    sql += " ORDER BY date DESC";
    if (limit) { sql += " LIMIT @limit OFFSET @offset"; params.limit = limit; params.offset = offset; }
    return db.prepare(sql).all(params).map(r => rowToObj("apRecords", r));
  });
  safeHandle("ap:get", (_, id) => { const r = db.prepare("SELECT * FROM apRecords WHERE id=?").get(id); return r ? rowToObj("apRecords", r) : null; });
  safeHandle("ap:add", (_, d) => {
    const row = objToRow("apRecords", { jobId: "", customer: "", date: "", items: [], total: 0, type: "Disbursement", payments: [], dueDate: "", invoiceNum: "", fxRate: 0, memo: "", currency: "CAD", paidDate: "", createdAt: new Date().toISOString(), ...d });
    db.prepare("INSERT INTO apRecords (id,jobId,customer,payee,date,items,total,type,payments,dueDate,invoiceNum,fxRate,memo,currency,paidDate,createdAt) VALUES (@id,@jobId,@customer,@payee,@date,@items,@total,@type,@payments,@dueDate,@invoiceNum,@fxRate,@memo,@currency,@paidDate,@createdAt)").run(row);
    return rowToObj("apRecords", db.prepare("SELECT * FROM apRecords WHERE id=?").get(d.id));
  });
  safeHandle("ap:update", (_, id, d) => {
    const row = objToRow("apRecords", d);
    const sets = Object.keys(row).filter(k => k !== "id").map(k => `${k}=@${k}`).join(",");
    db.prepare(`UPDATE apRecords SET ${sets} WHERE id=@id`).run({ ...row, id });
  });
  safeHandle("ap:delete", (_, id) => db.prepare("DELETE FROM apRecords WHERE id=?").run(id));
  safeHandle("ap:byJob", (_, jobId) => db.prepare("SELECT * FROM apRecords WHERE jobId=? ORDER BY date DESC").all(jobId).map(r => rowToObj("apRecords", r)));
  safeHandle("ap:deleteByJobInvoice", (_, jobId, invNum) => db.prepare("DELETE FROM apRecords WHERE jobId=? AND invoiceNum=?").run(jobId, invNum));
  safeHandle("ap:byJobInvoice", (_, jobId, invNum) => db.prepare("SELECT * FROM apRecords WHERE jobId=? AND invoiceNum=?").all(jobId, invNum).map(r => rowToObj("apRecords", r)));
  safeHandle("ap:nextId", () => { const seq = incCounter("nextAPId"); return `AP-${String(seq).padStart(5, "0")}`; });
  safeHandle("ap:peekId", () => { const seq = getCounter("nextAPId"); return `AP-${String(seq).padStart(5, "0")}`; });
  safeHandle("ap:nextGeneralId", () => { const seq = incCounter("nextGeneralId"); return `G-${String(seq).padStart(4, "0")}`; });
  safeHandle("ap:peekGeneralId", () => { const seq = getCounter("nextGeneralId"); return `G-${String(seq).padStart(4, "0")}`; });
  safeHandle("ap:countByPayee", (_, payeeName) => db.prepare("SELECT COUNT(*) as c FROM apRecords WHERE payee=?").get(payeeName).c);
  safeHandle("ap:stats", (_, { dateFrom, dateTo } = {}) => {
    let where = "1=1";
    const p = {};
    if (dateFrom) { where += " AND date>=@dateFrom"; p.dateFrom = dateFrom; }
    if (dateTo) { where += " AND date<=@dateTo"; p.dateTo = dateTo; }
    const rows = db.prepare(`SELECT id, total, payments, date, dueDate, payee, type, jobId FROM apRecords WHERE ${where}`).all(p);
    return rows.map(r => ({ ...r, payments: safeParseJSON(r.payments, []) }));
  });
  safeHandle("ap:count", (_, { dateFrom, dateTo, payee } = {}) => {
    let where = "1=1"; const p = {};
    if (dateFrom) { where += " AND date>=@dateFrom"; p.dateFrom = dateFrom; }
    if (dateTo) { where += " AND date<=@dateTo"; p.dateTo = dateTo; }
    if (payee) { where += " AND payee=@payee"; p.payee = payee; }
    return db.prepare(`SELECT COUNT(*) as c FROM apRecords WHERE ${where}`).get(p).c;
  });

  // ── CUSTOM CODES ──
  safeHandle("codes:list", () => db.prepare("SELECT * FROM custom_codes ORDER BY type, code").all());
  safeHandle("codes:add", (_, { type, code, label }) => {
    db.prepare("INSERT OR REPLACE INTO custom_codes (type, code, label) VALUES (?,?,?)").run(type, code, label);
    return { type, code, label };
  });
  safeHandle("codes:delete", (_, { type, code }) => {
    db.prepare("DELETE FROM custom_codes WHERE type=? AND code=?").run(type, code);
    return true;
  });

  // ── STL (Settlement) ──
  safeHandle("stl:list", (_, { dateFrom, dateTo, search, limit = 50, offset = 0 } = {}) => {
    let where = "1=1"; const p = {};
    if (dateFrom) { where += " AND date>=@dateFrom"; p.dateFrom = dateFrom; }
    if (dateTo) { where += " AND date<=@dateTo"; p.dateTo = dateTo; }
    if (search) p.q = `%${search}%`;
    
    // AR (no payments needed for STL — only close/reopen)
    let arW = where;
    if (search) arW += " AND (invoiceNumber LIKE @q OR jobId LIKE @q OR customer LIKE @q)";
    const invs = db.prepare(`SELECT invoiceNumber as id, 'AR' as side, type, customer, '' as payee, date, total, jobId, closedDate FROM invoices WHERE ${arW}`).all(p);
    
    // AP (General + non-General in one query)
    let apW = where;
    if (search) apW += " AND (id LIKE @q OR jobId LIKE @q OR customer LIKE @q OR payee LIKE @q)";
    const aps = db.prepare(`SELECT id, 'AP' as side, type, CASE WHEN type='General' THEN '' ELSE customer END as customer, payee, date, total, CASE WHEN type='General' THEN '' ELSE jobId END as jobId, closedDate FROM apRecords WHERE ${apW}`).all(p);
    
    // Group + count in single pass
    const all = [...invs, ...aps];
    const jobGroups = {};
    const noJobItems = [];
    let openCount = 0, closedCount = 0;
    for (const t of all) {
      if (t.closedDate) closedCount++; else openCount++;
      if (t.jobId) {
        if (!jobGroups[t.jobId]) jobGroups[t.jobId] = [];
        jobGroups[t.jobId].push(t);
      } else {
        noJobItems.push(t);
      }
    }
    
    // Build sorted list (single sort)
    const groupList = Object.entries(jobGroups).map(([jobId, items]) => {
      items.sort((a, b) => b.date.localeCompare(a.date));
      return { jobId, items, sortDate: items[0].date };
    });
    for (const t of noJobItems) groupList.push({ jobId: null, items: [t], sortDate: t.date });
    groupList.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
    
    const totalGroups = groupList.length;
    const paged = limit ? groupList.slice(offset, offset + limit) : groupList;
    return { groups: paged, totalGroups, totalTxns: all.length, openCount, closedCount };
  });
  safeHandle("stl:close", (_, { ids, closedDate }) => {
    const txn = db.transaction(() => {
      for (const item of ids) {
        if (item.side === "AR") {
          db.prepare("UPDATE invoices SET closedDate=? WHERE invoiceNumber=?").run(closedDate, item.id);
        } else {
          db.prepare("UPDATE apRecords SET closedDate=? WHERE id=?").run(closedDate, item.id);
        }
      }
    });
    txn();
    return true;
  });
  safeHandle("stl:reopen", (_, { ids }) => {
    const txn = db.transaction(() => {
      for (const item of ids) {
        if (item.side === "AR") {
          db.prepare("UPDATE invoices SET closedDate='' WHERE invoiceNumber=?").run(item.id);
        } else {
          db.prepare("UPDATE apRecords SET closedDate='' WHERE id=?").run(item.id);
        }
      }
    });
    txn();
    return true;
  });

  safeHandle("stl:report", (_, { year, month }) => {
    const pad = String(month).padStart(2, "0");
    const closedDate = `${year}-${pad}`;
    const dateFrom = `${year}-${pad}-01`;
    const dateTo = `${year}-${pad}-31`;
    const parseItems = r => ({ ...r, items: safeParseJSON(r.items, []) });

    const closedAR = db.prepare("SELECT invoiceNumber, type, items, subtotal, taxAmount, total, closedDate FROM invoices WHERE closedDate=?").all(closedDate).map(parseItems);
    const closedAP = db.prepare("SELECT id, type, items, total, closedDate FROM apRecords WHERE closedDate=? AND type!='General'").all(closedDate).map(parseItems);
    const closedGeneral = db.prepare("SELECT id, type, items, total, closedDate FROM apRecords WHERE closedDate=? AND type='General'").all(closedDate).map(parseItems);
    const accrualAR = db.prepare("SELECT invoiceNumber, type, items, subtotal, taxAmount, total, date, closedDate FROM invoices WHERE date<=? AND (closedDate IS NULL OR closedDate='' OR closedDate>?)").all(dateTo, closedDate).map(parseItems);
    const accrualAP = db.prepare("SELECT id, type, items, total, date, closedDate FROM apRecords WHERE date<=? AND (closedDate IS NULL OR closedDate='' OR closedDate>?) AND type!='General'").all(dateTo, closedDate).map(parseItems);
    const accrualGeneral = db.prepare("SELECT id, type, items, total, date, closedDate FROM apRecords WHERE date<=? AND (closedDate IS NULL OR closedDate='' OR closedDate>?) AND type='General'").all(dateTo, closedDate).map(parseItems);
    const uninv = calcUninvoiced(dateFrom, dateTo);
    return { closedAR, closedAP, closedGeneral, accrualAR, accrualAP, accrualGeneral, uninvByCode: uninv.byCode, uninvARTotal: uninv.arTotal, uninvAPTotal: uninv.apTotal };
  });

  // ── DASHBOARD ──
  safeHandle("dashboard:summary", (_, { dateFrom, dateTo } = {}) => {
    let where = "1=1"; const p = {};
    if (dateFrom) { where += " AND date>=@dateFrom"; p.dateFrom = dateFrom; }
    if (dateTo) { where += " AND date<=@dateTo"; p.dateTo = dateTo; }
    const invs = db.prepare(`SELECT invoiceNumber, total, payments, date, dueDate, customer, type, jobId FROM invoices WHERE ${where}`).all(p).map(r => ({ ...r, payments: safeParseJSON(r.payments, []) }));
    const aps = db.prepare(`SELECT id, total, payments, date, dueDate, payee, customer, type, jobId, invoiceNum FROM apRecords WHERE ${where}`).all(p).map(r => ({ ...r, payments: safeParseJSON(r.payments, []) }));
    const generalAP = db.prepare(`SELECT SUM(total) as total FROM apRecords WHERE ${where} AND (jobId IS NULL OR jobId='')`).all(p);
    const closedAR = db.prepare(`SELECT SUM(subtotal) as total FROM invoices WHERE ${where} AND closedDate IS NOT NULL AND closedDate!=''`).all(p);
    const closedAP = db.prepare(`SELECT SUM(total) as total FROM apRecords WHERE ${where} AND closedDate IS NOT NULL AND closedDate!='' AND type!='General'`).all(p);
    const accrualAR = db.prepare(`SELECT SUM(subtotal) as total FROM invoices WHERE ${where} AND (closedDate IS NULL OR closedDate='')`).all(p);
    const accrualAP = db.prepare(`SELECT SUM(total) as total FROM apRecords WHERE ${where} AND (closedDate IS NULL OR closedDate='') AND type!='General'`).all(p);
    const uninv = calcUninvoiced(dateFrom, dateTo);
    return { invoices: invs, apRecords: aps, generalAP: (generalAP[0]?.total || 0), closedAR: closedAR[0]?.total || 0, closedAP: closedAP[0]?.total || 0, accrualAR: accrualAR[0]?.total || 0, accrualAP: accrualAP[0]?.total || 0, uninvoicedAR: uninv.arTotal, uninvoicedAP: uninv.apTotal };
  });

  // ── AGING REPORT ──
  safeHandle("dashboard:aging", (_, { asOfDate, dateFrom, dateTo } = {}) => {
    const asOf = asOfDate || new Date().toISOString().split("T")[0];
    let where = "(closedDate IS NULL OR closedDate='')"; const p = {};
    if (dateFrom) { where += " AND date>=@dateFrom"; p.dateFrom = dateFrom; }
    if (dateTo) { where += " AND date<=@dateTo"; p.dateTo = dateTo; }
    const arInvs = db.prepare(`SELECT invoiceNumber, total, payments, date, dueDate, customer, type FROM invoices WHERE ${where}`).all(p)
      .map(r => ({ ...r, payments: safeParseJSON(r.payments, []) }));
    const apRecs = db.prepare(`SELECT id, total, payments, date, dueDate, payee, type FROM apRecords WHERE ${where} AND type!='General'`).all(p)
      .map(r => ({ ...r, payments: safeParseJSON(r.payments, []) }));
    return { arInvs, apRecs, asOfDate: asOf };
  });

  // ── SOA DATA ──
  safeHandle("soa:data", (_, { customer, dateFrom, dateTo } = {}) => {
    if (!customer) return { invoices: [], company: {} };
    let where = "customer=@cust AND (closedDate IS NULL OR closedDate='')"; const p = { cust: customer };
    if (dateFrom) { where += " AND date>=@dateFrom"; p.dateFrom = dateFrom; }
    if (dateTo) { where += " AND date<=@dateTo"; p.dateTo = dateTo; }
    const invs = db.prepare(`SELECT invoiceNumber, total, payments, date, dueDate, type, jobId FROM invoices WHERE ${where}`).all(p)
      .map(r => ({ ...r, payments: safeParseJSON(r.payments, []) }));
    const settings = {};
    db.prepare("SELECT key, value FROM company_settings").all().forEach(r => { settings[r.key] = r.value; });
    const custRow = db.prepare("SELECT * FROM customers WHERE name=?").get(customer);
    return { invoices: invs, company: settings, customer: custRow || { name: customer } };
  });

  // ── PDF GENERATION ──
  safeHandle("pdf:generate", async (_, { html, filename }) => {
    const { BrowserWindow: BW } = require("electron");
    const pdfWin = new BW({ show: false, width: 800, height: 1100, webPreferences: { nodeIntegration: false } });
    try {
      await pdfWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
      await new Promise(r => setTimeout(r, 500)); // wait for render
      const pdfData = await pdfWin.webContents.printToPDF({ 
        marginsType: 0, printBackground: true, pageSize: "Letter",
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
      });
      const win = BW.getFocusedWindow() || BW.getAllWindows()[0];
      const res = await dialog.showSaveDialog(win, {
        title: "Save Invoice PDF",
        defaultPath: filename || "invoice.pdf",
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });
      if (!res.canceled && res.filePath) {
        fs.writeFileSync(res.filePath, pdfData);
        return { success: true, path: res.filePath };
      }
      return { success: false, cancelled: true };
    } catch (e) { console.error("PDF generation error:", e); return { success: false, error: e.message }; }
    finally { pdfWin.destroy(); }
  });
  safeHandle("db:path", () => getDbPath());
  safeHandle("db:export", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showSaveDialog(win, { title: "Export Backup", defaultPath: `clik-backup-${new Date().toISOString().split("T")[0]}.db`, filters: [{ name: "SQLite DB", extensions: ["db"] }] });
    if (res.canceled) return null;
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
      fs.copyFileSync(getDbPath(), res.filePath);
      return res.filePath;
    } catch (e) { console.error("Export error:", e); return null; }
  });
  safeHandle("db:import", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win, { title: "Import Backup", filters: [{ name: "SQLite DB", extensions: ["db"] }], properties: ["openFile"] });
    if (res.canceled || !res.filePaths.length) return false;
    const filePath = res.filePaths[0];
    try {
      const dbPath = getDbPath();
      db.pragma("wal_checkpoint(TRUNCATE)");
      db.close();
      fs.copyFileSync(filePath, dbPath);
      try { fs.unlinkSync(dbPath + "-wal"); } catch (_) {}
      try { fs.unlinkSync(dbPath + "-shm"); } catch (_) {}
      db = new (require("better-sqlite3"))(dbPath);
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      runMigrations();
      return true;
    } catch (e) { console.error("Import error:", e); return false; }
  });

  // ── Auto-updater IPC ──
  safeHandle("update:check", () => { if (autoUpdater) autoUpdater.checkForUpdates().catch(() => {}); });
  safeHandle("update:download", () => { if (autoUpdater) autoUpdater.downloadUpdate().catch(() => {}); });
  safeHandle("update:install", () => { if (autoUpdater) autoUpdater.quitAndInstall(false, true); });
  safeHandle("app:version", () => app.getVersion());

  // ── Transaction-wrapped invoice creation (invoice + job update atomic) ──
  safeHandle("invoices:createWithJob", (_, { invoiceData, jobId, jobUpdate }) => {
    const tx = db.transaction(() => {
      // 1. Insert invoice
      const row = objToRow("invoices", { province: "", date: "", items: [], subtotal: 0, taxAmount: 0, total: 0, displayFields: {}, jobData: {}, payments: [], dueDate: "", invoicedCodes: [], fxRate: 0, invoiceCurrency: "CAD", taxLabel: "", taxRate: 0, taxComponents: [], createdAt: new Date().toISOString(), ...invoiceData });
      db.prepare("INSERT INTO invoices (invoiceNumber,type,customer,province,date,jobId,items,subtotal,taxAmount,total,displayFields,jobData,payments,dueDate,invoicedCodes,fxRate,invoiceCurrency,taxLabel,taxRate,taxComponents,createdAt) VALUES (@invoiceNumber,@type,@customer,@province,@date,@jobId,@items,@subtotal,@taxAmount,@total,@displayFields,@jobData,@payments,@dueDate,@invoicedCodes,@fxRate,@invoiceCurrency,@taxLabel,@taxRate,@taxComponents,@createdAt)").run(row);
      // 2. Update job's invoice list
      const jobRow = objToRow("jobs", jobUpdate);
      const sets = Object.keys(jobRow).filter(k => k !== "id").map(k => k === "transaction" ? `"transaction"=@transaction` : `${k}=@${k}`).join(",");
      db.prepare(`UPDATE jobs SET ${sets} WHERE id=@id`).run({ ...jobRow, id: jobId });
    });
    tx();
    // Return updated job
    return rowToObj("jobs", db.prepare("SELECT * FROM jobs WHERE id=?").get(jobId));
  });

  // ── Transaction-wrapped charge save (AR/AP charges + job update atomic) ──
  safeHandle("jobs:saveCharges", (_, id, d) => {
    const tx = db.transaction(() => {
      const row = objToRow("jobs", d);
      const sets = Object.keys(row).filter(k => k !== "id").map(k => k === "transaction" ? `"transaction"=@transaction` : `${k}=@${k}`).join(",");
      db.prepare(`UPDATE jobs SET ${sets} WHERE id=@id`).run({ ...row, id });
    });
    tx();
    return rowToObj("jobs", db.prepare("SELECT * FROM jobs WHERE id=?").get(id));
  });
}

// ═══════ AUTO-BACKUP ═══════
let backupInterval = null;
function autoBackup() {
  const p = getDbPath(); if (!fs.existsSync(p)) return;
  const dir = path.join(getDataDir(), "backups"); ensureDir(dir);
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const todayFile = `daily-${today}.db`;
  const todayPath = path.join(dir, todayFile);
  try {
    // Only write one backup per day (overwrite if already exists today)
    fs.copyFileSync(p, todayPath);
    if (fs.existsSync(p + "-wal")) fs.copyFileSync(p + "-wal", todayPath + "-wal");
    // Keep last 14 daily backups
    const files = fs.readdirSync(dir).filter(f => f.startsWith("daily-") && f.endsWith(".db")).sort().reverse();
    files.slice(14).forEach(f => {
      try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
      try { fs.unlinkSync(path.join(dir, f + "-wal")); } catch (_) {}
      try { fs.unlinkSync(path.join(dir, f + "-shm")); } catch (_) {}
    });
    // Also clean up old auto- prefixed backups from previous versions
    fs.readdirSync(dir).filter(f => f.startsWith("auto-") && f.endsWith(".db")).forEach(f => {
      try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
      try { fs.unlinkSync(path.join(dir, f + "-wal")); } catch (_) {}
    });
    console.log(`[Backup] Saved: ${todayFile} (${files.length} daily backups)`);
  } catch (e) { console.error("[Backup] Failed:", e.message); }
}
function startBackupSchedule() {
  autoBackup();
  backupInterval = setInterval(autoBackup, 60 * 60 * 1000); // every hour (but only writes once per day)
}

// ═══════ WINDOW ═══════
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 1024, minHeight: 700,
    title: "CLIK - Customs and Logistics Solutions", backgroundColor: "#faf8f5",
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, "preload.cjs") },
    show: false,
  });
  win.once("ready-to-show", () => win.show());
  mainWin = win;
  if (isDev) win.loadURL(`http://localhost:${port}`);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "File", submenu: [{ role: "reload" }, { role: "forceReload" }, { type: "separator" }, { role: "quit" }] },
    { label: "Edit", submenu: [{ role: "undo" },{ role: "redo" },{ type: "separator" },{ role: "cut" },{ role: "copy" },{ role: "paste" },{ role: "selectAll" }] },
    { label: "View", submenu: [{ role: "zoomIn" },{ role: "zoomOut" },{ role: "resetZoom" },{ type: "separator" },{ role: "togglefullscreen" },{ type: "separator" },{ role: "toggleDevTools" }] },
  ]));
}

app.whenReady().then(() => { initDB(); setupIPC(); startBackupSchedule(); createWindow(); setupAutoUpdater(); });
app.on("window-all-closed", () => {
  if (backupInterval) clearInterval(backupInterval);
  autoBackup(); // final backup on close
  if (db) try { db.close(); } catch (_) {}
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
