import React, { useState } from 'react';
import { Button } from './Button';
import { useApp } from '../context/AppContext';

export const NicknameForm: React.FC = () => {
  const { setNickname } = useApp();
  const [inputNickname, setInputNickname] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputNickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    if (inputNickname.length > 15) {
      setError('닉네임은 15자 이내여야 합니다.');
      return;
    }

    setNickname(inputNickname.trim());
    setError('');
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-soft">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        끝나지 않는 홍개팅에 오신 것을 환영합니다
      </h2>
      <p className="text-gray-600 mb-6">
        닉네임을 입력하면 지금 바로 홍익대 학생들과 소개팅을 시작할 수 있어요!
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="nickname"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            닉네임
          </label>
          <input
            type="text"
            id="nickname"
            value={inputNickname}
            onChange={(e) => setInputNickname(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="닉네임을 입력하세요"
            maxLength={15}
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          className="mt-2"
        >
          소개팅 시작하기
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>로그인 없이 이용 가능하며, 닉네임은 기기에만 저장됩니다.</p>
      </div>
    </div>
  );
};
