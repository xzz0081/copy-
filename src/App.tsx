import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MonitorAddresses from './pages/MonitorAddresses';
import ManualSell from './pages/ManualSell';
import SystemHealth from './pages/SystemHealth';
import { useEffect } from 'react';
import { connectWebSocket, initializeWebSocketService } from './services/websocket';

// WebSocket服务地址
const WS_URL = 'ws://d19e-2408-8266-5903-f0a-69cf-16a0-ec95-7ff0.ngrok-free.app';

function App() {
  // 应用启动时初始化WebSocket服务
  useEffect(() => {
    // 初始化WebSocket服务（设置事件监听和连接检查）
    initializeWebSocketService();
    
    // 建立初始连接
    connectWebSocket(WS_URL);
    
    // 组件卸载时不断开WebSocket，让服务自行管理连接
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<MonitorAddresses />} />
        <Route path="manual-sell" element={<ManualSell />} />
        <Route path="system-health" element={<SystemHealth />} />
      </Route>
    </Routes>
  );
}

export default App;