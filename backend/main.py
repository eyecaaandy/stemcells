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

       import os
    import replicate
    import tempfile

    # save uploaded file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    # send to Replicate
    output = replicate.run(
        "cjwbw/demucs",
        input={
            "audio": open(tmp_path, "rb")
        }
    )

    return {
        "result": output
    }