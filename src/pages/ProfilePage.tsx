import { User as UserIcon, LogOut, Mail, Calendar, BellRing, BellOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentUser } from '../state/UserContext';
import { enableNotifications, disableNotifications } from '../lib/pushNotifications';
import { ProfileSurveyBanner } from '../components/ProfileSurveyBanner';

export function ProfilePage() {
  const { user: authUser } = useAuth();
  const user = useCurrentUser();

  const handleLogout = () => {
    window.location.href = '/logout';
  };

  const handleEnablePush = async () => {
    try {
      await enableNotifications();
      alert('Notificações ativadas!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível ativar notificações.';
      alert(message);
    }
  };

  const handleDisablePush = async () => {
    try {
      await disableNotifications();
      alert('Notificações desativadas.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível desativar notificações.';
      alert(message);
    }
  };

  const createdDate = authUser?.created_at ? new Date(authUser.created_at) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Perfil</h2>
        <p className="text-text-secondary">Gerencie sua conta</p>
      </div>

      <div className="space-y-6">
        <ProfileSurveyBanner />

        <div className="bg-dark-secondary rounded-xl shadow-sm border border-border-primary p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent-hover rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
              <UserIcon className="w-8 h-8 text-dark-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text-primary mb-1">Informações da conta</h3>
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-text-muted" />
                  <p className="text-text-secondary text-sm">{user.email}</p>
                </div>
                {createdDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-text-muted" />
                    <p className="text-text-secondary text-sm">
                      Joined {createdDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleEnablePush}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-dark-primary shadow-sm transition hover:bg-accent-hover"
                >
                  <BellRing className="w-4 h-4" />
                  Ativar notificações
                </button>
                <button
                  type="button"
                  onClick={handleDisablePush}
                  className="inline-flex items-center gap-2 rounded-lg border border-border-primary bg-dark-tertiary px-4 py-2 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-dark-elevated"
                >
                  <BellOff className="w-4 h-4" />
                  Desativar notificações
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-dark-secondary rounded-xl shadow-sm border border-border-primary p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Sobre o Quenty AI</h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              O Quenty AI é um agente de inteligência artificial que transforma os debates mais quentes da internet em
              clareza, sem polarização. Em vez de te jogar em mais um feed infinito, ele vasculha redes sociais e
              portais, identifica o que realmente está pegando fogo e entrega resumos personalizados no seu WhatsApp,
              guiados pelos 3 pilares de consciência artificial: quem você é, no que você acredita e o ambiente ao seu
              redor. Assim, você recebe notícias com profundidade, várias perspectivas e zero ruído — simples,
              confiável e feito sob medida para a sua realidade.
            </p>
            <p className="pt-2 text-text-secondary">
              <span className="font-medium text-text-primary">Versão:</span>{' '}
              {import.meta.env.VITE_APP_VERSION || 'indisponível'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
