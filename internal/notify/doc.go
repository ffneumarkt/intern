// Package notify runs the daily notification job: it loads data, calls due, applies the users'
// notification settings and timings, deduplicates and hands grouped messages to a Sender.
package notify
