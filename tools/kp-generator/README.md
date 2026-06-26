# kp-generator —— 人教版小学知识点图谱 生成 + 校验工具（REQ-007）

用 **Kimi 大模型**生成「人教版小学」语文/数学/英语各年级知识点图谱（含层级 `parentId` 与前置 `prerequisites`），并带**结构校验**。
**在电脑上运行，不属于小程序、不会打包进小程序**（`project.config.json` 的 `packOptions.ignore` 已排除 `tools/`）。

> 按需求方答复：先用工具生成知识点 +「有校验的方法」，**校验通过后再上云**；掌握度按正确率，**正确率 ≥ 90% 才算掌握**（写入 `meta.masteryThreshold = 0.9`）。

## 用法

```bash
cd tools/kp-generator

# 设置 Kimi Key（与小程序 aiVision 同一个；仅 generate 需要）
export KIMI_API_KEY=你的KimiKey          # Windows PowerShell: $env:KIMI_API_KEY="你的KimiKey"

# 生成（不带 --subject 则三科都生成；逐(学科,年级)调用 Kimi，最后自动校验）
node index.js generate --subject 数学 --grades 1-6 --out math.kp.json
node index.js generate --out all.kp.json        # 三科 1-6 年级

# 单独校验已生成文件（通过 exit 0，否则 exit 2）
node index.js validate math.kp.json
```

## 数据结构

```json
{
  "meta": { "curriculum": "人教版", "stage": "小学", "masteryThreshold": 0.9,
            "subjects": ["数学"], "grades": [1] },
  "points": [
    { "id": "math-g1-num10", "subject": "数学", "grade": 1, "name": "10以内数的认识",
      "category": "数与代数", "parentId": null, "prerequisites": [] },
    { "id": "math-g1-add10", "subject": "数学", "grade": 1, "name": "10以内的加法",
      "category": "数与代数", "parentId": "math-g1-num10", "prerequisites": ["math-g1-num10"] }
  ]
}
```

`sample.kp.json` 是一份可通过校验的最小示例，可作为字段参考。

## 校验规则（即「校验的方法」）

通过 = 无 error。error 阻断上云，warning 仅提示：

- **error**：`points` 为空 / `id` 缺失或重复 / `name` 缺失 / `subject` 不在 语文·数学·英语 / `grade` 不是 1-6 整数 / `parentId` 指向不存在的知识点 / `parentId` 链成环 / `prerequisites` 不是数组、含自身、或指向不存在的知识点。
- **warning**：`meta.masteryThreshold` 缺失或 ≠ 0.9（与需求口径不符）；某(学科,年级)未覆盖或知识点偏少（默认 < 5）。覆盖度只检查 `meta.subjects`/`meta.grades` 声明的范围。

校验逻辑在 `validate.js`，已用 `sample.kp.json`（通过）与含错样例（捕获重复id/缺name/非法年级/悬空parent/自前置）做过自测。

## 掌握度口径（REQ-007 第2点）

- **掌握 = 该知识点相关题目正确率 ≥ 90%**（`meta.masteryThreshold = 0.9`）。
- 本工具只产出「知识点图谱」与该口径常量；**实际掌握度计算/上云**（按孩子答题正确率聚合到知识点）是后续单独步骤，集合与云函数另行实现。

## 限制与说明（如实）

- 需要 **Node 18+**（用到内置 `fetch`）。
- `generate` 依赖 Kimi Key，**尚未实测**（本机无 Key）。请你用真实 Key 跑一次；若 Kimi 文本接口字段/响应与此处不符，告诉我来修。
- `validate` 已本机自测可用（通过/不通过两种情况）。
- 生成的图谱默认**落地本地 JSON**。**校验通过后**再由你导入 CloudBase（集合名/字段映射、掌握度计算上云待定）。
