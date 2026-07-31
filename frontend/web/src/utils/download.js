import { api } from '../api/client.js';

// Download an authenticated endpoint (CSV/XLSX/PDF blob) as a file.
export async function downloadFile(endpoint, filename, params = {}) {
  const response = await api.get(endpoint, { params, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadCsv(endpoint, filename) {
  return downloadFile(endpoint, filename);
}
