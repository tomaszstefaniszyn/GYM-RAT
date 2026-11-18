'use client'

import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { cropImage } from '@/lib/image'

export function CropDialog({
  src,
  shape,
  title,
  onCancel,
  onConfirm,
}: {
  src: string
  shape: 'round' | 'rect'
  title: string
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="backdrop" onMouseDown={onCancel}>
      <div
        className="dialog crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <div className="crop-stage">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={shape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <label className="zoom-label">
          Powiększenie
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="crop-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn-yellow"
            disabled={busy || !area}
            onClick={() => {
              if (!area) return
              setBusy(true)
              setError(null)
              void cropImage(src, area)
                .then(onConfirm)
                .catch(() => {
                  setError('Nie udało się przyciąć zdjęcia.')
                  setBusy(false)
                })
            }}
          >
            Zatwierdź
          </button>
        </div>
      </div>
    </div>
  )
}
