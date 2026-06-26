// 孩子信息管理（REQ-012）：编辑/展示 名字·年级·年龄 + 头像，保存到家庭 children
var app = getApp()

Page({
  data: {
    childId: '',
    isAdd: false,
    name: '',
    grade: '',
    age: '',
    avatarUrl: '',       // 展示用(临时链接或本地预览)
    avatarTempPath: '',  // 新选择、待上传的本地路径
    avatarChanged: false,
    saving: false
  },

  onLoad: function (options) {
    if (options && options.childId) {
      this.setData({ childId: options.childId })
      this.loadChild()
    } else {
      this.setData({ isAdd: true })
      wx.setNavigationBarTitle({ title: '添加孩子' })
    }
  },

  loadChild: function () {
    var that = this
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再操作', icon: 'none' }); return }
    app.callCloudFunction('getFamilyInfo', {}, function (res) {
      if (res && res.success && res.data) {
        var c = (res.data.children || []).filter(function (x) { return x.childId === that.data.childId })[0]
        if (c) that.setData({ name: c.name || '', grade: c.grade || '', age: c.age || '', avatarUrl: c.avatar || '' })
        else wx.showToast({ title: '未找到该孩子', icon: 'none' })
      }
    })
  },

  onInputName: function (e) { this.setData({ name: e.detail.value }) },
  onInputGrade: function (e) { this.setData({ grade: e.detail.value }) },
  onInputAge: function (e) { this.setData({ age: e.detail.value }) },

  onChooseAvatar: function () {
    var that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        var f = res.tempFiles && res.tempFiles[0]
        if (f && f.tempFilePath) {
          that.setData({ avatarTempPath: f.tempFilePath, avatarUrl: f.tempFilePath, avatarChanged: true })
        }
      }
    })
  },

  onSave: function () {
    var that = this
    var name = (this.data.name || '').trim()
    if (!name) { wx.showToast({ title: '请填写名字', icon: 'none' }); return }
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再操作', icon: 'none' }); return }
    if (this.data.saving) return
    this.setData({ saving: true })

    // 头像有变更先上传得到 fileID，再保存
    if (this.data.avatarChanged && this.data.avatarTempPath) {
      var familyId = app.globalData.familyId || 'family'
      var ext = (this.data.avatarTempPath.match(/\.(\w+)$/) || [null, 'png'])[1]
      var cloudPath = 'child-avatar/' + familyId + '/' + (this.data.childId || ('c' + Date.now())) + '.' + ext
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: this.data.avatarTempPath,
        success: function (up) { that.doSave(up.fileID) },
        fail: function () { that.setData({ saving: false }); wx.showToast({ title: '头像上传失败', icon: 'none' }) }
      })
    } else {
      this.doSave(null)
    }
  },

  doSave: function (avatarFileID) {
    var that = this
    var payload = {
      action: this.data.isAdd ? 'addChild' : 'updateChild',
      name: (this.data.name || '').trim(),
      grade: (this.data.grade || '').trim(),
      age: (this.data.age || '').trim()
    }
    if (!this.data.isAdd) payload.childId = this.data.childId
    if (avatarFileID) payload.avatar = avatarFileID // 仅在更换头像时下发，避免覆盖原值

    app.callCloudFunction('manageFamily', payload, function (r) {
      that.setData({ saving: false })
      if (r && r.success) {
        // 刷新全局家庭数据，使首页/各页头像即时联动
        app.refreshFamily(function () {
          wx.showToast({ title: '已保存', icon: 'success' })
          setTimeout(function () { wx.navigateBack() }, 800)
        })
      } else {
        wx.showToast({ title: (r && r.message) || '保存失败', icon: 'none' })
      }
    })
  }
})
