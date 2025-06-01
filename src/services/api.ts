import axios from 'axios';
import { AddWalletRequest, LoginRequest, TotpVerifyRequest } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1'
  },
});

// 设置JWT令牌拦截器
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
  }
};

// 授权相关API
export const login = async (credentials: LoginRequest) => {
  try {
    const response = await api.post('/auth/login', credentials, {
      timeout: 5000 // 5秒超时
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      // 超时错误
      return { 
        success: false, 
        message: '登录请求超时，请检查网络连接'
      };
    }
    throw error;
  }
};

export const verifyTotp = async (data: TotpVerifyRequest) => {
  try {
    const response = await api.post('/auth/verify', data, {
      timeout: 5000 // 5秒超时
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      // 超时错误
      return { 
        success: false, 
        message: 'TOTP验证请求超时，请检查网络连接'
      };
    }
    throw error;
  }
};

export const getTotpQrUrl = async (username: string) => {
  const response = await api.get(`/auth/totp-qr/${username}`);
  return response.data;
};

export const getTotpQrImage = async (username: string) => {
  try {
    const response = await api.get(`/auth/totp-qr-image/${username}`, {
      timeout: 5000 // 5秒超时
    });
    
    // 简化的响应处理
    let result: {
      success: boolean;
      message?: string;
      data?: {
        qr_image?: string;
        [key: string]: any;
      };
      qr_image?: string;
    } = { 
      success: false 
    };
    
    if (response.data) {
      // 复制响应对象
      result = { ...response.data };
      
      // 处理标准响应格式
      if (result.success && result.data && result.data.qr_image) {
        const qrImage = result.data.qr_image;
        if (typeof qrImage === 'string' && !qrImage.startsWith('data:')) {
          result.data.qr_image = `data:image/svg+xml;base64,${qrImage}`;
        }
      } 
      // 处理简单响应格式
      else if (result.qr_image) {
        const qrImage = result.qr_image;
        if (typeof qrImage === 'string' && !qrImage.startsWith('data:')) {
          result.qr_image = `data:image/svg+xml;base64,${qrImage}`;
        }
      }
    }
    
    return result;
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      // 超时错误
      return { 
        success: false, 
        message: '获取TOTP二维码超时，请检查网络连接'
      };
    }
    console.error('获取TOTP二维码失败:', error);
    return {
      success: false,
      message: '获取TOTP二维码失败，请稍后重试'
    };
  }
};

// 获取SOL价格
let lastSolPriceData = {
  price: 0,
  timestamp: 0,
  retryCount: 0
};

export enum PriceSource {
  COINGECKO = 'coingecko',
  BINANCE = 'binance',
  OKX = 'okx',
  HUOBI = 'huobi',
  GATE = 'gate',
  COINMARKETCAP = 'coinmarketcap',
}

export const getSolPrice = async (source: PriceSource = PriceSource.OKX): Promise<number> => {
  // 如果价格请求失败频繁，增加间隔以避免API封锁
  if (lastSolPriceData.retryCount > 3 && Date.now() - lastSolPriceData.timestamp < 30000) {
    console.log('API请求频率过高，使用缓存价格');
    return lastSolPriceData.price;
  }
  
  try {
    let price = 0;

    switch (source) {
      case PriceSource.COINGECKO:
        // CoinGecko API - 无需API密钥但有请求限制
        const geckoResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
          params: {
            ids: 'solana',
            vs_currencies: 'usd'
          },
          timeout: 5000
        });
        price = geckoResponse.data.solana.usd;
        break;

      case PriceSource.BINANCE:
        // Binance API - 使用SOL/USDT交易对，实时性更好
        const binanceResponse = await axios.get('https://api.binance.com/api/v3/ticker/price', {
          params: {
            symbol: 'SOLUSDT'
          },
          timeout: 5000
        });
        price = parseFloat(binanceResponse.data.price);
        break;
        
      case PriceSource.OKX:
        // OKX API (欧易) - 在中国大陆可访问
        const okxResponse = await axios.get('https://www.okx.com/api/v5/market/ticker', {
          params: {
            instId: 'SOL-USDT'
          },
          timeout: 5000
        });
        price = parseFloat(okxResponse.data.data[0].last);
        break;
        
      case PriceSource.HUOBI:
        // 火币API
        const huobiResponse = await axios.get('https://api.huobi.pro/market/detail/merged', {
          params: {
            symbol: 'solusdt'
          },
          timeout: 5000
        });
        // 取收盘价
        price = (huobiResponse.data.tick.close + huobiResponse.data.tick.open) / 2;
        break;
        
      case PriceSource.GATE:
        // Gate.io API
        const gateResponse = await axios.get('https://api.gateio.ws/api/v4/spot/tickers', {
          params: {
            currency_pair: 'SOL_USDT'
          },
          timeout: 5000
        });
        price = parseFloat(gateResponse.data[0].last);
        break;

      case PriceSource.COINMARKETCAP:
        // 使用CoinMarketCap的公共API，仅获取基本价格
        // 注意：完整版需要API密钥，这里只是演示用
        const cmcResponse = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
          headers: {
            // 注意：实际使用时需要注册并获取API密钥
            'X-CMC_PRO_API_KEY': 'YOUR_API_KEY_HERE'  
          },
          params: {
            symbol: 'SOL'
          },
          timeout: 5000
        });
        // 仅作为示例，实际需要API密钥
        price = cmcResponse.data.data.SOL.quote.USD.price;
        break;

      default:
        // 默认使用OKX
        const defaultResponse = await axios.get('https://www.okx.com/api/v5/market/ticker', {
          params: {
            instId: 'SOL-USDT'
          },
          timeout: 5000
        });
        price = parseFloat(defaultResponse.data.data[0].last);
    }
    
    // 重置重试计数
    lastSolPriceData = {
      price: price,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    return price;
  } catch (error) {
    console.error('获取SOL价格失败:', error);
    
    // 增加重试计数
    lastSolPriceData.retryCount++;
    
    // 尝试切换源重试
    if (source === PriceSource.COINGECKO) {
      console.log('CoinGecko数据源失败，切换到OKX');
      return getSolPrice(PriceSource.OKX);
    } else if (source === PriceSource.BINANCE) {
      console.log('Binance数据源受限，切换到OKX');
      return getSolPrice(PriceSource.OKX);
    } else if (source === PriceSource.OKX) {
      console.log('OKX数据源失败，切换到火币');
      return getSolPrice(PriceSource.HUOBI);
    } else if (source === PriceSource.HUOBI) {
      console.log('火币数据源失败，切换到Gate.io');
      return getSolPrice(PriceSource.GATE);
    }
    
    // 如果有缓存的价格，则返回缓存的价格
    if (lastSolPriceData.price > 0) {
      return lastSolPriceData.price;
    }
    return 0;
  }
};

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

export const deleteMonitorAddress = async (address: string) => {
  const response = await api.delete('/monitor-addresses/delete', {
    data: { address }
  });
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

// 专用钱包配置API
export const getSpecialWallets = async () => {
  const response = await api.get('/special-wallets');
  return response.data;
};

export const addSpecialWallet = async (data: {
  wallet_address: string;
  slippage_percentage: number;
  tip_percentage: number;
  priority_fee_multiplier: number;
  compute_limit: number;
  note: string;
}) => {
  const response = await api.post('/special-wallets', data);
  return response.data;
};

export const updateSpecialWallet = async (data: {
  wallet_address: string;
  slippage_percentage: number;
  tip_percentage: number;
  priority_fee_multiplier: number;
  compute_limit: number;
  note: string;
}) => {
  const response = await api.put('/special-wallets/update', data);
  return response.data;
};

export const deleteSpecialWallet = async (walletAddress: string) => {
  const response = await api.delete(`/special-wallets/${walletAddress}`);
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
}) => {
  // 确保percentage是数字类型
  const requestData = {
    ...data,
    percentage: Number(data.percentage)
  };
  const response = await api.post('/sell', requestData);
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