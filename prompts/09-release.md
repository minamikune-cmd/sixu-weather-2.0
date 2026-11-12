# 阶段 09：发布准备与交接

检查功能清单、迁移报告、版本号、变更日志、隐私说明、权限说明、API 配置、部署文档、CI 状态和已知问题。核对 Web 部署与 Android APK/AAB 产物。检查 Secrets、签名和第三方服务配置，不泄露敏感内容。

列出发布阻塞项、需人工配置项、真机测试清单（安装、启动、定位授权、通知权限/送达、后台行为、旋转/返回键、网络切换、电量与性能）。明确哪些已通过自动化、哪些仅构建成功、哪些仍待真机。

输出 docs/RELEASE_CHECKLIST.md、docs/RELEASE_NOTES.md、docs/ANDROID_DEVICE_TEST_PLAN.md、docs/progress/PHASE-09.md。不得在未获明确发布授权时发布正式版本。