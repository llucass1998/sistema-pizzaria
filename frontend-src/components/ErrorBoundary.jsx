import React from 'react';
import { AlertCircle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
          <div className="w-full max-w-md rounded-xl border-2 border-red-500 bg-white dark:bg-slate-900 p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle size={32} />
            </div>
            <h1 className="mb-2 text-2xl font-black text-slate-900 dark:text-slate-100">
              Ops! Algo deu errado.
            </h1>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              Tivemos um problema inesperado ao carregar esta tela. Já fomos notificados e estamos
              trabalhando para resolver.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white hover:bg-slate-800"
            >
              Tentar Novamente
            </button>
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 text-left overflow-auto rounded bg-slate-100 p-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-bold">{this.state.error.toString()}</p>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
