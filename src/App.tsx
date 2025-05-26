import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MonitorAddresses from './pages/MonitorAddresses';
import ManualSell from './pages/ManualSell';
import SystemHealth from './pages/SystemHealth';
import { useEffect } from 'react';
import { connectWebSocket, initializeWebSocketService } from './services/websocket';

// WebSocket本地服务地址
// 根据实际运行的WebSocket服务端口进行调整
const WS_URL = 'ws://0.0.0.0:8081';

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