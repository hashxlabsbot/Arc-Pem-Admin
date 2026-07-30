'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { getCroppedImageBlob } from '@/lib/image-crop'

export interface AspectOption {
  label: string
  value: number | null // null = free-form
}

interface Props {
  imageSrc: string
  title: string
  mimeType: string
  /** Fixed aspect ratio (width/height). Omit if `aspectOptions` lets the user pick instead. */
  aspect?: number
  aspectHint?: string
  aspectOptions?: AspectOption[]
  confirmLabel?: string
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

/** Crop/zoom/rotate UI over react-easy-crop, producing a cropped Blob on confirm. */
export function ImageCropModal({
  imageSrc, title, mimeType, aspect, aspectHint, aspectOptions, confirmLabel = 'Use image', onCancel, onConfirm,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [selectedAspect, setSelectedAspect] = useState<number | null>(aspect ?? aspectOptions?.[0]?.value ?? null)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function confirm() {
    if (!croppedAreaPixels) return
    setError(''); setSaving(true)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, rotation, mimeType)
      onConfirm(blob)
    } catch {
      setError('Could not crop this image. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{title}</h3>
            {aspectHint && <p className="text-xs text-gray-400 mt-0.5">{aspectHint}</p>}
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="relative bg-gray-900" style={{ height: 360 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={selectedAspect ?? undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            restrictPosition={selectedAspect !== null}
          />
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>}

          {aspectOptions && aspectOptions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {aspectOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setSelectedAspect(opt.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${selectedAspect === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <ZoomOut size={15} className="text-gray-400 flex-shrink-0" />
            <input type="range" min={1} max={4} step={0.01} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-blue-600" />
            <ZoomIn size={15} className="text-gray-400 flex-shrink-0" />
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <button type="button" onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100" title="Rotate left">
              <RotateCcw size={15} />
            </button>
            <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100" title="Rotate right">
              <RotateCw size={15} />
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
            <button type="button" onClick={confirm} disabled={saving || !croppedAreaPixels}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Applying…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
