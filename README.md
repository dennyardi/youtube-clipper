# Youtube Clipper Maker

Dashboard Next.js untuk menganalisis video YouTube dari subtitle, memilih bagian terbaik memakai OpenAI, lalu memotong clip dengan `yt-dlp` dan `ffmpeg`.

## Fitur

- Analisis Long Video dengan hook/teaser.
- Analisis Short Video dengan custom range durasi dari frontend.
- Mode analisis `Hybrid Python + AI` atau `Full AI`.
- Python scorer untuk menghemat token sebelum kandidat dikirim ke OpenAI.
- CRUD Preset Prompt.
- Preview YouTube embed berdasarkan start dan end time.
- Edit manual timestamp hasil AI.
- Download clip melalui backend memakai `yt-dlp` + `ffmpeg -c copy`.
- Error log untuk debugging.

## Requirement VPS

- Node.js 20+
- MySQL
- Python 3
- yt-dlp
- ffmpeg

## Setup

```bash
npm install
cp .env.example .env
```

Isi `.env`:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/youtube_clipper_maker"
OPENAI_API_KEY="sk-your-key-here"
DEFAULT_OPENAI_MODEL="gpt-5.2"
PYTHON_EXE="python"
YTDLP_EXE="yt-dlp"
FFMPEG_EXE="ffmpeg"
MAX_AI_CANDIDATES="40"
```

`.env` sudah masuk `.gitignore`, jadi API key tidak ikut ter-push ke GitHub.

## Database

```bash
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

Untuk production:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

## Development

```bash
npm run dev
```

Buka:

```txt
http://localhost:3000
```

## Local Check Dengan Docker

Cara paling cepat untuk pengecekan lokal:

```bash
cp .env.local.example .env
npm run local:db
npm install
npm run local:setup
npm run dev
```

Buka dashboard:

```txt
http://localhost:3000
```

Buka database via phpMyAdmin:

```txt
http://localhost:8080
```

Login phpMyAdmin:

```txt
Server: mysql
Username: clipper_user
Password: clipper_password
```

Sebelum mencoba analisis sungguhan, isi `OPENAI_API_KEY` di `.env`. Untuk fitur download, pastikan `yt-dlp` dan `ffmpeg` tersedia di komputer lokal.

## Production VPS

```bash
npm run build
npm run start
```

Rekomendasi menjalankan di VPS:

- Pakai PM2 atau systemd.
- Pastikan folder `downloads/` dan `tmp/` writable.
- Pastikan command `yt-dlp --version` dan `ffmpeg -version` bisa dijalankan oleh user Node.js.
- Jalankan di Node runtime biasa, bukan serverless.

## Catatan Akurasi dan Token

Mode default adalah Hybrid:

```txt
Subtitle penuh
→ Build kandidat clip lokal
→ Python scoring
→ Top kandidat dikirim ke OpenAI
→ AI memilih final, alasan, judul, dan hook
```

Mode Full AI tersedia di halaman Setting. Mode ini lebih mahal karena transcript dikirim lebih utuh ke OpenAI, tapi berguna untuk video yang sangat naratif.

## Catatan Download

Pemotongan memakai `ffmpeg -c copy`, jadi cepat dan tidak render ulang. Dampaknya, start/end bisa sedikit mengikuti keyframe. Jika nanti butuh potongan frame-perfect, ubah command ffmpeg agar re-encode.
