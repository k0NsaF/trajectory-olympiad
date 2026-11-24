import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { AppError } from './utils/AppError.js'

import healthRouter from './routes/health.routes.js'
import profilesRouter from './modules/profiles/profiles.routes.js'
import olympiadsRouter from './modules/olympiads/olympiads.routes.js'
import trajectoryRouter from './modules/trajectory/trajectory.routes.js'
import universitiesRouter from './modules/universities/universities.routes.js'
import benefitsRouter from './modules/benefits/benefits.routes.js'
import achievementsRouter from './modules/achievements/achievements.routes.js'
import remindersRouter from './modules/reminders/reminders.routes.js'
import aiRouter from './modules/ai/ai.routes.js'
import catalogRouter from './modules/catalog/catalog.routes.js'

export const app = express()

app.disable('x-powered-by')

app.use(helmet())

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(
        new AppError(
          'Запрос с этого источника запрещён.',
          403,
          'CORS_ORIGIN_DENIED'
        )
      )
    },
    credentials: true,
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept'
    ]
  })
)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.use('/api', healthRouter)
app.use('/api/profile', profilesRouter)
app.use('/api/olympiads', olympiadsRouter)
app.use('/api/trajectory', trajectoryRouter)
app.use('/api/universities', universitiesRouter)
app.use('/api/benefits', benefitsRouter)
app.use('/api/achievements', achievementsRouter)
app.use('/api/reminders', remindersRouter)
app.use('/api/ai', aiRouter)
app.use('/api/catalog', catalogRouter)

app.use(notFound)
app.use(errorHandler)
