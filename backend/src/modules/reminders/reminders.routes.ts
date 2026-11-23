import { Router } from 'express'

import { authenticate } from '../../middleware/authenticate.js'
import { validateBody } from '../../middleware/validate.js'
import { getAuthContext } from '../../utils/authContext.js'

import {
  createReminderSchema,
  reminderIdSchema,
  updateReminderSchema,
  updateReminderStatusSchema
} from './reminders.schema.js'

import {
  createReminder,
  deleteReminder,
  getReminders,
  updateReminder,
  updateReminderStatus
} from './reminders.service.js'

const router = Router()

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const { userId, supabase } = getAuthContext(req)

    const reminders = await getReminders(
      supabase,
      userId
    )

    res.status(200).json(reminders)
  } catch (error) {
    next(error)
  }
})

router.post(
  '/',
  validateBody(createReminderSchema),
  async (req, res, next) => {
    try {
      const { userId, supabase } = getAuthContext(req)

      const reminder = await createReminder(
        supabase,
        userId,
        req.body
      )

      res.status(201).json(reminder)
    } catch (error) {
      next(error)
    }
  }
)

router.patch(
  '/:id/status',
  validateBody(updateReminderStatusSchema),
  async (req, res, next) => {
    try {
      const { id } = reminderIdSchema.parse(req.params)
      const { userId, supabase } = getAuthContext(req)

      const reminder = await updateReminderStatus(
        supabase,
        userId,
        id,
        req.body
      )

      res.status(200).json(reminder)
    } catch (error) {
      next(error)
    }
  }
)

router.patch(
  '/:id',
  validateBody(updateReminderSchema),
  async (req, res, next) => {
    try {
      const { id } = reminderIdSchema.parse(req.params)
      const { userId, supabase } = getAuthContext(req)

      const reminder = await updateReminder(
        supabase,
        userId,
        id,
        req.body
      )

      res.status(200).json(reminder)
    } catch (error) {
      next(error)
    }
  }
)

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = reminderIdSchema.parse(req.params)
    const { userId, supabase } = getAuthContext(req)

    await deleteReminder(supabase, userId, id)

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
