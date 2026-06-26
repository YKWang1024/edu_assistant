#!/usr/bin/env node
/*
 * kp-generator —— 人教版小学知识点图谱 生成 + 校验工具（对应 Lark 需求 REQ-007）
 *
 * 需求方答复：
 *  1) 知识点覆盖人教版小学教材；先用「工具」生成这些知识点，并「有校验的方法」，
 *     通过之后再传上云。不写进小程序。
 *  2) 掌握度按正确率：正确率≥90% 才算掌握（写入 meta.masteryThreshold=0.9）。
 *
 * 在电脑上运行，不属于小程序、不会打包进小程序（project.config.json 已排除 tools/）。
 *
 * 用法：
 *   生成：node index.js generate [--subject 数学] [--grades 1-6] [--out math.kp.json]
 *         (不带 --subject 则三科都生成；用 Kimi 大模型逐(学科,年级)生成，最后自动校验)
 *   校验：node index.js validate <文件.json>      (校验已生成文件；通过 exit 0，否则非 0)
 *
 * 环境变量：
 *   KIMI_API_KEY（或 AI_VISION_API_KEY） 必填(仅 generate 需要)
 *   KIMI_BASE_URL  默认 https://api.kimi.com/coding （实际请求 /v1/messages，Anthropic 兼容）
 *   KIMI_MODEL     默认 kimi-2.6
 * 需要 Node 18+（用到内置 fetch）。
 */
const fs = require('fs')
const path = require('path')
const { validateKnowledge, SUBJECTS } = require('./validate')

const API_KEY = process.env.KIMI_API_KEY || process.env.AI_VISION_API_KEY || ''
const BASE_URL = (process.env.KIMI_BASE_URL || 'https://api.kimi.com/coding').replace(/\/+$/, '')
const MODEL = process.env.KIMI_MODEL || 'kimi-2.6'
const ENDPOINT = BASE_URL + '/v1/messages'
const MASTERY_THRESHOLD = 0.9 // 需求口径：正确率≥90% 算掌握

function parseArgs(argv) {
  const a = { _: [] }
  for (let i = 3; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--subject') a.subject = argv[++i]
    else if (t === '--grades') a.grades = argv[++i]
    else if (t === '--out') a.out = argv[++i]
    else a._.push(t)
  }
  return a
}

function parseGrades(spec) {
  if (!spec) return [1, 2, 3, 4, 5, 6]
  const m = String(spec).match(/^(\d)\s*-\s*(\d)$/)
  if (m) {
    const out = []
    for (let g = Number(m[1]); g <= Number(m[2]); g++) out.push(g)
    return out
  }
  return String(spec).split(',').map(function (s) { return parseInt(s, 10) }).filter(function (n) { return n >= 1 && n <= 6 })
}

function buildPrompt(subject, grade) {
  return [
    '你是小学课程知识点整理专家。请基于「人教版」教材，列出小学 ' + subject + ' ' + grade + ' 年级的核心知识点。',
    '输出 JSON 数组，每个知识点字段：',
    '{ "id": 全局唯一英文短id(如 "math-g' + grade + '-add10"), "subject": "' + subject + '", "grade": ' + grade + ', "name": 知识点名称(中文), "category": 所属模块/单元, "parentId": 上级知识点id(顶层填 null), "prerequisites": 前置知识点id数组(没有则[]) }',
    '要求：覆盖该年级该学科主要单元；体现层级(用 parentId)与前置关系(prerequisites)；id 必须全局唯一、稳定、用英文与数字。',
    '只输出一个 JSON 数组，不要任何多余文字、解释或代码块。'
  ].join('\n')
}

async function callKimi(prompt) {
  if (typeof fetch !== 'function') throw new Error('需要 Node 18+（内置 fetch 不可用）')
  const body = { model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }] }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'Authorization': 'Bearer ' + API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  })
  const data = await res.json().catch(function () { return {} })
  if (!res.ok) throw new Error('Kimi 接口错误 ' + res.status + ': ' + JSON.stringify(data).slice(0, 300))
  return (data.content || []).filter(function (b) { return b.type === 'text' }).map(function (b) { return b.text }).join('')
}

function extractJsonArray(text) {
  if (!text) return []
  let s = String(text).trim().replace(/^```[a-zA-Z]*/, '').replace(/```$/, '').trim()
  const i = s.indexOf('[')
  const j = s.lastIndexOf(']')
  if (i >= 0 && j > i) s = s.slice(i, j + 1)
  try { const arr = JSON.parse(s); return Array.isArray(arr) ? arr : [] } catch (e) { return [] }
}

function printReport(report) {
  console.log('—— 校验报告 ——')
  console.log('知识点总数: ' + report.stats.total)
  if (report.warnings.length) {
    console.log('warning(' + report.warnings.length + '):')
    report.warnings.forEach(function (w) { console.log('  · ' + w) })
  }
  if (report.errors.length) {
    console.log('error(' + report.errors.length + '):')
    report.errors.forEach(function (e) { console.log('  ✗ ' + e) })
  }
  console.log(report.ok ? '结果: 通过 ✅（可上云）' : '结果: 不通过 ❌（修复 error 后再上云）')
}

async function cmdGenerate(args) {
  if (!API_KEY) { console.error('未设置 KIMI_API_KEY（或 AI_VISION_API_KEY）'); process.exit(1) }
  const subjects = args.subject ? [args.subject] : SUBJECTS
  const grades = parseGrades(args.grades)
  const points = []
  for (let si = 0; si < subjects.length; si++) {
    for (let gi = 0; gi < grades.length; gi++) {
      const subject = subjects[si], grade = grades[gi]
      process.stdout.write('生成 ' + subject + ' ' + grade + '年级 ... ')
      try {
        const resp = await callKimi(buildPrompt(subject, grade))
        const arr = extractJsonArray(resp)
        arr.forEach(function (p) { points.push(p) })
        console.log(arr.length + ' 个')
      } catch (e) { console.log('失败: ' + e.message) }
    }
  }
  const data = {
    meta: { curriculum: '人教版', stage: '小学', masteryThreshold: MASTERY_THRESHOLD, subjects: subjects, grades: grades },
    points: points
  }
  const out = args.out || 'knowledge.kp.json'
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8')
  console.log('已写出 ' + points.length + ' 个知识点 → ' + out)
  const report = validateKnowledge(data)
  printReport(report)
  if (!report.ok) process.exit(2)
}

function cmdValidate(file) {
  if (!file) { console.error('用法: node index.js validate <文件.json>'); process.exit(1) }
  if (!fs.existsSync(file)) { console.error('找不到文件: ' + file); process.exit(1) }
  let data
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { console.error('JSON 解析失败: ' + e.message); process.exit(1) }
  const report = validateKnowledge(data)
  printReport(report)
  process.exit(report.ok ? 0 : 2)
}

async function main() {
  const cmd = process.argv[2]
  const args = parseArgs(process.argv)
  if (cmd === 'generate') return cmdGenerate(args)
  if (cmd === 'validate') return cmdValidate(args._[0])
  console.error('用法:\n  node index.js generate [--subject 数学] [--grades 1-6] [--out out.json]\n  node index.js validate <文件.json>')
  process.exit(1)
}

main().catch(function (e) { console.error('出错:', e); process.exit(1) })
