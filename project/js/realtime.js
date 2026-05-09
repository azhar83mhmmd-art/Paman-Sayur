// ============================================================
// REALTIME.JS - Supabase Realtime subscriptions
// ============================================================

const Realtime = {
  channels: [],

  // Subscribe produk (stok, harga realtime)
  subscribeProducts(onUpdate) {
    const ch = db.channel('products-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, (payload) => {
        console.log('[Realtime] Products:', payload.eventType, payload.new || payload.old);
        onUpdate(payload);
      })
      .subscribe();
    this.channels.push(ch);
    return ch;
  },

  // Subscribe pesanan user tertentu
  subscribeUserOrders(userId, onUpdate) {
    const ch = db.channel(`orders-user-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('[Realtime] Order update:', payload);
        onUpdate(payload);
      })
      .subscribe();
    this.channels.push(ch);
    return ch;
  },

  // Subscribe semua pesanan (admin)
  subscribeAllOrders(onUpdate) {
    const ch = db.channel('orders-admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, (payload) => {
        console.log('[Realtime] Admin orders:', payload);
        onUpdate(payload);
      })
      .subscribe();
    this.channels.push(ch);
    return ch;
  },

  // Subscribe admin stats
  subscribeAdminStats(onUpdate) {
    const ch = db.channel('admin-stats')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'admin_stats'
      }, (payload) => {
        onUpdate(payload.new);
      })
      .subscribe();
    this.channels.push(ch);
    return ch;
  },

  // Unsubscribe semua channel
  unsubscribeAll() {
    this.channels.forEach(ch => {
      try { db.removeChannel(ch); } catch (e) {}
    });
    this.channels = [];
  },

  // Badge pesanan baru untuk admin (notif)
  listenNewOrder(onNew) {
    const ch = db.channel('new-orders-notif')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders'
      }, (payload) => {
        onNew(payload.new);
      })
      .subscribe();
    this.channels.push(ch);
    return ch;
  }
};

window.Realtime = Realtime;
