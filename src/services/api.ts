import type {
  AnalysisResponse,
  HealthResponse,
  MusicalTradition,
  PakadReference,
  RagaProfile,
} from '../types/svara';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return res.json() as Promise<HealthResponse>;
}

export async function fetchRagas(params?: {
  tradition?: MusicalTradition | 'All';
  search?: string;
}): Promise<{
  traditionScopeNote: string;
  count: number;
  ragas: RagaProfile[];
}> {
  const query = new URLSearchParams();
  if (params?.tradition && params.tradition !== 'All') {
    query.set('tradition', params.tradition);
  }
  if (params?.search?.trim()) {
    query.set('search', params.search.trim());
  }
  const qs = query.toString();
  const res = await fetch(`/api/ragas${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Raga library (${res.status})`);
  }
  return res.json();
}

export async function fetchRagaById(id: string): Promise<{
  raga: RagaProfile;
  curatedPakadReferences: PakadReference[];
}> {
  const res = await fetch(`/api/ragas/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load Raga "${id}"`);
  }
  return res.json();
}

export async function analyzeAudioRecording(
  file: File,
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('audio', file);

  const res = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error || `Analysis failed with HTTP status ${res.status}.`,
    );
  }

  return res.json() as Promise<AnalysisResponse>;
}
