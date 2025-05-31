# ECharts SVG Rendering Framework

该项目是一个灵活的图表渲染框架，可以将ECharts和D3.js生成的图表转换为SVG格式，支持多种图表类型和渲染方式。

## 功能特点

- 支持多种渲染引擎:
  - ECharts JavaScript API
  - Python生成的ECharts配置
  - D3.js图表
- 提供统一的SVG输出格式
- 支持递归扫描的模板系统，可以轻松添加新的图表类型
- 本地托管JavaScript库，减少外部依赖
- 高度可配置的渲染选项
- 完善的错误处理和日志记录

## 项目结构

```
framework/
├── make_svg.py             # 主程序入口点
├── template/               # 图表模板目录
│   ├── d3-js/              # D3.js模板
│   ├── echarts-js/         # ECharts JavaScript模板
│   ├── echarts_py/         # Python生成的ECharts模板
│   └── template_registry.py # 模板注册和管理
├── utils/                  # 工具函数
│   ├── file_utils.py       # 文件操作函数
│   ├── html_to_svg.py      # HTML到SVG的转换
│   └── load_charts.py      # 图表加载和渲染
├── scripts/                # 辅助脚本
├── static/                 # 静态资源
│   └── lib/                # 本地JavaScript库
└── data/                   # 示例数据
```

## 使用方法

### 基本用法

1. 准备JSON格式的输入数据
2. 运行主程序生成SVG图表:

```bash
python modules/chart_engine/chart_engine.py --input test/input.json --name donut_chart_01 --output tmp.svg
python modules/chart_engine/chart_engine.py --input test/testset/data/55.json --name donut_chart_01 --output tmp.svg
```

参数说明:
- `--input`: 输入JSON文件路径
- `--name`: 图表类型名称
- `--output`: 输出SVG文件路径
- `--html`: 输出HTML文件路径（可选），用于调试和修改图表代码

### HTML调试模式

使用`--html`参数可以同时导出HTML格式的图表：

```bash
python modules/chart_engine/chart_engine.py --input test/input.json --name donut_chart_01 --html debug.html
```

HTML模式的优势:
- 便于在浏览器中调试图表代码
- 可以直接修改和测试图表样式和行为
- 在开发新模板或解决复杂渲染问题时特别有用

### 添加新模板

如需了解如何创建新的图表模板，请参考文档 `docs/how_to_write_a_template.md`

## 依赖项

- Python 3.8+
- Node.js和npm（用于HTML到SVG的转换）
- Puppeteer（用于使用浏览器渲染SVG）

## 开发指南


### 添加新的渲染引擎

1. 在`utils/load_charts.py`中添加新的加载函数
2. 更新`render_chart_to_svg`函数以支持新的引擎 