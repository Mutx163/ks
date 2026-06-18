/**
 * Lucide 打包入口
 * 只导入项目实际使用的图标，减少体积
 */
import { createIcons } from 'lucide';

// 只导入使用的图标
import {
    AlertCircle,
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    ClipboardList,
    Clock,
    FileText,
    Frown,
    Home,
    Keyboard,
    PartyPopper,
    RefreshCw,
    RotateCcw,
    Save,
    Search,
    Settings,
    Smartphone,
    Star,
    SunMoon,
    Trophy,
    WifiOff
} from 'lucide';

const icons = {
    AlertCircle,
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    ClipboardList,
    Clock,
    FileText,
    Frown,
    Home,
    Keyboard,
    PartyPopper,
    RefreshCw,
    RotateCcw,
    Save,
    Search,
    Settings,
    Smartphone,
    Star,
    SunMoon,
    Trophy,
    WifiOff
};

// 暴露到全局（兼容现有代码）
window.lucide = {
    createIcons: () => createIcons({ icons })
};

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        createIcons({ icons });
    });
} else {
    createIcons({ icons });
}

export { createIcons, icons };
