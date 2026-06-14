import { useState, useRef, useEffect } from 'react'

const GREETING = 'Bonjour ! Je suis l\'assistant de GuinéeMarché. Comment puis-je vous aider ? 😊'

export default function SupportChatWidget({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING }
  ])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function sendMessage() {
    const msg = input.trim()
    if (!msg || loading) return

    // Historique sans le message de bienvenue initial
    const history = messages.slice(1)
    const next = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/v1/core/support-chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      })
      const data = await res.json()
      const reply = data.reply || 'Désolé, une erreur est survenue. Contactez-nous sur WhatsApp.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erreur de connexion. Réessayez ou contactez-nous sur WhatsApp au +224622411238.'
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div
      className="fixed bottom-24 right-4 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100"
      style={{ width: '320px', height: '440px' }}
    >
      {/* ── Header ── */}
      <div className="bg-green-600 text-white rounded-t-2xl px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">🤖</div>
          <div>
            <p className="text-sm font-semibold leading-tight">Assistant GuinéeMarché</p>
            <p className="text-xs opacity-75">Disponible 24h/24</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition text-white"
          aria-label="Fermer">
          ✕
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-green-600 text-white rounded-2xl rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <span className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggestions rapides (seulement au début) ── */}
      {messages.length === 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1 shrink-0">
          {['Comment créer une annonce ?', 'Comment payer ?', 'Mon compte est bloqué'].map(q => (
            <button
              key={q}
              onClick={() => { setInput(q); inputRef.current?.focus() }}
              className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-1 hover:bg-green-100 transition">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div className="p-3 border-t border-gray-100 flex gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Écrivez votre question..."
          maxLength={1000}
          disabled={loading}
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-xl w-10 flex items-center justify-center transition active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
