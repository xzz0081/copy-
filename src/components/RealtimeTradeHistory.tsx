import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import AddressDisplay from './ui/AddressDisplay';
import PriceDisplay from './ui/PriceDisplay';
import { formatNumber } from '../utils/profit';
import Spinner from './ui/Spinner';
import { 
  WebSocketEvents, 
  addWebSocketListener, 
  removeWebSocketListener,
  getWebSocketStatus
} from '../services/websocket';

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
  const [connected, setConnected] = useState(getWebSocketStatus());
  const [error, setError] = useState<string | null>(null);
  const maxTrades = 50; // 减少最大显示数量，适合侧边栏
  
  // 使用全局WebSocket服务
  useEffect(() => {
    console.log('初始化交易历史监听...');
    
    // 连接状态处理函数
    const handleConnected = () => {
      console.log('WebSocket连接成功');
      setConnected(true);
      setError(null);
    };
    
    const handleDisconnected = () => {
      console.log('WebSocket连接断开');
      setConnected(false);
      setError('连接已断开，正在重连...');
    };
    
    // 处理交易历史消息
    const handleTradeMessage = (data: any) => {
      try {
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
        console.error('处理交易消息失败:', err);
      }
    };
    
    // 添加事件监听
    addWebSocketListener(WebSocketEvents.CONNECTED, handleConnected);
    addWebSocketListener(WebSocketEvents.DISCONNECTED, handleDisconnected);
    addWebSocketListener(WebSocketEvents.MESSAGE, handleTradeMessage);
    
    // 设置初始连接状态
    setConnected(getWebSocketStatus());
    
    // 清理函数
    return () => {
      console.log('清理交易历史监听...');
      removeWebSocketListener(WebSocketEvents.CONNECTED, handleConnected);
      removeWebSocketListener(WebSocketEvents.DISCONNECTED, handleDisconnected);
      removeWebSocketListener(WebSocketEvents.MESSAGE, handleTradeMessage);
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