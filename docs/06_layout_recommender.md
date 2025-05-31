# 布局/变体推荐模块 (layout_recommender)

布局/变体推荐模块（`layout_recommender`）是 ChartPipeline 框架的第四个处理环节，负责推荐最佳的图表布局和视觉变体选项。

## 功能简介

本模块分析前序模块的输出，为可视化设计推荐最佳的布局组织和视觉呈现方式。这包括各元素（标题、图表、图像）的相对位置，以及各种视觉变体选项，如背景样式、标签方式和轴配置等。模块的目标是确保最终可视化具有良好的组织结构和视觉层次，最大化信息传递效果。

## 输入与输出

### 输入

模块接收包含以下字段的数据对象：

- `chart_type`: 图表类型推荐
- `datafacts`: 数据洞察
- `titles`: 生成的标题和副标题

### 输出

模块向输入数据添加 `layout` 和 `variation` 字段，结构如下：

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

### 布局字段说明

| 字段 | 类型 | 描述 | 可选值 |
|------|------|------|--------|
| `title_to_chart` | 字符串 | 标题相对于图表的位置 | `T`（上方）, `B`（下方）, `L`（左侧）, `R`（右侧）, `I`（内嵌） |
| `image_to_chart` | 字符串 | 图像相对于图表的位置 | `TL`（左上）, `TR`（右上）, `BL`（左下）, `BR`（右下）, `I`（内嵌） |
| `title_to_image` | 字符串 | 标题相对于图像的位置 | `T`（上方）, `B`（下方）, `L`（左侧）, `R`（右侧） |
| `chart_contains_title` | 布尔值 | 图表是否包含标题 | `true`, `false` |
| `chart_contains_image` | 布尔值 | 图表是否包含图像 | `true`, `false` |

### 变体字段说明

| 字段 | 类型 | 描述 | 可选值 |
|------|------|------|--------|
| `background` | 字符串 | 背景风格 | `no`（无）, `solid`（纯色）, `gradient`（渐变）, `texture`（纹理） |
| `image_chart` | 字符串 | 图像与图表的关系 | `side`（并排）, `overlay`（覆盖）, `background`（作为背景） |
| `image_title` | 字符串 | 图像与标题的关系 | `side`（并排）, `integrated`（整合）, `background`（作为背景） |
| `icon_mark` | 字符串 | 数据标记的图标样式 | `none`（无）, `simple`（简单图标）, `detailed`（详细图标） |
| `axis_label` | 字符串 | 轴标签样式 | `none`（无）, `simple`（简单）, `detailed`（详细） |
| `axes` | 对象 | 轴显示配置 | 包含 `x_axis` 和 `y_axis` 的显示设置 |

## 使用示例

### 命令行调用

```bash
python -m modules.layout_recommender.layout_recommender --input input_data.json --output output_data.json
```

### 程序调用

```python
from modules.layout_recommender.layout_recommender import process

success = process(input='input_data.json', output='output_data.json')
if success:
    print("布局推荐完成")
else:
    print("布局推荐失败")
```
