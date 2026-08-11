const features = [
  {
    title: "Treinos",
    description: "Monte e acompanhe suas rotinas de treino, série a série.",
  },
  {
    title: "Nutrição",
    description: "Registre refeições e acompanhe macros e calorias diárias.",
  },
  {
    title: "Progresso",
    description: "Visualize evolução de peso, medidas e recordes pessoais.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-center gap-12 px-6 py-24 sm:items-start">
        <div className="flex flex-col gap-4 text-center sm:items-start sm:text-left">
          <span className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            FitOS
          </span>
          <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
            Seu sistema operacional para treino, dieta e progresso.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Um único lugar para planejar treinos, acompanhar sua alimentação
            e ver sua evolução ao longo do tempo.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-2 rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-900"
            >
              <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
                {feature.title}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
