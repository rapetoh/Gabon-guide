export const metadata = {
  title: "Support — O'Kili",
  description: "Aide et contact pour l'application O'Kili",
}

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-neutral-800">
      <h1 className="text-3xl font-bold mb-2">Support O&apos;Kili</h1>
      <p className="text-neutral-500 mb-8">Aide et contact / Help &amp; contact</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Nous contacter</h2>
        <p className="mb-2">
          Une question, un problème avec l&apos;application, ou un restaurant à
          signaler ? Écrivez-nous :
        </p>
        <p>
          <a
            href="mailto:rapetohsenyo@gmail.com"
            className="text-orange-600 underline"
          >
            rapetohsenyo@gmail.com
          </a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Vous êtes restaurateur ?</h2>
        <p>
          Pour référencer votre établissement sur O&apos;Kili ou gérer votre
          fiche, contactez-nous à la même adresse — nous vous répondrons
          rapidement.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Confidentialité</h2>
        <p>
          Notre politique de confidentialité est disponible sur{' '}
          <a href="/privacy" className="text-orange-600 underline">
            cette page
          </a>
          .
        </p>
      </section>
    </main>
  )
}
