export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[440px] xl:w-[500px] flex-col bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 relative overflow-hidden flex-shrink-0">

        {/* decorative blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-16 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

        {/* grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
              <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
                <path d="M4 28 L18 6 L32 28" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M10 28 L18 14 L26 28" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.25)" />
                <line x1="4" y1="28" x2="32" y2="28" stroke="white" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight leading-none block">ARC PEM</span>
              <span className="text-indigo-300 text-[10px] font-medium tracking-wider uppercase">Admin Console</span>
            </div>
          </div>

          {/* Main copy */}
          <div className="flex-1 flex flex-col justify-center mt-16">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 w-fit mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-300 tracking-wide">Trusted by 30+ firms</span>
            </div>

            <h2 className="text-3xl xl:text-[2.6rem] font-black text-white leading-[1.15] mb-5">
              Manage every rupee.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-violet-300">
                On every project.
              </span>
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-10 max-w-xs">
              ARC PEM gives architects and construction firms complete control over project expenses, budgets, and client billing — all in one place.
            </p>

            {/* Feature list */}
            <div className="space-y-3">
              {[
                ['📊', 'Real-time budget & expense tracking'],
                ['📋', 'BOQ, purchase orders & invoices'],
                ['👥', 'Multi-user roles & permissions'],
                ['📈', 'Instant financial reports & exports'],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-base flex-shrink-0">
                    {icon}
                  </div>
                  <span className="text-slate-200 text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/10">
            {[
              { value: '30+', label: 'Active firms' },
              { value: '500+', label: 'Projects' },
              { value: '₹50Cr+', label: 'Tracked' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl font-black text-white">{s.value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen overflow-y-auto">

        {/* Mobile brand bar */}
        <div className="lg:hidden bg-gradient-to-r from-indigo-900 to-violet-900 px-5 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
              <path d="M4 28 L18 6 L32 28" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M10 28 L18 14 L26 28" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.25)" />
              <line x1="4" y1="28" x2="32" y2="28" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <span className="text-white font-bold text-base leading-none block">ARC PEM</span>
            <span className="text-indigo-300 text-[10px] tracking-wider uppercase">Admin Console</span>
          </div>
        </div>

        {/* Centered form */}
        <div className="flex-1 flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-[420px]">
            {children}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 pb-6">
          © {new Date().getFullYear()} ARC PEM. All rights reserved.
        </p>
      </div>

    </div>
  )
}
