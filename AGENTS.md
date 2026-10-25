# 项目接续入口

开始工作先读 `.agents/skills/alterlab-vcd-packaging/references/design-production-flow.md` 和 `.agents/skills/alterlab-vcd-packaging/references/continuation-state.md`。

包装任务使用 `.agents/skills/alterlab-vcd-packaging/SKILL.md`，只复查本次修改涉及的环节。软件修复不重做客户访谈或设计调研。

- 编码前明确假设、范围、简短步骤和验证标准；无法查明且影响结果的歧义先澄清。
- 最少代码完成需求；只改必要文件，保留已有修改，不清理无关代码。
- 保留原稿和未保存页面；客户修订另存版本，更新各案自己的续作记录。
- 技术检查、视觉确认、结构白样和工厂验收分别记录；不伪造核验，不移除导出门槛。
- 本仓库不含客户工程、私人素材或浏览器项目库。不要将本地客户资料推送到公共仓库。

运行 `npm test` 和 `npm run build` 核对相关改动；浏览器操作测试不能由构建成功代替。推送只在用户已授权时进行。
