import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { messagingAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import Logo from '../components/Logo'

// Messages rapides — acheteur
const QUICK_MSGS_BUYER = [
  'Bonjour, est-ce disponible ?',
  'Quel est votre dernier prix ?',
  'Je suis intéressé(e), on peut se retrouver où ?',
  'Pouvez-vous envoyer plus de photos ?',
  'Je viens d\'Hamdallaye, ça vous convient ?',
  'C\'est toujours en vente ?',
  'Merci, je vous contacterai bientôt.',
]

// Messages rapides — vendeur
const QUICK_MSGS_SELLER = [
  'Oui, l\'article est disponible !',
  'Je suis disponible pour la remise aujourd\'hui.',
  'On peut se retrouver au marché central, ça vous convient ?',
  'Quel quartier êtes-vous ? Je peux me déplacer.',
  'Le prix est ferme, pas de négociation.',
  'Envoyez-moi votre numéro WhatsApp pour coordonner.',
  'Merci pour votre achat ! Passez une bonne journée.',
]

function timeLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffH = diffMs / 3600000
  if (diffH < 24) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function MessagesPage() {
  const qc = useQueryClient()
  const location = useLocation()
  const { user: currentUser } = useAuthStore()
  // Sur mobile : null = liste visible. Sur desktop : les deux sont visibles.
  const [activeConv, setActiveConv]       = useState(null)
  const [showChat, setShowChat]           = useState(false)   // mobile: affiche le chat
  const [message, setMessage]             = useState('')
  const [sending, setSending]             = useState(false)
  const [showQuick, setShowQuick]         = useState(false)
  const [showOffer, setShowOffer]         = useState(false)
  const [offerAmount, setOfferAmount]     = useState('')
  const [autoOpenId, setAutoOpenId]       = useState(location.state?.conversationId || null)
  const bottomRef                         = useRef(null)

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagingAPI.getConversations().then(r => r.data),
    refetchInterval: 8000,
  })

  // Auto-ouvrir la conversation si navigué depuis une notification
  useEffect(() => {
    if (!autoOpenId || !conversations) return
    const list = conversations?.results ?? conversations ?? []
    const target = list.find(c => c.id === autoOpenId)
    if (target) {
      openConv(target)
      setAutoOpenId(null)
    }
  }, [autoOpenId, conversations]) // eslint-disable-line

  const { data: msgs, refetch: refetchMsgs } = useQuery({
    queryKey: ['messages', activeConv?.id],
    queryFn: () => messagingAPI.getMessages(activeConv.id).then(r => r.data),
    enabled: !!activeConv,
    refetchInterval: 5000,
  })

  const messages = Array.isArray(msgs) ? msgs : (msgs?.results ?? [])

  // Scroll vers le bas à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function openConv(conv) {
    setActiveConv(conv)
    setShowChat(true)   // sur mobile, bascule vers le chat
    setShowQuick(false)
  }

  function backToList() {
    setShowChat(false)
    setActiveConv(null)
  }

  const handleSend = async (text) => {
    const content = (text ?? message).trim()
    if (!content || !activeConv) return
    setSending(true)
    setShowQuick(false)
    try {
      await messagingAPI.sendMessage(activeConv.id, { content })
      setMessage('')
      refetchMsgs()
      qc.invalidateQueries(['conversations'])
    } catch {}
    finally { setSending(false) }
  }

  const handleSendOffer = async () => {
    const amount = parseInt(offerAmount.replace(/\s/g, ''), 10)
    if (!amount || amount <= 0 || !activeConv) return
    setSending(true)
    try {
      await messagingAPI.sendMessage(activeConv.id, {
        content: `💰 Je propose ${new Intl.NumberFormat('fr-GN').format(amount)} GNF`,
        msg_type: 'offer',
        offer_amount_gnf: amount,
      })
      setOfferAmount('')
      setShowOffer(false)
      refetchMsgs()
      qc.invalidateQueries(['conversations'])
    } catch {}
    finally { setSending(false) }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ─── Sidebar (liste conversations) ────────────────────────────────────────
  const ConvList = (
    <div className={`
      flex flex-col bg-white border-r
      ${showChat ? 'hidden md:flex' : 'flex'}
      w-full md:w-80 md:flex-shrink-0
    `}>
      <div className="p-4 border-b flex items-center gap-3">
        <Link to="/" className="text-green-700 text-lg md:hidden">←</Link>
        <h2 className="font-bold text-gray-800 text-base">💬 Messages</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !conversations?.results?.length ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">Aucune conversation</p>
            <Link to="/" className="mt-4 inline-block text-green-600 text-sm font-medium">
              Parcourir les annonces →
            </Link>
          </div>
        ) : (
          conversations.results.map(conv => (
            <button
              key={conv.id}
              onClick={() => openConv(conv)}
              className={`w-full p-4 text-left border-b hover:bg-gray-50 transition-colors
                ${activeConv?.id === conv.id ? 'bg-green-50 border-l-4 border-l-green-500' : 'border-l-4 border-l-transparent'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center text-lg flex-shrink-0 font-bold text-green-700">
                  {conv.other_user?.full_name?.[0] ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-800 text-sm truncate">{conv.other_user?.full_name}</p>
                    {conv.last_message && (
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                        {timeLabel(conv.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{conv.listing_title}</p>
                  {conv.last_message && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{conv.last_message.content}</p>
                  )}
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-green-600 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 flex-shrink-0">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )

  // ─── Zone chat ────────────────────────────────────────────────────────────
  const ChatArea = (
    <div className={`
      flex-1 flex flex-col bg-gray-50
      ${!showChat ? 'hidden md:flex' : 'flex'}
    `}>
      {!activeConv ? (
        // État vide desktop
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <p className="text-6xl mb-4">💬</p>
            <p className="font-medium">Sélectionnez une conversation</p>
            <p className="text-sm mt-1">Ou commencez depuis une annonce</p>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="bg-white border-b p-3 flex items-center gap-3">
            {/* Bouton retour mobile */}
            <button
              onClick={backToList}
              className="md:hidden text-green-700 font-bold text-xl w-8"
            >←</button>
            <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center font-bold text-green-700">
              {activeConv.other_user?.full_name?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm">{activeConv.other_user?.full_name}</p>
              <p className="text-xs text-gray-400 truncate">📦 {activeConv.listing_title}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-8">
                Commencez la conversation !
              </div>
            )}
            {messages.map((msg) => {
              const isFromOther = msg.sender === activeConv.other_user?.id
              const isOffer = msg.msg_type === 'offer' && msg.offer_amount_gnf
              // Message de confirmation de paiement — style centré spécial
              const isPaymentMsg = msg.content?.startsWith('✅ Paiement confirmé')
              if (isPaymentMsg) {
                return (
                  <div key={msg.id} className="flex justify-center my-3">
                    <div className="max-w-[85%] bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-center shadow-sm">
                      <p className="text-sm font-semibold text-emerald-700 whitespace-pre-line leading-relaxed">
                        {msg.content}
                      </p>
                      <p className="text-xs text-emerald-400 mt-1">{timeLabel(msg.created_at)}</p>
                    </div>
                  </div>
                )
              }
              return (
                <div key={msg.id} className={`flex ${isFromOther ? 'justify-start' : 'justify-end'}`}>
                  {isOffer ? (
                    /* Bulle spéciale pour les offres de prix */
                    <div className={`max-w-[80%] rounded-2xl shadow-sm overflow-hidden border-2 ${isFromOther ? 'border-amber-200 rounded-tl-none' : 'border-green-300 rounded-tr-none'}`}>
                      <div className={`px-4 py-2 text-xs font-bold ${isFromOther ? 'bg-amber-50 text-amber-700' : 'bg-green-600 text-white'}`}>
                        💰 OFFRE DE PRIX
                      </div>
                      <div className={`px-4 py-3 ${isFromOther ? 'bg-white' : 'bg-green-50'}`}>
                        <p className={`text-xl font-bold ${isFromOther ? 'text-gray-800' : 'text-green-700'}`}>
                          {new Intl.NumberFormat('fr-GN').format(msg.offer_amount_gnf)} GNF
                        </p>
                        <p className={`text-xs mt-1 ${isFromOther ? 'text-gray-400' : 'text-gray-500'}`}>
                          {timeLabel(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className={`
                      max-w-[75%] px-4 py-2.5 rounded-2xl text-sm
                      ${isFromOther
                        ? 'bg-white text-gray-800 rounded-tl-none shadow-sm border border-gray-100'
                        : 'bg-gradient-to-br from-green-600 to-green-700 text-white rounded-tr-none shadow-md'}
                    `}>
                      {msg.content}
                      <p className={`text-xs mt-1 ${isFromOther ? 'text-gray-400' : 'text-green-100'}`}>
                        {timeLabel(msg.created_at)}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Messages rapides */}
          {showQuick && (
            <div className="bg-white border-t px-4 py-3">
              <p className="text-xs text-gray-500 mb-2 font-medium">Messages rapides :</p>
              <div className="flex flex-wrap gap-2">
                {(activeConv && String(activeConv.seller) === String(currentUser?.id)
                  ? QUICK_MSGS_SELLER
                  : QUICK_MSGS_BUYER
                ).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-full transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Panneau offre de prix */}
          {showOffer && (
            <div className="bg-amber-50 border-t border-amber-200 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-2">💰 Proposer un prix</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Montant en GNF"
                  value={offerAmount}
                  onChange={e => setOfferAmount(e.target.value)}
                  className="flex-1 border border-amber-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSendOffer() } }}
                />
                <button onClick={handleSendOffer} disabled={sending || !offerAmount}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-sm transition disabled:opacity-50">
                  Envoyer
                </button>
                <button onClick={() => { setShowOffer(false); setOfferAmount('') }}
                  className="px-3 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm hover:bg-gray-200 transition">
                  ✕
                </button>
              </div>
              <p className="text-xs text-amber-500 mt-1">Le destinataire verra votre offre et pourra l'accepter ou contre-proposer.</p>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend() }}
            className="bg-white border-t border-gray-100 p-3 flex items-end gap-2"
          >
            <button
              type="button"
              onClick={() => { setShowQuick(v => !v); setShowOffer(false) }}
              className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-lg transition
                ${showQuick ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              title="Messages rapides"
            >⚡</button>
            <button
              type="button"
              onClick={() => { setShowOffer(v => !v); setShowQuick(false) }}
              className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-lg transition
                ${showOffer ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              title="Proposer un prix"
            >💰</button>
            <textarea
              rows={1}
              placeholder="Écrire un message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKey}
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400 max-h-28"
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="w-10 h-10 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-full flex items-center justify-center text-lg transition active:scale-95 flex-shrink-0"
            >
              {sending ? '…' : '➤'}
            </button>
          </form>
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Nav desktop uniquement (mobile : bouton retour dans la liste/header) */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 hidden md:block">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo back />
          <Link to="/profile" className="text-gray-500 text-sm hover:text-green-600 transition">👤 Profil</Link>
        </div>
      </nav>

      {/* Container principal — plein écran mobile */}
      <div className="flex-1 flex md:max-w-5xl md:mx-auto md:w-full md:px-4 md:py-6">
        <div className="flex flex-1 md:rounded-2xl md:shadow-card overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
          {ConvList}
          {ChatArea}
        </div>
      </div>
    </div>
  )
}
