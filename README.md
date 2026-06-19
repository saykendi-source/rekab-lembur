# Aplikasi Laporan Pengajuan Lembur

Aplikasi ini dibuat untuk GitHub Pages dengan database Google Spreadsheet dan backend Google Apps Script.

## Isi Paket

- `index.html` — halaman utama aplikasi.
- `style.css` — desain tampilan dan format cetak.
- `app.js` — logika input, template kegiatan, hitung jam, preview, simpan, dan cetak.
- `Code.gs` — backend Google Apps Script untuk membaca/menyimpan data ke Spreadsheet.
- `.nojekyll` — agar GitHub Pages membaca file statis apa adanya.
- `template-spreadsheet-lembur.xlsx` — template struktur spreadsheet.

## Alur Besar

1. Upload file web ke GitHub.
2. Aktifkan GitHub Pages.
3. Buat Google Spreadsheet dari template.
4. Tempel kode `Code.gs` ke Apps Script.
5. Deploy Apps Script sebagai Web App.
6. Salin URL Web App ke `CONFIG.SCRIPT_URL` di `app.js`.
7. Commit perubahan ke GitHub.
8. Buka aplikasi dan uji input lembur.

## Struktur Spreadsheet

### Sheet `Pegawai`

| NIK | Nama | Unit Kerja | Jabatan |
|---|---|---|---|

Isi master pegawai di sini. Aplikasi dapat mencari data pegawai dari sheet ini.

### Sheet `TemplateKegiatan`

| NIK | Hari | Kegiatan Default | Updated At |
|---|---|---|---|

Aplikasi akan menyimpan kegiatan default Senin sampai Sabtu per NIK.

### Sheet `PengajuanLembur`

Menyimpan data utama pengajuan, seperti ID pengajuan, nama, NIK, unit kerja, bulan, total hari, total jam, dan status.

### Sheet `DetailLembur`

Menyimpan rincian tanggal, kegiatan, jam aktual, jam dihitung, dan total jam.

### Sheet `Pengaturan`

Menyimpan pengaturan umum, misalnya jam mulai hitung lembur default.

## Pengaturan Apps Script

1. Buka Google Spreadsheet.
2. Pilih `Extensions > Apps Script`.
3. Hapus kode bawaan.
4. Tempel isi file `Code.gs`.
5. Simpan project.
6. Jalankan fungsi `setupSheets` satu kali.
7. Saat muncul permintaan izin, pilih akun Google yang digunakan.
8. Lanjutkan sampai proses otorisasi selesai.

## Deploy Web App

1. Di Apps Script, klik `Deploy > New deployment`.
2. Klik ikon roda gigi / pilih tipe deployment.
3. Pilih `Web app`.
4. Isi deskripsi, misalnya `Lembur API v1`.
5. Bagian `Execute as`, pilih `Me`.
6. Bagian `Who has access`, pilih `Anyone` atau `Anyone with the link`.
7. Klik `Deploy`.
8. Salin `Web app URL`.

## Menghubungkan GitHub Pages ke Apps Script

Buka file `app.js`, cari bagian berikut:

```js
const CONFIG = {
  SCRIPT_URL: "PASTE_WEB_APP_URL_HERE",
```

Ganti `PASTE_WEB_APP_URL_HERE` dengan URL Web App dari Apps Script.

Contoh:

```js
const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxxxx/exec",
```

Setelah itu commit ulang ke GitHub.

## Cara Uji Aplikasi

1. Buka alamat GitHub Pages.
2. Klik `Muat Data`.
3. Pilih atau isi data pegawai.
4. Isi template kegiatan Senin sampai Sabtu.
5. Klik `Simpan Template`.
6. Pilih tanggal lembur.
7. Kegiatan akan otomatis muncul sesuai hari.
8. Isi jam aktual dan jam yang dihitung.
9. Klik `Tambahkan ke Daftar`.
10. Klik `Tampilkan Preview`.
11. Klik `Simpan Pengajuan`.
12. Klik `Cetak / Simpan PDF`.

## Catatan Cetak PDF

Aplikasi memakai fitur cetak bawaan browser. Untuk membuat PDF:

1. Klik `Cetak / Simpan PDF`.
2. Pada tujuan printer, pilih `Save as PDF`.
3. Simpan file PDF.

Cara ini lebih ringan daripada membuat PDF memakai library tambahan.

## Catatan Penting

- Sebelum `SCRIPT_URL` diisi, aplikasi tetap bisa dicoba dalam mode lokal menggunakan `localStorage`.
- Data lokal hanya tersimpan di browser yang sama.
- Setelah terhubung ke Apps Script, data akan tersimpan di Google Spreadsheet.
- Jika ada perubahan kode Apps Script, lakukan deploy ulang dan gunakan URL deployment terbaru bila diperlukan.
