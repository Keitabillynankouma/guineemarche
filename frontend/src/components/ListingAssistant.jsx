/**
 * ListingAssistant — Chatbot contextuel sur la page d'une annonce
 * Utilise POST /api/v1/listings/assistant/
 * Connaît l'annonce, le prix, le vendeur et peut conseiller l'acheteur
 */
import { useState, useRef, useEffect } from 'react'
import api from '../services/api'

const GREETINGS = [
  '👋 Bonjour ! Je connais cette annonce. Demandez-moi si le prix est correct, comment négocier, ou si vous avez des doutes.',
  '👋 Salut ! Je suis là pour vous aider sur cette annonce. Prix correct ? Comment négocier ? Demandez-moi !',
]

export default function ListingAssistant({ listingId, listingTitle, listingPrice }) {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Initialiser le message de bienvenue à l'ouverture
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
      setMessages([{ role: 'assistant', content: greeting }])
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const msg = input.trim()
    if (!msg || loading) return

    const history = messages.slice(1) // exclure le message de bienvenue
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setInput('')
    setLoading(true)

    try {
      const { data } = await api.post('/listings/assistant/', {
        message: msg,
        history,
        listing_id: listingId,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      const errMsg = err?.response?.status === 429
        ? 'Trop de questions envoyées. Attendez quelques minutes.'
        : 'Erreur de connexion. Contactez le vendeur directement via la messagerie.'
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const quickQuestions = [
    'Le prix est-il correct ?',
    'Comment négocier ?',
    'À quoi faire attention ?',
    'C\'est une arnaque possible ?',
  ]

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Widget ouvert */}
      {open && (
        <div className="mb-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
             style={{ maxHeight: '480px' }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 flex justify-between items-center">
            <div>
              <div className="text-white font-semibold text-sm flex items-center gap-2">
                <span>✨</span> Assistant IA
              </div>
              {listingTitle && (
                <div className="text-emerald-100 text-xs truncate max-w-[200px]">{listingTitle}</div>
              )}
            </div>
            <button onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-xl leading-none transition">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '280px' }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-500 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}/>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Questions rapides */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1">
              {quickQuestions.map((q, i) => (
                <button key={i}
                  onClick={() => { setInput(q); setTimeout(send, 0) }}
                  className="text-xs px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full transition">
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Posez votre question…"
              disabled={loading}
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-emerald-400 transition bg-gray-50"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="p-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 text-white rounded-xl transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl"
        title="Assistant IA - poser une question sur cette annonce"
      >
        {open ? '✕' : '✨'}
      </button>
    </div>
  )
}
