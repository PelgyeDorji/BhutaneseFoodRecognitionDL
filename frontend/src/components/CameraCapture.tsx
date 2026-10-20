import { Camera, RefreshCw, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { Button } from './ui'

type Props = { onCapture: (photo: Blob) => void; onClose: () => void }

/** A full-screen camera sheet. Uses the back camera on phones when there is one. */
export function CameraCapture({ onCapture, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot use the camera here. Upload a photo instead.')
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false })
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop())
        stream.current = media
        if (video.current) video.current.srcObject = media
      })
      .catch((reason: DOMException) => {
        setError(
          reason.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it in the browser’s site settings, or upload a photo instead.'
            : 'No camera was found. Upload a photo instead.',
        )
      })

    return () => {
      cancelled = true
      stream.current?.getTracks().forEach((track) => track.stop())
      stream.current = null
    }
  }, [facing])

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose])

  const capture = () => {
    const el = video.current
    if (!el || !el.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = el.videoWidth
    canvas.height = el.videoHeight
    canvas.getContext('2d')!.drawImage(el, 0, 0)
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', 0.92)
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex h-14 items-center justify-between px-3 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onClose}
          className="grid size-11 place-items-center rounded-full hover:bg-white/10"
          aria-label="Close camera"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <p className="text-[14px] text-white/80">Fill the frame with the dish</p>
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          className="grid size-11 place-items-center rounded-full hover:bg-white/10"
          aria-label="Switch camera"
        >
          <RefreshCw className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <p className="text-[16px]">{error}</p>
              <Button variant="secondary" className="mt-6" onClick={onClose}>
                Back to upload
              </Button>
            </div>
          </div>
        ) : (
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className="size-full object-cover"
          />
        )}
      </div>

      {!error && (
        <div className="flex justify-center pb-[max(28px,env(safe-area-inset-bottom))] pt-6">
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            className="grid size-[72px] place-items-center rounded-full border-4 border-white/90 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.94] disabled:opacity-50"
            aria-label="Take photo"
          >
            <span className="grid size-14 place-items-center rounded-full bg-white text-black">
              <Camera className="size-6" aria-hidden="true" />
            </span>
          </button>
        </div>
      )}
    </motion.div>
  )
}
