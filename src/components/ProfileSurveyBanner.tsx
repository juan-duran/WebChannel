const SURVEY_URL = 'https://forms.office.com/r/7hCVThSNZB';

export function ProfileSurveyBanner() {
  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
      <p className="text-sm font-semibold text-blue-900">Ajude a melhorar o Quenty</p>
      <p className="text-xs text-blue-800">
        Responda uma pesquisa rápida sobre sua experiência. Seu feedback ajuda a construir um produto melhor para todos.
      </p>
      <div className="mt-2">
        <a
          href={SURVEY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Abrir pesquisa (30s)
        </a>
      </div>
    </div>
  );
}
