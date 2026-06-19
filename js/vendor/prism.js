/**
 * Prism.js 打包入口
 * 只导入项目实际使用的语言，减少体积
 */
import Prism from 'prismjs';

// 导入需要的语言
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';

// 导入主题 CSS
import 'prismjs/themes/prism-tomorrow.css';

// 暴露到全局（兼容现有代码）
window.Prism = Prism;

export default Prism;
