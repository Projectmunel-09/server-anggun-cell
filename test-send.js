const { initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

const serviceAccount = require("./service-account.json");

initializeApp({
  credential: cert(serviceAccount),
  databaseURL:
    "https://yungscell-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const token =
  "c98H_e40S1exPv6n3kXKUH:APA91bGXYYHSxZNMN87SYg1C_rRY3lnLMwFocxA4axFaBa58iX7FIZ5w0daXRcC9G1mJynBr2n6N4Q-rhij1yd_SjNf5LpQSONPLKGHO2cFerFHIN-229yY";

const message = {
  token: token,

  notification: {
    title: "Anggun Cell",
    body: "Tes notifikasi transaksi 😊"
  },

  data: {
    type: "Pulsa",
    nominal: "10000",
    transaksiId: "TEST-001"
  },

  android: {
    priority: "high",

    notification: {
      channelId: "transaksi",
      sound: "default"
    }
  }
};

getMessaging()
  .send(message)
  .then(response => {
    console.log("");
    console.log("========================================");
    console.log("✓ NOTIFIKASI TERKIRIM");
    console.log("========================================");
    console.log(response);
    console.log("========================================");
  })
  .catch(error => {
    console.error("");
    console.error("❌ GAGAL MENGIRIM NOTIFIKASI");
    console.error(error);
  });