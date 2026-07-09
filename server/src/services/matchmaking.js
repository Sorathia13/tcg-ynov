// File d'attente de matchmaking PvP (en mémoire, simple FIFO).
// Un joueur y entre avec son deck ; dès que deux joueurs sont présents, ils sont appariés.

const queue = []; // [{ socketId, user, deckCards }]

export function join(entry) {
  // Évite les doublons (re-clics).
  if (queue.some((e) => e.socketId === entry.socketId)) return null;
  queue.push(entry);
  if (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    return [a, b];
  }
  return null;
}

export function leave(socketId) {
  const idx = queue.findIndex((e) => e.socketId === socketId);
  if (idx !== -1) queue.splice(idx, 1);
}

export function size() {
  return queue.length;
}
