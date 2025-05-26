import { useState, useEffect } from 'react';
import { addWebSocketListener, removeWebSocketListener, getTokenPrice, WebSocketEvents } from '../services/websocket';

/**
 * 实时监听特定代币的价格
 * @param tokenAddress 代币地址
 * @returns 当前最新价格
 */
export function useTokenPrice(tokenAddress: string) {
  // 初始值从缓存获取
  const [price, setPrice] = useState<number>(() => getTokenPrice(tokenAddress));

  useEffect(() => {
    // 创建价格更新处理函数
    const handlePriceUpdate = (data: any) => {
      // 只有当更新的是我们关心的代币时才更新状态
      if (data.token === tokenAddress) {
        console.log(`代币 ${tokenAddress.substring(0, 8)}... 价格更新: ${data.price}`);
        setPrice(data.price);
      }
    };

    // 立即从缓存获取最新价格并设置
    const currentPrice = getTokenPrice(tokenAddress);
    if (currentPrice > 0) {
      setPrice(currentPrice);
    }

    // 添加价格更新监听
    addWebSocketListener(WebSocketEvents.TOKEN_PRICE, handlePriceUpdate);
    
    // 组件卸载时移除监听
    return () => {
      removeWebSocketListener(WebSocketEvents.TOKEN_PRICE, handlePriceUpdate);
    };
  }, [tokenAddress]);

  return price;
} 