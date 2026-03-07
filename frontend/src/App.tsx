import { useState, useEffect } from 'react'
import './App.css'

interface Item {
  id: number
  name: string
  description: string
}

interface HealthStatus {
  status: string
  message: string
}

function App() {
  const [items, setItems] = useState<Item[]>([])
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [healthRes, itemsRes] = await Promise.all([
          fetch('/api/health'),
          fetch('/api/items'),
        ])

        if (!healthRes.ok || !itemsRes.ok) {
          throw new Error('Failed to fetch from backend')
        }

        const healthData: HealthStatus = await healthRes.json()
        const itemsData: Item[] = await itemsRes.json()

        setHealth(healthData)
        setItems(itemsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>cadim</h1>
        <p className="subtitle">Rust + React Full-Stack Application</p>
      </header>

      <main className="main">
        <section className="status-section">
          <h2>Backend Status</h2>
          {loading && <p className="loading">Connecting to backend...</p>}
          {error && (
            <div className="error">
              <p>⚠️ Could not connect to backend</p>
              <p className="error-detail">{error}</p>
              <p className="error-hint">
                Make sure the backend is running: <code>cd backend && cargo run</code>
              </p>
            </div>
          )}
          {health && (
            <div className="health-card">
              <span className={`status-dot ${health.status === 'ok' ? 'online' : 'offline'}`} />
              <div>
                <p className="health-status">{health.status.toUpperCase()}</p>
                <p className="health-message">{health.message}</p>
              </div>
            </div>
          )}
        </section>

        <section className="items-section">
          <h2>Items from API</h2>
          {items.length > 0 ? (
            <div className="items-grid">
              {items.map((item) => (
                <div key={item.id} className="item-card">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <span className="item-id">#{item.id}</span>
                </div>
              ))}
            </div>
          ) : (
            !loading && !error && <p className="empty">No items found.</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
