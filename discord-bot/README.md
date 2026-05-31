# 🤖 Discord Voice Bot 24/7 (Backend)

Ini adalah program backend Discord Bot berbasis Node.js yang bertugas menjaga koneksi *voice channel* tetap aktif secara terus menerus (24/7) di VPS/Railway, serta mengekspos REST API untuk dikendalikan dari website Next.js.

## Fitur Inti
- **24/7 Voice Stay:** Menggunakan pustaka resmi `@discordjs/voice` untuk bergabung ke saluran suara Discord.
- **REST API Control:** Menerima perintah *Connect* dan *Disconnect* melalui API.
- **Auto-Reconnect:** Otomatis mendeteksi jika koneksi terputus secara tidak terduga dan mencoba menyambung kembali.
- **In-Memory State Logs:** Menyimpan logs aktivitas terbaru yang bisa dibaca real-time oleh website.

---

## 🚀 Cara Menjalankan Lokal

### 1. Prasyarat
Pastikan Anda sudah menginstal **Node.js** (versi 16 ke atas).

### 2. Instal Dependensi
Masuk ke folder `discord-bot` melalui command prompt/terminal Anda:
```bash
cd discord-bot
npm install
```

### 3. Konfigurasi Token (Opsional tapi Direkomendasikan)
Buat file bernama `.env` di dalam folder ini:
```env
PORT=3001
DISCORD_TOKEN=MASUKKAN_TOKEN_BOT_DISCORD_ANDA
```
*Catatan: Jika Anda tidak mengisi token di `.env`, Anda harus menginput token tersebut secara manual lewat website dashboard.*

### 4. Jalankan Server
```bash
npm start
```
Server backend sekarang aktif di `http://localhost:3001`!

---

## ☁️ Cara Deploy ke Railway (24/7 Tanpa Laptop Mati)

Railway sangat direkomendasikan karena mendukung Node.js out-of-the-box dan gratis untuk penggunaan dasar.

### Langkah-langkah:
1. **Buat Repositori GitHub:**
   - Unggah folder `discord-bot` ini ke sebuah repositori GitHub baru (misalnya diberi nama `discord-voice-bot-backend`).
   - *Penting: Pastikan file `node_modules` masuk ke `.gitignore` agar tidak diunggah.*
2. **Masuk ke Railway:**
   - Buka [Railway.app](https://railway.app) dan login dengan akun GitHub Anda.
3. **Deploy Project:**
   - Klik **New Project** -> Pilih **Deploy from GitHub repo**.
   - Pilih repositori bot yang baru saja Anda buat.
4. **Atur Environment Variables di Railway:**
   - Klik pada layanan bot Anda di dashboard Railway, masuk ke tab **Variables**.
   - Tambahkan variabel berikut:
     *   `PORT` = `3001`
     *   `DISCORD_TOKEN` = `(Token bot Discord Anda)`
5. **Dapatkan URL Public API:**
   - Di tab **Settings** pada Railway, cari bagian **Environment** atau **Domains** lalu klik **Generate Domain**.
   - Anda akan mendapatkan URL publik gratis seperti `https://xxx-production.up.railway.app`.
   - Simpan URL ini, Anda akan memasukkannya ke website dashboard Next.js sebagai **API Backend URL**.
