import React from 'react';
import { Copy } from 'lucide-react';
import { cn } from '../../utils/cn';
import toast from 'react-hot-toast';

interface AddressDisplayProps {
  address: string;
  maxLength?: number;
  className?: string;
}

export default function AddressDisplay({ 
  address, 
  maxLength = 8, 
  className 
}: AddressDisplayProps) {
  if (!address) return null;
  
  const truncateAddress = (addr: string) => {
    if (addr.length <= maxLength) return addr;
    return `${addr.slice(0, maxLength / 2)}...${addr.slice(-maxLength / 2)}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address)
      .then(() => toast.success('地址已复制到剪贴板'))
      .catch(() => toast.error('复制失败'));
  };

  return (
    <div className={cn('inline-flex items-center gap-1 font-mono text-sm', className)}>
      <span>{truncateAddress(address)}</span>
      <button
        type="button"
        onClick={copyToClipboard}
        className="text-gray-400 hover:text-gray-300"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}