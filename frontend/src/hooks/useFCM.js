/**
 * Hook useFCM — Enregistrement des push notifications Firebase.
 *
 * Utilisation dans un composant racine (ex: App.jsx) une fois l'user connecté :
 *   import useFCM from './hooks/useFCM'
 *   useFCM()
 *
 * Variables Vite requises (.env) :
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_STORAGE_BUCKET
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 *   VITE_FIREBASE_VAPID_KEY   (clé publique VAPID — Firebase Console → Cloud Messaging)
 */
import { useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { authAPI } from '../services/api'

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '',
}

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

let _messaging = null

async function getMessaging() {
  if (_messaging) return _messaging
  if (!FIREBASE_CONFIG.projectId) return null

  try {
    const { initializeApp, getApps } = await import('firebase/app')
    const { getMessaging: _getMsg, getToken, onMessage } = await import('firebase/messaging')

    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
    _messaging = _getMsg(app)
    return _messaging
  } catch (e) {
    console.warn('[FCM] Firebase non disponible :', e.message)
    return null
  }
}

export default function useFCM() {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) return
    if (!FIREBASE_CONFIG.projectId || !VAPID_KEY) return

    let cancelled = false

    async function register() {
      // Demander la permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.info('[FCM] Permission refusée par l\'utilisateur.')
        return
      }

      // Enregistrer le service worker
      let swReg
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      } catch (e) {
        console.warn('[FCM] Service worker non enregistré :', e.message)
        return
      }

      const messaging = await getMessaging()
      if (!messaging || cancelled) return

      try {
        const { getToken, onMessage } = await import('firebase/messaging')

        // Obtenir le token FCM
        const token = await getToken(messaging, {
          vapidKey:        VAPID_KEY,
          serviceWorkerRegistration: swReg,
        })

        if (token) {
          // Envoyer le token au backend
          await authAPI.registerFCMToken(token)
          console.info('[FCM] Token enregistré.')
        }

        // Notifications reçues quand l'app est ouverte (foreground)
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {}
          if (title && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' })
          }
        })
      } catch (e) {
        console.warn('[FCM] Erreur d\'enregistrement :', e.message)
      }
    }

    register()
    return () => { cancelled = true }
  }, [isAuthenticated])
}
