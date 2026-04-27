import React, { useState, useEffect, useRef, useMemo } from "react";

// ═══════ ERROR BOUNDARY ═══════
class ErrorBoundary extends React.Component{
  constructor(p){super(p);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return{hasError:true,error};}
  reset=()=>this.setState({hasError:false,error:null});
  render(){if(this.state.hasError)return(<div style={{padding:40,textAlign:"center",background:"#faf8f5",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:48,marginBottom:16}}>⚠️</div><h2 style={{fontFamily:"'DM Sans',sans-serif",color:"#c4533a",marginBottom:8}}>Something went wrong</h2><p style={{color:"#8c7e6a",fontSize:13,marginBottom:16,maxWidth:400}}>{this.state.error?.message||"An unexpected error occurred"}</p><div style={{display:"flex",gap:12}}><button onClick={this.reset} style={{padding:"8px 20px",background:"#4a7c59",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontWeight:600}}>Try Again</button></div></div>);return this.props.children;}
}

// ═══════ DB LAYER (in-memory + SQLite) ═══════
const DB_DEFAULTS = { customers:[], payees:[], jobs:[], invoices:[], apRecords:[], nextJobId:1, nextCustSeq:1, nextPayeeSeq:1, nextCBInvoice:1, nextFFInvoice:1, nextAPId:1, nextGeneralId:1 };
const DB = { ...JSON.parse(JSON.stringify(DB_DEFAULTS)) };

async function loadRefData() {
  if (!window.db) return;
  try { const [c,p] = await Promise.all([window.db.customers.list(), window.db.payees.list()]); DB.customers=c||[]; DB.payees=p||[]; } catch(e) { console.error("Ref data load:",e); }
}

async function dbAddCustomer(d) { if(window.db){const r=await window.db.customers.add(d);DB.customers.push(r);return r;} const code=`A${DB.nextCustSeq++}`;const e={id:`CUST-${code}`,code,...d};DB.customers.push(e);return e; }
async function dbUpdateCustomer(id,d) { if(window.db)await window.db.customers.update(id,d); const i=DB.customers.findIndex(c=>c.id===id);if(i>=0)DB.customers[i]={...DB.customers[i],...d}; }
async function dbDeleteCustomer(id) { if(window.db)await window.db.customers.delete(id); DB.customers=DB.customers.filter(c=>c.id!==id); }
async function dbCustomerExists(name) { if(window.db)return window.db.customers.exists(name); return DB.customers.some(c=>c.name.toLowerCase()===name.toLowerCase()); }
async function dbNextCustCode() { if(window.db)return window.db.customers.nextCode(); return`A${DB.nextCustSeq}`; }

async function dbAddPayee(d) { if(window.db){const r=await window.db.payees.add(d);DB.payees.push(r);return r;} const code=`B${DB.nextPayeeSeq++}`;const e={id:`PAYEE-${code}`,code,...d};DB.payees.push(e);return e; }
async function dbUpdatePayee(id,d) { if(window.db)await window.db.payees.update(id,d); const i=DB.payees.findIndex(p=>p.id===id);if(i>=0)DB.payees[i]={...DB.payees[i],...d}; }
async function dbDeletePayee(id) { if(window.db)await window.db.payees.delete(id); DB.payees=DB.payees.filter(p=>p.id!==id); }
async function dbPayeeExists(name) { if(window.db)return window.db.payees.exists(name); return DB.payees.some(p=>p.name.toLowerCase()===name.toLowerCase()); }
async function dbNextPayeeCode() { if(window.db)return window.db.payees.nextCode(); return`B${DB.nextPayeeSeq}`; }

async function dbAddJob(d) { if(window.db){const r=await window.db.jobs.add(d);DB.jobs.unshift(r);return r;} const id=`CLIK-${String(DB.nextJobId++).padStart(5,"0")}`;const j={id,...d,cb:{},ff:{},cbInvoices:[],ffInvoices:[],createdAt:new Date().toISOString()};DB.jobs.unshift(j);return j; }
async function dbUpdateJob(id,d) { if(window.db){const r=await window.db.jobs.update(id,d);const i=DB.jobs.findIndex(j=>j.id===id);if(i>=0)DB.jobs[i]=r||{...DB.jobs[i],...d};return DB.jobs[i];} const i=DB.jobs.findIndex(j=>j.id===id);if(i>=0)DB.jobs[i]={...DB.jobs[i],...d};return DB.jobs[i]; }
async function dbCountJobsByCustomer(name) { if(window.db)return window.db.jobs.countByCustomer(name); return DB.jobs.filter(j=>j.customer===name).length; }

async function dbAddInvoice(d) { try{if(window.db)return await window.db.invoices.add(d);}catch(e){console.error("dbAddInvoice:",e);throw e;} DB.invoices.push(d);return d; }
async function dbUpdateInvoice(num,d) { try{if(window.db)await window.db.invoices.update(num,d);}catch(e){console.error("dbUpdateInvoice:",e);throw e;} }
async function dbNextInvoiceNum(type) { if(window.db)return window.db.invoices.nextNum(type); const key=type==="CB"?"nextCBInvoice":"nextFFInvoice";return`${type}-${String(DB[key]++).padStart(5,"0")}`; }

async function dbAddAP(d) { try{if(window.db)return await window.db.ap.add(d);}catch(e){console.error("dbAddAP:",e);throw e;} DB.apRecords.push(d);return d; }
async function dbUpdateAP(id,d) { try{if(window.db)await window.db.ap.update(id,d);}catch(e){console.error("dbUpdateAP:",e);throw e;} }
async function dbDeleteAPByJobInvoice(jId,inv) { try{if(window.db)await window.db.ap.deleteByJobInvoice(jId,inv);}catch(e){console.error(e);throw e;} }
async function dbGetAPByJobInvoice(jId,inv) { try{if(window.db)return(await window.db.ap.byJobInvoice(jId,inv)).map(a=>({payments:[],...a}));}catch(e){return[];} return DB.apRecords.filter(a=>a.jobId===jId&&a.invoiceNum===inv); }
async function dbNextAPId() { if(window.db)return window.db.ap.nextId(); return`AP-${String(DB.nextAPId++).padStart(5,"0")}`; }
async function dbNextGeneralId() { if(window.db)return window.db.ap.nextGeneralId(); return`G-${String(DB.nextGeneralId++).padStart(4,"0")}`; }
async function dbCountAPByPayee(name) { if(window.db)return window.db.ap.countByPayee(name); return DB.apRecords.filter(a=>a.payee===name).length; }

// ═══════ THEME ═══════
const C={bg:"#faf8f5",sidebar:"#f5f1eb",surface:"#ffffff",surfaceHover:"#f0ece4",card:"#faf7f2",border:"#e5ddd3",accent:"#4a7c59",accentGlow:"rgba(74,124,89,0.10)",green:"#3a8a5c",orange:"#c08830",red:"#c4533a",purple:"#7c6b8a",blue:"#4a6fa5",text:"#2c2418",textDim:"#8c7e6a",textMuted:"#b5a898",white:"#fff",cyan:"#3a8a8a"};
const F={display:"'DM Sans',sans-serif",body:"'IBM Plex Sans',sans-serif",mono:"'IBM Plex Mono',monospace"};
const S={
  label:{fontSize:10,fontWeight:600,color:C.textMuted,fontFamily:F.body,textTransform:"uppercase",letterSpacing:".6px"},
  th:{textAlign:"left",padding:"10px 14px",fontSize:10,fontWeight:600,color:C.textMuted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`},
  td:{padding:"10px 14px"},
  empty:{padding:40,textAlign:"center",color:C.textMuted,fontSize:13},
  modal:{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000},
  pt:{margin:0,fontFamily:F.display,color:C.text,fontSize:20},
};

// ═══════ CONSTANTS ═══════
const PROVINCES=["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon"];
const PROVINCE_TAX={
  "Alberta":{rate:0.05,label:"GST 5%",components:[{type:"GST",rate:0.05,label:"GST (5%)"}]},
  "British Columbia":{rate:0.12,label:"GST+PST 12%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"PST",rate:0.07,label:"PST BC (7%)"}]},
  "Manitoba":{rate:0.12,label:"GST+PST 12%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"PST",rate:0.07,label:"PST MB (7%)"}]},
  "New Brunswick":{rate:0.15,label:"HST 15%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.10,label:"HST NB (10%)"}]},
  "Newfoundland and Labrador":{rate:0.15,label:"HST 15%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.10,label:"HST NL (10%)"}]},
  "Northwest Territories":{rate:0.05,label:"GST 5%",components:[{type:"GST",rate:0.05,label:"GST (5%)"}]},
  "Nova Scotia":{rate:0.15,label:"HST 15%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.10,label:"HST NS (10%)"}]},
  "Nunavut":{rate:0.05,label:"GST 5%",components:[{type:"GST",rate:0.05,label:"GST (5%)"}]},
  "Ontario":{rate:0.13,label:"HST 13%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.08,label:"HST ON (8%)"}]},
  "Prince Edward Island":{rate:0.15,label:"HST 15%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.10,label:"HST PE (10%)"}]},
  "Quebec":{rate:0.14975,label:"GST+QST 14.975%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"QST",rate:0.09975,label:"QST (9.975%)"}]},
  "Saskatchewan":{rate:0.11,label:"GST+PST 11%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"PST",rate:0.06,label:"PST SK (6%)"}]},
  "Yukon":{rate:0.05,label:"GST 5%",components:[{type:"GST",rate:0.05,label:"GST (5%)"}]}
};
const DEFAULT_TAX_PCT=13;
const CB_CODES=[{code:"CLC",label:"Customs Clearance"},{code:"CDT",label:"Customs Duty"},{code:"CDX",label:"Customs GST"},{code:"ACI",label:"ACI/eManifest"},{code:"ISF",label:"ISF Filing"},{code:"RPP",label:"RPP Bond"},{code:"HDC",label:"Handling Charge"},{code:"OTC",label:"Other Charge"},{code:"EXM",label:"CBSA Exam"}];
const FF_CODES=[{code:"TKC",label:"Trucking Charge"},{code:"HDC",label:"Handling Charge"},{code:"PPC",label:"Pre-Pull Charge"},{code:"STR",label:"Storage Charge"},{code:"WTC",label:"Waiting Charge"},{code:"OTC",label:"Other Charge"},{code:"WHI",label:"Warehouse In"},{code:"WHO",label:"Warehouse Out"},{code:"OPC",label:"Order Processing Charge"},{code:"PLT",label:"Palletizing"},{code:"BOL",label:"BL Charge"},{code:"CLC",label:"Customs Clearance"},{code:"ACI",label:"ACI/eManifest"},{code:"CDT",label:"Customs Duty"},{code:"CDX",label:"Customs GST"}];
const CB_INV_FIELDS={bl:"BL#",shipper:"Shipper",cnee:"CNEE",ior:"IOR",pol:"POL",polAtd:"POL ATD",pod:"POD",podEta:"POD ETA",ccn:"CCN#",transaction:"Transaction#"};
const FF_INV_FIELDS={mbl:"MBL#",hbl:"HBL#",cntr:"Container",size:"Size",quantity:"Quantity",quantityUom:"Qty UOM",weight:"Weight",volume:"Volume",pol:"POL",polAtd:"POL ATD",pod:"POD",podEta:"POD ETA",shipper:"Shipper",cnee:"CNEE"};
const GE_CODES=[{code:"RNT",label:"Office Rent"},{code:"UTL",label:"Utilities"},{code:"TEL",label:"Telephone/Internet"},{code:"INS",label:"Insurance"},{code:"OFC",label:"Office Supplies"},{code:"SFT",label:"Software/License"},{code:"ACC",label:"Accounting Fees"},{code:"LGL",label:"Legal Fees"},{code:"TRV",label:"Travel"},{code:"PRK",label:"Parking"},{code:"MKT",label:"Marketing"},{code:"MSC",label:"Miscellaneous"}];
const SIZE_OPTS=["20","40","40HC","40OT","45"];
const UOM_OPTS=["PLT","BOX","CARTON","ROLL","NMB"];

// ═══════ EXCHANGE RATE (Bank of Canada Valet API) ═══════
const _fxCache={};const _fxFailed=new Set();
async function fetchFxRate(dateStr){
  if(!dateStr)return null;if(_fxCache[dateStr]!==undefined)return _fxCache[dateStr];if(_fxFailed.has(dateStr))return null;
  try{
    let r=await fetch(`https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${dateStr}&end_date=${dateStr}`);let d=await r.json();
    if(d.observations?.length>0){const v=parseFloat(d.observations[0].FXUSDCAD.v);_fxCache[dateStr]=v;return v;}
    const dt=new Date(dateStr);dt.setDate(dt.getDate()-7);const s=dt.toISOString().split("T")[0];
    r=await fetch(`https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${s}&end_date=${dateStr}`);d=await r.json();
    if(d.observations?.length>0){const last=d.observations[d.observations.length-1];const v=parseFloat(last.FXUSDCAD.v);_fxCache[dateStr]=v;return v;}
    _fxFailed.add(dateStr);setTimeout(()=>_fxFailed.delete(dateStr),60000);return null;
  }catch(e){console.error("FX error:",e);_fxFailed.add(dateStr);setTimeout(()=>_fxFailed.delete(dateStr),30000);return null;}
}
function useFxRate(dateStr){
  const[rate,setRate]=useState(()=>_fxCache[dateStr]||null);const[loading,setLoading]=useState(false);
  useEffect(()=>{if(!dateStr){setRate(null);return;}if(_fxCache[dateStr]!==undefined){setRate(_fxCache[dateStr]);return;}let cancel=false;setLoading(true);fetchFxRate(dateStr).then(r=>{if(!cancel){setRate(r);setLoading(false);}});return()=>{cancel=true;};},[dateStr]);
  return{rate,loading};
}
function toCAD(amount,currency,rate){const n=parseFloat(amount)||0;if(currency==="USD"&&rate)return M.mul(n,rate);return M.round(n);}
function FxBadge({rate,loading,date}){
  if(loading)return<span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:5,background:`${C.orange}15`,border:`1px solid ${C.orange}30`,fontSize:10,fontFamily:F.mono,color:C.orange}}>⟳ Fetching rate...</span>;
  if(rate)return<span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:5,background:`${C.cyan}12`,border:`1px solid ${C.cyan}30`,fontSize:10,fontFamily:F.mono,color:C.cyan}}>🏦 BoC USD/CAD: {rate.toFixed(4)} <span style={{color:C.textMuted}}>({date})</span></span>;
  return null;
}

// ═══════ UTILITIES ═══════
// Cents-based money math — all currency calculations go through these to avoid floating-point errors
const M={
  // Parse any value to exact cents (integer)
  cents:v=>Math.round((parseFloat(v)||0)*100),
  // Round a dollar amount to exact cents
  round:v=>Math.round((parseFloat(v)||0)*100)/100,
  // Sum multiple dollar amounts via cents (avoids accumulation errors)
  sum:(...vals)=>vals.reduce((s,v)=>s+Math.round((parseFloat(v)||0)*100),0)/100,
  // Multiply two values and round to cents (for tax rates, FX conversion)
  mul:(a,b)=>Math.round(Math.round((parseFloat(a)||0)*100)*(parseFloat(b)||0))/100,
  // Subtract: a - b via cents
  sub:(a,b)=>(Math.round((parseFloat(a)||0)*100)-Math.round((parseFloat(b)||0)*100))/100,
  // Format for display
  fmt:v=>"$"+M.round(v).toFixed(2),
};
function useDebounce(value,delay=400){const[d,setD]=useState(value);useEffect(()=>{const t=setTimeout(()=>setD(value),delay);return()=>clearTimeout(t);},[value,delay]);return d;}
const daysSince=d=>Math.max(0,Math.floor((Date.now()-new Date(d).getTime())/864e5));
const ageBucket=d=>{const n=daysSince(d);return n<=30?"Current":n<=60?"30-60":n<=90?"60-90":"90+";};
const ageColor=b=>b==="Current"?C.green:b==="30-60"?C.orange:b==="60-90"?C.red:C.purple;
function downloadCSV(fn,hds,rows){const csv=[hds.join(","),...rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(","))].join("\n");const b=new Blob([csv],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=fn;a.click();URL.revokeObjectURL(u);}
const sumPay=r=>Math.round((r.payments||[]).reduce((s,p)=>s+(p.amount||0),0)*100)/100;
// AP tax rate profiles (reuses PROVINCE_TAX structure)
const AP_TAX_PROFILES=[
  {key:"none",label:"No Tax",rate:0,components:[]},
  {key:"gst",label:"GST 5% (AB/NT/YT/NU)",rate:0.05,components:[{type:"GST",rate:0.05,label:"GST (5%)"}]},
  {key:"on",label:"HST 13% (ON)",rate:0.13,components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.08,label:"HST ON (8%)"}]},
  {key:"nb",label:"HST 15% (NB)",rate:0.15,components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.10,label:"HST NB (10%)"}]},
  {key:"ns",label:"HST 15% (NS)",rate:0.15,components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.10,label:"HST NS (10%)"}]},
  {key:"nl",label:"HST 15% (NL)",rate:0.15,components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.10,label:"HST NL (10%)"}]},
  {key:"pe",label:"HST 15% (PE)",rate:0.15,components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.10,label:"HST PE (10%)"}]},
  {key:"bc",label:"GST+PST 12% (BC)",rate:0.12,components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"PST",rate:0.07,label:"PST BC (7%)"}]},
  {key:"mb",label:"GST+PST 12% (MB)",rate:0.12,components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"PST",rate:0.07,label:"PST MB (7%)"}]},
  {key:"sk",label:"GST+PST 11% (SK)",rate:0.11,components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"PST",rate:0.06,label:"PST SK (6%)"}]},
  {key:"qc",label:"GST+QST 14.975% (QC)",rate:0.14975,components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"QST",rate:0.09975,label:"QST (9.975%)"}]},
];
const PROVINCE_TO_PROFILE={"Ontario":"on","British Columbia":"bc","Quebec":"qc","Alberta":"gst","Manitoba":"mb","Saskatchewan":"sk","New Brunswick":"nb","Nova Scotia":"ns","Newfoundland and Labrador":"nl","Prince Edward Island":"pe","Northwest Territories":"gst","Yukon":"gst","Nunavut":"gst"};

function calcTaxComponents(profile,amount){
  const base=M.round(amount);if(!profile||!base)return[];
  return profile.components.map(c=>({type:c.type,rate:c.rate,label:c.label,amount:M.mul(base,c.rate)}));
}
function profileKeyFromComponents(comps){
  if(!comps||comps.length===0)return"none";
  // Try to match by exact component labels first
  const labels=comps.map(c=>c.label).sort().join("|");
  for(const p of AP_TAX_PROFILES){
    if(p.key==="none")continue;
    const pLabels=p.components.map(c=>c.label).sort().join("|");
    if(pLabels===labels)return p.key;
  }
  // Fallback: match by total rate
  const totalRate=comps.reduce((s,c)=>s+(c.rate||0),0);
  const found=AP_TAX_PROFILES.find(p=>Math.abs(p.rate-totalRate)<0.001&&p.key!=="none");
  return found?found.key:"custom";
}

function TaxRateSelect({amount,value,onChange,compact}){
  const[profileKey,setProfileKey]=useState(()=>profileKeyFromComponents(value));
  const[customRate,setCustomRate]=useState("");
  const[customType,setCustomType]=useState("GST");
  const profile=AP_TAX_PROFILES.find(p=>p.key===profileKey);
  const taxTotal=(value||[]).reduce((s,c)=>M.sum(s,c.amount),0);

  const selectProfile=(key)=>{
    setProfileKey(key);
    if(key==="custom")return;
    const p=AP_TAX_PROFILES.find(pr=>pr.key===key);
    if(p)onChange(calcTaxComponents(p,amount));
  };
  const applyCustom=(rateStr,type)=>{
    setCustomRate(rateStr);
    const t=type||customType;
    const r=parseFloat(rateStr)/100;
    if(r>0){onChange([{type:t,rate:r,label:`${t} Custom (${rateStr}%)`,amount:M.mul(amount,r)}]);}
    else onChange([]);
  };
  const changeCustomType=(t)=>{setCustomType(t);if(customRate)applyCustom(customRate,t);};
  // Recalc when amount changes
  useEffect(()=>{
    if(profileKey==="custom"){if(customRate)applyCustom(customRate);return;}
    if(profileKey==="none"){onChange([]);return;}
    const p=AP_TAX_PROFILES.find(pr=>pr.key===profileKey);
    if(p&&M.round(amount)>0)onChange(calcTaxComponents(p,amount));
  },[amount]);

  const fs=compact?{fontSize:10,padding:"3px 5px"}:{fontSize:11,padding:"4px 6px"};
  return(<div style={{display:"flex",gap:compact?4:6,alignItems:"center",flexWrap:"wrap"}}>
    <select value={profileKey} onChange={e=>selectProfile(e.target.value)} style={{fontFamily:F.mono,...fs,background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,outline:"none",maxWidth:compact?130:170,cursor:"pointer"}}>
      {AP_TAX_PROFILES.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}
      <option value="custom">Custom %</option>
    </select>
    {profileKey==="custom"&&<><select value={customType} onChange={e=>changeCustomType(e.target.value)} style={{fontFamily:F.mono,...fs,background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,outline:"none",width:compact?55:65,cursor:"pointer"}}><option value="GST">GST</option><option value="HST">HST</option><option value="PST">PST</option><option value="QST">QST</option></select><input value={customRate} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))applyCustom(v);}} placeholder="%" style={{fontFamily:F.mono,...fs,background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,outline:"none",width:50,textAlign:"right"}}/></>}
    {taxTotal>0&&<span style={{fontFamily:F.mono,fontSize:compact?9:10,color:C.cyan,fontWeight:600}}>${taxTotal.toFixed(2)}</span>}
  </div>);
}
// Helper to set profile from province (for disb auto-fill)
function getProfileKeyForProvince(province){return PROVINCE_TO_PROFILE[province]||"gst";}
const fmtMoney=n=>{const v=parseFloat(n)||0;return v<0?`-$${Math.abs(v).toLocaleString("en",{minimumFractionDigits:2})}`:`$${v.toLocaleString("en",{minimumFractionDigits:2})}`;};

// ═══════ MODAL ═══════
let _modalResolve=null;let _setModalState=null;
function ModalProvider({children}){
  const[ms,setMs]=useState(null);_setModalState=setMs;
  const close=v=>{setMs(null);if(_modalResolve){_modalResolve(v);_modalResolve=null;}};
  return<>{children}{ms&&<div style={S.modal} onClick={()=>{if(!ms.confirm)close(false);}}>
    <div style={{background:C.surface,borderRadius:12,padding:24,minWidth:340,maxWidth:480,border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:14,color:C.text,fontFamily:F.body,lineHeight:1.6,marginBottom:20,whiteSpace:"pre-wrap"}}>{ms.message}</div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        {ms.confirm&&<Button variant="ghost" onClick={()=>close(false)}>Cancel</Button>}
        <Button onClick={()=>close(true)}>{ms.confirm?"Confirm":"OK"}</Button>
      </div>
    </div>
  </div>}</>;
}
function showAlert(msg){return new Promise(r=>{_modalResolve=r;if(_setModalState)_setModalState({message:msg,confirm:false});else{window.alert(msg);r(true);}});}
function showConfirm(msg){return new Promise(r=>{_modalResolve=r;if(_setModalState)_setModalState({message:msg,confirm:true});else{r(window.confirm(msg));}});}

// ═══════ UI PRIMITIVES ═══════
function Button({children,onClick,variant="primary",size="md",disabled,style:s}){
  const base={fontFamily:F.body,fontWeight:600,border:"none",borderRadius:7,cursor:disabled?"not-allowed":"pointer",transition:"all .15s",opacity:disabled?0.45:1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,whiteSpace:"nowrap"};
  const sz={sm:{fontSize:11,padding:"5px 10px"},md:{fontSize:13,padding:"8px 16px"}};
  const vr={primary:{background:C.accent,color:C.white},success:{background:C.green,color:C.white},danger:{background:C.red,color:C.white},ghost:{background:"transparent",color:C.textDim,border:`1px solid ${C.border}`},warning:{background:C.orange,color:C.white}};
  return<button onClick={onClick} disabled={disabled} style={{...base,...sz[size],...vr[variant],...s}} onMouseEnter={e=>{if(!disabled)e.target.style.filter="brightness(1.12)";}} onMouseLeave={e=>{e.target.style.filter="";}}>{children}</button>;
}
function Input({label,value,onChange,placeholder,type="text",style:s,readOnly,inputMode}){
  const hc=e=>{if(inputMode==="numeric"){const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))onChange(v);}else onChange(e.target.value);};
  return(<div style={{display:"flex",flexDirection:"column",gap:3,...s}}>{label&&<label style={S.label}>{label}</label>}<input type={type} value={value} onChange={hc} placeholder={placeholder} readOnly={readOnly} inputMode={inputMode==="numeric"?"decimal":undefined} style={{fontFamily:F.mono,fontSize:13,padding:"7px 10px",background:readOnly?C.sidebar:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:readOnly?C.textDim:C.text,outline:"none",width:"100%"}} onFocus={e=>{if(!readOnly)e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/></div>);
}
function Select({label,value,onChange,options,style:s,disabled}){return(<div style={{display:"flex",flexDirection:"column",gap:3,...s}}>{label&&<label style={S.label}>{label}</label>}<select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} style={{fontFamily:F.mono,fontSize:13,padding:"7px 10px",background:disabled?C.sidebar:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:disabled?C.textMuted:C.text,outline:"none",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.6:1}}>{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}</select></div>);}
function Checkbox({label,checked,onChange,color,disabled}){return(<label style={{display:"flex",alignItems:"center",gap:8,cursor:disabled?"default":"pointer",fontSize:13,color:disabled?C.textMuted:C.text,fontFamily:F.body,opacity:disabled?0.6:1}}><div onClick={e=>{e.preventDefault();if(!disabled)onChange(!checked);}} style={{width:17,height:17,borderRadius:4,border:`2px solid ${checked?(color||C.accent):C.border}`,background:checked?(color||C.accent):"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",flexShrink:0}}>{checked&&<span style={{color:"#fff",fontSize:11,lineHeight:1}}>✓</span>}</div>{label}</label>);}
function Badge({children,color=C.accent}){return<span style={{fontSize:10,fontWeight:700,fontFamily:F.mono,padding:"2px 7px",borderRadius:4,background:`${color}18`,color,textTransform:"uppercase",letterSpacing:".4px",border:`1px solid ${color}30`}}>{children}</span>;}
function IdLink({id,color=C.accent,onClick}){return<span onClick={onClick} style={{fontFamily:F.mono,fontSize:12,color,fontWeight:600,cursor:onClick?"pointer":"default",textDecoration:onClick?"underline":"none",textDecorationColor:onClick?color+"40":"transparent"}} title={onClick?"Click to open":""}>{id}</span>;}
async function loadJobAndOpen(jobId,onOpenARAP){if(!window.db||!onOpenARAP)return;try{const job=await window.db.jobs.get(jobId);if(job)onOpenARAP(job);}catch(_){}}
function Spinner({size=20,color=C.accent}){return<div style={{width:size,height:size,border:`2px solid ${color}30`,borderTopColor:color,borderRadius:"50%",animation:"clik-spin .6s linear infinite",display:"inline-block"}}/>;}
function LoadingOverlay({text="Loading..."}){return<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:60,gap:12}}><Spinner size={28}/><span style={{fontSize:12,color:C.textDim,fontFamily:F.body}}>{text}</span></div>;}
function EmptyState({icon="📋",text="No data found."}){return<div style={{...S.empty,display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><span style={{fontSize:28}}>{icon}</span><span>{text}</span></div>;}
function FieldError({msg}){return msg?<div style={{fontSize:10,color:C.red,marginTop:2,fontFamily:F.body}}>{msg}</div>:null;}
const validateEmail=v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validatePhone=v=>!v||/^[+\d\s().-]{7,}$/.test(v);
function ValidatedAutoComplete({items,value,onSelect,label,placeholder,style:s,error}){
  const[query,setQuery]=useState("");const[open,setOpen]=useState(false);const ref=useRef(null);
  useEffect(()=>{setQuery(value||"");},[value]);
  const matches=items.filter(it=>it.name.toLowerCase().includes(query.toLowerCase())||it.code.toLowerCase().includes(query.toLowerCase())).slice(0,8);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const isValid=items.some(it=>it.name===query);
  return(<div ref={ref} style={{position:"relative",...s}}>{label&&<label style={S.label}>{label}</label>}<input value={query} onChange={e=>{setQuery(e.target.value);setOpen(true);onSelect("");}} onFocus={()=>setOpen(true)} placeholder={placeholder} style={{fontFamily:F.mono,fontSize:13,padding:"7px 10px",background:C.bg,border:`1px solid ${error?C.red:isValid?C.green:C.border}`,borderRadius:6,color:C.text,outline:"none",width:"100%"}}/>{open&&matches.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,maxHeight:200,overflow:"auto",zIndex:100,marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,0.12)"}}>{matches.map(it=><div key={it.id} onClick={()=>{onSelect(it.name);setQuery(it.name);setOpen(false);}} style={{padding:"8px 12px",cursor:"pointer",fontSize:12,color:C.text,display:"flex",justifyContent:"space-between"}} onMouseEnter={e=>{e.currentTarget.style.background=C.surfaceHover;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}><span>{it.name}</span><span style={{color:C.textMuted,fontFamily:F.mono,fontSize:10}}>{it.code}</span></div>)}</div>}{error&&<div style={{fontSize:11,color:C.red,marginTop:3}}>Select a registered entry</div>}</div>);
}
function ContainerInput({label,value,onChange,placeholder,style:s}){
  const[bulk,setBulk]=useState(false);const[text,setText]=useState("");
  const openBulk=()=>{setText(value?value.split(",").map(s=>s.trim()).filter(Boolean).join("\n"):"");setBulk(true);};
  const applyBulk=()=>{const parsed=text.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).join(", ");onChange(parsed);setBulk(false);};
  return(<div style={{display:"flex",flexDirection:"column",gap:3,...s}}>{label&&<label style={S.label}>{label}</label>}<div style={{display:"flex",gap:6,alignItems:"center"}}><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"CNTR1234567, CNTR7654321"} style={{fontFamily:F.mono,fontSize:13,padding:"7px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",flex:1}} onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/><button onClick={openBulk} title="Bulk entry" style={{width:30,height:30,borderRadius:6,border:`1px solid ${C.border}`,background:C.card,color:C.textDim,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>≡</button></div>{value&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>{value.split(",").map(s=>s.trim()).filter(Boolean).map((c,i)=><span key={i} style={{fontSize:10,fontFamily:F.mono,padding:"2px 6px",borderRadius:4,background:`${C.accent}15`,color:C.accent,border:`1px solid ${C.accent}25`}}>{c}</span>)}</div>}{bulk&&<div style={S.modal} onClick={()=>setBulk(false)}><div style={{background:C.surface,borderRadius:14,padding:24,width:420,border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}><h3 style={{margin:"0 0 12px",fontFamily:F.display,color:C.text,fontSize:15}}>Bulk Container Entry</h3><textarea value={text} onChange={e=>setText(e.target.value)} rows={8} placeholder={"CNTR1234567\nCNTR7654321"} style={{width:"100%",fontFamily:F.mono,fontSize:13,padding:10,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",resize:"vertical"}}/><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}><span style={{fontSize:11,color:C.textMuted}}>{text.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).length} containers</span><div style={{display:"flex",gap:8}}><Button variant="ghost" size="sm" onClick={()=>setBulk(false)}>Cancel</Button><Button size="sm" onClick={applyBulk}>Apply</Button></div></div></div></div>}</div>);
}
function ChargeRow({code,label,amount,currency,onAmount,onCurrency,disb,onDisb,payee,onPayee,payeeList,locked,fxRate,remark,onRemark,taxPct,onTaxPct}){
  const dis=!!locked;const num=parseFloat(amount)||0;const showCad=currency==="USD"&&fxRate&&num>0;
  const taxAmt=num*(parseFloat(taxPct)||0)/100;
  return<div style={{borderRadius:4,background:dis?C.bg:disb?`${C.orange}08`:"transparent",paddingLeft:disb||dis?6:0,paddingRight:disb||dis?6:0,opacity:dis?0.5:1}}>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
      <span style={{fontFamily:F.mono,fontSize:11,color:dis?C.textMuted:disb?C.orange:C.accent,width:34,flexShrink:0,fontWeight:600}}>{code}</span>
      <span style={{fontSize:12,color:C.textDim,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",width:130,flexShrink:0}}>{label}</span>
      <input value={remark||""} onChange={e=>{if(!dis&&onRemark)onRemark(e.target.value);}} placeholder="remark..." disabled={dis} style={{fontFamily:F.body,fontSize:11,padding:"5px 8px",background:dis?C.surface:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:dis?C.textMuted:C.textDim,outline:"none",flex:1,minWidth:60}}/>
      <input value={amount} onChange={e=>{if(dis)return;const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))onAmount(v);}} placeholder="0.00" disabled={dis} style={{fontFamily:F.mono,fontSize:12,padding:"5px 8px",background:dis?C.surface:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:dis?C.textMuted:C.text,outline:"none",width:90,textAlign:"right"}}/>
      <select value={currency} onChange={e=>{if(!dis)onCurrency(e.target.value);}} disabled={dis} style={{fontFamily:F.mono,fontSize:11,padding:"5px 4px",background:dis?C.surface:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:dis?C.textMuted:C.text,outline:"none",width:56}}><option>CAD</option><option>USD</option></select>
      <input value={taxPct??""} onChange={e=>{if(!dis&&onTaxPct){const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))onTaxPct(v);}}} placeholder="0" disabled={dis} style={{fontFamily:F.mono,fontSize:11,padding:"5px 4px",background:dis?C.surface:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:dis?C.textMuted:C.text,outline:"none",width:42,textAlign:"right"}} title="Tax %"/>
      <span style={{fontSize:10,color:C.textMuted,width:12,flexShrink:0}}>%</span>
      {taxAmt>0&&<span style={{fontSize:10,fontFamily:F.mono,color:C.green,minWidth:60,flexShrink:0}}>+${taxAmt.toFixed(2)}</span>}
      {showCad&&<span style={{fontSize:10,fontFamily:F.mono,color:C.cyan,minWidth:70,flexShrink:0}}><span style={{fontSize:8,background:`${C.cyan}20`,padding:"1px 3px",borderRadius:2,fontWeight:700,marginRight:2}}>CAD</span>${(num*fxRate).toFixed(2)}</span>}
      {onDisb!==undefined&&<label style={{display:"flex",alignItems:"center",gap:3,cursor:dis?"not-allowed":"pointer",flexShrink:0}}><input type="checkbox" checked={!!disb} onChange={e=>{if(!dis)onDisb(e.target.checked);}} disabled={dis} style={{accentColor:C.orange,width:14,height:14}}/><span style={{fontSize:9,fontWeight:600,color:dis?C.textMuted:disb?C.orange:C.textMuted,textTransform:"uppercase",letterSpacing:".3px"}}>Disb</span></label>}
      {dis&&<span style={{fontSize:8,color:C.green,fontWeight:600,textTransform:"uppercase",flexShrink:0}}>Invoiced</span>}
    </div>
    {disb&&payeeList&&!dis&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"0 0 4px 42px"}}><span style={{fontSize:9,color:C.orange,fontWeight:600,flexShrink:0}}>→ Pay To:</span><select value={payee||""} onChange={e=>onPayee(e.target.value)} style={{fontFamily:F.mono,fontSize:11,padding:"4px 6px",background:C.bg,border:`1px solid ${payee?C.orange+"40":C.red}`,borderRadius:5,color:C.text,outline:"none",flex:1,maxWidth:200}}><option value="">Select payee...</option>{payeeList.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></div>}
  </div>;
}

// ═══════ PAGINATION ═══════
function Pagination({page,totalPages,total,onPage}){
  if(totalPages<=1)return<div style={{fontSize:11,color:C.textMuted,fontFamily:F.mono,padding:"8px 0"}}>Total: {total}</div>;
  return(<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0"}}>
    <Button variant="ghost" size="sm" disabled={page<=1} onClick={()=>onPage(page-1)}>← Prev</Button>
    <span style={{fontSize:11,fontFamily:F.mono,color:C.textDim}}>Page {page} / {totalPages} ({total} total)</span>
    <Button variant="ghost" size="sm" disabled={page>=totalPages} onClick={()=>onPage(page+1)}>Next →</Button>
  </div>);
}

// ═══════ PLACEHOLDER PAGES ═══════

// ═══════ BL REMITTANCE STATUS HELPER ═══════
function blRemitStatus(job){
  const checkCharges=(charges)=>{
    if(!charges)return{hasLines:false,hasAccrued:false,allPaid:true,anyPaid:false};
    let hasLines=false,hasAccrued=false,allPaid=true,anyPaid=false;
    for(const[key,val]of Object.entries(charges)){
      if(key.startsWith("_")||key.includes("_"))continue;
      hasLines=true;
      const amt=M.round(val);
      if(amt<=0){hasAccrued=true;allPaid=false;continue;}
      const payments=charges[key+"_payments"]||[];
      const paid=payments.reduce((s,p)=>M.sum(s,p.amount),0);
      if(paid>=amt)anyPaid=true;else allPaid=false;
      if(paid>0&&paid<amt)anyPaid=true;
    }
    const manualAP=charges._manualAP||[];
    for(const l of manualAP){
      hasLines=true;
      const amt=M.round(l.amount);
      if(amt<=0){hasAccrued=true;allPaid=false;continue;}
      const paid=(l.payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
      if(paid>=amt)anyPaid=true;else allPaid=false;
      if(paid>0&&paid<amt)anyPaid=true;
    }
    return{hasLines,hasAccrued,allPaid,anyPaid};
  };
  const cb=checkCharges(job.cb);const ff=checkCharges(job.ff);
  const hasLines=cb.hasLines||ff.hasLines;
  if(!hasLines)return{status:"",color:C.textMuted};
  const hasAccrued=cb.hasAccrued||ff.hasAccrued;
  const allPaid=(cb.hasLines?cb.allPaid:true)&&(ff.hasLines?ff.allPaid:true);
  const anyPaid=cb.anyPaid||ff.anyPaid;
  if(allPaid&&!hasAccrued)return{status:"REMITTED",color:C.green};
  if(hasAccrued)return{status:"ACCRUED",color:C.purple};
  return{status:"SLIPPED",color:C.blue};
}

// ═══════ DASHBOARD PAGE ═══════
function DashboardPage({onOpenARAP,onNav}){
  const[data,setData]=useState(null);const[loading,setLoading]=useState(true);
  const load=async()=>{
    if(!window.db)return;setLoading(true);
    try{
      const stats=await window.db.dashboard.stats();
      setData({...stats,apOutstanding:0,topPayee:[],monthPayments:0});
    }catch(e){console.error(e);}
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  const fmt=v=>`$${(v||0).toLocaleString("en",{minimumFractionDigits:2})}`;
  if(loading)return<LoadingOverlay text="Loading dashboard..."/>;
  if(!data)return<EmptyState text="No data available."/>;
  const d=data;
  const Card=({label,value,color,sub})=>(<div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16,flex:1,minWidth:140}}>
    <div style={{fontSize:10,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:".5px"}}>{label}</div>
    <div style={{fontSize:24,fontWeight:700,fontFamily:F.mono,color:color||C.text,marginTop:6}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:C.textDim,marginTop:4}}>{sub}</div>}
  </div>);
  return(<div>
    <h1 style={S.pt}>📊 Dashboard</h1>
    {/* Summary cards */}
    <div style={{display:"flex",gap:14,marginBottom:24,flexWrap:"wrap"}}>
      <Card label="Total BLs" value={d.totalBLs} sub={`${d.openBLs} open · ${d.closedBLs} closed`}/>
      <Card label="AR Outstanding" value={fmt(d.arOutstanding)} color={d.arOutstanding>0?C.red:C.green} sub={`${d.totalInvs} invoices issued`}/>
      <Card label="AP Outstanding" value={fmt(d.apOutstanding)} color={d.apOutstanding>0?C.orange:C.green}/>
      <Card label="GE Count" value={d.totalGEs}/>
    </div>
    {/* This month */}
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16,marginBottom:24}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:12}}>This Month ({new Date().toISOString().slice(0,7)})</div>
      <div style={{display:"flex",gap:24,fontSize:12,color:C.textDim}}>
        <span><strong style={{color:C.text}}>{d.monthBLs}</strong> BLs created</span>
        <span><strong style={{color:C.text}}>{d.monthInvs}</strong> Invoices issued</span>
        <span><strong style={{color:C.green}}>{fmt(d.monthPayments)}</strong> Payments received</span>
      </div>
    </div>
    {/* Two columns: Top AR / Top AP */}
    <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:280,background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:10}}>Top AR Outstanding</div>
        {d.topCust.length===0?<div style={{fontSize:11,color:C.textMuted}}>No outstanding AR</div>:d.topCust.map(([cust,amt])=>(
          <div key={cust} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:12,color:C.text}}>{cust}</span>
            <span style={{fontFamily:F.mono,fontSize:12,color:C.red,fontWeight:600}}>{fmt(amt)}</span>
          </div>
        ))}
      </div>
      <div style={{flex:1,minWidth:280,background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:10}}>Top AP Outstanding</div>
        {d.topPayee.length===0?<div style={{fontSize:11,color:C.textMuted}}>No outstanding AP</div>:d.topPayee.map(([payee,amt])=>(
          <div key={payee} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:12,color:C.text}}>{payee}</span>
            <span style={{fontFamily:F.mono,fontSize:12,color:C.orange,fontWeight:600}}>{fmt(amt)}</span>
          </div>
        ))}
      </div>
    </div>
    {/* Recent BLs */}
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16}}>
      <div style={{fontSize:12,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:10}}>Recent BLs</div>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>
        {["ID","Customer","Type","Created","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}
      </tr></thead><tbody>
      {d.recentBLs.map(job=>{
        const rs=blRemitStatus(job);
        return(<tr key={job.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <td style={S.td}><IdLink id={job.id} onClick={()=>onOpenARAP(job)}/></td>
          <td style={S.td}><span style={{fontSize:12}}>{job.customer}</span></td>
          <td style={S.td}><div style={{display:"flex",gap:4}}>{job.cbEnabled&&<Badge color={C.accent}>CB</Badge>}{job.ffEnabled&&<Badge color={C.orange}>FF</Badge>}</div></td>
          <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11,color:C.textDim}}>{(job.createdAt||"").slice(0,10)||"—"}</span></td>
          <td style={S.td}>{rs.status&&<span style={{fontSize:9,fontWeight:700,color:rs.color,padding:"2px 6px",borderRadius:4,border:`1px solid ${rs.color}30`,background:`${rs.color}10`}}>{rs.status}</span>}</td>
        </tr>);
      })}
      </tbody></table>
    </div>
  </div>);
}

// ═══════ BL CREATION PAGE ═══════
function BLCreationPage({onOpenARAP,onOpenBLDetail,filters}){
  const[jobs,setJobs]=useState([]);
  const search=filters.search;const setSearch=filters.setSearch;const dSearch=useDebounce(search);
  const createdMonth=filters.createdMonth;const setCreatedMonth=filters.setCreatedMonth;
  const filterCustomer=filters.filterCustomer;const setFilterCustomer=filters.setFilterCustomer;
  const filterStatus=filters.filterStatus;const setFilterStatus=filters.setFilterStatus;
  const page=filters.page;const setPage=filters.setPage;
  const[total,setTotal]=useState(0);const PAGE_SIZE=50;
  const[showForm,setShowForm]=useState(false);const[customerList,setCustomerList]=useState([]);
  const[saving,setSaving]=useState(false);const[loading,setLoading]=useState(true);

  // Form state
  const emptyForm={customer:"",cbEnabled:false,ffEnabled:false,
    // CB fields
    cb_bl:"",cb_shipper:"",cb_cnee:"",cb_ior:"",cb_pol:"",cb_polAtd:"",cb_pod:"",cb_podEta:"",cb_ccn:"",cb_transaction:"",cb_remark:"",
    // FF fields
    ff_mbl:"",ff_hbl:"",ff_containers:"",ff_shipper:"",ff_cnee:"",ff_pol:"",ff_polAtd:"",ff_pod:"",ff_podEta:"",ff_quantity:"",ff_quantityUom:"PLT",ff_weight:"",ff_volume:"",ff_remark:""
  };
  const[form,setForm]=useState(emptyForm);
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));

  // Container rows for FF (each with container# + size + seal)
  const[ffContainers,setFfContainers]=useState([{cntr:"",size:"20",seal:""}]);
  const addContainer=()=>setFfContainers(p=>[...p,{cntr:"",size:"20",seal:""}]);
  const updContainer=(i,k,v)=>setFfContainers(p=>p.map((c,j)=>j===i?{...c,[k]:v}:c));
  const delContainer=i=>setFfContainers(p=>p.length<=1?p:p.filter((_,j)=>j!==i));

  const load=async()=>{
    if(!window.db)return;
    setLoading(true);
    try{
      const opts={limit:PAGE_SIZE,offset:(page-1)*PAGE_SIZE,search:dSearch,createdMonth};
      const[list,cnt]=await Promise.all([window.db.jobs.list(opts),window.db.jobs.count({search:dSearch,createdMonth})]);
      setJobs(list||[]);setTotal(cnt||0);
    }catch(e){await showAlert("Failed to load BLs: "+e.message);}
    setLoading(false);
  };
  useEffect(()=>{load();setCustomerList([...DB.customers]);},[dSearch,createdMonth,page]);

  // Client-side filters for customer and status
  const filteredJobs=jobs.filter(j=>{
    if(filterCustomer&&j.customer!==filterCustomer)return false;
    if(filterStatus){const rs=blRemitStatus(j);if(rs.status!==filterStatus)return false;}
    return true;
  });

  const hasClientFilter=!!(filterCustomer||filterStatus);
  const displayTotal=hasClientFilter?filteredJobs.length:total;
  const totalPages=Math.max(1,Math.ceil(displayTotal/PAGE_SIZE));

  const resetForm=()=>{setForm(emptyForm);setFfContainers([{cntr:"",size:"20",seal:""}]);setShowForm(false);};

  const createBL=async()=>{
    if(!form.customer){await showAlert("Please select a customer.");return;}
    if(!form.cbEnabled&&!form.ffEnabled){await showAlert("Please select at least CB or FF.");return;}
    setSaving(true);
    try{
      // Build container string and size string from ffContainers
      const cntrStr=ffContainers.map(c=>c.cntr).filter(Boolean).join(", ");
      const sizeStr=ffContainers.map(c=>c.size).join(", ");
      const sealStr=ffContainers.map(c=>c.seal||"").join(", ");

      const jobData={
        customer:form.customer,
        cbEnabled:form.cbEnabled, ffEnabled:form.ffEnabled,
        // CB fields
        bl:form.cb_bl, shipper:form.cbEnabled?form.cb_shipper:(form.ffEnabled?form.ff_shipper:""),
        cnee:form.cbEnabled?form.cb_cnee:(form.ffEnabled?form.ff_cnee:""),
        ior:form.cb_ior, ccn:form.cb_ccn, transaction:form.cb_transaction,
        // FF fields
        mbl:form.ff_mbl, hbl:form.ff_hbl, cntr:cntrStr, size:sizeStr, seal:sealStr,
        quantity:form.ff_quantity, quantityUom:form.ff_quantityUom,
        weight:form.ff_weight, volume:form.ff_volume,
        // Shared
        pol:form.cbEnabled?form.cb_pol:form.ff_pol,
        polAtd:form.cbEnabled?form.cb_polAtd:form.ff_polAtd,
        pod:form.cbEnabled?form.cb_pod:form.ff_pod,
        podEta:form.cbEnabled?form.cb_podEta:form.ff_podEta,
        remark:form.cbEnabled?form.cb_remark:form.ff_remark,
        // Store CB/FF specific shipping info in cb/ff JSON
        cb:form.cbEnabled?{_shipper:form.cb_shipper,_cnee:form.cb_cnee,_pol:form.cb_pol,_polAtd:form.cb_polAtd,_pod:form.cb_pod,_podEta:form.cb_podEta}:{},
        ff:form.ffEnabled?{_shipper:form.ff_shipper,_cnee:form.ff_cnee,_pol:form.ff_pol,_polAtd:form.ff_polAtd,_pod:form.ff_pod,_podEta:form.ff_podEta}:{},
      };
      await dbAddJob(jobData);
      resetForm();await load();
    }catch(e){await showAlert("Error: "+e.message);}
    setSaving(false);
  };

  const deleteBL=async(job)=>{
    const hasInv=(job.cbInvoices||[]).length>0||(job.ffInvoices||[]).length>0;
    if(hasInv){await showAlert("Cannot delete BL with invoices. Delete invoices first.");return;}
    if(!(await showConfirm(`Delete BL "${job.id}" (${job.customer})? This cannot be undone.`)))return;
    try{
      const res=await window.db.jobs.delete(job.id);
      if(res?.success){await load();}else{await showAlert(res?.error||"Delete failed.");}
    }catch(e){await showAlert("Error: "+e.message);}
  };

  const typeLabel=j=>{const t=[];if(j.cbEnabled)t.push("CB");if(j.ffEnabled)t.push("FF");return t.join(" / ")||"—";};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h1 style={S.pt}>📋 BL Creation</h1>
      <Button onClick={()=>{if(showForm)resetForm();else setShowForm(true);}}>{showForm?"✕ Cancel":"+ Create BL"}</Button>
    </div>

    {/* ── CREATE FORM ── */}
    {showForm&&<div style={{background:C.surface,borderRadius:10,padding:24,border:`1px solid ${C.accent}33`,marginBottom:24}}>
      <h3 style={{margin:"0 0 16px",fontFamily:F.display,color:C.text,fontSize:16}}>New BL</h3>

      {/* Row 1: Customer + Closing Date + CB/FF */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:16}}>
        <ValidatedAutoComplete items={customerList} value={form.customer} onSelect={v=>upd("customer",v)} label="Customer" placeholder="Select customer..."/>
      </div>
      <div style={{display:"flex",gap:20,marginBottom:20}}>
        <Checkbox label="CB (Customs Brokerage)" checked={form.cbEnabled} onChange={v=>upd("cbEnabled",v)} color={C.accent}/>
        <Checkbox label="FF (Freight Forwarding)" checked={form.ffEnabled} onChange={v=>upd("ffEnabled",v)} color={C.orange}/>
      </div>

      {/* ── CB Section ── */}
      {form.cbEnabled&&<div style={{background:`${C.accent}06`,borderRadius:8,border:`1px solid ${C.accent}20`,padding:16,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.accent,fontFamily:F.display,marginBottom:12}}>CB — Customs Brokerage</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
          <Input label="BL #" value={form.cb_bl} onChange={v=>upd("cb_bl",v)} placeholder="BL number"/>
          <Input label="Shipper" value={form.cb_shipper} onChange={v=>upd("cb_shipper",v)} placeholder="Shipper"/>
          <Input label="CNEE" value={form.cb_cnee} onChange={v=>upd("cb_cnee",v)} placeholder="Consignee"/>
          <Input label="IOR" value={form.cb_ior} onChange={v=>upd("cb_ior",v)} placeholder="Importer of Record"/>
          <Input label="CCN #" value={form.cb_ccn} onChange={v=>upd("cb_ccn",v)} placeholder="CCN number"/>
          <Input label="Transaction #" value={form.cb_transaction} onChange={v=>upd("cb_transaction",v)} placeholder="Transaction #"/>
          <Input label="POL" value={form.cb_pol} onChange={v=>upd("cb_pol",v)} placeholder="Port of Loading"/>
          <Input label="POL ATD" type="date" value={form.cb_polAtd} onChange={v=>upd("cb_polAtd",v)}/>
          <Input label="POD" value={form.cb_pod} onChange={v=>upd("cb_pod",v)} placeholder="Port of Discharge"/>
          <Input label="POD ETA" type="date" value={form.cb_podEta} onChange={v=>upd("cb_podEta",v)}/>
          <Input label="Remark" value={form.cb_remark} onChange={v=>upd("cb_remark",v)} placeholder="Notes..." style={{gridColumn:"span 2"}}/>
        </div>
      </div>}

      {/* ── FF Section ── */}
      {form.ffEnabled&&<div style={{background:`${C.orange}06`,borderRadius:8,border:`1px solid ${C.orange}20`,padding:16,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.orange,fontFamily:F.display,marginBottom:12}}>FF — Freight Forwarding</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
          <Input label="MBL #" value={form.ff_mbl} onChange={v=>upd("ff_mbl",v)} placeholder="Master BL"/>
          <Input label="HBL #" value={form.ff_hbl} onChange={v=>upd("ff_hbl",v)} placeholder="House BL"/>
          <Input label="Shipper" value={form.ff_shipper} onChange={v=>upd("ff_shipper",v)} placeholder="Shipper"/>
          <Input label="CNEE" value={form.ff_cnee} onChange={v=>upd("ff_cnee",v)} placeholder="Consignee"/>
          <Input label="POL" value={form.ff_pol} onChange={v=>upd("ff_pol",v)} placeholder="Port of Loading"/>
          <Input label="POL ATD" type="date" value={form.ff_polAtd} onChange={v=>upd("ff_polAtd",v)}/>
          <Input label="POD" value={form.ff_pod} onChange={v=>upd("ff_pod",v)} placeholder="Port of Discharge"/>
          <Input label="POD ETA" type="date" value={form.ff_podEta} onChange={v=>upd("ff_podEta",v)}/>
          <Input label="Quantity" value={form.ff_quantity} onChange={v=>upd("ff_quantity",v)} placeholder="0" inputMode="numeric"/>
          <Select label="Qty UOM" value={form.ff_quantityUom} onChange={v=>upd("ff_quantityUom",v)} options={UOM_OPTS}/>
          <Input label="Weight (kg)" value={form.ff_weight} onChange={v=>upd("ff_weight",v)} placeholder="0" inputMode="numeric"/>
          <Input label="Volume (CBM)" value={form.ff_volume} onChange={v=>upd("ff_volume",v)} placeholder="0" inputMode="numeric"/>
        </div>

        {/* Containers with per-row size */}
        <div style={{marginTop:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <label style={S.label}>Containers</label>
            <Button variant="ghost" size="sm" onClick={addContainer}>+ Add Container</Button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {ffContainers.map((c,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={c.cntr} onChange={e=>updContainer(i,"cntr",e.target.value)} placeholder={`Container #${i+1}`} style={{fontFamily:F.mono,fontSize:13,padding:"7px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",flex:1}} onFocus={e=>{e.target.style.borderColor=C.orange;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>
                <select value={c.size} onChange={e=>updContainer(i,"size",e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"7px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",width:80}}>
                  {SIZE_OPTS.map(s=><option key={s}>{s}</option>)}
                </select>
                <input value={c.seal||""} onChange={e=>updContainer(i,"seal",e.target.value)} placeholder="Seal #" style={{fontFamily:F.mono,fontSize:12,padding:"7px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",width:120}} onFocus={e=>{e.target.style.borderColor=C.orange;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>
                {ffContainers.length>1&&<button onClick={()=>delContainer(i)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16,padding:"0 4px",fontWeight:700}}>×</button>}
              </div>
            ))}
          </div>
          {ffContainers.filter(c=>c.cntr).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
            {ffContainers.filter(c=>c.cntr).map((c,i)=><span key={i} style={{fontSize:10,fontFamily:F.mono,padding:"2px 6px",borderRadius:4,background:`${C.orange}15`,color:C.orange,border:`1px solid ${C.orange}25`}}>{c.cntr} ({c.size}){c.seal?` 🔒${c.seal}`:""}</span>)}
          </div>}
        </div>

        <div style={{marginTop:10}}>
          <Input label="Remark" value={form.ff_remark} onChange={v=>upd("ff_remark",v)} placeholder="Notes..."/>
        </div>
      </div>}

      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        <Button variant="ghost" onClick={resetForm}>Cancel</Button>
        <Button onClick={createBL} disabled={saving||!form.customer}>{saving?"Creating...":"Create BL"}</Button>
      </div>
    </div>}

    {/* ── SEARCH & FILTERS ── */}
    <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"flex-end",flexWrap:"wrap"}}>
      <Input value={search} onChange={v=>{setSearch(v);setPage(1);}} placeholder="Search ID, BL, MBL, Customer..." style={{flex:1,minWidth:180}}/>
      <div><label style={S.label}>Created Month</label><input type="month" value={createdMonth} onChange={e=>{setCreatedMonth(e.target.value);setPage(1);}} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
      <div><label style={S.label}>Customer</label><select value={filterCustomer} onChange={e=>{setFilterCustomer(e.target.value);}} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",minWidth:120}}><option value="">All</option>{customerList.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
      <div><label style={S.label}>Status</label><select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);}} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",minWidth:100}}><option value="">All</option><option value="ACCRUED">ACCRUED</option><option value="SLIPPED">SLIPPED</option><option value="REMITTED">REMITTED</option></select></div>
      {(createdMonth||filterCustomer||filterStatus)&&<Button variant="ghost" size="sm" onClick={()=>{setCreatedMonth("");setFilterCustomer("");setFilterStatus("");setPage(1);}}>Clear All</Button>}
    </div>

    {/* ── BL LIST ── */}
    {loading?<LoadingOverlay text="Loading BLs..."/>:<>
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,overflow:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>
        {["ID #","BL # / MBL","Customer","Type","Created","Pay Status","Closed",""].map(h=><th key={h} style={S.th}>{h}</th>)}
      </tr></thead>
      <tbody>{filteredJobs.length===0?<tr><td colSpan={8}><EmptyState icon="📋" text="No BL records found."/></td></tr>:filteredJobs.map(job=>{
        const rs=blRemitStatus(job);
        const isClosed=!!job.closedMonth;
        return(<tr key={job.id} style={{borderBottom:`1px solid ${C.border}`,opacity:isClosed?0.5:1}} onMouseEnter={e=>e.currentTarget.style.background=C.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <td style={S.td}><span onClick={()=>onOpenARAP(job)} style={{fontFamily:F.mono,fontSize:12,color:C.accent,fontWeight:600,cursor:"pointer",textDecoration:"underline",textDecorationColor:C.accent+"40"}} title="Open AR/AP">{job.id}</span></td>
          <td style={S.td}><span onClick={()=>onOpenBLDetail(job)} style={{fontFamily:F.mono,fontSize:12,color:C.text,cursor:"pointer",textDecoration:"underline",textDecorationColor:C.border}} title="Open BL Detail">{job.bl||job.mbl||"—"}</span>{job.bl&&job.mbl&&<span style={{fontSize:10,color:C.textMuted,marginLeft:6}}>MBL: {job.mbl}</span>}</td>
          <td style={S.td}><span style={{fontSize:13,color:C.text}}>{job.customer}</span></td>
          <td style={S.td}><div style={{display:"flex",gap:4}}>
            {job.cbEnabled&&<Badge color={C.accent}>CB</Badge>}
            {job.ffEnabled&&<Badge color={C.orange}>FF</Badge>}
            {!job.cbEnabled&&!job.ffEnabled&&<span style={{color:C.textMuted}}>—</span>}
          </div></td>
          <td style={S.td}><span style={{fontFamily:F.mono,fontSize:12,color:job.createdAt?C.text:C.textMuted}}>{(job.createdAt||"").slice(0,10)||"—"}</span></td>
          <td style={S.td}>{rs.status&&<span style={{fontSize:10,fontWeight:700,color:rs.color,padding:"2px 8px",borderRadius:4,border:`1px solid ${rs.color}30`,background:`${rs.color}10`}}>{rs.status}</span>}</td>
          <td style={S.td}>{isClosed?<span style={{fontSize:10,fontWeight:700,color:C.green,padding:"2px 8px",borderRadius:4,border:`1px solid ${C.green}30`,background:`${C.green}10`}}>{job.closedMonth}</span>:<span style={{fontSize:10,color:C.textMuted}}>Open</span>}</td>
          <td style={S.td}><div style={{display:"flex",gap:4}}><Button variant="ghost" size="sm" onClick={()=>onOpenBLDetail(job)}>Open</Button>{!isClosed&&(job.cbInvoices||[]).length===0&&(job.ffInvoices||[]).length===0&&<button onClick={()=>deleteBL(job)} title="Delete BL" style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:13,fontWeight:700,padding:"0 4px"}}>×</button>}</div></td>
        </tr>);
      })}</tbody></table>
    </div>
    <Pagination page={page} totalPages={totalPages} total={displayTotal} onPage={setPage}/>
    </>}
  </div>);
}

// ═══════ INVOICE HTML + PRINT + PDF ═══════
const CLIK_LOGO_B64="data:image/jpeg;base64,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chKttbIyCQccE0VpUUEhRRRQAUUUUAFFFFABRRRQAda8p8f/ALLPws+JXmSaz4OsEu5Mk3mnqbScn+8Wi27j/vZr1airhOdN3g7MznThUVppNeZ8NeNP+CXOiXs0kvhbxte6Yh5W21S0W5GfTzEMZA/4Ca8W8V/8E0fitpG99KutC8QRj7q2920Mp+olRVH/AH0a/U6ivRhmWJju7+p58ssw0to29GfjZqn7CfxzsAd/gOeUDvb39pLn8FlJrm3/AGO/jS0xiHw51vcO/lLt/wC+s4r9t6K6Fm1brFfj/mYPKaPST/D/ACPxVtv2FvjrfYEfw9vVz/z2u7aP/wBClFdz4b/4JhfGXXNp1D+wPDyn7wvtQMjD8IUkBP41+uNFRLNa72SRccrox3bZ+ePgX/gknZxzJL4y8ezXEX8VpodoIj/3+lLf+i6+mvhz+xH8Gfhk0M2n+CrPU76Igi91om9k3DowEmUU+6qK90orhqYuvV+KX6HdTwtGn8MRqIsaKiKFVRgKBgAU6iiuQ6gooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvJ/GH7V3wg8A+IJND174haJYarE2yW1Nx5jQt/dk2AhD7NinftV+NtQ+HX7Ovj7xDpUrQalZ6XJ9nmXrG74QOPcbs/hXwb+xJ+wt4E/aB+Buo+MfGM+p3Gs6leXFvazW10Yxa7MDzMY+dixJO7IwBx1oHY/TjQPEOl+KtIttV0XUbXVtMul3wXllMssUq+qspINaFfnx/wS3g8X+CPEPxI8C61Z6lBoVnItzZPeW0kURlEjRuYywx8wCEgema+7tH8aeHvEV/c2Ola7pmp3ttnz7azvI5ZIsHB3KpJXnjnvQDNmisa18aeH77XZtEttd0y41mHPmadFeRtcJjrujB3DHfIqHxb4/8AC/gG2iufE/iTSPDl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";
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
async function buildInvoiceHTML(inv) {
  const tax = inv.taxLabel ? { label: inv.taxLabel } : (PROVINCE_TAX[inv.province] || { label: "GST 5%" });
  let co = {}, custAddr = "";
  try { co = window.db ? (await window.db.company.get()) : {}; } catch(_) { co = {}; }
  const flds = inv.displayFields || {};
  const labels = inv.type === "CB" ? CB_INV_FIELDS : FF_INV_FIELDS;
  const visible = Object.keys(flds).filter(k => flds[k] && inv.jobData?.[k]);
  const metaHtml = visible.map(k => `<tr><td style="color:#555;padding:3px 16px 3px 0;font-size:12px;font-weight:600">${esc(labels[k])}</td><td style="font-size:12px">${esc(inv.jobData[k])}</td></tr>`).join("");
  try { custAddr = esc((window.db ? (await window.db.customers.findByName(inv.customer))?.address : "") || ""); } catch(_) {}
  const invCurrency = inv.invoiceCurrency || "CAD";
  const fxRate = inv.fxRate || 1;
  const hasUSD = inv.items.some(it => (it.originalCurrency||"CAD") === "USD");
  const hasCAD = inv.items.some(it => (it.originalCurrency||"CAD") === "CAD");
  const hasMixed = hasUSD && hasCAD;
  // Build items with dual currency display
  const itemsHtml = inv.items.map(it => {
    const origAmt = it.originalAmount || it.amount || 0;
    const origCur = it.originalCurrency || "CAD";
    // Convert to invoice currency
    let dispAmt;
    if(invCurrency === "USD") {
      dispAmt = origCur === "USD" ? origAmt : M.mul(origAmt, 1/fxRate);
    } else {
      dispAmt = origCur === "USD" ? M.mul(origAmt, fxRate) : origAmt;
    }
    const rmk = it.remark ? `<div style="font-size:10px;color:#888;margin-top:1px">${esc(it.remark)}</div>` : "";
    return `<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500">${esc(it.label)}${rmk}</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px">1</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;font-size:13px;font-weight:600">${invCurrency} $${dispAmt.toFixed(2)}</td></tr>`;
  }).join("");
  // Totals in invoice currency
  let dispSubtotal, dispTotal;
  const taxComps = (inv.taxComponents || []).map(c => {
    const amt = invCurrency === "USD" ? M.mul(c.amount||0, 1/fxRate) : M.round(c.amount || 0);
    return { ...c, dispAmount: amt };
  });
  if(invCurrency === "USD") {
    dispSubtotal = M.mul(inv.subtotal, 1/fxRate);
    dispTotal = M.mul(inv.total, 1/fxRate);
  } else {
    dispSubtotal = M.round(inv.subtotal);
    dispTotal = M.round(inv.total);
  }
  // Fallback for old invoices without taxComponents
  const hasTaxComps = taxComps.length > 0;
  const fallbackTaxAmt = invCurrency === "USD" ? M.mul(inv.taxAmount||0, 1/fxRate) : M.round(inv.taxAmount || 0);
  const fallbackTaxLabel = inv.taxLabel || (PROVINCE_TAX[inv.province] || {}).label || "Tax";
  const coName = esc(co.companyName || ""), coAddr = esc(co.address || "");
  const coTax = co.taxId ? "Tax ID: " + esc(co.taxId) : "";
  const notes = co.notesTerms || "";
  const notesHtml = notes ? `<div style="margin-top:40px;padding-top:16px;border-top:1px solid #ccc"><div style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px">Notes / Terms</div><div style="font-size:11px;color:#444;white-space:pre-wrap">${esc(notes)}</div></div>` : "";
  const accent = "#4cb8c4";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${esc(inv.invoiceNumber)}</title>
<style>body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:800px;margin:30px auto;color:#222;padding:30px;font-size:13px}.accent-bar{background:linear-gradient(135deg,${accent},#3b82f6);height:4px;margin:20px 0 24px}.info-label{color:#555;font-weight:600;font-size:12px;text-align:right;padding:2px 10px 2px 0}.info-val{font-size:12px;padding:2px 0}.items-table{width:100%;border-collapse:collapse;margin:20px 0}.items-header{background:linear-gradient(135deg,${accent},#3b82f6);color:#fff}.items-header th{padding:10px 12px;font-size:11px;text-transform:uppercase;font-weight:700;letter-spacing:.5px}.total-section td{padding:4px 12px;font-size:13px}.total-row td{font-weight:700;font-size:15px;border-top:2px solid #222;padding-top:10px}@media print{body{margin:10px;padding:20px}}</style></head><body>
<table style="width:100%"><tr><td style="width:50%"><img src="${CLIK_LOGO_B64}" style="height:60px" alt="CLIK"/></td><td style="text-align:right;padding-top:4px"><div style="font-size:36px;font-weight:800;color:#1e3a5f;letter-spacing:1px">INVOICE</div>${coTax?'<div style="font-size:11px;color:#666;margin-top:2px">'+coTax+'</div>':''}${coName?'<div style="font-weight:700;font-size:13px;margin-top:8px">'+coName+'</div>':''}${coAddr?'<div style="font-size:11px;color:#666;white-space:pre-wrap">'+coAddr+'</div>':''}</td></tr></table>
<div class="accent-bar"></div>
<table style="width:100%;margin-bottom:20px"><tr><td style="vertical-align:top;width:55%"><div style="background:#f8f9fa;border-radius:6px;padding:14px 18px;border:1px solid #e5e7eb"><div style="font-size:10px;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:4px">Bill To</div><div style="font-weight:700;font-size:15px;color:#111">${esc(inv.customer)}</div>${custAddr?'<div style="font-size:12px;color:#444;margin-top:3px">'+custAddr+'</div>':''}</div></td><td style="vertical-align:top;text-align:right;padding-left:20px"><table style="margin-left:auto"><tr><td class="info-label">Invoice #:</td><td class="info-val" style="font-weight:700">${inv.invoiceNumber}</td></tr><tr><td class="info-label">Date:</td><td class="info-val">${inv.date}</td></tr>${inv.dueDate?'<tr><td class="info-label">Due:</td><td class="info-val">'+inv.dueDate+'</td></tr>':''}</table></td></tr></table>
${visible.length>0?'<table style="margin-bottom:16px">'+metaHtml+'</table>':''}
<table class="items-table"><thead><tr class="items-header"><th style="text-align:left;width:55%">Items</th><th style="text-align:center;width:15%">Qty</th><th style="text-align:right;width:30%">Amount (${invCurrency})</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<table style="width:320px;margin-left:auto;margin-top:10px" class="total-section"><tr><td style="color:#666;font-weight:600">Subtotal:</td><td style="text-align:right;font-family:monospace">${invCurrency} $${dispSubtotal.toFixed(2)}</td></tr>${hasTaxComps?taxComps.filter(c=>c.dispAmount>0).map(c=>`<tr><td style="color:#666;font-weight:600">${c.label}:</td><td style="text-align:right;font-family:monospace">${invCurrency} $${c.dispAmount.toFixed(2)}</td></tr>`).join(""):(fallbackTaxAmt>0?`<tr><td style="color:#666;font-weight:600">${fallbackTaxLabel}:</td><td style="text-align:right;font-family:monospace">${invCurrency} $${fallbackTaxAmt.toFixed(2)}</td></tr>`:``)}<tr class="total-row"><td>Total:</td><td style="text-align:right;font-family:monospace;color:#1e3a5f">${invCurrency} $${dispTotal.toFixed(2)}</td></tr></table>
${notesHtml}</body></html>`;
}
async function printInvoice(inv){const html=await buildInvoiceHTML(inv);const blob=new Blob([html],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const w=window.open(url,"_blank");if(w)setTimeout(()=>{w.print();},500);}
async function saveInvoicePDF(inv){if(!window.db)return false;const html=await buildInvoiceHTML(inv);try{const r=await window.db.generatePDF({html,filename:`${inv.invoiceNumber}.pdf`});return r?.success||false;}catch(e){console.error("PDF:",e);return false;}}

// ═══════ AR/AP DETAIL PAGE (per BL) ═══════
function ARAPDetailPage({job:initialJob,onBack}){
  const[job,setJob]=useState(initialJob);
  const[tab,setTab]=useState(initialJob.cbEnabled?"CB":"FF"); // CB or FF
  const[arLines,setArLines]=useState([]);
  const[apLines,setApLines]=useState([]);
  const[invoices,setInvoices]=useState([]);
  const[apRecords,setApRecords]=useState([]);
  const[payeeList,setPayeeList]=useState([]);
  const[showInvModal,setShowInvModal]=useState(false);
  const[viewInvoice,setViewInvoice]=useState(null);
  const[editInvoice,setEditInvoice]=useState(null); // for edit/reissue
  const[saving,setSaving]=useState(false);
  const[dirty,setDirty]=useState(false);

  // Custom code management
  const[showAddCode,setShowAddCode]=useState(null); // "ar" or "ap"
  const[newCodeCode,setNewCodeCode]=useState("");
  const[newCodeLabel,setNewCodeLabel]=useState("");
  const[customCodes,setCustomCodes]=useState([]);

  const allCodes=tab==="CB"?[...CB_CODES,...customCodes.filter(c=>c.type==="CB")]:[...FF_CODES,...customCodes.filter(c=>c.type==="FF")];

  const loadData=async()=>{
    if(!window.db)return;
    const fresh=await window.db.jobs.get(initialJob.id);
    if(fresh)setJob(fresh);
    const invs=await window.db.invoices.byJob(initialJob.id);setInvoices(invs||[]);
    const aps=await window.db.ap.byJob(initialJob.id);setApRecords(aps||[]);
    setPayeeList([...DB.payees]);
    // Load custom codes
    if(window.db.codes){const cc=await window.db.codes.list();setCustomCodes(cc||[]);}
  };
  useEffect(()=>{loadData();},[initialJob.id]);

  // Track job data version so effect re-runs after save
  const jobDataKey=JSON.stringify(tab==="CB"?job.cb:job.ff);

  // Initialize lines from job's cb/ff data
  useEffect(()=>{
    const charges=tab==="CB"?(job.cb||{}):(job.ff||{});
    const codes=tab==="CB"?[...CB_CODES,...customCodes.filter(c=>c.type==="CB")]:[...FF_CODES,...customCodes.filter(c=>c.type==="FF")];
    const ar=[];
    // Load existing AR charges saved in job
    for(const[key,val]of Object.entries(charges)){
      if(key.startsWith("_")||key.includes("_"))continue;
      const codeInfo=codes.find(c=>c.code===key)||{code:key,label:key};
      const currency=charges[key+"_cur"]||"CAD";
      const notes=charges[key+"_note"]||"";
      const disb=!!charges[key+"_disb"];
      const payee=charges[key+"_payee"]||"";
      const payments=charges[key+"_payments"]||[];
      const taxPaid=charges[key+"_taxPaid"]||0;
      const taxPaidComponents=charges[key+"_taxPaidComponents"]||[];
      const dueDate=charges[key+"_dueDate"]||"";
      const slipped=!!charges[key+"_slipped"];
      const vendorInvNum=charges[key+"_vendorInvNum"]||"";
      const vendorInvDate=charges[key+"_vendorInvDate"]||"";
      ar.push({code:codeInfo.code,label:codeInfo.label,amount:val,currency,notes,disb,payee,payments,taxPaid,taxPaidComponents,dueDate,slipped,vendorInvNum,vendorInvDate,locked:false});
    }
    // Sort AR lines by code definition order
    const codeOrder=codes.map(c=>c.code);
    ar.sort((a,b)=>{const ai=codeOrder.indexOf(a.code);const bi=codeOrder.indexOf(b.code);return(ai===-1?999:ai)-(bi===-1?999:bi);});
    setArLines(ar);
    // Load manual AP lines
    const manualAP=charges._manualAP||[];
    setApLines(manualAP.map(l=>{const codeInfo=codes.find(c=>c.code===l.code)||{code:l.code,label:l.label||l.code};return{...l,payments:l.payments||[],code:codeInfo.code,label:codeInfo.label};}));
    setDirty(false);
  },[tab,job.id,jobDataKey,customCodes.length]);

  // Add AR line
  const addARLine=(codeInfo)=>{
    if(arLines.some(l=>l.code===codeInfo.code))return;
    setArLines(p=>[...p,{code:codeInfo.code,label:codeInfo.label,amount:"",currency:"CAD",notes:"",disb:false,payee:"",payments:[],taxPaid:"",taxPaidComponents:[],dueDate:"",slipped:false,vendorInvNum:"",vendorInvDate:"",locked:false}]);setDirty(true);
  };
  // Add AP line
  const addAPLine=(codeInfo)=>{
    if(apLines.some(l=>l.code===codeInfo.code))return;
    setApLines(p=>[...p,{code:codeInfo.code,label:codeInfo.label,amount:"",currency:"CAD",notes:"",payee:"",payments:[],taxPaid:"",taxPaidComponents:[],dueDate:"",slipped:false,vendorInvNum:"",vendorInvDate:""}]);setDirty(true);
  };
  // Remove lines
  const removeARLine=i=>{setArLines(p=>p.filter((_,j)=>j!==i));setDirty(true);};
  const removeAPLine=i=>{setApLines(p=>p.filter((_,j)=>j!==i));setDirty(true);};
  // Update AR/AP line fields
  const updAR=(i,k,v)=>{setArLines(p=>p.map((l,j)=>j===i?{...l,[k]:v}:l));setDirty(true);};
  const updAP=(i,k,v)=>{setApLines(p=>p.map((l,j)=>j===i?{...l,[k]:v}:l));setDirty(true);};

  // Save charges back to job
  const saveCharges=async()=>{
    setSaving(true);
    const charges={};
    // Preserve existing shipping fields (_shipper, _cnee, _pol, etc.)
    const existing=tab==="CB"?(job.cb||{}):(job.ff||{});
    for(const[k,v]of Object.entries(existing)){
      if(k.startsWith("_")&&k!=="_manualAP")charges[k]=v;
    }
    // Save AR lines with disb/payee info
    for(const l of arLines){
      charges[l.code]=""+(l.amount||"0");
      charges[l.code+"_cur"]=l.currency;
      charges[l.code+"_note"]=l.notes||"";
      if(l.disb){charges[l.code+"_disb"]=true;charges[l.code+"_payee"]=l.payee||"";if(M.round(l.taxPaid))charges[l.code+"_taxPaid"]=M.round(l.taxPaid);if(l.taxPaidComponents&&l.taxPaidComponents.length>0)charges[l.code+"_taxPaidComponents"]=l.taxPaidComponents;if(l.dueDate)charges[l.code+"_dueDate"]=l.dueDate;if(l.slipped)charges[l.code+"_slipped"]=true;if(l.vendorInvNum)charges[l.code+"_vendorInvNum"]=l.vendorInvNum;if(l.vendorInvDate)charges[l.code+"_vendorInvDate"]=l.vendorInvDate;}
      if(l.payments&&l.payments.length>0)charges[l.code+"_payments"]=l.payments;
    }
    // Save manual AP lines (non-disb) — include payments and taxPaidComponents
    const manualAP=apLines.map(l=>({code:l.code,label:l.label,amount:l.amount,currency:l.currency,notes:l.notes,payee:l.payee,payments:l.payments||[],taxPaid:M.round(l.taxPaid),taxPaidComponents:l.taxPaidComponents||[],dueDate:l.dueDate||"",slipped:!!l.slipped,vendorInvNum:l.vendorInvNum||"",vendorInvDate:l.vendorInvDate||""}));
    charges._manualAP=manualAP;
    const update=tab==="CB"?{cb:charges}:{ff:charges};
    try{
      const updated=await dbUpdateJob(job.id,update);
      if(updated){setJob(updated);setDirty(false);await showAlert("Saved.");}
    }catch(e){await showAlert("Save error: "+e.message);}
    setSaving(false);
    // Reload fresh data from DB to ensure consistency
    await loadData();
  };

  // Add custom code
  const addCustomCode=async(type)=>{
    if(!newCodeCode||!newCodeLabel)return;
    const code=newCodeCode.toUpperCase();
    if(window.db?.codes){await window.db.codes.add({type,code,label:newCodeLabel});}
    setCustomCodes(p=>[...p,{type,code,label:newCodeLabel}]);
    setNewCodeCode("");setNewCodeLabel("");setShowAddCode(null);
  };

  // ── Invoice Generation ──
  const[invDate,setInvDate]=useState(new Date().toISOString().split("T")[0]);
  const[invDueDate,setInvDueDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()+30);return d.toISOString().split("T")[0];});
  const[invSelCodes,setInvSelCodes]=useState({});
  const[invProvince,setInvProvince]=useState("Ontario");
  const[invNoTax,setInvNoTax]=useState(false);
  const[invCustomTaxRate,setInvCustomTaxRate]=useState("");
  const[invCustomTaxLabel,setInvCustomTaxLabel]=useState("");
  const[invCustomTaxType,setInvCustomTaxType]=useState("GST");
  const{rate:fxRate,loading:fxLoading}=useFxRate(invDate);
  const[customFxRate,setCustomFxRate]=useState("");

  const invoicedCodes=useMemo(()=>{
    const m=new Map();
    const invField=tab==="CB"?"cbInvoices":"ffInvoices";
    const jobInvs=job[invField]||[];
    for(const inv of invoices){if(jobInvs.includes(inv.invoiceNumber)){(inv.invoicedCodes||[]).forEach(c=>{if(!m.has(c))m.set(c,inv.invoiceNumber);});}}
    return m;
  },[invoices,job,tab]);

  const availableForInvoice=arLines.filter(l=>M.round(l.amount)>0&&!invoicedCodes.has(l.code));

  const openInvoiceModal=()=>{
    const sel={};availableForInvoice.forEach(l=>{sel[l.code]=true;});
    setInvSelCodes(sel);setCustomFxRate("");setShowInvModal(true);
  };

  const generateInvoice=async(currency)=>{
    const selectedLines=availableForInvoice.filter(l=>invSelCodes[l.code]);
    if(selectedLines.length===0)return;
    setSaving(true);
    try{
      const effectiveRate=parseFloat(customFxRate)||fxRate||1;
      const invNum=await dbNextInvoiceNum(tab);
      const provTax=PROVINCE_TAX[invProvince]||{rate:0.13,label:"HST 13%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.08,label:"HST ON (8%)"}]};
      const tax=invNoTax?{rate:0,label:"No Tax",components:[]}:invCustomTaxRate?{rate:parseFloat(invCustomTaxRate)/100,label:invCustomTaxLabel||`${invCustomTaxType} ${invCustomTaxRate}%`,components:[{type:invCustomTaxType,rate:parseFloat(invCustomTaxRate)/100,label:invCustomTaxLabel||`${invCustomTaxType} Custom (${invCustomTaxRate}%)`}]}:provTax;
      // Store each item with its original currency and amount, plus CAD equivalent
      const items=selectedLines.map(l=>{
        const amt=M.round(l.amount);
        const cadAmt=l.currency==="USD"?M.mul(amt,effectiveRate):amt;
        return{code:l.code,label:l.label,originalAmount:amt,originalCurrency:l.currency,exchangeRate:effectiveRate,amount:cadAmt,remark:l.notes||""};
      });
      // Calculate subtotal in CAD for tax purposes (sum via cents)
      const subtotalCents=items.reduce((s,it)=>s+M.cents(it.amount),0);
      const subtotalCAD=subtotalCents/100;
      // Calculate each tax component via cents
      const taxComponents=(tax.components||[]).map(c=>({type:c.type,rate:c.rate,label:c.label,amount:M.mul(subtotalCAD,c.rate)}));
      const taxAmt=taxComponents.reduce((s,c)=>M.sum(s,c.amount),0);
      const totalCAD=M.sum(subtotalCAD,taxAmt);
      const invData={
        invoiceNumber:invNum,type:tab,customer:job.customer,province:invProvince,date:invDate,
        jobId:job.id,items,subtotal:subtotalCAD,taxAmount:taxAmt,total:totalCAD,taxLabel:tax.label,taxRate:tax.rate,taxComponents,
        displayFields:{},jobData:{bl:job.bl,mbl:job.mbl,hbl:job.hbl,shipper:job.shipper,cnee:job.cnee,pol:job.pol,pod:job.pod},
        payments:[],dueDate:invDueDate,invoicedCodes:selectedLines.map(l=>l.code),fxRate:effectiveRate||0,
        invoiceCurrency:currency
      };
      const invField=tab==="CB"?"cbInvoices":"ffInvoices";
      // Use transaction-wrapped call if available, otherwise fallback to separate calls
      if(window.db?.invoices?.createWithJob){
        const updated=await window.db.invoices.createWithJob({invoiceData:invData,jobId:job.id,jobUpdate:{[invField]:[...(job[invField]||[]),invNum]}});
        if(updated){const i=DB.jobs.findIndex(j=>j.id===job.id);if(i>=0)DB.jobs[i]=updated;setJob(updated);}
      } else {
        await dbAddInvoice(invData);
        const updated=await dbUpdateJob(job.id,{[invField]:[...(job[invField]||[]),invNum]});
        if(updated)setJob(updated);
      }
      setShowInvModal(false);await loadData();
      await showAlert(`Invoice ${invNum} generated (${currency}).`);
    }catch(e){await showAlert("Error: "+e.message);}
    setSaving(false);
  };

  // ── Code dropdown for adding ──
  const[arDropdown,setArDropdown]=useState(false);
  const[apDropdown,setApDropdown]=useState(false);
  const arDropRef=useRef(null);const apDropRef=useRef(null);
  useEffect(()=>{const h=e=>{if(arDropRef.current&&!arDropRef.current.contains(e.target))setArDropdown(false);if(apDropRef.current&&!apDropRef.current.contains(e.target))setApDropdown(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);

  const renderCodeDropdown=(side,ref,open,setOpen)=>{
    const existing=side==="ar"?arLines.map(l=>l.code):apLines.map(l=>l.code);
    const available=allCodes.filter(c=>!existing.includes(c.code));
    return(<div ref={ref} style={{position:"relative",display:"inline-block"}}>
      <Button variant="ghost" size="sm" onClick={()=>setOpen(!open)}>+ Add</Button>
      {open&&<div style={{position:"absolute",top:"100%",[side==="ap"?"right":"left"]:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:100,minWidth:220,maxHeight:300,overflow:"auto",marginTop:4}}>
        {available.length===0?<div style={{padding:12,fontSize:12,color:C.textMuted}}>All codes added</div>:available.map(c=><div key={c.code} onClick={()=>{side==="ar"?addARLine(c):addAPLine(c);setOpen(false);}} style={{padding:"8px 12px",cursor:"pointer",fontSize:12,display:"flex",justifyContent:"space-between",gap:8}} onMouseEnter={e=>e.currentTarget.style.background=C.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><span style={{fontFamily:F.mono,color:C.accent,fontWeight:600,fontSize:11}}>{c.code}</span><span style={{color:C.text}}>{c.label}</span></div>)}
        <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 12px"}}>
          <button onClick={()=>{setShowAddCode(side==="ar"?tab:tab);setOpen(false);}} style={{background:"none",border:"none",color:C.green,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:F.body}}>+ New Custom Code</button>
        </div>
      </div>}
    </div>);
  };

  // Payment status helper
  const payStatus=(amount,payments)=>{
    const total=M.round(amount);
    if(total<=0)return{status:"ACCRUED",color:C.purple,paid:0};
    const paid=(payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
    if(paid>=total)return{status:"REMITTED",color:C.green,paid};
    if(paid>0)return{status:"P REMITTED",color:C.orange,paid};
    return{status:"SLIPPED",color:C.blue,paid:0};
  };

  return(<div>
    <button onClick={async()=>{if(dirty&&!(await showConfirm("You have unsaved changes. Leave anyway?")))return;onBack();}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontFamily:F.body,fontSize:13,marginBottom:14,padding:0}}>← Back to BL List</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div><h2 style={{...S.pt,margin:0}}>AR / AP — {job.id}</h2><span style={{fontSize:12,color:C.textDim}}>{job.customer} • {job.bl||job.mbl||"No BL#"}</span></div>
      <div style={{display:"flex",gap:8}}>
        <Button onClick={saveCharges} disabled={saving}>{saving?"Saving...":"💾 Save"}</Button>
      </div>
    </div>

    {/* CB/FF tab selector */}
    <div style={{display:"flex",gap:8,marginBottom:20}}>
      {job.cbEnabled&&<button onClick={async()=>{if(tab==="CB")return;if(dirty&&!(await showConfirm("You have unsaved changes. Switch tab anyway?")))return;setTab("CB");}} style={{padding:"8px 20px",borderRadius:7,border:`2px solid ${tab==="CB"?C.accent:C.border}`,background:tab==="CB"?C.accentGlow:C.surface,color:tab==="CB"?C.accent:C.textDim,fontWeight:600,fontFamily:F.body,fontSize:13,cursor:"pointer"}}>CB — Customs Brokerage</button>}
      {job.ffEnabled&&<button onClick={async()=>{if(tab==="FF")return;if(dirty&&!(await showConfirm("You have unsaved changes. Switch tab anyway?")))return;setTab("FF");}} style={{padding:"8px 20px",borderRadius:7,border:`2px solid ${tab==="FF"?C.orange:C.border}`,background:tab==="FF"?`${C.orange}10`:C.surface,color:tab==="FF"?C.orange:C.textDim,fontWeight:600,fontFamily:F.body,fontSize:13,cursor:"pointer"}}>FF — Freight Forwarding</button>}
    </div>

    {/* AR | AP side by side */}
    <div style={{display:"flex",gap:20,alignItems:"flex-start",flexWrap:"wrap"}}>
      {/* ── AR (left) ── */}
      <div style={{flex:1,minWidth:320}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:F.display}}>AR (Receivable)</div>
          <div style={{display:"flex",gap:6}}>{renderCodeDropdown("ar",arDropRef,arDropdown,setArDropdown)}</div>
        </div>
        <div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,padding:12}}>
          {arLines.length===0?<div style={S.empty}>No AR items. Click + Add to start.</div>:arLines.map((l,i)=>{
            const isInvoiced=invoicedCodes.has(l.code);
            const isLocked=isInvoiced;
            return(<div key={l.code+i} style={{borderRadius:4,background:l.disb?`${C.orange}08`:isLocked?`${C.green}06`:"transparent",padding:l.disb?"6px 6px":"6px 0",borderBottom:i<arLines.length-1?`1px solid ${C.border}`:"none"}}>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontFamily:F.mono,fontSize:11,color:l.disb?C.orange:(tab==="CB"?C.accent:C.orange),fontWeight:600,width:36,flexShrink:0}}>{l.code}</span>
                <span style={{fontSize:11,color:C.textDim,width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{l.label}</span>
                {isLocked?<span style={{fontFamily:F.mono,fontSize:12,color:C.text,width:90,textAlign:"right"}}>{l.currency} {l.amount||"0.00"}</span>:(
                <><input value={l.amount} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))updAR(i,"amount",v);}} placeholder="0.00" style={{fontFamily:F.mono,fontSize:12,padding:"5px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,outline:"none",width:90,textAlign:"right"}}/>
                <select value={l.currency} onChange={e=>updAR(i,"currency",e.target.value)} style={{fontFamily:F.mono,fontSize:11,padding:"5px 4px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,width:56}}><option>CAD</option><option>USD</option></select></>)}
                {isLocked?null:<input value={l.notes||""} onChange={e=>updAR(i,"notes",e.target.value)} placeholder="notes..." style={{fontFamily:F.body,fontSize:11,padding:"5px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,flex:1,minWidth:50,color:C.textDim,outline:"none"}}/>}
                {!isInvoiced&&!isLocked&&<label style={{display:"flex",alignItems:"center",gap:3,cursor:"pointer",flexShrink:0}}><input type="checkbox" checked={!!l.disb} onChange={e=>{const checked=e.target.checked;updAR(i,"disb",checked);if(checked&&(!l.taxPaidComponents||l.taxPaidComponents.length===0)){const pk=getProfileKeyForProvince(job.province);const p=AP_TAX_PROFILES.find(pr=>pr.key===pk);if(p&&M.round(l.amount)>0)updAR(i,"taxPaidComponents",calcTaxComponents(p,l.amount));}}} style={{accentColor:C.orange,width:14,height:14}}/><span style={{fontSize:9,fontWeight:600,color:l.disb?C.orange:C.textMuted,textTransform:"uppercase",letterSpacing:".3px"}}>Disb</span></label>}
                {(()=>{const ps=payStatus(l.amount,l.payments);return ps.status?<span style={{fontSize:9,fontWeight:700,color:ps.color,padding:"2px 6px",borderRadius:4,border:`1px solid ${ps.color}30`,background:`${ps.color}10`}}>{ps.status}</span>:null;})()}
                
                {isInvoiced?<Badge color={C.green}>{invoicedCodes.get(l.code)||"Invoiced"}</Badge>:<button onClick={()=>removeARLine(i)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,fontWeight:700,padding:"0 4px"}}>×</button>}
              </div>
              {l.disb&&<><div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0 0 42px",flexWrap:"wrap"}}><span style={{fontSize:9,color:C.orange,fontWeight:600,flexShrink:0}}>→ Pay To:</span><select value={l.payee||""} onChange={e=>updAR(i,"payee",e.target.value)} style={{fontFamily:F.mono,fontSize:11,padding:"4px 6px",background:C.bg,border:`1px solid ${l.payee?C.orange+"40":C.red}`,borderRadius:5,color:C.text,outline:"none",flex:1,maxWidth:200}}><option value="">Select payee...</option>{payeeList.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select><span style={{fontSize:9,color:C.cyan,fontWeight:600,flexShrink:0,marginLeft:4}}>Due:</span><input type="date" value={l.dueDate||""} onChange={e=>updAR(i,"dueDate",e.target.value)} style={{fontFamily:F.mono,fontSize:10,padding:"3px 5px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,outline:"none",width:110}}/><span style={{fontSize:9,color:C.cyan,fontWeight:600,flexShrink:0,marginLeft:4}}>Tax:</span><TaxRateSelect amount={l.amount} value={l.taxPaidComponents} onChange={v=>updAR(i,"taxPaidComponents",v)} compact/></div>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"2px 0 0 42px",flexWrap:"wrap"}}><span style={{fontSize:9,color:C.textDim,fontWeight:600,flexShrink:0}}>Vendor Inv#:</span><input value={l.vendorInvNum||""} onChange={e=>updAR(i,"vendorInvNum",e.target.value)} placeholder="INV-0000" style={{fontFamily:F.mono,fontSize:10,padding:"3px 5px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,outline:"none",width:110}}/><span style={{fontSize:9,color:C.textDim,fontWeight:600,flexShrink:0,marginLeft:4}}>Inv Date:</span><input type="date" value={l.vendorInvDate||""} onChange={e=>updAR(i,"vendorInvDate",e.target.value)} style={{fontFamily:F.mono,fontSize:10,padding:"3px 5px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,outline:"none",width:110}}/></div></>}
            </div>);
          })}
        </div>
      </div>

      {/* ── AP (right) ── */}
      <div style={{flex:1,minWidth:320}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:F.display}}>AP (Payable)</div>
          {renderCodeDropdown("ap",apDropRef,apDropdown,setApDropdown)}
        </div>
        <div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,padding:12}}>
          {/* Disb-mirrored lines from AR (read-only) */}
          {arLines.filter(l=>l.disb).map((l,i)=>{
            const ps=payStatus(l.amount,l.payments);
            return(<div key={"disb-"+l.code+i} style={{display:"flex",gap:6,alignItems:"center",padding:"6px 6px",borderBottom:`1px solid ${C.border}`,background:`${C.orange}06`,borderRadius:4,marginBottom:4}}>
              <span style={{fontFamily:F.mono,fontSize:11,color:C.orange,fontWeight:600,width:36,flexShrink:0}}>{l.code}</span>
              <span style={{fontSize:11,color:C.textDim,width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{l.label}</span>
              <span style={{fontFamily:F.mono,fontSize:12,color:C.text,width:90,textAlign:"right"}}>{l.currency} {l.amount||"0.00"}</span>
              <span style={{fontSize:11,color:C.orange,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>→ {l.payee||"(no payee)"}</span>
              {ps.status&&<span style={{fontSize:9,fontWeight:700,color:ps.color,padding:"2px 6px",borderRadius:4,border:`1px solid ${ps.color}30`,background:`${ps.color}10`}}>{ps.status}</span>}
              
              <Badge color={C.orange} style={{fontSize:9}}>Disb</Badge>
            </div>);
          })}
          {/* Manual AP lines */}
          {apLines.length===0&&arLines.filter(l=>l.disb).length===0?<div style={S.empty}>No AP items.</div>:apLines.map((l,i)=>(<React.Fragment key={l.code+i}>
            <div style={{display:"flex",gap:6,alignItems:"center",padding:"6px 0",borderBottom:i<apLines.length-1?`1px solid ${C.border}`:"none",flexWrap:"wrap"}}>
              <span style={{fontFamily:F.mono,fontSize:11,color:C.orange,fontWeight:600,width:36,flexShrink:0}}>{l.code}</span>
              <span style={{fontSize:11,color:C.textDim,width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{l.label}</span>
              <input value={l.amount} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))updAP(i,"amount",v);}} placeholder="0.00" style={{fontFamily:F.mono,fontSize:12,padding:"5px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,outline:"none",width:90,textAlign:"right"}}/>
              <select value={l.currency} onChange={e=>updAP(i,"currency",e.target.value)} style={{fontFamily:F.mono,fontSize:11,padding:"5px 4px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,width:56}}><option>CAD</option><option>USD</option></select>
              <input value={l.notes||""} onChange={e=>updAP(i,"notes",e.target.value)} placeholder="notes..." style={{fontFamily:F.body,fontSize:11,padding:"5px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,flex:1,minWidth:50,color:C.textDim,outline:"none"}}/>
              <select value={l.payee||""} onChange={e=>updAP(i,"payee",e.target.value)} style={{fontFamily:F.mono,fontSize:11,padding:"5px 6px",background:C.bg,border:`1px solid ${l.payee?C.orange+"40":C.border}`,borderRadius:5,minWidth:120,maxWidth:160}}><option value="">Payee...</option>{payeeList.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select>
              <span style={{fontSize:9,color:C.textDim,fontWeight:600,flexShrink:0}}>Due:</span><input type="date" value={l.dueDate||""} onChange={e=>updAP(i,"dueDate",e.target.value)} style={{fontFamily:F.mono,fontSize:10,padding:"3px 5px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,outline:"none",width:110}}/>
              <span style={{fontSize:9,color:C.cyan,fontWeight:600,flexShrink:0}}>Tax:</span><TaxRateSelect amount={l.amount} value={l.taxPaidComponents} onChange={v=>updAP(i,"taxPaidComponents",v)} compact/>
              {(()=>{const ps=payStatus(l.amount,l.payments);return ps.status?<span style={{fontSize:9,fontWeight:700,color:ps.color,padding:"2px 6px",borderRadius:4,border:`1px solid ${ps.color}30`,background:`${ps.color}10`}}>{ps.status}</span>:null;})()}
              <button onClick={()=>removeAPLine(i)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,fontWeight:700,padding:"0 4px"}}>×</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"2px 0 0 8px",flexWrap:"wrap"}}>
              <span style={{fontSize:9,color:C.textDim,fontWeight:600,flexShrink:0}}>Vendor Inv#:</span><input value={l.vendorInvNum||""} onChange={e=>updAP(i,"vendorInvNum",e.target.value)} placeholder="INV-0000" style={{fontFamily:F.mono,fontSize:10,padding:"3px 5px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,outline:"none",width:110}}/>
              <span style={{fontSize:9,color:C.textDim,fontWeight:600,flexShrink:0,marginLeft:4}}>Inv Date:</span><input type="date" value={l.vendorInvDate||""} onChange={e=>updAP(i,"vendorInvDate",e.target.value)} style={{fontFamily:F.mono,fontSize:10,padding:"3px 5px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,outline:"none",width:110}}/>
            </div>
          </React.Fragment>))}
        </div>
        {/* AP records from DB */}
        {apRecords.filter(a=>a.type!=="General").length>0&&<div style={{marginTop:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:8}}>AP Records</div>
          {apRecords.filter(a=>a.type!=="General").map(ap=>(
            <div key={ap.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:C.card,borderRadius:6,border:`1px solid ${C.border}`,marginBottom:6}}>
              <div><span style={{fontFamily:F.mono,fontSize:12,color:C.orange,fontWeight:600}}>{ap.id}</span><span style={{fontSize:11,color:C.textDim,marginLeft:8}}>{ap.payee}</span><span style={{fontSize:11,color:C.textMuted,marginLeft:8}}>{ap.invoiceNum}</span></div>
              <span style={{fontFamily:F.mono,fontSize:12,color:C.text}}>{ap.currency||"CAD"} ${(ap.total||0).toFixed(2)}</span>
            </div>
          ))}
        </div>}
      </div>
    </div>


  </div>);
}

// ═══════ BL DETAIL / EDIT PAGE ═══════
function BLDetailPage({job:initialJob,onBack}){
  const[job,setJob]=useState(initialJob);
  const[form,setForm]=useState({});
  const[ffContainers,setFfContainers]=useState([{cntr:"",size:"20",seal:""}]);
  const[saving,setSaving]=useState(false);
  const[customerList,setCustomerList]=useState([...DB.customers]);

  // Fetch fresh data on mount
  useEffect(()=>{(async()=>{if(window.db){const fresh=await window.db.jobs.get(initialJob.id);if(fresh)setJob(fresh);}})();},[initialJob.id]);

  useEffect(()=>{
    const j=job;
    setForm({customer:j.customer||"",cbEnabled:!!j.cbEnabled,ffEnabled:!!j.ffEnabled,
      cb_bl:j.bl||"",cb_shipper:j.cb?._shipper||j.shipper||"",cb_cnee:j.cb?._cnee||j.cnee||"",cb_ior:j.ior||"",cb_ccn:j.ccn||"",cb_transaction:j.transaction||"",
      cb_pol:j.cb?._pol||j.pol||"",cb_polAtd:j.cb?._polAtd||j.polAtd||"",cb_pod:j.cb?._pod||j.pod||"",cb_podEta:j.cb?._podEta||j.podEta||"",cb_remark:j.remark||"",
      ff_mbl:j.mbl||"",ff_hbl:j.hbl||"",ff_shipper:j.ff?._shipper||j.shipper||"",ff_cnee:j.ff?._cnee||j.cnee||"",
      ff_pol:j.ff?._pol||j.pol||"",ff_polAtd:j.ff?._polAtd||j.polAtd||"",ff_pod:j.ff?._pod||j.pod||"",ff_podEta:j.ff?._podEta||j.podEta||"",
      ff_quantity:j.quantity||"",ff_quantityUom:j.quantityUom||"PLT",ff_weight:j.weight||"",ff_volume:j.volume||"",ff_remark:j.ff?._remark||j.remark||""
    });
    // Parse containers (with seal)
    const cntrs=(j.cntr||"").split(",").map(s=>s.trim()).filter(Boolean);
    const sizes=(j.size||"").split(",").map(s=>s.trim());
    const seals=(j.seal||"").split(",").map(s=>s.trim());
    if(cntrs.length>0)setFfContainers(cntrs.map((c,i)=>({cntr:c,size:sizes[i]||"20",seal:seals[i]||""})));
    else setFfContainers([{cntr:"",size:"20",seal:""}]);
  },[job]);

  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const addContainer=()=>setFfContainers(p=>[...p,{cntr:"",size:"20",seal:""}]);
  const updContainer=(i,k,v)=>setFfContainers(p=>p.map((c,j)=>j===i?{...c,[k]:v}:c));
  const delContainer=i=>setFfContainers(p=>p.length<=1?p:p.filter((_,j)=>j!==i));

  const save=async()=>{
    setSaving(true);
    try{
      const cntrStr=ffContainers.map(c=>c.cntr).filter(Boolean).join(", ");
      const sizeStr=ffContainers.map(c=>c.size).join(", ");
      const sealStr=ffContainers.map(c=>c.seal||"").join(", ");
      const d={customer:form.customer,cbEnabled:form.cbEnabled,ffEnabled:form.ffEnabled,
        bl:form.cb_bl,ior:form.cb_ior,ccn:form.cb_ccn,transaction:form.cb_transaction,
        mbl:form.ff_mbl,hbl:form.ff_hbl,cntr:cntrStr,size:sizeStr,seal:sealStr,
        quantity:form.ff_quantity,quantityUom:form.ff_quantityUom,weight:form.ff_weight,volume:form.ff_volume,
        shipper:form.cbEnabled?form.cb_shipper:form.ff_shipper,cnee:form.cbEnabled?form.cb_cnee:form.ff_cnee,
        pol:form.cbEnabled?form.cb_pol:form.ff_pol,polAtd:form.cbEnabled?form.cb_polAtd:form.ff_polAtd,
        pod:form.cbEnabled?form.cb_pod:form.ff_pod,podEta:form.cbEnabled?form.cb_podEta:form.ff_podEta,
        remark:form.cbEnabled?form.cb_remark:form.ff_remark,
        cb:{...(job.cb||{}),_shipper:form.cb_shipper,_cnee:form.cb_cnee,_pol:form.cb_pol,_polAtd:form.cb_polAtd,_pod:form.cb_pod,_podEta:form.cb_podEta},
        ff:{...(job.ff||{}),_shipper:form.ff_shipper,_cnee:form.ff_cnee,_pol:form.ff_pol,_polAtd:form.ff_polAtd,_pod:form.ff_pod,_podEta:form.ff_podEta,_remark:form.ff_remark}
      };
      const updated=await dbUpdateJob(job.id,d);if(updated)setJob(updated);
      await showAlert("Saved.");
    }catch(e){await showAlert("Error: "+e.message);}
    setSaving(false);
  };

  return(<div style={{maxWidth:860}}>
    <button onClick={onBack} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontFamily:F.body,fontSize:13,marginBottom:14,padding:0}}>← Back to BL List</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{...S.pt,margin:0}}>📋 BL Detail — {job.id}</h2>
      <Button onClick={save} disabled={saving}>{saving?"Saving...":"💾 Save"}</Button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:16}}>
      <ValidatedAutoComplete items={customerList} value={form.customer} onSelect={v=>upd("customer",v)} label="Customer" placeholder="Select customer..."/>
    </div>
    <div style={{display:"flex",gap:20,marginBottom:20}}>
      <Checkbox label="CB (Customs Brokerage)" checked={form.cbEnabled} onChange={v=>upd("cbEnabled",v)} color={C.accent}/>
      <Checkbox label="FF (Freight Forwarding)" checked={form.ffEnabled} onChange={v=>upd("ffEnabled",v)} color={C.orange}/>
    </div>
    {form.cbEnabled&&<div style={{background:`${C.accent}06`,borderRadius:8,border:`1px solid ${C.accent}20`,padding:16,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,fontFamily:F.display,marginBottom:12}}>CB — Customs Brokerage</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
        <Input label="BL #" value={form.cb_bl||""} onChange={v=>upd("cb_bl",v)}/><Input label="Shipper" value={form.cb_shipper||""} onChange={v=>upd("cb_shipper",v)}/><Input label="CNEE" value={form.cb_cnee||""} onChange={v=>upd("cb_cnee",v)}/>
        <Input label="IOR" value={form.cb_ior||""} onChange={v=>upd("cb_ior",v)}/><Input label="CCN #" value={form.cb_ccn||""} onChange={v=>upd("cb_ccn",v)}/><Input label="Transaction #" value={form.cb_transaction||""} onChange={v=>upd("cb_transaction",v)}/>
        <Input label="POL" value={form.cb_pol||""} onChange={v=>upd("cb_pol",v)}/><Input label="POL ATD" type="date" value={form.cb_polAtd||""} onChange={v=>upd("cb_polAtd",v)}/><Input label="POD" value={form.cb_pod||""} onChange={v=>upd("cb_pod",v)}/>
        <Input label="POD ETA" type="date" value={form.cb_podEta||""} onChange={v=>upd("cb_podEta",v)}/><Input label="Remark" value={form.cb_remark||""} onChange={v=>upd("cb_remark",v)} style={{gridColumn:"span 2"}}/>
      </div>
    </div>}
    {form.ffEnabled&&<div style={{background:`${C.orange}06`,borderRadius:8,border:`1px solid ${C.orange}20`,padding:16,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:C.orange,fontFamily:F.display,marginBottom:12}}>FF — Freight Forwarding</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
        <Input label="MBL #" value={form.ff_mbl||""} onChange={v=>upd("ff_mbl",v)}/><Input label="HBL #" value={form.ff_hbl||""} onChange={v=>upd("ff_hbl",v)}/><Input label="Shipper" value={form.ff_shipper||""} onChange={v=>upd("ff_shipper",v)}/>
        <Input label="CNEE" value={form.ff_cnee||""} onChange={v=>upd("ff_cnee",v)}/><Input label="POL" value={form.ff_pol||""} onChange={v=>upd("ff_pol",v)}/><Input label="POL ATD" type="date" value={form.ff_polAtd||""} onChange={v=>upd("ff_polAtd",v)}/>
        <Input label="POD" value={form.ff_pod||""} onChange={v=>upd("ff_pod",v)}/><Input label="POD ETA" type="date" value={form.ff_podEta||""} onChange={v=>upd("ff_podEta",v)}/><Input label="Quantity" value={form.ff_quantity||""} onChange={v=>upd("ff_quantity",v)} inputMode="numeric"/>
        <Select label="Qty UOM" value={form.ff_quantityUom||"PLT"} onChange={v=>upd("ff_quantityUom",v)} options={UOM_OPTS}/><Input label="Weight (kg)" value={form.ff_weight||""} onChange={v=>upd("ff_weight",v)} inputMode="numeric"/><Input label="Volume (CBM)" value={form.ff_volume||""} onChange={v=>upd("ff_volume",v)} inputMode="numeric"/>
      </div>
      <div style={{marginTop:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><label style={S.label}>Containers</label><Button variant="ghost" size="sm" onClick={addContainer}>+ Add Container</Button></div>
        {ffContainers.map((c,i)=>(<div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
          <input value={c.cntr} onChange={e=>updContainer(i,"cntr",e.target.value)} placeholder={`Container #${i+1}`} style={{fontFamily:F.mono,fontSize:13,padding:"7px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",flex:1}}/>
          <select value={c.size} onChange={e=>updContainer(i,"size",e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"7px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,width:80}}>{SIZE_OPTS.map(s=><option key={s}>{s}</option>)}</select>
          <input value={c.seal||""} onChange={e=>updContainer(i,"seal",e.target.value)} placeholder="Seal #" style={{fontFamily:F.mono,fontSize:12,padding:"7px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",width:120}}/>
          {ffContainers.length>1&&<button onClick={()=>delContainer(i)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16,fontWeight:700}}>×</button>}
        </div>))}
      </div>
      <Input label="Remark" value={form.ff_remark||""} onChange={v=>upd("ff_remark",v)} style={{marginTop:10}}/>
    </div>}
  </div>);
}

// ═══════ SETTLEMENT PAGE ═══════
function SettlementPage({onOpenARAP}){
  const[tab,setTab]=useState("AR");
  const[jobs,setJobs]=useState([]);const[invoices,setInvoices]=useState([]);
  const[loading,setLoading]=useState(false);const[totalJobCount,setTotalJobCount]=useState(0);
  const[customerList,setCustomerList]=useState([]);const[payeeList,setPayeeList]=useState([]);
  const[searchEntity,setSearchEntity]=useState("");const dSearchEntity=useDebounce(searchEntity);
  const[filterStatus,setFilterStatus]=useState("");
  const[createdFrom,setCreatedFrom]=useState(()=>{const d=new Date();return d.toISOString().slice(0,8)+"01";});
  const[createdTo,setCreatedTo]=useState(()=>new Date().toISOString().slice(0,10));
  const[sPage,setSPage]=useState(1);const S_PAGE_SIZE=200;
  const[selected,setSelected]=useState(new Set());
  // Invoice generation
  const[showInvModal,setShowInvModal]=useState(false);
  const[invDate,setInvDate]=useState(new Date().toISOString().split("T")[0]);
  const[invDueDate,setInvDueDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()+30);return d.toISOString().split("T")[0];});
  const[invProvince,setInvProvince]=useState("Ontario");
  const[invNoTax,setInvNoTax]=useState(false);
  const[invCustomTaxRate,setInvCustomTaxRate]=useState("");const[invCustomTaxLabel,setInvCustomTaxLabel]=useState("");const[invCustomTaxType,setInvCustomTaxType]=useState("GST");
  const{rate:fxRate,loading:fxLoading}=useFxRate(invDate);const[customFxRate,setCustomFxRate]=useState("");
  const[saving,setSaving]=useState(false);
  // View invoice
  const[viewInvoice,setViewInvoice]=useState(null);
  // Consolidation
  const[selectedInvs,setSelectedInvs]=useState(new Set());
  const toggleInvSelect=(num)=>setSelectedInvs(p=>{const n=new Set(p);n.has(num)?n.delete(num):n.add(num);return n;});
  // Payment
  const[payModal,setPayModal]=useState(null);const[payAmt,setPayAmt]=useState("");const[payDate,setPayDate]=useState(new Date().toISOString().split("T")[0]);const[payNote,setPayNote]=useState("");

  const load=async()=>{
    if(!window.db)return;
    setCustomerList([...DB.customers]);setPayeeList([...DB.payees]);
    setLoading(true);
    try{
      const search=dSearchEntity||"";
      const offset=(sPage-1)*S_PAGE_SIZE;
      const allJobs=await window.db.jobs.list({limit:S_PAGE_SIZE,offset,search,createdFrom,createdTo});
      const count=await window.db.jobs.count({search,createdFrom,createdTo});
      let filtered=allJobs||[];
      if(tab==="AR"&&dSearchEntity)filtered=filtered.filter(j=>j.customer.toLowerCase().includes(dSearchEntity.toLowerCase()));
      setTotalJobCount(count||0);
      const allInv=await window.db.invoices.list({limit:9999,offset:0});
      if(tab==="AR"){
        const custSet=new Set(filtered.map(j=>j.customer));
        setInvoices((allInv||[]).filter(i=>custSet.has(i.customer)));
      } else {
        setInvoices(allInv||[]);
      }
      setJobs(filtered);
    }catch(e){await showAlert("Load error: "+e.message);}
    setLoading(false);
  };
  useEffect(()=>{setSPage(1);},[dSearchEntity,tab,createdFrom,createdTo]);
  useEffect(()=>{load();},[dSearchEntity,tab,createdFrom,createdTo,sPage]);

  // ── Extract all AR lines across all jobs ──
  const arLines=useMemo(()=>{
    const lines=[];
    for(const job of jobs){
      const proc=(charges,type)=>{
        if(!charges)return;
        for(const[key,val]of Object.entries(charges)){
          if(key.startsWith("_")||key.includes("_"))continue;
          const amt=M.round(val);if(amt<=0)continue;
          const cur=charges[key+"_cur"]||"CAD";const notes=charges[key+"_note"]||"";
          const disb=!!charges[key+"_disb"];
          lines.push({jobId:job.id,bl:job.bl||job.mbl||"",customer:job.customer,province:job.province||"Ontario",createdAt:job.createdAt,code:key,label:key,amount:amt,currency:cur,notes,disb,type});
        }
      };
      if(job.cbEnabled)proc(job.cb,"CB");
      if(job.ffEnabled)proc(job.ff,"FF");
    }
    return lines;
  },[jobs]);

  // ── Map each AR line to its invoice ──
  const arWithInvoice=useMemo(()=>{
    const invMap={};
    for(const inv of invoices){
      // Map by main jobId + invoicedCodes
      for(const code of (inv.invoicedCodes||[])){
        const key=inv.jobId+"|"+code;
        if(!invMap[key])invMap[key]=inv;
      }
      // Also map by per-item jobId for multi-BL invoices
      for(const item of (inv.items||[])){
        if(item.jobId&&item.code){const key=item.jobId+"|"+item.code;if(!invMap[key])invMap[key]=inv;}
      }
    }
    return arLines.map(l=>{
      const inv=invMap[l.jobId+"|"+l.code];
      let status="ACCRUED",color=C.purple;
      if(inv){
        const paid=(inv.payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
        if(paid>=inv.total){status="REMITTED";color=C.green;}
        else if(paid>0){status="P REMITTED";color=C.orange;}
        else{status="SLIPPED";color=C.blue;}
      }
      return{...l,invoice:inv||null,invNum:inv?.invoiceNumber||null,status,color};
    });
  },[arLines,invoices]);

  // ── Extract all AP lines across all jobs ──
  const apLines=useMemo(()=>{
    const lines=[];
    for(const job of jobs){
      const proc=(charges,type)=>{
        if(!charges)return;
        for(const[key,val]of Object.entries(charges)){
          if(key.startsWith("_")||key.includes("_"))continue;
          if(!charges[key+"_disb"])continue;
          const amt=M.round(val);if(amt<=0)continue;
          const payee=charges[key+"_payee"]||"";const cur=charges[key+"_cur"]||"CAD";
          const payments=charges[key+"_payments"]||[];const dueDate=charges[key+"_dueDate"]||"";
          const slipped=!!charges[key+"_slipped"];
          const paid=payments.reduce((s,p)=>M.sum(s,p.amount),0);
          let status="ACCRUED",color=C.purple;
          if(paid>=amt){status="REMITTED";color=C.green;}
          else if(paid>0){status="P REMITTED";color=C.orange;}
          else if(slipped){status="SLIPPED";color=C.blue;}
          lines.push({jobId:job.id,bl:job.bl||job.mbl||"",customer:job.customer,code:key,label:key,amount:amt,currency:cur,payee,payments,dueDate,slipped,status,color,type,paid});
        }
        // Manual AP
        for(const l of (charges._manualAP||[])){
          const amt=M.round(l.amount);if(amt<=0)continue;
          const payments=l.payments||[];const paid=payments.reduce((s,p)=>M.sum(s,p.amount),0);
          const slipped=!!l.slipped;
          let status="ACCRUED",color=C.purple;
          if(paid>=amt){status="REMITTED";color=C.green;}
          else if(paid>0){status="P REMITTED";color=C.orange;}
          else if(slipped){status="SLIPPED";color=C.blue;}
          lines.push({jobId:job.id,bl:job.bl||job.mbl||"",customer:job.customer,code:l.code,label:l.label||l.code,amount:amt,currency:l.currency||"CAD",payee:l.payee||"",payments,dueDate:l.dueDate||"",slipped,status,color,type:"AP",paid});
        }
      };
      if(job.cbEnabled)proc(job.cb,"CB");
      if(job.ffEnabled)proc(job.ff,"FF");
    }
    return lines;
  },[jobs]);

  // ── Filtered lines ──
  const filteredAR=arWithInvoice.filter(l=>{
    if(dSearchEntity&&!l.customer.toLowerCase().includes(dSearchEntity.toLowerCase()))return false;
    if(filterStatus&&l.status!==filterStatus)return false;
    return true;
  });
  const filteredAP=apLines.filter(l=>{
    if(dSearchEntity&&!l.payee.toLowerCase().includes(dSearchEntity.toLowerCase()))return false;
    if(filterStatus&&l.status!==filterStatus)return false;
    return true;
  });

  // ── Group ──
  const groupBy=(arr,key)=>{const m={};arr.forEach(l=>{const k=l[key]||"Unknown";if(!m[k])m[k]=[];m[k].push(l);});return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0]));};
  const groupByJob=(lines)=>{const m={};lines.forEach(l=>{const k=l.jobId||"?";if(!m[k])m[k]=[];m[k].push(l);});return Object.entries(m);};
  const arGroups=groupBy(filteredAR,"customer");
  const apGroups=groupBy(filteredAP,"payee");

  // ── Selection ──
  const toggleSelect=(lineKey)=>setSelected(p=>{const n=new Set(p);n.has(lineKey)?n.delete(lineKey):n.add(lineKey);return n;});
  const lineKey=l=>l.jobId+"|"+l.code+"|"+(l.type||"");

  // ── Aging helper ──
  const ageBucket=d=>{if(!d)return"No Date";const n=daysSince(d);return n<=30?"Current":n<=60?"31-60":n<=90?"61-90":"90+";};
  const ageColor=b=>b==="Current"?C.green:b==="31-60"?C.orange:b==="61-90"?C.red:b==="90+"?C.purple:C.textMuted;

  // ── Invoice generation from selected AR lines ──
  const selectedARLines=filteredAR.filter(l=>selected.has(lineKey(l))&&l.status==="ACCRUED");
  const canGenerate=selectedARLines.length>0&&new Set(selectedARLines.map(l=>l.customer)).size===1;

  // ── Outstanding invoices per customer (for consolidation) ──
  const outstandingInvByCustomer=useMemo(()=>{
    const m={};
    for(const inv of invoices){
      if(inv.consolidatedInto)continue; // skip already consolidated
      const paid=(inv.payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
      if(paid>=inv.total)continue; // fully paid
      if(!m[inv.customer])m[inv.customer]=[];
      m[inv.customer].push({...inv,paid,balance:M.sub(inv.total,paid)});
    }
    return m;
  },[invoices]);

  // ── Consolidation ──
  const selectedConsolidateInvs=useMemo(()=>{
    return invoices.filter(inv=>selectedInvs.has(inv.invoiceNumber));
  },[invoices,selectedInvs]);
  const canConsolidate=selectedConsolidateInvs.length>=2&&new Set(selectedConsolidateInvs.map(i=>i.customer)).size===1;

  const consolidateInvoices=async()=>{
    if(!canConsolidate)return;
    setSaving(true);
    try{
      const customer=selectedConsolidateInvs[0].customer;
      const tabType=selectedConsolidateInvs[0].type||"FF";
      const newNum=await dbNextInvoiceNum(tabType);
      // Merge all items, sum totals
      const allItems=[];let totalSub=0,totalTax=0,totalAmt=0;
      const mergedTaxMap={};
      for(const inv of selectedConsolidateInvs){
        for(const it of (inv.items||[])){allItems.push({...it,jobId:it.jobId||inv.jobId,sourceInvoice:inv.invoiceNumber});}
        totalSub=M.sum(totalSub,inv.subtotal);totalTax=M.sum(totalTax,inv.taxAmount);totalAmt=M.sum(totalAmt,inv.total);
        for(const tc of (inv.taxComponents||[])){
          if(!mergedTaxMap[tc.label])mergedTaxMap[tc.label]={...tc,amount:0};
          mergedTaxMap[tc.label].amount=M.sum(mergedTaxMap[tc.label].amount,tc.amount);
        }
      }
      // Carry forward any existing payments from source invoices
      const allPayments=[];
      for(const inv of selectedConsolidateInvs){for(const p of (inv.payments||[]))allPayments.push({...p,sourceInvoice:inv.invoiceNumber});}
      const newInv={
        invoiceNumber:newNum,type:tabType,customer,province:selectedConsolidateInvs[0].province||"Ontario",
        date:new Date().toISOString().split("T")[0],
        jobId:selectedConsolidateInvs[0].jobId,items:allItems,subtotal:totalSub,taxAmount:totalTax,total:totalAmt,
        taxLabel:"Consolidated",taxRate:0,taxComponents:Object.values(mergedTaxMap),
        displayFields:{},jobData:{},payments:allPayments,
        dueDate:invDueDate,invoicedCodes:allItems.map(it=>it.code),fxRate:selectedConsolidateInvs[0].fxRate||0,
        invoiceCurrency:selectedConsolidateInvs[0].invoiceCurrency||"CAD",
        consolidatedFrom:selectedConsolidateInvs.map(i=>i.invoiceNumber)
      };
      await dbAddInvoice(newInv);
      // Mark source invoices as consolidated
      for(const inv of selectedConsolidateInvs){
        await window.db.invoices.update(inv.invoiceNumber,{consolidatedInto:newNum});
      }
      // Update job cbInvoices/ffInvoices to include new number
      const jobIds=[...new Set(allItems.map(it=>it.jobId).filter(Boolean))];
      for(const jId of jobIds){
        const j=jobs.find(x=>x.id===jId);if(!j)continue;
        const field=tabType==="CB"?"cbInvoices":"ffInvoices";
        const existing=j[field]||[];
        if(!existing.includes(newNum))await dbUpdateJob(jId,{[field]:[...existing,newNum]});
      }
      setSelectedInvs(new Set());await load();
      await showAlert(`Consolidated ${selectedConsolidateInvs.length} invoices into ${newNum} (${fmt(totalAmt)}).`);
    }catch(e){await showAlert("Error: "+e.message);}
    setSaving(false);
  };

  const generateInvoice=async()=>{
    if(!canGenerate)return;
    setSaving(true);
    try{
      const customer=selectedARLines[0].customer;const province=selectedARLines[0].province;
      const effectiveRate=parseFloat(customFxRate)||fxRate||1;
      const provTax=PROVINCE_TAX[invProvince]||{rate:0.13,label:"HST 13%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.08,label:"HST ON (8%)"}]};
      const tax=invNoTax?{rate:0,label:"No Tax",components:[]}:invCustomTaxRate?{rate:parseFloat(invCustomTaxRate)/100,label:invCustomTaxLabel||`${invCustomTaxType} ${invCustomTaxRate}%`,components:[{type:invCustomTaxType,rate:parseFloat(invCustomTaxRate)/100,label:invCustomTaxLabel||`${invCustomTaxType} Custom (${invCustomTaxRate}%)`}]}:provTax;
      // Determine tab type from first line
      const tabType=selectedARLines[0].type||"FF";
      const invNum=await dbNextInvoiceNum(tabType);
      const items=selectedARLines.map(l=>{
        const cadAmt=l.currency==="USD"?M.mul(l.amount,effectiveRate):l.amount;
        return{code:l.code,label:l.label,originalAmount:l.amount,originalCurrency:l.currency,exchangeRate:effectiveRate,amount:cadAmt,remark:l.notes||"",jobId:l.jobId};
      });
      const subtotalCents=items.reduce((s,it)=>s+M.cents(it.amount),0);const subtotalCAD=subtotalCents/100;
      const taxComponents=(tax.components||[]).map(c=>({type:c.type,rate:c.rate,label:c.label,amount:M.mul(subtotalCAD,c.rate)}));
      const taxAmt=taxComponents.reduce((s,c)=>M.sum(s,c.amount),0);const totalCAD=M.sum(subtotalCAD,taxAmt);
      const invData={
        invoiceNumber:invNum,type:tabType,customer,province:invProvince,date:invDate,
        jobId:selectedARLines[0].jobId,items,subtotal:subtotalCAD,taxAmount:taxAmt,total:totalCAD,
        taxLabel:tax.label,taxRate:tax.rate,taxComponents,
        displayFields:{},jobData:{},
        payments:[],dueDate:invDueDate,invoicedCodes:selectedARLines.map(l=>l.code),fxRate:effectiveRate||0,
        invoiceCurrency:"CAD"
      };
      // Save invoice and update each job's cbInvoices/ffInvoices
      await dbAddInvoice(invData);
      const jobIds=[...new Set(selectedARLines.map(l=>l.jobId))];
      for(const jId of jobIds){
        const j=jobs.find(x=>x.id===jId);if(!j)continue;
        const field=tabType==="CB"?"cbInvoices":"ffInvoices";
        await dbUpdateJob(jId,{[field]:[...(j[field]||[]),invNum]});
      }
      setShowInvModal(false);setSelected(new Set());await load();
      await showAlert(`Invoice ${invNum} generated — ${selectedARLines.length} lines, total ${totalCAD.toFixed(2)} CAD.`);
    }catch(e){await showAlert("Error: "+e.message);}
    setSaving(false);
  };

  // ── Invoice payment ──
  const openInvPayModal=(inv)=>{
    setPayModal({type:"invoice",inv,payments:inv.payments||[]});
    setPayDate(new Date().toISOString().split("T")[0]);setPayAmt("");setPayNote("");
  };
  const addInvPayment=async()=>{
    if(!payAmt||!payModal?.inv)return;
    const newPay={date:payDate,amount:M.round(payAmt),note:payNote};
    const updPayments=[...(payModal.payments||[]),newPay];
    try{
      await window.db.invoices.update(payModal.inv.invoiceNumber,{payments:updPayments});
      setPayModal(p=>({...p,payments:updPayments}));setPayAmt("");setPayNote("");
      await load();
    }catch(e){await showAlert("Error: "+e.message);}
  };
  const removeInvPayment=async(pi)=>{
    if(!payModal?.inv)return;
    const updPayments=payModal.payments.filter((_,j)=>j!==pi);
    try{
      await window.db.invoices.update(payModal.inv.invoiceNumber,{payments:updPayments});
      setPayModal(p=>({...p,payments:updPayments}));
      await load();
    }catch(e){await showAlert("Error: "+e.message);}
  };

  // ── Delete invoice ──
  const deleteInvoice=async(inv)=>{
    const paid=(inv.payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
    if(paid>=inv.total&&inv.total>0){await showAlert("Cannot delete a REMITTED invoice.");return;}
    if(paid>0){if(!(await showConfirm(`Invoice ${inv.invoiceNumber} has payments of ${fmt(paid)}. Delete anyway? Payments will be lost.`)))return;}
    else{if(!(await showConfirm(`Delete invoice ${inv.invoiceNumber} (${fmt(inv.total)})? Charge lines will revert to ACCRUED.`)))return;}
    try{
      const res=await window.db.invoices.delete(inv.invoiceNumber);
      if(res?.success){await load();await showAlert(`Invoice ${inv.invoiceNumber} deleted.`);}
      else{await showAlert(res?.error||"Delete failed.");}
    }catch(e){await showAlert("Error: "+e.message);}
  };

  // ── Edit invoice ──
  const[editInvoice,setEditInvoice]=useState(null);
  const openEditInvoice=(inv)=>{
    setEditInvoice({
      ...inv,
      editItems:(inv.items||[]).map(it=>({...it})),
      editDate:inv.date,editDueDate:inv.dueDate||"",
      editProvince:inv.province||"Ontario",
      editCurrency:inv.invoiceCurrency||"CAD",
      editFxRate:inv.fxRate?String(inv.fxRate):"",
      editNoTax:inv.taxRate===0,
      editCustomTaxRate:inv.taxRate!=null&&inv.taxRate!==0&&!PROVINCE_TAX[inv.province||""]?String(inv.taxRate*100):"",
      editCustomTaxLabel:inv.taxLabel||"",
      editCustomTaxType:(inv.taxComponents||[])[0]?.type||"GST"
    });
  };
  const saveEditInvoice=async()=>{
    if(!editInvoice)return;
    setSaving(true);
    try{
      const ei=editInvoice;
      const efx=parseFloat(ei.editFxRate)||ei.fxRate||1;
      const provTax=PROVINCE_TAX[ei.editProvince]||{rate:0.13,label:"HST 13%",components:[{type:"GST",rate:0.05,label:"GST (5%)"},{type:"HST",rate:0.08,label:"HST ON (8%)"}]};
      const tax=ei.editNoTax?{rate:0,label:"No Tax",components:[]}:ei.editCustomTaxRate?{rate:parseFloat(ei.editCustomTaxRate)/100,label:ei.editCustomTaxLabel||`${ei.editCustomTaxType||"GST"} ${ei.editCustomTaxRate}%`,components:[{type:ei.editCustomTaxType||"GST",rate:parseFloat(ei.editCustomTaxRate)/100,label:ei.editCustomTaxLabel||`${ei.editCustomTaxType||"GST"} Custom (${ei.editCustomTaxRate}%)`}]}:provTax;
      const newItems=ei.editItems.filter(it=>M.round(it.amount)>0).map(it=>{
        const amt=M.round(it.amount);const cadAmt=it.originalCurrency==="USD"?M.mul(amt,efx):amt;
        return{...it,amount:cadAmt,originalAmount:amt,exchangeRate:efx};
      });
      const subtotalCents=newItems.reduce((s,it)=>s+M.cents(it.amount),0);const subtotalCAD=subtotalCents/100;
      const taxComponents=(tax.components||[]).map(c=>({type:c.type,rate:c.rate,label:c.label,amount:M.mul(subtotalCAD,c.rate)}));
      const taxAmt=taxComponents.reduce((s,c)=>M.sum(s,c.amount),0);const totalCAD=M.sum(subtotalCAD,taxAmt);
      const updData={items:newItems,date:ei.editDate,dueDate:ei.editDueDate,province:ei.editProvince,invoiceCurrency:ei.editCurrency,fxRate:efx,subtotal:subtotalCAD,taxAmount:taxAmt,total:totalCAD,taxLabel:tax.label,taxRate:tax.rate,taxComponents,invoicedCodes:newItems.map(it=>it.code)};
      await window.db.invoices.update(ei.invoiceNumber,updData);
      setEditInvoice(null);await load();
      await showAlert(`Invoice ${ei.invoiceNumber} updated.`);
    }catch(e){await showAlert("Error: "+e.message);}
    setSaving(false);
  };

  // ── AP slip ──
  const slipAPLine=async(line)=>{
    const j=jobs.find(x=>x.id===line.jobId);if(!j)return;
    const charges=line.type==="CB"?(j.cb||{}):(j.ff||{});
    // Check if it's a disb line or manual AP
    if(charges[line.code+"_disb"]){
      charges[line.code+"_slipped"]=true;
    } else {
      const manAP=charges._manualAP||[];
      const idx=manAP.findIndex(l=>l.code===line.code);
      if(idx>=0)manAP[idx].slipped=true;
      charges._manualAP=manAP;
    }
    const update=line.type==="CB"?{cb:charges}:{ff:charges};
    await dbUpdateJob(line.jobId,update);await load();
  };

  // ── AP payment ──
  const openAPPayModal=(line)=>{
    setPayModal({type:"ap",line,payments:line.payments||[]});
    setPayDate(new Date().toISOString().split("T")[0]);setPayAmt("");setPayNote("");
  };
  const addAPPayment=async()=>{
    if(!payAmt||!payModal?.line)return;
    const line=payModal.line;const j=jobs.find(x=>x.id===line.jobId);if(!j)return;
    const newPay={date:payDate,amount:M.round(payAmt),note:payNote};
    const charges=line.type==="CB"?{...(j.cb||{})}:{...(j.ff||{})};
    if(charges[line.code+"_disb"]){
      const payments=[...(charges[line.code+"_payments"]||[]),newPay];
      charges[line.code+"_payments"]=payments;
      setPayModal(p=>({...p,payments}));
    } else {
      const manAP=[...(charges._manualAP||[])];
      const idx=manAP.findIndex(l=>l.code===line.code);
      if(idx>=0){manAP[idx].payments=[...(manAP[idx].payments||[]),newPay];setPayModal(p=>({...p,payments:manAP[idx].payments}));}
      charges._manualAP=manAP;
    }
    const update=line.type==="CB"?{cb:charges}:{ff:charges};
    await dbUpdateJob(line.jobId,update);setPayAmt("");setPayNote("");await load();
  };

  const fmt=v=>v<0?`-$${Math.abs(v).toLocaleString("en",{minimumFractionDigits:2})}`:`$${(v||0).toLocaleString("en",{minimumFractionDigits:2})}`;

  return(<div>
    <h1 style={S.pt}>💰 Settlement</h1>
    {/* Tab bar */}
    <div style={{display:"flex",gap:0,marginBottom:20}}>
      {["AR","AP"].map(t=><button key={t} onClick={()=>{setTab(t);setFilterEntity("");setFilterStatus("");setSelected(new Set());}} style={{padding:"10px 32px",fontSize:13,fontWeight:700,fontFamily:F.display,border:`1px solid ${C.border}`,background:tab===t?C.accent:C.surface,color:tab===t?"#fff":C.textDim,cursor:"pointer",borderRadius:t==="AR"?"8px 0 0 8px":"0 8px 8px 0"}}>{t==="AR"?"AR (Receivable)":"AP (Payable)"}</button>)}
    </div>

    {/* Filters */}
    <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"flex-end",flexWrap:"wrap"}}>
      <div><label style={S.label}>From</label><input type="date" value={createdFrom} onChange={e=>setCreatedFrom(e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
      <div><label style={S.label}>To</label><input type="date" value={createdTo} onChange={e=>setCreatedTo(e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
      <div><label style={S.label}>{tab==="AR"?"Customer":"Payee"}</label><input value={searchEntity} onChange={e=>{setSearchEntity(e.target.value);}} placeholder={`Search ${tab==="AR"?"customer":"payee"}...`} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",minWidth:180}}/></div>
      <div><label style={S.label}>Status</label><select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",minWidth:120}}><option value="">All</option><option>ACCRUED</option><option>SLIPPED</option><option>P REMITTED</option><option>REMITTED</option></select></div>
      {(searchEntity||filterStatus)&&<Button variant="ghost" size="sm" onClick={()=>{setSearchEntity("");setFilterStatus("");}}>Clear</Button>}
      {tab==="AR"&&canGenerate&&<Button size="sm" onClick={()=>{setInvProvince(selectedARLines[0].province||"Ontario");setShowInvModal(true);}}>Generate Invoice ({selectedARLines.length} lines)</Button>}
      {tab==="AR"&&canConsolidate&&<Button size="sm" onClick={consolidateInvoices} disabled={saving}>{saving?"Consolidating...":"Consolidate "+selectedConsolidateInvs.length+" Invoices"}</Button>}
    </div>

    {loading?<LoadingOverlay/>:tab==="AR"?(
      /* ═══ AR TAB ═══ */
      arGroups.length===0?<EmptyState text="No AR lines found."/>:arGroups.map(([customer,lines])=>{
        const totalAmt=lines.reduce((s,l)=>M.sum(s,l.amount),0);
        const unpaid=lines.filter(l=>l.status!=="REMITTED");
        const agingBuckets={Current:0,"31-60":0,"61-90":0,"90+":0};
        unpaid.forEach(l=>{const d=l.invoice?.date||(l.createdAt||"").slice(0,10);const b=ageBucket(d);agingBuckets[b]=M.sum(agingBuckets[b],l.amount);});
        const jobGroups=groupByJob(lines);
        return(<div key={customer} style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:F.display}}>{customer}</div>
            <div style={{display:"flex",gap:12,fontSize:10,fontFamily:F.mono}}>
              {Object.entries(agingBuckets).filter(([,v])=>v>0).map(([b,v])=><span key={b} style={{color:ageColor(b),fontWeight:600}}>{b}: {fmt(v)}</span>)}
              <span style={{fontWeight:700,color:C.text}}>Total: {fmt(totalAmt)}</span>
            </div>
          </div>
          {jobGroups.map(([jobId,jobLines])=>(
            <div key={jobId} style={{marginBottom:10,borderLeft:`3px solid ${C.accent}30`,paddingLeft:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <IdLink id={jobId} onClick={()=>{const j=jobs.find(x=>x.id===jobId);if(j&&onOpenARAP)onOpenARAP(j);}}/>
                {jobLines[0]?.bl&&<span style={{fontFamily:F.mono,fontSize:10,color:C.textDim}}>{jobLines[0].bl}</span>}
                <span style={{fontSize:10,color:C.textMuted}}>{jobLines.length} line{jobLines.length>1?"s":""}</span>
                <span style={{fontFamily:F.mono,fontSize:10,color:C.text,fontWeight:600}}>{fmt(jobLines.reduce((s,l)=>M.sum(s,l.amount),0))}</span>
              </div>
              {jobLines.map(l=>{const lk=lineKey(l);const sel=selected.has(lk)&&l.status==="ACCRUED";
                return(<div key={lk} style={{display:"flex",gap:8,alignItems:"center",padding:"4px 0",fontSize:12}}>
                  {l.status==="ACCRUED"&&<input type="checkbox" checked={sel} onChange={()=>toggleSelect(lk)} style={{accentColor:C.accent}}/>}
                  <span style={{fontFamily:F.mono,fontSize:11,color:C.orange,fontWeight:600,width:36}}>{l.code}</span>
                  <span style={{fontFamily:F.mono,fontSize:12}}>{l.currency} {fmt(l.amount)}</span>
                  {l.invNum&&<span style={{fontFamily:F.mono,fontSize:10,color:C.accent,fontWeight:600,cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewInvoice(l.invoice)}>{l.invNum}</span>}
                  <span style={{fontSize:9,fontWeight:700,color:l.color,padding:"2px 6px",borderRadius:4,border:`1px solid ${l.color}30`,background:`${l.color}10`}}>{l.status}</span>
                  {l.invoice&&l.status!=="REMITTED"&&<button onClick={()=>openInvPayModal(l.invoice)} style={{background:"none",border:"none",color:C.cyan,cursor:"pointer",fontSize:11}}>💳</button>}
                </div>);
              })}
            </div>
          ))}
          {/* Outstanding Invoices for this customer */}
          {(outstandingInvByCustomer[customer]||[]).length>0&&<div style={{marginTop:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.textDim,fontFamily:F.display,marginBottom:6}}>Outstanding Invoices</div>
            {(outstandingInvByCustomer[customer]||[]).map(inv=>{
              const isSel=selectedInvs.has(inv.invoiceNumber);
              const invPaid=(inv.payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
              const invStatus=invPaid>0?"P REMITTED":"SLIPPED";
              const invColor=invPaid>0?C.orange:C.blue;
              return(<div key={inv.invoiceNumber} style={{display:"flex",gap:8,alignItems:"center",padding:"6px 10px",background:isSel?`${C.accent}0c`:C.card,borderRadius:6,border:`1px solid ${isSel?C.accent+"40":C.border}`,marginBottom:4,flexWrap:"wrap"}}>
                <input type="checkbox" checked={isSel} onChange={()=>toggleInvSelect(inv.invoiceNumber)} style={{accentColor:C.accent}}/>
                <span style={{fontFamily:F.mono,fontSize:12,color:C.accent,fontWeight:600,cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewInvoice(inv)}>{inv.invoiceNumber}</span>
                <span style={{fontSize:11,color:C.textDim}}>{inv.date}</span>
                <span style={{fontFamily:F.mono,fontSize:12,color:C.text,fontWeight:600}}>{fmt(inv.total)}</span>
                {invPaid>0&&<span style={{fontFamily:F.mono,fontSize:10,color:C.green}}>paid {fmt(invPaid)}</span>}
                <span style={{fontFamily:F.mono,fontSize:10,color:C.red}}>bal {fmt(inv.balance)}</span>
                <span style={{fontSize:9,fontWeight:700,color:invColor,padding:"2px 6px",borderRadius:4,border:`1px solid ${invColor}30`,background:`${invColor}10`}}>{invStatus}</span>
                {inv.consolidatedFrom&&inv.consolidatedFrom.length>0&&<Badge color={C.purple}>Consolidated</Badge>}
                <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
                  <button onClick={()=>openEditInvoice(inv)} title="Edit invoice" style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:11}}>✏️</button>
                  <button onClick={()=>openInvPayModal(inv)} title="Record payment" style={{background:"none",border:"none",color:C.cyan,cursor:"pointer",fontSize:12}}>💳</button>
                  <button onClick={()=>deleteInvoice(inv)} title="Delete invoice" style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:11}}>🗑</button>
                </div>
              </div>);
            })}
          </div>}
        </div>);
      })
    ):(
      /* ═══ AP TAB ═══ */
      apGroups.length===0?<EmptyState text="No AP lines found."/>:apGroups.map(([payee,lines])=>{
        const totalAmt=lines.reduce((s,l)=>M.sum(s,l.amount),0);
        const unpaid=lines.filter(l=>l.status!=="REMITTED");
        const agingBuckets={Current:0,"31-60":0,"61-90":0,"90+":0};
        unpaid.forEach(l=>{const b=ageBucket(l.dueDate);agingBuckets[b]=M.sum(agingBuckets[b],l.amount);});
        const jobGroups=groupByJob(lines);
        return(<div key={payee} style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:F.display}}>{payee||"(No Payee)"}</div>
            <div style={{display:"flex",gap:12,fontSize:10,fontFamily:F.mono}}>
              {Object.entries(agingBuckets).filter(([,v])=>v>0).map(([b,v])=><span key={b} style={{color:ageColor(b),fontWeight:600}}>{b}: {fmt(v)}</span>)}
              <span style={{fontWeight:700,color:C.text}}>Total: {fmt(totalAmt)}</span>
            </div>
          </div>
          {jobGroups.map(([jobId,jobLines])=>(
            <div key={jobId} style={{marginBottom:10,borderLeft:`3px solid ${C.orange}30`,paddingLeft:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <IdLink id={jobId} onClick={()=>{const j=jobs.find(x=>x.id===jobId);if(j&&onOpenARAP)onOpenARAP(j);}}/>
                {jobLines[0]?.bl&&<span style={{fontFamily:F.mono,fontSize:10,color:C.textDim}}>{jobLines[0].bl}</span>}
                <span style={{fontSize:10,color:C.textMuted}}>{jobLines.length} line{jobLines.length>1?"s":""}</span>
                <span style={{fontFamily:F.mono,fontSize:10,color:C.text,fontWeight:600}}>{fmt(jobLines.reduce((s,l)=>M.sum(s,l.amount),0))}</span>
              </div>
              {jobLines.map((l,li)=>(
                <div key={l.code+li} style={{display:"flex",gap:8,alignItems:"center",padding:"4px 0",fontSize:12}}>
                  <span style={{fontFamily:F.mono,fontSize:11,color:C.orange,fontWeight:600,width:36}}>{l.code}</span>
                  <span style={{fontFamily:F.mono,fontSize:12}}>{l.currency} {fmt(l.amount)}</span>
                  {l.paid>0&&<span style={{fontSize:9,color:C.green}}>(paid {fmt(l.paid)})</span>}
                  <span style={{fontFamily:F.mono,fontSize:10,color:l.dueDate?C.textDim:C.textMuted}}>{l.dueDate||""}</span>
                  <span style={{fontSize:9,fontWeight:700,color:l.color,padding:"2px 6px",borderRadius:4,border:`1px solid ${l.color}30`,background:`${l.color}10`}}>{l.status}</span>
                  {l.status==="ACCRUED"&&<button onClick={()=>slipAPLine(l)} style={{background:"none",border:`1px solid ${C.blue}40`,borderRadius:4,color:C.blue,cursor:"pointer",fontSize:9,fontWeight:600,padding:"2px 8px"}}>Slip</button>}
                  {l.status!=="REMITTED"&&<button onClick={()=>openAPPayModal(l)} style={{background:"none",border:"none",color:C.cyan,cursor:"pointer",fontSize:11}}>💳</button>}
                </div>
              ))}
            </div>
          ))}
        </div>);
      })
    )}

    {/* Pagination */}
    {totalJobCount>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,marginBottom:8}}>
      <span style={{fontSize:11,color:C.textMuted}}>Showing {Math.min(jobs.length,S_PAGE_SIZE)} of {totalJobCount} BLs</span>
      {totalJobCount>S_PAGE_SIZE&&<div style={{display:"flex",gap:4}}>
        <Button variant="ghost" size="sm" disabled={sPage<=1} onClick={()=>setSPage(p=>p-1)}>← Prev</Button>
        <span style={{fontSize:11,color:C.text,padding:"6px 10px"}}>{sPage} / {Math.ceil(totalJobCount/S_PAGE_SIZE)}</span>
        <Button variant="ghost" size="sm" disabled={sPage>=Math.ceil(totalJobCount/S_PAGE_SIZE)} onClick={()=>setSPage(p=>p+1)}>Next →</Button>
      </div>}
    </div>}

    {/* ── Invoice View Modal ── */}
    {viewInvoice&&(()=>{
      const vi=viewInvoice;const viCur=vi.invoiceCurrency||"CAD";const viFx=vi.fxRate||1;
      const invPaid=(vi.payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
      return<div style={S.modal} onClick={()=>setViewInvoice(null)}><div style={{background:C.surface,borderRadius:14,padding:24,width:560,maxHeight:"85vh",overflow:"auto",border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <h3 style={{margin:0,fontFamily:F.display,color:C.text}}>{vi.invoiceNumber}</h3>
          <div style={{display:"flex",gap:6}}>
            <Button variant="ghost" size="sm" onClick={()=>printInvoice(vi)}>🖨</Button>
            <Button variant="ghost" size="sm" onClick={()=>saveInvoicePDF(vi)}>PDF</Button>
            <Button variant="ghost" size="sm" onClick={()=>setViewInvoice(null)}>✕</Button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12,marginBottom:12}}>
          <div><strong>Customer:</strong> {vi.customer}</div><div><strong>Date:</strong> {vi.date}</div>
          <div><strong>Due:</strong> {vi.dueDate||"—"}</div><div><strong>Province:</strong> {vi.province}</div>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:12}}><thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
          <th style={{textAlign:"left",padding:"6px 0"}}>Item</th><th style={{textAlign:"right",padding:"6px 0"}}>Amount</th>
        </tr></thead><tbody>
        {(vi.items||[]).map((it,i)=><tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
          <td style={{padding:"6px 0"}}><span style={{fontFamily:F.mono,color:C.orange}}>{it.code}</span> {it.label}{it.jobId&&<span style={{fontSize:9,color:C.textMuted,marginLeft:4}}>{it.jobId}</span>}</td>
          <td style={{padding:"6px 0",textAlign:"right",fontFamily:F.mono}}>{fmt(it.amount)}</td>
        </tr>)}
        </tbody></table>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Subtotal</span><span style={{fontFamily:F.mono}}>{fmt(vi.subtotal)}</span></div>
        {(vi.taxComponents||[]).map((c,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.textDim}}><span>{c.label}</span><span style={{fontFamily:F.mono}}>{fmt(c.amount)}</span></div>)}
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15,marginTop:8,paddingTop:8,borderTop:`2px solid ${C.accent}`}}><span>Total</span><span style={{color:C.accent,fontFamily:F.mono}}>{fmt(vi.total)}</span></div>
        {invPaid>0&&<div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:12}}><span style={{color:C.green}}>Paid</span><span style={{fontFamily:F.mono,color:C.green}}>{fmt(invPaid)}</span></div>}
        {invPaid<vi.total&&<div style={{display:"flex",justifyContent:"space-between",marginTop:2,fontSize:12}}><span style={{color:C.red}}>Balance</span><span style={{fontFamily:F.mono,color:C.red}}>{fmt(M.sub(vi.total,invPaid))}</span></div>}
        <div style={{marginTop:12,display:"flex",gap:8}}>
          <Button size="sm" onClick={()=>openInvPayModal(vi)}>💳 Record Payment</Button>
          <Button size="sm" variant="ghost" onClick={()=>{setViewInvoice(null);openEditInvoice(vi);}}>✏️ Edit</Button>
          <Button size="sm" variant="ghost" onClick={()=>{setViewInvoice(null);deleteInvoice(vi);}}>🗑 Delete</Button>
        </div>
      </div></div>;
    })()}

    {/* ── Edit Invoice Modal ── */}
    {editInvoice&&<div style={S.modal} onClick={()=>setEditInvoice(null)}><div style={{background:C.surface,borderRadius:14,padding:24,width:560,maxHeight:"85vh",overflow:"auto",border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
      <h3 style={{margin:"0 0 16px",fontFamily:F.display,color:C.text,fontSize:16}}>Edit Invoice — {editInvoice.invoiceNumber}</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:16}}>
        <Input label="Date" type="date" value={editInvoice.editDate} onChange={v=>setEditInvoice(p=>({...p,editDate:v}))}/>
        <Input label="Due Date" type="date" value={editInvoice.editDueDate} onChange={v=>setEditInvoice(p=>({...p,editDueDate:v}))}/>
        <Select label="Province (Tax)" value={editInvoice.editProvince} onChange={v=>setEditInvoice(p=>({...p,editProvince:v,editCustomTaxRate:"",editCustomTaxLabel:"",editCustomTaxType:"GST"}))} options={PROVINCES} disabled={editInvoice.editNoTax}/>
        <Select label="Currency" value={editInvoice.editCurrency} onChange={v=>setEditInvoice(p=>({...p,editCurrency:v}))} options={[{value:"CAD",label:"CAD"},{value:"USD",label:"USD"}]}/>
        <div><label style={S.label}>FX Rate</label><input value={editInvoice.editFxRate||""} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))setEditInvoice(p=>({...p,editFxRate:v}));}} placeholder={String(editInvoice.fxRate||"1.0000")} style={{fontFamily:F.mono,fontSize:12,padding:"7px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",width:"100%",textAlign:"right"}}/></div>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <label style={S.label}>Tax</label>
            <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}><input type="checkbox" checked={!!editInvoice.editNoTax} onChange={e=>setEditInvoice(p=>({...p,editNoTax:e.target.checked,editCustomTaxRate:"",editCustomTaxLabel:"",editCustomTaxType:"GST"}))} style={{accentColor:C.accent}}/><span style={{fontSize:10,fontWeight:600,color:editInvoice.editNoTax?C.red:C.textMuted}}>No Tax</span></label>
          </div>
          {!editInvoice.editNoTax&&<div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <input value={editInvoice.editCustomTaxRate||""} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))setEditInvoice(p=>({...p,editCustomTaxRate:v}));}} placeholder={(PROVINCE_TAX[editInvoice.editProvince]||{rate:0.13}).rate*100+"%"} style={{fontFamily:F.mono,fontSize:11,padding:"5px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,outline:"none",width:50,textAlign:"right"}}/>
            <span style={{fontSize:10,color:C.textMuted}}>%</span>
            {editInvoice.editCustomTaxRate&&<select value={editInvoice.editCustomTaxType||"GST"} onChange={e=>setEditInvoice(p=>({...p,editCustomTaxType:e.target.value}))} style={{fontFamily:F.mono,fontSize:10,padding:"4px 3px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,outline:"none",cursor:"pointer"}}><option value="GST">GST</option><option value="HST">HST</option><option value="PST">PST</option><option value="QST">QST</option></select>}
            {!editInvoice.editCustomTaxRate&&<span style={{fontSize:10,color:C.cyan,fontFamily:F.mono}}>{(PROVINCE_TAX[editInvoice.editProvince]||{label:"HST 13%"}).label}</span>}
          </div>}
        </div>
      </div>
      {/* Line items */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <label style={S.label}>Line Items</label>
          <button onClick={()=>setEditInvoice(p=>({...p,editItems:[...p.editItems,{code:"",label:"",amount:"",originalAmount:"",originalCurrency:"CAD",exchangeRate:1,remark:"",jobId:""}]}))} style={{background:"none",border:`1px solid ${C.accent}40`,borderRadius:5,color:C.accent,cursor:"pointer",fontSize:10,fontWeight:600,padding:"3px 10px",fontFamily:F.body}}>+ Add Line</button>
        </div>
        {editInvoice.editItems.map((it,i)=>(
          <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
            <input value={it.code||""} onChange={e=>setEditInvoice(p=>({...p,editItems:p.editItems.map((x,j)=>j===i?{...x,code:e.target.value.toUpperCase()}:x)}))} placeholder="CODE" style={{fontFamily:F.mono,fontSize:11,padding:"5px 6px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.orange,fontWeight:600,width:50,textAlign:"center"}}/>
            <input value={it.label||""} onChange={e=>setEditInvoice(p=>({...p,editItems:p.editItems.map((x,j)=>j===i?{...x,label:e.target.value}:x)}))} placeholder="Description" style={{fontFamily:F.body,fontSize:11,padding:"5px 6px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,flex:1,minWidth:80}}/>
            <input value={it.originalAmount!=null?it.originalAmount:it.amount||""} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))setEditInvoice(p=>({...p,editItems:p.editItems.map((x,j)=>j===i?{...x,amount:v,originalAmount:v}:x)}));}} placeholder="0.00" style={{fontFamily:F.mono,fontSize:12,padding:"5px 6px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,width:80,textAlign:"right"}}/>
            <select value={it.originalCurrency||"CAD"} onChange={e=>setEditInvoice(p=>({...p,editItems:p.editItems.map((x,j)=>j===i?{...x,originalCurrency:e.target.value}:x)}))} style={{fontFamily:F.mono,fontSize:10,padding:"4px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,width:52}}><option>CAD</option><option>USD</option></select>
            {it.jobId&&<span style={{fontSize:9,color:C.textMuted,fontFamily:F.mono}}>{it.jobId}</span>}
            {editInvoice.editItems.length>1&&<button onClick={()=>setEditInvoice(p=>({...p,editItems:p.editItems.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:13,fontWeight:700}}>×</button>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <Button variant="ghost" onClick={()=>setEditInvoice(null)}>Cancel</Button>
        <Button onClick={saveEditInvoice} disabled={saving}>{saving?"Saving...":"💾 Save Changes"}</Button>
      </div>
    </div></div>}

    {/* ── Invoice Generation Modal ── */}
    {showInvModal&&<div style={S.modal} onClick={()=>setShowInvModal(false)}><div style={{background:C.surface,borderRadius:14,padding:24,width:500,maxHeight:"85vh",overflow:"auto",border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
      <h3 style={{margin:"0 0 16px",fontFamily:F.display,color:C.text,fontSize:16}}>Generate Invoice</h3>
      <div style={{fontSize:12,color:C.textDim,marginBottom:12}}>{selectedARLines.length} lines from {new Set(selectedARLines.map(l=>l.jobId)).size} BL(s) — {selectedARLines[0]?.customer}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:16}}>
        <Input label="Date" type="date" value={invDate} onChange={setInvDate}/>
        <Input label="Due Date" type="date" value={invDueDate} onChange={setInvDueDate}/>
        <Select label="Province (Tax)" value={invProvince} onChange={v=>{setInvProvince(v);setInvCustomTaxRate("");}} options={PROVINCES} disabled={invNoTax}/>
        <div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <label style={S.label}>Tax</label>
          <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}><input type="checkbox" checked={invNoTax} onChange={e=>setInvNoTax(e.target.checked)} style={{accentColor:C.accent}}/><span style={{fontSize:10,fontWeight:600,color:invNoTax?C.red:C.textMuted}}>No Tax</span></label>
        </div>
        {!invNoTax&&<div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <input value={invCustomTaxRate} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))setInvCustomTaxRate(v);}} placeholder={(PROVINCE_TAX[invProvince]||{rate:0.13}).rate*100+"%"} style={{fontFamily:F.mono,fontSize:12,padding:"6px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,outline:"none",width:50,textAlign:"right"}}/>
          <span style={{fontSize:10,color:C.textMuted}}>%</span>
          {invCustomTaxRate&&<select value={invCustomTaxType} onChange={e=>setInvCustomTaxType(e.target.value)} style={{fontFamily:F.mono,fontSize:10,padding:"4px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text}}><option value="GST">GST</option><option value="HST">HST</option><option value="PST">PST</option><option value="QST">QST</option></select>}
          {!invCustomTaxRate&&<span style={{fontSize:10,color:C.cyan,fontFamily:F.mono}}>{(PROVINCE_TAX[invProvince]||{label:"HST 13%"}).label}</span>}
        </div>}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <Button variant="ghost" onClick={()=>setShowInvModal(false)}>Cancel</Button>
        <Button onClick={()=>generateInvoice()} disabled={saving}>{saving?"Generating...":"Generate Invoice"}</Button>
      </div>
    </div></div>}

    {/* ── Payment Modal ── */}
    {payModal&&<div style={S.modal} onClick={()=>setPayModal(null)}><div style={{background:C.surface,borderRadius:14,padding:24,width:480,maxHeight:"85vh",overflow:"auto",border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{margin:0,fontFamily:F.display,color:C.text,fontSize:15}}>{payModal.type==="invoice"?"Invoice Payment":"AP Payment"}</h3>
        <Button variant="ghost" size="sm" onClick={()=>setPayModal(null)}>✕</Button>
      </div>
      {payModal.type==="invoice"&&<div style={{fontSize:12,color:C.textDim,marginBottom:12}}>{payModal.inv.invoiceNumber} — Total: {fmt(payModal.inv.total)}</div>}
      {payModal.type==="ap"&&<div style={{fontSize:12,color:C.textDim,marginBottom:12}}>{payModal.line.jobId} {payModal.line.code} — Total: {fmt(payModal.line.amount)}</div>}
      {/* Existing payments */}
      {(payModal.payments||[]).length>0&&<div style={{marginBottom:12}}>
        {payModal.payments.map((p,pi)=><div key={pi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:C.card,borderRadius:6,border:`1px solid ${C.border}`,marginBottom:4}}>
          <div><span style={{fontFamily:F.mono,fontSize:11}}>{p.date}</span><span style={{fontFamily:F.mono,fontSize:12,color:C.green,marginLeft:8}}>{fmt(p.amount)}</span>{p.note&&<span style={{fontSize:10,color:C.textMuted,marginLeft:8}}>{p.note}</span>}</div>
          <button onClick={()=>payModal.type==="invoice"?removeInvPayment(pi):null} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12}}>×</button>
        </div>)}
      </div>}
      {/* Add payment */}
      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
        <Input label="Date" type="date" value={payDate} onChange={setPayDate} style={{flex:1}}/>
        <Input label="Amount" value={payAmt} onChange={v=>{if(v===""||/^\d*\.?\d*$/.test(v))setPayAmt(v);}} placeholder="0.00" style={{flex:1}}/>
        <Input label="Note" value={payNote} onChange={setPayNote} placeholder="Wire, Check..." style={{flex:1}}/>
        <Button onClick={payModal.type==="invoice"?addInvPayment:addAPPayment} disabled={!payAmt||!payDate}>+ Add</Button>
      </div>
    </div></div>}
  </div>);
}

// ═══════ GENERAL EXPENSE PAGE ═══════
function GeneralExpensePage({onNav}){
  const[items,setItems]=useState([]);const[search,setSearch]=useState("");const dSearch=useDebounce(search);
  const[createdMonth,setCreatedMonth]=useState("");
  const[page,setPage]=useState(1);const[total,setTotal]=useState(0);const PAGE_SIZE=50;
  const[showForm,setShowForm]=useState(false);const[saving,setSaving]=useState(false);const[loading,setLoading]=useState(true);
  const[payeeList,setPayeeList]=useState([]);
  const[customCodes,setCustomCodes]=useState([]);
  const[showAddCode,setShowAddCode]=useState(false);
  const[newCodeCode,setNewCodeCode]=useState("");const[newCodeLabel,setNewCodeLabel]=useState("");
  const[editId,setEditId]=useState(null); // for editing existing expense

  const allCodes=[...GE_CODES,...customCodes.filter(c=>c.type==="GEN")];

  // Form state — lineItems supports multiple codes/amounts per GE
  const emptyLine={code:"",label:"",amount:""};
  const emptyForm={lineItems:[{...emptyLine}],currency:"CAD",notes:"",payee:"",registeredDate:new Date().toISOString().split("T")[0],paidDate:"",taxPaidComponents:[],vendorInvNum:"",vendorInvDate:"",dueDate:"",memo:""};
  const[form,setForm]=useState(emptyForm);
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const updLine=(i,k,v)=>setForm(p=>({...p,lineItems:p.lineItems.map((l,j)=>j===i?{...l,[k]:v}:l)}));
  const addLine=()=>setForm(p=>({...p,lineItems:[...p.lineItems,{...emptyLine}]}));
  const removeLine=(i)=>setForm(p=>({...p,lineItems:p.lineItems.filter((_,j)=>j!==i)}));
  const formTotal=form.lineItems.reduce((s,l)=>M.sum(s,l.amount),0);

  const load=async()=>{
    if(!window.db)return;
    setLoading(true);
    try{
      const opts={dateFrom:"",dateTo:"",payee:"",limit:PAGE_SIZE,offset:(page-1)*PAGE_SIZE};
      const all=await window.db.ap.list({...opts});
      const generals=(all||[]).filter(a=>a.type==="General");
      let filtered=generals;
      if(dSearch){const q=dSearch.toLowerCase();filtered=filtered.filter(a=>(a.id||"").toLowerCase().includes(q)||(a.payee||"").toLowerCase().includes(q)||(a.memo||"").toLowerCase().includes(q));}
      if(createdMonth){filtered=filtered.filter(a=>(a.createdAt||"").slice(0,7)===createdMonth);}
      setItems(filtered);setTotal(filtered.length);
      setPayeeList([...DB.payees]);
      if(window.db.codes){const cc=await window.db.codes.list();setCustomCodes(cc||[]);}
    }catch(e){await showAlert("Failed to load expenses: "+e.message);}
    setLoading(false);
  };
  useEffect(()=>{load();},[dSearch,createdMonth,page]);

  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));

  const saveExpense=async()=>{
    const validLines=form.lineItems.filter(l=>l.code&&M.round(l.amount)>0);
    if(validLines.length===0){await showAlert("Please add at least one item with a code and amount.");return;}
    setSaving(true);
    const items=validLines.map(l=>({code:l.code,label:l.label,amount:M.round(l.amount)}));
    const total=items.reduce((s,l)=>M.sum(s,l.amount),0);
    try{
      const memoStr=(form.vendorInvDate?"vinvDate:"+form.vendorInvDate+"|":"")+form.notes;
      if(editId){
        if(window.db)await window.db.ap.update(editId,{
          payee:form.payee,date:form.registeredDate,items,total,
          memo:memoStr,invoiceNum:form.vendorInvNum||"",dueDate:form.dueDate||"",
          currency:form.currency,paidDate:form.paidDate,taxPaid:(form.taxPaidComponents||[]).reduce((s,c)=>M.sum(s,c.amount),0),taxPaidComponents:form.taxPaidComponents||[]
        });
        setEditId(null);
      } else {
        const id=await dbNextGeneralId();
        const tpc=form.taxPaidComponents||[];const tp=tpc.reduce((s,c)=>M.sum(s,c.amount),0);
        await dbAddAP({id,jobId:"",customer:"",payee:form.payee,date:form.registeredDate,items,total,type:"General",payments:[],dueDate:form.dueDate||"",invoiceNum:form.vendorInvNum||"",fxRate:0,memo:memoStr,currency:form.currency,paidDate:form.paidDate,taxPaid:tp,taxPaidComponents:tpc});
      }
      setForm(emptyForm);setShowForm(false);await load();
    }catch(e){await showAlert("Error: "+e.message);}
    setSaving(false);
  };

  const startEdit=(item)=>{
    const parsed=parseMemo(item.memo);
    const lineItems=(item.items||[]).map(l=>({code:l.code||"",label:l.label||"",amount:String(l.amount||"")}));
    if(lineItems.length===0)lineItems.push({code:"",label:"",amount:""});
    setForm({lineItems,currency:item.currency||"CAD",notes:parsed.notes,payee:item.payee||"",registeredDate:item.date||"",paidDate:item.paidDate||"",taxPaidComponents:item.taxPaidComponents||[],vendorInvNum:item.invoiceNum||"",vendorInvDate:parsed.vendorInvDate||"",dueDate:item.dueDate||"",memo:""});
    setEditId(item.id);setShowForm(true);
  };

  const deleteExpense=async(id)=>{
    if(!(await showConfirm(`Delete expense ${id}?`)))return;
    if(window.db)await window.db.ap.delete(id);
    await load();
  };

  const addCustomCode=async()=>{
    if(!newCodeCode||!newCodeLabel)return;
    const code=newCodeCode.toUpperCase();
    if(window.db?.codes)await window.db.codes.add({type:"GEN",code,label:newCodeLabel});
    setCustomCodes(p=>[...p,{type:"GEN",code,label:newCodeLabel}]);
    setNewCodeCode("");setNewCodeLabel("");setShowAddCode(false);
  };

  // Code dropdown
  const[codeDropdown,setCodeDropdown]=useState(false);const codeDropRef=useRef(null);
  useEffect(()=>{const h=e=>{if(codeDropRef.current&&!codeDropRef.current.contains(e.target))setCodeDropdown(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);

  const parseMemo=(memo)=>{
    const closing=(memo||"").match(/closing:(\d{4}-\d{2})/);
    const vinvDate=(memo||"").match(/vinvDate:(\d{4}-\d{2}-\d{2})/);
    const notes=(memo||"").replace(/closing:\d{4}-\d{2}\|?/,"").replace(/vinvDate:\d{4}-\d{2}-\d{2}\|?/,"").replace(/^\|+/,"");
    return{closingMonth:closing?closing[1]:"",vendorInvDate:vinvDate?vinvDate[1]:"",notes};
  };

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h1 style={S.pt}>📝 General Expense</h1>
      <Button onClick={()=>{if(showForm){setShowForm(false);setForm(emptyForm);setEditId(null);}else setShowForm(true);}}>{showForm?"✕ Cancel":"+ Add Expense"}</Button>
    </div>

    {/* ── Add/Edit Form ── */}
    {showForm&&<div style={{background:C.surface,borderRadius:10,padding:24,border:`1px solid ${C.accent}33`,marginBottom:24}}>
      <h3 style={{margin:"0 0 16px",fontFamily:F.display,color:C.text,fontSize:16}}>{editId?"Edit Expense":"New Expense"}</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
        {/* Line Items */}
        <div style={{gridColumn:"span 3",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <label style={S.label}>Line Items</label>
            <button onClick={addLine} style={{background:"none",border:`1px solid ${C.accent}40`,borderRadius:5,color:C.accent,cursor:"pointer",fontSize:10,fontWeight:600,padding:"3px 10px",fontFamily:F.body}}>+ Add Line</button>
          </div>
          {form.lineItems.map((li,i)=>(
            <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
              <div ref={i===form.lineItems.length-1?codeDropRef:null} style={{position:"relative",minWidth:180}}>
                <div onClick={()=>setCodeDropdown(codeDropdown===i?false:i)} style={{fontFamily:F.mono,fontSize:11,padding:"6px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:li.code?C.text:C.textMuted,cursor:"pointer",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{li.code?`${li.code} — ${li.label}`:"Select code..."}</div>
                {codeDropdown===i&&<div style={{position:"absolute",top:"100%",left:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:100,minWidth:260,maxHeight:240,overflow:"auto",marginTop:4}}>
                  {allCodes.map(c=><div key={c.code} onClick={()=>{updLine(i,"code",c.code);updLine(i,"label",c.label);setCodeDropdown(false);}} style={{padding:"7px 12px",cursor:"pointer",fontSize:12,display:"flex",gap:8}} onMouseEnter={e=>e.currentTarget.style.background=C.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><span style={{fontFamily:F.mono,color:C.accent,fontWeight:600,fontSize:11}}>{c.code}</span><span style={{color:C.text}}>{c.label}</span></div>)}
                  <div style={{borderTop:`1px solid ${C.border}`,padding:"7px 12px"}}><button onClick={()=>{setShowAddCode(true);setCodeDropdown(false);}} style={{background:"none",border:"none",color:C.green,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:F.body}}>+ New Custom Code</button></div>
                </div>}
              </div>
              <input value={li.amount} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))updLine(i,"amount",v);}} placeholder="0.00" style={{fontFamily:F.mono,fontSize:12,padding:"6px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,outline:"none",width:90,textAlign:"right"}}/>
              {form.lineItems.length>1&&<button onClick={()=>removeLine(i)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,fontWeight:700,padding:"0 4px"}}>×</button>}
            </div>
          ))}
          {form.lineItems.length>1&&<div style={{textAlign:"right",fontFamily:F.mono,fontSize:12,fontWeight:700,color:C.text,padding:"4px 0"}}>Total: ${formTotal.toFixed(2)}</div>}
        </div>
        <Select label="Currency" value={form.currency} onChange={v=>upd("currency",v)} options={["CAD","USD"]}/>
        <div><label style={S.label}>Tax Paid (ITC)</label><TaxRateSelect amount={formTotal} value={form.taxPaidComponents} onChange={v=>upd("taxPaidComponents",v)}/></div>
        <div><label style={S.label}>Payee</label><select value={form.payee} onChange={e=>upd("payee",e.target.value)} style={{width:"100%",fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}><option value="">Select payee...</option>{payeeList.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></div>
        <Input label="Registered Date" type="date" value={form.registeredDate} onChange={v=>upd("registeredDate",v)}/>
        <Input label="Paid Date" type="date" value={form.paidDate} onChange={v=>upd("paidDate",v)}/>
        <Input label="Vendor Inv #" value={form.vendorInvNum} onChange={v=>upd("vendorInvNum",v)} placeholder="INV-0000"/>
        <Input label="Vendor Inv Date" type="date" value={form.vendorInvDate} onChange={v=>upd("vendorInvDate",v)}/>
        <Input label="Due Date" type="date" value={form.dueDate} onChange={v=>upd("dueDate",v)}/>
        <Input label="Notes" value={form.notes} onChange={v=>upd("notes",v)} placeholder="Description..."/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Button variant="ghost" onClick={()=>{setShowForm(false);setForm(emptyForm);setEditId(null);}}>Cancel</Button>
        <Button onClick={saveExpense} disabled={saving||formTotal<=0}>{saving?"Saving...":(editId?"💾 Update":"Save Expense")}</Button>
      </div>
    </div>}

    {/* ── Search ── */}
    <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"flex-end",flexWrap:"wrap"}}>
      <Input value={search} onChange={v=>{setSearch(v);setPage(1);}} placeholder="Search ID, Payee, Notes..." style={{flex:1,minWidth:200}}/>
      <div><label style={S.label}>Created Month</label><input type="month" value={createdMonth} onChange={e=>{setCreatedMonth(e.target.value);setPage(1);}} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
      {createdMonth&&<Button variant="ghost" size="sm" onClick={()=>{setCreatedMonth("");setPage(1);}}>Clear</Button>}
    </div>

    {/* ── List ── */}
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,overflow:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>
        {["ID","Code","Payee","Amount","Vendor Inv#","Due","Tax Paid","Status","Closed","Registered","Paid Date","Notes",""].map(h=><th key={h} style={S.th}>{h}</th>)}
      </tr></thead>
      <tbody>{items.length===0?<tr><td colSpan={13} style={S.empty}>No general expenses.</td></tr>:items.map(item=>{
        const parsed=parseMemo(item.memo);
        const itemsList=item.items||[];
        const amt=M.round(item.total);
        const hasPaidDate=!!item.paidDate;
        const statusLabel=amt<=0?"ACCRUED":hasPaidDate?"REMITTED":"SLIPPED";
        const statusColor=amt<=0?C.purple:hasPaidDate?C.green:C.blue;
        return(<tr key={item.id} style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>startEdit(item)} onMouseEnter={e=>e.currentTarget.style.background=C.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <td style={S.td}><IdLink id={item.id} color={C.orange} onClick={()=>startEdit(item)}/></td>
          <td style={S.td}>{itemsList.map((l,li)=><div key={li} style={{lineHeight:"1.4"}}><span style={{fontFamily:F.mono,fontSize:11,color:C.orange}}>{l.code}</span><span style={{fontSize:10,color:C.textDim,marginLeft:4}}>{l.label}</span>{itemsList.length>1&&<span style={{fontFamily:F.mono,fontSize:10,color:C.textMuted,marginLeft:4}}>${M.round(l.amount).toFixed(2)}</span>}</div>)}</td>
          <td style={S.td}><span style={{fontSize:12,color:C.text}}>{item.payee||"—"}</span></td>
          <td style={S.td}><span style={{fontFamily:F.mono,fontSize:12,color:C.text}}>{item.currency||"CAD"} ${(item.total||0).toFixed(2)}</span></td>
          <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11,color:item.invoiceNum?C.text:C.textMuted}}>{item.invoiceNum||"—"}</span>{parsed.vendorInvDate&&<span style={{fontSize:9,color:C.textDim,marginLeft:4}}>{parsed.vendorInvDate}</span>}</td>
          <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11,color:item.dueDate?C.text:C.textMuted}}>{item.dueDate||"—"}</span></td>
          <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11,color:(item.taxPaidComponents||[]).length>0||item.taxPaid?C.cyan:C.textMuted}}>{(item.taxPaidComponents||[]).length>0?(item.taxPaidComponents||[]).map(c=>`${c.type} $${M.round(c.amount).toFixed(2)}`).join(", "):item.taxPaid?`$${M.round(item.taxPaid).toFixed(2)}`:"—"}</span></td>
          <td style={S.td}><span style={{fontSize:10,fontWeight:700,color:statusColor,padding:"2px 8px",borderRadius:4,border:`1px solid ${statusColor}30`,background:`${statusColor}10`}}>{statusLabel}</span></td>
          <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11,color:C.textDim}}>{(item.closedMonth||"—")}</span></td>
          <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11,color:C.text}}>{item.date||"—"}</span></td>
          <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11,color:item.paidDate?C.green:C.textMuted}}>{item.paidDate||"—"}</span></td>
          <td style={S.td}><span style={{fontSize:11,color:C.textDim,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"inline-block"}}>{parsed.notes||"—"}</span></td>
          <td style={S.td}><button onClick={e=>{e.stopPropagation();deleteExpense(item.id);}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:13,fontWeight:700}}>×</button></td>
        </tr>);
      })}</tbody></table>
    </div>
    <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage}/>

    {/* ── Add Custom Code Modal ── */}
    {showAddCode&&<div style={S.modal} onClick={()=>setShowAddCode(false)}><div style={{background:C.surface,borderRadius:12,padding:24,width:400,border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
      <h3 style={{margin:"0 0 16px",fontFamily:F.display,color:C.text,fontSize:15}}>Add Custom Code</h3>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Input label="Code" value={newCodeCode} onChange={v=>setNewCodeCode(v.toUpperCase())} placeholder="e.g. RNT"/>
        <Input label="Label" value={newCodeLabel} onChange={setNewCodeLabel} placeholder="e.g. Office Rent"/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Button variant="ghost" onClick={()=>setShowAddCode(false)}>Cancel</Button><Button onClick={addCustomCode} disabled={!newCodeCode||!newCodeLabel}>Add</Button></div>
    </div></div>}
  </div>);
}

// ═══════ CLOSING PAGE ═══════
function ClosingPage({onOpenARAP,onNav}){
  const[jobs,setJobs]=useState([]);const[geItems,setGeItems]=useState([]);
  const[createdFrom,setCreatedFrom]=useState("");const[createdTo,setCreatedTo]=useState("");
  const[search,setSearch]=useState("");const dSearch=useDebounce(search);
  const[page,setPage]=useState(1);const PAGE_SIZE=50;
  const[selected,setSelected]=useState(new Set());const[expanded,setExpanded]=useState(new Set());
  const[saving,setSaving]=useState(false);
  const[closeMonth,setCloseMonth]=useState(new Date().toISOString().slice(0,7));
  const[showClosePrompt,setShowClosePrompt]=useState(false);

  const load=async()=>{
    if(!window.db)return;
    const opts={limit:999,offset:0,search:dSearch,createdFrom,createdTo};
    const jList=await window.db.jobs.list(opts);
    setJobs(jList||[]);
    const allAp=await window.db.ap.list({dateFrom:createdFrom,dateTo:createdTo,payee:"",limit:999,offset:0});
    let ges=(allAp||[]).filter(a=>a.type==="General");
    if(dSearch){const q=dSearch.toLowerCase();ges=ges.filter(a=>(a.id||"").toLowerCase().includes(q)||(a.payee||"").toLowerCase().includes(q)||(a.memo||"").toLowerCase().includes(q));}
    setGeItems(ges);
    setSelected(new Set());
  };
  useEffect(()=>{load();},[dSearch,createdFrom,createdTo]);

  // Combine and paginate
  const allRows=[];
  jobs.forEach(j=>allRows.push({type:"BL",id:j.id,data:j,createdAt:(j.createdAt||"").slice(0,10),closed:!!j.closedMonth,closedMonth:j.closedMonth||""}));
  geItems.forEach(g=>allRows.push({type:"GE",id:g.id,data:g,createdAt:(g.createdAt||"").slice(0,10),closed:!!g.closedMonth,closedMonth:g.closedMonth||""}));
  const totalPages=Math.max(1,Math.ceil(allRows.length/PAGE_SIZE));
  const pageRows=allRows.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);

  const toggleSelect=(id)=>setSelected(p=>{const n=new Set(p);if(n.has(id))n.delete(id);else n.add(id);return n;});
  const selectAll=()=>{if(selected.size===pageRows.filter(r=>!r.closed).length)setSelected(new Set());else{const n=new Set();pageRows.forEach(r=>{if(!r.closed)n.add(r.type+":"+r.id);});setSelected(n);}};
  const toggleExpand=(id)=>setExpanded(p=>{const n=new Set(p);if(n.has(id))n.delete(id);else n.add(id);return n;});

  const handleClose=async()=>{
    if(selected.size===0||!closeMonth)return;
    if(!await showConfirm(`Close ${selected.size} item(s) into month ${closeMonth}?`))return;
    setSaving(true);setShowClosePrompt(false);
    try{
      const jobIds=[],geIds=[];
      for(const key of selected){const[t,id]=key.split(":");if(t==="BL")jobIds.push(id);else geIds.push(id);}
      if(jobIds.length>0)await window.db.jobs.bulkClose(jobIds,closeMonth);
      if(geIds.length>0)await window.db.ap.bulkClose(geIds,closeMonth);
      await load();
    }catch(e){await showAlert("Error: "+e.message);}
    setSaving(false);
  };

  const handleReopen=async(type,id)=>{
    if(!await showConfirm(`Reopen ${id}?`))return;
    setSaving(true);
    try{
      if(type==="BL")await window.db.jobs.bulkReopen([id]);
      else await window.db.ap.bulkReopen([id]);
      await load();
    }catch(e){await showAlert("Error: "+e.message);}
    setSaving(false);
  };

  // Helper to get BL sub-items (AR/AP charges)
  const getBLCharges=(job)=>{
    const items=[];
    const addCharges=(charges,side)=>{
      if(!charges)return;
      for(const[key,val]of Object.entries(charges)){
        if(key.startsWith("_")||key.includes("_"))continue;
        const amt=M.round(val);if(!amt)continue;
        const cur=charges[key+"_cur"]||"CAD";
        const note=charges[key+"_note"]||"";
        const disb=!!charges[key+"_disb"];
        items.push({code:key,amount:amt,currency:cur,notes:note,disb,side});
      }
      const manualAP=charges._manualAP||[];
      manualAP.forEach(l=>{const amt=M.round(l.amount);if(amt)items.push({code:l.code,amount:amt,currency:l.currency||"CAD",notes:l.notes||"",side:"AP"});});
    };
    if(job.cbEnabled)addCharges(job.cb,"CB");
    if(job.ffEnabled)addCharges(job.ff,"FF");
    return items;
  };

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h1 style={S.pt}>📅 Closing</h1>
      <Button onClick={()=>{if(selected.size===0)return;setShowClosePrompt(true);}} disabled={saving||selected.size===0}>{saving?"Closing...":(`🔒 Close (${selected.size})`)}</Button>
    </div>

    {/* Close month prompt */}
    {showClosePrompt&&<div style={S.modal} onClick={()=>setShowClosePrompt(false)}><div style={{background:C.surface,borderRadius:14,padding:24,width:360,border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
      <h3 style={{margin:"0 0 16px",fontFamily:F.display,color:C.text,fontSize:15}}>Close into which month?</h3>
      <input type="month" value={closeMonth} onChange={e=>setCloseMonth(e.target.value)} style={{width:"100%",fontFamily:F.mono,fontSize:14,padding:"10px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",marginBottom:16}}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <Button variant="ghost" onClick={()=>setShowClosePrompt(false)}>Cancel</Button>
        <Button onClick={handleClose} disabled={!closeMonth}>🔒 Close {selected.size} items into {closeMonth}</Button>
      </div>
    </div></div>}

    {/* Filters */}
    <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"flex-end",flexWrap:"wrap"}}>
      <Input value={search} onChange={v=>{setSearch(v);setPage(1);}} placeholder="Search ID, Customer, Payee..." style={{flex:1,minWidth:200}}/>
      <div><label style={S.label}>From</label><input type="date" value={createdFrom} onChange={e=>{setCreatedFrom(e.target.value);setPage(1);}} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
      <div><label style={S.label}>To</label><input type="date" value={createdTo} onChange={e=>{setCreatedTo(e.target.value);setPage(1);}} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
      {(createdFrom||createdTo)&&<Button variant="ghost" size="sm" onClick={()=>{setCreatedFrom("");setCreatedTo("");setPage(1);}}>Clear</Button>}
    </div>

    {/* Table */}
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,overflow:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>
        <th style={{...S.th,width:30}}><input type="checkbox" onChange={selectAll} checked={pageRows.filter(r=>!r.closed).length>0&&selected.size===pageRows.filter(r=>!r.closed).length}/></th>
        <th style={{...S.th,width:24}}></th>
        <th style={S.th}>Type</th>
        <th style={S.th}>ID</th>
        <th style={S.th}>Customer / Payee</th>
        <th style={S.th}>Created</th>
        <th style={S.th}>Pay Status</th>
        <th style={S.th}>Closed</th>
        <th style={{...S.th,width:60}}></th>
      </tr></thead>
      <tbody>{pageRows.length===0?<tr><td colSpan={9} style={S.empty}>No records found.</td></tr>:pageRows.map(row=>{
        const key=row.type+":"+row.id;
        const isExpanded=expanded.has(key);
        const isClosed=row.closed;
        const rs=row.type==="BL"?blRemitStatus(row.data):(()=>{const amt=M.round(row.data.total);if(amt<=0)return{status:"ACCRUED",color:C.purple};return row.data.paidDate?{status:"REMITTED",color:C.green}:{status:"SLIPPED",color:C.blue};})();
        return(<React.Fragment key={key}>
          <tr style={{borderBottom:`1px solid ${C.border}`,opacity:isClosed?0.45:1}} onMouseEnter={e=>{if(!isClosed)e.currentTarget.style.background=C.surfaceHover;}} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <td style={S.td}>{!isClosed&&<input type="checkbox" checked={selected.has(key)} onChange={()=>toggleSelect(key)} style={{accentColor:C.accent}}/>}</td>
            <td style={{...S.td,cursor:"pointer",userSelect:"none"}} onClick={()=>toggleExpand(key)}><span style={{fontSize:11,color:C.textDim,transition:"transform .2s",display:"inline-block",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>▶</span></td>
            <td style={S.td}><Badge color={row.type==="BL"?C.accent:C.orange}>{row.type}</Badge></td>
            <td style={S.td}><IdLink id={row.id} color={row.type==="BL"?C.accent:C.orange} onClick={row.type==="BL"?()=>loadJobAndOpen(row.id,onOpenARAP):onNav?()=>onNav("genexp"):null}/></td>
            <td style={S.td}><span style={{fontSize:12,color:C.text}}>{row.type==="BL"?row.data.customer:(row.data.payee||"—")}</span></td>
            <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11,color:C.textDim}}>{row.createdAt||"—"}</span></td>
            <td style={S.td}>{rs.status&&<span style={{fontSize:10,fontWeight:700,color:rs.color,padding:"2px 8px",borderRadius:4,border:`1px solid ${rs.color}30`,background:`${rs.color}10`}}>{rs.status}</span>}</td>
            <td style={S.td}>{isClosed?<span style={{fontSize:10,fontWeight:700,color:C.green,padding:"2px 8px",borderRadius:4,border:`1px solid ${C.green}30`,background:`${C.green}10`}}>{row.closedMonth}</span>:<span style={{fontSize:10,color:C.textMuted}}>Open</span>}</td>
            <td style={S.td}>{isClosed&&<button onClick={()=>handleReopen(row.type,row.id)} disabled={saving} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:4,color:C.textDim,cursor:"pointer",fontSize:10,fontWeight:600,padding:"2px 8px",fontFamily:F.body}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.orange} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>Reopen</button>}</td>
          </tr>
          {isExpanded&&<tr style={{background:`${C.accent}04`}}><td colSpan={9} style={{padding:"8px 16px 12px 52px"}}>
            {row.type==="BL"?(()=>{
              const charges=getBLCharges(row.data);
              if(charges.length===0)return<div style={{fontSize:11,color:C.textMuted}}>No AR/AP charges recorded.</div>;
              return(<div>
                <div style={{fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",marginBottom:6}}>Charges</div>
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  {charges.map((ch,ci)=><div key={ci} style={{display:"flex",gap:10,fontSize:11,alignItems:"center"}}>
                    <span style={{fontFamily:F.mono,color:ch.side==="CB"?C.accent:C.orange,fontWeight:600,width:28}}>{ch.code}</span>
                    <span style={{fontFamily:F.mono,width:90,textAlign:"right"}}>{ch.currency} {ch.amount.toFixed(2)}</span>
                    {ch.disb&&<Badge color={C.orange} style={{fontSize:8}}>Disb</Badge>}
                    {ch.notes&&<span style={{color:C.textDim,fontSize:10}}>{ch.notes}</span>}
                  </div>)}
                </div>
                {row.data.cbInvoices?.length>0&&<div style={{marginTop:6,fontSize:10,color:C.textDim}}>CB Invoices: {row.data.cbInvoices.join(", ")}</div>}
                {row.data.ffInvoices?.length>0&&<div style={{fontSize:10,color:C.textDim}}>FF Invoices: {row.data.ffInvoices.join(", ")}</div>}
              </div>);
            })():(()=>{
              const pm=parseMemo(row.data.memo);
              const itemsList=row.data.items||[];
              return(<div style={{display:"flex",flexDirection:"column",gap:4,fontSize:11}}>
                {itemsList.map((li,li_i)=><div key={li_i} style={{display:"flex",gap:12}}>
                  <span><strong>{li_i===0?"Items:":""}</strong> <span style={{fontFamily:F.mono,color:C.orange}}>{li.code}</span> {li.label} <span style={{fontFamily:F.mono}}>${M.round(li.amount).toFixed(2)}</span></span>
                </div>)}
                <div style={{display:"flex",gap:12}}>
                  <span><strong>Total:</strong> <span style={{fontFamily:F.mono}}>{row.data.currency||"CAD"} ${(row.data.total||0).toFixed(2)}</span></span>
                  <span><strong>Payee:</strong> {row.data.payee||"—"}</span>
                  <span><strong>Date:</strong> {row.data.date||"—"}</span>
                  <span><strong>Paid:</strong> <span style={{color:row.data.paidDate?C.green:C.textMuted}}>{row.data.paidDate||"Not paid"}</span></span>
                </div>
                {pm.notes&&<div><strong>Notes:</strong> {pm.notes}</div>}
              </div>);
            })()}
          </td></tr>}
        </React.Fragment>);
      })}</tbody></table>
    </div>
    <Pagination page={page} totalPages={totalPages} total={allRows.length} onPage={setPage}/>
  </div>);
}

// ═══════ REPORTS PAGE ═══════
const REPORT_TABS=[
  {id:"closing",label:"Closing",icon:"📅"},
  {id:"soa",label:"SOA",icon:"📄"},
  {id:"arAging",label:"AR Aging",icon:"⏳"},
  {id:"apAging",label:"AP Aging",icon:"⏳"},
  {id:"revByCust",label:"Revenue / Customer",icon:"👥"},
  {id:"profitByPeriod",label:"Profit / Period",icon:"📊"},
];

function ReportsPage({onOpenARAP,onNav}){
  const[tab,setTab]=useState("closing");

  // ── Shared helpers ──
  const parseMemo=(memo)=>{const c=(memo||"").match(/closing:(\d{4}-\d{2})/);return c?c[1]:"";};
  const extractCharges=(charges)=>{
    const ar=[],ap=[];if(!charges)return{ar,ap};
    for(const[key,val]of Object.entries(charges)){
      if(key.startsWith("_")||key.includes("_"))continue;
      const amt=M.round(val);const cur=charges[key+"_cur"]||"CAD";const disb=!!charges[key+"_disb"];
      ar.push({code:key,amount:amt,currency:cur,disb});
      if(disb)ap.push({code:key,amount:amt,currency:cur,source:"Disb"});
    }
    const manualAP=charges._manualAP||[];
    for(const l of manualAP){const amt=M.round(l.amount);ap.push({code:l.code,amount:amt,currency:l.currency||"CAD",source:"Manual"});}
    return{ar,ap};
  };
  const fmt=n=>M.fmt(n);

  // ════════ CLOSING REPORT ════════
  const[clMonth,setClMonth]=useState("");const[clReport,setClReport]=useState(null);const[clLoading,setClLoading]=useState(false);
  const genClosing=async()=>{
    if(!clMonth||!window.db)return;setClLoading(true);
    try{
      const allJobs=await window.db.jobs.list({limit:9999,offset:0,search:"",createdMonth:""});
      const allAp=await window.db.ap.list({dateFrom:"",dateTo:"",payee:"",limit:9999,offset:0});
      const allGE=(allAp||[]).filter(a=>a.type==="General"&&parseMemo(a.memo)===clMonth);
      const allInv=await window.db.invoices.list({limit:9999,offset:0});
      const closedBLs=(allJobs||[]).filter(j=>!!j.closedMonth);const accruedBLs=(allJobs||[]).filter(j=>!j.closedMonth);
      const closedGEs=allGE.filter(g=>!!g.closedMonth);const accruedGEs=allGE.filter(g=>!g.closedMonth);
      let totalAR=0,totalAP=0;const blRows=[];
      for(const job of closedBLs){let jAR=0,jAP=0;const proc=ch=>{const{ar,ap}=extractCharges(ch);ar.forEach(c=>{jAR=M.sum(jAR,c.amount);});ap.forEach(c=>{jAP=M.sum(jAP,c.amount);});};
        if(job.cbEnabled)proc(job.cb);if(job.ffEnabled)proc(job.ff);totalAR=M.sum(totalAR,jAR);totalAP=M.sum(totalAP,jAP);blRows.push({id:job.id,customer:job.customer,bl:job.bl||job.mbl||"—",ar:jAR,ap:jAP,net:M.sub(jAR,jAP)});}
      let totalGE=0;const geRows=[];
      for(const ge of closedGEs){const amt=M.round(ge.total);totalGE=M.sum(totalGE,amt);geRows.push({id:ge.id,payee:ge.payee||"—",code:(ge.items||[]).map(l=>l.code).filter(Boolean).join(", ")||"—",amount:amt,currency:ge.currency||"CAD"});}
      let accAR=0,accAP=0;const accBLRows=[];
      for(const job of accruedBLs){let jAR=0,jAP=0;const proc=ch=>{const{ar,ap}=extractCharges(ch);ar.forEach(c=>{jAR=M.sum(jAR,c.amount);});ap.forEach(c=>{jAP=M.sum(jAP,c.amount);});};
        if(job.cbEnabled)proc(job.cb);if(job.ffEnabled)proc(job.ff);accAR=M.sum(accAR,jAR);accAP=M.sum(accAP,jAP);accBLRows.push({id:job.id,customer:job.customer,bl:job.bl||job.mbl||"—",ar:jAR,ap:jAP,net:M.sub(jAR,jAP)});}
      let accGET=0;const accGERows=[];
      for(const ge of accruedGEs){const amt=M.round(ge.total);accGET=M.sum(accGET,amt);accGERows.push({id:ge.id,payee:ge.payee||"—",code:(ge.items||[]).map(l=>l.code).filter(Boolean).join(", ")||"—",amount:amt,currency:ge.currency||"CAD"});}
      // Tax
      const taxMap={};const closedIds=new Set(closedBLs.map(j=>j.id));
      for(const inv of (allInv||[])){if(!closedIds.has(inv.jobId))continue;const comps=inv.taxComponents||[];
        if(comps.length>0){for(const c of comps){const k=c.label||c.type;if(!taxMap[k])taxMap[k]={type:c.type,collected:0,paid:0};taxMap[k].collected=M.sum(taxMap[k].collected,c.amount);}}
        else{const l=inv.taxLabel||(PROVINCE_TAX[inv.province]||{}).label||"Tax";if(!taxMap[l])taxMap[l]={type:"Legacy",collected:0,paid:0};taxMap[l].collected=M.sum(taxMap[l].collected,inv.taxAmount);}}
      // Aggregate tax paid (input tax credits) by exact label from closed BL charges + closed GEs
      const taxPaidByLabel={};
      const addTPC=comps=>{for(const c of (comps||[])){if(c.label&&c.amount){const k=c.label;taxPaidByLabel[k]=M.sum(taxPaidByLabel[k]||0,c.amount);if(!taxPaidByLabel[k+"_type"])taxPaidByLabel[k+"_type"]=c.type;}}};
      for(const job of closedBLs){
        const proc=ch=>{if(!ch)return;
          for(const[key]of Object.entries(ch)){
            if(key.endsWith("_taxPaidComponents"))addTPC(ch[key]);
          }
          const manAP=ch._manualAP||[];
          for(const l of manAP)addTPC(l.taxPaidComponents);
        };
        if(job.cbEnabled)proc(job.cb);if(job.ffEnabled)proc(job.ff);
      }
      for(const ge of closedGEs){
        addTPC(ge.taxPaidComponents);
        // Fallback: old GEs with taxPaid number but no components
        if((!ge.taxPaidComponents||ge.taxPaidComponents.length===0)&&M.round(ge.taxPaid)>0){
          taxPaidByLabel["Tax Paid (Unclassified)"]=M.sum(taxPaidByLabel["Tax Paid (Unclassified)"]||0,ge.taxPaid);
          taxPaidByLabel["Tax Paid (Unclassified)_type"]="GST";
        }
      }
      // Fallback: old BL charges with _taxPaid but no _taxPaidComponents
      for(const job of closedBLs){
        const procFallback=ch=>{if(!ch)return;
          for(const[key,val]of Object.entries(ch)){
            if(key.endsWith("_taxPaid")&&!key.endsWith("_taxPaidComponents")){
              const tpcKey=key.replace("_taxPaid","_taxPaidComponents");
              if(!ch[tpcKey]||ch[tpcKey].length===0){
                if(M.round(val)>0){taxPaidByLabel["Tax Paid (Unclassified)"]=M.sum(taxPaidByLabel["Tax Paid (Unclassified)"]||0,val);taxPaidByLabel["Tax Paid (Unclassified)_type"]="GST";}
              }
            }
          }
          const manAP=ch._manualAP||[];
          for(const l of manAP){
            if((!l.taxPaidComponents||l.taxPaidComponents.length===0)&&M.round(l.taxPaid)>0){
              taxPaidByLabel["Tax Paid (Unclassified)"]=M.sum(taxPaidByLabel["Tax Paid (Unclassified)"]||0,l.taxPaid);
              taxPaidByLabel["Tax Paid (Unclassified)_type"]="GST";
            }
          }
        };
        if(job.cbEnabled)procFallback(job.cb);if(job.ffEnabled)procFallback(job.ff);
      }
      // Place paid amounts into matching taxMap rows by exact label
      for(const[label,pAmt]of Object.entries(taxPaidByLabel)){
        if(label.endsWith("_type")||pAmt<=0)continue;
        const pType=taxPaidByLabel[label+"_type"]||"GST";
        if(taxMap[label]){
          // Exact label match — put paid directly
          taxMap[label].paid=M.sum(taxMap[label].paid,pAmt);
        } else {
          // No matching collected row — create ITC row
          taxMap[label]={type:pType,collected:0,paid:pAmt};
        }
      }
      const txOrd={GST:0,HST:1,PST:2,QST:3,Custom:4,Legacy:5};
      const taxRows=Object.entries(taxMap).filter(([,v])=>v.collected>0||v.paid>0).map(([l,v])=>({label:l,type:v.type,collected:v.collected,paid:v.paid,net:M.sub(v.collected,v.paid)})).sort((a,b)=>(txOrd[a.type]??9)-(txOrd[b.type]??9));
      setClReport({month:clMonth,closedBLs:blRows,closedGEs:geRows,accruedBLs:accBLRows,accruedGEs:accGERows,totalAR,totalAP,totalGE,netProfit:M.sub(M.sub(totalAR,totalAP),totalGE),accruedAR:accAR,accruedAP:accAP,accruedGETotal:accGET,taxRows,
        closedBLCount:closedBLs.length,accruedBLCount:accruedBLs.length,closedGECount:closedGEs.length,accruedGECount:accruedGEs.length});
    }catch(e){await showAlert("Error: "+e.message);}setClLoading(false);
  };
  const printClosing=()=>{
    if(!clReport)return;const r=clReport;
    const blH=r.closedBLs.map(b=>`<tr><td>${esc(b.id)}</td><td>${esc(b.customer)}</td><td>${esc(b.bl)}</td><td style="text-align:right">${fmt(b.ar)}</td><td style="text-align:right">${fmt(b.ap)}</td><td style="text-align:right;font-weight:600">${fmt(b.net)}</td></tr>`).join("");
    const geH=r.closedGEs.map(g=>`<tr><td>${esc(g.id)}</td><td>${esc(g.code)}</td><td>${esc(g.payee)}</td><td style="text-align:right">${fmt(g.amount)}</td></tr>`).join("");
    const aBH=r.accruedBLs.map(b=>`<tr><td>${esc(b.id)}</td><td>${esc(b.customer)}</td><td>${esc(b.bl)}</td><td style="text-align:right">${fmt(b.ar)}</td><td style="text-align:right">${fmt(b.ap)}</td><td style="text-align:right">${fmt(b.net)}</td></tr>`).join("");
    const aGH=r.accruedGEs.map(g=>`<tr><td>${esc(g.id)}</td><td>${esc(g.code)}</td><td>${esc(g.payee)}</td><td style="text-align:right">${fmt(g.amount)}</td></tr>`).join("");
    const tH=r.taxRows.map(t=>`<tr><td>${esc(t.label)}</td><td style="text-align:right">${fmt(t.collected)}</td><td style="text-align:right">${fmt(t.paid)}</td><td style="text-align:right;font-weight:600">${fmt(t.net)}</td></tr>`).join("");
    const tTC=r.taxRows.reduce((s,t)=>s+t.collected,0);const tTP=r.taxRows.reduce((s,t)=>s+t.paid,0);
    const ttR=r.taxRows.length>1?`<tr style="border-top:2px solid #333;font-weight:700"><td>Total Tax</td><td style="text-align:right">${fmt(tTC)}</td><td style="text-align:right">${fmt(tTP)}</td><td style="text-align:right">${fmt(tTC-tTP)}</td></tr>`:"";
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Closing Report ${r.month}</title><style>body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:900px;margin:30px auto;color:#222;padding:20px;font-size:12px}h1{font-size:22px;color:#1e3a5f;margin:0}h2{font-size:14px;color:#1e3a5f;margin:24px 0 8px;border-bottom:2px solid #4cb8c4;padding-bottom:4px}h3{font-size:12px;color:#7c6b8a;margin:20px 0 6px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;border-bottom:2px solid #ddd}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:12px}.summary{display:flex;gap:16px;margin:20px 0}.sb{flex:1;background:#f8f9fa;border-radius:8px;padding:14px;border:1px solid #e5e7eb}.sb .l{font-size:10px;color:#666;text-transform:uppercase;font-weight:600}.sb .v{font-size:20px;font-weight:700;font-family:monospace;margin-top:4px}.grn{color:#3a8a5c}.red{color:#c4533a}.pur{color:#7c6b8a}@media print{body{margin:10px;padding:10px}}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h1>CLIK — Closing Report</h1><div style="font-size:13px;color:#666;margin-top:4px">Month: <strong>${r.month}</strong></div></div><div style="font-size:11px;color:#999">Generated: ${new Date().toLocaleDateString()}</div></div>
<div class="summary"><div class="sb"><div class="l">Total AR</div><div class="v grn">${fmt(r.totalAR)}</div></div><div class="sb"><div class="l">Total AP</div><div class="v red">${fmt(r.totalAP)}</div></div><div class="sb"><div class="l">General Expenses</div><div class="v" style="color:#c08830">${fmt(r.totalGE)}</div></div><div class="sb"><div class="l">Net Profit</div><div class="v ${r.netProfit>=0?"grn":"red"}">${fmt(r.netProfit)}</div></div></div>
<h2>Closed BLs (${r.closedBLCount})</h2>${blH?`<table><thead><tr><th>Job ID</th><th>Customer</th><th>BL #</th><th style="text-align:right">AR</th><th style="text-align:right">AP</th><th style="text-align:right">Net</th></tr></thead><tbody>${blH}<tr style="border-top:2px solid #333;font-weight:700"><td colspan="3">Subtotal</td><td style="text-align:right">${fmt(r.totalAR)}</td><td style="text-align:right">${fmt(r.totalAP)}</td><td style="text-align:right">${fmt(r.totalAR-r.totalAP)}</td></tr></tbody></table>`:`<p style="color:#999">None</p>`}
${geH?`<h2>Closed GE (${r.closedGECount})</h2><table><thead><tr><th>ID</th><th>Code</th><th>Payee</th><th style="text-align:right">Amount</th></tr></thead><tbody>${geH}<tr style="border-top:2px solid #333;font-weight:700"><td colspan="3">Subtotal</td><td style="text-align:right">${fmt(r.totalGE)}</td></tr></tbody></table>`:""}
${tH?`<h2>Tax Summary</h2><table><thead><tr><th>Tax Type</th><th style="text-align:right">Collected</th><th style="text-align:right">Paid</th><th style="text-align:right">Net</th></tr></thead><tbody>${tH}${ttR}</tbody></table>`:""}
${aBH||aGH?`<h2 style="color:#7c6b8a;border-color:#7c6b8a">ACCRUED (Not Closed)</h2><p style="font-size:11px;color:#666">Items with closing month ${r.month} not yet closed.</p>`:""}
${aBH?`<h3>Accrued BLs (${r.accruedBLCount})</h3><table><thead><tr><th>Job ID</th><th>Customer</th><th>BL #</th><th style="text-align:right">AR</th><th style="text-align:right">AP</th><th style="text-align:right">Net</th></tr></thead><tbody>${aBH}<tr style="border-top:2px solid #7c6b8a;font-weight:700;color:#7c6b8a"><td colspan="3">Subtotal</td><td style="text-align:right">${fmt(r.accruedAR)}</td><td style="text-align:right">${fmt(r.accruedAP)}</td><td style="text-align:right">${fmt(r.accruedAR-r.accruedAP)}</td></tr></tbody></table>`:""}
${aGH?`<h3>Accrued GE (${r.accruedGECount})</h3><table><thead><tr><th>ID</th><th>Code</th><th>Payee</th><th style="text-align:right">Amount</th></tr></thead><tbody>${aGH}<tr style="border-top:2px solid #7c6b8a;font-weight:700;color:#7c6b8a"><td colspan="3">Subtotal</td><td style="text-align:right">${fmt(r.accruedGETotal)}</td></tr></tbody></table>`:""}
</body></html>`;
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const w=window.open(url,"_blank");if(w)setTimeout(()=>{w.print();},500);
  };

  // ════════ SOA (Statement of Account) ════════
  const[soaCust,setSoaCust]=useState("");const[soaData,setSoaData]=useState(null);const[soaLoading,setSoaLoading]=useState(false);const[custList,setCustList]=useState([]);
  useEffect(()=>{setCustList([...DB.customers]);},[tab]);
  const genSOA=async()=>{
    if(!soaCust||!window.db)return;setSoaLoading(true);
    try{
      const allInv=await window.db.invoices.list({limit:9999,offset:0});
      const custInvs=(allInv||[]).filter(i=>i.customer===soaCust&&!i.consolidatedInto).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
      const rows=custInvs.map(inv=>{
        const paid=(inv.payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
        const balance=M.sub(inv.total,paid);
        const status=paid>=inv.total&&inv.total>0?"PAID":"UNPAID";
        const statusColor=status==="PAID"?"#3a8a5c":"#c4533a";
        return{invNum:inv.invoiceNumber,date:inv.date,dueDate:inv.dueDate||"",total:M.round(inv.total),currency:inv.invoiceCurrency||"CAD",fxRate:inv.fxRate||1,paid,balance,status,statusColor,consolidated:inv.consolidatedFrom&&inv.consolidatedFrom.length>0};
      });
      const totalOwed=rows.filter(r=>r.status!=="PAID").reduce((s,r)=>M.sum(s,r.balance),0);
      const totalInvoiced=rows.reduce((s,r)=>M.sum(s,r.total),0);
      const totalPaid=rows.reduce((s,r)=>M.sum(s,r.paid),0);
      let co={};try{co=await window.db.company.get()||{};}catch(_){}
      let custAddr="";try{custAddr=(await window.db.customers.findByName(soaCust))?.address||"";}catch(_){}
      setSoaData({customer:soaCust,custAddr,rows,totalOwed,totalInvoiced,totalPaid,co});
    }catch(e){await showAlert("Error: "+e.message);}setSoaLoading(false);
  };
  const printSOA=()=>{
    if(!soaData)return;const d=soaData;const co=d.co||{};
    const rowsH=d.rows.map(r=>`<tr style="opacity:${r.status==="PAID"?0.5:1}"><td>${esc(r.invNum)}</td><td>${esc(r.date)}</td><td>${esc(r.dueDate)}</td><td style="text-align:right">${fmt(r.total)}</td><td style="text-align:right">${fmt(r.paid)}</td><td style="text-align:right;font-weight:600;color:${r.balance>0?"#c4533a":"#3a8a5c"}">${fmt(r.balance)}</td><td><span style="font-size:10px;font-weight:700;color:${r.statusColor};padding:2px 6px;border-radius:3px;border:1px solid ${r.statusColor}40">${r.status}</span></td></tr>`).join("");
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>SOA — ${esc(d.customer)}</title><style>body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:800px;margin:30px auto;color:#222;padding:30px;font-size:13px}table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px;font-size:10px;text-transform:uppercase;color:#666;border-bottom:2px solid #4cb8c4}td{padding:8px;border-bottom:1px solid #eee}.total{border-top:2px solid #222;font-weight:700;font-size:14px}@media print{body{margin:10px;padding:20px}}</style></head><body>
<div style="display:flex;justify-content:space-between;margin-bottom:24px"><div><div style="font-size:24px;font-weight:800;color:#1e3a5f">CLIK</div>${co.companyName?`<div style="font-size:13px;font-weight:700;margin-top:6px">${esc(co.companyName)}</div>`:""}<div style="font-size:11px;color:#666;white-space:pre-wrap">${esc(co.address||"")}</div>${co.taxId?`<div style="font-size:11px;color:#666">GST/HST: ${esc(co.taxId)}</div>`:""}</div><div style="text-align:right"><div style="font-size:28px;font-weight:800;color:#1e3a5f">STATEMENT</div><div style="font-size:11px;color:#666;margin-top:4px">Date: ${new Date().toLocaleDateString()}</div></div></div>
<div style="background:#f8f9fa;border-radius:8px;padding:14px 18px;border:1px solid #e5e7eb;margin-bottom:24px"><div style="font-size:10px;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:4px">Statement For</div><div style="font-weight:700;font-size:15px">${esc(d.customer)}</div>${d.custAddr?`<div style="font-size:12px;color:#444;margin-top:3px">${esc(d.custAddr)}</div>`:""}</div>
<table><thead><tr><th>Invoice #</th><th>Date</th><th>Due Date</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th><th>Status</th></tr></thead><tbody>${rowsH}<tr class="total"><td colspan="3">Total</td><td style="text-align:right">${fmt(d.totalInvoiced)}</td><td style="text-align:right">${fmt(d.totalPaid)}</td><td style="text-align:right;color:#c4533a">${fmt(d.totalOwed)}</td><td></td></tr></tbody></table>
<div style="margin-top:30px;text-align:right;font-size:18px;font-weight:700;color:#1e3a5f">Amount Due: <span style="color:#c4533a">${fmt(d.totalOwed)}</span></div>
${co.notesTerms?`<div style="margin-top:30px;padding-top:16px;border-top:1px solid #ccc"><div style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px">Terms</div><div style="font-size:11px;color:#444;white-space:pre-wrap">${esc(co.notesTerms)}</div></div>`:""}
</body></html>`;
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const w=window.open(url,"_blank");if(w)setTimeout(()=>w.print(),500);
  };

  // ════════ AR AGING ════════
  const[arAgingData,setArAgingData]=useState(null);const[arAgingLoading,setArAgingLoading]=useState(false);
  const genArAging=async()=>{
    if(!window.db)return;setArAgingLoading(true);
    try{
      const allInv=await window.db.invoices.list({limit:9999,offset:0});
      const today=new Date();
      const buckets={current:[],d30:[],d60:[],d90:[]};
      for(const inv of (allInv||[])){
        const paid=(inv.payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
        const balance=M.sub(inv.total,paid);if(balance<=0)continue;
        const due=inv.dueDate?new Date(inv.dueDate):new Date(inv.date);
        const days=Math.floor((today-due)/(1000*60*60*24));
        const row={invNum:inv.invoiceNumber,customer:inv.customer,date:inv.date,dueDate:inv.dueDate||"",total:M.round(inv.total),paid,balance,days};
        if(days<=0)buckets.current.push(row);else if(days<=30)buckets.d30.push(row);else if(days<=60)buckets.d60.push(row);else buckets.d90.push(row);
      }
      setArAgingData(buckets);
    }catch(e){await showAlert("Error: "+e.message);}setArAgingLoading(false);
  };

  // ════════ AP AGING ════════
  const[apAgingData,setApAgingData]=useState(null);const[apAgingLoading,setApAgingLoading]=useState(false);
  const genApAging=async()=>{
    if(!window.db)return;setApAgingLoading(true);
    try{
      const allJobs=await window.db.jobs.list({limit:9999,offset:0,search:""});
      const today=new Date();const buckets={current:[],d30:[],d60:[],d90:[]};
      for(const job of (allJobs||[])){
        const processCharges=(charges,type)=>{
          if(!charges)return;
          for(const[key,val]of Object.entries(charges)){
            if(key.startsWith("_")||key.includes("_"))continue;
            if(!charges[key+"_disb"])continue;
            const amt=M.round(val);if(!amt)continue;
            const payments=charges[key+"_payments"]||[];
            const paid=payments.reduce((s,p)=>M.sum(s,p.amount),0);
            const balance=M.sub(amt,paid);if(balance<=0)continue;
            const created=new Date(job.createdAt||Date.now());
            const days=Math.floor((today-created)/(1000*60*60*24));
            const row={jobId:job.id,code:key,payee:charges[key+"_payee"]||"—",total:amt,paid,balance,days,customer:job.customer};
            if(days<=0)buckets.current.push(row);else if(days<=30)buckets.d30.push(row);else if(days<=60)buckets.d60.push(row);else buckets.d90.push(row);
          }
          const manualAP=charges._manualAP||[];
          for(const l of manualAP){
            const amt=M.round(l.amount);if(!amt)continue;
            const paid=(l.payments||[]).reduce((s,p)=>M.sum(s,p.amount),0);
            const balance=M.sub(amt,paid);if(balance<=0)continue;
            const days=Math.floor((today-new Date(job.createdAt||Date.now()))/(1000*60*60*24));
            const row={jobId:job.id,code:l.code,payee:l.payee||"—",total:amt,paid,balance,days,customer:job.customer};
            if(days<=0)buckets.current.push(row);else if(days<=30)buckets.d30.push(row);else if(days<=60)buckets.d60.push(row);else buckets.d90.push(row);
          }
        };
        if(job.cbEnabled)processCharges(job.cb,"CB");if(job.ffEnabled)processCharges(job.ff,"FF");
      }
      setApAgingData(buckets);
    }catch(e){await showAlert("Error: "+e.message);}setApAgingLoading(false);
  };

  // ════════ REVENUE BY CUSTOMER ════════
  const[revFrom,setRevFrom]=useState("");const[revTo,setRevTo]=useState("");const[revData,setRevData]=useState(null);const[revLoading,setRevLoading]=useState(false);
  const genRevByCust=async()=>{
    if(!window.db)return;setRevLoading(true);
    try{
      const allJobs=await window.db.jobs.list({limit:9999,offset:0,search:""});
      const custMap={};
      for(const job of (allJobs||[])){
        const cm=(job.closedMonth||"");
        if(revFrom&&cm<revFrom)continue;if(revTo&&cm>revTo)continue;
        let ar=0,ap=0;
        const proc=ch=>{const r=extractCharges(ch);r.ar.forEach(c=>{ar=M.sum(ar,c.amount);});r.ap.forEach(c=>{ap=M.sum(ap,c.amount);});};
        if(job.cbEnabled)proc(job.cb);if(job.ffEnabled)proc(job.ff);
        if(!custMap[job.customer])custMap[job.customer]={customer:job.customer,ar:0,ap:0,blCount:0};
        custMap[job.customer].ar=M.sum(custMap[job.customer].ar,ar);custMap[job.customer].ap=M.sum(custMap[job.customer].ap,ap);custMap[job.customer].blCount++;
      }
      const rows=Object.values(custMap).sort((a,b)=>b.ar-a.ar);
      setRevData(rows);
    }catch(e){await showAlert("Error: "+e.message);}setRevLoading(false);
  };

  // ════════ PROFIT BY PERIOD ════════
  const[ppFrom,setPpFrom]=useState("");const[ppTo,setPpTo]=useState("");const[ppData,setPpData]=useState(null);const[ppLoading,setPpLoading]=useState(false);
  const genProfitByPeriod=async()=>{
    if(!window.db)return;setPpLoading(true);
    try{
      const allJobs=await window.db.jobs.list({limit:9999,offset:0,search:""});
      const allAp=await window.db.ap.list({dateFrom:"",dateTo:"",payee:"",limit:9999,offset:0});
      const allGE=(allAp||[]).filter(a=>a.type==="General");
      const monthMap={};
      for(const job of (allJobs||[])){
        const cm=(job.closedMonth||"")||"Unknown";
        if(ppFrom&&cm<ppFrom)continue;if(ppTo&&cm>ppTo)continue;
        let ar=0,ap=0;
        const proc=ch=>{const r=extractCharges(ch);r.ar.forEach(c=>{ar=M.sum(ar,c.amount);});r.ap.forEach(c=>{ap=M.sum(ap,c.amount);});};
        if(job.cbEnabled)proc(job.cb);if(job.ffEnabled)proc(job.ff);
        if(!monthMap[cm])monthMap[cm]={month:cm,ar:0,ap:0,ge:0,blCount:0};
        monthMap[cm].ar=M.sum(monthMap[cm].ar,ar);monthMap[cm].ap=M.sum(monthMap[cm].ap,ap);monthMap[cm].blCount++;
      }
      for(const ge of allGE){
        const cm=parseMemo(ge.memo);if(!cm)continue;
        if(ppFrom&&cm<ppFrom)continue;if(ppTo&&cm>ppTo)continue;
        if(!monthMap[cm])monthMap[cm]={month:cm,ar:0,ap:0,ge:0,blCount:0};
        monthMap[cm].ge=M.sum(monthMap[cm].ge,ge.total);
      }
      const rows=Object.values(monthMap).sort((a,b)=>a.month.localeCompare(b.month));
      setPpData(rows);
    }catch(e){await showAlert("Error: "+e.message);}setPpLoading(false);
  };

  // ── Aging table renderer ──
  const AgingBucket=({label,color,rows,columns})=>{
    if(rows.length===0)return null;
    const bucketTotal=rows.reduce((s,r)=>M.sum(s,r.balance),0);
    return(<div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:700,color,fontFamily:F.display}}>{label} ({rows.length})</div>
        <span style={{fontFamily:F.mono,fontSize:13,fontWeight:700,color}}>{fmt(bucketTotal)}</span>
      </div>
      <div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>
          {columns.map(h=><th key={h.key} style={{...S.th,textAlign:h.align||"left"}}>{h.label}</th>)}
        </tr></thead><tbody>{rows.map((r,i)=><tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
          {columns.map(h=><td key={h.key} style={{...S.td,textAlign:h.align||"left"}}>{h.render?h.render(r):<span style={{fontFamily:h.mono?F.mono:F.body,fontSize:12}}>{r[h.key]}</span>}</td>)}
        </tr>)}</tbody></table>
      </div>
    </div>);
  };

  // ══════════ RENDER ══════════
  return(<div>
    <h1 style={S.pt}>📈 Reports</h1>

    {/* ── Tab selector ── */}
    <div style={{display:"flex",gap:4,marginTop:16,marginBottom:20,flexWrap:"wrap"}}>
      {REPORT_TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:7,border:tab===t.id?`1px solid ${C.accent}40`:`1px solid ${C.border}`,background:tab===t.id?C.accentGlow:"transparent",color:tab===t.id?C.accent:C.textDim,fontFamily:F.body,fontSize:12,fontWeight:tab===t.id?700:400,cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all .15s"}} onMouseEnter={e=>{if(tab!==t.id)e.currentTarget.style.background=C.surfaceHover;}} onMouseLeave={e=>{if(tab!==t.id)e.currentTarget.style.background="transparent";}}><span style={{fontSize:13}}>{t.icon}</span>{t.label}</button>)}
    </div>

    {/* ════════ CLOSING TAB ════════ */}
    {tab==="closing"&&<div>
      <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
          <div><label style={S.label}>Closing Month</label><input type="month" value={clMonth} onChange={e=>setClMonth(e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
          <Button onClick={genClosing} disabled={!clMonth||clLoading}>{clLoading?"Generating...":"Generate"}</Button>
          {clReport&&<Button variant="ghost" onClick={printClosing}>🖨 Print / PDF</Button>}
        </div>
      </div>
      {clReport&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,marginBottom:24}}>
          {[{l:"Total AR",v:fmt(clReport.totalAR),c:C.green},{l:"Total AP",v:fmt(clReport.totalAP),c:C.red},{l:"General Expenses",v:fmt(clReport.totalGE),c:C.orange},{l:"Net Profit",v:fmt(clReport.netProfit),c:clReport.netProfit>=0?C.green:C.red}].map(card=>
            <div key={card.l} style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16}}><div style={{fontSize:10,fontWeight:600,color:C.textMuted,textTransform:"uppercase"}}>{card.l}</div><div style={{fontSize:22,fontWeight:700,fontFamily:F.mono,color:card.c,marginTop:6}}>{card.v}</div></div>)}
        </div>
        {/* Closed BLs */}
        {clReport.closedBLs.length>0&&<div style={{marginBottom:20}}><div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:10}}>Closed BLs ({clReport.closedBLCount})</div>
          <div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>{["Job ID","Customer","BL #","AR","AP","Net"].map(h=><th key={h} style={{...S.th,textAlign:["AR","AP","Net"].includes(h)?"right":"left"}}>{h}</th>)}</tr></thead><tbody>
            {clReport.closedBLs.map(b=><tr key={b.id} style={{borderBottom:`1px solid ${C.border}`}}><td style={S.td}><IdLink id={b.id} onClick={()=>loadJobAndOpen(b.id,onOpenARAP)}/></td><td style={S.td}>{b.customer}</td><td style={S.td}><span style={{fontFamily:F.mono,fontSize:11}}>{b.bl}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.green}}>{fmt(b.ar)}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.red}}>{fmt(b.ap)}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:b.net>=0?C.green:C.red}}>{fmt(b.net)}</span></td></tr>)}
            <tr style={{borderTop:`2px solid ${C.text}`,background:C.card}}><td colSpan={3} style={{...S.td,fontWeight:700}}>Subtotal</td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.green}}>{fmt(clReport.totalAR)}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.red}}>{fmt(clReport.totalAP)}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700}}>{fmt(clReport.totalAR-clReport.totalAP)}</span></td></tr>
          </tbody></table></div></div>}
        {/* Closed GEs */}
        {clReport.closedGEs.length>0&&<div style={{marginBottom:20}}><div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:10}}>Closed GE ({clReport.closedGECount})</div>
          <div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>{["ID","Code","Payee","Amount"].map(h=><th key={h} style={{...S.th,textAlign:h==="Amount"?"right":"left"}}>{h}</th>)}</tr></thead><tbody>
            {clReport.closedGEs.map(g=><tr key={g.id} style={{borderBottom:`1px solid ${C.border}`}}><td style={S.td}><IdLink id={g.id} color={C.orange} onClick={onNav?()=>onNav("genexp"):null}/></td><td style={S.td}><span style={{fontFamily:F.mono,fontSize:11,color:C.orange}}>{g.code}</span></td><td style={S.td}>{g.payee}</td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono}}>{fmt(g.amount)}</span></td></tr>)}
            <tr style={{borderTop:`2px solid ${C.text}`,background:C.card}}><td colSpan={3} style={{...S.td,fontWeight:700}}>Subtotal</td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.orange}}>{fmt(clReport.totalGE)}</span></td></tr>
          </tbody></table></div></div>}
        {/* Tax Summary */}
        {clReport.taxRows.length>0&&<div style={{marginBottom:20}}><div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:10}}>Tax Summary</div>
          <div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>{["Tax Type","Collected (AR)","Paid (AP)","Net"].map(h=><th key={h} style={{...S.th,textAlign:h==="Tax Type"?"left":"right"}}>{h}</th>)}</tr></thead><tbody>
            {clReport.taxRows.map(t=><tr key={t.label} style={{borderBottom:`1px solid ${C.border}`}}><td style={S.td}><span style={{fontWeight:600}}>{t.label}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.green}}>{fmt(t.collected)}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.red}}>{fmt(t.paid)}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:t.net>=0?C.green:C.red}}>{fmt(t.net)}</span></td></tr>)}
            {clReport.taxRows.length>1&&<tr style={{borderTop:`2px solid ${C.text}`,background:C.card}}><td style={{...S.td,fontWeight:700}}>Total Tax</td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.green}}>{fmt(clReport.taxRows.reduce((s,t)=>s+t.collected,0))}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.red}}>{fmt(clReport.taxRows.reduce((s,t)=>s+t.paid,0))}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700}}>{fmt(clReport.taxRows.reduce((s,t)=>s+t.net,0))}</span></td></tr>}
          </tbody></table></div></div>}
        {/* Accrued */}
        {(clReport.accruedBLs.length>0||clReport.accruedGEs.length>0)&&<div style={{marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:700,color:C.purple,fontFamily:F.display,marginBottom:4}}>ACCRUED (Not Closed)</div>
          <div style={{fontSize:11,color:C.textDim,marginBottom:12}}>Items with closing month {clReport.month} not yet closed.</div>
          {clReport.accruedBLs.length>0&&<div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.purple}30`,overflow:"hidden",marginBottom:12}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:`${C.purple}08`}}>{["Job ID","Customer","BL #","AR","AP","Net"].map(h=><th key={h} style={{...S.th,textAlign:["AR","AP","Net"].includes(h)?"right":"left"}}>{h}</th>)}</tr></thead><tbody>
            {clReport.accruedBLs.map(b=><tr key={b.id} style={{borderBottom:`1px solid ${C.border}`}}><td style={S.td}><IdLink id={b.id} color={C.purple} onClick={()=>loadJobAndOpen(b.id,onOpenARAP)}/></td><td style={S.td}>{b.customer}</td><td style={S.td}><span style={{fontFamily:F.mono,fontSize:11}}>{b.bl}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono}}>{fmt(b.ar)}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono}}>{fmt(b.ap)}</span></td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:600}}>{fmt(b.net)}</span></td></tr>)}
          </tbody></table></div>}
          {clReport.accruedGEs.length>0&&<div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.purple}30`,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:`${C.purple}08`}}>{["ID","Code","Payee","Amount"].map(h=><th key={h} style={{...S.th,textAlign:h==="Amount"?"right":"left"}}>{h}</th>)}</tr></thead><tbody>
            {clReport.accruedGEs.map(g=><tr key={g.id} style={{borderBottom:`1px solid ${C.border}`}}><td style={S.td}><IdLink id={g.id} color={C.purple} onClick={onNav?()=>onNav("genexp"):null}/></td><td style={S.td}><span style={{fontFamily:F.mono,fontSize:11}}>{g.code}</span></td><td style={S.td}>{g.payee}</td><td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono}}>{fmt(g.amount)}</span></td></tr>)}
          </tbody></table></div>}
        </div>}
      </div>}
    </div>}

    {/* ════════ SOA TAB ════════ */}
    {tab==="soa"&&<div>
      <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:12}}>Statement of Account</div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
          <div><label style={S.label}>Customer</label><select value={soaCust} onChange={e=>setSoaCust(e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",minWidth:200}}><option value="">Select customer...</option>{custList.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
          <Button onClick={genSOA} disabled={!soaCust||soaLoading}>{soaLoading?"Loading...":"Generate SOA"}</Button>
          {soaData&&<Button variant="ghost" onClick={printSOA}>🖨 Print / PDF</Button>}
        </div>
      </div>
      {soaData&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
          {[{l:"Total Invoiced",v:fmt(soaData.totalInvoiced),c:C.text},{l:"Total Paid",v:fmt(soaData.totalPaid),c:C.green},{l:"Amount Due",v:fmt(soaData.totalOwed),c:soaData.totalOwed>0?C.red:C.green}].map(card=>
            <div key={card.l} style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16}}><div style={{fontSize:10,fontWeight:600,color:C.textMuted,textTransform:"uppercase"}}>{card.l}</div><div style={{fontSize:22,fontWeight:700,fontFamily:F.mono,color:card.c,marginTop:6}}>{card.v}</div></div>)}
        </div>
        <div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>
            {["Invoice #","Date","Due Date","Amount","Paid","Balance","Status"].map(h=><th key={h} style={{...S.th,textAlign:["Amount","Paid","Balance"].includes(h)?"right":"left"}}>{h}</th>)}
          </tr></thead><tbody>
            {soaData.rows.length===0?<tr><td colSpan={7}><EmptyState text="No invoices found for this customer."/></td></tr>:soaData.rows.map(r=><tr key={r.invNum} style={{borderBottom:`1px solid ${C.border}`,opacity:r.status==="PAID"?0.45:1}}>
              <td style={S.td}><IdLink id={r.invNum}/></td>
              <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11}}>{r.date}</span></td>
              <td style={S.td}><span style={{fontFamily:F.mono,fontSize:11}}>{r.dueDate||"—"}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono}}>{fmt(r.total)}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.green}}>{fmt(r.paid)}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:r.balance>0?C.red:C.green}}>{fmt(r.balance)}</span></td>
              <td style={S.td}><span style={{fontSize:9,fontWeight:700,color:r.status==="PAID"?C.green:C.red,padding:"2px 6px",borderRadius:4,border:`1px solid ${r.status==="PAID"?C.green:C.red}30`,background:`${r.status==="PAID"?C.green:C.red}10`}}>{r.status}</span>{r.consolidated&&<Badge color={C.purple}>C</Badge>}</td>
            </tr>)}
          </tbody></table>
        </div>
      </div>}
    </div>}

    {/* ════════ AR AGING TAB ════════ */}
    {tab==="arAging"&&<div>
      <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
        <Button onClick={genArAging} disabled={arAgingLoading}>{arAgingLoading?"Loading...":"Generate AR Aging"}</Button>
      </div>
      {arAgingData&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,marginBottom:20}}>
          {[{l:"Current",v:arAgingData.current.reduce((s,r)=>s+r.balance,0),c:C.green},{l:"1-30 Days",v:arAgingData.d30.reduce((s,r)=>s+r.balance,0),c:C.orange},{l:"31-60 Days",v:arAgingData.d60.reduce((s,r)=>s+r.balance,0),c:C.red},{l:"60+ Days",v:arAgingData.d90.reduce((s,r)=>s+r.balance,0),c:C.red}].map(card=>
            <div key={card.l} style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16}}><div style={{fontSize:10,fontWeight:600,color:C.textMuted,textTransform:"uppercase"}}>{card.l}</div><div style={{fontSize:22,fontWeight:700,fontFamily:F.mono,color:card.c,marginTop:6}}>{fmt(card.v)}</div><div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{card.l==="Current"?arAgingData.current.length:card.l==="1-30 Days"?arAgingData.d30.length:card.l==="31-60 Days"?arAgingData.d60.length:arAgingData.d90.length} invoices</div></div>)}
        </div>
        {[{label:"Current (Not Yet Due)",color:C.green,rows:arAgingData.current},{label:"1-30 Days Overdue",color:C.orange,rows:arAgingData.d30},{label:"31-60 Days Overdue",color:C.red,rows:arAgingData.d60},{label:"60+ Days Overdue",color:C.red,rows:arAgingData.d90}].map(b=>
          <AgingBucket key={b.label} label={b.label} color={b.color} rows={b.rows} columns={[{key:"invNum",label:"Invoice #",mono:true},{key:"customer",label:"Customer"},{key:"date",label:"Date",mono:true},{key:"dueDate",label:"Due",mono:true},{key:"total",label:"Total",align:"right",render:r=><span style={{fontFamily:F.mono}}>{fmt(r.total)}</span>},{key:"paid",label:"Paid",align:"right",render:r=><span style={{fontFamily:F.mono,color:C.green}}>{fmt(r.paid)}</span>},{key:"balance",label:"Balance",align:"right",render:r=><span style={{fontFamily:F.mono,fontWeight:700,color:C.red}}>{fmt(r.balance)}</span>}]}/>)}
      </div>}
    </div>}

    {/* ════════ AP AGING TAB ════════ */}
    {tab==="apAging"&&<div>
      <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
        <Button onClick={genApAging} disabled={apAgingLoading}>{apAgingLoading?"Loading...":"Generate AP Aging"}</Button>
      </div>
      {apAgingData&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,marginBottom:20}}>
          {[{l:"Current",v:apAgingData.current.reduce((s,r)=>s+r.balance,0),c:C.green},{l:"1-30 Days",v:apAgingData.d30.reduce((s,r)=>s+r.balance,0),c:C.orange},{l:"31-60 Days",v:apAgingData.d60.reduce((s,r)=>s+r.balance,0),c:C.red},{l:"60+ Days",v:apAgingData.d90.reduce((s,r)=>s+r.balance,0),c:C.red}].map(card=>
            <div key={card.l} style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16}}><div style={{fontSize:10,fontWeight:600,color:C.textMuted,textTransform:"uppercase"}}>{card.l}</div><div style={{fontSize:22,fontWeight:700,fontFamily:F.mono,color:card.c,marginTop:6}}>{fmt(card.v)}</div></div>)}
        </div>
        {[{label:"Current",color:C.green,rows:apAgingData.current},{label:"1-30 Days",color:C.orange,rows:apAgingData.d30},{label:"31-60 Days",color:C.red,rows:apAgingData.d60},{label:"60+ Days",color:C.red,rows:apAgingData.d90}].map(b=>
          <AgingBucket key={b.label} label={b.label} color={b.color} rows={b.rows} columns={[{key:"jobId",label:"Job ID",mono:true},{key:"code",label:"Code",mono:true},{key:"payee",label:"Payee"},{key:"customer",label:"Customer"},{key:"total",label:"Total",align:"right",render:r=><span style={{fontFamily:F.mono}}>{fmt(r.total)}</span>},{key:"paid",label:"Paid",align:"right",render:r=><span style={{fontFamily:F.mono,color:C.green}}>{fmt(r.paid)}</span>},{key:"balance",label:"Balance",align:"right",render:r=><span style={{fontFamily:F.mono,fontWeight:700,color:C.red}}>{fmt(r.balance)}</span>}]}/>)}
      </div>}
    </div>}

    {/* ════════ REVENUE BY CUSTOMER TAB ════════ */}
    {tab==="revByCust"&&<div>
      <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:12}}>Revenue by Customer</div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
          <div><label style={S.label}>From Month</label><input type="month" value={revFrom} onChange={e=>setRevFrom(e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
          <div><label style={S.label}>To Month</label><input type="month" value={revTo} onChange={e=>setRevTo(e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
          <Button onClick={genRevByCust} disabled={revLoading}>{revLoading?"Loading...":"Generate"}</Button>
        </div>
      </div>
      {revData&&<div>
        <div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>
            {["Customer","BLs","AR (Revenue)","AP (Costs)","Net Profit","Margin"].map(h=><th key={h} style={{...S.th,textAlign:["BLs","AR (Revenue)","AP (Costs)","Net Profit","Margin"].includes(h)?"right":"left"}}>{h}</th>)}
          </tr></thead><tbody>
            {revData.length===0?<tr><td colSpan={6}><EmptyState text="No data for selected period."/></td></tr>:revData.map(r=>{
              const net=r.ar-r.ap;const margin=r.ar>0?((net/r.ar)*100).toFixed(1):"0.0";
              return<tr key={r.customer} style={{borderBottom:`1px solid ${C.border}`}}>
                <td style={S.td}><span style={{fontWeight:600}}>{r.customer}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono}}>{r.blCount}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.green}}>{fmt(r.ar)}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.red}}>{fmt(r.ap)}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:net>=0?C.green:C.red}}>{fmt(net)}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:parseFloat(margin)>=0?C.green:C.red}}>{margin}%</span></td>
              </tr>;})}
            {revData.length>0&&<tr style={{borderTop:`2px solid ${C.text}`,background:C.card}}>
              <td style={{...S.td,fontWeight:700}}>Total</td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700}}>{revData.reduce((s,r)=>s+r.blCount,0)}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.green}}>{fmt(revData.reduce((s,r)=>s+r.ar,0))}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.red}}>{fmt(revData.reduce((s,r)=>s+r.ap,0))}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700}}>{fmt(revData.reduce((s,r)=>s+(r.ar-r.ap),0))}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700}}>{(revData.reduce((s,r)=>s+r.ar,0)>0?((revData.reduce((s,r)=>s+(r.ar-r.ap),0)/revData.reduce((s,r)=>s+r.ar,0))*100).toFixed(1):"0.0")}%</span></td>
            </tr>}
          </tbody></table>
        </div>
      </div>}
    </div>}

    {/* ════════ PROFIT BY PERIOD TAB ════════ */}
    {tab==="profitByPeriod"&&<div>
      <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:12}}>Profit by Period</div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
          <div><label style={S.label}>From Month</label><input type="month" value={ppFrom} onChange={e=>setPpFrom(e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
          <div><label style={S.label}>To Month</label><input type="month" value={ppTo} onChange={e=>setPpTo(e.target.value)} style={{fontFamily:F.mono,fontSize:12,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none"}}/></div>
          <Button onClick={genProfitByPeriod} disabled={ppLoading}>{ppLoading?"Loading...":"Generate"}</Button>
        </div>
      </div>
      {ppData&&<div>
        <div style={{background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>
            {["Month","BLs","AR","AP","GE","Net Profit"].map(h=><th key={h} style={{...S.th,textAlign:h==="Month"?"left":"right"}}>{h}</th>)}
          </tr></thead><tbody>
            {ppData.length===0?<tr><td colSpan={6}><EmptyState text="No data for selected period."/></td></tr>:ppData.map(r=>{
              const net=r.ar-r.ap-r.ge;
              return<tr key={r.month} style={{borderBottom:`1px solid ${C.border}`}}>
                <td style={S.td}><span style={{fontFamily:F.mono,fontWeight:600}}>{r.month}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono}}>{r.blCount}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.green}}>{fmt(r.ar)}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.red}}>{fmt(r.ap)}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,color:C.orange}}>{fmt(r.ge)}</span></td>
                <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:net>=0?C.green:C.red}}>{fmt(net)}</span></td>
              </tr>;})}
            {ppData.length>0&&<tr style={{borderTop:`2px solid ${C.text}`,background:C.card}}>
              <td style={{...S.td,fontWeight:700}}>Total</td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700}}>{ppData.reduce((s,r)=>s+r.blCount,0)}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.green}}>{fmt(ppData.reduce((s,r)=>s+r.ar,0))}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.red}}>{fmt(ppData.reduce((s,r)=>s+r.ap,0))}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700,color:C.orange}}>{fmt(ppData.reduce((s,r)=>s+r.ge,0))}</span></td>
              <td style={{...S.td,textAlign:"right"}}><span style={{fontFamily:F.mono,fontWeight:700}}>{fmt(ppData.reduce((s,r)=>s+(r.ar-r.ap-r.ge),0))}</span></td>
            </tr>}
          </tbody></table>
        </div>
      </div>}
    </div>}
  </div>);
}

// ═══════ CUSTOMERS PAGE ═══════
function CustomersPage({onRefresh}){
  const[items,setItems]=useState([]);const[search,setSearch]=useState("");const[showForm,setShowForm]=useState(false);
  const[name,setName]=useState("");const[address,setAddress]=useState("");const[contact,setContact]=useState("");const[email,setEmail]=useState("");const[phone,setPhone]=useState("");const[brokerageFee,setBrokerageFee]=useState("");const[paymentTerms,setPaymentTerms]=useState("30");
  const[alsoPayee,setAlsoPayee]=useState(false);const[editId,setEditId]=useState(null);const[previewCode,setPreviewCode]=useState("");

  const loadItems=async()=>{if(window.db){const c=await window.db.customers.list();setItems(c||[]);DB.customers=c||[];}else setItems([...DB.customers]);};
  useEffect(()=>{loadItems();},[]);
  useEffect(()=>{if(showForm&&!editId)dbNextCustCode().then(setPreviewCode);},[showForm,editId]);
  const filtered=items.filter(it=>{const q=search.toLowerCase();return!q||it.name.toLowerCase().includes(q)||it.code.toLowerCase().includes(q);});
  const reset=()=>{setName("");setAddress("");setContact("");setEmail("");setPhone("");setBrokerageFee("");setPaymentTerms("30");setEditId(null);setShowForm(false);setAlsoPayee(false);};
  const save=async()=>{if(!name){await showAlert("Please enter a company name.");return;}if(email&&!validateEmail(email)){await showAlert("Please enter a valid email address.");return;}if(phone&&!validatePhone(phone)){await showAlert("Please enter a valid phone number.");return;}if(!editId&&await dbCustomerExists(name)){await showAlert(`Customer "${name}" already exists.`);return;}const data={name,address,contact,email,phone,brokerageFee,paymentTerms};if(editId){await dbUpdateCustomer(editId,data);}else{await dbAddCustomer(data);if(alsoPayee&&!(await dbPayeeExists(name)))await dbAddPayee({...data});}await loadItems();onRefresh();reset();};
  const startEdit=it=>{setName(it.name);setAddress(it.address||"");setContact(it.contact||"");setEmail(it.email||"");setPhone(it.phone||"");setBrokerageFee(it.brokerageFee||"");setPaymentTerms(it.paymentTerms||"30");setEditId(it.id);setShowForm(true);setAlsoPayee(false);};
  const del=async id=>{const cust=items.find(c=>c.id===id);if(!cust)return;const refs=await dbCountJobsByCustomer(cust.name);const msg=refs>0?`"${cust.name}" is used in ${refs} BL(s). Delete anyway?`:`Delete customer "${cust.name}"?`;if(!(await showConfirm(msg)))return;await dbDeleteCustomer(id);await loadItems();onRefresh();};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h1 style={S.pt}>👥 Customers</h1><Button onClick={()=>{reset();setShowForm(!showForm);}}>{showForm?"✕ Cancel":"+ New"}</Button></div>
    {showForm&&(<div style={{background:C.surface,borderRadius:10,padding:20,border:`1px solid ${C.accent}33`,marginBottom:20}}>
      <h3 style={{margin:"0 0 14px",fontFamily:F.display,color:C.text,fontSize:15}}>{editId?"Edit Customer":"Register New Customer"}</h3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Input label="Company / Name" value={name} onChange={setName} placeholder="Company name"/>
        <Input label="Code (Auto)" value={editId?(items.find(i=>i.id===editId)?.code||""):previewCode} onChange={()=>{}} readOnly/>
        <Input label="Contact Person" value={contact} onChange={setContact} placeholder="Name"/>
        <Input label="Email" value={email} onChange={setEmail} placeholder="email@example.com"/>
        <Input label="Phone" value={phone} onChange={setPhone} placeholder="+1 xxx-xxx-xxxx"/>
        <Input label="Default Brokerage Fee (CAD)" value={brokerageFee} onChange={setBrokerageFee} placeholder="0.00" inputMode="numeric"/>
        <Input label="Payment Terms (Days)" value={paymentTerms} onChange={setPaymentTerms} placeholder="30" inputMode="numeric"/>
      </div>
      <div style={{marginTop:8}}><Input label="Address" value={address} onChange={setAddress} placeholder="Address"/></div>
      {!editId&&(<div style={{marginTop:14,padding:12,background:C.card,borderRadius:8,border:`1px solid ${C.border}`}}>
        <Checkbox label="Also register as Payee" checked={alsoPayee} onChange={setAlsoPayee} color={C.green}/>
        {alsoPayee&&<div style={{fontSize:11,color:C.green,marginTop:6,paddingLeft:25}}>✓ Will also be registered as Payee</div>}
      </div>)}
      <div style={{marginTop:16,display:"flex",justifyContent:"flex-end",gap:8}}><Button variant="ghost" onClick={reset}>Cancel</Button><Button onClick={save} disabled={!name}>{editId?"Update":"Register"}</Button></div>
    </div>)}
    <Input value={search} onChange={setSearch} placeholder="Search customers..." style={{marginBottom:16}}/>
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,overflow:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>{["Code","Name","Contact","Brokerage Fee","Terms","Phone","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
      <tbody>{filtered.length===0?<tr><td colSpan={7} style={S.empty}>No customers.</td></tr>:filtered.map(it=>(<tr key={it.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <td style={S.td}><span style={{fontFamily:F.mono,fontSize:12,color:C.accent}}>{it.code}</span></td>
        <td style={S.td}><span style={{fontSize:13,color:C.text,fontWeight:500}}>{it.name}</span></td>
        <td style={S.td}><span style={{fontSize:12,color:C.textDim}}>{it.contact||"—"}</span></td>
        <td style={S.td}><span style={{fontFamily:F.mono,fontSize:12,color:C.green}}>{it.brokerageFee?`$${parseFloat(it.brokerageFee).toFixed(2)}`:"—"}</span></td>
        <td style={S.td}><span style={{fontFamily:F.mono,fontSize:12,color:C.textDim}}>{it.paymentTerms||"30"}d</span></td>
        <td style={S.td}><span style={{fontSize:12,color:C.textDim,fontFamily:F.mono}}>{it.phone||"—"}</span></td>
        <td style={S.td}><div style={{display:"flex",gap:6}}><Button variant="ghost" size="sm" onClick={()=>startEdit(it)}>Edit</Button><Button variant="danger" size="sm" onClick={()=>del(it.id)}>Del</Button></div></td>
      </tr>))}</tbody></table>
    </div>
  </div>);
}

// ═══════ PAYEES PAGE ═══════
function PayeesPage({onRefresh}){
  const[items,setItems]=useState([]);const[search,setSearch]=useState("");const[showForm,setShowForm]=useState(false);
  const[name,setName]=useState("");const[address,setAddress]=useState("");const[contact,setContact]=useState("");const[email,setEmail]=useState("");const[phone,setPhone]=useState("");
  const[alsoCust,setAlsoCust]=useState(false);const[editId,setEditId]=useState(null);const[previewCode,setPreviewCode]=useState("");

  const loadItems=async()=>{if(window.db){const p=await window.db.payees.list();setItems(p||[]);DB.payees=p||[];}else setItems([...DB.payees]);};
  useEffect(()=>{loadItems();},[]);
  useEffect(()=>{if(showForm&&!editId)dbNextPayeeCode().then(setPreviewCode);},[showForm,editId]);
  const filtered=items.filter(it=>{const q=search.toLowerCase();return!q||it.name.toLowerCase().includes(q)||it.code.toLowerCase().includes(q);});
  const reset=()=>{setName("");setAddress("");setContact("");setEmail("");setPhone("");setEditId(null);setShowForm(false);setAlsoCust(false);};
  const save=async()=>{if(!name){await showAlert("Please enter a company name.");return;}if(email&&!validateEmail(email)){await showAlert("Please enter a valid email address.");return;}if(phone&&!validatePhone(phone)){await showAlert("Please enter a valid phone number.");return;}if(!editId&&await dbPayeeExists(name)){await showAlert(`Payee "${name}" already exists.`);return;}const data={name,address,contact,email,phone};if(editId){await dbUpdatePayee(editId,data);}else{await dbAddPayee(data);if(alsoCust&&!(await dbCustomerExists(name)))await dbAddCustomer({...data});}await loadItems();onRefresh();reset();};
  const startEdit=it=>{setName(it.name);setAddress(it.address||"");setContact(it.contact||"");setEmail(it.email||"");setPhone(it.phone||"");setEditId(it.id);setShowForm(true);setAlsoCust(false);};
  const del=async id=>{const payee=items.find(p=>p.id===id);if(!payee)return;const refs=await dbCountAPByPayee(payee.name);const msg=refs>0?`"${payee.name}" is used in ${refs} AP record(s). Delete anyway?`:`Delete payee "${payee.name}"?`;if(!(await showConfirm(msg)))return;await dbDeletePayee(id);await loadItems();onRefresh();};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h1 style={S.pt}>🏢 Payees</h1><Button onClick={()=>{reset();setShowForm(!showForm);}}>{showForm?"✕ Cancel":"+ New"}</Button></div>
    {showForm&&(<div style={{background:C.surface,borderRadius:10,padding:20,border:`1px solid ${C.accent}33`,marginBottom:20}}>
      <h3 style={{margin:"0 0 14px",fontFamily:F.display,color:C.text,fontSize:15}}>{editId?"Edit Payee":"Register New Payee"}</h3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Input label="Company / Name" value={name} onChange={setName} placeholder="Company name"/>
        <Input label="Code (Auto)" value={editId?(items.find(i=>i.id===editId)?.code||""):previewCode} onChange={()=>{}} readOnly/>
        <Input label="Contact Person" value={contact} onChange={setContact} placeholder="Name"/>
        <Input label="Email" value={email} onChange={setEmail} placeholder="email@example.com"/>
        <Input label="Phone" value={phone} onChange={setPhone} placeholder="+1 xxx-xxx-xxxx"/>
        <Input label="Address" value={address} onChange={setAddress} placeholder="Address"/>
      </div>
      {!editId&&(<div style={{marginTop:14,padding:12,background:C.card,borderRadius:8,border:`1px solid ${C.border}`}}>
        <Checkbox label="Also register as Customer" checked={alsoCust} onChange={setAlsoCust} color={C.green}/>
        {alsoCust&&<div style={{fontSize:11,color:C.green,marginTop:6,paddingLeft:25}}>✓ Will also be registered as Customer</div>}
      </div>)}
      <div style={{marginTop:16,display:"flex",justifyContent:"flex-end",gap:8}}><Button variant="ghost" onClick={reset}>Cancel</Button><Button onClick={save} disabled={!name}>{editId?"Update":"Register"}</Button></div>
    </div>)}
    <Input value={search} onChange={setSearch} placeholder="Search payees..." style={{marginBottom:16}}/>
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,overflow:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.card}}>{["Code","Name","Contact","Email","Phone","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
      <tbody>{filtered.length===0?<tr><td colSpan={6} style={S.empty}>No payees yet.</td></tr>:filtered.map(it=>(<tr key={it.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <td style={S.td}><span style={{fontFamily:F.mono,fontSize:12,color:C.accent}}>{it.code}</span></td>
        <td style={S.td}><span style={{fontSize:13,color:C.text,fontWeight:500}}>{it.name}</span></td>
        <td style={S.td}><span style={{fontSize:12,color:C.textDim}}>{it.contact||"—"}</span></td>
        <td style={S.td}><span style={{fontSize:12,color:C.textDim,fontFamily:F.mono}}>{it.email||"—"}</span></td>
        <td style={S.td}><span style={{fontSize:12,color:C.textDim,fontFamily:F.mono}}>{it.phone||"—"}</span></td>
        <td style={S.td}><div style={{display:"flex",gap:6}}><Button variant="ghost" size="sm" onClick={()=>startEdit(it)}>Edit</Button><Button variant="danger" size="sm" onClick={()=>del(it.id)}>Del</Button></div></td>
      </tr>))}</tbody></table>
    </div>
  </div>);
}

// ═══════ COMPANY SETTINGS PAGE ═══════
function CompanySettingsPage(){
  const[data,setData]=useState({companyName:"",address:"",taxId:"",businessNumber:"",notesTerms:"",phone:"",email:"",website:""});
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);

  useEffect(()=>{
    (async()=>{
      if(!window.db)return setLoading(false);
      try{const d=await window.db.company.get();if(d)setData(prev=>({...prev,...d}));}catch(e){console.error("Load company:",e);}
      setLoading(false);
    })();
  },[]);

  const save=async()=>{
    setSaving(true);
    try{if(window.db)await window.db.company.set(data);setSaved(true);setTimeout(()=>setSaved(false),2000);}
    catch(e){await showAlert("Failed to save: "+e.message);}
    setSaving(false);
  };

  const upd=(k,v)=>{setData(p=>({...p,[k]:v}));setSaved(false);};

  if(loading)return<div style={S.empty}>Loading company settings...</div>;

  return(<div style={{maxWidth:720}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <h2 style={S.pt}>⚙ Company Info</h2>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        {saved&&<span style={{fontSize:12,color:C.green,fontWeight:600}}>✓ Saved</span>}
        <Button onClick={save} disabled={saving}>{saving?"Saving...":"Save Changes"}</Button>
      </div>
    </div>

    {/* Basic Info */}
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:24,marginBottom:20}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:16}}>Basic Information</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Input label="Company Name" value={data.companyName} onChange={v=>upd("companyName",v)} placeholder="Your Company Name" style={{gridColumn:"1/3"}}/>
        <Input label="Phone" value={data.phone} onChange={v=>upd("phone",v)} placeholder="+1 (000) 000-0000"/>
        <Input label="Email" value={data.email} onChange={v=>upd("email",v)} placeholder="info@company.com"/>
        <Input label="Website" value={data.website} onChange={v=>upd("website",v)} placeholder="www.company.com" style={{gridColumn:"1/3"}}/>
      </div>
    </div>

    {/* Address */}
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:24,marginBottom:20}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:16}}>Address</div>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <label style={S.label}>Full Address</label>
        <textarea value={data.address} onChange={e=>upd("address",e.target.value)} placeholder={"123 Business St\nSuite 100\nToronto, ON M5V 1A1\nCanada"} rows={4} style={{fontFamily:F.mono,fontSize:13,padding:"7px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",resize:"vertical",width:"100%"}} onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>
        <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>This address will appear on your invoices.</div>
      </div>
    </div>

    {/* Tax Info */}
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:24,marginBottom:20}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:16}}>Tax & Registration</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Input label="Tax ID / GST/HST Number" value={data.taxId} onChange={v=>upd("taxId",v)} placeholder="123456789RT0001"/>
        <Input label="Business Number" value={data.businessNumber} onChange={v=>upd("businessNumber",v)} placeholder="123456789"/>
      </div>
    </div>

    {/* Invoice Notes/Terms */}
    <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:24,marginBottom:20}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:16}}>Invoice Notes / Terms</div>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <label style={S.label}>Default Notes & Terms</label>
        <textarea value={data.notesTerms} onChange={e=>upd("notesTerms",e.target.value)} placeholder={"Payment due within 30 days.\nPlease make cheque payable to...\nE-Transfer: payments@company.com"} rows={5} style={{fontFamily:F.mono,fontSize:13,padding:"7px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,outline:"none",resize:"vertical",width:"100%"}} onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>
        <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>These notes will appear at the bottom of your invoices.</div>
      </div>
    </div>

    {/* Preview */}
    <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:24}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:16}}>Invoice Header Preview</div>
      <div style={{background:C.white,borderRadius:8,border:`1px solid ${C.border}`,padding:20}}>
        <div style={{fontFamily:F.display,fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>{data.companyName||"Your Company Name"}</div>
        <div style={{fontSize:12,color:C.textDim,whiteSpace:"pre-wrap",lineHeight:1.5,marginBottom:8}}>{data.address||"123 Business St\nToronto, ON"}</div>
        <div style={{display:"flex",gap:20,fontSize:11,color:C.textDim,flexWrap:"wrap"}}>
          {data.phone&&<span>📞 {data.phone}</span>}
          {data.email&&<span>✉ {data.email}</span>}
          {data.website&&<span>🌐 {data.website}</span>}
        </div>
        {(data.taxId||data.businessNumber)&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`,display:"flex",gap:20,fontSize:10,color:C.textMuted}}>
          {data.taxId&&<span>GST/HST: {data.taxId}</span>}
          {data.businessNumber&&<span>BN: {data.businessNumber}</span>}
        </div>}
      </div>
    </div>
  </div>);
}

// ═══════ NAV ═══════
const NAV=[
  {id:"div1",type:"divider",label:"Operations"},
  {id:"dashboard",label:"Dashboard",icon:"📊"},
  {id:"bl",label:"BL Creation",icon:"📋"},
  {id:"div2",type:"divider",label:"Finance"},
  {id:"settlement",label:"Settlement",icon:"💰"},
  {id:"genexp",label:"General Expense",icon:"📝"},
  {id:"closing",label:"Closing",icon:"📅"},
  {id:"report",label:"Reports",icon:"📈"},
  {id:"div3",type:"divider",label:"Management"},
  {id:"customers",label:"Customers",icon:"👥"},
  {id:"payees",label:"Payees",icon:"🏢"},
  {id:"div4",type:"divider",label:"Settings"},
  {id:"company",label:"Company Info",icon:"⚙"},
];

// ═══════ MAIN APP ═══════
function UpdateBanner({status,data,onDownload,onInstall,onDismiss}){
  if(!status||status==="not-available"||status==="checking")return null;
  const styles={
    available:{bg:`${C.cyan}15`,border:C.cyan,color:C.cyan,icon:"🔔"},
    downloading:{bg:`${C.orange}15`,border:C.orange,color:C.orange,icon:"⬇"},
    downloaded:{bg:`${C.green}15`,border:C.green,color:C.green,icon:"✅"},
    error:{bg:`${C.red}10`,border:C.red,color:C.red,icon:"⚠"},
  };
  const s=styles[status]||styles.error;
  return(<div style={{padding:"10px 16px",background:s.bg,border:`1px solid ${s.border}30`,borderRadius:8,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:14}}>{s.icon}</span>
      {status==="available"&&<span style={{fontSize:12,color:s.color,fontWeight:600}}>Version {data?.version} is available</span>}
      {status==="downloading"&&<span style={{fontSize:12,color:s.color,fontWeight:600}}>Downloading update... {data?.percent||0}%</span>}
      {status==="downloaded"&&<span style={{fontSize:12,color:s.color,fontWeight:600}}>Version {data?.version} ready to install</span>}
      {status==="error"&&<span style={{fontSize:12,color:s.color}}>Update error: {data?.message||"Unknown error"}</span>}
    </div>
    <div style={{display:"flex",gap:6}}>
      {status==="available"&&<button onClick={onDownload} style={{padding:"4px 12px",borderRadius:5,border:`1px solid ${C.cyan}`,background:C.cyan,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:F.body}}>Download</button>}
      {status==="downloaded"&&<button onClick={onInstall} style={{padding:"4px 12px",borderRadius:5,border:`1px solid ${C.green}`,background:C.green,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:F.body}}>Restart & Update</button>}
      <button onClick={onDismiss} style={{padding:"4px 8px",borderRadius:5,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontSize:11,cursor:"pointer",fontFamily:F.body}}>✕</button>
    </div>
  </div>);
}

function AppInner(){
  const[page,setPage]=useState("dashboard");
  const[subPage,setSubPage]=useState(null);
  const[dbReady,setDbReady]=useState(false);
  const[dbPath,setDbPath]=useState("");
  const[appVersion,setAppVersion]=useState("");

  // Auto-update state
  const[updateStatus,setUpdateStatus]=useState(null); // "checking"|"available"|"downloading"|"downloaded"|"error"|"not-available"
  const[updateData,setUpdateData]=useState(null);
  const[updateDismissed,setUpdateDismissed]=useState(false);

  const[tick,setTick]=useState(0);
  const refresh=()=>setTick(n=>n+1);

  useEffect(()=>{(async()=>{if(window.db){try{const p=await window.db.getPath();setDbPath(p);}catch(_){} await loadRefData();try{const v=await window.db.getVersion();setAppVersion(v||"");}catch(_){}}setDbReady(true);})();},[]);

  // Listen for auto-update events
  useEffect(()=>{
    if(!window.db?.update?.onStatus)return;
    const cleanup=window.db.update.onStatus((status,data)=>{
      setUpdateStatus(status);setUpdateData(data||null);
      if(status==="available"||status==="downloaded")setUpdateDismissed(false);
    });
    return cleanup;
  },[]);

  const doExport=()=>{if(window.db)window.db.exportBackup();};
  const doImport=async()=>{if(window.db){const ok=await window.db.importBackup();if(ok){setPage("bl");setSubPage(null);}}};

  const navTo=(pg)=>{setPage(pg);setSubPage(null);};
  const openARAP=(job)=>{setSubPage({type:"arap",job});};
  const openBLDetail=(job)=>{setSubPage({type:"bldetail",job});};
  const backToList=()=>setSubPage(null);

  // Lift BL filter state so it persists across sub-page navigation
  const[blSearch,setBlSearch]=useState("");
  const[blCreatedMonth,setBlCreatedMonth]=useState("");
  const[blFilterCustomer,setBlFilterCustomer]=useState("");
  const[blFilterStatus,setBlFilterStatus]=useState("");
  const[blPage,setBlPage]=useState(1);
  const blFilters={search:blSearch,setSearch:setBlSearch,createdMonth:blCreatedMonth,setCreatedMonth:setBlCreatedMonth,filterCustomer:blFilterCustomer,setFilterCustomer:setBlFilterCustomer,filterStatus:blFilterStatus,setFilterStatus:setBlFilterStatus,page:blPage,setPage:setBlPage};

  if(!dbReady)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:C.bg,color:C.textDim,fontFamily:F.body,fontSize:14}}>Loading database...</div>;

  const renderPage=()=>{
    // Sub-pages override main page
    if(subPage){
      if(subPage.type==="arap")return<ARAPDetailPage job={subPage.job} onBack={backToList}/>;
      if(subPage.type==="bldetail")return<BLDetailPage job={subPage.job} onBack={backToList}/>;
    }
    switch(page){
      case"dashboard": return<DashboardPage onOpenARAP={openARAP} onNav={navTo}/>;
      case"bl": return<BLCreationPage onOpenARAP={openARAP} onOpenBLDetail={openBLDetail} filters={blFilters}/>;
      case"settlement": return<SettlementPage onOpenARAP={openARAP}/>;
      case"genexp": return<GeneralExpensePage onNav={navTo}/>;
      case"closing": return<ClosingPage onOpenARAP={openARAP} onNav={navTo}/>;
      case"report": return<ReportsPage onOpenARAP={openARAP} onNav={navTo}/>;
      case"customers": return<CustomersPage onRefresh={refresh}/>;
      case"payees": return<PayeesPage onRefresh={refresh}/>;
      case"company": return<CompanySettingsPage/>;
      default: return null;
    }
  };

  return(<div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:F.body}}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"/>
    {/* ── SIDEBAR ── */}
    <div style={{width:210,background:C.sidebar,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
      <div style={{padding:"18px 14px",borderBottom:`1px solid ${C.border}`,textAlign:"center"}}>
        <span style={{fontFamily:F.display,fontSize:20,fontWeight:800,color:C.accent,letterSpacing:"2px"}}>CLIK</span>
        <div style={{fontSize:8,color:C.textMuted,letterSpacing:"1px",marginTop:2}}>CUSTOMS & LOGISTICS</div>
      </div>
      <nav style={{padding:"8px 6px",flex:1,display:"flex",flexDirection:"column",gap:1,overflow:"auto"}}>
        {NAV.map(item=>{
          if(item.type==="divider")return<div key={item.id} style={{fontSize:9,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"1px",padding:"12px 12px 4px",fontFamily:F.body}}>{item.label}</div>;
          const active=page===item.id&&!subPage;
          return(<div key={item.id} onClick={()=>navTo(item.id)} style={{padding:"8px 12px",borderRadius:7,cursor:"pointer",background:active?C.accentGlow:"transparent",border:active?`1px solid ${C.accent}28`:"1px solid transparent",display:"flex",alignItems:"center",gap:9,transition:"all .15s"}} onMouseEnter={e=>{if(!active)e.currentTarget.style.background=C.surfaceHover;}} onMouseLeave={e=>{if(!active)e.currentTarget.style.background=active?C.accentGlow:"transparent";}}>
            <span style={{fontSize:13}}>{item.icon}</span>
            <span style={{fontFamily:F.body,fontSize:12.5,fontWeight:active?600:400,color:active?C.accent:C.textDim}}>{item.label}</span>
          </div>);
        })}
      </nav>
      <div style={{padding:"10px 10px 14px",borderTop:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:6}}>
        {dbPath&&<div style={{fontSize:8,color:C.textMuted,fontFamily:F.mono,padding:"0 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={dbPath}>💾 {dbPath.split(/[/\\]/).pop()}</div>}
        <button onClick={doExport} style={{width:"100%",padding:"7px 0",borderRadius:6,border:`1px solid ${C.border}`,background:C.card,color:C.textDim,fontFamily:F.body,fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onMouseEnter={e=>{e.currentTarget.style.background=C.surfaceHover;}} onMouseLeave={e=>{e.currentTarget.style.background=C.card;}}>⬇ Export Backup</button>
        <button onClick={doImport} style={{width:"100%",padding:"7px 0",borderRadius:6,border:`1px solid ${C.border}`,background:C.card,color:C.textDim,fontFamily:F.body,fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onMouseEnter={e=>{e.currentTarget.style.background=C.surfaceHover;}} onMouseLeave={e=>{e.currentTarget.style.background=C.card;}}>⬆ Import Backup</button>
        {appVersion&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 4px 0"}}>
          <span style={{fontSize:9,color:C.textMuted,fontFamily:F.mono}}>v{appVersion}</span>
          <button onClick={()=>{if(window.db?.update)window.db.update.check();}} style={{background:"none",border:"none",color:C.cyan,cursor:"pointer",fontSize:9,fontFamily:F.body,fontWeight:600,padding:0}} title="Check for updates">Check update</button>
        </div>}
      </div>
    </div>
    {/* ── MAIN ── */}
    <div style={{flex:1,padding:28,overflow:"auto",maxHeight:"100vh",minWidth:0}}>
      {!updateDismissed&&<UpdateBanner status={updateStatus} data={updateData}
        onDownload={()=>{if(window.db?.update)window.db.update.download();}}
        onInstall={()=>{if(window.db?.update)window.db.update.install();}}
        onDismiss={()=>setUpdateDismissed(true)}/>}
      {renderPage()}
    </div>
    <style>{`html,body,#root,#__next{margin:0;padding:0;width:100%;min-height:100vh}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}@keyframes clik-spin{to{transform:rotate(360deg)}}`}</style>
  </div>);
}

export default function App(){return<ErrorBoundary><ModalProvider><AppInner/></ModalProvider></ErrorBoundary>;}
