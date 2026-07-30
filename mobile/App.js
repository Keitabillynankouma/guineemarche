import React, { useCallback } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import AppNavigator from './src/navigation/AppNavigator'
import useNotifications from './src/hooks/useNotifications'
import useAuthStore from './src/store/authStore'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 30_000,
        },
    },
})

// Composant interne qui a accès au store (QueryClientProvider doit être au-dessus)
function AppWithNotifications() {
    const { isAuthenticated } = useAuthStore()

    // Brancher les notifications uniquement si l'utilisateur est connecté
    useNotifications({
        enabled: isAuthenticated,
        onResponse: useCallback((response) => {
            // À enrichir selon la structure de vos notifications
            // Ex : { data: { type: 'order', id: '...' } }
            const data = response?.notification?.request?.content?.data
            if (data?.type && data?.id) {
                console.log('[Push] Tap sur notification :', data)
                // Note : la navigation globale nécessite une ref sur navigationRef
                // — implémentée dans AppNavigator via navigationRef si besoin.
            }
        }, []),
    })

    return <AppNavigator />
}

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
                <StatusBar style="light" />
                <AppWithNotifications />
            </QueryClientProvider>
        </GestureHandlerRootView>
    )
}
