import React from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

type StatusType = 'success' | 'error' | 'warning' | 'neutral';

interface StatusBadgeProps {
  status: StatusType;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function StatusBadge({ 
  status, 
  text, 
  size = 'md', 
  className 
}: StatusBadgeProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className={cn('h-4 w-4', size === 'sm' && 'h-3 w-3', size === 'lg' && 'h-5 w-5')} />;
      case 'error':
        return <XCircle className={cn('h-4 w-4', size === 'sm' && 'h-3 w-3', size === 'lg' && 'h-5 w-5')} />;
      case 'warning':
        return <AlertCircle className={cn('h-4 w-4', size === 'sm' && 'h-3 w-3', size === 'lg' && 'h-5 w-5')} />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-success-500/20 text-success-400 border-success-500/30';
      case 'error':
        return 'bg-error-500/20 text-error-400 border-error-500/30';
      case 'warning':
        return 'bg-warning-500/20 text-warning-400 border-warning-500/30';
      case 'neutral':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
        getStatusColor(),
        size === 'sm' && 'px-1.5 py-0.5 text-xs',
        size === 'lg' && 'px-3 py-1.5 text-sm',
        className
      )}
    >
      {getStatusIcon()}
      {text && <span>{text}</span>}
    </span>
  );
}