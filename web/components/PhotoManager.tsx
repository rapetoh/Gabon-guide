'use client'

import { useState, useRef } from 'react'
import { createClient } from '../lib/supabase-browser'
import type { Database } from '../lib/database.types'

type Photo = Database['public']['Tables']['photos']['Row']

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function photoUrl(storagePath: string, supabaseUrl: string) {
  return `${supabaseUrl}/storage/v1/object/public/place-photos/${storagePath}`
}

export default function PhotoManager({
  placeId,
  initialPhotos,
}: {
  placeId: string
  initialPhotos: Photo[]
}) {
  const supabase = createClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    setError(null)

    const maxPosition = photos.reduce((max, p) => Math.max(max, p.position), -1)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const storagePath = `${placeId}/${uuidv4()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('place-photos')
        .upload(storagePath, file, { contentType: file.type })

      if (uploadError) {
        showToast(`Upload failed: ${uploadError.message}`, 'error')
        continue
      }

      const isPrimary = photos.length === 0 && i === 0

      const { data: newPhoto, error: dbError } = await supabase
        .from('photos')
        .insert({
          place_id: placeId,
          storage_path: storagePath,
          is_primary: isPrimary,
          is_deleted: false,
          position: maxPosition + i + 1,
        })
        .select()
        .single()

      if (dbError) {
        showToast(`DB error: ${dbError.message}`, 'error')
      } else if (newPhoto) {
        setPhotos(prev => [...prev, newPhoto as Photo])
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    showToast(`${files.length} photo${files.length !== 1 ? 's' : ''} uploaded successfully.`)
  }

  async function handleSetPrimary(photoId: string) {
    await supabase.from('photos').update({ is_primary: false }).eq('place_id', placeId)
    const { error } = await supabase.from('photos').update({ is_primary: true }).eq('id', photoId)
    if (error) { showToast(error.message, 'error'); return }
    setPhotos(prev => prev.map(p => ({ ...p, is_primary: p.id === photoId })))
    showToast('Primary photo updated.')
  }

  async function handleDelete(photo: Photo) {
    if (!window.confirm('Delete this photo?')) return

    // Soft-delete in DB
    const { error: dbError } = await supabase
      .from('photos')
      .update({ is_deleted: true })
      .eq('id', photo.id)

    if (dbError) { showToast(dbError.message, 'error'); return }

    // Delete from storage
    await supabase.storage.from('place-photos').remove([photo.storage_path])

    setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  return (
    <div className="max-w-3xl">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 text-white text-sm font-medium rounded-xl shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success'
            ? <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {toast.message}
        </div>
      )}

      {/* Upload area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-colors mb-6"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        {uploading ? (
          <div className="text-sm text-gray-500">Uploading…</div>
        ) : (
          <>
            <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm font-medium text-gray-700">Click to upload photos</p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — multiple files supported</p>
          </>
        )}
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center text-sm text-gray-400">
          No photos yet. Upload one above.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {photos.map(photo => (
            <div key={photo.id} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(photo.storage_path, supabaseUrl)}
                alt=""
                className="w-full aspect-square object-cover rounded-xl border border-gray-100"
              />

              {/* Primary badge */}
              {photo.is_primary && (
                <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  Primary
                </div>
              )}

              {/* Hover actions */}
              <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                {!photo.is_primary && (
                  <button
                    onClick={() => handleSetPrimary(photo.id)}
                    className="px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded-lg hover:bg-gray-100"
                  >
                    Set as primary
                  </button>
                )}
                <button
                  onClick={() => handleDelete(photo)}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        {photos.length} photo{photos.length !== 1 ? 's' : ''} · Hover a photo to set as primary or delete
      </p>
    </div>
  )
}
