import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();
  const isOwner = user?.id === post.author.id;

  return (
    <article className="post-card">
      <header className="post-header">
        <Link to={`/users/${post.author.id}`} className="post-author">
          @{post.author.username}
        </Link>
        <time dateTime={post.createdAt}>
          {new Date(post.createdAt).toLocaleString()}
        </time>
      </header>
      <p className="post-content">{post.content}</p>
      {isOwner && (
        <button type="button" className="btn-danger btn-sm" onClick={() => onDelete(post.id)}>
          Delete
        </button>
      )}
    </article>
  );
}
