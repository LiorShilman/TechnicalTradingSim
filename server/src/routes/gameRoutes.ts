import express from 'express'
import { createGame, getGame, nextCandle, executeTrade } from '../controllers/gameController.js'

const router = express.Router()

// יצירת משחק חדש
router.post('/new', createGame)

// קבלת מצב משחק
router.get('/:gameId', getGame)

// נר הבא
router.post('/:gameId/next', nextCandle)

// ביצוע מסחר
router.post('/:gameId/trade', executeTrade)

export default router
