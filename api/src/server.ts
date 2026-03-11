import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import alertsRouter from './routes/alerts'
import chatRouter from './routes/chat'
import dashboardSummaryRouter from './routes/dashboard-summary'
import conversationsRouter from './routes/conversations'

dotenv.config({ path: '../.env' })

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Galton AI API' })
})

app.use('/api', alertsRouter)
app.use('/api', chatRouter)
app.use('/api', dashboardSummaryRouter)
app.use('/api', conversationsRouter)

app.listen(PORT, () => {
  console.log(`Galton AI API running on http://localhost:${PORT}`)
})

export default app
