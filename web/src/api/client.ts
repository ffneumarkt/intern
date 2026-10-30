import PocketBase from 'pocketbase'

export const pb = new PocketBase('/')

// Otherwise the SDK aborts parallel requests to the same collection.
pb.autoCancellation(false)

// A rejected token ends the session wherever it is noticed.
pb.afterSend = (response, data) => {
  if (response.status === 401) pb.authStore.clear()
  return data
}
