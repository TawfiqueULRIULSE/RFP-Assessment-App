import type { Evidence } from '../types/domain';
import { API_BASE_URL, apiRequest, buildAuthHeaders } from './api';

interface EvidenceResponse {
  evidence: Evidence[];
}

interface CreateEvidenceResponse {
  evidence: Evidence;
}

export const fetchEvidence = async (rfpId: string): Promise<Evidence[]> => {
  const response = await apiRequest<EvidenceResponse>(`/evidence?rfpId=${encodeURIComponent(rfpId)}`);
  return response.evidence;
};

export const createEvidence = async (input: {
  rfpId: string;
  vendorId: string;
  criterionId: string;
  title: string;
  url: string;
  addedBy: string;
}): Promise<Evidence> => {
  const response = await apiRequest<CreateEvidenceResponse>('/evidence', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return response.evidence;
};

export const uploadEvidenceFile = (
  evidenceId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Evidence> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    const headers = buildAuthHeaders();

    xhr.open('POST', `${API_BASE_URL}/evidence/${encodeURIComponent(evidenceId)}/upload`);

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText) as CreateEvidenceResponse;
          resolve(parsed.evidence);
        } catch {
          reject(new Error('Invalid response from upload endpoint.'));
        }
      } else {
        try {
          const parsed = JSON.parse(xhr.responseText) as { message?: string };
          reject(new Error(parsed.message ?? `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during file upload.')));
    xhr.send(formData);
  });
};

export const deleteEvidence = async (evidenceId: string): Promise<void> => {
  await apiRequest<void>(`/evidence/${encodeURIComponent(evidenceId)}`, {
    method: 'DELETE',
  });
};

export const evidenceDownloadUrl = (evidenceId: string): string =>
  `${API_BASE_URL}/evidence/${encodeURIComponent(evidenceId)}/download`;
