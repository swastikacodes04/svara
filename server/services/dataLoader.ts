import fs from 'node:fs/promises';
import path from 'node:path';
import type { PakadReference, RagaProfile } from '../../src/types/svara.ts';

let cachedRagas: RagaProfile[] | null = null;
let cachedPakads: PakadReference[] | null = null;

export async function loadRagas(): Promise<RagaProfile[]> {
  if (cachedRagas) return cachedRagas;
  const filePath = path.resolve(process.cwd(), 'server', 'data', 'ragas.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  cachedRagas = JSON.parse(raw) as RagaProfile[];
  return cachedRagas;
}

export async function loadPakadReferences(): Promise<PakadReference[]> {
  if (cachedPakads) return cachedPakads;
  const filePath = path.resolve(process.cwd(), 'server', 'data', 'pakad_references.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  cachedPakads = JSON.parse(raw) as PakadReference[];
  return cachedPakads;
}
