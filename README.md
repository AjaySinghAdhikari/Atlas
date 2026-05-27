# Atlas

**Atlas** is a personal knowledge library that captures URLs, summarises them with AI, and lets you chat with everything you've saved.

Paste in a YouTube video, an article, or a documentation page — Atlas fetches the content, generates a 5-bullet AI summary, auto-tags it, and stores it in a searchable library. A built-in chat interface lets you ask questions across your entire collection.

---

## Features

- **Smart capture** — paste any URL and Atlas auto-detects whether it's a YouTube video, article, or documentation page
- **AI summarisation** — every saved item gets a concise 5-bullet summary powered by Groq (Llama 3.1)
- **Auto-tagging** — relevant topic tags are generated automatically from the title and summary
- **Searchable library** — filter by type (VIDEO / ARTICLE / DOCS) or full-text search across titles, tags, and summaries
- **Chat with your library** — ask natural-language questions and get answers grounded in your saved content
- **Stats dashboard** — see counts by content type at a glance

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite |
| Backend | FastAPI, SQLAlchemy (async) |
| Database | SQLite (`atlas.db`) |
| AI | Groq API — `llama-3.1-8b-instant` |
| Content fetching | `trafilatura` (articles/docs), `youtube-transcript-api` (videos) |

---

## Project Structure

```
Atlas/
├── backend/
│   ├── main.py          # FastAPI app — all API routes and AI logic
│   ├── fetcher.py       # URL detection and content extraction
│   └── atlas.db         # SQLite database (auto-created on first run)
└── frontend/
    ├── src/
│   └── App.jsx          # Main React app
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Prerequisites

- Python 3.8+
- Node.js 16+ and npm
- A [Groq API key](https://console.groq.com) (free tier available)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/AjaySinghAdhikari/Atlas.git
cd Atlas
```

### 2. Backend

```bash
# Create and activate a virtual environment (recommended)
python -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install fastapi uvicorn sqlalchemy aiosqlite pydantic python-dotenv \
            groq httpx trafilatura youtube-transcript-api

# Create your .env file
echo "GROQ_API_KEY=your_key_here" > .env

# Start the backend (runs on http://localhost:8000)
python backend/main.py
```

> The SQLite database (`atlas.db`) is created automatically on first run.

### 3. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The app will be available at **http://localhost:5173**.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/api/capture` | Capture and summarise a URL |
| `GET` | `/api/library` | List saved items (supports `?search=` and `?type_filter=`) |
| `GET` | `/api/library/{id}` | Get a single saved item (includes full raw content) |
| `DELETE` | `/api/library/{id}` | Delete a saved item |
| `GET` | `/api/stats` | Get counts by content type |
| `POST` | `/api/chat` | Ask a question against your saved library |

### Example: Capture a URL

```bash
curl -X POST http://localhost:8000/api/capture \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

**Response:**

```json
{
  "id": 1,
  "title": "Rick Astley - Never Gonna Give You Up",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "type": "VIDEO",
  "summary": "• ...\n• ...",
  "tags": "music, pop, 80s",
  "saved_at": "2026-05-25T12:00:00"
}
```

### Example: Chat with your library

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What have I saved about Python async programming?"}'
```

---

## Content Type Detection

Atlas automatically classifies URLs into one of three types:

| Type | Detected when URL contains |
|---|---|
| `VIDEO` | `youtube.com/watch`, `youtu.be` |
| `DOCS` | `docs.`, `/docs/`, `documentation`, `readme`, `wiki`, `developer.` |
| `ARTICLE` | Everything else |

YouTube videos use `youtube-transcript-api` to pull the full transcript. Articles and documentation pages are scraped with `trafilatura`. If a video has no available transcript, the summary is generated from the title alone.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Your Groq API key for AI summarisation and chat |

Create a `.env` file in the project root:

```env
GROQ_API_KEY=gsk_...
```

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)