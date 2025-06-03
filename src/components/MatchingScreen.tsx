import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { useApp } from '../context/AppContext';
import { Heart, Loader2 } from 'lucide-react';

export const MatchingScreen: React.FC = () => {
  const { matchStatus, enterMatchmaking, exitMatchmaking, currentMatch, acceptMatch, rejectMatch } = useApp();
  const [searching, setSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const handleRejectMatch = async () => {
    try {
      await rejectMatch();
    } catch (err) {
      console.error('❌ 매칭 거절 중 오류:', err);
    }
  };



  useEffect(() => {
    let interval: number | undefined;
    
    if (matchStatus === 'searching') {
      setSearching(true);
      interval = setInterval(() => {
        setSearchTime((prev) => prev + 1);
      }, 1000) as unknown as number;
    } else {
      setSearching(false);
      setSearchTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [matchStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs < 10 ? '0' : ''}${secs}초`;
  };

  const handleStartMatching = async () => {
    await enterMatchmaking();
  };

  const handleCancelMatching = async () => {
    await exitMatchmaking();
  };

  const handleAcceptMatch = async () => {
    await acceptMatch();
  };

  if (matchStatus === 'found' && currentMatch) {
    const otherUserId = currentMatch.users.find(id => id !== useApp().userId);
    const otherUserNickname = otherUserId ? currentMatch.userNicknames[otherUserId] : '';
    const hasAccepted = Array.isArray(currentMatch.acceptedBy) && currentMatch.acceptedBy.includes(useApp().userId);

    return (
      <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-soft text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-red-100 p-4 rounded-full">
            <Heart className="h-12 w-12 text-primary-500" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-3">매칭 성공!</h2>
        <p className="text-gray-600 mb-6">
          <span className="font-semibold">{otherUserNickname}</span> 님과 매칭되었습니다.
        </p>

        {hasAccepted ? (
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 text-primary-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{otherUserNickname} 님의 수락을 기다리는 중...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button variant="primary" size="lg" fullWidth onClick={handleAcceptMatch}>
              수락하기
            </Button>
            <Button variant="outline" size="lg" fullWidth onClick={handleRejectMatch}>
              거절하기
            </Button>

          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-soft">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {searching ? '매칭 중...' : '소개팅 시작하기'}
        </h2>
        <p className="text-gray-600">
          {searching 
            ? `${formatTime(searchTime)}째 매칭 중입니다` 
            : '홍익대 학생과의 익명 소개팅을 시작해보세요'}
        </p>
      </div>

      <div className="flex justify-center mb-6">
        {searching ? (
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-12 w-12 text-primary-500 animate-spin" />
            </div>
            <Heart className="h-24 w-24 text-primary-100 animate-pulse-slow" />
          </div>
        ) : (
          <Heart className="h-24 w-24 text-primary-500 hover:text-primary-600 transition-colors duration-300" />
        )}
      </div>

      {searching ? (
        <Button 
          variant="outline" 
          size="lg" 
          fullWidth 
          onClick={handleCancelMatching}
        >
          매칭 취소
        </Button>
      ) : (
        <Button 
          variant="primary" 
          size="lg" 
          fullWidth
          onClick={handleStartMatching}
        >
          홍익대 학생과 소개팅 시작하기
        </Button>
      )}

      {!searching && (
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>매칭된 상대방과 서로 수락해야 대화가 시작됩니다</p>
        </div>
      )}
    </div>
  );
};
