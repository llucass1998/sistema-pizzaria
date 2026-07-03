import React from 'react';

export function PageContainer({ children }) {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {children}
    </main>
  );
}
