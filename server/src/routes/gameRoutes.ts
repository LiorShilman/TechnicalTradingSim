import express from 'express'
import multer from 'multer'
import { createGame, createGameFromCSV, getGame, nextCandle, executeTrade } from '../controllers/gameController.js'

const router = express.Router()

// Multer configuration for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Only CSV files are allowed'))
    }
  },
})

// יצירת משחק חדש
router.post('/new', createGame)

// יצירת משחק מקובץ CSV
router.post('/upload-csv', upload.single('csvFile'), createGameFromCSV)

// קבלת מצב משחק
router.get('/:gameId', getGame)

// נר הבא
router.post('/:gameId/next', nextCandle)

// ביצוע מסחר
router.post('/:gameId/trade', executeTrade)

export default router
