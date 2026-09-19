import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      localStorage.removeItem('notebooklm_provider');
      localStorage.removeItem('notebooklm_api_keys');
      localStorage.removeItem('notebooklm_chat_histories');
    } catch (e) {
      console.warn(e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-stone-100 flex items-center justify-center p-4 font-sans text-stone-900">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-stone-200 p-6 space-y-5 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-stone-900">Ocorreu um erro na interface</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                {this.state.error?.message || 'Ocorreu uma falha inesperada durante a execução da aplicação.'}
              </p>
            </div>

            {this.state.error?.stack && (
              <details className="text-left bg-stone-50 border border-stone-200 rounded-lg p-3 text-[11px] font-mono text-stone-700 max-h-32 overflow-y-auto">
                <summary className="cursor-pointer font-semibold text-stone-800 mb-1">Ver detalhes técnicos</summary>
                <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
              </details>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Recarregar Página
              </button>
              <button
                onClick={this.handleClearCache}
                className="w-full py-2 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Redefinir Chaves e Cache Local
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
