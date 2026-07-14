import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Chat() {
  const { userId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (!userId) {
      async function loadInbox() {
        try {
          const data = await api.getConversations();
          setConversations(data);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }
      loadInbox();
      return;
    }

    if (Number(userId) === user.id) {
      setError('Cannot chat with yourself');
      setLoading(false);
      return;
    }

    async function openChat() {
      try {
        const conversation = await api.createConversation(Number(userId));
        setConversationId(conversation.id);
        setOtherUser(conversation.otherUser);

        const data = await api.getMessages(conversation.id);
        setMessages(data.messages);
        setOtherUser(data.otherUser);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    openChat();
  }, [user, userId]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit('join_conversation', conversationId);

    function onMessage(message) {
      if (Number(message.conversationId) !== Number(conversationId)) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    }

    function onError(payload) {
      setError(payload?.error || 'Chat error');
    }

    socket.on('new_message', onMessage);
    socket.on('error_message', onError);

    return () => {
      socket.off('new_message', onMessage);
      socket.off('error_message', onError);
    };
  }, [socket, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!socket || !conversationId || !text.trim() || sending) return;

    setSending(true);
    setError('');
    socket.emit('send_message', {
      conversationId,
      content: text.trim(),
    });
    setText('');
    setSending(false);
  }

  if (!user) return <p className="error">Please log in to chat.</p>;
  if (loading) return <p className="loading">Loading chat...</p>;
  if (error && !conversationId && userId) return <p className="error">{error}</p>;

  if (!userId) {
    return (
      <div className="chat-page">
        <h1>Messages</h1>
        {error && <p className="error">{error}</p>}
        {conversations.length === 0 ? (
          <p className="empty">
            No conversations yet. Find someone on{' '}
            <Link to="/search">Search</Link> and open their profile to start chatting.
          </p>
        ) : (
          <div className="conversation-list">
            {conversations.map((c) => (
              <Link key={c.id} to={`/chat/${c.otherUser.id}`} className="conversation-item">
                <strong>@{c.otherUser.username}</strong>
                <span className="conversation-preview">
                  {c.lastMessage || 'No messages yet'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <Link to="/chat" className="chat-back">← Messages</Link>
        <h1>
          <Link to={`/users/${otherUser?.id}`}>@{otherUser?.username}</Link>
        </h1>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="chat-messages">
        {messages.length === 0 ? (
          <p className="empty">Say hello to start the conversation.</p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === user.id;
            return (
              <div
                key={message.id}
                className={`chat-bubble ${mine ? 'chat-bubble-mine' : 'chat-bubble-theirs'}`}
              >
                {!mine && (
                  <span className="chat-sender">@{message.sender?.username}</span>
                )}
                <p>{message.content}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-compose" onSubmit={handleSend}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          disabled={!socket}
        />
        <button type="submit" disabled={!socket || !text.trim() || sending}>
          Send
        </button>
      </form>
    </div>
  );
}
