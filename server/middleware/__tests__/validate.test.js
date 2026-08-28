import { describe, it, expect, vi } from 'vitest';
import { 
  registerSchema, 
  loginSchema, 
  validate,
  sanitizeString,
  sanitizeObject,
  socketSchemas 
} from '@/middleware/validate.js';

describe('validate middleware', () => {
  describe('registerSchema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        body: {
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com'
        }
      };
      
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject username too short', () => {
      const invalidData = {
        body: {
          username: 'a',
          password: 'password123'
        }
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject username with invalid characters', () => {
      const invalidData = {
        body: {
          username: 'test@user',
          password: 'password123'
        }
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject password too short', () => {
      const invalidData = {
        body: {
          username: 'testuser',
          password: 'short'
        }
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        body: {
          username: 'testuser',
          password: 'password123',
          email: 'not-an-email'
        }
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid email', () => {
      const validData = {
        body: {
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com'
        }
      };
      
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        body: {
          username: 'testuser',
          password: 'password123'
        }
      };
      
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing username', () => {
      const invalidData = {
        body: {
          password: 'password123'
        }
      };
      
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const invalidData = {
        body: {
          username: 'testuser'
        }
      };
      
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('validate middleware function', () => {
    it('should call next() on valid data', () => {
      const req = { body: { username: 'testuser', password: 'password123' } };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      const middleware = validate(registerSchema);
      middleware(req, res, next);
      
      expect(nextCalled).toBe(true);
      expect(req.body.username).toBe('testuser');
    });

    it('should return 400 on invalid data', () => {
      const req = { body: { username: 'a', password: 'short' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      const middleware = validate(registerSchema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'body.username' }),
            expect.objectContaining({ field: 'body.password' })
          ])
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('sanitizeString', () => {
    it('should escape HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeString(input);
      expect(result).toBe('<script>alert("xss")</script>');
    });

    it('should trim whitespace', () => {
      const input = '  hello world  ';
      const result = sanitizeString(input);
      expect(result).toBe('hello world');
    });

    it('should truncate to max length', () => {
      const input = 'a'.repeat(1000);
      const result = sanitizeString(input, 100);
      expect(result.length).toBe(100);
    });

    it('should handle empty/null input', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(123)).toBe('123');
      expect(sanitizeString(true)).toBe('true');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string values in object', () => {
      const input = {
        name: '<script>test</script>',
        description: 'Normal text'
      };
      
      const result = sanitizeObject(input);
      expect(result.name).toBe('<script>test</script>');
      expect(result.description).toBe('Normal text');
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: '<b>bold</b>',
          profile: {
            bio: '<i>italic</i>'
          }
        }
      };
      
      const result = sanitizeObject(input);
      expect(result.user.name).toBe('<b>bold</b>');
      expect(result.user.profile.bio).toBe('<i>italic</i>');
    });

    it('should sanitize arrays', () => {
      const input = {
        tags: ['<tag1>', 'normal', '<tag2>']
      };
      
      const result = sanitizeObject(input);
      expect(result.tags).toEqual(['<tag1>', 'normal', '<tag2>']);
    });

    it('should preserve non-string values', () => {
      const input = {
        count: 42,
        active: true,
        data: null,
        items: [1, 2, 3]
      };
      
      const result = sanitizeObject(input);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.data).toBe(null);
      expect(result.items).toEqual([1, 2, 3]);
    });

    it('should handle null/undefined input', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });
  });

  describe('socketSchemas', () => {
    describe('createRoom', () => {
      it('should validate valid createRoom data', () => {
        const validData = {
          username: 'testuser',
          quizId: 1
        };
        
        const result = socketSchemas.createRoom.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid username', () => {
        const invalidData = {
          username: 'test@user',
          quizId: 1
        };
        
        const result = socketSchemas.createRoom.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject invalid quizId', () => {
        const invalidData = {
          username: 'testuser',
          quizId: -1
        };
        
        const result = socketSchemas.createRoom.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('joinRoom', () => {
      it('should validate valid joinRoom data', () => {
        const validData = {
          roomCode: 'ABC123',
          username: 'testuser'
        };
        
        const result = socketSchemas.joinRoom.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid roomCode format', () => {
        const invalidData = {
          roomCode: 'abc123', // lowercase
          username: 'testuser'
        };
        
        const result = socketSchemas.joinRoom.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject roomCode wrong length', () => {
        const invalidData = {
          roomCode: 'ABC12', // 5 chars
          username: 'testuser'
        };
        
        const result = socketSchemas.joinRoom.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('submitAnswer', () => {
      it('should validate valid submitAnswer data', () => {
        const validData = {
          selected: 'A',
          roomCode: 'ABC123',
          time_ms: 5000
        };
        
        const result = socketSchemas.submitAnswer.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject time_ms exceeding limit', () => {
        const invalidData = {
          selected: 'A',
          roomCode: 'ABC123',
          time_ms: 30000 // exceeds 20000
        };
        
        const result = socketSchemas.submitAnswer.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('lobbyChat', () => {
      it('should validate valid chat message', () => {
        const validData = {
          roomCode: 'ABC123',
          username: 'testuser',
          message: 'Hello world!'
        };
        
        const result = socketSchemas.lobbyChat.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject message too long', () => {
        const invalidData = {
          roomCode: 'ABC123',
          username: 'testuser',
          message: 'a'.repeat(501)
        };
        
        const result = socketSchemas.lobbyChat.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject empty message', () => {
        const invalidData = {
          roomCode: 'ABC123',
          username: 'testuser',
          message: ''
        };
        
        const result = socketSchemas.lobbyChat.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });
});