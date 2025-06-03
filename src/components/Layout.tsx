import React from 'react';
import { Heart, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { nickname } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-red-50 to-blue-50">
      <header className="py-4 px-4 sm:px-6 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <Heart className="h-6 w-6 text-hongik-red mr-2" />
            <h1 className="text-xl font-bold text-gray-800">
              끝나지 않는 홍개팅
            </h1>
          </div>
          {nickname && (
            <div className="text-sm text-gray-600">
              안녕하세요, <span className="font-medium">{nickname}</span>님
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>

      <footer className="py-4 px-4 sm:px-6 bg-white/80 backdrop-blur-sm text-center text-sm text-gray-500">
        <div className="container mx-auto">
          <p>© 2025 끝나지 않는 홍개팅</p>
          <p className="flex items-center justify-center mt-1">
            <Info className="h-3 w-3 mr-1" />
            <span>이 서비스는 홍익대학교 학생 전용입니다</span>
          </p>
        </div>
      </footer>
    </div>
  );
};
