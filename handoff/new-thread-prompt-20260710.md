# LifeOS New Codex Thread Prompt

Use this prompt when starting a new Codex thread in the `D:\LifeOS` project.

```text
你现在接手 LifeOS 项目。请注意：本项目目录是 D:\LifeOS，不是 D:\个人加班账本。

请先阅读以下文件，不要直接写代码：

- D:\LifeOS\docs\requirements.md
- D:\LifeOS\docs\architecture.md
- D:\LifeOS\docs\mvp.md
- D:\LifeOS\docs\data-model-phase1.md
- D:\LifeOS\docs\api-phase1a.md

项目背景：

LifeOS 是一个个人/情侣自用的生活与项目操作系统，不是公开上线推广产品。V1 供两个人使用：我和对象。两个人功能一致，但数据分开。V1 不做账号密码、不做公开注册、不做 OAuth、不做复杂权限。

核心定位：

- Android 负责 Todo、提醒、快速记录、小组件。
- PC Web 负责 Dashboard、Projects/Goals、AI Workspace、开发/目标恢复上下文。
- Phase 1 先做 Todo + Reminder + Sync，但已拆成多个 gate。

已确认技术方向：

- PC Web: React + Vite
- Android: Kotlin 原生
- Backend: Python + FastAPI
- Database: PostgreSQL
- Android local: Room + DataStore + WorkManager
- Sync: REST writes + sync_changes pull recovery + SSE wake-up
- Files/COS 暂时预留

重要 review 结论：

1. 原 Phase 1 范围过大，已经拆成 Phase 1A-1E。
2. Phase 1A 只做 Todo CRUD + 两人隔离 + PC/Android 同步闭环。
3. 强提醒 full-screen 不属于 Phase 1A，放到 Phase 1C 先做可行性验证。
4. Reminder API、Recurring Todo API、Reminder events、离线 pending operation replay 都不属于 Phase 1A。
5. 仅靠 updated_at/deleted_at 做同步恢复风险较高，已改为轻量 sync_changes 表。
6. 所有写接口需要 Idempotency-Key，并新增 idempotency_keys 表。
7. Android pending operation 后续需要 client_operation_id、device_id、base_version/base_updated_at、server ack。
8. 循环任务需要唯一约束，但属于 Phase 1D，不进入 Phase 1A API。
9. Reminder 状态机已补，但属于 Phase 1B/1C，不进入 Phase 1A API。
10. 身份安全边界为 per-identity bootstrap token。token 推导 user_id，客户端不传 user_id。

Phase 1 gates：

- Phase 1A: Todo CRUD + two-user isolation + PC/Android sync
- Phase 1B: Normal reminder scheduling and notification
- Phase 1C: Strong reminder full-screen prototype and Android permission validation
- Phase 1D: Recurring Todo template and 7-day instance generation
- Phase 1E: Limited Android offline queue and conflict handling

Phase 1A API 范围已写入 D:\LifeOS\docs\api-phase1a.md：

- GET /api/v1/me
- GET /api/v1/todo-categories
- POST /api/v1/todo-categories
- PATCH /api/v1/todo-categories/{id}
- DELETE /api/v1/todo-categories/{id}
- GET /api/v1/todos
- GET /api/v1/todos/today
- POST /api/v1/todos
- GET /api/v1/todos/{id}
- PATCH /api/v1/todos/{id}
- POST /api/v1/todos/{id}/complete
- POST /api/v1/todos/{id}/reopen
- DELETE /api/v1/todos/{id}
- GET /api/v1/sync/changes
- GET /api/v1/sync/events

Phase 1A 明确排除：

- Reminder API
- Recurring Todo API
- Strong reminder API
- Android offline pending operation replay API
- Full login/account system

当前 API 设计已确认：

- API base path: /api/v1
- Auth: Authorization: Bearer <identity_token>
- token 由服务端初始化生成，客户端手动录入保存。
- 数据库存 bootstrap_token_hash，不存明文 token。
- 客户端永远不传 user_id。
- 所有写接口必须带 Idempotency-Key: <uuid>。
- 幂等记录保留 7 天。
- 相同 user + key + 相同请求返回首次响应。
- 相同 user + key + 不同请求返回 409 idempotency_key_conflict。
- 所有写接口返回 sync.cursor。
- SSE 只发 sync.available + latest_cursor，不发实体数据。
- GET /api/v1/sync/changes 返回 snapshot 或 tombstone。
- sync cursor 使用全局递增 bigint。
- sync changes 支持 limit，默认 100，最大 500。
- Today Todo API 返回聚合结构，不返回裸列表。
- Today sections: overdue, due, planned, inbox_recent。
- Today 单归属优先级: overdue > due > planned > inbox_recent。
- inbox_recent 最多 5 条。
- Todo 删除软删除。
- Category 删除软删除，已有 Todo 保留 category_id。
- Todo 完成使用 POST /api/v1/todos/{id}/complete。
- Todo 重新打开使用 POST /api/v1/todos/{id}/reopen。
- Phase 1A 不做 cancel API。
- PATCH /api/v1/todos/{id} 禁止修改 status 和系统字段。
- GET /api/v1/todos 默认返回未删除 pending Todo，completed 需显式请求。
- Todo 列表使用 cursor 分页。
- Todo 列表基础筛选：status, category_id, planned_date, due_from, due_to, limit, cursor。
- Category 排序使用 sort_order ASC, created_at ASC。
- Inbox 可改显示属性，但不可删除/取消 Inbox 身份。

当前剩余实现前决策：

1. GET /api/v1/todos/{id} 对软删除 Todo 返回 404 not_found 还是 410 deleted_resource。
2. bootstrap token hash 算法。
3. idempotency request hash 算法。
4. Todo list opaque cursor 格式。
5. PC Web token 存储方式。
6. 是否现在把 api-phase1a.md 中的 Open Implementation Decisions 收口后再进入代码骨架。

你的下一步任务：

先不要写代码。请继续使用 $grill-me 或等价方式，对 Phase 1A 剩余实现前决策进行拷问并收口。每次只问一个关键问题，并给出你的推荐答案。收口后，把结论更新到：

- D:\LifeOS\docs\api-phase1a.md
- 必要时同步 D:\LifeOS\docs\data-model-phase1.md 或 D:\LifeOS\docs\architecture.md

只有当这些实现前决策收口后，才进入后端代码骨架设计。
```
