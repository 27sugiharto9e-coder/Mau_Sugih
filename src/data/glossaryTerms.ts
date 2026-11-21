export type GlossaryCategory =
  | 'Dasar & Mekanisme BEI'
  | 'Fundamental & Valuasi'
  | 'Analisis Teknikal'
  | 'Aksi Korporasi & Risiko';

export type GlossaryLevel = 'Pemula' | 'Menengah';

export interface GlossaryCaseStudy {
  title: string;
  scenario: string;
  calculation: string;
  takeaway: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  shortLabel?: string;
  category: GlossaryCategory;
  level: GlossaryLevel;
  shortMeaning: string;
  beginnerAnalogy: string;
  explanation: string;
  howToRead: string;
  commonMistake: string;
  formula?: string;
  exampleTicker?: string;
  caseStudy: GlossaryCaseStudy;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  'Dasar & Mekanisme BEI',
  'Fundamental & Valuasi',
  'Analisis Teknikal',
  'Aksi Korporasi & Risiko',
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'per',
    term: 'PER (Price to Earnings Ratio)',
    shortLabel: 'PER',
    category: 'Fundamental & Valuasi',
    level: 'Pemula',
    shortMeaning:
      'Rasio yang membandingkan harga saham saat ini dengan laba bersih per lembar saham (EPS) selama 12 bulan terakhir.',
    beginnerAnalogy:
      'Bayangkan Anda ditawari membeli kedai kopi seharga Rp100 juta yang mencetak laba bersih Rp10 juta per tahun. Artinya butuh 10 tahun bagi laba kedai itu untuk balik modal — itulah PER = 10x.',
    explanation:
      'PER membantu investor mengukur apakah harga sebuah saham tergolong murah atau mahal dibanding kemampuan perusahaan mencetak keuntungan.',
    howToRead:
      'PER di bawah 10x–15x umumnya dianggap menarik, tetapi wajib dibandingkan dengan rata-rata sektor sejenis serta pertumbuhan labanya. PER menjadi tidak terdefinisi/negatif jika perusahaan sedang rugi.',
    commonMistake:
      'Menganggap PER rendah pasti murah tanpa mengecek apakah labanya turun terus atau hanya berasal dari keuntungan sekali jual aset.',
    formula: 'PER = Harga Saham / EPS (Laba per Saham)',
    exampleTicker: 'BMRI',
    caseStudy: {
      title: 'Contoh Kasus: Membandingkan Saham Bank A vs Bank B',
      scenario:
        'Saham Bank A diperdagangkan di harga Rp5.000 dengan EPS Rp500. Sementara Bank B berharga Rp9.000 dengan EPS Rp450.',
      calculation:
        'PER Bank A = Rp5.000 / Rp500 = 10x. PER Bank B = Rp9.000 / Rp450 = 20x.',
      takeaway:
        'Secara valuasi laba saat ini, Bank A dua kali lebih murah daripada Bank B karena Anda hanya membayar Rp10 untuk setiap Rp1 laba tahunan perusahaan.',
    },
  },
  {
    id: 'pbv',
    term: 'PBV (Price to Book Value)',
    shortLabel: 'PBV',
    category: 'Fundamental & Valuasi',
    level: 'Pemula',
    shortMeaning:
      'Perbandingan harga pasar saham terhadap nilai buku (kekayaan bersih/ekuitas) per lembar saham perusahaan.',
    beginnerAnalogy:
      'Jika sebuah ruko punya nilai aset bersih (setelah dikurangi utang) sebesar Rp1 miliar, lalu pemiliknya menjual seharga Rp800 juta, maka Anda membelinya di PBV 0,8x (diskon 20% dari nilai asetnya).',
    explanation:
      'Nilai buku (BVPS) adalah total kekayaan bersih perusahaan milik pemegang saham jika seluruh aset dijual dan seluruh utang dilunasi. PBV melihat apakah pasar menghargai saham di atas atau di bawah kekayaan bersih tersebut.',
    howToRead:
      'PBV < 1x berarti harga pasar lebih murah dari nilai bukunya. Namun untuk bank atau konsumer berkualitas tinggi (ROE > 15%), PBV 2x–3x masih sering dianggap wajar karena bisnisnya sangat produktif.',
    commonMistake:
      'Membeli saham PBV 0,3x hanya karena terlihat murah, padahal perusahaan tersebut terus merugi sehingga nilai bukunya tergerus setiap tahun.',
    formula: 'PBV = Harga Saham / BVPS (Nilai Buku per Saham)',
    exampleTicker: 'BBRI',
    caseStudy: {
      title: 'Contoh Kasus: Menilai Diskon Aset Emiten Properti',
      scenario:
        'PT Properti Sejahtera memiliki ekuitas Rp1.200 per lembar (BVPS) dan saat ini harga sahamnya di pasar adalah Rp900.',
      calculation: 'PBV = Rp900 / Rp1.200 = 0,75x (diskon 25% di bawah nilai buku).',
      takeaway:
        'Selama perusahaan masih mencetak laba dan utangnya aman, PBV 0,75x menandakan pasar menghargai saham di bawah nilai kekayaan bersihnya.',
    },
  },
  {
    id: 'eps',
    term: 'EPS (Earning Per Share)',
    shortLabel: 'EPS',
    category: 'Fundamental & Valuasi',
    level: 'Pemula',
    shortMeaning:
      'Jumlah laba bersih perusahaan yang menjadi hak setiap satu lembar saham yang beredar di pasar.',
    beginnerAnalogy:
      'Jika sebuah toko roti meraih untung bersih Rp100 juta setahun dan kepemilikannya terbagi menjadi 1 juta lembar saham, maka jatah laba untuk setiap 1 lembar saham (EPS) adalah Rp100.',
    explanation:
      'EPS adalah ukuran langsung seberapa besar keuntungan riil yang dihasilkan perusahaan untuk tiap lembar saham yang Anda pegang. EPS menjadi bahan dasar perhitungan PER.',
    howToRead:
      'Cari perusahaan dengan tren EPS yang naik konsisten dari tahun ke tahun. Pertumbuhan EPS yang stabil adalah mesin penggerak harga saham dan kenaikan dividen jangka panjang.',
    commonMistake:
      'Hanya melihat nominal harga saham (misal Rp500 dianggap lebih murah daripada Rp5.000) tanpa melihat berapa EPS yang dihasilkan per lembarnya.',
    formula: 'EPS = Laba Bersih / Jumlah Saham Beredar',
    exampleTicker: 'BBCA',
    caseStudy: {
      title: 'Contoh Kasus: Dampak Pertumbuhan EPS ke Harga Saham',
      scenario:
        'PT Maju Pangan mencatat laba bersih Rp500 miliar dengan jumlah saham beredar 2 miliar lembar. Tahun lalu EPS-nya Rp200.',
      calculation:
        'EPS Tahun Ini = Rp500 miliar / 2 miliar lembar = Rp250/lembar (naik +25% YoY).',
      takeaway:
        'Jika pasar tetap menghargai saham ini pada PER 12x, nilai wajarnya ikut terdorong dari Rp2.400 (12 × Rp200) menjadi Rp3.000 (12 × Rp250).',
    },
  },
  {
    id: 'dividend-yield',
    term: 'Dividen & Dividend Yield',
    shortLabel: 'Dividen Yield',
    category: 'Fundamental & Valuasi',
    level: 'Pemula',
    shortMeaning:
      'Pembagian sebagian laba tunai kepada pemegang saham (Dividen), diukur dalam persentase terhadap harga beli sahamnya (Yield).',
    beginnerAnalogy:
      'Seperti uang sewa tahunan dari rumah kontrakan. Jika Anda membeli rumah Rp500 juta dan menerima uang sewa bersih Rp30 juta per tahun, maka yield sewa Anda adalah 6% per tahun.',
    explanation:
      'Investor saham mendapat keuntungan dari dua sumber: kenaikan harga (capital gain) dan bagi hasil laba tunai (dividen). Dividend Yield menunjukkan seberapa besar imbal hasil tunai tahunan relatif terhadap harga saham saat ini.',
    howToRead:
      'Yield di atas 4%–6% per tahun sudah cukup bersaing dengan deposito/obligasi, asalkan perusahaan mencetak arus kas bebas (FCF) positif agar dividennya tidak hanya sekali lewat.',
    commonMistake:
      'Terjebak "Dividend Trap": membeli saham tepat sebelum cum-date hanya karena yield tercatat 15%, lalu harga saham anjlok lebih dalam dari dividen yang diterima saat ex-date.',
    formula: 'Dividend Yield = (Dividen per Lembar / Harga Saham Sekarang) × 100%',
    exampleTicker: 'PTBA',
    caseStudy: {
      title: 'Contoh Kasus: Menghitung Pendapatan Pasif Dividen dari Modal Rp10 Juta',
      scenario:
        'Harga saham PT Tambang Nusantara Rp2.500 per lembar (Rp250.000/Lot) dan rutin membagikan dividen tahunan Rp200 per lembar.',
      calculation:
        'Dividend Yield = (Rp200 / Rp2.500) × 100% = 8,0%. Dengan modal Rp10 juta, Anda mendapat 40 Lot (4.000 lembar) → dividen tunai = 4.000 × Rp200 = Rp800.000/tahun.',
      takeaway:
        'Yield tinggi memberi arus kas pasif, tetapi selalu cek apakah laba perusahaan tahun depan diperkirakan tetap kuat menopang pembagian dividen tersebut.',
    },
  },
  {
    id: 'roe',
    term: 'ROE (Return on Equity)',
    shortLabel: 'ROE',
    category: 'Fundamental & Valuasi',
    level: 'Pemula',
    shortMeaning:
      'Persentase efisiensi perusahaan dalam menghasilkan laba bersih dari modal sendiri (ekuitas) pemegang saham.',
    beginnerAnalogy:
      'Anda menyetor modal Rp100 juta untuk membuka usaha katering. Dalam setahun usaha itu menghasilkan laba bersih Rp20 juta. Artinya produktivitas modal Anda (ROE) adalah 20% per tahun.',
    explanation:
      'ROE mengukur kualitas manajemen dan daya saing bisnis. Bisnis dengan keunggulan kompetitif kuat (moat) mampu menjaga ROE tetap tinggi selama bertahun-tahun.',
    howToRead:
      'ROE di atas 12%–15% per tahun menandakan profitabilitas yang solid. Bandingkan ROE dengan bunga deposito (~4%–5%); perusahaan idealnya jauh melampaui imbal hasil bebas risiko tersebut.',
    commonMistake:
      'Terpukau ROE 30% padahal utang perusahaan sangat menumpuk (DER > 3x pada non-bank), yang membuat ekuitas mengecil dan risiko gagal bayar membengkak.',
    formula: 'ROE = (Laba Bersih / Total Ekuitas) × 100%',
    exampleTicker: 'BBCA',
    caseStudy: {
      title: 'Contoh Kasus: Mengapa Perusahaan dengan ROE Tinggi Lebih Cepat Tumbuh',
      scenario:
        'Perusahaan X memiliki ekuitas Rp10 triliun dan laba bersih Rp2 triliun, sedangkan Perusahaan Y ekuitasnya Rp10 triliun tetapi labanya hanya Rp500 miliar.',
      calculation:
        'ROE X = (2 / 10) × 100% = 20%. ROE Y = (0,5 / 10) × 100% = 5%.',
      takeaway:
        'Dengan modal yang sama, Perusahaan X menghasilkan laba 4 kali lipat lebih besar sehingga lebih layak dihargai pada PBV lebih tinggi dibanding Perusahaan Y.',
    },
  },
  {
    id: 'der',
    term: 'DER (Debt to Equity Ratio)',
    shortLabel: 'DER',
    category: 'Fundamental & Valuasi',
    level: 'Menengah',
    shortMeaning:
      'Rasio perbandingan total kewajiban (utang) perusahaan terhadap total modal sendiri (ekuitas).',
    beginnerAnalogy:
      'Jika Anda membeli rumah Rp1 miliar menggunakan uang sendiri Rp500 juta dan KPR bank Rp500 juta, maka rasio utang terhadap modal Anda (DER) adalah 1,0x.',
    explanation:
      'DER membantu pemula menilai tingkat keamanan finansial perusahaan, terutama saat suku bunga pinjaman naik atau ekonomi melambat.',
    howToRead:
      'Untuk perusahaan non-keuangan (manufaktur/tambang/konsumer), DER < 1,0x tergolong aman dan konservatif. Khusus perbankan, DER memang tinggi (4x–8x) karena dana tabungan nasabah dicatat sebagai liabilitas.',
    commonMistake:
      'Menyamakan standar DER bank dengan pabrik. Bank yang sehat memang memiliki DER tinggi karena bisnis intinya menghimpun dana nasabah untuk disalurkan sebagai kredit.',
    formula: 'DER = Total Liabilitas / Total Ekuitas',
    exampleTicker: 'ADRO',
    caseStudy: {
      title: 'Contoh Kasus: Menguji Ketahanan Utang Emiten Saat Suku Bunga Naik',
      scenario:
        'PT Konstruksi Jaya punya total liabilitas Rp6 triliun dan ekuitas Rp2 triliun. Sementara PT Energi Bersih punya liabilitas Rp1,2 triliun dan ekuitas Rp3 triliun.',
      calculation:
        'DER Konstruksi Jaya = 6 / 2 = 3,0x. DER Energi Bersih = 1,2 / 3 = 0,4x.',
      takeaway:
        'PT Energi Bersih jauh lebih tahan menghadapi kenaikan bunga pinjaman karena porsi utangnya hanya 40% dari modal sendiri.',
    },
  },
  {
    id: 'margin-of-safety',
    term: 'Margin of Safety (Batas Keamanan)',
    shortLabel: 'Margin of Safety',
    category: 'Fundamental & Valuasi',
    level: 'Menengah',
    shortMeaning:
      'Persentase selisih diskon antara harga beli saham di pasar dengan perkiraan nilai wajar (intrinsic value) perusahaan.',
    beginnerAnalogy:
      'Jika sebuah jembatan dirancang mampu menahan beban 10 ton, Anda cukup melewatinya dengan truk bermuatan maksimal 7 ton. Selisih 3 ton (30%) itulah bantalan keamanan Anda agar jembatan tidak roboh.',
    explanation:
      'Konsep inti value investing yang dipopulerkan Benjamin Graham untuk melindungi investor dari salah hitung valuasi maupun gejolak pasar tak terduga.',
    howToRead:
      'Semakin besar Margin of Safety (misalnya ≥ 20%), semakin besar bantalan perlindungan risiko Anda dan semakin menarik peluang kenaikan harganya menuju nilai wajar.',
    commonMistake:
      'Membeli saham bagus pada harga berapa pun tanpa menghitung batas aman harga beli, sehingga jika pasar terkoreksi sedikit investor langsung mengalami rugi berkepanjangan.',
    formula: 'MoS = ((Nilai Wajar − Harga Sekarang) / Nilai Wajar) × 100%',
    exampleTicker: 'BBRI',
    caseStudy: {
      title: 'Contoh Kasus: Menentukan Harga Beli Aman Saham',
      scenario:
        'Berdasarkan perhitungan laba dan ekuitasnya, nilai wajar saham PT Ritel Makmur diperkirakan Rp2.500 per lembar. Saat ini harga pasar berada di Rp1.900.',
      calculation:
        'MoS = ((2.500 − 1.900) / 2.500) × 100% = +24%. Jika target MoS minimal 20%, batas harga beli aman adalah 2.500 × 80% = Rp2.000.',
      takeaway:
        'Karena Rp1.900 berada di bawah batas aman Rp2.000, investor memiliki Margin of Safety 24% sebagai pelindung risiko.',
    },
  },
  {
    id: 'lot',
    term: 'Lot (Satuan Perdagangan Saham)',
    shortLabel: 'Lot',
    category: 'Dasar & Mekanisme BEI',
    level: 'Pemula',
    shortMeaning:
      'Satuan jumlah minimum pembelian atau penjualan saham di pasar reguler BEI, di mana 1 Lot = 100 lembar saham.',
    beginnerAnalogy:
      'Sama seperti membeli air mineral dalam satuan dus berisi 24 botol — Anda tidak bisa membeli hanya 1 botol di kasir grosir; di bursa saham satuan terkecilnya adalah 1 Lot berisi 100 lembar.',
    explanation:
      'Semua harga saham yang tertera di layar bursa adalah harga per 1 lembar. Untuk mengetahui uang yang harus disiapkan, kalikan harga lembar tersebut dengan 100.',
    howToRead:
      'Pemula dengan modal terjangkau tetap bisa mulai berinvestasi di saham berkualitas dengan membeli 1–5 Lot terlebih dahulu.',
    commonMistake:
      'Mengira modal membeli saham berharga Rp3.000 cukup Rp3.000 saja, padahal untuk 1 Lot (100 lembar) dibutuhkan Rp300.000 ditambah biaya beli broker.',
    formula: 'Modal Beli = Jumlah Lot × 100 × Harga per Lembar',
    exampleTicker: 'BBRI',
    caseStudy: {
      title: 'Contoh Kasus: Menghitung Kebutuhan Modal Membeli 3 Lot Saham',
      scenario:
        'Anda ingin membeli 3 Lot saham BBRI yang saat ini dihargai Rp4.200 per lembar dengan biaya broker beli 0,15%.',
      calculation:
        '3 Lot = 300 lembar. Nilai saham = 300 × Rp4.200 = Rp1.260.000. Biaya broker 0,15% = Rp1.890. Total dana yang dibutuhkan = Rp1.261.890.',
      takeaway:
        'Cukup dengan kisaran Rp1,26 juta Anda sudah resmi memiliki 300 lembar saham bank BUMN besar di BEI.',
    },
  },
  {
    id: 'ihsg',
    term: 'IHSG (Indeks Harga Saham Gabungan)',
    shortLabel: 'IHSG',
    category: 'Dasar & Mekanisme BEI',
    level: 'Pemula',
    shortMeaning:
      'Indeks acuan utama yang mengukur kinerja gabungan seluruh saham perusahaan tercatat di Bursa Efek Indonesia.',
    beginnerAnalogy:
      'Jika bursa saham adalah satu kelas berisi 800+ murid, maka IHSG adalah nilai rata-rata rapot seluruh kelas tersebut secara keseluruhan.',
    explanation:
      'IHSG (^JKSE) bertindak sebagai cermin sentimen pasar saham Indonesia. Saham berkapitalisasi besar seperti BBCA, BBRI, BMRI, dan TLKM memiliki bobot paling besar terhadap naik-turunnya IHSG.',
    howToRead:
      'Gunakan IHSG untuk memahami iklim pasar secara umum. Saat IHSG turun tajam akibat isu makro global, saham bagus pun sering ikut terdampak sementara.',
    commonMistake:
      'Mengira jika IHSG naik 1%, semua saham di portofolio pasti ikut naik 1%. Setiap emiten bergerak sesuai kinerja dan sentimen sektornya masing-masing.',
    caseStudy: {
      title: 'Contoh Kasus: Membaca Pengaruh Saham Big Cap terhadap IHSG',
      scenario:
        'Pada hari tertentu IHSG melemah -1,2% sementara sektor Energi justru menguat +2,1%.',
      calculation:
        'Karena bobot sektor Keuangan & Infrastruktur di IHSG mencapai >40%, koreksi pada 3 bank besar sudah cukup menarik IHSG ke zona merah.',
      takeaway:
        'Pantau tidak hanya angka IHSG, tetapi juga pergerakan sektor industri pada panel Kinerja Sektor di halaman Ringkasan Harian.',
    },
  },
  {
    id: 'bid-offer',
    term: 'Bid & Offer (Order Book)',
    shortLabel: 'Bid & Offer',
    category: 'Dasar & Mekanisme BEI',
    level: 'Pemula',
    shortMeaning:
      'Daftar antrean harga pembeli tertinggi (Bid) dan harga penjual terendah (Offer/Ask) yang sedang aktif di bursa.',
    beginnerAnalogy:
      'Di pasar tradisional, Bid adalah harga tawar pembeli ("Saya mau beli di Rp4.950"), sedangkan Offer adalah harga pasang penjual ("Saya lepas di Rp5.000").',
    explanation:
      'Jika Anda ingin transaksi langsung berhasil (match), beli di harga Offer terendah (HAKA) atau jual di harga Bid tertinggi (HAKI). Jika ingin harga lebih murah, pasang antrean di kolom Bid.',
    howToRead:
      'Jarak (spread) yang rapat antar harga Bid dan Offer disertai antrean ribuan Lot menandakan saham sangat likuid dan mudah diperjualbelikan.',
    commonMistake:
      'Memasang order beli pada saham tidak likuid yang antrean Bid/Offer-nya kosong atau renggang, sehingga sulit menjualnya kembali saat butuh dana.',
    exampleTicker: 'BBCA',
    caseStudy: {
      title: 'Contoh Kasus: Membeli Langsung vs Antre Harga',
      scenario:
        'Order book BBCA menampilkan Bid tertinggi Rp5.650 (5.200 Lot) dan Offer terendah Rp5.675 (3.400 Lot).',
      calculation:
        'Beli di Rp5.675 → order langsung tereksekusi seketika. Pasang beli di Rp5.625 → order masuk antrean Bid dan baru cocok jika harga pasar turun menyentuh Rp5.625.',
      takeaway:
        'Untuk saham likuid dengan selisih 1 fraksi harga (Rp25), membeli langsung di Offer tidak menimbulkan selisih biaya yang signifikan.',
    },
  },
  {
    id: 'ara-arb',
    term: 'ARA & ARB (Auto Rejection Atas & Bawah)',
    shortLabel: 'ARA & ARB',
    category: 'Dasar & Mekanisme BEI',
    level: 'Pemula',
    shortMeaning:
      'Batas persentase kenaikan tertinggi (ARA) dan penurunan terdalam (ARB) harga saham yang diizinkan BEI dalam satu hari bursa.',
    beginnerAnalogy:
      'Seperti sekring pembatas arus listrik di rumah — otomatis memutus kenaikan atau penurunan harga yang terlalu ekstrem dalam satu hari agar perdagangan tetap terkendali.',
    explanation:
      'Di BEI, batas Auto Rejection simetris umumnya berkisar 20% hingga 35% per hari tergantung rentang harga sahamnya. Sistem bursa menolak order di luar rentang harga tersebut.',
    howToRead:
      'Saham yang menyentuh ARA menandakan minat beli sangat besar tanpa ada yang bersedia menjual. Sebaliknya, saham terkunci di ARB berisiko tidak bisa dijual pada hari itu.',
    commonMistake:
      'Mengejar saham gorengan yang sudah berhari-hari ARA tanpa fundamental jelas; begitu berbalik arah ke ARB, investor pemula kerap terjebak tidak bisa menjual.',
    caseStudy: {
      title: 'Contoh Kasus: Simulasi Batas Harga Harian Saham Rp1.000',
      scenario:
        'Sebuah saham ditutup kemarin di harga Rp1.000 (masuk rentang batas harian ±25%).',
      calculation:
        'Batas ARA hari ini = Rp1.000 + 25% = Rp1.250. Batas ARB hari ini = Rp1.000 − 25% = Rp750.',
      takeaway:
        'Order beli di atas Rp1.250 atau order jual di bawah Rp750 akan otomatis ditolak oleh sistem perdagangan BEI.',
    },
  },
  {
    id: 'blue-chip',
    term: 'Saham Blue Chip',
    shortLabel: 'Blue Chip',
    category: 'Dasar & Mekanisme BEI',
    level: 'Pemula',
    shortMeaning:
      'Saham perusahaan besar yang mapan secara finansial, pemimpin pasar di industrinya, sangat likuid, dan konsisten mencetak laba.',
    beginnerAnalogy:
      'Jika berinvestasi diibaratkan memilih kendaraan jarak jauh, saham Blue Chip adalah bus eksekutif mesin terawat: bukan yang paling ngebut seketika, tetapi paling nyaman dan tahan guncangan.',
    explanation:
      'Di Indonesia, saham Blue Chip umumnya menjadi penghuni utama indeks LQ45 atau IDX30 dengan kapitalisasi pasar puluhan hingga ratusan triliun rupiah.',
    howToRead:
      'Sangat ideal dijadikan fondasi 60%–80% portofolio investor pemula karena risiko bangkrut rendah dan sering membagikan dividen rutin.',
    commonMistake:
      'Beranggapan saham Blue Chip tidak bisa turun atau bisa dibeli di harga berapa pun tanpa memperhatikan valuasi PER/PBV-nya.',
    exampleTicker: 'BBCA',
    caseStudy: {
      title: 'Contoh Kasus: Membangun Portofolio Inti Pemula',
      scenario:
        'Seorang pemula memiliki dana Rp15 juta dan ingin membagi ke 3 saham Blue Chip berbeda sektor agar risikonya tersebar.',
      calculation:
        'Alokasi Rp5 juta ke Perbankan (BBCA/BBRI), Rp5 juta ke Infrastruktur Telekomunikasi (TLKM), dan Rp5 juta ke Konsumer (ICBP).',
      takeaway:
        'Diversifikasi lintas sektor pada saham Blue Chip melindungi portofolio jika salah satu sektor sedang lesu.',
    },
  },
  {
    id: 'market-cap',
    term: 'Kapitalisasi Pasar (Market Cap)',
    shortLabel: 'Market Cap',
    category: 'Dasar & Mekanisme BEI',
    level: 'Pemula',
    shortMeaning:
      'Total nilai pasar seluruh saham perusahaan yang beredar di publik, mencerminkan ukuran skala perusahaan di bursa.',
    beginnerAnalogy:
      'Sebuah pizza dipotong 10 bagian seharga Rp20.000/potong (total nilai Rp200.000) nilainya tetap lebih besar daripada kue kecil dipotong 2 bagian seharga Rp50.000/potong (total Rp100.000).',
    explanation:
      'Market Cap menunjukkan ukuran perusahaan sesungguhnya (Big Cap, Mid Cap, atau Small Cap), bukan sekadar melihat harga per lembar sahamnya.',
    howToRead:
      'Emiten dengan Market Cap > Rp100 Triliun tergolong raksasa (Big Cap) dengan stabilitas lebih tinggi dibanding emiten berkapitalisasi di bawah Rp5 Triliun.',
    commonMistake:
      'Mengira saham berharga Rp100 "lebih murah" atau "perusahaan kecil" dibanding saham Rp10.000 tanpa mengalikan jumlah total lembar saham beredarnya.',
    formula: 'Market Cap = Harga Saham × Total Saham Beredar',
    exampleTicker: 'TLKM',
    caseStudy: {
      title: 'Contoh Kasus: Harga Lembar Kecil Belum Tentu Perusahaan Kecil',
      scenario:
        'Emiten A berharga Rp1.000 dengan 100 miliar lembar saham beredar. Emiten B berharga Rp5.000 dengan 1 miliar lembar saham beredar.',
      calculation:
        'Market Cap A = Rp1.000 × 100 miliar = Rp100 Triliun. Market Cap B = Rp5.000 × 1 miliar = Rp5 Triliun.',
      takeaway:
        'Meski harga per lembarnya lebih rendah, Emiten A berukuran 20 kali lebih besar daripada Emiten B.',
    },
  },
  {
    id: 'fcf',
    term: 'Free Cash Flow (Arus Kas Bebas)',
    shortLabel: 'Free Cash Flow',
    category: 'Fundamental & Valuasi',
    level: 'Menengah',
    shortMeaning:
      'Sisa uang tunai bersih dari kegiatan operasional setelah dikurangi belanja modal (CapEx) untuk merawat atau memperluas aset.',
    beginnerAnalogy:
      'Setelah gaji bulanan diterima dan dipakai membayar biaya operasional serta perawatan alat kerja, sisa uang tunai yang benar-benar bisa Anda tabung atau bagikan itulah Free Cash Flow.',
    explanation:
      'Laba bersih di laporan Laba Rugi bisa dipengaruhi pencatatan akuntansi non-tunai, sedangkan Free Cash Flow menunjukkan uang tunai riil yang tersisa untuk membayar dividen dan melunasi utang.',
    howToRead:
      'Bandingkan FCF dengan Laba Bersih di tab Arus Kas. Perusahaan dengan FCF positif yang konsisten menandakan kualitas laba yang sangat sehat.',
    commonMistake:
      'Hanya membaca Laba Bersih tanpa memeriksa Arus Kas Operasi; perusahaan bisa terlihat untung di atas kertas padahal kasnya seret karena piutang macet.',
    formula: 'FCF = Arus Kas Operasi − Belanja Modal (CapEx)',
    exampleTicker: 'TLKM',
    caseStudy: {
      title: 'Contoh Kasus: Menguji Kemampuan Perusahaan Membayar Dividen',
      scenario:
        'Dalam satu kuartal, perusahaan menghasilkan Arus Kas Operasi Rp16 triliun dan mengeluarkan CapEx Rp8 triliun untuk perawatan jaringan.',
      calculation: 'Free Cash Flow = Rp16 triliun − Rp8 triliun = +Rp8 triliun.',
      takeaway:
        'Sisa kas Rp8 triliun memberi ruang yang sangat leluasa bagi perusahaan untuk membagikan dividen tunai tanpa perlu berutang.',
    },
  },
  {
    id: 'candlestick',
    term: 'Grafik Candlestick',
    shortLabel: 'Candlestick',
    category: 'Analisis Teknikal',
    level: 'Pemula',
    shortMeaning:
      'Grafik lilin yang merangkum 4 informasi harga dalam satu periode: Buka (Open), Tertinggi (High), Terendah (Low), dan Tutup (Close).',
    beginnerAnalogy:
      'Seperti laporan ringkas pertandingan tarik tambang harian: bagian badan lilin menunjukkan siapa yang menang di akhir hari (pembeli atau penjual), sedangkan garis sumbu menunjukkan tarik-ulur terjauh sepanjang hari.',
    explanation:
      'Jika penutupan lebih tinggi dari pembukaan, lilin berwarna hijau/teal (bullish). Jika penutupan lebih rendah dari pembukaan, lilin berwarna merah (bearish).',
    howToRead:
      'Perhatikan panjang sumbu (wick) bawah: sumbu bawah panjang setelah tren turun menandakan pembeli mulai masuk menahan kejatuhan harga.',
    commonMistake:
      'Langsung membeli hanya karena melihat satu lilin hijau tanpa mengecek tren besar dan volume perdagangannya.',
    caseStudy: {
      title: 'Contoh Kasus: Membaca Lilin Penolakan Penurunan (Hammer)',
      scenario:
        'Saham dibuka di Rp2.000, sempat turun dalam sesi siang ke Rp1.900, lalu diborong kembali hingga tutup di Rp2.020.',
      calculation:
        'Terbentuk badan lilin hijau tipis (2.000 → 2.020) dengan ekor bawah panjang hingga Rp1.900.',
      takeaway:
        'Pola ini mengindikasikan adanya daya beli kuat di sekitar area Rp1.900 yang berpotensi menjadi penahan penurunan.',
    },
  },
  {
    id: 'support-resistance',
    term: 'Support & Resistance',
    shortLabel: 'Support & Resistance',
    category: 'Analisis Teknikal',
    level: 'Pemula',
    shortMeaning:
      'Area lantai harga yang kerap menahan penurunan (Support) dan area atap harga yang kerap menahan kenaikan (Resistance).',
    beginnerAnalogy:
      'Bayangkan bola memantul di dalam kamar: lantai adalah Support yang memantulkan bola kembali ke atas, dan langit-langit adalah Resistance yang menahan bola agar tidak langsung menembus ke atas.',
    explanation:
      'Level ini muncul karena banyak pelaku pasar mengingat area harga historis tersebut sebagai titik beli murah atau titik ambil untung.',
    howToRead:
      'Pemula sebaiknya mempertimbangkan beli bertahap di dekat area Support yang memantul, bukan mengejar beli tepat di bawah atap Resistance.',
    commonMistake:
      'Menahan saham terus-menerus tanpa evaluasi saat harga sudah jebol ke bawah Support kuat disertai volume jual besar.',
    caseStudy: {
      title: 'Contoh Kasus: Menentukan Titik Masuk Terukur',
      scenario:
        'Selama 3 bulan terakhir saham X berulang kali memantul naik dari area Rp1.500 (Support) dan selalu tertahan di Rp1.800 (Resistance).',
      calculation:
        'Jika Anda membeli di Rp1.530 dengan target jual di Rp1.780 (+16,3%) dan batas cut loss di Rp1.460 (−4,5%), rasio untung vs ruginya lebih dari 3:1.',
      takeaway:
        'Mengenali Support & Resistance membuat rencana beli dan batas risiko jauh lebih disiplin.',
    },
  },
  {
    id: 'moving-average',
    term: 'Moving Average (MA20 & MA50)',
    shortLabel: 'Moving Average',
    category: 'Analisis Teknikal',
    level: 'Pemula',
    shortMeaning:
      'Garis rata-rata harga penutupan selama periode tertentu (20 atau 50 hari bursa) untuk memperhalus fluktuasi dan melihat arah tren.',
    beginnerAnalogy:
      'Nilai harian cuaca bisa berubah mendadak hujan atau panas, tetapi rata-rata suhu 30 hari terakhir (Moving Average) menunjukkan apakah kita sedang memasuki musim hujan atau kemarau.',
    explanation:
      'MA20 mewakili rata-rata tren jangka pendek (~1 bulan perdagangan), sedangkan MA50 mewakili tren jangka menengah (~2,5 bulan perdagangan).',
    howToRead:
      'Harga yang bergerak stabil di atas MA20 dan MA50 menandakan tren naik (uptrend). Jika MA20 memotong ke atas MA50 (Golden Cross), momentum jangka menengah mulai menguat.',
    commonMistake:
      'Mengandalkan garis Moving Average pada saham yang sedang bergerak mendatar (sideways) karena sinyal potongannya kerap bolak-balik.',
    caseStudy: {
      title: 'Contoh Kasus: Membaca Sinyal Pemulihan Tren di Grafik',
      scenario:
        'Setelah turun 2 bulan, harga saham TLKM naik ke Rp2.180 dan berhasil menembus ke atas garis MA20 (Rp2.075), sementara MA50 masih berada di Rp2.250.',
      calculation:
        'Posisi harga Rp2.180 > MA20 (Rp2.075) menandakan pemulihan jangka pendek awal, dengan ujian resisten terdekat di MA50 (Rp2.250).',
      takeaway:
        'Anda bisa memantau apakah harga mampu bertahan di atas MA20 sebelum mengonfirmasi pembalikan tren penuh di atas MA50.',
    },
  },
  {
    id: 'rsi',
    term: 'RSI (Relative Strength Index)',
    shortLabel: 'RSI (14)',
    category: 'Analisis Teknikal',
    level: 'Menengah',
    shortMeaning:
      'Indikator momentum berskala 0–100 untuk mendeteksi kondisi pasar yang terlalu ramai beli (overbought) atau terlalu banyak jual (oversold).',
    beginnerAnalogy:
      'Seperti pengukur suhu mesin mobil (0–100): di atas 70 mesin mulai kepanasan (rawan perlu pendinginan/koreksi), sedangkan di bawah 30 berarti terlalu dingin (potensi mulai memanas kembali).',
    explanation:
      'RSI(14) membandingkan rata-rata kekuatan kenaikan harga terhadap rata-rata penurunannya selama 14 hari perdagangan terakhir.',
    howToRead:
      'RSI > 70 = Jenuh Beli (Overbought, rawan koreksi). RSI < 30 = Jenuh Jual (Oversold, peluang pantulan teknikal). Zona 40–60 = Netral.',
    commonMistake:
      'Langsung membeli hanya karena RSI di bawah 30 tanpa memeriksa apakah fundamental perusahaan bermasalah — saham yang fundamentalnya rusak bisa bertahan di zona oversold cukup lama.',
    caseStudy: {
      title: 'Contoh Kasus: Menghindari Membeli di Puncak Euforia',
      scenario:
        'Saham komoditas naik +35% dalam dua minggu hingga harga Rp3.400 dan indikator RSI(14) menyentuh level 81.',
      calculation:
        'RSI 81 jauh melampaui ambang jenuh beli 70.',
      takeaway:
        'Alih-alih ikut mengejar di Rp3.400, investor sabar menunggu pendinginan harga atau koreksi sehat menuju area Support/MA20.',
    },
  },
  {
    id: 'volume',
    term: 'Volume Perdagangan',
    shortLabel: 'Volume',
    category: 'Analisis Teknikal',
    level: 'Pemula',
    shortMeaning:
      'Total jumlah lembar atau nilai saham yang benar-benar berpindah tangan antara pembeli dan penjual dalam satu sesi.',
    beginnerAnalogy:
      'Kenaikan harga tanpa volume besar seperti sorakan dari 3 penonton saja; kenaikan harga dengan lonjakan volume besar seperti dukungan ribuan penonton di stadion.',
    explanation:
      'Volume mengonfirmasi seberapa besar partisipasi dan keyakinan pelaku pasar (termasuk institusi besar) di balik pergerakan harga.',
    howToRead:
      'Penembusan atap harga (breakout) yang disertai volume jauh di atas rata-rata 20 hari terakhir cenderung lebih dapat diandalkan.',
    commonMistake:
      'Mengabaikan volume pada saham yang tiba-tiba naik tinggi hanya dengan nilai transaksi puluhan juta rupiah, yang sangat mudah berbalik turun.',
    caseStudy: {
      title: 'Contoh Kasus: Membedakan Breakout Valid vs Semu',
      scenario:
        'Rata-rata volume harian saham X adalah 15 juta lembar. Hari ini harga menembus resisten Rp1.200 dengan volume 62 juta lembar.',
      calculation: 'Volume hari ini = 4,1× lipat di atas rata-rata harian.',
      takeaway:
        'Lonjakan volume 4× lipat mengonfirmasi adanya akumulasi minat beli yang kuat di balik penembusan harga tersebut.',
    },
  },
  {
    id: 'ipo',
    term: 'IPO (Initial Public Offering)',
    shortLabel: 'IPO',
    category: 'Aksi Korporasi & Risiko',
    level: 'Pemula',
    shortMeaning:
      'Penawaran umum perdana saat perusahaan tertutup pertama kali menjual sahamnya ke masyarakat melalui Bursa Efek Indonesia.',
    beginnerAnalogy:
      'Seperti restoran keluarga sukses yang memutuskan membuka kepemilikan untuk umum agar mendapat modal segar membangun 50 cabang baru di seluruh Indonesia.',
    explanation:
      'Perusahaan memperoleh dana ekspansi tanpa utang berbunga, sedangkan masyarakat dapat ikut menjadi pemilik perusahaan sejak hari pertama melantai di bursa.',
    howToRead:
      'Baca prospektus ringkas: perhatikan untuk apa dana IPO dipakai (ekspansi produktif vs sekadar bayar utang) serta cek kewajaran PER/PBV harga penawarannya.',
    commonMistake:
      'Ikut memesan IPO hanya karena tren ramai di media sosial tanpa memeriksa apakah perusahaan tersebut mencetak laba atau justru merugi.',
    caseStudy: {
      title: 'Contoh Kasus: Menilai Kualitas Penggunaan Dana IPO',
      scenario:
        'Calon emiten IPO menargetkan dana Rp500 miliar: 80% untuk membangun pabrik baru yang meningkatkan kapasitas produksi, dan 20% untuk modal kerja.',
      calculation:
        'Alokasi 80% langsung ke aset produktif jauh lebih positif dibanding emiten yang menggunakan 70% dana IPO hanya untuk melunasi utang lama.',
      takeaway:
        'Fokus pada prospek pertumbuhan laba setelah dana IPO masuk, bukan hanya euforia hari pertama pencatatan.',
    },
  },
  {
    id: 'stock-split',
    term: 'Stock Split (Pemecahan Saham)',
    shortLabel: 'Stock Split',
    category: 'Aksi Korporasi & Risiko',
    level: 'Pemula',
    shortMeaning:
      'Pemecahan jumlah lembar saham menjadi lebih banyak diikuti penurunan harga per lembar secara proporsional tanpa mengubah nilai perusahaan.',
    beginnerAnalogy:
      'Menukar 1 lembar uang Rp100.000 menjadi 5 lembar uang Rp20.000 — jumlah lembarnya bertambah banyak, tetapi total nilai uang di dompet Anda tetap sama persis.',
    explanation:
      'Perusahaan melakukan stock split agar harga 1 Lot saham menjadi lebih terjangkau oleh investor ritel sehingga likuiditas perdagangan meningkat.',
    howToRead:
      'Rasio valuasi PER, PBV, dan persentase kepemilikan Anda tidak berubah setelah stock split.',
    commonMistake:
      'Mengira harga saham "tiba-tiba anjlok" 80% pada hari stock split 1:5 atau mengira fundamental perusahaan menjadi 5 kali lebih murah.',
    formula: 'Harga Baru = Harga Lama / Rasio Split | Lembar Baru = Lembar Lama × Rasio Split',
    exampleTicker: 'BBCA',
    caseStudy: {
      title: 'Contoh Kasus: Simulasi Stock Split 1:5',
      scenario:
        'Anda memiliki 2 Lot (200 lembar) saham BBCA seharga Rp35.000/lembar (total nilai Rp7.000.000), lalu perusahaan melakukan stock split 1:5.',
      calculation:
        'Jumlah saham Anda menjadi 200 × 5 = 1.000 lembar (10 Lot), dan harga menyesuaikan menjadi Rp35.000 / 5 = Rp7.000/lembar. Total nilai = 1.000 × Rp7.000 = Rp7.000.000.',
      takeaway:
        'Kekayaan Anda tetap Rp7 juta, namun kini investor baru cukup menyiapkan Rp700.000 untuk membeli 1 Lot (sebelumnya Rp3,5 juta).',
    },
  },
  {
    id: 'right-issue',
    term: 'Right Issue (HMETD)',
    shortLabel: 'Right Issue',
    category: 'Aksi Korporasi & Risiko',
    level: 'Menengah',
    shortMeaning:
      'Penerbitan saham baru yang ditawarkan lebih dahulu kepada pemegang saham lama (Hak Memesan Efek Terlebih Dahulu) untuk menambah modal perusahaan.',
    beginnerAnalogy:
      'Usaha patungan Anda bersama teman membutuhkan tambahan modal renovasi. Pemilik lama diberi hak prioritas menyetor modal tambahan agar porsi kepemilikannya tidak berkurang.',
    explanation:
      'Jika Anda menebus Right Issue, persentase kepemilikan Anda terjaga. Jika tidak ditebus dan tidak dijual haknya, persentase kepemilikan Anda terdilusi karena jumlah total saham beredar bertambah.',
    howToRead:
      'Periksa harga tebus Right Issue dan tujuan dananya (ekspansi akuisisi menguntungkan vs menambal kerugian).',
    commonMistake:
      'Membiarkan hak Right Issue hangus tanpa ditebus atau dijual saat harga pasar berada jauh di atas harga tebus, sehingga kehilangan nilai hak tersebut.',
    caseStudy: {
      title: 'Contoh Kasus: Menghitung Harga Teoritis Saat Right Issue',
      scenario:
        'Harga saham saat ini Rp1.200. Perusahaan menggelar Right Issue rasio 2:1 (setiap 2 saham lama berhak membeli 1 saham baru) di harga tebus Rp900.',
      calculation:
        'Harga Teoritis = ((2 × Rp1.200) + (1 × Rp900)) / (2 + 1) = Rp3.300 / 3 = Rp1.100.',
      takeaway:
        'Harga pasar akan menyesuaikan secara teoritis menuju Rp1.100 pada tanggal ex-right, bukan berarti saham mengalami penurunan fundamental.',
    },
  },
  {
    id: 'cut-loss-tp',
    term: 'Cut Loss & Take Profit',
    shortLabel: 'Cut Loss & TP',
    category: 'Aksi Korporasi & Risiko',
    level: 'Pemula',
    shortMeaning:
      'Disiplin menjual saham untuk membatasi kerugian maksimal (Cut Loss) atau mengamankan keuntungan saat target tercapai (Take Profit).',
    beginnerAnalogy:
      'Seperti memakai sabuk pengaman dan rem saat berkendara: bukan karena berharap kecelakaan, melainkan memastikan jika terjadi kesalahan arah kita tetap selamat untuk melanjutkan perjalanan.',
    explanation:
      'Menentukan batas rugi dan target laba sebelum menekan tombol beli mencegah keputusan emosional saat harga bergerak cepat.',
    howToRead:
      'Pada strategi trading jangka pendek-menengah, batasi risiko kerugian sekitar 5%–8% per posisi sambil menargetkan potensi untung minimal 15%–20%.',
    commonMistake:
      'Menolak Cut Loss saat tesis investasi sudah batal hingga rugi −5% membengkak menjadi −60% ("terpaksa jadi investor jangka panjang").',
    caseStudy: {
      title: 'Contoh Kasus: Matematika Pemulihan Kerugian',
      scenario:
        'Bandingkan kerugian kecil yang segera dibatasi (−10%) dengan kerugian besar yang dibiarkan (−50%) pada modal awal Rp10 juta.',
      calculation:
        'Rugi −10% (sisa Rp9 juta) hanya butuh naik +11,1% untuk balik modal. Rugi −50% (sisa Rp5 juta) butuh naik +100% (2 kali lipat) sekadar untuk kembali ke modal awal!',
      takeaway:
        'Membatasi kerugian kecil sejak dini menjaga modal Anda tetap lincah untuk peluang berikutnya.',
    },
  },
  {
    id: 'dca',
    term: 'DCA (Dollar Cost Averaging)',
    shortLabel: 'DCA',
    category: 'Aksi Korporasi & Risiko',
    level: 'Pemula',
    shortMeaning:
      'Strategi menabung saham secara rutin dalam nominal tetap setiap periode (misal tiap bulan setelah gajian) tanpa menebak waktu pasar.',
    beginnerAnalogy:
      'Menyisihkan Rp1 juta tiap tanggal gajian untuk membeli emas atau saham perusahaan bagus — saat harga sedang turun Anda otomatis mendapat barang lebih banyak dengan uang Rp1 juta yang sama.',
    explanation:
      'DCA menghilangkan stres menebak kapan titik harga terendah. Dalam jangka panjang (3–10 tahun), harga beli rata-rata menjadi lebih seimbang dan efek compounding bekerja maksimal.',
    howToRead:
      'Pastikan metode DCA hanya diterapkan pada emiten berfundamental kuat dan sehat (seperti Blue Chip atau emiten dengan ROE stabil), bukan saham yang bisnisnya terus menyusut.',
    commonMistake:
      'Melakukan DCA terus-menerus pada saham yang fundamentalnya memburuk tanpa mengevaluasi laporan keuangan kuartalannya.',
    caseStudy: {
      title: 'Contoh Kasus: Menabung Rp1 Juta/Bulan Saat Harga Berfluktuasi',
      scenario:
        'Anda membeli saham secara rutin Rp1.000.000/bulan selama 3 bulan saat harga berturut-turut Rp2.500, Rp2.000, lalu Rp2.500.',
      calculation:
        'Bulan 1: dapat 400 lembar | Bulan 2: dapat 500 lembar | Bulan 3: dapat 400 lembar. Total 1.300 lembar dengan modal Rp3.000.000 → harga rata-rata Rp2.308 (lebih rendah dari harga saat ini Rp2.500!).',
      takeaway:
        'Di akhir bulan ke-3 nilai saham Anda Rp3.250.000 (+8,3%) meski harga pasar hanya kembali ke titik awal Rp2.500.',
    },
  },
];

export const BEGINNER_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    question:
      'Jika harga saham PTBA berada di Rp2.700 per lembar, berapa modal minimal untuk membeli 2 Lot (sebelum biaya transaksi)?',
    options: ['Rp5.400', 'Rp54.000', 'Rp540.000', 'Rp2.700.000'],
    correctIndex: 2,
    explanation:
      '1 Lot di BEI = 100 lembar. Jadi 2 Lot = 200 lembar × Rp2.700 = Rp540.000.',
  },
  {
    id: 'q2',
    question:
      'Sebuah saham memiliki PER 8x dan PBV 0,9x, sementara rata-rata PER sektornya adalah 16x. Interpretasi awal yang paling tepat adalah:',
    options: [
      'Saham tersebut pasti langsung naik besok',
      'Secara rasio valuasi terlihat terdiskon, namun tetap perlu memeriksa kualitas laba dan utangnya',
      'Perusahaan tersebut pasti mengalami kebangkrutan',
      'Dividen yang dibagikan pasti sebesar 8% per tahun',
    ],
    correctIndex: 1,
    explanation:
      'PER dan PBV rendah menandakan valuasi murah secara relatif, tetapi investor tetap harus memverifikasi apakah laba stabil dan DER sehat.',
  },
  {
    id: 'q3',
    question:
      'Mengapa rasio utang terhadap ekuitas (DER) pada saham bank seperti BBCA atau BBRI terlihat tinggi (misal 4x–6x) dibanding emiten manufaktur?',
    options: [
      'Karena bank selalu terlilit kredit macet',
      'Karena dana tabungan/simpanan nasabah dicatat sebagai liabilitas dalam akuntansi perbankan',
      'Karena bank tidak memiliki ekuitas',
      'Karena 1 Lot saham bank berisi 1.000 lembar',
    ],
    correctIndex: 1,
    explanation:
      'Dalam laporan keuangan bank, Dana Pihak Ketiga (tabungan, giro, deposito nasabah) tercatat di sisi liabilitas sehingga DER bank memang secara alami lebih tinggi.',
  },
  {
    id: 'q4',
    question:
      'Strategi rutin menyisihkan nominal tetap setiap bulan untuk membeli saham berfundamental kuat tanpa menunggu harga terendah disebut:',
    options: [
      'Auto Rejection Atas (ARA)',
      'Stock Split',
      'Dollar Cost Averaging (DCA)',
      'Right Issue',
    ],
    correctIndex: 2,
    explanation:
      'DCA membantu meratakan harga perolehan dalam jangka panjang dan mengurangi risiko salah timing saat pasar berfluktuasi.',
  },
  {
    id: 'q5',
    question:
      'Jika indikator RSI(14) suatu saham berada di level 78 setelah reli tajam beberapa minggu, apa yang sebaiknya diwaspadai pemula?',
    options: [
      'Saham memasuki area jenuh beli (overbought) sehingga rawan koreksi teknikal jangka pendek',
      'Saham otomatis dihapus dari bursa',
      'Dividen perusahaan dibatalkan oleh BEI',
      'Harga saham tidak bisa bergerak lagi sepanjang tahun',
    ],
    correctIndex: 0,
    explanation:
      'RSI di atas 70 mengindikasikan kondisi jenuh beli (overbought); sebaiknya hindari membeli terburu-buru di puncak tanpa rencana manajemen risiko.',
  },
];
