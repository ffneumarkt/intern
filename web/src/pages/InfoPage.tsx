import LegalItems from '../components/LegalItems'
import { List } from '@/components/ui/list'
import Page from '../components/Page'
import { Hint } from '../components/ui'

export default function InfoPage() {
  return (
    <Page title="Info">
      <Hint>Rechtliche Informationen zu dieser Anwendung der Freiwilligen Feuerwehr Neumarkt im Mühlkreis.</Hint>
      <List>
        <LegalItems />
      </List>
    </Page>
  )
}
