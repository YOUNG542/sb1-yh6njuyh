export interface User {
  id: string;
  nickname: string;
  createdAt: number;
  lastActive: number;
  status: 'online' | 'matching' | 'chatting' | 'offline';
  matchingLocked?: boolean;
}

export interface MatchRequest {
  id: string;
  userId: string;
  nickname: string;
  createdAt: number;
  matched?: boolean;
  matchedAt?: any; // Firebase serverTimestamp
  lastActive?: number;
}

export interface Match {
  id: string;
  users: string[];
  userNicknames: Record<string, string>;
  createdAt: number;
  acceptedBy: string[];
  status: 'pending' | 'active' | 'ended';
  rejectedBy?: string;
  endedAt?: number;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  senderNickname: string;
  text: string;
  createdAt: number;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterNickname: string;
  reportedId: string;
  reportedNickname: string;
  matchId: string;
  reason: string;
  createdAt: number;
}