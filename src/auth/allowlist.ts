export const ADMIN_EMAILS = [
    'jiayimeng12@gmail.com',
    'aadityasahu26@gmail.com',
    'zile.zhao@gmail.com',
] as const;

export const VIEWER_EMAILS = [
    'mindqueblast@gmail.com',
    'altjiayi@gmail.com',
    'chuang11791@gmail.com',
    'forensicsclubforschool@gmail.com',
    'huangdenny65@gmail.com',
    'vihaan.bhatnagar04@gmail.com',
] as const;

export type UserRole = 'admin' | 'viewer';

export function roleForEmail(email: string | null | undefined): UserRole | null {
    if (!email) return null;
    const lower = email.toLowerCase();
    if ((ADMIN_EMAILS as readonly string[]).includes(lower)) return 'admin';
    if ((VIEWER_EMAILS as readonly string[]).includes(lower)) return 'viewer';
    return null;
}
