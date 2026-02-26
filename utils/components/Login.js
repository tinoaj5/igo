function Login() {
  const [step, setStep] = React.useState("input"); // input | verify
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = React.useState(false);
  const inputRefs = React.useRef([]);

  const bg = "assets/ui-reference.png";

  const handleIdentifierSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      const res = await window.Backend.startLogin(email.trim());
      if (res?.ok) {
        setStep("verify");
        alert("Code sent. Use 555555 for testing.");
      } else {
        alert(res?.error || "Could not send code.");
      }
    } catch (err) {
      alert(window.Backend.niceError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    if (value.length > 1) return;
    const v = value.replace(/[^0-9]/g, "");
    const next = [...code];
    next[index] = v;
    setCode(next);
    if (v && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const joined = code.join("");
    if (joined.length !== 6) return;

    setIsLoading(true);
    try {
      const res = await window.Backend.verifyCode(email.trim(), joined);
      if (res?.ok && res?.token) {
        window.location.href = "index.html";
      } else {
        alert(res?.error || "Invalid or expired code.");
      }
    } catch (err) {
      alert(window.Backend.niceError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl bg-white/5 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/10 backdrop-blur-xl">
      <div className="md:w-1/2 relative hidden md:block">
        <img src={bg} alt="UI reference" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/70 to-primary/20"></div>
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          <p className="font-extrabold text-2xl mb-2">Let’s start here</p>
          <p className="opacity-90">Passwordless sign-in — clean, quick, mobile-first.</p>
        </div>
      </div>

      <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
        <div className="mb-8">
          <div className="w-12 h-12 bg-primary/15 rounded-full flex items-center justify-center text-primary mb-4 border border-primary/30">
            <div className="icon-paw-print text-2xl"></div>
          </div>
          <h2 className="text-3xl font-extrabold text-textMain mb-2">Sign in</h2>
          <p className="text-textMuted">We’ll send a 6-digit code to your email.</p>
        </div>

        {step === "input" ? (
          <form onSubmit={handleIdentifierSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-textMain mb-2">Email</label>
              <div className="relative">
                <input
                  type="email"
                  className="w-full bg-background/60 border border-white/10 rounded-xl px-4 py-3 text-textMain focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all placeholder-textMuted pl-10"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="icon-mail absolute left-3 top-3.5 text-textMuted"></div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 rounded-full bg-primary text-white font-extrabold shadow-lg shadow-primary/25 hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Sending code…
                </>
              ) : (
                <>
                  Continue <div className="icon-arrow-right"></div>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-textMuted mb-6">
                We sent a code to <span className="font-bold text-textMain">{email}</span>.
                <br />
                <button
                  type="button"
                  onClick={() => {
                    setStep("input");
                    setCode(["", "", "", "", "", ""]);
                  }}
                  className="text-primary hover:underline ml-1"
                >
                  Change?
                </button>
              </p>

              <div className="flex gap-2 justify-center mb-2">
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleCodeChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-12 h-12 text-center text-xl font-extrabold rounded-xl bg-background/60 border border-white/10 text-textMain focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                  />
                ))}
              </div>

              <p className="text-xs text-textMuted">
                Testing: use <span className="text-textMain font-bold">555555</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 rounded-full bg-primary text-white font-extrabold shadow-lg shadow-primary/25 hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Verifying…
                </>
              ) : (
                <>
                  Sign in <div className="icon-check"></div>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
