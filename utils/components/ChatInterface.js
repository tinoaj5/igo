function ChatInterface() {
  const [jobId, setJobId] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const j = params.get("job");
    setJobId(j);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      let id = jobId;

      if (!id) {
        const cur = await window.Backend.currentWalks();
        const first = cur?.ok && Array.isArray(cur.jobs) ? cur.jobs[0] : null;
        id = first?.job_id || null;
        setJobId(id);
      }

      if (!id) {
        setMessages([]);
        setErr("Open a job chat from Jobs page.");
        return;
      }

      const res = await window.Backend.listMessages(id);
      const arr = res?.ok && Array.isArray(res.messages) ? res.messages : [];
      const me = String(getProfile()?.email || "").toLowerCase().trim();

      const mapped = arr.map((m) => ({
        id: m.id || m.ts || Math.random(),
        text: m.body || "",
        sender: String(m.sender_email || "").toLowerCase().trim() === me ? "me" : "them",
        time: m.ts ? new Date(m.ts).toLocaleString() : "",
        who: m.sender_name || m.sender_email || "",
      }));

      setMessages(mapped);
    } catch (e) {
      setErr(window.Backend.niceError(e, "Could not load chat."));
      if (e?.code === "AUTH_REQUIRED") window.location.href = "login.html";
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    load();
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, [load]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !jobId) return;

    const body = input.trim();
    setInput("");

    try {
      const res = await window.Backend.sendMessage(jobId, body);
      if (!res?.ok) alert(res?.error || "Could not send message.");
      await load();
    } catch (e2) {
      alert(window.Backend.niceError(e2));
      if (e2?.code === "AUTH_REQUIRED") window.location.href = "login.html";
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] max-w-6xl mx-auto my-4 rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
      <div className="w-80 border-r border-white/10 bg-white/5 hidden md:flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-extrabold text-textMain mb-2">Messages</h2>
          <p className="text-textMuted text-sm">
            Job: <span className="text-textMain font-bold">{jobId || "—"}</span>
          </p>
          <a href="jobs.html" className="inline-flex items-center gap-2 mt-4 text-primary font-bold hover:underline">
            Back to jobs <div className="icon-arrow-left"></div>
          </a>
        </div>
        <div className="p-6 text-textMuted text-sm">
          Tip: open chat from a job card to set the job id automatically.
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-textMain font-extrabold">Chat</div>
            <div className="text-textMuted text-sm">{jobId ? `Walk • ${jobId}` : "No job selected"}</div>
          </div>
          <button
            onClick={load}
            className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-textMain font-bold hover:bg-white/10 transition-all inline-flex items-center gap-2"
          >
            Refresh <div className="icon-refresh-cw"></div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && <div className="text-textMuted">Loading messages…</div>}

          {!loading && err && (
            <div className="text-textMuted">
              {err}{" "}
              <a className="text-primary font-bold hover:underline" href="jobs.html">
                Open Jobs
              </a>
            </div>
          )}

          {!loading && !err && !messages.length && <div className="text-textMuted">No messages yet.</div>}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-4 py-3 border ${
                m.sender === "me" ? "ml-auto bg-primary/15 border-primary/40" : "mr-auto bg-white/5 border-white/10"
              }`}
            >
              <div className="text-textMain">{m.text}</div>
              <div className="text-xs text-textMuted mt-1">
                {m.who ? `${m.who} • ` : ""}{m.time}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} className="p-5 border-t border-white/10 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-textMain focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
          <button
            className="px-6 py-3 rounded-full bg-primary text-white font-extrabold shadow-lg shadow-primary/25 hover:brightness-110 transition-all inline-flex items-center gap-2"
            type="submit"
          >
            Send <div className="icon-send"></div>
          </button>
        </form>
      </div>
    </div>
  );
}
