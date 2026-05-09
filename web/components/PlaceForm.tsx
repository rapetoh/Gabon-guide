'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase-browser'
import type { Database, PlaceHours, DayHours } from '../lib/database.types'

type Place = Database['public']['Tables']['places']['Row']

const DAYS: { key: keyof PlaceHours; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const DEFAULT_DAY: DayHours = { open: '08:00', close: '22:00', closed: false, overnight: false }

const DEFAULT_HOURS: PlaceHours = {
  mon: { ...DEFAULT_DAY }, tue: { ...DEFAULT_DAY }, wed: { ...DEFAULT_DAY },
  thu: { ...DEFAULT_DAY }, fri: { ...DEFAULT_DAY }, sat: { ...DEFAULT_DAY },
  sun: { ...DEFAULT_DAY },
}

// ─── Helpers (same logic as mobile PlaceForm) ────────────────────────────────

function parseLocationLink(link: string): { lat: number; lng: number } | null {
  const patterns = [
    /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,          // Google Maps short
    /\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,               // Google Maps long
    /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,           // Apple Maps
    /(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,     // Generic fallback
  ]
  for (const re of patterns) {
    const m = link.match(re)
    if (m) {
      const lat = parseFloat(m[1])
      const lng = parseFloat(m[2])
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng }
      }
    }
  }
  return null
}

function validatePhone(value: string): string | null {
  if (!value.trim()) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 12) {
    return 'Invalid number. Ex: 077 12 34 56 or +241 77 12 34 56'
  }
  return null
}

function normalizeWebsite(value: string): string {
  const v = value.trim()
  if (!v) return v
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('www.') || v.includes('.')) return `https://${v}`
  return v
}

function validateWebsite(value: string): string | null {
  if (!value.trim()) return null
  const v = normalizeWebsite(value)
  if (!/^https?:\/\/[^/]+\.[^/]{2,}/.test(v)) {
    return 'Invalid link. Ex: instagram.com/lepatio or https://lepatio.ga'
  }
  return null
}

function validateTimeFormat(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  place?: Place | null
}

export default function PlaceForm({ place }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState(place?.name ?? '')
  const [categoryId, setCategoryId] = useState(place?.category_id ?? '')
  const [subcategoryId, setSubcategoryId] = useState(place?.subcategory_id ?? '')
  const [zoneId, setZoneId] = useState(place?.zone_id ?? '')
  const [priceRange, setPriceRange] = useState<1 | 2 | 3 | null>(place?.price_range ?? null)
  const [phone, setPhone] = useState(place?.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(place?.whatsapp ?? '')
  const [website, setWebsite] = useState(place?.website ?? '')
  const [address, setAddress] = useState(place?.address ?? '')
  const [latitude, setLatitude] = useState(place?.latitude?.toString() ?? '')
  const [longitude, setLongitude] = useState(place?.longitude?.toString() ?? '')
  const [locationLink, setLocationLink] = useState('')
  const [descriptionFr, setDescriptionFr] = useState(place?.description_fr ?? '')
  const [descriptionEn, setDescriptionEn] = useState(place?.description_en ?? '')
  const [isActive, setIsActive] = useState(place?.is_active ?? false)
  const [isPromoted, setIsPromoted] = useState(place?.is_promoted ?? false)
  const [promotedLabelFr, setPromotedLabelFr] = useState(place?.promoted_label_fr ?? '')
  const [promotedLabelEn, setPromotedLabelEn] = useState(place?.promoted_label_en ?? '')
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'standard' | 'premium'>(
    place?.subscription_tier ?? 'free'
  )
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState(
    place?.subscription_expires_at ? String(place.subscription_expires_at).slice(0, 10) : ''
  )
  const [socialInstagram, setSocialInstagram] = useState(place?.social_instagram ?? '')
  const [socialFacebook, setSocialFacebook] = useState(place?.social_facebook ?? '')
  const [socialTiktok, setSocialTiktok] = useState(place?.social_tiktok ?? '')
  const [hours, setHours] = useState<PlaceHours>(
    (place?.hours as PlaceHours | null) ?? DEFAULT_HOURS
  )

  const [categories, setCategories] = useState<{ id: string; name_fr: string }[]>([])
  const [subcategories, setSubcategories] = useState<{ id: string; name_fr: string; category_id: string }[]>([])
  const [zones, setZones] = useState<{ id: string; name: string }[]>([])

  const [saving, setSaving] = useState(false)
  const [linkResolving, setLinkResolving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadReferenceData() {
      const [{ data: cats }, { data: subs }, { data: zns }] = await Promise.all([
        supabase.from('categories').select('id, name_fr').order('name_fr'),
        supabase.from('subcategories').select('id, name_fr, category_id').order('name_fr'),
        supabase.from('zones').select('id, name').order('name'),
      ])
      setCategories(cats ?? [])
      setSubcategories(subs ?? [])
      setZones(zns ?? [])
    }
    loadReferenceData()
  }, [])

  const filteredSubcategories = subcategories.filter(s => s.category_id === categoryId)

  function updateDay(day: keyof PlaceHours, field: keyof DayHours, value: string | boolean) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  async function applyLocationLink() {
    const raw = locationLink.trim()
    // Try direct parse first (works for full Google Maps / Apple Maps URLs)
    let result = parseLocationLink(raw)

    // If that fails, resolve redirects server-side — handles maps.app.goo.gl short links
    if (!result) {
      setLinkResolving(true)
      try {
        const res = await fetch('/api/resolve-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: raw }),
        })
        const data = await res.json()
        if (data.resolvedUrl) result = parseLocationLink(data.resolvedUrl)
      } catch {
        // network error — fall through to show error
      } finally {
        setLinkResolving(false)
      }
    }

    if (!result) {
      setErrors(e => ({ ...e, locationLink: 'Link not recognized. Try a Google Maps or Apple Maps link.' }))
      return
    }
    setErrors(e => { const { locationLink: _, ...rest } = e; return rest })
    setLatitude(result.lat.toString())
    setLongitude(result.lng.toString())
    setLocationLink('')
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Name is required.'
    } else if (name.trim().length < 2) {
      newErrors.name = 'Minimum 2 characters.'
    } else if (name.trim().length > 100) {
      newErrors.name = 'Maximum 100 characters.'
    }

    if (!categoryId) newErrors.category = 'Select a category.'
    if (!zoneId) newErrors.zone = 'Select a zone.'

    if (address.trim().length > 300) newErrors.address = 'Maximum 300 characters.'

    const phoneErr = validatePhone(phone)
    if (phoneErr) newErrors.phone = phoneErr

    const whatsappErr = validatePhone(whatsapp)
    if (whatsappErr) newErrors.whatsapp = whatsappErr

    const websiteErr = validateWebsite(website)
    if (websiteErr) newErrors.website = websiteErr

    if (latitude && isNaN(parseFloat(latitude))) newErrors.latitude = 'Must be a number.'
    if (longitude && isNaN(parseFloat(longitude))) newErrors.longitude = 'Must be a number.'

    // TODO (pre-launch): re-enable Gabon bounding box check
    // if (latitude && longitude) {
    //   const lat = parseFloat(latitude), lng = parseFloat(longitude)
    //   if (lat < -4 || lat > 2.5 || lng < 8.5 || lng > 14.5)
    //     newErrors.location = 'Coordinates must be within Gabon.'
    // }

    DAYS.forEach(({ key }) => {
      const h = hours[key]
      if (!h.closed) {
        if (!validateTimeFormat(h.open)) newErrors[`hours_${key}_open`] = 'HH:MM'
        if (!validateTimeFormat(h.close)) newErrors[`hours_${key}_close`] = 'HH:MM'
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSave() {
    if (!validate()) return

    setSaving(true)
    setErrors({})

    const normalizedWebsite = normalizeWebsite(website)

    // is_promoted requires subscription_tier='premium' (DB check constraint)
    const effectivePromoted = subscriptionTier === 'premium' ? isPromoted : false
    const payload: Database['public']['Tables']['places']['Insert'] = {
      name: name.trim(),
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      zone_id: zoneId || null,
      price_range: priceRange,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      website: normalizedWebsite || null,
      address: address.trim() || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      description_fr: descriptionFr.trim() || null,
      description_en: descriptionEn.trim() || null,
      hours,
      hours_verified_at: null,
      is_active: isActive,
      is_deleted: false,
      subscription_tier: subscriptionTier,
      subscription_expires_at: subscriptionExpiresAt
        ? new Date(subscriptionExpiresAt + 'T00:00:00Z').toISOString()
        : null,
      social_instagram: socialInstagram.trim() ? normalizeWebsite(socialInstagram) : null,
      social_facebook: socialFacebook.trim() ? normalizeWebsite(socialFacebook) : null,
      social_tiktok: socialTiktok.trim() ? normalizeWebsite(socialTiktok) : null,
      is_promoted: effectivePromoted,
      promoted_label_fr: effectivePromoted ? (promotedLabelFr.trim() || null) : null,
      promoted_label_en: effectivePromoted ? (promotedLabelEn.trim() || null) : null,
    }

    let saveError
    if (place?.id) {
      ;({ error: saveError } = await supabase.from('places').update(payload).eq('id', place.id))
    } else {
      const { data: newPlace, error: insertError } = await supabase
        .from('places').insert(payload).select('id').single()
      saveError = insertError
      if (!saveError && newPlace) {
        // Redirect to photos page so admin can add photos immediately after creating a place
        router.push(`/admin/places/${(newPlace as any).id}/photos?created=1`)
        return
      }
    }

    if (saveError) {
      setErrors({ _save: saveError.message })
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!place?.id) return
    if (!window.confirm(`Delete "${place.name}"? This cannot be undone.`)) return
    await supabase.from('places').update({ is_deleted: true }).eq('id', place.id)
    router.push('/admin/places')
  }

  const err = (key: string) => errors[key]
    ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p>
    : null

  return (
    <div>
      {/* Fixed-position toasts — visible regardless of scroll position */}
      {success && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-xl shadow-lg animate-in slide-in-from-bottom-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          Place saved successfully.
        </div>
      )}
      {errors._save && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-xl shadow-lg animate-in slide-in-from-bottom-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          {errors._save}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 max-w-7xl">
        {/* ─── Main column ─── */}
        <div className="space-y-5">
          {/* Basic Info */}
          <Section title="Basic info">
        <Field label="Name *">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            className={`${inputClass} ${errors.name ? 'border-red-300' : ''}`}
            placeholder="Restaurant Le Palmier"
          />
          {err('name')}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category *">
            <select
              value={categoryId}
              onChange={e => { setCategoryId(e.target.value); setSubcategoryId('') }}
              className={`${inputClass} ${errors.category ? 'border-red-300' : ''}`}
            >
              <option value="">— Select —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
            </select>
            {err('category')}
          </Field>
          <Field label="Subcategory">
            <select
              value={subcategoryId}
              onChange={e => setSubcategoryId(e.target.value)}
              className={inputClass}
              disabled={!categoryId}
            >
              <option value="">— None —</option>
              {filteredSubcategories.map(s => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Zone *">
            <select
              value={zoneId}
              onChange={e => setZoneId(e.target.value)}
              className={`${inputClass} ${errors.zone ? 'border-red-300' : ''}`}
            >
              <option value="">— Select —</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            {err('zone')}
          </Field>
          <Field label="Price range">
            <select
              value={priceRange ?? ''}
              onChange={e => setPriceRange(e.target.value ? (parseInt(e.target.value) as 1 | 2 | 3) : null)}
              className={inputClass}
            >
              <option value="">— Select —</option>
              <option value="1">Économique — &lt; 5 000 FCFA</option>
              <option value="2">Intermédiaire — 5 000–20 000 FCFA</option>
              <option value="3">Haut de gamme — &gt; 20 000 FCFA</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className={`${inputClass} ${errors.phone ? 'border-red-300' : ''}`}
              placeholder="+241 07 12 34 56"
            />
            {err('phone')}
          </Field>
          <Field label="WhatsApp">
            <input
              type="text"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              className={`${inputClass} ${errors.whatsapp ? 'border-red-300' : ''}`}
              placeholder="+241 07 12 34 56"
            />
            {err('whatsapp')}
          </Field>
        </div>
        <Field label="Website">
          <input
            type="text"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            className={`${inputClass} ${errors.website ? 'border-red-300' : ''}`}
            placeholder="instagram.com/lepatio or https://lepatio.ga"
          />
          {err('website')}
          {website && !errors.website && (
            <p className="mt-1 text-xs text-gray-400">
              Will be saved as: {normalizeWebsite(website)}
            </p>
          )}
        </Field>
      </Section>

      {/* Location */}
      <Section title="Location">
        <Field label="Address">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            maxLength={300}
            className={`${inputClass} ${errors.address ? 'border-red-300' : ''}`}
            placeholder="Rue des Jardins, Centre-ville"
          />
          {err('address')}
        </Field>

        {/* Location link paste */}
        <Field label="Paste a location link (Google Maps, Apple Maps, WhatsApp)">
          <div className="flex gap-2">
            <input
              type="text"
              value={locationLink}
              onChange={e => setLocationLink(e.target.value)}
              className={`${inputClass} flex-1 ${errors.locationLink ? 'border-red-300' : ''}`}
              placeholder="https://maps.google.com/..."
            />
            <button
              type="button"
              onClick={applyLocationLink}
              disabled={!locationLink.trim() || linkResolving}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {linkResolving ? 'Resolving…' : 'Extract coords'}
            </button>
          </div>
          {err('locationLink')}
          <p className="mt-1 text-xs text-gray-400">
            Paste a shared location link to auto-fill latitude and longitude below.
          </p>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude">
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={e => setLatitude(e.target.value)}
              className={`${inputClass} ${errors.latitude ? 'border-red-300' : ''}`}
              placeholder="-0.7193"
            />
            {err('latitude')}
          </Field>
          <Field label="Longitude">
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={e => setLongitude(e.target.value)}
              className={`${inputClass} ${errors.longitude ? 'border-red-300' : ''}`}
              placeholder="8.7815"
            />
            {err('longitude')}
          </Field>
        </div>
      </Section>

      {/* Hours */}
      <Section title="Opening hours">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left py-2 font-medium w-24">Day</th>
                <th className="text-left py-2 font-medium w-20">Closed</th>
                <th className="text-left py-2 font-medium">Open</th>
                <th className="text-left py-2 font-medium">Close</th>
                <th className="text-left py-2 font-medium">Overnight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {DAYS.map(({ key, label }) => (
                <tr key={key}>
                  <td className="py-2 pr-3">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={hours[key].closed}
                      onChange={e => updateDay(key, 'closed', e.target.checked)}
                      className="accent-orange-500"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="time"
                      value={hours[key].open}
                      disabled={hours[key].closed}
                      onChange={e => updateDay(key, 'open', e.target.value)}
                      className={`${inputClass} w-28 disabled:opacity-40 ${errors[`hours_${key}_open`] ? 'border-red-300' : ''}`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="time"
                      value={hours[key].close}
                      disabled={hours[key].closed}
                      onChange={e => updateDay(key, 'close', e.target.value)}
                      className={`${inputClass} w-28 disabled:opacity-40 ${errors[`hours_${key}_close`] ? 'border-red-300' : ''}`}
                    />
                  </td>
                  <td className="py-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hours[key].overnight}
                        disabled={hours[key].closed}
                        onChange={e => updateDay(key, 'overnight', e.target.checked)}
                        className="accent-orange-500 disabled:opacity-40"
                      />
                      <span className="text-xs text-gray-400">Closes after midnight</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Descriptions */}
      <Section title="Description">
        <Field label="French">
          <textarea
            value={descriptionFr}
            onChange={e => setDescriptionFr(e.target.value)}
            rows={4}
            className={`${inputClass} resize-none`}
            placeholder="Description en français…"
          />
        </Field>
        <Field label="English">
          <textarea
            value={descriptionEn}
            onChange={e => setDescriptionEn(e.target.value)}
            rows={4}
            className={`${inputClass} resize-none`}
            placeholder="Description in English…"
          />
        </Field>
      </Section>
        </div>
        {/* ─── End main column ─── */}

        {/* ─── Sidebar (status / tier / promotion / social) ─── */}
        <aside className="space-y-5">

      {/* Subscription */}
      <Section title="Subscription">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Pack</p>
            <div className="flex gap-2">
              {(['free', 'standard', 'premium'] as const).map(t => {
                const selected = subscriptionTier === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSubscriptionTier(t)
                      if (t !== 'premium' && isPromoted) setIsPromoted(false)
                    }}
                    className={`flex-1 rounded-lg py-2 px-3 text-sm font-semibold transition-colors capitalize ${
                      selected
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t === 'free' ? 'Free' : t === 'standard' ? 'Standard' : 'Premium'}
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Expires on (YYYY-MM-DD)">
            <input
              type="date"
              value={subscriptionExpiresAt}
              onChange={e => setSubscriptionExpiresAt(e.target.value)}
              className={inputClass}
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  const d = new Date()
                  d.setMonth(d.getMonth() + 3)
                  setSubscriptionExpiresAt(d.toISOString().slice(0, 10))
                }}
                className="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
              >
                +3 months
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date()
                  d.setFullYear(d.getFullYear() + 1)
                  setSubscriptionExpiresAt(d.toISOString().slice(0, 10))
                }}
                className="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
              >
                +1 year
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionExpiresAt('')}
                className="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
              >
                Clear
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Empty = no expiration. No auto-downgrade — this is just a reminder for you.
            </p>
          </Field>
        </div>
      </Section>

      {/* Promotion — Premium tier only */}
      <Section title="Promotion (Trending Now)">
        <div
          className={`rounded-lg border p-4 ${
            subscriptionTier !== 'premium' ? 'opacity-50' : ''
          } ${isPromoted ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}
        >
          <label className={`flex items-center gap-3 ${subscriptionTier === 'premium' ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            <input
              type="checkbox"
              checked={isPromoted}
              onChange={e => setIsPromoted(e.target.checked)}
              disabled={subscriptionTier !== 'premium'}
              className="accent-orange-500 w-4 h-4"
            />
            <div>
              <span className="text-sm font-semibold text-gray-900">Promoted place</span>
              <p className="text-xs text-gray-500 mt-0.5">
                {subscriptionTier !== 'premium'
                  ? 'Premium tier only — change the pack above to enable.'
                  : 'Appears first in Trending Now with a badge on the photo'}
              </p>
            </div>
          </label>
          {isPromoted && subscriptionTier === 'premium' && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Badge label (FR)">
                <input
                  type="text"
                  value={promotedLabelFr}
                  onChange={e => setPromotedLabelFr(e.target.value)}
                  className={inputClass}
                  placeholder="Promu"
                />
              </Field>
              <Field label="Badge label (EN)">
                <input
                  type="text"
                  value={promotedLabelEn}
                  onChange={e => setPromotedLabelEn(e.target.value)}
                  className={inputClass}
                  placeholder="Promoted"
                />
              </Field>
            </div>
          )}
        </div>
      </Section>

      {/* Social links — admin-controlled, public visibility gated by tier_features.social_links */}
      <Section title="Social links">
        <div className="grid grid-cols-1 gap-4">
          <Field label="Instagram URL">
            <input
              type="text"
              value={socialInstagram}
              onChange={e => setSocialInstagram(e.target.value)}
              className={inputClass}
              placeholder="https://instagram.com/…"
            />
          </Field>
          <Field label="Facebook URL">
            <input
              type="text"
              value={socialFacebook}
              onChange={e => setSocialFacebook(e.target.value)}
              className={inputClass}
              placeholder="https://facebook.com/…"
            />
          </Field>
          <Field label="TikTok URL">
            <input
              type="text"
              value={socialTiktok}
              onChange={e => setSocialTiktok(e.target.value)}
              className={inputClass}
              placeholder="https://tiktok.com/@…"
            />
          </Field>
        </div>
      </Section>

      {/* Visibility */}
      <Section title="Visibility">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setIsActive(v => !v)}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm font-medium text-gray-700">
            {isActive ? 'Active — visible in the app' : 'Inactive — hidden from users'}
          </span>
        </label>
      </Section>
        </aside>
        {/* ─── End sidebar ─── */}
      </div>
      {/* End grid */}

      {/* Photos — full width below the form */}
      <div className="mt-5 max-w-7xl">
      <Section title="Photos">
        {place?.id ? (
          <a
            href={`/admin/places/${place.id}/photos`}
            className="flex items-center justify-between p-4 border-2 border-dashed border-orange-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Manage photos</p>
                <p className="text-xs text-gray-400">Upload, reorder, and set the primary photo</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </a>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p className="text-sm text-gray-400">Save the place first — you'll be taken to the photos page immediately after.</p>
          </div>
        )}
      </Section>

      </div>
      {/* End Photos wrapper */}

      {/* Actions — sticky at bottom */}
      <div className="mt-6 max-w-7xl flex items-center justify-between pt-4 border-t border-gray-100">
        <div>
          {place?.id && (
            <button
              onClick={handleDelete}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              Delete place
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : place?.id ? 'Save changes' : 'Create place'}
        </button>
      </div>
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
