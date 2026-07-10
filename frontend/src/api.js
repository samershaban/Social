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
};
