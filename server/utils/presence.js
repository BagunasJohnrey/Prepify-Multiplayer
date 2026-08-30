// Tracks currently connected users by username for friend online-status.
const onlineUsers = new Map(); // username -> Set of socketIds

export function userOnline(username, socketId) {
  if (!username) return;
  if (!onlineUsers.has(username)) onlineUsers.set(username, new Set());
  onlineUsers.get(username).add(socketId);
}

export function userOffline(username, socketId) {
  if (!username) return;
  const set = onlineUsers.get(username);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) onlineUsers.delete(username);
  }
}

export function isOnline(username) {
  return onlineUsers.has(username);
}

export function getSocketIds(username) {
  const set = onlineUsers.get(username);
  return set ? Array.from(set) : [];
}

// Test helper: reset the online users map
export function __resetPresenceForTesting() {
  onlineUsers.clear();
}
