const { initializeApp, cert } =
  require("firebase-admin/app");

const { getMessaging } =
  require("firebase-admin/messaging");

const { getDatabase } =
  require("firebase-admin/database");

const serviceAccount =
  JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

// ======================================================
// FIREBASE ADMIN
// ======================================================

initializeApp({
  credential: cert(serviceAccount),

  databaseURL:
    "https://yungscell-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = getDatabase();
const transaksiRef = db.ref("transaksi");

// ======================================================
// KONVERSI JENIS TRANSAKSI
// ======================================================

function formatJenisTransaksi(type) {

  const jenis = {
    pulsa: "Pulsa",
    Pulsa: "Pulsa",

    paket: "Paket Data",
    Paket: "Paket Data",

    token: "Token",
    Token: "Token",

    transfer: "Transfer",
    Transfer: "Transfer",

    tarik_tunai: "Tarik Tunai",
    Tarik_Tunai: "Tarik Tunai",

    tarik_laba: "Tarik Laba",
    Tarik_Laba: "Tarik Laba",

    deposit: "Deposit",
    Deposit: "Deposit",

    saldo_online: "Saldo Online",
    Saldo_Online: "Saldo Online",

    ewallet: "E-Wallet",
    Ewallet: "E-Wallet"
  };

  return jenis[type] || type || "Transaksi";
}

// ======================================================
// AMBIL NOMINAL TRANSAKSI
// ======================================================

function ambilNominal(data) {

  // Transaksi seperti Pulsa/Paket/Token
  // biasanya menggunakan field "jual"
  if (data.jual !== undefined && data.jual !== null) {
    return Number(data.jual || 0);
  }

  // Transaksi lain menggunakan "nominal"
  if (data.nominal !== undefined && data.nominal !== null) {
    return Number(data.nominal || 0);
  }

  // Fallback
  return 0;
}

// ======================================================
// FORMAT RUPIAH
// ======================================================

function formatRupiah(nominal) {

  return "Rp" + Number(nominal || 0).toLocaleString("id-ID");

}

// ======================================================
// SIMPAN RIWAYAT NOTIFIKASI
// ======================================================

async function simpanRiwayatNotifikasi(data) {

  const jenis = formatJenisTransaksi(data.type);

  const nominalAngka = ambilNominal(data);

  const nominal = formatRupiah(nominalAngka);

  const pesan =
    `Hei Miknel, ada transaksi baru di Anggun Cell 😊, ${jenis} ${nominal}`;

  await db.ref("notifications").push({

    judul: "Anggun Cell",

    pesan: pesan,

    jenis: jenis,

    nominal: nominalAngka,

    type: data.type || "",

    tanggal: data.tanggal || "",

    tanggalISO: data.tanggalISO || "",

    dibaca: false,

    createdAt: Date.now()

  });

}

// ======================================================
// KIRIM NOTIFIKASI
// ======================================================

async function kirimNotifikasi(data) {

  const jenis = formatJenisTransaksi(data.type);
  const nominalAngka = ambilNominal(data);
  const nominal = formatRupiah(nominalAngka);

  const body =
    `Hei Miknel, ada transaksi baru di Anggun Cell 😊, ${jenis} ${nominal}`;

    // Simpan ke riwayat notifikasi
await simpanRiwayatNotifikasi(data);

  try {

    // ================================================
    // AMBIL SEMUA DEVICE YANG AKTIF
    // ================================================

    const snapshot = await db.ref("deviceTokens").once("value");

    const tokens = [];

    snapshot.forEach(child => {

      const device = child.val();

      if (
        device &&
        device.aktif === true &&
        device.token
      ) {
        tokens.push(device.token);
      }

    });

    console.log("");
    console.log("Jumlah device aktif :", tokens.length);

    // Tidak ada device
    if (tokens.length === 0) {

      console.log("⚠ Tidak ada device aktif");
      return;

    }

    // ================================================
    // DATA PESAN
    // ================================================

    const message = {

      notification: {
        title: "Anggun Cell",
        body: body
      },

      data: {
        jenis: jenis,
        nominal: String(nominalAngka),
        type: String(data.type || ""),
        tanggal: String(data.tanggal || ""),
        transaksiBaru: "true"
      },

      android: {
        priority: "high",

        notification: {
          channelId: "transaksi",
          sound: "default"
        }
      }

    };

    // ================================================
    // KIRIM KE SEMUA DEVICE
    // ================================================

    const response =
      await getMessaging().sendEachForMulticast({
        tokens: tokens,
        ...message
      });

    // ================================================
    // HASIL
    // ================================================

    console.log("");
    console.log("========================================");
    console.log("✓ NOTIFIKASI SELESAI DIKIRIM");
    console.log("========================================");
    console.log("Transaksi :", jenis);
    console.log("Nominal   :", nominal);
    console.log("Pesan     :", body);
    console.log("Device    :", tokens.length);
    console.log("Berhasil  :", response.successCount);
    console.log("Gagal     :", response.failureCount);
   response.responses.forEach(async (result, index) => {

  if (result.success) {

    console.log(
      `✓ Device ${index + 1}: BERHASIL`
    );

  } else {

    console.log(
      `❌ Device ${index + 1}: GAGAL`
    );

    console.log(
      "   Error:",
      result.error?.code || "unknown"
    );

    console.log(
      "   Pesan:",
      result.error?.message || "unknown"
    );

    // ================================================
    // HAPUS TOKEN YANG SUDAH TIDAK VALID
    // ================================================

    if (
      result.error?.code ===
      "messaging/registration-token-not-registered"
    ) {

      const tokenYangTidakValid =
        tokens[index];

      const snapshot =
        await db
          .ref("deviceTokens")
          .once("value");

      snapshot.forEach(child => {

        const device = child.val();

        if (
          device &&
          device.token === tokenYangTidakValid
        ) {

          db.ref(
            "deviceTokens/" + child.key
          ).remove()
            .then(() => {

              console.log(
                `🗑 Token Device ${index + 1} dihapus`
              );

            })
            .catch(error => {

              console.error(
                "Gagal menghapus token:",
                error
              );

            });

        }

      });

    }

  }

});
    console.log("========================================");
    console.log("");

  } catch (error) {

    console.error("");
    console.error("❌ GAGAL MENGIRIM NOTIFIKASI");
    console.error(error);
    console.error("");

  }

}

// ======================================================
// CEGAH TRANSAKSI LAMA DIKIRIM ULANG
// ======================================================

const transaksiSudahAda = new Set();

// ======================================================
// AMBIL DATA LAMA SAAT SERVER START
// ======================================================

async function mulaiWatcher() {

  console.log("");
  console.log("========================================");
  console.log(" ANG GUN CELL NOTIFICATION SERVER");
  console.log("========================================");
  console.log("Memuat transaksi lama...");
  console.log("");

  const snapshot = await transaksiRef.once("value");

  snapshot.forEach(child => {

    transaksiSudahAda.add(child.key);

  });

  console.log(
    `✓ ${transaksiSudahAda.size} transaksi lama diabaikan`
  );

  console.log("");
  console.log("✓ Menunggu transaksi baru...");
  console.log("");

  // ====================================================
  // MONITOR TRANSAKSI BARU
  // ====================================================

  transaksiRef.on("child_added", async snapshot => {

    const key = snapshot.key;

    // Jangan kirim transaksi yang sudah ada saat server mulai
    if (transaksiSudahAda.has(key)) {
      return;
    }

    // Tandai sebagai sudah diproses
    transaksiSudahAda.add(key);

    const data = snapshot.val();

    console.log("");
    console.log("🔔 TRANSAKSI BARU TERDETEKSI");
    console.log("Key :", key);
    console.log("Data:", data);

    await kirimNotifikasi(data);

  });

}

// ======================================================
// START
// ======================================================

mulaiWatcher()
  .catch(error => {

    console.error("");
    console.error("❌ WATCHER GAGAL DIMULAI");
    console.error(error);
    console.error("");

  });