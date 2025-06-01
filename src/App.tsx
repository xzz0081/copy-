import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MonitorAddresses from './pages/MonitorAddresses';
import ManualSell from './pages/ManualSell';
import SystemHealth from './pages/SystemHealth';
import SpecialWallets from './pages/SpecialWallets';
import Login from './pages/Login';
import AuthGuide from './pages/AuthGuide';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './services/authContext';
import { useEffect } from 'react';
import { connectWebSocket, initializeWebSocketService } from './services/websocket';

// WebSocket服务地址 - 使用动态协议和主机名
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}/ws`;

function App() {
  // 应用启动时初始化WebSocket服务
  useEffect(() => {
    try {
      console.log('初始化WebSocket服务...');
      
      // 初始化WebSocket服务（设置事件监听和连接检查）
      initializeWebSocketService();
      
      if (WS_URL) {
        console.log(`尝试连接WebSocket服务: ${WS_URL}`);
        // 建立初始连接
        connectWebSocket(WS_URL);
      } else {
        console.error('未配置WebSocket URL，无法连接');
      }
    } catch (error) {
      console.error('WebSocket初始化失败:', error);
    }
    
    // 组件卸载时不断开WebSocket，让服务自行管理连接
  }, []);

  return (
    <AuthProvider>
      <Routes>
        {/* 登录路由 */}
        <Route path="/login" element={<Login />} />
        
        {/* 受保护的路由 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<MonitorAddresses />} />
            <Route path="manual-sell" element={<ManualSell />} />
            <Route path="special-wallets" element={<SpecialWallets />} />
            <Route path="system-health" element={<SystemHealth />} />
            <Route path="auth-guide" element={<AuthGuide />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;