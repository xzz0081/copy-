import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCcw } from 'lucide-react';
import { getTransactions, getSolPrice, PriceSource } from '../services/api';
import { TransactionsResponse, Transaction } from '../types';
import { addWebSocketListener, removeWebSocketListener, WebSocketEvents, getTokenPrice, getAllTokenPrices } from '../services/websocket';
import { calculateTransactionsProfits, formatProfit, formatProfitPercentage, formatNumber, calculateUsdValue, calculateTokenPriceUsd } from '../utils/profit';
import Spinner from '../components/ui/Spinner';
import AddressDisplay from '../components/ui/AddressDisplay';
import StatusBadge from '../components/ui/StatusBadge';
import PriceDisplay from '../components/ui/PriceDisplay';
import UsdPriceDisplay from '../components/ui/UsdPriceDisplay';
import TransactionRow from '../components/TransactionRow';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [processedTransactions, setProcessedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [inputWalletAddress, setInputWalletAddress] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const wsConnectedRef = useRef(wsConnected);
  const transactionsRef = useRef(transactions);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const updateTimeoutRef = useRef<number | null>(null);

  // 监听WebSocket事件
  const handleConnected = () => {
    setWsConnected(true);
    wsConnectedRef.current = true;
    toast.success('价格更新服务已连接');
  };

  const handleDisconnected = () => {
    setWsConnected(false);
    wsConnectedRef.current = false;
    toast.error('价格更新服务已断开');
  };

  // 批量处理代币价格更新
  const handleTokenPriceMessage = useCallback((data: any) => {
    // 使用节流技术，防止频繁更新
    if (updateTimeoutRef.current) {
      return; // 已经有待处理的更新，忽略此次更新
    }
    
    // 设置更新超时，最多500ms更新一次
    updateTimeoutRef.current = window.setTimeout(() => {
      // 只有当前有交易记录时才更新
      if (transactionsRef.current.length > 0) {
        updateTransactionsWithPrices();
      }
      
      // 更新时间戳并清除超时引用
      setLastUpdateTime(Date.now());
      updateTimeoutRef.current = null;
    }, 500);
  }, []);

  // 获取SOL价格
  const fetchSolPrice = async () => {
    try {
      setLoadingPrice(true);
      const price = await getSolPrice(PriceSource.OKX);
      setSolPrice(price);
      
      // 更新盈利计算
      if (transactionsRef.current.length > 0) {
        updateTransactionsWithPrices();
      }
    } catch (error) {
      console.error('获取SOL价格失败:', error);
    } finally {
      setLoadingPrice(false);
    }
  };

  // 获取SOL价格和监听WebSocket事件
  useEffect(() => {
    // 监听WebSocket事件
    addWebSocketListener(WebSocketEvents.CONNECTED, handleConnected);
    addWebSocketListener(WebSocketEvents.DISCONNECTED, handleDisconnected);
    addWebSocketListener(WebSocketEvents.MESSAGE, handleTokenPriceMessage);

    fetchSolPrice();
    
    // 组件卸载时清理
    return () => {
      removeWebSocketListener(WebSocketEvents.CONNECTED, handleConnected);
      removeWebSocketListener(WebSocketEvents.DISCONNECTED, handleDisconnected);
      removeWebSocketListener(WebSocketEvents.MESSAGE, handleTokenPriceMessage);
      
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, [handleTokenPriceMessage]);

  // 更新交易记录的价格 - 性能优化版
  const updateTransactionsWithPrices = useCallback(() => {
    if (transactionsRef.current.length === 0) return;
    
    // 获取所有当前的代币价格（使用Map优化查找）
    const allTokenPrices = getAllTokenPrices();
    
    // 为每条交易记录设置当前价格
    const updatedTransactions = transactionsRef.current.map(tx => {
      const tokenAddress = tx.token_address.toLowerCase();
      
      // 直接从Map中查找价格
      let websocketPrice = allTokenPrices.get(tokenAddress);
      
      // 如果没找到，尝试进行后缀匹配
      if (websocketPrice === undefined) {
        // 尝试添加pump后缀
        const addressWithPump = tokenAddress + 'pump';
        websocketPrice = allTokenPrices.get(addressWithPump);
        
        // 尝试移除pump后缀
        if (websocketPrice === undefined && tokenAddress.endsWith('pump')) {
          const addressWithoutPump = tokenAddress.slice(0, -4);
          websocketPrice = allTokenPrices.get(addressWithoutPump);
        }
        
        // 如果仍未找到，使用getTokenPrice进行完整匹配
        if (websocketPrice === undefined) {
          websocketPrice = getTokenPrice(tokenAddress);
        }
      }
      
      // 返回更新后的交易记录
      return { ...tx, current_price: websocketPrice ?? null };
    });
    
    // 计算盈利情况
    const processed = calculateTransactionsProfits(updatedTransactions, solPrice);
    setProcessedTransactions(processed);
  }, [solPrice]);

  // 处理交易记录更新
  useEffect(() => {
    transactionsRef.current = transactions;
    
    if (transactions.length > 0) {
      // 更新处理后的交易记录
      updateTransactionsWithPrices();
    } else {
      setProcessedTransactions([]);
    }
  }, [transactions, solPrice, updateTransactionsWithPrices]);

  // 手动刷新价格
  const refreshPrices = () => {
    console.log('手动刷新价格和交易记录...');
    fetchSolPrice();
    updateTransactionsWithPrices();
  };

  // 计算美元价值
  const calculateUsdValue = (tokenPrice: number): string => {
    if (!solPrice || tokenPrice === undefined) return '$ 0.00';
    // 直接使用原始价格计算，不做任何缩放或调整
    const usdValue = tokenPrice * solPrice;
    console.log(`价格计算 (原始值): ${tokenPrice} * ${solPrice} = ${usdValue}`);
    return `$ ${usdValue.toFixed(2)}`;
  };

  const fetchTransactions = async (wallet: string, page: number, limit: number) => {
    if (!wallet) return;
    
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const response = await getTransactions(wallet, limit, offset) as TransactionsResponse;
      
      if (response.success) {
        setTransactions(response.data);
        setTotalTransactions(response.total);
      } else {
        toast.error('获取交易历史失败');
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('获取交易历史失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!inputWalletAddress) {
      toast.error('请输入钱包地址');
      return;
    }
    setWalletAddress(inputWalletAddress);
    setCurrentPage(1);
    fetchTransactions(inputWalletAddress, 1, pageSize);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchTransactions(walletAddress, page, pageSize);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1);
    fetchTransactions(walletAddress, 1, newSize);
  };

  const exportToCSV = () => {
    if (processedTransactions.length === 0) {
      toast.error('没有可导出的数据');
      return;
    }

    // Create CSV header row
    const headers = [
      '时间',
      '类型',
      'Token地址',
      '数量',
      'SOL数量',
      '价格',
      '当前价格',
      '持仓盈利',
      '持仓盈利百分比',
      '交易盈利',
      '交易盈利百分比',
      '预期价格',
      '价格滑点',
      '状态',
      '钱包地址',
      '签名',
    ];

    // Format transaction data for CSV
    const data = processedTransactions.map((tx) => [
      tx.timestamp,
      tx.tx_type,
      tx.token_address,
      tx.amount.toString(),
      tx.sol_amount.toString(),
      tx.price.toString(),
      tx.current_price?.toString() || '',
      tx.position_profit?.toString() || '',
      tx.position_profit_percentage?.toString() || '',
      tx.profit?.toString() || '',
      tx.profit_percentage?.toString() || '',
      tx.expected_price.toString(),
      tx.price_slippage.toString(),
      tx.status,
      tx.wallet_address,
      tx.signature,
    ]);

    // Combine header and data rows
    const csvContent = [headers, ...data]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `交易历史_${walletAddress}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
    );
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('CSV文件已导出');
  };

  const formatDatetime = (isoString: string) => {
    try {
      return format(new Date(isoString), 'yyyy-MM-dd HH:mm:ss');
    } catch (error) {
      return isoString;
    }
  };

  const getTransactionTypeText = (type: string) => {
    if (type.toLowerCase().includes('buy')) return '买入';
    if (type.toLowerCase().includes('sell')) return '卖出';
    return type;
  };

  // TransactionRow组件
  const TransactionRow = ({ tx, solPrice, index }: { tx: Transaction; solPrice: number; index: number }) => {
    return (
      <tr className="border-b border-gray-700 hover:bg-gray-800/50">
        <td className="px-4 py-3 text-sm">
          {formatDatetime(tx.timestamp)}
        </td>
        <td className="px-4 py-3">
          <span className={`font-medium ${tx.tx_type.toLowerCase().includes('buy') ? 'text-success-500' : 'text-error-500'}`}>
            {getTransactionTypeText(tx.tx_type)}
          </span>
        </td>
        <td className="px-4 py-3">
          <AddressDisplay address={tx.token_address} />
        </td>
        <td className="px-4 py-3 text-right font-mono">
          {(tx.amount / 1000000).toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}
        </td>
        <td className="px-4 py-3 text-right font-mono">
          {tx.sol_amount.toLocaleString(undefined, { 
            minimumFractionDigits: 6, 
            maximumFractionDigits: 6 
          })}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="font-mono">{tx.price.toExponential(6)}</div>
          <div className="font-mono text-xs text-gray-400">
            {calculateUsdValue(tx.price)}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="font-mono">
            {tx.current_price ? tx.current_price.toExponential(6) : '-'}
          </div>
          {tx.current_price && (
            <div className="font-mono text-xs text-gray-400">
              {calculateUsdValue(tx.current_price)}
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className={`font-medium ${(tx.position_profit_percentage || 0) >= 0 ? 'text-success-500' : 'text-error-500'}`}>
            {formatProfitPercentage(tx.position_profit_percentage)}
          </div>
          <div className="text-xs text-gray-400">
            {formatProfit(tx.position_profit)}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          {tx.tx_type.toLowerCase().includes('sell') && (
            <>
              <div className={`font-medium ${(tx.profit_percentage || 0) >= 0 ? 'text-success-500' : 'text-error-500'}`}>
                {formatProfitPercentage(tx.profit_percentage)}
              </div>
              <div className="text-xs text-gray-400">
                {formatProfit(tx.profit)}
              </div>
            </>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <StatusBadge
            status={tx.status === 'confirmed' ? 'success' : tx.status === 'pending' ? 'warning' : 'error'}
            text={tx.status === 'confirmed' ? '已确认' : tx.status === 'pending' ? '处理中' : '失败'}
            size="sm"
          />
        </td>
      </tr>
    );
  };

  const totalPages = Math.ceil(totalTransactions / pageSize);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">交易历史</h1>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${wsConnected ? 'text-success-500' : 'text-error-500'}`}>
            {wsConnected ? (
              <>
                <Wifi className="inline-block w-4 h-4 mr-1" />
                价格更新已连接
              </>
            ) : (
              <>
                <WifiOff className="inline-block w-4 h-4 mr-1" />
                价格更新已断开
              </>
            )}
          </span>
          <button 
            className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" 
            onClick={refreshPrices}
            disabled={loadingPrice}
          >
            <RefreshCcw className="w-3 h-3" />
            {loadingPrice ? '刷新中...' : '刷新价格'}
          </button>
        </div>
      </div>
      
      {/* SOL价格显示 */}
      <div className="mb-4 text-sm text-gray-300">
        SOL价格: ${solPrice.toFixed(2)} USD
        <span className="text-xs text-gray-400 ml-2">
          最后更新: {new Date(lastUpdateTime).toLocaleTimeString()}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-4">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="relative">
            <input
              type="text"
              className="bg-gray-800 border border-gray-700 rounded p-2 pl-8 w-full sm:w-96"
              placeholder="输入钱包地址"
              value={inputWalletAddress}
              onChange={(e) => setInputWalletAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
          </div>
          <button
            className="bg-primary-500 hover:bg-primary-600 text-white rounded px-4 py-2"
            onClick={handleSearch}
          >
            查询
          </button>
        </div>

        {transactions.length > 0 && (
          <button
            className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white rounded px-4 py-2"
            onClick={exportToCSV}
          >
            <Download className="w-4 h-4" />
            导出CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : transactions.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full bg-gray-900 rounded overflow-hidden">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left">时间</th>
                  <th className="px-4 py-3 text-left">类型</th>
                  <th className="px-4 py-3 text-left">代币地址</th>
                  <th className="px-4 py-3 text-right">数量</th>
                  <th className="px-4 py-3 text-right">SOL金额</th>
                  <th className="px-4 py-3 text-right">历史价格</th>
                  <th className="px-4 py-3 text-right">当前价格</th>
                  <th className="px-4 py-3 text-right">当前盈亏</th>
                  <th className="px-4 py-3 text-right">实现盈亏</th>
                  <th className="px-4 py-3 text-center">状态</th>
                </tr>
              </thead>
              <tbody>
                {processedTransactions.map((tx, index) => (
                  <TransactionRow 
                    key={tx.signature} 
                    tx={tx} 
                    solPrice={solPrice} 
                    index={index}
                  />
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-400">
              显示 {processedTransactions.length} 条交易，共 {totalTransactions} 条
            </div>
            <div className="flex items-center gap-2">
              <select
                className="bg-gray-800 border border-gray-700 rounded p-2"
                value={pageSize}
                onChange={handlePageSizeChange}
              >
                <option value="10">10条/页</option>
                <option value="20">20条/页</option>
                <option value="50">50条/页</option>
                <option value="100">100条/页</option>
              </select>
              
              <div className="flex">
                <button
                  className="bg-gray-800 hover:bg-gray-700 text-white rounded-l px-3 py-2 disabled:opacity-50"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="bg-gray-900 text-white px-4 py-2 border-x border-gray-700">
                  {currentPage}
                </span>
                <button
                  className="bg-gray-800 hover:bg-gray-700 text-white rounded-r px-3 py-2 disabled:opacity-50"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage * pageSize >= totalTransactions}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : walletAddress ? (
        <div className="bg-gray-800 rounded p-8 text-center">
          <p className="text-lg text-gray-300">没有找到交易记录</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded p-8 text-center">
          <p className="text-lg text-gray-300">请输入钱包地址查询交易记录</p>
        </div>
      )}
    </div>
  );
}