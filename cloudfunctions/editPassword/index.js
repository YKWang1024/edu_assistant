// 云函数：家长编辑密码（每个用户自己设置，存在 users.editPasswordHash，服务端校验）。
//   action='status'  -> { hasPassword }
//   action='set'     { password, oldPassword? } -> 首次设置；已设置则需 oldPassword 匹配才能改
//   action='verify'  { password } -> { match }
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function hash(s) { return crypto.createHash('sha256').update(String(s)).digest('hex') }

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const us = await db.collection('users').where({ openid: openid }).get()
    if (!us.data || !us.data.length) return { success: false, message: '用户不存在' }
    const user = us.data[0]
    const action = event.action

    if (action === 'status') {
      return { success: true, data: { hasPassword: !!user.editPasswordHash } }
    }

    if (action === 'verify') {
      const match = !!user.editPasswordHash && user.editPasswordHash === hash(event.password || '')
      return { success: true, data: { match: match } }
    }

    if (action === 'set') {
      const pwd = String(event.password || '').trim()
      if (pwd.length < 4) return { success: false, message: '密码至少 4 位' }
      if (user.editPasswordHash && user.editPasswordHash !== hash(event.oldPassword || '')) {
        return { success: false, message: '原密码不正确' }
      }
      await db.collection('users').doc(user._id).update({ data: { editPasswordHash: hash(pwd) } })
      return { success: true }
    }

    return { success: false, message: '未知操作' }
  } catch (err) {
    return { success: false, message: '操作失败', error: err.message }
  }
}
