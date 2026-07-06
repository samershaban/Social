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

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getPosts: () => request('/posts'),
  createPost: (content) => request('/posts', { method: 'POST', body: JSON.stringify({ content }) }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
  getMyProfile: () => request('/users/me'),
  getUserProfile: (id) => request(`/users/${id}`),
  updateBio: (bio) => request('/users/me', { method: 'PUT', body: JSON.stringify({ bio }) }),
};
