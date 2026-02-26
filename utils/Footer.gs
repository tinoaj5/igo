function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-white/5 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-textMain font-extrabold tracking-[0.18em] uppercase text-sm">
            IGO-HUB
          </div>
          <div className="text-textMuted text-sm mt-1">
            © {year} • Matching hub for walks & sitting
          </div>
        </div>
        <div className="text-textMuted text-sm">
          igo is only a matching layer — no insurance or guarantees.
        </div>
      </div>
    </footer>
  );
}
