import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MonitorAddresses from './pages/MonitorAddresses';
import AddressDetail from './pages/AddressDetail';
import TransactionHistory from './pages/TransactionHistory';
import ManualSell from './pages/ManualSell';
import SystemHealth from './pages/SystemHealth';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<MonitorAddresses />} />
        <Route path="address/:address" element={<AddressDetail />} />
        <Route path="transactions" element={<TransactionHistory />} />
        <Route path="manual-sell" element={<ManualSell />} />
        <Route path="system-health" element={<SystemHealth />} />
      </Route>
    </Routes>
  );
}

export default App;