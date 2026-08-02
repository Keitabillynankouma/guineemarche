import { registerRootComponent } from 'expo'
import App from './App'

// Capturer les erreurs JS fatales (hors React tree) et les logger
if (global.ErrorUtils) {
    const orig = global.ErrorUtils.getGlobalHandler()
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        console.error('[FATAL]', isFatal ? 'FATAL' : 'non-fatal', error?.message, error?.stack)
        if (orig) orig(error, isFatal)
    })
}

// registerRootComponent appelle AppRegistry.registerComponent('main', () => App)
// et s'assure que l'environnement Expo est correctement initialisé.
registerRootComponent(App)
