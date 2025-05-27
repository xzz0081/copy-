import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Save, X } from 'lucide-react';
import { getSpecialWallets, addSpecialWallet, updateSpecialWallet, deleteSpecialWallet } from '../services/api';
import { SpecialWalletConfig, AddSpecialWalletRequest, SpecialWalletsResponse } from '../types';
import Spinner from '../components/ui/Spinner';
import AddressDisplay from '../components/ui/AddressDisplay';
import toast from 'react-hot-toast';

export default function SpecialWallets() {
  const [wallets, setWallets] = useState<Record<string, SpecialWalletConfig>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<SpecialWalletConfig>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingWallet, setDeletingWallet] = useState<string | null>(null);
  const [newWallet, setNewWallet] = useState<AddSpecialWalletRequest>({
    wallet_address: '',
    slippage_percentage: 1.5,
    tip_percentage: 0.8,
    priority_fee_multiplier: 5,
    compute_limit: 70000,
    note: ''
  });

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const response = await getSpecialWallets() as SpecialWalletsResponse;
      if (response.success) {
        setWallets(response.data.wallets);
      } else {
        toast.error('获取专用钱包配置失败');
      }
    } catch (error) {
      console.error('Error fetching special wallets:', error);
      toast.error('获取专用钱包配置失败');
    } finally {
      setLoading(false);
    }
  };

  const refreshWallets = async () => {
    try {
      setRefreshing(true);
      await fetchWallets();
      toast.success('刷新成功');
    } catch (error) {
      console.error('Error refreshing wallets:', error);
      toast.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let parsedValue: string | number = value;
    
    if (type === 'number') {
      parsedValue = parseFloat(value);
    }
    
    setEditValues({
      ...editValues,
      [name]: parsedValue
    });
  };

  const handleNewWalletChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const startEditing = (walletAddress: string) => {
    setEditingWallet(walletAddress);
    setEditValues(wallets[walletAddress]);
  };

  const cancelEditing = () => {
    setEditingWallet(null);
    setEditValues({});
  };

  const saveChanges = async () => {
    if (!editingWallet || Object.keys(editValues).length === 0) return;

    try {
      const updateData = {
        wallet_address: editingWallet,
        slippage_percentage: editValues.slippage_percentage!,
        tip_percentage: editValues.tip_percentage!,
        priority_fee_multiplier: editValues.priority_fee_multiplier!,
        compute_limit: editValues.compute_limit!,
        note: editValues.note || ''
      };

      const response = await updateSpecialWallet(updateData);
      if (response.success) {
        toast.success('专用钱包配置已更新');
        // 更新本地状态
        setWallets((prev) => ({
          ...prev,
          [editingWallet]: {
            ...prev[editingWallet],
            ...editValues,
          },
        }));
        cancelEditing();
      } else {
        toast.error('更新专用钱包配置失败');
      }
    } catch (error) {
      console.error('Error updating special wallet:', error);
      toast.error('更新专用钱包配置失败');
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newWallet.wallet_address) {
      toast.error('请输入钱包地址');
      return;
    }
    
    try {
      const response = await addSpecialWallet(newWallet);
      
      if (response.success) {
        toast.success('专用钱包配置已添加');
        setShowAddForm(false);
        setNewWallet({
          wallet_address: '',
          slippage_percentage: 1.5,
          tip_percentage: 0.8,
          priority_fee_multiplier: 5,
          compute_limit: 70000,
          note: ''
        });
        // 刷新钱包列表
        fetchWallets();
      } else {
        toast.error(response.message || '添加专用钱包配置失败');
      }
    } catch (error) {
      console.error('Error adding special wallet:', error);
      toast.error('添加专用钱包配置失败');
    }
  };

  const handleDeleteWallet = async (walletAddress: string) => {
    try {
      setDeletingWallet(walletAddress);
      setIsDeleting(true);
      
      const response = await deleteSpecialWallet(walletAddress);
      
      if (response.success) {
        toast.success('专用钱包配置已删除');
        // 从本地状态中移除
        setWallets(prevWallets => {
          const newWallets = { ...prevWallets };
          delete newWallets[walletAddress];
          return newWallets;
        });
      } else {
        toast.error(response.message || '删除专用钱包配置失败');
      }
    } catch (error) {
      console.error('Error deleting special wallet:', error);
      toast.error('删除专用钱包配置失败');
    } finally {
      setDeletingWallet(null);
      setIsDeleting(false);
    }
  };

  const confirmDelete = (walletAddress: string) => {
    if (window.confirm(`确定要删除钱包 ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)} 的专用配置吗？`)) {
      handleDeleteWallet(walletAddress);
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="flex h-80 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">专用钱包配置</h1>
        <div className="flex space-x-2">
          <button
            onClick={refreshWallets}
            className="btn btn-secondary btn-sm"
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
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary btn-sm"
          >
            {showAddForm ? (
              <>
                <X className="mr-2 h-4 w-4" />
                取消
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                添加专用钱包
              </>
            )}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card mb-6">
          <h2 className="mb-4 text-xl font-semibold">添加专用钱包配置</h2>
          <form onSubmit={handleAddWallet} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="wallet_address" className="block text-sm font-medium">
                  钱包地址 <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  id="wallet_address"
                  name="wallet_address"
                  value={newWallet.wallet_address}
                  onChange={handleNewWalletChange}
                  placeholder="输入钱包地址"
                  className="input"
                  required
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
                  onChange={handleNewWalletChange}
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
                  onChange={handleNewWalletChange}
                  min="0"
                  step="0.1"
                  className="input"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="priority_fee_multiplier" className="block text-sm font-medium">
                  优先费乘数
                </label>
                <input
                  type="number"
                  id="priority_fee_multiplier"
                  name="priority_fee_multiplier"
                  value={newWallet.priority_fee_multiplier}
                  onChange={handleNewWalletChange}
                  min="1"
                  className="input"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="compute_limit" className="block text-sm font-medium">
                  计算单元限制
                </label>
                <input
                  type="number"
                  id="compute_limit"
                  name="compute_limit"
                  value={newWallet.compute_limit}
                  onChange={handleNewWalletChange}
                  min="1000"
                  className="input"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="note" className="block text-sm font-medium">
                  备注
                </label>
                <input
                  type="text"
                  id="note"
                  name="note"
                  value={newWallet.note}
                  onChange={handleNewWalletChange}
                  placeholder="添加备注信息"
                  className="input"
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="btn btn-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                添加配置
              </button>
            </div>
          </form>
        </div>
      )}

      {Object.keys(wallets).length === 0 ? (
        <div className="card">
          <div className="flex h-40 flex-col items-center justify-center">
            <p className="text-gray-400">暂无专用钱包配置</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn btn-secondary btn-sm mt-4"
            >
              <Plus className="mr-2 h-4 w-4" />
              添加专用钱包
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="text-left text-sm text-gray-400">
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3">钱包地址</th>
                  <th className="px-4 py-3">滑点</th>
                  <th className="px-4 py-3">小费比例</th>
                  <th className="px-4 py-3">优先费乘数</th>
                  <th className="px-4 py-3">计算单元限制</th>
                  <th className="px-4 py-3">备注</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(wallets).map(([walletAddress, config]) => (
                  <tr
                    key={walletAddress}
                    className="border-b border-gray-700 hover:bg-gray-800"
                  >
                    <td className="px-4 py-3">
                      <AddressDisplay address={walletAddress} maxLength={12} />
                    </td>
                    
                    {editingWallet === walletAddress ? (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            name="slippage_percentage"
                            value={editValues.slippage_percentage}
                            onChange={handleInputChange}
                            min="0.1"
                            step="0.1"
                            className="input input-sm w-full"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            name="tip_percentage"
                            value={editValues.tip_percentage}
                            onChange={handleInputChange}
                            min="0"
                            step="0.1"
                            className="input input-sm w-full"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            name="priority_fee_multiplier"
                            value={editValues.priority_fee_multiplier}
                            onChange={handleInputChange}
                            min="1"
                            className="input input-sm w-full"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            name="compute_limit"
                            value={editValues.compute_limit}
                            onChange={handleInputChange}
                            min="1000"
                            className="input input-sm w-full"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            name="note"
                            value={editValues.note || ''}
                            onChange={handleInputChange}
                            className="input input-sm w-full"
                            placeholder="添加备注"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <button
                              onClick={saveChanges}
                              className="btn btn-success btn-sm"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="btn btn-ghost btn-sm"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">{config.slippage_percentage}%</td>
                        <td className="px-4 py-3">{config.tip_percentage}%</td>
                        <td className="px-4 py-3">{config.priority_fee_multiplier}</td>
                        <td className="px-4 py-3">{config.compute_limit}</td>
                        <td className="px-4 py-3">{config.note || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => startEditing(walletAddress)}
                              className="btn btn-ghost btn-sm"
                              disabled={!!editingWallet}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => confirmDelete(walletAddress)}
                              className="btn btn-ghost btn-sm text-error-500"
                              disabled={isDeleting}
                            >
                              {deletingWallet === walletAddress && isDeleting ? (
                                <Spinner size="sm" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 