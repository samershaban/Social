import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import BusinessForm from '../components/BusinessForm';

export default function PostBusiness() {
  const navigate = useNavigate();

  async function handleCreate(body) {
    const business = await api.createBusiness(body);
    navigate(`/businesses/${business.id}`);
  }

  return (
    <div className="post-business-page">
      <h1>Post a Business</h1>
      <BusinessForm onSubmit={handleCreate} />
    </div>
  );
}
