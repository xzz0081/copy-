// 使用浏览器原生的EventTarget替代Node的EventEmitter
// 创建一个简单的事件发射器类

class EventEmitter {
  private events: Record<string, Array<(...args: any[]) => void>> = {};

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}

// WebSocket事件类型
export enum WebSocketEvents {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  MESSAGE = 'message',
  ERROR = 'error',
  TOKEN_PRICE = 'token_price'
}

// 代币价格类型
export interface TokenPrice {
  token: string;
  price: number;
}

// 代币价格缓存，用于存储最新价格
const tokenPriceCache: Record<string, number> = {};

// 创建事件发射器
const priceEventEmitter = new EventEmitter();

// WebSocket连接实例
let wsInstance: WebSocket | null = null;
let isConnected = false;
let reconnectAttempts = 0;
let reconnectTimer: number | null = null;

/**
 * 连接到WebSocket服务
 * @param url WebSocket服务URL
 */
export const connectWebSocket = (url: string): void => {
  // 如果已经连接，则不再重复连接
  if (isConnected && wsInstance) {
    return;
  }

  // 清除重连定时器
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    wsInstance = new WebSocket(url);

    // 连接打开
    wsInstance.onopen = () => {
      console.log('WebSocket连接已建立');
      isConnected = true;
      reconnectAttempts = 0;
      priceEventEmitter.emit(WebSocketEvents.CONNECTED);
    };

    // 接收消息
    wsInstance.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 更新价格缓存
        if (data.token && data.price !== undefined) {
          tokenPriceCache[data.token] = data.price;
          // 发出价格更新事件
          priceEventEmitter.emit(WebSocketEvents.TOKEN_PRICE, data);
          priceEventEmitter.emit(WebSocketEvents.MESSAGE, data);
        }
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
        priceEventEmitter.emit(WebSocketEvents.ERROR, '解析消息失败');
      }
    };

    // 连接关闭
    wsInstance.onclose = () => {
      console.log('WebSocket连接已关闭');
      isConnected = false;
      priceEventEmitter.emit(WebSocketEvents.DISCONNECTED);
      
      // 尝试重新连接
      if (reconnectAttempts < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`${delay / 1000}秒后尝试重新连接...`);
        
        reconnectTimer = window.setTimeout(() => {
          reconnectAttempts++;
          connectWebSocket(url);
        }, delay);
      }
    };

    // 连接错误
    wsInstance.onerror = (error) => {
      console.error('WebSocket连接错误:', error);
      priceEventEmitter.emit(WebSocketEvents.ERROR, error);
    };
  } catch (error) {
    console.error('创建WebSocket连接失败:', error);
    priceEventEmitter.emit(WebSocketEvents.ERROR, '创建连接失败');
  }
};

/**
 * 断开WebSocket连接
 */
export const disconnectWebSocket = (): void => {
  if (wsInstance) {
    wsInstance.close();
    wsInstance = null;
  }
  
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  isConnected = false;
  reconnectAttempts = 0;
};

/**
 * 获取指定代币的最新价格
 * @param tokenAddress 代币地址
 * @returns 代币价格，如果没有则返回0
 */
export const getTokenPrice = (tokenAddress: string): number => {
  return tokenPriceCache[tokenAddress] || 0;
};

/**
 * 获取WebSocket连接状态
 */
export const getWebSocketStatus = (): boolean => {
  return isConnected;
};

/**
 * 添加WebSocket事件监听
 * @param event 事件类型
 * @param listener 事件处理函数
 */
export const addWebSocketListener = (
  event: WebSocketEvents,
  listener: (...args: any[]) => void
): void => {
  priceEventEmitter.on(event, listener);
};

/**
 * 移除WebSocket事件监听
 * @param event 事件类型
 * @param listener 事件处理函数
 */
export const removeWebSocketListener = (
  event: WebSocketEvents,
  listener: (...args: any[]) => void
): void => {
  priceEventEmitter.off(event, listener);
};

export default {
  connectWebSocket,
  disconnectWebSocket,
  getTokenPrice,
  getWebSocketStatus,
  addWebSocketListener,
  removeWebSocketListener,
  WebSocketEvents
}; 