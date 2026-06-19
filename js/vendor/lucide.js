/**
 * Lucide 打包入口
 * 只导入项目实际使用的图标，减少体积并避免运行时连接外部 CDN
 */
import { createIcons } from 'lucide';

// 只导入项目使用到的图标
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    Brain,
    Check,
    CheckCircle,
    CheckCircle2,
    CheckSquare,
    ClipboardList,
    Clock,
    Cpu,
    Download,
    FileText,
    Frown,
    Home,
    KeyRound,
    Keyboard,
    Layers,
    Lightbulb,
    List,
    Monitor,
    Moon,
    Palette,
    PartyPopper,
    RefreshCw,
    Repeat,
    RotateCcw,
    Save,
    Search,
    Settings,
    ShieldOff,
    Shuffle,
    Smartphone,
    Sparkles,
    Star,
    Sun,
    SunMoon,
    Target,
    Trash2,
    Trophy,
    User,
    UserPlus,
    Users,
    WifiOff,
    X,
    XCircle
} from 'lucide';

const icons = {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    Brain,
    Check,
    CheckCircle,
    CheckCircle2,
    CheckSquare,
    ClipboardList,
    Clock,
    Cpu,
    Download,
    FileText,
    Frown,
    Home,
    KeyRound,
    Keyboard,
    Layers,
    Lightbulb,
    List,
    Monitor,
    Moon,
    Palette,
    PartyPopper,
    RefreshCw,
    Repeat,
    RotateCcw,
    Save,
    Search,
    Settings,
    ShieldOff,
    Shuffle,
    Smartphone,
    Sparkles,
    Star,
    Sun,
    SunMoon,
    Target,
    Trash2,
    Trophy,
    User,
    UserPlus,
    Users,
    WifiOff,
    X,
    XCircle
};

function createProjectIcons() {
    createIcons({ icons });
}

// 暴露到全局（兼容现有代码）
window.lucide = {
    createIcons: createProjectIcons
};

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createProjectIcons);
} else {
    createProjectIcons();
}

export { createIcons, icons, createProjectIcons };
