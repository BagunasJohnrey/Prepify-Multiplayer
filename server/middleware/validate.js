import { z } from "zod";

/**
 * Validation schemas for all API endpoints
 */

// Shared strict email rule: valid format, trimmed, lowercased
const emailSchema = z.string().trim().toLowerCase().email().max(255).refine(v => v.length > 0, { message: "Email is required" });

// Auth schemas
export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/),
    password: z.string().min(8).max(128),
    email: emailSchema.optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1),
    password: z.string().min(1)
  })
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1)
  })
});

export const resendVerificationSchema = z.object({});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(128)
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128)
  })
});

export const updateProfileSchema = z.object({
  body: z.object({
    username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
    email: emailSchema.optional()
  }).refine(data => data.username || data.email, {
    message: "At least one field (username or email) is required"
  })
});

export const completeProfileSchema = z.object({
  body: z.object({
    username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/)
  })
});

export const addFriendSchema = z.object({
  body: z.object({
    username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/)
  })
});

export const removeFriendSchema = z.object({
  params: z.object({
    friendId: z.string().regex(/^\d+$/)
  })
});

export const buyHeartSchema = z.object({});

export const addXpSchema = z.object({});

export const loseHeartSchema = z.object({});

export const uploadAvatarSchema = z.object({});

export const toggleBookmarkSchema = z.object({
  body: z.object({
    quizId: z.number().int().positive()
  })
});

// Quiz schemas
export const getQuizzesSchema = z.object({
  query: z.object({
    course: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    search: z.string().optional(),
    difficulty: z.string().optional(),
    tag: z.string().optional()
  })
});

export const getQuizByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/)
  })
});

export const getSharedQuizSchema = z.object({
  params: z.object({
    shareId: z.string().min(1)
  })
});

export const deleteQuizSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/)
  })
});

export const generateQuizSchema = z.object({
  body: z.object({
    course: z.string().min(1).max(100).optional(),
    customTitle: z.string().max(200).optional(),
    numQuestions: z.coerce.number().int().min(1).max(50).default(10),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    description: z.string().max(1000).optional(),
    tags: z.string().max(500).optional()
  })
});

// Result schemas
export const saveResultSchema = z.object({
  body: z.object({
    quizId: z.number().int().positive(),
    history: z.array(z.object({
      question: z.string().min(1),
      selected: z.string().min(1),
      correct: z.string().min(1).optional(),
      isCorrect: z.boolean(),
      timeMs: z.number().int().min(0).optional()
    })).min(1)
  })
});

export const getHistorySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().optional(),
    course: z.string().optional(),
    difficulty: z.string().optional()
  })
});

export const getResultByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/)
  })
});

export const getWrongAnswersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    course: z.string().optional(),
    quiz_id: z.coerce.number().int().positive().optional()
  })
});

export const getQuizStatsSchema = z.object({});

export const getLeaderboardSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    page: z.coerce.number().int().min(1).default(1),
    sort: z.enum(['xp', 'streak']).default('xp')
  })
});

export const getQuizLeaderboardSchema = z.object({
  params: z.object({
    quizId: z.string().regex(/^\d+$/)
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
});

export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().min(2).max(50)
  })
});

/**
 * Socket.IO event validation schemas
 */
export const socketSchemas = {
  createRoom: z.object({
    username: z.string().min(1).max(20).regex(/^[a-zA-Z0-9_-]+$/),
    quizId: z.number().int().positive()
  }),
  
  joinRoom: z.object({
    roomCode: z.string().length(6).regex(/^[A-Z0-9]+$/),
    username: z.string().min(1).max(20).regex(/^[a-zA-Z0-9_-]+$/)
  }),
  
  startGame: z.object({
    roomCode: z.string().length(6).regex(/^[A-Z0-9]+$/),
    quizId: z.number().int().positive()
  }),
  
  submitAnswer: z.object({
    selected: z.string().min(1),
    roomCode: z.string().length(6).regex(/^[A-Z0-9]+$/),
    time_ms: z.number().int().min(0).max(20000).optional()
  }),
  
  changeQuiz: z.object({
    roomCode: z.string().length(6).regex(/^[A-Z0-9]+$/),
    quizId: z.number().int().positive()
  }),
  
  lobbyChat: z.object({
    roomCode: z.string().length(6).regex(/^[A-Z0-9]+$/),
    username: z.string().min(1).max(20).regex(/^[a-zA-Z0-9_-]+$/),
    message: z.string().min(1).max(500)
  }),
  
  leaveRoom: z.object({
    roomCode: z.string().length(6).regex(/^[A-Z0-9]+$/)
  }),
  
  sendInvite: z.object({
    toUsername: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/)
  }),
  
  respondInvite: z.object({
    toSocketId: z.string().min(1),
    accepted: z.boolean()
  })
};

/**
 * Generic validation middleware factory
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} source - Optional source override (body, query, params)
 */
export function validate(schema, source) {
  return (req, res, next) => {
    if (!schema || typeof schema.safeParse !== 'function') {
      console.error('Invalid validation schema provided');
      return res.status(500).json({ error: 'Internal validation error' });
    }
    
    const data = source ? { [source]: req[source] } : { body: req.body, query: req.query, params: req.params };
    
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const issues = result.error?.issues || result.error?.errors || [];
      if (!result.error || issues.length === 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: [{ field: source || 'request', message: 'Invalid input' }]
        });
      }
      
      const errors = issues.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    if (source) {
      req[source] = result.data[source] || result.data;
    }
    next();
  };
}

/**
 * Multi-source validation middleware
 * Validates body, query, and params simultaneously
 */
export function validateAll(schemas) {
  return (req, res, next) => {
    const errors = [];
    
    for (const [source, schema] of Object.entries(schemas)) {
      const data = req[source];
      const result = schema.safeParse(data);
      
      if (!result.success) {
        (result.error?.issues || result.error?.errors || []).forEach(e => {
          errors.push({
            source,
            field: e.path.join('.'),
            message: e.message
          });
        });
      } else {
        req[source] = result.data;
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    next();
  };
}

/**
 * Socket.IO validation middleware
 */
export function validateSocketEvent(schema) {
  return (data, callback) => {
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const errors = (result.error?.issues || result.error?.errors || []).map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      
      if (callback) {
        callback({ error: 'Validation failed', details: errors });
      }
      return false;
    }
    
    return result.data;
  };
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input, maxLength = 500) {
  if (!input) return '';
  return String(input)
    .replace(/[<>\"'&]/g, (c) => ({
      '<': '<',
      '>': '>',
      '"': '"',
      "'": "'",
      '&': '&'
    }[c]))
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj, maxLength = 500) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxLength));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, maxLength);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, maxLength);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}