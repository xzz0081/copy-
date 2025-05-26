import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { formatNumber, formatProfit, formatProfitPercentage, calculateUsdValue, calculateTokenPriceUsd } from '../utils/profit';
import { format } from 'date-fns';
import AddressDisplay from './ui/AddressDisplay';
import PriceDisplay from './ui/PriceDisplay';
import UsdPriceDisplay from './ui/UsdPriceDisplay';
import StatusBadge from './ui/StatusBadge';

interface TransactionRowProps {
  tx: Transaction;
  solPrice: number;
  index: number;
}

/**
 * 交易记录行组件，显示直接从props传入的价格
 */
const TransactionRow: React.FC<TransactionRowProps> = ({ tx, solPrice, index }) => {
  // 固定的交易价格 (从交易记录API获取的历史价格，不变)
  const transactionPrice = tx.price;
  
  // 当前价格从Transaction对象中获取
  const currentPrice = tx.current_price || 0;
  
  // 本地计算盈利
  const profitData = useMemo(() => {
    // 如果没有获取到当前市场价格，返回默认值
    if (!currentPrice) {
      return {
        percentage: tx.position_profit_percentage || 0,
        profit: tx.position_profit || 0
      };
    }
    
    // 买入交易计算当前持仓盈利
    if (tx.tx_type.toLowerCase().includes('buy')) {
      const buyPrice = transactionPrice;
      if (buyPrice <= 0) return { percentage: 0, profit: 0 };
      
      // 计算盈利百分比 = (当前价格/买入价格 - 1) * 100%
      const percentage = ((currentPrice / buyPrice) - 1) * 100;
      
      // 买入时SOL金额
      const buyInSolAmount = tx.sol_amount;
      
      // 当前价值SOL金额 = 买入SOL金额 * (1 + 盈亏比例/100)
      const currentSolValue = buyInSolAmount * (1 + percentage / 100);
      
      // 盈亏SOL金额 = 当前价值 - 买入SOL金额
      const profit = currentSolValue - buyInSolAmount;
      
      return { percentage, profit };
    }
    
    // 卖出交易显示原有盈利
    return {
      percentage: tx.position_profit_percentage || 0,
      profit: tx.position_profit || 0
    };
  }, [tx, currentPrice, transactionPrice]);
  
  // 格式化日期时间
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
      <td className="px-4 py-3 text-right">
        <div className="font-mono">
          {formatNumber(tx.amount / 1000000)}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="font-mono">
          {tx.sol_amount.toLocaleString(undefined, { 
            minimumFractionDigits: 6, 
            maximumFractionDigits: 6 
          })}
        </div>
        <div className="text-xs text-success-500">
          {calculateUsdValue(tx.sol_amount, solPrice)}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div>
          <PriceDisplay price={transactionPrice} />
        </div>
        {solPrice > 0 && (
          <div className="text-xs text-success-500">
            <UsdPriceDisplay price={calculateTokenPriceUsd(transactionPrice, solPrice)} />
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {currentPrice > 0 ? (
          <div>
            <div>
              <PriceDisplay price={currentPrice} />
            </div>
            {solPrice > 0 && (
              <div className="text-xs text-success-500">
                <UsdPriceDisplay price={calculateTokenPriceUsd(currentPrice, solPrice)} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-400">未获取</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className={`font-medium ${profitData.percentage >= 0 ? 'text-success-500' : 'text-error-500'}`}>
          {formatProfitPercentage(profitData.percentage)}
        </div>
        <div className="text-xs text-gray-400">
          {formatProfit(profitData.profit)}
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

export default TransactionRow; 