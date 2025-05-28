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
    min_sol_out: number;
    min_sol_out_ui: number;
    price: number;
    signature: string;
    signer: string;
    timestamp: number;
    token_address: string;
    token_amount: number;
    token_amount_ui: number;
    transaction_type: string;
  };
  timestamp: number;
  trade_id: string;
}

interface RealtimeTradeHistoryProps {
  onClose: () => void; // 保留这个参数以保持接口一致，但不会使用它
}

const RealtimeTradeHistory: React.FC<RealtimeTradeHistoryProps> = () => {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const pingTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const maxTrades = 50; // 减少最大显示数量，适合侧边栏
  const MAX_RECONNECT_ATTEMPTS = 10;
  const HEARTBEAT_INTERVAL = 15000; // 15秒发送一次心跳
  const PING_TIMEOUT = 10000; // 10秒内没收到pong就认为连接断开

  // 发送心跳包
  const sendHeartbeat = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("发送心跳包...");
      wsRef.current.send(JSON.stringify({ type: "ping" }));
      
      // 设置超时定时器，如果在指定时间内未收到pong响应，则重新连接
      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
      }
      
      pingTimeoutRef.current = window.setTimeout(() => {
        console.log("心跳包响应超时，重新连接...");
        if (wsRef.current) {
          wsRef.current.close();
        }
      }, PING_TIMEOUT);
    }
  };

  // 启动心跳机制
  const startHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    heartbeatRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
  };

  // 停止心跳机制
  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    
    if (pingTimeoutRef.current) {
      clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    // 初始化WebSocket连接
    const connect = () => {
      setError(null);
      try {
        console.log('尝试连接WebSocket...');
        const ws = new WebSocket('ws://localhost:8081/trades');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('实时交易WebSocket连接成功');
          setConnected(true);
          setError(null);
          reconnectCountRef.current = 0; // 重置重连计数
          
          // 连接成功后立即发送一个ping
          sendHeartbeat();
          // 启动心跳
          startHeartbeat();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // 处理pong响应
            if (data.type === 'pong') {
              console.log('收到pong响应');
              // 清除ping超时
              if (pingTimeoutRef.current) {
                clearTimeout(pingTimeoutRef.current);
                pingTimeoutRef.current = null;
              }
              return;
            }
            
            // 只处理交易历史消息
            if (data.message_type === 'trade_history') {
              console.log('收到实时交易数据:', data);
              setTrades(prev => {
                // 将新交易添加到列表开头
                const updatedTrades = [data, ...prev];
                // 限制最大数量
                return updatedTrades.slice(0, maxTrades);
              });
            }
          } catch (err) {
            console.error('解析WebSocket消息失败:', err);
          }
        };

        ws.onerror = (e) => {
          console.error('实时交易WebSocket错误:', e);
          setError('连接出错，正在重连...');
          setConnected(false);
          stopHeartbeat();
          // 自动重连处理放到onclose中
        };

        ws.onclose = (event) => {
          console.log('实时交易WebSocket连接关闭, 代码:', event.code);
          setConnected(false);
          stopHeartbeat();
          
          // 非正常关闭时尝试重连
          if (event.code !== 1000) {
            setError('连接已断开，正在重连...');
            
            // 清除所有计时器
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            // 使用指数退避重连策略
            const reconnectDelay = Math.min(1000 * Math.pow(1.5, reconnectCountRef.current), 30000);
            
            if (reconnectCountRef.current < MAX_RECONNECT_ATTEMPTS) {
              console.log(`将在 ${reconnectDelay}ms 后重连 (尝试 ${reconnectCountRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
              
              reconnectTimeoutRef.current = window.setTimeout(() => {
                reconnectCountRef.current++;
                if (wsRef.current?.readyState !== WebSocket.OPEN) {
                  connect();
                }
              }, reconnectDelay);
            } else {
              // 达到最大重连次数，间隔更长时间后重试
              console.log('达到最大重连次数，将在60秒后再次尝试');
              reconnectTimeoutRef.current = window.setTimeout(() => {
                reconnectCountRef.current = 0;
                connect();
              }, 60000);
            }
          }
        };
        
        return ws;
      } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        setError('连接失败，重试中...');
        setConnected(false);
        
        // 尝试重连
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
        
        return null;
      }
    };

    const ws = connect();

    // 页面可见性变化监听
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 如果页面变为可见，但WebSocket已断开，则重连
        if (wsRef.current?.readyState !== WebSocket.OPEN && wsRef.current?.readyState !== WebSocket.CONNECTING) {
          connect();
        }
      }
    };

    // 添加页面可见性监听
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 组件卸载时清理
    return () => {
      stopHeartbeat();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
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
                  trade.params.transaction_type.toLowerCase().includes('buy') 
                    ? 'text-success-500' 
                    : 'text-error-500'
                }`}>
                  {getTransactionTypeText(trade.params.transaction_type)}
                </span>
              </div>
              
              <div className="mt-1">
                <AddressDisplay 
                  address={trade.params.token_address} 
                  maxLength={8} 
                  className="text-xs" 
                />
              </div>
              
              <div className="mt-1 grid grid-cols-2 gap-x-1 gap-y-1">
                <div>
                  <span className="text-gray-400">数量:</span>
                  <span className="ml-1">{formatNumber(trade.params.token_amount_ui)}</span>
                </div>
                <div>
                  <span className="text-gray-400">SOL:</span>
                  <span className="ml-1">{trade.params.min_sol_out_ui.toFixed(4)}</span>
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

export default RealtimeTradeHistory; 