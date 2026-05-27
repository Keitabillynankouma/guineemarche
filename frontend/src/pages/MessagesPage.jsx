import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { messagingAPI } from '../services/api'

export default function MessagesPage() {
    const [activeConv, setActiveConv] = useState(null)
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)

    const { data: conversations, isLoading } = useQuery({
        queryKey: ['conversations'],
        queryFn: () => messagingAPI.getConversations().then(r => r.data),
    })

    const { data: messages, refetch: refetchMessages } = useQuery({
        queryKey: ['messages', activeConv?.id],
        queryFn: () => messagingAPI.getMessages(activeConv.id).then(r => r.data),
        enabled: !!activeConv,
    })

    const handleSend = async (e) => {
        e.preventDefault()
        if (!message.trim()) return
        setSending(true)
        try {
            await messagingAPI.sendMessage(activeConv.id, { content: message })
            setMessage('')
            refetchMessages()
        } catch { }
        finally { setSending(false) }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="text-green-700 font-bold text-lg">GuinéeMarché</Link>
                    <Link to="/profile" className="text-gray-500 text-sm hover:text-green-600">👤 Profil</Link>
                </div>
            </nav>

            <div className="max-w-5xl mx-auto px-4 py-6">
                <div className="bg-white rounded-2xl shadow overflow-hidden flex h-[600px]">

                    {/* Liste conversations */}
                    <div className="w-80 border-r flex flex-col">
                        <div className="p-4 border-b">
                            <h2 className="font-bold text-gray-800">Messages</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="p-4 space-y-3">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                                    ))}
                                </div>
                            ) : conversations?.results?.length === 0 ? (
                                <div className="p-6 text-center text-gray-400">
                                    <p className="text-3xl mb-2">💬</p>
                                    <p className="text-sm">Aucune conversation</p>
                                </div>
                            ) : (
                                conversations?.results?.map(conv => (
                                    <button
                                        key={conv.id}
                                        onClick={() => setActiveConv(conv)}
                                        className={`w-full p-4 text-left border-b hover:bg-gray-50 transition ${activeConv?.id === conv.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                                                👤
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-800 truncate text-sm">
                                                    {conv.other_user?.full_name}
                                                </p>
                                                <p className="text-xs text-gray-400 truncate">{conv.listing_title}</p>
                                                {conv.last_message && (
                                                    <p className="text-xs text-gray-500 truncate mt-1">
                                                        {conv.last_message.content}
                                                    </p>
                                                )}
                                            </div>
                                            {conv.unread_count > 0 && (
                                                <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Zone messages */}
                    <div className="flex-1 flex flex-col">
                        {!activeConv ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <p className="text-5xl mb-3">💬</p>
                                    <p>Sélectionnez une conversation</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Header conversation */}
                                <div className="p-4 border-b flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">👤</div>
                                    <div>
                                        <p className="font-medium text-gray-800">{activeConv.other_user?.full_name}</p>
                                        <p className="text-xs text-gray-400 truncate">{activeConv.listing_title}</p>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {messages?.results?.map(msg => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.sender === activeConv.buyer ? 'justify-start' : 'justify-end'}`}
                                        >
                                            <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${msg.sender === activeConv.buyer
                                                    ? 'bg-gray-100 text-gray-800'
                                                    : 'bg-green-600 text-white'
                                                }`}>
                                                {msg.content}
                                                {msg.offer_amount_gnf && (
                                                    <p className="font-bold mt-1">
                                                        💰 {new Intl.NumberFormat('fr-GN').format(msg.offer_amount_gnf)} GNF
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Input message */}
                                <form onSubmit={handleSend} className="p-4 border-t flex gap-3">
                                    <input
                                        type="text"
                                        placeholder="Écrire un message..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sending || !message.trim()}
                                        className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {sending ? '...' : 'Envoyer'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}