import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:8000";

const TYPE_COLORS = {
  VIDEO:   { bg: "#2d1b69", text: "#a78bfa", border: "#7c3aed" },
  ARTICLE: { bg: "#1a3a5c", text: "#60a5fa", border: "#2563eb" },
  DOCS:    { bg: "#1a3d2e", text: "#34d399", border: "#059669" },
};

const timeAgo = (ts) => {
  if (!ts) return "Unknown";
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
};

const parseSummary = (summary) => {
  if (!summary) return [];
  if (Array.isArray(summary)) return summary;
  return summary.split("\n").map(l => l.trim()).filter(l => l.length > 0);
};

const TypeBadge = ({ type }) => {
  const c = TYPE_COLORS[type] || TYPE_COLORS.ARTICLE;
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: "4px", padding: "2px 8px", fontSize: "11px",
      fontWeight: "700", letterSpacing: "0.05em", flexShrink: 0,
    }}>{type || "ARTICLE"}</span>
  );
};

const LOADING_STAGES = [
  "Fetching content...",
  "Analysing with AI...",
  "Generating summary...",
  "Saving to library...",
];

export default function App() {
  const [view, setView] = useState("add");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [library, setLibrary] = useState([]);
  const [stats, setStats] = useState({ total: 0, videos: 0, articles: 0, docs: 0 });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [expanded, setExpanded] = useState(null);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fetchLibrary = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/library`);
      setLibrary(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/stats`);
      setStats(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchStats(); fetchLibrary(); }, [fetchStats, fetchLibrary]);

  useEffect(() => {
    if (!loading) { setLoadingStage(0); return; }
    const interval = setInterval(() => {
      setLoadingStage(prev => (prev + 1) % LOADING_STAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  const handleCapture = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch(`${API}/api/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to capture");
      }
      const data = await res.json();
      setPreview(data);
      setUrl("");
      fetchStats();
      fetchLibrary();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await fetch(`${API}/api/library/${id}`, { method: "DELETE" });
    fetchLibrary();
    fetchStats();
    if (expanded?.id === id) setExpanded(null);
  };

  const handleChat = async () => {
    if (!chatQuestion.trim()) return;
    setChatLoading(true);
    setChatAnswer("");
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: chatQuestion }),
      });
      const data = await res.json();
      setChatAnswer(data.answer);
    } catch (e) {
      setChatAnswer("Error connecting to Atlas.");
    } finally {
      setChatLoading(false);
    }
  };

  const filteredLibrary = library.filter(item => {
    const summaryText = typeof item.summary === "string" ? item.summary : "";
    const matchSearch = !search ||
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      summaryText.toLowerCase().includes(search.toLowerCase()) ||
      item.tags?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "ALL" || item.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100vw",
      background: "#0d0d14",
      color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      overflow: "hidden",
    }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: "200px",
        minWidth: "200px",
        maxWidth: "200px",
        background: "#13131f",
        borderRight: "1px solid #1e1e30",
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        gap: "16px",
        overflowY: "auto",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>🗺️ Atlas</div>
          <div style={{ fontSize: "9px", color: "#4a4a6a", letterSpacing: "0.15em", marginTop: "4px" }}>
            KNOWLEDGE BASE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {[
            { label: "TOTAL SAVED", value: stats.total || 0, color: "#a78bfa" },
            { label: "VIDEOS", value: stats.videos || 0, color: "#a78bfa" },
            { label: "ARTICLES", value: stats.articles || 0, color: "#60a5fa" },
            { label: "DOCS", value: stats.docs || 0, color: "#34d399" },
          ].map(s => (
            <div key={s.label} style={{
              background: "#0d0d14",
              border: "1px solid #1e1e30",
              borderRadius: "6px",
              padding: "8px 10px",
            }}>
              <div style={{ fontSize: "9px", color: "#4a4a6a", letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: s.color, marginTop: "2px" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {[
            { id: "add", label: "✦ Capture URL" },
            { id: "library", label: "◈ My Library" },
            { id: "chat", label: "◎ Ask Atlas" },
          ].map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{
              background: view === n.id ? "#7c3aed" : "transparent",
              color: view === n.id ? "#fff" : "#6b7280",
              border: `1px solid ${view === n.id ? "#7c3aed" : "#1e1e30"}`,
              borderRadius: "6px",
              padding: "9px 12px",
              fontSize: "11px",
              fontFamily: "monospace",
              fontWeight: "600",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}>{n.label}</button>
          ))}
        </div>
      </aside>

      {/* ── Main Panel ── */}
      <main style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid #1e1e30",
          background: "#13131f",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "11px", color: "#4a4a6a", letterSpacing: "0.1em" }}>
            {view === "add" ? "CAPTURE NEW KNOWLEDGE" : view === "library" ? "MY LIBRARY" : "ASK ATLAS"}
          </span>
          <span style={{ fontSize: "11px", color: "#4a4a6a" }}>{stats.total} items saved</span>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "20px 16px",
          boxSizing: "border-box",
          width: "100%",
        }}>

          {/* ── ADD VIEW ── */}
          {view === "add" && (
            <div style={{ maxWidth: "560px", margin: "0 auto" }}>
              {!loading && !preview && (
                <>
                  <div style={{ marginBottom: "24px", textAlign: "center" }}>
                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>🗺️</div>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "6px" }}>
                      Capture anything
                    </div>
                    <div style={{ fontSize: "12px", color: "#4a4a6a" }}>
                      Paste a YouTube, article, or documentation URL
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="https://youtube.com/watch?v=... or any article URL"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCapture()}
                    autoFocus
                    style={{
                      width: "100%",
                      background: "#13131f",
                      border: "1px solid #1e1e30",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      color: "#e2e8f0",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      outline: "none",
                      marginBottom: "10px",
                      boxSizing: "border-box",
                    }}
                  />
                  <button onClick={handleCapture} style={{
                    width: "100%",
                    background: "#7c3aed",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}>CAPTURE →</button>
                  {error && (
                    <div style={{
                      marginTop: "12px", padding: "10px 14px",
                      background: "#1e0a0a", border: "1px solid #3d1a1a",
                      borderRadius: "6px", color: "#f87171", fontSize: "12px",
                    }}>⚠ {error}</div>
                  )}
                  <div style={{ marginTop: "24px" }}>
                    <div style={{ fontSize: "10px", color: "#4a4a6a", letterSpacing: "0.1em", marginBottom: "8px" }}>
                      TRY THESE EXAMPLES
                    </div>
                    {[
                      { label: "YouTube", url: "https://www.youtube.com/watch?v=aircAruvnKk" },
                      { label: "React Docs", url: "https://react.dev/learn" },
                      { label: "Article", url: "https://css-tricks.com/a-complete-guide-to-flexbox/" },
                    ].map(ex => (
                      <div key={ex.url} onClick={() => setUrl(ex.url)} style={{
                        padding: "8px 12px", background: "#13131f",
                        border: "1px solid #1e1e30", borderRadius: "6px",
                        marginBottom: "6px", cursor: "pointer", fontSize: "11px", color: "#6b7280",
                      }}>
                        <span style={{ color: "#a78bfa", marginRight: "8px" }}>{ex.label}</span>
                        {ex.url}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {loading && (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <div style={{
                    width: "44px", height: "44px", border: "3px solid #1e1e30",
                    borderTop: "3px solid #7c3aed", borderRadius: "50%",
                    margin: "0 auto 20px", animation: "spin 0.8s linear infinite",
                  }} />
                  <div style={{ fontSize: "13px", color: "#a78bfa", marginBottom: "6px", fontWeight: "600" }}>
                    {LOADING_STAGES[loadingStage]}
                  </div>
                  <div style={{ fontSize: "11px", color: "#4a4a6a" }}>This takes 10-20 seconds</div>
                  <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "6px" }}>
                    {LOADING_STAGES.map((_, i) => (
                      <div key={i} style={{
                        width: "7px", height: "7px", borderRadius: "50%",
                        background: i === loadingStage ? "#7c3aed" : "#1e1e30",
                        transition: "background 0.3s",
                      }} />
                    ))}
                  </div>
                </div>
              )}

              {preview && !loading && (
                <div>
                  <div style={{
                    background: "#13131f", border: "1px solid #7c3aed",
                    borderRadius: "12px", padding: "20px", marginBottom: "14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <TypeBadge type={preview.type} />
                      <span style={{ fontSize: "11px", color: "#4a4a6a" }}>✓ Saved successfully</span>
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "#fff", marginBottom: "14px", lineHeight: "1.4" }}>
                      {preview.title}
                    </div>
                    <div style={{ fontSize: "10px", color: "#4a4a6a", letterSpacing: "0.1em", marginBottom: "8px" }}>AI SUMMARY</div>
                    {parseSummary(preview.summary).map((bullet, i) => (
                      <div key={i} style={{
                        display: "flex", gap: "8px", marginBottom: "6px",
                        fontSize: "12px", color: "#cbd5e1", lineHeight: "1.6",
                      }}>
                        <span style={{ color: "#7c3aed", flexShrink: 0 }}>•</span>
                        <span>{bullet.replace(/^[•\-\*]\s*/, "")}</span>
                      </div>
                    ))}
                    {preview.tags && (
                      <div style={{ marginTop: "12px", display: "flex", gap: "5px", flexWrap: "wrap" }}>
                        {preview.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                          <span key={tag} style={{
                            background: "#1e1e30", color: "#6b7280",
                            borderRadius: "4px", padding: "2px 7px", fontSize: "10px",
                          }}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { setPreview(null); setUrl(""); }} style={{
                      flex: 1, background: "#7c3aed", color: "#fff", border: "none",
                      borderRadius: "8px", padding: "10px", fontSize: "12px",
                      fontFamily: "monospace", fontWeight: "700", cursor: "pointer",
                    }}>Capture Another</button>
                    <button onClick={() => setView("library")} style={{
                      flex: 1, background: "#13131f", color: "#6b7280",
                      border: "1px solid #1e1e30", borderRadius: "8px", padding: "10px",
                      fontSize: "12px", fontFamily: "monospace", cursor: "pointer",
                    }}>View Library →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LIBRARY VIEW ── */}
          {view === "library" && (
            <div style={{ width: "100%", boxSizing: "border-box" }}>

              {/* Search bar */}
              <input
                type="text"
                placeholder="Search titles, summaries, tags..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  background: "#13131f",
                  border: "1px solid #1e1e30",
                  borderRadius: "6px",
                  padding: "9px 12px",
                  color: "#e2e8f0",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: "10px",
                }}
              />

              {/* Filter buttons */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
                {["ALL", "VIDEO", "ARTICLE", "DOCS"].map(f => {
                  const colors = {
                    ALL:     { text: "#a78bfa", border: "#7c3aed" },
                    VIDEO:   { text: "#a78bfa", border: "#7c3aed" },
                    ARTICLE: { text: "#60a5fa", border: "#2563eb" },
                    DOCS:    { text: "#34d399", border: "#059669" },
                  };
                  const c = colors[f];
                  return (
                    <button key={f} onClick={() => setTypeFilter(f)} style={{
                      background: typeFilter === f ? c.text : "#13131f",
                      color: typeFilter === f ? "#000" : c.text,
                      border: `1px solid ${c.border}`,
                      borderRadius: "4px", padding: "5px 10px", fontSize: "11px",
                      fontFamily: "monospace", fontWeight: "700", cursor: "pointer",
                    }}>{f}</button>
                  );
                })}
              </div>

              {/* Cards grid */}
              {filteredLibrary.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#2a2a3e" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗺️</div>
                  <div style={{ fontSize: "14px", marginBottom: "6px" }}>
                    {library.length === 0 ? "Your library is empty" : "No results found"}
                  </div>
                  <div style={{ fontSize: "12px" }}>
                    {library.length === 0 ? "Capture your first URL to get started" : "Try a different search"}
                  </div>
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "12px",
                  width: "100%",
                  boxSizing: "border-box",
                }}>
                  {filteredLibrary.map(item => (
                    <div key={item.id}
                      onClick={() => setExpanded(item)}
                      style={{
                        background: "#13131f",
                        border: "1px solid #1e1e30",
                        borderRadius: "10px",
                        padding: "14px",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        minWidth: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#7c3aed"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e30"}
                    >
                      {/* Top row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px" }}>
                        <TypeBadge type={item.type} />
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                          <span style={{ fontSize: "10px", color: "#4a4a6a", whiteSpace: "nowrap" }}>
                            {timeAgo(item.saved_at)}
                          </span>
                          <button
                            onClick={(e) => handleDelete(e, item.id)}
                            style={{
                              background: "none", border: "1px solid #3d1a1a",
                              borderRadius: "3px", color: "#f87171", cursor: "pointer",
                              fontSize: "10px", padding: "1px 4px", lineHeight: 1, flexShrink: 0,
                            }}
                          >🗑</button>
                        </div>
                      </div>

                      {/* Title */}
                      <div style={{
                        fontSize: "12px", fontWeight: "600", color: "#fff",
                        lineHeight: "1.4", display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        overflow: "hidden", minWidth: 0,
                      }}>{item.title}</div>

                      {/* Bullets */}
                      {parseSummary(item.summary).slice(0, 2).map((bullet, i) => (
                        <div key={i} style={{
                          display: "flex", gap: "6px", minWidth: 0,
                          fontSize: "11px", color: "#6b7280", lineHeight: "1.5",
                        }}>
                          <span style={{ color: "#4a4a6a", flexShrink: 0 }}>•</span>
                          <span style={{
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", minWidth: 0,
                          }}>{bullet.replace(/^[•\-\*]\s*/, "")}</span>
                        </div>
                      ))}

                      {/* Tags */}
                      {item.tags && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {item.tags.split(",").slice(0, 3).map(t => t.trim()).filter(Boolean).map(tag => (
                            <span key={tag} style={{
                              background: "#0d0d14", color: "#4a4a6a",
                              borderRadius: "3px", padding: "1px 5px", fontSize: "10px",
                            }}>#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CHAT VIEW ── */}
          {view === "chat" && (
            <div style={{ maxWidth: "560px", margin: "0 auto" }}>
              <div style={{ marginBottom: "20px", textAlign: "center" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>◎</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "6px" }}>
                  Ask your library anything
                </div>
                <div style={{ fontSize: "12px", color: "#4a4a6a" }}>
                  Atlas answers using only content you've saved
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
                <input
                  type="text"
                  placeholder="What do I know about React hooks?"
                  value={chatQuestion}
                  onChange={e => setChatQuestion(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleChat()}
                  style={{
                    flex: 1, background: "#13131f", border: "1px solid #1e1e30",
                    borderRadius: "8px", padding: "10px 14px", color: "#e2e8f0",
                    fontSize: "12px", fontFamily: "monospace", outline: "none",
                  }}
                />
                <button onClick={handleChat} disabled={chatLoading} style={{
                  background: "#7c3aed", color: "#fff", border: "none",
                  borderRadius: "8px", padding: "10px 16px", fontSize: "12px",
                  fontFamily: "monospace", fontWeight: "700", cursor: "pointer",
                }}>Ask</button>
              </div>

              {chatLoading && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{
                    width: "32px", height: "32px", border: "2px solid #1e1e30",
                    borderTop: "2px solid #7c3aed", borderRadius: "50%",
                    margin: "0 auto 14px", animation: "spin 0.8s linear infinite",
                  }} />
                  <div style={{ fontSize: "12px", color: "#4a4a6a" }}>Searching your library...</div>
                </div>
              )}

              {chatAnswer && !chatLoading && (
                <div style={{
                  background: "#13131f", border: "1px solid #1e1e30",
                  borderRadius: "10px", padding: "16px",
                }}>
                  <div style={{ fontSize: "10px", color: "#4a4a6a", letterSpacing: "0.1em", marginBottom: "10px" }}>
                    ATLAS ANSWER
                  </div>
                  <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.8", whiteSpace: "pre-wrap" }}>
                    {chatAnswer}
                  </div>
                  <button onClick={() => { setChatAnswer(""); setChatQuestion(""); }} style={{
                    marginTop: "12px", background: "none", border: "1px solid #1e1e30",
                    borderRadius: "4px", color: "#4a4a6a", padding: "5px 10px",
                    fontSize: "11px", fontFamily: "monospace", cursor: "pointer",
                  }}>Ask another</button>
                </div>
              )}

              {!chatAnswer && !chatLoading && (
                <div>
                  <div style={{ fontSize: "10px", color: "#4a4a6a", letterSpacing: "0.1em", marginBottom: "10px" }}>
                    SUGGESTED QUESTIONS
                  </div>
                  {[
                    "What have I learned about JavaScript?",
                    "Summarise everything I know about APIs",
                    "What are the key concepts I've saved?",
                    "What videos have I watched recently?",
                  ].map(q => (
                    <div key={q} onClick={() => setChatQuestion(q)} style={{
                      padding: "9px 12px", background: "#13131f",
                      border: "1px solid #1e1e30", borderRadius: "6px",
                      marginBottom: "6px", cursor: "pointer", fontSize: "12px", color: "#6b7280",
                    }}>→ {q}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Expanded Modal ── */}
      {expanded && (
        <div onClick={() => setExpanded(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#13131f", border: "1px solid #1e1e30",
            borderRadius: "12px", padding: "24px", width: "90%", maxWidth: "540px",
            maxHeight: "80vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <TypeBadge type={expanded.type} />
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button onClick={(e) => handleDelete(e, expanded.id)} style={{
                  background: "#1e0a0a", border: "1px solid #3d1a1a",
                  borderRadius: "4px", color: "#f87171", cursor: "pointer",
                  fontSize: "11px", padding: "4px 8px",
                }}>🗑 Delete</button>
                <button onClick={() => setExpanded(null)} style={{
                  background: "none", border: "none", color: "#4a4a6a",
                  cursor: "pointer", fontSize: "18px",
                }}>✕</button>
              </div>
            </div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "6px", lineHeight: "1.4" }}>
              {expanded.title}
            </div>
            <div style={{ fontSize: "11px", color: "#4a4a6a", marginBottom: "16px" }}>
              Saved {timeAgo(expanded.saved_at)} •{" "}
              <a href={expanded.url} target="_blank" rel="noreferrer" style={{ color: "#7c3aed" }}>
                Open original ↗
              </a>
            </div>
            <div style={{ fontSize: "10px", color: "#4a4a6a", letterSpacing: "0.1em", marginBottom: "10px" }}>
              AI SUMMARY
            </div>
            {parseSummary(expanded.summary).map((bullet, i) => (
              <div key={i} style={{
                display: "flex", gap: "8px", marginBottom: "8px",
                fontSize: "13px", color: "#cbd5e1", lineHeight: "1.7",
              }}>
                <span style={{ color: "#7c3aed", flexShrink: 0 }}>•</span>
                <span>{bullet.replace(/^[•\-\*]\s*/, "")}</span>
              </div>
            ))}
            {expanded.tags && (
              <div style={{ marginTop: "14px", display: "flex", gap: "5px", flexWrap: "wrap" }}>
                {expanded.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} style={{
                    background: "#0d0d14", color: "#6b7280",
                    borderRadius: "4px", padding: "2px 7px", fontSize: "11px",
                  }}>#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d0d14; }
        ::-webkit-scrollbar-thumb { background: #2a2a3e; border-radius: 2px; }
        input::placeholder { color: #4a4a6a; }
        input:focus { border-color: #7c3aed !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}