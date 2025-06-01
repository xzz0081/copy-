import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AuthState, LoginRequest, TotpVerifyRequest } from '../types';
import { login, verifyTotp, setAuthToken } from './api';
import { disconnectWebSocket, connectWebSocket } from './websocket';

// WebSocket服务地址 - 使用动态协议和主机名
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}/ws`;

// 初始状态
const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  username: null,
  tempToken: null,
  requiresTotp: false,
  error: null,
  loading: false,
  expiresAt: null
};

// 动作类型
type AuthAction =
  | { type: 'LOGIN_REQUEST' }
  | { type: 'LOGIN_SUCCESS'; payload: { tempToken: string; username: string; requiresTotp: boolean } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'VERIFY_REQUEST' }
  | { type: 'VERIFY_SUCCESS'; payload: { token: string; expiresAt: number } }
  | { type: 'VERIFY_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' };

// 创建上下文
const AuthContext = createContext<{
  state: AuthState;
  login: (credentials: LoginRequest) => Promise<void>;
  verifyTotp: (data: TotpVerifyRequest) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}>({
  state: initialState,
  login: async () => {},
  verifyTotp: async () => {},
  logout: () => {},
  clearError: () => {}
});

// Reducer函数
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_REQUEST':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        tempToken: action.payload.tempToken,
        username: action.payload.username,
        requiresTotp: action.payload.requiresTotp,
        error: null
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    case 'VERIFY_REQUEST':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'VERIFY_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        token: action.payload.token,
        tempToken: null,
        requiresTotp: false,
        loading: false,
        expiresAt: action.payload.expiresAt,
        error: null
      };
    case 'VERIFY_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    case 'LOGOUT':
      return {
        ...initialState
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    default:
      return state;
  }
};

// 提供者组件
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 从本地存储中恢复token和状态
  useEffect(() => {
    const token = localStorage.getItem('token');
    const expiresAtStr = localStorage.getItem('expiresAt');
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
    const username = localStorage.getItem('username');
    const tempToken = localStorage.getItem('tempToken');
    const requiresTotpStr = localStorage.getItem('requiresTotp');
    const requiresTotp = requiresTotpStr === 'true';

    if (token && expiresAt && new Date().getTime() < expiresAt) {
      setAuthToken(token);
      dispatch({
        type: 'VERIFY_SUCCESS',
        payload: { token, expiresAt }
      });
    } else if (tempToken && requiresTotp && username) {
      // 如果有临时token和TOTP状态，恢复TOTP验证状态
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          tempToken,
          username,
          requiresTotp
        }
      });
    } else {
      // Token过期或没有，清除状态
      localStorage.removeItem('token');
      localStorage.removeItem('expiresAt');
      localStorage.removeItem('username');
      localStorage.removeItem('tempToken');
      localStorage.removeItem('requiresTotp');
      setAuthToken(null);
    }
  }, []);

  // 登录函数
  const handleLogin = async (credentials: LoginRequest) => {
    dispatch({ type: 'LOGIN_REQUEST' });
    try {
      // 添加超时设置
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
      
      const response = await login(credentials);
      clearTimeout(timeoutId);
      
      if (response.success) {
        // 保存临时token和TOTP状态到本地存储
        localStorage.setItem('username', credentials.username);
        localStorage.setItem('tempToken', response.temp_token);
        localStorage.setItem('requiresTotp', response.requires_totp.toString());
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            tempToken: response.temp_token,
            username: credentials.username,
            requiresTotp: response.requires_totp
          }
        });
      } else {
        dispatch({ type: 'LOGIN_FAILURE', payload: response.message || '登录失败' });
      }
    } catch (error: any) {
      // 检查是否是超时错误
      if (error.name === 'AbortError') {
        dispatch({ type: 'LOGIN_FAILURE', payload: '请求超时，请检查网络连接' });
      } else {
        dispatch({
          type: 'LOGIN_FAILURE',
          payload: error instanceof Error ? error.message : '登录失败，请稍后重试'
        });
      }
    }
  };

  // 验证TOTP函数
  const handleVerifyTotp = async (data: TotpVerifyRequest) => {
    dispatch({ type: 'VERIFY_REQUEST' });
    try {
      const response = await verifyTotp(data);
      if (response.success) {
        // 成功验证后，清除临时状态
        localStorage.removeItem('tempToken');
        localStorage.removeItem('requiresTotp');
        
        setAuthToken(response.token);
        localStorage.setItem('token', response.token);
        localStorage.setItem('expiresAt', response.expires_at.toString());
        
        dispatch({
          type: 'VERIFY_SUCCESS',
          payload: {
            token: response.token,
            expiresAt: response.expires_at
          }
        });

        // 重新连接WebSocket
        if (WS_URL) {
          connectWebSocket(WS_URL);
        }
      } else {
        dispatch({ type: 'VERIFY_FAILURE', payload: response.message || 'TOTP验证失败' });
      }
    } catch (error) {
      dispatch({
        type: 'VERIFY_FAILURE',
        payload: error instanceof Error ? error.message : 'TOTP验证失败，请稍后重试'
      });
    }
  };

  // 注销函数
  const handleLogout = () => {
    // 清理本地存储
    localStorage.removeItem('token');
    localStorage.removeItem('expiresAt');
    localStorage.removeItem('username');
    localStorage.removeItem('tempToken');
    localStorage.removeItem('requiresTotp');
    
    // 清除Token
    setAuthToken(null);
    
    // 断开所有WebSocket连接
    try {
      // 断开WebSocket连接
      console.log('退出登录：断开所有WebSocket连接');
      disconnectWebSocket();
    } catch (error) {
      console.error('断开WebSocket连接失败:', error);
    }
    
    // 更新状态
    dispatch({ type: 'LOGOUT' });
  };

  // 清除错误
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <AuthContext.Provider
      value={{
        state,
        login: handleLogin,
        verifyTotp: handleVerifyTotp,
        logout: handleLogout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 自定义钩子
export const useAuth = () => useContext(AuthContext); 