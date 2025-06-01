import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../services/authContext';

const ProtectedRoute: React.FC = () => {
  const { state } = useAuth();

  // 如果用户未认证，重定向到登录页面
  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 渲染子路由
  return <Outlet />;
};

export default ProtectedRoute; 