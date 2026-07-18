// send_push: deliver one in-app notification (public.notifications row) to the
// owner's devices via Expo's push API.
//
// Called by the DB trigger trg_push_on_notification (migration 040) through
// pg_net with the project anon key as Bearer (verify_jwt gate). The caller is
// NOT trusted: this function re-reads the row with the service role and
// atomically claims it via pushed_at, so a replayed call is a no-op and the
// push content always comes from the database, never from the request.
//
// Push text is rendered here in the user's preferred_language (profiles),
// mirroring the client-side copy in mobile/locales/{fr,en}.json.

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type Lang = 'fr' | 'en'

// deno-lint-ignore no-explicit-any
function renderPush(type: string, p: any, lang: Lang): { title: string; body: string } {
  const fcfa = (n: number) => `${Math.abs(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
  const place = p?.place_name ?? (lang === 'fr' ? 'un établissement' : 'a place')

  switch (type) {
    case 'coupon_redeemed': {
      const title = lang === 'fr' ? (p?.coupon_title_fr ?? p?.coupon_title_en) : (p?.coupon_title_en ?? p?.coupon_title_fr)
      return lang === 'fr'
        ? { title: 'Coupon utilisé 🎉', body: `Votre coupon${title ? ` « ${title} »` : ''} a été validé chez ${place}.` }
        : { title: 'Coupon redeemed 🎉', body: `Your coupon${title ? ` “${title}”` : ''} was validated at ${place}.` }
    }
    case 'credit_spent':
      return lang === 'fr'
        ? { title: 'Crédit utilisé', body: `${fcfa(p?.delta_fcfa ?? 0)} de crédit utilisé chez ${place}.` }
        : { title: 'Credit used', body: `${fcfa(p?.delta_fcfa ?? 0)} of credit used at ${place}.` }
    case 'credit_received': {
      const delta = p?.delta_fcfa ?? 0
      if (delta < 0) {
        return lang === 'fr'
          ? { title: 'Crédit ajusté', body: `Votre crédit O'Kili a été ajusté de -${fcfa(delta)}.` }
          : { title: 'Credit adjusted', body: `Your O'Kili credit was adjusted by -${fcfa(delta)}.` }
      }
      return lang === 'fr'
        ? { title: 'Crédit reçu 💰', body: `+${fcfa(delta)} ajouté à votre crédit O'Kili.` }
        : { title: 'Credit received 💰', body: `+${fcfa(delta)} added to your O'Kili credit.` }
    }
    case 'referral_reward':
      return lang === 'fr'
        ? { title: 'Parrainage récompensé 🎁', body: `+${fcfa(p?.delta_fcfa ?? 0)} — un ami s'est inscrit avec votre code.` }
        : { title: 'Referral reward 🎁', body: `+${fcfa(p?.delta_fcfa ?? 0)} — a friend joined with your code.` }
    case 'review_reply':
      return lang === 'fr'
        ? { title: `${place} vous a répondu`, body: p?.reply_excerpt ?? 'Voir la réponse à votre avis.' }
        : { title: `${place} replied to you`, body: p?.reply_excerpt ?? 'See the reply to your review.' }
    default:
      return lang === 'fr'
        ? { title: "O'Kili", body: 'Vous avez une nouvelle notification.' }
        : { title: "O'Kili", body: 'You have a new notification.' }
  }
}

Deno.serve(async (req: Request) => {
  let notificationId: string | undefined
  try {
    const body = await req.json()
    notificationId = body?.notification_id
  } catch {
    // fall through to 400
  }
  if (!notificationId) {
    return new Response(JSON.stringify({ error: 'notification_id required' }), { status: 400 })
  }

  // Atomically claim the row: only the first call for this id gets it back.
  const { data: notif, error: claimError } = await supabase
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('pushed_at', null)
    .select('id, user_id, type, payload')
    .maybeSingle()

  if (claimError) {
    return new Response(JSON.stringify({ error: claimError.message }), { status: 500 })
  }
  if (!notif) {
    return new Response(JSON.stringify({ skipped: 'unknown id or already pushed' }), { status: 200 })
  }

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', notif.user_id)

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ skipped: 'no devices' }), { status: 200 })
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', notif.user_id)
    .maybeSingle()
  const lang: Lang = prof?.preferred_language === 'en' ? 'en' : 'fr'

  const { title, body } = renderPush(notif.type, notif.payload, lang)
  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title,
    body,
    badge: 1,
    data: {
      notification_id: notif.id,
      type: notif.type,
      place_id: notif.payload?.place_id ?? null,
    },
  }))

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  })
  const expoJson = await expoRes.json().catch(() => null)

  // Drop tokens Expo says no longer exist (app uninstalled, permissions revoked).
  const tickets: Array<{ status: string; details?: { error?: string } }> = expoJson?.data ?? []
  const deadTokens = tickets
    .map((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
    .filter((t): t is string => t !== null)
  if (deadTokens.length > 0) {
    await supabase.from('push_tokens').delete().eq('user_id', notif.user_id).in('token', deadTokens)
  }

  return new Response(
    JSON.stringify({ sent: messages.length - deadTokens.length, pruned: deadTokens.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
