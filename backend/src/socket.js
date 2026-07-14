import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { formatMessage, userInConversation } from './routes/conversations.js';

export function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on('join_conversation', async (conversationId) => {
      try {
        const conversation = await userInConversation(conversationId, socket.userId);
        if (!conversation) {
          socket.emit('error_message', { error: 'Conversation not found' });
          return;
        }
        socket.join(`conversation:${conversationId}`);
      } catch (err) {
        console.error(err);
        socket.emit('error_message', { error: 'Failed to join conversation' });
      }
    });

    socket.on('send_message', async ({ conversationId, content }) => {
      try {
        const text = content?.trim();
        if (!text) {
          socket.emit('error_message', { error: 'Message cannot be empty' });
          return;
        }
        if (text.length > 1000) {
          socket.emit('error_message', { error: 'Message is too long' });
          return;
        }

        const conversation = await userInConversation(conversationId, socket.userId);
        if (!conversation) {
          socket.emit('error_message', { error: 'Conversation not found' });
          return;
        }

        const insert = await query(
          `INSERT INTO messages (conversation_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, conversation_id, sender_id, content, created_at`,
          [conversationId, socket.userId, text]
        );

        const userResult = await query(
          'SELECT username FROM users WHERE id = $1',
          [socket.userId]
        );

        const message = formatMessage({
          ...insert.rows[0],
          username: userResult.rows[0].username,
        });

        io.to(`conversation:${conversationId}`).emit('new_message', message);

        const otherUserId =
          conversation.user_a === socket.userId
            ? conversation.user_b
            : conversation.user_a;

        io.to(`user:${otherUserId}`).emit('conversation_updated', {
          conversationId: Number(conversationId),
          message,
        });
      } catch (err) {
        console.error(err);
        socket.emit('error_message', { error: 'Failed to send message' });
      }
    });
  });

  return io;
}
