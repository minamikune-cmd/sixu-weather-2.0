// 页面和路由层 · 路由定义。
// 应用是单页沉浸式天气场景，路由采用哈希锚点（与 1.0 一致），
// 桌面导航与底部移动导航共用这一份定义；Android 返回键不涉及历史回退。
export interface RouteDef {
  id: string
  hash: string
  label: string
}

export const ROUTES: RouteDef[] = [
  { id: 'overview', hash: '#overview', label: '此刻' },
  { id: 'hourly', hash: '#hourly', label: '逐时' },
  { id: 'daily', hash: '#daily', label: '七日' },
]
