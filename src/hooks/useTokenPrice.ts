import { useState, useEffect, useRef } from 'react';
import { addWebSocketListener, removeWebSocketListener, getTokenPrice, WebSocketEvents } from '../services/websocket';

/**
 * 实时监听特定代币的价格
 * @param tokenAddress 代币地址
 * @returns 当前最新价格
 */
export function useTokenPrice(tokenAddress: string) {
  // 初始值从缓存获取
  const [price, setPrice] = useState<number>(() => {
    const initialPrice = getTokenPrice(tokenAddress);
    console.log(`[useTokenPrice] 初始化 ${tokenAddress.substring(0, 8)}... 价格: ${initialPrice}`);
    return initialPrice;
  });
  
  // 使用ref存储最新价格，避免闭包陷阱
  const priceRef = useRef(price);
  
  // 价格更新时同步ref值
  useEffect(() => {
    priceRef.current = price;
  }, [price]);

  useEffect(() => {
    // 创建价格更新处理函数
    const handlePriceUpdate = (data: any) => {
      // 只有当更新的是我们关心的代币时才更新状态
      if (data.token === tokenAddress) {
        // 避免不必要的更新
        if (data.price !== priceRef.current && data.price > 0) {
          console.log(`[useTokenPrice] 代币 ${tokenAddress.substring(0, 8)}... 价格更新: ${priceRef.current} -> ${data.price}`);
          setPrice(data.price);
        }
      }
    };

    // 立即从缓存获取最新价格并设置
    const currentPrice = getTokenPrice(tokenAddress);
    if (currentPrice > 0 && currentPrice !== priceRef.current) {
      console.log(`[useTokenPrice] 缓存中发现 ${tokenAddress.substring(0, 8)}... 的价格: ${currentPrice}`);
      setPrice(currentPrice);
    }

    // 添加价格更新监听
    console.log(`[useTokenPrice] 为 ${tokenAddress.substring(0, 8)}... 添加价格监听器`);
    addWebSocketListener(WebSocketEvents.TOKEN_PRICE, handlePriceUpdate);
    
    // 组件卸载时移除监听
    return () => {
      console.log(`[useTokenPrice] 移除 ${tokenAddress.substring(0, 8)}... 的价格监听器`);
      removeWebSocketListener(WebSocketEvents.TOKEN_PRICE, handlePriceUpdate);
    };
  }, [tokenAddress]);

  return price;
} 