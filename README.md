# LifeOS

LifeOS 是一个在本机运行的个人工作台。PC 网页版可以管理待办、项目与目标，记录笔记和 AI 会话；配置 DeepSeek 后，还可以用 **Plan my day** 生成今日计划建议。

## Windows 快速开始

**下载源码后不能直接双击使用。** 只看代码不需要安装任何环境。想在 Windows 上运行，首次需要安装运行环境、配置 PostgreSQL 并安装项目依赖。之后可以用仓库自带的启动脚本一次启动后端和网页。

仓库提供 `setup-lifeos.ps1`，用于检查环境和安装项目依赖。它不会安装系统工具、启动服务或修改数据库，也不会覆盖已有配置。

### 1. 安装环境并获取源码

| 工具 | 要求 |
| --- | --- |
| [PowerShell 7](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows) | 终端中能运行 `pwsh` |
| [Python](https://www.python.org/downloads/windows/) | 3.11 或更新版本，确保终端中能运行 `python` |
| [Node.js](https://nodejs.org/en/download) | 建议 24 LTS，或 22.13 及以上的 22.x，安装时保留 npm |
| [PostgreSQL](https://www.postgresql.org/download/windows/) | 本机数据库服务，以下示例用默认端口 `5432`，可用 pgAdmin 管理 |

如果装了 Git，打开 PowerShell 7 后运行：

```powershell
git clone https://github.com/a1143301680-wq/LifeOS.git
cd LifeOS
```

不装 Git 也可以在 GitHub 点击 **Code → Download ZIP**，解压后在含有 `start-lifeos.ps1` 的目录打开 PowerShell 7。以下 PowerShell 命令均从该目录运行。

### 2. 一键安装项目依赖

在 PowerShell 7 中运行：

```powershell
pwsh -NoProfile -File .\setup-lifeos.ps1
```

脚本会检查 Python、Node.js 和 npm，创建项目专用的 Python 环境，安装前后端依赖，并在缺少 `backend/.env` 时从模板生成。仅想检查环境、不安装依赖时，在命令末尾加 `-CheckOnly`。

如果想手动安装，可以用以下命令代替脚本：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .\backend
Push-Location .\web
npm.cmd ci --include=dev
Pop-Location
```

### 3. 创建并配置自己的数据库

启动 PostgreSQL。在 pgAdmin 中用 PostgreSQL 管理员账号连接本机服务器，选中默认的 `postgres` 数据库并打开 **Query Tool**。将示例里的密码换成自己的密码，然后**分两次**执行以下两行 SQL，不要一起执行：

```sql
CREATE ROLE lifeos WITH LOGIN PASSWORD 'replace-with-your-password';
CREATE DATABASE lifeos OWNER lifeos;
```

如已建好账号和数据库，可以跳过创建，直接使用自己的连接信息。首次体验建议用一个独立的空数据库。

如果走的是手动安装流程，可以用下列命令补建配置文件；运行过配置脚本的组员可跳过：

```powershell
if (-not (Test-Path .\backend\.env)) {
    Copy-Item .\backend\.env.example .\backend\.env
}
```

如果已有 `backend/.env`，直接编辑，不要覆盖。打开该文件，将 `DATABASE_URL` 改为你的数据库连接地址：

```dotenv
DATABASE_URL=postgresql+psycopg://lifeos:replace-with-your-password@localhost:5432/lifeos
```

分隔符 `@`、`:`、`/` 等出现在密码中时，需要在连接地址里做 URL 编码。体验待办、项目和笔记不需要 API Key。想使用 **Plan my day**，再在同一个文件里填写自己的 `DEEPSEEK_API_KEY`。不要分享或提交 `backend/.env`。

### 4. 启动并登录

在 PowerShell 7 中执行下列命令。第一行让现有启动脚本使用项目自己的 Python，第二行启动服务。这也是以后从新终端启动的方法，不用重复安装依赖。

```powershell
$env:Path = (Resolve-Path .\.venv\Scripts).Path + ';' + $env:Path
.\start-lifeos.cmd -LocalOnly
```

启动脚本会迁移数据库、初始化本地身份并打开 [LifeOS 网页](http://127.0.0.1:5173/)；没有自动打开时可手动访问。首次启动空数据库时，窗口会打印 `me:` 和 `partner:` 两个身份的登录凭证。复制 `me:` 后面的值，粘贴到网页的 **Identity token** 输入框登录。

凭证只在创建身份时显示，重启不会重新打印，请私下保管。登录后可以先创建一条待办，再刷新网页确认记录仍在。

## 停止与排查

- **停止：** 双击 `stop-lifeos.cmd`。默认只停止 LifeOS 的网页和后端，PostgreSQL 保持运行。关闭启动窗口也不会停止服务。
- **配置脚本无法运行：** 如果提示执行策略禁止运行脚本，在确认源码可信且机器没有组织策略限制的前提下，可在启动配置脚本的命令中加上 `-ExecutionPolicy Bypass`（放在 `-File` 前）。只对这一次 PowerShell 进程生效，不改系统策略。
- **数据库报错：** 先确认 PostgreSQL 在运行，再检查 `backend/.env` 的账号、密码、端口和数据库名。
- **网页打不开：** 查看启动窗口的报错，确认后端端口 `8000` 和网页端口 `5173` 未被其他应用占用。启动日志位于 `%TEMP%\LifeOS\run`。

如需开发资料，可查看[后端](backend/README.md)、[PC 网页](web/README.md)或 [Android](android/README.md) 的说明。体验 PC 网页不需要安装 Android 开发环境。
