# KindlePress

KindlePress 是一个 Windows 优先的 Electron 桌面应用，用来把本地 PDF 教材和本地 Markdown 学习书籍目录转换成适合 Kindle 6-7 寸设备阅读的重排文本 PDF。

## 功能

- PDF 输入：使用 PDF.js 渲染页面，再用本地离线 Tesseract.js 进行中英双语 OCR。
- Markdown 输入：选择本地文件夹，递归扫描 `.md` / `.markdown` 文件并按文件名合并。
- Kindle PDF 导出：通过 Electron `printToPDF` 生成小尺寸重排 PDF。
- 页面设置：内置通用 6 寸、Paperwhite 6.8 寸和自定义尺寸。
- 排版设置：支持字体、字号、行距、边距和 OCR DPI。
- 任务体验：单任务转换、阶段进度、日志和取消任务。

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 当前边界

- 第一版只支持本地 PDF 文件和本地 Markdown 文件夹。
- PDF OCR 以文本重排为主，不承诺高保真还原公式、复杂表格或多栏版式。
- 当前优先验证 Windows；macOS/Linux 打包需要后续补充平台验证。
