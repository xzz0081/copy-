import React, { useState, useEffect } from 'react';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTransactions } from '../services/api';
import { TransactionsResponse, Transaction } from '../types';
import Spinner from '../components/ui/Spinner';
import AddressDisplay from '../components/ui/AddressDisplay';
import StatusBadge from '../components/ui/StatusBadge';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [inputWalletAddress, setInputWalletAddress] = useState('');

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

  const totalPages = Math.ceil(totalTransactions / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">交易历史</h1>

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
              disabled={transactions.length === 0}
              className="btn btn-outline"
            >
              <Download className="mr-2 h-4 w-4" />
              导出 CSV
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
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
        </div>

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : transactions.length === 0 ? (
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
                          minimumFractionDigits: 6, 
                          maximumFractionDigits: 6 
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {tx.price.toExponential(6)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge
                          status={tx.status === 'confirmed' ? 'success' : tx.status === 'pending' ? 'warning' : 'error'}
                          text={tx.status === 'confirmed' ? '已确认' : tx.status === 'pending' ? '处理中' : '失败'}
                          size="sm"
                        />
                      </td>
                    </tr>
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