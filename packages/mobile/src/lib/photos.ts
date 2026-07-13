type ChecklistPhotoUploadResponse = {
  uploadUrl?: string;
  upload_url?: string;
  publicUrl?: string;
  public_url?: string;
};

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  return text || `Request failed with ${response.status}`;
}

export async function uploadChecklistPhoto(token: string, jobId: string, file: File): Promise<string> {
  if (!navigator.onLine) throw new Error('Photo upload requires a network connection.');

  const contentType = file.type || 'application/octet-stream';
  const mintResponse = await fetch('/api/uploads/checklist-photo', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      job_id: jobId,
      content_type: contentType
    })
  });

  if (!mintResponse.ok) throw new Error(await readError(mintResponse));

  const payload = (await mintResponse.json()) as ChecklistPhotoUploadResponse;
  const uploadUrl = payload.uploadUrl ?? payload.upload_url;
  const publicUrl = payload.publicUrl ?? payload.public_url;

  if (!uploadUrl || !publicUrl) {
    throw new Error('Upload URL response was missing required photo URLs.');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': contentType
    },
    body: file
  });

  if (!uploadResponse.ok) throw new Error(await readError(uploadResponse));

  return publicUrl;
}
