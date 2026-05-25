import httpx
import re
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
import trafilatura

def detect_type(url: str) -> str:
    """Detect if URL is YouTube, article, or docs."""
    if any(x in url for x in ["youtube.com/watch", "youtu.be"]):
        return "VIDEO"
    if any(x in url for x in ["docs.", "/docs/", "documentation", "readme", "wiki", "developer."]):
        return "DOCS"
    return "ARTICLE"

def extract_youtube_id(url: str) -> str:
    """Extract YouTube video ID from URL."""
    patterns = [
        r"youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/embed/([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def fetch_youtube(url: str) -> dict:
    video_id = extract_youtube_id(url)
    if not video_id:
        raise ValueError("Could not extract YouTube video ID")

    # Try transcript first
    transcript = None
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(
            video_id, languages=["en", "en-US", "en-GB", "hi", "a.en"]
        )
        transcript = " ".join([t["text"] for t in transcript_list])
        words = transcript.split()
        if len(words) > 6000:
            transcript = " ".join(words[:6000]) + "..."
    except Exception:
        transcript = None

    # Get title via oEmbed
    title = "YouTube Video"
    try:
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
        resp = httpx.get(oembed_url, timeout=10)
        if resp.status_code == 200:
            title = resp.json().get("title", "YouTube Video")
    except Exception:
        pass

    # If no transcript, use title as content with a note
    if not transcript:
        transcript = f"This is a YouTube video titled: {title}. No transcript was available for this video. The AI will summarise based on the title only."

    return {
        "title": title,
        "content": transcript,
        "source_url": url,
        "type": "VIDEO",
    }
def fetch_article(url: str) -> dict:
    """Fetch article or docs content using trafilatura."""
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            raise ValueError("Could not download page content")

        content = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=False,
            no_fallback=False,
        )

        if not content or len(content.strip()) < 100:
            raise ValueError("Could not extract meaningful content from page")

        # Get metadata
        metadata = trafilatura.extract_metadata(downloaded)
        title = "Untitled"
        if metadata:
            title = metadata.title or metadata.sitename or "Untitled"

        # Trim to 6000 words
        words = content.split()
        if len(words) > 6000:
            content = " ".join(words[:6000]) + "..."

        return {
            "title": title,
            "content": content,
            "source_url": url,
            "type": detect_type(url),
        }

    except Exception as e:
        raise ValueError(f"Could not fetch article: {str(e)}")

def fetch_content(url: str) -> dict:
    """Main entry point — detect type and fetch accordingly."""
    url = url.strip()
    content_type = detect_type(url)

    if content_type == "VIDEO":
        return fetch_youtube(url)
    else:
        return fetch_article(url)