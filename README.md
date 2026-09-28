# SocialApp

A basic social media app with a React + Vite frontend and an Express/Node backend backed by PostgreSQL.

## Features

- User registration and login (JWT auth)
- Create and view posts in a feed
- User profiles with editable bio
- Delete your own posts
- Browse events and search them by keyword, date, venue or performer
- Post events you organize, then edit or delete your own

## Project Structure

```
App/
├── frontend/          # React + Vite
├── backend/           # Express API
└── docker-compose.yml # PostgreSQL 15
```

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)

## Setup

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Start the backend

```bash
cd backend
npm install
npm run dev
```

The API runs at `http://localhost:3001`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Environment Variables

Create `backend/.env` (a default is included):

```
PORT=3001
JWT_SECRET=dev-secret-change-in-production
DATABASE_URL=postgresql://socialapp:socialapp@localhost:5432/socialapp
```

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/posts` | No | Get feed |
| POST | `/api/posts` | Yes | Create post |
| DELETE | `/api/posts/:id` | Yes | Delete own post |
| GET | `/api/users/me` | Yes | Get own profile |
| PUT | `/api/users/me` | Yes | Update bio |
| GET | `/api/users/:id` | No | Get public profile |
| GET | `/api/followers` | No | Get followers from a logged in user  |
| GET | `/api/events` | No | List/search events (`q`, `date`, `venue`, `performer`, `limit`) |
| GET | `/api/events/:id` | No | Get one event |
| POST | `/api/events` | Yes | Create an event |
| PUT | `/api/events/:id` | Yes | Update own event |
| DELETE | `/api/events/:id` | Yes | Delete own event |
| GET | `/api/venues` | No | List venues |
| GET | `/api/performers` | No | List performers |

### Event search

`GET /api/events` is both the list and the search endpoint. Every filter is optional and they
combine with AND, so `?q=swift&venue=o2` means both. `q` is a Postgres full-text search over the
event title, performer, venue and description, ranked so title matches come first. With no `date`
given, only upcoming events are returned.

Event times are stored and displayed as a UTC-pinned wall clock: the time an organizer enters is
the time every viewer sees, and the time `?date=` matches, with no timezone shifting.

Venues and performers are reference data, created implicitly when an event first names one and
matched case-insensitively thereafter. They are intentionally read-only over HTTP: there is no
admin role to decide who may rename a shared venue.
