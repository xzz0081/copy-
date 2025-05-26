import React, { useState, useEffect, useRef } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { getTransactions, getSolPrice, PriceSource } from '../services/api';
import { TransactionsResponse, Transaction } from '../types';
import { addWebSocketListener, removeWebSocketListener, WebSocketEvents } from '../services/websocket';
import { calculateTransactionsProfits, formatProfit, formatProfitPercentage, formatNumber, calculateUsdValue, calculateTokenPriceUsd } from '../utils/profit';
import Spinner from '../components/ui/Spinner';
import AddressDisplay from '../components/ui/AddressDisplay';
import StatusBadge from '../components/ui/StatusBadge';
import PriceDisplay from '../components/ui/PriceDisplay';
import UsdPriceDisplay from '../components/ui/UsdPriceDisplay';
import TransactionRow from '../components/TransactionRow';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// 代币价格缓存
const tokenPriceCache: Record<string, number> = {};

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

  // 初始化WebSocket连接监听
  useEffect(() => {
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

    // 处理代币价格更新
    const handleTokenPriceMessage = (data: any) => {
      // 处理不同格式的价格消息
      // 1. {type: 'token_price', token: '...', price: ...} 格式
      // 2. {price: ..., token: '...'} 格式 (直接从WebSocket收到)
      if ((data.type === 'token_price' && data.token && data.price !== undefined) || 
          (!data.type && data.token && data.price !== undefined)) {
        
        const tokenAddress = data.token.toLowerCase();
        const price = parseFloat(data.price);
        
        // 打印接收到的代币信息
        console.log(`接收到代币价格更新: ${tokenAddress} = ${price}`);
        
        // 更新缓存
        tokenPriceCache[tokenAddress] = price;
        
        // 如果当前有交易记录，尝试匹配并更新
        if (transactionsRef.current.length > 0) {
          // 检查是否有匹配的代币地址
          const hasMatchingToken = transactionsRef.current.some(tx => {
            const txTokenAddress = tx.token_address.toLowerCase();
            
            // 精确匹配
            if (txTokenAddress === tokenAddress) {
              return true;
            }
            
            // pump后缀匹配
            if (txTokenAddress.endsWith('pump') && tokenAddress === txTokenAddress.slice(0, -4)) {
              return true;
            }
            
            if (!txTokenAddress.endsWith('pump') && tokenAddress === txTokenAddress + 'pump') {
              return true;
            }
            
            // 部分匹配（前8个字符）
            if (txTokenAddress.startsWith(tokenAddress.substring(0, 8)) ||
                tokenAddress.startsWith(txTokenAddress.substring(0, 8))) {
              return true;
            }
            
            return false;
          });
          
          if (hasMatchingToken) {
            console.log(`找到匹配的代币: ${tokenAddress}，更新UI...`);
            updateTransactionsWithPrices();
          }
        }
      }
    };

    // 获取SOL价格
    fetchSolPrice();

    addWebSocketListener(WebSocketEvents.CONNECTED, handleConnected);
    addWebSocketListener(WebSocketEvents.DISCONNECTED, handleDisconnected);
    addWebSocketListener(WebSocketEvents.MESSAGE, handleTokenPriceMessage);

    // 组件卸载时只移除监听器，不断开连接
    return () => {
      removeWebSocketListener(WebSocketEvents.CONNECTED, handleConnected);
      removeWebSocketListener(WebSocketEvents.DISCONNECTED, handleDisconnected);
      removeWebSocketListener(WebSocketEvents.MESSAGE, handleTokenPriceMessage);
    };
  }, []);

  // 获取代币当前价格
  const getTokenPrice = (tokenAddress: string): number => {
    if (!tokenAddress) return 0;
    
    // 尝试直接匹配
    const normalizedAddress = tokenAddress.toLowerCase();
    
    console.log(`尝试获取代币 ${normalizedAddress} 的价格`);
    console.log(`当前价格缓存中有 ${Object.keys(tokenPriceCache).length} 个代币`);
    
    // 直接匹配
    if (tokenPriceCache[normalizedAddress]) {
      console.log(`直接匹配到价格: ${tokenPriceCache[normalizedAddress]}`);
      return tokenPriceCache[normalizedAddress];
    }
    
    // 尝试用结尾包含"pump"的地址匹配
    // 有些代币地址在WebSocket响应中会带上"pump"后缀
    if (normalizedAddress.endsWith('pump')) {
      // 已经带有pump后缀，去掉它试试
      const addressWithoutPump = normalizedAddress.slice(0, -4);
      if (tokenPriceCache[addressWithoutPump]) {
        console.log(`去掉pump后缀匹配到价格: ${tokenPriceCache[addressWithoutPump]}`);
        return tokenPriceCache[addressWithoutPump];
      }
    } else {
      // 没有pump后缀，加上试试
      const addressWithPump = normalizedAddress + 'pump';
      if (tokenPriceCache[addressWithPump]) {
        console.log(`添加pump后缀匹配到价格: ${tokenPriceCache[addressWithPump]}`);
        return tokenPriceCache[addressWithPump];
      }
    }
    
    // 尝试部分匹配（前8个字符）
    const matchingKey = Object.keys(tokenPriceCache).find(key => 
      key.startsWith(normalizedAddress.substring(0, 8)) ||
      normalizedAddress.startsWith(key.substring(0, 8))
    );
    
    if (matchingKey) {
      console.log(`部分匹配到价格: ${tokenPriceCache[matchingKey]} (通过 ${matchingKey})`);
      return tokenPriceCache[matchingKey];
    }
    
    console.log(`未找到代币 ${normalizedAddress} 的价格，返回0`);
    return 0;
  };

  // 更新交易记录的价格
  const updateTransactionsWithPrices = () => {
    if (transactionsRef.current.length === 0) return;
    
    console.log('正在更新交易记录价格...');
    
    // 为每条交易记录设置当前价格
    const updatedTransactions = transactionsRef.current.map(tx => {
      const tokenAddress = tx.token_address;
      // 使用WebSocket实时价格
      const websocketPrice = getTokenPrice(tokenAddress);
      
      // 强制使用WebSocket价格，即使为0也使用真实值
      console.log(`交易 ${tx.signature.substring(0, 8)}... 代币 ${tokenAddress.substring(0, 8)}...`);
      console.log(`历史价格: ${tx.price}, WebSocket价格: ${websocketPrice}`);
      
      // 不做任何兜底或格式转换，直接使用WebSocket价格
      return { ...tx, current_price: websocketPrice };
    });
    
    // 查看价格是否真正更新
    console.log('更新后的交易记录:');
    updatedTransactions.forEach((tx, index) => {
      console.log(`#${index} 代币: ${tx.token_address.substring(0, 8)}... 历史价格: ${tx.price}, 当前价格(WebSocket): ${tx.current_price}`);
    });
    
    // 计算盈利情况
    const processed = calculateTransactionsProfits(updatedTransactions, solPrice);
    console.log('处理后的交易记录数: ' + processed.length);
    setProcessedTransactions(processed);
  };

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

  // 处理交易记录更新
  useEffect(() => {
    transactionsRef.current = transactions;
    
    if (transactions.length > 0) {
      // 打印交易记录中的代币地址
      const tokenAddresses = [...new Set(transactions.map(tx => tx.token_address))];
      console.log(`交易记录中的代币地址: ${tokenAddresses.join(', ')}`);
      
      // 更新处理后的交易记录
      updateTransactionsWithPrices();
    } else {
      setProcessedTransactions([]);
    }
  }, [transactions, solPrice]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">交易历史</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <span className="text-sm text-gray-400 mr-2">SOL价格:</span>
            <span className="font-medium">${solPrice.toFixed(2)} USD</span>
          </div>
          <button 
            onClick={refreshPrices}
            className="btn btn-sm btn-outline"
          >
            刷新价格
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">价格更新:</span>
            {wsConnected ? (
              <div className="flex items-center text-success-500">
                <Wifi className="mr-1 h-4 w-4" />
                <span className="text-sm">已连接</span>
              </div>
            ) : (
              <div className="flex items-center text-error-500">
                <WifiOff className="mr-1 h-4 w-4" />
                <span className="text-sm">未连接</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {!wsConnected && (
        <div className="bg-error-500/10 border border-error-500 text-error-500 rounded-md p-3 mb-4 flex items-center">
          <WifiOff className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">价格更新服务未连接</p>
            <p className="text-sm">持仓盈利计算将使用交易价格代替当前市场价格</p>
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="walletAddress" className="block text-sm font-medium">
              钱包地址
            </label>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                id="walletAddress"
                placeholder="输入钱包地址"
                className="input pl-10"
                value={inputWalletAddress}
                onChange={(e) => setInputWalletAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSearch} className="btn btn-primary">
              查询
            </button>
            <button
              onClick={exportToCSV}
              disabled={processedTransactions.length === 0}
              className="btn btn-outline"
            >
              <Download className="mr-2 h-4 w-4" />
              导出 CSV
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">每页显示:</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="rounded-md border border-gray-700 bg-background-dark px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        
        {walletAddress && (
          <div className="text-sm text-gray-400">
            显示地址 <AddressDisplay address={walletAddress} maxLength={10} /> 的交易
          </div>
        )}

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : processedTransactions.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-2 text-gray-400">
            {walletAddress ? (
              <>
                <p className="text-lg">没有找到交易记录</p>
                <p className="text-sm">请检查钱包地址是否正确或尝试其他地址</p>
              </>
            ) : (
              <p className="text-lg">请输入钱包地址并查询</p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-2 text-left">时间</th>
                    <th className="px-4 py-2 text-left">类型</th>
                    <th className="px-4 py-2 text-left">Token地址</th>
                    <th className="px-4 py-2 text-right">数量</th>
                    <th className="px-4 py-2 text-right">SOL数量</th>
                    <th className="px-4 py-2 text-right">价格</th>
                    <th className="px-4 py-2 text-right">当前价格</th>
                    <th className="px-4 py-2 text-right">持仓盈利</th>
                    <th className="px-4 py-2 text-right">交易盈利</th>
                    <th className="px-4 py-2 text-center">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {processedTransactions.map((tx, index) => (
                    <TransactionRow 
                      key={tx.signature + index}
                      tx={tx}
                      solPrice={solPrice}
                      index={index}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn btn-sm btn-outline"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm">
                  第 {currentPage} 页，共 {totalPages} 页
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn btn-sm btn-outline"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}