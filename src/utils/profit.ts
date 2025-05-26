import { Transaction } from '../types';
import { getTokenPrice } from '../services/websocket';

/**
 * 格式化大数，使用K、M、B等单位
 * @param num 要格式化的数字
 * @param digits 保留小数位数
 * @returns 格式化后的字符串
 */
export const formatNumber = (num: number, digits = 2): string => {
  if (num === 0) return '0';
  
  const units = ['', 'K', 'M', 'B', 'T'];
  const unit = Math.floor(Math.log10(Math.abs(num)) / 3);
  
  if (unit === 0 || isNaN(unit)) return num.toFixed(digits);
  
  const formattedNum = (num / Math.pow(1000, unit)).toFixed(digits);
  return `${formattedNum}${units[unit]}`;
};

/**
 * 格式化价格，避免使用科学计数法
 * @param price 价格
 * @returns 格式化后的价格字符串
 */
export const formatPrice = (price: number): string => {
  if (!price) return '0';
  
  // 处理科学计数法的数值
  const priceStr = price.toString();
  
  if (priceStr.includes('e-')) {
    const [base, exponent] = priceStr.split('e-');
    const zeroCount = parseInt(exponent) - 1;
    const baseNum = parseFloat(base);
    const significantDigits = baseNum.toString().replace('.', '');
    
    // 返回格式化后的字符串，不使用JSX
    return `0.[$${zeroCount}]${significantDigits}`;
  }
  
  // 处理普通数值
  if (priceStr.includes('.')) {
    const [intPart, decimalPart] = priceStr.split('.');
    
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
      // 返回格式化后的字符串，不使用JSX
      return `${intPart}.[$${zeroCount}]${restDigits}`;
    }
  }
  
  return priceStr;
};

/**
 * 计算美元价值
 * @param solAmount SOL数量
 * @param solPrice SOL价格（美元）
 * @returns 美元价值字符串
 */
export const calculateUsdValue = (solAmount: number, solPrice: number): string => {
  if (!solPrice || !solAmount) return '$ 0.00';
  const usdValue = solAmount * solPrice;
  
  if (usdValue < 0.01) return '< $0.01';
  
  return `$ ${usdValue.toFixed(2)}`;
};

/**
 * 计算交易记录的盈利情况
 * @param transactions 交易记录列表
 * @param solPrice SOL价格（美元）
 * @returns 计算后的交易记录列表
 */
export const calculateTransactionsProfits = (transactions: Transaction[], solPrice = 0): Transaction[] => {
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
    
    // 输出日志，检查价格获取情况
    console.log(`计算代币 ${tokenAddress.substring(0, 8)}... 的盈利 - 当前价格: ${currentPrice}, 交易数量: ${txs.length}`);
    
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
  // 持仓数量和买入价格记录
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
      totalCost += tx.sol_amount; // 累计SOL花费
      
      // 计算持仓盈利 - 对比买入时价格与当前价格
      const buyPrice = tx.price; // token本位价格
      
      // 当WebSocket未连接或无法获取当前价格时
      if (currentPrice <= 0) {
        // 使用买入价格作为当前价格（显示为0%盈亏）
        result.position_profit_percentage = 0;
        result.position_profit = 0;
        result.current_price = buyPrice; // 设置当前价格等于买入价格
      } else {
        // 当前盈亏比例(百分比) = (当前价格 / 买入价格 - 1) * 100
        result.position_profit_percentage = buyPrice > 0 
          ? ((currentPrice / buyPrice) - 1) * 100 
          : 0;
        
        // 买入时SOL金额
        const buyInSolAmount = tx.sol_amount;
        
        // 当前价值SOL金额 = 买入SOL金额 * (1 + 盈亏比例/100)
        const currentSolValue = buyInSolAmount * (1 + result.position_profit_percentage / 100);
        
        // 盈亏SOL金额 = 当前价值 - 买入SOL金额
        result.position_profit = currentSolValue - buyInSolAmount;
      }
    }
    // 卖出交易
    else if (tx.tx_type.toLowerCase().includes('sell')) {
      // 如果有持仓，计算卖出盈利
      if (holdingAmount > 0 && totalCost > 0) {
        const avgCostPerToken = totalCost / holdingAmount; // 平均每个token花费的SOL
        const currentSellValue = tx.sol_amount; // 卖出获得的SOL
        const sellAmount = tx.amount; // 卖出的token数量
        const estimatedCost = avgCostPerToken * sellAmount; // 估算的买入成本
        
        // 已实现盈利 = 卖出获得SOL - 估算买入成本
        result.profit = currentSellValue - estimatedCost;
        
        // 已实现盈利百分比 = (卖出价格 / 平均买入价格 - 1) * 100
        const avgBuyPrice = totalCost / holdingAmount / tx.sol_amount * tx.amount; // 估算的平均买入价格
        result.profit_percentage = tx.price > 0 && avgBuyPrice > 0 
          ? ((tx.price / avgBuyPrice) - 1) * 100
          : 0;
        
        // 更新持仓
        holdingAmount -= tx.amount;
        if (holdingAmount > 0) {
          // 按比例减少总成本
          totalCost = totalCost * (1 - tx.amount / (tx.amount + holdingAmount));
        } else {
          totalCost = 0;
        }
      } else {
        result.profit = 0;
        result.profit_percentage = 0;
      }
      
      // 剩余持仓盈利计算逻辑同买入
      if (holdingAmount > 0 && totalCost > 0) {
        const avgBuyPrice = totalCost / holdingAmount / tx.sol_amount * tx.amount; // 估算的平均买入价格
        
        // 当WebSocket未连接或无法获取当前价格时
        if (currentPrice <= 0) {
          // 使用平均买入价格作为当前价格（显示为0%盈亏）
          result.position_profit_percentage = 0;
          result.position_profit = 0;
          result.current_price = avgBuyPrice; // 设置当前价格等于平均买入价格
        } else {
          // 当前盈亏比例(百分比) = (当前价格 / 平均买入价格 - 1) * 100
          result.position_profit_percentage = avgBuyPrice > 0 
            ? ((currentPrice / avgBuyPrice) - 1) * 100 
            : 0;
          
          // 买入时SOL金额
          const remainingSolCost = totalCost;
          
          // 当前价值SOL金额 = 买入SOL金额 * (1 + 盈亏比例/100)
          const currentSolValue = remainingSolCost * (1 + result.position_profit_percentage / 100);
          
          // 盈亏SOL金额 = 当前价值 - 买入SOL金额
          result.position_profit = currentSolValue - remainingSolCost;
        }
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