export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-carta px-4">
      <div className="mb-6 flex items-baseline gap-2">
        <span className="f-serif text-3xl font-semibold tracking-tight text-inchiostro">
          VISTA
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-ottone">
          gestionale
        </span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-center text-xs text-faint">
        Il cuore della suite VISTA · dati del negozio, sempre tuoi
      </p>
    </div>
  );
}
