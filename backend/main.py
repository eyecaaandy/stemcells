"""
StemForge Backend — FastAPI + Demucs stem separation
Run: uvicorn main:app --reload --port 8000
"""

import os
import uuid
import shutil
import zipfile
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# ── Constants ──────────────────────────────────────────────────────────────────
UPLOAD_DIR   = Path("tmp/uploads")
OUTPUT_DIR   = Path("tmp/outputs")
MAX_FILE_MB  = 20
MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
ALLOWED_EXTS = {".mp3", ".wav"}
STEM_NAMES   = ["vocals", "drums", "bass", "other"]

# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(title="StemForge API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create working directories on startup
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Serve processed stems as static files under /files/
app.mount("/files", StaticFiles(directory=str(OUTPUT_DIR)), name="files")


# ── Helpers ────────────────────────────────────────────────────────────────────

def cleanup_job(job_id: str) -> None:
    """Remove all temp files for a given job (upload + output)."""
    upload_path = UPLOAD_DIR / job_id
    output_path = OUTPUT_DIR / job_id
    if upload_path.exists():
        shutil.rmtree(upload_path, ignore_errors=True)
    if output_path.exists():
        shutil.rmtree(output_path, ignore_errors=True)


def run_demucs(input_file: Path, output_dir: Path) -> None:
    """
    Run Demucs to separate all four stems (vocals, drums, bass, other).

    Modern Demucs (4.x) removed --four-stems. The default htdemucs model
    already outputs all four stems when you run it WITHOUT --two-stems,
    so we just omit that flag entirely.

    Output layout: <output_dir>/htdemucs/<track_name>/{vocals,drums,bass,other}.mp3
    """
    cmd = [
        "demucs",
        "--mp3",                   # Encode output as mp3
        "--out", str(output_dir),  # Where to write results
        str(input_file),
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600,   # 10-min hard limit — large files can be slow
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Demucs failed (exit {result.returncode}):\n{result.stderr}"
        )


def find_stems(output_dir: Path, job_id: str) -> dict[str, Path]:
    """
    Demucs writes: <output_dir>/htdemucs/<stem_name>/<filename>.mp3
    Walk the tree and return a mapping of stem_name → Path.
    """
    stems: dict[str, Path] = {}

    for stem in STEM_NAMES:
        # Search recursively so we don't care about the exact model subdir
        matches = list(output_dir.rglob(f"{stem}.mp3"))
        if not matches:
            raise FileNotFoundError(
                f"Expected stem '{stem}.mp3' not found in {output_dir}"
            )
        stems[stem] = matches[0]

    return stems


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/separate")
async def separate_stems(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> JSONResponse:
    """
    Accept an audio file, run Demucs, return URLs to each stem + zip.
    """

    # ── 1. Validate extension ──────────────────────────────────────────────────
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Upload an MP3 or WAV file.",
        )

    # ── 2. Read & size-check ───────────────────────────────────────────────────
    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(audio_bytes) / 1e6:.1f} MB). Limit is {MAX_FILE_MB} MB.",
        )

    # ── 3. Persist upload to a unique job directory ───────────────────────────
    job_id    = uuid.uuid4().hex
    job_upload = UPLOAD_DIR / job_id
    job_output = OUTPUT_DIR / job_id
    job_upload.mkdir(parents=True)
    job_output.mkdir(parents=True)

    input_path = job_upload / f"input{ext}"
    input_path.write_bytes(audio_bytes)

    # ── 4. Run Demucs ─────────────────────────────────────────────────────────
    try:
        run_demucs(input_path, job_output)
    except subprocess.TimeoutExpired:
        background_tasks.add_task(cleanup_job, job_id)
        raise HTTPException(status_code=504, detail="Demucs timed out. Try a shorter file.")
    except RuntimeError as exc:
        background_tasks.add_task(cleanup_job, job_id)
        raise HTTPException(status_code=500, detail=str(exc))

    # ── 5. Locate output stems ────────────────────────────────────────────────
    try:
        stem_paths = find_stems(job_output, job_id)
    except FileNotFoundError as exc:
        background_tasks.add_task(cleanup_job, job_id)
        raise HTTPException(status_code=500, detail=str(exc))

    # ── 6. Build zip of all stems ─────────────────────────────────────────────
    zip_path = job_output / "all_stems.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, path in stem_paths.items():
            zf.write(path, arcname=f"{name}.mp3")

    # ── 7. Build public URL map ────────────────────────────────────────────────
    # Paths are served by the StaticFiles mount at /files/<job_id>/...
    def stem_url(path: Path) -> str:
        # path is something like tmp/outputs/<job_id>/htdemucs/input/vocals.mp3
        # We need the part relative to OUTPUT_DIR
        rel = path.relative_to(OUTPUT_DIR)
        return f"/files/{rel.as_posix()}"

    zip_rel = zip_path.relative_to(OUTPUT_DIR)

    return JSONResponse({
        "job_id": job_id,
        "stems": {
            name: stem_url(path)
            for name, path in stem_paths.items()
        },
        "zip_url": f"/files/{zip_rel.as_posix()}",
    })


@app.get("/download/{job_id}/zip")
async def download_zip(job_id: str) -> FileResponse:
    """Convenience endpoint that streams the zip for a completed job."""
    zip_path = OUTPUT_DIR / job_id / "all_stems.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Zip not found. Run /separate first.")
    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename="stems.zip",
    )
