import { CONFIG } from './config';
import { decrypt } from './utils';

const TARGET_URL = decrypt(CONFIG.urls.target);

export const decrypt = (str) => atob(str);
export const encrypt = (str) => btoa(str);