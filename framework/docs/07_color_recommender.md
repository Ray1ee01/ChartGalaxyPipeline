# 色彩推荐模块 (color_recommender)

色彩推荐模块（`color_recommender`）是 ChartPipeline 框架的第五个处理环节，负责为可视化推荐和生成协调的配色方案。

## 功能简介

本模块分析数据结构和内容，为可视化设计推荐最佳的配色方案。良好的色彩设计不仅能提升视觉美感，更能强化数据间的关系，突出关键信息，引导用户正确理解数据。模块会考虑色彩心理学原理、可访问性标准和数据特性，生成既美观又实用的配色方案。

## 输入与输出

### 输入

模块接收包含以下字段的数据对象：

- `metadata`: 原始元数据（包含标题、描述等）
- `data`: 列定义，包含各列的数据类型和角色 + 数据元素
- `datafacts`: 数据洞察

### 输出

模块向输入数据添加 `colors` 字段，结构如下：

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

### 色彩字段说明

| 字段 | 类型 | 描述 |
|------|------|------|
| `field` | 对象 | 特定字段值的强制色彩映射，使用直接映射形式（如 `{"US": "blue"}`） |
| `other` | 对象 | 其他需要强制指定的色彩，使用命名键（如 `{"primary": "#E63946", "secondary": "#457B9D"}`）。其中primary是指整个chart使用统一的色调；secondary是指例如第二个chart（存在composite）的颜色。 |
| `available_colors` | 数组 | 提供了一些供你随意使用的其他颜色 |
| `background_color` | 字符串 | 整体背景色。大部分情况下不需要添加背景，空白即可。 |
| `text_color` | 字符串 | 文本内容的色彩 |
其他颜色不做强制要求，自行选择。

## 色彩选择原则

模块遵循以下原则选择和推荐色彩：

1. **数据类型匹配**
   - 分类数据：使用差异明显的离散色彩
   - 序列数据：使用同一色调的不同明度/饱和度
   - 发散数据：使用双色调渐变表示正负或高低差异

2. **感知可访问性**
   - 确保足够的对比度（符合 WCAG 标准）
   - 考虑色盲友好性（避免红-绿等易混淆组合）
   - 在灰度下仍保持可区分性

3. **语义一致性**
   - 利用色彩的文化和心理联想（如红色表示警告/热，蓝色表示冷静/冷）
   - 保持数据语义与色彩感知的一致性

4. **美学协调**
   - 使用协调的色彩组合（如互补色、类似色等）
   - 考虑品牌色彩和目标环境

## 支持的色彩映射类型

模块支持多种色彩映射类型：

- **分类映射**：为不同类别指定不同色彩
- **序列映射**：使用单色系渐变表示数值大小
- **发散映射**：使用双色系渐变表示偏离中心点的两个方向
- **强调映射**：突出特定数据点或区域

## 使用示例

### 命令行调用

```bash
python -m modules.color_recommender.color_recommender --input input_data.json --output output_data.json
```

### 程序调用

```python
from modules.color_recommender.color_recommender import process

success = process(input='input_data.json', output='output_data.json')
if success:
    print("色彩推荐完成")
else:
    print("色彩推荐失败")
```
