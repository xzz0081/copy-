import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, RotateCw, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { checkSystemHealth } from '../services/api';
import { SystemHealthResponse } from '../types';
import Spinner from '../components/ui/Spinner';
import { format } from 'date-fns';
import { getWebSocketStatus, getWebSocketStats, addWebSocketListener, WebSocketEvents, WebSocketStats } from '../services/websocket';

export default function SystemHealth() {
  const [healthStatus, setHealthStatus] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [healthHistory, setHealthHistory] = useState<SystemHealthResponse[]>([]);
  const [wsStats, setWsStats] = useState<WebSocketStats | null>(null);

  const checkHealth = async () => {
    try {
      setLoading(true);
      const status = await checkSystemHealth();
      setHealthStatus(status);
      setLastChecked(new Date());
      
      // Add to history, limit to last 10 checks
      setHealthHistory((prev) => {
        const newHistory = [status, ...prev];
        return newHistory.slice(0, 10);
      });
    } catch (error) {
      console.error('Error checking health:', error);
      setHealthStatus({
        status: 500,
        data: { message: 'Failed to check health' },
        responseTime: 0,
        error: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    
    // Set up interval to check every 30 seconds
    const interval = setInterval(() => {
      checkHealth();
    }, 30000);
    
    // 监听WebSocket统计信息更新
    const handleStatsUpdate = (stats: WebSocketStats) => {
      setWsStats(stats);
    };
    
    // 初始获取WebSocket状态
    setWsStats(getWebSocketStats());
    
    // 添加WebSocket统计信息更新事件监听
    addWebSocketListener(WebSocketEvents.STATS_UPDATED, handleStatsUpdate);
    
    return () => {
      clearInterval(interval);
      // 注意：这里不需要移除WebSocket监听器，因为在组件卸载时整个应用可能还在使用
    };
  }, []);

  const isHealthy = healthStatus && !healthStatus.error && healthStatus.status < 400;
  
  const getStatusColor = (status: SystemHealthResponse) => {
    if (status.error || status.status >= 400) return 'text-error-500';
    if (status.responseTime > 1000) return 'text-warning-500';
    return 'text-success-500';
  };

  const getStatusText = (status: SystemHealthResponse) => {
    if (status.error || status.status >= 400) return '服务不可用';
    if (status.responseTime > 1000) return '响应缓慢';
    return '正常';
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd HH:mm:ss');
  };

  // 格式化WebSocket连接状态的连接时间
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系统健康检查</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">系统状态</h2>
            <button 
              onClick={checkHealth} 
              disabled={loading}
              className="btn btn-sm btn-outline"
            >
              {loading ? <Spinner size="sm" /> : <RotateCw className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-gray-700">
              {loading ? (
                <Spinner size="lg" />
              ) : (
                <div className={`text-6xl ${getStatusColor(healthStatus || { status: 500, data: {}, responseTime: 0, error: true })}`}>
                  {isHealthy ? (
                    <CheckCircle className="h-16 w-16" />
                  ) : (
                    <AlertCircle className="h-16 w-16" />
                  )}
                </div>
              )}
            </div>

            <div className="text-center">
              <h3 className={`text-2xl font-bold ${getStatusColor(healthStatus || { status: 500, data: {}, responseTime: 0, error: true })}`}>
                {healthStatus ? getStatusText(healthStatus) : '检查中...'}
              </h3>
              {healthStatus && (
                <p className="mt-1 text-gray-400">
                  HTTP {healthStatus.status} | {healthStatus.responseTime}ms
                </p>
              )}
            </div>

            {lastChecked && (
              <p className="text-sm text-gray-400">
                最后检查时间: {formatDateTime(lastChecked)}
              </p>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 text-xl font-semibold">价格推送状态</h2>
          
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-full border-2 ${wsStats?.isConnected ? 'border-success-500' : 'border-error-500'}`}>
                {wsStats?.isConnected ? (
                  <Wifi className="h-8 w-8 text-success-500" />
                ) : (
                  <WifiOff className="h-8 w-8 text-error-500" />
                )}
              </div>
            </div>
            
            <div className="text-center">
              <h3 className={`text-xl font-bold ${wsStats?.isConnected ? 'text-success-500' : 'text-error-500'}`}>
                {wsStats?.isConnected ? '已连接' : '未连接'}
              </h3>
              {wsStats?.isConnected && wsStats.connectionStartTime && (
                <p className="text-sm text-gray-400">
                  已连接 {formatDuration(wsStats.uptime)}
                </p>
              )}
            </div>
            
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-gray-400">总连接次数</h4>
                  <RefreshCw className="h-3 w-3 text-gray-400" />
                </div>
                <p className="mt-1 text-lg font-semibold">{wsStats?.totalConnections || 0}</p>
              </div>
              
              <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-gray-400">断开连接次数</h4>
                  <WifiOff className="h-3 w-3 text-gray-400" />
                </div>
                <p className="mt-1 text-lg font-semibold">{wsStats?.disconnections || 0}</p>
              </div>
              
              <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-gray-400">消息接收数</h4>
                  <Activity className="h-3 w-3 text-gray-400" />
                </div>
                <p className="mt-1 text-lg font-semibold">{wsStats?.currentSessionMessages || 0}</p>
              </div>
              
              <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-gray-400">心跳包发送数</h4>
                  <Activity className="h-3 w-3 text-gray-400" />
                </div>
                <p className="mt-1 text-lg font-semibold">{wsStats?.heartbeatsSent || 0}</p>
              </div>
            </div>
            
            <div className="mt-2 text-xs text-gray-400">
              {wsStats?.lastConnectedTime && (
                <div className="flex justify-between">
                  <span>最后连接时间:</span>
                  <span>{formatDateTime(wsStats.lastConnectedTime)}</span>
                </div>
              )}
              {wsStats?.lastDisconnectedTime && (
                <div className="flex justify-between">
                  <span>最后断开时间:</span>
                  <span>{formatDateTime(wsStats.lastDisconnectedTime)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 text-xl font-semibold">检查历史</h2>
        
        {healthHistory.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-gray-400">
            <p>暂无历史记录</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-2 text-left">时间</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-right">响应时间</th>
                </tr>
              </thead>
              <tbody>
                {healthHistory.map((status, index) => (
                  <tr key={index} className="border-b border-gray-700">
                    <td className="px-4 py-2 text-sm">
                      {formatDateTime(new Date(Date.now() - index * 30000))}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 ${getStatusColor(status)}`}>
                        {status.error || status.status >= 400 ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        {getStatusText(status)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {status.responseTime}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          <p>自动检查间隔: 30秒</p>
          <p>保留最近 10 次检查</p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 text-xl font-semibold">系统性能指标</h2>
        
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400">API 响应时间</h3>
              <Activity className="h-4 w-4 text-primary-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {healthStatus ? `${healthStatus.responseTime}ms` : '---'}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-700">
              <div 
                className={`h-full ${
                  healthStatus && healthStatus.responseTime < 200 
                    ? 'bg-success-500' 
                    : healthStatus && healthStatus.responseTime < 1000 
                    ? 'bg-warning-500' 
                    : 'bg-error-500'
                }`}
                style={{ 
                  width: healthStatus 
                    ? `${Math.min(100, (healthStatus.responseTime / 2000) * 100)}%` 
                    : '0%' 
                }}
              ></div>
            </div>
          </div>
          
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400">系统运行状态</h3>
              <div className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-success-500 animate-ping-slow' : 'bg-error-500'}`}></div>
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {isHealthy ? '在线' : '离线'}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              {isHealthy 
                ? '所有系统正常运行' 
                : '系统当前不可用，请检查服务器'}
            </p>
          </div>
          
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400">价格推送</h3>
              <div className={`h-2 w-2 rounded-full ${wsStats?.isConnected ? 'bg-success-500 animate-ping-slow' : 'bg-error-500'}`}></div>
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {wsStats?.isConnected ? '在线' : '离线'}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              {wsStats?.isConnected 
                ? `当前会话已接收 ${wsStats.currentSessionMessages} 条消息` 
                : '价格推送服务未连接'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}