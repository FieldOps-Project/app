# ADR-001: Signing Out With Operations Still Pending Synchronization

**Status:** Accepted  
**Date:** 2026-10-14  
**Issue:** [FieldOps-Project/app#7](https://github.com/FieldOps-Project/app/issues/7)

## Context

From sprint 6 on (EP-08), everything the technician records in the field is
written to a local outbox before it reaches the API. Signing out while that
outbox still holds operations raises a product question: is the person
allowed to leave, and what happens to the work that has not been sent yet?

Signing out has to keep working without a connection. The technician might be
handing the device to a colleague, or leaving a site with no signal at all.
Two options were considered:

1. **Block** sign-out until the outbox is empty.
2. **Warn and require confirmation**, keeping the pending operations on the
   device.

Blocking sounds safer, but in practice it traps the person. With no signal the
outbox cannot drain, so sign-out would be impossible for as long as the
technician stays out of coverage. And an operation the server keeps rejecting
would block sign-out for good. The usual workaround would be to clear the app
data, which is exactly how field work gets lost.

The business rules also limit the options: RN-066 says unsynchronized data must
survive closing and reopening the app, and document 7.9 says local data must
never be deleted because a session expired.

## Decision

We adopt **option 2: warn and require confirmation**.

- Signing out always asks for confirmation on the profile screen. Once the
  outbox exists, the confirmation shows how many operations are still pending
  and says that they stay saved on the device.
- Signing out removes **only credentials**: the tokens and the cached profile
  in SecureStore, and the in-memory query cache. The local database, the outbox
  and captured files are never touched by sign-out or by session expiry.
- Pending operations belong to the user who recorded them. When that same user
  signs in again, synchronization picks them up where it stopped. If a
  different user signs in on the device, the previous user's operations are
  neither sent under the new identity nor shown to them. They wait until their
  author signs in again.
- Signing out works offline. Revoking the refresh token on the API
  (`POST /api/v1/auth/logout`) is best effort and runs after the local
  credentials are already gone. If the API cannot be reached, the token stays
  valid on the server until it expires.

## Consequences

### Positive

- The technician is never stuck in a session they asked to leave, even with no
  signal or with an operation the server keeps rejecting.
- Field work survives sign-out, session expiry and a change of user on the
  device, which keeps RN-066 and the "never delete local data" rule from 7.9.
- The confirmation step already exists, so EP-08 only has to add the pending
  count to it.

### Negative

- A shared device can hold several users' unsent work at the same time.
  EP-08 has to key outbox entries by user id and filter them on read and on
  send.
- A refresh token that could not be revoked offline stays valid until it
  expires. This is limited by the token lifetime set on the API and by RN-008,
  which invalidates sessions when the password changes or the user is blocked.

## References

- [07 - Fluxo Geral §7.9](https://github.com/FieldOps-Project/docs/blob/main/notion/07-fluxo-geral.md)
- [11 - Arquitetura §11.10](https://github.com/FieldOps-Project/docs/blob/main/notion/11-arquitetura.md)
- [13 - Aplicativo Mobile §13.6](https://github.com/FieldOps-Project/docs/blob/main/notion/13-aplicativo-mobile.md)
- [09 - Regras de Negócio](https://github.com/FieldOps-Project/docs/blob/main/notion/09-regras-de-negocio.md): RN-007, RN-008, RN-066
