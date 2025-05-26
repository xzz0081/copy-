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
  TOKEN_PRICE = 'token_price',
  STATS_UPDATED = 'stats_updated'  // 新增：统计信息更新事件
}

// 代币价格类型
export interface TokenPrice {
  token: string;
  price: number;
}

// WebSocket统计信息类型
export interface WebSocketStats {
  totalConnections: number;    // 总连接次数
  disconnections: number;      // 断开连接次数
  connectionErrors: number;    // 连接错误次数
  messagesReceived: number;    // 接收到的消息数
  currentSessionMessages: number; // 当前会话接收的消息数
  heartbeatsSent: number;      // 发送的心跳包数量
  lastConnectedTime: Date | null; // 最后一次连接时间
  lastDisconnectedTime: Date | null; // 最后一次断开连接时间
  uptime: number;              // 连接保持时间(秒)
  connectionStartTime: Date | null; // 当前连接开始时间
  isConnected: boolean;        // 当前是否连接
}

// 代币价格缓存，使用Map提高查找效率
const tokenPriceCache = new Map<string, number>();

// 地址前缀索引，用于快速查找匹配的地址
const tokenPrefixIndex = new Map<string, string[]>();

// 创建事件发射器
const priceEventEmitter = new EventEmitter();

// WebSocket状态管理
let wsInstance: WebSocket | null = null;
let isConnected = false;
let isConnecting = false; // 新增，防止重复连接尝试
let reconnectAttempts = 0;
let reconnectTimer: number | null = null;
let heartbeatTimer: number | null = null;
let connectionCheckTimer: number | null = null;
let initialConnectionEstablished = false; // 是否已建立过初始连接
let uptimeTimer: number | null = null; // 用于计算连接保持时间

// 保存WebSocket URL
let savedWsUrl = '';

// WebSocket统计信息
const wsStats: WebSocketStats = {
  totalConnections: 0,
  disconnections: 0,
  connectionErrors: 0,
  messagesReceived: 0,
  currentSessionMessages: 0,
  heartbeatsSent: 0,
  lastConnectedTime: null,
  lastDisconnectedTime: null,
  uptime: 0,
  connectionStartTime: null,
  isConnected: false
};

// 更新并发布统计信息
const updateStats = (updates: Partial<WebSocketStats> = {}) => {
  Object.assign(wsStats, updates);
  
  // 更新连接状态
  wsStats.isConnected = isConnected;
  
  // 如果当前已连接，计算uptime
  if (isConnected && wsStats.connectionStartTime) {
    wsStats.uptime = Math.floor((new Date().getTime() - wsStats.connectionStartTime.getTime()) / 1000);
  }
  
  // 发布统计信息更新事件
  priceEventEmitter.emit(WebSocketEvents.STATS_UPDATED, { ...wsStats });
};

// 启动uptime计时器
const startUptimeTimer = () => {
  if (uptimeTimer) {
    window.clearInterval(uptimeTimer);
  }
  
  // 每秒更新一次uptime
  uptimeTimer = window.setInterval(() => {
    if (isConnected) {
      updateStats();
    }
  }, 1000);
};

// 停止uptime计时器
const stopUptimeTimer = () => {
  if (uptimeTimer) {
    window.clearInterval(uptimeTimer);
    uptimeTimer = null;
  }
};

// 浏览器页面可见性变化监听
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    // 页面变为可见时，检查连接
    if (!isConnected && !isConnecting) {
      // 减少日志输出
      connectWebSocket(savedWsUrl);
    }
  }
};

// 心跳包数据（简单的PING消息）
const HEARTBEAT_MSG = JSON.stringify({ type: 'ping' });

/**
 * 发送心跳包以保持连接
 */
const sendHeartbeat = () => {
  if (wsInstance && isConnected) {
    try {
      wsInstance.send(HEARTBEAT_MSG);
      // 减少日志，不再打印每次心跳
      
      // 更新心跳统计
      updateStats({ 
        heartbeatsSent: wsStats.heartbeatsSent + 1 
      });
    } catch (error) {
      console.error('发送心跳包失败');
      // 如果发送失败，可能连接已中断，尝试重连
      handleConnectionFailure();
    }
  }
};

/**
 * 启动心跳检测
 */
const startHeartbeat = () => {
  // 清除现有心跳
  stopHeartbeat();
  
  // 每10秒发送一次心跳包
  heartbeatTimer = window.setInterval(sendHeartbeat, 10000);
};

/**
 * 停止心跳检测
 */
const stopHeartbeat = () => {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

/**
 * 启动连接状态检查
 */
const startConnectionCheck = () => {
  // 清除现有检查
  stopConnectionCheck();
  
  // 每60秒检查一次连接状态
  connectionCheckTimer = window.setInterval(() => {
    if (!isConnected && !isConnecting && savedWsUrl) {
      // 减少日志输出
      connectWebSocket(savedWsUrl);
    }
  }, 60000);
};

/**
 * 停止连接状态检查
 */
const stopConnectionCheck = () => {
  if (connectionCheckTimer) {
    window.clearInterval(connectionCheckTimer);
    connectionCheckTimer = null;
  }
};

/**
 * 处理连接失败
 */
const handleConnectionFailure = () => {
  isConnected = false;
  isConnecting = false;
  
  const disconnectedTime = new Date();
  
  // 更新统计信息
  updateStats({
    disconnections: wsStats.disconnections + 1,
    lastDisconnectedTime: disconnectedTime,
    isConnected: false,
    currentSessionMessages: 0 // 重置当前会话消息计数
  });
  
  // 停止uptime计时器
  stopUptimeTimer();
  
  if (wsInstance) {
    try {
      wsInstance.close();
    } catch (e) {
      // 忽略关闭错误
    }
    wsInstance = null;
  }
  
  priceEventEmitter.emit(WebSocketEvents.DISCONNECTED);
  
  // 如果需要，安排重连
  if (savedWsUrl) {
    scheduleReconnect();
  }
};

/**
 * 安排重连
 */
const scheduleReconnect = () => {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
  }
  
  // 确保有URL可用于重连
  if (!savedWsUrl) {
    console.error('无法重连：WebSocket URL未保存');
    return;
  }
  
  if (reconnectAttempts < 10) { // 最多尝试10次
    // 使用指数退避策略，但设置上限
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
    // 减少日志，简化输出
    console.log(`${delay / 1000}秒后尝试重连 (${reconnectAttempts + 1}/10)`);
    
    reconnectTimer = window.setTimeout(() => {
      reconnectAttempts++;
      // 确保使用保存的URL进行重连
      if (savedWsUrl) {
        connectWebSocket(savedWsUrl);
      } else {
        console.error('重连失败：WebSocket URL已丢失');
      }
    }, delay);
  } else if (initialConnectionEstablished) {
    // 如果之前连接成功过，重置重连次数并安排一个长时间后的重连
    console.log('达到最大重连次数，将在2分钟后再次尝试');
    reconnectTimer = window.setTimeout(() => {
      reconnectAttempts = 0;
      // 确保使用保存的URL进行重连
      if (savedWsUrl) {
        connectWebSocket(savedWsUrl);
      } else {
        console.error('重连失败：WebSocket URL已丢失');
      }
    }, 120000); // 2分钟后再次尝试
  }
};

/**
 * 更新代币价格缓存和索引
 * @param tokenAddress 代币地址
 * @param price 价格
 */
const updateTokenPriceCache = (tokenAddress: string, price: number) => {
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // 更新价格缓存
  tokenPriceCache.set(normalizedAddress, price);
  
  // 更新索引
  for (let prefixLength = 8; prefixLength <= 12; prefixLength += 4) {
    if (normalizedAddress.length >= prefixLength) {
      const prefix = normalizedAddress.substring(0, prefixLength);
      
      if (!tokenPrefixIndex.has(prefix)) {
        tokenPrefixIndex.set(prefix, []);
      }
      
      const addresses = tokenPrefixIndex.get(prefix);
      if (addresses && !addresses.includes(normalizedAddress)) {
        addresses.push(normalizedAddress);
      }
    }
  }
};

/**
 * 连接到WebSocket服务
 * @param url WebSocket服务URL
 */
export const connectWebSocket = (url: string): void => {
  // 保存URL以便于重连
  if (url) {
    savedWsUrl = url;
  } else if (!savedWsUrl) {
    console.error('未提供WebSocket URL');
    return;
  }
  
  // 如果已经连接或正在连接中，则不再重复连接
  if ((isConnected && wsInstance) || isConnecting) {
    return;
  }
  
  isConnecting = true;
  
  // 清除重连定时器
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    console.log('正在连接WebSocket...');
    // 始终使用保存的URL，确保URL不会丢失
    wsInstance = new WebSocket(savedWsUrl);

    // 设置连接超时
    const connectionTimeout = window.setTimeout(() => {
      if (isConnecting && !isConnected) {
        console.error('WebSocket连接超时');
        isConnecting = false;
        
        // 更新统计信息 - 连接错误
        updateStats({
          connectionErrors: wsStats.connectionErrors + 1
        });
        
        if (wsInstance) {
          try {
            wsInstance.close();
          } catch (e) {
            // 忽略关闭错误
          }
          wsInstance = null;
        }
        scheduleReconnect();
      }
    }, 10000); // 10秒连接超时

    // 连接打开
    wsInstance.onopen = () => {
      console.log('WebSocket连接已建立');
      isConnected = true;
      isConnecting = false;
      initialConnectionEstablished = true;
      reconnectAttempts = 0;
      
      const connectedTime = new Date();
      
      // 更新统计信息
      updateStats({
        totalConnections: wsStats.totalConnections + 1,
        lastConnectedTime: connectedTime,
        connectionStartTime: connectedTime,
        isConnected: true,
        currentSessionMessages: 0 // 重置当前会话消息计数
      });
      
      // 启动uptime计时器
      startUptimeTimer();
      
      // 清除连接超时
      window.clearTimeout(connectionTimeout);
      
      // 启动心跳
      startHeartbeat();
      
      priceEventEmitter.emit(WebSocketEvents.CONNECTED);
    };

    // 接收消息
    wsInstance.onmessage = (event) => {
      try {
        // 解析消息数据
        const data = JSON.parse(event.data);
        
        // 更新统计信息 - 接收消息
        updateStats({
          messagesReceived: wsStats.messagesReceived + 1,
          currentSessionMessages: wsStats.currentSessionMessages + 1
        });
        
        // 处理心跳响应
        if (data.type === 'pong') {
          return;
        }
        
        // 处理价格更新消息，兼容多种格式
        // 格式1: {type: 'price_update', token: '...', price: ...}
        // 格式2: {price: ..., token: '...'}
        if ((data.type === 'price_update' && data.token && data.price !== undefined) ||
            (!data.type && data.token && data.price !== undefined)) {
          
          const tokenAddress = data.token.toLowerCase();
          const price = parseFloat(data.price);
          
          // 更新价格缓存和索引
          updateTokenPriceCache(tokenAddress, price);
          
          // 始终发送MESSAGE事件，包含完整数据
          priceEventEmitter.emit(WebSocketEvents.MESSAGE, data);
          
          // 为兼容性保留TOKEN_PRICE事件
          priceEventEmitter.emit(WebSocketEvents.TOKEN_PRICE, {
            token: data.token,
            price: data.price
          });
        } else {
          // 其他类型消息也发送MESSAGE事件
          priceEventEmitter.emit(WebSocketEvents.MESSAGE, data);
        }
      } catch (error) {
        console.error('解析WebSocket消息失败');
        priceEventEmitter.emit(WebSocketEvents.ERROR, '解析消息失败');
      }
    };

    // 连接关闭
    wsInstance.onclose = (event) => {
      // 清除连接超时
      window.clearTimeout(connectionTimeout);
      
      console.log(`WebSocket连接已关闭: Code=${event.code}`);
      isConnected = false;
      isConnecting = false;
      
      const disconnectedTime = new Date();
      
      // 更新统计信息
      updateStats({
        disconnections: wsStats.disconnections + 1,
        lastDisconnectedTime: disconnectedTime,
        isConnected: false,
        currentSessionMessages: 0 // 重置当前会话消息计数
      });
      
      // 停止uptime计时器
      stopUptimeTimer();
      
      // 停止心跳
      stopHeartbeat();
      
      priceEventEmitter.emit(WebSocketEvents.DISCONNECTED);
      
      // 如果不是正常关闭，则尝试重新连接
      if (event.code !== 1000) {
        scheduleReconnect();
      }
    };

    // 连接错误
    wsInstance.onerror = (error) => {
      console.error('WebSocket连接错误');
      
      // 更新统计信息 - 连接错误
      updateStats({
        connectionErrors: wsStats.connectionErrors + 1
      });
      
      priceEventEmitter.emit(WebSocketEvents.ERROR, error);
      
      // 让onclose处理重连
    };
  } catch (error) {
    console.error('创建WebSocket连接失败');
    
    // 更新统计信息 - 连接错误
    updateStats({
      connectionErrors: wsStats.connectionErrors + 1
    });
    
    priceEventEmitter.emit(WebSocketEvents.ERROR, '创建连接失败');
    isConnecting = false;
    scheduleReconnect();
  }
};

/**
 * 初始化WebSocket服务
 * 设置页面可见性事件监听和连接检查
 */
export const initializeWebSocketService = (): void => {
  // 添加页面可见性变化监听
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // 启动连接状态检查
  startConnectionCheck();
  
  // 初始化统计信息
  updateStats({
    totalConnections: 0,
    disconnections: 0,
    connectionErrors: 0,
    messagesReceived: 0,
    currentSessionMessages: 0,
    heartbeatsSent: 0,
    lastConnectedTime: null,
    lastDisconnectedTime: null,
    uptime: 0,
    connectionStartTime: null,
    isConnected: false
  });
};

/**
 * 断开WebSocket连接
 */
export const disconnectWebSocket = (): void => {
  console.log('主动断开WebSocket连接');
  
  if (wsInstance) {
    try {
      wsInstance.close(1000, 'User requested disconnect');
    } catch (e) {
      // 忽略关闭错误
    }
    wsInstance = null;
  }
  
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // 停止uptime计时器
  stopUptimeTimer();
  
  // 停止心跳和连接检查
  stopHeartbeat();
  stopConnectionCheck();
  
  // 移除页面可见性监听
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  isConnected = false;
  isConnecting = false;
  reconnectAttempts = 0;
  // 保留savedWsUrl，除非明确要求不再重连
  // savedWsUrl = '';
};

/**
 * 获取WebSocket统计信息
 * @returns WebSocket统计信息对象
 */
export const getWebSocketStats = (): WebSocketStats => {
  // 返回统计信息的副本
  return { ...wsStats };
};

/**
 * 获取指定代币的最新价格
 * @param tokenAddress 代币地址
 * @returns 代币价格，如果没有则返回0
 */
export const getTokenPrice = (tokenAddress: string): number => {
  if (!tokenAddress) return 0;
  
  // 统一转为小写
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // 直接匹配 - 使用Map优化性能
  const price = tokenPriceCache.get(normalizedAddress);
  if (price !== undefined) {
    return price;
  }
  
  // 尝试添加pump后缀匹配
  const addressWithPump = normalizedAddress + 'pump';
  const priceWithPump = tokenPriceCache.get(addressWithPump);
  if (priceWithPump !== undefined) {
    return priceWithPump;
  }
  
  // 尝试去除pump后缀匹配
  if (normalizedAddress.endsWith('pump')) {
    const addressWithoutPump = normalizedAddress.slice(0, -4);
    const priceWithoutPump = tokenPriceCache.get(addressWithoutPump);
    if (priceWithoutPump !== undefined) {
      return priceWithoutPump;
    }
  }
  
  // 尝试使用前缀索引进行匹配
  for (let prefixLength = 8; prefixLength <= 12; prefixLength += 4) {
    if (normalizedAddress.length >= prefixLength) {
      const prefix = normalizedAddress.substring(0, prefixLength);
      const candidateAddresses = tokenPrefixIndex.get(prefix);
      
      if (candidateAddresses && candidateAddresses.length > 0) {
        // 返回第一个匹配的地址对应的价格
        const matchAddress = candidateAddresses[0];
        const matchPrice = tokenPriceCache.get(matchAddress);
        if (matchPrice !== undefined) {
          return matchPrice;
        }
      }
    }
  }
  
  return 0;
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

/**
 * 批量处理价格更新，返回所有已更新的代币地址和价格
 * @returns 价格更新Map
 */
export const getAllTokenPrices = (): Map<string, number> => {
  return new Map(tokenPriceCache);
};

export default {
  connectWebSocket,
  disconnectWebSocket,
  initializeWebSocketService,
  getTokenPrice,
  getAllTokenPrices,
  getWebSocketStatus,
  getWebSocketStats,
  addWebSocketListener,
  removeWebSocketListener,
  WebSocketEvents
}; 