import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import useAuthStore from '../store/authStore'
import { colors, font } from '../theme'

// ── Auth ──────────────────────────────────────────────────────────────────────
import LoginScreen          from '../screens/LoginScreen'
import RegisterScreen       from '../screens/RegisterScreen'

// ── Tabs ──────────────────────────────────────────────────────────────────────
import HomeScreen           from '../screens/HomeScreen'
import MessagesScreen       from '../screens/MessagesScreen'
import OrdersScreen         from '../screens/OrdersScreen'
import ProfileScreen        from '../screens/ProfileScreen'

// ── Écrans full-screen ────────────────────────────────────────────────────────
import ListingDetailScreen  from '../screens/ListingDetailScreen'
import CreateListingScreen  from '../screens/CreateListingScreen'
import PaymentScreen        from '../screens/PaymentScreen'
import LivreurDashboardScreen from '../screens/LivreurDashboardScreen'
import SellerEarningsScreen   from '../screens/SellerEarningsScreen'
import MyListingsScreen       from '../screens/MyListingsScreen'

const Stack = createStackNavigator()
const Tab   = createBottomTabNavigator()

// ── Auth stack ─────────────────────────────────────────────────────────────────
function AuthStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
    )
}

// ── Tab icon ───────────────────────────────────────────────────────────────────
function TabIcon({ emoji, focused }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
}

// ── Bottom tabs ────────────────────────────────────────────────────────────────
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

// ── Options d'en-tête standard ─────────────────────────────────────────────────
const stdHeader = (title) => ({
    title,
    headerStyle:      { backgroundColor: colors.primary },
    headerTintColor:  '#fff',
    headerTitleStyle: { fontWeight: font.bold },
    headerBackTitle:  ' ',
})

// ── Root stack ─────────────────────────────────────────────────────────────────
function RootStack() {
    return (
        <Stack.Navigator>
            {/* Tabs */}
            <Stack.Screen
                name="Main"
                component={MainTabs}
                options={{ headerShown: false }}
            />

            {/* Détail annonce */}
            <Stack.Screen
                name="ListingDetail"
                component={ListingDetailScreen}
                options={stdHeader('Annonce')}
            />

            {/* Créer une annonce */}
            <Stack.Screen
                name="CreateListing"
                component={CreateListingScreen}
                options={{ headerShown: false }}  // écran gère son propre header
            />

            {/* Paiement */}
            <Stack.Screen
                name="Payment"
                component={PaymentScreen}
                options={{ headerShown: false }}  // écran gère son propre header
            />

            {/* Dashboard livreur */}
            <Stack.Screen
                name="LivreurDashboard"
                component={LivreurDashboardScreen}
                options={{ headerShown: false }}
            />

            {/* Gains vendeur */}
            <Stack.Screen
                name="SellerEarnings"
                component={SellerEarningsScreen}
                options={{ headerShown: false }}
            />

            {/* Mes annonces */}
            <Stack.Screen
                name="MyListings"
                component={MyListingsScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    )
}

// ── AppNavigator ───────────────────────────────────────────────────────────────
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
