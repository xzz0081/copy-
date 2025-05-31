import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import AddressDisplay from './ui/AddressDisplay';
import PriceDisplay from './ui/PriceDisplay';
import { formatNumber } from '../utils/profit';
import Spinner from './ui/Spinner';

interface TradeData {
  message_type: string;
  params: {
    // 旧字段名
    min_sol_out?: number;
    min_sol_out_ui?: number;
    token_amount?: number;
    token_amount_ui?: number;
    
    // 新字段名
    amount_sol?: number;
    amount_sol_ui?: number;
    token_amount_in?: number;
    token_amount_in_ui?: number;
    
    // 通用字段
    price: number;
    signature: string;
    signer: string;
    timestamp?: number;
    token_address?: string;
    transaction_type?: string;
  };
  timestamp: number;
  trade_id: string;
}

interface RealtimeTradeHistoryProps {
  onClose: () => void; // 保留这个参数以保持接口一致，但不会使用它
}

// 交易历史专用WebSocket连接URL
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const TRADES_WS_URL = `${protocol}://${window.location.host}/trades`;

// 全局静态引用，确保即使在StrictMode下也只创建一个WebSocket实例
const staticWsRef: {
  instance: WebSocket | null;
  listeners: Set<(data: any) => void>;
  isConnecting: boolean;
  isConnected: boolean;
  reconnectTimer: number | null;
  reconnectAttempts: number;
  heartbeatTimer: number | null;
} = {
  instance: null,
  listeners: new Set(),
  isConnecting: false,
  isConnected: false,
  reconnectTimer: null,
  reconnectAttempts: 0,
  heartbeatTimer: null
};

// 全局函数 - 发送心跳包
const sendHeartbeat = () => {
  if (staticWsRef.instance && staticWsRef.instance.readyState === WebSocket.OPEN) {
    try {
      staticWsRef.instance.send(JSON.stringify({ type: 'ping' }));
    } catch (error) {
      console.error('发送心跳包失败');
      handleConnectionFailure();
    }
  }
};

// 全局函数 - 启动心跳检测
const startHeartbeat = () => {
  // 清除现有心跳
  if (staticWsRef.heartbeatTimer) {
    window.clearInterval(staticWsRef.heartbeatTimer);
  }
  
  // 每30秒发送一次心跳包
  staticWsRef.heartbeatTimer = window.setInterval(sendHeartbeat, 30000);
};

// 全局函数 - 停止心跳检测
const stopHeartbeat = () => {
  if (staticWsRef.heartbeatTimer) {
    window.clearInterval(staticWsRef.heartbeatTimer);
    staticWsRef.heartbeatTimer = null;
  }
};

// 全局函数 - 处理连接失败
const handleConnectionFailure = () => {
  staticWsRef.isConnected = false;
  staticWsRef.isConnecting = false;
  
  if (staticWsRef.instance) {
    try {
      staticWsRef.instance.close();
    } catch (e) {
      // 忽略关闭错误
    }
    staticWsRef.instance = null;
  }
  
  // 安排重连
  scheduleReconnect();
};

// 全局函数 - 安排重连
const scheduleReconnect = () => {
  if (staticWsRef.reconnectTimer) {
    window.clearTimeout(staticWsRef.reconnectTimer);
  }
  
  const maxReconnectAttempts = 10;
  if (staticWsRef.reconnectAttempts < maxReconnectAttempts) {
    // 使用指数退避策略，但设置上限
    const delay = Math.min(1000 * Math.pow(1.5, staticWsRef.reconnectAttempts), 30000);
    console.log(`${delay / 1000}秒后尝试重连交易记录 (${staticWsRef.reconnectAttempts + 1}/${maxReconnectAttempts})`);
    
    staticWsRef.reconnectTimer = window.setTimeout(() => {
      staticWsRef.reconnectAttempts++;
      connectToTradesWS();
    }, delay);
  } else {
    // 重置重连次数并安排一个长时间后的重连
    console.log('达到最大重连次数，将在2分钟后再次尝试');
    staticWsRef.reconnectTimer = window.setTimeout(() => {
      staticWsRef.reconnectAttempts = 0;
      connectToTradesWS();
    }, 120000); // 2分钟后再次尝试
  }
};

// 全局函数 - 连接到交易记录WebSocket
const connectToTradesWS = () => {
  // 如果已经连接或正在连接，则不重复连接
  if (staticWsRef.isConnected || staticWsRef.isConnecting) {
    console.log('已有交易记录WebSocket连接或正在连接，跳过重复连接');
    return;
  }
  
  staticWsRef.isConnecting = true;
  
  // 如果已经有连接，先关闭
  if (staticWsRef.instance) {
    try {
      staticWsRef.instance.close();
    } catch (e) {
      // 忽略关闭错误
    }
  }
  
  try {
    console.log('正在连接交易记录WebSocket...');
    staticWsRef.instance = new WebSocket(TRADES_WS_URL);
    
    // 设置连接超时
    const connectionTimeout = window.setTimeout(() => {
      if (staticWsRef.instance && staticWsRef.instance.readyState !== WebSocket.OPEN) {
        console.error('交易记录WebSocket连接超时');
        handleConnectionFailure();
      }
    }, 10000);
    
    // 连接打开
    staticWsRef.instance.onopen = () => {
      console.log('交易记录WebSocket连接已建立');
      staticWsRef.isConnected = true;
      staticWsRef.isConnecting = false;
      staticWsRef.reconnectAttempts = 0;
      window.clearTimeout(connectionTimeout);
      startHeartbeat();
      
      // 通知所有监听器连接已建立
      for (const listener of staticWsRef.listeners) {
        try {
          listener({ type: 'connection', connected: true });
        } catch (e) {
          console.error('通知监听器失败', e);
        }
      }
    };
    
    // 接收消息
    staticWsRef.instance.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 处理心跳响应
        if (data.type === 'pong') {
          return;
        }
        
        // 处理交易记录消息并通知所有监听器
        if (data.message_type === 'trade_history') {
          console.log('收到实时交易数据:', data);
          for (const listener of staticWsRef.listeners) {
            try {
              listener(data);
            } catch (e) {
              console.error('通知监听器失败', e);
            }
          }
        }
      } catch (error) {
        console.error('处理交易消息失败:', error);
      }
    };
    
    // 错误处理
    staticWsRef.instance.onerror = (error) => {
      console.error('交易记录WebSocket错误:', error);
      // 通知所有监听器连接错误
      for (const listener of staticWsRef.listeners) {
        try {
          listener({ type: 'error', message: '连接错误，正在尝试重连...' });
        } catch (e) {
          console.error('通知监听器失败', e);
        }
      }
    };
    
    // 连接关闭
    staticWsRef.instance.onclose = (event) => {
      console.log(`交易记录WebSocket连接关闭: 代码=${event.code}, 原因=${event.reason}`);
      
      // 通知所有监听器连接关闭
      for (const listener of staticWsRef.listeners) {
        try {
          listener({ type: 'connection', connected: false });
        } catch (e) {
          console.error('通知监听器失败', e);
        }
      }
      
      // 只有在非正常关闭时才重连
      if (event.code !== 1000) {
        handleConnectionFailure();
      } else {
        staticWsRef.isConnected = false;
        staticWsRef.isConnecting = false;
      }
    };
  } catch (error) {
    console.error('创建交易记录WebSocket连接失败:', error);
    staticWsRef.isConnecting = false;
    
    // 通知所有监听器连接失败
    for (const listener of staticWsRef.listeners) {
      try {
        listener({ type: 'error', message: '创建连接失败，正在尝试重连...' });
      } catch (e) {
        console.error('通知监听器失败', e);
      }
    }
    
    scheduleReconnect();
  }
};

// 初始化页面可见性监听
(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // 页面变为可见时，检查连接
      if (!staticWsRef.isConnected && !staticWsRef.isConnecting) {
        connectToTradesWS();
      }
    }
  };
  
  // 确保只添加一次监听器
  if (typeof window !== 'undefined' && !window.__tradesVisibilityListenerAdded) {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.__tradesVisibilityListenerAdded = true;
  }
})();

// 组件实现
const RealtimeTradeHistory: React.FC<RealtimeTradeHistoryProps> = () => {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [connected, setConnected] = useState(staticWsRef.isConnected);
  const [error, setError] = useState<string | null>(null);
  const maxTrades = 50; // 减少最大显示数量，适合侧边栏
  
  // 处理消息的回调函数
  const handleMessage = (data: any) => {
    // 处理连接状态消息
    if (data.type === 'connection') {
      setConnected(data.connected);
      if (data.connected) {
        setError(null);
      } else {
        setError('连接已断开，正在重连...');
      }
      return;
    }
    
    // 处理错误消息
    if (data.type === 'error') {
      setError(data.message);
      return;
    }
    
    // 处理交易记录消息
    if (data.message_type === 'trade_history') {
      setTrades(prev => {
        // 将新交易添加到列表开头
        const updatedTrades = [data, ...prev];
        // 限制最大数量
        return updatedTrades.slice(0, maxTrades);
      });
    }
  };
  
  // 组件挂载时添加监听器，卸载时移除
  useEffect(() => {
    // 添加监听器
    staticWsRef.listeners.add(handleMessage);
    
    // 设置初始状态
    setConnected(staticWsRef.isConnected);
    if (!staticWsRef.isConnected && !staticWsRef.isConnecting) {
      // 如果没有连接，则尝试建立连接
      connectToTradesWS();
    }
    
    // 清理函数
    return () => {
      // 移除监听器
      staticWsRef.listeners.delete(handleMessage);
      
      // 如果没有其他监听器，并且组件卸载，可以考虑关闭连接
      // 但由于我们希望保持单例连接，这里不关闭WebSocket
    };
  }, [maxTrades]);

  // 格式化时间戳
  const formatTimestamp = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'HH:mm:ss');
  };

  // 打开Solscan浏览器查看交易详情
  const openTransaction = (signature: string) => {
    window.open(`https://solscan.io/tx/${signature}`, '_blank');
  };

  // 获取交易类型文本
  const getTransactionTypeText = (type: string) => {
    if (type.toLowerCase().includes('buy')) return '买';
    if (type.toLowerCase().includes('sell')) return '卖';
    return type;
  };

  return (
    <div className="h-full w-full text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center text-xs">
          状态:
          {connected ? (
            <span className="ml-1 text-success-500">已连接</span>
          ) : (
            <span className="ml-1 text-error-500">未连接</span>
          )}
        </span>
      </div>

      {error && (
        <div className="rounded bg-red-900/30 p-2 text-red-300 text-xs mb-2">
          <p>{error}</p>
        </div>
      )}

      {!connected && !error && (
        <div className="flex justify-center items-center p-4">
          <Spinner size="sm" />
          <span className="ml-2 text-xs text-gray-400">连接中...</span>
        </div>
      )}

      {connected && trades.length === 0 && (
        <div className="p-2 text-center text-xs text-gray-400">
          等待交易数据...
        </div>
      )}

      {trades.length > 0 && (
        <div className="space-y-2">
          {trades.map((trade) => (
            <div 
              key={trade.trade_id} 
              className="rounded bg-gray-800/50 p-2 text-xs hover:bg-gray-700/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-400">
                  {formatTimestamp(trade.timestamp)}
                </span>
                <span className={`font-medium ${
                  (trade.params.transaction_type?.toLowerCase().includes('buy') ?? false)
                    ? 'text-success-500' 
                    : 'text-error-500'
                }`}>
                  {getTransactionTypeText(trade.params.transaction_type || '未知')}
                </span>
              </div>
              
              <div className="mt-1">
                <AddressDisplay 
                  address={trade.params.token_address || '未知地址'} 
                  maxLength={8} 
                  className="text-xs" 
                />
              </div>
              
              <div className="mt-1 grid grid-cols-2 gap-x-1 gap-y-1">
                <div>
                  <span className="text-gray-400">数量:</span>
                  <span className="ml-1">
                    {formatNumber(trade.params.token_amount_ui || trade.params.token_amount_in_ui || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">SOL:</span>
                  <span className="ml-1">
                    {(trade.params.min_sol_out_ui || trade.params.amount_sol_ui || 0).toFixed(4)}
                  </span>
                </div>
                <div className="col-span-2 flex justify-between items-center">
                  <div>
                    <span className="text-gray-400">价格:</span>
                    <PriceDisplay price={trade.params.price} />
                  </div>
                  <button 
                    onClick={() => openTransaction(trade.params.signature)}
                    className="text-primary-500 hover:text-primary-400 flex items-center"
                    title="在Solscan查看交易"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 声明全局Window接口扩展
declare global {
  interface Window {
    __tradesVisibilityListenerAdded?: boolean;
  }
}

export default RealtimeTradeHistory; 