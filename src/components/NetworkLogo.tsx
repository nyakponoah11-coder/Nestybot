interface Props {
  network: string;
  className?: string;
}

// Lightweight network "logo" badges using brand colors from the design system.
// These are not official trademarks — just brand-tone marks for quick recognition.
export const NetworkLogo = ({ network, className = "" }: Props) => {
  const base =
    "inline-flex items-center justify-center rounded-full font-black shrink-0 shadow-card";

  if (network === "MTN") {
    return (
      <div
        className={`${base} bg-mtn text-mtn-foreground border-2 border-mtn-foreground/80 ${className}`}
        aria-label="MTN"
      >
        <span className="text-[0.55em] tracking-tighter italic">MTN</span>
      </div>
    );
  }
  if (network === "TELECEL") {
    return (
      <div
        className={`${base} bg-telecel text-telecel-foreground ${className}`}
        aria-label="Telecel"
      >
        <span className="text-[0.7em] italic">t</span>
      </div>
    );
  }
  if (network === "AT") {
    return (
      <div
        className={`${base} bg-at text-at-foreground ${className}`}
        aria-label="AirtelTigo"
      >
        <span className="text-[0.45em] tracking-tight">AT</span>
      </div>
    );
  }
  return (
    <div className={`${base} bg-muted text-foreground ${className}`}>
      <span className="text-[0.5em]">{network}</span>
    </div>
  );
};
