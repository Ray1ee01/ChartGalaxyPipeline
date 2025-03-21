# ChartPipeline Framework

![ChartPipeline Logo](./assets/logo.png)

## 简介

ChartPipeline 是一个模块化、可扩展的数据可视化生成框架，通过一系列专业化模块，将原始数据转换为具有高度设计感和信息表达力的图表。该框架遵循数据驱动的设计原则，自动推荐最佳的图表类型、数据洞察、布局、配色方案和视觉元素，最终生成一份完整的可视化作品。

## 核心模块：图表模板实现引擎 (chart_engine)

**图表模板实现引擎**是ChartPipeline框架的核心渲染引擎，负责将配置信息转换为可视化图表。

### 主要特点

- 支持多种渲染引擎：ECharts (Python/JavaScript) 和 D3.js
- 提供统一的SVG输出格式
- 基于模板系统实现多种图表类型
- 支持递归扫描的模板目录，可以轻松添加新图表类型

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

### 开发新模板

如需创建自己的图表模板，请参考[如何编写图表模板](docs/how_to_write_a_template.md)文档。
了解支持的图表类型及其数据要求，请参考[图表类型文档](docs/chart_types_documentation.md)。

## 目录

- [框架架构](#框架架构)
- [数据流程](#数据流程)
- [初始数据格式](#初始数据格式)
- [模块详解](#模块详解)
  - [1. 图表类型推荐模块](#1-图表类型推荐模块-chart_type_recommender)
  - [2. 数据洞察模块](#2-数据洞察模块-datafact_generator)
  - [3. 标题生成模块](#3-标题生成模块-title_generator)
  - [4. 布局/变体推荐模块](#4-布局变体推荐模块-layout_recommender)
  - [5. 色彩推荐模块](#5-色彩推荐模块-color_recommender)
  - [6. 图像推荐模块](#6-图像推荐模块-image_recommender)
  - [7. 图表模板实现引擎](#7-图表模板实现引擎-chart_engine)
  - [8. 标题元素生成模块](#8-标题元素生成模块-title_styler)
  - [9. 布局优化模块](#9-布局优化模块-layout_optimizer)
- [安装与使用](#安装与使用)
  - [安装依赖](#安装依赖)
  - [模块执行示例](#模块执行示例)
  - [完整管道执行](#完整管道执行)
- [示例案例](#示例案例)
- [扩展指南](#扩展指南)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

## 框架架构

ChartPipeline 采用模块化设计，每个模块专注于可视化生成流程中的特定阶段：

```
输入数据 → [1.图表类型推荐] → [2.数据洞察] → [3.标题生成] → [4.布局推荐] → [5.色彩推荐] → [6.图像推荐] → [7.图表生成] → [8.标题样式化] → [9.布局优化] → 最终输出
```

每个模块独立工作，接收上一步骤的输出作为输入，并向数据对象添加新的信息或生成最终视觉元素。这种设计确保了系统的可扩展性和每个组件的可替换性。

## 数据流程

ChartPipeline 中的数据流遵循以下规则:

1. **JSON传递**: 模块1-6通过修改并扩展同一个JSON对象工作，每个模块向其添加特定字段
2. **SVG生成**: 模块7-8基于累积的JSON配置生成独立的SVG元素
3. **最终合成**: 模块9将生成的SVG元素组合成最终的可视化作品

## 初始数据格式

系统的输入是一个标准化的JSON对象，包含以下主要部分:

```json
{
  "metadata": {
    "title": "The United States of Emergency",
    "description": "Number of national emergencies declared in the United States since 1976, by current status",
    "main_insight": "The number of national emergencies declared in the US has generally increased over time, with a significant number of those declared since 2000 still active."
  },
  "data_columns": [
    {
      "name": "Time Period",
      "importance": "primary",
      "description": "Time periods of national emergencies declared",
      "unit": "none",
      "data_type": "time",
      "role": "x"
    },
    {
      "name": "Binary",
      "importance": "primary",
      "description": "Binary for the corresponding status",
      "unit": "none",
      "data_type": "number",
      "role": "y"
    },
    {
      "name": "Status",
      "importance": "primary",
      "description": "The status of the data point",
      "unit": "none",
      "data_type": "categorical",
      "role": "group"
    }
  ],
  "data": [
    {
      "Time Period": "'76-'79",
      "Binary": 1,
      "Status": "Still active"
    },
    {
      "Time Period": "'80-'89",
      "Binary": 7,
      "Status": "Ended"
    },
    {
      "Time Period": "'90-'99",
      "Binary": 6,
      "Status": "Still active"
    },
    {
      "Time Period": "'90-'99",
      "Binary": 14,
      "Status": "Ended"
    },
    {
      "Time Period": "'00-'09",
      "Binary": 11,
      "Status": "Still active"
    },
    {
      "Time Period": "'00-'09",
      "Binary": 5,
      "Status": "Ended"
    },
    {
      "Time Period": "'10-'19",
      "Binary": 15,
      "Status": "Still active"
    },
    {
      "Time Period": "'10-'19",
      "Binary": 3,
      "Status": "Ended"
    },
    {
      "Time Period": "'20-'22",
      "Binary": 8,
      "Status": "Still active"
    },
    {
      "Time Period": "'20-'22",
      "Binary": 1,
      "Status": "Ended"
    }
  ]
}
```

## 模块详解

每个模块被设计为专注于可视化生成流程中的特定功能，以下是各个模块的详细说明：

### 1. 图表类型推荐模块 (chart_type_recommender)

**功能**: 分析数据特征并推荐最合适的图表类型。

**输入字段**: 初始数据对象

**输出字段**:
```json
{
  "chart_type": [
    {
      "type": "vertical_stacked_bar_chart",
      "confidence": 0.92,
      "reasoning": "选择堆叠柱状图是因为需要比较不同时间段内两种状态的分布情况，同时展示总量变化趋势"
    },
    {
      "type": "grouped_bar_chart",
      "confidence": 0.75,
      "reasoning": "分组柱状图适合清晰对比不同时期内各状态的具体数值"
    },
    {
      "type": "area_chart",
      "confidence": 0.68,
      "reasoning": "面积图能够体现紧急状态总量随时间的变化趋势"
    }
  ]
}
```

**核心功能**:
- 基于数据结构和类型自动推荐多种适合的图表类型
- 为每种图表类型提供置信度评分
- 给出每种推荐的理由和解释

### 2. 数据洞察模块 (datafact_generator)

**功能**: 分析数据并提取关键洞察，用于增强可视化的信息价值。

**输入字段**: 包含chart_type的数据对象

**输出字段**:
```json
{
  "datafacts": [
    {
      "type": "trend",
      "score": 0.95,
      "annotation": "紧急状态宣布数量总体呈上升趋势",
      "reason": "从1976年至2022年，每十年宣布的国家紧急状态总数从1个增长到平均每十年超过15个"
    },
    {
      "type": "proportion",
      "score": 0.92,
      "annotation": "2010年代83%的紧急状态仍然活跃",
      "reason": "在2010-2019期间宣布的18个紧急状态中，15个仍处于活跃状态，只有3个已结束"
    },
    {
      "type": "difference",
      "score": 0.88,
      "annotation": "90年代结束的紧急状态最多",
      "reason": "1990-1999年期间有14个紧急状态被结束，是所有时期中最高的"
    },
    {
      "type": "trend",
      "score": 0.85,
      "annotation": "结束的紧急状态比例逐年减少",
      "reason": "从1980年代的100%结束率到2020年代仅11%的结束率，显示出明显下降趋势"
    },
    {
      "type": "value",
      "score": 0.82,
      "annotation": "总计41个紧急状态仍然活跃",
      "reason": "所有时期加总，仍处于活跃状态的紧急状态数量为41个，远高于已结束的30个"
    }
  ]
}
```

**核心功能**:
- 自动识别数据中的趋势、比例、差异和关键值
- 按照重要性对洞察进行评分排序
- 为每个洞察提供简洁的注释和详细理由

### 3. 标题生成模块 (title_generator)

**功能**: 基于数据内容和洞察生成有吸引力的标题和副标题。

**输入字段**: 包含chart_type和datafacts的数据对象

**输出字段**:
```json
{
  "titles": {
    "main_title": "美国国家紧急状态持续增长",
    "sub_title": "1976年以来宣布的紧急状态中大多数仍然有效"
  }
}
```

**核心功能**:
- 通过分析数据洞察自动生成引人注目的主标题
- 生成补充主标题并提供额外上下文的副标题
- 确保标题简洁明了并传达核心信息

### 4. 布局/变体推荐模块 (layout_recommender)

**功能**: 推荐最佳的图表布局和视觉变体选项。

**输入字段**: 包含chart_type、datafacts和titles的数据对象

**输出字段**:
```json
{
  "layout": {
    "title_to_chart": "T",
    "image_to_chart": "BL",
    "title_to_image": "L",
    "chart_contains_title": false,
    "chart_contains_image": false
  },
  "variation": {
    "background": "no",
    "image_chart": "side",
    "image_title": "side",
    "icon_mark": "none",
    "axis_label": "none",
    "axes": {
      "x_axis": "yes",
      "y_axis": "yes"
    }
  }
}
```

**核心功能**:
- 推荐各元素（标题、图表、图像）的相对位置
- 提供图表变体选项，如背景、标签和轴配置
- 设计符合最佳可视化实践的整体布局结构

### 5. 色彩推荐模块 (color_recommender)

**功能**: 为可视化推荐和生成协调的配色方案。

**输入字段**: 包含chart_type、datafacts、titles和layout的数据对象

**输出字段**:
```json
{
  "colors": {
    "field": {
      "US": "blue",
      "China": "red",
      "Russia": "green",
      "Germany": "yellow",
      "Brazil": "purple"
    },
    "other": {
      "primary": "#E63946",
      "secondary": "#457B9D"
    },
    "available_colors": ["#A9D700", "#FFD700", "#008080", "#4B0082"],
    "background_color": "#FFFFFF",
    "text_color": "#1D3557"
  }
}
```

**核心功能**:
- 生成视觉协调的配色方案
- 为不同数据类别分配适当的色彩映射
- 确保文本和背景颜色之间有足够的对比度
- 支持通过 `required_field_color` 直接为特定数据值指定颜色，无需字段结构

### 6. 图像推荐模块 (image_recommender)

**功能**: 推荐与图表内容相关的图像和图标元素。

**输入字段**: 包含chart_type、datafacts、titles、layout和colors的数据对象

**输出字段**:
```json
{
  "images": {
      "field": {
          "Still active": "data:image/svg+xml;base64,...",
          "Ended": "data:image/svg+xml;base64,...",
          "Time Period": "data:image/svg+xml;base64,...",
          "Status": "data:image/svg+xml;base64,..."
      },
      "other": {
          "primary": "data:image/svg+xml;base64,...",
          "man": "data:image/svg+xml;base64,...",
          "us_flag": "base64_encoded_image_data_for_us_flag"
      }
  }
}
```

**核心功能**:
- 推荐与数据标记相关的图标和视觉元素
- 为轴标签和图例提供合适的图像
- 提供增强可视化背景和上下文的辅助图像

### 7. 图表模板实现引擎 (chart_engine)

**功能**: 基于前面模块的所有输出，生成图表的SVG表示。

**输入**: 完整的JSON数据对象（包含所有前述模块的输出）

**输出**:
```json
{
  "chart_svg": "<svg width=\"800\" height=\"500\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

**核心功能**:
- 将图表类型、数据和样式配置转换为SVG格式
- 实现复杂的图表组件和交互元素
- 确保图表遵循推荐的布局和设计规范

**命令行使用**:
```bash
python modules/chart_engine/chart_engine.py --input input_data.json --output chart.svg --name chart_name
```

**程序调用**:
```python
from modules.chart_engine.chart_engine import process
success = process(input='input_data.json', output='chart.svg')
```

### 8. 标题元素生成模块 (title_styler)

**功能**: 为标题和副标题生成带有样式的SVG元素。

**输入**: 完整的JSON数据对象（包含所有前述模块的输出）

**输出**:
```json
{
  "title_svg": "<svg width=\"800\" height=\"100\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

**核心功能**:
- 为标题和副标题创建样式化的SVG元素
- 应用推荐的颜色和字体样式
- 确保标题元素与整体视觉主题一致

### 9. 布局优化模块 (layout_optimizer)

**功能**: 组合并优化图表和标题SVG元素，生成最终的可视化作品。

**输入**: chart_svg和title_svg

**输出**:
```json
{
  "final_svg": "<svg width=\"1000\" height=\"650\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

**核心功能**:
- 根据布局推荐组合图表和标题元素
- 优化元素间距和整体尺寸
- 确保最终输出在各种媒体上具有良好的可视效果

## 安装与使用

### 安装依赖

```bash
# 克隆代码库
git clone https://github.com/yourusername/ChartPipeline.git
cd ChartPipeline

# 安装依赖
pip install -r requirements.txt
```

### 模块执行示例

每个模块可以独立运行，也可以作为完整管道的一部分执行：

**1-6号模块（JSON处理模块）**:
```bash
python module_name.py --input data.json --output data.json
```

**7号模块 (chart_engine)**:
```bash
python modules/chart_engine/chart_engine.py --input data.json --output chart.svg --name chart_name
```

**8号模块 (title_styler)**:
```bash
python title_styler.py --input data.json --output title.svg
```

**9号模块 (layout_optimizer)**:
```bash
python layout_optimizer.py --input_chart chart.svg --input_title title.svg --output final.svg
```

### 完整管道执行

要执行完整的可视化生成管道：

```bash
python pipeline.py --input data.json --output final.svg
```

## 示例案例

请参考 `test/` 目录下的示例数据和输出。

## 扩展指南

### 添加新的图表模板

如需添加新的图表模板，请参考[如何编写图表模板](docs/how_to_write_a_template.md)文档，了解模板要求和创建过程。

### 图表类型参考

要了解系统支持的图表类型及其数据要求，请参考[图表类型文档](docs/chart_types_documentation.md)。

## 贡献指南

欢迎提交问题报告、功能请求和代码贡献。

## 许可证

本项目采用 MIT 许可证。详情请参阅 LICENSE 文件。