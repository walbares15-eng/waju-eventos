import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  formatCurrency,
  formatDateTime,
  getEventById,
  getTicketNumber,
  readState,
  writeState,
} from './data'
import type { AppState, EventItem, PaymentMethod, ProductItem, SaleRecord } from './types'

type Tab = 'caixa' | 'resgate' | 'admin' | 'relatorio'

type ReportFilter = {
  eventId: string
  operator: string
  paymentMethod: string
}

const PAYMENT_OPTIONS: PaymentMethod[] = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Cortesia']

function App() {
  const [state, setState] = useState<AppState>(() => readState())
  const [activeTab, setActiveTab] = useState<Tab>('caixa')
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('Dinheiro')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [resgateInput, setResgateInput] = useState('')
  const [printTicket, setPrintTicket] = useState<SaleRecord | null>(null)
  const [reportFilter, setReportFilter] = useState<ReportFilter>({
    eventId: 'todos',
    operator: 'Todos',
    paymentMethod: 'Todos',
  })
  const [eventDraft, setEventDraft] = useState({ name: '', date: '2026-11-20', location: '' })
  const [productDraft, setProductDraft] = useState({ name: '', price: '12', color: '#2563eb' })
  const [statusMessage, setStatusMessage] = useState('Offline pronto para vender.')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    writeState(state)
  }, [state])

  const selectedEvent = useMemo(
    () => getEventById(state.selectedEventId, state),
    [state],
  )

  const visibleProducts = useMemo(
    () => state.products.filter((product) => product.eventId === selectedEvent.id && product.active),
    [selectedEvent.id, state.products],
  )

  const cartItems = useMemo(
    () =>
      visibleProducts
        .filter((product) => cart[product.id])
        .map((product) => ({
          ...product,
          qty: cart[product.id],
          total: product.price * cart[product.id],
        })),
    [cart, visibleProducts],
  )

  const finalTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.total, 0),
    [cartItems],
  )

  const addToCart = (productId: string) => {
    setCart((current) => ({
      ...current,
      [productId]: (current[productId] ?? 0) + 1,
    }))
  }

  const changeQty = (productId: string, delta: number) => {
    setCart((current) => {
      const nextQty = (current[productId] ?? 0) + delta
      if (nextQty <= 0) {
        const updated = { ...current }
        delete updated[productId]
        return updated
      }
      return { ...current, [productId]: nextQty }
    })
  }

  const clearCart = () => setCart({})

  const finalizeSale = async () => {
    if (!cartItems.length) {
      setStatusMessage('Selecione pelo menos um produto antes de concluir a venda.')
      return
    }

    if (isProcessing) return
    setIsProcessing(true)

    try {
      const ticketNumber = getTicketNumber(state)
      const newSale: SaleRecord = {
        id: crypto.randomUUID(),
        ticketNumber,
        eventId: selectedEvent.id,
        operator: state.operator,
        paymentMethod: selectedPayment,
        createdAt: new Date().toISOString(),
        status: 'emitida',
        items: cartItems.map((item) => ({
          productId: item.id,
          name: item.name,
          qty: item.qty,
          unitPrice: item.price,
          total: item.total,
        })),
        total: finalTotal,
      }

      setState((previous) => ({
        ...previous,
        sales: [newSale, ...previous.sales],
        lastTicketNumber: ticketNumber,
        lastSyncAt: new Date().toISOString(),
      }))
      setPrintTicket(newSale)
      setStatusMessage(`Venda ${ticketNumber} registrada com sucesso.`)
      setCart({})
      setSelectedPayment('Dinheiro')

      // Pequeno delay para garantir que o estado do printTicket foi atualizado antes de abrir a janela de impressão
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.print()
        }
        setIsProcessing(false)
      }, 100)
    } catch (error) {
      console.error(error)
      setStatusMessage('Erro ao registrar venda. Tente novamente.')
      setIsProcessing(false)
    }
  }

  const handleResgate = () => {
    const numericTicket = Number(resgateInput)
    if (!numericTicket) {
      setStatusMessage('Informe um número de ficha válido para resgatar.')
      return
    }

    const target = state.sales.find((sale) => sale.ticketNumber === numericTicket)
    if (!target) {
      setStatusMessage('Ficha não encontrada. Verifique o número e tente novamente.')
      return
    }

    if (target.status === 'resgatada' || target.status === 'cancelada') {
      setStatusMessage(`A ficha ${numericTicket} já foi ${target.status === 'cancelada' ? 'cancelada' : 'resgatada'}.`)
      return
    }

    setState((previous) => ({
      ...previous,
      sales: previous.sales.map((sale) =>
        sale.ticketNumber === numericTicket ? { ...sale, status: 'resgatada' } : sale,
      ),
    }))
    setStatusMessage(`Ficha ${numericTicket} marcada como resgatada.`)
    setResgateInput('')
  }

  const startSupervisorAction = (mode: 'reprint-last' | 'reprint-number' | 'cancel') => {
    const pin = typeof window !== 'undefined' ? window.prompt('Informe o PIN do supervisor:') : null

    if (pin !== '1234') {
      setStatusMessage('PIN inválido. Ação bloqueada.')
      return
    }

    if (mode === 'reprint-last') {
      const latest = state.sales[0]
      if (!latest) {
        setStatusMessage('Nenhuma venda disponível para reimprimir.')
        return
      }
      setPrintTicket(latest)
      setStatusMessage(`Última venda reimpresa: ficha ${latest.ticketNumber}.`)
      if (typeof window !== 'undefined') {
        window.print()
      }
      return
    }

    if (mode === 'reprint-number') {
      const ticket = typeof window !== 'undefined' ? Number(window.prompt('Número da ficha:')) : 0
      const found = state.sales.find((sale) => sale.ticketNumber === ticket)
      if (!found) {
        setStatusMessage('Número de ficha não encontrado.')
        return
      }
      setPrintTicket(found)
      setStatusMessage(`Ficha ${found.ticketNumber} enviada para impressão.`)
      if (typeof window !== 'undefined') {
        window.print()
      }
      return
    }

    const ticket = typeof window !== 'undefined' ? Number(window.prompt('Número da ficha para cancelamento:')) : 0
    const found = state.sales.find((sale) => sale.ticketNumber === ticket)
    if (!found) {
      setStatusMessage('Número de ficha não encontrado para cancelamento.')
      return
    }
    const reason = typeof window !== 'undefined' ? window.prompt('Motivo do cancelamento:') ?? 'Sem motivo informado' : 'Sem motivo informado'
    setState((previous) => ({
      ...previous,
      sales: previous.sales.map((sale) =>
        sale.ticketNumber === ticket ? { ...sale, status: 'cancelada' } : sale,
      ),
    }))
    setStatusMessage(`Ficha ${ticket} cancelada. Motivo: ${reason}.`)
  }

  const createEvent = () => {
    if (!eventDraft.name || !eventDraft.location) {
      setStatusMessage('Preencha nome e local do evento para continuar.')
      return
    }

    const newEvent: EventItem = {
      id: crypto.randomUUID(),
      name: eventDraft.name,
      date: eventDraft.date,
      location: eventDraft.location,
      status: 'ativo',
    }

    setState((previous) => ({
      ...previous,
      events: [...previous.events, newEvent],
      selectedEventId: newEvent.id,
    }))
    setEventDraft({ name: '', date: '2026-11-20', location: '' })
    setStatusMessage(`Evento ${newEvent.name} criado com sucesso.`)
  }

  const createProduct = () => {
    if (!productDraft.name || !productDraft.price) {
      setStatusMessage('Preencha nome e valor do produto para incluir no evento.')
      return
    }

    const newProduct: ProductItem = {
      id: crypto.randomUUID(),
      eventId: selectedEvent.id,
      name: productDraft.name,
      price: Number(productDraft.price),
      color: productDraft.color,
      active: true,
    }

    setState((previous) => ({
      ...previous,
      products: [newProduct, ...previous.products],
    }))
    setProductDraft({ name: '', price: '12', color: '#2563eb' })
    setStatusMessage(`Produto ${newProduct.name} adicionado ao evento.`)
  }

  const toggleProduct = (productId: string) => {
    setState((previous) => ({
      ...previous,
      products: previous.products.map((product) =>
        product.id === productId ? { ...product, active: !product.active } : product,
      ),
    }))
  }

  const deleteProduct = (productId: string) => {
    setState((previous) => ({
      ...previous,
      products: previous.products.filter((product) => product.id !== productId),
    }))
  }

  const filteredSales = useMemo(() => {
    return state.sales.filter((sale) => {
      const matchesEvent = reportFilter.eventId === 'todos' || sale.eventId === reportFilter.eventId
      const matchesOperator =
        reportFilter.operator === 'Todos' || sale.operator === reportFilter.operator
      const matchesPayment =
        reportFilter.paymentMethod === 'Todos' || sale.paymentMethod === reportFilter.paymentMethod
      return matchesEvent && matchesOperator && matchesPayment
    })
  }, [reportFilter, state.sales])

  const summaryCards = useMemo(() => {
    const totalSold = filteredSales.reduce((sum, sale) => sum + sale.total, 0)
    const totalTickets = filteredSales.length
    const ticketAverage = totalTickets ? totalSold / totalTickets : 0
    return {
      totalSold,
      totalTickets,
      ticketAverage,
    }
  }, [filteredSales])

  const salesByProduct = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; total: number }>()

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const current = map.get(item.productId) ?? { name: item.name, quantity: 0, total: 0 }
        current.quantity += item.qty
        current.total += item.total
        map.set(item.productId, current)
      })
    })

    return [...map.values()].sort((left, right) => right.total - left.total)
  }, [filteredSales])

  const salesByPayment = useMemo(() => {
    const map = new Map<string, number>()
    filteredSales.forEach((sale) => {
      map.set(sale.paymentMethod, (map.get(sale.paymentMethod) ?? 0) + sale.total)
    })

    return [...map.entries()].map(([label, total]) => ({ label, total }))
  }, [filteredSales])

  const salesByOperator = useMemo(() => {
    const map = new Map<string, number>()
    filteredSales.forEach((sale) => {
      map.set(sale.operator, (map.get(sale.operator) ?? 0) + sale.total)
    })

    return [...map.entries()].map(([operator, total]) => ({ operator, total }))
  }, [filteredSales])

  const hourlySales = useMemo(() => {
    const groups = Array.from({ length: 12 }, (_, index) => ({ hour: `${index + 12}:00`, value: 0 }))
    filteredSales.forEach((sale) => {
      const hour = new Date(sale.createdAt).getHours()
      const offset = hour - 12
      if (offset >= 0 && offset < groups.length) {
        groups[offset].value += sale.total
      }
    })
    return groups
  }, [filteredSales])

  const exportCsv = () => {
    const header = ['Produto', 'Quantidade', 'Valor Total']
    const rows = salesByProduct.map((item) => [item.name, item.quantity, item.total.toFixed(2)])
    const csv = [header, ...rows].map((line) => line.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'relatorio-fichas.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `wj-eventos-backup-${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    setStatusMessage('Backup exportado com sucesso.')
  }

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader()
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], 'UTF-8')
      fileReader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string)
          if (parsed && parsed.events && parsed.sales) {
            setState(parsed)
            setStatusMessage('Backup restaurado com sucesso.')
          } else {
            setStatusMessage('Arquivo de backup inválido.')
          }
        } catch {
          setStatusMessage('Erro ao ler arquivo de backup.')
        }
      }
    }
  }

  const wipeAllData = () => {
    const pin = typeof window !== 'undefined' ? window.prompt('Para APAGAR TUDO, digite o PIN mestre (1234):') : null
    if (pin === '1234') {
      if (typeof window !== 'undefined' && window.confirm('TEM CERTEZA? Isso apagará todos os eventos, produtos e vendas permanentemente.')) {
        const initialState = {
          selectedEventId: '',
          events: [],
          products: [],
          sales: [],
          lastTicketNumber: 0,
          lastSyncAt: new Date().toISOString(),
          operator: 'Operador 01',
        }
        setState(initialState)
        setStatusMessage('Todos os dados foram apagados.')
      }
    } else {
      setStatusMessage('PIN incorreto. Ação cancelada.')
    }
  }

  const handleSync = () => {
    setState((previous) => ({ ...previous, lastSyncAt: new Date().toISOString() }))
    setStatusMessage('Sincronização concluída. Dados online e offline consistentes.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">WAJU EVENTOS</p>
          <h1>PDV de Vendas</h1>
        </div>
        <div className="status-pill">
          <span className="dot" aria-hidden="true" />
          {state.lastSyncAt ? `Offline • ${formatDateTime(state.lastSyncAt)}` : 'Offline'}
        </div>
      </header>

      <nav className="tab-bar" aria-label="Navegação principal">
        {['caixa', 'resgate', 'admin', 'relatorio'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab as Tab)}
          >
            {tab === 'caixa' && 'Caixa'}
            {tab === 'resgate' && 'Resgate'}
            {tab === 'admin' && 'Admin'}
            {tab === 'relatorio' && 'Relatório'}
          </button>
        ))}
      </nav>

      <div className="status-bar">{statusMessage}</div>

      {activeTab === 'caixa' && (
        <div className="content-grid">
          <section className="panel">
            <div className="panel-header">
              <h2>Vendedor</h2>
              <button type="button" className="secondary" onClick={handleSync}>
                Sincronizar
              </button>
            </div>

            <div className="event-select-row">
              <label>
                Evento
                <select
                  value={state.selectedEventId}
                  onChange={(event) => setState((previous) => ({ ...previous, selectedEventId: event.target.value }))}
                >
                  {state.events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Operador
                <input
                  value={state.operator}
                  onChange={(event) => setState((previous) => ({ ...previous, operator: event.target.value }))}
                />
              </label>
            </div>

            <div className="products-grid">
              {visibleProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="product-button"
                  style={{ background: product.color }}
                  onClick={() => addToCart(product.id)}
                >
                  <span>{product.name}</span>
                  <strong>{formatCurrency(product.price)}</strong>
                </button>
              ))}
            </div>
          </section>

          <aside className="panel cart-panel">
            <h2>Carrinho</h2>

            {cartItems.length ? (
              <>
                <div className="cart-list">
                  {cartItems.map((item) => (
                    <div key={item.id} className="cart-item">
                      <div>
                        <strong>{item.name}</strong>
                        <span>{formatCurrency(item.price)} cada</span>
                      </div>
                      <div className="qty-box">
                        <button type="button" onClick={() => changeQty(item.id, -1)}>-</button>
                        <span>{item.qty}</span>
                        <button type="button" onClick={() => changeQty(item.id, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="payment-grid">
                  {PAYMENT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={selectedPayment === option ? 'payment active' : 'payment'}
                      onClick={() => setSelectedPayment(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className="totals">
                  <span>Total</span>
                  <strong>{formatCurrency(finalTotal)}</strong>
                </div>

                <div className="cart-actions">
                  <button type="button" className="secondary" onClick={clearCart}>
                    Limpar
                  </button>
                  <button type="button" className="primary" onClick={finalizeSale}>
                    Finalizar e imprimir
                  </button>
                </div>

                <div className="supervisor-actions">
                  <button type="button" className="secondary" onClick={() => startSupervisorAction('reprint-last')}>
                    Reimprimir última
                  </button>
                  <button type="button" className="secondary" onClick={() => startSupervisorAction('reprint-number')}>
                    Reimprimir por nº
                  </button>
                  <button type="button" className="danger" onClick={() => startSupervisorAction('cancel')}>
                    Cancelar venda
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-cart">Nenhum item no carrinho.</div>
            )}
          </aside>
        </div>
      )}

      {activeTab === 'resgate' && (
        <section className="panel wide-panel">
          <h2>Resgate de ficha</h2>
          <div className="resgate-box">
            <input
              value={resgateInput}
              placeholder="Digite o número da ficha"
              onChange={(event) => setResgateInput(event.target.value)}
            />
            <button type="button" className="primary" onClick={handleResgate}>
              Validar ficha
            </button>
          </div>

          <div className="mini-table">
            <table>
              <thead>
                <tr>
                  <th>Ficha</th>
                  <th>Operador</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {state.sales.slice(0, 8).map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.ticketNumber}</td>
                    <td>{sale.operator}</td>
                    <td>{sale.paymentMethod}</td>
                    <td>{sale.status}</td>
                    <td>{formatCurrency(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'admin' && (
        <div className="content-grid admin-grid">
          <section className="panel">
            <h2>Eventos</h2>
            <div className="form-grid">
              <input
                placeholder="Nome do evento"
                value={eventDraft.name}
                onChange={(event) => setEventDraft((previous) => ({ ...previous, name: event.target.value }))}
              />
              <input
                type="date"
                value={eventDraft.date}
                onChange={(event) => setEventDraft((previous) => ({ ...previous, date: event.target.value }))}
              />
              <input
                placeholder="Local"
                value={eventDraft.location}
                onChange={(event) => setEventDraft((previous) => ({ ...previous, location: event.target.value }))}
              />
            </div>
            <button type="button" className="primary" onClick={createEvent}>
              Cadastrar evento
            </button>

            <div className="group-list">
              {state.events.map((event) => (
                <div key={event.id} className="list-card">
                  <div>
                    <strong>{event.name}</strong>
                    <span>{event.location}</span>
                  </div>
                  <button
                    type="button"
                    className={state.selectedEventId === event.id ? 'secondary active' : 'secondary'}
                    onClick={() => setState((previous) => ({ ...previous, selectedEventId: event.id }))}
                  >
                    {state.selectedEventId === event.id ? 'Selecionado' : 'Selecionar'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Produtos do evento</h2>
            <div className="form-grid">
              <input
                placeholder="Nome do produto"
                value={productDraft.name}
                onChange={(event) => setProductDraft((previous) => ({ ...previous, name: event.target.value }))}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={productDraft.price}
                onChange={(event) => setProductDraft((previous) => ({ ...previous, price: event.target.value }))}
              />
              <input
                type="color"
                value={productDraft.color}
                onChange={(event) => setProductDraft((previous) => ({ ...previous, color: event.target.value }))}
              />
            </div>
            <button type="button" className="primary" onClick={createProduct}>
              Incluir produto
            </button>

            <div className="group-list">
              {state.products
                .filter((product) => product.eventId === selectedEvent.id)
                .map((product) => (
                  <div key={product.id} className="list-card product-row">
                    <div className="product-name-block">
                      <span className="swatch" style={{ background: product.color }} />
                      <div>
                        <strong>{product.name}</strong>
                        <span>{formatCurrency(product.price)}</span>
                      </div>
                    </div>
                    <div className="admin-actions">
                      <button type="button" className="secondary" onClick={() => toggleProduct(product.id)}>
                        {product.active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button type="button" className="danger" onClick={() => deleteProduct(product.id)}>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <section className="panel">
            <h2>Backup & Restauração</h2>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#666' }}>
              Garanta a segurança dos dados exportando um backup antes de iniciar o evento ou caso precise trocar de dispositivo.
            </p>
            <div className="admin-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="button" className="primary" onClick={exportBackup}>
                Exportar Backup (JSON)
              </button>
              <label className="secondary" style={{ textAlign: 'center', cursor: 'pointer', padding: '10px', borderRadius: '5px' }}>
                Restaurar Backup
                <input type="file" onChange={importBackup} accept=".json" style={{ display: 'none' }} />
              </label>
              <button type="button" className="danger" onClick={wipeAllData} style={{ marginTop: '20px' }}>
                APAGAR TODOS OS DADOS
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'relatorio' && (
        <section className="panel wide-panel">
          <div className="report-toolbar">
            <div className="report-filters">
              <select
                value={reportFilter.eventId}
                onChange={(event) => setReportFilter((previous) => ({ ...previous, eventId: event.target.value }))}
              >
                <option value="todos">Todos os eventos</option>
                {state.events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>

              <select
                value={reportFilter.operator}
                onChange={(event) => setReportFilter((previous) => ({ ...previous, operator: event.target.value }))}
              >
                <option value="Todos">Todos operadores</option>
                {[...new Set(state.sales.map((sale) => sale.operator))].map((operator) => (
                  <option key={operator} value={operator}>
                    {operator}
                  </option>
                ))}
              </select>

              <select
                value={reportFilter.paymentMethod}
                onChange={(event) => setReportFilter((previous) => ({ ...previous, paymentMethod: event.target.value }))}
              >
                <option value="Todos">Todas as formas</option>
                {PAYMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="export-actions">
              <button type="button" className="secondary" onClick={exportCsv}>
                Exportar CSV
              </button>
              <button type="button" className="primary" onClick={() => window.print()}>
                Imprimir relatório
              </button>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-card accent">
              <span>Total vendido</span>
              <strong>{formatCurrency(summaryCards.totalSold)}</strong>
            </div>
            <div className="summary-card">
              <span>Fichas</span>
              <strong>{summaryCards.totalTickets}</strong>
            </div>
            <div className="summary-card">
              <span>Ticket médio</span>
              <strong>{formatCurrency(summaryCards.ticketAverage)}</strong>
            </div>
            <div className="summary-card">
              <span>Vendas</span>
              <strong>{filteredSales.length}</strong>
            </div>
          </div>

          <div className="reports-layout">
            <div className="report-card">
              <h3>Vendas por produto</h3>
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {salesByProduct.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-card">
              <h3>Vendas por forma de pagamento</h3>
              <table>
                <thead>
                  <tr>
                    <th>Forma</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {salesByPayment.map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-card">
              <h3>Vendas por operador</h3>
              <table>
                <thead>
                  <tr>
                    <th>Operador</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {salesByOperator.map((item) => (
                    <tr key={item.operator}>
                      <td>{item.operator}</td>
                      <td>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-card chart-card">
            <h3>Vendas por hora</h3>
            <div className="chart-columns">
              {hourlySales.map((row) => (
                <div key={row.hour} className="chart-column">
                  <span style={{ height: `${Math.max((row.value / Math.max(...hourlySales.map((item) => item.value), 1)) * 100, 6)}%` }} />
                  <small>{row.hour}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {printTicket && (
        <div className="print-area" aria-label="Recibo de venda">
          <div className="receipt-box">
            <h3>{selectedEvent.name}</h3>
            <p>FICHA DE PRODUTO</p>
            <div className="receipt-line" />
            {printTicket.items.map((item) => (
              <div key={`${printTicket.id}-${item.productId}`} className="receipt-item">
                <span>
                  {item.name} x{item.qty}
                </span>
                <span>{formatCurrency(item.total)}</span>
              </div>
            ))}
            <div className="receipt-line" />
            <div className="receipt-total">
              <span>Total</span>
              <strong>{formatCurrency(printTicket.total)}</strong>
            </div>
            <p>Ficha: {printTicket.ticketNumber}</p>
            <p>Pagamento: {printTicket.paymentMethod}</p>
            <p>{formatDateTime(printTicket.createdAt)}</p>
            <div className="qr-box">QR</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
