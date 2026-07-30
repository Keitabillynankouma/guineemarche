/**
 * Patch expo-modules-core pour compatibilité Gradle 8.x
 * Bug : `components.release` supprimé en Gradle 8.1+
 * Fix : `components.findByName("release")`
 * Tourne automatiquement via `postinstall` dans package.json
 */
const fs   = require('fs')
const path = require('path')

const target = path.join(
  __dirname,
  '../node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle'
)

if (!fs.existsSync(target)) {
  console.log('[patch-gradle] fichier non trouvé, skip.')
  process.exit(0)
}

let content = fs.readFileSync(target, 'utf8')

if (content.includes('from components.release')) {
  content = content.replace(
    /from components\.release/g,
    'from components.findByName("release")'
  )
  fs.writeFileSync(target, content)
  console.log('[patch-gradle] ✓ ExpoModulesCorePlugin.gradle patché (Gradle 8.x compat)')
} else {
  console.log('[patch-gradle] déjà patché ou version différente, rien à faire.')
}
