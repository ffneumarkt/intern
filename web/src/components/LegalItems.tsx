import { FileText, ShieldCheck } from 'lucide-react'
import { Row, RowLabel } from '@/components/ui/list'
import { paths } from '../routes'

// The rows that lead to the legal pages; the Info page and the settings each put them in a list.
export default function LegalItems() {
  return (
    <>
      <Row to={paths.imprint} detail>
        <FileText aria-hidden="true" />
        <RowLabel>Impressum</RowLabel>
      </Row>
      <Row to={paths.privacy} detail>
        <ShieldCheck aria-hidden="true" />
        <RowLabel>Datenschutz</RowLabel>
      </Row>
    </>
  )
}
