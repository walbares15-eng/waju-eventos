import type { AppState, EventItem, PaymentMethod, ProductItem, SaleRecord } from './types'

const eventId = 'evt-festa-bairro'
const productIds = {
  cerveja: 'prod-cerveja',
  refri: 'prod-refri',
  espetinho: 'prod-espetinho',
  agua: 'prod-agua',
  chopp: 'prod-chopp',
  pao: 'prod-pao',
}

const paymentMethods: PaymentMethod[] = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Cortesia']
const operators = ['Maria', 'Pedro', 'Bia', 'João', 'Ana']

const baseEvent: EventItem = {
  id: eventId,
  name: 'Festa do Bairro 2026',
  date: '2026-11-15',
  location: 'Parque Central',
  status: 'ativo',
}

const baseProducts: ProductItem[] = [
  { id: productIds.cerveja, eventId, name: 'Cerveja', price: 14, color: '#f59e0b', active: true },
  { id: productIds.refri, eventId, name: 'Refrigerante', price: 10, color: '#22c55e', active: true },
  { id: productIds.espetinho, eventId, name: 'Espetinho', price: 18, color: '#ef4444', active: true },
  { id: productIds.agua, eventId, name: 'Água', price: 7, color: '#38bdf8', active: true },
  { id: productIds.chopp, eventId, name: 'Chope', price: 16, color: '#8b5cf6', active: true },
  { id: productIds.pao, eventId, name: 'Pão de Queijo', price: 12, color: '#f472b6', active: true },
]

const buildSeedSales = (): SaleRecord[] => {
  const sales: SaleRecord[] = []

  for (let index = 1; index <= 30; index += 1) {
    const product = baseProducts[index % baseProducts.length]
    const qty = 1 + ((index * 2) % 4)
    const paymentMethod = paymentMethods[index % paymentMethods.length]
    const operator = operators[index % operators.length]
    const total = product.price * qty
    const createdAt = new Date(2026, 10, 15, 18 + (index % 8), (index * 11) % 60, 0).toISOString()

    sales.push({
      id: `sale-${index}`,
      ticketNumber: index,
      eventId,
      operator,
      paymentMethod,
      createdAt,
      status: index % 5 === 0 ? 'resgatada' : 'emitida',
      items: [{
        productId: product.id,
        name: product.name,
        qty,
        unitPrice: product.price,
        total,
      }],
      total,
    })
  }

  return sales
}

export const getSeedState = (): AppState => ({
  selectedEventId: eventId,
  events: [baseEvent],
  products: baseProducts,
  sales: buildSeedSales(),
  lastTicketNumber: 30,
  lastSyncAt: new Date().toISOString(),
  operator: 'Operador 01',
})

export const STORAGE_KEY = 'fichas-eventos-v1'

export const readState = (): AppState => {
  if (typeof window === 'undefined') {
    return getSeedState()
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return getSeedState()
  }

  try {
    const parsed = JSON.parse(raw) as AppState
    return parsed
  } catch {
    return getSeedState()
  }
}

export const writeState = (next: AppState) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

export const formatDateTime = (dateString: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(dateString))

export const getEventById = (eventIdValue: string, state: AppState) =>
  state.events.find((event) => event.id === eventIdValue) ?? state.events[0]

export const getTicketNumber = (state: AppState) => state.lastTicketNumber + 1
