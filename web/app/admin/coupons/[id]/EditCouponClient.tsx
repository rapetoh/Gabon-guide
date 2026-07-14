'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-browser'

export interface CouponDetail {
  id: string
  place_id: string | null
  title_fr: string
  title_en: string | null
  description_fr: string | null
  starts_at: string
  expires_at: string
  max_redemptions_per_user: number
  max_total_redemptions: number | null
  discount_type: 'percentage' | 'amount' | null
  discount_value: number | null
  is_active: boolean
  is_system: boolean
  places: { id: string; name: string } | null
}

interface PlaceOption {
  id: string
  name: string
}

type Scope = 'all' | 'subset'
type Discount = 'none' | 'percentage' | 'amount'

export default function EditCouponClient({
  coupon, places, initialScope,
}: {
  coupon: CouponDetail
  places: PlaceOption[]
  initialScope: string[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const isPlatform = coupon.place_id === null

  const [titleFr, setTitleFr] = useState(coupon.title_fr)
  const [titleEn, setTitleEn] = useState(coupon.title_en ?? '')
  const [descFr, setDescFr]   = useState(coupon.description_fr ?? '')
  const [startsAt, setStartsAt]   = useState(coupon.starts_at.slice(0, 10))
  const [expiresAt, setExpiresAt] = useState(coupon.expires_at.slice(0, 10))
  const [maxPerUser, setMaxPerUser] = useState(String(coupon.max_redemptions_per_user))
  const [maxTotal, setMaxTotal] = useState(coupon.max_total_redemptions === null ? '' : String(coupon.max_total_redemptions))
  const [discount, setDiscount] = useState<Discount>(coupon.discount_type ?? 'none')
  const [discountValue, setDiscountValue] = useState(coupon.discount_value === null ? '' : String(coupon.discount_value))
  const [isActive, setIsActive] = useState(coupon.is_active)
  const [scope, setScope] = useState<Scope>(initialScope.length > 0 ? 'subset' : 'all')
  const [picked, setPicked] = useState<Set<string>>(new Set(initialScope))
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return places.filter(p => !s || p.name.toLowerCase().includes(s))
  }, [places, search])

  const canSubmit = titleFr.trim()
    && startsAt
    && expiresAt
    && (discount === 'none' || (parseInt(discountValue, 10) > 0))
    && (!isPlatform || scope === 'all' || picked.size > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setNotice(null)

    const start = new Date(startsAt + 'T00:00:00Z')
    const exp = new Date(expiresAt + 'T23:59:59Z')
    if (Number.isNaN(start.getTime())) { setError('Date de début invalide (format YYYY-MM-DD).'); return }
    if (Number.isNaN(exp.getTime()))   { setError('Date d’expiration invalide (format YYYY-MM-DD).'); return }
    if (exp.getTime() <= start.getTime()) { setError('La date d’expiration doit être après la date de début.'); return }

    const perUser = Math.max(1, parseInt(maxPerUser, 10) || 1)
    const total = maxTotal.trim() === '' ? null : Math.max(1, parseInt(maxTotal, 10) || 1)

    let dtype: 'percentage' | 'amount' | null = null
    let dvalue: number | null = null
    if (discount !== 'none') {
      const v = parseInt(discountValue, 10)
      if (!Number.isFinite(v) || v <= 0) { setError('Valeur de remise invalide.'); return }
      if (discount === 'percentage' && v > 100) { setError('Le pourcentage doit être entre 1 et 100.'); return }
      dtype = discount
      dvalue = v
    }

    setSubmitting(true)
    try {
      const { error: uErr } = await supabase
        .from('coupons')
        .update({
          title_fr: titleFr.trim(),
          title_en: titleEn.trim() || null,
          description_fr: descFr.trim() || null,
          starts_at: start.toISOString(),
          expires_at: exp.toISOString(),
          max_redemptions_per_user: perUser,
          max_total_redemptions: total,
          discount_type: dtype,
          discount_value: dvalue,
          is_active: isActive,
        })
        .eq('id', coupon.id)
      if (uErr) throw uErr

      // Platform coupons: rewrite the place scope (empty = every restaurant)
      if (isPlatform) {
        const { error: dErr } = await supabase
          .from('coupon_places')
          .delete()
          .eq('coupon_id', coupon.id)
        if (dErr) throw dErr
        if (scope === 'subset' && picked.size > 0) {
          const { error: sErr } = await supabase
            .from('coupon_places')
            .insert(Array.from(picked).map(pid => ({ coupon_id: coupon.id, place_id: pid })))
          if (sErr) throw sErr
        }
      }

      router.push('/admin/coupons')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Échec de l’enregistrement.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer définitivement ce coupon ? Cette action est irréversible.')) return
    setError(null)
    setNotice(null)
    setDeleting(true)
    try {
      const { error: delErr } = await supabase.from('coupons').delete().eq('id', coupon.id)
      if (delErr) {
        // FK RESTRICT: the coupon has claims/redemptions — deactivate instead.
        if (delErr.code === '23503') {
          await supabase.from('coupons').update({ is_active: false }).eq('id', coupon.id)
          setIsActive(false)
          setNotice('Ce coupon a un historique d’utilisation — il a été désactivé à la place.')
          router.refresh()
          return
        }
        throw delErr
      }
      router.push('/admin/coupons')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Échec de la suppression.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card title="Titres & détails">
        <Field label="Titre (français) *">
          <input value={titleFr} onChange={e => setTitleFr(e.target.value)} maxLength={140}
            className={inputCls} />
        </Field>
        <Field label="Titre (anglais)">
          <input value={titleEn} onChange={e => setTitleEn(e.target.value)} maxLength={140}
            className={inputCls} />
        </Field>
        <Field label="Détails">
          <textarea value={descFr} onChange={e => setDescFr(e.target.value)} rows={3} maxLength={400}
            placeholder="Conditions, montant minimum, etc." className={`${inputCls} resize-none`} />
        </Field>
      </Card>

      <Card title="Validité">
        <Field label="Débute le (YYYY-MM-DD) *">
          <input value={startsAt} onChange={e => setStartsAt(e.target.value)} placeholder="2026-07-01"
            className={`${inputCls} max-w-[200px]`} />
        </Field>
        <Field label="Expire le (YYYY-MM-DD) *">
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
                >+{days}j</button>
              ))}
            </div>
          </div>
        </Field>
        <Field label="Limite par client">
          <input value={maxPerUser} onChange={e => setMaxPerUser(e.target.value.replace(/\D/g, ''))}
            className={`${inputCls} max-w-[120px]`} />
        </Field>
        <Field label="Quota total (vide = illimité)">
          <input value={maxTotal} onChange={e => setMaxTotal(e.target.value.replace(/\D/g, ''))}
            placeholder="Illimité" className={`${inputCls} max-w-[200px]`} />
        </Field>
      </Card>

      <Card title="Remise">
        <div className="flex gap-2">
          {(['none', 'percentage', 'amount'] as const).map(d => (
            <button key={d} type="button" onClick={() => setDiscount(d)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                discount === d ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >{d === 'percentage' ? '%' : d === 'amount' ? 'FCFA' : 'Aucune'}</button>
          ))}
        </div>
        {discount !== 'none' && (
          <Field label={discount === 'percentage' ? 'Pourcentage (1-100)' : 'Montant en FCFA'}>
            <input value={discountValue} onChange={e => setDiscountValue(e.target.value.replace(/\D/g, ''))}
              placeholder={discount === 'percentage' ? '15' : '2000'}
              className={`${inputCls} max-w-[200px]`} />
          </Field>
        )}
      </Card>

      {isPlatform ? (
        <Card title="Valable chez">
          <div className="flex gap-2">
            {(['all', 'subset'] as const).map(s => (
              <button key={s} type="button" onClick={() => setScope(s)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  scope === s ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >{s === 'all' ? 'Tous les restaurants' : 'Restaurants sélectionnés'}</button>
            ))}
          </div>
          {scope === 'subset' && (
            <div className="space-y-2">
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filtrer par nom…"
                className={inputCls}
              />
              <div className="text-xs text-gray-500 font-semibold">
                {picked.size > 0 ? `${picked.size} sélectionné${picked.size === 1 ? '' : 's'}` : 'Choisissez au moins un restaurant'}
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
      ) : (
        <Card title="Valable chez">
          <div className="text-sm text-gray-700 font-medium">{coupon.places?.name ?? '—'}</div>
          <p className="text-xs text-gray-400">Coupon lié à ce restaurant — la portée n’est pas modifiable.</p>
        </Card>
      )}

      <Card title="Statut">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">Coupon actif</div>
            <p className="text-xs text-gray-500 mt-0.5">
              Un coupon inactif n’apparaît plus dans l’application et ne peut plus être réclamé.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(a => !a)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
              isActive ? 'bg-green-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
                isActive ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </Card>

      {error && <div className="text-sm text-red-600 font-semibold">{error}</div>}
      {notice && <div className="text-sm text-amber-700 font-semibold bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">{notice}</div>}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-700 hover:text-gray-900"
        >Annuler</button>
        <button type="submit" disabled={!canSubmit || submitting}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
            !canSubmit || submitting
              ? 'bg-orange-300 text-white cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >{submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" onClick={handleDelete} disabled={deleting || submitting}
          className="ml-auto px-4 py-2.5 rounded-lg text-sm font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40"
        >{deleting ? 'Suppression…' : 'Supprimer'}</button>
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
