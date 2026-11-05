import { Link } from 'react-router-dom'
import LegalSection from '../components/LegalSection'
import Page from '../components/Page'
import { responsible as r } from '../legal/contact'
import { paths } from '../routes'

export default function PrivacyPage() {
  return (
    <Page title="Datenschutzerklärung" back={paths.info}>
      <div className="legal-note">
        <strong>Kurzfassung für Eilige:</strong>
        <p>
          Das Beförderungspapier funktioniert ohne Anmeldung und speichert <strong>keine persönlichen Daten</strong>. Wir verwenden <strong>keine Tracking-Cookies</strong> und keine Tracking-Tools (wie Google Analytics). Nur
          Mitglieder, die sich anmelden, haben ein Konto mit ihrem Namen, ihrer E-Mail-Adresse und den von ihnen erfassten Verwendungen und Prüfungen.
        </p>
      </div>

      <p className="legal-intro">
        Der Schutz Ihrer Daten ist uns ein besonderes Anliegen. Wir verarbeiten Ihre Daten daher ausschließlich auf Grundlage der gesetzlichen Bestimmungen (DSGVO, TKG). In diesen Datenschutzinformationen informieren wir Sie über die
        wichtigsten Aspekte der Datenverarbeitung im Rahmen dieser Anwendung.
      </p>

      <LegalSection title="Verantwortlicher">
        <p>
          Siehe <Link to={paths.imprint}>Impressum</Link>
        </p>
      </LegalSection>

      <LegalSection title="Beförderungspapier">
        <p>
          Das Beförderungspapier kann ohne Anmeldung benutzt werden. Anzahl der Flaschen, Absender und Empfänger werden nur in Ihrem Browser verarbeitet: Das PDF entsteht auf Ihrem Gerät, die Eingaben werden nicht an uns
          übertragen. Die zuletzt verwendete Anzahl wird auf Ihrem Gerät gespeichert, damit Sie sie nicht erneut eingeben müssen. Vom Server werden nur die allgemeinen Angaben zur Feuerwehr, zur Füllstelle und zur Checkliste geladen.
        </p>
      </LegalSection>

      <LegalSection title="Mitgliederbereich">
        <p>
          Für die Materialverwaltung melden sich Mitglieder mit E-Mail-Adresse und Passwort oder mit einem Passkey an. Konten legt die Feuerwehr an; eine Registrierung durch Besucher ist nicht möglich. Wir speichern Ihren Namen, Ihre
          E-Mail-Adresse, das Passwort ausschließlich in verschlüsselter Form (Hash) und für jeden Passkey den öffentlichen Schlüssel, den von Ihnen gewählten Gerätenamen und das Datum der Anlage. Ihre Berechtigungen werden je
          Kategorie von der Feuerwehr festgelegt.
        </p>
        <p>
          Verwendungen und Prüfungen von Ausrüstung werden mit Datum, Art, Ergebnis, Notiz und dem Namen der erfassenden Person gespeichert. Zweck ist der Nachweis über Prüffristen und den Einsatz der Geräte. Das ist ein berechtigtes
          Interesse i.S.d. DSGVO. Diese Nachweise bleiben als Dokumentation erhalten; sie sind für andere angemeldete Mitglieder sichtbar. Ihr Konto können wir auf Wunsch deaktivieren, sodass Sie sich nicht mehr anmelden können.
        </p>
      </LegalSection>

      <LegalSection title="Push-Nachrichten">
        <p>
          Erinnerungen an fällige Prüfungen per Push-Nachricht sind freiwillig und lassen sich jederzeit unter Einstellungen ausschalten. Dafür speichern wir die Adresse und die Schlüssel, die Ihr Browser für diesen Zweck
          bereitstellt, sowie Ihre Einstellungen (Kategorien, Zeitpunkte, Ruhezeit) und ein Protokoll, welche Erinnerung wann gesendet wurde, damit keine doppelt kommt. Die Nachrichten werden verschlüsselt über den Push-Dienst
          des Herstellers Ihres Browsers oder Geräts (z.B. Google, Apple, Mozilla oder Microsoft) zugestellt; wir haben darauf keinen Einfluss.
        </p>
      </LegalSection>

      <LegalSection title="Hosting & Logfiles">
        <p>
          Die Anwendung läuft auf einem gemieteten Server (VPS) und ist über <a href="https://www.cloudflare.com">Cloudflare</a> erreichbar. Um die Sicherheit und Funktionsfähigkeit zu gewährleisten, verarbeiten Cloudflare und der
          Server technisch notwendige Daten (z.B. IP-Adresse, Browserversion, Zeitpunkt und aufgerufene Adresse), die Ihr Browser automatisch übermittelt. Der Server bewahrt solche Protokolle bis zu fünf Tage auf. Die IP-Adresse
          wird außerdem kurzzeitig verwendet, um die Zahl der Anmeldeversuche zu begrenzen. Diese Daten dienen ausschließlich der technischen Auslieferung, der Fehlersuche und der Abwehr von Angriffen. Sie werden nicht für
          Marketingzwecke genutzt.
        </p>
      </LegalSection>

      <LegalSection title="Lokaler Speicher">
        <p>
          Diese Anwendung verwendet <strong>keine Cookies</strong>, die einer Einwilligung bedürfen. Im Speicher Ihres Browsers legt sie nur Technisches ab: nach der Anmeldung das Anmeldetoken (es wird beim Abmelden gelöscht),
          zuletzt verwendete Eingaben wie die Anzahl der Flaschen oder Ihren Namen beim Erfassen einer Verwendung sowie die Dateien der Anwendung selbst, damit sie auch ohne Internetverbindung funktioniert. Sie können diese Daten
          jederzeit in den Einstellungen Ihres Browsers löschen.
        </p>
      </LegalSection>

      <LegalSection title="Externe Medien">
        <p>
          Wir binden keine externen Inhalte (wie YouTube, Google Maps oder Facebook-Feeds) ein, die ungefragt Daten an Dritte übertragen würden. Alle Bilder und Schriften liegen lokal auf unserem Server.
        </p>
      </LegalSection>

      <LegalSection title="Kontaktaufnahme">
        <p>
          Wenn Sie uns per E-Mail an <a href={`mailto:${r.email}`}>{r.email}</a> kontaktieren, werden Ihre angegebenen Daten zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen sechs Monate bei uns gespeichert. Dies
          ist ein berechtigtes Interesse i.S.d. DSGVO. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
        </p>
      </LegalSection>

      <LegalSection title="Ihre Rechte als Betroffener">
        <p>
          Ihnen stehen bezüglich Ihrer von uns verarbeiteten Daten grundsätzlich die Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerruf und Widerspruch zu. Wenn Sie glauben, dass die
          Verarbeitung Ihrer Daten gegen das Datenschutzrecht verstößt oder Ihre datenschutzrechtlichen Ansprüche sonst in einer Weise verletzt worden sind, können Sie sich bei uns per E-Mail oder bei der{' '}
          <a href="https://www.dsb.gv.at">Datenschutzbehörde</a> beschweren.
        </p>
      </LegalSection>
    </Page>
  )
}
