import { useEffect, useMemo, useState, type FormEvent } from 'react'
// @ts-ignore Vite handles CSS side-effect imports; declaration may be absent in the editor TS config.
import './App.css'

type Page = 'Overview' | 'Transactions' | 'Cards' | 'Analytics' | 'Settings'
type TransactionType = 'income' | 'expense'
type TransactionFilter = 'all' | TransactionType

type Transaction = {
  id: string
  name: string
  category: string
  date: string
  amount: number
  type: TransactionType
  icon: string
}

type DemoCard = {
  id: string
  number: string
  frozen: boolean
  holder: string
  expiry: string
  variant: 'primary' | 'virtual' | 'business'
}

type Settings = {
  id?: string
  fullName: string
  email: string
  phone: string
  currency: string
  language: string
  emailNotifications: boolean
  transactionAlerts: boolean
  marketingEmails: boolean
  twoFactor: boolean
  theme: 'light' | 'system'
}

type WalletState = {
  user: Settings
  account: { balance: number }
  transactions: Transaction[]
  cards: DemoCard[]
  stats: { income: number; expenses: number; net: number }
}

const API_URL = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_URL || 'http://localhost:5000/api'

const initialSettings: Settings = {
  fullName: 'Grace Boy',
  email: 'graceboy@example.com',
  phone: '+234 800 000 0000',
  currency: 'NGN — Nigerian Naira',
  language: 'English',
  emailNotifications: true,
  transactionAlerts: true,
  marketingEmails: false,
  twoFactor: true,
  theme: 'light',
}

const fallbackTransactions: Transaction[] = [
  { id: 'tx-001', name: 'Salary', category: 'Income', date: 'Nov 24, 2026', amount: 300000, type: 'income', icon: '↗' },
  { id: 'tx-002', name: 'Freelance Project', category: 'Income', date: 'Nov 20, 2026', amount: 150000, type: 'income', icon: '↗' },
  { id: 'tx-003', name: 'Electricity Bill', category: 'Bills', date: 'Nov 18, 2026', amount: 50000, type: 'expense', icon: '↙' },
  { id: 'tx-004', name: 'Shopping', category: 'Shopping', date: 'Nov 16, 2026', amount: 35000, type: 'expense', icon: '↙' },
  { id: 'tx-005', name: 'Transport', category: 'Transport', date: 'Nov 14, 2026', amount: 20000, type: 'expense', icon: '↙' },
  { id: 'tx-006', name: 'Food', category: 'Food', date: 'Nov 12, 2026', amount: 20000, type: 'expense', icon: '↙' },
]

const fallbackCards: DemoCard[] = [
  { id: 'card-001', number: '2048', frozen: false, holder: 'GRACE BOY', expiry: '12/31', variant: 'primary' },
  { id: 'card-002', number: '7816', frozen: false, holder: 'GRACE BOY', expiry: '08/30', variant: 'virtual' },
]

const fallbackState: WalletState = {
  user: initialSettings,
  account: { balance: 1250000 },
  transactions: fallbackTransactions,
  cards: fallbackCards,
  stats: { income: 450000, expenses: 125000, net: 325000 },
}

const LOCAL_STORAGE_KEY = 'grace-boy-wallet-state-v2'

const isWalletState = (value: unknown): value is WalletState => {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<WalletState>
  return Boolean(state.user && state.account && typeof state.account.balance === 'number' && Array.isArray(state.transactions) && Array.isArray(state.cards))
}

const readLocalWallet = (): WalletState => {
  try {
    const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (isWalletState(parsed)) return parsed
    }
  } catch {
    // Use the default demo wallet if local storage is unavailable.
  }
  return fallbackState
}

const saveLocalWallet = (state: WalletState) => {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore local storage errors.
  }
}

const menu: Array<{ name: Page; icon: string }> = [
  { name: 'Overview', icon: '⌂' },
  { name: 'Transactions', icon: '↔' },
  { name: 'Cards', icon: '▣' },
  { name: 'Analytics', icon: '▥' },
  { name: 'Settings', icon: '⚙' },
]

const formatMoney = (amount: number, currency = 'NGN — Nigerian Naira') => {
  const code = currency.split(' ')[0]
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' }
  const symbol = symbols[code] || '₦'
  return `${symbol}${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  let data: unknown = {}

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`Server returned invalid JSON (${response.status}).`)
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message?: unknown }).message || 'Request failed.')
      : `Request failed (${response.status}).`
    throw new Error(message)
  }

  return data as T
}

function App() {
  const [activePage, setActivePage] = useState<Page>('Overview')
  const [showBalance, setShowBalance] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<TransactionFilter>('all')
  const [cards, setCards] = useState<DemoCard[]>(() => readLocalWallet().cards)
  const [transactions, setTransactions] = useState<Transaction[]>(() => readLocalWallet().transactions)
  const [settings, setSettings] = useState<Settings>(() => readLocalWallet().user)
  const [balance, setBalance] = useState(() => readLocalWallet().account.balance)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showAddMoney, setShowAddMoney] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [cardHolder, setCardHolder] = useState('GRACE BOY')
  const [cardExpiry, setCardExpiry] = useState('12/31')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    window.setTimeout(() => setNotice(null), 3200)
  }

  const getCurrentWalletState = (): WalletState => {
    const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    return { user: settings, account: { balance }, transactions, cards, stats: { income, expenses, net: income - expenses } }
  }

  const applyState = (state: WalletState) => {
    if (!isWalletState(state)) return
    setSettings(state.user)
    setBalance(state.account.balance)
    setTransactions(state.transactions)
    setCards(state.cards)
    saveLocalWallet(state)
  }

  const updateLocalWallet = (updater: (state: WalletState) => WalletState) => {
    applyState(updater(getCurrentWalletState()))
  }

  const loadWallet = async () => {
    try {
      const response = await apiRequest<WalletState>('/state')
      applyState(response)
    } catch {
      const localState = readLocalWallet()
      setSettings(localState.user)
      setBalance(localState.account.balance)
      setTransactions(localState.transactions)
      setCards(localState.cards)
    }
  }

  useEffect(() => {
    void loadWallet()
  }, [])

  const navigate = (page: Page) => {
    setActivePage(page)
    setMobileNavOpen(false)
  }

  const filteredTransactions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return transactions.filter((transaction) => {
      const matchesSearch =
        !query ||
        transaction.name.toLowerCase().includes(query) ||
        transaction.category.toLowerCase().includes(query) ||
        transaction.date.toLowerCase().includes(query)
      const matchesType = filterType === 'all' || transaction.type === filterType
      return matchesSearch && matchesType
    })
  }, [transactions, searchTerm, filterType])

  const incomeTotal = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  const expenseTotal = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  const netTotal = incomeTotal - expenseTotal
  const activeCards = cards.filter((card) => !card.frozen).length
  const frozenCards = cards.filter((card) => card.frozen).length

  const addMoney = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const amount = Number(form.get('amount'))
    const source = String(form.get('source') || 'Demo funding')
    if (!Number.isFinite(amount) || amount <= 0) { showNotice('error', 'Enter an amount greater than zero.'); return }
    try {
      const response = await apiRequest<{ message: string; state: WalletState }>('/wallet/add-money', { method: 'POST', body: JSON.stringify({ amount, source }) })
      applyState(response.state); formElement.reset(); setShowAddMoney(false); showNotice('success', response.message || 'Money added successfully.')
    } catch {
      updateLocalWallet((state) => ({ ...state, account: { balance: state.account.balance + amount }, transactions: [{ id: `local-income-${Date.now()}`, name: source, category: 'Income', date: new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }), amount, type: 'income', icon: '↗' }, ...state.transactions] }))
      formElement.reset(); setShowAddMoney(false); showNotice('success', `${formatMoney(amount, settings.currency)} added to your wallet.`)
    }
  }

  const transferMoney = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const amount = Number(form.get('amount'))
    const recipient = String(form.get('recipient') || '').trim()
    const note = String(form.get('note') || '').trim()
    if (!Number.isFinite(amount) || amount <= 0) { showNotice('error', 'Enter an amount greater than zero.'); return }
    if (!recipient) { showNotice('error', 'Enter the recipient name.'); return }
    if (amount > balance) { showNotice('error', `Insufficient balance. Available: ${formatMoney(balance, settings.currency)}.`); return }
    try {
      const response = await apiRequest<{ message: string; state: WalletState }>('/wallet/transfer', { method: 'POST', body: JSON.stringify({ amount, recipient, note }) })
      applyState(response.state); formElement.reset(); setShowTransfer(false); showNotice('success', response.message || 'Transfer completed successfully.')
    } catch {
      updateLocalWallet((state) => ({ ...state, account: { balance: state.account.balance - amount }, transactions: [{ id: `local-transfer-${Date.now()}`, name: `Transfer to ${recipient}`, category: 'Transfer', date: new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }), amount, type: 'expense', icon: '↙' }, ...state.transactions] }))
      formElement.reset(); setShowTransfer(false); showNotice('success', `${formatMoney(amount, settings.currency)} transferred to ${recipient}.`)
    }
  }

  const makePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const amount = Number(form.get('amount'))
    const merchant = String(form.get('merchant') || '').trim()
    const category = String(form.get('category') || 'Payment')
    if (!Number.isFinite(amount) || amount <= 0) { showNotice('error', 'Enter an amount greater than zero.'); return }
    if (!merchant) { showNotice('error', 'Enter the merchant name.'); return }
    if (amount > balance) { showNotice('error', `Insufficient balance. Available: ${formatMoney(balance, settings.currency)}.`); return }
    try {
      const response = await apiRequest<{ message: string; state: WalletState }>('/wallet/payment', { method: 'POST', body: JSON.stringify({ amount, merchant, category }) })
      applyState(response.state); formElement.reset(); setShowPayment(false); showNotice('success', response.message || 'Payment recorded successfully.')
    } catch {
      updateLocalWallet((state) => ({ ...state, account: { balance: state.account.balance - amount }, transactions: [{ id: `local-payment-${Date.now()}`, name: merchant, category, date: new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }), amount, type: 'expense', icon: '↙' }, ...state.transactions] }))
      formElement.reset(); setShowPayment(false); showNotice('success', `${formatMoney(amount, settings.currency)} payment recorded.`)
    }
  }

  const addCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const holder = cardHolder.trim().toUpperCase()
    const expiry = cardExpiry.trim()
    if (holder.length < 2) { showNotice('error', 'Please enter a valid cardholder name.'); return }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) { showNotice('error', 'Expiry must use MM/YY format.'); return }
    const month = Number(expiry.slice(0, 2))
    if (month < 1 || month > 12) { showNotice('error', 'Expiry month must be between 01 and 12.'); return }
    try {
      const response = await apiRequest<{ message: string; state: WalletState }>('/cards', { method: 'POST', body: JSON.stringify({ holder, expiry }) })
      applyState(response.state); setShowAddCard(false); setCardHolder(settings.fullName.toUpperCase()); setCardExpiry('12/31'); showNotice('success', response.message || 'Demo virtual card added successfully.')
    } catch {
      const newCard: DemoCard = { id: `local-card-${Date.now()}`, number: String(Math.floor(1000 + Math.random() * 9000)), frozen: false, holder, expiry, variant: cards.length === 0 ? 'primary' : 'virtual' }
      updateLocalWallet((state) => ({ ...state, cards: [...state.cards, newCard] }))
      setShowAddCard(false); setCardHolder(settings.fullName.toUpperCase()); setCardExpiry('12/31'); showNotice('success', 'Demo virtual card added successfully.')
    }
  }

  const toggleFreeze = async (id: string) => {
    const card = cards.find((item) => item.id === id)
    if (!card) return
    try {
      const response = await apiRequest<{ message: string; state: WalletState }>(`/cards/${id}/freeze`, { method: 'PATCH', body: JSON.stringify({ frozen: !card.frozen }) })
      applyState(response.state); showNotice('success', response.message || (card.frozen ? 'Card unfrozen.' : 'Card frozen.'))
    } catch {
      updateLocalWallet((state) => ({ ...state, cards: state.cards.map((item) => item.id === id ? { ...item, frozen: !item.frozen } : item) }))
      showNotice('success', card.frozen ? 'Card unfrozen.' : 'Card frozen.')
    }
  }

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!settings.fullName.trim()) { showNotice('error', 'Full name cannot be empty.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) { showNotice('error', 'Please enter a valid email address.'); return }
    try {
      const response = await apiRequest<{ message: string; state: WalletState }>('/settings', { method: 'PUT', body: JSON.stringify(settings) })
      applyState(response.state); showNotice('success', 'Settings saved. Dashboard updated.')
    } catch {
      saveLocalWallet(getCurrentWalletState()); showNotice('success', 'Settings saved on this device.')
    }
  }

  const resetSettings = () => {
    const saved = readLocalWallet()
    setSettings(saved.user); setBalance(saved.account.balance); setTransactions(saved.transactions); setCards(saved.cards)
    void loadWallet()
    showNotice('success', 'Saved wallet settings were restored.')
  }

  const handlePasswordChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get('currentPassword') || '')
    const newPassword = String(form.get('newPassword') || '')
    const confirmPassword = String(form.get('confirmPassword') || '')

    if (!currentPassword || newPassword.length < 8) {
      showNotice('error', 'Enter your current password and a new password of at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      showNotice('error', 'New password and confirmation do not match.')
      return
    }

    event.currentTarget.reset()
    showNotice('success', 'Password validation completed. Passwords are not stored by this demo frontend.')
  }

  const firstName = settings.fullName.trim().split(/\s+/)[0] || 'Grace'
  const initials = settings.fullName.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'GB'

  return (
    <div className="app">
      <button
        className={`mobile-menu-backdrop ${mobileNavOpen ? 'visible' : ''}`}
        aria-label="Close navigation"
        onClick={() => setMobileNavOpen(false)}
      />

      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">G</div>
          <div>
            <span className="brand-name">GRACE BOY</span>
            <small>FINTECH WALLET</small>
          </div>
          <button className="sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">×</button>
        </div>

        <p className="menu-label">MAIN MENU</p>
        <nav>
          {menu.map((item) => (
            <button key={item.name} className={`nav-item ${activePage === item.name ? 'active' : ''}`} onClick={() => navigate(item.name)}>
              <span>{item.icon}</span>{item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-icon">?</div>
            <strong>Need help?</strong>
            <p>Get assistance with your demonstration wallet.</p>
            <button onClick={() => showNotice('success', 'Support request opened in demo mode.')}>Get support</button>
          </div>

          <div className="profile">
            <div className="avatar">{initials}</div>
            <div>
              <strong>{settings.fullName}</strong>
              <small>Personal Account</small>
            </div>
            <button className="profile-menu" aria-label="Open account settings" onClick={() => navigate('Settings')}>⋮</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand-row">
            <button className="mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">☰</button>
            <div>
              <p className="welcome">Welcome back,</p>
              <h2>{settings.fullName} <span aria-hidden="true">👋</span></h2>
            </div>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notifications" onClick={() => showNotice('success', 'You have no new notifications.')}>♧<span className="notification-dot" /></button>
            <button className="top-avatar" onClick={() => navigate('Settings')} aria-label="Open profile settings">{initials}</button>
          </div>
        </header>

        {notice && (
          <div className={`toast ${notice.type}`} role="status">
            <span>{notice.type === 'success' ? '✓' : '!'}</span>
            <p>{notice.message}</p>
            <button onClick={() => setNotice(null)} aria-label="Dismiss notification">×</button>
          </div>
        )}

        <section className="page-heading">
          <div>
            <p className="eyebrow">PERSONAL WALLET</p>
            <h1>{activePage}</h1>
            <p>Manage your money with confidence.</p>
          </div>
          <button className="date-button" onClick={() => showNotice('success', 'Showing activity for the current month.')}>◷ This month <span>⌄</span></button>
        </section>

        {activePage === 'Overview' && (
          <>
            <section className="balance-grid">
              <div className="balance-card">
                <div className="balance-top">
                  <span>Total balance</span>
                  <button onClick={() => setShowBalance((visible) => !visible)}>{showBalance ? 'Hide balance' : 'Show balance'} ◉</button>
                </div>
                <h2>{showBalance ? formatMoney(balance, settings.currency) : '••••••••••'}</h2>
                <p className="balance-note">Your available account balance</p>
                <div className="balance-footer"><span>GRACE BOY WALLET</span><span>•••• {cards[0]?.number || '2048'}</span></div>
              </div>

              <div className="stat-card">
                <div className="stat-heading"><span>↗</span><small>Income</small></div>
                <h2>{formatMoney(incomeTotal, settings.currency)}</h2>
                <p className="positive">↑ 12.5% <span>vs last month</span></p>
              </div>

              <div className="stat-card">
                <div className="stat-heading expense-icon"><span>↙</span><small>Expenses</small></div>
                <h2>{formatMoney(expenseTotal, settings.currency)}</h2>
                <p className="negative">↓ 4.2% <span>vs last month</span></p>
              </div>
            </section>

            <section className="content-grid">
              <div className="panel">
                <div className="panel-heading">
                  <div><h3>Recent transactions</h3><p>Your latest financial activities</p></div>
                  <button className="text-button" onClick={() => navigate('Transactions')}>View all →</button>
                </div>
                <TransactionControls searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterType={filterType} setFilterType={setFilterType} />
                <div className="transaction-list">
                  {filteredTransactions.slice(0, 5).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} currency={settings.currency} />)}
                  {filteredTransactions.length === 0 && <p className="empty-message">No matching transactions found.</p>}
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading"><div><h3>Quick actions</h3><p>Manage your money faster</p></div></div>
                <div className="quick-actions">
                  <button onClick={() => setShowTransfer(true)}><span>↗</span>Transfer money</button>
                  <button onClick={() => setShowAddMoney(true)}><span>＋</span>Add money</button>
                  <button onClick={() => setShowPayment(true)}><span>▣</span>Make payment</button>
                  <button onClick={() => navigate('Cards')}><span>▤</span>My cards</button>
                </div>
                <div className="security-note"><span>✓</span><div><strong>Your security matters</strong><p>This demonstration wallet uses sample financial data only.</p></div></div>
              </div>
            </section>
          </>
        )}

        {activePage === 'Transactions' && (
          <section className="panel full-transactions">
            <div className="panel-heading"><div><h3>All transactions</h3><p>Search and filter your financial activity.</p></div><span className="transaction-count">{filteredTransactions.length} transactions</span></div>
            <TransactionControls searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterType={filterType} setFilterType={setFilterType} />
            <div className="transaction-table">
              <div className="transaction-table-header"><span>TRANSACTION</span><span>DATE</span><span>CATEGORY</span><span>AMOUNT</span></div>
              {filteredTransactions.length > 0 ? filteredTransactions.map((transaction) => (
                <div className="transaction-table-row" key={transaction.id}>
                  <div className="table-transaction-name"><div className={`transaction-icon ${transaction.type}`}>{transaction.icon}</div><strong>{transaction.name}</strong></div>
                  <span>{transaction.date}</span><span className="table-category">{transaction.category}</span>
                  <strong className={transaction.type}>{transaction.type === 'income' ? '+' : '-'}{formatMoney(transaction.amount, settings.currency)}</strong>
                </div>
              )) : <p className="empty-message">No matching transactions found.</p>}
            </div>
          </section>
        )}

        {activePage === 'Cards' && (
          <section className="cards-page">
            <div className="cards-heading">
              <div><p className="eyebrow">WALLET MANAGEMENT</p><h3>My Cards</h3><p>Manage your demonstration virtual payment cards.</p></div>
              <button className="add-card-button" onClick={() => setShowAddCard(true)}>+ Add new card</button>
            </div>
            <div className="card-stats">
              <div className="mini-stat"><span>Total cards</span><strong>{cards.length}</strong></div>
              <div className="mini-stat"><span>Active</span><strong>{activeCards}</strong></div>
              <div className="mini-stat"><span>Frozen</span><strong>{frozenCards}</strong></div>
            </div>
            <div className="cards-grid">
              {cards.map((card, index) => (
                <article className={`card-shell ${card.frozen ? 'is-frozen' : ''}`} key={card.id}>
                  <div className={`virtual-card ${card.variant}`}>
                    <div className="card-glow" />
                    <div className="virtual-card-top"><div className="card-brand"><strong>GRACE BOY</strong><small>{card.variant === 'business' ? 'BUSINESS WALLET' : 'PREMIUM WALLET'}</small></div><span className="card-network">VISA</span></div>
                    <div className="card-chip">▦</div>
                    <p className="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; {card.number}</p>
                    <div className="virtual-card-bottom"><div><small>CARD HOLDER</small><strong>{card.holder}</strong></div><div><small>EXPIRES</small><strong>{card.expiry}</strong></div></div>
                    {card.frozen && <div className="frozen-overlay">CARD FROZEN</div>}
                  </div>
                  <div className="card-actions"><div><span className={`status-dot ${card.frozen ? 'frozen-dot' : ''}`} /><span>{card.frozen ? 'Frozen' : 'Active'} · {index === 0 ? 'Primary' : 'Virtual'}</span></div><button onClick={() => void toggleFreeze(card.id)}>{card.frozen ? 'Unfreeze' : 'Freeze'}</button></div>
                </article>
              ))}
            </div>
            <div className="cards-bottom-grid">
              <div className="panel card-information"><div className="panel-heading"><div><h3>Card management</h3><p>Current demo card status.</p></div></div><div className="card-info-row"><span>Total demo cards</span><strong>{cards.length}</strong></div><div className="card-info-row"><span>Active cards</span><strong className="positive">{activeCards}</strong></div><div className="card-info-row"><span>Frozen cards</span><strong className="negative">{frozenCards}</strong></div></div>
              <div className="panel card-security"><span className="security-check">✓</span><div><strong>Demo card security</strong><p>These cards are visual demonstrations only. They cannot process real payments or connect to a bank.</p></div></div>
            </div>
          </section>
        )}

        {activePage === 'Analytics' && <Analytics transactions={transactions} incomeTotal={incomeTotal} expenseTotal={expenseTotal} netTotal={netTotal} currency={settings.currency} />}

        {activePage === 'Settings' && (
          <section className="settings-page">
            <form className="panel settings-form" onSubmit={saveSettings}>
              <div className="settings-section">
                <div className="settings-title"><div><p className="eyebrow">PROFILE</p><h3>Profile information</h3><p>Update the information displayed on your account.</p></div></div>
                <div className="form-grid">
                  <label>Full name<input value={settings.fullName} onChange={(event) => setSettings((prev) => ({ ...prev, fullName: event.target.value }))} required /></label>
                  <label>Email address<input type="email" value={settings.email} onChange={(event) => setSettings((prev) => ({ ...prev, email: event.target.value }))} required /></label>
                  <label>Phone number<input value={settings.phone} onChange={(event) => setSettings((prev) => ({ ...prev, phone: event.target.value }))} /></label>
                  <label>Currency<select value={settings.currency} onChange={(event) => setSettings((prev) => ({ ...prev, currency: event.target.value }))}><option>NGN — Nigerian Naira</option><option>USD — US Dollar</option><option>GBP — British Pound</option><option>EUR — Euro</option></select></label>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-title"><div><p className="eyebrow">PREFERENCES</p><h3>Account preferences</h3><p>Control how the dashboard behaves.</p></div></div>
                <div className="preference-row"><div><strong>Language</strong><span>Choose your dashboard language.</span></div><select value={settings.language} onChange={(event) => setSettings((prev) => ({ ...prev, language: event.target.value }))}><option>English</option><option>French</option><option>German</option></select></div>
                <div className="preference-row"><div><strong>Theme</strong><span>Choose the preferred dashboard appearance.</span></div><select value={settings.theme} onChange={(event) => setSettings((prev) => ({ ...prev, theme: event.target.value as Settings['theme'] }))}><option value="light">Light</option><option value="system">System</option></select></div>
              </div>

              <div className="settings-section">
                <div className="settings-title"><div><p className="eyebrow">NOTIFICATIONS</p><h3>Notification preferences</h3><p>Choose which updates you want to receive.</p></div></div>
                <ToggleRow title="Email notifications" description="Receive account updates by email." checked={settings.emailNotifications} onChange={(checked) => setSettings((prev) => ({ ...prev, emailNotifications: checked }))} />
                <ToggleRow title="Transaction alerts" description="Show alerts for new account activity." checked={settings.transactionAlerts} onChange={(checked) => setSettings((prev) => ({ ...prev, transactionAlerts: checked }))} />
                <ToggleRow title="Product and marketing emails" description="Receive optional product updates." checked={settings.marketingEmails} onChange={(checked) => setSettings((prev) => ({ ...prev, marketingEmails: checked }))} />
              </div>

              <div className="settings-actions"><button type="button" className="secondary-button" onClick={resetSettings}>Cancel</button><button type="submit" className="primary-button">Save changes</button></div>
            </form>

            <div className="settings-side">
              <section className="panel security-panel">
                <div className="settings-title"><div><p className="eyebrow">SECURITY</p><h3>Security settings</h3><p>Keep your account protected.</p></div></div>
                <ToggleRow title="Two-factor authentication" description="Add another verification step to your account." checked={settings.twoFactor} onChange={(checked) => setSettings((prev) => ({ ...prev, twoFactor: checked }))} />
                <div className="security-status"><span>✓</span><div><strong>{settings.twoFactor ? '2FA is enabled' : '2FA is disabled'}</strong><p>Demo security status only. No real authentication service is connected.</p></div></div>
              </section>

              <form className="panel password-panel" onSubmit={handlePasswordChange}>
                <div className="settings-title"><div><p className="eyebrow">PASSWORD</p><h3>Change password</h3><p>Password values are not retained in React state.</p></div></div>
                <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
                <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
                <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
                <button className="primary-button full-width" type="submit">Update password</button>
              </form>
            </div>
          </section>
        )}

        <footer>© 2026 GRACE BOY. Fintech Dashboard Demo.</footer>
      </main>

      {showAddCard && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-card-title">
            <div className="modal-heading"><div><p className="eyebrow">DEMO CARD</p><h3 id="add-card-title">Add a virtual card</h3><p>Create a safe demonstration card with generated last-four digits.</p></div><button onClick={() => setShowAddCard(false)} aria-label="Close">×</button></div>
            <form onSubmit={addCard}>
              <label>Cardholder name<input value={cardHolder} onChange={(event) => setCardHolder(event.target.value)} maxLength={40} required /></label>
              <label>Expiry<input value={cardExpiry} onChange={(event) => setCardExpiry(event.target.value.replace(/[^\d/]/g, '').slice(0, 5))} placeholder="MM/YY" inputMode="numeric" required /></label>
              <div className="demo-warning"><span>i</span><p>No full card number, CVV, PIN, or real payment credentials are collected.</p></div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowAddCard(false)}>Cancel</button><button type="submit" className="primary-button">Create demo card</button></div>
            </form>
          </div>
        </div>
      )}

      {showAddMoney && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-money-title">
            <div className="modal-heading"><div><p className="eyebrow">WALLET</p><h3 id="add-money-title">Add money</h3><p>Add simulated funds to your GRACE BOY wallet.</p></div><button onClick={() => setShowAddMoney(false)} aria-label="Close">×</button></div>
            <form onSubmit={addMoney}>
              <label>Amount<input name="amount" type="number" min="1" step="0.01" placeholder="50000" required /></label>
              <label>Source<input name="source" placeholder="Demo funding" /></label>
              <div className="demo-warning"><span>i</span><p>This is a simulated wallet. It does not move real bank money.</p></div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowAddMoney(false)}>Cancel</button><button type="submit" className="primary-button">Add money</button></div>
            </form>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
            <div className="modal-heading"><div><p className="eyebrow">TRANSFER</p><h3 id="transfer-title">Transfer money</h3><p>Transfer funds from your simulated wallet.</p></div><button onClick={() => setShowTransfer(false)} aria-label="Close">×</button></div>
            <form onSubmit={transferMoney}>
              <label>Amount<input name="amount" type="number" min="1" step="0.01" placeholder="10000" required /></label>
              <label>Recipient<input name="recipient" placeholder="John Doe" required /></label>
              <label>Note<input name="note" placeholder="Payment for service" /></label>
              <div className="demo-warning"><span>i</span><p>Demo transfer only. No real bank transfer will occur.</p></div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowTransfer(false)}>Cancel</button><button type="submit" className="primary-button">Transfer money</button></div>
            </form>
          </div>
        </div>
      )}

      {showPayment && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
            <div className="modal-heading"><div><p className="eyebrow">PAYMENT</p><h3 id="payment-title">Make a payment</h3><p>Record a simulated wallet payment.</p></div><button onClick={() => setShowPayment(false)} aria-label="Close">×</button></div>
            <form onSubmit={makePayment}>
              <label>Amount<input name="amount" type="number" min="1" step="0.01" placeholder="5000" required /></label>
              <label>Merchant<input name="merchant" placeholder="Electricity Bill" required /></label>
              <label>Category<select name="category"><option>Bills</option><option>Shopping</option><option>Food</option><option>Transport</option><option>Entertainment</option><option>Other</option></select></label>
              <div className="demo-warning"><span>i</span><p>This records a simulated payment only.</p></div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowPayment(false)}>Cancel</button><button type="submit" className="primary-button">Make payment</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TransactionControls({ searchTerm, setSearchTerm, filterType, setFilterType }: { searchTerm: string; setSearchTerm: (value: string) => void; filterType: TransactionFilter; setFilterType: (value: TransactionFilter) => void }) {
  return (
    <div className="transaction-controls">
      <div className="search-field"><span>⌕</span><input type="search" placeholder="Search transactions..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} aria-label="Search transactions" /></div>
      <select value={filterType} onChange={(event) => setFilterType(event.target.value as TransactionFilter)} aria-label="Filter transactions"><option value="all">All transactions</option><option value="income">Income</option><option value="expense">Expenses</option></select>
    </div>
  )
}

function TransactionRow({ transaction, currency }: { transaction: Transaction; currency: string }) {
  return (
    <div className="transaction">
      <div className={`transaction-icon ${transaction.type}`}>{transaction.icon}</div>
      <div className="transaction-details"><strong>{transaction.name}</strong><small>{transaction.date}</small></div>
      <div className="transaction-amount"><strong className={transaction.type}>{transaction.type === 'income' ? '+' : '-'}{formatMoney(transaction.amount, currency)}</strong><small>{transaction.category}</small></div>
    </div>
  )
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="toggle-row"><div><strong>{title}</strong><span>{description}</span></div><button type="button" className={`switch ${checked ? 'on' : ''}`} aria-pressed={checked} onClick={() => onChange(!checked)}><span /></button></div>
  )
}

function Analytics({ transactions, incomeTotal, expenseTotal, netTotal, currency }: { transactions: Transaction[]; incomeTotal: number; expenseTotal: number; netTotal: number; currency: string }) {
  const maxMonthly = 350000
  const monthlyData = [
    { month: 'Jun', income: 210000, expense: 118000 },
    { month: 'Jul', income: 260000, expense: 142000 },
    { month: 'Aug', income: 185000, expense: 97000 },
    { month: 'Sep', income: 315000, expense: 154000 },
    { month: 'Oct', income: 280000, expense: 132000 },
    { month: 'Nov', income: incomeTotal, expense: expenseTotal },
  ]

  const expenseByCategory = transactions.filter((item) => item.type === 'expense').reduce<Record<string, number>>((result, item) => {
    result[item.category] = (result[item.category] || 0) + item.amount
    return result
  }, {})

  const categories = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, amount]) => ({ name, amount, percent: expenseTotal ? Math.round((amount / expenseTotal) * 100) : 0 }))

  const incomeTransactions = transactions.filter((item) => item.type === 'income')
  const expenseTransactions = transactions.filter((item) => item.type === 'expense')
  const largestIncome = incomeTransactions.length ? Math.max(...incomeTransactions.map((item) => item.amount)) : 0
  const largestExpense = expenseTransactions.length ? Math.max(...expenseTransactions.map((item) => item.amount)) : 0

  return (
    <section className="analytics-page">
      <div className="analytics-summary">
        <div className="analytics-card"><span>Total income</span><strong>{formatMoney(incomeTotal, currency)}</strong><small>Across saved wallet transactions</small></div>
        <div className="analytics-card expense"><span>Total expenses</span><strong>{formatMoney(expenseTotal, currency)}</strong><small>Across saved wallet transactions</small></div>
        <div className="analytics-card accent"><span>Net activity</span><strong>{formatMoney(netTotal, currency)}</strong><small>Income minus expenses</small></div>
      </div>

      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-heading"><div><h3>Income vs expenses</h3><p>Six-month financial activity summary.</p></div></div>
          <div className="bar-chart">
            <div className="chart-y-axis"><span>₦350k</span><span>₦250k</span><span>₦150k</span><span>₦0</span></div>
            <div className="bars">
              {monthlyData.map((item) => (
                <div className="bar-group" key={item.month}>
                  <div className="bar-pair"><div className="bar income-bar" style={{ height: `${Math.min((item.income / maxMonthly) * 100, 100)}%` }} title={`Income ${formatMoney(item.income, currency)}`} /><div className="bar expense-bar" style={{ height: `${Math.min((item.expense / maxMonthly) * 100, 100)}%` }} title={`Expenses ${formatMoney(item.expense, currency)}`} /></div>
                  <span>{item.month}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-legend"><span><i className="legend-income" /> Income</span><span><i className="legend-expense" /> Expenses</span></div>
        </section>

        <section className="panel spending-panel">
          <div className="panel-heading"><div><h3>Spending categories</h3><p>Calculated from saved transactions.</p></div></div>
          <div className="category-list">
            {categories.length ? categories.map((category) => (
              <div className="category-item" key={category.name}><div className="category-top"><span>{category.name}</span><strong>{formatMoney(category.amount, currency)}</strong></div><div className="progress-track"><span style={{ width: `${category.percent}%` }} /></div><small>{category.percent}% of saved expenses</small></div>
            )) : <p className="empty-message">No expense data yet.</p>}
          </div>
        </section>
      </div>

      <section className="panel financial-summary">
        <div className="panel-heading"><div><h3>Financial activity</h3><p>Key metrics from the current saved wallet.</p></div></div>
        <div className="summary-grid">
          <div><span>Income transactions</span><strong>{incomeTransactions.length}</strong></div>
          <div><span>Expense transactions</span><strong>{expenseTransactions.length}</strong></div>
          <div><span>Largest income</span><strong>{formatMoney(largestIncome, currency)}</strong></div>
          <div><span>Largest expense</span><strong>{formatMoney(largestExpense, currency)}</strong></div>
        </div>
      </section>
    </section>
  )
}

export default App
