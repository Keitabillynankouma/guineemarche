import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text } from 'react-native'
import useAuthStore from '../store/authStore'
import { colors, font } from '../theme'

// Screens
import LoginScreen        from '../screens/LoginScreen'
import RegisterScreen     from '../screens/RegisterScreen'
import HomeScreen         from '../screens/HomeScreen'
import ListingDetailScreen from '../screens/ListingDetailScreen'
import MessagesScreen     from '../screens/MessagesScreen'
import OrdersScreen       from '../screens/OrdersScreen'
import ProfileScreen      from '../screens/ProfileScreen'

const Stack = createStackNavigator()
const Tab   = createBottomTabNavigator()

// ── Auth stack ────────────────────────────────────────────────────────────────
function AuthStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
    )
}

// ── Tab icon helper ───────────────────────────────────────────────────────────
function TabIcon({ emoji, focused }) {
    return (
        <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    )
}

// ── Bottom tabs ───────────────────────────────────────────────────────────────
function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor:   colors.primary,
                tabBarInactiveTintColor: '#9ca3af',
                tabBarStyle: {
                    backgroundColor: '#fff',
                    borderTopColor: '#e5e7eb',
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 4,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: font.semi,
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarLabel: 'Accueil',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{
                    tabBarLabel: 'Messages',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
                }}
            />
            <Tab.Screen
                name="Orders"
                component={OrdersScreen}
                options={{
                    tabBarLabel: 'Commandes',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} />,
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarLabel: 'Profil',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
                }}
            />
        </Tab.Navigator>
    )
}

// ── Root stack (inclut le detail d'annonce au-dessus des tabs) ────────────────
function RootStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
                name="ListingDetail"
                component={ListingDetailScreen}
                options={{
                    title: 'Annonce',
                    headerStyle:     { backgroundColor: colors.primary },
                    headerTintColor: '#fff',
                    headerTitleStyle:{ fontWeight: font.bold },
                    headerBackTitle: ' ',
                }}
            />
        </Stack.Navigator>
    )
}

// ── AppNavigator ──────────────────────────────────────────────────────────────
export default function AppNavigator() {
    const { isAuthenticated, restoreSession } = useAuthStore()

    useEffect(() => {
        restoreSession()
    }, [])

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {isAuthenticated ? (
                    <Stack.Screen name="App" component={RootStack} />
                ) : (
                    <Stack.Screen name="Auth" component={AuthStack} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    )
}
