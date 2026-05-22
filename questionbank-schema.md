# 题库导入格式规范 v1.0

## 基本结构

```json
{
  "id": "unique-bank-id",
  "name": "题库名称",
  "description": "题库描述",
  "version": "1.0.0",
  "author": "作者",
  "categories": ["分类1", "分类2"],
  "tags": ["标签1", "标签2"],
  "questions": [...]
}
```

## 题目类型

| type | 说明 | answer 格式 |
|------|------|-------------|
| `single` | 单选题 | `"A"` 或 `"B"` 等 |
| `multiple` | 多选题 | `["A", "C", "D"]` |
| `judge` | 判断题 | `true` 或 `false` |
| `fill` | 填空题 | `["答案1", "答案2"]` |
| `code` | 编程题 | `"参考代码"` |
| `essay` | 简答题 | `"参考答案"` |

## 题目结构

```json
{
  "id": 1,
  "type": "single",
  "category": "静力学",
  "tags": ["刚体", "基本概念"],
  "difficulty": 1,
  "question": "题目内容（支持数学公式和代码）",
  "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
  "answer": "A",
  "explanation": "解析说明",
  "code": "可选的代码块",
  "codeLanguage": "c",
  "memoryAid": "可选记忆提示",
  "img": "可选题目图片地址"
}
```

## 趋势与分析页面适配

趋势与分析页面不需要题库额外提供统计字段，统计数据来自用户答题进度。为了保证分析结果准确：

- `id` 必须唯一且后续版本保持稳定，否则旧进度无法匹配题目。
- `type` 会用于“题型掌握”统计，建议只使用表格中的标准英文值。
- `category` 会用于“薄弱知识点”和“题库分析”，建议每题填写且命名保持一致。
- `difficulty`、`tags`、`memoryAid`、`img` 是可选增强字段，不影响导入。

## 数学公式语法

使用 LaTeX 语法，用 `$` 包裹：

- 行内公式：`$F = ma$`
- 块级公式：`$$\sum F = 0$$`
- 希腊字母：`$\alpha$`, `$\beta$`, `$\sigma$`
- 上下标：`$x^2$`, `$F_{max}$`
- 分数：`$\frac{F}{A}$`
- 根号：`$\sqrt{x^2 + y^2}$`
- 积分：`$\int_0^L F dx$`

## 代码块语法

使用三个反引号包裹，指定语言：

````
```c
#include <stdio.h>
int main() {
    printf("Hello");
    return 0;
}
```
````

支持语言：`c`, `cpp`, `java`, `python`, `javascript`, `html`, `css`

## 完整示例

```json
{
  "id": "c-language-basics",
  "name": "C语言基础",
  "description": "C语言程序设计基础题库",
  "version": "1.0.0",
  "author": "MiMo",
  "categories": ["基础语法", "指针", "数组", "函数"],
  "tags": ["C语言", "编程"],
  "questions": [
    {
      "id": 1,
      "type": "single",
      "category": "基础语法",
      "tags": ["数据类型", "变量"],
      "difficulty": 1,
      "question": "以下哪个是C语言的合法变量名？",
      "options": ["A. `123abc`", "B. `_name`", "C. `int`", "D. `a-b`"],
      "answer": "B",
      "explanation": "变量名规则：\n1. 不能以数字开头\n2. 不能是关键字\n3. 只能包含字母、数字、下划线",
      "code": "",
      "codeLanguage": ""
    },
    {
      "id": 2,
      "type": "code",
      "category": "基础语法",
      "tags": ["输入输出"],
      "difficulty": 2,
      "question": "编写程序，输入两个整数，输出它们的和。",
      "options": [],
      "answer": "#include <stdio.h>\nint main() {\n    int a, b;\n    scanf(\"%d %d\", &a, &b);\n    printf(\"%d\", a + b);\n    return 0;\n}",
      "explanation": "使用 `scanf` 读取输入，`printf` 输出结果。",
      "code": "",
      "codeLanguage": "c"
    },
    {
      "id": 3,
      "type": "judge",
      "category": "基础语法",
      "tags": ["数据类型"],
      "difficulty": 1,
      "question": "`int` 类型在所有系统上都占 4 字节。",
      "options": [],
      "answer": false,
      "explanation": "`int` 的大小取决于系统架构，标准只规定 `sizeof(int) >= sizeof(short)`。",
      "code": "",
      "codeLanguage": ""
    }
  ]
}
```
