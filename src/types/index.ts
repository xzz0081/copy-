// Monitor Address Types
export interface WalletConfig {
  compute_unit_limit: number;
  follow_percentage: number;
  is_active: boolean;
  max_price_multiplier: number;
  min_price_multiplier: number;
  note: string | null;
  priority_fee: number;
  slippage_percentage: number;
  sol_amount_max: number;
  sol_amount_min: number;
  tip_percentage: number;
  take_profit_percentage?: number;
  stop_loss_percentage?: number;
}

export interface AddWalletRequest {
  address: string;
  follow_percentage: number;
  slippage_percentage: number;
  tip_percentage: number;
  min_price_multiplier: number;
  max_price_multiplier: number;
  priority_fee: number;
  compute_unit_limit: number;
}

export interface MonitorAddressesResponse {
  data: {
    sol_address: string;
    targets: string[];
    wallets: Record<string, WalletConfig>;
  };
  message: string;
  success: boolean;
}

export interface MonitorAddressResponse {
  data: {
    address: string;
    config: WalletConfig;
    is_monitored: boolean;
  };
  message: string;
  success: boolean;
}

// Transaction Types
export interface Transaction {
  amount: number;
  build_data: string;
  expected_price: number;
  price: number;
  price_slippage: number;
  signature: string;
  sol_amount: number;
  status: string;
  timestamp: string;
  token_address: string;
  tx_type: string;
  wallet_address: string;
}

export interface TransactionsResponse {
  data: Transaction[];
  limit: number;
  offset: number;
  success: boolean;
  total: number;
}

// Manual Sell Types
export interface SellRequest {
  token_address: string;
  percentage: number;
  tip_fixed: number;
  slippage_bps: number;
  priority_fee: number;
  follow_system_defaults: boolean;
}

export interface SellResponse {
  success: boolean;
  message: string;
  signatures: string[];
  error: null | string;
  status: string;
  token_address: string;
  token_symbol: null | string;
  sell_percentage: number;
  sell_amount: number;
  sell_amount_raw: number;
  tip_amount: number;
  zero_slot_tip: null | number;
  slippage_bps: number;
  priority_fee: number;
  submitted_at: string;
}

// System Health Types
export interface SystemHealthResponse {
  status: number;
  data: any;
  responseTime: number;
  error?: boolean;
}