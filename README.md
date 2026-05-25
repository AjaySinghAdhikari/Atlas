# Atlas

A small project containing a Python backend and a Vite + React frontend.

**Project structure**

- backend/: Python backend (includes `fetcher.py`, `main.py`, and `atlas.db`).
- frontend/: Vite + React frontend (development via `npm`/`yarn`).

**Prerequisites**

- Python 3.8+ (backend)
- Node.js 16+ and npm or yarn (frontend)
- Git (already initialized in this repo)

**Quick start**

Backend (from repository root):

```bash
# create a virtual environment (optional but recommended)
python -m venv .venv
# activate it (Windows PowerShell)
.\.venv\Scripts\Activate.ps1
# install requirements if any (check backend for requirements.txt)
# run the backend
python backend/main.py
```

Frontend (from repository root):

```bash
cd frontend
npm install
npm run dev
```

**Notes**

- This README is intentionally minimal. See files in `backend/` and `frontend/` for implementation details.
- If you want, I can add a more detailed developer README, CI workflow, or a license file.

**Repository**

https://github.com/AjaySinghAdhikari/Atlas
