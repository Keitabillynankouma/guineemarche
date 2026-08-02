import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { authAPI } from '../services/api'

/**
 * useNotifications
 * - Demande la permission push
 * - Obtient le token Expo + envoie au backend via /auth/fcm-token/
 * - Écoute les notifications reçues en avant-plan
 * - Écoute les taps sur notification (navigation si besoin)
 *
 * @param {object}   params
 * @param {boolean}  params.enabled        - activer seulement si l'utilisateur est connecté
 * @param {function} params.onNotification - callback(notification) quand une notif arrive
 * @param {function} params.onResponse     - callback(response) quand l'user tape une notif
 */
export default function useNotifications({ enabled = true, onNotification, onResponse } = {}) {
    const notifListener = useRef(null)
    const respListener  = useRef(null)

    useEffect(() => {
        if (!enabled) return

        let cancelled = false

        // Configurer le comportement d'affichage des notifications
        try {
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge:  true,
                }),
            })
        } catch (e) {
            console.warn('[useNotifications] setNotificationHandler failed:', e)
            return // Si le module n'est pas disponible, on abandonne
        }

        const register = async () => {
            // Uniquement sur un vrai appareil (simulateur/émulateur ne supporte pas push)
            if (!Device.isDevice) return

            // Demande permission
            const { status: existing } = await Notifications.getPermissionsAsync()
            let finalStatus = existing
            if (existing !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync()
                finalStatus = status
            }
            if (finalStatus !== 'granted') return

            // Canal Android obligatoire
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name:               'Notifications Guimatrix',
                    importance:         Notifications.AndroidImportance.MAX,
                    vibrationPattern:   [0, 250, 250, 250],
                    lightColor:         '#16a34a',
                    sound:              'default',
                })
            }

            // Récupère le token push Expo (projet ID dans app.json)
            try {
                const { data: token } = await Notifications.getExpoPushTokenAsync()
                if (cancelled) return
                // Envoi au backend
                await authAPI.registerFcmToken(token)
            } catch (err) {
                // Silencieux — l'app fonctionne sans push si ça échoue
                console.warn('[useNotifications] Impossible d\'obtenir le token push :', err)
            }
        }

        register()

        // Listener : notification reçue pendant que l'app est ouverte
        notifListener.current = Notifications.addNotificationReceivedListener(notification => {
            onNotification?.(notification)
        })

        // Listener : l'utilisateur a tapé sur une notification
        respListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            onResponse?.(response)
        })

        return () => {
            cancelled = true
            if (notifListener.current) Notifications.removeNotificationSubscription(notifListener.current)
            if (respListener.current)  Notifications.removeNotificationSubscription(respListener.current)
        }
    }, [enabled])
}
