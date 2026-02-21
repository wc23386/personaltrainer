# API 說明

## save-post（儲存部落格文章）

用於文章編輯器直接將文章與圖片寫入 GitHub 倉庫。

### 環境變數（Vercel）

在 Vercel 專案設定中新增：

| 變數 | 說明 |
|------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token，需勾選 `repo` 權限 |
| `GITHUB_REPO` | 倉庫名稱，格式：`owner/repo`（例如 `myuser/personaltrainer`） |
| `GITHUB_BRANCH` | 選填，預設為 `main` |

### 行為

- 接收 POST JSON：`title`, `date`, `slug`, `excerpt`, `content`, 選填 `ig_link`、`image: { data: base64, extension }`
- 在倉庫中新增或更新：
  - `_posts/YYYY-MM-DD-slug.md`（文章）
  - 若有上傳圖片：`img/programs/blog_<slug>.<ext>`（並在 front matter 寫入 `image`）
- 儲存後需重新建站（Vercel 會依 Git 推送自動建站），文章才會出現在「專業分享」頁面

### 本地測試

`bundle exec jekyll serve` 僅負責靜態網站，不會執行 API。要測試「儲存文章」請：

- 使用 `vercel dev` 在本地跑含 API 的環境，或
- 部署到 Vercel 後在正式/預覽網址使用文章編輯器
