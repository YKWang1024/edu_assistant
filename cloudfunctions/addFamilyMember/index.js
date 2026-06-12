// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const db = cloud.database()
    const openid = wxContext.OPENID
    const { memberOpenid, memberNickname, memberRole } = event

    // 验证操作者是否是家庭管理员
    const user = await db.collection('users').where({
      openid: openid
    }).get()

    if (!user.data || user.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      }
    }

    if (user.data[0].familyRole !== 'admin') {
      return {
        success: false,
        message: '只有管理员可以添加家庭成员'
      }
    }

    const familyId = user.data[0].familyId

    // 检查被添加的用户是否已注册
    let memberUser = await db.collection('users').where({
      openid: memberOpenid
    }).get()

    let memberUserId

    if (!memberUser.data || memberUser.data.length === 0) {
      // 创建新用户
      const newUser = await db.collection('users').add({
        data: {
          openid: memberOpenid,
          nickname: memberNickname || '家庭成员',
          avatarUrl: '',
          familyId: familyId,
          familyRole: memberRole || 'member',
          createdAt: new Date()
        }
      })
      memberUserId = newUser._id
    } else {
      // 更新现有用户
      memberUserId = memberUser.data[0]._id
      await db.collection('users').doc(memberUserId).update({
        data: {
          familyId: familyId,
          familyRole: memberRole || 'member'
        }
      })
    }

    // 添加到家庭成员列表
    await db.collection('families').doc(familyId).update({
      data: {
        members: db.command.push([{
          openid: memberOpenid,
          role: memberRole || 'member',
          joinedAt: new Date()
        }])
      }
    })

    return {
      success: true,
      message: '添加家庭成员成功'
    }
  } catch (err) {
    return {
      success: false,
      message: '添加失败',
      error: err.message
    }
  }
}
