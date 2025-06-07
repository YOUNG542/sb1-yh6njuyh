import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ref, onValue, set, get, remove, onDisconnect, runTransaction, serverTimestamp } from 'firebase/database';
import { database } from '../firebase/config';
import { User, MatchRequest, Match, Message, Report } from '../types';
import { auth } from '../firebase/config';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

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
  rejectMatch: () => Promise<void>;
  rejectedUserIds: Record<string, number>;
  addRejectedUser: (id: string) => void; 
  forceEndMatch: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUserId, setFirebaseUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [nickname, setNicknameState] = useState<string>(localStorage.getItem('nickname') || '');
  const [matchStatus, setMatchStatus] = useState<'idle' | 'searching' | 'found' | 'chatting'>('idle');
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rejectedUserIds, setRejectedUserIds] = useState<Record<string, number>>({});
  const rejectedUserIdsRef = useRef<Record<string, number>>({});
  const matchingLockRef = useRef<boolean>(false);
  const lastMatchAttemptRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUserId(user.uid);
      } else {
        const result = await signInAnonymously(auth);
        setFirebaseUserId(result.user.uid);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    rejectedUserIdsRef.current = rejectedUserIds;
  }, [rejectedUserIds]);

  const addRejectedUser = (userId: string) => {
    setRejectedUserIds((prev) => ({
      ...prev,
      [userId]: Date.now()
    }));
  };
  
  const setNickname = (name: string) => {
    setNicknameState(name);
    localStorage.setItem('nickname', name);
  };

  const userId = firebaseUserId || '';

  // Set up user online status with proper cleanup
  useEffect(() => {
    if (!nickname || !userId) return;

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
    
    // Enhanced disconnect handling
    onDisconnect(userRef).update({ 
      status: 'offline', 
      lastActive: serverTimestamp(),
      matchingLocked: false // Release any locks on disconnect
    });

    // Clean up match request on disconnect
    const matchRequestRef = ref(database, `matchRequests/${userId}`);
    onDisconnect(matchRequestRef).remove();

    // Listen for matches with improved error handling
    const matchesRef = ref(database, 'matches');
    const unsubscribeMatches = onValue(matchesRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      try {
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
      } catch (error) {
        console.error('Error processing matches:', error);
      }
    }, (error) => {
      console.error('Error listening to matches:', error);
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
      
      try {
        const messagesData = snapshot.val();
        const messagesList = Object.values<Message>(messagesData);
        setMessages(messagesList.sort((a, b) => a.createdAt - b.createdAt));
      } catch (error) {
        console.error('Error processing messages:', error);
        setMessages([]);
      }
    }, (error) => {
      console.error('Error listening to messages:', error);
    });

    return () => {
      unsubscribeMessages();
    };
  }, [currentMatch]);

  // Improved matchmaking logic with proper locking
  useEffect(() => {
    if (matchStatus !== 'searching' || matchingLockRef.current) return;

    const matchRequestsRef = ref(database, 'matchRequests');
    
    const handleMatchmaking = async () => {
      // Prevent concurrent matching attempts
      if (matchingLockRef.current) return;
      
      const now = Date.now();
      // Throttle matching attempts to prevent flooding
      if (now - lastMatchAttemptRef.current < 2000) return;
      
      lastMatchAttemptRef.current = now;
      matchingLockRef.current = true;

      try {
        // Use transaction to safely check and create matches
        await runTransaction(matchRequestsRef, (currentRequests) => {
          if (!currentRequests) return currentRequests;

          const requestList = Object.values<MatchRequest>(currentRequests);
          
          // Filter out current user and apply rejection logic
          const availableRequests = requestList.filter(req => {
            if (req.userId === userId) return false;
            if (req.matched) return false; // Skip already matched users
            
            // Check rejection logic (simplified for transaction)
            return true;
          });

          if (availableRequests.length < 2) {
            return currentRequests; // Not enough users to match
          }

          // Find the current user's request
          const myRequest = requestList.find(req => req.userId === userId);
          if (!myRequest || myRequest.matched) {
            return currentRequests; // User not in queue or already matched
          }

          // Select another user for matching
          const otherRequest = availableRequests.find(req => req.userId !== userId);
          if (!otherRequest) {
            return currentRequests;
          }

          // Mark both users as matched in the transaction
          const updatedRequests = { ...currentRequests };
          updatedRequests[userId] = { ...myRequest, matched: true, matchedAt: serverTimestamp() };
          updatedRequests[otherRequest.userId] = { ...otherRequest, matched: true, matchedAt: serverTimestamp() };

          return updatedRequests;
        });

        // After successful transaction, create the match
        const snapshot = await get(matchRequestsRef);
        if (snapshot.exists()) {
          const requests = snapshot.val();
          const myRequest = requests[userId];
          
          if (myRequest && myRequest.matched) {
            // Find the other matched user
            const otherMatchedRequest = Object.values<MatchRequest>(requests).find(
              req => req.userId !== userId && req.matched && req.matchedAt === myRequest.matchedAt
            );

            if (otherMatchedRequest) {
              await createMatch(myRequest, otherMatchedRequest);
            }
          }
        }
      } catch (error) {
        console.error('Error in matchmaking transaction:', error);
      } finally {
        matchingLockRef.current = false;
      }
    };

    const unsubscribe = onValue(matchRequestsRef, () => {
      handleMatchmaking().catch(console.error);
    }, (error) => {
      console.error('Error listening to match requests:', error);
      matchingLockRef.current = false;
    });

    return () => {
      unsubscribe();
      matchingLockRef.current = false;
    };
  }, [matchStatus, userId]);

  const createMatch = async (req1: MatchRequest, req2: MatchRequest) => {
    try {
      // Double-check rejections before creating match
      const rejectionsSnap = await get(ref(database, 'rejections'));
      const allRejections = rejectionsSnap.exists() ? rejectionsSnap.val() : {};
      
      const now = Date.now();
      const rejectedByReq1 = allRejections[req1.userId]?.[req2.userId];
      const rejectedByReq2 = allRejections[req2.userId]?.[req1.userId];
      
      if (
        (rejectedByReq1 && now - rejectedByReq1 < 60000) ||
        (rejectedByReq2 && now - rejectedByReq2 < 60000)
      ) {
        // Clean up matched flags and return
        await remove(ref(database, `matchRequests/${req1.userId}`));
        await remove(ref(database, `matchRequests/${req2.userId}`));
        return;
      }

      const matchId = uuidv4();
      const newMatch: Match = {
        id: matchId,
        users: [req1.userId, req2.userId],
        userNicknames: {
          [req1.userId]: req1.nickname,
          [req2.userId]: req2.nickname
        },
        acceptedBy: [],
        status: 'pending',
        createdAt: Date.now()
      };

      // Create match and clean up requests atomically
      await set(ref(database, `matches/${matchId}`), newMatch);
      await remove(ref(database, `matchRequests/${req1.userId}`));
      await remove(ref(database, `matchRequests/${req2.userId}`));
      
    } catch (error) {
      console.error('Error creating match:', error);
      // Clean up on error
      await remove(ref(database, `matchRequests/${req1.userId}`));
      await remove(ref(database, `matchRequests/${req2.userId}`));
    }
  };

  const enterMatchmaking = async () => {
    if (!nickname || matchingLockRef.current) return;
    
    try {
      setMatchStatus('searching');
      matchingLockRef.current = false; // Reset lock for new search
      
      // Update user status
      const userRef = ref(database, `users/${userId}`);
      await set(userRef, {
        id: userId,
        nickname,
        createdAt: Date.now(),
        lastActive: Date.now(),
        status: 'matching',
        matchingLocked: false
      });
      
      // Add to matchmaking queue with enhanced data
      const matchRequestRef = ref(database, `matchRequests/${userId}`);
      const matchRequest: MatchRequest = {
        id: userId,
        userId,
        nickname,
        createdAt: Date.now(),
        matched: false,
        lastActive: Date.now()
      };
      await set(matchRequestRef, matchRequest);
      
      // Set up disconnect cleanup
      onDisconnect(matchRequestRef).remove();
      
    } catch (error) {
      console.error('Error entering matchmaking:', error);
      setMatchStatus('idle');
    }
  };

  const exitMatchmaking = async () => {
    if (matchStatus !== 'searching') return;
    
    try {
      setMatchStatus('idle');
      matchingLockRef.current = false;
      
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
        status: 'online',
        matchingLocked: false
      });
    } catch (error) {
      console.error('Error exiting matchmaking:', error);
    }
  };

  const acceptMatch = async () => {
    if (!currentMatch) return;
    
    try {
      const matchRef = ref(database, `matches/${currentMatch.id}`);
      
      await runTransaction(matchRef, (currentMatch) => {
        if (!currentMatch) return currentMatch;
        
        const acceptedBy = Array.isArray(currentMatch.acceptedBy) ? currentMatch.acceptedBy : [];
        
        if (!acceptedBy.includes(userId)) {
          const updatedAcceptedBy = [...acceptedBy, userId];
          
          return {
            ...currentMatch,
            acceptedBy: updatedAcceptedBy,
            status: updatedAcceptedBy.length === 2 ? 'active' : 'pending'
          };
        }
        
        return currentMatch;
      });
      
      // Update user status if match is now active
      const updatedMatchSnap = await get(matchRef);
      if (updatedMatchSnap.exists()) {
        const updatedMatch = updatedMatchSnap.val();
        if (updatedMatch.status === 'active') {
          const userRef = ref(database, `users/${userId}`);
          await set(userRef, {
            id: userId,
            nickname,
            lastActive: Date.now(),
            status: 'chatting'
          });
        }
      }
    } catch (error) {
      console.error('Error accepting match:', error);
    }
  };

  const sendMessage = async (text: string) => {
    if (!currentMatch || !text.trim()) return;
    
    try {
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
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const forceEndMatch = async () => {
    if (!currentMatch) return;
  
    try {
      // Mark match as ended
      const matchRef = ref(database, `matches/${currentMatch.id}`);
      await set(matchRef, {
        ...currentMatch,
        status: 'ended',
        endedAt: Date.now()
      });
  
      // Update user status
      const userRef = ref(database, `users/${userId}`);
      await set(userRef, {
        id: userId,
        nickname,
        lastActive: Date.now(),
        status: 'online'
      });
  
      // Reset state
      setCurrentMatch(null);
      setMatchStatus('idle');
      setMessages([]);
    } catch (error) {
      console.error('Error force ending match:', error);
    }
  };

  const leaveChat = async () => {
    if (!currentMatch) return;
    
    try {
      // Mark match as ended
      const matchRef = ref(database, `matches/${currentMatch.id}`);
      await set(matchRef, {
        ...currentMatch,
        status: 'ended',
        endedAt: Date.now()
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
    } catch (error) {
      console.error('Error leaving chat:', error);
    }
  };

  const reportUser = async (reason: string) => {
    if (!currentMatch) return;
    
    try {
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
    } catch (error) {
      console.error('Error reporting user:', error);
    }
  };

  const rejectMatch = async () => {
    if (!currentMatch) return;
  
    try {
      const otherUserId = currentMatch.users.find(id => id !== userId);
  
      if (otherUserId) {
        const now = Date.now();
        // Record rejection
        await set(ref(database, `rejections/${userId}/${otherUserId}`), now);
      }
  
      // End the match
      const matchRef = ref(database, `matches/${currentMatch.id}`);
      await set(matchRef, {
        ...currentMatch,
        status: 'ended',
        rejectedBy: userId,
        endedAt: Date.now()
      });
  
      // Reset state
      setCurrentMatch(null);
      setMatchStatus('idle');
      setMessages([]);
  
      // Restart matchmaking after a brief delay
      setTimeout(() => {
        enterMatchmaking();
      }, 1000);
    } catch (error) {
      console.error('Error rejecting match:', error);
    }
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
        reportUser,
        rejectMatch,
        rejectedUserIds,
        addRejectedUser,
        forceEndMatch,
      }}
    >
      {isAuthReady ? children : null}
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