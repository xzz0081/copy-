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
    try {
      const response = await getTotpQrImage(username);
      let qrImage = null;
      if (response && response.success) {
        if ('data' in response && response.data && typeof response.data.qr_image === 'string') {
          qrImage = response.data.qr_image;
        } else if ('qr_image' in response && typeof response.qr_image === 'string') {
          qrImage = response.qr_image;
        } else if ('data' in response && typeof response.data === 'string') {
          if (response.data.startsWith('data:')) {
            qrImage = response.data;
          }
        }
      }
      if (qrImage) {
        setTotpQrImage(qrImage);
        setShowTotpSetup(true);
        setQrLoaded(true);
      }
    } catch (error) {
      console.error('获取TOTP二维码失败', error);
    } finally {
      setIsQrLoading(false);
    }
  }, [isQrLoading, qrLoaded]);

  // 如果需要TOTP设置，获取二维码
  useEffect(() => {
    if (state.requiresTotp && state.username && !qrLoaded) {
      fetchTotpQrImage(state.username);
    }
  }, [state.requiresTotp, state.username, fetchTotpQrImage, qrLoaded]);

  // 重置二维码状态
  useEffect(() => {
    if (!state.requiresTotp) {
      setTotpQrImage(null);
      setShowTotpSetup(false);
      setQrLoaded(false);
    }
  }, [state.requiresTotp]);

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
    await login(credentials);
  };

  // 处理TOTP验证提交
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
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
      {/* 只有首次绑定才显示二维码 */}
      {state.isBindingMode && showTotpSetup && (
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">请输入两步验证码</h3>
          {totpQrImage && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                请使用谷歌验证器或其他TOTP应用扫描下方二维码设置您的两步验证。
              </p>
              <div className="flex justify-center mb-4">
                {isQrLoading ? (
                  <div className="flex items-center justify-center h-[200px] w-[200px] border rounded">
                    <p className="text-gray-500">加载中...</p>
                  </div>
                ) : (
                  <img 
                    src={totpQrImage} 
                    alt="TOTP二维码" 
                    className="max-w-full h-auto border rounded"
                    style={{ maxWidth: '200px' }}
                  />
                )}
              </div>
              <p className="text-sm text-gray-500">
                设置完成后，输入应用生成的6位验证码。
              </p>
            </>
          )}
        </div>
      )}
      {/* 验证码输入框始终显示 */}
      <div>
        <label htmlFor="totpCode" className="block text-sm font-medium text-gray-700">
          验证码
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
          {state.loading ? '验证中...' : '验证'}
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
        
        {state.requiresTotp ? renderTotpForm() : renderLoginForm()}
      </div>
    </div>
  );
};

export default Login; 
