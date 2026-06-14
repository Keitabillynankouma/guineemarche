import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

// ── Sentry — monitoring frontend ──────────────────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,   // 'development' ou 'production'
    // Performance : tracer 10 % des pages en prod
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    // Intégrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Enregistrer 5 % des sessions normales, 100 % des sessions avec erreur
        sessionSampleRate: 0.05,
        errorSampleRate: 1.0,
        // Masquer les données sensibles
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Ignorer les erreurs réseau normales
    ignoreErrors: [
      'Network Error',
      'Request aborted',
      'ResizeObserver loop limit exceeded',
    ],
    // Ne pas envoyer d'infos personnelles
    sendDefaultPii: false,
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* ErrorBoundary global : capture les crashes React et les envoie à Sentry */}
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
            <div className="text-5xl mb-4">😔</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Une erreur est survenue</h1>
            <p className="text-gray-500 text-sm mb-6">
              L'équipe GuinéeMarché a été notifiée automatiquement. Essayez de recharger la page.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetError}
                className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition">
                Réessayer
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-gray-100 text-gray-700 px-5 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                Accueil
              </button>
            </div>
          </div>
        </div>
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
