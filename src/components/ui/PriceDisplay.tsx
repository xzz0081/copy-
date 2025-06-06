import React from 'react';

interface PriceDisplayProps {
  price: number;
}

/**
 * 价格显示组件，将科学记数法转换为更友好的格式
 */
const PriceDisplay: React.FC<PriceDisplayProps> = ({ price }) => {
  if (!price) return <span className="font-mono">0</span>;
  
  // 处理科学计数法的数值
  const priceStr = price.toString();
  
  if (priceStr.includes('e-')) {
    const [base, exponent] = priceStr.split('e-');
    const zeroCount = parseInt(exponent) - 1;
    const baseNum = parseFloat(base);
    const significantDigits = baseNum.toString().replace('.', '');
    
    // 格式化为 0.⁵5 这样的格式（零的个数作为上标）
    return (
      <span className="font-mono">
        0.
        <span className="text-xs text-error-500 align-super">{zeroCount}</span>
        {significantDigits}
      </span>
    );
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
      // 格式化为 1.⁵678 这样的格式
      return (
        <span className="font-mono">
          {intPart}.
          <span className="text-xs text-error-500 align-super">{zeroCount}</span>
          {restDigits}
        </span>
      );
    }
  }
  
  return <span className="font-mono">{priceStr}</span>;
};

export default PriceDisplay; 