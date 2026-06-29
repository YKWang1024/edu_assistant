var app = getApp()

Page({
  data: {
    loading: true,
    needLogin: false,
    familyId: '',
    myRole: '',
    isAdmin: false,
    isObserver: false,
    members: [],
    children: [],
    inviteCode: '',
    familyName: '',
    myFamilies: []
  },

  onShow: function () {
    this.load()
  },

  load: function () {
    var that = this
    if (!app.globalData.cloudReady) {
      that.setData({ loading: false })
      wx.showToast({ title: '云开发未就绪，请稍后重试', icon: 'none' })
      return
    }
    this.loadFamilies()
    app.callCloudFunction('getFamilyInfo', {}, function (res) {
      if (res && res.success) {
        var members = (res.data.members || []).map(function (m) {
          m.roleLabel = m.role === 'admin' ? '管理员' : (m.role === 'observer' ? '旁观' : '成员')
          return m
        })
        that.setData({
          loading: false,
          needLogin: false,
          familyId: res.data.familyId,
          myRole: res.data.myRole,
          isAdmin: res.data.myRole === 'admin',
          isObserver: res.data.myRole === 'observer',
          members: members,
          children: res.data.children || [],
          inviteCode: res.data.inviteCode || '',
          familyName: res.data.familyName || ''
        })
        // 管理员若还没有家庭码，自动生成一个，保证「看得到家庭码」
        if (res.data.myRole === 'admin' && !res.data.inviteCode) {
          app.callCloudFunction('generateInviteCode', {}, function (r) {
            if (r && r.success) that.setData({ inviteCode: r.data.code })
          })
        }
      } else if (res && res.code === 'NO_FAMILY') {
        that.setData({ loading: false, needLogin: true })
      } else {
        that.setData({ loading: false })
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' })
      }
    })
  },

  // ---------------- 多家庭：列表 / 切换 / 退出 ----------------
  loadFamilies: function () {
    var that = this
    app.callCloudFunction('getMyFamilies', {}, function (res) {
      if (res && res.success) that.setData({ myFamilies: res.data.families || [] })
    })
  },

  onRenameFamily: function () {
    var that = this
    wx.showModal({
      title: '家庭名称',
      editable: true,
      placeholderText: '如 我们一家 / 爷爷奶奶家',
      content: that.data.familyName || '',
      success: function (m) {
        if (!m.confirm || !(m.content || '').trim()) return
        app.callCloudFunction('manageFamily', { action: 'setFamilyName', name: m.content.trim() }, function (r) {
          if (r && r.success) { wx.showToast({ title: '已改名', icon: 'success' }); that.load() }
          else wx.showToast({ title: (r && r.message) || '改名失败', icon: 'none' })
        })
      }
    })
  },

  onSwitchFamily: function (e) {
    var that = this
    if (e.currentTarget.dataset.active) return
    var fid = e.currentTarget.dataset.id
    wx.showLoading({ title: '切换中…' })
    app.callCloudFunction('switchFamily', { familyId: fid }, function (res) {
      wx.hideLoading()
      if (res && res.success) {
        app.saveFamilyId(res.data.familyId)
        app.refreshFamily(function () {})
        wx.showToast({ title: '已切换', icon: 'success' })
        that.load()
      } else {
        wx.showToast({ title: (res && res.message) || '切换失败', icon: 'none' })
      }
    })
  },

  onLeaveFamily: function (e) {
    var that = this
    var fid = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name || '该家庭'
    wx.showModal({
      title: '退出家庭',
      content: '确定退出「' + name + '」吗？退出后将看不到该家庭共享的菜谱、错题等数据。',
      confirmColor: '#e5484d',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('leaveFamily', { familyId: fid }, function (res) {
          if (res && res.success) {
            app.saveFamilyId(res.data.familyId)
            app.refreshFamily(function () {})
            wx.showToast({ title: '已退出', icon: 'success' })
            that.load()
          } else {
            wx.showToast({ title: (res && res.message) || '退出失败', icon: 'none' })
          }
        })
      }
    })
  },

  // 新建家庭：输入名称 → 创建并切换为当前家庭
  onCreateFamily: function () {
    var that = this
    wx.showModal({
      title: '新建家庭',
      editable: true,
      placeholderText: '如 爷爷奶奶家 / 我们一家',
      success: function (m) {
        if (!m.confirm) return
        var name = (m.content || '').trim()
        wx.showLoading({ title: '创建中…' })
        app.callCloudFunction('createFamily', { name: name }, function (res) {
          wx.hideLoading()
          if (res && res.success) {
            app.saveFamilyId(res.data.familyId)
            app.refreshFamily(function () {})
            wx.showToast({ title: '已创建', icon: 'success' })
            that.load()
          } else {
            wx.showToast({ title: (res && res.message) || '创建失败', icon: 'none' })
          }
        })
      }
    })
  },

  // 删除家庭：仅管理员、该家庭只剩自己、且不是唯一家庭。二次确认。
  onDeleteFamily: function (e) {
    var that = this
    var fid = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name || '该家庭'
    wx.showModal({
      title: '删除家庭',
      content: '将永久删除「' + name + '」及其菜谱、错题、打卡等数据，且无法在小程序内恢复。确定删除吗？',
      confirmText: '删除',
      confirmColor: '#e5484d',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('deleteFamily', { familyId: fid }, function (res) {
          if (res && res.success) {
            app.saveFamilyId(res.data.familyId)
            app.refreshFamily(function () {})
            wx.showToast({ title: '已删除', icon: 'success' })
            that.load()
          } else {
            wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' })
          }
        })
      }
    })
  },

  onGoAuth: function () {
    wx.navigateTo({ url: '/pages/auth/auth' })
  },

  onGenerateCode: function () {
    var that = this
    wx.showLoading({ title: '生成中…' })
    app.callCloudFunction('generateInviteCode', {}, function (res) {
      wx.hideLoading()
      if (res && res.success) {
        that.setData({ inviteCode: res.data.code })
        wx.showToast({ title: '已生成', icon: 'success' })
      } else {
        wx.showToast({ title: (res && res.message) || '生成失败', icon: 'none' })
      }
    })
  },

  onCopyCode: function () {
    if (!this.data.inviteCode) {
      wx.showToast({ title: '请先生成邀请码', icon: 'none' })
      return
    }
    wx.setClipboardData({ data: this.data.inviteCode })
  },

  onShareAppMessage: function () {
    var code = this.data.inviteCode
    var familyId = this.data.familyId
    var path = '/pages/family/join?familyId=' + familyId + (code ? ('&code=' + code) : '')
    return {
      title: '邀请你加入我们的家庭 👨‍👩‍👧',
      path: path
    }
  },

  onGoJoin: function () {
    wx.navigateTo({ url: '/pages/family/join' })
  },

  onRename: function () {
    var that = this
    wx.showModal({
      title: '修改我的称呼',
      editable: true,
      placeholderText: '如 妈妈 / 爸爸 / 家长',
      success: function (m) {
        if (!m.confirm || !(m.content || '').trim()) return
        app.callCloudFunction('setMemberName', { displayName: m.content.trim() }, function (r) {
          if (r && r.success) { wx.showToast({ title: '已修改', icon: 'success' }); that.load() }
          else wx.showToast({ title: (r && r.message) || '修改失败', icon: 'none' })
        })
      }
    })
  },

  // ---------------- 小孩成员（无账号） ----------------
  // 先问称呼再问年级，最后提交
  promptChild: function (presetName, presetGrade, cb) {
    wx.showModal({
      title: '小孩称呼',
      editable: true,
      placeholderText: '如 妹妹 / 姐姐',
      content: presetName || '',
      success: function (m1) {
        if (!m1.confirm) return
        var name = (m1.content || '').trim()
        if (!name) { wx.showToast({ title: '请填写称呼', icon: 'none' }); return }
        wx.showModal({
          title: '年级（可留空）',
          editable: true,
          placeholderText: '如 一年级',
          content: presetGrade || '',
          success: function (m2) {
            if (!m2.confirm) return
            cb(name, (m2.content || '').trim())
          }
        })
      }
    })
  },

  // 添加/编辑小孩 → 信息管理页(支持头像/年龄)，REQ-012
  onAddChild: function () {
    wx.navigateTo({ url: '/pages/profile/child' })
  },

  onEditChild: function (e) {
    var c = e.currentTarget.dataset.child
    wx.navigateTo({ url: '/pages/profile/child?childId=' + c.childId })
  },

  onRemoveChild: function (e) {
    var that = this
    var c = e.currentTarget.dataset.child
    wx.showModal({
      title: '移除小孩',
      content: '确定移除「' + c.name + '」吗？(数据会保留，不再显示)',
      confirmColor: '#ba1a1a',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('manageFamily', { action: 'removeChild', childId: c.childId }, function (r) {
          if (r && r.success) { wx.showToast({ title: '已移除', icon: 'success' }); that.load() }
          else wx.showToast({ title: (r && r.message) || '移除失败', icon: 'none' })
        })
      }
    })
  },

  // ---------------- 家长密码（编辑错题用，每人自己设置） ----------------
  onEditPassword: function () {
    app.callCloudFunction('editPassword', { action: 'status' }, function (res) {
      if (!res || !res.success) { wx.showToast({ title: '网络异常，请重试', icon: 'none' }); return }
      if (res.data && res.data.hasPassword) {
        wx.showModal({
          title: '修改家长密码', editable: true, placeholderText: '请输入原密码',
          success: function (m1) {
            if (!m1.confirm) return
            var oldp = (m1.content || '').trim()
            wx.showModal({
              title: '设置新密码', editable: true, placeholderText: '至少 4 位',
              success: function (m2) {
                if (!m2.confirm) return
                var np = (m2.content || '').trim()
                if (np.length < 4) { wx.showToast({ title: '至少 4 位', icon: 'none' }); return }
                app.callCloudFunction('editPassword', { action: 'set', password: np, oldPassword: oldp }, function (r) {
                  wx.showToast({ title: (r && r.success) ? '已修改' : ((r && r.message) || '修改失败'), icon: (r && r.success) ? 'success' : 'none' })
                })
              }
            })
          }
        })
      } else {
        wx.showModal({
          title: '设置家长密码', editable: true, placeholderText: '至少 4 位（编辑错题时用）',
          success: function (m) {
            if (!m.confirm) return
            var np = (m.content || '').trim()
            if (np.length < 4) { wx.showToast({ title: '至少 4 位', icon: 'none' }); return }
            app.callCloudFunction('editPassword', { action: 'set', password: np }, function (r) {
              wx.showToast({ title: (r && r.success) ? '已设置' : ((r && r.message) || '设置失败'), icon: (r && r.success) ? 'success' : 'none' })
            })
          }
        })
      }
    })
  },

  // ---------------- 成员角色 ----------------
  onChangeRole: function (e) {
    var that = this
    var m = e.currentTarget.dataset.member
    wx.showActionSheet({
      itemList: ['设为管理员', '设为成员', '设为旁观者(只读)'],
      success: function (r) {
        var role = ['admin', 'member', 'observer'][r.tapIndex]
        app.callCloudFunction('manageFamily', { action: 'setMemberRole', targetOpenid: m.openid, role: role }, function (res) {
          if (res && res.success) { wx.showToast({ title: '已设置', icon: 'success' }); that.load() }
          else wx.showToast({ title: (res && res.message) || '设置失败', icon: 'none' })
        })
      }
    })
  }
})
