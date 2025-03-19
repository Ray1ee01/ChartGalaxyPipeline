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
│   ├── echarts-py/         # Python生成的ECharts模板
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

1. 准备JSON格式的输入数据（参考`input.json`）
2. 运行主程序生成SVG图表:

```bash
python make_svg.py
```

默认情况下，程序将读取`input.json`文件并生成SVG输出到`tmp/`目录。

### 添加新模板

1. 根据图表类型，在相应的模板目录（`echarts-py/`、`echarts-js/`或`d3-js/`）中创建新模板文件
2. 确保模板文件包含以下格式的要求声明:

```
REQUIREMENTS_BEGIN
{
    "chart_type": "你的图表类型",
    "description": "图表描述",
    "min_width": 400,
    "min_height": 300
}
REQUIREMENTS_END
```

3. 实现创建图表选项的函数（对于`echarts-py`）或完整的渲染代码（对于JavaScript模板）
4. 模板文件可以放在子目录下，系统会自动递归扫描

## 依赖项

- Python 3.8+
- Node.js和npm（用于HTML到SVG的转换）
- Puppeteer（用于使用浏览器渲染SVG）

## 开发指南

### 调试

可以通过设置环境变量来控制日志级别:

```bash
export DEBUG=True
python make_svg.py
```

### 添加新的渲染引擎

1. 在`utils/load_charts.py`中添加新的加载函数
2. 在`template_registry.py`中添加新的模板类型
3. 更新`render_chart_to_svg`函数以支持新的引擎 