// Public privacy policy — the URL Apple/Google require on the store listing.
// Served at https://okili-admin.vercel.app/privacy (outside the /admin gate).

export const metadata = {
  title: "Politique de confidentialité — O'Kili",
  description: "Politique de confidentialité de l'application O'Kili / O'Kili privacy policy",
}

const UPDATED = '17 juillet 2026 / July 17, 2026'

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold text-gray-900">Politique de confidentialité — O&apos;Kili</h1>
      <p className="mt-2 text-sm text-gray-500">Dernière mise à jour / Last updated: {UPDATED}</p>

      {/* ── Français ── */}
      <section className="mt-10 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">🇫🇷 Français</h2>

        <div>
          <h3 className="font-semibold">Qui sommes-nous</h3>
          <p className="mt-1 text-sm leading-6">
            O&apos;Kili est une application de découverte de restaurants, bars et lieux de sortie au Gabon.
            Le responsable du traitement des données est l&apos;éditeur de l&apos;application O&apos;Kili.
            Contact&nbsp;: <a className="text-orange-600 underline" href="mailto:rapetohsenyo@gmail.com">rapetohsenyo@gmail.com</a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Données que nous collectons</h3>
          <ul className="mt-1 list-disc pl-5 text-sm leading-6">
            <li><strong>Compte</strong> — adresse e-mail, nom affiché, photo de profil (optionnelle), langue préférée. Connexion possible via Google ou Apple.</li>
            <li><strong>Position</strong> — uniquement avec votre permission, pour afficher les lieux près de vous et les itinéraires. Jamais stockée sur nos serveurs.</li>
            <li><strong>Activité dans l&apos;app</strong> — avis publiés, favoris, coupons utilisés, crédit O&apos;Kili, code de parrainage, consultations de fiches (statistiques anonymisées pour les établissements).</li>
            <li><strong>Notifications</strong> — un jeton d&apos;appareil (push token) si vous acceptez les notifications.</li>
            <li><strong>Mesure d&apos;audience</strong> — statistiques d&apos;utilisation anonymisées (PostHog) pour améliorer l&apos;application.</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Comment nous les utilisons</h3>
          <p className="mt-1 text-sm leading-6">
            Fournir le service (compte, avis, coupons, crédit, parrainage), vous notifier des événements qui vous
            concernent (coupon validé, crédit reçu, réponse à un avis), montrer aux établissements des statistiques
            agrégées de consultation, et améliorer l&apos;application. Nous ne vendons jamais vos données.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Où sont-elles hébergées</h3>
          <p className="mt-1 text-sm leading-6">
            Base de données et authentification&nbsp;: Supabase. Notifications push&nbsp;: Expo. Statistiques&nbsp;:
            PostHog. Hébergement web&nbsp;: Vercel. Ces prestataires traitent les données pour notre compte.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Vos droits</h3>
          <p className="mt-1 text-sm leading-6">
            Vous pouvez modifier votre profil dans l&apos;application et <strong>supprimer votre compte</strong> à tout
            moment (Profil → Mon compte → Supprimer le compte)&nbsp;: vos données personnelles sont alors effacées.
            Pour toute autre demande (accès, rectification), écrivez-nous à l&apos;adresse ci-dessus.
          </p>
        </div>
      </section>

      {/* ── English ── */}
      <section className="mt-12 space-y-6 border-t border-gray-200 pt-10">
        <h2 className="text-xl font-semibold text-gray-900">🇬🇧 English</h2>

        <div>
          <h3 className="font-semibold">Who we are</h3>
          <p className="mt-1 text-sm leading-6">
            O&apos;Kili is an app for discovering restaurants, bars and going-out spots in Gabon. The data controller
            is the publisher of the O&apos;Kili app.
            Contact: <a className="text-orange-600 underline" href="mailto:rapetohsenyo@gmail.com">rapetohsenyo@gmail.com</a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Data we collect</h3>
          <ul className="mt-1 list-disc pl-5 text-sm leading-6">
            <li><strong>Account</strong> — email address, display name, optional profile photo, preferred language. Sign-in via Google or Apple is supported.</li>
            <li><strong>Location</strong> — only with your permission, to show nearby places and directions. Never stored on our servers.</li>
            <li><strong>In-app activity</strong> — reviews, favorites, redeemed coupons, O&apos;Kili credit, referral code, place views (anonymized statistics shown to venues).</li>
            <li><strong>Notifications</strong> — a device push token if you allow notifications.</li>
            <li><strong>Analytics</strong> — anonymized usage statistics (PostHog) to improve the app.</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">How we use it</h3>
          <p className="mt-1 text-sm leading-6">
            To provide the service (account, reviews, coupons, credit, referrals), to notify you about events that
            concern you (coupon redeemed, credit received, reply to your review), to show venues aggregated view
            statistics, and to improve the app. We never sell your data.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Where it lives</h3>
          <p className="mt-1 text-sm leading-6">
            Database and authentication: Supabase. Push notifications: Expo. Analytics: PostHog. Web hosting: Vercel.
            These providers process data on our behalf.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Your rights</h3>
          <p className="mt-1 text-sm leading-6">
            You can edit your profile in the app and <strong>delete your account</strong> at any time
            (Profile → My account → Delete account); your personal data is then erased. For any other request
            (access, correction), email us at the address above.
          </p>
        </div>
      </section>
    </main>
  )
}
