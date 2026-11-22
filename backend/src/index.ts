
import 'dotenv/config'

import { app } from './app.js'
import { env } from './config/env.js'

const server = app.listen(env.port, () => {
  console.log(
    `Trajectory Olympiad API running at http://localhost:${env.port}`
  )

  console.log(`Environment: ${env.nodeEnv}`)
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Порт ${env.port} уже занят.`)
  } else {
    console.error('Не удалось запустить сервер:', error)
  }

  process.exitCode = 1
})
