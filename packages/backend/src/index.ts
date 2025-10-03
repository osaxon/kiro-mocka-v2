import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes placeholder
app.get('/api', (_req, res) => {
  res.json({ message: 'API Mocking Service Backend' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
