import argon2 from 'argon2';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export const passwordHasher: PasswordHasher = {
  hash(password) {
    return argon2.hash(password, { type: argon2.argon2id });
  },
  verify(hash, password) {
    return argon2.verify(hash, password);
  }
};
