import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "D:/LifeOS/outputs/lifeos-project-overview-20260913";
const outputPath = `${outputDir}/LifeOS_project_overview_AI_study_group_demo.xlsx`;
const font = "Arial";

async function buildTaskRows() {
  const tasksDir = "D:/LifeOS/tasks";
  const files = (await fs.readdir(tasksDir))
    .filter((name) => /^TASK-\d+.*\.md$/.test(name))
    .sort();
  const rows = [["Task", "任务名称", "状态", "优先级", "父级/范围", "目标摘要", "交流价值", "来源"]];

  for (const file of files) {
    const text = await fs.readFile(path.join(tasksDir, file), "utf8");
    const taskId = file.match(/TASK-\d+/)?.[0] ?? "";
    const heading = text.match(/^#\s+(.+)$/m)?.[1]?.replace(/^TASK-\d+[:\s-]*/, "").trim() ?? "";
    const status = text.match(/^- Status:\s*(.+)$/m)?.[1]?.trim()
      ?? text.match(/^Status:\s*(.+)$/m)?.[1]?.trim()
      ?? "";
    const priority = text.match(/^- Priority:\s*(.+)$/m)?.[1]?.trim() ?? "";
    const parent = text.match(/^- Parent Task:\s*(.+)$/m)?.[1]?.trim() ?? "";
    const goal = text.match(/^## Goal\s*\r?\n+([\s\S]*?)(?:\r?\n## |\r?\n# |$)/m)?.[1]
      ?.split(/\r?\n/)
      .map((line) => line.replace(/^[-*> ]+/, "").trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(" ")
      ?? "";
    rows.push([
      taskId,
      heading,
      status,
      priority,
      parent,
      goal,
      taskStory(taskId, heading, parent),
      `tasks/${file}`,
    ]);
  }
  return rows;
}

function taskStory(taskId, heading, parent) {
  const text = `${taskId} ${heading} ${parent}`.toLowerCase();
  if (text.includes("workflow") || text.includes("rework") || text.includes("review")) {
    return "展示 AI 多窗口协作如何靠状态机、门禁和任务档案保持边界。";
  }
  if (text.includes("android")) {
    return "展示从 Web/后端走向移动端执行入口的工程节奏。";
  }
  if (text.includes("pc web") || text.includes("web")) {
    return "展示前端从身份、列表、今日视图到同步刷新逐步闭环。";
  }
  if (text.includes("sync") || text.includes("sse")) {
    return "展示跨端同步不是即时协同，而是 durable change log + wake-up。";
  }
  if (text.includes("todo") || text.includes("category")) {
    return "展示先把最小日用 Todo 能力做稳，再扩展 LifeOS。";
  }
  return "展示小步任务、明确验收和可追溯交付。";
}

const sources = [
  ["需求定位", "docs/requirements.md", "1 Product Positioning", "LifeOS is a personal life and project operating system for the AI era; core purpose includes life state, goals, project progress, and AI collaboration context."],
  ["平台范围", "docs/requirements.md", "4 Platform Scope", "PC Web focuses on Dashboard, Projects/Goals, Resume Progress, AI Workspace, logs, Calendar, Notes; Android focuses on Todo, reminders, fast capture, widgets."],
  ["MVP原则", "docs/mvp.md", "1 MVP Principle", "Smallest useful loop: two users separately manage Todos and see changes sync between PC Web and Android before advanced reminder behavior."],
  ["Phase规划", "docs/mvp.md", "3-7 Phase Plan", "Phase 1 Todo/Reminder/Sync; Phase 2 Projects/Goals; Phase 3 AI Workspace Basic; Phase 4 Notes/Calendar; Phase 5 Widgets."],
  ["架构总览", "docs/architecture.md", "1 Architecture Summary", "PC Web React/Vite, Android Native Kotlin, Backend Python/FastAPI, PostgreSQL, REST writes plus SSE notifications, COS reserved."],
  ["同步模型", "docs/architecture.md", "6 Synchronization Model", "REST writes commit sync_changes and emit lightweight sync.available SSE events; clients pull durable changes by cursor."],
  ["AI Workspace", "docs/requirements.md", "9 AI Workspace", "Structured AI collaboration context store; V1 records AI Sessions manually and provides prompt templates/copy prompt."],
  ["AI数据模型", "docs/architecture.md", "11 AI Workspace Data Notes", "AI Session can be stored as specialized log record plus structured session table linked to project_logs."],
  ["AI扩展点", "docs/architecture.md", "13 Future Extension Points", "Reserved future features include Git scanning, Git diff summary, AI-generated progress estimate, AI-generated Todo, knowledge base API, GitHub, MCP."],
  ["当前进度", "docs/phase1a-progress.md", "Platform Completion", "Phase 1A backend done, PC Web done, Android next/active, PC/Android end-to-end pending."],
  ["完成审计", "docs/phase1a-completion-audit.md", "Verdict", "Backend complete, PC Web complete, Android not started at audit baseline, overall loop incomplete until Android and E2E acceptance."],
  ["当前任务", "handoff/current-task.md", "Current Stage", "TASK-027 Android toolchain and runnable Compose foundation is in REVIEWING, next role Git Commit."],
  ["后端依赖", "backend/pyproject.toml", "project dependencies", "FastAPI, SQLAlchemy, Alembic, PostgreSQL driver, Pydantic Settings, Uvicorn, Argon2id, Pytest/HTTPX."],
  ["前端依赖", "web/package.json", "dependencies", "React, Vite, TypeScript, Vitest, Playwright, eventsource-parser, lucide-react, Manrope font."],
  ["Android依赖", "android/app/build.gradle.kts", "android config", "Kotlin, Jetpack Compose, Material 3, minSdk 26, compileSdk/targetSdk 36, debug API base 10.0.2.2."],
];

const overview = [
  ["项目名称", "LifeOS"],
  ["一句话定位", "AI 时代的个人生活与项目操作系统，用于管理个人状态、长期目标、项目进展和 AI 协作上下文。"],
  ["目标用户", "V1 面向 me / partner 两个身份，功能相同、数据隔离，不做注册、密码登录或团队协作。"],
  ["MVP主线", "先做可日用的 Todo + 身份隔离 + PC/Android 同步闭环，再逐步加入提醒、目标恢复、AI Workspace、Notes/Calendar、Widgets。"],
  ["当前状态", "Phase 1A 后端和 PC Web 已完成；Android 基础任务 TASK-027 处于 REVIEWING，PC/Android 端到端验收仍待完成。"],
  ["对学习小组的讲述重点", "这是一个从个人效率工具逐步演进到 AI 协作上下文系统的产品，不只是 Todo。"],
];

const requirements = [
  ["主题", "生活里的问题", "想要的体验", "先做什么", "来源"],
  ["为什么做 LifeOS", "每天有很多零散任务、长期目标和 AI 对话散在不同地方，真正麻烦的是“下次从哪里继续”。", "打开系统先看到今天最重要的事、正在推进的目标、下一步行动和可以继续给 AI 的 prompt。", "先用 Todo + 同步把日用闭环跑起来，再把项目恢复和 AI 上下文接进来。", "docs/requirements.md §1; docs/mvp.md §1"],
  ["两个人怎么用", "我和 partner 都会用，但生活数据不能混在一起；又不想一开始就做复杂账号系统。", "第一次选择身份，之后看到的是自己的 Todo、目标和提醒。", "V1 只做 me / partner 两个身份的数据隔离。", "docs/requirements.md §2-3"],
  ["电脑上想解决什么", "坐在电脑前时，更常见的问题不是“记一个小事”，而是项目做到哪了、上次 AI 帮我做了什么、下一步该接哪里。", "PC 更像复盘和继续工作的工作台：Dashboard、Projects/Goals、AI Workspace、日志、Notes、Calendar。", "先完成 PC Web 的身份、Todo、Today、分类、编辑、完成和同步刷新。", "docs/requirements.md §4; docs/phase1a-progress.md"],
  ["手机上想解决什么", "生活里的执行通常发生在手机上：临时记事、提醒、强提醒、完成任务、看一眼今天要做什么。", "Android 更像随身执行入口：快速添加、今日 Todo、提醒、Widget。", "当前先把 Android 可运行基础打好，下一步再接身份和 Todo。", "docs/requirements.md §4; docs/mvp.md §3; handoff/current-task.md"],
  ["长期目标怎么不断线", "学习、开发、健康、生活计划都不是一天完成的，隔几天回来很容易忘掉状态。", "每个 Project/Goal 都有阶段、进度、里程碑、日志和下一步。", "Phase 2 再做 Projects/Goals；当前用任务档案和 Todo 先支撑开发过程。", "docs/requirements.md §7; docs/mvp.md §4"],
  ["继续进度怎么讲清楚", "真正需要的是一句话告诉我：上次做完什么、现在卡在哪、下一步做什么。", "开发项目显示 Continue Development，其他目标显示 Continue Progress。", "先在需求里定义恢复视角，等 Projects/Goals 与 AI Session 接入后落地。", "docs/requirements.md §8; docs/mvp.md §4"],
  ["提醒为什么重要", "Todo 只记录事情还不够，生活里真正难的是在合适的时候被可靠地叫醒。", "普通提醒处理日常提醒，强提醒用于不能错过的事情。", "先做 Todo；普通提醒、强提醒和重复任务分阶段验证，尤其强提醒要先验证 Android 权限和系统限制。", "docs/requirements.md §10-12; docs/mvp.md §3"],
  ["轻量记录和日历", "有些东西只是快速记一下，或者希望按时间回看，不想再维护一套复杂知识库/日历。", "Notes 用于快记，Calendar 聚合 Todo、提醒、里程碑、日志和 AI Sessions。", "Phase 4 做轻量 Notes + Calendar 聚合，不做完整知识库和第二套日历系统。", "docs/requirements.md §13-15; docs/mvp.md §6"],
];

const tech = [
  ["层", "技术选型", "为什么适合当前阶段", "已验证/当前状态", "来源"],
  ["Backend", "Python + FastAPI", "开发速度快，API 合同清晰，适合自托管低流量服务。", "Phase 1A API 已完成；测试覆盖 Todo/category/auth/sync/SSE。", "docs/architecture.md §1; backend/pyproject.toml; docs/phase1a-progress.md"],
  ["Database", "PostgreSQL + SQLAlchemy + Alembic", "需要持久化身份隔离、Todo、同步游标、软删除和版本字段。", "迁移基础与 sync_changes 已验证。", "docs/architecture.md §9; backend/pyproject.toml"],
  ["Sync", "REST 写入 + sync_changes + SSE wake-up", "简单可靠：写操作进入 durable change log，SSE 只唤醒客户端拉取。", "GET /sync/changes 与 /sync/events 已完成。", "docs/architecture.md §6; docs/phase1a-progress.md"],
  ["PC Web", "React + Vite + TypeScript", "适合快速构建 Dashboard、Todo 管理与后续 AI Workspace。", "PC Web Phase 1A 已完成，含 Vitest/Playwright 验证。", "docs/architecture.md §1; web/package.json; docs/phase1a-completion-audit.md"],
  ["Android", "Native Kotlin + Jetpack Compose + Material 3", "提醒、Widget、锁屏/全屏能力更贴近原生 Android。", "TASK-027 建立可构建、可安装的 Compose 基础。", "docs/architecture.md §3; android/app/build.gradle.kts; handoff/current-task.md"],
  ["Android Local", "Room / DataStore / WorkManager（推荐）", "Room 做本地关系缓存，DataStore 存轻量设置，WorkManager 做后台同步和重试。", "规划于架构文档；当前 Android 基础任务未引入业务同步。", "docs/architecture.md §3; handoff/current-task.md"],
  ["Auth", "per-identity bootstrap token + bearer token", "V1 不做完整账号体系，但要求请求不能只靠可见 user_id。", "后端按 token 解析身份，Phase 1A 合同稳定。", "docs/architecture.md §5; docs/mvp.md §3"],
  ["Files", "Tencent COS reserved", "附件不是 V1 核心，但预留后续 Notes/Projects/AI Sessions 附件链接。", "V1 延期附件上传，只保留架构扩展点。", "docs/architecture.md §1, §12"],
];

const aiPlan = [
  ["阶段", "我希望AI帮什么忙", "生活/学习里的价值", "怎么一步步做", "边界感", "来源"],
  ["第一步：把上下文留下来", "不是再做一个聊天软件，而是把每次 AI 协作沉淀成一条 AI Session。", "下次继续项目时，不用翻聊天记录找“上次做到哪了”，系统会留下目标、完成内容、验证结果、遗留问题和下一步。", "先手动记录 AI Session，并关联到 Project/Goal；这一步最朴素，但最可靠。", "AI 先做记录和整理，不自动替我改生活状态。", "docs/requirements.md §9; docs/mvp.md §5"],
  ["第二步：帮我恢复进度", "在 Dashboard / Resume Progress 里显示最近 AI 会话摘要和推荐下一条 prompt。", "我隔几天回来，也能快速进入状态：知道上次做了什么、现在卡在哪、下一句该怎么问 AI。", "Project/Goal 接入 AI Session 后，把 latest summary 和 recommended prompt 放到继续进度视图。", "推荐 prompt 是入口，不是强制行动。", "docs/requirements.md §6, §8-9"],
  ["第三步：给出建议但让我确认", "AI 可以建议项目进度、下一步任务，甚至从遗留问题里整理 Todo。", "减少人工复盘负担，让长期目标更容易被推进，但最终决定仍由我确认。", "先做 AI suggested progress，之后再做 AI-generated Todo；保存前需要用户确认。", "不让 AI 静默写入关键进度或任务。", "docs/requirements.md §7; docs/mvp.md §8; docs/architecture.md §13"],
  ["第四步：减少手工填写", "让系统读取 Git diff 或本地项目变化，自动补全修改文件、完成工作和验证线索。", "开发类学习/项目分享时，AI 工作流可以自动生成更完整的阶段记录。", "未来接入 Git repository scanning、local project directory access、Git diff summary。", "先服务开发项目，不把它泛化成监控所有个人文件。", "docs/requirements.md §9; docs/architecture.md §13"],
  ["第五步：连接我的知识和工具", "把知识库、GitHub、MCP 等外部上下文接进来，让 AI 能基于真实资料继续协作。", "AI 不只回答问题，还能在我的个人系统里理解项目背景、引用资料、连接执行工具。", "未来做 Knowledge base API、GitHub integration、MCP integration。", "外部集成要有清晰权限和可追溯来源。", "docs/mvp.md §8; docs/architecture.md §13"],
  ["分享时的重点", "LifeOS 里的 AI 不是替代人做决定，而是帮助我保存上下文、恢复状态、生成候选行动。", "最有价值的不是炫酷自动化，而是减少长期项目里的遗忘、断片和重复解释。", "从手动结构化记录开始，逐步走向半自动建议，再走向外部工具集成。", "每一步都保留用户确认和状态追溯。", "docs/requirements.md §1, §9; docs/workflow.md"],
];

const talk = [
  ["段落", "建议讲法", "可展开点"],
  ["开场", "LifeOS 不是 Todo 应用，而是 AI 时代的个人生活和项目操作系统。", "Todo 是第一条日用闭环；真正目标是让个人长期项目、生活状态和 AI 协作上下文可以恢复。"],
  ["为什么先做 Todo + Sync", "先做最小可用闭环：两个身份各自管理 Todo，并在 PC Web 与 Android 之间同步。", "这能先验证身份隔离、API、同步、客户端刷新和移动端执行体验。"],
  ["技术取舍", "技术栈保持简单：FastAPI + PostgreSQL 做后端，React/Vite 做 PC Web，Android 用原生 Kotlin/Compose。", "不急着上复杂协同、CRDT 或完整账号系统，先保证可维护和可验证。"],
  ["AI计划", "AI 不是做一个聊天窗口，而是沉淀结构化协作上下文。", "AI Session 记录目标、产出、修改文件、验证结果、遗留问题和推荐下一条 prompt。"],
  ["后续想象", "后续可让 AI 读取 Git diff、生成进度建议、生成 Todo，并通过知识库/GitHub/MCP 接入更多上下文。", "但这些都要以用户确认和可靠数据模型为前提，避免自动化误写个人系统。"],
  ["当前状态", "后端和 PC Web 的 Phase 1A 已完成；Android 基础正在收口；完整 PC/Android 端到端同步仍是下一阶段重点。", "讲清楚完成与未完成，学习小组会更容易理解工程节奏。"],
];

const todoRows = [
  ["身份", "Todo标题", "分类", "优先级", "计划日期", "截止时间", "提醒时间", "状态", "演示点"],
  ["me", "整理 LifeOS 项目介绍", "AI", "High", "2026-09-13", "2026-09-13 14:00", "2026-09-13 13:30", "Pending", "今日任务 + AI 分类 + 普通提醒"],
  ["me", "完成 Android Compose 基础提交", "Project", "High", "2026-09-13", "2026-09-13 18:00", "", "Pending", "关联当前 TASK-027，展示项目推进"],
  ["me", "复盘 PC Web 同步验收证据", "Work", "Medium", "2026-09-13", "", "", "Completed", "展示已完成任务不会混入 partner"],
  ["partner", "准备晚餐食材清单", "Life", "Medium", "2026-09-13", "2026-09-13 17:30", "2026-09-13 16:30", "Pending", "展示另一身份的数据隔离"],
  ["partner", "晚上运动打卡", "Health", "Low", "2026-09-13", "", "2026-09-13 20:30", "Pending", "展示轻量生活任务和提醒"],
  ["me", "记录下一次 AI 协作入口", "AI", "Medium", "2026-09-14", "", "", "Pending", "展示 Resume Progress 的下一步"],
];

const projectRows = [
  ["项目/目标", "类型", "状态", "阶段", "进度", "下一步", "最新AI会话", "推荐下一条Prompt", "演示点"],
  ["LifeOS Phase 1A", "Development", "In progress", "Android foundation", 0.78, "完成 TASK-027 Git Commit 后进入 Android identity slice", "Android Compose foundation review", "请基于当前 TASK-027 结果，规划 Android 身份选择和 /me 校验的最小实现切片。", "展示 Continue Development"],
  ["AI 学习小组分享", "Learning", "Planning", "材料整理", 0.35, "用项目概要 Excel 生成 3-5 分钟讲稿", "Project overview workbook", "请把 LifeOS 项目概要整理成面向 AI 学习小组的 3 分钟口播。", "展示非开发目标的 Continue Progress"],
  ["家庭健康提醒", "Health", "Paused", "需求收集", 0.2, "等强提醒能力验证后再拆任务", "", "", "展示强提醒还在后续阶段"],
  ["知识库联动", "Other", "Planning", "外部链接", 0.1, "先定义 Notes 外部知识库链接字段", "", "", "展示 KnowledgeBase 先链接、不全文同步"],
];

const aiRows = [
  ["会话", "关联项目", "AI工具", "目标", "已完成", "修改文件/产物", "验证结果", "遗留问题", "下一步", "推荐Prompt"],
  ["Project overview workbook", "AI 学习小组分享", "Codex", "整理需求、技术选型、AI 计划到 Excel", "生成 5 张项目概要表，并补充来源与讲稿提示", "LifeOS_project_overview_AI_study_group.xlsx", "导出成功；公式错误扫描 0；关键表 PNG 预览正常", "需要为现场演示补充 demo 数据", "加入 Todo/项目/AI会话样例", "请在概要 workbook 中加入少量用于演示的测试数据，并标注 demo data。"],
  ["Android Compose foundation review", "LifeOS Phase 1A", "Codex", "验证 Android 基础工程可构建、可安装、非空渲染", "完成 Kotlin/Compose 基础、API base 校验、debug cleartext 策略", "android/**; docs/adr/0001-android-foundation.md", "任务处于 REVIEWING；待 Git Commit 发布", "PC/Android 端到端验收尚未完成", "进入 Android identity validation", "请基于 TASK-027 的 Android 基础，做身份选择和 /me 校验的最小垂直切片。"],
  ["PC Web sync recovery", "LifeOS Phase 1A", "Codex", "实现认证 SSE refresh 和 durable sync recovery", "PC Web Phase 1A 关闭；107 tests/build/Playwright/audit gate 通过", "web/src/sync-*; web/src/App.sync.test.tsx", "已完成并发布", "真实跨设备联调依赖 Android 客户端", "等待 Android 同步读写实现", "请设计 Android local cache + sync pull 的最小可验收路径。"],
];

const workflowRows = [
  ["角色窗口", "核心问题", "主要输入", "主要输出", "关键边界", "交流亮点"],
  ["Decision", "下一步该做什么，范围是否清楚？", "需求/MVP/架构、项目状态、未解决问题、用户最新方向", "handoff/current-task.md + tasks/TASK-xxx.md，状态 PLANNED", "不能在已有 READY/IN_PROGRESS/REVIEWING/CHANGES_REQUESTED/BLOCKED 任务时发布新主任务。", "AI 先做产品/工程决策，不直接写代码。"],
  ["Task Review", "这个任务能安全开工吗？", "current-task、任务档案、worktree 状态、验收标准", "task-review-gate.md；PASS 后两处任务状态同步为 READY", "只审查开工准备，不审实现，不启动 Coding。", "把“需求是否足够清楚”变成门禁。"],
  ["Git Snapshot", "这项任务从哪个精确代码状态开始？", "READY 任务、分支、HEAD、diff、staged/unstaged 状态", "git-snapshot.md；必要时 snapshot commit；状态 IN_PROGRESS", "只记录/建立基线，不写业务代码。", "防止 AI 在脏工作区里把边界搅乱。"],
  ["Coding", "如何只完成批准范围内的实现？", "IN_PROGRESS 任务、Task Review PASS、Snapshot COMPLETE、相关代码/测试", "实现变更、验证记录；完成后状态 REVIEWING", "只改 in-scope 文件；发现范围外问题写 issue-log，不顺手修。", "AI 写代码前必须证明自己拿到了正确任务和基线。"],
  ["Code Review", "批准任务是否被正确完成？", "REVIEWING 任务、diff、测试证据、验收标准", "code-review-gate.md；PASS 授权 Git Commit，或 CHANGES_REQUESTED 路由回 Coding", "不批准开工；PASS 不直接把任务改 COMPLETED。", "把 AI 自查和独立审查分成两个角色。"],
  ["Git Commit", "能否发布已审查结果？", "Code Review PASS、精确 reviewed diff、状态文件", "result commit、git-commit.md；成功后任务状态 COMPLETED", "不修实现逻辑，不混入任务外文件。", "发布动作独立，避免写代码的 AI 顺手提交不该提交的东西。"],
  ["Decision Closure", "发布后任务是否真正收口？", "result commit、远端一致性、review/test evidence、issue disposition", "Closure PASS/BLOCKED、必要的里程碑/进度更新", "Closure Check 属于 Decision，不是另一个随意窗口。", "任务结束也有门禁，方便长期项目持续推进。"],
  ["Terminal Closure Commit", "闭环文档能否终结发布？", "Decision Closure PASS 和明确批准的文档 diff", "docs(task): close TASK-xxx；远端 parity 后回到 Decision", "只提交 closure 文档，不触发第二次 closure check。", "把“做完了”变成可追溯的项目记忆。"],
];

const statusRows = [
  ["状态", "含义", "下一步"],
  ["PLANNED", "Decision 已写任务，Task Review 未批准。", "Task Review"],
  ["READY", "Task Review 已批准，可以建立 Git Snapshot。", "Git Snapshot"],
  ["IN_PROGRESS", "Snapshot 完成，Coding 可以实现。", "Coding"],
  ["BLOCKED", "需要 Decision 输入、依赖解决或环境变化。", "Decision 处理阻塞"],
  ["REVIEWING", "Coding 完成，Code Review 活跃。", "Code Review 或 Git Commit"],
  ["CHANGES_REQUESTED", "Code Review 拒绝实现，Coding 需修复阻塞问题。", "Coding guarded rework"],
  ["COMPLETED", "Code Review 通过且 Git Commit 已发布结果。", "Decision Closure/下一任务"],
  ["CANCELLED", "Decision 取消任务。", "结束"],
];

function setWidths(sheet, widths) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  widths.forEach((width, idx) => {
    const col = letters[idx];
    sheet.getRange(`${col}:${col}`).format.columnWidth = width;
  });
}

function styleSheet(sheet, usedRange, headerRange = null) {
  sheet.showGridLines = false;
  usedRange.format.font = { name: font, size: 10, color: "#1F2937" };
  usedRange.format.verticalAlignment = "center";
  usedRange.format.wrapText = true;
  if (headerRange) {
    headerRange.format = {
      fill: "#1F4E78",
      font: { name: font, size: 10, bold: true, color: "#FFFFFF" },
    };
    headerRange.format.horizontalAlignment = "center";
  }
  usedRange.format.borders = {
    insideHorizontal: { style: "thin", color: "#E5E7EB" },
    insideVertical: { style: "thin", color: "#F3F4F6" },
    bottom: { style: "thin", color: "#D1D5DB" },
  };
  usedRange.format.autofitRows();
}

function addTitle(sheet, title, subtitle, lastColLetter) {
  sheet.getRange(`A2:${lastColLetter}2`).merge(true);
  sheet.getRange("A2").values = [[title]];
  sheet.getRange("A2").format.font = { name: font, size: 16, bold: true, color: "#111827" };
  sheet.getRange("A3").values = [[subtitle]];
  sheet.getRange(`A3:${lastColLetter}3`).merge(true);
  sheet.getRange("A3").format.font = { name: font, size: 10, italic: true, color: "#4B5563" };
  sheet.getRange(`A4:${lastColLetter}4`).format.borders = { bottom: { style: "thin", color: "#9CA3AF" } };
}

const workbook = Workbook.create();

const wsOverview = workbook.worksheets.add("项目总览");
addTitle(wsOverview, "LifeOS 项目概要", "面向 AI 学习小组介绍：需求、技术选型、当前进度和 AI 计划。", "D");
wsOverview.getRange("A6:B11").values = overview;
wsOverview.getRange("A6:A11").format = { fill: "#EAF2F8", font: { name: font, bold: true, color: "#1F4E78" } };
styleSheet(wsOverview, wsOverview.getRange("A6:B11"));
setWidths(wsOverview, [22, 92, 20, 20]);
wsOverview.freezePanes.freezeRows(5);
wsOverview.tabColor = "#1F4E78";

const wsReq = workbook.worksheets.add("需求分析");
addTitle(wsReq, "需求分析", "从需求文档和 MVP 计划抽取，适合作为介绍时的主干。", "E");
wsReq.getRange("A6:E14").values = requirements;
styleSheet(wsReq, wsReq.getRange("A6:E14"), wsReq.getRange("A6:E6"));
setWidths(wsReq, [20, 68, 56, 58, 30]);
wsReq.freezePanes.freezeRows(6);
wsReq.tabColor = "#2E75B6";

const wsTech = workbook.worksheets.add("技术选型");
addTitle(wsTech, "技术选型", "保持自托管、低流量、易验证的简单架构，避免过早复杂化。", "E");
wsTech.getRange("A6:E14").values = tech;
styleSheet(wsTech, wsTech.getRange("A6:E14"), wsTech.getRange("A6:E6"));
setWidths(wsTech, [18, 34, 48, 46, 32]);
wsTech.freezePanes.freezeRows(6);
wsTech.tabColor = "#5B9BD5";

const wsAI = workbook.worksheets.add("AI计划");
addTitle(wsAI, "后续 AI 计划", "仓库中已有明确规划：先结构化记录 AI 协作，再逐步引入自动化生成和外部上下文集成。", "F");
wsAI.getRange("A6:F13").values = aiPlan;
styleSheet(wsAI, wsAI.getRange("A6:F13"), wsAI.getRange("A6:F6"));
setWidths(wsAI, [18, 36, 42, 54, 34, 34]);
wsAI.freezePanes.freezeRows(6);
wsAI.tabColor = "#70AD47";

const wsTalk = workbook.worksheets.add("来源与讲稿提示");
addTitle(wsTalk, "来源与讲稿提示", "左侧是可直接用于介绍的讲述顺序；下方列出本 workbook 的主要项目来源。", "D");
wsTalk.getRange("A6:C12").values = talk;
styleSheet(wsTalk, wsTalk.getRange("A6:C12"), wsTalk.getRange("A6:C6"));
setWidths(wsTalk, [18, 70, 72, 20]);
wsTalk.getRange("A15:D15").values = [["来源主题", "文件", "位置", "摘要"]];
wsTalk.getRange("A16:D30").values = sources;
styleSheet(wsTalk, wsTalk.getRange("A15:D30"), wsTalk.getRange("A15:D15"));
wsTalk.freezePanes.freezeRows(6);
wsTalk.tabColor = "#A5A5A5";

const wsTodo = workbook.worksheets.add("演示数据-Todo");
addTitle(wsTodo, "演示数据 - Todo", "仅用于现场演示，不代表真实生产数据。覆盖身份隔离、今日任务、提醒、分类和状态。", "I");
wsTodo.getRange("A6:I12").values = todoRows;
styleSheet(wsTodo, wsTodo.getRange("A6:I12"), wsTodo.getRange("A6:I6"));
wsTodo.getRange("A1").values = [["DEMO DATA"]];
wsTodo.getRange("A1").format.font = { name: font, size: 9, bold: true, color: "#B45309" };
setWidths(wsTodo, [12, 32, 14, 12, 18, 20, 20, 14, 42]);
wsTodo.freezePanes.freezeRows(6);
wsTodo.tabColor = "#FFC000";

const wsProject = workbook.worksheets.add("演示数据-项目");
addTitle(wsProject, "演示数据 - 项目/目标", "用于演示 Continue Development / Continue Progress、项目阶段、下一步和推荐 prompt。", "I");
wsProject.getRange("A6:I10").values = projectRows;
styleSheet(wsProject, wsProject.getRange("A6:I10"), wsProject.getRange("A6:I6"));
wsProject.getRange("E7:E10").format.numberFormat = "0%";
wsProject.getRange("A1").values = [["DEMO DATA"]];
wsProject.getRange("A1").format.font = { name: font, size: 9, bold: true, color: "#B45309" };
setWidths(wsProject, [24, 16, 16, 24, 12, 48, 30, 66, 34]);
wsProject.freezePanes.freezeRows(6);
wsProject.tabColor = "#ED7D31";

const wsAi = workbook.worksheets.add("演示数据-AI会话");
addTitle(wsAi, "演示数据 - AI Session", "用于演示 AI Workspace 的结构化记录：目标、产出、验证、遗留问题、下一步和推荐 prompt。", "J");
wsAi.getRange("A6:J9").values = aiRows;
styleSheet(wsAi, wsAi.getRange("A6:J9"), wsAi.getRange("A6:J6"));
wsAi.getRange("A1").values = [["DEMO DATA"]];
wsAi.getRange("A1").format.font = { name: font, size: 9, bold: true, color: "#B45309" };
setWidths(wsAi, [28, 24, 12, 34, 48, 38, 42, 42, 38, 66]);
wsAi.freezePanes.freezeRows(6);
wsAi.tabColor = "#70AD47";

const taskRows = await buildTaskRows();
const wsTasks = workbook.worksheets.add("任务档案");
addTitle(wsTasks, "任务档案", "从 tasks/TASK-*.md 自动汇总，适合展示 LifeOS 如何把 AI 协作沉淀成可追溯任务链。", "H");
wsTasks.getRange(`A6:H${5 + taskRows.length}`).values = taskRows;
styleSheet(wsTasks, wsTasks.getRange(`A6:H${5 + taskRows.length}`), wsTasks.getRange("A6:H6"));
setWidths(wsTasks, [12, 38, 16, 12, 30, 72, 54, 38]);
wsTasks.freezePanes.freezeRows(6);
wsTasks.tabColor = "#8064A2";

const wsWorkflow = workbook.worksheets.add("AI工作流");
addTitle(wsWorkflow, "AI 多窗口工作流", "把 AI 协作拆成多个职责窗口，用 durable files 代替聊天记忆，保持范围、证据和交接清楚。", "F");
wsWorkflow.getRange("A6:F14").values = workflowRows;
styleSheet(wsWorkflow, wsWorkflow.getRange("A6:F14"), wsWorkflow.getRange("A6:F6"));
setWidths(wsWorkflow, [20, 36, 46, 48, 56, 42]);
wsWorkflow.getRange("A17:C25").values = statusRows;
styleSheet(wsWorkflow, wsWorkflow.getRange("A17:C25"), wsWorkflow.getRange("A17:C17"));
setWidths(wsWorkflow, [20, 36, 46, 48, 56, 42]);
wsWorkflow.freezePanes.freezeRows(6);
wsWorkflow.tabColor = "#7030A0";

for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  used.format.autofitRows();
}

workbook.recalculate();

const overviewInspect = await workbook.inspect({
  kind: "table",
  range: "项目总览!A1:D14",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 8,
});
console.log(overviewInspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

for (const sheetName of ["项目总览", "需求分析", "技术选型", "AI计划", "来源与讲稿提示", "演示数据-Todo", "演示数据-项目", "演示数据-AI会话", "任务档案", "AI工作流"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  const safeName = sheetName.replace(/[\\/:*?"<>|]/g, "_");
  await fs.writeFile(`${outputDir}/${safeName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`Saved ${outputPath}`);
