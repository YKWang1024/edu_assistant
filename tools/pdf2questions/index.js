#!/usr/bin/env node
/*
 * pdf2questions —— 本地题库整理工具（对应 Lark 需求 REQ-001 的 PDF 部分）
 * 把 PDF 试卷/题集用 Kimi 大模型整理成结构化题目 JSON（含难度/类别/知识点）。
 * 在电脑上运行，不属于小程序、不会打包进小程序（已在 project.config.json 的 packOptions.ignore 里排除 tools/）。
 *
 * 用法： node index.js <pdf路径> [--out 题目.json] [--subject 数学] [--chunk 6000]
 * 环境变量：
 *   KIMI_API_KEY（或 AI_VISION_API_KEY） 必填，和小程序 aiVision 用的同一个 Kimi Key
 *   KIMI_BASE_URL  默认 https://api.kimi.com/coding （实际请求 /v1/messages，Anthropic 兼容）
 *   KIMI_MODEL     默认 kimi-2.6
 * 需要 Node 18+（用到内置 fetch）。仅处理「文本型 PDF」(能提取文字)；扫描件需 OCR/视觉，本版未做。
 */
const fs = require('fs')
const path = require('path')

let pdfParse
try {
  pdfParse = require('pdf-parse')
} catch (e) {
  console.error('缺少依赖 pdf-parse。请先在本目录执行: npm install')
  process.exit(1)
}

const API_KEY = process.env.KIMI_API_KEY || process.env.AI_VISION_API_KEY || ''
const BASE_URL = (process.env.KIMI_BASE_URL || 'https://api.kimi.com/coding').replace(/\/+$/, '')
const MODEL = process.env.KIMI_MODEL || 'kimi-2.6'
const ENDPOINT = BASE_URL + '/v1/messages'

function parseArgs(argv) {
  const a = { _: [] }
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--out') a.out = argv[++i]
    else if (t === '--subject') a.subject = argv[++i]
    else if (t === '--chunk') a.chunk = parseInt(argv[++i], 10)
    else a._.push(t)
  }
  return a
}

function buildPrompt(text, subjectHint) {
  return [
    '你是题库整理助手。下面是从 PDF 提取的文本（可能包含多道题）。',
    '请提取其中的题目，整理成 JSON 数组，' + (subjectHint ? ('学科默认填「' + subjectHint + '」，') : '') + '每道题字段：',
    '{ "subject": 学科, "type": "choice"|"fill"|"other", "stem": 题干, "options": 选择题选项数组(如 [{"key":"A","text":"..."}]，非选择题为 []), "answer": 答案(可空), "difficulty": 难度(1-5 整数), "category": 题型/类别, "knowledgePoints": 知识点(字符串数组) }',
    '只输出一个 JSON 数组，不要任何多余文字、解释或代码块。若该段没有完整题目则输出 []。',
    '文本：',
    text
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
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    return []
  }
}

function chunkText(text, size) {
  const out = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}

async function main() {
  const args = parseArgs(process.argv)
  const pdf = args._[0]
  if (!pdf) {
    console.error('用法: node index.js <pdf路径> [--out 题目.json] [--subject 数学] [--chunk 6000]')
    process.exit(1)
  }
  if (!API_KEY) {
    console.error('未设置 KIMI_API_KEY（或 AI_VISION_API_KEY）环境变量')
    process.exit(1)
  }
  if (!fs.existsSync(pdf)) {
    console.error('找不到文件: ' + pdf)
    process.exit(1)
  }

  console.log('读取 PDF ...', pdf)
  const buf = fs.readFileSync(pdf)
  const parsed = await pdfParse(buf)
  const text = (parsed.text || '').trim()
  if (!text) {
    console.error('PDF 没有可提取的文本（可能是扫描件，需要 OCR/视觉模型；本工具暂只处理文本型 PDF）')
    process.exit(2)
  }

  const chunkSize = args.chunk || 6000
  const chunks = chunkText(text, chunkSize)
  console.log('共 ' + text.length + ' 字，分 ' + chunks.length + ' 段调用 Kimi(' + MODEL + ') ...')

  const all = []
  for (let k = 0; k < chunks.length; k++) {
    process.stdout.write('  段 ' + (k + 1) + '/' + chunks.length + ' ... ')
    try {
      const resp = await callKimi(buildPrompt(chunks[k], args.subject))
      const arr = extractJsonArray(resp)
      console.log('得到 ' + arr.length + ' 题')
      for (let m = 0; m < arr.length; m++) all.push(arr[m])
    } catch (e) {
      console.log('失败: ' + e.message)
    }
  }

  const out = args.out || (path.basename(pdf).replace(/\.[^.]+$/, '') + '.questions.json')
  fs.writeFileSync(out, JSON.stringify(all, null, 2), 'utf8')
  console.log('完成：共 ' + all.length + ' 题 → ' + out)
}

main().catch(function (e) { console.error('出错:', e); process.exit(1) })
