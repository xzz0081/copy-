import React, { useState } from 'react';
import { SendHorizonal } from 'lucide-react';
import { sellToken } from '../services/api';
import { SellRequest, SellResponse } from '../types';
import Spinner from '../components/ui/Spinner';
import AddressDisplay from '../components/ui/AddressDisplay';
import toast from 'react-hot-toast';

export default function ManualSell() {
  const [formData, setFormData] = useState<SellRequest>({
    token_address: '',
    percentage: 25,
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SellResponse | null>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    let parsedValue: string | number = value;
    if (type === 'number' || name === 'percentage') {
      parsedValue = parseInt(value, 10);
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.token_address) {
      toast.error('请输入代币地址');
      return;
    }
    
    try {
      setLoading(true);
      const requestData = {
        ...formData,
        percentage: Number(formData.percentage)
      };
      
      const response = await sellToken(requestData);
      setResult(response);
      
      if (response.success) {
        toast.success('卖出请求已成功处理');
      } else {
        toast.error(response.message || '卖出请求失败');
      }
    } catch (error) {
      console.error('Error submitting sell request:', error);
      toast.error('卖出请求失败');
    } finally {
      setLoading(false);
    }
  };
  
  // Format the form data as JSON for display
  const formDataJson = JSON.stringify(formData, null, 2);
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">手动卖出</h1>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-xl font-semibold">卖出表单</h2>
          <p className="mb-4 text-sm text-gray-400">使用专用钱包配置进行卖出，只需提供代币地址和卖出比例</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="token_address" className="block text-sm font-medium">
                代币地址
              </label>
              <input
                type="text"
                id="token_address"
                name="token_address"
                value={formData.token_address}
                onChange={handleChange}
                placeholder="输入代币地址"
                className="input"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="percentage" className="block text-sm font-medium">
                卖出比例 ({formData.percentage}%)
              </label>
              <input
                type="range"
                id="percentage"
                name="percentage"
                min="1"
                max="100"
                value={formData.percentage}
                onChange={handleChange}
                className="w-full appearance-none rounded-full bg-gray-700 h-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>1%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  处理中...
                </>
              ) : (
                <>
                  <SendHorizonal className="mr-2 h-4 w-4" />
                  提交卖出请求
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="flex flex-col gap-6">
          <div className="card">
            <h2 className="mb-4 text-xl font-semibold">请求预览</h2>
            <pre className="overflow-auto rounded-md bg-gray-800 p-4 text-sm text-gray-300">
              {formDataJson}
            </pre>
          </div>
          
          {result && (
            <div className="card">
              <h2 className="mb-4 text-xl font-semibold">请求结果</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${result.success ? 'bg-success-500' : 'bg-error-500'}`}></div>
                  <span className={`font-medium ${result.success ? 'text-success-500' : 'text-error-500'}`}>
                    {result.success ? '成功' : '失败'}
                  </span>
                </div>
                
                <p className="text-sm">{result.message}</p>
                
                {result.success && (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">代币地址:</h3>
                      <AddressDisplay address={result.token_address} maxLength={20} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400">卖出百分比:</p>
                        <p>{result.sell_percentage}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400">卖出数量:</p>
                        <p>{result.sell_amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">滑点 (BPS):</p>
                        <p>{result.slippage_bps} ({result.slippage_bps / 100}%)</p>
                      </div>
                      <div>
                        <p className="text-gray-400">优先费:</p>
                        <p>{result.priority_fee}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">小费金额:</p>
                        <p>{result.tip_amount} SOL</p>
                      </div>
                      <div>
                        <p className="text-gray-400">提交时间:</p>
                        <p>{result.submitted_at}</p>
                      </div>
                    </div>
                    
                    {result.signatures.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">交易签名:</h3>
                        <ul className="space-y-1">
                          {result.signatures.map((sig, index) => (
                            <li key={index} className="overflow-hidden text-ellipsis text-xs font-mono">
                              {sig}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}