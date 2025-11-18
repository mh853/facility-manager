'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square, Calendar as CalendarIcon, Paperclip, Upload, FileText, Trash2, Download, Eye, Image as ImageIcon, FileIcon, ExternalLink } from 'lucide-react';

/**
 * 첨부 파일 메타데이터 타입
 */
interface AttachedFile {
  name: string;
  size: number;
  type: string;
  url: string;
  uploaded_at: string;
}

/**
 * 캘린더 이벤트 데이터 타입
 */
interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date?: string | null; // 기간 설정용 (nullable)
  event_type: 'todo' | 'schedule';
  is_completed: boolean;
  author_id: string;
  author_name: string;
  attached_files?: AttachedFile[]; // 첨부 파일 배열
  created_at: string;
  updated_at: string;
}

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  mode: 'view' | 'create' | 'edit';
  initialDate?: string; // 초기 날짜 (생성 모드용)
  onSuccess?: () => void;
}

/**
 * 캘린더 모달 컴포넌트
 * - 보기/작성/수정 모드 지원
 * - todo/schedule 타입 구분
 * - Level 1+ (AUTHENTICATED) 작성/수정 권한
 */
export default function CalendarModal({
  isOpen,
  onClose,
  event,
  mode,
  initialDate,
  onSuccess
}: CalendarModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<'todo' | 'schedule'>('schedule');
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<'view' | 'create' | 'edit'>(mode);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<AttachedFile | null>(null);
  const [preloadedFiles, setPreloadedFiles] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);

  /**
   * 로컬 타임존에서 날짜를 YYYY-MM-DD 형식으로 변환
   */
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 모달이 열릴 때 기존 데이터 로드
  useEffect(() => {
    if (isOpen) {
      setInternalMode(mode);
      if (event && (mode === 'view' || mode === 'edit')) {
        setTitle(event.title);
        setDescription(event.description || '');
        setEventDate(event.event_date);
        setEventType(event.event_type);
        setIsCompleted(event.is_completed);
        setAttachedFiles(event.attached_files || []);
      } else if (mode === 'create') {
        setTitle('');
        setDescription('');
        setEventDate(initialDate || formatLocalDate(new Date()));
        setEventType('schedule');
        setIsCompleted(false);
        setAttachedFiles([]);
      }
      setError(null);
    }
  }, [isOpen, event, mode, initialDate]);

  // Preview file 상태 변경 디버깅
  useEffect(() => {
    if (previewFile) {
      console.log('📂 [PREVIEW-STATE] Preview file set:', previewFile.name);
      console.log('📂 [PREVIEW-STATE] Preview modal should now be visible');
    } else {
      console.log('📂 [PREVIEW-STATE] Preview file cleared');
    }
  }, [previewFile]);

  if (!isOpen) return null;

  /**
   * 파일 크기 포맷팅
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * 파일 타입 확인
   */
  const getFileType = (file: AttachedFile): 'image' | 'pdf' | 'document' | 'other' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (
      file.type.includes('word') ||
      file.type.includes('excel') ||
      file.type.includes('powerpoint') ||
      file.type.includes('text')
    ) return 'document';
    return 'other';
  };

  /**
   * 파일 타입별 아이콘 반환
   */
  const getFileIcon = (file: AttachedFile) => {
    const type = getFileType(file);
    switch (type) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-purple-600 flex-shrink-0" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />;
      case 'document':
        return <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />;
      default:
        return <FileIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />;
    }
  };

  /**
   * Supabase Storage URL을 프록시 URL로 변환
   * PDF 파일은 private bucket에서도 접근 가능하도록 서버 프록시 사용
   */
  const getProxyUrl = (file: AttachedFile): string => {
    try {
      // Supabase Storage URL에서 파일 경로 추출
      // 예: https://xxx.supabase.co/storage/v1/object/public/facility-files/calendar/temp/xxx.pdf
      // -> calendar/temp/xxx.pdf
      const url = new URL(file.url);
      const pathParts = url.pathname.split('/');

      // 'facility-files' 이후의 경로 추출
      const bucketIndex = pathParts.findIndex(part => part === 'facility-files');
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        const proxyUrl = `/api/calendar/file-proxy?path=${encodeURIComponent(filePath)}`;
        console.log('🔄 [PROXY] Converting URL:', { original: file.url, proxy: proxyUrl });
        return proxyUrl;
      }

      // 경로 추출 실패 시 원본 URL 반환
      console.warn('⚠️ [PROXY] Failed to extract path from URL:', file.url);
      return file.url;
    } catch (error) {
      console.error('❌ [PROXY] URL parsing error:', error);
      return file.url;
    }
  };

  /**
   * 파일 프리로딩 (호버 시 백그라운드에서 파일 캐싱)
   * - 이미지/PDF 파일만 프리로드
   * - 중복 프리로드 방지
   * - 브라우저 캐시에 파일 미리 로드하여 클릭 시 즉시 표시
   */
  const handleFilePreload = (file: AttachedFile) => {
    const fileType = getFileType(file);

    // 이미지와 PDF만 프리로드 (다른 파일 타입은 다운로드되므로 불필요)
    if (fileType !== 'image' && fileType !== 'pdf') {
      return;
    }

    // 이미 프리로드된 파일은 스킵
    if (preloadedFiles.has(file.url)) {
      console.log('⏭️ [PRELOAD] Already preloaded:', file.name);
      return;
    }

    console.log('🚀 [PRELOAD] Starting preload:', file.name);
    const startTime = Date.now();

    // 프록시 URL 생성 (PDF용)
    const preloadUrl = fileType === 'pdf' ? getProxyUrl(file) : file.url;

    // fetch로 브라우저 캐시에 저장
    fetch(preloadUrl, {
      method: 'GET',
      cache: 'force-cache', // 강제 캐싱
      priority: 'low', // 낮은 우선순위 (백그라운드 작업)
    } as RequestInit)
      .then((response) => {
        if (response.ok) {
          const loadTime = Date.now() - startTime;
          console.log(`✅ [PRELOAD] Preloaded successfully: ${file.name} (${loadTime}ms)`);
          setPreloadedFiles(prev => new Set(prev).add(file.url));
        } else {
          console.warn(`⚠️ [PRELOAD] Failed to preload: ${file.name} (${response.status})`);
        }
      })
      .catch((error) => {
        console.error('❌ [PRELOAD] Error:', file.name, error);
      });
  };

  /**
   * 파일 다운로드
   */
  const handleDownload = async (file: AttachedFile) => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      setError('파일 다운로드 중 오류가 발생했습니다.');
    }
  };

  /**
   * 파일 미리보기
   */
  const handlePreview = (file: AttachedFile) => {
    console.log('🔍 [PREVIEW] Preview button clicked:', file.name);
    console.log('🔍 [PREVIEW] File type:', file.type);
    console.log('🔍 [PREVIEW] File URL:', file.url);

    const type = getFileType(file);
    console.log('🔍 [PREVIEW] Detected type:', type);

    if (type === 'image' || type === 'pdf') {
      console.log('✅ [PREVIEW] Opening preview modal');
      setPreviewLoading(true); // 로딩 시작
      setPreviewFile(file);
    } else {
      // 다른 파일 타입은 새 탭에서 열기
      console.log('🔗 [PREVIEW] Opening in new tab');
      window.open(file.url, '_blank');
    }
  };

  /**
   * 파일 업로드 처리
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        // eventId는 생성 시에는 없으므로 나중에 이벤트 생성 후 파일 경로 업데이트가 필요할 수 있음
        if (event?.id) {
          formData.append('eventId', event.id);
        }

        const response = await fetch('/api/calendar/upload', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '파일 업로드 실패');
        }

        return result.data as AttachedFile;
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setAttachedFiles(prev => [...prev, ...uploadedFiles]);

      console.log('✅ 파일 업로드 성공:', uploadedFiles);
    } catch (err) {
      console.error('❌ 파일 업로드 실패:', err);
      setError('파일 업로드 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setUploading(false);
      // 입력 초기화 (같은 파일을 다시 선택할 수 있도록)
      e.target.value = '';
    }
  };

  /**
   * 파일 제거 처리
   */
  const handleFileRemove = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * 저장 처리
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !eventDate) {
      setError('제목과 날짜를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // TODO: 실제 사용자 정보 가져오기
      const authorId = 'temp_user_id';
      const authorName = '사용자';

      if (internalMode === 'create') {
        // 생성
        const response = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description || null,
            event_date: eventDate,
            event_type: eventType,
            is_completed: eventType === 'todo' ? isCompleted : false,
            author_id: authorId,
            author_name: authorName,
            attached_files: attachedFiles
          })
        });

        const result = await response.json();

        if (!result.success) {
          setError(result.error || '이벤트 생성에 실패했습니다.');
          return;
        }
      } else if (internalMode === 'edit' && event) {
        // 수정
        const response = await fetch(`/api/calendar/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description || null,
            event_date: eventDate,
            event_type: eventType,
            is_completed: eventType === 'todo' ? isCompleted : false,
            attached_files: attachedFiles
          })
        });

        const result = await response.json();

        if (!result.success) {
          setError(result.error || '이벤트 수정에 실패했습니다.');
          return;
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[캘린더 이벤트 저장 오류]', err);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 삭제 처리
   */
  const handleDelete = async () => {
    if (!event) return;

    if (!confirm('이 이벤트를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/calendar/${event.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '삭제에 실패했습니다.');
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[캘린더 이벤트 삭제 오류]', err);
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-purple-100/20">
        {/* 헤더 */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-500 opacity-10"></div>
          <div className="relative flex items-center justify-between p-6 border-b border-purple-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {internalMode === 'create' ? '일정 추가' : internalMode === 'edit' ? '일정 수정' : '일정 상세'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {internalMode === 'create' ? '새로운 일정을 등록하세요' : internalMode === 'edit' ? '일정 정보를 수정하세요' : '일정 상세 정보'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-purple-50 rounded-xl transition-all duration-200 hover:rotate-90"
              disabled={loading}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] bg-gradient-to-b from-white to-gray-50/30">
          {internalMode === 'view' && event ? (
            // 보기 모드
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-purple-50/50 to-blue-50/50 rounded-2xl p-6 border border-purple-100/50">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                  {event.event_type === 'todo' && (
                    event.is_completed ? (
                      <CheckSquare className="w-6 h-6 text-green-600" />
                    ) : (
                      <Square className="w-6 h-6 text-blue-600" />
                    )
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 rounded-lg border border-purple-100">
                    <CalendarIcon className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-gray-700">{new Date(event.event_date).toLocaleDateString('ko-KR')}</span>
                  </span>
                  <span className={`px-3 py-1.5 rounded-lg font-medium ${
                    event.event_type === 'todo' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
                  }`}>
                    {event.event_type === 'todo' ? '할일' : '일정'}
                  </span>
                  {event.event_type === 'todo' && (
                    <span className={`px-3 py-1.5 rounded-lg font-medium ${
                      event.is_completed ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                      {event.is_completed ? '완료' : '진행중'}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-3 flex items-center gap-2">
                  <span className="font-medium">{event.author_name}</span>
                  <span>·</span>
                  <span>{new Date(event.created_at).toLocaleString('ko-KR')}</span>
                </div>
              </div>
              {event.description && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <p className="text-sm font-semibold text-gray-600 mb-2">설명</p>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}

              {/* 첨부 파일 목록 (보기 모드) */}
              {event.attached_files && event.attached_files.length > 0 && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip className="w-4 h-4 text-purple-600" />
                    <p className="text-sm font-semibold text-gray-600">
                      첨부 파일 ({event.attached_files.length})
                    </p>
                  </div>
                  <div className="space-y-2">
                    {event.attached_files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-lg transition-colors group cursor-pointer"
                        onMouseEnter={() => handleFilePreload(file)}
                        onClick={() => handlePreview(file)}
                      >
                        {getFileIcon(file)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)} · {new Date(file.uploaded_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* 다운로드 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // 파일 항목 클릭 이벤트 방지
                              handleDownload(file);
                            }}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                            title="다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // 작성/수정 모드
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 bg-white"
                  placeholder="일정 제목을 입력하세요"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 min-h-[120px] bg-white resize-none"
                  placeholder="일정 설명을 입력하세요 (선택사항)"
                  disabled={loading}
                />
              </div>

              {/* 파일 첨부 섹션 (작성/수정 모드) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    <span>파일 첨부</span>
                  </div>
                </label>

                {/* 파일 업로드 버튼 */}
                <div className="relative">
                  <input
                    type="file"
                    id="fileUpload"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                    onChange={handleFileUpload}
                    disabled={loading || uploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="fileUpload"
                    className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer ${
                      uploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {uploading ? '업로드 중...' : '파일 선택 (최대 10MB)'}
                    </span>
                  </label>
                </div>

                {/* 첨부된 파일 목록 */}
                {attachedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors group cursor-pointer"
                        onMouseEnter={() => handleFilePreload(file)}
                        onClick={() => handlePreview(file)}
                      >
                        {getFileIcon(file)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)}
                            {file.uploaded_at && ` · ${new Date(file.uploaded_at).toLocaleDateString('ko-KR')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* 다운로드 버튼 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                            title="다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {/* 제거 버튼 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileRemove(index);
                            }}
                            disabled={loading}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 hover:text-red-700"
                            title="파일 제거"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    날짜 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 bg-white"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    타입 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as 'todo' | 'schedule')}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 bg-white"
                    disabled={loading}
                  >
                    <option value="schedule">일정</option>
                    <option value="todo">할일</option>
                  </select>
                </div>
              </div>

              {eventType === 'todo' && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-blue-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      id="isCompleted"
                      checked={isCompleted}
                      onChange={(e) => setIsCompleted(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                      disabled={loading}
                    />
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                      완료됨
                    </span>
                  </label>
                </div>
              )}

              {error && (
                <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl text-sm text-red-700 font-medium flex items-start gap-2">
                  <span className="text-red-500 text-lg">⚠</span>
                  <span>{error}</span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-6 border-t border-purple-100/50 bg-gradient-to-r from-gray-50 to-purple-50/30">
          <div>
            {internalMode === 'edit' && (
              <button
                onClick={handleDelete}
                className="px-5 py-2.5 text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-all duration-200 hover:shadow-md border-2 border-transparent hover:border-red-200"
                disabled={loading}
              >
                삭제
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 hover:bg-white rounded-xl font-semibold transition-all duration-200 hover:shadow-md border-2 border-gray-200 hover:border-gray-300"
              disabled={loading}
            >
              {internalMode === 'view' ? '닫기' : '취소'}
            </button>
            {internalMode === 'view' ? (
              <button
                onClick={() => setInternalMode('edit')}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                disabled={loading}
              >
                수정
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                disabled={loading}
              >
                {loading ? '처리 중...' : internalMode === 'create' ? '추가' : '저장'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* 파일 미리보기 모달 - 메인 모달 외부에 렌더링 */}
    {previewFile && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
        <div className="relative bg-white rounded-2xl max-w-4xl max-h-[90vh] w-full overflow-hidden shadow-2xl">
          {/* 모달 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              {getFileIcon(previewFile)}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{previewFile.name}</h3>
                <p className="text-sm text-gray-500">
                  {formatFileSize(previewFile.size)} · {getFileType(previewFile).toUpperCase()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPreviewFile(null)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="닫기"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* 미리보기 콘텐츠 */}
          <div className="overflow-auto max-h-[calc(90vh-80px)]">
            {getFileType(previewFile) === 'image' ? (
              <div className="flex items-center justify-center p-8 bg-gray-100 relative">
                {/* 로딩 스피너 */}
                {previewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
                      <p className="text-sm text-gray-600 font-medium">이미지 로딩 중...</p>
                    </div>
                  </div>
                )}
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                  onLoad={() => {
                    console.log('✅ [PREVIEW] Image loaded successfully');
                    setPreviewLoading(false);
                  }}
                  onError={(e) => {
                    console.error('❌ [PREVIEW] Image load error:', previewFile.url);
                    setPreviewLoading(false);
                    e.currentTarget.onerror = null;
                  }}
                />
              </div>
            ) : getFileType(previewFile) === 'pdf' ? (
              <div className="bg-gray-100 relative">
                {/* 로딩 스피너 */}
                {previewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
                      <p className="text-sm text-gray-600 font-medium">PDF 로딩 중...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={`${getProxyUrl(previewFile)}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                  className="w-full h-[70vh] border-0"
                  title={previewFile.name}
                  onLoad={() => {
                    console.log('✅ [PREVIEW] PDF loaded successfully via proxy');
                    setTimeout(() => setPreviewLoading(false), 500); // PDF는 렌더링 시간 고려
                  }}
                  onError={(e) => {
                    console.error('❌ [PREVIEW] PDF load error via proxy:', getProxyUrl(previewFile));
                    setPreviewLoading(false);
                  }}
                />
                {/* PDF 로딩 실패 시 대체 옵션 */}
                <div className="absolute bottom-4 right-4 z-10">
                  <button
                    onClick={() => window.open(getProxyUrl(previewFile), '_blank')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2"
                    title="새 탭에서 열기"
                  >
                    <ExternalLink className="w-4 h-4" />
                    새 탭에서 열기
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <FileIcon className="w-16 h-16 mb-4" />
                <p className="text-lg font-medium mb-2">미리보기를 지원하지 않는 파일 형식입니다</p>
                <button
                  onClick={() => handleDownload(previewFile)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  다운로드
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </>
  );
}
