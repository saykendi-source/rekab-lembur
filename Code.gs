/**
 * Backend Google Apps Script untuk Aplikasi Laporan Pengajuan Lembur.
 * Cara pakai:
 * 1. Buka Google Spreadsheet template.
 * 2. Extensions > Apps Script.
 * 3. Tempel seluruh kode ini ke Code.gs.
 * 4. Jalankan fungsi setupSheets() sekali.
 * 5. Deploy sebagai Web App.
 */

const SHEETS = {
  pegawai: 'Pegawai',
  template: 'TemplateKegiatan',
  pengajuan: 'PengajuanLembur',
  detail: 'DetailLembur',
  pengaturan: 'Pengaturan'
};

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function doGet(e) {
  try {
    const action = (e.parameter.action || 'ping').toLowerCase();
    if (action === 'ping') return jsonOutput({ ok: true, message: 'Lembur API aktif', time: new Date().toISOString() });
    if (action === 'setup') return jsonOutput(setupSheets());
    if (action === 'pegawai') return jsonOutput({ employees: getEmployees_() });
    if (action === 'template') return jsonOutput({ templates: getTemplates_(e.parameter.nik || '') });
    if (action === 'bootstrap') {
      return jsonOutput({
        ok: true,
        employees: getEmployees_(),
        templates: getTemplates_(e.parameter.nik || '')
      });
    }
    return jsonOutput({ ok: false, error: 'Action tidak dikenal: ' + action });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err), stack: err.stack || '' });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupSheets();
    const payload = parsePayload_(e);
    const action = String(payload.action || '').toLowerCase();
    if (action === 'savetemplate') return jsonOutput(saveTemplate_(payload));
    if (action === 'savepengajuan') return jsonOutput(savePengajuan_(payload));
    return jsonOutput({ ok: false, error: 'Action POST tidak dikenal: ' + action });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err), stack: err.stack || '' });
  } finally {
    lock.releaseLock();
  }
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEETS.pegawai, ['NIK', 'Nama', 'Unit Kerja', 'Jabatan']);
  ensureSheet_(ss, SHEETS.template, ['NIK', 'Hari', 'Kegiatan Default', 'Updated At']);
  ensureSheet_(ss, SHEETS.pengajuan, [
    'ID', 'Timestamp', 'Nama', 'NIK', 'Unit Kerja', 'Jabatan', 'Bulan Pengajuan',
    'Total Hari', 'Total Jam', 'Status', 'Atasan Nama', 'Atasan Jabatan', 'Lokasi Tanggal', 'Catatan'
  ]);
  ensureSheet_(ss, SHEETS.detail, [
    'ID Pengajuan', 'Tanggal', 'Hari', 'Kegiatan', 'Jam Aktual Mulai', 'Jam Aktual Selesai',
    'Jam Hitung Mulai', 'Jam Hitung Selesai', 'Total Jam'
  ]);
  ensureSheet_(ss, SHEETS.pengaturan, ['Nama Pengaturan', 'Nilai']);
  seedSettings_();
  return { ok: true, message: 'Sheet siap digunakan.' };
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn())).getValues()[0];
    let changed = false;
    headers.forEach((h, i) => {
      if (existing[i] !== h) {
        existing[i] = h;
        changed = true;
      }
    });
    if (changed) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#dbeafe');
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

function seedSettings_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.pengaturan);
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, 5, 2).setValues([
    ['Jam kerja selesai', '16:00'],
    ['Mulai hitung lembur default', '17:00'],
    ['Selesai hitung lembur default', '20:00'],
    ['Maksimal jam lembur per hari', '4'],
    ['Nama instansi/unit', 'Unit Kerja']
  ]);
}

function getEmployees_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.pegawai);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  return values
    .filter(r => r[0] || r[1])
    .map(r => ({
      nik: String(r[0] || '').trim(),
      nama: String(r[1] || '').trim(),
      unitKerja: String(r[2] || '').trim(),
      jabatan: String(r[3] || '').trim()
    }));
}

function getTemplates_(nik) {
  nik = String(nik || '').trim();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.template);
  const out = {};
  if (!sh || sh.getLastRow() < 2 || !nik) return out;
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  values.forEach(r => {
    if (String(r[0]).trim() === nik) out[String(r[1]).trim()] = String(r[2] || '').trim();
  });
  return out;
}

function saveTemplate_(payload) {
  const nik = String(payload.nik || '').trim();
  if (!nik) throw new Error('NIK wajib diisi.');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.template);
  const templates = payload.templates || {};

  deleteRowsByColumnValue_(sh, 1, nik);
  const now = new Date();
  const rows = DAYS.map(day => [nik, day, String(templates[day] || '').trim(), now]);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  return { ok: true, message: 'Template tersimpan.', nik };
}

function savePengajuan_(payload) {
  const id = String(payload.id || makeId_()).trim();
  if (!payload.nama || !payload.nik || !payload.unitKerja) throw new Error('Nama, NIK, dan Unit Kerja wajib diisi.');
  const rows = payload.rows || [];
  if (!rows.length) throw new Error('Detail lembur masih kosong.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shMain = ss.getSheetByName(SHEETS.pengajuan);
  const shDetail = ss.getSheetByName(SHEETS.detail);

  // Jika ID sudah ada, hapus dulu supaya update tidak dobel.
  deleteRowsByColumnValue_(shMain, 1, id);
  deleteRowsByColumnValue_(shDetail, 1, id);

  shMain.getRange(shMain.getLastRow() + 1, 1, 1, 14).setValues([[
    id,
    payload.timestamp ? new Date(payload.timestamp) : new Date(),
    payload.nama || '',
    payload.nik || '',
    payload.unitKerja || '',
    payload.jabatan || '',
    payload.bulanPengajuan || '',
    Number(payload.totalHari || rows.length),
    Number(payload.totalJam || 0),
    payload.status || 'Diajukan',
    payload.atasanNama || '',
    payload.atasanJabatan || '',
    payload.lokasiTanggal || '',
    payload.catatan || ''
  ]]);

  const detailRows = rows.map(r => [
    id,
    r.tanggal ? new Date(r.tanggal + 'T00:00:00') : '',
    r.hari || '',
    r.kegiatan || '',
    r.aktualMulai || '',
    r.aktualSelesai || '',
    r.hitungMulai || '',
    r.hitungSelesai || '',
    Number(r.totalJam || 0)
  ]);
  shDetail.getRange(shDetail.getLastRow() + 1, 1, detailRows.length, 9).setValues(detailRows);
  shDetail.getRange(2, 2, Math.max(1, shDetail.getLastRow() - 1), 1).setNumberFormat('dd mmmm yyyy');

  return { ok: true, id, message: 'Pengajuan tersimpan.' };
}

function deleteRowsByColumnValue_(sheet, columnNumber, value) {
  if (!sheet || sheet.getLastRow() < 2) return;
  const target = String(value).trim();
  const values = sheet.getRange(2, columnNumber, sheet.getLastRow() - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]).trim() === target) sheet.deleteRow(i + 2);
  }
}

function parsePayload_(e) {
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      // fallback untuk form-urlencoded sederhana
    }
  }
  return e.parameter || {};
}

function makeId_() {
  const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
  const ym = Utilities.formatDate(new Date(), tz, 'yyyyMM');
  const suffix = Utilities.formatDate(new Date(), tz, 'HHmmss');
  return 'LBR-' + ym + '-' + suffix;
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
