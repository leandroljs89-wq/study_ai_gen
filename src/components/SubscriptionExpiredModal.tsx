import React from 'react';
import { AlertTriangle, Clock, MessageSquare, LogOut, ShieldAlert } from 'lucide-react';
import { ADMIN_EMAIL } from '../types';

interface SubscriptionExpiredModalProps {
  isOpen: boolean;
  onLogout?: () => void;
  onSignOut?: () => void;
  onClose?: () => void;
  reason?: 'expired' | 'suspended' | 'not_found';
  userEmail?: string;
  plan?: string;
  expiresAt?: string | null;
}

export const SubscriptionExpiredModal: React.FC<SubscriptionExpiredModalProps> = ({
  isOpen,
  onLogout,
  onSignOut,
  onClose,
  reason = 'expired',
  userEmail,
  plan,
  expiresAt
}) => {
  if (!isOpen) return null;

  const handleSignOutAction = onSignOut || onLogout || (() => {});
  const isSuspended = reason === 'suspended';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-md w-full p-6 text-center animate-in zoom-in-95 duration-150">
        
        {/* Icon */}
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-inner ${
          isSuspended 
            ? 'bg-red-50 text-red-600 border border-red-200' 
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {isSuspended ? <ShieldAlert className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-stone-900 mb-2">
          {isSuspended ? 'Acesso Temporariamente Suspenso' : 'Sua Assinatura Expirou'}
        </h3>

        {/* Description */}
        <p className="text-xs text-stone-600 leading-relaxed mb-4">
          {isSuspended ? (
            <>
              O acesso para a conta <strong>{userEmail}</strong> foi pausado pelo administrador. Entre em contato para regularizar seu acesso.
            </>
          ) : (
            <>
              O período de validade do seu plano ({plan || 'Mensal'}) chegou ao fim
              {expiresAt && <> em <strong>{new Date(expiresAt).toLocaleDateString('pt-BR')}</strong></>}.
              Renove seu plano para continuar acessando todos os seus cadernos e ferramentas de Inteligência Artificial.
            </>
          )}
        </p>

        {/* Renewal / Contact Info Box */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 mb-5 text-left">
          <p className="font-semibold text-stone-800 mb-1">Como Renovar:</p>
          <p className="text-[11px] text-stone-600 mb-2">
            Fale diretamente com o administrador para renovar sua licença via Pix ou cartão.
          </p>
          <div className="flex items-center gap-1.5 text-stone-800 font-medium text-[11px]">
            <span>📧 Contato:</span>
            <span className="font-mono text-amber-900">{ADMIN_EMAIL}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              const msg = `Olá! Meu acesso ao NotebookLM Pro (${userEmail}) expirou e gostaria de renovar meu plano.`;
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            }}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Falar com o Administrador no WhatsApp</span>
          </button>

          <button
            onClick={handleSignOutAction}
            className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
