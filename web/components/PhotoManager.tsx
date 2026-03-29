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
  const [uploadAsMenu, setUploadAsMenu] = useState(false)
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

    const nonMenuPhotos = photos.filter(p => !p.is_menu)
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

      // Only set primary for non-menu gallery photos when no gallery photos exist yet
      const isPrimary = !uploadAsMenu && nonMenuPhotos.length === 0 && i === 0

      const { data: newPhoto, error: dbError } = await supabase
        .from('photos')
        .insert({
          place_id: placeId,
          storage_path: storagePath,
          is_primary: isPrimary,
          is_deleted: false,
          is_menu: uploadAsMenu,
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

  async function handleToggleMenu(photo: Photo) {
    const { error } = await supabase
      .from('photos')
      .update({ is_menu: !photo.is_menu, is_primary: photo.is_menu ? photo.is_primary : false })
      .eq('id', photo.id)
    if (error) { showToast(error.message, 'error'); return }
    setPhotos(prev => prev.map(p =>
      p.id === photo.id ? { ...p, is_menu: !photo.is_menu, is_primary: photo.is_menu ? p.is_primary : false } : p
    ))
    showToast(photo.is_menu ? 'Moved to gallery.' : 'Marked as menu photo.')
  }

  async function handleDelete(photo: Photo) {
    if (!window.confirm('Delete this photo?')) return

    const { error: dbError } = await supabase
      .from('photos')
      .update({ is_deleted: true })
      .eq('id', photo.id)

    if (dbError) { showToast(dbError.message, 'error'); return }

    await supabase.storage.from('place-photos').remove([photo.storage_path])
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  const galleryPhotos = photos.filter(p => !p.is_menu)
  const menuPhotos = photos.filter(p => p.is_menu)

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
      <div className="mb-6">
        {/* Menu photo toggle */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none w-fit">
          <div
            onClick={() => setUploadAsMenu(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${uploadAsMenu ? 'bg-orange-500' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${uploadAsMenu ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm font-medium text-gray-700">
            Upload as menu photo
          </span>
          <span className="text-xs text-gray-400">(shown in the Menu section, not the gallery)</span>
        </label>

        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${uploadAsMenu ? 'border-orange-300 bg-orange-50 hover:border-orange-400' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'}`}
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
              <p className="text-sm font-medium text-gray-700">
                Click to upload {uploadAsMenu ? 'menu photos' : 'photos'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — multiple files supported</p>
            </>
          )}
        </div>
      </div>

      {/* Gallery photos */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Gallery Photos ({galleryPhotos.length})
        </h3>
        {galleryPhotos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-6 py-10 text-center text-sm text-gray-400">
            No gallery photos yet.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {galleryPhotos.map(photo => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                supabaseUrl={supabaseUrl}
                onSetPrimary={handleSetPrimary}
                onToggleMenu={handleToggleMenu}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Menu photos */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Menu Photos ({menuPhotos.length})
        </h3>
        {menuPhotos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-6 py-10 text-center text-sm text-gray-400">
            No menu photos yet. Toggle &quot;Upload as menu photo&quot; above.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {menuPhotos.map(photo => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                supabaseUrl={supabaseUrl}
                onSetPrimary={handleSetPrimary}
                onToggleMenu={handleToggleMenu}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        {photos.length} photo{photos.length !== 1 ? 's' : ''} total · Hover a photo to manage it
      </p>
    </div>
  )
}

function PhotoCard({
  photo,
  supabaseUrl,
  onSetPrimary,
  onToggleMenu,
  onDelete,
}: {
  photo: Photo
  supabaseUrl: string
  onSetPrimary: (id: string) => void
  onToggleMenu: (photo: Photo) => void
  onDelete: (photo: Photo) => void
}) {
  return (
    <div className="relative group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl(photo.storage_path, supabaseUrl)}
        alt=""
        className="w-full aspect-square object-cover rounded-xl border border-gray-100"
      />

      {/* Badges */}
      <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
        {photo.is_primary && (
          <span className="bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            Primary
          </span>
        )}
        {photo.is_menu && (
          <span className="bg-blue-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            Menu
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
        {!photo.is_primary && !photo.is_menu && (
          <button
            onClick={() => onSetPrimary(photo.id)}
            className="px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded-lg hover:bg-gray-100 w-full text-center"
          >
            Set as primary
          </button>
        )}
        <button
          onClick={() => onToggleMenu(photo)}
          className="px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded-lg hover:bg-gray-100 w-full text-center"
        >
          {photo.is_menu ? 'Move to gallery' : 'Mark as menu'}
        </button>
        <button
          onClick={() => onDelete(photo)}
          className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 w-full text-center"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
