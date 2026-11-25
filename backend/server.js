import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = Number(process.env.PORT || 5000)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const DB_FILE = path.join(__dirname, 'data', 'db.json')

const app = express()

app.use(cors({
  origin: CLIENT_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}))
app.use(express.json({ limit: '50kb' }))

const defaultState = {
  user: {
    id: 'demo-user-1',
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
  },
  account: { balance: 1250000 },
  transactions: [
    { id: 'tx-1', name: 'Netflix Subscription', category: 'Entertainment', date: 'Today, 10:42 AM', amount: 8500, type: 'expense', icon: 'N' },
    { id: 'tx-2', name: 'Salary Payment', category: 'Income', date: 'Today, 09:15 AM', amount: 250000, type: 'income', icon: 'S' },
    { id: 'tx-3', name: 'Shopping', category: 'Shopping', date: 'Yesterday, 04:30 PM', amount: 25000, type: 'expense', icon: 'S' },
    { id: 'tx-4', name: 'Freelance Project', category: 'Business', date: 'Yesterday, 11:20 AM', amount: 85000, type: 'income', icon: 'F' },
    { id: 'tx-5', name: 'Electricity Bill', category: 'Bills', date: '18 Nov, 02:10 PM', amount: 32000, type: 'expense', icon: 'E' },
    { id: 'tx-6', name: 'Client Payment', category: 'Business', date: '17 Nov, 01:05 PM', amount: 120000, type: 'income', icon: 'C' },
    { id: 'tx-7', name: 'Food & Dining', category: 'Food', date: '16 Nov, 08:35 PM', amount: 18500, type: 'expense', icon: 'F' },
    { id: 'tx-8', name: 'Transport', category: 'Transport', date: '15 Nov, 07:45 AM', amount: 12000, type: 'expense', icon: 'T' },
  ],
  cards: [
    { id: 'card-1', number: '2048', frozen: false, holder: 'GRACE BOY', expiry: '12/29', variant: 'primary' },
    { id: 'card-2', number: '7316', frozen: false, holder: 'GRACE BOY', expiry: '08/30', variant: 'virtual' },
  ],
}

async function writeDb(data) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  const temp = `${DB_FILE}.tmp`
  await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(temp, DB_FILE)
}

async function ensureDb() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    await writeDb(defaultState)
  }
}

async function readDb() {
  return JSON.parse(await fs.readFile(DB_FILE, 'utf8'))
}

function cleanText(value, max = 100) {
  return String(value ?? '').trim().slice(0, max)
}

function validAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000
}

function transactionDate() {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date())
}

function stats(db) {
  const income = db.transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expenses = db.transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  return { income, expenses, net: income - expenses }
}

function publicState(db) {
  return { user: db.user, account: db.account, transactions: db.transactions, cards: db.cards, stats: stats(db) }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'GRACE BOY Wallet API' })
})

app.get('/api/state', async (_req, res) => {
  try {
    res.json(publicState(await readDb()))
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Unable to load wallet data.' })
  }
})

app.put('/api/settings', async (req, res) => {
  try {
    const db = await readDb()
    const fullName = cleanText(req.body.fullName, 80)
    const email = cleanText(req.body.email, 120)
    const phone = cleanText(req.body.phone, 30)

    if (!fullName) return res.status(400).json({ message: 'Full name is required.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })

    db.user = {
      ...db.user,
      fullName,
      email,
      phone,
      currency: ['NGN — Nigerian Naira', 'USD — US Dollar', 'GBP — British Pound', 'EUR — Euro'].includes(req.body.currency) ? req.body.currency : db.user.currency,
      language: ['English', 'French', 'German'].includes(req.body.language) ? req.body.language : db.user.language,
      emailNotifications: Boolean(req.body.emailNotifications),
      transactionAlerts: Boolean(req.body.transactionAlerts),
      marketingEmails: Boolean(req.body.marketingEmails),
      twoFactor: Boolean(req.body.twoFactor),
      theme: req.body.theme === 'system' ? 'system' : 'light',
    }

    await writeDb(db)
    res.json({ message: 'Settings saved successfully.', state: publicState(db) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Unable to save settings.' })
  }
})

app.post('/api/wallet/add-money', async (req, res) => {
  try {
    const db = await readDb()
    const amount = Number(req.body.amount)
    const source = cleanText(req.body.source, 60) || 'Demo funding'

    if (!validAmount(amount)) return res.status(400).json({ message: 'Enter a valid amount.' })

    db.account.balance += amount
    db.transactions.unshift({ id: crypto.randomUUID(), name: source, category: 'Add Money', date: transactionDate(), amount, type: 'income', icon: '+' })

    await writeDb(db)
    res.status(201).json({ message: 'Money added successfully.', state: publicState(db) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Unable to add money.' })
  }
})

app.post('/api/wallet/transfer', async (req, res) => {
  try {
    const db = await readDb()
    const amount = Number(req.body.amount)
    const recipient = cleanText(req.body.recipient, 80)
    const note = cleanText(req.body.note, 120)

    if (!recipient) return res.status(400).json({ message: 'Recipient name is required.' })
    if (!validAmount(amount)) return res.status(400).json({ message: 'Enter a valid amount.' })
    if (amount > db.account.balance) return res.status(400).json({ message: 'Insufficient wallet balance.' })

    db.account.balance -= amount
    db.transactions.unshift({ id: crypto.randomUUID(), name: `Transfer to ${recipient}`, category: 'Transfer', date: transactionDate(), amount, type: 'expense', icon: '↗', note })

    await writeDb(db)
    res.status(201).json({ message: 'Transfer completed successfully.', state: publicState(db) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Unable to complete transfer.' })
  }
})

app.post('/api/wallet/payment', async (req, res) => {
  try {
    const db = await readDb()
    const amount = Number(req.body.amount)
    const merchant = cleanText(req.body.merchant, 80)
    const category = cleanText(req.body.category, 40) || 'Payment'

    if (!merchant) return res.status(400).json({ message: 'Merchant/payment name is required.' })
    if (!validAmount(amount)) return res.status(400).json({ message: 'Enter a valid amount.' })
    if (amount > db.account.balance) return res.status(400).json({ message: 'Insufficient wallet balance.' })

    db.account.balance -= amount
    db.transactions.unshift({ id: crypto.randomUUID(), name: merchant, category, date: transactionDate(), amount, type: 'expense', icon: '▣' })

    await writeDb(db)
    res.status(201).json({ message: 'Payment recorded successfully.', state: publicState(db) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Unable to record payment.' })
  }
})

app.post('/api/cards', async (req, res) => {
  try {
    const db = await readDb()
    const holder = cleanText(req.body.holder, 40).toUpperCase()
    const expiry = cleanText(req.body.expiry, 5)

    if (holder.length < 2) return res.status(400).json({ message: 'Enter a valid cardholder name.' })
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return res.status(400).json({ message: 'Expiry must use MM/YY format.' })

    const month = Number(expiry.slice(0, 2))
    if (month < 1 || month > 12) return res.status(400).json({ message: 'Expiry month must be between 01 and 12.' })

    db.cards.push({ id: crypto.randomUUID(), number: String(Math.floor(1000 + Math.random() * 9000)), frozen: false, holder, expiry, variant: 'virtual' })
    await writeDb(db)
    res.status(201).json({ message: 'Demo virtual card added.', state: publicState(db) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Unable to create card.' })
  }
})

app.patch('/api/cards/:id/freeze', async (req, res) => {
  try {
    const db = await readDb()
    const card = db.cards.find((item) => item.id === req.params.id)
    if (!card) return res.status(404).json({ message: 'Card not found.' })

    card.frozen = Boolean(req.body.frozen)
    await writeDb(db)
    res.json({ message: card.frozen ? 'Card frozen.' : 'Card unfrozen.', state: publicState(db) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Unable to update card.' })
  }
})

await ensureDb()

app.listen(PORT, () => {
  console.log(`GRACE BOY Wallet API running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
})
