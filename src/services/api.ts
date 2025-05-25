import axios from 'axios';
import { AddWalletRequest } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1'
  },
});

// Monitor Addresses API
export const getMonitorAddresses = async () => {
  const response = await api.get('/monitor-addresses');
  return response.data;
};

export const getMonitorAddress = async (address: string) => {
  const response = await api.get(`/monitor-addresses/${address}`);
  return response.data;
};

export const addMonitorAddress = async (data: AddWalletRequest) => {
  const response = await api.post('/monitor-addresses/add', data);
  return response.data;
};

export const updateMonitorAddress = async (data: any) => {
  const response = await api.put('/monitor-addresses/update', data);
  return response.data;
};

export const updateAddressNote = async (data: { address: string; note: string }) => {
  const response = await api.post('/monitor-addresses/update-note', data);
  return response.data;
};

// Wallet Config API
export const pauseWallet = async (walletAddress: string) => {
  const response = await api.post('/wallet_configs/pause', { wallet_address: walletAddress });
  return response.data;
};

export const resumeWallet = async (walletAddress: string) => {
  const response = await api.post('/wallet_configs/resume', { wallet_address: walletAddress });
  return response.data;
};

// Transaction API
export const getTransactions = async (
  walletAddress: string,
  limit: number = 20,
  offset: number = 0
) => {
  const response = await api.get('/deta-transactions', {
    params: {
      wallet_address: walletAddress,
      limit,
      offset,
    },
  });
  return response.data;
};

// Manual Sell API
export const sellToken = async (data: {
  token_address: string;
  percentage: number;
  tip_fixed: number;
  slippage_bps: number;
  priority_fee: number;
  follow_system_defaults: boolean;
}) => {
  const response = await api.post('/sell', data);
  return response.data;
};

// System Health API
export const checkSystemHealth = async () => {
  try {
    const startTime = Date.now();
    const response = await api.get('/system-status', { timeout: 5000 });
    const endTime = Date.now();
    return {
      status: response.status,
      data: response.data,
      responseTime: endTime - startTime,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: 'Service unavailable' },
        responseTime: 0,
        error: true,
      };
    }
    return {
      status: 500,
      data: { message: 'Unknown error' },
      responseTime: 0,
      error: true,
    };
  }
};

export default api;