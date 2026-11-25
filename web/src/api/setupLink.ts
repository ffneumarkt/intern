import { paths } from '../routes'

// The token goes in the fragment, which browsers do not send to any server.
export const setupLinkUrl = (token: string) => `${window.location.origin}${paths.setup}#${token}`
