'use client'

import { useState, useRef } from 'react'
import { createClient } from '../lib/supabase-browser'
import type { Database } from '../lib/database.types'

type Video = Database['public']['Tables']['videos']['Row']

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function videoUrl(storagePath: string, supabaseUrl: string) {
  return `${supabaseUrl}/storage/v1/object/public/place-videos/${storagePath}`
}

export default function VideoManager({
  placeId,
  initialVideos,
}: {
  placeId: string
  initialVideos: Video[]
}) {
  const supabase = createClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Accept video files only
    if (!file.type.startsWith('video/')) {
      showToast('Please select a video file.', 'error')
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
    const storagePath = `${placeId}/${uuidv4()}.${ext}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('place-videos')
        .upload(storagePath, file, { contentType: file.type })

      if (uploadError) throw uploadError

      const maxPosition = videos.reduce((max, v) => Math.max(max, v.position), -1)

      const { data: inserted, error: dbError } = await supabase
        .from('videos')
        .insert({
          place_id: placeId,
          storage_path: storagePath,
          caption: caption.trim() || null,
          position: maxPosition + 1,
        })
        .select()
        .single()

      if (dbError) throw dbError

      setVideos(prev => [...prev, inserted as Video])
      setCaption('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      showToast('Video uploaded successfully.')
    } catch (err: any) {
      showToast(err?.message ?? 'Upload failed.', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(video: Video) {
    if (!confirm(`Delete this video? This cannot be undone.`)) return
    setDeletingId(video.id)
    try {
      // Remove from storage
      await supabase.storage.from('place-videos').remove([video.storage_path])
      // Remove from DB
      const { error } = await supabase.from('videos').delete().eq('id', video.id)
      if (error) throw error
      setVideos(prev => prev.filter(v => v.id !== video.id))
      showToast('Video deleted.')
    } catch (err: any) {
      showToast(err?.message ?? 'Delete failed.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleUpdateCaption(video: Video, newCaption: string) {
    const { error } = await supabase
      .from('videos')
      .update({ caption: newCaption.trim() || null })
      .eq('id', video.id)
    if (error) {
      showToast('Failed to update caption.', 'error')
    } else {
      setVideos(prev =>
        prev.map(v => (v.id === video.id ? { ...v, caption: newCaption.trim() || null } : v))
      )
      showToast('Caption updated.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-100'
              : 'bg-green-50 text-green-700 border border-green-100'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Upload section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Upload New Video</h2>
        <p className="text-sm text-gray-500">
          Supported formats: MP4, MOV, WebM. Recommended: vertical (9:16), under 50 MB.
        </p>

        {/* Caption input */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Caption (optional)
          </label>
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Short caption for this video…"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        {/* File picker */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
            id="video-upload-input"
          />
          <label
            htmlFor="video-upload-input"
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {uploading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Choose Video
              </>
            )}
          </label>
        </div>
      </div>

      {/* Video list */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Videos ({videos.length})
        </h2>

        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No videos yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video, index) => (
              <VideoRow
                key={video.id}
                video={video}
                index={index}
                supabaseUrl={supabaseUrl}
                videoUrl={videoUrl}
                deletingId={deletingId}
                onDelete={handleDelete}
                onUpdateCaption={handleUpdateCaption}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VideoRow({
  video,
  index,
  supabaseUrl,
  videoUrl: getUrl,
  deletingId,
  onDelete,
  onUpdateCaption,
}: {
  video: Video
  index: number
  supabaseUrl: string
  videoUrl: (path: string, url: string) => string
  deletingId: string | null
  onDelete: (v: Video) => void
  onUpdateCaption: (v: Video, caption: string) => void
}) {
  const [editingCaption, setEditingCaption] = useState(false)
  const [captionDraft, setCaptionDraft] = useState(video.caption ?? '')
  const url = getUrl(video.storage_path, supabaseUrl)
  const isDeleting = deletingId === video.id

  return (
    <div className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
      {/* Video thumbnail / preview */}
      <div className="shrink-0 w-24 h-36 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
        <video
          src={url}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
          <span className="text-xs text-gray-400 truncate">{video.storage_path.split('/').pop()}</span>
        </div>

        {/* Caption */}
        {editingCaption ? (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={captionDraft}
              onChange={e => setCaptionDraft(e.target.value)}
              className="flex-1 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-300"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onUpdateCaption(video, captionDraft)
                  setEditingCaption(false)
                } else if (e.key === 'Escape') {
                  setCaptionDraft(video.caption ?? '')
                  setEditingCaption(false)
                }
              }}
            />
            <button
              className="text-xs text-orange-500 font-semibold"
              onClick={() => { onUpdateCaption(video, captionDraft); setEditingCaption(false) }}
            >
              Save
            </button>
            <button
              className="text-xs text-gray-400"
              onClick={() => { setCaptionDraft(video.caption ?? ''); setEditingCaption(false) }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="text-sm text-gray-600 text-left hover:text-orange-500 transition-colors"
            onClick={() => setEditingCaption(true)}
          >
            {video.caption ?? <span className="text-gray-400 italic">No caption — click to add</span>}
          </button>
        )}

        <p className="text-xs text-gray-400">
          Uploaded {video.created_at ? new Date(video.created_at).toLocaleDateString() : '—'}
        </p>
      </div>

      {/* Delete button */}
      <button
        onClick={() => onDelete(video)}
        disabled={isDeleting}
        className="shrink-0 self-start p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
        title="Delete video"
      >
        {isDeleting ? (
          <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-red-400 rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>
    </div>
  )
}
