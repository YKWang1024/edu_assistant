// 习惯管理页(REQ-023 自定义习惯 + REQ-024 奖励类型)：仅家长(admin)可增/改/删，其他成员只读查看。
var app = getApp()

var REWARD_TYPE_LABELS = { time: '游戏时间(分钟)', money: '零花钱(元)', points: '积分' }
var MODE_LABELS = { targetTime: '按目标时间打卡', fixed: '打卡即得固定奖励' }

Page({
  data: {
    isAdmin: false,
    habits: [],
    loading: true
  },

  onShow: function () {
    var that = this
    // 先用缓存角色即时展示，再刷新家庭信息确保角色最新(避免深链直达时角色数据未同步)
    this.setData({ isAdmin: app.globalData.myFamilyRole === 'admin' })
    app.refreshFamily(function () {
      that.setData({ isAdmin: app.globalData.myFamilyRole === 'admin' })
    })
    this.load()
  },

  load: function () {
    var that = this
    if (!app.globalData.cloudReady) { that.setData({ loading: false }); return }
    app.callCloudFunction('listHabitDefs', {}, function (res) {
      that.setData({ loading: false })
      if (res && res.success) {
        var habits = (res.data || []).map(function (h) {
          return Object.assign({}, h, {
            modeLabel: MODE_LABELS[h.mode] || h.mode,
            rewardTypeLabel: REWARD_TYPE_LABELS[h.rewardType] || h.rewardType,
            rewardValueLabel: h.mode === 'targetTime' ? ('最多 +' + h.maxReward) : ('固定 ' + h.fixedReward)
          })
        })
        that.setData({ habits: habits })
      } else {
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' })
      }
    })
  },

  onAdd: function () {
    if (!this.data.isAdmin) return
    wx.navigateTo({ url: '/pages/reward/habit-edit' })
  },

  onEdit: function (e) {
    if (!this.data.isAdmin) return
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/reward/habit-edit?id=' + id })
  },

  onDelete: function (e) {
    var that = this
    if (!this.data.isAdmin) return
    var id = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name || '该习惯'
    wx.showModal({
      title: '删除习惯',
      content: '确定删除「' + name + '」吗？历史打卡记录会保留，但以后不能再对它打卡。',
      confirmColor: '#e5484d',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('deleteHabitDef', { habitId: id }, function (r) {
          if (r && r.success) { wx.showToast({ title: '已删除', icon: 'success' }); that.load() }
          else wx.showToast({ title: (r && r.message) || '删除失败', icon: 'none' })
        })
      }
    })
  }
})
