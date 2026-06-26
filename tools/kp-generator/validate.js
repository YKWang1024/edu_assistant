/*
 * 知识点图谱校验（REQ-007 的「校验方法」）
 * 需求方要求：先用工具生成人教版小学知识点，并「有校验的方法」，通过之后再传上云。
 * 这里对生成的数据做结构性校验，只有 ok=true（无 error）才算「通过」，可上云。
 */

var SUBJECTS = ['语文', '数学', '英语']
var GRADE_MIN = 1
var GRADE_MAX = 6
var MIN_POINTS_PER_GRADE = 5 // 每(学科,年级)少于该数量给 warning（不阻断）

function isNonEmptyStr(v) { return typeof v === 'string' && v.trim().length > 0 }

// 沿 parentId 向上找是否成环，或引用不存在的父节点
function detectParentIssues(points, idMap) {
  var errors = []
  points.forEach(function (p) {
    var pid = p.parentId
    if (pid === undefined || pid === null || pid === '') return
    if (!idMap[pid]) { errors.push('知识点 ' + p.id + ' 的 parentId「' + pid + '」不存在'); return }
    // 环检测
    var seen = {}
    var cur = p.id
    while (cur) {
      if (seen[cur]) { errors.push('知识点 ' + p.id + ' 的 parentId 链存在环'); break }
      seen[cur] = true
      var node = idMap[cur]
      cur = node ? node.parentId : null
      if (cur === undefined || cur === '') cur = null
    }
  })
  return errors
}

function detectPrereqIssues(points, idMap) {
  var errors = []
  points.forEach(function (p) {
    var pre = p.prerequisites
    if (!pre) return
    if (!Array.isArray(pre)) { errors.push('知识点 ' + p.id + ' 的 prerequisites 不是数组'); return }
    pre.forEach(function (q) {
      if (q === p.id) { errors.push('知识点 ' + p.id + ' 的前置含自身'); return }
      if (!idMap[q]) errors.push('知识点 ' + p.id + ' 的前置「' + q + '」不存在')
    })
  })
  return errors
}

function validateKnowledge(data) {
  var errors = []
  var warnings = []

  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['数据不是对象'], warnings: [], stats: {} }
  }
  var points = data.points
  if (!Array.isArray(points) || points.length === 0) {
    return { ok: false, errors: ['points 必须是非空数组'], warnings: [], stats: {} }
  }

  // 掌握度口径校验（需求方：正确率≥90% 才算掌握）
  if (!data.meta || typeof data.meta.masteryThreshold !== 'number') {
    warnings.push('meta.masteryThreshold 缺失，建议显式写 0.9（正确率≥90% 算掌握）')
  } else if (Math.abs(data.meta.masteryThreshold - 0.9) > 1e-9) {
    warnings.push('meta.masteryThreshold=' + data.meta.masteryThreshold + '，与需求口径 0.9 不一致')
  }

  var idMap = {}
  var coverage = {} // "学科|年级" -> count

  points.forEach(function (p, i) {
    var tag = 'points[' + i + ']'
    if (!p || typeof p !== 'object') { errors.push(tag + ' 不是对象'); return }
    if (!isNonEmptyStr(p.id)) { errors.push(tag + ' 缺少 id'); return }
    if (idMap[p.id]) errors.push('id 重复：' + p.id)
    idMap[p.id] = p

    if (!isNonEmptyStr(p.name)) errors.push(p.id + ' 缺少 name')
    if (SUBJECTS.indexOf(p.subject) < 0) errors.push(p.id + ' 的 subject「' + p.subject + '」不在 ' + SUBJECTS.join('/'))
    var g = p.grade
    if (typeof g !== 'number' || g % 1 !== 0 || g < GRADE_MIN || g > GRADE_MAX) {
      errors.push(p.id + ' 的 grade「' + g + '」应为 ' + GRADE_MIN + '-' + GRADE_MAX + ' 的整数')
    }
    if (SUBJECTS.indexOf(p.subject) >= 0 && typeof g === 'number') {
      var key = p.subject + '|' + g
      coverage[key] = (coverage[key] || 0) + 1
    }
  })

  errors = errors.concat(detectParentIssues(points, idMap))
  errors = errors.concat(detectPrereqIssues(points, idMap))

  // 覆盖度 warning：仅对「本次声明要生成」的范围检查(meta.subjects/grades)，
  // 缺省则按全量(三科 1-6 年级)。避免部分生成时对未涉及学科误报。
  var covSubjects = (data.meta && Array.isArray(data.meta.subjects) && data.meta.subjects.length) ? data.meta.subjects : SUBJECTS
  var covGrades = (data.meta && Array.isArray(data.meta.grades) && data.meta.grades.length)
    ? data.meta.grades
    : (function () { var arr = []; for (var g = GRADE_MIN; g <= GRADE_MAX; g++) arr.push(g); return arr })()
  covSubjects.forEach(function (s) {
    covGrades.forEach(function (g) {
      var c = coverage[s + '|' + g] || 0
      if (c === 0) warnings.push('未覆盖：' + s + ' ' + g + '年级（0 个知识点）')
      else if (c < MIN_POINTS_PER_GRADE) warnings.push('偏少：' + s + ' ' + g + '年级仅 ' + c + ' 个知识点')
    })
  })

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    stats: { total: points.length, coverage: coverage }
  }
}

module.exports = { validateKnowledge: validateKnowledge, SUBJECTS: SUBJECTS }
