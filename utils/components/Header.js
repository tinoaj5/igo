function Header({ activePage }) {
  const [authed, setAuthed] = React.useState(!!getToken());
  const [profile, setProfileState] = React.useState(getProfile());

  React.useEffect(() => {
    const iv = setInterval(() => {
      setAuthed(!!getToken());
      setProfileState(getProfile());
    }, 600);
    return () => clearInterval(iv);
  }, []);

  const name = profile?.name || profile?.email || "Account";

  const linkClass = (key) =>
    `px-4 py-2 rounded-full text-sm font-semibold transition-all ${
      activePage === key
        ? "bg-primary text-white shadow-md shadow-primary/20"
        : "text-textMuted hover:bg-white/5 hover:text-textMain"
    }`;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <a href="index.html" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-[#FF9A3D] shadow-lg shadow-primary/20 flex items-center justify-center">
            <div className="icon-paw-print text-white text-xl"></div>
          </div>
          <div className="leading-tight">
            <div className="text-textMain font-extrabold tracking-[0.18em] text-sm uppercase">
              IGO-HUB
            </div>
            <div className="text-textMuted text-xs">Walks • Sitting • Chat</div>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-2">
          <a className={linkClass("home")} href="index.html">Home</a>
          <a className={linkClass("jobs")} href="jobs.html">Jobs</a>
          <a className={linkClass("chat")} href="chat.html">Chat</a>
          <a className={linkClass("profile")} href="profile.html">Profile</a>
        </nav>

        <div className="flex items-center gap-2">
          {authed ? (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10">
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  <div className="icon-user text-textMain text-sm"></div>
                </div>
                <div className="text-sm font-semibold text-textMain max-w-[180px] truncate">
                  {name}
                </div>
              </div>
              <button
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-textMain font-semibold hover:bg-white/10 transition-all"
                onClick={() => {
                  signOut();
                  window.location.href = "login.html";
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <a
              className="px-5 py-2 rounded-full bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
              href="login.html"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
