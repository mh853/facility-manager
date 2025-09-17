'use client';

import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Send,
  Reply,
  Edit,
  Trash2,
  AtSign,
  Clock,
  User
} from 'lucide-react';
import { Employee } from '@/types';

interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_position: string;
  user_avatar?: string;
  created_at: string;
  updated_at: string;
  parent_id?: string;
  reply_count: number;
  replies?: Comment[];
}

interface TaskCommentsProps {
  taskId: string;
  employees: Employee[];
}

export default function TaskComments({ taskId, employees }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  useEffect(() => {
    loadComments();
  }, [taskId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        setComments(result.data);
      }
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (content: string, parentId?: string) => {
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content.trim(),
          parent_id: parentId
        })
      });

      const result = await response.json();
      if (result.success) {
        setNewComment('');
        setReplyingTo(null);
        await loadComments();
      } else {
        alert(result.error || '댓글 작성에 실패했습니다.');
      }
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      alert('댓글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: content.trim() })
      });

      const result = await response.json();
      if (result.success) {
        setEditingComment(null);
        setEditContent('');
        await loadComments();
      } else {
        alert(result.error || '댓글 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('댓글 수정 실패:', error);
      alert('댓글 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        await loadComments();
      } else {
        alert(result.error || '댓글 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  const handleInputChange = (value: string, setValue: (value: string) => void) => {
    setValue(value);

    // @ 멘션 감지
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = value.substring(lastAtIndex + 1);
      if (!afterAt.includes(' ') && afterAt.length <= 20) {
        setMentionQuery(afterAt);
        setShowMentionSuggestions(true);
        setCursorPosition(lastAtIndex);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const handleMentionSelect = (employee: Employee, inputValue: string, setValue: (value: string) => void) => {
    const beforeAt = inputValue.substring(0, cursorPosition);
    const afterMention = inputValue.substring(cursorPosition + 1 + mentionQuery.length);
    const newValue = `${beforeAt}@${employee.name} ${afterMention}`;
    setValue(newValue);
    setShowMentionSuggestions(false);
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const isEditing = editingComment === comment.id;
    const currentUserId = localStorage.getItem('user_id');

    return (
      <div className={`${isReply ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
        <div className="bg-gray-50 rounded-lg p-4">
          {/* 댓글 헤더 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                {comment.user_avatar ? (
                  <img
                    src={comment.user_avatar}
                    alt={comment.user_name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <User className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div>
                <span className="font-medium text-gray-900">{comment.user_name}</span>
                <span className="text-sm text-gray-500 ml-2">{comment.user_position}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(comment.created_at)}
                {comment.updated_at !== comment.created_at && ' (수정됨)'}
              </span>
              {comment.user_id === currentUserId && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingComment(comment.id);
                      setEditContent(comment.content);
                    }}
                    className="p-1 text-gray-500 hover:text-blue-600 rounded"
                    title="수정"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="p-1 text-gray-500 hover:text-red-600 rounded"
                    title="삭제"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 댓글 내용 */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => handleInputChange(e.target.value, setEditContent)}
                className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="댓글을 수정하세요..."
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEditComment(comment.id, editContent)}
                  disabled={submitting || !editContent.trim()}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  수정
                </button>
                <button
                  onClick={() => {
                    setEditingComment(null);
                    setEditContent('');
                  }}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-800 whitespace-pre-wrap mb-2">
                {comment.content}
              </p>
              {!isReply && (
                <button
                  onClick={() => setReplyingTo(comment.id)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Reply className="w-3 h-3" />
                  답글
                </button>
              )}
            </div>
          )}
        </div>

        {/* 답글 작성 */}
        {replyingTo === comment.id && (
          <div className="mt-3 ml-8">
            <CommentForm
              onSubmit={(content) => handleSubmitComment(content, comment.id)}
              onCancel={() => setReplyingTo(null)}
              placeholder={`${comment.user_name}님에게 답글...`}
              employees={employees}
            />
          </div>
        )}

        {/* 답글 목록 */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} isReply={true} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const CommentForm = ({
    onSubmit,
    onCancel,
    placeholder = "댓글을 작성하세요...",
    employees
  }: {
    onSubmit: (content: string) => void;
    onCancel?: () => void;
    placeholder?: string;
    employees: Employee[];
  }) => {
    const [value, setValue] = useState('');

    return (
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => handleInputChange(e.target.value, setValue)}
          placeholder={placeholder}
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
        />

        {/* 멘션 제안 */}
        {showMentionSuggestions && filteredEmployees.length > 0 && (
          <div className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
            {filteredEmployees.map(employee => (
              <button
                key={employee.id}
                onClick={() => handleMentionSelect(employee, value, setValue)}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
              >
                <AtSign className="w-4 h-4 text-gray-500" />
                <span>{employee.name}</span>
                <span className="text-sm text-gray-500">({employee.position})</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            @ 를 입력하여 동료를 멘션할 수 있습니다
          </span>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-3 py-1 text-gray-600 hover:text-gray-800"
              >
                취소
              </button>
            )}
            <button
              onClick={() => {
                onSubmit(value);
                setValue('');
              }}
              disabled={submitting || !value.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              작성
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-medium text-gray-900">
          댓글 ({comments.length})
        </h3>
      </div>

      {/* 새 댓글 작성 */}
      <CommentForm
        onSubmit={(content) => handleSubmitComment(content)}
        employees={employees}
      />

      {/* 댓글 목록 */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            첫 번째 댓글을 작성해보세요.
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}