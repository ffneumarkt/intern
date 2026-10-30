// Failures the screens explain to the user.
export class BarcodeTakenError extends Error {}

export class ItemPartlySavedError extends Error {}

export class CheckTypeInUseError extends Error {}

export class ItemHasHistoryError extends Error {}

// The user closed the browser's passkey dialog: nothing to report.
export class PasskeyCancelledError extends Error {}

export class PasskeyExistsError extends Error {}
