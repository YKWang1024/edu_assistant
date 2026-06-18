// 开发云 AI 模型配置
// =====================================================================
// 这里的 provider / model 必须与你在「云开发控制台 → AI」里实际开通并启用的一致。
//
//  - provider 固定填 'cloudbase'(主托管组)；若你走的是「小程序成长计划」，改成 'hunyuan-exp'。
//  - VISION_MODEL 必须是【多模态/能看图】的模型，否则拍照识别会失败。
//      例如 'deepseek-v4-pro'（支持图片）。注意 *-flash 之类的纯文本模型【不能】看图。
//  - TEXT_MODEL 用于给「重点疑难题」生成讲解课程，普通文本模型即可，例如 'deepseek-v3.2'。
//
//  改这里之后无需改其它代码。若暂时没开通，识别会失败但流程仍可用（可手动输入题目）。
// =====================================================================

module.exports = {
  VISION_PROVIDER: 'cloudbase',
  VISION_MODEL: 'deepseek-v4-pro',   // TODO: 改成你已开通的【多模态】模型 id

  TEXT_PROVIDER: 'cloudbase',
  TEXT_MODEL: 'deepseek-v3.2',       // TODO: 改成你已开通的【文本】模型 id

  // 可保存错题的科目列表
  SUBJECTS: ['语文', '数学', '英语', '科学', '其他']
}
