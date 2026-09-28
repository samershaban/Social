import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import Feed from './pages/Feed';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Users from './pages/Users';
import Chat from './pages/Chat';
import Businesses from './pages/Businesses';
import PostBusiness from './pages/PostBusiness';
import BusinessDetail from './pages/BusinessDetail';
import Events from './pages/Events';
import PostEvent from './pages/PostEvent';
import EventDetail from './pages/EventDetail';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SocketProvider>
          <Navbar />
          <main className="container">
            <Routes>
              <Route path="/" element={<Feed />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/users/:id" element={<Profile />} />
              <Route path="/search" element={<Users />} />
              <Route path="/businesses" element={<Businesses />} />
              <Route path="/businesses/new" element={<PostBusiness />} />
              <Route path="/businesses/:id" element={<BusinessDetail />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/new" element={<PostEvent />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/:userId" element={<Chat />} />
            </Routes>
          </main>
        </SocketProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
