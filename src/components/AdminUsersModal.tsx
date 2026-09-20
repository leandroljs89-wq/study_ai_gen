import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  MessageSquare, 
  DollarSign, 
  Calendar, 
  RefreshCw, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Send, 
  Database, 
  ExternalLink,
  Phone,
  AlertTriangle,
  X,
  Plus,
  KeyRound,
  TrendingUp,
  Infinity as InfinityIcon
} from 'lucide-react';
import { ManagedUser, UserAccessPlan, UserAccessStatus, ADMIN_EMAIL } from '../types';
import { User } from '@supabase/supabase-js';
import { fetchManagedUsersFromSupabase, saveManagedUserProfile } from '../lib/supabaseClient';
import { apiFetch } from '../lib/apiHelper';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  supabaseUrl = '',
  supabaseAnonKey = ''
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'create' | 'message_template' | 'sql_setup'>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'suspended'>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [serviceRoleKey, setServiceRoleKey] = useState(() => localStorage.getItem('admin_supabase_service_key') || '');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('Acesso@2026');
  const [newPlan, setNewPlan] = useState<UserAccessPlan>('monthly');
  const [newPricePaid, setNewPricePaid] = useState('49.90');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [customExpirationDays, setCustomExpirationDays] = useState(30);
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Created user result for quick sharing
  const [lastCreatedUser, setLastCreatedUser] = useState<{
    user: ManagedUser;
    password: string;
  } | null>(null);

  // Editing User State
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  // Check if current user is Admin
  const isAuthorized = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Load users on open
  useEffect(() => {
    if (isOpen && isAuthorized) {
      loadUsers();
    }
  }, [isOpen, isAuthorized]);

  const showNotify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  const calculateExpirationDate = (plan: UserAccessPlan, customDays = 30): string | null => {
    if (plan === 'lifetime') return null;
    const now = new Date();
    if (plan === 'monthly') now.setDate(now.getDate() + 30);
    else if (plan === 'quarterly') now.setDate(now.getDate() + 90);
    else if (plan === 'semiannual') now.setDate(now.getDate() + 180);
    else if (plan === 'annual') now.setDate(now.getDate() + 365);
    else if (plan === 'custom') now.setDate(now.getDate() + (customDays || 30));
    else now.setDate(now.getDate() + 30);
    return now.toISOString();
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // 1. Try via backend Admin API
      try {
        const res = await apiFetch('/api/admin/list-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: ADMIN_EMAIL,
            supabaseUrl,
            serviceRoleKey,
            anonKey: supabaseAnonKey
          })
        });
        if (res.users && Array.isArray(res.users) && res.users.length > 0) {
          setUsers(res.users);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Backend admin list fallback to client:', e);
      }

      // 2. Client fallback via Supabase profiles
      const clientUsers = await fetchManagedUsersFromSupabase();
      if (clientUsers && clientUsers.length > 0) {
        setUsers(clientUsers);
      } else {
        // Local storage cache fallback
        const cached = localStorage.getItem('notebooklm_managed_users');
        if (cached) {
          setUsers(JSON.parse(cached));
        } else {
          // Default initial record
          const initialAdmin: ManagedUser = {
            id: currentUser?.id || 'admin_1',
            email: ADMIN_EMAIL,
            full_name: 'Administrador (Você)',
            role: 'admin',
            plan: 'lifetime',
            status: 'active',
            created_at: new Date().toISOString(),
            notes: 'Conta master proprietária da aplicação.',
            price_paid: 0
          };
          setUsers([initialAdmin]);
        }
      }
    } catch (err: any) {
      showNotify(err.message || 'Erro ao carregar lista de usuários.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      showNotify('Informe um endereço de e-mail válido.', 'error');
      return;
    }

    setIsSubmittingNewUser(true);
    try {
      const expiresAt = calculateExpirationDate(newPlan, customExpirationDays);
      const price = parseFloat(newPricePaid) || 0;

      let createdUserObj: ManagedUser | null = null;

      // 1. Try Backend API
      try {
        const response = await apiFetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: ADMIN_EMAIL,
            supabaseUrl,
            serviceRoleKey,
            anonKey: supabaseAnonKey,
            email: newEmail.trim().toLowerCase(),
            password: newPassword,
            fullName: newFullName.trim() || newEmail.split('@')[0],
            plan: newPlan,
            status: 'active',
            expiresAt,
            pricePaid: price,
            phoneWhatsapp: newPhone.trim(),
            notes: newNotes.trim()
          })
        });

        if (response.user) {
          createdUserObj = response.user;
        }
      } catch (backendErr: any) {
        console.warn('Backend admin create user failed, saving profile directly:', backendErr);
      }

      // 2. Direct client fallback
      if (!createdUserObj) {
        const genId = 'usr_' + Date.now();
        createdUserObj = {
          id: genId,
          email: newEmail.trim().toLowerCase(),
          full_name: newFullName.trim() || newEmail.split('@')[0],
          role: 'user',
          plan: newPlan,
          status: 'active',
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
          notes: newNotes.trim(),
          price_paid: price,
          phone_whatsapp: newPhone.trim(),
          temporary_password: newPassword
        };

        await saveManagedUserProfile(createdUserObj);
      }

      // Update local state and cache
      setUsers(prev => {
        const filtered = prev.filter(u => u.email.toLowerCase() !== createdUserObj!.email.toLowerCase());
        const updated = [createdUserObj!, ...filtered];
        localStorage.setItem('notebooklm_managed_users', JSON.stringify(updated));
        return updated;
      });

      setLastCreatedUser({
        user: createdUserObj,
        password: newPassword
      });

      showNotify(`Cliente ${createdUserObj.full_name} criado com sucesso!`, 'success');

      // Reset form
      setNewEmail('');
      setNewFullName('');
      generateRandomPassword();
      setNewPhone('');
      setNewNotes('');
    } catch (err: any) {
      showNotify(err.message || 'Erro ao criar usuário.', 'error');
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  const handleUpdateUserStatus = async (user: ManagedUser, newStatus: UserAccessStatus) => {
    try {
      const updated = { ...user, status: newStatus };
      await saveManagedUserProfile(updated);

      try {
        await apiFetch('/api/admin/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: ADMIN_EMAIL,
            supabaseUrl,
            serviceRoleKey,
            anonKey: supabaseAnonKey,
            userId: user.id,
            updates: { status: newStatus }
          })
        });
      } catch {}

      setUsers(prev => {
        const next = prev.map(u => u.id === user.id ? updated : u);
        localStorage.setItem('notebooklm_managed_users', JSON.stringify(next));
        return next;
      });

      showNotify(`Status de ${user.full_name} alterado para ${newStatus === 'active' ? 'Ativo' : 'Suspenso'}.`);
    } catch (err: any) {
      showNotify(err.message || 'Erro ao atualizar status.', 'error');
    }
  };

  const handleExtendUserPlan = async (user: ManagedUser, addedDays: number | 'lifetime') => {
    try {
      let newExpiresAt: string | null = null;
      let newPlan = user.plan;

      if (addedDays === 'lifetime') {
        newExpiresAt = null;
        newPlan = 'lifetime';
      } else {
        const base = user.expires_at && new Date(user.expires_at) > new Date()
          ? new Date(user.expires_at)
          : new Date();
        base.setDate(base.getDate() + addedDays);
        newExpiresAt = base.toISOString();
      }

      const updated: ManagedUser = {
        ...user,
        status: 'active',
        plan: newPlan,
        expires_at: newExpiresAt
      };

      await saveManagedUserProfile(updated);

      try {
        await apiFetch('/api/admin/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: ADMIN_EMAIL,
            supabaseUrl,
            serviceRoleKey,
            anonKey: supabaseAnonKey,
            userId: user.id,
            updates: { status: 'active', plan: newPlan, expires_at: newExpiresAt }
          })
        });
      } catch {}

      setUsers(prev => {
        const next = prev.map(u => u.id === user.id ? updated : u);
        localStorage.setItem('notebooklm_managed_users', JSON.stringify(next));
        return next;
      });

      showNotify(`Acesso de ${user.full_name} estendido com sucesso!`);
    } catch (err: any) {
      showNotify(err.message || 'Erro ao estender prazo.', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      try {
        await apiFetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: ADMIN_EMAIL,
            supabaseUrl,
            serviceRoleKey,
            anonKey: supabaseAnonKey,
            userId
          })
        });
      } catch {}

      setUsers(prev => {
        const next = prev.filter(u => u.id !== userId);
        localStorage.setItem('notebooklm_managed_users', JSON.stringify(next));
        return next;
      });

      setUserToDelete(null);
      showNotify('Usuário excluído do sistema.');
    } catch (err: any) {
      showNotify(err.message || 'Erro ao excluir usuário.', 'error');
    }
  };

  const handleSaveServiceRoleKey = () => {
    localStorage.setItem('admin_supabase_service_key', serviceRoleKey.trim());
    showNotify('Service Role Key salva com sucesso! Criação direta sem confirmação de e-mail habilitada.');
  };

  // Metrics
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'active' && (!u.expires_at || new Date(u.expires_at) > new Date())).length;
  const totalRevenue = users.reduce((acc, u) => acc + (u.price_paid || 0), 0);
  const expiringSoonUsers = users.filter(u => {
    if (!u.expires_at || u.status !== 'active') return false;
    const exp = new Date(u.expires_at).getTime();
    const now = Date.now();
    const diffDays = (exp - now) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone_whatsapp && u.phone_whatsapp.includes(searchQuery));

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') {
      return u.status === 'active' && (!u.expires_at || new Date(u.expires_at) > new Date());
    }
    if (statusFilter === 'expired') {
      return u.expires_at && new Date(u.expires_at) <= new Date();
    }
    if (statusFilter === 'suspended') {
      return u.status === 'suspended';
    }
    return true;
  });

  const getWhatsAppMessage = (user: ManagedUser, password = 'Acesso@2026') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://notebooklm.app';
    const planName = 
      user.plan === 'monthly' ? 'Mensal (30 dias)' :
      user.plan === 'quarterly' ? 'Trimestral (90 dias)' :
      user.plan === 'semiannual' ? 'Semestral (180 dias)' :
      user.plan === 'annual' ? 'Anual (365 dias)' :
      user.plan === 'lifetime' ? 'Vitalício (Acesso Permanente)' : 'Personalizado';

    const validade = user.expires_at 
      ? `📅 Validade do Plano: ${new Date(user.expires_at).toLocaleDateString('pt-BR')}`
      : `📅 Validade do Plano: Acesso Vitalício (Sem Expiração)`;

    return `Olá ${user.full_name}, seu acesso ao *NotebookLM Pro* está liberado! 🚀

🔗 *Link de Acesso:* ${origin}
👤 *Login (E-mail):* ${user.email}
🔑 *Senha Inicial:* ${password}
📦 *Plano:* ${planName}
${validade}

*Como começar:*
1. Abra o link acima no seu navegador.
2. Clique no canto superior em *"Entrar ou Criar Conta"*.
3. Insira seu e-mail e a senha acima.
4. Crie seus cadernos, envie seus PDFs e faça perguntas com Inteligência Artificial!

Se precisar de suporte ou renovação, estamos à disposição!`;
  };

  const getDaysRemainingText = (expiresAt?: string | null) => {
    if (!expiresAt) return { text: 'Vitalício', color: 'text-purple-700 bg-purple-50 border-purple-200' };
    const exp = new Date(expiresAt).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Expirou há ${Math.abs(diffDays)}d`, color: 'text-red-700 bg-red-50 border-red-200' };
    }
    if (diffDays === 0) {
      return { text: 'Expira hoje', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (diffDays <= 7) {
      return { text: `${diffDays} dias restantes`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    return { text: `${diffDays} dias restantes`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-stone-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-stone-200 bg-linear-to-r from-stone-900 via-stone-800 to-amber-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white">
                  Painel de Administração & Vendas
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold tracking-wider uppercase border border-amber-400/30">
                  ADM EXCLUSIVO
                </span>
              </div>
              <p className="text-xs text-stone-300">
                Gerencie clientes, crie logins, venda assinaturas e envie credenciais instantâneas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security Guard Check */}
        {!isAuthorized ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mb-4 shadow-sm">
              <Lock className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-stone-900 mb-2">Acesso Restrito ao Administrador</h4>
            <p className="text-xs text-stone-600 leading-relaxed mb-6">
              Esta área é estritamente restrita ao administrador proprietário da aplicação (<strong>{ADMIN_EMAIL}</strong>).
            </p>
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 w-full text-left mb-6">
              <p className="font-semibold text-stone-800 mb-1">Usuário Atual:</p>
              <p className="font-mono text-[11px] text-stone-600">{currentUser?.email || 'Nenhum usuário logado'}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
            >
              Voltar para a Aplicação
            </button>
          </div>
        ) : (
          <>
            {/* Notification Toast */}
            {notification && (
              <div className={`px-4 py-2 text-xs font-semibold flex items-center justify-between transition-all ${
                notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
              }`}>
                <span>{notification.message}</span>
                <button onClick={() => setNotification(null)} className="text-white hover:opacity-80">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Metrics KPI Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-stone-50 border-b border-stone-200 shrink-0">
              <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-600 font-semibold uppercase tracking-wider block">Total Clientes</span>
                  <span className="text-lg font-bold text-stone-900">{totalUsers}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-600 font-semibold uppercase tracking-wider block">Assinantes Ativos</span>
                  <span className="text-lg font-bold text-emerald-700">{activeUsers}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-600 font-semibold uppercase tracking-wider block">Faturamento Total</span>
                  <span className="text-lg font-bold text-amber-900">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-600 font-semibold uppercase tracking-wider block">Expirando em Breve</span>
                  <span className="text-lg font-bold text-red-700">{expiringSoonUsers}</span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-stone-200 bg-white shrink-0">
              <button
                onClick={() => setActiveTab('users')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'users'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Lista de Clientes ({users.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('create')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'create'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Criar Novo Cliente / Venda</span>
              </button>

              <button
                onClick={() => setActiveTab('message_template')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'message_template'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Modelo de Mensagem WhatsApp</span>
              </button>

              <button
                onClick={() => setActiveTab('sql_setup')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'sql_setup'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Integração Supabase & SQL</span>
              </button>
            </div>

            {/* TAB 1: USERS LIST */}
            {activeTab === 'users' && (
              <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden bg-stone-50/40">
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 shrink-0">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por nome, email ou telefone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-stone-800 shadow-2xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-stone-200 text-xs shadow-2xs">
                      <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          statusFilter === 'all' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        Todos ({users.length})
                      </button>
                      <button
                        onClick={() => setStatusFilter('active')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        Ativos
                      </button>
                      <button
                        onClick={() => setStatusFilter('expired')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          statusFilter === 'expired' ? 'bg-red-600 text-white' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        Expirados
                      </button>
                      <button
                        onClick={() => setStatusFilter('suspended')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          statusFilter === 'suspended' ? 'bg-stone-600 text-white' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        Bloqueados
                      </button>
                    </div>

                    <button
                      onClick={loadUsers}
                      disabled={isLoading}
                      title="Atualizar lista de clientes"
                      className="p-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl transition-all shadow-2xs cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
                    </button>

                    <button
                      onClick={() => setActiveTab('create')}
                      className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Novo Cliente</span>
                    </button>
                  </div>
                </div>

                {/* Table Container */}
                <div className="flex-1 bg-white rounded-xl border border-stone-200 overflow-y-auto shadow-2xs">
                  {filteredUsers.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-stone-500">
                      <Users className="w-10 h-10 text-stone-300 mb-2" />
                      <p className="text-sm font-semibold text-stone-700">Nenhum cliente encontrado</p>
                      <p className="text-xs text-stone-500 max-w-xs mt-1">
                        {searchQuery ? 'Nenhum resultado corresponde à busca.' : 'Clique em "Criar Novo Cliente / Venda" para cadastrar seu primeiro comprador.'}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-stone-50 sticky top-0 z-10 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Cliente & E-mail</th>
                          <th className="py-3 px-4">Plano</th>
                          <th className="py-3 px-4">Validade / Status</th>
                          <th className="py-3 px-4">Valor Cobrado</th>
                          <th className="py-3 px-4">Contato / Notas</th>
                          <th className="py-3 px-4 text-right">Ações Rápidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-sans">
                        {filteredUsers.map((user) => {
                          const remaining = getDaysRemainingText(user.expires_at);
                          const isMasterAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

                          return (
                            <tr key={user.id} className="hover:bg-stone-50/80 transition-colors">
                              {/* Name & Email */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isMasterAdmin ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700 border border-stone-200'
                                  }`}>
                                    {user.full_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-stone-900 truncate">{user.full_name}</span>
                                      {isMasterAdmin && (
                                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 text-[9px] font-bold rounded">
                                          ADMIN MASTER
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-stone-500 font-mono block truncate">{user.email}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Plan */}
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] border capitalize inline-flex items-center gap-1 ${
                                  user.plan === 'lifetime'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : user.plan === 'annual'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-stone-100 text-stone-800 border-stone-200'
                                }`}>
                                  {user.plan === 'lifetime' && <InfinityIcon className="w-3 h-3 text-purple-600" />}
                                  {user.plan === 'monthly' ? 'Mensal' :
                                   user.plan === 'quarterly' ? 'Trimestral' :
                                   user.plan === 'semiannual' ? 'Semestral' :
                                   user.plan === 'annual' ? 'Anual' :
                                   user.plan === 'lifetime' ? 'Vitalício' : user.plan}
                                </span>
                              </td>

                              {/* Expiration & Status */}
                              <td className="py-3 px-4">
                                <div className="flex flex-col gap-1">
                                  <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] border w-max ${remaining.color}`}>
                                    {remaining.text}
                                  </span>
                                  {user.expires_at && (
                                    <span className="text-[10px] text-stone-400">
                                      Até {new Date(user.expires_at).toLocaleDateString('pt-BR')}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Price */}
                              <td className="py-3 px-4 font-mono font-medium text-stone-800">
                                {user.price_paid ? `R$ ${user.price_paid.toFixed(2)}` : 'R$ 0,00'}
                              </td>

                              {/* Notes / Phone */}
                              <td className="py-3 px-4">
                                <div className="max-w-[160px]">
                                  {user.phone_whatsapp && (
                                    <span className="text-[11px] text-stone-700 font-mono block truncate">
                                      📱 {user.phone_whatsapp}
                                    </span>
                                  )}
                                  {user.notes && (
                                    <span className="text-[10px] text-stone-500 truncate block" title={user.notes}>
                                      {user.notes}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Quick Actions */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {/* Send WhatsApp Message */}
                                  <button
                                    onClick={() => {
                                      const msg = getWhatsAppMessage(user, user.temporary_password || 'Acesso@2026');
                                      copyToClipboard(msg, `msg_${user.id}`);
                                      if (user.phone_whatsapp) {
                                        const cleanPhone = user.phone_whatsapp.replace(/\D/g, '');
                                        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                      } else {
                                        showNotify('Mensagem copiada para a área de transferência! Envie para o comprador.');
                                      }
                                    }}
                                    title="Copiar e Enviar Dados de Acesso via WhatsApp"
                                    className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    {copiedText === `msg_${user.id}` ? (
                                      <Check className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                      <MessageSquare className="w-4 h-4" />
                                    )}
                                  </button>

                                  {/* Extend +30 Days */}
                                  {!isMasterAdmin && (
                                    <button
                                      onClick={() => handleExtendUserPlan(user, 30)}
                                      title="Renovar / Estender +30 Dias"
                                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer font-bold text-[11px]"
                                    >
                                      +30d
                                    </button>
                                  )}

                                  {/* Toggle Active / Suspended */}
                                  {!isMasterAdmin && (
                                    <button
                                      onClick={() => handleUpdateUserStatus(user, user.status === 'active' ? 'suspended' : 'active')}
                                      title={user.status === 'active' ? 'Bloquear/Suspender Acesso' : 'Reativar Acesso'}
                                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                        user.status === 'active'
                                          ? 'text-stone-500 hover:text-red-700 hover:bg-red-50'
                                          : 'text-emerald-600 hover:bg-emerald-50'
                                      }`}
                                    >
                                      {user.status === 'active' ? (
                                        <XCircle className="w-4 h-4" />
                                      ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}

                                  {/* Delete */}
                                  {!isMasterAdmin && (
                                    <button
                                      onClick={() => setUserToDelete(user)}
                                      title="Excluir Usuário"
                                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CREATE NEW USER */}
            {activeTab === 'create' && (
              <div className="flex-1 p-6 overflow-y-auto bg-stone-50/30">
                <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                  <div className="flex items-center gap-3 pb-4 mb-6 border-b border-stone-100">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900">Cadastrar Novo Comprador / Usuário</h4>
                      <p className="text-xs text-stone-500">
                        Crie o acesso do cliente no Supabase Auth e gere a mensagem com link e senha pronta para envio.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Nome do Cliente *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Carlos Eduardo"
                          value={newFullName}
                          onChange={(e) => setNewFullName(e.target.value)}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-stone-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          E-mail do Cliente (Login) *
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="carlos@gmail.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-stone-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Password with generator */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-stone-700">Senha Inicial *</label>
                          <button
                            type="button"
                            onClick={generateRandomPassword}
                            className="text-[10px] text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1"
                          >
                            <KeyRound className="w-3 h-3" /> Gerar Forte
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-9 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:outline-hidden focus:border-stone-800"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* WhatsApp Phone */}
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          WhatsApp / Telefone (com DDD)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 5511999998888"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-stone-800"
                        />
                      </div>
                    </div>

                    {/* Plan Selector & Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Plano Vendido *
                        </label>
                        <select
                          value={newPlan}
                          onChange={(e) => {
                            const val = e.target.value as UserAccessPlan;
                            setNewPlan(val);
                            if (val === 'monthly') setNewPricePaid('49.90');
                            else if (val === 'quarterly') setNewPricePaid('119.90');
                            else if (val === 'semiannual') setNewPricePaid('199.90');
                            else if (val === 'annual') setNewPricePaid('349.90');
                            else if (val === 'lifetime') setNewPricePaid('599.00');
                          }}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:border-stone-800"
                        >
                          <option value="monthly">⚡ Mensal (30 dias de acesso)</option>
                          <option value="quarterly">🌟 Trimestral (90 dias de acesso)</option>
                          <option value="semiannual">💎 Semestral (180 dias de acesso)</option>
                          <option value="annual">🚀 Anual (365 dias de acesso)</option>
                          <option value="lifetime">♾️ Vitalício (Acesso Permanente)</option>
                          <option value="custom">⚙️ Personalizado</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Valor Cobrado (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-semibold text-stone-500">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={newPricePaid}
                            onChange={(e) => setNewPricePaid(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:outline-hidden focus:border-stone-800"
                          />
                        </div>
                      </div>
                    </div>

                    {newPlan === 'custom' && (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Duração em Dias
                        </label>
                        <input
                          type="number"
                          value={customExpirationDays}
                          onChange={(e) => setCustomExpirationDays(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-stone-800"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Observações Internas (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Comprou via Pix no WhatsApp dia 20/09"
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-stone-800"
                      />
                    </div>

                    <div className="pt-3">
                      <button
                        type="submit"
                        disabled={isSubmittingNewUser}
                        className="w-full py-3 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                      >
                        {isSubmittingNewUser ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Cadastrando Cliente no Supabase...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Criar Acesso e Gerar Mensagem de Venda</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Last Created Success Banner */}
                  {lastCreatedUser && (
                    <div className="mt-6 p-4 bg-emerald-50 border border-emerald-300 rounded-2xl animate-in fade-in duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          <span>Acesso Gerado com Sucesso!</span>
                        </div>
                        <button
                          onClick={() => {
                            const msg = getWhatsAppMessage(lastCreatedUser.user, lastCreatedUser.password);
                            copyToClipboard(msg, 'last_created');
                          }}
                          className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedText === 'last_created' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Mensagem WhatsApp</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre className="text-[11px] text-stone-800 bg-white p-3 rounded-xl border border-emerald-200 font-sans whitespace-pre-wrap leading-relaxed">
                        {getWhatsAppMessage(lastCreatedUser.user, lastCreatedUser.password)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: WHATSAPP MESSAGE TEMPLATE */}
            {activeTab === 'message_template' && (
              <div className="flex-1 p-6 overflow-y-auto bg-stone-50/30">
                <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900">Modelo Padrão de Entrega de Acesso</h4>
                      <p className="text-xs text-stone-500">
                        Este é o texto enviado para os compradores logo após a confirmação do pagamento.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-800 leading-relaxed font-sans whitespace-pre-wrap">
                    {`Olá [Nome do Cliente], seu acesso ao *NotebookLM Pro* está liberado! 🚀

🔗 *Link de Acesso:* ${typeof window !== 'undefined' ? window.location.origin : 'https://notebooklm.app'}
👤 *Login (E-mail):* [email_do_cliente]
🔑 *Senha Inicial:* [senha_temporaria]
📦 *Plano:* [Plano Escolhido]
📅 *Validade:* [Data de Expiração ou Vitalício]

*Como começar:*
1. Abra o link acima no seu computador ou celular.
2. Clique no canto superior em *"Entrar ou Criar Conta"*.
3. Insira seu e-mail e a senha acima.
4. Pronto! Crie seus cadernos, envie seus PDFs e faça perguntas com Inteligência Artificial!

Qualquer dúvida estamos à disposição!`}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-stone-500">
                      💡 Ao clicar no ícone do WhatsApp na lista de clientes, a mensagem é preenchida automaticamente.
                    </span>
                    <button
                      onClick={() => {
                        const sampleUser: ManagedUser = {
                          id: 'sample',
                          email: 'comprador@gmail.com',
                          full_name: 'Cliente Exemplo',
                          role: 'user',
                          plan: 'monthly',
                          status: 'active',
                          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                          created_at: new Date().toISOString()
                        };
                        copyToClipboard(getWhatsAppMessage(sampleUser, 'Acesso@2026'), 'tpl_copy');
                      }}
                      className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedText === 'tpl_copy' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>Copiar Modelo de Exemplo</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SQL & SERVICE ROLE KEY CONFIGURATION */}
            {activeTab === 'sql_setup' && (
              <div className="flex-1 p-6 overflow-y-auto bg-stone-50/30 space-y-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* Service Role Key Configuration Card */}
                  <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-stone-900">Supabase Service Role Key (Opcional - Recomendado)</h4>
                        <p className="text-xs text-stone-500">
                          Permite criar usuários no Supabase Auth instantaneamente com e-mail confirmado, sem precisar de confirmação por link.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Service Role Secret)"
                        value={serviceRoleKey}
                        onChange={(e) => setServiceRoleKey(e.target.value)}
                        className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:outline-hidden focus:border-stone-800"
                      />
                      <button
                        onClick={handleSaveServiceRoleKey}
                        className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
                      >
                        Salvar Chave Admin
                      </button>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-2">
                      Obtenha em: Supabase Dashboard &gt; Project Settings &gt; API &gt; <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-700 font-mono">service_role secret</code>.
                    </p>
                  </div>

                  {/* Non-Destructive SQL Setup Script */}
                  <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                        <Database className="w-4 h-4 text-amber-600" />
                        <span>Script SQL para Suporte a Vendas e Planos no Supabase</span>
                      </div>
                      <button
                        onClick={() => {
                          const sql = `-- ==========================================
-- NOTEBOOKLM PRO: ATUALIZAÇÃO PARA VENDAS E PLANOS
-- ==========================================

-- 1. Garante colunas de gestão de acessos na tabela public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS price_paid NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_whatsapp TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Define o administrador principal
UPDATE public.profiles 
SET role = 'admin', plan = 'lifetime', status = 'active'
WHERE email = 'leandroljs89@gmail.com';

-- 3. Políticas de RLS para Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seus próprios perfis" ON public.profiles;
CREATE POLICY "Usuários podem ver seus próprios perfis" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seus próprios perfis" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins podem gerenciar todos os perfis" ON public.profiles;
CREATE POLICY "Admins podem gerenciar todos os perfis" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'leandroljs89@gmail.com'
    )
  );`;
                          copyToClipboard(sql, 'sql_copy');
                        }}
                        className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedText === 'sql_copy' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>SQL Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar SQL para o Supabase</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-stone-500 mb-3 leading-relaxed">
                      Execute este script no <strong>Supabase SQL Editor</strong> para habilitar as colunas de planos, datas de expiração e permissões de administrador.
                    </p>

                    <pre className="p-3.5 bg-stone-900 text-stone-100 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed max-h-60">
{`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS price_paid NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_whatsapp TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes TEXT;`}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Modal */}
        {userToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-stone-200 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-stone-900 mb-1">Excluir Usuário?</h4>
              <p className="text-xs text-stone-600 mb-4 leading-relaxed">
                Tem certeza que deseja remover o usuário <strong>{userToDelete.full_name}</strong> ({userToDelete.email})? O acesso será revogado permanentemente.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteUser(userToDelete.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
