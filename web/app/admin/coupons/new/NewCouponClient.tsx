'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-browser'

interface PlaceOption {
  id: string
  name: string
}

type Scope = 'all' | 'subset'
type Discount = 'none' | 'percentage' | 'amount'

export default function NewCouponClient({ places }: { places: PlaceOption[] }) {
  const supabase = createClient()
  const router = useRouter()

  const [titleFr, setTitleFr] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [descFr, setDescFr]   = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [maxPerUser, setMaxPerUser] = useState('1')
  const [maxTotal, setMaxTotal] = useState('')
  const [discount, setDiscount] = useState<Discount>('percentage')
  const [discountValue, setDiscountValue] = useState('10')
  const [scope, setScope] = useState<Scope>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return places.filter(p => !s || p.name.toLowerCase().includes(s))
  }, [places, search])

  const canSubmit = titleFr.trim()
    && expiresAt
    && (discount === 'none' || (parseInt(discountValue, 10) > 0))
    && (scope === 'all' || picked.size > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    const exp = new Date(expiresAt + 'T23:59:59Z')
    if (Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      setError('Pick a future expiration date.')
      return
    }
    const perUser = Math.max(1, parseInt(maxPerUser, 10) || 1)
    const total = maxTotal.trim() === '' ? null : Math.max(1, parseInt(maxTotal, 10) || 1)

    let dtype: 'percentage' | 'amount' | null = null
    let dvalue: number | null = null
    if (discount !== 'none') {
      const v = parseInt(discountValue, 10)
      if (!Number.isFinite(v) || v <= 0) { setError('Invalid discount value.'); return }
      if (discount === 'percentage' && v > 100) { setError('Percentage must be between 1 and 100.'); return }
      dtype = discount
      dvalue = v
    }

    setSubmitting(true)
    try {
      const { data: created, error: cErr } = await supabase
        .from('coupons')
        .insert({
          place_id: null,
          title_fr: titleFr.trim(),
          title_en: titleEn.trim() || null,
          description_fr: descFr.trim() || null,
          description_en: null,
          expires_at: exp.toISOString(),
          max_redemptions_per_user: perUser,
          max_total_redemptions: total,
          discount_type: dtype,
          discount_value: dvalue,
          is_active: true,
          is_system: true,
        })
        .select('id')
        .single()
      if (cErr) throw cErr
      const couponId = (created as { id: string }).id

      if (scope === 'subset' && picked.size > 0) {
        const { error: sErr } = await supabase
          .from('coupon_places')
          .insert(Array.from(picked).map(pid => ({ coupon_id: couponId, place_id: pid })))
        if (sErr) {
          await supabase.from('coupons').delete().eq('id', couponId)
          throw sErr
        }
      }

      router.push('/admin/coupons')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Could not create')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card title="Titles & details">
        <Field label="Title (French) *">
          <input value={titleFr} onChange={e => setTitleFr(e.target.value)} maxLength={140}
            placeholder="-15% holiday promo at every restaurant" className={inputCls} />
        </Field>
        <Field label="Title (English)">
          <input value={titleEn} onChange={e => setTitleEn(e.target.value)} maxLength={140}
            placeholder="-15% holiday promo everywhere" className={inputCls} />
        </Field>
        <Field label="Details">
          <textarea value={descFr} onChange={e => setDescFr(e.target.value)} rows={3} maxLength={400}
            placeholder="Conditions, minimum spend, etc." className={`${inputCls} resize-none`} />
        </Field>
      </Card>

      <Card title="Validity">
        <Field label="Expires on (YYYY-MM-DD) *">
          <div className="flex items-center gap-2">
            <input value={expiresAt} onChange={e => setExpiresAt(e.target.value)} placeholder="2026-12-31"
              className={`${inputCls} max-w-[200px]`} />
            <div className="flex items-center gap-1.5">
              {[7, 30, 90].map(days => (
                <button key={days} type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() + days)
                    setExpiresAt(d.toISOString().slice(0, 10))
                  }}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                >+{days}d</button>
              ))}
            </div>
          </div>
        </Field>
        <Field label="Per-customer limit">
          <input value={maxPerUser} onChange={e => setMaxPerUser(e.target.value.replace(/\D/g, ''))}
            className={`${inputCls} max-w-[120px]`} />
        </Field>
        <Field label="Total quota (leave blank = unlimited)">
          <input value={maxTotal} onChange={e => setMaxTotal(e.target.value.replace(/\D/g, ''))}
            placeholder="Unlimited" className={`${inputCls} max-w-[200px]`} />
        </Field>
      </Card>

      <Card title="Discount">
        <div className="flex gap-2">
          {(['none', 'percentage', 'amount'] as const).map(d => (
            <button key={d} type="button" onClick={() => setDiscount(d)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                discount === d ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >{d === 'percentage' ? '%' : d === 'amount' ? 'FCFA' : 'None'}</button>
          ))}
        </div>
        {discount !== 'none' && (
          <Field label={discount === 'percentage' ? 'Percentage (1-100)' : 'Amount in FCFA'}>
            <input value={discountValue} onChange={e => setDiscountValue(e.target.value.replace(/\D/g, ''))}
              placeholder={discount === 'percentage' ? '15' : '2000'}
              className={`${inputCls} max-w-[200px]`} />
          </Field>
        )}
      </Card>

      <Card title="Applies at">
        <div className="flex gap-2">
          {(['all', 'subset'] as const).map(s => (
            <button key={s} type="button" onClick={() => setScope(s)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                scope === s ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >{s === 'all' ? 'Every restaurant' : 'Selected restaurants only'}</button>
          ))}
        </div>
        {scope === 'subset' && (
          <div className="space-y-2">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter by name…"
              className={inputCls}
            />
            <div className="text-xs text-gray-500 font-semibold">
              {picked.size > 0 ? `${picked.size} selected` : 'Pick at least one restaurant'}
            </div>
            <div className="border border-gray-200 rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100">
              {filtered.map(p => {
                const on = picked.has(p.id)
                return (
                  <button key={p.id} type="button"
                    onClick={() => setPicked(prev => {
                      const next = new Set(prev)
                      if (next.has(p.id)) next.delete(p.id); else next.add(p.id)
                      return next
                    })}
                    className={`w-full text-left flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 ${
                      on ? 'bg-orange-50' : 'bg-white'
                    }`}
                  >
                    <span className={`text-sm ${on ? 'text-orange-600 font-semibold' : 'text-gray-800 font-medium'}`}>
                      {p.name}
                    </span>
                    {on && <span className="text-orange-500 text-base">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {error && <div className="text-sm text-red-600 font-semibold">{error}</div>}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-700 hover:text-gray-900"
        >Cancel</button>
        <button type="submit" disabled={!canSubmit || submitting}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
            !canSubmit || submitting
              ? 'bg-orange-300 text-white cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >{submitting ? 'Publishing…' : 'Publish coupon'}</button>
      </div>
    </form>
  )
}

const inputCls = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
      <div className="font-semibold text-gray-900">{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</span>
      {children}
    </label>
  )
}
