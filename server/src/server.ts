import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import gameRoutes from './routes/gameRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? 'http://shilmanlior2608.ddns.net:17500'
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Routes
app.use('/api/game', gameRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Trading game server is running' })
})

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})
