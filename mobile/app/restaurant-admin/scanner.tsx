import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions, type BarcodeSettings } from 'expo-camera'
import { router } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  decodeScanPayload,
  fetchCouponScanDetails,
  fetchCreditScanDetails,
  useApplyRedemptionSession,
  REDEMPTION_ERRORS,
  type ScannedCouponDetails,
  type ScannedCreditDetails,
} from '../../hooks/useCouponRedemption'
import { useOwnedPlaceId } from '../../hooks/useCoupons'
import { useSession } from '../../hooks/useSession'

const BARCODE_SETTINGS: BarcodeSettings = { barcodeTypes: ['qr'] }
const ORANGE = '#E8571A'

type CouponItem = {
  kind: 'coupon'
  redemptionId: string
  couponId: string
  titleFr: string
  titleEn: string | null
  discountType: 'percentage' | 'amount' | null
  discountValue: number | null
}
type CreditItem = {
  kind: 'credit'
  balance: number
}
type SessionItem = CouponItem | CreditItem

type SessionState = {
  userId: string | null
  customerName: string | null
  customerEmail: string | null
  items: SessionItem[]
}

const EMPTY_SESSION: SessionState = {
  userId: null,
  customerName: null,
  customerEmail: null,
  items: [],
}

function formatFcfa(n: number, lang: 'fr' | 'en'): string {
  return `${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

function discountLabel(it: CouponItem, lang: 'fr' | 'en'): string | null {
  if (it.discountType === null || it.discountValue === null) return null
  if (it.discountType === 'percentage') return `-${it.discountValue}%`
  return `-${formatFcfa(it.discountValue, lang)}`
}

export default function CouponScanner() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { session } = useSession()
  const { data: ownedPlaceId } = useOwnedPlaceId()
  const [permission, requestPermission] = useCameraPermissions()
  const apply = useApplyRedemptionSession()

  const [sessionState, setSessionState] = useState<SessionState>(EMPTY_SESSION)
  const [scanError, setScanError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  // Brief debounce after each scan so we don't process the same QR ten
  // times in a row as the camera keeps streaming frames.
  const lockRef = useRef<string | null>(null)
  // Stale-state guard for async scan handlers
  const sessionRef = useRef(sessionState)
  sessionRef.current = sessionState

  const lookupAndAdd = useCallback(async (raw: string) => {
    const payload = decodeScanPayload(raw)
    if (!payload) {
      setScanError(lang === 'fr' ? 'QR non reconnu' : 'Unrecognised QR')
      return
    }

    if (payload.kind === 'coupon') {
      let details: ScannedCouponDetails | null
      try { details = await fetchCouponScanDetails({ couponId: payload.couponId, code: payload.code }) }
      catch { setScanError(lang === 'fr' ? 'Erreur réseau' : 'Network error'); return }
      if (!details) { setScanError(lang === 'fr' ? 'Code introuvable' : 'Code not found'); return }

      // Place must match the owner's place
      if (ownedPlaceId && details.placeId !== ownedPlaceId) {
        setScanError(lang === 'fr' ? 'Ce coupon est d\'un autre restaurant' : 'This coupon belongs to another place')
        return
      }
      if (details.alreadyRedeemed) {
        setScanError(lang === 'fr' ? 'Coupon déjà utilisé' : 'Coupon already used')
        return
      }
      if (details.inactiveReason) {
        setScanError(lang === 'fr' ? 'Coupon inactif ou expiré' : 'Coupon inactive or expired')
        return
      }

      const s = sessionRef.current
      // Lock to one customer per session
      if (s.userId && s.userId !== details.userId) {
        setScanError(lang === 'fr' ? 'Client différent — terminez la session en cours' : 'Different customer — finish current session first')
        return
      }
      // De-dupe same redemption
      if (s.items.some(i => i.kind === 'coupon' && i.redemptionId === details!.redemptionId)) {
        setScanError(lang === 'fr' ? 'Déjà ajouté' : 'Already added')
        return
      }
      setSessionState({
        userId:        details.userId,
        customerName:  s.customerName  ?? details.customerName,
        customerEmail: s.customerEmail ?? details.customerEmail,
        items: [...s.items, {
          kind: 'coupon',
          redemptionId: details.redemptionId,
          couponId: details.couponId,
          titleFr: details.couponTitleFr,
          titleEn: details.couponTitleEn,
          discountType: details.discountType,
          discountValue: details.discountValue,
        }],
      })
      setScanError(null)
      return
    }

    // payload.kind === 'credit'
    let cdet: ScannedCreditDetails | null
    try { cdet = await fetchCreditScanDetails(payload.userId) }
    catch { setScanError(lang === 'fr' ? 'Erreur réseau' : 'Network error'); return }
    if (!cdet) { setScanError(lang === 'fr' ? 'Utilisateur introuvable' : 'User not found'); return }

    const s2 = sessionRef.current
    if (s2.userId && s2.userId !== cdet.userId) {
      setScanError(lang === 'fr' ? 'Client différent — terminez la session en cours' : 'Different customer — finish current session first')
      return
    }
    if (s2.items.some(i => i.kind === 'credit')) {
      // Refresh balance silently — no error
      setSessionState({
        ...s2,
        userId: s2.userId ?? cdet.userId,
        customerName:  s2.customerName  ?? cdet.customerName,
        customerEmail: s2.customerEmail ?? cdet.customerEmail,
        items: s2.items.map(i => i.kind === 'credit' ? { kind: 'credit', balance: cdet!.creditBalance } : i),
      })
      setScanError(null)
      return
    }
    if (cdet.creditBalance <= 0) {
      setScanError(lang === 'fr' ? 'Crédit indisponible' : 'No credit available')
      return
    }
    setSessionState({
      userId: cdet.userId,
      customerName:  s2.customerName  ?? cdet.customerName,
      customerEmail: s2.customerEmail ?? cdet.customerEmail,
      items: [...s2.items, { kind: 'credit', balance: cdet.creditBalance }],
    })
    setScanError(null)
  }, [lang, ownedPlaceId])

  const onBarcodeScanned = useCallback((event: { data: string }) => {
    const raw = event?.data ?? ''
    if (!raw) return
    if (lockRef.current === raw) return
    lockRef.current = raw
    // Release the lock after 1.5s so the owner can rescan the same code if needed
    setTimeout(() => { if (lockRef.current === raw) lockRef.current = null }, 1500)
    void lookupAndAdd(raw)
  }, [lookupAndAdd])

  // ─── Permission states ──────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.permRoot}>
        <View style={styles.center}><ActivityIndicator color="#fff" /></View>
      </SafeAreaView>
    )
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permRoot}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {lang === 'fr' ? 'Scanner' : 'Scan'}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={48} color="rgba(255,255,255,0.5)" />
          <Text style={styles.permTitle}>
            {lang === 'fr' ? 'Caméra requise' : 'Camera required'}
          </Text>
          <Text style={styles.permText}>
            {lang === 'fr'
              ? 'Autorisez l\'accès à la caméra pour scanner les coupons et crédits.'
              : 'Grant camera access to scan coupons and credits.'}
          </Text>
          <Pressable onPress={requestPermission} style={styles.permBtn}>
            <Text style={styles.permBtnText}>
              {lang === 'fr' ? 'Autoriser' : 'Grant access'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const itemCount = sessionState.items.length
  const hasItems = itemCount > 0
  const hasCredit = sessionState.items.some(i => i.kind === 'credit')

  return (
    <SafeAreaView style={styles.permRoot} edges={['top']}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={!reviewing}
          barcodeScannerSettings={BARCODE_SETTINGS}
          onBarcodeScanned={onBarcodeScanned}
        />

        {/* Header */}
        <View style={[styles.header, styles.headerOverlay]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {lang === 'fr' ? 'Scanner' : 'Scan'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Reticle */}
        <View pointerEvents="none" style={styles.reticleWrap}>
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.reticleHint}>
            {hasItems
              ? (lang === 'fr' ? 'Scannez un autre code ou validez' : 'Scan another code or apply')
              : (lang === 'fr' ? 'Coupon ou crédit du client' : 'Customer coupon or credit')}
          </Text>
        </View>

        {/* Inline scan-error toast */}
        {scanError && (
          <Pressable
            onPress={() => setScanError(null)}
            style={styles.scanErrorToast}
            pointerEvents="box-only"
          >
            <Ionicons name="alert-circle" size={16} color="#fff" />
            <Text style={styles.scanErrorText}>{scanError}</Text>
          </Pressable>
        )}

        {/* Session footer — sticky at the bottom of the camera */}
        {hasItems && (
          <View style={styles.sessionFooter}>
            {!!sessionState.customerName || !!sessionState.customerEmail ? (
              <View style={styles.customerStrip}>
                <Ionicons name="person-circle-outline" size={18} color="#fff" />
                <Text style={styles.customerStripText} numberOfLines={1}>
                  {sessionState.customerName?.trim() || sessionState.customerEmail || ''}
                </Text>
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {sessionState.items.map((it, idx) => (
                <View key={idx} style={styles.chip}>
                  <Ionicons
                    name={it.kind === 'credit' ? 'gift-outline' : 'pricetag'}
                    size={12}
                    color="#fff"
                  />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {it.kind === 'credit'
                      ? `${lang === 'fr' ? 'Crédit' : 'Credit'} · ${formatFcfa(it.balance, lang)}`
                      : `${(lang === 'en' && it.titleEn) ? it.titleEn : it.titleFr}${discountLabel(it, lang) ? ` · ${discountLabel(it, lang)}` : ''}`}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setSessionState(prev => ({
                      ...prev,
                      items: prev.items.filter((_, i) => i !== idx),
                      // If we just removed the last item, reset customer lock too
                      userId: prev.items.length === 1 ? null : prev.userId,
                      customerName:  prev.items.length === 1 ? null : prev.customerName,
                      customerEmail: prev.items.length === 1 ? null : prev.customerEmail,
                    }))}
                  >
                    <Ionicons name="close" size={12} color="rgba(255,255,255,0.7)" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => setReviewing(true)}
              style={styles.reviewBtn}
            >
              <Text style={styles.reviewBtnText}>
                {lang === 'fr'
                  ? `Vérifier et valider (${itemCount})`
                  : `Review & apply (${itemCount})`}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>

      <ReviewModal
        visible={reviewing}
        session={sessionState}
        placeId={ownedPlaceId ?? null}
        applyPending={apply.isPending}
        applyResult={apply.isSuccess ? apply.data : null}
        applyError={apply.isError ? (apply.error as Error)?.message ?? 'UNKNOWN' : null}
        onClose={() => setReviewing(false)}
        onApply={async (billAmount, creditToUse) => {
          if (!session || !ownedPlaceId || !sessionState.userId) return
          const redemptionIds = sessionState.items
            .filter((i): i is CouponItem => i.kind === 'coupon')
            .map(i => i.redemptionId)
          await apply.mutateAsync({
            userId: sessionState.userId,
            redemptionIds,
            creditToUse: hasCredit ? creditToUse : 0,
            billAmount,
            placeId: ownedPlaceId,
          })
        }}
        onDone={() => {
          // Reset everything and go back home
          apply.reset()
          setSessionState(EMPTY_SESSION)
          setReviewing(false)
          router.back()
        }}
        lang={lang}
      />
    </SafeAreaView>
  )
}

// ─── Review modal ──────────────────────────────────────────────────
interface ReviewProps {
  visible: boolean
  session: SessionState
  placeId: string | null
  applyPending: boolean
  applyResult: import('../../hooks/useCouponRedemption').ApplySessionResult | null
  applyError: string | null
  onClose: () => void
  onApply: (billAmount: number, creditToUse: number) => Promise<void>
  onDone: () => void
  lang: 'fr' | 'en'
}

function ReviewModal({
  visible, session, placeId, applyPending, applyResult, applyError, onClose, onApply, onDone, lang,
}: ReviewProps) {
  const [bill, setBill] = useState('')
  const [creditAmount, setCreditAmount] = useState('') // empty = use max available

  const billNum = bill.trim() === '' ? null : parseInt(bill.replace(/[^0-9]/g, ''), 10)
  const creditItem = session.items.find(i => i.kind === 'credit') as CreditItem | undefined
  const creditAvailable = creditItem?.balance ?? 0
  const couponItems = session.items.filter((i): i is CouponItem => i.kind === 'coupon')

  // Per-coupon share of the bill (the RPC does the same split)
  const share = billNum && couponItems.length > 0 ? Math.floor(billNum / couponItems.length) : 0
  const previewDiscounts = couponItems.map(c => {
    if (c.discountType === null || c.discountValue === null) return 0
    if (c.discountType === 'percentage') return Math.min(share, Math.round((share * c.discountValue) / 100))
    return Math.min(share, c.discountValue)
  })
  const totalCouponDiscount = previewDiscounts.reduce((a, b) => a + b, 0)
  const remainingAfterCoupons = billNum !== null ? Math.max(0, billNum - totalCouponDiscount) : 0
  const creditCap = Math.min(creditAvailable, remainingAfterCoupons)
  const creditWanted = creditAmount.trim() === ''
    ? creditCap  // default = use max
    : Math.min(creditCap, Math.max(0, parseInt(creditAmount.replace(/[^0-9]/g, ''), 10) || 0))
  const customerPays = billNum !== null ? Math.max(0, billNum - totalCouponDiscount - creditWanted) : null

  const customerLabel = session.customerName?.trim() || session.customerEmail || (lang === 'fr' ? 'Client' : 'Customer')
  const showsBillInput = couponItems.some(c => c.discountType !== null) || creditItem !== undefined

  const errorText = (key: string) => {
    switch (key) {
      case REDEMPTION_ERRORS.MIXED_CUSTOMERS:           return lang === 'fr' ? 'Clients mélangés' : 'Mixed customers'
      case REDEMPTION_ERRORS.ALREADY_REDEEMED:          return lang === 'fr' ? 'Déjà utilisé'    : 'Already redeemed'
      case REDEMPTION_ERRORS.COUPON_INACTIVE_OR_EXPIRED:return lang === 'fr' ? 'Coupon inactif'  : 'Coupon inactive'
      case REDEMPTION_ERRORS.WRONG_PLACE:               return lang === 'fr' ? 'Mauvais restaurant' : 'Wrong place'
      case REDEMPTION_ERRORS.NOT_AUTHORIZED:            return lang === 'fr' ? 'Non autorisé'    : 'Not authorised'
      case REDEMPTION_ERRORS.CODE_NOT_FOUND:            return lang === 'fr' ? 'Code introuvable': 'Code not found'
      case REDEMPTION_ERRORS.INVALID_BILL:              return lang === 'fr' ? 'Addition invalide': 'Invalid bill'
      default: return key
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={r.backdrop} onPress={onClose}>
          <Pressable style={r.card} onPress={() => {/* swallow */}}>
            <Pressable onPress={onClose} style={r.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={22} color="#1C1C1E" />
            </Pressable>

            <ScrollView
              contentContainerStyle={r.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {applyResult ? (
                // ── Success ──
                <>
                  <View style={[r.iconCircle, r.iconOk]}>
                    <Ionicons name="checkmark" size={28} color="#fff" />
                  </View>
                  <Text style={r.title}>
                    {lang === 'fr' ? 'Validé' : 'Done'}
                  </Text>
                  <View style={[r.divider]} />
                  <View style={r.customerStrip2}>
                    <Ionicons name="person-circle-outline" size={24} color="#6B6B70" />
                    <Text style={r.customerName} numberOfLines={1}>{customerLabel}</Text>
                  </View>
                  <View style={r.divider} />
                  <SummaryRow label={lang === 'fr' ? 'Addition' : 'Bill'} value={formatFcfa(applyResult.bill_amount, lang)} />
                  {applyResult.total_discount > 0 && (
                    <SummaryRow label={lang === 'fr' ? 'Remises' : 'Discounts'} value={`-${formatFcfa(applyResult.total_discount, lang)}`} highlight />
                  )}
                  {applyResult.credit_used > 0 && (
                    <SummaryRow label={lang === 'fr' ? 'Crédit utilisé' : 'Credit used'} value={`-${formatFcfa(applyResult.credit_used, lang)}`} highlight />
                  )}
                  <SummaryRow
                    label={lang === 'fr' ? 'Le client paie' : 'Customer pays'}
                    value={formatFcfa(applyResult.customer_pays, lang)}
                    strong
                  />
                  <Pressable onPress={onDone} style={r.primaryBtn}>
                    <Text style={r.primaryBtnText}>{lang === 'fr' ? 'Terminé' : 'Done'}</Text>
                  </Pressable>
                </>
              ) : (
                // ── Ready / error states ──
                <>
                  <View style={[r.iconCircle, r.iconOrange]}>
                    <Ionicons name="receipt-outline" size={24} color="#fff" />
                  </View>
                  <Text style={r.title}>
                    {lang === 'fr' ? 'Validation' : 'Review'}
                  </Text>

                  <View style={r.divider} />
                  <View style={r.customerStrip2}>
                    <Ionicons name="person-circle-outline" size={24} color="#6B6B70" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={r.customerName} numberOfLines={1}>{customerLabel}</Text>
                      {session.customerEmail && session.customerName && session.customerEmail !== session.customerName && (
                        <Text style={r.customerSub} numberOfLines={1}>{session.customerEmail}</Text>
                      )}
                    </View>
                  </View>

                  <View style={r.divider} />
                  {couponItems.map((c, idx) => (
                    <SummaryRow
                      key={c.redemptionId}
                      label={(lang === 'en' && c.titleEn) ? c.titleEn : c.titleFr}
                      value={billNum !== null ? `-${formatFcfa(previewDiscounts[idx] ?? 0, lang)}` : (discountLabel(c, lang) ?? '—')}
                      highlight
                    />
                  ))}
                  {creditItem && (
                    <SummaryRow
                      label={lang === 'fr' ? 'Crédit disponible' : 'Available credit'}
                      value={formatFcfa(creditItem.balance, lang)}
                    />
                  )}

                  {showsBillInput && (
                    <>
                      <View style={r.divider} />
                      <Text style={r.label}>
                        {lang === 'fr' ? 'Addition (FCFA)' : 'Bill (FCFA)'}
                      </Text>
                      <TextInput
                        style={r.input}
                        value={bill}
                        onChangeText={t => setBill(t.replace(/[^0-9]/g, ''))}
                        placeholder={lang === 'fr' ? 'Montant total' : 'Total amount'}
                        placeholderTextColor="#A3A3A8"
                        keyboardType="number-pad"
                        returnKeyType="done"
                      />
                      {creditItem && billNum !== null && creditCap > 0 && (
                        <>
                          <Text style={[r.label, { marginTop: 12 }]}>
                            {lang === 'fr'
                              ? `Crédit à utiliser (max ${formatFcfa(creditCap, lang)})`
                              : `Credit to use (max ${formatFcfa(creditCap, lang)})`}
                          </Text>
                          <TextInput
                            style={r.input}
                            value={creditAmount}
                            onChangeText={t => setCreditAmount(t.replace(/[^0-9]/g, ''))}
                            placeholder={formatFcfa(creditCap, lang)}
                            placeholderTextColor="#A3A3A8"
                            keyboardType="number-pad"
                          />
                        </>
                      )}
                    </>
                  )}

                  {billNum !== null && customerPays !== null && (
                    <>
                      <View style={r.divider} />
                      {totalCouponDiscount > 0 && (
                        <SummaryRow label={lang === 'fr' ? 'Total remises' : 'Total discounts'} value={`-${formatFcfa(totalCouponDiscount, lang)}`} highlight />
                      )}
                      {creditWanted > 0 && (
                        <SummaryRow label={lang === 'fr' ? 'Crédit utilisé' : 'Credit used'} value={`-${formatFcfa(creditWanted, lang)}`} highlight />
                      )}
                      <SummaryRow
                        label={lang === 'fr' ? 'Le client paie' : 'Customer pays'}
                        value={formatFcfa(customerPays, lang)}
                        strong
                      />
                    </>
                  )}

                  {applyError && (
                    <Text style={r.errorText}>{errorText(applyError)}</Text>
                  )}

                  <Pressable
                    disabled={applyPending || !placeId || (showsBillInput && billNum === null)}
                    onPress={() => {
                      if (billNum === null && !showsBillInput) {
                        // No bill needed (no discount + no credit) — still apply with 0
                        void onApply(0, 0)
                      } else if (billNum !== null) {
                        void onApply(billNum, creditWanted)
                      }
                    }}
                    style={[
                      r.primaryBtn,
                      (applyPending || !placeId || (showsBillInput && billNum === null)) && r.primaryBtnDisabled,
                    ]}
                  >
                    {applyPending
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={r.primaryBtnText}>{lang === 'fr' ? 'Appliquer tout' : 'Apply all'}</Text>}
                  </Pressable>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function SummaryRow({ label, value, highlight, strong }: { label: string; value: string; highlight?: boolean; strong?: boolean }) {
  return (
    <View style={r.row}>
      <Text style={[r.rowLabel, strong && r.rowLabelStrong]} numberOfLines={2}>{label}</Text>
      <Text style={[
        r.rowValue,
        strong && r.rowValueStrong,
        highlight && { color: ORANGE },
      ]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  permRoot: { flex: 1, backgroundColor: '#000' },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },

  cameraWrap: { flex: 1, position: 'relative' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  reticleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: { width: 240, height: 240, position: 'relative' },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#fff' },
  cornerTL: { top: 0, left: 0,    borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0,   borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  reticleHint: {
    color: '#fff', fontSize: 13, fontWeight: '500',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999,
  },

  scanErrorToast: {
    position: 'absolute', top: 80, left: 16, right: 16,
    backgroundColor: 'rgba(255,59,48,0.92)',
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    zIndex: 30,
  },
  scanErrorText: { color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 },

  sessionFooter: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 10,
    zIndex: 20,
  },
  customerStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4,
  },
  customerStripText: { color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 },

  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingLeft: 10, paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 260,
  },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '600', maxWidth: 200 },

  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: ORANGE,
    paddingVertical: 13,
    borderRadius: 999,
    marginTop: 4,
  },
  reviewBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  permTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  permText:  { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18, textAlign: 'center', maxWidth: 300 },
  permBtn:   { backgroundColor: ORANGE, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  permBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})

// Review modal styles
const r = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 12, right: 12,
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  scroll: { gap: 8, alignItems: 'stretch', paddingBottom: 4 },

  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },
  iconOk:     { backgroundColor: '#34C759' },
  iconOrange: { backgroundColor: ORANGE },

  title: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E5EA', marginVertical: 6 },

  customerStrip2: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customerName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  customerSub:  { fontSize: 11, color: '#6B6B70', marginTop: 1 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  rowLabel:       { flex: 1, fontSize: 13, color: '#3C3C43' },
  rowLabelStrong: { fontWeight: '700', fontSize: 14, color: '#1C1C1E' },
  rowValue:       { fontSize: 14, fontWeight: '600', color: '#1C1C1E', textAlign: 'right' },
  rowValueStrong: { fontSize: 17, fontWeight: '800' },

  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: '#6B6B70', marginTop: 4 },
  input: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10,
    fontSize: 17, fontWeight: '700',
    color: '#1C1C1E',
    backgroundColor: '#F2F2F7',
    marginTop: 4,
  },

  errorText: { color: '#FF3B30', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6 },

  primaryBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 22, paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
