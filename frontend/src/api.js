import axios from 'axios';

const TOKEN_KEY = 'token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export const api = {
  register: (body) => client.post('/auth/register', body),
  login: (body) => client.post('/auth/login', body),
  getPosts: () => client.get('/posts'),
  getPostsById: (id) => client.get(`/posts/${id}`),
  createPost: (content) => client.post('/posts', { content }),
  deletePost: (id) => client.delete(`/posts/${id}`),
  getMyProfile: () => client.get('/users/me'),
  getUserProfile: (id) => client.get(`/users/${id}`),
  updateBio: (bio) => client.put('/users/me', { bio }),
  getFollowers: (id) => client.get(`/followers/${id}/following`),
  follow: (id) => client.put(`/followers/follow/${id}`),
  unfollow: (id) => client.delete(`/followers/follow/${id}`),
  searchUsers: (q, lmt) => client.get(`/users/search?q=${q}&limit=${lmt}`),
  getConversations: () => client.get('/conversations'),
  createConversation: (userId) => client.post('/conversations', { userId }),
  getMessages: (conversationId) => client.get(`/conversations/${conversationId}/messages`),
  getBusinesses: () => client.get('/businesses'),
  searchBusinesses: (q) => client.get(`/businesses/search?q=${encodeURIComponent(q)}`),
  getBusiness: (id) => client.get(`/businesses/${id}`),
  createBusiness: (body) => client.post('/businesses', body),
  updateBusiness: (id, body) => client.put(`/businesses/${id}`, body),
  deleteBusiness: (id) => client.delete(`/businesses/${id}`),
  getReviews: (businessId) => client.get(`/businesses/${businessId}/reviews`),
  createReview: (businessId, body) => client.post(`/businesses/${businessId}/reviews`, body),
  updateReview: (id, body) => client.put(`/reviews/${id}`, body),
  deleteReview: (id) => client.delete(`/reviews/${id}`),
  // Empty filters are dropped so `?date=&venue=` never reaches the server as blank values
  // that would read as real filters.
  getEvents: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const search = params.toString();
    return client.get(search ? `/events?${search}` : '/events');
  },
  getEvent: (id) => client.get(`/events/${id}`),
  createEvent: (body) => client.post('/events', body),
  updateEvent: (id, body) => client.put(`/events/${id}`, body),
  deleteEvent: (id) => client.delete(`/events/${id}`),
  getVenues: () => client.get('/venues'),
  getPerformers: () => client.get('/performers'),
  getMyTickets: (eventId) => client.get(`/events/${eventId}/tickets`),
  reserveTickets: (eventId, quantity) => client.post(`/events/${eventId}/tickets`, { quantity }),
  releaseTicket: (ticketId) => client.delete(`/tickets/${ticketId}`),
};
