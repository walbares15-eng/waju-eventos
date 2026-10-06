export type PaymentMethod = 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito' | 'Cortesia'

export type EventStatus = 'ativo' | 'encerrado'

export interface EventItem {
  id: string
  name: string
  date: string
  location: string
  status: EventStatus
}

export interface ProductItem {
  id: string
  eventId: string
  name: string
  price: number
  color: string
  active: boolean
  image?: string
}

export interface SaleItem {
  productId: string
  name: string
  qty: number
  unitPrice: number
  total: number
}

export interface SaleRecord {
  id: string
  ticketNumber: number
  eventId: string
  operator: string
  paymentMethod: PaymentMethod
  createdAt: string
  status: 'emitida' | 'resgatada' | 'cancelada'
  items: SaleItem[]
  total: number
}

export interface AppState {
  selectedEventId: string
  events: EventItem[]
  products: ProductItem[]
  sales: SaleRecord[]
  lastTicketNumber: number
  lastSyncAt: string
  operator: string
}
