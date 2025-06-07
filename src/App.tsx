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
  const [blockInAppBrowser, setBlockInAppBrowser] = useState(false);

  // iOS 및 인앱 브라우저 여부 감지
  const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  const isInAppBrowser = () => {
    const ua = navigator.userAgent.toLowerCase();
    return (
      ua.includes('kakaotalk') ||
      ua.includes('instagram') ||
      ua.includes('fbav') ||
      ua.includes('line') ||
      ua.includes('naver')
    );
  };
  const isInStandaloneMode =
    'standalone' in window.navigator && (window.navigator as any).standalone;

  // 설치 프롬프트 및 인앱 차단 로직
  useEffect(() => {
    registerServiceWorker();

    if (isIos && isInAppBrowser()) {
      setBlockInAppBrowser(true);
      return;
    }

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

  const renderContent = () => {
    if (!nickname) {
      return <NicknameForm />;
    }

    if (matchStatus === 'chatting') {
      return <ChatRoom />;
    }

    return <MatchingScreen />;
  };

  // 인앱 브라우저 차단 화면 (방법 1 - 버튼 제거)
  if (blockInAppBrowser) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center text-center p-6 z-50">
        <h1 className="text-lg font-semibold mb-3">Safari에서 열어주세요</h1>
        <p className="text-sm leading-relaxed text-gray-700">
          이 앱은 아이폰 Safari에서만 작동합니다. <br />
          오른쪽 위의 <strong>[ ⋮ ]</strong> 또는 하단의 <strong>[ ⬆️ ]</strong> 버튼을 눌러<br />
          <strong>“Safari에서 열기”</strong> 또는 <strong>“기타 브라우저로 열기”</strong>를 선택해주세요.
        </p>
      </div>
    );
  }

  return (
    <Layout>
      {/* iOS 홈 화면 추가 안내 */}
      {isIos && !isInStandaloneMode && (
        <div className="mb-4 bg-yellow-100 border border-yellow-300 p-3 rounded-lg text-sm text-center">
          <p className="text-yellow-900">
            홈 화면에 추가하려면 Safari 하단의 <strong>공유 버튼</strong>을 누른 뒤{' '}
            <strong>"홈 화면에 추가"</strong>를 선택하세요.
          </p>
        </div>
      )}

      {/* Android에서 설치 프롬프트 */}
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
