import { Card, BlockButton, Hint } from './ui'
import { setupLinkUrl } from '../api/setupLink'

// Shows a setup link once, with ways to pass it on. The link is not stored anywhere in the app.
export default function SetupLinkPanel({ token, name, onDone }: { token: string; name: string; onDone(): void }) {
  const link = setupLinkUrl(token)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // The link stays visible to copy by hand.
    }
  }
  const share = () => navigator.share({ title: 'FF Intern', text: `Einrichtungslink für ${name}`, url: link }).catch(() => {})
  return (
    <>
      <Card>
        <Hint>
          Einrichtungslink für <strong>{name}</strong>. Er gilt 24 Stunden, nur einmal, und wird nur jetzt angezeigt.
        </Hint>
        <p className="ui-link" data-testid="setup-link">
          {link}
        </p>
        <BlockButton fill="outline" onClick={copy}>
          Link kopieren
        </BlockButton>
        {typeof navigator.share === 'function' && (
          <BlockButton fill="outline" onClick={share}>
            Teilen
          </BlockButton>
        )}
      </Card>
      <BlockButton onClick={onDone}>Fertig</BlockButton>
    </>
  )
}
