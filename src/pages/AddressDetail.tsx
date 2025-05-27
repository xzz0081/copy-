import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Play, Pause } from 'lucide-react';
import { getMonitorAddress, updateMonitorAddress, pauseWallet, resumeWallet } from '../services/api';
import { MonitorAddressResponse, WalletConfig } from '../types';
import Spinner from '../components/ui/Spinner';
import AddressDisplay from '../components/ui/AddressDisplay';
import toast from 'react-hot-toast';

export default function AddressDetail() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<WalletConfig | null>(null);
  const [formData, setFormData] = useState<Partial<WalletConfig>>({});

  useEffect(() => {
    if (address) {
      fetchAddressConfig(address);
    }
  }, [address]);

  const fetchAddressConfig = async (walletAddress: string) => {
    try {
      setLoading(true);
      const response = await getMonitorAddress(walletAddress) as MonitorAddressResponse;
      if (response.success) {
        setConfig(response.data.config);
        setFormData(response.data.config);
        setIsActive(response.data.config.is_active);
      } else {
        toast.error('获取地址配置失败');
      }
    } catch (error) {
      console.error('Error fetching address config:', error);
      toast.error('获取地址配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    let parsedValue: string | number | boolean = value;
    
    if (type === 'number') {
      parsedValue = parseFloat(value);
    } else if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    }
    
    setFormData({ ...formData, [name]: parsedValue });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    try {
      setSaving(true);
      const updateData = {
        address,
        ...formData,
      };

      const response = await updateMonitorAddress(updateData);
      if (response.success) {
        toast.success('配置已更新');
        // Refresh data
        fetchAddressConfig(address);
      } else {
        toast.error('更新配置失败');
      }
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('更新配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!address) return;

    try {
      setSaving(true);
      const response = isActive
        ? await pauseWallet(address)
        : await resumeWallet(address);

      if (response.success) {
        setIsActive(!isActive);
        toast.success(isActive ? '监控已暂停' : '监控已恢复');
        // Refresh data
        fetchAddressConfig(address);
      } else {
        toast.error(isActive ? '暂停监控失败' : '恢复监控失败');
      }
    } catch (error) {
      console.error('Error toggling active state:', error);
      toast.error('操作失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-4">
        <p className="text-xl text-gray-400">未找到地址配置</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <button 
          onClick={() => navigate('/')} 
          className="mr-4 flex items-center text-gray-400 hover:text-white"
        >
          <ArrowLeft className="mr-1 h-5 w-5" />
          返回列表
        </button>
        <h1 className="text-2xl font-bold">单地址配置</h1>
      </div>

      <div className="card">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-medium">地址:</span>
            <AddressDisplay address={address || ''} maxLength={20} className="text-base" />
          </div>
          <button
            onClick={handleToggleActive}
            disabled={saving}
            className={`btn ${isActive ? 'btn-outline' : 'btn-success'}`}
          >
            {saving ? (
              <Spinner size="sm" className="mr-2" />
            ) : isActive ? (
              <Pause className="mr-2 h-4 w-4" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {isActive ? '暂停监控' : '恢复监控'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="follow_percentage" className="block text-sm font-medium">
                跟单比例 (%)
              </label>
              <input
                type="number"
                id="follow_percentage"
                name="follow_percentage"
                min="1"
                max="100"
                value={formData.follow_percentage}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="slippage_percentage" className="block text-sm font-medium">
                滑点百分比 (%)
              </label>
              <input
                type="number"
                id="slippage_percentage"
                name="slippage_percentage"
                min="0.1"
                step="0.1"
                value={formData.slippage_percentage}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tip_percentage" className="block text-sm font-medium">
                小费百分比 (%)
              </label>
              <input
                type="number"
                id="tip_percentage"
                name="tip_percentage"
                min="0"
                step="0.1"
                value={formData.tip_percentage}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="min_price_multiplier" className="block text-sm font-medium">
                最小价格乘数
              </label>
              <input
                type="number"
                id="min_price_multiplier"
                name="min_price_multiplier"
                min="0"
                step="any"
                value={formData.min_price_multiplier}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="max_price_multiplier" className="block text-sm font-medium">
                最大价格乘数
              </label>
              <input
                type="number"
                id="max_price_multiplier"
                name="max_price_multiplier"
                min="0"
                step="any"
                value={formData.max_price_multiplier}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="priority_fee" className="block text-sm font-medium">
                优先费
              </label>
              <input
                type="number"
                id="priority_fee"
                name="priority_fee"
                min="0"
                step="1000"
                value={formData.priority_fee}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="compute_unit_limit" className="block text-sm font-medium">
                计算单元限制
              </label>
              <input
                type="number"
                id="compute_unit_limit"
                name="compute_unit_limit"
                min="0"
                step="1000"
                value={formData.compute_unit_limit}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="sol_amount_min" className="block text-sm font-medium">
                最小 SOL 数量
              </label>
              <input
                type="number"
                id="sol_amount_min"
                name="sol_amount_min"
                min="0"
                step="0.001"
                value={formData.sol_amount_min}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="sol_amount_max" className="block text-sm font-medium">
                最大 SOL 数量
              </label>
              <input
                type="number"
                id="sol_amount_max"
                name="sol_amount_max"
                min="0"
                step="0.1"
                value={formData.sol_amount_max}
                onChange={handleInputChange}
                className="input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="note" className="block text-sm font-medium">
              备注
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              value={formData.note || ''}
              onChange={handleInputChange}
              className="input"
            ></textarea>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-outline"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}