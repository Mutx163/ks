/**
 * API 基址（唯一来源）
 *
 * 规则：
 * 1. 优先读取构建环境变量 `VITE_API_BASE`（`.env.development` 指向本地 wrangler dev）。
 * 2. 未配置、空串或只有空白时，**一律回落到生产域名**——环境变量填错也不能把线上 API 指到别处。
 * 3. 这里不引入任何依赖，api.js 与 logCollector.js 都从这里取，避免各自留一份写死的地址。
 */

const DEFAULT_API_BASE = 'https://ks-api.mutx.ccwu.cc';

const envBase =
    typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_BASE : '';

export const API_BASE = (envBase && String(envBase).trim()) || DEFAULT_API_BASE;

/**
 * 是否为开发构建。
 * 用编译期常量判断，而不是运行时嗅探 location.hostname：
 * 生产包在本地跑时本来就该按生产行为走，不该因为主机名又开调试日志。
 */
export const IS_DEV =
    typeof import.meta !== 'undefined' && import.meta.env ? !!import.meta.env.DEV : false;

export default API_BASE;
