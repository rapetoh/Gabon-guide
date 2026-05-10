import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions, type BarcodeSettings } from 'expo-camera'
import { router } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { decodeQrPayload, useRedeemCode } from '../../hooks/useCouponRedemption'
import { supabase } from '../../lib/supabase'

// Stable barcode settings reference — recreating this object on every render
// makes expo-camera tear down and re-install its barcode pipeline, which
// shows up in logs as "Barcode scanning has been disabled" and prevents
// scans from firing.
const BARCODE_SETTINGS: BarcodeSettings = { barcodeTypes: ['qr'] }

type ScanState =
  | { kind: 'idle' }
  | { kind: 'redeeming'; couponTitle: string; code: string }
  | { kind: 'success'; couponTitle: string }
  | { kind: 'error'; message: string }

export default function CouponScanner() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const [permission, requestPermission] = useCameraPermissions()
  const [state, setState] = useState<ScanState>({ kind: 'idle' })
  const redeemCode = useRedeemCode()
  // Prevents back-to-back scans of the same QR firing the handler dozens of times
  const lockRef = useRef<string | null>(null)

  // ─── Stable scan handler via refs ─────────────────────────────────
  // The ONLY way to keep onBarcodeScanned identity stable across all
  // renders (regardless of state changes, hook returns, etc.) is to
  // route through a ref. expo-camera tears down its barcode pipeline
  // when the prop identity changes; thrashing prevents real scans
  // from firing.
  const stateRef = useRef(state)
  stateRef.current = state

  const redeemMutate = redeemCode.mutateAsync

  const handleScanInner = useCallback(async (raw: string) => {
    console.log('[scanner] handleScanInner running for', raw)
    if (lockRef.current === raw) return
    lockRef.current = raw

    const payload = decodeQrPayload(raw)
    if (!payload) {
      setState({
        kind: 'error',
        message: lang === 'fr' ? 'QR non reconnu' : 'Unrecognised QR code',
      })
      setTimeout(() => {
        setState({ kind: 'idle' })
        lockRef.current = null
      }, 2500)
      return
    }

    let couponTitle = ''
    try {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('title_fr, title_en')
        .eq('id', payload.couponId)
        .maybeSingle()
      if (coupon) {
        couponTitle = (lang === 'en' && coupon.title_en) ? coupon.title_en : coupon.title_fr
      }
    } catch {
      // Ignore — we'll still try the redemption
    }

    setState({ kind: 'redeeming', couponTitle, code: payload.code })

    try {
      await redeemMutate({ couponId: payload.couponId, code: payload.code })
      setState({ kind: 'success', couponTitle })
    } catch (e: any) {
      const msg = (e?.message ?? '').toString()
      let userMsg: string
      if (msg === 'ALREADY_REDEEMED') {
        userMsg = lang === 'fr' ? 'Coupon déjà utilisé' : 'Coupon already redeemed'
      } else if (msg === 'Coupon code not found') {
        userMsg = lang === 'fr' ? 'Code introuvable' : 'Code not found'
      } else if (msg.toLowerCase().includes('not authorized') || msg.toLowerCase().includes('row-level security')) {
        userMsg = lang === 'fr' ? 'Non autorisé. Ce coupon ne vous appartient pas.' : 'Not authorised. Coupon does not belong to you.'
      } else {
        userMsg = msg || (lang === 'fr' ? 'Erreur' : 'Error')
      }
      setState({ kind: 'error', message: userMsg })
    }
  }, [lang, redeemMutate])

  const handleScanRef = useRef(handleScanInner)
  handleScanRef.current = handleScanInner

  // THIS is the prop passed to CameraView. Identity NEVER changes
  // (empty deps array). It reads current state + latest handler from
  // refs and decides whether to act.
  const onBarcodeScanned = useCallback((event: { data: string }) => {
    console.log('[scanner] onBarcodeScanned event fired with data:', event?.data)
    if (stateRef.current.kind !== 'idle') {
      console.log('[scanner] ignoring — state is', stateRef.current.kind)
      return
    }
    void handleScanRef.current(event?.data ?? '')
  }, [])

  const nextScan = useCallback(() => {
    setState({ kind: 'idle' })
    lockRef.current = null
  }, [])

  // No permission yet → show the request screen
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      </SafeAreaView>
    )
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {lang === 'fr' ? 'Scanner un coupon' : 'Scan a coupon'}
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
              ? 'Autorisez l’accès à la caméra pour scanner les coupons que vos clients vous présentent.'
              : 'Grant camera access to scan coupons your customers present.'}
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={BARCODE_SETTINGS}
          onBarcodeScanned={onBarcodeScanned}
        />

        {/* Header */}
        <View style={[styles.header, styles.headerOverlay]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {lang === 'fr' ? 'Scanner un coupon' : 'Scan a coupon'}
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
            {lang === 'fr' ? 'Cadrez le QR code du client' : "Frame the customer's QR code"}
          </Text>
        </View>

        {/* Result overlay */}
        {state.kind !== 'idle' && (
          <View style={styles.resultOverlay}>
            <View style={styles.resultCard}>
              {state.kind === 'redeeming' && (
                <>
                  <ActivityIndicator color="#E8571A" />
                  <Text style={styles.resultTitle}>
                    {lang === 'fr' ? 'Validation…' : 'Validating…'}
                  </Text>
                </>
              )}
              {state.kind === 'success' && (
                <>
                  <View style={styles.resultIconOk}>
                    <Ionicons name="checkmark" size={36} color="#fff" />
                  </View>
                  <Text style={styles.resultTitle}>
                    {lang === 'fr' ? 'Coupon validé' : 'Coupon redeemed'}
                  </Text>
                  {state.couponTitle ? (
                    <Text style={styles.resultSubtitle}>{state.couponTitle}</Text>
                  ) : null}
                  <Pressable onPress={nextScan} style={styles.resultBtn}>
                    <Text style={styles.resultBtnText}>
                      {lang === 'fr' ? 'Scanner un autre' : 'Scan another'}
                    </Text>
                  </Pressable>
                </>
              )}
              {state.kind === 'error' && (
                <>
                  <View style={styles.resultIconErr}>
                    <Ionicons name="close" size={32} color="#fff" />
                  </View>
                  <Text style={styles.resultTitle}>{state.message}</Text>
                  <Pressable onPress={nextScan} style={styles.resultBtn}>
                    <Text style={styles.resultBtnText}>
                      {lang === 'fr' ? 'Réessayer' : 'Try again'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },

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
  reticle: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32, height: 32,
    borderColor: '#fff',
  },
  cornerTL: { top: 0, left: 0,    borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0,   borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  reticleHint: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },

  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  resultCard: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  resultIconOk: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#34C759',
    alignItems: 'center', justifyContent: 'center',
  },
  resultIconErr: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
  },
  resultTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', textAlign: 'center' },
  resultSubtitle: { fontSize: 13, color: '#6B6B70', textAlign: 'center' },
  resultBtn: {
    backgroundColor: '#E8571A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 4,
  },
  resultBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  permTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  permText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18, textAlign: 'center', maxWidth: 300 },
  permBtn: { backgroundColor: '#E8571A', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  permBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
