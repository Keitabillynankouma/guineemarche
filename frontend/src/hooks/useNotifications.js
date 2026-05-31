import { useEffect, useRef, useCallback } from 'react'
import useAuthStore from '../store/authStore'

const WS_BASE = import.meta.env.VITE_WS_URL
    ? import.meta.env.VITE_WS_URL
    : (window.location.protocol === 'https:' ? 'wss' : 'ws') + '://' + window.location.host

/**
 * useNotifications(onMessage)
 * Se connecte au WebSocket de notifications et appelle onMessage(data) à chaque notif.
 * Se reconnecte automatiquement toutes les 3s si la connexion tombe.
 */
export default function useNotifications(onMessage) {
    const token   = useAuthStore((s) => s.token)
    const wsRef   = useRef(null)
    const retryRef = useRef(null)

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
