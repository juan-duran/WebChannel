import { MessageSquare } from 'lucide-react';

const SURVEY_URL = 'https://forms.office.com/r/7hCVThSNZB';

export function ProfileSurveyBanner() {
  return (
    <div className="mb-4 p-4 bg-white border-[3px] border-black shadow-brutal">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-brutal-cyan border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000000]">
          <MessageSquare className="w-5 h-5 text-black" />
        </div>
        <div className="flex-1">
          <p className="font-mono font-bold text-black uppercase tracking-wide text-sm">
            Ajude a melhorar o Quenty
          </p>
          <p className="text-xs text-gray-700 mt-1">
            Responda uma pesquisa rápida sobre sua experiência. Seu feedback ajuda a construir um produto melhor para todos.
          </p>
          <div className="mt-3">
            <a
              href={SURVEY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black border-2 border-black text-white text-xs font-mono font-bold uppercase shadow-[3px_3px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              Abrir pesquisa (30s)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
