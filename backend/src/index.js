import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { setupSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import usersRoutes from './routes/users.js';
import followersRoutes from './routes/followers.js';
import conversationsRoutes from './routes/conversations.js';
import businessesRoutes, { reviewsRouter } from './routes/businesses.js';
import eventsRoutes, { venuesRouter, performersRouter, ticketsRouter } from './routes/events.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

setupSocket(server);

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/followers', followersRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/businesses', businessesRoutes);
app.use('/api/reviews', reviewsRouter);
app.use('/api/events', eventsRoutes);
app.use('/api/venues', venuesRouter);
app.use('/api/performers', performersRouter);
app.use('/api/tickets', ticketsRouter);

async function start() {
  try {
    await initDb();
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
