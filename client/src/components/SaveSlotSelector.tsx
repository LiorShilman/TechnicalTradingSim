import { useState } from 'react'
import { SaveSlot } from '@/types/game.types'
import { Trash2, Edit2, Play, Save, X } from 'lucide-react'
import ConfirmDialog from '@/components/Common/ConfirmDialog'

interface SaveSlotSelectorProps {
  fileName: string
  dateRange?: { start: string; end: string } | null
  slots: SaveSlot[]
  onLoadSlot: (slotId: string) => void
  onSaveNewSlot: () => void
  onDeleteSlot: (slotId: string) => void
  onRenameSlot: (slotId: string, newName: string) => void
  onClose?: () => void
}

export default function SaveSlotSelector({
  fileName,
  dateRange,
  slots,
  onLoadSlot,
  onSaveNewSlot,
  onDeleteSlot,
  onRenameSlot,
  onClose,
}: SaveSlotSelectorProps) {
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [slotToDelete, setSlotToDelete] = useState<{ id: string; name: string } | null>(null)

  const handleStartEdit = (slot: SaveSlot) => {
    setEditingSlotId(slot.slotId)
    setEditName(slot.slotName)
  }

  const handleSaveEdit = (slotId: string) => {
    if (editName.trim()) {
      onRenameSlot(slotId, editName.trim())
    }
    setEditingSlotId(null)
    setEditName('')
  }

  const handleCancelEdit = () => {
    setEditingSlotId(null)
    setEditName('')
  }

  const handleDeleteClick = (slotId: string, slotName: string) => {
    setSlotToDelete({ id: slotId, name: slotName })
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (slotToDelete) {
      onDeleteSlot(slotToDelete.id)
    }
    setDeleteDialogOpen(false)
    setSlotToDelete(null)
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setSlotToDelete(null)
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-md rounded-2xl p-6 border-2 border-purple-500/30 relative">
      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="סגור"
        >
          <X className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Save className="w-6 h-6" />
          משחקים שמורים
        </h2>
        <p className="text-sm text-gray-300">
          {fileName} {dateRange && `(${dateRange.start} - ${dateRange.end})`}
        </p>
      </div>

      {/* New Save Button */}
      <button
        onClick={onSaveNewSlot}
        className="w-full mb-4 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
      >
        <Save className="w-5 h-5" />
        התחל משחק חדש
      </button>

      {/* Saved Slots List */}
      {slots.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">אין משחקים שמורים</p>
          <p className="text-sm mt-2">לחץ על "התחל משחק חדש" כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {slots
            .sort((a, b) => b.savedAt - a.savedAt) // Newest first
            .map((slot) => (
              <div
                key={slot.slotId}
                className="bg-dark-card/50 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all group"
              >
                {/* Slot Name */}
                {editingSlotId === slot.slotId ? (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(slot.slotId)
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="flex-1 px-3 py-1 bg-dark-bg border border-purple-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      autoFocus
                      dir="rtl"
                    />
                    <button
                      onClick={() => handleSaveEdit(slot.slotId)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                    >
                      שמור
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
                    >
                      ביטול
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">{slot.slotName}</h3>
                    <button
                      onClick={() => handleStartEdit(slot)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-purple-500/20 rounded"
                      title="שנה שם"
                    >
                      <Edit2 className="w-4 h-4 text-purple-400" />
                    </button>
                  </div>
                )}

                {/* Slot Info */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-gray-400">נשמר:</span>{' '}
                    <span className="text-white">
                      {new Date(slot.savedAt).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">שעה:</span>{' '}
                    <span className="text-white">
                      {new Date(slot.savedAt).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">נר:</span>{' '}
                    <span className="text-white">{slot.gameState.currentIndex + 1}</span>
                  </div>
                  <div dir="ltr" className="text-left">
                    <span className="text-gray-400">יתרה:</span>{' '}
                    <span
                      className={
                        slot.gameState.account.equity >= slot.gameState.account.initialBalance
                          ? 'text-green-400'
                          : 'text-red-400'
                      }
                    >
                      ${slot.gameState.account.equity.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLoadSlot(slot.slotId)}
                    className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    טען משחק
                  </button>
                  <button
                    onClick={() => handleDeleteClick(slot.slotId, slot.slotName)}
                    className="py-2 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all duration-200"
                    title="מחק משחק"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        type="danger"
        title="מחיקת משחק שמור"
        message={`האם אתה בטוח שברצונך למחוק את "${slotToDelete?.name}"? פעולה זו לא ניתנת לביטול.`}
        confirmText="מחק"
        cancelText="ביטול"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}
