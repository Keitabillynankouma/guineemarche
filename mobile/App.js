import React, { useCallback } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { Text, ScrollView, StyleSheet } from 'react-native'
import AppNavigator from './src/navigation/AppNavigator'
import useNotifications from './src/hooks/useNotifications'
import useAuthStore from './src/store/authStore'

// ── ErrorBoundary — affiche l'erreur au lieu de crasher ──────────────────────
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { error: null, stack: null }
    }
    static getDerivedStateFromError(error) {
        return { error }
    }
    componentDidCatch(error, info) {
        this.setState({ stack: info?.componentStack })
        console.error('[CRASH]', error, info)
    }
    render() {
        if (this.state.error) {
            return (
                <ScrollView style={errStyles.bg}>
                    <Text style={errStyles.title}>❌ Erreur de démarrage</Text>
                    <Text style={errStyles.msg}>{String(this.state.error)}</Text>
                    {this.state.stack && (
                        <Text style={errStyles.stack}>{this.state.stack}</Text>
                    )}
                </ScrollView>
            )
        }
        return this.props.children
    }
}
const errStyles = StyleSheet.create({
    bg:    { flex: 1, backgroundColor: '#1a1a2e', padding: 20, paddingTop: 60 },
    title: { color: '#ff4757', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
    msg:   { color: '#fff', fontSize: 13, fontFamily: 'monospace', marginBottom: 16 },
    stack: { color: '#aaa', fontSize: 10, fontFamily: 'monospace' },
})

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
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <QueryClientProvider client={queryClient}>
                    <StatusBar style="light" />
                    <AppWithNotifications />
                </QueryClientProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    )
}
