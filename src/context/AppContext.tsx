import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ref, onValue, set, get, remove, onDisconnect } from 'firebase/database';
import { database } from '../firebase/config';
import { User, MatchRequest, Match, Message } from '../types';

interface AppContextType {
  userId: string;
  nickname: string;
  setNickname: (nickname: string) => void;
  enterMatchmaking: () => Promise<void>;
  exitMatchmaking: () => Promise<void>;
  currentMatch: Match | null;
  matchStatus: 'idle' | 'searching' | 'found' | 'chatting';
  acceptMatch: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  messages: Message[];
  leaveChat: () => Promise<void>;
  reportUser: (reason: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId] = useState<string>(() => {
    const storedId = localStorage.getItem('userId');
    if (storedId) return storedId;
    const newId = uuidv4();
    localStorage.setItem('userId', newId);
    return newId;
  });
  
  const [nickname, setNicknameState] = useState<string>(localStorage.getItem('nickname') || '');
  const [matchStatus, setMatchStatus] = useState<'idle' | 'searching' | 'found' | 'chatting'>('idle');
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Set nickname and store in localStorage
  const setNickname = (name: string) => {
    setNicknameState(name);
    localStorage.setItem('nickname', name);
  };

  // Set up user online status
  useEffect(() => {
    if (!nickname) return;

    const userRef = ref(database, `users/${userId}`);
    const user: User = {
      id: userId,
      nickname,
      createdAt: Date.now(),
      lastActive: Date.now(),
      status: 'online'
    };

    // Set user data and handle disconnection
    set(userRef, user);
    onDisconnect(userRef).update({ status: 'offline', lastActive: Date.now() });

    // Listen for matches
    const matchesRef = ref(database, 'matches');
    const unsubscribeMatches = onValue(matchesRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const matches = snapshot.val();
      const userMatches = Object.values<Match>(matches).filter(
        (match) => match.users.includes(userId) && match.status !== 'ended'
      );

      if (userMatches.length > 0) {
        const match = userMatches[0];
        setCurrentMatch(match);
        
        if (match.status === 'pending') {
          setMatchStatus('found');
        } else if (match.status === 'active') {
          setMatchStatus('chatting');
        }
      } else if (matchStatus !== 'idle' && matchStatus !== 'searching') {
        setMatchStatus('idle');
        setCurrentMatch(null);
      }
    });

    return () => {
      unsubscribeMatches();
    };
  }, [userId, nickname, matchStatus]);

  // Listen for messages when in a chat
  useEffect(() => {
    if (!currentMatch || currentMatch.status !== 'active') {
      setMessages([]);
      return;
    }

    const messagesRef = ref(database, `messages/${currentMatch.id}`);
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setMessages([]);
        return;
      }
      
      const messagesData = snapshot.val();
      const messagesList = Object.values<Message>(messagesData);
      setMessages(messagesList.sort((a, b) => a.createdAt - b.createdAt));
    });

    return () => {
      unsubscribeMessages();
    };
  }, [currentMatch]);

  // Enter matchmaking queue
  const enterMatchmaking = async () => {
    if (!nickname) return;
    
    setMatchStatus('searching');
    
    // Update user status
    const userRef = ref(database, `users/${userId}`);
    await set(userRef, {
      id: userId,
      nickname,
      createdAt: Date.now(),
      lastActive: Date.now(),
      status: 'matching'
    });
    
    // Add to matchmaking queue
    const matchRequestRef = ref(database, `matchRequests/${userId}`);
    const matchRequest: MatchRequest = {
      id: userId,
      userId,
      nickname,
      createdAt: Date.now()
    };
    await set(matchRequestRef, matchRequest);
  };

  // Exit matchmaking queue
  const exitMatchmaking = async () => {
    if (matchStatus !== 'searching') return;
    
    setMatchStatus('idle');
    
    // Remove from matchmaking queue
    const matchRequestRef = ref(database, `matchRequests/${userId}`);
    await remove(matchRequestRef);
    
    // Update user status
    const userRef = ref(database, `users/${userId}`);
    await set(userRef, {
      id: userId,
      nickname,
      createdAt: Date.now(),
      lastActive: Date.now(),
      status: 'online'
    });
  };

  // Accept a match
  const acceptMatch = async () => {
    if (!currentMatch) return;
    
    const matchRef = ref(database, `matches/${currentMatch.id}`);
    const snapshot = await get(matchRef);
    
    if (!snapshot.exists()) return;
    
    const match = snapshot.val() as Match;
    
    // Add user to accepted list
    if (!match.acceptedBy.includes(userId)) {
      const updatedAcceptedBy = [...match.acceptedBy, userId];
      
      // If both users accepted
      if (updatedAcceptedBy.length === 2) {
        await set(matchRef, {
          ...match,
          acceptedBy: updatedAcceptedBy,
          status: 'active'
        });
        
        // Update users' status
        for (const uid of match.users) {
          const userRef = ref(database, `users/${uid}`);
          await set(userRef, {
            id: uid,
            nickname: match.userNicknames[uid],
            lastActive: Date.now(),
            status: 'chatting'
          });
        }
      } else {
        await set(matchRef, {
          ...match,
          acceptedBy: updatedAcceptedBy
        });
      }
    }
  };

  // Send a message
  const sendMessage = async (text: string) => {
    if (!currentMatch || !text.trim()) return;
    
    const messageId = uuidv4();
    const messagesRef = ref(database, `messages/${currentMatch.id}/${messageId}`);
    
    const message: Message = {
      id: messageId,
      matchId: currentMatch.id,
      senderId: userId,
      senderNickname: nickname,
      text: text.trim(),
      createdAt: Date.now()
    };
    
    await set(messagesRef, message);
  };

  // Leave the chat
  const leaveChat = async () => {
    if (!currentMatch) return;
    
    // Mark match as ended
    const matchRef = ref(database, `matches/${currentMatch.id}`);
    await set(matchRef, {
      ...currentMatch,
      status: 'ended'
    });
    
    // Update user status
    const userRef = ref(database, `users/${userId}`);
    await set(userRef, {
      id: userId,
      nickname,
      lastActive: Date.now(),
      status: 'online'
    });
    
    setCurrentMatch(null);
    setMatchStatus('idle');
    setMessages([]);
  };

  // Report a user
  const reportUser = async (reason: string) => {
    if (!currentMatch) return;
    
    const reportId = uuidv4();
    const reportedUserId = currentMatch.users.find(id => id !== userId);
    
    if (!reportedUserId) return;
    
    const reportRef = ref(database, `reports/${reportId}`);
    const report: Report = {
      id: reportId,
      reporterId: userId,
      reporterNickname: nickname,
      reportedId: reportedUserId,
      reportedNickname: currentMatch.userNicknames[reportedUserId],
      matchId: currentMatch.id,
      reason,
      createdAt: Date.now()
    };
    
    await set(reportRef, report);
  };

  return (
    <AppContext.Provider
      value={{
        userId,
        nickname,
        setNickname,
        enterMatchmaking,
        exitMatchmaking,
        currentMatch,
        matchStatus,
        acceptMatch,
        sendMessage,
        messages,
        leaveChat,
        reportUser
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};