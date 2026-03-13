const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("db", {
  // Company Settings
  company: {
    get: () => ipcRenderer.invoke("company:get"),
    set: (data) => ipcRenderer.invoke("company:set", data),
  },
  // Customers
  customers: {
    list: () => ipcRenderer.invoke("customers:list"),
    add: (d) => ipcRenderer.invoke("customers:add", d),
    update: (id, d) => ipcRenderer.invoke("customers:update", id, d),
    delete: (id) => ipcRenderer.invoke("customers:delete", id),
    findByName: (n) => ipcRenderer.invoke("customers:findByName", n),
    exists: (n) => ipcRenderer.invoke("customers:exists", n),
    nextCode: () => ipcRenderer.invoke("customers:nextCode"),
  },
  // Payees
  payees: {
    list: () => ipcRenderer.invoke("payees:list"),
    add: (d) => ipcRenderer.invoke("payees:add", d),
    update: (id, d) => ipcRenderer.invoke("payees:update", id, d),
    delete: (id) => ipcRenderer.invoke("payees:delete", id),
    exists: (n) => ipcRenderer.invoke("payees:exists", n),
    nextCode: () => ipcRenderer.invoke("payees:nextCode"),
  },
  // Jobs
  jobs: {
    list: (opts) => ipcRenderer.invoke("jobs:list", opts),
    count: (opts) => ipcRenderer.invoke("jobs:count", opts),
    get: (id) => ipcRenderer.invoke("jobs:get", id),
    add: (d) => ipcRenderer.invoke("jobs:add", d),
    update: (id, d) => ipcRenderer.invoke("jobs:update", id, d),
    saveCharges: (id, d) => ipcRenderer.invoke("jobs:saveCharges", id, d),
    countByCustomer: (name) => ipcRenderer.invoke("jobs:countByCustomer", name),
    bulkClose: (ids, closedMonth) => ipcRenderer.invoke("jobs:bulkClose", ids, closedMonth),
    bulkReopen: (ids) => ipcRenderer.invoke("jobs:bulkReopen", ids),
    profitMap: (jobIds) => ipcRenderer.invoke("jobs:profitMap", jobIds),
  },
  // Invoices
  invoices: {
    list: (opts) => ipcRenderer.invoke("invoices:list", opts),
    get: (num) => ipcRenderer.invoke("invoices:get", num),
    add: (d) => ipcRenderer.invoke("invoices:add", d),
    createWithJob: (d) => ipcRenderer.invoke("invoices:createWithJob", d),
    update: (num, d) => ipcRenderer.invoke("invoices:update", num, d),
    byJob: (jobId) => ipcRenderer.invoke("invoices:byJob", jobId),
    nextNum: (type) => ipcRenderer.invoke("invoices:nextNum", type),
    stats: (opts) => ipcRenderer.invoke("invoices:stats", opts),
    count: (opts) => ipcRenderer.invoke("invoices:count", opts),
  },
  // AP Records
  ap: {
    list: (opts) => ipcRenderer.invoke("ap:list", opts),
    get: (id) => ipcRenderer.invoke("ap:get", id),
    add: (d) => ipcRenderer.invoke("ap:add", d),
    update: (id, d) => ipcRenderer.invoke("ap:update", id, d),
    delete: (id) => ipcRenderer.invoke("ap:delete", id),
    byJob: (jobId) => ipcRenderer.invoke("ap:byJob", jobId),
    byJobInvoice: (jobId, invNum) => ipcRenderer.invoke("ap:byJobInvoice", jobId, invNum),
    deleteByJobInvoice: (jobId, invNum) => ipcRenderer.invoke("ap:deleteByJobInvoice", jobId, invNum),
    nextId: () => ipcRenderer.invoke("ap:nextId"),
    peekId: () => ipcRenderer.invoke("ap:peekId"),
    nextGeneralId: () => ipcRenderer.invoke("ap:nextGeneralId"),
    peekGeneralId: () => ipcRenderer.invoke("ap:peekGeneralId"),
    countByPayee: (name) => ipcRenderer.invoke("ap:countByPayee", name),
    stats: (opts) => ipcRenderer.invoke("ap:stats", opts),
    count: (opts) => ipcRenderer.invoke("ap:count", opts),
    bulkClose: (ids, closedMonth) => ipcRenderer.invoke("ap:bulkClose", ids, closedMonth),
    bulkReopen: (ids) => ipcRenderer.invoke("ap:bulkReopen", ids),
  },
  // Custom Codes
  codes: {
    list: () => ipcRenderer.invoke("codes:list"),
    add: (d) => ipcRenderer.invoke("codes:add", d),
    delete: (d) => ipcRenderer.invoke("codes:delete", d),
  },
  // STL (Settlement)
  stl: {
    list: (opts) => ipcRenderer.invoke("stl:list", opts),
    close: (data) => ipcRenderer.invoke("stl:close", data),
    reopen: (data) => ipcRenderer.invoke("stl:reopen", data),
    report: (data) => ipcRenderer.invoke("stl:report", data),
  },
  // Dashboard
  dashboard: {
    summary: (opts) => ipcRenderer.invoke("dashboard:summary", opts),
    aging: (opts) => ipcRenderer.invoke("dashboard:aging", opts),
  },
  soa: {
    data: (opts) => ipcRenderer.invoke("soa:data", opts),
  },
  // Utils
  getPath: () => ipcRenderer.invoke("db:path"),
  exportBackup: () => ipcRenderer.invoke("db:export"),
  importBackup: () => ipcRenderer.invoke("db:import"),
  generatePDF: (data) => ipcRenderer.invoke("pdf:generate", data),

  // Auto-updater
  update: {
    check: () => ipcRenderer.invoke("update:check"),
    download: () => ipcRenderer.invoke("update:download"),
    install: () => ipcRenderer.invoke("update:install"),
    onStatus: (callback) => {
      const handler = (_event, status, data) => callback(status, data);
      ipcRenderer.on("update:status", handler);
      return () => ipcRenderer.removeListener("update:status", handler);
    },
  },
  getVersion: () => ipcRenderer.invoke("app:version"),

});
