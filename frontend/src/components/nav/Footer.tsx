export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-border bg-secondary/30 overflow-hidden">
      {/* Atlanta BeltLine silhouette decoration */}
      <svg
        className="absolute inset-x-0 -top-12 w-full h-24 text-sand/60 pointer-events-none"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        fill="currentColor"
        aria-hidden
      >
        <path d="M0,80 C160,40 320,90 480,60 C640,30 800,70 960,55 C1120,40 1280,80 1440,50 L1440,100 L0,100 Z" />
      </svg>
      <div className="container relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-8 text-sm">
        <div>
          <div className="font-display text-base text-forest">GroundVault</div>
          <p className="text-muted-foreground text-xs mt-1">
            © GroundVault. Stewardship and multi-generational security.
          </p>
        </div>
        <nav className="flex items-center gap-6 text-muted-foreground">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-forest transition-colors">
            GitHub
          </a>
          <a href="https://atlantalandtrust.org" target="_blank" rel="noreferrer" className="hover:text-forest transition-colors">
            Atlanta Land Trust
          </a>
          <a href="https://iex.ec" target="_blank" rel="noreferrer" className="hover:text-forest transition-colors">
            iExec Nox
          </a>
          <a href="#" className="hover:text-forest transition-colors">
            Terms
          </a>
        </nav>
      </div>
    </footer>
  );
}
