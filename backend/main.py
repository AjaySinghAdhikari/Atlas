from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import Column, Integer, String, Text, DateTime, select, delete, func
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
import datetime
import os
import asyncio
from fetcher import fetch_content

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)

DATABASE_URL = "sqlite+aiosqlite:///./atlas.db"
engine = create_async_engine(DATABASE_URL, echo=False)
Base = declarative_base()
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ── Database Model ───────────────────────────────────────────────
class SavedItem(Base):
    __tablename__ = "saved_items"
    id         = Column(Integer, primary_key=True, index=True)
    title      = Column(String)
    url        = Column(String)
    type       = Column(String)        # VIDEO / ARTICLE / DOCS
    content    = Column(Text)          # raw fetched content
    summary    = Column(Text)          # AI generated bullet points
    tags       = Column(String)        # comma separated
    saved_at   = Column(DateTime, default=datetime.datetime.utcnow)

# ── AI Summariser ────────────────────────────────────────────────
def summarise_with_groq(content: str, title: str, content_type: str) -> str:
    """Use Groq (Llama 3) to summarise content into bullet points."""
    type_hint = {
        "VIDEO": "YouTube video transcript",
        "ARTICLE": "article or blog post",
        "DOCS": "technical documentation",
    }.get(content_type, "content")

    prompt = f"""You are a knowledge assistant. Summarise this {type_hint} titled "{title}" into exactly 5 clear, concise bullet points.

Rules:
- Each bullet point should be one sentence max
- Focus on the most important insights and takeaways
- Start each bullet with "• "
- No introduction or conclusion, just the 5 bullets
- Be specific, not vague

Content:
{content[:4000]}

Provide exactly 5 bullet points:"""

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=500,
    )
    return response.choices[0].message.content.strip()

def generate_tags(title: str, content_type: str, summary: str) -> str:
    """Generate tags from title and summary."""
    prompt = f"""Generate 3-5 short topic tags for this content.
Title: {title}
Type: {content_type}
Summary: {summary[:500]}

Rules:
- Each tag is 1-2 words max
- Lowercase, no special characters
- Separate with commas
- Example: python, web development, api design

Tags:"""

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=50,
    )
    return response.choices[0].message.content.strip()

# ── FastAPI App ──────────────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

class CaptureRequest(BaseModel):
    url: str

class ChatRequest(BaseModel):
    question: str

@app.get("/")
async def root():
    return {"message": "Atlas backend is running!"}

# ── Capture endpoint ─────────────────────────────────────────────
@app.post("/api/capture")
async def capture(req: CaptureRequest):
    """Fetch URL, summarise with AI, save to library."""
    try:
        # Step 1: Fetch content
        fetched = await asyncio.get_event_loop().run_in_executor(
            None, fetch_content, req.url
        )

        # Step 2: AI summary
        summary = await asyncio.get_event_loop().run_in_executor(
            None, summarise_with_groq,
            fetched["content"], fetched["title"], fetched["type"]
        )

        # Step 3: Generate tags
        tags = await asyncio.get_event_loop().run_in_executor(
            None, generate_tags,
            fetched["title"], fetched["type"], summary
        )

        # Step 4: Save to DB
        async with AsyncSessionLocal() as session:
            item = SavedItem(
                title    = fetched["title"],
                url      = fetched["source_url"],
                type     = fetched["type"],
                content  = fetched["content"][:10000],
                summary  = summary,
                tags     = tags,
            )
            session.add(item)
            await session.commit()
            await session.refresh(item)

            return {
                "id":       item.id,
                "title":    item.title,
                "url":      item.url,
                "type":     item.type,
                "summary":  item.summary,
                "tags":     item.tags,
                "saved_at": item.saved_at.isoformat(),
            }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ── Library endpoint ─────────────────────────────────────────────
@app.get("/api/library")
async def get_library(search: str = "", type_filter: str = "ALL"):
    async with AsyncSessionLocal() as session:
        query = select(SavedItem).order_by(SavedItem.id.desc())
        result = await session.execute(query)
        items = result.scalars().all()

        filtered = []
        for item in items:
            if type_filter != "ALL" and item.type != type_filter:
                continue
            if search and search.lower() not in (item.title or "").lower() \
               and search.lower() not in (item.tags or "").lower() \
               and search.lower() not in (item.summary or "").lower():
                continue
            filtered.append({
                "id":       item.id,
                "title":    item.title,
                "url":      item.url,
                "type":     item.type,
                "summary":  item.summary,
                "tags":     item.tags,
                "saved_at": item.saved_at.isoformat() if item.saved_at else None,
            })
        return filtered

# ── Stats endpoint ───────────────────────────────────────────────
@app.get("/api/stats")
async def get_stats():
    async with AsyncSessionLocal() as session:
        total = await session.execute(select(func.count(SavedItem.id)))
        videos = await session.execute(
            select(func.count(SavedItem.id)).where(SavedItem.type == "VIDEO"))
        articles = await session.execute(
            select(func.count(SavedItem.id)).where(SavedItem.type == "ARTICLE"))
        docs = await session.execute(
            select(func.count(SavedItem.id)).where(SavedItem.type == "DOCS"))
        return {
            "total":    total.scalar() or 0,
            "videos":   videos.scalar() or 0,
            "articles": articles.scalar() or 0,
            "docs":     docs.scalar() or 0,
        }

# ── Single item ──────────────────────────────────────────────────
@app.get("/api/library/{item_id}")
async def get_item(item_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(SavedItem).where(SavedItem.id == item_id))
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        return {
            "id": item.id, "title": item.title, "url": item.url,
            "type": item.type, "summary": item.summary,
            "tags": item.tags, "content": item.content,
            "saved_at": item.saved_at.isoformat() if item.saved_at else None,
        }

# ── Delete item ──────────────────────────────────────────────────
@app.delete("/api/library/{item_id}")
async def delete_item(item_id: int):
    async with AsyncSessionLocal() as session:
        await session.execute(
            delete(SavedItem).where(SavedItem.id == item_id))
        await session.commit()
    return {"message": "Deleted"}

# ── Chat with library ────────────────────────────────────────────
@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Answer questions using saved library as context."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(SavedItem).order_by(SavedItem.id.desc()).limit(20))
        items = result.scalars().all()

    if not items:
        return {"answer": "Your library is empty. Save some content first and then ask me questions about it!"}

    # Build context from summaries
    context = ""
    for item in items:
        context += f"\n\n[{item.type}] {item.title}\nTags: {item.tags}\nSummary:\n{item.summary}"

    prompt = f"""You are Atlas, a personal knowledge assistant. Answer the user's question using ONLY the content from their saved library below. 

If the answer isn't in their library, say "I couldn't find anything about that in your library. Try saving some content about it first."

Be conversational but concise. Reference specific titles when relevant.

User's Library:
{context[:6000]}

Question: {req.question}

Answer:"""

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        max_tokens=600,
    )

    return {"answer": response.choices[0].message.content.strip()}