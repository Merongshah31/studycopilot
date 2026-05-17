import React, { useMemo, useState } from 'react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'
import { pushDebugEvent } from '../lib/debug'

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result || '')
      const base64 = raw.includes(',') ? raw.split(',')[1] : raw
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export default function ScheduleImport() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [selected, setSelected] = useState({})
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [importId, setImportId] = useState('')

  const selectedItems = useMemo(
    () => preview.filter((_, idx) => selected[idx]),
    [preview, selected]
  )

  async function handlePreview() {
    if (!file) return
    pushDebugEvent('schedule-import-preview-start', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    })
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const fileDataBase64 = await toBase64(file)
      const data = await apiFetch('/schedule-import/preview', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, fileDataBase64 }),
      })
      const items = Array.isArray(data?.previewItems) ? data.previewItems : []
      pushDebugEvent('schedule-import-preview-success', {
        importId: data?.importId || '',
        storagePath: data?.storagePath || '',
        totalCourses: data?.totalCourses || 0,
        extractedItems: items.length,
      })
      setImportId(String(data?.importId || ''))
      setPreview(items)
      const nextSelected = {}
      items.forEach((_, idx) => { nextSelected[idx] = true })
      setSelected(nextSelected)
      setMessage(`Preview ready: ${items.length} extracted item(s).`)
    } catch (err) {
      pushDebugEvent('schedule-import-preview-error', {
        message: err?.message || 'Failed to preview PDF.',
      })
      setError(err?.message || 'Failed to preview PDF.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (selectedItems.length === 0) {
      setError('Select at least one item to import.')
      return
    }
    setConfirming(true)
    pushDebugEvent('schedule-import-confirm-start', {
      importId,
      selectedCount: selectedItems.length,
    })
    setError('')
    setMessage('')
    try {
      const data = await apiFetch('/schedule-import/confirm', {
        method: 'POST',
        body: JSON.stringify({ importId, items: selectedItems }),
      })
      pushDebugEvent('schedule-import-confirm-success', {
        importId,
        inserted: data?.inserted || 0,
        skipped: data?.skipped || 0,
        uiEvents: Array.isArray(data?.ui_events) ? data.ui_events : [],
      })
      setMessage(data?.message || 'Import completed.')
      const events = Array.isArray(data?.ui_events) ? data.ui_events : []
      if (events.length > 0) {
        window.dispatchEvent(new CustomEvent('studypilot:agent-ui-events', { detail: { events } }))
      }
    } catch (err) {
      pushDebugEvent('schedule-import-confirm-error', {
        importId,
        message: err?.message || 'Failed to import items.',
      })
      setError(err?.message || 'Failed to import items.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-lg font-semibold">Schedule PDF Import</h2>
        <p className="text-sm text-gray-500 mt-1">Upload class schedule PDF, review extracted rows, then confirm import to tasks.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="file"
            accept="application/pdf"
            className="rounded-md border p-2 text-sm"
            onChange={(e) => {
              const nextFile = e.target.files?.[0] || null
              setFile(nextFile)
              pushDebugEvent('schedule-import-file-selected', {
                fileName: nextFile?.name || '',
                fileSize: nextFile?.size || 0,
                fileType: nextFile?.type || '',
              })
            }}
          />
          <button
            type="button"
            onClick={handlePreview}
            disabled={!file || loading}
            className="btn-primary bg-gradient-primary disabled:opacity-60"
          >
            {loading ? 'Extracting...' : 'Preview Extract'}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Extracted Items</h3>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || selectedItems.length === 0}
            className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50 disabled:opacity-60"
          >
            {confirming ? 'Importing...' : `Import Selected (${selectedItems.length})`}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {preview.map((item, idx) => (
            <label key={`${item.title}-${idx}`} className="flex items-start gap-3 rounded-lg border p-3">
              <input
                type="checkbox"
                checked={!!selected[idx]}
                onChange={(e) => setSelected((prev) => ({ ...prev, [idx]: e.target.checked }))}
                className="mt-1"
              />
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{item.description || 'No details'}</p>
                <p className="text-xs mt-1">
                  Priority: <span className="font-medium uppercase">{item.priority || 'medium'}</span>
                </p>
              </div>
            </label>
          ))}
          {preview.length === 0 && <p className="text-sm text-gray-500">No extracted items yet.</p>}
        </div>
      </Card>
    </div>
  )
}
