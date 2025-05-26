import React from 'react';
import PriceDisplay from './PriceDisplay';

interface UsdPriceDisplayProps {
  price: number;
}

/**
 * 美元价格显示组件，将美元价值使用科学记数法友好格式显示
 */
const UsdPriceDisplay: React.FC<UsdPriceDisplayProps> = ({ price }) => {
  return (
    <span className="whitespace-nowrap">
      $ <PriceDisplay price={price} />
    </span>
  );
};

export default UsdPriceDisplay; 