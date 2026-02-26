function JobBoard() {
  const [jobs, setJobs] = React.useState([]);
  const [filter, setFilter] = React.useState("All");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [showBidModal, setShowBidModal] = React.useState(null);
  const [bidAmount, setBidAmount] = React.useState("");
  const [bidMessage, setBidMessage] = React.useState("");

  const categories = ["All", "Walking", "Sitting"];

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await window.Backend.listJobs({});
      const arr = res?.ok && Array.isArray(res.jobs) ? res.jobs : [];

      const mapped = arr.map((j) => ({
        raw: j,
        id: j.job_id,
        type: j.type || "Walking",
        title: `${j.dog_name || "Dog"} • ${j.city || ""}`,
        description: j.notes || "No notes.",
        date: `${j.date || ""} ${j.time || ""}`.trim(),
        budget: j.max_price ? `${Math.round(Number(j.max_price))} CHF max` : "—",
        bids: j.bid_count || 0,
        duration: j.duration || "",
      }));

      setJobs(mapped);
    } catch (e) {
      setError(window.Backend.niceError(e, "Could not load jobs."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filteredJobs = filter === "All" ? jobs : jobs.filter((j) => j.type === filter);

  const openBid = (job) => {
    setShowBidModal(job);
    const max = job?.raw?.max_price ? Math.round(Number(job.raw.max_price)) : "";
    setBidAmount(max ? String(max) : "");
    setBidMessage("");
  };

  const submitBid = async (e) => {
    e.preventDefault();
    if (!showBidModal) return;

    try {
      const job_id = showBidModal.raw.job_id;
      const amount = Number(bidAmount || "");
      const message = String(bidMessage || "");
      const res = await window.Backend.placeBid(job_id, { amount, message });

      if (res?.ok) {
        alert("Bid sent ✔️");
        setShowBidModal(null);
        await load();
      } else {
        alert(res?.error || "Could not send bid.");
      }
    } catch (err) {
      alert(window.Backend.niceError(err));
      if (err?.code === "AUTH_REQUIRED") window.location.href = "login.html";
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-textMain mb-2">Available Jobs</h1>
          <p className="text-textMuted">Nearby walks and sits — bid in one tap.</p>
        </div>

        <div className="flex gap-2 bg-white/5 p-1.5 rounded-full border border-white/10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                filter === cat
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-textMuted hover:bg-white/5 hover:text-textMain"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 text-textMuted">
          Loading jobs…
        </div>
      )}

      {!loading && error && (
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 text-red-200">
          {error}
          <div className="mt-3">
            <a href="login.html" className="text-primary font-bold hover:underline">
              Sign in
            </a>
          </div>
        </div>
      )}

      {!loading && !error && !filteredJobs.length && (
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 text-textMuted">
          No jobs found.
        </div>
      )}

      <div className="grid gap-6">
        {filteredJobs.map((job) => (
          <div
            key={job.id}
            className="group rounded-3xl p-6 md:p-8 bg-white/5 border border-white/10 hover:bg-white/7 transition-all flex flex-col md:flex-row gap-6 hover:-translate-y-1"
          >
            <div className="flex-shrink-0">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl border border-white/10 ${
                  job.type === "Walking"
                    ? "bg-primary/15 text-primary"
                    : "bg-[#FF9A3D]/15 text-[#FF9A3D]"
                }`}
              >
                <div className={`icon-${job.type === "Walking" ? "footprints" : "home"}`}></div>
              </div>
            </div>

            <div className="flex-grow">
              <div className="flex flex-col md:flex-row justify-between items-start mb-2 gap-2">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border border-white/10 ${
                        job.type === "Walking"
                          ? "bg-primary/15 text-primary"
                          : "bg-[#FF9A3D]/15 text-[#FF9A3D]"
                      }`}
                    >
                      {job.type}
                    </span>
                    <span className="text-textMuted text-xs flex items-center gap-1">
                      <div className="icon-clock text-xs"></div> {job.date || "—"}
                    </span>
                    {job.duration ? (
                      <span className="text-textMuted text-xs">• {job.duration} min</span>
                    ) : null}
                  </div>

                  <h3 className="text-xl font-extrabold text-textMain group-hover:text-primary transition-colors">
                    {job.title}
                  </h3>
                </div>

                <div className="text-right md:text-right text-left">
                  <p className="text-lg font-extrabold text-primary">{job.budget}</p>
                  <p className="text-xs text-textMuted font-medium">{job.bids} offers so far</p>
                </div>
              </div>

              <p className="text-textMuted text-base mb-6 leading-relaxed">{job.description}</p>

              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => openBid(job)}
                  className="px-6 py-3 rounded-full bg-primary text-white font-extrabold shadow-lg shadow-primary/20 hover:brightness-110 transition-all inline-flex items-center gap-2"
                >
                  Place bid <div className="icon-send"></div>
                </button>

                <a
                  href={`chat.html?job=${encodeURIComponent(job.id)}`}
                  className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-textMain font-extrabold hover:bg-white/10 transition-all inline-flex items-center gap-2"
                >
                  Chat <div className="icon-message-circle"></div>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showBidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowBidModal(null)}></div>

          <div className="relative w-full max-w-lg rounded-3xl bg-background/95 border border-white/10 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-textMain font-extrabold text-xl">Place a bid</div>
                <div className="text-textMuted text-sm">{showBidModal.title}</div>
              </div>
              <button
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                onClick={() => setShowBidModal(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitBid} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-textMain mb-2">Amount (CHF)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-textMain focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                  placeholder="e.g. 25"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-textMain mb-2">Quick note (optional)</label>
                <input
                  type="text"
                  value={bidMessage}
                  onChange={(e) => setBidMessage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-textMain focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                  placeholder="Anything the owner should know?"
                />
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 rounded-full bg-primary text-white font-extrabold shadow-lg shadow-primary/25 hover:brightness-110 transition-all inline-flex items-center justify-center gap-2"
              >
                Send bid <div className="icon-send"></div>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
