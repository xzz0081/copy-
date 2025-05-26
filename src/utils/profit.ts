import { Transaction } from '../types';
import { getTokenPrice } from '../services/websocket';

/**
 * 计算交易记录的盈利情况
 * @param transactions 交易记录列表
 * @returns 计算后的交易记录列表
 */
export const calculateTransactionsProfits = (transactions: Transaction[]): Transaction[] => {
  if (!transactions || transactions.length === 0) return [];

  // 按照代币地址分组，每个代币单独计算持仓盈利
  const tokenGroups: Record<string, Transaction[]> = {};
  
  // 对交易记录进行分组处理
  transactions.forEach(tx => {
    if (!tokenGroups[tx.token_address]) {
      tokenGroups[tx.token_address] = [];
    }
    tokenGroups[tx.token_address].push({...tx});
  });
  
  // 计算每组代币的盈利情况
  const result: Transaction[] = [];
  
  Object.keys(tokenGroups).forEach(tokenAddress => {
    // 按时间顺序排序交易记录（从早到晚）
    const txs = tokenGroups[tokenAddress].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // 获取当前代币价格
    const currentPrice = getTokenPrice(tokenAddress);
    
    // 计算各项盈利数据
    const calculatedTxs = calculateTokenProfits(txs, currentPrice);
    result.push(...calculatedTxs);
  });
  
  // 按照原始顺序返回交易记录
  return result.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

/**
 * 计算单个代币的盈利情况
 * @param transactions 同一代币的交易记录
 * @param currentPrice 当前价格
 * @returns 计算后的交易记录
 */
const calculateTokenProfits = (transactions: Transaction[], currentPrice: number): Transaction[] => {
  // 持仓数量和平均成本
  let holdingAmount = 0;
  let totalCost = 0;
  
  // 为每笔交易计算盈利
  return transactions.map(tx => {
    const result = {...tx};
    result.current_price = currentPrice;
    
    // 买入交易
    if (tx.tx_type.toLowerCase().includes('buy')) {
      // 添加到持仓
      holdingAmount += tx.amount;
      totalCost += tx.price * tx.amount;
      
      // 计算持仓盈利
      if (holdingAmount > 0) {
        const avgPrice = totalCost / holdingAmount;
        result.position_profit = (currentPrice - avgPrice) * holdingAmount;
        result.position_profit_percentage = ((currentPrice / avgPrice) - 1) * 100;
      } else {
        result.position_profit = 0;
        result.position_profit_percentage = 0;
      }
    }
    // 卖出交易
    else if (tx.tx_type.toLowerCase().includes('sell')) {
      // 如果有持仓，计算卖出盈利
      if (holdingAmount > 0) {
        const avgPrice = totalCost / holdingAmount;
        result.profit = (tx.price - avgPrice) * tx.amount;
        result.profit_percentage = ((tx.price / avgPrice) - 1) * 100;
        
        // 更新持仓
        holdingAmount -= tx.amount;
        totalCost = holdingAmount > 0 ? avgPrice * holdingAmount : 0;
      } else {
        result.profit = 0;
        result.profit_percentage = 0;
      }
      
      // 计算剩余持仓盈利
      if (holdingAmount > 0) {
        const avgPrice = totalCost / holdingAmount;
        result.position_profit = (currentPrice - avgPrice) * holdingAmount;
        result.position_profit_percentage = ((currentPrice / avgPrice) - 1) * 100;
      } else {
        result.position_profit = 0;
        result.position_profit_percentage = 0;
      }
    }
    
    return result;
  });
};

/**
 * 格式化盈利数值为显示文本
 * @param value 盈利数值
 * @returns 格式化后的文本
 */
export const formatProfit = (value: number | undefined): string => {
  if (value === undefined) return '-';
  
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
};

/**
 * 格式化盈利百分比为显示文本
 * @param percentage 盈利百分比
 * @returns 格式化后的文本
 */
export const formatProfitPercentage = (percentage: number | undefined): string => {
  if (percentage === undefined) return '-';
  
  return `${percentage >= 0 ? '+' : ''}${percentage.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}%`;
}; 