const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { familyId, memberNickname } = event

    const familyRes = await db.collection('families').doc(familyId).get()
    if (!familyRes.data) {
      return {
        success: false,
        message: '家庭不存在'
      }
    }

    const userRes = await db.collection('users').where({ openid: openid }).get()
    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '用户未注册'
      }
    }

    const user = userRes.data[0]
    if (user.familyRole !== 'owner') {
      return {
        success: false,
        message: '只有家庭管理员才能添加成员'
      }
    }

    await db.collection('families').doc(familyId).update({
      data: {
        members: db.command.push({
          openid: openid,
          nickname: memberNickname,
          role: 'member'
        })
      }
    })

    return {
      success: true,
      message: '添加成功'
    }
  } catch (e) {
    return {
      success: false,
      message: e.message
    }
  }
}