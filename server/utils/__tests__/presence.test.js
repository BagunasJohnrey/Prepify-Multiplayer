import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  userOnline, 
  userOffline, 
  isOnline, 
  getSocketIds,
  __resetPresenceForTesting
} from '../presence.js';

describe('presence', () => {
  beforeEach(() => {
    // Clear the onlineUsers map before each test
    __resetPresenceForTesting();
  });

  afterEach(() => {
    __resetPresenceForTesting();
  });

  describe('userOnline', () => {
    it('should add user to online list', () => {
      userOnline('testuser1', 'socket1');
      expect(isOnline('testuser1')).toBe(true);
    });

    it('should support multiple socket IDs for same user', () => {
      userOnline('testuser1', 'socket1');
      userOnline('testuser1', 'socket2');
      
      const sockets = getSocketIds('testuser1');
      expect(sockets).toContain('socket1');
      expect(sockets).toContain('socket2');
      expect(sockets.length).toBe(2);
    });

    it('should handle empty username gracefully', () => {
      userOnline('', 'socket1');
      // Empty string username is treated as falsy and not tracked
      expect(isOnline('')).toBe(false);
    });

    it('should handle null/undefined username gracefully', () => {
      userOnline(null, 'socket1');
      userOnline(undefined, 'socket2');
      // Should not crash
      expect(isOnline(null)).toBe(false);
      expect(isOnline(undefined)).toBe(false);
    });
  });

  describe('userOffline', () => {
    it('should remove user when last socket disconnects', () => {
      userOnline('testuser1', 'socket1');
      userOffline('testuser1', 'socket1');
      expect(isOnline('testuser1')).toBe(false);
    });

    it('should keep user online if other sockets remain', () => {
      userOnline('testuser1', 'socket1');
      userOnline('testuser1', 'socket2');
      userOffline('testuser1', 'socket1');
      expect(isOnline('testuser1')).toBe(true);
      
      const sockets = getSocketIds('testuser1');
      expect(sockets).toContain('socket2');
      expect(sockets.length).toBe(1);
    });

    it('should handle removing non-existent socket gracefully', () => {
      userOnline('testuser1', 'socket1');
      userOffline('testuser1', 'nonexistent');
      // Should not crash, user should still be online with socket1
      expect(isOnline('testuser1')).toBe(true);
      expect(getSocketIds('testuser1')).toContain('socket1');
    });

    it('should handle empty/null username gracefully', () => {
      userOffline('', 'socket1');
      userOffline(null, 'socket1');
      userOffline(undefined, 'socket1');
      // Should not crash
    });
  });

  describe('isOnline', () => {
    it('should return true for online user', () => {
      userOnline('testuser1', 'socket1');
      expect(isOnline('testuser1')).toBe(true);
    });

    it('should return false for offline user', () => {
      expect(isOnline('nonexistent')).toBe(false);
    });

    it('should return false after user goes offline', () => {
      userOnline('testuser1', 'socket1');
      userOffline('testuser1', 'socket1');
      expect(isOnline('testuser1')).toBe(false);
    });
  });

  describe('getSocketIds', () => {
    it('should return array of socket IDs for online user', () => {
      userOnline('testuser1', 'socket1');
      userOnline('testuser1', 'socket2');
      
      const sockets = getSocketIds('testuser1');
      expect(Array.isArray(sockets)).toBe(true);
      expect(sockets).toContain('socket1');
      expect(sockets).toContain('socket2');
    });

    it('should return empty array for offline user', () => {
      const sockets = getSocketIds('nonexistent');
      expect(sockets).toEqual([]);
    });

    it('should return empty array for user with no sockets', () => {
      userOnline('testuser1', 'socket1');
      userOffline('testuser1', 'socket1');
      
      const sockets = getSocketIds('testuser1');
      expect(sockets).toEqual([]);
    });
  });
});