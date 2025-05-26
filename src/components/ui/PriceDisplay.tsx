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
    
    return (
      <span className="font-mono">
        0.
        <sub className="text-xs text-error-500">{zeroCount}</sub>
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
      return (
        <span className="font-mono">
          {intPart}.
          <sub className="text-xs text-error-500">{zeroCount}</sub>
          {restDigits}
        </span>
      );
    }
  }
  
  return <span className="font-mono">{priceStr}</span>;
};

export default PriceDisplay; 