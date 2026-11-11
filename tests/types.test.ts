import { describe, expect, it } from 'vitest';
import { MAX_BYTES, validVideo } from '../lib/types';
describe('video validation',()=>{it('accepts supported videos',()=>{expect(validVideo('Meeting.MP4',123)).toBe(true);expect(validVideo('meeting.webm',123)).toBe(true)});it('rejects empty, unsupported, and oversized files',()=>{expect(validVideo('meeting.mov',2)).toBe(false);expect(validVideo('meeting.mp4',0)).toBe(false);expect(validVideo('meeting.mp4',MAX_BYTES+1)).toBe(false)})});
