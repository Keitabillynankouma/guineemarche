/**
 * Firebase Cloud Messaging — Service Worker
 *
 * Ce fichier doit être à la racine du site (servi depuis /firebase-messaging-sw.js).
 * Il gère les notifications push reçues quand l'application est en arrière-plan ou fermée.
 *
 * Configuration requise :
 *   Les variables VITE_FIREBASE_* ne sont PAS accessibles dans un service worker
 *   (il tourne hors du contexte Vite). Il faut les injecter via un fichier de config
 *   séparé OU les mettre en dur ici (acceptable pour des données publiques Firebase).
 *
 *   Remplacez les valeurs ci-dessous par votre vraie config Firebase :
 *   Firebase Console → Paramètres du projet → Vos applications → Config
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// ── Config Firebase (valeurs publiques — pas des secrets) ────────────────────
// À remplacer par votre vraie config :
const FIREBASE_CONFIG = {
  apiKey:            self.__FIREBASE_API_KEY__      || '',
  authDomain:        self.__FIREBASE_AUTH_DOMAIN__  || '',
  projectId:         self.__FIREBASE_PROJECT_ID__   || '',
  storageBucket:     self.__FIREBASE_STORAGE_BUCKET__ || '',
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || '',
  appId:             self.__FIREBASE_APP_ID__       || '',
}

// N'initialiser que si la config est présente
if (FIREBASE_CONFIG.projectId) {
  firebase.initializeApp(FIREBASE_CONFIG)
  const messaging = firebase.messaging()

  // Notification reçue en arrière-plan
  messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification || {}
    const data = payload.data || {}

    self.registration.showNotification(title || 'Guimatrix', {
      body:  body  || '',
      icon:  icon  || '/favicon.ico',
      badge: '/favicon.ico',
      tag:   data.notif_id || 'guimatrix-notif',
      data:  data,
    })
  })

  // Clic sur la notification → ouvre l'app
  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const data = event.notification.data || {}
    const url  = data.order_id
      ? `/orders`
      : data.listing_id
        ? `/listings/${data.listing_id}`
        : '/'

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        if (clients.openWindow) return clients.openWindow(url)
      })
    )
  })
}
