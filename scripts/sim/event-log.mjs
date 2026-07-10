import {
  openSync,
  writeSync,
  closeSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';

const fileOf = (dir) => join(dir, 'events.jsonl');

// seq is derived from current line count so it survives process restarts and
// stays correct under concurrent single-process appends (O_APPEND is atomic
// for writes under PIPE_BUF; one JSON line is well under that).
export function appendEvent(dir, event) {
  mkdirSync(dir, { recursive: true });
  const path = fileOf(dir);
  const seq = existsSync(path) ? countLines(readFileSync(path, 'utf8')) : 0;
  const record = { seq, ...event };
  const fd = openSync(path, 'a');
  try {
    writeSync(fd, JSON.stringify(record) + '\n');
  } finally {
    closeSync(fd);
  }
  return record;
}

export function readEvents(dir) {
  const path = fileOf(dir);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l));
}

function countLines(text) {
  return text.split('\n').filter((l) => l.trim() !== '').length;
}
