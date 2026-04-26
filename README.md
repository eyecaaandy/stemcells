# 🎛️ StemForge — AI Stem Separator

> Split any audio track into **vocals · drums · bass · melody** using [Demucs](https://github.com/facebookresearch/demucs).

---

## 📁 Project Structure

```
stemforge/
├── backend/
│   ├── main.py              ← FastAPI app (POST /separate, GET /download)
│   └── requirements.txt     ← Python dependencies
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── index.css
```

---

## ⚙️ Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | ≥ 3.10 | https://python.org |
| Node.js | ≥ 18 | https://nodejs.org |
| ffmpeg | any | see below |

### Install ffmpeg (required by Demucs for mp3 output)

**macOS (Homebrew)**
```bash
brew install ffmpeg
```

**Ubuntu / Debian**
```bash
sudo apt update && sudo apt install -y ffmpeg
```

**Windows**
Download from https://ffmpeg.org/download.html and add to PATH.

---

## 🐍 Backend Setup

```bash
# 1. Enter backend directory
cd backend

# 2. Create & activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
# NOTE: torch/torchaudio install can take a few minutes (large download)

# 4. Start the API server
uvicorn main:app --reload --port 8000
```

The API will be live at http://localhost:8000

**Optional — CPU-only PyTorch** (smaller download, slower separation):
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install fastapi uvicorn[standard] python-multipart demucs
```

---

## ⚛️ Frontend Setup

```bash
# 1. Enter frontend directory
cd frontend

# 2. Install npm dependencies
npm install

# 3. Start Vite dev server
npm run dev
```

The app will be live at http://localhost:5173

> Vite proxies all `/separate`, `/files`, `/download` requests to `http://localhost:8000`
> so no CORS issues in development.

---

## 🚀 Running the Full App

Open **two terminals**:

**Terminal 1 — Backend**
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 🔌 API Reference

### `POST /separate`
Upload an audio file for stem separation.

**Request:** `multipart/form-data`
- `file`: MP3 or WAV file (max 20 MB)

**Response:** `200 OK`
```json
{
  "job_id": "a3f7c2b1...",
  "stems": {
    "vocals": "/files/<job_id>/htdemucs/input/vocals.mp3",
    "drums":  "/files/<job_id>/htdemucs/input/drums.mp3",
    "bass":   "/files/<job_id>/htdemucs/input/bass.mp3",
    "other":  "/files/<job_id>/htdemucs/input/other.mp3"
  },
  "zip_url": "/files/<job_id>/all_stems.zip"
}
```

**Error codes:**
| Code | Reason |
|------|--------|
| 400  | Unsupported file type |
| 413  | File > 20 MB |
| 500  | Demucs failed |
| 504  | Processing timeout (>10 min) |

---

### `GET /download/{job_id}/zip`
Stream the zip archive for a completed job.

---

### `GET /files/{path}`
Static file server for processed stems and zips.

---

## 📝 Notes

- **First run is slow**: Demucs downloads its pretrained `htdemucs` model (~80 MB) on first use.
- **GPU acceleration**: If you have an NVIDIA GPU with CUDA, install the CUDA-enabled PyTorch. Separation is 5–10× faster.
- **Temp files**: Output stems live in `backend/tmp/outputs/<job_id>/`. They are cleaned up automatically on error, but on success they persist so users can download. Add a cron job or background task for periodic cleanup in production.
- **Production deploy**: Replace `allow_origins=["*"]` in CORS middleware with your actual frontend domain.

---

## 🧰 Troubleshooting

**`demucs: command not found`**
Ensure your virtualenv is activated: `source .venv/bin/activate`

**`No module named 'demucs'`**
Re-run `pip install -r requirements.txt` inside the activated venv.

**`RuntimeError: ffmpeg not found`**
Install ffmpeg and make sure it's on your PATH (`ffmpeg -version` should work).

**Separation takes very long**
Demucs is computationally heavy on CPU. A 3-minute song can take 3–8 minutes without a GPU. This is normal.

**`OSError: [Errno 28] No space left on device`**
Demucs writes large intermediate files. Ensure at least 1 GB free disk space.
