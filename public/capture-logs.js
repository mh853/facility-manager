// 콘솔 로그 캡처 스크립트
// 브라우저 콘솔에서 이 스크립트를 복사하여 실행하세요

(function() {
  const logs = [];
  const startTime = Date.now();

  // 원본 콘솔 함수 저장
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  // 로그 캡처 함수
  function captureLog(type, args) {
    const timestamp = Date.now() - startTime;
    const message = Array.from(args).map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    logs.push({
      type,
      timestamp,
      message
    });
  }

  // 콘솔 함수 오버라이드
  console.log = function(...args) {
    captureLog('LOG', args);
    originalLog.apply(console, args);
  };

  console.error = function(...args) {
    captureLog('ERROR', args);
    originalError.apply(console, args);
  };

  console.warn = function(...args) {
    captureLog('WARN', args);
    originalWarn.apply(console, args);
  };

  // 로그 다운로드 함수
  window.downloadLogs = function() {
    const logText = logs.map(log => {
      return `[${log.timestamp}ms] [${log.type}] ${log.message}`;
    }).join('\n\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    originalLog(`✅ 로그 ${logs.length}개를 다운로드했습니다.`);
  };

  // 필터링된 로그만 다운로드
  window.downloadFilteredLogs = function(keywords = ['NUMBERING', 'LOOKUP', 'PHOTO', 'CARD']) {
    const filteredLogs = logs.filter(log =>
      keywords.some(keyword => log.message.includes(keyword))
    );

    const logText = filteredLogs.map(log => {
      return `[${log.timestamp}ms] [${log.type}] ${log.message}`;
    }).join('\n\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filtered-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    originalLog(`✅ 필터링된 로그 ${filteredLogs.length}개를 다운로드했습니다.`);
  };

  originalLog('📝 로그 캡처 시작! 사용법:');
  originalLog('  - downloadLogs(): 모든 로그 다운로드');
  originalLog('  - downloadFilteredLogs(): 중요 로그만 다운로드');
  originalLog('  - downloadFilteredLogs(["키워드1", "키워드2"]): 특정 키워드 로그만 다운로드');
})();
