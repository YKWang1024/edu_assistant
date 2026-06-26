# pdf2questions —— 本地题库整理工具（REQ-001 的 PDF 部分）

把 PDF 试卷/题集用 **Kimi 大模型**整理成结构化题目 JSON（含难度/类别/知识点）。
**在电脑上运行，不属于小程序、不会打包进小程序**（已在 `project.config.json` 的 `packOptions.ignore` 排除 `tools/`）。

## 用法

```bash
cd tools/pdf2questions
npm install                       # 首次，装 pdf-parse

# 设置 Kimi Key（与小程序 aiVision 同一个）
export KIMI_API_KEY=你的KimiKey     # Windows PowerShell: $env:KIMI_API_KEY="你的KimiKey"

node index.js 试卷.pdf --subject 数学 --out 数学题库.json
```

输出 `数学题库.json`，数组里每题：

```json
{
  "subject": "数学",
  "type": "choice",
  "stem": "题干……",
  "options": [{ "key": "A", "text": "…" }],
  "answer": "B",
  "difficulty": 3,
  "category": "一元二次方程",
  "knowledgePoints": ["因式分解", "求根公式"]
}
```

## 可选环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `KIMI_API_KEY` / `AI_VISION_API_KEY` | （必填） | Kimi Key |
| `KIMI_BASE_URL` | `https://api.kimi.com/coding` | 实际请求 `/v1/messages`（Anthropic 兼容） |
| `KIMI_MODEL` | `kimi-2.6` | 模型名 |

## 限制与说明（如实）

- 需要 **Node 18+**（用到内置 `fetch`）。
- 仅处理**文本型 PDF**（能提取文字）。**扫描件**需要 OCR/视觉模型，本版**未做**。
- ⚠️ **本工具尚未实测**：我没有 Kimi Key 和样例 PDF，无法在本机验证。请你用真实 Key + 一份 PDF 跑一次确认；若 Kimi 文本接口的字段/响应与此处不符，告诉我，我来修。
- 生成的题默认**落地本地 JSON 文件**。若要把它导入小程序题库（CloudBase 集合）供 App 使用，是**单独一步**，集合名/字段映射待你定。
