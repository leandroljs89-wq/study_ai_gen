import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  LogIn,
  UserPlus,
  LogOut,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Cloud,
  ArrowRight
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { getSupabase, ensureUserProfile } from '../lib/supabaseClient';

interface SupabaseAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onAuthSuccess: (user: User) => void;
  onSignOut: () => void;
  onSyncLocalData?: () => void;
}

export const SupabaseAuthModal: React.FC<SupabaseAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
  onSignOut,
  onSyncLocalData
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('leandroljs89@gmail.com');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('Leandro');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const sb = getSupabase();
    if (!sb) {
      setErrorMsg('Configure a URL e a Anon Key do Supabase nas configurações antes de autenticar.');
      return;
    }

    if (!email || !password) {
      setErrorMsg('Informe o e-mail e a senha.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() }
          }
        });

        if (error) throw error;

        if (data.user) {
          await ensureUserProfile(data.user, fullName);
          if (data.session) {
            setSuccessMsg('Conta criada com sucesso e autenticada!');
            onAuthSuccess(data.user);
          } else {
            setSuccessMsg('Conta criada! Caso o Supabase exija confirmação de e-mail, verifique sua caixa de entrada ou faça login.');
          }
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) throw error;

        if (data.user) {
          await ensureUserProfile(data.user);
          setSuccessMsg('Autenticado com sucesso! Persistência em nuvem ativada.');
          onAuthSuccess(data.user);
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMsg(err.message || 'Falha na autenticação com o Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const sb = getSupabase();
    if (!sb) {
      setErrorMsg('Configure a URL e a Anon Key do Supabase nas configurações primeiro.');
      return;
    }

    setLoading(true);
    try {
      // Try Supabase Anonymous sign in if enabled
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      if (data.user) {
        await ensureUserProfile(data.user, 'Convidado');
        setSuccessMsg('Sessão anônima criada com sucesso! Seus cadernos agora são persistidos no Supabase.');
        onAuthSuccess(data.user);
      }
    } catch (err: any) {
      setErrorMsg(`Login anônimo não está ativo no seu Supabase: ${err.message}. Utilize seu e-mail e senha.`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    const sb = getSupabase();
    if (sb) {
      await sb.auth.signOut();
    }
    onSignOut();
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-2xs">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {currentUser ? 'Sessão Supabase Ativa' : 'Autenticação Supabase'}
              </h3>
              <p className="text-[11px] text-stone-500">
                Necessário para Row Level Security (RLS) & Persistência
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Explanation Banner */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Por que o login é obrigatório para persistir?</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              O seu script SQL possui <strong>Row Level Security (RLS)</strong> ativo com política <code className="font-mono bg-emerald-100/80 px-1 rounded">auth.uid() = user_id</code>. Sem um usuário logado no Supabase, as inserções de cadernos são bloqueadas pelo banco. Ao fazer login, todos os cadernos são salvos permanentemente na sua conta.
            </p>
          </div>

          {currentUser ? (
            /* Logged in state */
            <div className="space-y-4">
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-600">Usuário Conectado</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Ativo & Sincronizado
                  </span>
                </div>
                <div className="text-xs text-stone-900 font-medium">
                  {currentUser.email}
                </div>
                <div className="text-[10px] text-stone-400 font-mono">
                  ID: {currentUser.id}
                </div>
              </div>

              {onSyncLocalData && (
                <button
                  type="button"
                  onClick={() => {
                    onSyncLocalData();
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Sincronizar Cadernos com a Nuvem
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="w-full py-2 px-4 border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Encerrar Sessão
              </button>
            </div>
          ) : (
            /* Login / Register Form */
            <form onSubmit={handleAuth} className="space-y-3.5">
              {/* Tab Selector */}
              <div className="flex border border-stone-200 rounded-xl p-1 bg-stone-100/80">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'signin' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'signup' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Criar Conta
                </button>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Seu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-colors"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : mode === 'signin' ? (
                  <>
                    <LogIn className="w-4 h-4" /> Entrar & Ativar Persistência
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Criar Conta & Ativar
                  </>
                )}
              </button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2 text-stone-400 font-semibold">ou teste rápido</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAnonymousSignIn}
                disabled={loading}
                className="w-full py-2 px-3 border border-stone-200 hover:bg-stone-50 text-stone-600 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                Entrar como Convidado / Anônimo
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
