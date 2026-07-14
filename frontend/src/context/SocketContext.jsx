import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      return;
    }

    const token = getToken();
    if (!token) return;

    const s = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
