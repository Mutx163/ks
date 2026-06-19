/**
 * KaTeX 打包入口
 */
import katex from 'katex';

// 导入 CSS
import 'katex/dist/katex.min.css';

// 暴露到全局（兼容现有代码）
window.katex = katex;

export default katex;
