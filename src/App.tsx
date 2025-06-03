import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { NicknameForm } from './components/NicknameForm';
import { MatchingScreen } from './components/MatchingScreen';
import { ChatRoom } from './components/ChatRoom';
import { useApp } from './context/AppContext';
import { registerServiceWorker } from './utils/registerSW';

function App() {
  const { nickname, matchStatus } = useApp();
  const [isInstallPromptShown, setIsInstallPromptShown] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA 설치 프롬프트 처리
  useEffect(() => {
    // 서비스 워커 등록
    registerServiceWorker();

    // 설치 프롬프트 이벤트 처리
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallPromptShown(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstallClick = () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('사용자가 설치를 수락했습니다.');
      }
      setDeferredPrompt(null);
    });

    setIsInstallPromptShown(false);
  };

  // 현재 상태에 따라 렌더링할 콘텐츠 선택
  const renderContent = () => {
    if (!nickname) {
      return <NicknameForm />;
    }

    if (matchStatus === 'chatting') {
      return <ChatRoom />;
    }

    return <MatchingScreen />;
  };

  return (
    <Layout>
      {isInstallPromptShown && (
        <div className="mb-4 bg-secondary-50 p-3 rounded-lg border border-secondary-200 flex justify-between items-center">
          <p className="text-secondary-800 text-sm">
            더 나은 이용을 위해 ‘끝나지 않는 홍개팅’을 홈 화면에 추가해보세요!
          </p>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1 bg-secondary-500 text-white rounded-md text-sm hover:bg-secondary-600 transition-colors"
          >
            홈 화면에 추가
          </button>
        </div>
      )}

      {renderContent()}
    </Layout>
  );
}

export default App;
