import { Outlet, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { 
  LineChart, 
  BarChart3, 
  Settings, 
  History, 
  DollarSign, 
  Activity, 
  Menu, 
  X 
} from 'lucide-react';
import { cn } from '../utils/cn';

type NavItemProps = {
  to: string;
  icon: React.ReactNode;
  text: string;
};

function NavItem({ to, icon, text }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary-700 text-white'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        )
      }
    >
      {icon}
      <span>{text}</span>
    </NavLink>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-700 bg-background-dark px-4 sm:px-6">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-400 hover:text-gray-300 lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <LineChart className="h-6 w-6 text-primary-500" />
          <span className="text-xl font-bold">跟单系统</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-400">v1.0.0</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar */}
        <div
          className={cn(
            'fixed inset-0 z-50 lg:hidden',
            sidebarOpen ? 'block' : 'hidden'
          )}
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <nav className="absolute bottom-0 left-0 top-0 w-64 bg-background-dark p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LineChart className="h-6 w-6 text-primary-500" />
                <span className="text-xl font-bold">跟单系统</span>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-400 hover:text-gray-300"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-8 flex flex-col gap-2">
              <NavItem to="/" icon={<BarChart3 className="h-5 w-5" />} text="监控地址" />
              <NavItem to="/transactions" icon={<History className="h-5 w-5" />} text="交易历史" />
              <NavItem to="/manual-sell" icon={<DollarSign className="h-5 w-5" />} text="手动卖出" />
              <NavItem to="/system-health" icon={<Activity className="h-5 w-5" />} text="系统健康" />
            </div>
          </nav>
        </div>

        {/* Desktop sidebar */}
        <nav className="hidden w-64 border-r border-gray-700 bg-background-dark p-4 lg:block">
          <div className="flex flex-col gap-2">
            <NavItem to="/" icon={<BarChart3 className="h-5 w-5" />} text="监控地址" />
            <NavItem to="/transactions" icon={<History className="h-5 w-5" />} text="交易历史" />
            <NavItem to="/manual-sell" icon={<DollarSign className="h-5 w-5" />} text="手动卖出" />
            <NavItem to="/system-health" icon={<Activity className="h-5 w-5" />} text="系统健康" />
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}