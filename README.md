# ChartPipeline Framework

![ChartPipeline Logo](./assets/logo.png)

## 简介

ChartPipeline 是一个模块化的数据可视化生成框架，将原始数据转换为图表。框架包含九个模块，自动推荐图表类型、提取数据洞察、生成标题、配色方案和视觉元素。

## 架构

```
输入数据 → [1.图表类型推荐] → [2.数据洞察] → [3.标题生成] → [4.布局推荐] → [5.色彩推荐] → [6.图像推荐] → [7.图表生成] → [8.标题样式化] → [9.布局优化] → 最终输出
```

模块1-6：通过JSON对象传递数据，每个模块添加特定字段  
模块7-8：基于JSON配置生成SVG元素  
模块9：合成最终可视化作品

## 数据格式

### 输入格式

```json
{
  "description": "A global restaurant chain analyzes market share in major cities to inform expansion strategy and resource allocation.",
  "data": {
    "data": [
      {
        "City": "New York",
        "Revenue": 8500.0
      },
      {
        "City": "Tokyo",
        "Revenue": 9200.0
      },
      {
        "City": "Sao Paulo",
        "Revenue": 6800.0
      }
    ],
    "columns": [
      {
        "name": "City",
        "description": "City where the restaurant is located",
        "data_type": "categorical",
        "unit": ""
      },
      {
        "name": "Revenue",
        "description": "Annual restaurant industry revenue",
        "data_type": "numerical",
        "unit": "$m"
      }
    ],
    "type_combination": "categorical + numerical"
  },
  "metadata": {
    "title": "Restaurant Industry Revenue: New York vs. Tokyo vs. Sao Paulo",
    "description": "A global restaurant chain analyzes market share in major cities to inform expansion strategy and resource allocation.",
    "main_insight": "Tokyo consistently leads in restaurant industry revenue, demonstrating a strong and growing market compared to New York and Sao Paulo."
  }
}
```

### 处理后格式

```json
{
  "description": "数据描述",
  "data": { "data": [...], "columns": [...], "type_combination": "..." },
  "metadata": { "title": "...", "description": "...", "main_insight": "..." },
  "titles": {
    "main_title": "主标题",
    "sub_title": "副标题"
  },
  "secondary_data": [],
  "variables": {
    "width": 600,
    "height": 600,
    "has_rounded_corners": false,
    "has_shadow": false,
    "has_spacing": false,
    "has_gradient": false,
    "has_stroke": false
  },
  "typography": {
    "title": { "font_family": "Arial", "font_size": "28px", "font_weight": 700 },
    "description": { "font_family": "Arial", "font_size": "16px", "font_weight": 500 },
    "label": { "font_family": "Arial", "font_size": "16px", "font_weight": 500 },
    "annotation": { "font_family": "Arial", "font_size": "12px", "font_weight": 400 }
  },
  "processed": true,
  "datafacts": [
    {
      "type": "value",
      "subtype": "max",
      "data_points": [...],
      "score": 0.92,
      "annotation": "数据洞察注释",
      "reason": "洞察理由"
    }
  ],
  "colors": {
    "field": { "Tokyo": "#9e1214", "New York": "#6381f1" },
    "other": { "primary": "#9e1214", "secondary": "#5ea9f6" },
    "available_colors": [...],
    "background_color": "#E2F1F6",
    "text_color": "#414141"
  },
  "colors_dark": {
    "field": { "Tokyo": "#fb484a", "New York": "#b5c4fb" },
    "other": { "primary": "#fb484a", "secondary": "#abd4fe" },
    "available_colors": [...],
    "background_color": "#203a43",
    "text_color": "#a38e8e"
  },
  "images": {
    "other": { "primary": "base64_encoded_image_data" }
  }
}
```

## 模块详解

### 1. 图表类型推荐模块 (chart_type_recommender)

分析数据特征并推荐合适的图表类型。

**输入**: 初始数据对象

**输出**:
```json
{
  "chart_type": [
    {
      "type": "vertical_stacked_bar_chart",
      "confidence": 0.92,
      "reasoning": "选择堆叠柱状图是因为需要比较不同时间段内两种状态的分布情况，同时展示总量变化趋势"
    }
  ]
}
```

### 2. 数据洞察模块 (datafact_generator)

分析数据并提取关键洞察。

**输入**: 包含chart_type的数据对象

**输出**:
```json
{
  "datafacts": [
    {
      "type": "trend",
      "score": 0.95,
      "annotation": "紧急状态宣布数量总体呈上升趋势",
      "reason": "从1976年至2022年，每十年宣布的国家紧急状态总数从1个增长到平均每十年超过15个"
    }
  ]
}
```

### 3. 标题生成模块 (title_generator)

基于数据内容和洞察生成标题和副标题。

**输入**: 包含chart_type和datafacts的数据对象

**输出**:
```json
{
  "titles": {
    "main_title": "美国国家紧急状态持续增长",
    "sub_title": "1976年以来宣布的紧急状态中大多数仍然有效"
  }
}
```

### 5. 色彩推荐模块 (color_recommender)

为可视化推荐配色方案。

**输入**: 包含chart_type、datafacts、titles和layout的数据对象

**输出**:
```json
{
  "colors": {
    "field": { "US": "blue", "China": "red" },
    "other": { "primary": "#E63946", "secondary": "#457B9D" },
    "available_colors": ["#A9D700", "#FFD700"],
    "background_color": "#FFFFFF",
    "text_color": "#1D3557"
  }
}
```

### 6. 图像推荐模块 (image_recommender)

推荐与图表内容相关的图像和图标元素。

**输入**: 包含chart_type、datafacts、titles、layout和colors的数据对象

**输出**:
```json
{
  "images": {
    "field": {
      "Still active": "data:image/svg+xml;base64,...",
      "Ended": "data:image/svg+xml;base64,..."
    },
    "other": {
      "primary": "data:image/svg+xml;base64,...",
      "man": "data:image/svg+xml;base64,..."
    }
  }
}
```

### 7. 图表模板实现引擎 (chart_engine)

基于前面模块的输出生成图表的SVG表示。支持ECharts和D3.js渲染引擎。

**输入**: JSON数据对象

**输出**:
```json
{
  "chart_svg": "<svg width=\"800\" height=\"500\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

### 8. 标题元素生成模块 (title_styler)

为标题和副标题生成SVG元素。

**输入**: JSON数据对象

**输出**:
```json
{
  "title_svg": "<svg width=\"800\" height=\"100\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

## 使用方式

### 安装

```bash
git clone https://github.com/yourusername/ChartPipeline.git
cd ChartPipeline
pip install -r requirements.txt
```

### 信息图生成（推荐）

```bash
# 批量处理
python pipeline.py --modules infographics_generator --input /path/to/input/data --output /path/to/output --threads 12

# 指定图表类型
python pipeline.py --modules infographics_generator --input /path/to/input/data --output /path/to/output --threads 12 --chart-name donut_chart_03_d3_hand
```

### 完整流水线

```bash
# 单个文件处理（模块1-9）
python pipeline.py --modules all --input /path/to/data.json --output /path/to/output --threads 1
```

### 图表引擎独立使用

```bash
# 生成SVG图表
python -m modules.chart_engine.chart_generation --input /path/to/data.json --output chart.svg --name chart_type_name

# 生成HTML调试版本
python -m modules.chart_engine.chart_generation --input /path/to/data.json --output chart.svg --name chart_type_name --html debug.html
```

### 参数说明

- `--modules`: 模块集合（`infographics_generator` 或 `all`）
- `--input`: 输入数据路径
- `--output`: 输出路径
- `--threads`: 并行线程数
- `--chart-name`: 图表类型名称（可选）
- `--html`: 输出HTML调试文件（仅chart_engine支持）

## 扩展

- [如何编写Chart variation](docs/how_to_write_a_variation.md)  
- [图表类型文档](docs/chart_types_documentation.md)

## 示例

请参考 `test/` 目录下的示例数据和输出。