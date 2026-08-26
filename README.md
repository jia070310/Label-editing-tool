# 柠檬标签工具

桌面端标签设计与打印工具（Electron），按毫米尺寸精确输出。

仓库：https://github.com/jia070310/Label-editing-tool

## 下载

请到 [Releases](https://github.com/jia070310/Label-editing-tool/releases) 下载：

- **安装包** `Lemon-Label-Tool-*-x64.exe`
- **绿色版** `Lemon-Label-Tool-*-portable.exe`

## 反馈日志

首页点击「反馈日志」，或在打印/崩溃报错时导出日志文本（仅本机保存，不联网）。把文件发给开发者即可协助排查。

## 开发启动

```bash
npm install
npm run desktop
```

仅前端预览（调试界面，不用于正式打印）：

```bash
npm run dev
```

## 打包

```bash
npm run dist
```

产物输出到 `release/`。

## 主要功能

- **新建模板**：按宽度/高度（mm）创建空白标签
- **表格**：增减行列、合并/拆分、行高列宽、右键插入/删除、双击编辑
- **拖拽**：移动、缩放；线条/矩形可旋转
- **元素**：文本、矩形、线条、条码、二维码、日期、警示语
- **变量与批量打印**：CSV 导入、自动翻译英文、预览后批量打印
- **打印**：Windows 按物理毫米尺寸直打
- **保存**：本地模板列表（localStorage）
