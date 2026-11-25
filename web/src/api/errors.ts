import { ClientResponseError } from 'pocketbase'

// Failures the screens explain to the user.
export class BarcodeTakenError extends Error {}

export class ItemPartlySavedError extends Error {}

export class CheckTypeInUseError extends Error {}

export class ItemHasHistoryError extends Error {}

// A location with items, uses or checks in it, or the default one, cannot be deleted.
export class LocationInUseError extends Error {}

export class LocationNameTakenError extends Error {}

// The user closed the browser's passkey dialog: nothing to report.
export class PasskeyCancelledError extends Error {}

export class PasskeyExistsError extends Error {}

export class WrongPasswordError extends Error {}

// The server's rate limit answered, which says nothing about the password.
export class TooManyAttemptsError extends Error {}

export const tooManyAttemptsMessage = 'Zu viele Versuche. Bitte eine Minute warten.'

export function explainRateLimit(err: unknown): unknown {
  return err instanceof ClientResponseError && err.status === 429 ? new TooManyAttemptsError() : err
}

// The browser refused the notification permission.
export class PushDeniedError extends Error {}

// The setup link is unknown, expired, used or of a deactivated member; the server does not say which.
export class SetupLinkInvalidError extends Error {}
