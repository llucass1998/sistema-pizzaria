export function ProductSkeleton() {
  return (
    <div className="flex w-full max-w-[280px] min-h-[420px] animate-pulse flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex w-full shrink-0 items-center justify-center pt-6 pb-2">
        <div className="h-[160px] w-[160px] rounded-full bg-slate-100 dark:bg-slate-800 ring-4 ring-slate-50 dark:ring-slate-800/50"></div>
      </div>
      <div className="flex flex-1 flex-col items-center p-5">
        <div className="mb-4 flex w-full flex-1 flex-col items-center">
          <div className="mb-3 h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
          <div className="flex w-full flex-col items-center space-y-2">
            <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800"></div>
            <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800"></div>
            <div className="h-3 w-4/6 rounded bg-slate-100 dark:bg-slate-800"></div>
          </div>
        </div>
        <div className="mt-auto flex w-full flex-col items-center gap-3">
          <div className="h-6 w-24 rounded bg-slate-200 dark:bg-slate-700"></div>
          <div className="h-11 w-full rounded-xl bg-slate-200 dark:bg-slate-700"></div>
        </div>
      </div>
    </div>
  );
}
