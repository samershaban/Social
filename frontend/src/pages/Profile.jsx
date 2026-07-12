import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [bio, setBio] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState([]);
  const [error, setError] = useState('');

  const isOwnProfile = !id || (user && Number(id) === user.id);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = isOwnProfile && user ? await api.getMyProfile() : await api.getUserProfile(id);
        setProfile(data);
        setBio(data.bio || '');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
    async function loadFollowers() {
      try {
        const data = user? await api.getFollowers(user.id): [];
        setFollowers(data);
        // console.log(data);
      } catch (err) {
        setError(err.message);
      } finally {
        // setLoading(false);
      }
    }
    loadFollowers();
  }, [id, user, isOwnProfile]);

  async function handleSaveBio() {
    try {
      const updated = await api.updateBio(bio);
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleFollow(profile) {
    await api.follow(profile.id);
    setFollowers((prev) => [...prev, profile.id]);
  }

  async function handleUnFollow(profile) {
    await api.unfollow(profile.id);
    setFollowers((prev) => prev.filter((id) => id !== profile.id));
  }

  async function handleDelete(postId) {
    await api.deletePost(postId);
    setProfile((prev) => ({
      ...prev,
      posts: prev.posts.filter((p) => p.id !== postId),
      postCount: prev.postCount - 1,
    }));
  }

  if (loading) return <p className="loading">Loading profile...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!profile) return <p className="error">User not found</p>;

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>@{profile.username}</h1>
        <p className="profile-meta">{profile.postCount} posts</p>
        {isOwnProfile ? (
          editing ? (
            <div className="bio-edit">
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Write a bio..." />
              <div className="bio-actions">
                <button type="button" onClick={handleSaveBio}>Save</button>
                <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setBio(profile.bio); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="bio-display">
              <p>{profile.bio || 'No bio yet.'}</p>
              <button type="button" className="btn-sm" onClick={() => setEditing(true)}>Edit bio</button>
            </div>
          )
        ) : (<>
          {followers && profile && !followers.includes(profile.id)?<>
            <button type="button" className="btn-sm" onClick={() =>handleFollow(profile)}>Follow</button>
          </>: <>
          <button type="button" className="btn-sm" onClick={() =>handleUnFollow(profile)}>Unfollow</button>
          </>}</>
        )}
      </header>

      <h2>Posts</h2>
      {profile.posts.length === 0 ? (
        <p className="empty">No posts yet.</p>
      ) : (
        <div className="post-list">
          {profile.posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
