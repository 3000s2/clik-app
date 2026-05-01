/**
 * CLIK Backend Tests — Run: node tests/backend.test.cjs
 * Covers: counters, CRUD, invoices, payments, AP, STL, uninvoiced, pagination, JSON safety, indexes, backup, edge cases
 */
const path = require("path"), fs = require("fs"), Database = require("better-sqlite3");
let passed=0, failed=0, total=0; const results=[];
function test(name,fn){total++;try{fn();passed++;results.push({name,s:"✓",e:null});}catch(e){failed++;results.push({name,s:"✗",e:e.message});}}
function expect(v){return{toBe(x){if(v!==x)throw new Error(`Expected ${JSON.stringify(x)}, got ${JSON.stringify(v)}`)},toBeGreaterThan(n){if(v<=n)throw new Error(`Expected ${v}>${n}`)},toBeCloseTo(x,p=2){if(Math.abs(v-x)>Math.pow(10,-p)/2)throw new Error(`Expected ${v}≈${x}`)},toBeTruthy(){if(!v)throw new Error(`Expected truthy, got ${JSON.stringify(v)}`)},toBeFalsy(){if(v)throw new Error(`Expected falsy, got ${JSON.stringify(v)}`)},toContain(i){if(!v.includes(i))throw new Error(`Array missing ${JSON.stringify(i)}`)},toHaveLength(n){if(v.length!==n)throw new Error(`Length: expected ${n}, got ${v.length}`)},toBeUndefined(){if(v!==undefined)throw new Error(`Expected undefined`)},toBeGreaterThanOrEqual(n){if(v<n)throw new Error(`Expected ${v}>=${n}`)},not:{toBe(x){if(v===x)throw new Error(`Expected NOT ${JSON.stringify(x)}`)},toBeUndefined(){if(v===undefined)throw new Error("Expected not undefined")}}};}

const TEST_DB=path.join(__dirname,".test-temp.db"); let db;
function setup(){if(fs.existsSync(TEST_DB))fs.unlinkSync(TEST_DB);db=new Database(TEST_DB);db.pragma("journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,code TEXT NOT NULL,name TEXT NOT NULL,address TEXT DEFAULT'',contact TEXT DEFAULT'',email TEXT DEFAULT'',phone TEXT DEFAULT'',brokerageFee TEXT DEFAULT'',paymentTerms TEXT DEFAULT'30',createdAt TEXT DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_cust_name ON customers(name);CREATE INDEX IF NOT EXISTS idx_cust_code ON customers(code);
CREATE TABLE IF NOT EXISTS payees(id TEXT PRIMARY KEY,code TEXT NOT NULL,name TEXT NOT NULL,address TEXT DEFAULT'',contact TEXT DEFAULT'',email TEXT DEFAULT'',phone TEXT DEFAULT'',createdAt TEXT DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_pay_name ON payees(name);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,customer TEXT NOT NULL,province TEXT DEFAULT'Ontario',cbEnabled INTEGER DEFAULT 0,ffEnabled INTEGER DEFAULT 0,bl TEXT DEFAULT'',ior TEXT DEFAULT'',ccn TEXT DEFAULT'',"transaction" TEXT DEFAULT'',mbl TEXT DEFAULT'',hbl TEXT DEFAULT'',cntr TEXT DEFAULT'',size TEXT DEFAULT'',quantity TEXT DEFAULT'',quantityUom TEXT DEFAULT'PLT',weight TEXT DEFAULT'',volume TEXT DEFAULT'',shipper TEXT DEFAULT'',cnee TEXT DEFAULT'',pol TEXT DEFAULT'',polAtd TEXT DEFAULT'',pod TEXT DEFAULT'',podEta TEXT DEFAULT'',remark TEXT DEFAULT'',cb TEXT DEFAULT'{}',ff TEXT DEFAULT'{}',cbInvoices TEXT DEFAULT'[]',ffInvoices TEXT DEFAULT'[]',createdAt TEXT DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_job_cust ON jobs(customer);CREATE INDEX IF NOT EXISTS idx_job_bl ON jobs(bl);
CREATE TABLE IF NOT EXISTS invoices(invoiceNumber TEXT PRIMARY KEY,type TEXT NOT NULL,customer TEXT NOT NULL,province TEXT DEFAULT'',date TEXT DEFAULT'',jobId TEXT NOT NULL,items TEXT DEFAULT'[]',subtotal REAL DEFAULT 0,taxAmount REAL DEFAULT 0,total REAL DEFAULT 0,displayFields TEXT DEFAULT'{}',jobData TEXT DEFAULT'{}',payments TEXT DEFAULT'[]',dueDate TEXT DEFAULT'',invoicedCodes TEXT DEFAULT'[]',fxRate REAL DEFAULT 0,closedDate TEXT DEFAULT'',createdAt TEXT DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_inv_job ON invoices(jobId);CREATE INDEX IF NOT EXISTS idx_inv_cust ON invoices(customer);CREATE INDEX IF NOT EXISTS idx_inv_date ON invoices(date);CREATE INDEX IF NOT EXISTS idx_inv_closed ON invoices(closedDate);CREATE INDEX IF NOT EXISTS idx_inv_type ON invoices(type);CREATE INDEX IF NOT EXISTS idx_inv_date_closed ON invoices(date,closedDate);
CREATE TABLE IF NOT EXISTS apRecords(id TEXT PRIMARY KEY,jobId TEXT DEFAULT'',customer TEXT DEFAULT'',payee TEXT NOT NULL,date TEXT DEFAULT'',items TEXT DEFAULT'[]',total REAL DEFAULT 0,type TEXT DEFAULT'Disbursement',payments TEXT DEFAULT'[]',dueDate TEXT DEFAULT'',invoiceNum TEXT DEFAULT'',fxRate REAL DEFAULT 0,memo TEXT DEFAULT'',closedDate TEXT DEFAULT'',createdAt TEXT DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_ap_job ON apRecords(jobId);CREATE INDEX IF NOT EXISTS idx_ap_payee ON apRecords(payee);CREATE INDEX IF NOT EXISTS idx_ap_date ON apRecords(date);CREATE INDEX IF NOT EXISTS idx_ap_closed ON apRecords(closedDate);CREATE INDEX IF NOT EXISTS idx_ap_type ON apRecords(type);CREATE INDEX IF NOT EXISTS idx_ap_date_closed ON apRecords(date,closedDate);CREATE INDEX IF NOT EXISTS idx_ap_invoiceNum ON apRecords(invoiceNum);
CREATE TABLE IF NOT EXISTS counters(key TEXT PRIMARY KEY,value INTEGER DEFAULT 1);CREATE TABLE IF NOT EXISTS company_settings(key TEXT PRIMARY KEY,value TEXT DEFAULT'');`);
["nextCustSeq","nextPayeeSeq","nextJobSeq","nextCBInvoice","nextFFInvoice","nextAPSeq","nextGeneralSeq"].forEach(k=>db.prepare("INSERT OR IGNORE INTO counters(key,value)VALUES(?,1)").run(k));}
function teardown(){if(db)db.close();if(fs.existsSync(TEST_DB))fs.unlinkSync(TEST_DB);}

function getCounter(k){return db.prepare("SELECT value FROM counters WHERE key=?").get(k)?.value||1;}
function incCounter(k){return db.transaction(()=>{const v=db.prepare("SELECT value FROM counters WHERE key=?").get(k)?.value||1;db.prepare("UPDATE counters SET value=? WHERE key=?").run(v+1,k);return v;})();}
function safeJSON(s,fb){try{return JSON.parse(s||JSON.stringify(fb));}catch(_){return fb;}}
const CB_CODES=["CLC","CDT","CDX","ACI","ISF","RPP","HDC","OTC","EXM"];
const FF_CODES=["TKC","HDC","PPC","STR","WTC","OTC","WHI","WHO","OPC","PLT","BOL","CLC","ACI","CDT","CDX"];
function calcUninvoiced(){const m={};db.prepare("SELECT invoiceNumber,invoicedCodes FROM invoices").all().forEach(r=>{try{m[r.invoiceNumber]=JSON.parse(r.invoicedCodes||"[]")}catch(_){m[r.invoiceNumber]=[]}});const jobs=db.prepare("SELECT id,cb,ff,cbInvoices,ffInvoices FROM jobs").all();const bc={};let ar=0,ap=0;for(const j of jobs){const cb=safeJSON(j.cb,{}),ff=safeJSON(j.ff,{}),ci=safeJSON(j.cbInvoices,[]),fi=safeJSON(j.ffInvoices,[]);const cs=new Set(),fs2=new Set();ci.forEach(n=>(m[n]||[]).forEach(c=>cs.add(c)));fi.forEach(n=>(m[n]||[]).forEach(c=>fs2.add(c)));for(const c of CB_CODES){if(!cs.has(c)){const a=parseFloat(cb[c])||0;if(a>0){bc[c]=(bc[c]||0)+a;ar+=a;if(cb[c+"_disb"])ap+=a;}}}for(const c of FF_CODES){if(!fs2.has(c)){const a=parseFloat(ff[c])||0;if(a>0){bc[c]=(bc[c]||0)+a;ar+=a;}}}}return{byCode:bc,arTotal:ar,apTotal:ap};}

console.log("\n═══════ CLIK Backend Tests ═══════\n");
setup();

// 1. COUNTERS
test("Counter starts at 1",()=>{expect(getCounter("nextCBInvoice")).toBe(1);});
test("Counter increments",()=>{expect(incCounter("nextCBInvoice")).toBe(1);expect(incCounter("nextCBInvoice")).toBe(2);expect(getCounter("nextCBInvoice")).toBe(3);});
test("Counter atomic: 100 calls, all unique",()=>{const k="atomicTest";db.prepare("INSERT OR REPLACE INTO counters(key,value)VALUES(?,1)").run(k);const r=[];for(let i=0;i<100;i++)r.push(incCounter(k));expect(new Set(r).size).toBe(100);expect(r[0]).toBe(1);expect(r[99]).toBe(100);});

// 2. CUSTOMER CRUD
test("Add customer",()=>{const s=incCounter("nextCustSeq");db.prepare("INSERT INTO customers(id,code,name,address)VALUES(?,?,?,?)").run(`CUST-A${s}`,`A${s}`,"Test Corp","123 Main");const r=db.prepare("SELECT * FROM customers WHERE name=?").get("Test Corp");expect(r.name).toBe("Test Corp");});
test("Update customer",()=>{db.prepare("UPDATE customers SET address=? WHERE name=?").run("456 Ave","Test Corp");expect(db.prepare("SELECT address FROM customers WHERE name=?").get("Test Corp").address).toBe("456 Ave");});
test("Delete customer",()=>{db.prepare("DELETE FROM customers WHERE name=?").run("Test Corp");expect(db.prepare("SELECT * FROM customers WHERE name=?").get("Test Corp")).toBeUndefined();});
test("Duplicate PK throws",()=>{db.prepare("INSERT INTO customers(id,code,name)VALUES(?,?,?)").run("DUP1","D","A");let threw=false;try{db.prepare("INSERT INTO customers(id,code,name)VALUES(?,?,?)").run("DUP1","D","B");}catch(_){threw=true;}expect(threw).toBeTruthy();});

// 3. JOB
test("Create job with CB/FF",()=>{db.prepare("INSERT INTO jobs(id,customer,cbEnabled,ffEnabled,cb,ff)VALUES(?,?,?,?,?,?)").run("JOB-001","TestCo",1,1,JSON.stringify({CLC:"150",CDT:"500",CDT_disb:true,CDT_payee:"CBSA"}),JSON.stringify({TKC:"200"}));const j=db.prepare("SELECT * FROM jobs WHERE id=?").get("JOB-001");expect(JSON.parse(j.cb).CLC).toBe("150");});
test("Empty JSON fields safe",()=>{db.prepare("INSERT INTO jobs(id,customer)VALUES(?,?)").run("JOB-E","E");const j=db.prepare("SELECT * FROM jobs WHERE id=?").get("JOB-E");expect(safeJSON(j.cb,{})).toBeTruthy();expect(safeJSON(j.cbInvoices,[])).toHaveLength(0);});

// 4. INVOICE + PAYMENT
test("Invoice totals correct",()=>{const items=[{label:"CLC",amount:150},{label:"CDT",amount:500}];const sub=650,tax=32.5,tot=682.5;db.prepare("INSERT INTO invoices(invoiceNumber,type,customer,province,date,jobId,items,subtotal,taxAmount,total,payments)VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("CB-00001","CB","TestCo","Ontario","2026-02-01","JOB-001",JSON.stringify(items),sub,tax,tot,"[]");const inv=db.prepare("SELECT * FROM invoices WHERE invoiceNumber=?").get("CB-00001");expect(inv.subtotal).toBe(650);expect(inv.total).toBe(682.5);});
test("Partial payment balance",()=>{db.prepare("UPDATE invoices SET payments=? WHERE invoiceNumber=?").run(JSON.stringify([{date:"2026-02-15",amount:200,currency:"CAD"}]),"CB-00001");const inv=db.prepare("SELECT * FROM invoices WHERE invoiceNumber=?").get("CB-00001");const p=JSON.parse(inv.payments).reduce((s,x)=>s+x.amount,0);expect(inv.total-p).toBeCloseTo(482.5);});
test("Full payment: balance=0 (float-safe)",()=>{db.prepare("UPDATE invoices SET payments=? WHERE invoiceNumber=?").run(JSON.stringify([{date:"2026-02-15",amount:200,currency:"CAD"},{date:"2026-02-20",amount:482.50,currency:"CAD"}]),"CB-00001");const inv=db.prepare("SELECT * FROM invoices WHERE invoiceNumber=?").get("CB-00001");const p=Math.round(JSON.parse(inv.payments).reduce((s,x)=>s+x.amount,0)*100)/100;expect(Math.round((inv.total-p)*100)/100).toBe(0);});
test("$464.06-$464.06 = 0 not -0",()=>{db.prepare("INSERT INTO invoices(invoiceNumber,type,customer,date,jobId,subtotal,total,payments)VALUES(?,?,?,?,?,?,?,?)").run("CB-FP01","CB","FP","2026-01-01","JOB-001",464.06,464.06,JSON.stringify([{date:"2026-01-15",amount:464.06}]));const inv=db.prepare("SELECT * FROM invoices WHERE invoiceNumber=?").get("CB-FP01");const b=Math.round((inv.total-Math.round(JSON.parse(inv.payments).reduce((s,x)=>s+x.amount,0)*100)/100)*100)/100;expect(b).toBe(0);expect(Object.is(b,-0)).toBeFalsy();});
test("Multi-currency payments",()=>{db.prepare("INSERT INTO invoices(invoiceNumber,type,customer,date,jobId,total,payments)VALUES(?,?,?,?,?,?,?)").run("CB-MC","CB","MC","2026-02-01","JOB-001",300,JSON.stringify([{date:"2026-02-10",amount:100,currency:"CAD"},{date:"2026-02-20",amount:200,currency:"USD"}]));const ps=JSON.parse(db.prepare("SELECT payments FROM invoices WHERE invoiceNumber=?").get("CB-MC").payments);expect(ps).toHaveLength(2);expect(ps[1].currency).toBe("USD");});

// 5. AP RECORDS
test("AP disbursement linked to invoice",()=>{db.prepare("INSERT INTO apRecords(id,jobId,customer,payee,date,items,total,type,payments,invoiceNum)VALUES(?,?,?,?,?,?,?,?,?,?)").run("AP-00001","JOB-001","TestCo","CBSA","2026-02-01",JSON.stringify([{label:"CDT",amount:500}]),500,"Disbursement","[]","CB-00001");const ap=db.prepare("SELECT * FROM apRecords WHERE id=?").get("AP-00001");expect(ap.payee).toBe("CBSA");expect(ap.invoiceNum).toBe("CB-00001");});
test("General expense with categories",()=>{db.prepare("INSERT INTO apRecords(id,jobId,payee,date,items,total,type,payments,memo)VALUES(?,?,?,?,?,?,?,?,?)").run("GEN-00001","","Landlord","2026-02-01",JSON.stringify([{label:"Office Rent",amount:1500},{label:"Bank Monthly Fee",amount:25}]),1525,"General","[]","Feb");const ap=db.prepare("SELECT * FROM apRecords WHERE id=?").get("GEN-00001");expect(ap.type).toBe("General");expect(ap.total).toBe(1525);expect(JSON.parse(ap.items)[0].label).toBe("Office Rent");});
test("AP lookup by invoiceNum",()=>{expect(db.prepare("SELECT * FROM apRecords WHERE invoiceNum=?").all("CB-00001").length).toBeGreaterThan(0);});
test("Delete AP by job+invoice",()=>{db.prepare("INSERT INTO apRecords(id,jobId,payee,total,type,payments,invoiceNum)VALUES(?,?,?,?,?,?,?)").run("AP-DEL","JOB-001","X",100,"Disbursement","[]","CB-TEMP");db.prepare("DELETE FROM apRecords WHERE jobId=? AND invoiceNum=?").run("JOB-001","CB-TEMP");expect(db.prepare("SELECT * FROM apRecords WHERE id=?").get("AP-DEL")).toBeUndefined();});

// 6. STL CLOSING
test("Close invoice",()=>{db.prepare("UPDATE invoices SET closedDate=? WHERE invoiceNumber=?").run("2026-02","CB-00001");expect(db.prepare("SELECT closedDate FROM invoices WHERE invoiceNumber=?").get("CB-00001").closedDate).toBe("2026-02");});
test("Close AP",()=>{db.prepare("UPDATE apRecords SET closedDate=? WHERE id=?").run("2026-02","AP-00001");expect(db.prepare("SELECT closedDate FROM apRecords WHERE id=?").get("AP-00001").closedDate).toBe("2026-02");});
test("Closed in closed query",()=>{expect(db.prepare("SELECT * FROM invoices WHERE closedDate=?").all("2026-02").find(r=>r.invoiceNumber==="CB-00001")).not.toBeUndefined();});
test("Unclosed in accrual query",()=>{expect(db.prepare("SELECT * FROM invoices WHERE date<=? AND(closedDate IS NULL OR closedDate=''OR closedDate>?)").all("2026-02-28","2026-02").find(r=>r.invoiceNumber==="CB-FP01")).not.toBeUndefined();});
test("Reopen works",()=>{db.prepare("UPDATE invoices SET closedDate='' WHERE invoiceNumber='CB-00001'").run();expect(db.prepare("SELECT closedDate FROM invoices WHERE invoiceNumber=?").get("CB-00001").closedDate).toBe("");db.prepare("UPDATE invoices SET closedDate='2026-02' WHERE invoiceNumber='CB-00001'").run();});
test("General in general query, not AP cost",()=>{const gen=db.prepare("SELECT * FROM apRecords WHERE type='General' AND(closedDate IS NULL OR closedDate='')").all();expect(gen.find(g=>g.id==="GEN-00001")).not.toBeUndefined();const ap=db.prepare("SELECT * FROM apRecords WHERE type!='General' AND(closedDate IS NULL OR closedDate='')").all();expect(ap.find(a=>a.id==="GEN-00001")).toBeUndefined();});

// 7. UNINVOICED
test("All uninvoiced when no codes",()=>{db.prepare("UPDATE invoices SET invoicedCodes='[]' WHERE invoiceNumber='CB-00001'").run();db.prepare("UPDATE jobs SET cbInvoices='[]' WHERE id='JOB-001'").run();const r=calcUninvoiced();expect(r.arTotal).toBe(850);expect(r.apTotal).toBe(500);});
test("Uninvoiced reduces with codes",()=>{db.prepare("UPDATE invoices SET invoicedCodes=? WHERE invoiceNumber=?").run(JSON.stringify(["CLC","CDT"]),"CB-00001");db.prepare("UPDATE jobs SET cbInvoices=? WHERE id=?").run(JSON.stringify(["CB-00001"]),"JOB-001");expect(calcUninvoiced().arTotal).toBe(200);});
test("Corrupt JSON in job doesn't crash",()=>{db.prepare("INSERT INTO jobs(id,customer,cb,ff,cbInvoices,ffInvoices)VALUES(?,?,?,?,?,?)").run("JOB-BAD","Bad","not-json","{}","not-arr","[]");const r=calcUninvoiced();expect(r.arTotal).toBeGreaterThanOrEqual(0);});

// 8. DASHBOARD
test("SUM queries correct",()=>{expect(db.prepare("SELECT SUM(subtotal)as t FROM invoices").get().t).toBeGreaterThan(0);expect(db.prepare("SELECT SUM(total)as t FROM apRecords WHERE type!='General'").get().t).toBe(500);expect(db.prepare("SELECT SUM(total)as t FROM apRecords WHERE type='General'").get().t).toBe(1525);});
test("Closed vs accrual split",()=>{expect(db.prepare("SELECT SUM(subtotal)as t FROM invoices WHERE closedDate IS NOT NULL AND closedDate!=''").get().t).toBeGreaterThan(0);expect(db.prepare("SELECT SUM(subtotal)as t FROM invoices WHERE(closedDate IS NULL OR closedDate='')").get().t).toBeGreaterThan(0);});
test("Date range filter",()=>{expect(db.prepare("SELECT SUM(subtotal)as t FROM invoices WHERE date>='2026-01-01' AND date<='2026-01-31'").get().t).toBeGreaterThan(0);expect(db.prepare("SELECT SUM(subtotal)as t FROM invoices WHERE date>='2026-02-01' AND date<='2026-02-28'").get().t).toBeGreaterThan(0);});

// 9. PAGINATION
test("LIMIT/OFFSET no overlap",()=>{for(let i=2;i<=6;i++)db.prepare("INSERT OR IGNORE INTO jobs(id,customer)VALUES(?,?)").run(`JOB-P${i}`,`C${i}`);const p1=db.prepare("SELECT id FROM jobs ORDER BY id LIMIT 3 OFFSET 0").all().map(r=>r.id);const p2=db.prepare("SELECT id FROM jobs ORDER BY id LIMIT 3 OFFSET 3").all().map(r=>r.id);expect(p1).toHaveLength(3);expect(p2.length).toBeGreaterThan(0);expect(p1.filter(id=>p2.includes(id))).toHaveLength(0);});

// 10. JSON SAFETY
test("safeJSON all cases",()=>{expect(safeJSON("bad",[])).toHaveLength(0);expect(safeJSON("",{})).toBeTruthy();expect(safeJSON(null,[])).toHaveLength(0);expect(safeJSON(undefined,"fb")).toBe("fb");expect(safeJSON('{"a":1}',{}).a).toBe(1);expect(safeJSON("[1,2]",[])).toHaveLength(2);});
test("Corrupt items doesn't crash",()=>{db.prepare("INSERT INTO invoices(invoiceNumber,type,customer,date,jobId,items,total,payments)VALUES(?,?,?,?,?,?,?,?)").run("CB-CRP","CB","X","2026-03-01","JOB-001","bad-json",100,"[]");expect(safeJSON(db.prepare("SELECT items FROM invoices WHERE invoiceNumber=?").get("CB-CRP").items,[])).toHaveLength(0);});
test("Corrupt payments defaults empty",()=>{db.prepare("INSERT INTO invoices(invoiceNumber,type,customer,date,jobId,total,payments)VALUES(?,?,?,?,?,?,?)").run("CB-BP","CB","X","2026-03-01","JOB-001",100,"{bad}");expect(safeJSON(db.prepare("SELECT payments FROM invoices WHERE invoiceNumber=?").get("CB-BP").payments,[])).toHaveLength(0);});

// 11. INDEXES
test("All performance indexes exist",()=>{const idx=db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r=>r.name);["idx_inv_date","idx_inv_closed","idx_inv_type","idx_inv_date_closed","idx_ap_closed","idx_ap_type","idx_ap_date_closed","idx_ap_invoiceNum","idx_inv_job","idx_ap_job"].forEach(i=>expect(idx).toContain(i));});

// 12. BACKUP
test("DB file copyable and valid",()=>{db.pragma("wal_checkpoint(TRUNCATE)");const bp=TEST_DB+".bak";fs.copyFileSync(TEST_DB,bp);expect(fs.existsSync(bp)).toBeTruthy();const bdb=new Database(bp);expect(bdb.prepare("SELECT COUNT(*)as n FROM jobs").get().n).toBeGreaterThan(0);bdb.close();fs.unlinkSync(bp);});

// 13. EDGE CASES
test("Empty date range = no results",()=>{expect(db.prepare("SELECT * FROM invoices WHERE date>='2099-01-01'").all()).toHaveLength(0);});
test("NULL closedDate in accrual",()=>{db.prepare("INSERT INTO invoices(invoiceNumber,type,customer,date,jobId,total,payments)VALUES(?,?,?,?,?,?,?)").run("CB-NUL","CB","X","2026-02-15","JOB-001",50,"[]");db.prepare("UPDATE invoices SET closedDate=NULL WHERE invoiceNumber='CB-NUL'").run();expect(db.prepare("SELECT * FROM invoices WHERE date<=? AND(closedDate IS NULL OR closedDate='')").all("2026-12-31").find(r=>r.invoiceNumber==="CB-NUL")).not.toBeUndefined();});
test("Large amount doesn't corrupt",()=>{const big=9999999.99;db.prepare("INSERT INTO invoices(invoiceNumber,type,customer,date,jobId,total,payments)VALUES(?,?,?,?,?,?,?)").run("CB-BIG","CB","X","2026-02-01","JOB-001",big,JSON.stringify([{date:"2026-02-01",amount:big}]));const inv=db.prepare("SELECT * FROM invoices WHERE invoiceNumber=?").get("CB-BIG");expect(inv.total).toBe(big);expect(Math.round((inv.total-Math.round(JSON.parse(inv.payments).reduce((s,p)=>s+p.amount,0)*100)/100)*100)/100).toBe(0);});
test("Special chars in name",()=>{db.prepare("INSERT INTO customers(id,code,name)VALUES(?,?,?)").run("CUST-SP","SP","O'Brien & Co \"LLC\"");expect(db.prepare("SELECT name FROM customers WHERE id=?").get("CUST-SP").name).toBe("O'Brien & Co \"LLC\"");});

// REPORT
teardown();
console.log("");results.forEach(r=>{const c=r.s==="✓"?"\x1b[32m":"\x1b[31m";console.log(`${c}${r.s}\x1b[0m ${r.name}${r.e?` — ${r.e}`:""}`)});
console.log(`\n═══════ Results: ${passed}/${total} passed, ${failed} failed ═══════\n`);
process.exit(failed>0?1:0);
