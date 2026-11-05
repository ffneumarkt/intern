import LegalSection from '../components/LegalSection'
import Page from '../components/Page'
import { phoneLink, responsible as r } from '../legal/contact'
import { paths } from '../routes'

export default function ImprintPage() {
  return (
    <Page title="Impressum" back={paths.info}>
      <LegalSection title="Für den Inhalt verantwortlich">
        <p>
          {r.name}
          <br />
          {r.role}
        </p>
        <p>
          {r.brigade}
          <br />
          {r.street}
          <br />
          {r.postalCode} {r.town}
        </p>
      </LegalSection>

      <LegalSection title="Erreichbarkeit">
        <p>
          Sie können jederzeit per E-Mail an <a href={`mailto:${r.email}`}>{r.email}</a> Kontakt aufnehmen. Darüber hinaus besteht die Möglichkeit, telefonisch mit {r.name} unter der Nummer{' '}
          <a href={phoneLink(r.phone)}>{r.phone}</a> in Kontakt zu treten.
        </p>
      </LegalSection>

      <LegalSection title="Copyright">
        <p>Alle Bilder und Inhalte dieser Anwendung sind urheberrechtlich geschützt durch die {r.brigade}. Eine Weiterverwendung ohne vorherige Zustimmung ist nicht gestattet.</p>
      </LegalSection>

      <LegalSection title="Haftungsausschluss">
        <p>
          Die {r.brigade} ist bemüht, richtige und vollständige Informationen in dieser Anwendung bereitzustellen, übernimmt aber keinerlei Verantwortung, Garantien oder Haftung dafür, dass die bereitgestellten Informationen,
          einschließlich jeglicher Datenbankeinträge, richtig, vollständig oder aktuell sind. Das gilt auch für die Berechnungen und das Formular des Beförderungspapiers: Die Verantwortung für die ordnungsgemäße Beförderung bleibt
          beim Feuerwehrkommandanten.
        </p>
        <p>
          Die {r.brigade} behält sich das Recht vor, jederzeit und ohne Vorankündigung die Informationen in dieser Anwendung zu ändern, und verpflichtet sich auch nicht, die enthaltenen Informationen zu aktualisieren.
        </p>
        <p>
          In keinem Fall kann die {r.brigade} bzw. die Gemeinde {r.town} für Schäden irgendeiner Art haftbar gemacht werden, die sich aus der Nutzung oder den Inhalten oder der Verfügbarkeit dieser Anwendung, oder den Dokumenten,
          Diensten und Informationen in dieser Anwendung ergeben könnten. Dabei ist es gleichgültig, ob der Schaden direkter, indirekter oder finanzieller Natur ist, oder es sich um einen Folgeschaden bzw. sonstigen Schaden handelt,
          der sich aus Datenverlust, Nutzungsausfall oder sonstigen Gründen aller Art ergeben könnte.
        </p>
      </LegalSection>
    </Page>
  )
}
