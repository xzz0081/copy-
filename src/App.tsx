import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MonitorAddresses from './pages/MonitorAddresses';
import ManualSell from './pages/ManualSell';
import SystemHealth from './pages/SystemHealth';
import { useEffect } from 'react';
import { connectWebSocket } from './services/websocket';

// WebSocket服务地址
const WS_URL = 'ws://d19e-2408-8266-5903-f0a-69cf-16a0-ec95-7ff0.ngrok-free.app';

function App() {
  // 应用启动时连接WebSocket
  useEffect(() => {
    connectWebSocket(WS_URL);
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