import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { LoginRequest, TotpVerifyRequest } from '../types';
import { getTotpQrImage } from '../services/api';

const Login: React.FC = () => {
  const { state, login, verifyTotp, clearError } = useAuth();
  const navigate = useNavigate();
  
  const [credentials, setCredentials] = useState<LoginRequest>({
    username: '',
    password: '',
  });
  
  const [totpCode, setTotpCode] = useState('');
  const [totpQrImage, setTotpQrImage] = useState<string | null>(null);
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // 如果已认证，跳转到主页
  useEffect(() => {
    if (state.isAuthenticated) {
      navigate('/');
    }
  }, [state.isAuthenticated, navigate]);

  // 获取TOTP二维码的方法
  const fetchTotpQrImage = useCallback(async (username: string) => {
    if (!username || isQrLoading || qrLoaded) return;
    setIsQrLoading(true);
    setQrError(null);
    try {
      console.log('获取TOTP二维码开始:', username);
      const response = await getTotpQrImage(username);
      console.log('TOTP二维码响应:', response);
      
      let qrImage: string | null = null;
      
      // 使用类型守卫确保类型安全
      if (response && typeof response === 'object' && 'success' in response && response.success) {
        // 检查data.qr_image (标准响应格式)
        if ('data' in response && 
            response.data && 
            typeof response.data === 'object' && 
            'qr_image' in response.data && 
            typeof response.data.qr_image === 'string') {
          qrImage = response.data.qr_image;
          console.log('从data.qr_image获取二维码');
        } 
        // 检查qr_image (简单响应格式)
        else if ('qr_image' in response && typeof response.qr_image === 'string') {
          qrImage = response.qr_image;
          console.log('从qr_image获取二维码');
        }
        // 检查data是否直接是字符串
        else if ('data' in response && typeof response.data === 'string') {
          qrImage = response.data;
          console.log('从data字符串获取二维码');
        }
      }
      
      if (qrImage) {
        console.log('成功获取到二维码数据');
        setTotpQrImage(qrImage);
        setShowTotpSetup(true);
        setQrLoaded(true);
      } else {
        console.error('获取二维码失败: 响应中没有有效的二维码数据');
        setQrError('获取二维码失败，响应中没有有效的二维码数据');
      }
    } catch (error) {
      console.error('获取TOTP二维码异常:', error);
      setQrError('获取二维码时发生错误，请刷新页面重试');
    } finally {
      setIsQrLoading(false);
    }
  }, [isQrLoading, qrLoaded]);

  // 如果需要TOTP设置或绑定，获取二维码
  useEffect(() => {
    // 检查条件并记录
    console.log('二维码加载条件检查:', {
      username: state.username,
      qrLoaded,
      requiresTotp: state.requiresTotp,
      isBindingMode: state.isBindingMode
    });
    
    if (state.username && !qrLoaded && (state.requiresTotp || state.isBindingMode)) {
      console.log('触发二维码获取:', state.username);
      fetchTotpQrImage(state.username);
    }
  }, [state.requiresTotp, state.isBindingMode, state.username, fetchTotpQrImage, qrLoaded]);

  // 重置二维码状态
  useEffect(() => {
    if (!state.requiresTotp && !state.isBindingMode) {
      setTotpQrImage(null);
      setShowTotpSetup(false);
      setQrLoaded(false);
      setQrError(null);
    }
  }, [state.requiresTotp, state.isBindingMode]);

  // 处理输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 处理TOTP代码输入
  const handleTotpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTotpCode(e.target.value);
  };

  // 处理登录表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    console.log('提交登录表单:', credentials);
    await login(credentials);
  };

  // 处理TOTP验证提交
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    console.log('提交TOTP验证:', { tempToken: state.tempToken, totpCode });
    if (state.tempToken) {
      const totpData: TotpVerifyRequest = {
        temp_token: state.tempToken,
        totp_code: totpCode,
      };
      await verifyTotp(totpData);
    }
  };

  // 渲染登录表单
  const renderLoginForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
          用户名
        </label>
        <input
          type="text"
          id="username"
          name="username"
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          value={credentials.username}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          密码
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          value={credentials.password}
          onChange={handleChange}
        />
      </div>
      <div>
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={state.loading}
        >
          {state.loading ? '登录中...' : '登录'}
        </button>
      </div>
    </form>
  );

  // 渲染TOTP验证表单
  const renderTotpForm = () => (
    <form onSubmit={handleTotpSubmit} className="space-y-4">
      {/* 只有首次绑定时才显示二维码 */}
      {state.isBindingMode && (
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">设置两步验证</h3>
          {isQrLoading ? (
            <div className="flex flex-col items-center justify-center p-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
              <p className="text-gray-500">正在加载二维码，请稍候...</p>
            </div>
          ) : totpQrImage ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                请使用谷歌验证器或其他TOTP应用扫描下方二维码设置您的两步验证。
              </p>
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="border-2 border-gray-300 p-2 rounded-md mb-2 bg-white">
                  <img 
                    src={totpQrImage} 
                    alt="TOTP二维码" 
                    className="max-w-full h-auto"
                    style={{ maxWidth: '200px' }}
                    onError={(e) => {
                      console.error('二维码图片加载失败');
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBmaWxsPSJub25lIiBkPSJNMCAwaDI0djI0SDBWMHoiLz48cGF0aCBkPSJNMTEgMThoMnYtMmgtMnYyem0xLTE2QzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQxIDAtOC0zLjU5LTgtOHMzLjU5LTggOC04IDggMy41OSA4IDgtMy41OSA4LTggOHptMC0xNGMtMi4yMSAwLTQgMS43OS00IDRoMmMwLTEuMS45LTIgMi0ycy4yLjkgMiAyYzAgMi0zIDEuNzUtMyA1aDJjMC0yLjI1IDMtMi41IDMtNSAwLTIuMjEtMS43OS00LTQtNHoiIGZpbGw9IiM5OTk5OTkiLz48L3N2Zz4=';
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQrLoaded(false);
                    fetchTotpQrImage(state.username || '');
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 mt-2"
                >
                  重新加载二维码
                </button>
              </div>
              <p className="text-sm text-gray-500">
                设置完成后，输入应用生成的6位验证码完成绑定。
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-red-500 mb-4">
                {qrError || '二维码加载失败，请点击下方按钮重试。'}
              </p>
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setQrLoaded(false);
                    fetchTotpQrImage(state.username || '');
                  }}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200"
                >
                  重新加载二维码
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {!state.isBindingMode && (
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          输入验证码
        </h3>
      )}
      {/* 验证码输入框始终显示 */}
      <div>
        <label htmlFor="totpCode" className="block text-sm font-medium text-gray-700">
          {state.isBindingMode ? '6位验证码' : '验证码'}
        </label>
        <input
          type="text"
          id="totpCode"
          name="totpCode"
          required
          maxLength={6}
          pattern="[0-9]{6}"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          value={totpCode}
          onChange={handleTotpChange}
          placeholder="输入6位数验证码"
          autoComplete="off"
        />
      </div>
      <div>
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={state.loading}
        >
          {state.loading ? '验证中...' : (state.isBindingMode ? '设置并验证' : '验证')}
        </button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">跟单系统登录</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            安全授权访问后端服务
          </p>
        </div>
        
        {state.error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">错误</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{state.error}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {(state.tempToken || state.requiresTotp || state.isBindingMode) ? renderTotpForm() : renderLoginForm()}
      </div>
    </div>
  );
};

export default Login; 
