import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, Edit, ExternalLink, Plus, DollarSign, Clock, TrendingUp, TrendingDown, Settings, Trash2, History, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonitorAddresses, updateMonitorAddress, addMonitorAddress, getSolPrice, PriceSource, deleteMonitorAddress, getTransactions } from '../services/api';
import { MonitorAddressesResponse, WalletConfig, AddWalletRequest, Transaction, TransactionsResponse } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import AddressDisplay from '../components/ui/AddressDisplay';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function MonitorAddresses() {
  const [addresses, setAddresses] = useState<Record<string, WalletConfig>>({});
  const [targetAddresses, setTargetAddresses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<WalletConfig>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addWalletLoading, setAddWalletLoading] = useState(false);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
  const [priceChange, setPriceChange] = useState<'up' | 'down' | 'none'>('none');
  const [priceSource, setPriceSource] = useState<PriceSource>(PriceSource.OKX);
  const [showPriceSourceMenu, setShowPriceSourceMenu] = useState(false);
  const prevPriceRef = useRef<number>(0);
  const [newWallet, setNewWallet] = useState<AddWalletRequest>({
    address: '',
    follow_percentage: 30.0,
    slippage_percentage: 2.0,
    tip_percentage: 1.0,
    min_price_multiplier: 0.8,
    max_price_multiplier: 1.2,
    priority_fee: 50000,
    compute_unit_limit: 200000
  });
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toggleStatusAddress, setToggleStatusAddress] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // 交易历史记录相关状态
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);

  useEffect(() => {
    fetchAddresses();
    fetchSolPrice();

    // 使用Binance API，可以调高刷新频率，每5秒刷新一次
    const priceInterval = setInterval(() => {
      fetchSolPrice();
    }, 5000); 
    
    // 组件卸载时清除定时器
    return () => clearInterval(priceInterval);
  }, []);

  useEffect(() => {
    if (prevPriceRef.current && solPrice !== prevPriceRef.current) {
      // 设置价格变化方向
      setPriceChange(solPrice > prevPriceRef.current ? 'up' : 'down');
      
      // 2秒后重置动画效果
      const timer = setTimeout(() => {
        setPriceChange('none');
      }, 2000);
      
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = solPrice;
  }, [solPrice]);

  // 获取交易历史记录
  const fetchTransactions = async (wallet: string, page: number, limit: number) => {
    if (!wallet) return;
    
    try {
      setLoadingTransactions(true);
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
      setLoadingTransactions(false);
    }
  };

  // 展示交易历史记录
  const handleShowTransactions = (address: string) => {
    setSelectedWallet(address);
    setCurrentPage(1);
    fetchTransactions(address, 1, pageSize);
    setShowTransactionHistory(true);
  };

  // 关闭交易历史记录弹窗
  const handleCloseTransactions = () => {
    setShowTransactionHistory(false);
    setSelectedWallet('');
    setTransactions([]);
  };

  // 处理分页变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchTransactions(selectedWallet, page, pageSize);
  };

  // 处理每页条数变化
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1);
    fetchTransactions(selectedWallet, 1, newSize);
  };

  // 导出交易历史CSV
  const exportToCSV = () => {
    if (transactions.length === 0) {
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
      '预期价格',
      '价格滑点',
      '状态',
      '钱包地址',
      '签名',
    ];

    // Format transaction data for CSV
    const data = transactions.map((tx) => [
      tx.timestamp,
      tx.tx_type,
      tx.token_address,
      tx.amount.toString(),
      tx.sol_amount.toString(),
      tx.price.toString(),
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
      `交易历史_${selectedWallet}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
    );
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('CSV文件已导出');
  };

  // 格式化日期时间
  const formatDatetime = (isoString: string) => {
    try {
      return format(new Date(isoString), 'yyyy-MM-dd HH:mm:ss');
    } catch (error) {
      return isoString;
    }
  };

  // 获取交易类型文本
  const getTransactionTypeText = (type: string) => {
    if (type.toLowerCase().includes('buy')) return '买入';
    if (type.toLowerCase().includes('sell')) return '卖出';
    return type;
  };

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await getMonitorAddresses() as MonitorAddressesResponse;
      if (response.success) {
        setAddresses(response.data.wallets);
        setTargetAddresses(response.data.targets);
      } else {
        toast.error('获取监控地址失败');
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('获取监控地址失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSolPrice = async () => {
    try {
      setLoadingPrice(true);
      const price = await getSolPrice(priceSource);
      setSolPrice(price);
      setLastPriceUpdate(new Date());
    } catch (error) {
      console.error('Error fetching SOL price:', error);
      toast.error('获取SOL价格失败');
    } finally {
      setLoadingPrice(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAddresses(), fetchSolPrice()]);
    setRefreshing(false);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const filteredAddresses = Object.entries(addresses).filter(([address, config]) => {
    const lowerQuery = searchQuery.toLowerCase();
    return (
      address.toLowerCase().includes(lowerQuery) ||
      (config.note && config.note.toLowerCase().includes(lowerQuery)) ||
      (config.is_active ? '活跃'.includes(lowerQuery) : '暂停'.includes(lowerQuery))
    );
  });

  const startEditing = (address: string) => {
    setEditingAddress(address);
    setEditValues({
      follow_percentage: addresses[address].follow_percentage,
      slippage_percentage: addresses[address].slippage_percentage,
      tip_percentage: addresses[address].tip_percentage,
      min_price_multiplier: addresses[address].min_price_multiplier,
      max_price_multiplier: addresses[address].max_price_multiplier,
      priority_fee: addresses[address].priority_fee,
      compute_unit_limit: addresses[address].compute_unit_limit,
      sol_amount_min: addresses[address].sol_amount_min,
      sol_amount_max: addresses[address].sol_amount_max,
      is_active: addresses[address].is_active,
    });
  };

  const cancelEditing = () => {
    setEditingAddress(null);
    setEditValues({});
  };

  const saveChanges = async () => {
    if (!editingAddress || Object.keys(editValues).length === 0) return;

    try {
      const updateData = {
        address: editingAddress,
        ...addresses[editingAddress],
        ...editValues,
      };

      const response = await updateMonitorAddress(updateData);
      if (response.success) {
        toast.success('更新成功');
        // Update local state
        setAddresses((prev) => ({
          ...prev,
          [editingAddress]: {
            ...prev[editingAddress],
            ...editValues,
          },
        }));
      } else {
        toast.error('更新失败');
      }
    } catch (error) {
      console.error('Error updating address:', error);
      toast.error('更新失败');
    } finally {
      cancelEditing();
    }
  };

  const handleAddWalletChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    let parsedValue: string | number = value;
    
    if (type === 'number') {
      parsedValue = parseFloat(value);
    }
    
    setNewWallet({
      ...newWallet,
      [name]: parsedValue
    });
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newWallet.address) {
      toast.error('请输入钱包地址');
      return;
    }
    
    try {
      setAddWalletLoading(true);
      const response = await addMonitorAddress(newWallet);
      
      if (response.success) {
        toast.success('添加钱包地址成功');
        setShowAddForm(false);
        setNewWallet({
          address: '',
          follow_percentage: 30.0,
          slippage_percentage: 2.0,
          tip_percentage: 1.0,
          min_price_multiplier: 0.8,
          max_price_multiplier: 1.2,
          priority_fee: 50000,
          compute_unit_limit: 200000
        });
        // 刷新地址列表
        fetchAddresses();
      } else {
        toast.error(response.message || '添加钱包地址失败');
      }
    } catch (error) {
      console.error('Error adding wallet address:', error);
      toast.error('添加钱包地址失败');
    } finally {
      setAddWalletLoading(false);
    }
  };

  // 计算美元价值
  const calculateUsdValue = (solAmount: number): string => {
    if (!solPrice || !solAmount) return '$ 0.00';
    const usdValue = solAmount * solPrice;
    return `$ ${usdValue.toFixed(2)}`;
  };

  // 格式化小数，将连续的0以上标形式显示
  const formatDecimal = (value: number): React.ReactNode => {
    if (!value) return '0';
    
    // 转换为字符串
    const valueStr = value.toString();
    
    // 对于科学记数法的数字，进行特殊处理
    if (valueStr.includes('e-')) {
      const [base, exponent] = valueStr.split('e-');
      const zeroCount = parseInt(exponent) - 1;
      const baseNum = parseFloat(base);
      const significantDigits = baseNum.toString().replace('.', '');
      
      return (
        <span className="font-mono">
          0.
          <sub className="text-xs">{zeroCount}</sub>
          {significantDigits}
        </span>
      );
    }
    
    // 对于普通小数
    if (valueStr.includes('.')) {
      const [intPart, decimalPart] = valueStr.split('.');
      
      // 计算小数点后连续的0的数量
      let zeroCount = 0;
      for (let i = 0; i < decimalPart.length; i++) {
        if (decimalPart[i] === '0') {
          zeroCount++;
        } else {
          break;
        }
      }
      
      // 如果有连续的0
      if (zeroCount > 2) {
        const restDigits = decimalPart.substring(zeroCount);
        return (
          <span className="font-mono">
            {intPart}.
            <sub className="text-xs">{zeroCount}</sub>
            {restDigits}
          </span>
        );
      }
    }
    
    // 其他情况直接返回原值
    return <span className="font-mono">{valueStr}</span>;
  };

  // 格式化最后更新时间
  const formatLastUpdate = (): string => {
    if (!lastPriceUpdate) return '';
    return format(lastPriceUpdate, 'HH:mm:ss');
  };

  const handlePriceSourceChange = (source: PriceSource) => {
    setPriceSource(source);
    setShowPriceSourceMenu(false);
    fetchSolPrice();
    toast.success(`已切换价格源为: ${getPriceSourceName(source)}`);
  };

  const getPriceSourceName = (source: PriceSource): string => {
    switch (source) {
      case PriceSource.COINGECKO:
        return 'CoinGecko';
      case PriceSource.BINANCE:
        return 'Binance';
      case PriceSource.OKX:
        return 'OKX(欧易)';
      case PriceSource.HUOBI:
        return '火币';
      case PriceSource.GATE:
        return 'Gate.io';
      case PriceSource.COINMARKETCAP:
        return 'CoinMarketCap';
      default:
        return 'OKX(欧易)';
    }
  };

  // 处理删除钱包地址
  const handleDeleteWallet = async (address: string) => {
    try {
      setDeletingAddress(address);
      setIsDeleting(true);
      
      const response = await deleteMonitorAddress(address);
      
      if (response.success) {
        toast.success('钱包地址已成功删除');
        // 从本地状态中移除
        setAddresses(prevAddresses => {
          const newAddresses = { ...prevAddresses };
          delete newAddresses[address];
          return newAddresses;
        });
      } else {
        toast.error(response.message || '删除钱包地址失败');
      }
    } catch (error) {
      console.error('Error deleting wallet address:', error);
      toast.error('删除钱包地址失败');
    } finally {
      setDeletingAddress(null);
      setIsDeleting(false);
    }
  };

  // 显示删除确认对话框
  const confirmDelete = (address: string) => {
    if (window.confirm(`确定要删除钱包地址 ${address.substring(0, 6)}...${address.substring(address.length - 4)} 的监控吗？`)) {
      handleDeleteWallet(address);
    }
  };

  // 处理点击切换状态
  const handleToggleStatus = async (address: string, currentStatus: boolean) => {
    if (isTogglingStatus) return; // 防止重复操作
    
    // 添加确认对话框
    const confirmMessage = currentStatus 
      ? `确定要暂停监控钱包 ${address.substring(0, 6)}...${address.substring(address.length - 4)} 吗？` 
      : `确定要激活监控钱包 ${address.substring(0, 6)}...${address.substring(address.length - 4)} 吗？`;
    
    // 对于暂停操作，必须进行确认
    // 对于激活操作，可以直接进行
    if (currentStatus && !window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      setToggleStatusAddress(address);
      setIsTogglingStatus(true);
      
      const updateData = {
        address,
        ...addresses[address],
        is_active: !currentStatus,
      };

      const response = await updateMonitorAddress(updateData);
      
      if (response.success) {
        // 更新本地状态
        setAddresses(prev => ({
          ...prev,
          [address]: {
            ...prev[address],
            is_active: !currentStatus
          }
        }));
        
        toast.success(`钱包已${!currentStatus ? '激活' : '暂停'}`);
      } else {
        toast.error('状态更新失败');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('状态更新失败');
    } finally {
      setToggleStatusAddress(null);
      setIsTogglingStatus(false);
    }
  };

  // 计算总页数
  const totalPages = Math.ceil(totalTransactions / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">监控地址列表</h1>
        <div className="flex items-center gap-4">
          {solPrice > 0 && (
            <div className="flex items-center gap-1 text-sm font-medium">
              <div className="relative">
                <button 
                  onClick={() => setShowPriceSourceMenu(!showPriceSourceMenu)}
                  className="flex items-center"
                >
                  <Settings className="h-3.5 w-3.5 mr-1 text-gray-400 hover:text-gray-200" />
                </button>
                
                {showPriceSourceMenu && (
                  <div className="absolute right-0 top-6 z-10 w-48 rounded-md bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="px-2 py-1 text-xs text-gray-400">选择价格源</div>
                    <div 
                      className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer ${priceSource === PriceSource.OKX ? 'text-success-500' : 'text-gray-300'} hover:bg-gray-700`}
                      onClick={() => handlePriceSourceChange(PriceSource.OKX)}
                    >
                      OKX(欧易) {priceSource === PriceSource.OKX && '✓'}
                    </div>
                    <div 
                      className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer ${priceSource === PriceSource.HUOBI ? 'text-success-500' : 'text-gray-300'} hover:bg-gray-700`}
                      onClick={() => handlePriceSourceChange(PriceSource.HUOBI)}
                    >
                      火币 {priceSource === PriceSource.HUOBI && '✓'}
                    </div>
                    <div 
                      className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer ${priceSource === PriceSource.GATE ? 'text-success-500' : 'text-gray-300'} hover:bg-gray-700`}
                      onClick={() => handlePriceSourceChange(PriceSource.GATE)}
                    >
                      Gate.io {priceSource === PriceSource.GATE && '✓'}
                    </div>
                    <div 
                      className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer ${priceSource === PriceSource.BINANCE ? 'text-success-500' : 'text-gray-300'} hover:bg-gray-700`}
                      onClick={() => handlePriceSourceChange(PriceSource.BINANCE)}
                    >
                      Binance {priceSource === PriceSource.BINANCE && '✓'}
                    </div>
                    <div 
                      className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer ${priceSource === PriceSource.COINGECKO ? 'text-success-500' : 'text-gray-300'} hover:bg-gray-700`}
                      onClick={() => handlePriceSourceChange(PriceSource.COINGECKO)}
                    >
                      CoinGecko {priceSource === PriceSource.COINGECKO && '✓'}
                    </div>
                  </div>
                )}
              </div>
              <DollarSign className={`h-4 w-4 ${loadingPrice ? 'animate-pulse' : 'text-success-500'}`} />
              <div className="flex items-center">
                <span className={`transition-colors duration-500 ${
                  priceChange === 'up' 
                    ? 'text-success-500' 
                    : priceChange === 'down' 
                      ? 'text-error-500' 
                      : ''
                }`}>
                  SOL: ${solPrice.toFixed(2)} USD 
                </span>
                {priceChange === 'up' && (
                  <TrendingUp className="ml-1 h-3 w-3 text-success-500" />
                )}
                {priceChange === 'down' && (
                  <TrendingDown className="ml-1 h-3 w-3 text-error-500" />
                )}
                <span className="ml-1 text-xs text-gray-400">
                  ({getPriceSourceName(priceSource)})
                </span>
              </div>
              {lastPriceUpdate && (
                <div className="flex items-center text-xs text-gray-400 ml-2">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{formatLastUpdate()}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button 
              onClick={() => setShowAddForm(!showAddForm)} 
              className="btn btn-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              添加钱包
            </button>
            <button 
              onClick={handleRefresh} 
              className="btn btn-primary"
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  刷新中...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="card">
          <h2 className="mb-4 text-xl font-semibold">添加新钱包地址</h2>
          <form onSubmit={handleAddWallet} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="address" className="block text-sm font-medium">
                  钱包地址 <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={newWallet.address}
                  onChange={handleAddWalletChange}
                  placeholder="输入钱包地址"
                  className="input"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="follow_percentage" className="block text-sm font-medium">
                  跟单比例 (%)
                </label>
                <input
                  type="number"
                  id="follow_percentage"
                  name="follow_percentage"
                  value={newWallet.follow_percentage}
                  onChange={handleAddWalletChange}
                  min="1"
                  max="100"
                  step="0.1"
                  className="input"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="slippage_percentage" className="block text-sm font-medium">
                  滑点百分比 (%)
                </label>
                <input
                  type="number"
                  id="slippage_percentage"
                  name="slippage_percentage"
                  value={newWallet.slippage_percentage}
                  onChange={handleAddWalletChange}
                  min="0.1"
                  step="0.1"
                  className="input"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="tip_percentage" className="block text-sm font-medium">
                  小费百分比 (%)
                </label>
                <input
                  type="number"
                  id="tip_percentage"
                  name="tip_percentage"
                  value={newWallet.tip_percentage}
                  onChange={handleAddWalletChange}
                  min="0"
                  step="0.1"
                  className="input"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="min_price_multiplier" className="block text-sm font-medium">
                  最小价格乘数
                </label>
                <input
                  type="number"
                  id="min_price_multiplier"
                  name="min_price_multiplier"
                  value={newWallet.min_price_multiplier}
                  onChange={handleAddWalletChange}
                  min="0"
                  step="0.01"
                  className="input"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="max_price_multiplier" className="block text-sm font-medium">
                  最大价格乘数
                </label>
                <input
                  type="number"
                  id="max_price_multiplier"
                  name="max_price_multiplier"
                  value={newWallet.max_price_multiplier}
                  onChange={handleAddWalletChange}
                  min="0"
                  step="0.01"
                  className="input"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="priority_fee" className="block text-sm font-medium">
                  优先费
                </label>
                <input
                  type="number"
                  id="priority_fee"
                  name="priority_fee"
                  value={newWallet.priority_fee}
                  onChange={handleAddWalletChange}
                  min="0"
                  className="input"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="compute_unit_limit" className="block text-sm font-medium">
                  计算单元限制
                </label>
                <input
                  type="number"
                  id="compute_unit_limit"
                  name="compute_unit_limit"
                  value={newWallet.compute_unit_limit}
                  onChange={handleAddWalletChange}
                  min="0"
                  className="input"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn btn-outline"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={addWalletLoading}
                className="btn btn-primary"
              >
                {addWalletLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    添加中...
                  </>
                ) : '添加'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索地址或状态..."
            className="input pl-10"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-2 text-left">地址</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-left">跟单比例</th>
                  <th className="px-4 py-2 text-left">滑点</th>
                  <th className="px-4 py-2 text-left">小费比例</th>
                  <th className="px-4 py-2 text-left">最小价格乘数</th>
                  <th className="px-4 py-2 text-left">最大价格乘数</th>
                  <th className="px-4 py-2 text-left">优先费</th>
                  <th className="px-4 py-2 text-left">计算单元限制</th>
                  <th className="px-4 py-2 text-left">SOL最小值</th>
                  <th className="px-4 py-2 text-left">SOL最大值</th>
                  <th className="px-4 py-2 text-left">备注</th>
                  <th className="px-4 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAddresses.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                      没有找到匹配的地址
                    </td>
                  </tr>
                ) : (
                  filteredAddresses.map(([address, config]) => (
                    <tr key={address} className="border-b border-gray-700 hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <AddressDisplay address={address} />
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <div className="flex items-center">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editValues.is_active}
                                onChange={(e) => setEditValues({ ...editValues, is_active: e.target.checked })}
                                className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-primary-600"
                              />
                              活跃
                            </label>
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer"
                            onClick={() => handleToggleStatus(address, config.is_active)}
                            title={config.is_active ? "点击暂停" : "点击激活"}
                          >
                            {toggleStatusAddress === address && isTogglingStatus ? (
                              <div className="flex items-center">
                                <Spinner size="sm" className="mr-2" />
                                <span>{config.is_active ? '暂停中...' : '激活中...'}</span>
                              </div>
                            ) : (
                              <StatusBadge
                                status={config.is_active ? 'success' : 'error'}
                                text={config.is_active ? '活跃' : '暂停'}
                              />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={editValues.follow_percentage}
                            onChange={(e) => setEditValues({ ...editValues, follow_percentage: parseFloat(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          `${config.follow_percentage}%`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={editValues.slippage_percentage}
                            onChange={(e) => setEditValues({ ...editValues, slippage_percentage: parseFloat(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          `${config.slippage_percentage}%`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={editValues.tip_percentage}
                            onChange={(e) => setEditValues({ ...editValues, tip_percentage: parseFloat(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          `${config.tip_percentage}%`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="0"
                            step="0.000001"
                            value={editValues.min_price_multiplier}
                            onChange={(e) => setEditValues({ ...editValues, min_price_multiplier: parseFloat(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          <div className="flex flex-col">
                            {formatDecimal(config.min_price_multiplier)}
                            <span className="text-xs text-success-500">
                              {solPrice > 0 && `$ ${(config.min_price_multiplier * solPrice).toFixed(6)}`}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="0"
                            step="0.000001"
                            value={editValues.max_price_multiplier}
                            onChange={(e) => setEditValues({ ...editValues, max_price_multiplier: parseFloat(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          <div className="flex flex-col">
                            {formatDecimal(config.max_price_multiplier)}
                            <span className="text-xs text-success-500">
                              {solPrice > 0 && `$ ${(config.max_price_multiplier * solPrice).toFixed(6)}`}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="0"
                            value={editValues.priority_fee}
                            onChange={(e) => setEditValues({ ...editValues, priority_fee: parseInt(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          config.priority_fee
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="0"
                            value={editValues.compute_unit_limit}
                            onChange={(e) => setEditValues({ ...editValues, compute_unit_limit: parseInt(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          config.compute_unit_limit
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={editValues.sol_amount_min}
                            onChange={(e) => setEditValues({ ...editValues, sol_amount_min: parseFloat(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span>{config.sol_amount_min}</span>
                            <span className="text-xs text-success-500">{calculateUsdValue(config.sol_amount_min)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={editValues.sol_amount_max}
                            onChange={(e) => setEditValues({ ...editValues, sol_amount_max: parseFloat(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span>{config.sol_amount_max}</span>
                            <span className="text-xs text-success-500">{calculateUsdValue(config.sol_amount_max)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{config.note || '无'}</td>
                      <td className="px-4 py-3 text-right">
                        {editingAddress === address ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={saveChanges}
                              className="btn btn-sm btn-success"
                            >
                              保存
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="btn btn-sm btn-outline"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => confirmDelete(address)}
                              disabled={deletingAddress === address && isDeleting}
                              className="btn btn-sm btn-circle btn-error"
                              title="删除"
                            >
                              {deletingAddress === address && isDeleting ? (
                                <Spinner size="sm" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => startEditing(address)}
                              className="btn btn-sm btn-outline"
                            >
                              <Edit className="mr-1 h-3 w-3" />
                              编辑
                            </button>
                            <button
                              onClick={() => handleShowTransactions(address)}
                              className="btn btn-sm btn-primary"
                            >
                              <History className="mr-1 h-3 w-3" />
                              交易详情
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 交易历史记录弹窗 */}
      {showTransactionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-background-dark rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                钱包 <AddressDisplay address={selectedWallet} /> 的交易历史
              </h2>
              <button
                onClick={handleCloseTransactions}
                className="btn btn-sm btn-circle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-between items-center mb-4">
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
              <button
                onClick={exportToCSV}
                disabled={transactions.length === 0}
                className="btn btn-sm btn-outline"
              >
                <Download className="mr-2 h-3 w-3" />
                导出 CSV
              </button>
            </div>

            {loadingTransactions ? (
              <div className="flex h-60 items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex h-60 flex-col items-center justify-center gap-2 text-gray-400">
                <p className="text-lg">没有找到交易记录</p>
                <p className="text-sm">该钱包暂无交易记录</p>
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
                        <th className="px-4 py-2 text-center">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, index) => (
                        <tr
                          key={tx.signature + index}
                          className="border-b border-gray-700 hover:bg-gray-800/50"
                        >
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
                              minimumFractionDigits: 4, 
                              maximumFractionDigits: 4 
                            })}
                            <span className="text-xs text-success-500 ml-1">
                              ({solPrice > 0 ? `$${(tx.sol_amount * solPrice).toFixed(2)}` : '$0.00'})
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col">
                              {formatDecimal(tx.price)}
                              <span className="text-xs text-success-500">
                                {solPrice > 0 && (
                                  <>
                                    $ {formatDecimal(tx.price * solPrice)}
                                  </>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge 
                              status={tx.status === 'confirmed' ? 'success' : 'error'} 
                              text={tx.status === 'confirmed' ? '成功' : '失败'} 
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center mt-4 space-x-1">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="btn btn-sm btn-outline"
                    >
                      首页
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="btn btn-sm btn-outline"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="flex items-center px-3 py-1">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="btn btn-sm btn-outline"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="btn btn-sm btn-outline"
                    >
                      末页
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}