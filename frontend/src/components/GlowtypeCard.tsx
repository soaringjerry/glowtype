type GlowtypeCardProps = {
  label?: string;
  title: string;
  subtitle?: string;
  className?: string;
};

export function GlowtypeCard({ label = 'Glowtype', title, subtitle, className }: GlowtypeCardProps) {
  const classes = ['glowtype-card px-6 py-6 text-center', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="glowtype-card-inner space-y-2">
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-100/70">
          {label}
        </p>
        <p className="text-3xl font-semibold tracking-tight text-slate-900">
          {title}
        </p>
        {subtitle && (
          <p className="text-sm text-slate-800/90">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

