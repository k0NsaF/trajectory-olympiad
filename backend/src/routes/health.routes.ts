
import { Router } from 'express'

const router = Router()

const startedAt = Date.now()

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Trajectory Olympiad API is running',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
  })
})

export default router
