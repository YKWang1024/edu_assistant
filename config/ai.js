// 开发云 / AI 配置
// =====================================================================
//  视觉识别（菜谱识图 / 拍照识题）现走云函数 aiVision（Kimi Code，Anthropic 兼容），
//  其 API Key / 模型在云函数 aiVision 的【环境变量】配置，与这里无关。
//
//  下面的 TEXT_* 仍用于「重点疑难题」AI 讲解课程（小程序端 wx.cloud.extend.AI 文本模型）。
//  SUBJECTS 为可保存错题的科目列表。
//
//  DEBUG：调试开关。true 时前端会显示后端/接口返回的【具体错误】(便于排查)；
//         上线给用户前请改回 false（生产模式只显示友好提示，不暴露技术细节）。
// =====================================================================

module.exports = {
  DEBUG: false,

  // 文本模型（错题 AI 讲解课程，走 wx.cloud.extend.AI）
  TEXT_PROVIDER: 'cloudbase',
  TEXT_MODEL: 'deepseek-v3.2',       // 改成你已开通的文本模型 id

  // 兼容旧字段（视觉已迁至云函数 aiVision，这里不再使用）
  VISION_PROVIDER: 'cloudbase',
  VISION_MODEL: 'deepseek-v4-pro',

  // 可保存错题的科目列表
  SUBJECTS: ['语文', '数学', '英语', '科学', '其他']
}
