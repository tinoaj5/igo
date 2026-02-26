function FeatureSection() {
  const items = [
    {
      icon: "icon-shield",
      title: "Simple & safe",
      desc: "Passwordless login with a 6-digit code. No passwords to leak.",
    },
    {
      icon: "icon-map-pin",
      title: "City-first matching",
      desc: "Jobs prioritize your city for faster, cleaner matching.",
    },
    {
      icon: "icon-message-circle",
      title: "Chat per walk",
      desc: "Owners & walkers chat inside igo — no phone numbers required.",
    },
    {
      icon: "icon-zap",
      title: "Fast mobile UI",
      desc: "Dark surfaces, orange CTAs, and app-like spacing everywhere.",
    },
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 py-14">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-textMain">
            Built like an app
          </h2>
          <p className="text-textMuted mt-2 max-w-2xl">
            The UI is fully connected to your backend flows: login, jobs, bidding,
            chat, and profile.
          </p>
        </div>
        <a
          href="jobs.html"
          className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-textMain font-extrabold hover:bg-white/10 transition-all inline-flex items-center gap-2"
        >
          Explore jobs <div className="icon-arrow-right"></div>
        </a>
      </div>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-3xl bg-white/5 border border-white/10 p-5 shadow-soft"
          >
            <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mb-4">
              <div className={it.icon}></div>
            </div>
            <div className="text-textMain font-extrabold">{it.title}</div>
            <div className="text-textMuted text-sm mt-2 leading-relaxed">
              {it.desc}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
