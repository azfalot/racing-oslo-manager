/**
 * Returns true only for a market item whose seller is explicitly identified as
 * Comunio's Computer account. Unknown ownership must never be treated as safe
 * for an autonomous purchase.
 */
export function isVerifiedComputerOwner(item) {
  const ownerId = item?.owner?.id ?? item?.ownerId;
  const ownerName = String(item?.owner?.name ?? item?.ownerName ?? '').trim().toLowerCase();

  return ownerId === 1 && ownerName === 'computer' && item?.owner?.isRival !== true;
}
