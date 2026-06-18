/**
 * Marked 打包入口
 */
import { marked } from 'marked';

// 暴露到全局（兼容现有代码）
window.marked = marked;

export default marked;
