# Data Jemaah Gorontalo 2026

Website statis untuk identitas jemaah Gorontalo Kloter 28 dan Kloter 30.

Isi utama:
- biodata jemaah hasil olahan CSV
- foto jemaah
- kartu jemaah
- visa detail

Struktur proyek:
- `public/index.html`: halaman utama
- `public/styles.css`: tampilan dan responsivitas
- `public/app.js`: logika pencarian, filter, modal detail, dan loading state
- `public/data/*.json`: data jemaah siap pakai
- `public/assets/`: foto dan dokumen per jemaah
- `scripts/generate_site_data.py`: generator JSON dan aset dari sumber lokal

Fitur:
- pencarian cepat dengan hasil teratas
- filter kloter, rombongan, regu, status, dan kabupaten/kota
- modal detail jemaah yang mobile-friendly
- loading animation saat data JSON masih dimuat
- logo lokal untuk header dan favicon

Deploy ke Cloudflare Pages:
1. Hubungkan repository ini ke Cloudflare Pages.
2. Pilih framework preset `None`.
3. Kosongkan build command.
4. Set output directory ke `public`.
5. Deploy.

Catatan:
- Repository ini membawa seluruh aset statis, sehingga ukuran repo relatif besar.
- Website ini tidak memakai backend maupun Cloudflare Access.
