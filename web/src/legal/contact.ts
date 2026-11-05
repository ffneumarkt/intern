// Who is responsible, as on ffneumarkt.at (ffneumarkt-web: content/settings and the Impressum page).
// Static on purpose: the legal pages must work offline and without a login.
export const responsible = {
  name: 'Rainer Stroblmair',
  role: 'Feuerwehrkommandant',
  brigade: 'Freiwillige Feuerwehr Neumarkt im Mühlkreis',
  brigadeShort: 'FF Neumarkt',
  street: 'Edlwies 3',
  postalCode: '4212',
  town: 'Neumarkt im Mühlkreis',
  email: '02121@fr.ooelfv.at',
  phone: '+43 664 101 80 06',
}

export const phoneLink = (phone: string) => `tel:${phone.replace(/\s/g, '')}`
