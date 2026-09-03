import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import PostForm from '../components/PostForm';

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadFollowers() {
    try {
      const data = await api.getFollowers(user.id);
      setFollowers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (followers.length === 0) return;

    async function loadFollowedPosts() {
      try {
        const results = await Promise.all(
          followers.map((id) => api.getPostsById(id))
        );
        setPosts(results.flat());
        console.log(results.flat());
      } catch (err) {
        setError(err.message);
      }
    }

    loadFollowedPosts();
    console.log('Followers use effect');
  }, [followers]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadFollowers();
    console.log('User use effect');
  }, [user]);

  async function handleCreate(content) {
    const post = await api.createPost(content);
    setPosts((prev) => [post, ...prev]);
  }

  async function handleDelete(id) {
    await api.deletePost(id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) return <p className="loading">Loading feed...</p>;

  return (
    <div className="feed-page">
      <h1>Feed</h1>
      {user && <PostForm onSubmit={handleCreate} />}
      {error && <p className="error">{error}</p>}
      {posts.length === 0 ? (
        <p className="empty">No posts yet. Be the first to post!</p>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
