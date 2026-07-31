/**
 * Resolves an opaque `TenantAIProviderConfiguration.secretReference` to the
 * actual provider API key. PostgreSQL never stores the raw key — only a
 * reference a resolver knows how to look up.
 */
export interface SecretResolver {
  resolve(secretReference: string): Promise<string>;
}

/** Production default: `secretReference` is the name of an environment variable. */
export class EnvSecretResolver implements SecretResolver {
  public resolve(secretReference: string): Promise<string> {
    const value = process.env[secretReference];
    if (!value) {
      throw new Error(`Secret reference "${secretReference}" is not configured.`);
    }
    return Promise.resolve(value);
  }
}

/** Test/dev double: an in-memory map from reference name to secret value. */
export class InMemorySecretResolver implements SecretResolver {
  private readonly secrets: Map<string, string>;

  public constructor(secrets: Readonly<Record<string, string>> = {}) {
    this.secrets = new Map(Object.entries(secrets));
  }

  public set(secretReference: string, value: string): void {
    this.secrets.set(secretReference, value);
  }

  public resolve(secretReference: string): Promise<string> {
    const value = this.secrets.get(secretReference);
    if (!value) {
      throw new Error(`Secret reference "${secretReference}" is not configured.`);
    }
    return Promise.resolve(value);
  }
}
