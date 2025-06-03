import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { useApp } from '../context/AppContext';
import { Flag, SendHorizontal, X } from 'lucide-react';

export const ChatRoom: React.FC = () => {
  const { userId, currentMatch, messages, sendMessage, leaveChat } = useApp();
  const [messageText, setMessageText] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherUserId = currentMatch?.users.find((id) => id !== userId);
  const otherUserNickname =
    otherUserId && currentMatch ? currentMatch.userNicknames[otherUserId] : '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    sendMessage(messageText);
    setMessageText('');
  };

  const handleLeaveChat = () => {
    leaveChat();
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-soft overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
        {/* 채팅 헤더 */}
        <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-800">
              {otherUserNickname} 님과의 대화
            </h3>
            <p className="text-xs text-gray-500">
              채팅방을 나가면 메시지는 삭제됩니다.
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowReportModal(true)}
              className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              aria-label="사용자 신고"
            >
              <Flag className="h-5 w-5" />
            </button>
            <button
              onClick={handleLeaveChat}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="채팅방 나가기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-grow p-4 overflow-y-auto bg-gray-50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
              <p className="mb-2">아직 메시지가 없습니다</p>
              <p className="text-sm">
                {otherUserNickname} 님께 먼저 인사해보세요!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.senderId === userId
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                      message.senderId === userId
                        ? 'bg-primary-500 text-white rounded-tr-none'
                        : 'bg-gray-200 text-gray-800 rounded-tl-none'
                    }`}
                  >
                    <div className="text-sm mb-1">
                      {message.senderId === userId
                        ? '나'
                        : message.senderNickname}
                    </div>
                    <div className="break-words">{message.text}</div>
                    <div
                      className={`text-xs mt-1 text-right ${
                        message.senderId === userId
                          ? 'text-primary-100'
                          : 'text-gray-500'
                      }`}
                    >
                      {formatTime(message.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 입력창 */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t">
          <div className="flex space-x-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={`${otherUserNickname} 님에게 메시지 보내기`}
              className="flex-grow px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              maxLength={500}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!messageText.trim()}
            >
              <SendHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>

      {/* 신고 모달 */}
      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          nickname={otherUserNickname}
        />
      )}
    </>
  );
};

interface ReportModalProps {
  onClose: () => void;
  nickname: string;
}

const ReportModal: React.FC<ReportModalProps> = ({ onClose, nickname }) => {
  const { reportUser, leaveChat } = useApp();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    await reportUser(reason);
    await leaveChat();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4">사용자 신고</h3>
        <p className="text-gray-600 mb-4">
          <span className="font-semibold">{nickname}</span> 님을
          신고하시겠습니까?
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="reason"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              신고 사유
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="어떤 문제가 있었는지 자세히 적어주세요."
              rows={4}
              required
            />
          </div>

          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isSubmitting}
              disabled={!reason.trim() || isSubmitting}
              className="flex-1"
            >
              신고하기
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
