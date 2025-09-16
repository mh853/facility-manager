import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // 팝업 창에서 처리하기 위한 HTML 응답
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>구글 로그인 처리 중...</title>
      <meta charset="utf-8">
    </head>
    <body>
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="text-align: center;">
          <div style="margin-bottom: 20px;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #4285F4; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto;"></div>
          </div>
          <p>구글 로그인 처리 중...</p>
        </div>
      </div>

      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>

      <script>
        (async function() {
          try {
            const code = "${code}";
            const error = "${error}";

            if (error) {
              window.opener?.postMessage({
                type: 'SOCIAL_LOGIN_ERROR',
                error: '구글 로그인이 취소되었거나 오류가 발생했습니다.'
              }, window.location.origin);
              window.close();
              return;
            }

            if (!code) {
              window.opener?.postMessage({
                type: 'SOCIAL_LOGIN_ERROR',
                error: '구글 인증 코드를 받지 못했습니다.'
              }, window.location.origin);
              window.close();
              return;
            }

            // 백엔드 API 호출
            const response = await fetch('/api/auth/social/google', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (data.success) {
              window.opener?.postMessage({
                type: 'SOCIAL_LOGIN_SUCCESS',
                data: data.data
              }, window.location.origin);
            } else {
              window.opener?.postMessage({
                type: 'SOCIAL_LOGIN_ERROR',
                error: data.error?.message || '구글 로그인 중 오류가 발생했습니다.'
              }, window.location.origin);
            }

            window.close();
          } catch (error) {
            console.error('구글 로그인 콜백 처리 오류:', error);
            window.opener?.postMessage({
              type: 'SOCIAL_LOGIN_ERROR',
              error: '구글 로그인 처리 중 오류가 발생했습니다.'
            }, window.location.origin);
            window.close();
          }
        })();
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}