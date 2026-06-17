import { useState, useEffect } from 'react'

export function useDarkMode() {
    const [dark, setDark] = useState(() => {
        const saved = localStorage.getItem('gm_dark_mode')
        if (saved !== null) return saved === 'true'
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    })

    useEffect(() => {
        const root = document.documentElement
        if (dark) {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
        localStorage.setItem('gm_dark_mode', String(dark))
    }, [dark])

    return [dark, () => setDark(d => !d)]
}
