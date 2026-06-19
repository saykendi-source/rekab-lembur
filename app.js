/*
  Aplikasi Laporan Pengajuan Lembur
  1) Jalankan langsung di GitHub Pages.
  2) Isi SCRIPT_URL setelah Web App Apps Script berhasil dibuat.
*/
const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzXWjWKZ6xr_gQh_8PQg2Xuh8IfSotWnVqxuCtr0muyx2z99QDTWNWB5vSYNXs6tly8mw/exec",
  APP_NAME: "Laporan Pengajuan Lembur",
  DEFAULT_COUNTED_START: "17:00",
  DEFAULT_COUNTED_END: "20:00"
};

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const TEMPLATE_DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const STORAGE_KEY = "lembur-app-v1";

const $ = (id) => document.getElementById(id);

let state = {
  employees: [],
  templates: {},
  rows: [],
  lastSubmissionId: ""
};

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (err) {
    console.warn("Gagal membaca localStorage", err);
  }
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isConnected() {
  return CONFIG.SCRIPT_URL && !CONFIG.SCRIPT_URL.includes("PASTE_WEB_APP_URL_HERE");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dateFromISO(iso) {
  return new Date(`${iso}T00:00:00`);
}

function getDayName(iso) {
  if (!iso) return "";
  return DAYS[dateFromISO(iso).getDay()];
}

function formatDateID(iso) {
  if (!iso) return "";
  return dateFromISO(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function toMinutes(time) {
  if (!time || !time.includes(":")) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesDiff(start, end) {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e < s) e += 24 * 60; // untuk kasus melewati tengah malam
  return Math.max(0, e - s);
}

function hoursText(total) {
  const rounded = Math.round(total * 100) / 100;
  return `${rounded.toLocaleString("id-ID")} jam`;
}

function calculateRow(row) {
  const diff = minutesDiff(row.hitungMulai, row.hitungSelesai);
  row.totalJam = Math.round((diff / 60) * 100) / 100;
  return row;
}

function setStatus(message, type = "info") {
  const el = $("statusMessage");
  el.textContent = message;
  el.style.color = type === "error" ? "#b91c1c" : "#075985";
}

function renderTemplates() {
  const container = $("templateGrid");
  container.innerHTML = "";
  TEMPLATE_DAYS.forEach((day) => {
    const label = document.createElement("label");
    label.innerHTML = `${day}<textarea rows="3" data-day="${day}" placeholder="Kegiatan default hari ${day}"></textarea>`;
    container.appendChild(label);
    label.querySelector("textarea").value = state.templates[day] || "";
  });
}

function readTemplatesFromUI() {
  document.querySelectorAll("#templateGrid textarea").forEach((el) => {
    state.templates[el.dataset.day] = el.value.trim();
  });
  saveLocal();
}

function renderEmployees() {
  const list = $("employeeList");
  list.innerHTML = "";
  state.employees.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = `${emp.nama || ""} - ${emp.nik || ""}`.trim();
    opt.label = `${emp.unitKerja || ""}${emp.jabatan ? " | " + emp.jabatan : ""}`;
    list.appendChild(opt);
  });
}

function selectedEmployeeValue() {
  const val = $("employeeSearch").value.toLowerCase();
  return state.employees.find((emp) => {
    const label = `${emp.nama || ""} - ${emp.nik || ""}`.toLowerCase();
    return label === val || (emp.nik || "").toLowerCase() === val || (emp.nama || "").toLowerCase() === val;
  });
}

function fillEmployee(emp) {
  if (!emp) return;
  $("nama").value = emp.nama || "";
  $("nik").value = emp.nik || "";
  $("unitKerja").value = emp.unitKerja || "";
  $("jabatan").value = emp.jabatan || "";
  if (emp.templates) {
    state.templates = { ...state.templates, ...emp.templates };
    renderTemplates();
  }
}

function syncActivityForSingleDate() {
  readTemplatesFromUI();
  const iso = $("tanggalSingle").value;
  const day = getDayName(iso);
  if (day && state.templates[day]) {
    $("kegiatanSingle").value = state.templates[day];
  }
}

function createRow({ date, kegiatan, aktualMulai, aktualSelesai, hitungMulai, hitungSelesai }) {
  return calculateRow({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    tanggal: date,
    hari: getDayName(date),
    kegiatan: kegiatan || state.templates[getDayName(date)] || "",
    aktualMulai: aktualMulai || "16:00",
    aktualSelesai: aktualSelesai || "20:00",
    hitungMulai: hitungMulai || CONFIG.DEFAULT_COUNTED_START,
    hitungSelesai: hitungSelesai || CONFIG.DEFAULT_COUNTED_END,
    totalJam: 0
  });
}

function addSingleRow() {
  readTemplatesFromUI();
  const date = $("tanggalSingle").value;
  if (!date) return setStatus("Tanggal lembur belum dipilih.", "error");
  const row = createRow({
    date,
    kegiatan: $("kegiatanSingle").value.trim(),
    aktualMulai: $("aktualMulai").value,
    aktualSelesai: $("aktualSelesai").value,
    hitungMulai: $("hitungMulai").value,
    hitungSelesai: $("hitungSelesai").value
  });
  upsertRows([row]);
}

function addRangeRows() {
  readTemplatesFromUI();
  const start = $("tanggalMulai").value;
  const end = $("tanggalSampai").value;
  if (!start || !end) return setStatus("Tanggal mulai dan sampai wajib diisi.", "error");
  if (dateFromISO(end) < dateFromISO(start)) return setStatus("Tanggal sampai tidak boleh lebih awal dari tanggal mulai.", "error");

  const chosen = [...document.querySelectorAll(".weekdayPick:checked")].map((x) => Number(x.value));
  if (!chosen.length) return setStatus("Pilih minimal satu hari.", "error");

  const rows = [];
  const cursor = dateFromISO(start);
  const last = dateFromISO(end);
  while (cursor <= last) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (chosen.includes(cursor.getDay())) {
      rows.push(createRow({
        date: iso,
        kegiatan: state.templates[getDayName(iso)] || "",
        aktualMulai: $("rangeAktualMulai").value,
        aktualSelesai: $("rangeAktualSelesai").value,
        hitungMulai: $("rangeHitungMulai").value,
        hitungSelesai: $("rangeHitungSelesai").value
      }));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  upsertRows(rows);
}

function upsertRows(rows) {
  const byDate = new Map(state.rows.map((r) => [r.tanggal, r]));
  rows.forEach((r) => byDate.set(r.tanggal, r));
  state.rows = [...byDate.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  saveLocal();
  renderRows();
  setStatus(`${rows.length} baris lembur ditambahkan/diperbarui.`);
}

function updateRow(id, field, value) {
  const row = state.rows.find((r) => r.id === id);
  if (!row) return;
  row[field] = value;
  if (field === "tanggal") {
    row.hari = getDayName(value);
    if (!row.kegiatan && state.templates[row.hari]) row.kegiatan = state.templates[row.hari];
  }
  calculateRow(row);
  saveLocal();
  renderRows();
}

function deleteRow(id) {
  state.rows = state.rows.filter((r) => r.id !== id);
  saveLocal();
  renderRows();
}

function renderRows() {
  const body = $("overtimeBody");
  body.innerHTML = "";
  let total = 0;
  state.rows.forEach((row, index) => {
    calculateRow(row);
    total += Number(row.totalJam || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><input class="mini-input" type="date" value="${row.tanggal}" data-field="tanggal"></td>
      <td>${row.hari}</td>
      <td><textarea rows="2" data-field="kegiatan">${escapeHTML(row.kegiatan || "")}</textarea></td>
      <td><div class="time-group"><input class="mini-input" type="time" value="${row.aktualMulai}" data-field="aktualMulai"><input class="mini-input" type="time" value="${row.aktualSelesai}" data-field="aktualSelesai"></div></td>
      <td><div class="time-group"><input class="mini-input" type="time" value="${row.hitungMulai}" data-field="hitungMulai"><input class="mini-input" type="time" value="${row.hitungSelesai}" data-field="hitungSelesai"></div></td>
      <td><strong>${hoursText(row.totalJam)}</strong></td>
      <td><button class="action-link" type="button">Hapus</button></td>
    `;
    tr.querySelectorAll("input, textarea").forEach((el) => {
      el.addEventListener("change", () => updateRow(row.id, el.dataset.field, el.value));
    });
    tr.querySelector("button").addEventListener("click", () => deleteRow(row.id));
    body.appendChild(tr);
  });
  $("totalJamCell").textContent = hoursText(total);
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validateSubmission() {
  const required = ["nama", "nik", "unitKerja"];
  for (const id of required) {
    if (!$(id).value.trim()) return `Field ${id} wajib diisi.`;
  }
  if (!state.rows.length) return "Daftar lembur masih kosong.";
  for (const row of state.rows) {
    if (!row.tanggal || !row.kegiatan || !row.hitungMulai || !row.hitungSelesai) {
      return "Tanggal, kegiatan, dan jam dihitung wajib lengkap di setiap baris.";
    }
    if (toMinutes(row.hitungMulai) < toMinutes(row.aktualMulai)) {
      return `Jam dihitung mulai pada ${formatDateID(row.tanggal)} tidak boleh lebih awal dari jam aktual mulai.`;
    }
    const actual = minutesDiff(row.aktualMulai, row.aktualSelesai);
    const counted = minutesDiff(row.hitungMulai, row.hitungSelesai);
    if (counted > actual) {
      return `Jam dihitung pada ${formatDateID(row.tanggal)} tidak boleh lebih besar dari durasi aktual.`;
    }
  }
  return "";
}

function collectSubmission(status = "Draft") {
  const totalJam = state.rows.reduce((sum, r) => sum + Number(r.totalJam || 0), 0);
  const bulan = $("bulanPengajuan").value || monthISO();
  const id = state.lastSubmissionId || makeSubmissionId(bulan);
  state.lastSubmissionId = id;
  return {
    action: "savePengajuan",
    id,
    timestamp: new Date().toISOString(),
    status,
    nama: $("nama").value.trim(),
    nik: $("nik").value.trim(),
    unitKerja: $("unitKerja").value.trim(),
    jabatan: $("jabatan").value.trim(),
    bulanPengajuan: bulan,
    totalHari: state.rows.length,
    totalJam: Math.round(totalJam * 100) / 100,
    atasanNama: $("atasanNama").value.trim(),
    atasanJabatan: $("atasanJabatan").value.trim(),
    lokasiTanggal: $("lokasiTanggal").value.trim(),
    catatan: $("catatan").value.trim(),
    rows: state.rows.map((r) => calculateRow({ ...r }))
  };
}

function makeSubmissionId(month) {
  const cleanMonth = (month || monthISO()).replace("-", "");
  const suffix = String(Date.now()).slice(-5);
  return `LBR-${cleanMonth}-${suffix}`;
}

function buildPreview() {
  const err = validateSubmission();
  if (err) {
    setStatus(err, "error");
    return false;
  }
  const data = collectSubmission("Preview");
  const rowsHTML = data.rows.map((row, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${formatDateID(row.tanggal)}</td>
      <td>${row.hari}</td>
      <td>${escapeHTML(row.kegiatan)}</td>
      <td style="text-align:center">${row.aktualMulai} - ${row.aktualSelesai}</td>
      <td style="text-align:center">${row.hitungMulai} - ${row.hitungSelesai}</td>
      <td style="text-align:center">${hoursText(row.totalJam)}</td>
    </tr>`).join("");

  $("printArea").innerHTML = `
    <h2 class="doc-title">Laporan Pengajuan Lembur</h2>
    <p class="doc-subtitle">Nomor Pengajuan: <strong>${data.id}</strong></p>

    <div class="identity-grid">
      <div>Nama</div><div>:</div><div>${escapeHTML(data.nama)}</div>
      <div>NIK</div><div>:</div><div>${escapeHTML(data.nik)}</div>
      <div>Unit Kerja</div><div>:</div><div>${escapeHTML(data.unitKerja)}</div>
      <div>Jabatan</div><div>:</div><div>${escapeHTML(data.jabatan || "-")}</div>
      <div>Bulan Pengajuan</div><div>:</div><div>${escapeHTML(data.bulanPengajuan)}</div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th>No</th>
          <th>Tanggal</th>
          <th>Hari</th>
          <th>Kegiatan</th>
          <th>Jam Aktual</th>
          <th>Jam Dihitung</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>

    <p class="print-summary">Total: ${data.totalHari} hari / ${hoursText(data.totalJam)}</p>
    ${data.catatan ? `<div class="note-box"><strong>Catatan:</strong><br>${escapeHTML(data.catatan)}</div>` : ""}

    <div class="signature-row">
      <div>
        <p>Pemohon,</p>
        <div class="signature-space"></div>
        <p><strong>${escapeHTML(data.nama)}</strong><br>NIK. ${escapeHTML(data.nik)}</p>
      </div>
      <div>
        <p>${escapeHTML(data.lokasiTanggal || "Yogyakarta, ....................")}</p>
        <p>Mengetahui,</p>
        <div class="signature-space"></div>
        <p><strong>${escapeHTML(data.atasanNama || "........................")}</strong><br>${escapeHTML(data.atasanJabatan || "........................")}</p>
      </div>
    </div>
  `;
  $("previewCard").classList.add("active");
  $("previewCard").scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("Preview berhasil dibuat.");
  return true;
}

async function apiGet(action, params = {}) {
  if (!isConnected()) throw new Error("SCRIPT_URL belum diisi.");
  const url = new URL(CONFIG.SCRIPT_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(payload) {
  if (!isConnected()) throw new Error("SCRIPT_URL belum diisi.");
  const res = await fetch(CONFIG.SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadDataFromSheet() {
  if (!isConnected()) {
    setStatus("SCRIPT_URL belum diisi. Aplikasi berjalan dalam mode uji lokal.");
    return;
  }
  try {
    setStatus("Memuat data dari Spreadsheet...");
    const data = await apiGet("bootstrap", { nik: $("nik").value.trim() });
    state.employees = data.employees || [];
    if (data.templates) state.templates = { ...state.templates, ...data.templates };
    saveLocal();
    renderEmployees();
    renderTemplates();
    setStatus("Data berhasil dimuat dari Spreadsheet.");
  } catch (err) {
    console.error(err);
    setStatus("Gagal memuat data Spreadsheet. Cek Web App URL dan izin akses.", "error");
  }
}

async function saveTemplateToSheet() {
  readTemplatesFromUI();
  const nik = $("nik").value.trim();
  if (!nik) return setStatus("Isi NIK terlebih dahulu sebelum menyimpan template.", "error");
  saveLocal();
  if (!isConnected()) {
    setStatus("Template tersimpan lokal. Isi SCRIPT_URL untuk menyimpan ke Spreadsheet.");
    return;
  }
  try {
    await apiPost({ action: "saveTemplate", nik, templates: state.templates });
    setStatus("Template berhasil disimpan ke Spreadsheet.");
  } catch (err) {
    console.error(err);
    setStatus("Gagal menyimpan template ke Spreadsheet.", "error");
  }
}

async function saveSubmission() {
  const err = validateSubmission();
  if (err) return setStatus(err, "error");
  const data = collectSubmission("Diajukan");
  saveLocal();
  if (!isConnected()) {
    setStatus(`Pengajuan ${data.id} tersimpan lokal. Isi SCRIPT_URL untuk menyimpan ke Spreadsheet.`);
    return;
  }
  try {
    setStatus("Menyimpan pengajuan ke Spreadsheet...");
    const result = await apiPost(data);
    if (result && result.id) state.lastSubmissionId = result.id;
    saveLocal();
    setStatus(`Pengajuan ${state.lastSubmissionId || data.id} berhasil disimpan.`);
  } catch (err) {
    console.error(err);
    setStatus("Gagal menyimpan pengajuan. Data masih tersimpan lokal di browser.", "error");
  }
}

function printDocument() {
  if (!$("previewCard").classList.contains("active")) {
    const ok = buildPreview();
    if (!ok) return;
  }
  window.print();
}

function bindEvents() {
  $("bulanPengajuan").value = monthISO();
  $("tanggalSingle").value = todayISO();
  $("tanggalMulai").value = todayISO();
  $("tanggalSampai").value = todayISO();
  $("lokasiTanggal").value = `Yogyakarta, ${formatDateID(todayISO())}`;
  $("hitungMulai").value = CONFIG.DEFAULT_COUNTED_START;
  $("hitungSelesai").value = CONFIG.DEFAULT_COUNTED_END;
  $("rangeHitungMulai").value = CONFIG.DEFAULT_COUNTED_START;
  $("rangeHitungSelesai").value = CONFIG.DEFAULT_COUNTED_END;

  document.querySelectorAll("input[name='modeTanggal']").forEach((el) => {
    el.addEventListener("change", () => {
      const mode = document.querySelector("input[name='modeTanggal']:checked").value;
      $("singleDateBox").classList.toggle("hidden", mode !== "single");
      $("rangeDateBox").classList.toggle("hidden", mode !== "range");
    });
  });

  $("employeeSearch").addEventListener("change", () => fillEmployee(selectedEmployeeValue()));
  $("tanggalSingle").addEventListener("change", syncActivityForSingleDate);
  $("btnAddRows").addEventListener("click", () => {
    const mode = document.querySelector("input[name='modeTanggal']:checked").value;
    mode === "single" ? addSingleRow() : addRangeRows();
  });
  $("btnResetRows").addEventListener("click", () => {
    if (confirm("Kosongkan semua daftar lembur?")) {
      state.rows = [];
      state.lastSubmissionId = "";
      saveLocal();
      renderRows();
      setStatus("Daftar lembur dikosongkan.");
    }
  });
  $("btnSaveTemplate").addEventListener("click", saveTemplateToSheet);
  $("btnClearTemplate").addEventListener("click", () => {
    if (!confirm("Kosongkan semua template kegiatan?")) return;
    state.templates = {};
    saveLocal();
    renderTemplates();
  });
  $("btnPreview").addEventListener("click", buildPreview);
  $("btnSaveSubmission").addEventListener("click", saveSubmission);
  $("btnPrint").addEventListener("click", printDocument);
  $("btnPrintTop").addEventListener("click", printDocument);
  $("btnPrintPreview").addEventListener("click", printDocument);
  $("btnEdit").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  $("btnLoadData").addEventListener("click", loadDataFromSheet);
}

function initDemoDataIfEmpty() {
  if (!state.employees.length) {
    state.employees = [
      { nik: "12345", nama: "Contoh Pegawai", unitKerja: "Unit Kerja", jabatan: "Staf" }
    ];
  }
  if (!Object.keys(state.templates).length) {
    state.templates = {
      Senin: "Rekap data dan administrasi unit kerja.",
      Selasa: "Pengelolaan dokumen dan arsip pekerjaan.",
      Rabu: "Validasi data serta penyelesaian laporan.",
      Kamis: "Persiapan dokumen dan koordinasi kegiatan.",
      Jumat: "Sinkronisasi data dan evaluasi pekerjaan.",
      Sabtu: "Penyelesaian pekerjaan tambahan unit kerja."
    };
  }
}

function init() {
  loadLocal();
  initDemoDataIfEmpty();
  bindEvents();
  renderEmployees();
  renderTemplates();
  renderRows();
  syncActivityForSingleDate();
  setStatus(isConnected() ? "Aplikasi siap digunakan." : "Mode uji lokal aktif. Isi SCRIPT_URL di app.js untuk terhubung ke Spreadsheet.");
}

document.addEventListener("DOMContentLoaded", init);
