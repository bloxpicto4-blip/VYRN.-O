# Security Specification — VYRN / Arcade Arena Firestore Rules

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every path not explicitly matched is denied (`read, write: if false`).
2. **PII Isolation (`/users/{userId}`)**: User documents contain `email`. Only the document owner (`request.auth.uid == userId`) or a verified admin (`isAdmin()`) may `get` or `list` user documents. Users cannot self-assign `role: 'admin'` or `isApproved: true` on creation or update.
3. **Catalog Integrity (`/content/{contentId}`)**: Only verified admins may create, update, or delete content items. Draft and archived items are strictly hidden from non-admin reads and list queries.
4. **Section & Taxonomy Integrity (`/sections/{sectionId}`, `/categories/{catId}`, `/settings/{docId}`)**: Only verified admins may write sections, categories, or platform settings. Draft/disabled sections are hidden from non-admins.
5. **Comment Ownership & Moderation (`/comments/{commentId}`)**: Verified users may create comments with `userId == request.auth.uid`, `isApproved == false` (unless admin), `isReported == false`, and `createdAt == request.time`, and only for an existing `contentId`. Non-admins cannot approve comments or tamper with other users' comments, and may only report via an allowlisted action.
6. **Favorites Ownership (`/favorites/{favoriteId}`)**: Users may only read, list, create, or delete their own favorites (`userId == request.auth.uid`) referencing an existing `contentId`.
7. **Temporal & Key Integrity**: Document IDs must match `^[a-zA-Z0-9_-]+$` (max 128 chars). Write payloads enforce exact allowed keys (`hasAll` + `hasOnly`), bounded string/list sizes, immutable `id`/`createdAt`, and `request.time` server timestamps.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated Content Write**: Unauthenticated client attempts `setDoc(doc(db, 'content', 'hack1'), {...})`.
2. **Role Self-Escalation on Signup**: Verified member attempts `setDoc(doc(db, 'users', uid), { id: uid, username: 'attacker', role: 'admin', isApproved: true, createdAt: serverTimestamp() })`.
3. **Shadow/Ghost Field Injection**: Admin or user attempts `setDoc` / `updateDoc` with an unknown field `shadowFlag: true` (blocked by `hasOnly` / `affectedKeys().hasOnly`).
4. **Email Spoofing Without Verification**: User token has `email: 'bidamohammed412@gmail.com'` and `email_verified: false` attempting admin write.
5. **PII Blanket Read**: Member A attempts `getDoc(doc(db, 'users', memberBUid))` or `getDocs(collection(db, 'users'))` without scoping to own UID.
6. **Draft Content Scraping**: Unauthenticated visitor or regular member attempts `getDoc` on a `status: 'draft'` game.
7. **Path ID Poisoning**: Attacker attempts `setDoc` with a 1500-character or special-character document ID (`../admin` or `a`.repeat(200)).
8. **Type / Size Poisoning**: Attacker supplies a 50,000-character `title` or non-boolean `isFeatured: "yes"` or `tags` array exceeding 20 items.
9. **Orphaned Comment Creation**: Verified user creates a comment pointing to a non-existent `contentId: 'fake_game_999'`.
10. **Comment Identity Spoofing**: Verified user A creates a comment claiming `userId: 'user_B'`.
11. **Timestamp Tampering**: User creates a record with a backdated `createdAt` instead of `request.time`.
12. **Admin Collection Tampering**: Any client (even verified user) attempts to write `/admins/{uid}` directly.
