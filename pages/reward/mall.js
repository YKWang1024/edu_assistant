// 积分商城(REQ-025)：用积分兑换家长维护的奖励清单；记录兑换流水。
var app = getApp()

Page({
  data: {
    isAdmin: false,
    pointsBalance: 0,
    catalog: [],
    redemptions: [],
    redeeming: false
  },

  onShow: function () {
    var that = this
    this.setData({ isAdmin: app.globalData.myFamilyRole === 'admin' })
    app.refreshFamily(function () {
      that.setData({ isAdmin: app.globalData.myFamilyRole === 'admin' })
    })
    this.load()
  },

  load: function () {
    var that = this
    if (!app.globalData.cloudReady) return
    app.getRewardWallet('points', app.getCurrentChild(), function (balance) {
      that.setData({ pointsBalance: balance })
    })
    app.callCloudFunction('listRewardCatalog', {}, function (res) {
      if (res && res.success) that.setData({ catalog: res.data || [] })
    })
    app.callCloudFunction('listRedemptions', { childName: app.getCurrentChild(), limit: 20 }, function (res) {
      if (res && res.success) that.setData({ redemptions: res.data || [] })
    })
  },

  // 同一个奖励在「尚未拿到成功结果」前重复兑换请求复用同一个 requestId(幂等键)，
  // 避免网络超时后用户重试导致被服务端重复扣分；一旦成功或本次会话结束就清掉。
  _pendingRedeemIds: {},

  onRedeem: function (e) {
    var that = this
    var item = e.currentTarget.dataset.item
    if (this.data.pointsBalance < item.pointsCost) {
      wx.showToast({ title: '积分不足', icon: 'none' })
      return
    }
    if (this.data.redeeming) return
    wx.showModal({
      title: '兑换确认',
      content: '确定用 ' + item.pointsCost + ' 积分兑换「' + item.name + '」吗？',
      success: function (m) {
        if (!m.confirm) return
        if (!that._pendingRedeemIds[item._id]) {
          that._pendingRedeemIds[item._id] = 'rq_' + Date.now() + '_' + Math.floor(Math.random() * 1e6)
        }
        var requestId = that._pendingRedeemIds[item._id]
        that.setData({ redeeming: true })
        app.callCloudFunction('redeemReward', { itemId: item._id, childName: app.getCurrentChild(), clientRequestId: requestId }, function (res) {
          that.setData({ redeeming: false })
          if (res && res.success) {
            delete that._pendingRedeemIds[item._id]
            wx.showToast({ title: '兑换成功', icon: 'success' })
            that.load()
          } else {
            wx.showToast({ title: (res && res.message) || '兑换失败', icon: 'none' })
          }
        })
      }
    })
  },

  // —— 家长维护兑换清单(轻量两步弹窗，先名称+积分，可再编辑补说明) ——
  onAddItem: function () {
    var that = this
    wx.showModal({
      title: '奖励名称', editable: true, placeholderText: '如 多玩30分钟游戏 / 买一个小玩具',
      success: function (m1) {
        if (!m1.confirm) return
        var name = (m1.content || '').trim()
        if (!name) { wx.showToast({ title: '请填写名称', icon: 'none' }); return }
        wx.showModal({
          title: '所需积分', editable: true, placeholderText: '如 50',
          success: function (m2) {
            if (!m2.confirm) return
            var cost = parseInt(m2.content, 10)
            if (!cost || cost <= 0) { wx.showToast({ title: '请输入有效积分数', icon: 'none' }); return }
            app.callCloudFunction('saveRewardCatalog', { name: name, pointsCost: cost }, function (r) {
              if (r && r.success) { wx.showToast({ title: '已添加', icon: 'success' }); that.load() }
              else wx.showToast({ title: (r && r.message) || '添加失败', icon: 'none' })
            })
          }
        })
      }
    })
  },

  onEditItem: function (e) {
    var that = this
    var item = e.currentTarget.dataset.item
    wx.showModal({
      title: '修改名称', editable: true, content: item.name,
      success: function (m1) {
        if (!m1.confirm) return
        var name = (m1.content || '').trim()
        if (!name) { wx.showToast({ title: '请填写名称', icon: 'none' }); return }
        wx.showModal({
          title: '修改所需积分', editable: true, content: String(item.pointsCost),
          success: function (m2) {
            if (!m2.confirm) return
            var cost = parseInt(m2.content, 10)
            if (!cost || cost <= 0) { wx.showToast({ title: '请输入有效积分数', icon: 'none' }); return }
            app.callCloudFunction('saveRewardCatalog', { itemId: item._id, name: name, pointsCost: cost }, function (r) {
              if (r && r.success) { wx.showToast({ title: '已保存', icon: 'success' }); that.load() }
              else wx.showToast({ title: (r && r.message) || '保存失败', icon: 'none' })
            })
          }
        })
      }
    })
  },

  onDeleteItem: function (e) {
    var that = this
    var item = e.currentTarget.dataset.item
    wx.showModal({
      title: '删除奖励', content: '确定从兑换清单中删除「' + item.name + '」吗？',
      confirmColor: '#e5484d',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('deleteRewardCatalog', { itemId: item._id }, function (r) {
          if (r && r.success) { wx.showToast({ title: '已删除', icon: 'success' }); that.load() }
          else wx.showToast({ title: (r && r.message) || '删除失败', icon: 'none' })
        })
      }
    })
  }
})
