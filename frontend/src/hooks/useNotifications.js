import { useEffect, useRef, useCallback } from 'react'
import useAuthStore from '../store/authStore'

const WS_BASE = import.meta.env.VITE_WS_URL
    ? import.meta.env.VITE_WS_URL
    : (window.location.protocol === 'https:' ? 'wss' : 'ws') + '://' + window.location.host

// ── Push notifications via l'API Notifications du navigateur ─────────────────
async function requestPushPermission() {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied')  return false
    const result = await Notification.requestPermission()
    return result === 'granted'
}

function showPushNotification(data) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const title = data.title || 'Guimatrix'
    const body  = data.body  || ''
    const icon  = '/icon-192.png'

    // Préférer le service worker pour les notifs (apparaissent même app en arrière-plan)
    if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
                body, icon,
                badge: icon,
                data:  data.data || {},
                vibrate: [100, 50, 100],
            })
        }).catch(() => {
            new Notification(title, { body, icon })
        })
    } else {
        new Notification(title, { body, icon })
    }
}

/**
 * useNotifications(onMessage)
 * Se connecte au WebSocket de notifications et appelle onMessage(data) à chaque notif.
 * Affiche aussi une notification push si l'app est en arrière-plan.
 * Se reconnecte automatiquement toutes les 3s si la connexion tombe.
 */
export default function useNotifications(onMessage) {
    const token   = useAuthStore((s) => s.token)
    const wsRef   = useRef(null)
    const retryRef = useRef(null)

    // Demander permission au chargement (une seule fois)
    useEffect(() => {
        if (token) requestPushPermission()
    }, [token])

    const connect = useCallback(() => {
        if (!token) return
        if (wsRef.current?.readyState === WebSocket.OPEN) return

        const url = `${WS_BASE}/ws/notifications/?token=${token}`
        const ws  = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            clearTimeout(retryRef.current)
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.type !== 'connected' && data.type !== 'pong') {
                    onMessage?.(data)
                    // Afficher push si la page est cachée (arrière-plan / autre onglet)
                    if (document.hidden) {
                        showPushNotification(data)
                    }
                }
            } catch (_) {}
        }

        ws.onclose = () => {
            retryRef.current = setTimeout(connect, 3000)
        }

        ws.onerror = () => {
            ws.close()
        }
    }, [token, onMessage])

    useEffect(() => {
        connect()
        return () => {
            clearTimeout(retryRef.current)
            wsRef.current?.close()
        }
    }, [connect])
}
