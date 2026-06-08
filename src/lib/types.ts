export interface Product {
  id: string
  user_id: string
  name: string
  unit_price: number
  stock: number
  added_date: string
  created_at: string
  store_id?: string | null
  variants?: {color: string, size: string, price?: number, stock?: number, cost?: number}[] | null
  cost?: number | null
}

export interface Order {
  id: string
  user_id: string
  date: string
  day_seq: number
  phone: string
  address: string
  delivery_fee: number
  status: 'pending' | 'delivered' | 'cancelled'
  created_at: string
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
}

export interface RestockLog {
  id: string
  user_id: string
  product_id: string | null
  product_name: string
  quantity: number
  type: 'in' | 'out'
  note: string | null
  date: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  business_name: string | null
  subscription_status: 'trial' | 'active' | 'expired'
  trial_ends_at: string | null
  subscription_ends_at: string | null
}
