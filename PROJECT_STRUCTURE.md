AoE4 HUD 前端项目结构说明（Electron + Vue3）

本项目用于实现 AoE4 Overlay 覆盖层前端，遵循 `doc/前端项目文档_v0.2.md` 的 MVP 要求。

**目录结构**

- `doc/` 项目需求与协议文档
- `src/main/` Electron 主进程
- `src/main/windows/` 主进程窗口管理
- `src/main/services/` 配置、IPC、后端 WS 等服务
- `src/preload/` 预加载脚本（安全 IPC）
- `src/renderer/` 前端渲染层（Vue3）
- `src/renderer/components/` UI 组件
- `src/shared/` 进程间共享类型
- `scripts/ensure-electron-entry.cjs` dev 启动前入口占位脚本
- `electron.vite.config.ts` Electron + Vite 配置
- `package.json` 运行脚本与依赖声明
- `tsconfig.json` TypeScript 配置

**运行入口**

- Electron 主进程：`src/main/index.ts`
- Preload：`src/preload/index.ts`
- Renderer：`src/renderer/main.ts`

**整体流程概览**

启动时由主进程创建覆盖层窗口并设置透明、置顶。窗口尺寸基于屏幕工作区宽高的比例（宽度 0.4，高度 0.25），位置贴顶且距左侧 0.1 屏幕宽度。主进程初始化配置存储与后端 WS 客户端，并注册 IPC 通道。渲染进程拉取配置与屏幕信息，加载 HUD 与面板 UI。配置变更由渲染进程广播给主进程，主进程持久化并转发给后端。后端 WS 推送识别状态与数据，主进程通过 IPC 发送给渲染进程显示。

**模块说明（主进程）**

`src/main/index.ts`：应用启动入口，创建窗口与后端连接，转发后端事件并处理 IPC 回调。

`src/main/windows/overlayWindow.ts`：创建覆盖层窗口与窗口参数，窗口尺寸与位置基于屏幕比例；锁定状态启用鼠标穿透。


`src/main/services/configStore.ts`：基于 electron-store 的配置持久化与深度合并更新。

`src/main/services/backendWs.ts`：后端 WebSocket 客户端，负责重连、发送 CONFIG_SET、START/STOP 等消息。

`src/main/services/ipcBridge.ts`：主进程 IPC 注册，提供配置、屏幕信息、后端控制等通道；新增外部链接通道 `external:openUrl`，统一通过系统默认浏览器打开链接；支持应用关闭通道 `app:close`（渲染进程触发后由主进程退出应用）。

**模块说明（预加载）**

`src/preload/index.ts`：通过 contextBridge 暴露最小化 API，确保渲染进程与系统能力隔离；包含 `openExternalUrl` 外链能力（由主进程执行）。

**模块说明（渲染进程）**

`src/renderer/main.ts`：Vue 应用挂载入口。

`src/renderer/App.vue`：全局状态容器，负责配置加载、标定流程、后端事件绑定、AoE4World 最近对局拉取与 HUD 组合展示。

`src/renderer/components/OverlayHUD.vue`：HUD 展示卡片，显示双方阵容信息、当前模式、连接与锁定状态；顶部采用紧凑响应式三区布局（中间模式区无边框）；编辑态提供“锁定”按钮与显眼的“?”帮助按钮（介绍按钮功能与快捷键）；右上角提供高层级的紧凑文字型“关闭”按钮（通过 IPC 触发主进程关闭应用）；在小宽度断点下进一步压缩模式卡片与队伍文本字号，并同步压缩帮助面板字体与尺寸，改善 1080p 下的展示完整性；帮助面板在小宽度下限制最大高度并启用纵向滚动，避免面板顶部越界；新增“收起/展开”按钮，收起后隐藏对局信息与双方信息，仅保留底部按钮栏；收起态仍保留右上角关闭按钮可用；双方战绩中的 W/L 场次在数值高于 1000 时按 `k` 简写显示且不保留小数（如 `1234 -> 1k`）；玩家信息行强制保持单行显示，超长内容使用省略号截断，避免因换行触发页面滚动条；1v1 与多 v 多模式下均按接口返回独立显示排位分与隐藏分，不再因为单排模式做互斥隐藏；当模式为 `RM_1V1` 时切换为专用三行信息布局，展示名称、战绩、胜率、排位分、隐藏分、当前段位图标、历史最高分与最高段位文案，并根据分数映射段位颜色，窄宽度下自动切换为纵向紧凑排布。


`src/renderer/components/CalibrationWizard.vue`：标定向导 UI，拖拽矩形生成 ROI，当前包含计时器、空闲村民、人口、资源与采集等区域；支持两行操作按钮（上一步/跳过/确认保存位置/下一步 与 完成并保存所有/退出/查看已标定位置）和已标定区域可视化。

`src/renderer/components/SettingsPanel.vue`：设置面板，使用本地表单态编辑并保存全量配置；支持维护我方 profileId 历史列表（展示 profileId + 玩家名、点击回填、删除历史项），并在对局信息拉取到玩家名后自动回写历史名称；profileId 输入框后缀提供“历史”按钮触发悬浮下拉，支持限高滚动与点击外部自动关闭，不占用表单布局空间；标题区与“取消/保存”操作同一行，小宽度断点下采用更紧凑的字号、间距和按钮尺寸，降低 1080p 下出现滚动的概率。

`src/renderer/env.d.ts`：window.api 的类型声明。

**共享类型**

`src/shared/types.ts`：前后端通信协议类型、配置结构、屏幕签名、ROI 定义等核心数据模型；对局玩家视图额外包含 `maxRating`、`rankLevel` 等单排展示所需字段。

**开发脚本说明**

`scripts/ensure-electron-entry.cjs`：dev 启动前创建 `dist/main/index.js` 与 `dist/preload/index.js` 占位文件，用于绕过 electron-vite 启动时的入口检测（构建产物会覆盖它）。

安装包打包：通过 `npm run pack:win` 调用 `electron-builder` 生成 Windows NSIS 安装包，输出目录为 `release/`。

**关键逻辑说明**

锁定与编辑状态：锁定状态下 HUD 窗口鼠标穿透且不抢焦点，`OverlayHUD` 组件根节点 `hud-root` 保持透明；未锁定（编辑态）时 `hud-root` 显示半透明背景，降低底层窗口干扰，便于点击按钮与查看内容。UI 仅提供“锁定”按钮（不提供解锁按钮），解锁与锁定切换通过全局快捷键完成（默认 `Alt+W`，若注册失败则使用 `Alt+Shift+W`）。

HUD 收起/展开逻辑：底部操作栏新增“收起/展开”按钮；收起后隐藏对局信息、双方阵容与状态文案，仅保留底部按钮栏，便于在小空间下最小化占位。

HUD 收起态补充：收起状态下右上角关闭按钮保持可点击，方便快速退出应用。

单实例启动策略：应用启动时申请 Electron 单实例锁；若检测到已有实例（包含同类旧版本实例）则新进程直接退出，并触发已运行实例置顶显示，避免重复弹出多个 HUD 窗口。

标定流程：进入标定时主窗口临时扩展为全屏并允许鼠标交互，完成或退出后恢复原始窗口大小与锁定状态。

配置同步策略：渲染进程更新配置后广播给主进程，主进程保存并推送 CONFIG_SET 给后端。

对局信息策略：通过 AoE4World `players/:profile_id/games/last?include_stats=true` 拉取最近对局，依据 `teams` 中包含当前 profileId 的队伍映射左右阵容；计时器首次出现与重开局时自动触发刷新，并在对局未更新时进行有限次重试；当已获取到 `ongoing=true` 但玩家 `rating/mmr` 缺失时，会在限次且限时窗口内继续补拉，避免因接口延迟补数导致展示中断。

标定与屏幕签名：标定生成 ROI 与窗口签名（基于当前窗口尺寸），签名用于分辨率变化提示。

OCR 配置：后端改为 Tesseract OCR，不再下发模板集与‘调试项，仅保留 `recognition` 与 `tts` 配置；识别字段包含计时器、空闲村民、人口、资源与采集等通道。

**构建输出**

- 主进程输出：`dist/main/index.js`
- Preload 输出：`dist/preload/index.js`
- Renderer 输出：`dist/renderer/index.html`

后端通信：连接成功后自动发送 CONFIG_SET，断线自动重连并重发最新配置。

**TODO（已完成）**

- 已搭建 Electron + Vue3 + electron-vite 基础工程结构。
- 已实现覆盖层窗口与锁定/编辑状态切换。
- 已实现配置存储与深度合并更新。
- 已实现后端 WS 客户端与自动重连骨架。
- 已实现 IPC 通道与 preload 安全 API。
- 已实现 HUD、控制面板、标定向导、设置面板的 MVP UI。
- 已为 dev 添加入口占位脚本以通过 electron-vite 入口检查。

**TODO（未完成/待完善）**

核心功能（影响稳定运行）：
- AoE4World API 字段映射已切换为 `games/last` 接口，但异常场景提示与显示细节仍可继续优化。
- 标定流程需增加 ROI 校验、最小矩形限制与已完成状态提示。
- 分辨率变化检测与“需重新标定”提示逻辑尚未落地。
- 后端消息类型扩展与 PONG 处理尚未接入。
- 快捷键 UI 配置与禁用逻辑未实现（当前默认 `Alt+W`）。

次要功能（非必要增强）：
- 后端连接状态与识别状态的 UI 细化与容错提示未完善。
- 识别频率与模板集的 UI 校验与范围限制需补充。
- 多显示器支持与 displayId 变更判断未实现。

**联调日志（临时）**

以下文件包含联调阶段的临时日志输出（测试结束后可移除）：
- `src/main/services/backendWs.ts`：WS 连接、CONFIG_SET 下发、消息收发日志
- `src/main/services/configStore.ts`：配置更新后的 ROI 数量日志
- `src/main/services/ipcBridge.ts`：配置更新入参日志
- `src/renderer/components/CalibrationWizard.vue`：标定保存/完成日志
- `src/renderer/App.vue`：标定应用配置日志
