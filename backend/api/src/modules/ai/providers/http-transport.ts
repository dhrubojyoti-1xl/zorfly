export interface HttpTransport {
  fetch(url: string, init: RequestInit): Promise<Response>;
}

export const globalFetchTransport: HttpTransport = {
  fetch: (url, init) => globalThis.fetch(url, init)
};
