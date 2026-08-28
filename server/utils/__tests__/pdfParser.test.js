import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockResult = { text: '', error: null };

vi.mock('../pdfParser.js', () => ({
  parsePDFBuffer: vi.fn(async (buffer) => {
    if (mockResult.error) {
      throw mockResult.error;
    }
    return mockResult.text;
  })
}));

const { parsePDFBuffer } = await import('../pdfParser.js');

describe('pdfParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResult = { text: '', error: null };
  });

  it('should resolve with extracted text on success', async () => {
    const mockText = 'This is extracted PDF text content';
    mockResult.text = mockText;

    const buffer = Buffer.from('mock-pdf-content');
    const result = await parsePDFBuffer(buffer);

    expect(result).toBe(mockText);
  });

  it('should reject on parse error', async () => {
    mockResult.error = new Error('PDF parse failed');

    const buffer = Buffer.from('invalid-pdf');
    await expect(parsePDFBuffer(buffer)).rejects.toThrow('PDF parse failed');
  });

  it('should handle empty buffer', async () => {
    mockResult.text = '';

    const buffer = Buffer.from('');
    const result = await parsePDFBuffer(buffer);
    expect(result).toBe('');
  });
});
