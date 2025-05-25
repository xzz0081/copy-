import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, Edit, ExternalLink, Plus } from 'lucide-react';
import { getMonitorAddresses, updateMonitorAddress, addMonitorAddress } from '../services/api';
import { MonitorAddressesResponse, WalletConfig, AddWalletRequest } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import AddressDisplay from '../components/ui/AddressDisplay';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';

export default function MonitorAddresses() {
  const [addresses, setAddresses] = useState<Record<string, WalletConfig>>({});
  const [targetAddresses, setTargetAddresses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<WalletConfig>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addWalletLoading, setAddWalletLoading] = useState(false);
  const [newWallet, setNewWallet] = useState<AddWalletRequest>({
    address: '',
    follow_percentage: 30.0,
    slippage_percentage: 2.0,
    tip_percentage: 1.0,
    min_price_multiplier: 0.8,
    max_price_multiplier: 1.2,
    priority_fee: 50000,
    compute_unit_limit: 200000
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await getMonitorAddresses() as MonitorAddressesResponse;
      if (response.success) {
        setAddresses(response.data.wallets);
        setTargetAddresses(response.data.targets);
      } else {
        toast.error('获取监控地址失败');
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('获取监控地址失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAddresses();
    setRefreshing(false);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const filteredAddresses = Object.entries(addresses).filter(([address, config]) => {
    const lowerQuery = searchQuery.toLowerCase();
    return (
      address.toLowerCase().includes(lowerQuery) ||
      (config.note && config.note.toLowerCase().includes(lowerQuery)) ||
      (config.is_active ? '活跃'.includes(lowerQuery) : '暂停'.includes(lowerQuery))
    );
  });

  const startEditing = (address: string) => {
    setEditingAddress(address);
    setEditValues({
      follow_percentage: addresses[address].follow_percentage,
      is_active: addresses[address].is_active,
    });
  };

  const cancelEditing = () => {
    setEditingAddress(null);
    setEditValues({});
  };

  const saveChanges = async () => {
    if (!editingAddress || Object.keys(editValues).length === 0) return;

    try {
      const updateData = {
        address: editingAddress,
        ...addresses[editingAddress],
        ...editValues,
      };

      const response = await updateMonitorAddress(updateData);
      if (response.success) {
        toast.success('更新成功');
        // Update local state
        setAddresses((prev) => ({
          ...prev,
          [editingAddress]: {
            ...prev[editingAddress],
            ...editValues,
          },
        }));
      } else {
        toast.error('更新失败');
      }
    } catch (error) {
      console.error('Error updating address:', error);
      toast.error('更新失败');
    } finally {
      cancelEditing();
    }
  };

  const handleAddWalletChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    let parsedValue: string | number = value;
    
    if (type === 'number') {
      parsedValue = parseFloat(value);
    }
    
    setNewWallet({
      ...newWallet,
      [name]: parsedValue
    });
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newWallet.address) {
      toast.error('请输入钱包地址');
      return;
    }
    
    try {
      setAddWalletLoading(true);
      const response = await addMonitorAddress(newWallet);
      
      if (response.success) {
        toast.success('添加钱包地址成功');
        setShowAddForm(false);
        setNewWallet({
          address: '',
          follow_percentage: 30.0,
          slippage_percentage: 2.0,
          tip_percentage: 1.0,
          min_price_multiplier: 0.8,
          max_price_multiplier: 1.2,
          priority_fee: 50000,
          compute_unit_limit: 200000
        });
        // 刷新地址列表
        fetchAddresses();
      } else {
        toast.error(response.message || '添加钱包地址失败');
      }
    } catch (error) {
      console.error('Error adding wallet address:', error);
      toast.error('添加钱包地址失败');
    } finally {
      setAddWalletLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">监控地址列表</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            className="btn btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加钱包
          </button>
          <button 
            onClick={handleRefresh} 
            className="btn btn-primary"
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新
              </>
            )}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card">
          <h2 className="mb-4 text-xl font-semibold">添加新钱包地址</h2>
          <form onSubmit={handleAddWallet} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="address" className="block text-sm font-medium">
                  钱包地址 <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={newWallet.address}
                  onChange={handleAddWalletChange}
                  placeholder="输入钱包地址"
                  className="input"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="follow_percentage" className="block text-sm font-medium">
                  跟单比例 (%)
                </label>
                <input
                  type="number"
                  id="follow_percentage"
                  name="follow_percentage"
                  value={newWallet.follow_percentage}
                  onChange={handleAddWalletChange}
                  min="1"
                  max="100"
                  step="0.1"
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
                  value={newWallet.slippage_percentage}
                  onChange={handleAddWalletChange}
                  min="0.1"
                  step="0.1"
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
                  value={newWallet.tip_percentage}
                  onChange={handleAddWalletChange}
                  min="0"
                  step="0.1"
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
                  value={newWallet.min_price_multiplier}
                  onChange={handleAddWalletChange}
                  min="0"
                  step="0.01"
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
                  value={newWallet.max_price_multiplier}
                  onChange={handleAddWalletChange}
                  min="0"
                  step="0.01"
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
                  value={newWallet.priority_fee}
                  onChange={handleAddWalletChange}
                  min="0"
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
                  value={newWallet.compute_unit_limit}
                  onChange={handleAddWalletChange}
                  min="0"
                  className="input"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn btn-outline"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={addWalletLoading}
                className="btn btn-primary"
              >
                {addWalletLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    添加中...
                  </>
                ) : '添加'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索地址或状态..."
            className="input pl-10"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-2 text-left">地址</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-left">跟单比例</th>
                  <th className="px-4 py-2 text-left">滑点</th>
                  <th className="px-4 py-2 text-left">备注</th>
                  <th className="px-4 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAddresses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      没有找到匹配的地址
                    </td>
                  </tr>
                ) : (
                  filteredAddresses.map(([address, config]) => (
                    <tr key={address} className="border-b border-gray-700 hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <AddressDisplay address={address} />
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <div className="flex items-center">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editValues.is_active}
                                onChange={(e) => setEditValues({ ...editValues, is_active: e.target.checked })}
                                className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-primary-600"
                              />
                              活跃
                            </label>
                          </div>
                        ) : (
                          <StatusBadge
                            status={config.is_active ? 'success' : 'neutral'}
                            text={config.is_active ? '活跃' : '暂停'}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingAddress === address ? (
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={editValues.follow_percentage}
                            onChange={(e) => setEditValues({ ...editValues, follow_percentage: parseInt(e.target.value) })}
                            className="input w-20"
                          />
                        ) : (
                          `${config.follow_percentage}%`
                        )}
                      </td>
                      <td className="px-4 py-3">{config.slippage_percentage}%</td>
                      <td className="px-4 py-3 text-gray-400">{config.note || '无'}</td>
                      <td className="px-4 py-3 text-right">
                        {editingAddress === address ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={saveChanges}
                              className="btn btn-sm btn-success"
                            >
                              保存
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="btn btn-sm btn-outline"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => startEditing(address)}
                              className="btn btn-sm btn-outline"
                            >
                              <Edit className="mr-1 h-3 w-3" />
                              编辑
                            </button>
                            <Link
                              to={`/address/${address}`}
                              className="btn btn-sm btn-primary"
                            >
                              <ExternalLink className="mr-1 h-3 w-3" />
                              详情
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}