import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Client from 'socket.io-client';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { validateSocketEvent, socketSchemas } from '../middleware/validate.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-socket-tests-32chars!!';

function createTestServer() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 5000,
    pingInterval: 2000
  });

  return { app, httpServer, io };
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function waitForEvent(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Socket.IO Event Validation', () => {
  describe('validateSocketEvent middleware', () => {
    it('should return validated data on success', () => {
      const data = { username: 'testuser', quizId: 1 };
      const result = validateSocketEvent(socketSchemas.createRoom)(data);
      expect(result).toEqual(data);
    });

    it('should return false on invalid data', () => {
      const data = { username: '', quizId: -1 };
      const result = validateSocketEvent(socketSchemas.createRoom)(data);
      expect(result).toBe(false);
    });

    it('should return false when callback not provided', () => {
      const data = { username: '' };
      const result = validateSocketEvent(socketSchemas.createRoom)(data);
      expect(result).toBe(false);
    });

    it('should call callback with error details', () => {
      const callback = vi.fn();
      const data = { username: '' };
      validateSocketEvent(socketSchemas.createRoom)(data, callback);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.any(Array)
        })
      );
    });
  });

  describe('Socket.IO connection and events', () => {
    let httpServer, io, clientSocket, port;

    beforeAll(async () => {
      const server = createTestServer();
      httpServer = server.httpServer;
      io = server.io;

      // Set up the connection handler with all events
      io.on('connection', (socket) => {
        socket.on('createRoom', (data) => {
          const validated = validateSocketEvent(socketSchemas.createRoom)(data);
          if (!validated) return;
          const roomCode = 'TEST01';
          socket.join(roomCode);
          socket.emit('lobbyUpdate', { roomCode, host: validated.username, players: [{ username: validated.username, id: socket.id }] });
        });

        socket.on('joinRoom', (data) => {
          const validated = validateSocketEvent(socketSchemas.joinRoom)(data);
          if (!validated) return;
          socket.join(validated.roomCode);
          socket.emit('lobbyUpdate', { roomCode: validated.roomCode, players: [{ username: validated.username, id: socket.id }] });
        });

        socket.on('lobbyChat', (data) => {
          const validated = validateSocketEvent(socketSchemas.lobbyChat)(data);
          if (!validated) return;
          io.to(validated.roomCode).emit('lobbyChat', { username: validated.username, message: validated.message });
        });

        socket.on('submitAnswer', (data) => {
          const validated = validateSocketEvent(socketSchemas.submitAnswer)(data);
          if (!validated) return;
          socket.emit('answerRecorded', { selected: validated.selected });
        });

        socket.on('leaveRoom', (data) => {
          const validated = validateSocketEvent(socketSchemas.leaveRoom)(data);
          if (!validated) return;
          socket.leave(validated.roomCode);
          socket.emit('leftRoom', { roomCode: validated.roomCode });
        });

        socket.on('sendInvite', (data) => {
          const validated = validateSocketEvent(socketSchemas.sendInvite)(data);
          if (!validated) return;
          socket.emit('inviteSent', { username: validated.toUsername });
        });

        socket.on('respondInvite', (data) => {
          const validated = validateSocketEvent(socketSchemas.respondInvite)(data);
          if (!validated) return;
          socket.emit('inviteResponse', { accepted: validated.accepted });
        });
      });

      await new Promise((resolve) => {
        httpServer.listen(0, () => {
          port = httpServer.address().port;
          resolve();
        });
      });
    });

    afterAll(() => {
      io.close();
      httpServer.close();
    });

    beforeEach(() => {
      clientSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
    });

    afterEach(() => {
      if (clientSocket.connected) clientSocket.disconnect();
    });

    it('should connect successfully', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      expect(clientSocket.connected).toBe(true);
    });

    it('should validate createRoom and emit lobbyUpdate', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const lobbyPromise = waitForEvent(clientSocket, 'lobbyUpdate');
      clientSocket.emit('createRoom', { username: 'player1', quizId: 1 });
      const data = await lobbyPromise;
      expect(data.roomCode).toBe('TEST01');
      expect(data.host).toBe('player1');
    });

    it('should reject createRoom with invalid data', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const emitted = new Promise((resolve) => {
        const handler = () => resolve(true);
        clientSocket.once('lobbyUpdate', handler);
        setTimeout(() => {
          clientSocket.off('lobbyUpdate', handler);
          resolve(false);
        }, 500);
      });
      clientSocket.emit('createRoom', { username: '', quizId: -1 });
      expect(await emitted).toBe(false);
    });

    it('should validate joinRoom and emit lobbyUpdate', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const lobbyPromise = waitForEvent(clientSocket, 'lobbyUpdate');
      clientSocket.emit('joinRoom', { roomCode: 'TEST01', username: 'player2' });
      const data = await lobbyPromise;
      expect(data.roomCode).toBe('TEST01');
      expect(data.players[0].username).toBe('player2');
    });

    it('should reject joinRoom with invalid roomCode format', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const emitted = new Promise((resolve) => {
        clientSocket.once('lobbyUpdate', () => resolve(true));
        setTimeout(() => resolve(false), 500);
      });
      clientSocket.emit('joinRoom', { roomCode: 'abc', username: 'player2' });
      expect(await emitted).toBe(false);
    });

    it('should validate lobbyChat and broadcast message', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      // First join a room
      const joinPromise = waitForEvent(clientSocket, 'lobbyUpdate');
      clientSocket.emit('joinRoom', { roomCode: 'CHAT01', username: 'chatter' });
      await joinPromise;

      const chatPromise = waitForEvent(clientSocket, 'lobbyChat');
      clientSocket.emit('lobbyChat', { roomCode: 'CHAT01', username: 'chatter', message: 'Hello world' });
      const data = await chatPromise;
      expect(data.message).toBe('Hello world');
      expect(data.username).toBe('chatter');
    });

    it('should reject lobbyChat with empty message', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const emitted = new Promise((resolve) => {
        clientSocket.once('lobbyChat', () => resolve(true));
        setTimeout(() => resolve(false), 500);
      });
      clientSocket.emit('lobbyChat', { roomCode: 'CHAT02', username: 'chatter', message: '' });
      expect(await emitted).toBe(false);
    });

    it('should reject lobbyChat with message > 500 chars', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const emitted = new Promise((resolve) => {
        clientSocket.once('lobbyChat', () => resolve(true));
        setTimeout(() => resolve(false), 500);
      });
      clientSocket.emit('lobbyChat', { roomCode: 'CHAT03', username: 'chatter', message: 'x'.repeat(501) });
      expect(await emitted).toBe(false);
    });

    it('should validate submitAnswer and emit answerRecorded', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const answerPromise = waitForEvent(clientSocket, 'answerRecorded');
      clientSocket.emit('submitAnswer', { selected: 'A', roomCode: 'TEST01' });
      const data = await answerPromise;
      expect(data.selected).toBe('A');
    });

    it('should reject submitAnswer with empty selected', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const emitted = new Promise((resolve) => {
        clientSocket.once('answerRecorded', () => resolve(true));
        setTimeout(() => resolve(false), 500);
      });
      clientSocket.emit('submitAnswer', { selected: '', roomCode: 'TEST01' });
      expect(await emitted).toBe(false);
    });

    it('should validate leaveRoom and emit leftRoom', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const leftPromise = waitForEvent(clientSocket, 'leftRoom');
      clientSocket.emit('leaveRoom', { roomCode: 'TEST01' });
      const data = await leftPromise;
      expect(data.roomCode).toBe('TEST01');
    });

    it('should reject leaveRoom with invalid roomCode', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const emitted = new Promise((resolve) => {
        clientSocket.once('leftRoom', () => resolve(true));
        setTimeout(() => resolve(false), 500);
      });
      clientSocket.emit('leaveRoom', { roomCode: 'abc' });
      expect(await emitted).toBe(false);
    });

    it('should validate sendInvite and emit inviteSent', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const invitePromise = waitForEvent(clientSocket, 'inviteSent');
      clientSocket.emit('sendInvite', { toUsername: 'friend1' });
      const data = await invitePromise;
      expect(data.username).toBe('friend1');
    });

    it('should reject sendInvite with invalid username', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const emitted = new Promise((resolve) => {
        clientSocket.once('inviteSent', () => resolve(true));
        setTimeout(() => resolve(false), 500);
      });
      clientSocket.emit('sendInvite', { toUsername: 'a' });
      expect(await emitted).toBe(false);
    });

    it('should validate respondInvite and emit inviteResponse', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const responsePromise = waitForEvent(clientSocket, 'inviteResponse');
      clientSocket.emit('respondInvite', { toSocketId: 'socket123', accepted: true });
      const data = await responsePromise;
      expect(data.accepted).toBe(true);
    });

    it('should reject respondInvite with non-boolean accepted', async () => {
      await new Promise((resolve) => clientSocket.on('connect', resolve));
      const emitted = new Promise((resolve) => {
        clientSocket.once('inviteResponse', () => resolve(true));
        setTimeout(() => resolve(false), 500);
      });
      clientSocket.emit('respondInvite', { toSocketId: 'socket123', accepted: 'yes' });
      expect(await emitted).toBe(false);
    });
  });

  describe('Socket.IO authentication', () => {
    let httpServer, io, port;

    beforeAll(async () => {
      const server = createTestServer();
      httpServer = server.httpServer;
      io = server.io;

      io.use((socket, next) => {
        try {
          const token = socket.handshake.auth?.token;
          if (token) {
            socket.user = jwt.verify(token, JWT_SECRET);
          }
        } catch {}
        next();
      });

      io.on('connection', (socket) => {
        socket.emit('welcome', { user: socket.user || null });
      });

      await new Promise((resolve) => {
        httpServer.listen(0, () => {
          port = httpServer.address().port;
          resolve();
        });
      });
    });

    afterAll(() => {
      io.close();
      httpServer.close();
    });

    it('should pass user info when valid token provided', async () => {
      const token = generateToken({ id: 1, username: 'authuser', role: 'user' });
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token }
      });

      const welcome = await waitForEvent(client, 'welcome');
      expect(welcome.user).toBeTruthy();
      expect(welcome.user.username).toBe('authuser');
      client.disconnect();
    });

    it('should pass null user when no token provided', async () => {
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket']
      });

      const welcome = await waitForEvent(client, 'welcome');
      expect(welcome.user).toBeNull();
      client.disconnect();
    });

    it('should pass null user when invalid token provided', async () => {
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: 'invalid-token' }
      });

      const welcome = await waitForEvent(client, 'welcome');
      expect(welcome.user).toBeNull();
      client.disconnect();
    });
  });

  describe('Socket.IO room limits', () => {
    let httpServer, io, port;

    beforeAll(async () => {
      const server = createTestServer();
      httpServer = server.httpServer;
      io = server.io;

      const rooms = new Map();
      const MAX_ROOM_SIZE = 10;

      io.on('connection', (socket) => {
        socket.on('joinRoom', (data) => {
          const validated = validateSocketEvent(socketSchemas.joinRoom)(data);
          if (!validated) return;

          let roomPlayers = rooms.get(validated.roomCode) || [];
          if (roomPlayers.length >= MAX_ROOM_SIZE) {
            socket.emit('roomError', 'Room is full');
            return;
          }
          roomPlayers.push(socket.id);
          rooms.set(validated.roomCode, roomPlayers);
          socket.join(validated.roomCode);
          socket.emit('lobbyUpdate', { roomCode: validated.roomCode, players: roomPlayers });
        });
      });

      await new Promise((resolve) => {
        httpServer.listen(0, () => {
          port = httpServer.address().port;
          resolve();
        });
      });
    });

    afterAll(() => {
      io.close();
      httpServer.close();
    });

    it('should reject join when room is full', async () => {
      const roomCode = 'FULL01';
      const clients = [];

      // Fill the room with 10 clients
      for (let i = 0; i < 10; i++) {
        const client = Client(`http://localhost:${port}`, {
          transports: ['websocket'],
          forceNew: true
        });
        clients.push(client);
        await new Promise((resolve) => client.on('connect', resolve));

        const lobbyPromise = waitForEvent(client, 'lobbyUpdate');
        client.emit('joinRoom', { roomCode, username: `user${i}` });
        await lobbyPromise;
      }

      // 11th client should be rejected
      const overflowClient = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      clients.push(overflowClient);
      await new Promise((resolve) => overflowClient.on('connect', resolve));

      const errorPromise = waitForEvent(overflowClient, 'roomError');
      overflowClient.emit('joinRoom', { roomCode, username: 'overflow' });
      const error = await errorPromise;
      expect(error).toBe('Room is full');

      clients.forEach(c => c.disconnect());
    });
  });
});
